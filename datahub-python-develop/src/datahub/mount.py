"""DatahubFS — client-side mount for DataHub datasets.

dual-backend 구조: FUSE (Linux) / NFS-over-localhost (macOS·Linux 공용).
사용자는 `datahub mount` 한 가지 인터페이스만 사용하며,
백엔드는 환경 자동 감지 또는 `--backend fuse|nfs|auto` 로 명시 선택.

Architecture:
    DataHub server  →  CAB token + file manifest (logical path → physical GCS address)
    MountBackend    →  FuseBackend (Linux FUSE) or NfsBackend (NFS-over-localhost)
                       └─ GCS HTTP Range reads (lazy fetch, 서버 무경유)

Usage:
    datahub mount my-dataset /local/path --branch main
    datahub mount my-dataset /local/path --branch main --backend nfs
    open("/local/path/train.csv")   # transparent, no code change needed
    datahub umount /local/path

Requirements:
    pip install "datahub[fuse]"          # FuseBackend (Linux)
    sudo apt install fuse                # FuseBackend (Linux)
    pip install "datahub[nfs]"           # NfsBackend: datahub-nfsd 바이너리 포함 wheel

Known limitations (Phase 1 PoC):

1. **CAB 토큰 만료 (~1h)**: 마운트 후 1시간이 지나면 GCS 읽기 오류가 발생할 수 있음.
   토큰 자동 갱신(rotation)은 Phase 2 구현 대상. 장기 실행 에이전트 환경에서는
   주기적으로 umount → mount 재실행 필요.

2. **getattr 시 파일별 HEAD 요청** (FuseBackend): `ls -la` 등 stat 조회 시 파일마다
   GCS HEAD 요청이 발생. 대규모 레포(수천 개 파일)에서 첫 디렉토리 탐색이 느릴 수 있음.
   Phase 2에서 `get_file_manifest` 응답에 size 포함 → HEAD 요청 제거 예정.

3. **NfsBackend**: `datahub-nfsd` Rust 바이너리 필요 (`pip install 'datahub[nfs]'`).
   바이너리 미설치 시 RuntimeError. Rust 구현은 `datahub-nfsd` 저장소 참고.
"""

from __future__ import annotations

import errno
import json
import logging
import os
import platform
import shutil
import socket
import stat
import subprocess
import tempfile
import threading
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)

_GCS_API_BASE = "https://storage.googleapis.com/storage/v1"


# ──────────────────────────────────────────────────────────────────────────────
# MountBackend — 추상 인터페이스
# ──────────────────────────────────────────────────────────────────────────────

class MountBackend(ABC):
    """마운트 백엔드 추상 인터페이스.

    FuseBackend (Linux FUSE) 또는 NfsBackend (NFS-over-localhost)로 구현됨.
    """

    @abstractmethod
    def mount(
        self,
        token: str,
        files: list[dict],
        mountpoint: str,
        *,
        foreground: bool = False,
        debug: bool = False,
        expires_at: Optional[float] = None,
        token_refresher: Optional[Callable[[], tuple[str, float]]] = None,
    ) -> None:
        """데이터셋을 mountpoint에 마운트한다.

        Args:
            token: DataHub CAB 토큰
            files: [{"path": "...", "physical_address": "gs://..."}]
            mountpoint: 로컬 마운트 경로
            foreground: True면 포그라운드 실행 (Ctrl-C로 종료)
            debug: True면 백엔드 디버그 로그 출력
            expires_at: CAB 토큰 만료 시각 (Unix timestamp). NFS 백엔드 rotation에 사용.
            token_refresher: 토큰 갱신 콜백 `() -> (new_token, new_expires_at)`.
        """

    @abstractmethod
    def umount(self, mountpoint: str) -> None:
        """mountpoint 마운트를 해제한다."""

    @classmethod
    @abstractmethod
    def is_available(cls) -> bool:
        """현재 환경에서 이 백엔드를 사용할 수 있는지 확인."""


# ──────────────────────────────────────────────────────────────────────────────
# FuseBackend — Linux FUSE (fusepy + libfuse)
# ──────────────────────────────────────────────────────────────────────────────

class _FileEntry:
    """단일 파일의 논리 경로 → GCS 물리 주소 매핑."""

    __slots__ = ("logical_path", "bucket", "blob", "_size")

    def __init__(self, logical_path: str, physical_address: str) -> None:
        self.logical_path = logical_path.lstrip("/")
        gcs = physical_address[5:]  # strip "gs://"
        bucket, _, blob = gcs.partition("/")
        self.bucket = bucket
        self.blob = blob
        self._size: Optional[int] = None  # lazy HEAD 요청

    def size(self, token: str) -> int:
        if self._size is None:
            self._size = self._head_size(token)
        return self._size

    def _head_size(self, token: str) -> int:
        import httpx
        url = f"{_GCS_API_BASE}/b/{self.bucket}/o/{quote(self.blob, safe='')}?fields=size"
        resp = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15.0)
        if resp.status_code == 200:
            return int(resp.json().get("size", 0))
        return 0

    def gcs_read(self, token: str, offset: int, length: int) -> bytes:
        import httpx
        url = f"{_GCS_API_BASE}/b/{self.bucket}/o/{quote(self.blob, safe='')}?alt=media"
        end = offset + length - 1
        headers = {
            "Authorization": f"Bearer {token}",
            "Range": f"bytes={offset}-{end}",
        }
        resp = httpx.get(url, headers=headers, timeout=60.0)
        if resp.status_code in (200, 206):
            return resp.content
        return b""


class _DirNode:
    def __init__(self) -> None:
        self.children: dict[str, "_DirNode | _FileEntry"] = {}


def _build_tree(files: list[dict]) -> _DirNode:
    root = _DirNode()
    for f in files:
        logical = f.get("path", "").lstrip("/")
        phys = f.get("physical_address", "")
        if not logical or not phys:
            continue
        parts = logical.split("/")
        node = root
        for part in parts[:-1]:
            if part not in node.children:
                node.children[part] = _DirNode()
            child = node.children[part]
            if isinstance(child, _FileEntry):
                break
            node = child
        else:
            node.children[parts[-1]] = _FileEntry(logical, phys)
    return root


def _lookup(root: _DirNode, path: str) -> "_DirNode | _FileEntry | None":
    if path == "/" or path == "":
        return root
    parts = path.strip("/").split("/")
    node: "_DirNode | _FileEntry" = root
    for part in parts:
        if not isinstance(node, _DirNode):
            return None
        node = node.children.get(part)  # type: ignore[arg-type]
        if node is None:
            return None
    return node


class _DatahubFS:
    """LakeFS 논리 경로를 GCS HTTP Range로 매핑하는 read-only FUSE 파일시스템."""

    def __init__(self, token: str, files: list[dict], mount_time: Optional[float] = None) -> None:
        self._token = token
        self._root = _build_tree(files)
        self._mount_time = mount_time or time.time()

    def _dir_stat(self, fuse_mod):
        st = fuse_mod.c_stat()
        st.st_mode = stat.S_IFDIR | 0o555
        st.st_nlink = 2
        st.st_uid = os.getuid()
        st.st_gid = os.getgid()
        st.st_atime = st.st_mtime = st.st_ctime = self._mount_time
        return st

    def _file_stat(self, entry: _FileEntry, fuse_mod):
        st = fuse_mod.c_stat()
        st.st_mode = stat.S_IFREG | 0o444
        st.st_nlink = 1
        st.st_uid = os.getuid()
        st.st_gid = os.getgid()
        st.st_size = entry.size(self._token)
        st.st_atime = st.st_mtime = st.st_ctime = self._mount_time
        return st

    def getattr(self, path, fh=None):
        import fuse as fuse_mod
        node = _lookup(self._root, path)
        if node is None:
            raise OSError(errno.ENOENT, os.strerror(errno.ENOENT), path)
        if isinstance(node, _DirNode):
            return self._dir_stat(fuse_mod)
        return self._file_stat(node, fuse_mod)

    def readdir(self, path, fh):
        node = _lookup(self._root, path)
        if node is None or not isinstance(node, _DirNode):
            raise OSError(errno.ENOENT, os.strerror(errno.ENOENT), path)
        yield "."
        yield ".."
        for name in node.children:
            yield name

    def open(self, path, flags):
        if flags & (os.O_WRONLY | os.O_RDWR):
            raise OSError(errno.EACCES, os.strerror(errno.EACCES), path)
        node = _lookup(self._root, path)
        if node is None or not isinstance(node, _FileEntry):
            raise OSError(errno.ENOENT, os.strerror(errno.ENOENT), path)
        return 0

    def read(self, path, size, offset, fh):
        node = _lookup(self._root, path)
        if node is None or not isinstance(node, _FileEntry):
            raise OSError(errno.ENOENT, os.strerror(errno.ENOENT), path)
        data = node.gcs_read(self._token, offset, size)
        logger.debug("read %s offset=%d size=%d → %d bytes", path, offset, size, len(data))
        return data

    def getxattr(self, path, name, position=0):
        raise OSError(errno.ENODATA, os.strerror(errno.ENODATA), path)

    def listxattr(self, path):
        return []


class FuseBackend(MountBackend):
    """Linux FUSE 백엔드 (fusepy + libfuse).

    Phase 1 구현 완료. AI 에이전트 서버 환경(Linux) 대상.
    """

    @classmethod
    def is_available(cls) -> bool:
        if platform.system() != "Linux":
            return False
        try:
            import fuse  # noqa: F401
            return True
        except ImportError:
            return False

    def mount(
        self,
        token: str,
        files: list[dict],
        mountpoint: str,
        *,
        foreground: bool = False,
        debug: bool = False,
        expires_at: Optional[float] = None,
        token_refresher: Optional[Callable[[], tuple[str, float]]] = None,
    ) -> None:
        if platform.system() != "Linux":
            raise RuntimeError(
                "FuseBackend는 Linux 전용입니다.\n"
                "macOS에서는 --backend nfs 를 사용하세요 (Phase 2 예정)."
            )
        try:
            import fuse as fuse_mod
        except ImportError:
            raise RuntimeError(
                "fusepy가 필요합니다: pip install 'datahub[fuse]'\n"
                "libfuse2도 필요합니다: sudo apt install fuse"
            )
        os.makedirs(mountpoint, exist_ok=True)
        fs = _DatahubFS(token, files)
        fuse_mod.FUSE(
            fs,
            mountpoint,
            foreground=foreground,
            ro=True,
            nothreads=True,
            debug=debug,
            nonempty=True,
        )

    def umount(self, mountpoint: str) -> None:
        if os.path.exists("/usr/bin/fusermount") or os.path.exists("/bin/fusermount"):
            result = subprocess.run(["fusermount", "-u", mountpoint], capture_output=True)
        else:
            result = subprocess.run(["umount", mountpoint], capture_output=True)
        if result.returncode != 0:
            raise RuntimeError(f"마운트 해제 실패: {result.stderr.decode().strip()}")


# ──────────────────────────────────────────────────────────────────────────────
# NfsBackend — NFS-over-localhost (macOS·Linux 공용, Phase 2 구현 대상)
# ──────────────────────────────────────────────────────────────────────────────

_NFSD_BIN_NAME = "datahub-nfsd"
_NFSD_SOCK_TIMEOUT = 30   # 초: datahub-nfsd 기동 대기 시간
_NFSD_STATE_DIR = Path(os.environ.get("XDG_RUNTIME_DIR", "/tmp")) / "datahub-nfsd"
_TOKEN_ROTATION_BUFFER = 300  # 초: 만료 5분 전 갱신
_TOKEN_ROTATION_CHECK = 30    # 초: rotation 체크 주기


# ──────────────────────────────────────────────────────────────────────────────
# TokenRotator — CAB 토큰 자동 갱신 (Phase 2-B)
# ──────────────────────────────────────────────────────────────────────────────

class _TokenRotator(threading.Thread):
    """NFS 마운트 유지 중 CAB 토큰을 자동 갱신하는 백그라운드 스레드.

    만료 _TOKEN_ROTATION_BUFFER 초 전에 token_refresher()를 호출하여
    새 토큰을 datahub-nfsd에 rotate_token IPC로 전달한다.
    """

    def __init__(
        self,
        sock_path: str,
        token_refresher: Callable[[], tuple[str, float]],
        expires_at: float,
        stop_event: threading.Event,
    ) -> None:
        super().__init__(daemon=True, name="datahub-token-rotator")
        self._sock_path = sock_path
        self._token_refresher = token_refresher
        self._expires_at = expires_at
        self._stop_event = stop_event

    def run(self) -> None:
        logger.debug("TokenRotator 시작, 만료: %.0f", self._expires_at)
        while not self._stop_event.wait(timeout=_TOKEN_ROTATION_CHECK):
            remaining = self._expires_at - time.time()
            if remaining > _TOKEN_ROTATION_BUFFER:
                continue
            logger.info("CAB 토큰 갱신 시작 (만료 %.0f초 전)", remaining)
            try:
                new_token, new_expires_at = self._token_refresher()
                _nfsd_send(
                    self._sock_path,
                    {"type": "rotate_token", "token": new_token},
                    timeout=10.0,
                )
                self._expires_at = new_expires_at
                logger.info(
                    "CAB 토큰 갱신 완료, 다음 만료까지 %.0f초",
                    new_expires_at - time.time(),
                )
            except Exception as exc:
                logger.error("CAB 토큰 갱신 실패: %s", exc)


def _find_nfsd_bin() -> str:
    """datahub-nfsd 바이너리 경로 반환.

    탐색 순서:
    1. datahub-nfsd-bin 패키지 (pip install "datahub[nfs]" 로 설치)
    2. datahub 패키지 내 동봉 바이너리 (개발/테스트용)
    3. PATH 상의 바이너리 (수동 설치)
    """
    # 1. datahub-nfsd-bin 패키지 (권장 설치 경로)
    try:
        import datahub_nfsd_bin
        return datahub_nfsd_bin.get_binary_path()
    except ImportError:
        pass
    except FileNotFoundError:
        pass

    # 2. datahub 패키지 내 동봉 바이너리
    bundled = Path(__file__).parent / "bin" / _NFSD_BIN_NAME
    if bundled.exists() and os.access(bundled, os.X_OK):
        return str(bundled)

    # 3. PATH
    found = shutil.which(_NFSD_BIN_NAME)
    if found:
        return found

    raise RuntimeError(
        f"'{_NFSD_BIN_NAME}' 바이너리를 찾을 수 없습니다.\n"
        "설치 방법: pip install 'datahub[nfs]'"
    )


def _nfsd_sock_path(mountpoint: str) -> Path:
    """마운트포인트별 Unix socket 경로."""
    safe = mountpoint.replace("/", "_").strip("_")
    _NFSD_STATE_DIR.mkdir(parents=True, exist_ok=True)
    return _NFSD_STATE_DIR / f"{safe}.sock"


def _nfsd_pid_path(mountpoint: str) -> Path:
    safe = mountpoint.replace("/", "_").strip("_")
    _NFSD_STATE_DIR.mkdir(parents=True, exist_ok=True)
    return _NFSD_STATE_DIR / f"{safe}.pid"


def _rotation_pid_path(mountpoint: str) -> Path:
    safe = mountpoint.replace("/", "_").strip("_")
    _NFSD_STATE_DIR.mkdir(parents=True, exist_ok=True)
    return _NFSD_STATE_DIR / f"{safe}.rotate.pid"


def _rotation_state_path(mountpoint: str) -> Path:
    """rotation daemon이 필요한 상태를 저장하는 JSON 파일."""
    safe = mountpoint.replace("/", "_").strip("_")
    _NFSD_STATE_DIR.mkdir(parents=True, exist_ok=True)
    return _NFSD_STATE_DIR / f"{safe}.rotate.json"


def _nfsd_send(sock_path: str, msg: dict, timeout: float = 10.0) -> dict:
    """Unix socket으로 JSON 메시지 송수신."""
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        s.connect(sock_path)
        s.sendall((json.dumps(msg) + "\n").encode())
        data = b""
        while not data.endswith(b"\n"):
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
    return json.loads(data.strip())


def _os_mount_nfs(port: int, mountpoint: str) -> None:
    """localhost NFS 서버를 mountpoint에 마운트."""
    os.makedirs(mountpoint, exist_ok=True)
    system = platform.system()
    if system == "Darwin":
        cmd = [
            "mount_nfs",
            "-o", "ro,soft,intr,rsize=65536,wsize=65536",
            f"localhost:{port}:/",
            mountpoint,
        ]
    else:
        cmd = [
            "mount", "-t", "nfs",
            "-o", f"ro,soft,intr,rsize=65536,wsize=65536,port={port}",
            "localhost:/",
            mountpoint,
        ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"NFS 마운트 실패: {result.stderr.strip()}")


def _os_umount(mountpoint: str) -> None:
    system = platform.system()
    cmd = ["diskutil", "unmount", mountpoint] if system == "Darwin" else ["umount", mountpoint]
    subprocess.run(cmd, capture_output=True)


class NfsBackend(MountBackend):
    """NFS-over-localhost 백엔드.

    커널 확장 불필요 — macOS/Linux 내장 NFS 클라이언트 활용.
    `datahub-nfsd` (Rust 데몬)를 subprocess로 기동 후 Unix socket IPC로 제어.

    IPC 프로토콜:
        Python → nfsd : {"type": "init", "token": "...", "files": [...]}
        nfsd → Python : {"type": "ready", "port": <N>}
        Python → nfsd : {"type": "rotate_token", "token": "..."} (Phase 2-B)
        Python → nfsd : {"type": "shutdown"}

    Requirements:
        pip install "datahub[nfs]"   (datahub-nfsd 바이너리 포함)
    """

    @classmethod
    def is_available(cls) -> bool:
        try:
            _find_nfsd_bin()
            return True
        except RuntimeError:
            return False

    def mount(
        self,
        token: str,
        files: list[dict],
        mountpoint: str,
        *,
        foreground: bool = False,
        debug: bool = False,
        expires_at: Optional[float] = None,
        token_refresher: Optional[Callable[[], tuple[str, float]]] = None,
    ) -> None:
        bin_path = _find_nfsd_bin()
        sock_path = _nfsd_sock_path(mountpoint)
        pid_path = _nfsd_pid_path(mountpoint)

        if sock_path.exists():
            raise RuntimeError(
                f"'{mountpoint}' 는 이미 마운트된 것으로 보입니다.\n"
                f"해제하려면: datahub umount {mountpoint}"
            )

        cmd = [
            bin_path,
            "--socket", str(sock_path),
            "--mountpoint", mountpoint,
            "--port", "0",
            "--pid-file", str(pid_path),
        ]
        if foreground:
            cmd.append("--foreground")
        if debug:
            cmd.append("--debug")

        logger.debug("datahub-nfsd 기동: %s", cmd)
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL if not debug else None,
            stderr=subprocess.DEVNULL if not debug else None,
        )

        # socket 생성 대기
        deadline = time.monotonic() + _NFSD_SOCK_TIMEOUT
        while not sock_path.exists():
            if time.monotonic() > deadline:
                proc.terminate()
                raise RuntimeError(
                    f"datahub-nfsd가 {_NFSD_SOCK_TIMEOUT}초 내에 소켓을 생성하지 않았습니다."
                )
            if proc.poll() is not None:
                raise RuntimeError(f"datahub-nfsd가 예기치 않게 종료됐습니다. (rc={proc.returncode})")
            time.sleep(0.1)

        # init 메시지 전송 → ready 수신
        try:
            resp = _nfsd_send(
                str(sock_path),
                {"type": "init", "token": token, "files": files},
                timeout=_NFSD_SOCK_TIMEOUT,
            )
        except Exception as e:
            proc.terminate()
            sock_path.unlink(missing_ok=True)
            raise RuntimeError(f"datahub-nfsd init 실패: {e}") from e

        if resp.get("type") != "ready":
            proc.terminate()
            sock_path.unlink(missing_ok=True)
            raise RuntimeError(f"datahub-nfsd 예상치 못한 응답: {resp}")

        nfs_port = resp["port"]
        logger.debug("datahub-nfsd ready, NFS port=%d", nfs_port)

        # OS NFS 마운트
        try:
            _os_mount_nfs(nfs_port, mountpoint)
        except Exception as e:
            proc.terminate()
            sock_path.unlink(missing_ok=True)
            pid_path.unlink(missing_ok=True)
            raise RuntimeError(f"NFS 마운트 실패: {e}") from e

        logger.info("NFS 마운트 완료: %s (port=%d)", mountpoint, nfs_port)

        # background 모드 rotation daemon 기동
        if not foreground and token_refresher is not None:
            _start_rotation_daemon(
                mountpoint=mountpoint,
                sock_path=str(sock_path),
                token_refresher=token_refresher,
                expires_at=expires_at or (time.time() + 3600),
                repo=getattr(token_refresher, "_repo", ""),
                branch=getattr(token_refresher, "_branch", "main"),
            )

        if foreground:
            stop_event = threading.Event()
            if token_refresher is not None:
                effective_expires_at = expires_at or (time.time() + 3600)
                rotator = _TokenRotator(
                    sock_path=str(sock_path),
                    token_refresher=token_refresher,
                    expires_at=effective_expires_at,
                    stop_event=stop_event,
                )
                rotator.start()
                logger.info(
                    "토큰 자동 갱신 활성화 (만료까지 %.0f초)",
                    effective_expires_at - time.time(),
                )
            else:
                if expires_at and (expires_at - time.time()) < 7200:
                    logger.warning(
                        "token_refresher 미설정 — 토큰 만료 시 GCS 오류 발생 가능 "
                        "(만료까지 %.0f초). --foreground 모드에서 자동 갱신하려면 "
                        "token_refresher를 전달하세요.",
                        expires_at - time.time(),
                    )
            try:
                proc.wait()
            except KeyboardInterrupt:
                self.umount(mountpoint)
            finally:
                stop_event.set()

    def umount(self, mountpoint: str) -> None:
        sock_path = _nfsd_sock_path(mountpoint)
        pid_path = _nfsd_pid_path(mountpoint)
        rotate_pid_path = _rotation_pid_path(mountpoint)
        rotate_state_path = _rotation_state_path(mountpoint)

        # rotation daemon 먼저 종료
        if rotate_pid_path.exists():
            try:
                pid = int(rotate_pid_path.read_text().strip())
                os.kill(pid, 15)  # SIGTERM
            except (ValueError, ProcessLookupError, PermissionError):
                pass
            rotate_pid_path.unlink(missing_ok=True)
        rotate_state_path.unlink(missing_ok=True)

        # OS 마운트 해제 먼저
        _os_umount(mountpoint)

        # nfsd shutdown 신호
        if sock_path.exists():
            try:
                _nfsd_send(str(sock_path), {"type": "shutdown"}, timeout=5.0)
            except Exception:
                # socket 통신 실패 시 PID 파일로 SIGTERM fallback
                if pid_path.exists():
                    try:
                        pid = int(pid_path.read_text().strip())
                        os.kill(pid, 15)  # SIGTERM
                    except (ValueError, ProcessLookupError, PermissionError):
                        pass
            finally:
                sock_path.unlink(missing_ok=True)

        pid_path.unlink(missing_ok=True)
        logger.info("NFS 마운트 해제 완료: %s", mountpoint)


# ──────────────────────────────────────────────────────────────────────────────
# 백엔드 선택 로직
# ──────────────────────────────────────────────────────────────────────────────

_BACKENDS: dict[str, type[MountBackend]] = {
    "fuse": FuseBackend,
    "nfs": NfsBackend,
}


def get_backend(name: str = "auto") -> MountBackend:
    """백엔드 이름 또는 환경 자동 감지로 적절한 백엔드 반환.

    Args:
        name: "fuse" | "nfs" | "auto"
              "auto": Linux → FuseBackend, 그 외 → NfsBackend

    Returns:
        MountBackend 인스턴스

    Raises:
        ValueError: 알 수 없는 백엔드 이름
        RuntimeError: 요청 백엔드가 현재 환경에서 불가
    """
    if name == "auto":
        if platform.system() == "Linux":
            return FuseBackend()
        return NfsBackend()

    cls = _BACKENDS.get(name)
    if cls is None:
        raise ValueError(f"알 수 없는 백엔드: {name!r}. 선택 가능: {list(_BACKENDS)}")
    if not cls.is_available():
        raise RuntimeError(f"{name} 백엔드를 현재 환경에서 사용할 수 없습니다.")
    return cls()


# ──────────────────────────────────────────────────────────────────────────────
# Public helpers (하위 호환)
# ──────────────────────────────────────────────────────────────────────────────

def mount(
    token: str,
    files: list[dict],
    mountpoint: str,
    foreground: bool = False,
    debug: bool = False,
    backend: str = "auto",
    expires_at: Optional[float] = None,
    token_refresher: Optional[Callable[[], tuple[str, float]]] = None,
) -> None:
    """NFS/FUSE 마운트 — Phase 2 개발 예정."""
    raise NotImplementedError(
        "datahub mount: NFS/FUSE 마운트는 현재 개발 중입니다 (Phase 2 예정)."
    )


def umount(mountpoint: str, backend: str = "auto") -> None:
    """NFS/FUSE 마운트 해제 — Phase 2 개발 예정."""
    raise NotImplementedError(
        "datahub umount: NFS/FUSE 마운트는 현재 개발 중입니다 (Phase 2 예정)."
    )


# ──────────────────────────────────────────────────────────────────────────────
# Rotation daemon — background 모드 CAB 토큰 자동 갱신 (Phase 2-C)
# ──────────────────────────────────────────────────────────────────────────────

def _start_rotation_daemon(
    mountpoint: str,
    sock_path: str,
    token_refresher: Callable[[], tuple[str, float]],
    expires_at: float,
    repo: str = "",
    branch: str = "main",
) -> None:
    """background 모드에서 rotation daemon을 분리된 프로세스로 기동.

    `datahub mount` 프로세스가 종료된 후에도 토큰 갱신이 지속됨.
    데몬 상태는 _NFSD_STATE_DIR 의 JSON 파일로 관리.
    """
    import sys

    # token_refresher 직렬화: CLI가 클로저를 넘기므로 refresher 재현에
    # 필요한 정보(repo, branch, config path)를 state 파일에 저장하는 대신,
    # 현재 프로세스에서 refresher를 즉시 한 번 검증만 한다.
    # 실제 갱신은 datahub CLI가 _run_rotation_daemon 진입점을 재호출하는 방식.
    state_path = _rotation_state_path(mountpoint)
    rotate_pid_path = _rotation_pid_path(mountpoint)

    # 실행 시 필요한 상태를 파일에 저장
    # (token_refresher 자체는 직렬화 불가 → CLI 진입점이 재구성)
    state = {
        "sock_path": sock_path,
        "mountpoint": mountpoint,
        "expires_at": expires_at,
        "repo": repo,
        "branch": branch,
    }
    state_path.write_text(json.dumps(state))

    # 분리된 데몬 프로세스 기동 (double-fork 패턴 대신 subprocess로 단순화)
    daemon_cmd = [
        sys.executable, "-m", "datahub._rotation_daemon",
        "--state-file", str(state_path),
        "--pid-file", str(rotate_pid_path),
    ]
    proc = subprocess.Popen(
        daemon_cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,  # SIGHUP 차단, 터미널 분리
    )
    logger.info("rotation daemon 기동 (pid=%d)", proc.pid)


def _run_rotation_daemon_loop(
    sock_path: str,
    mountpoint: str,
    expires_at: float,
    token_refresher: Callable[[], tuple[str, float]],
    pid_file: Optional[str] = None,
) -> None:
    """rotation daemon 메인 루프 — 직접 호출용 (테스트, foreground).

    소켓이 사라지면 자동 종료 (umount 감지).
    """
    if pid_file:
        Path(pid_file).write_text(str(os.getpid()))

    logger.info("rotation daemon 시작, 만료: %.0f, 소켓: %s", expires_at, sock_path)

    try:
        while True:
            # 소켓 존재 확인 (nfsd 살아있는지)
            if not Path(sock_path).exists():
                logger.info("NFS 소켓 없음 — rotation daemon 종료 (umount 완료)")
                break

            remaining = expires_at - time.time()
            if remaining <= _TOKEN_ROTATION_BUFFER:
                logger.info("CAB 토큰 갱신 시작 (만료 %.0f초 전)", remaining)
                try:
                    new_token, expires_at = token_refresher()
                    _nfsd_send(
                        sock_path,
                        {"type": "rotate_token", "token": new_token},
                        timeout=10.0,
                    )
                    logger.info(
                        "토큰 갱신 완료, 다음 만료까지 %.0f초",
                        expires_at - time.time(),
                    )
                except Exception as exc:
                    logger.error("토큰 갱신 실패: %s", exc)

            time.sleep(_TOKEN_ROTATION_CHECK)
    finally:
        if pid_file:
            Path(pid_file).unlink(missing_ok=True)
        logger.info("rotation daemon 종료")

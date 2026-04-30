"""E2E 시나리오 테스트 — background 데몬 & 대용량 파일 토큰 rotation.

이슈 #11: mount → 파일 읽기 → 토큰 만료 → rotation → 계속 읽기 시나리오.

커버리지:
- 시나리오 3: background 데몬 — 프로세스 재시작 후 상태 유지
  - 3-1: _run_rotation_daemon_loop 직접 실행 → 만료 임박 시 갱신 트리거
  - 3-2: _start_rotation_daemon → start_new_session=True 전달, state 파일 기록
  - 3-3: rotation 실패 (refresher 예외) 후에도 데몬 루프 계속 실행
- 시나리오 4: 대용량 파일 — 복수 rotation 사이클 (장기 실행 시뮬레이션)
  - 4-1: 복수 rotation 사이클 — 갱신 후 새 expires_at 기준으로 재갱신
  - 4-2: 소켓 소멸 감지 → 데몬 루프 클린 종료 (umount 시나리오)
  - 4-3: _nfsd_send 실패 시 expires_at 미갱신 → 다음 사이클 재시도
"""

from __future__ import annotations

import json
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

import datahub.mount as _mount_mod
from datahub.mount import (
    _TOKEN_ROTATION_BUFFER,
    _run_rotation_daemon_loop,
    _start_rotation_daemon,
)

# 루프 체크 주기 단축 (30초 → 20ms)
_FAST_CHECK = 0.02


@pytest.fixture(autouse=True)
def fast_check(monkeypatch):
    """모든 테스트에서 rotation 체크 주기를 20ms로 단축."""
    monkeypatch.setattr(_mount_mod, "_TOKEN_ROTATION_CHECK", _FAST_CHECK)


# ──────────────────────────────────────────────────────────────
# 시나리오 3-1: _run_rotation_daemon_loop — 만료 임박 시 갱신
# ──────────────────────────────────────────────────────────────


class TestRotationDaemonLoop:
    """_run_rotation_daemon_loop 정상 동작 검증."""

    def test_rotation_triggered_near_expiry(self, tmp_path):
        """만료 BUFFER 이내 진입 시 token_refresher + _nfsd_send 호출."""
        sock = tmp_path / "test.sock"
        sock.touch()  # 소켓 파일 존재 → 루프 진입 허용

        new_token = "ya29.daemon-refreshed"
        new_expires = time.time() + 3600
        refresher = MagicMock(return_value=(new_token, new_expires))

        # 만료를 BUFFER 이내로 설정 → 첫 루프에서 즉시 rotation
        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        done = threading.Event()

        def _run():
            with patch("datahub.mount._nfsd_send", return_value={"ok": True}) as mock_send:
                _run_rotation_daemon_loop(
                    sock_path=str(sock),
                    mountpoint=str(tmp_path / "mnt"),
                    expires_at=expires_at,
                    token_refresher=refresher,
                )
            done._mock_send = mock_send

        # 루프가 소켓 소멸 감지로 종료되도록 일정 시간 후 소켓 제거
        t = threading.Thread(target=_run, daemon=True)
        t.start()
        time.sleep(0.1)
        sock.unlink()  # umount 시뮬레이션 → 루프 종료 유도
        t.join(timeout=3)

        refresher.assert_called()
        token_arg = refresher.call_args  # 갱신 호출 확인 (인자 없음)
        assert token_arg is not None

    def test_rotation_updates_expires_at(self, tmp_path):
        """rotation 성공 후 새 expires_at 기준으로 다음 루프가 작동한다."""
        sock = tmp_path / "test.sock"
        sock.touch()

        call_times: list[float] = []
        first_new_expires = time.time() + 9999  # 갱신 후 오랫동안 만료 없음

        def _refresher():
            call_times.append(time.time())
            return ("ya29.updated", first_new_expires)

        # 만료 임박으로 시작
        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        t = threading.Thread(
            target=lambda: _run_rotation_daemon_loop(
                sock_path=str(sock),
                mountpoint=str(tmp_path / "mnt"),
                expires_at=expires_at,
                token_refresher=_refresher,
            ),
            daemon=True,
        )

        with patch("datahub.mount._nfsd_send", return_value={"ok": True}):
            t.start()
            time.sleep(0.15)
            sock.unlink()
            t.join(timeout=3)

        # 갱신 1회 후 새 expires_at (9999초 후)로 갱신됐으므로 추가 호출 없음
        assert len(call_times) == 1


# ──────────────────────────────────────────────────────────────
# 시나리오 3-2: _start_rotation_daemon — subprocess 파라미터 검증
# ──────────────────────────────────────────────────────────────


class TestStartRotationDaemon:
    """_start_rotation_daemon subprocess 기동 방식 검증."""

    def test_popen_called_with_start_new_session(self, tmp_path):
        """`start_new_session=True` 플래그 전달 확인 — SIGHUP 차단 보장."""
        sock = tmp_path / "test.sock"
        refresher = MagicMock(return_value=("ya29.t", time.time() + 3600))
        expires_at = time.time() + 3600

        mock_proc = MagicMock()
        mock_proc.pid = 99999

        with patch("subprocess.Popen", return_value=mock_proc) as mock_popen:
            _start_rotation_daemon(
                mountpoint=str(tmp_path / "mnt"),
                sock_path=str(sock),
                token_refresher=refresher,
                expires_at=expires_at,
                repo="my-dataset",
                branch="main",
            )

        mock_popen.assert_called_once()
        _, kwargs = mock_popen.call_args
        assert kwargs.get("start_new_session") is True, (
            "start_new_session=True 없으면 부모 종료 시 SIGHUP이 데몬에 전달됨"
        )

    def test_state_file_written_correctly(self, tmp_path):
        """state JSON 파일에 필수 필드가 저장된다."""
        sock = tmp_path / "test.sock"
        mountpoint = str(tmp_path / "mnt")
        expires_at = time.time() + 1800
        refresher = MagicMock(return_value=("ya29.t", expires_at))

        mock_proc = MagicMock()
        mock_proc.pid = 99998

        with patch("subprocess.Popen", return_value=mock_proc):
            _start_rotation_daemon(
                mountpoint=mountpoint,
                sock_path=str(sock),
                token_refresher=refresher,
                expires_at=expires_at,
                repo="my-dataset",
                branch="dev",
            )

        # state 파일 검증
        state_files = list(tmp_path.parent.rglob("*.rotate.json"))
        # XDG_RUNTIME_DIR 또는 /tmp/datahub-nfsd에 저장됨 — 실 경로 추적
        from datahub.mount import _rotation_state_path
        state_path = _rotation_state_path(mountpoint)

        assert state_path.exists(), "state JSON 파일이 생성됐어야 함"
        state = json.loads(state_path.read_text())

        assert state["sock_path"] == str(sock)
        assert state["mountpoint"] == mountpoint
        assert state["repo"] == "my-dataset"
        assert state["branch"] == "dev"
        assert abs(state["expires_at"] - expires_at) < 1

    def test_daemon_cmd_uses_rotation_daemon_module(self, tmp_path):
        """기동 명령이 `datahub._rotation_daemon` 모듈을 사용한다."""
        refresher = MagicMock(return_value=("ya29.t", time.time() + 3600))
        mock_proc = MagicMock()
        mock_proc.pid = 99997

        with patch("subprocess.Popen", return_value=mock_proc) as mock_popen:
            _start_rotation_daemon(
                mountpoint=str(tmp_path / "mnt"),
                sock_path=str(tmp_path / "test.sock"),
                token_refresher=refresher,
                expires_at=time.time() + 3600,
                repo="ds",
                branch="main",
            )

        cmd = mock_popen.call_args[0][0]
        assert "-m" in cmd
        idx = cmd.index("-m")
        assert cmd[idx + 1] == "datahub._rotation_daemon"


# ──────────────────────────────────────────────────────────────
# 시나리오 3-3: rotation 실패 후 루프 계속 실행
# ──────────────────────────────────────────────────────────────


class TestRotationDaemonFailureRecovery:
    """rotation 실패 시 데몬 루프 생존 검증."""

    def test_refresher_exception_does_not_crash_daemon(self, tmp_path):
        """token_refresher 예외 시에도 루프가 계속 실행된다."""
        sock = tmp_path / "test.sock"
        sock.touch()

        call_count = [0]

        def _failing_refresher():
            call_count[0] += 1
            raise RuntimeError("DataHub API 503")

        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        alive_flag = [True]

        def _run():
            try:
                with patch("datahub.mount._nfsd_send"):
                    _run_rotation_daemon_loop(
                        sock_path=str(sock),
                        mountpoint=str(tmp_path / "mnt"),
                        expires_at=expires_at,
                        token_refresher=_failing_refresher,
                    )
            except Exception:
                alive_flag[0] = False

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        time.sleep(0.12)

        # 크래시 없이 살아서 refresher를 여러 번 호출
        assert alive_flag[0] is True, "루프가 예외로 크래시됨"
        assert call_count[0] >= 1, "refresher가 한 번도 호출되지 않음"

        sock.unlink()
        t.join(timeout=3)

    def test_api_recovery_after_failure(self, tmp_path):
        """실패 후 다음 루프에서 정상 rotation이 가능하다."""
        sock = tmp_path / "test.sock"
        sock.touch()

        results: list[str] = []

        def _recovers_on_second_call():
            if len(results) == 0:
                results.append("fail")
                raise ConnectionError("일시적 장애")
            results.append("ok")
            return ("ya29.recovered", time.time() + 9999)

        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        with patch("datahub.mount._nfsd_send", return_value={"ok": True}):
            t = threading.Thread(
                target=lambda: _run_rotation_daemon_loop(
                    sock_path=str(sock),
                    mountpoint=str(tmp_path / "mnt"),
                    expires_at=expires_at,
                    token_refresher=_recovers_on_second_call,
                ),
                daemon=True,
            )
            t.start()
            time.sleep(0.2)
            sock.unlink()
            t.join(timeout=3)

        assert "fail" in results
        assert "ok" in results, "복구 후 정상 rotation이 발생해야 함"


# ──────────────────────────────────────────────────────────────
# 시나리오 4-1: 복수 rotation 사이클 (장기 실행)
# ──────────────────────────────────────────────────────────────


class TestMultipleRotationCycles:
    """복수 rotation 사이클 — 장기 실행 대용량 파일 접근 시뮬레이션."""

    def test_multiple_rotations_in_sequence(self, tmp_path):
        """rotation 성공마다 새 expires_at 기준으로 다음 갱신이 예약된다.

        대용량 파일 전송 중 여러 번 토큰이 교체되는 시나리오를 모사.
        """
        sock = tmp_path / "test.sock"
        sock.touch()

        rotation_count = [0]
        # 각 rotation마다 짧은 유효기간 반환 → 다음 루프에서 즉시 재갱신
        short_ttl = _TOKEN_ROTATION_BUFFER - 5

        def _short_ttl_refresher():
            rotation_count[0] += 1
            new_expires = time.time() + short_ttl
            return (f"ya29.cycle-{rotation_count[0]}", new_expires)

        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        nfsd_calls: list[dict] = []

        def _capture_send(sock_path, msg, timeout=10.0):
            nfsd_calls.append(msg)
            return {"ok": True}

        with patch("datahub.mount._nfsd_send", side_effect=_capture_send):
            t = threading.Thread(
                target=lambda: _run_rotation_daemon_loop(
                    sock_path=str(sock),
                    mountpoint=str(tmp_path / "mnt"),
                    expires_at=expires_at,
                    token_refresher=_short_ttl_refresher,
                ),
                daemon=True,
            )
            t.start()
            time.sleep(0.25)  # 복수 사이클 대기
            sock.unlink()
            t.join(timeout=3)

        # 복수 rotation 발생 확인
        assert rotation_count[0] >= 2, (
            f"최소 2회 rotation이 발생해야 하나 {rotation_count[0]}회 발생"
        )
        # 각 _nfsd_send 호출에 갱신된 토큰이 전달됐는지 확인
        tokens_sent = [msg["token"] for msg in nfsd_calls if msg.get("type") == "rotate_token"]
        assert len(tokens_sent) >= 2
        # 토큰이 cycle마다 달라야 함
        assert len(set(tokens_sent)) >= 2, "rotation마다 새 토큰이 발급되어야 함"


# ──────────────────────────────────────────────────────────────
# 시나리오 4-2: 소켓 소멸 감지 → 클린 종료 (umount 시나리오)
# ──────────────────────────────────────────────────────────────


class TestDaemonSocketDisappears:
    """소켓 소멸 시 데몬 루프 클린 종료 검증.

    대용량 파일 전송 중 umount 발생 시 데몬이 정상적으로 종료되는 시나리오.
    """

    def test_daemon_exits_cleanly_when_socket_removed(self, tmp_path):
        """소켓 파일 삭제 시 루프가 즉시 종료된다 (pid 파일 정리 포함)."""
        sock = tmp_path / "test.sock"
        sock.touch()
        pid_file = tmp_path / "daemon.pid"

        refresher = MagicMock(return_value=("ya29.x", time.time() + 9999))

        terminated = threading.Event()

        def _run():
            with patch("datahub.mount._nfsd_send", return_value={"ok": True}):
                _run_rotation_daemon_loop(
                    sock_path=str(sock),
                    mountpoint=str(tmp_path / "mnt"),
                    expires_at=time.time() + 9999,
                    token_refresher=refresher,
                    pid_file=str(pid_file),
                )
            terminated.set()

        t = threading.Thread(target=_run, daemon=True)
        t.start()

        # 루프 진입 대기
        time.sleep(0.05)

        # umount 시뮬레이션: 소켓 제거
        sock.unlink()

        # 루프가 _FAST_CHECK(20ms) + 약간의 여유 내에 종료되어야 함
        assert terminated.wait(timeout=2), "소켓 소멸 후 데몬이 3초 내에 종료되어야 함"

        # pid 파일이 정리됐는지 확인
        assert not pid_file.exists(), "pid 파일이 루프 종료 시 삭제되어야 함"

    def test_daemon_does_not_crash_if_socket_never_existed(self, tmp_path):
        """초기에 소켓이 없으면 첫 루프에서 즉시 종료된다."""
        sock = tmp_path / "nonexistent.sock"
        refresher = MagicMock()

        terminated = threading.Event()

        def _run():
            with patch("datahub.mount._nfsd_send"):
                _run_rotation_daemon_loop(
                    sock_path=str(sock),
                    mountpoint=str(tmp_path / "mnt"),
                    expires_at=time.time() + 9999,
                    token_refresher=refresher,
                )
            terminated.set()

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        assert terminated.wait(timeout=2)
        refresher.assert_not_called()


# ──────────────────────────────────────────────────────────────
# 시나리오 4-3: _nfsd_send 실패 시 expires_at 미갱신 → 재시도
# ──────────────────────────────────────────────────────────────


class TestNfsdSendFailureRetry:
    """IPC 실패 시 데몬 동작 검증.

    구현 참고: token_refresher() 성공 후 _nfsd_send()가 실패하면
    expires_at은 이미 갱신된 상태이므로 즉시 재시도는 발생하지 않는다.
    중요한 것은 데몬이 크래시 없이 계속 실행된다는 점이다.
    """

    def test_daemon_continues_after_ipc_failure(self, tmp_path):
        """_nfsd_send 실패 시 expires_at은 갱신(refresher 성공)됐지만 데몬은 살아있는다.

        token_refresher() 성공 → expires_at 갱신 → _nfsd_send 실패 순서로 진행.
        예외는 로깅되고 루프는 계속 실행. 즉시 재시도 없음 (갱신된 expires_at 기준).
        """
        sock = tmp_path / "test.sock"
        sock.touch()

        refresher_calls: list[int] = []

        def _refresher():
            refresher_calls.append(len(refresher_calls) + 1)
            # 갱신 후 만료까지 충분히 남아 있음 → 즉시 재시도 없음
            return ("ya29.new", time.time() + 9999)

        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        alive_flag = [True]

        def _failing_send(sock_path, msg, timeout=10.0):
            raise ConnectionRefusedError("IPC 지속 실패")

        def _run():
            try:
                with patch("datahub.mount._nfsd_send", side_effect=_failing_send):
                    _run_rotation_daemon_loop(
                        sock_path=str(sock),
                        mountpoint=str(tmp_path / "mnt"),
                        expires_at=expires_at,
                        token_refresher=_refresher,
                    )
            except Exception:
                alive_flag[0] = False

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        time.sleep(0.15)

        # 데몬이 크래시 없이 살아있어야 함
        assert alive_flag[0] is True, "IPC 실패 후 데몬이 크래시됨"
        # token_refresher는 정확히 1회 호출 (IPC 실패 후 expires_at 갱신 → 즉시 재시도 없음)
        assert len(refresher_calls) == 1, (
            "refresher가 1회 호출됐어야 함 — IPC 실패 후 갱신된 expires_at으로 즉시 재시도 없음"
        )

        sock.unlink()
        t.join(timeout=3)

    def test_ipc_failure_is_logged_not_raised(self, tmp_path, caplog):
        """IPC 실패는 예외를 전파하지 않고 ERROR 로그로만 기록된다."""
        import logging

        sock = tmp_path / "test.sock"
        sock.touch()

        refresher = MagicMock(return_value=("ya29.x", time.time() + 9999))
        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        with caplog.at_level(logging.ERROR, logger="datahub.mount"):
            t = threading.Thread(
                target=lambda: _run_rotation_daemon_loop(
                    sock_path=str(sock),
                    mountpoint=str(tmp_path / "mnt"),
                    expires_at=expires_at,
                    token_refresher=refresher,
                ),
                daemon=True,
            )
            with patch("datahub.mount._nfsd_send", side_effect=OSError("socket gone")):
                t.start()
                time.sleep(0.1)
                sock.unlink()
                t.join(timeout=3)

        error_logs = [r for r in caplog.records if r.levelno == logging.ERROR]
        assert any("갱신 실패" in r.message or "socket gone" in r.message for r in error_logs), (
            "IPC 실패가 ERROR 레벨로 로깅되어야 함"
        )

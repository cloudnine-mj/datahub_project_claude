"""DataClient: data-platform-service thin client.

SDK는 서버 API만 호출합니다. LakeFS, Unity Catalog 의존성 없음.
파일 전송은 CAB 토큰 기반 google-cloud-storage SDK 직접 사용 (DataHub 서버 무경유).

Usage:
    from datahub import DataClient

    client = DataClient()

    # 데이터셋 전체 다운로드 (1 repo = 1 dataset)
    client.download("ner-v4", "/", "./data/", branch="main")

    # 로컬 결과 폴더 업로드 + 커밋 + UC 동기 등록
    client.upload("ner-v5", "./output/ner-v5/",
                  branch="main", message="NER v5 학습 데이터 추가")

    # 새 데이터셋 생성
    client.create_repo("ner-v5")
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Dict, Optional

import httpx

from datahub.config import DataHubConfig
from datahub.types import (
    ApiKeyInfo,
    CommitInfo,
    CreatedApiKey,
    DatasetMetadata,
    ListResult,
    TableInfo,
    UserIdentity,
)
from datahub.cli import parse_dh_uri

logger = logging.getLogger(__name__)

_DEFAULT_MAX_WORKERS = 8
_DEFAULT_MAX_IN_FLIGHT = 10
_DEFAULT_TRANSFER_CHUNK_SIZE = 32 * 1024 * 1024
_DEFAULT_MULTIPART_THRESHOLD = 128 * 1024 * 1024
_DEFAULT_DOWNLOAD_PAGE_SIZE = 1000
_DEFAULT_MAX_RETRIES = 3
TransferProgressCallback = Callable[[Dict[str, Any]], None]


def _parse_retry_after(resp) -> Optional[float]:
    """Retry-After 헤더를 파싱해 sleep 초를 반환.

    헤더 값이 숫자면 float(val) + 1.0 반환.
    헤더 없거나 파싱 불가하면 None 반환 (호출자가 지수 백오프 사용).
    """
    val = resp.headers.get("Retry-After")
    if val is None:
        return None
    try:
        return float(val) + 1.0
    except ValueError:
        return None


def _http_request_with_retry(fn, *args, max_retries: int = _DEFAULT_MAX_RETRIES, **kwargs):
    """HTTP 요청 실행. 429 응답 시 Retry-After 기반 sleep 후 재시도.

    - Retry-After 헤더 있으면: float(Retry-After) + 1.0 초 sleep
    - 헤더 없으면: 지수 백오프 (2^attempt 초)
    - max_retries 초과 시: 마지막 응답 반환 (호출자가 raise_for_status 처리)
    """
    for attempt in range(max_retries + 1):
        resp = fn(*args, **kwargs)
        if resp.status_code != 429 or attempt == max_retries:
            return resp
        sleep_secs = _parse_retry_after(resp)
        if sleep_secs is None:
            sleep_secs = 2 ** attempt
        time.sleep(sleep_secs)
    return resp  # unreachable, satisfies type checker


class DataClient:
    """DataHub thin client.

    data-platform-service API만 호출합니다.

    Args:
        config: DataHubConfig 인스턴스. None이면 자동 로드.
    """

    def __init__(self, config: Optional[DataHubConfig] = None) -> None:
        self._config = config or DataHubConfig.load()

        if not self._config.auth.endpoint:
            raise ValueError(
                "auth.endpoint가 설정되지 않았습니다. "
                "DATAHUB_AUTH_ENDPOINT 환경변수 또는 config.yaml에 설정하세요."
            )

        self._endpoint = self._config.auth.endpoint.rstrip("/")
        headers = self._build_auth_headers()
        verify: bool | str = self._config.auth.ca_bundle or self._config.auth.verify_ssl
        try:
            self._http = httpx.Client(headers=headers, timeout=120.0, verify=verify)
        except TypeError:
            try:
                self._http = httpx.Client(headers=headers, verify=verify)
            except TypeError:
                self._http = httpx.Client()
                self._http.headers.update(headers)

        # 세션 생성 → 사용자 정보 확인
        resp = self._http.post(self._url("/api/v1/auth/session"))
        if resp.status_code == 401 and self._refresh_cli_token():
            resp = self._http.post(self._url("/api/v1/auth/session"))
        resp.raise_for_status()
        session = resp.json()
        self._identity = UserIdentity(email=session["email"])

    def _url(self, path: str) -> str:
        """Build full URL from relative path."""
        return f"{self._endpoint}{path}"

    def _build_auth_headers(self) -> dict[str, str]:
        """인증 헤더 구성.

        우선순위: (1) API Key → (2) CLI 로그인 토큰 → (3) GCP ADC (fallback)
        """
        if self._config.auth.api_key:
            return {"X-API-Key": self._config.auth.api_key}

        # CLI 로그인으로 저장된 토큰 확인
        from datahub.auth import CredentialStore

        creds = CredentialStore.load()
        if creds and creds.get("token"):
            return {"Authorization": f"Bearer {creds['token']}"}

        # GCP ADC fallback
        token = self._get_google_token()
        return {"Authorization": f"Bearer {token}"}

    def _refresh_cli_token(self) -> str | None:
        from datahub.auth import CredentialStore

        creds = CredentialStore.load()
        refresh_token = creds.get("refresh_token") if creds else None
        if not refresh_token:
            return None

        resp = self._http.post(
            self._url("/api/v1/auth/refresh"),
            json={"refresh_token": refresh_token},
        )
        if resp.status_code != 200:
            return None

        payload = resp.json()
        refreshed = dict(creds or {})
        refreshed["token"] = payload["access_token"]
        refreshed["refresh_token"] = payload["refresh_token"]
        CredentialStore.save(refreshed)
        self._http.headers["Authorization"] = f"Bearer {payload['access_token']}"
        return payload["access_token"]

    @staticmethod
    def _get_google_token() -> str:
        """GCP ADC에서 access token 획득 (fallback)."""
        try:
            import google.auth
            import google.auth.transport.requests
        except ImportError:
            raise RuntimeError(
                "인증 정보가 없습니다. 'datahub login'으로 로그인하거나, "
                "google-auth 패키지를 설치하세요: pip install datahub[gcp]"
            )

        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        credentials.refresh(google.auth.transport.requests.Request())
        return credentials.token

    @property
    def identity(self) -> UserIdentity:
        """현재 사용자 Identity."""
        return self._identity

    # ──────────────────────────────────────────────
    # 데이터 검색 (Catalog)
    # ──────────────────────────────────────────────

    def get_table(self, full_name: str) -> TableInfo:
        """테이블 메타데이터 조회.

        Args:
            full_name: 'catalog.schema.table' 형식
        """
        resp = self._http.get(self._url(f"/api/v1/catalog/tables/{full_name}"))
        resp.raise_for_status()
        return _to_table_info(resp.json())

    # ── API Key 관리 ────────────────────────────────
    # 서버 계약: POST/GET/DELETE/POST rotate 는 모두 본인 키만. raw key 는 생성
    # 응답(CreatedApiKey) 에서만 1회 노출되고 이후 목록엔 포함되지 않는다.

    def create_api_key(
        self,
        name: str,
        *,
        scope: str = "full",
        expires_in_days: Optional[int] = None,
    ) -> CreatedApiKey:
        """API 키 발급. 반환된 `api_key` 는 지금만 볼 수 있다."""
        body: dict = {"name": name, "scope": scope}
        if expires_in_days is not None:
            body["expires_in_days"] = expires_in_days
        resp = self._http.post(self._url("/api/v1/auth/api-keys"), json=body)
        resp.raise_for_status()
        d = resp.json()
        return CreatedApiKey(
            api_key=d["api_key"], id=d["id"], prefix=d["prefix"],
            name=d["name"], scope=d["scope"],
            created_at=d["created_at"], expires_at=d.get("expires_at"),
        )

    def list_api_keys(self, include_revoked: bool = False) -> list[ApiKeyInfo]:
        """본인 API 키 목록. 기본은 활성만."""
        params = {"include_revoked": "true"} if include_revoked else None
        resp = self._http.get(self._url("/api/v1/auth/api-keys"), params=params)
        resp.raise_for_status()
        return [
            ApiKeyInfo(
                id=k["id"], prefix=k["prefix"], name=k.get("name", ""),
                scope=k.get("scope", "full"),
                created_at=k["created_at"], last_used=k.get("last_used"),
                expires_at=k.get("expires_at"), is_active=k.get("is_active", True),
                revoked_at=k.get("revoked_at"),
            )
            for k in resp.json().get("api_keys", [])
        ]

    def revoke_api_key(self, key_ref: str | int) -> None:
        """API 키 revoke. `key_ref` 는 숫자 id 또는 `dl_...` prefix."""
        resp = self._http.delete(self._url(f"/api/v1/auth/api-keys/{key_ref}"))
        resp.raise_for_status()

    def rotate_api_key(self, key_ref: str | int) -> CreatedApiKey:
        """기존 키를 revoke 하고 동일 속성으로 새 키 발급."""
        resp = self._http.post(self._url(f"/api/v1/auth/api-keys/{key_ref}/rotate"))
        resp.raise_for_status()
        d = resp.json()
        return CreatedApiKey(
            api_key=d["api_key"], id=d["id"], prefix=d["prefix"],
            name=d["name"], scope=d["scope"],
            created_at=d["created_at"], expires_at=d.get("expires_at"),
        )

    def search(
        self,
        keyword: str = "",
        catalog_name: Optional[str] = None,
        filters: Optional[dict[str, str]] = None,
    ) -> list[TableInfo]:
        """키워드 + 필터로 데이터셋 검색."""
        params: dict = {}
        if keyword:
            params["keyword"] = keyword
        if catalog_name:
            params["catalog_name"] = catalog_name
        if filters:
            for k, v in filters.items():
                params[k] = v

        resp = self._http.get(self._url("/api/v1/catalog/search"), params=params)
        resp.raise_for_status()
        return [_to_table_info(t) for t in resp.json()["tables"]]

    def update_metadata(self, full_name: str, metadata: DatasetMetadata) -> None:
        """데이터셋 메타데이터 부분 업데이트."""
        body = metadata.to_dict()
        resp = self._http.patch(self._url(f"/api/v1/catalog/tables/{full_name}/metadata"), json=body)
        resp.raise_for_status()

    def list_tables(self, catalog_name: str, schema_name: str) -> list[TableInfo]:
        """스키마 내 테이블 목록."""
        resp = self._http.get(
            self._url("/api/v1/catalog/tables"),
            params={"catalog": catalog_name, "schema": schema_name},
        )
        resp.raise_for_status()
        return [_to_table_info(t) for t in resp.json()["tables"]]

    def list_catalogs(self) -> list[str]:
        """등록된 카탈로그(랩) 목록."""
        resp = self._http.get(self._url("/api/v1/catalog/catalogs"))
        resp.raise_for_status()
        return resp.json()["catalogs"]

    @staticmethod
    def _emit_progress(on_progress: Optional[TransferProgressCallback], **event: Any) -> None:
        if on_progress:
            on_progress(event)

    @staticmethod
    def _format_progress_label(files_done: int, files_total: int) -> str:
        return f"{files_done}/{files_total} files"

    @staticmethod
    def _emit_stage(
        on_progress: Optional[TransferProgressCallback],
        *,
        operation: str,
        stage: str,
        label: str,
        files_done: int = 0,
        files_total: int = 0,
        bytes_done: int = 0,
        bytes_total: int = 0,
        summary: str = "",
    ) -> None:
        DataClient._emit_progress(
            on_progress,
            type="stage",
            operation=operation,
            stage=stage,
            label=label,
            files_done=files_done,
            files_total=files_total,
            bytes_done=bytes_done,
            bytes_total=bytes_total,
            summary=summary,
        )

    @staticmethod
    def _checksum_from_blob(blob: Any, local_file: str) -> str:
        md5_hash = getattr(blob, "md5_hash", None)
        if md5_hash:
            return base64.b64decode(md5_hash).hex()

        digest = hashlib.md5()
        with open(local_file, "rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    @staticmethod
    def _blob_size(blob: Any) -> int:
        size = getattr(blob, "size", None)
        if isinstance(size, bool):
            return 0
        if isinstance(size, (int, float)):
            return int(size)
        return 0

    @staticmethod
    def _load_blob_size(blob: Any) -> int:
        blob.reload()
        return DataClient._blob_size(blob)

    @staticmethod
    def _should_use_chunked_transfer(item_count: int, total_size: int, multi: bool) -> bool:
        return multi and item_count == 1 and total_size >= _DEFAULT_MULTIPART_THRESHOLD

    @staticmethod
    def _get_transfer_manager():
        try:
            from google.cloud.storage import transfer_manager  # type: ignore[import]
        except ImportError as exc:
            raise ImportError(
                "google-cloud-storage transfer_manager is required for -m transfers"
            ) from exc
        return transfer_manager

    @staticmethod
    def _resolve_download_destination(file_path: str, remote_path: str, local_path: str) -> str:
        prefix = remote_path.lstrip("/")

        if remote_path.endswith("/") or remote_path == "":
            rel = file_path[len(prefix):].lstrip("/") if prefix else file_path
            dest = os.path.join(local_path, rel)
        elif os.path.isdir(local_path):
            dest = os.path.join(local_path, os.path.basename(file_path))
        else:
            dest = local_path

        os.makedirs(os.path.dirname(os.path.abspath(dest)), exist_ok=True)
        return dest

    def _build_download_targets(
        self,
        gcs: Any,
        files: list[dict],
        remote_path: str,
        local_path: str,
        operation: str,
        on_progress: Optional[TransferProgressCallback] = None,
    ) -> list[dict]:
        targets: list[dict] = []
        total_files = len(files)
        self._emit_stage(
            on_progress,
            operation=operation,
            stage="preparing",
            label="Preparing download targets",
            files_done=0,
            files_total=total_files,
        )
        for index, entry in enumerate(files, start=1):
            file_path = entry["path"]
            physical_address = entry["physical_address"]
            dest = self._resolve_download_destination(file_path, remote_path, local_path)

            bucket_name, _, blob_name = physical_address[5:].partition("/")
            blob = gcs.bucket(bucket_name).blob(blob_name)

            size_bytes = entry.get("size_bytes")
            if not isinstance(size_bytes, int):
                try:
                    size_bytes = self._load_blob_size(blob)
                except Exception:
                    size_bytes = 0

            targets.append({
                "path": file_path,
                "uri": file_path,
                "dest": dest,
                "blob": blob,
                "size_bytes": size_bytes,
                "physical_address": physical_address,
            })
            self._emit_stage(
                on_progress,
                operation=operation,
                stage="preparing",
                label="Preparing download targets",
                files_done=index,
                files_total=total_files,
            )
        return targets

    # ──────────────────────────────────────────────
    # 파일 / 디렉토리 I/O
    # ──────────────────────────────────────────────

    def download(
        self,
        repo_name: str,
        remote_path: str,
        local_path: str,
        branch: str = "main",
        max_workers: int = _DEFAULT_MAX_WORKERS,
        multi: bool = False,
        on_progress: Optional[TransferProgressCallback] = None,
    ) -> list[str]:
        """파일 또는 디렉토리를 로컬로 다운로드.

        Type B 다운로드: GET /repos/{repo}/token → GCS JSON API 직접 다운로드.

        Args:
            repo_name: 레포지토리 이름
            remote_path: 레포 내 경로 (예: 'training/ner-v4/')
            local_path: 로컬 저장 경로
            branch: 브랜치 (기본 'main')
            max_workers: 병렬 다운로드 워커 수
            multi: (미사용, 하위 호환)
            on_progress: 진행 상황 이벤트 콜백

        Returns:
            다운로드된 로컬 파일 경로 리스트

        Raises:
            httpx.HTTPStatusError: API 오류 시
        """
        return self._download_token(repo_name, remote_path, local_path, branch, max_workers, on_progress)

    def _download_cab(
        self,
        repo_name: str,
        remote_path: str,
        local_path: str,
        branch: str,
        max_workers: int,
        multi: bool,
        on_progress: Optional[TransferProgressCallback] = None,
    ) -> list[str]:
        """CAB 토큰 기반 다운로드. google-cloud-storage SDK로 GCS 직접 다운로드.

        2-step flow:
        1. POST /repos/{repo}/download/stream/open → CAB 토큰
        2. POST /repos/{repo}/download/stream/page → 물리주소 페이지 목록
        3. GCS SDK로 직접 다운로드
        """
        paths = [remote_path]
        self._emit_stage(
            on_progress,
            operation="download",
            stage="resolving",
            label="Opening download session",
            summary="waiting for server",
        )
        resp = self._http.post(
            self._url(f"/api/v1/repos/{repo_name}/download/stream/open"),
            json={"branch": branch, "paths": paths},
        )
        resp.raise_for_status()
        data = resp.json()
        token = data["token"]
        after: Optional[str] = None
        files: list[dict[str, Any]] = []
        resolved_count = 0

        while True:
            page_resp = self._http.post(
                self._url(f"/api/v1/repos/{repo_name}/download/stream/page"),
                json={
                    "branch": branch,
                    "paths": paths,
                    "after": after,
                    "limit": _DEFAULT_DOWNLOAD_PAGE_SIZE,
                },
            )
            page_resp.raise_for_status()
            page_data = page_resp.json()
            page_files = page_data["files"]
            files.extend(page_files)
            resolved_count += len(page_files)
            self._emit_stage(
                on_progress,
                operation="download",
                stage="resolving",
                label="Resolving remote paths",
                files_done=resolved_count,
                files_total=resolved_count,
                summary=f"{resolved_count} files resolved",
            )
            if not page_data.get("has_more"):
                break
            after = page_data.get("next_offset")

        if not files:
            return []

        gcs = self._gcs_client(token=token)
        targets = self._build_download_targets(gcs, files, remote_path, local_path, "download", on_progress)
        total_bytes = sum(target["size_bytes"] for target in targets)
        self._emit_progress(
            on_progress,
            type="start",
            operation="download",
            stage="transferring",
            summary=self._format_progress_label(0, len(targets)),
            label=self._format_progress_label(0, len(targets)),
            bytes_done=0,
            bytes_total=total_bytes,
            files_done=0,
            files_total=len(targets),
        )

        if self._should_use_chunked_transfer(len(targets), total_bytes, multi):
            transfer_manager = self._get_transfer_manager()
            target = targets[0]
            transfer_manager.download_chunks_concurrently(
                target["blob"],
                target["dest"],
                chunk_size=_DEFAULT_TRANSFER_CHUNK_SIZE,
                worker_type=transfer_manager.THREAD,
                max_workers=max_workers,
            )
            self._emit_progress(
                on_progress,
                type="file_complete",
                operation="download",
                stage="transferring",
                uri=f"dh://{repo_name}/{target['path']}",
                path=target["path"],
                local_path=target["dest"],
                label=self._format_progress_label(1, 1),
                summary=self._format_progress_label(1, 1),
                bytes_done=total_bytes,
                bytes_total=total_bytes,
                files_done=1,
                files_total=1,
            )
            return [target["dest"]]

        if multi:
            transfer_manager = self._get_transfer_manager()
            results = transfer_manager.download_many(
                [(target["blob"], target["dest"]) for target in targets],
                worker_type=transfer_manager.THREAD,
                max_workers=max_workers,
                raise_exception=False,
            )
            downloaded: list[str] = []
            completed_bytes = 0
            for index, result in enumerate(results):
                if result is not None:
                    raise result
                target = targets[index]
                downloaded.append(target["dest"])
                completed_bytes += target["size_bytes"]
                self._emit_progress(
                    on_progress,
                    type="file_complete",
                    operation="download",
                    stage="transferring",
                    uri=f"dh://{repo_name}/{target['path']}",
                    path=target["path"],
                    local_path=target["dest"],
                    label=self._format_progress_label(index + 1, len(targets)),
                    summary=self._format_progress_label(index + 1, len(targets)),
                    bytes_done=completed_bytes,
                    bytes_total=total_bytes,
                    files_done=index + 1,
                    files_total=len(targets),
                )
            return downloaded

        downloaded = []
        completed_bytes = 0
        for index, target in enumerate(targets, start=1):
            target["blob"].download_to_filename(target["dest"])
            downloaded.append(target["dest"])
            completed_bytes += target["size_bytes"]
            self._emit_progress(
                on_progress,
                type="file_complete",
                operation="download",
                stage="transferring",
                uri=f"dh://{repo_name}/{target['path']}",
                path=target["path"],
                local_path=target["dest"],
                label=self._format_progress_label(index, len(targets)),
                summary=self._format_progress_label(index, len(targets)),
                bytes_done=completed_bytes,
                bytes_total=total_bytes,
                files_done=index,
                files_total=len(targets),
            )
        return downloaded

    def _download_token(
        self,
        repo_name: str,
        remote_path: str,
        local_path: str,
        branch: str,
        max_workers: int,
        on_progress: Optional[TransferProgressCallback] = None,
    ) -> list[str]:
        """Type A 다운로드: stream/open + stream/page → 청크별 병렬 GCS GET → 순서대로 재조합.

        Flow:
          1. POST /api/v1/repos/{repo}/download/stream/open
             {branch, paths} → {token, token_expiry}
          2. POST /api/v1/repos/{repo}/download/stream/page (paginated)
             → {files: [{path, chunks: [{oid, size, offset, physical_address}]}]}
          3. 모든 청크를 ThreadPoolExecutor 병렬 GET
          4. 파일별 offset 순 정렬 후 로컬 파일에 순차 write
        """
        import urllib.parse

        self._emit_stage(
            on_progress,
            operation="download",
            stage="resolving",
            label="Fetching download token",
            summary="waiting for server",
        )

        # Step 1: get token via stream/open
        paths_payload = [remote_path] if remote_path else []
        open_resp = self._http.post(
            self._url(f"/api/v1/repos/{repo_name}/download/stream/open"),
            json={"branch": branch, "paths": paths_payload},
        )
        open_resp.raise_for_status()
        token: str = open_resp.json()["token"]

        # Step 2: paginate stream/page to collect all file entries
        all_files: list[dict] = []
        after: Optional[str] = None
        while True:
            page_body: dict = {"branch": branch, "paths": paths_payload, "limit": 1000}
            if after:
                page_body["after"] = after
            page_resp = self._http.post(
                self._url(f"/api/v1/repos/{repo_name}/download/stream/page"),
                json=page_body,
            )
            page_resp.raise_for_status()
            page_data = page_resp.json()
            all_files.extend(page_data.get("files", []))
            if not page_data.get("has_more"):
                break
            after = page_data.get("next_offset")

        files = all_files
        if not files:
            return []

        total_files = len(files)
        self._emit_progress(
            on_progress,
            type="start",
            operation="download",
            stage="transferring",
            summary=self._format_progress_label(0, total_files),
            label=self._format_progress_label(0, total_files),
            bytes_done=0,
            bytes_total=0,
            files_done=0,
            files_total=total_files,
        )

        def _gcs_get(physical_address: str) -> bytes:
            """GCS JSON API 직접 다운로드."""
            bucket_name, _, blob_path = physical_address[5:].partition("/")
            encoded_blob = urllib.parse.quote(blob_path, safe="")
            url = (
                f"https://storage.googleapis.com/download/storage/v1/b/"
                f"{bucket_name}/o/{encoded_blob}?alt=media"
            )
            resp = httpx.get(url, headers={"Authorization": f"Bearer {token}"})
            resp.raise_for_status()
            return resp.content

        def _download_one(entry: dict) -> str:
            """파일 항목을 청크별 병렬 다운로드 후 offset 순으로 재조합."""
            file_path = entry["path"]
            dest = self._resolve_download_destination(file_path, remote_path, local_path)
            os.makedirs(os.path.dirname(os.path.abspath(dest)), exist_ok=True)

            chunks = entry.get("chunks")
            if chunks:
                # Type A: 청크 단위 병렬 다운로드 → offset 순 정렬 → 재조합
                def _fetch_chunk(c: dict) -> tuple[int, bytes]:
                    data = _gcs_get(c["physical_address"])
                    return c["offset"], data

                with ThreadPoolExecutor(max_workers=min(max_workers, len(chunks))) as pool:
                    chunk_results = list(pool.map(_fetch_chunk, chunks))

                # offset 순 정렬 후 write
                chunk_results.sort(key=lambda x: x[0])
                with open(dest, "wb") as fh:
                    for _, data in chunk_results:
                        fh.write(data)
            else:
                # 레거시 Type B: single physical_address
                physical_address = entry.get("physical_address", "")
                data = _gcs_get(physical_address)
                with open(dest, "wb") as fh:
                    fh.write(data)

            return dest

        downloaded: list[str] = []

        if max_workers > 1 and len(files) > 1:
            with ThreadPoolExecutor(max_workers=min(max_workers, len(files))) as pool:
                futures = {pool.submit(_download_one, f): f for f in files}
                for index, fut in enumerate(as_completed(futures), start=1):
                    dest = fut.result()
                    entry = futures[fut]
                    downloaded.append(dest)
                    self._emit_progress(
                        on_progress,
                        type="file_complete",
                        operation="download",
                        stage="transferring",
                        uri=f"dh://{repo_name}/{entry['path']}",
                        path=entry["path"],
                        local_path=dest,
                        label=self._format_progress_label(index, total_files),
                        summary=self._format_progress_label(index, total_files),
                        bytes_done=0,
                        bytes_total=0,
                        files_done=index,
                        files_total=total_files,
                    )
        else:
            for index, entry in enumerate(files, start=1):
                dest = _download_one(entry)
                downloaded.append(dest)
                self._emit_progress(
                    on_progress,
                    type="file_complete",
                    operation="download",
                    stage="transferring",
                    uri=f"dh://{repo_name}/{entry['path']}",
                    path=entry["path"],
                    local_path=dest,
                    label=self._format_progress_label(index, total_files),
                    summary=self._format_progress_label(index, total_files),
                    bytes_done=0,
                    bytes_total=0,
                    files_done=index,
                    files_total=total_files,
                )

        return downloaded

    def upload(
        self,
        repo_name: str,
        local_path: str,
        branch: str = "main",
        message: Optional[str] = None,
        remote_prefix: str = "",
        max_workers: int = _DEFAULT_MAX_WORKERS,
        max_in_flight: int = _DEFAULT_MAX_IN_FLIGHT,
        metadata: Optional[DatasetMetadata] = None,
        multi: bool = False,
        on_progress: Optional[TransferProgressCallback] = None,
    ) -> Optional[CommitInfo]:
        """로컬 파일 또는 디렉토리를 업로드.

        Type A 업로드: BLAKE3 CAS + LFS batch endpoint + GCS signed URL 직접 전송.

        Args:
            repo_name: 레포지토리 이름
            local_path: 로컬 파일/디렉토리 경로
            branch: 브랜치 (기본 'main')
            message: 커밋 메시지
            remote_prefix: 원격 경로 prefix (예: 'data/' → data/a.txt로 업로드)
            max_workers: 병렬 업로드 워커 수
            metadata: 사용자 지정 메타데이터 (업로드 후 update_metadata로 적용)
            multi: (미사용, 하위 호환)
            on_progress: 진행 상황 이벤트 콜백

        Returns:
            커밋 시 CommitInfo, 아니면 None
        """
        file_entries = self._collect_file_entries(local_path, "upload", on_progress)
        return self._upload_lfs(
            repo_name, file_entries, branch, message,
            remote_prefix, max_workers, max_in_flight, metadata, on_progress,
        )

    def upload_many(
        self,
        repo_name: str,
        local_paths: list[str],
        branch: str = "main",
        message: Optional[str] = None,
        remote_prefix: str = "",
        max_workers: int = _DEFAULT_MAX_WORKERS,
        max_in_flight: int = _DEFAULT_MAX_IN_FLIGHT,
        metadata: Optional[DatasetMetadata] = None,
        multi: bool = False,
        on_progress: Optional[TransferProgressCallback] = None,
    ) -> Optional[CommitInfo]:
        """여러 로컬 파일/디렉토리를 하나의 커밋으로 업로드."""
        if not local_paths:
            return None

        file_entries: list[dict[str, Any]] = []
        for source_path in local_paths:
            source_entries = self._collect_file_entries(source_path, "upload", on_progress)
            if os.path.isdir(source_path):
                source_root = os.path.basename(os.path.normpath(source_path.rstrip(os.sep)))
                for entry in source_entries:
                    entry["remote_path"] = f"{source_root}/{entry['remote_path']}"
            file_entries.extend(source_entries)

        return self._upload_lfs(
            repo_name, file_entries, branch, message,
            remote_prefix, max_workers, max_in_flight, metadata, on_progress,
        )

    def _collect_file_entries(
        self,
        local_path: str,
        operation: str,
        on_progress: Optional[TransferProgressCallback] = None,
    ) -> list[dict]:
        """로컬 경로에서 업로드 대상 파일 목록 구성."""
        if os.path.isdir(local_path):
            local_files: list[str] = []
            for root, _dirs, filenames in os.walk(local_path):
                for fname in filenames:
                    local_files.append(os.path.join(root, fname))

            entries: list[dict] = []
            base = os.path.normpath(local_path)
            total_files = len(local_files)
            self._emit_stage(
                on_progress,
                operation=operation,
                stage="collecting",
                label="Collecting local files",
                files_done=0,
                files_total=total_files,
            )
            for index, local_file in enumerate(local_files, start=1):
                rel = os.path.relpath(local_file, base).replace(os.sep, "/")
                entries.append({
                    "local_path": local_file,
                    "remote_path": rel,
                    "size_bytes": os.path.getsize(local_file),
                })
                self._emit_stage(
                    on_progress,
                    operation=operation,
                    stage="collecting",
                    label="Collecting local files",
                    files_done=index,
                    files_total=total_files,
                )
            return entries
        self._emit_stage(
            on_progress,
            operation=operation,
            stage="collecting",
            label="Collecting local files",
            files_done=1,
            files_total=1,
        )
        return [{
            "local_path": local_path,
            "remote_path": os.path.basename(local_path),
            "size_bytes": os.path.getsize(local_path),
        }]

    # ──────────────────────────────────────────────
    # Type A 업로드 (Issue #85) — BLAKE3 CAS + LFS batch + signed URL
    # ──────────────────────────────────────────────

    @staticmethod
    def _blake3_hash_file(path: str) -> tuple[str, int]:
        """BLAKE3 hash와 크기를 반환. (hex_digest, size_bytes)"""
        import blake3 as _blake3  # lazy import

        hasher = _blake3.blake3()
        size = 0
        with open(path, "rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                hasher.update(chunk)
                size += len(chunk)
        return hasher.hexdigest(), size

    def _lfs_batch_url(self, repo_name: str) -> str:
        """LFS batch endpoint URL — group-scoped when repo_name contains '/'."""
        if "/" in repo_name:
            group, repo = repo_name.split("/", 1)
            return self._url(f"/api/v1/lfs/{group}/{repo}/objects/batch")
        return self._url(f"/api/v1/repos/{repo_name}/lfs/objects/batch")

    def _upload_lfs(
        self,
        repo_name: str,
        file_entries: list[dict[str, Any]],
        branch: str,
        message: Optional[str],
        remote_prefix: str,
        max_workers: int,
        max_in_flight: int = _DEFAULT_MAX_IN_FLIGHT,
        metadata: Optional[DatasetMetadata] = None,
        on_progress: Optional[TransferProgressCallback] = None,
    ) -> Optional[CommitInfo]:
        """Type A 업로드: fastcdc 가변 청크 + BLAKE3 CAS + LFS batch + 병렬 GCS PUT.

        Flow:
          1. fastcdc로 파일을 가변 청크로 분할, 청크별 BLAKE3 hash
          2. POST /repos/{repo}/lfs/objects/batch — 모든 청크 OID preflight (hit/miss)
          3. CAS miss 청크를 ThreadPoolExecutor로 병렬 GCS PUT (signed URL)
             semaphore(max_in_flight)로 동시 in-flight 청크 수 제한 (S3Transfer 패턴)
          4. POST /repos/{repo}/lfs/commits — 파일당 chunks 배열 포함
        """
        from datahub._cas import chunk_file, ChunkInfo

        if not file_entries:
            return None

        # remote_prefix 적용
        if remote_prefix:
            if remote_prefix.endswith("/"):
                prefix = remote_prefix.strip("/")
                for entry in file_entries:
                    entry["remote_path"] = f"{prefix}/{entry['remote_path']}"
            else:
                if len(file_entries) == 1:
                    file_entries[0]["remote_path"] = remote_prefix.lstrip("/")
                else:
                    prefix = remote_prefix.strip("/")
                    for entry in file_entries:
                        entry["remote_path"] = f"{prefix}/{entry['remote_path']}"

        total_files = len(file_entries)

        # ── 1. fastcdc chunking ────────────────────────────────────
        self._emit_stage(
            on_progress,
            operation="upload",
            stage="hashing",
            label="Chunking files (fastcdc + BLAKE3)",
            files_done=0,
            files_total=total_files,
        )
        # chunked_entries: [{...entry, chunks: [ChunkInfo]}]
        chunked_entries: list[dict[str, Any]] = []
        for index, entry in enumerate(file_entries, start=1):
            chunks = chunk_file(entry["local_path"])
            chunked_entries.append({**entry, "chunks": chunks})
            self._emit_stage(
                on_progress,
                operation="upload",
                stage="hashing",
                label="Chunking files (fastcdc + BLAKE3)",
                files_done=index,
                files_total=total_files,
            )

        # ── 2. LFS batch preflight (all chunk OIDs) ───────────────
        self._emit_stage(
            on_progress,
            operation="upload",
            stage="resolving",
            label="CAS preflight check",
            summary="waiting for server",
        )
        # Collect unique chunks across all files
        all_chunks_map: dict[str, ChunkInfo] = {}  # hash → ChunkInfo (dedup)
        for entry in chunked_entries:
            for c in entry["chunks"]:
                all_chunks_map[c.hash] = c

        batch_resp = _http_request_with_retry(
            self._http.post,
            self._lfs_batch_url(repo_name),
            json={
                "branch": branch,
                "objects": [{"oid": c.hash, "size": c.length} for c in all_chunks_map.values()],
            },
        )
        batch_resp.raise_for_status()
        batch_data = batch_resp.json()

        # oid → signed PUT URL (empty actions = CAS hit, skip upload)
        oid_to_href: dict[str, str] = {}
        for obj in batch_data.get("objects", []):
            actions = obj.get("actions") or []
            if actions:
                oid_to_href[obj["oid"]] = actions[0]["href"]

        # ── 3. Upload CAS miss chunks via signed URL (parallel) ───
        miss_chunks = [c for c in all_chunks_map.values() if c.hash in oid_to_href]
        total_bytes = sum(c.length for c in miss_chunks)
        total_miss = len(miss_chunks)

        self._emit_progress(
            on_progress,
            type="start",
            operation="upload",
            stage="transferring",
            summary=self._format_progress_label(0, total_miss),
            label=self._format_progress_label(0, total_miss),
            bytes_done=0,
            bytes_total=total_bytes,
            files_done=0,
            files_total=total_miss,
        )

        _sem = threading.Semaphore(max(1, max_in_flight))

        def _put_chunk_raw(c: ChunkInfo) -> ChunkInfo:
            href = oid_to_href[c.hash]
            resp = _http_request_with_retry(
                httpx.put, href,
                content=c.data,
                headers={"Content-Type": "application/octet-stream"},
            )
            resp.raise_for_status()
            return c

        def _put_chunk(c: ChunkInfo) -> ChunkInfo:
            try:
                return _put_chunk_raw(c)
            finally:
                _sem.release()

        completed_bytes = 0
        if max_workers > 1 and total_miss > 1:
            with ThreadPoolExecutor(max_workers=min(max_workers, total_miss)) as pool:
                futures: dict = {}
                for c in miss_chunks:
                    _sem.acquire()
                    futures[pool.submit(_put_chunk, c)] = c
                for index, fut in enumerate(as_completed(futures), start=1):
                    c = fut.result()
                    completed_bytes += c.length
                    self._emit_progress(
                        on_progress,
                        type="file_complete",
                        operation="upload",
                        stage="transferring",
                        uri=f"dh://{repo_name}/chunks/{c.hash}",
                        path=c.hash,
                        local_path="",
                        label=self._format_progress_label(index, total_miss),
                        summary=self._format_progress_label(index, total_miss),
                        bytes_done=completed_bytes,
                        bytes_total=total_bytes,
                        files_done=index,
                        files_total=total_miss,
                    )
        else:
            for index, c in enumerate(miss_chunks, start=1):
                _put_chunk_raw(c)
                completed_bytes += c.length
                self._emit_progress(
                    on_progress,
                    type="file_complete",
                    operation="upload",
                    stage="transferring",
                    uri=f"dh://{repo_name}/chunks/{c.hash}",
                    path=c.hash,
                    local_path="",
                    label=self._format_progress_label(index, total_miss),
                    summary=self._format_progress_label(index, total_miss),
                    bytes_done=completed_bytes,
                    bytes_total=total_bytes,
                    files_done=index,
                    files_total=total_miss,
                )

        # ── 4. Commit via /repos/{repo}/commits (chunks array) ────
        self._emit_stage(
            on_progress,
            operation="upload",
            stage="finalizing",
            label="Committing (LFS import)",
            files_done=0,
            files_total=total_files,
        )
        commit_objects = [
            {
                "path": entry["remote_path"],
                "chunks": [
                    {"oid": c.hash, "size": c.length, "offset": c.offset}
                    for c in entry["chunks"]
                ],
            }
            for entry in chunked_entries
        ]
        commit_resp = _http_request_with_retry(
            self._http.post,
            self._url(f"/api/v1/repos/{repo_name}/lfs/commits"),
            json={
                "branch": branch,
                "message": message or "",
                "objects": commit_objects,
            },
        )
        commit_resp.raise_for_status()
        result = commit_resp.json()
        self._emit_stage(
            on_progress,
            operation="upload",
            stage="finalizing",
            label="Committing (LFS import)",
            files_done=total_files,
            files_total=total_files,
        )
        commit_id = result.get("commit_id")
        if commit_id:
            return CommitInfo(id=commit_id, message=message or "")
        return None

    def get_file_manifest(
        self,
        repo_name: str,
        branch: str = "main",
    ) -> tuple[str, list[dict], float]:
        """마운트용 CAB 토큰 + 전체 파일 목록 조회.

        1-step flow:
        1. POST /repos/{repo}/download/cab → CAB 토큰 + 물리주소 목록

        Args:
            repo_name: 레포지토리 이름
            branch: 브랜치 (기본 'main')

        Returns:
            (cab_token, files, expires_at) — files: [{"path": "...", "physical_address": "gs://..."}]
        """
        resp = self._http.post(
            self._url(f"/api/v1/repos/{repo_name}/download/stream/open"),
            json={"branch": branch, "paths": [""]},
        )
        resp.raise_for_status()
        data = resp.json()
        token = data["token"]
        expiry = data.get("token_expiry", "")
        files: list[dict[str, str]] = []
        after: Optional[str] = None

        while True:
            page_resp = self._http.post(
                self._url(f"/api/v1/repos/{repo_name}/download/stream/page"),
                json={
                    "branch": branch,
                    "paths": [""],
                    "after": after,
                    "limit": _DEFAULT_DOWNLOAD_PAGE_SIZE,
                },
            )
            page_resp.raise_for_status()
            page_data = page_resp.json()
            files.extend(
                {"path": f["path"], "physical_address": f["physical_address"]}
                for f in page_data["files"]
            )
            if not page_data.get("has_more"):
                break
            after = page_data.get("next_offset")

        # expires_at: expiry ISO 문자열 파싱, 없으면 1시간 후 fallback
        expires_at: float = time.time() + 3600
        if expiry:
            try:
                from datetime import datetime as _dt, timezone as _tz
                dt = _dt.fromisoformat(expiry.replace("Z", "+00:00"))
                expires_at = dt.timestamp()
            except ValueError:
                pass
        return token, files, expires_at

    # ──────────────────────────────────────────────
    # URI 파싱
    # ──────────────────────────────────────────────

    @staticmethod
    def _parse_physical_address(uri: str) -> tuple[str, str]:
        """gs://bucket/path → (bucket, path)."""
        if not uri.startswith("gs://"):
            raise ValueError(f"GCS URI는 gs://로 시작해야 합니다: {uri}")
        stripped = uri[5:]
        parts = stripped.split("/", 1)
        bucket = parts[0]
        path = parts[1] if len(parts) == 2 else ""
        return bucket, path

    def _gcs_client(self, token: Optional[str] = None):
        """GCS Client 생성. token이 있으면 CAB 토큰으로 인증, 없으면 ADC 사용."""
        try:
            from google.cloud import storage  # type: ignore[import]
        except ImportError:
            raise ImportError(
                "google-cloud-storage 패키지가 필요합니다: pip install 'datahub[gcp]'"
            )
        if token:
            from google.oauth2.credentials import Credentials  # type: ignore[import]
            creds = Credentials(token=token)
            return storage.Client(credentials=creds)
        # ADC (사용자 자격증명)
        return storage.Client()

    def copy(
        self,
        src_uri: str,
        dst_uri: str,
        src_branch: str = "main",
        dst_branch: str = "main",
        message: Optional[str] = None,
        max_workers: int = _DEFAULT_MAX_WORKERS,
        multi: bool = False,
        on_progress: Optional[TransferProgressCallback] = None,
    ) -> Optional["CommitInfo"]:
        """dh:// → dh:// 레포 간 데이터 복사.
        
        Args:
            src_uri: 소스 dh:// URI
            dst_uri: 대상 dh:// URI
            src_branch: 소스 브랜치 (기본 'main')
            dst_branch: 대상 브랜치 (기본 'main')
            message: 커밋 메시지
            max_workers: 병렬 복사 워커 수
        
        Returns:
            commit이 발생한 경우 CommitInfo, 아니면 None
        
        Raises:
            ValueError: dh:// URI가 아닌 경우
            httpx.HTTPStatusError: API 오류 시
        """
        if not src_uri.startswith("dh://") or not dst_uri.startswith("dh://"):
            raise ValueError(
                f"dh:// URI만 지원합니다: {src_uri!r} → {dst_uri!r}"
            )
        return self._copy_dh_to_dh(src_uri, dst_uri, src_branch, dst_branch, message, max_workers, multi, on_progress)

    def _copy_dh_to_dh(
        self,
        src_uri: str,
        dst_uri: str,
        src_branch: str,
        dst_branch: str,
        message: Optional[str],
        max_workers: int,
        multi: bool,
        on_progress: Optional[TransferProgressCallback],
    ) -> Optional["CommitInfo"]:
        """dh:// → dh:// — 서버사이드 copy/stream 복사."""

        src_group, src_repo, src_path = parse_dh_uri(src_uri)
        dst_group, dst_repo, dst_path = parse_dh_uri(dst_uri)
        src_repo_name = f"{src_group}/{src_repo}"

        self._emit_stage(
            on_progress,
            operation="copy",
            stage="resolving",
            label="Opening copy session",
            summary="waiting for server",
        )
        open_resp = self._http.post(
            self._url(f"/api/v1/repos/{dst_group}/{dst_repo}/copy/stream/open"),
            json={
                "src_repo": src_repo_name,
                "src_branch": src_branch,
                "dest_branch": dst_branch,
                "commit_message": message,
            },
        )
        open_resp.raise_for_status()
        session_id = open_resp.json()["session_id"]

        self._emit_progress(
            on_progress,
            type="start",
            operation="copy",
            stage="transferring",
            label="Copying objects (server-side)",
            summary="0 files",
            files_done=0,
            files_total=0,
            bytes_done=0,
            bytes_total=0,
        )

        paths = [src_path.strip("/")] if src_path.strip("/") else [""]
        dest_prefix = dst_path.strip("/")

        page_resp = self._http.post(
            self._url(f"/api/v1/repos/{dst_group}/{dst_repo}/copy/stream/page"),
            json={
                "session_id": session_id,
                "paths": paths,
                "dest_prefix": dest_prefix,
            },
        )
        page_resp.raise_for_status()
        page_data = page_resp.json()
        files_accepted = page_data.get("files_accepted", 0)

        self._emit_progress(
            on_progress,
            type="file_complete",
            operation="copy",
            stage="transferring",
            label="Copying objects (server-side)",
            summary=f"{files_accepted} files",
            files_done=files_accepted,
            files_total=files_accepted,
            bytes_done=0,
            bytes_total=0,
        )

        commit_resp = self._http.post(
            self._url(f"/api/v1/repos/{dst_group}/{dst_repo}/copy/stream/commit"),
            json={"session_id": session_id},
        )
        commit_resp.raise_for_status()
        data = commit_resp.json()
        files_committed = data.get("files_committed", 0)
        self._emit_stage(
            on_progress,
            operation="copy",
            stage="finalizing",
            label="Finalizing copy",
            files_done=files_committed,
            files_total=files_committed,
        )
        commit_id = data.get("commit_id")
        if commit_id:
            return CommitInfo(id=commit_id, message=message or "")
        return None

    def ls(
        self,
        repo_name: str,
        path: str = "",
        branch: str = "main",
        recursive: bool = False,
        max_items: int = 100,
        after: Optional[str] = None,
    ) -> ListResult:
        """레포 내 파일 목록 조회 (페이지네이션)."""
        params: dict = {
            "branch": branch,
            "prefix": path,
            "recursive": str(recursive).lower(),
            "amount": max_items,
        }
        if after:
            params["after"] = after

        resp = self._http.get(self._url(f"/api/v1/repos/{repo_name}/ls"), params=params)
        resp.raise_for_status()
        data = resp.json()
        return ListResult(
            items=data["items"],
            has_more=data.get("has_more", False),
            next_offset=data.get("next_offset"),
        )


    # ──────────────────────────────────────────────
    # 버전 관리
    # ──────────────────────────────────────────────

    def create_branch(self, repo_name: str, branch_name: str, source: str = "main") -> None:
        """브랜치 생성."""
        resp = self._http.post(
            self._url(f"/api/v1/repos/{repo_name}/branches"),
            json={"branch_name": branch_name, "source": source},
        )
        resp.raise_for_status()

    def list_branches(self, repo_name: str) -> list[str]:
        """브랜치 목록."""
        resp = self._http.get(self._url(f"/api/v1/repos/{repo_name}/branches"))
        resp.raise_for_status()
        return resp.json()["branches"]

    def delete_branch(self, repo_name: str, branch_name: str) -> None:
        """브랜치 삭제."""
        resp = self._http.delete(self._url(f"/api/v1/repos/{repo_name}/branches/{branch_name}"))
        resp.raise_for_status()

    def commit(self, repo_name: str, branch_name: str, message: str) -> CommitInfo:
        """커밋."""
        resp = self._http.post(
            self._url(f"/api/v1/repos/{repo_name}/commits"),
            json={"branch": branch_name, "message": message},
        )
        resp.raise_for_status()
        data = resp.json()
        return CommitInfo(id=data["id"], message=data["message"], committer=data.get("committer", ""))

    def merge(self, repo_name: str, source_branch: str, into: str = "main") -> None:
        """브랜치 머지."""
        resp = self._http.post(
            self._url(f"/api/v1/repos/{repo_name}/merge"),
            json={"source_branch": source_branch, "into": into},
        )
        resp.raise_for_status()

    def diff(self, repo_name: str, source: str, target: str = "main") -> list[str]:
        """두 브랜치 간 변경 파일 목록."""
        resp = self._http.get(
            self._url(f"/api/v1/repos/{repo_name}/diff"),
            params={"source": source, "target": target},
        )
        resp.raise_for_status()
        return resp.json()["paths"]

    # ──────────────────────────────────────────────
    # 저장소 관리
    # ──────────────────────────────────────────────

    def create_repo(self, name: str, group: Optional[str] = None) -> dict:
        """저장소 생성. group 지정 시 해당 organization 하위에 생성."""
        payload: dict = {"repo_name": name}
        if group:
            payload["group"] = group
        resp = self._http.post(self._url("/api/v1/repos"), json=payload)
        resp.raise_for_status()
        return resp.json()

    def delete_repo(self, name: str) -> None:
        """저장소 삭제 (UC + GCS + DB 전체 cascade)."""
        resp = self._http.delete(self._url(f"/api/v1/repos/{name}"))
        resp.raise_for_status()

    def list_repos(self) -> list[dict]:
        """접근 가능한 레포 목록."""
        resp = self._http.get(self._url("/api/v1/repos"))
        resp.raise_for_status()
        return resp.json()["repos"]

    def grant_access(self, repo_name: str, email: str, role: str = "writer") -> None:
        """권한 부여."""
        resp = self._http.put(
            self._url(f"/api/v1/repos/{repo_name}/permissions"),
            json={"email": email, "role": role},
        )
        resp.raise_for_status()

    def revoke_access(self, repo_name: str, email: str) -> None:
        """권한 회수."""
        resp = self._http.delete(self._url(f"/api/v1/repos/{repo_name}/permissions/{email}"))
        resp.raise_for_status()

    def list_permissions(self, repo_name: str) -> list[dict]:
        """권한 목록."""
        resp = self._http.get(self._url(f"/api/v1/repos/{repo_name}/permissions"))
        resp.raise_for_status()
        return resp.json()["permissions"]


def _to_table_info(data: dict) -> TableInfo:
    return TableInfo(
        full_name=data["full_name"],
        catalog_name=data["catalog_name"],
        schema_name=data["schema_name"],
        table_name=data["table_name"],
        storage_location=data.get("storage_location", ""),
        comment=data.get("comment"),
        table_type=data.get("table_type"),
        data_source_format=data.get("data_source_format"),
        properties=data.get("properties"),
    )

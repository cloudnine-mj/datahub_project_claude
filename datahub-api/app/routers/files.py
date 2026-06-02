"""File transfer control-plane endpoints.

The API prepares and confirms object-storage transfers. File bytes move through
GCS, not through this FastAPI service, and no versioning engine is involved.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from google.api_core.exceptions import NotFound
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_scope
from app.models import Repo, User
from app.schemas.files import (
    BulkManifestInstruction,
    ContentResponse,
    CopyRequest,
    CopyResponse,
    DeleteFileResponse,
    DownloadTokenRequest,
    DownloadTokenResponse,
    FileEntry,
    FileListResponse,
    LsItem,
    LsResponse,
    OperationStatusResponse,
    TransferInstruction,
    UploadConfirmRequest,
    UploadConfirmResponse,
    WriteTokenRequest,
    WriteTokenResponse,
)
from app.services.audit import AuditService
from app.services.authorization import check_access, require_capability
from app.services.cab import generate_repo_download_token, generate_repo_upload_token
from app.services.gcs import GCSService
from app.services.idempotency import run_idempotent

router = APIRouter()
audit = AuditService()
_gcs = GCSService()


def _bucket_for(repo: Repo) -> str:
    return repo.bucket_name or f"{settings.gcp_bucket_prefix}-{repo.repo_name}"


def _parse_expiry(expiry: str | None) -> float | None:
    if not expiry:
        return None
    try:
        return datetime.fromisoformat(expiry.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def _normalize_path(path: str) -> str:
    candidate = path.strip().lstrip("/")
    if not candidate:
        return ""
    has_trailing_slash = candidate.endswith("/")
    candidate = candidate.rstrip("/")
    if not candidate:
        return ""
    parts = candidate.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise HTTPException(status_code=400, detail="Invalid repository file path")
    normalized = "/".join(parts)
    return f"{normalized}/" if has_trailing_slash else normalized


def _file_entry(item: dict) -> FileEntry:
    updated_at = None
    if item.get("mtime"):
        updated_at = datetime.fromtimestamp(item["mtime"]).isoformat() + "Z"
    return FileEntry(
        path=item["path"],
        kind="prefix" if item["path_type"] == "prefix" else "file",
        size=item.get("size_bytes"),
        updated_at=updated_at,
    )


def _api_error(status_code: int, *, code: str, message: str, target: str | None = None, retryable: bool = False) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "code": code,
            "message": message,
            "target": target,
            "retryable": retryable,
        },
    )


def _normalize_checksum(value: str | None) -> tuple[str, str] | None:
    if not value:
        return None
    algorithm, separator, checksum = value.strip().lower().partition(":")
    if separator:
        return algorithm, checksum
    if len(algorithm) == 64 and all(ch in "0123456789abcdef" for ch in algorithm):
        return "sha256", algorithm
    return "unknown", algorithm


def _validate_object_integrity(bucket: str, path: str, *, size: int | None = None, checksum: str | None = None) -> dict:
    metadata = _gcs.get_object_metadata(bucket, path)
    if not metadata.get("exists"):
        raise _api_error(
            404,
            code="object_not_found",
            message="Storage object was not found",
            target=path,
        )

    actual_size = metadata.get("size")
    if size is not None and actual_size is not None and int(actual_size) != int(size):
        raise _api_error(
            409,
            code="size_mismatch",
            message=f"Uploaded object size mismatch: expected {size}, got {actual_size}",
            target=path,
        )

    expected = _normalize_checksum(checksum)
    if expected is None:
        return metadata

    algorithm, expected_value = expected
    custom_metadata = metadata.get("metadata") or {}
    actual_value = None
    if algorithm == "sha256":
        actual_value = str(custom_metadata.get("sha256") or "").lower() or None
    elif algorithm == "crc32c":
        actual_value = str(metadata.get("crc32c") or "").lower() or None
    elif algorithm in {"md5", "md5_hash"}:
        actual_value = str(metadata.get("md5_hash") or "").lower() or None

    if actual_value is not None and actual_value != expected_value:
        raise _api_error(
            409,
            code="checksum_mismatch",
            message=f"Uploaded object checksum mismatch for {algorithm}",
            target=path,
        )
    return metadata


def _transfer(bucket: str, token: str, expiry: str | None, *, object_path: str | None = None, scope: str | None = None) -> TransferInstruction:
    """CAB downscoped 토큰 기반 storage-client 채널.

    `gcp_project` 는 환경별 설정 (settings.gcp_project) 을 그대로 전달한다.
    SDK 가 storage.Client(project=..., credentials=...) 를 명시 생성해서 google-
    cloud-storage 라이브러리의 암묵적 ADC project 추정 (사용자 로컬에서 실패)
    을 회피하기 위함. SDK 에 project 하드코드를 두지 않는다 — 운영팀이 storage
    host project 를 변경하더라도 서버 설정만 갱신하면 SDK 재배포 불필요.
    """
    return TransferInstruction(
        method="storage-client",
        bucket=bucket,
        gcp_project=settings.gcp_project,
        object_path=object_path,
        token=token,
        token_expiry=expiry,
        expires_at=_parse_expiry(expiry),
        scope=scope,
    )


def _is_web_bff(request: Request) -> bool:
    """검증된 X-Service-Token 으로 식별된 Web BFF 인지.

    main.py 의 service_token_middleware 가 정적 매핑(`_static_service_tokens`)
    에서 매칭된 caller 를 request.state.service_caller 에 채워준다.
    """
    return getattr(request.state, "service_caller", None) == "datahub-web"


# Web BFF 단일 파일 업로드 최대 크기 (Web Client Limits — governance §file-transfer).
# 더 큰 파일은 SDK/CLI 의 CAB 채널을 안내.
_WEB_SIGNED_URL_MAX_SIZE = 50 * 1024 * 1024
# Web BFF 용 signed URL TTL (분). 클라이언트가 받는 즉시 사용하는 가정.
_WEB_SIGNED_URL_TTL_MINUTES = 5
_BULK_MANIFEST_MAX_BYTES = 64 * 1024 * 1024


def _signed_url_transfer(
    bucket: str,
    object_path: str,
    method: str,
    *,
    content_type: str | None = None,
    scope: str | None = None,
) -> TransferInstruction:
    """Web BFF 용 signed URL 기반 TransferInstruction 생성.

    Args:
        method: "PUT" (upload) 또는 "GET" (download)
        content_type: PUT 일 때 클라이언트에 전달할 Content-Type 헤더.
    """
    physical_address = f"gs://{bucket}/{object_path}"
    effective_content_type = content_type or "application/octet-stream"
    signed_url = _gcs.generate_signed_url(
        physical_address,
        method=method,
        expiry_minutes=_WEB_SIGNED_URL_TTL_MINUTES,
        content_type=effective_content_type if method == "PUT" else None,
    )
    expires_at = datetime.now(timezone.utc).timestamp() + (_WEB_SIGNED_URL_TTL_MINUTES * 60)
    signed_headers: dict[str, str] | None = None
    if method == "PUT":
        signed_headers = {"Content-Type": effective_content_type}
    return TransferInstruction(
        method="signed-url",
        bucket=bucket,
        object_path=object_path,
        signed_url=signed_url,
        signed_headers=signed_headers,
        expires_at=expires_at,
        scope=scope,
    )


def _manifest_upload_path(upload_id: str) -> str:
    return f".datahub/manifests/{upload_id}.jsonl"


def _digest_bytes(data: bytes) -> str:
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def _load_bulk_manifest(
    bucket: str,
    manifest_ref: str,
    *,
    expected_digest: str | None,
    expected_count: int | None,
    expected_bytes: int | None,
) -> list[dict]:
    manifest_path = _normalize_path(manifest_ref)
    if not manifest_path:
        raise HTTPException(status_code=400, detail="manifest_ref is required")
    try:
        data, _total_size, truncated = _gcs.read_object_bytes(bucket, manifest_path, _BULK_MANIFEST_MAX_BYTES)
    except NotFound:
        raise _api_error(
            404,
            code="manifest_not_found",
            message="Bulk upload manifest was not found",
            target=manifest_path,
        )
    if truncated:
        raise _api_error(
            413,
            code="manifest_too_large",
            message="Bulk upload manifest exceeds the supported size",
            target=manifest_path,
        )

    actual_digest = _digest_bytes(data)
    if expected_digest and actual_digest != expected_digest:
        raise _api_error(
            409,
            code="manifest_digest_mismatch",
            message="Bulk upload manifest digest mismatch",
            target=manifest_path,
        )

    records: list[dict] = []
    for line_number, raw_line in enumerate(data.decode("utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            raise _api_error(
                400,
                code="invalid_manifest",
                message=f"Invalid JSONL record at line {line_number}",
                target=manifest_path,
            )
        path = _normalize_path(str(record.get("path") or ""))
        if not path:
            raise _api_error(
                400,
                code="invalid_manifest",
                message=f"Manifest record at line {line_number} is missing path",
                target=manifest_path,
            )
        records.append({
            "path": path,
            "size": record.get("size"),
            "checksum": record.get("checksum"),
        })

    files_count = len(records)
    bytes_total = sum(int(record.get("size") or 0) for record in records)
    if expected_count is not None and files_count != expected_count:
        raise _api_error(
            409,
            code="manifest_count_mismatch",
            message=f"Bulk upload manifest count mismatch: expected {expected_count}, got {files_count}",
            target=manifest_path,
        )
    if expected_bytes is not None and bytes_total != expected_bytes:
        raise _api_error(
            409,
            code="manifest_bytes_mismatch",
            message=f"Bulk upload manifest bytes mismatch: expected {expected_bytes}, got {bytes_total}",
            target=manifest_path,
        )
    return records


@router.get(
    "/repos/{owner}/{repo}/files",
    response_model=FileListResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def list_files(
    owner: str,
    repo: str,
    prefix: str = "",
    recursive: bool = False,
    limit: int = Query(100, ge=1, le=1000),
    page_token: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List repository objects using repository-internal paths."""
    repo_id = f"{owner}/{repo}"
    repo_obj = require_capability(db, user, repo_id, "file_list", min_member_role="guest")
    items, has_more, next_page_token = _gcs.list_objects(
        _bucket_for(repo_obj),
        prefix=_normalize_path(prefix),
        recursive=recursive,
        max_items=limit,
        page_token=page_token,
    )
    return FileListResponse(
        items=[_file_entry(item) for item in items],
        has_more=has_more,
        next_page_token=next_page_token,
    )


@router.post(
    "/repos/{owner}/{repo}/files/download-token",
    response_model=DownloadTokenResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def prepare_download(
    owner: str,
    repo: str,
    body: DownloadTokenRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo_id = f"{owner}/{repo}"
    repo_obj = require_capability(db, user, repo_id, "file_read", min_member_role="guest")
    path = _normalize_path(body.path)
    bucket = _bucket_for(repo_obj)
    files: list[FileEntry] = []
    if path.endswith("/") or body.recursive:
        listed, _, _ = _gcs.list_objects(bucket, prefix=path, recursive=True, max_items=1000)
        files = [_file_entry(item) for item in listed if item["path_type"] == "object"]
    elif path:
        metadata = _validate_object_integrity(bucket, path)
        files = [FileEntry(path=path, kind="file")]
        files[0].size = metadata.get("size")

    scope = "read-prefix" if body.recursive else "read-object"
    if _is_web_bff(request):
        # Web BFF 는 단일 객체 다운로드만 signed URL 로 처리.
        # prefix/recursive 다운로드는 BFF 가 클라이언트 한쌍의 signed URL 로 표현할 수 없어
        # SDK/CLI 경로(CAB)로 안내한다.
        if body.recursive or path.endswith("/") or not path:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Web BFF download supports single objects only. "
                    "Use the CLI/SDK for prefix or recursive downloads."
                ),
            )
        transfer = _signed_url_transfer(bucket, path, method="GET", scope=scope)
    else:
        try:
            token, expiry = generate_repo_download_token(bucket)
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Failed to issue download credentials. Contact support.",
            )
        transfer = _transfer(bucket, token, expiry, object_path=path, scope=scope)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="file.download.prepare",
        resource_type="repo",
        resource_id=repo_id,
        details={"path": path, "files_count": len(files), "transfer_method": transfer.method},
        ip_address=request.client.host if request.client else None,
    )
    return DownloadTokenResponse(
        operation_id=f"op_{uuid4().hex}",
        path=path,
        transfer=transfer,
        files=files,
    )


@router.post(
    "/repos/{owner}/{repo}/files/write-token",
    response_model=WriteTokenResponse,
    dependencies=[Depends(require_scope("repo", "write"))],
)
def prepare_upload(
    owner: str,
    repo: str,
    body: WriteTokenRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo_id = f"{owner}/{repo}"
    mode = body.mode or "single"
    path = _normalize_path(body.path or "")
    target_prefix = _normalize_path(body.target_prefix or "")
    if mode == "single" and not path:
        raise HTTPException(status_code=400, detail="path is required")
    if mode == "bulk" and _is_web_bff(request):
        raise HTTPException(
            status_code=422,
            detail="Web BFF upload supports single objects only. Use the CLI/SDK for bulk uploads.",
        )

    def _prepare() -> WriteTokenResponse:
        repo_obj = check_access(db, user, repo_id, min_role="contributor")
        bucket = _bucket_for(repo_obj)
        upload_id = f"upl_{uuid4().hex}"
        manifest_upload_path = _manifest_upload_path(upload_id) if mode == "bulk" else None

        if _is_web_bff(request):
            # Web Client Limits — 단일 파일 50MB 이상은 SDK/CLI 로 유도.
            if body.size is not None and body.size > _WEB_SIGNED_URL_MAX_SIZE:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Single file exceeds {_WEB_SIGNED_URL_MAX_SIZE // (1024 * 1024)}MB. "
                        "Use the CLI for larger files."
                    ),
                )
            transfer = _signed_url_transfer(
                bucket,
                path,
                method="PUT",
                content_type=body.content_type,
                scope="write-object",
            )
        else:
            try:
                token, expiry = generate_repo_upload_token(bucket)
            except Exception:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to issue upload credentials. Contact support.",
                )
            transfer = _transfer(
                bucket,
                token,
                expiry,
                object_path=target_prefix if mode == "bulk" else path,
                scope="operation-prefix" if mode == "bulk" else "write-object",
            )

        audit.log(
            db,
            user_id=user.id,
            user_email=user.email,
            action="file.bulk_upload.prepare" if mode == "bulk" else "file.upload.prepare",
            resource_type="repo",
            resource_id=repo_id,
            details={
                "path": path,
                "mode": mode,
                "target_prefix": target_prefix,
                "files_count": body.files_count,
                "bytes_total": body.bytes_total,
                "manifest_digest": body.manifest_digest,
                "manifest_ref": manifest_upload_path,
                "size": body.size,
                "upload_id": upload_id,
                "transfer_method": transfer.method,
            },
            ip_address=request.client.host if request.client else None,
        )
        return WriteTokenResponse(
            operation_id=f"op_{uuid4().hex}",
            upload_id=upload_id,
            mode=mode,
            path=path,
            target_prefix=target_prefix or None,
            manifest=BulkManifestInstruction(upload_path=manifest_upload_path) if manifest_upload_path else None,
            transfer=transfer,
        )

    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"file.write-token:{repo_id}",
        body={
            "mode": mode,
            "path": path,
            "target_prefix": target_prefix,
            "files_count": body.files_count,
            "bytes_total": body.bytes_total,
            "manifest_digest": body.manifest_digest,
            "size": body.size,
            "content_type": body.content_type,
        },
        response_factory=_prepare,
        required=True,
    )


@router.post(
    "/repos/{owner}/{repo}/files/confirm",
    response_model=UploadConfirmResponse,
    dependencies=[Depends(require_scope("repo", "write"))],
)
def confirm_upload_bulk(
    owner: str,
    repo: str,
    body: UploadConfirmRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo_id = f"{owner}/{repo}"
    mode = body.mode or "single"
    path = _normalize_path(body.path or "")
    manifest_ref = _normalize_path(body.manifest_ref or "")
    if mode == "single" and not path:
        raise HTTPException(status_code=400, detail="path is required")
    if mode == "bulk" and not manifest_ref:
        raise HTTPException(status_code=400, detail="manifest_ref is required")
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"file.confirm:{repo_id}",
        body={
            "mode": mode,
            "path": path,
            "upload_id": body.upload_id,
            "size": body.size,
            "checksum": body.checksum,
            "manifest_ref": manifest_ref,
            "manifest_digest": body.manifest_digest,
            "files_count": body.files_count,
            "bytes_total": body.bytes_total,
        },
        response_factory=lambda: (
            _confirm_bulk_upload(owner, repo, body, request, user, db)
            if mode == "bulk"
            else _confirm_upload(owner, repo, path, body, request, user, db)
        ),
        required=True,
    )


@router.get(
    "/repos/{owner}/{repo}/files/operations/{operation_id}",
    response_model=OperationStatusResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_operation_status(
    owner: str,
    repo: str,
    operation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_access(db, user, f"{owner}/{repo}", min_role="guest")
    return OperationStatusResponse(operation_id=operation_id, status="completed")


@router.post(
    "/repos/{owner}/{repo}/files/copy",
    response_model=CopyResponse,
    dependencies=[Depends(require_scope("repo", "write"))],
)
def copy_file(
    owner: str,
    repo: str,
    body: CopyRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_repo_id = f"{owner}/{repo}"
    source_path = _normalize_path(body.source_path)
    target_path = _normalize_path(body.target_path)
    if not source_path or not target_path:
        raise HTTPException(status_code=400, detail="source_path and target_path are required")

    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"file.copy:{target_repo_id}",
        body={
            "source_repo": body.source_repo,
            "source_path": source_path,
            "target_path": target_path,
        },
        response_factory=lambda: _copy_file(
            target_repo_id,
            body.source_repo,
            source_path,
            target_path,
            request,
            user,
            db,
        ),
        required=True,
    )


def _copy_file(
    target_repo_id: str,
    source_repo_id: str,
    source_path: str,
    target_path: str,
    request: Request,
    user: User,
    db: Session,
) -> CopyResponse:
    source_repo = require_capability(db, user, source_repo_id, "file_read", min_member_role="guest")
    target_repo = check_access(db, user, target_repo_id, min_role="contributor")
    source_metadata = _validate_object_integrity(_bucket_for(source_repo), source_path)
    source_uri = f"gs://{_bucket_for(source_repo)}/{source_path}"
    target_uri = f"gs://{_bucket_for(target_repo)}/{target_path}"
    _gcs.server_side_copy(source_uri, target_uri)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="file.copy",
        resource_type="repo",
        resource_id=target_repo_id,
        details={"source_repo": source_repo_id, "source_path": source_path, "target_path": target_path},
        ip_address=request.client.host if request.client else None,
    )
    return CopyResponse(
        operation_id=f"op_{uuid4().hex}",
        files_done=1,
        bytes_done=source_metadata.get("size") or 0,
    )


@router.put(
    "/repos/{owner}/{repo}/files/{path:path}",
    response_model=UploadConfirmResponse,
    dependencies=[Depends(require_scope("repo", "write"))],
)
def confirm_upload(
    owner: str,
    repo: str,
    path: str,
    body: UploadConfirmRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized = _normalize_path(path)
    repo_id = f"{owner}/{repo}"
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"file.confirm:{repo_id}",
        body={
            "path": normalized,
            "upload_id": body.upload_id,
            "size": body.size,
            "checksum": body.checksum,
        },
        response_factory=lambda: _confirm_upload(owner, repo, normalized, body, request, user, db),
        required=True,
    )


def _confirm_upload(
    owner: str,
    repo: str,
    path: str,
    body: UploadConfirmRequest,
    request: Request,
    user: User,
    db: Session,
) -> UploadConfirmResponse:
    repo_id = f"{owner}/{repo}"
    repo_obj = check_access(db, user, repo_id, min_role="contributor")
    normalized = _normalize_path(path)
    if not normalized:
        raise HTTPException(status_code=400, detail="path is required")
    _validate_object_integrity(_bucket_for(repo_obj), normalized, size=body.size, checksum=body.checksum)
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="file.upload.confirm",
        resource_type="repo",
        resource_id=repo_id,
        details={"path": normalized, "upload_id": body.upload_id, "size": body.size, "checksum": body.checksum},
        ip_address=request.client.host if request.client else None,
    )
    return UploadConfirmResponse(operation_id=f"op_{uuid4().hex}", path=normalized)


def _confirm_bulk_upload(
    owner: str,
    repo: str,
    body: UploadConfirmRequest,
    request: Request,
    user: User,
    db: Session,
) -> UploadConfirmResponse:
    repo_id = f"{owner}/{repo}"
    repo_obj = check_access(db, user, repo_id, min_role="contributor")
    bucket = _bucket_for(repo_obj)
    manifest_ref = _normalize_path(body.manifest_ref or "")
    records = _load_bulk_manifest(
        bucket,
        manifest_ref,
        expected_digest=body.manifest_digest,
        expected_count=body.files_count,
        expected_bytes=body.bytes_total,
    )
    for record in records:
        _validate_object_integrity(
            bucket,
            record["path"],
            size=record.get("size"),
            checksum=record.get("checksum"),
        )

    files_total = len(records)
    bytes_total = sum(int(record.get("size") or 0) for record in records)
    operation_id = f"op_{uuid4().hex}"
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="file.bulk_upload.confirm",
        resource_type="repo",
        resource_id=repo_id,
        details={
            "upload_id": body.upload_id,
            "manifest_ref": manifest_ref,
            "manifest_digest": body.manifest_digest,
            "files_count": files_total,
            "bytes_total": bytes_total,
        },
        ip_address=request.client.host if request.client else None,
    )
    return UploadConfirmResponse(
        operation_id=operation_id,
        status="completed",
        path="",
        files_total=files_total,
        bytes_total=bytes_total,
        status_url=f"/api/v1/repos/{owner}/{repo}/files/operations/{operation_id}",
    )


@router.delete(
    "/repos/{owner}/{repo}/files/{path:path}",
    response_model=DeleteFileResponse,
    dependencies=[Depends(require_scope("repo", "write"))],
)
def delete_file(
    owner: str,
    repo: str,
    path: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo_id = f"{owner}/{repo}"
    normalized = _normalize_path(path)
    if not normalized:
        raise HTTPException(status_code=400, detail="path is required")

    def _delete() -> DeleteFileResponse:
        repo_obj = check_access(db, user, repo_id, min_role="contributor")
        _gcs.delete_objects([f"gs://{_bucket_for(repo_obj)}/{normalized}"])
        audit.log(
            db,
            user_id=user.id,
            user_email=user.email,
            action="file.delete",
            resource_type="repo",
            resource_id=repo_id,
            details={"path": normalized},
            ip_address=request.client.host if request.client else None,
        )
        return DeleteFileResponse(path=normalized)

    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"file.delete:{repo_id}",
        body={"path": normalized},
        response_factory=_delete,
        required=True,
    )


@router.get(
    "/repos/{owner}/{repo}/files/content",
    response_model=ContentResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def get_content(
    owner: str,
    repo: str,
    path: str = Query(..., description="Repository-internal file path"),
    max_bytes: int = Query(10240, ge=1, le=1024 * 1024),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo_id = f"{owner}/{repo}"
    repo_obj = require_capability(db, user, repo_id, "file_read", min_member_role="guest")
    content, total_size, truncated = _gcs.read_text_object(_bucket_for(repo_obj), _normalize_path(path), max_bytes)
    return ContentResponse(content=content, total_size=total_size, truncated=truncated)


@router.get(
    "/repos/{repo}/ls",
    response_model=LsResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def ls_legacy(
    repo: str,
    prefix: str = "",
    recursive: bool = False,
    amount: int = Query(100, ge=1, le=1000),
    after: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compatibility wrapper for older SDK `ls` calls."""
    repo_obj = require_capability(db, user, repo, "file_list", min_member_role="guest")
    items, has_more, next_offset = _gcs.list_objects(
        _bucket_for(repo_obj),
        prefix=_normalize_path(prefix),
        recursive=recursive,
        max_items=amount,
        page_token=after,
    )
    return LsResponse(
        items=[
            LsItem(
                path=item["path"],
                path_type="prefix" if item["path_type"] == "prefix" else "object",
                size_bytes=item.get("size_bytes"),
                mtime=item.get("mtime"),
            )
            for item in items
        ],
        has_more=has_more,
        next_offset=next_offset,
    )


@router.get(
    "/repos/{owner}/{repo}/ls",
    response_model=LsResponse,
    dependencies=[Depends(require_scope("repo", "read"))],
)
def ls_group_legacy(
    owner: str,
    repo: str,
    prefix: str = "",
    recursive: bool = False,
    amount: int = Query(100, ge=1, le=1000),
    after: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ls_legacy(f"{owner}/{repo}", prefix, recursive, amount, after, user, db)

"""File Operations 엔드포인트.

- POST /repos/{repo}/lfs/objects/batch: LFS preflight — CAS 체크 + GCS 업로드 URL 반환 (developer 이상)
- POST /repos/{repo}/lfs/commits: LakeFS Staging API link + commit (developer 이상)
- POST /repos/{repo}/token: objectAdmin CAB 토큰 발행 (developer 이상)
- GET  /repos/{repo}/token: objectViewer CAB 토큰 발행 (guest 이상)
- POST /repos/{repo}/download: Signed URL 반환
- POST /repos/{repo}/download/stream/open: 스트림 다운로드용 CAB 토큰 발행
- POST /repos/{repo}/download/stream/page: 스트림 파일 목록 페이지
- GET  /repos/{repo}/ls: 파일 목록
- GET  /repos/{repo}/content: 파일 내용 프리뷰
- POST /repos/{repo}/migrate: GCS → GCS 서버사이드 복사
- Group-scoped aliases: /lfs/{group}/{repo}/..., /repos/{group}/{repo}/...
- POST /repos/{group}/{repo}/copy/stream/open: Copy session 생성
- POST /repos/{group}/{repo}/copy/stream/page: 청크 메타데이터 복사
- POST /repos/{group}/{repo}/copy/stream/commit: LakeFS 링크 + 커밋
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional, TypeVar
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_scope
from app.models import Chunk, CopySession, Manifest, ManifestChunk, RepoLineage, User
from app.services.authorization import check_access, require_capability
from app.schemas.files import (
    ContentResponse,
    CopyStreamCommitRequest,
    CopyStreamCommitResponse,
    CopyStreamOpenRequest,
    CopyStreamOpenResponse,
    CopyStreamPageRequest,
    CopyStreamPageResponse,
    DownloadChunkInfo,
    DownloadFileEntry,
    DownloadFileMapping,
    DownloadRequest,
    DownloadResponse,
    DownloadStreamOpenRequest,
    DownloadStreamOpenResponse,
    DownloadStreamPageRequest,
    DownloadStreamPageResponse,
    LfsBatchAction,
    LfsBatchObjectResponse,
    LfsBatchRequest,
    LfsBatchResponse,
    LfsCommitRequest,
    LfsCommitResponse,
    LsItem,
    LsResponse,
    MigrateRequest,
    MigrateResponse,
    RepoTokenResponse,
)
from app.services.audit import AuditService
from app.services.gcs import GCSService
from app.services.lakefs import LakeFSService, StagingLocation
logger = logging.getLogger(__name__)

router = APIRouter()
audit = AuditService()

_gcs = GCSService()
_lakefs = LakeFSService()

T = TypeVar("T")
R = TypeVar("R")


def _parallel_map(items: list[T], func: Callable[[T], R], max_workers: int) -> list[R]:
    if not items:
        return []

    worker_count = max(1, min(max_workers, len(items)))
    if worker_count == 1:
        return [func(item) for item in items]

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        return list(executor.map(func, items))


def _parse_expiry(expiry: Optional[str]) -> Optional[float]:
    if not expiry:
        return None
    try:
        dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        return dt.timestamp()
    except ValueError:
        return None


def _cas_path(bucket: str, oid: str) -> str:
    return f"gs://{bucket}/_cas/{oid[:2]}/{oid}"


def _store_manifest(db, repo, branch, file_path, chunks, user_id, bucket, session_id=None):
    """Upsert Chunk + create Manifest + ManifestChunk rows for fastcdc upload."""
    total_size = sum(c.size for c in chunks)
    manifest_id = str(uuid4())
    for c in chunks:
        db.execute(
            pg_insert(Chunk).values(oid=c.oid, size=c.size).on_conflict_do_nothing(
                index_elements=["oid"]
            )
        )
    manifest = Manifest(
        id=manifest_id,
        repo_name=repo,
        branch=branch,
        file_path=file_path,
        total_size=total_size,
        created_by=user_id,
        session_id=session_id,
    )
    db.add(manifest)
    for c in chunks:
        db.add(
            ManifestChunk(
                manifest_id=manifest_id,
                chunk_oid=c.oid,
                offset=c.offset,
                physical_address=_cas_path(bucket, c.oid),
            )
        )


def _enrich_with_chunks(db, repo, branch, bucket, files):
    """Replace DownloadFileMapping entries with chunk info from DB when available."""
    enriched = []
    for f in files:
        manifest = (
            db.query(Manifest)
            .filter(
                Manifest.repo_name == repo,
                Manifest.branch == branch,
                Manifest.file_path == f.path,
            )
            .order_by(Manifest.created_at.desc())
            .first()
        )
        if manifest and manifest.manifest_chunks:
            chunks = [
                DownloadChunkInfo(
                    oid=mc.chunk_oid,
                    size=mc.chunk.size,
                    offset=mc.offset,
                    physical_address=mc.physical_address or _cas_path(bucket, mc.chunk_oid),
                )
                for mc in manifest.manifest_chunks
            ]
            enriched.append(
                DownloadFileMapping(
                    path=f.path,
                    physical_address=f.physical_address,
                    size_bytes=f.size_bytes,
                    chunks=chunks,
                )
            )
        else:
            enriched.append(f)
    return enriched


def _resolve_download_mapping(
    repo: str,
    branch: str,
    path: str,
    size_bytes: Optional[int] = None,
) -> DownloadFileMapping:
    physical_addr, resolved_size_bytes = _lakefs.resolve_physical_path(repo, branch, path)
    if not _gcs.object_exists(physical_addr):
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Resolved backing object is missing from GCS",
                "repo": repo,
                "branch": branch,
                "path": path,
                "physical_address": physical_addr,
            },
        )

    return DownloadFileMapping(
        path=path,
        physical_address=physical_addr,
        size_bytes=size_bytes if isinstance(size_bytes, int) else resolved_size_bytes,
    )


def _resolve_download_page(repo: str, branch: str, path: str, after: Optional[str], limit: int) -> tuple[list[DownloadFileMapping], bool, Optional[str]]:
    if path.endswith("/") or path == "":
        items, has_more, next_offset = _lakefs.list_objects(
            repo,
            branch,
            prefix=path,
            recursive=True,
            max_items=limit,
            after=after,
        )
        object_items = [item for item in items if item.path_type == "object"]
        resolved = _parallel_map(
            object_items,
            lambda item: _resolve_download_mapping(repo, branch, item.path, item.size_bytes),
            settings.lakefs_download_resolve_max_workers,
        )
        return resolved, has_more, next_offset

    return [_resolve_download_mapping(repo, branch, path)], False, None


@router.post("/repos/{repo}/lfs/objects/batch", response_model=LfsBatchResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def lfs_objects_batch(
    repo: str,
    body: LfsBatchRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """LFS preflight — CAS 체크 후 업로드 필요 객체에 대해 GCS 서명 URL 반환 (developer 이상).

    CAS hit(이미 존재)이면 actions=[] — 클라이언트가 업로드를 건너뜁니다.
    CAS miss면 PUT 서명 URL을 actions에 포함합니다.
    응답에는 objectAdmin CAB 토큰도 포함됩니다.
    """
    repo_obj = check_access(db, user, repo, min_role="developer")

    from app.services.cab import generate_repo_upload_token

    bucket = repo_obj.bucket_name or f"{settings.gcp_bucket_prefix}-{repo_obj.repo_name}"
    token, expiry = generate_repo_upload_token(repo_obj.repo_name)

    result_objects: list[LfsBatchObjectResponse] = []
    for obj in body.objects:
        h = obj.oid
        cas_path = f"gs://{bucket}/_cas/{h[:2]}/{h}"
        exists = _gcs.object_exists(cas_path)

        if exists:
            actions: list[LfsBatchAction] = []
        else:
            signed_url = _gcs.generate_signed_url(cas_path, method="PUT")
            actions = [LfsBatchAction(href=signed_url, expires_at=expiry)]

        result_objects.append(LfsBatchObjectResponse(oid=h, actions=actions))

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="lfs_batch",
        resource_type="repo",
        resource_id=repo,
        details={
            "branch": body.branch,
            "objects_count": len(body.objects),
            "cas_hits": sum(1 for o in result_objects if not o.actions),
        },
        ip_address=request.client.host if request.client else None,
    )

    return LfsBatchResponse(
        objects=result_objects,
        cab_token=token,
        bucket=bucket,
        token_expiry=expiry,
        expires_at=_parse_expiry(expiry),
    )


@router.post("/repos/{repo}/lfs/commits", response_model=LfsCommitResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def lfs_commit(
    repo: str,
    body: LfsCommitRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """CAS 오브젝트를 LakeFS Staging API로 등록 + 커밋 (developer 이상).

    fastcdc chunks[] 형식과 legacy oid 형식 모두 지원.
    chunks[]가 있으면 DB에 Manifest + ManifestChunk를 저장하고
    첫 번째(가장 낮은 offset) 청크를 대표 물리 주소로 사용.
    """
    repo_obj = check_access(db, user, repo, min_role="developer")

    if not body.objects:
        raise HTTPException(status_code=400, detail="objects must not be empty")

    lfs_repo = repo_obj.repo_name
    bucket = repo_obj.bucket_name or f"{settings.gcp_bucket_prefix}-{lfs_repo}"

    for obj in body.objects:
        if obj.chunks:
            # fastcdc chunked upload — store manifest in DB
            _store_manifest(db, lfs_repo, body.branch, obj.path, obj.chunks, user.id, bucket)
            db.flush()
            first_chunk = min(obj.chunks, key=lambda c: c.offset)
            cas_physical = _cas_path(bucket, first_chunk.oid)
            total_size = sum(c.size for c in obj.chunks)
            _lakefs.link_physical_address(
                repo_name=lfs_repo,
                branch=body.branch,
                path=obj.path,
                staging=StagingLocation(physical_address=cas_physical),
                size_bytes=total_size,
                checksum=first_chunk.oid,
            )
        elif obj.oid:
            # Legacy single-oid upload
            cas_physical = f"gs://{bucket}/_cas/{obj.oid[:2]}/{obj.oid}"
            _lakefs.link_physical_address(
                repo_name=lfs_repo,
                branch=body.branch,
                path=obj.path,
                staging=StagingLocation(physical_address=cas_physical),
                size_bytes=obj.size,
                checksum=obj.oid,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Object '{obj.path}' must have either 'oid' or 'chunks'",
            )

    commit_info = _lakefs.commit(
        repo_name=lfs_repo,
        branch_name=body.branch,
        message=body.message or "Upload via DataHub LFS",
        user_email=user.email,
    )

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="lfs_commit",
        resource_type="repo",
        resource_id=repo,
        details={
            "branch": body.branch,
            "objects_count": len(body.objects),
            "commit_id": commit_info.id,
            "message": body.message,
        },
        ip_address=request.client.host if request.client else None,
    )

    return LfsCommitResponse(commit_id=commit_info.id)


@router.post("/repos/{repo}/token", response_model=RepoTokenResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_upload_token(
    repo: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포 objectAdmin CAB 토큰 발행 (업로드용, developer 이상)."""
    repo_obj = check_access(db, user, repo, min_role="developer")

    from app.services.cab import generate_repo_upload_token

    token, expiry = generate_repo_upload_token(repo_obj.repo_name)
    bucket = repo_obj.bucket_name or f"{settings.gcp_bucket_prefix}-{repo_obj.repo_name}"

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="token_issue_upload",
        resource_type="repo",
        resource_id=repo,
        details={"bucket": bucket, "token_expiry": expiry},
        ip_address=request.client.host if request.client else None,
    )

    return RepoTokenResponse(cab_token=token, bucket=bucket, token_expiry=expiry)


@router.get("/repos/{repo}/token", response_model=RepoTokenResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_download_token(
    repo: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포 objectViewer CAB 토큰 발행 (다운로드용, guest 이상)."""
    repo_obj = check_access(db, user, repo, min_role="guest")

    from app.services.cab import generate_repo_download_token

    token, expiry = generate_repo_download_token(repo_obj.repo_name)
    bucket = repo_obj.bucket_name or f"{settings.gcp_bucket_prefix}-{repo_obj.repo_name}"

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="token_issue_download",
        resource_type="repo",
        resource_id=repo,
        details={"bucket": bucket, "token_expiry": expiry},
        ip_address=request.client.host if request.client else None,
    )

    return RepoTokenResponse(cab_token=token, bucket=bucket, token_expiry=expiry)


@router.post("/repos/{repo}/download", response_model=DownloadResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def download(
    repo: str,
    body: DownloadRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """물리 경로 resolve → Signed URL 반환.

    governance: 비멤버는 public_access.file_read 가 true 일 때만 통과.
    """
    repo_obj = require_capability(db, user, repo, "file_read", min_member_role="guest")
    lfs_repo = repo_obj.repo_name

    files: list[DownloadFileEntry] = []

    for path in body.paths:
        if path.endswith("/") or path == "":
            for logical_path, physical_addr, size_bytes in _lakefs.iter_physical_paths(lfs_repo, body.branch, path):
                mapping = _resolve_download_mapping(lfs_repo, body.branch, logical_path, size_bytes)
                signed_url = _gcs.generate_signed_url(mapping.physical_address, method="GET")
                files.append(DownloadFileEntry(path=logical_path, signed_url=signed_url, physical_address=mapping.physical_address, size_bytes=mapping.size_bytes))
        else:
            mapping = _resolve_download_mapping(lfs_repo, body.branch, path)
            signed_url = _gcs.generate_signed_url(mapping.physical_address, method="GET")
            files.append(DownloadFileEntry(path=path, signed_url=signed_url, physical_address=mapping.physical_address, size_bytes=mapping.size_bytes))

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="download",
        resource_type="repo",
        resource_id=repo,
        details={"branch": body.branch, "paths": body.paths, "files_count": len(files)},
        ip_address=request.client.host if request.client else None,
    )

    return DownloadResponse(files=files)


@router.post("/repos/{repo}/download/stream/open", response_model=DownloadStreamOpenResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def download_stream_open(
    repo: str,
    body: DownloadStreamOpenRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """governance: 비멤버는 public_access.file_read 가 true 일 때만 통과."""
    repo_obj = require_capability(db, user, repo, "file_read", min_member_role="guest")

    from app.services.cab import generate_repo_download_token

    token, expiry = generate_repo_download_token(repo_obj.repo_name)
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="download_stream_open",
        resource_type="repo",
        resource_id=repo,
        details={"branch": body.branch, "paths_count": len(body.paths)},
        ip_address=request.client.host if request.client else None,
    )
    return DownloadStreamOpenResponse(token=token, token_expiry=expiry, expires_at=_parse_expiry(expiry))


@router.post("/repos/{repo}/download/stream/page", response_model=DownloadStreamPageResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def download_stream_page(
    repo: str,
    body: DownloadStreamPageRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """governance: 비멤버는 public_access.file_read 가 true 일 때만 통과."""
    repo_obj = require_capability(db, user, repo, "file_read", min_member_role="guest")
    lfs_repo = repo_obj.repo_name
    if len(body.paths) != 1:
        raise HTTPException(status_code=400, detail="Streaming download currently supports exactly one path")

    files, has_more, next_offset = _resolve_download_page(lfs_repo, body.branch, body.paths[0], body.after, body.limit)

    bucket = repo_obj.bucket_name or f"{settings.gcp_bucket_prefix}-{lfs_repo}"
    files = _enrich_with_chunks(db, lfs_repo, body.branch, bucket, files)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="download_stream_page",
        resource_type="repo",
        resource_id=repo,
        details={"branch": body.branch, "count": len(files), "has_more": has_more},
        ip_address=request.client.host if request.client else None,
    )
    return DownloadStreamPageResponse(files=files, has_more=has_more, next_offset=next_offset)


@router.get("/repos/{repo}/ls", response_model=LsResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def ls(
    repo: str,
    branch: str = "main",
    prefix: str = "",
    recursive: bool = False,
    amount: int = 100,
    after: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포 내 파일 목록 (페이지네이션).

    governance: 비멤버는 public_access.file_list 가 true 일 때만 통과.
    """
    repo_obj = require_capability(db, user, repo, "file_list", min_member_role="guest")

    entries, has_more, next_offset = _lakefs.list_objects(
        repo_obj.repo_name, branch, prefix=prefix, recursive=recursive,
        max_items=amount, after=after,
    )

    items = [
        LsItem(
            path=e.path,
            path_type=e.path_type,
            size_bytes=e.size_bytes,
            mtime=e.mtime,
        )
        for e in entries
    ]

    return LsResponse(items=items, has_more=has_more, next_offset=next_offset)


@router.get("/repos/{repo}/content", response_model=ContentResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_content(
    repo: str,
    ref: str = "main",
    path: str = Query(..., description="파일 경로"),
    max_bytes: int = 10240,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """파일 내용 프리뷰 (최대 max_bytes).

    governance: 비멤버는 public_access.file_read 가 true 일 때만 통과.
    """
    repo_obj = require_capability(db, user, repo, "file_read", min_member_role="guest")

    content, total_size, truncated = _lakefs.get_object_content(
        repo_obj.repo_name, ref, path, max_bytes=max_bytes,
    )

    return ContentResponse(content=content, total_size=total_size, truncated=truncated)


@router.post("/repos/{repo}/migrate", response_model=MigrateResponse,
    dependencies=[Depends(require_scope("repo", "admin"))])
def migrate(
    repo: str,
    body: MigrateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GCS → GCS 서버사이드 복사 + LakeFS link + commit."""
    repo_obj = check_access(db, user, repo, min_role="developer")
    src_repo_obj = check_access(db, user, body.source_repo, min_role="guest")
    lfs_repo = repo_obj.repo_name
    lfs_src_repo = src_repo_obj.repo_name

    files_copied = 0

    for logical_path, physical_addr, _size_bytes in _lakefs.iter_physical_paths(
        lfs_src_repo, body.source_branch, body.source_prefix
    ):
        rel_path = logical_path[len(body.source_prefix.lstrip("/")):].lstrip("/")
        dest_remote_path = rel_path

        staging = _lakefs.get_staging_location(lfs_repo, body.branch, dest_remote_path)
        _gcs.server_side_copy(physical_addr, staging.physical_address)
        _lakefs.link_physical_address(
            lfs_repo, body.branch, dest_remote_path,
            staging, size_bytes=0, checksum="",
        )
        files_copied += 1

    commit_id: Optional[str] = None
    if body.commit_message:
        commit_info = _lakefs.commit(
            lfs_repo, body.branch, body.commit_message, user_email=user.email,
        )
        commit_id = commit_info.id

    if body.source_repo != repo:
        existing_lineage = db.query(RepoLineage).filter(
            RepoLineage.source_repo == body.source_repo,
            RepoLineage.derived_repo == repo,
        ).first()
        if not existing_lineage:
            lineage = RepoLineage(
                source_repo=body.source_repo,
                derived_repo=repo,
                relation_type="derived_from",
                description=f"Auto-created from migrate ({files_copied} files)",
                created_by=user.id,
            )
            db.add(lineage)
            db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="migrate",
        resource_type="repo",
        resource_id=repo,
        details={
            "source_repo": body.source_repo,
            "source_prefix": body.source_prefix,
            "files_copied": files_copied,
            "commit_id": commit_id,
        },
        ip_address=request.client.host if request.client else None,
    )

    return MigrateResponse(files_copied=files_copied, commit_id=commit_id)


# ── Group-scoped aliases ──────────────────────────────────────────────────────

@router.get("/repos/{group}/{repo_name}/ls", response_model=LsResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def ls_group(
    group: str,
    repo_name: str,
    branch: str = "main",
    prefix: str = "",
    recursive: bool = False,
    amount: int = 100,
    after: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ls(f"{group}/{repo_name}", branch, prefix, recursive, amount, after, user, db)


@router.post("/lfs/{group}/{repo_name}/objects/batch", response_model=LfsBatchResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def lfs_objects_batch_group(
    group: str,
    repo_name: str,
    body: LfsBatchRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lfs_objects_batch(f"{group}/{repo_name}", body, request, user, db)


@router.post("/repos/{group}/{repo_name}/lfs/commits", response_model=LfsCommitResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def lfs_commit_group(
    group: str,
    repo_name: str,
    body: LfsCommitRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lfs_commit(f"{group}/{repo_name}", body, request, user, db)


@router.post("/repos/{group}/{repo_name}/download/stream/open", response_model=DownloadStreamOpenResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def download_stream_open_group(
    group: str,
    repo_name: str,
    body: DownloadStreamOpenRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return download_stream_open(f"{group}/{repo_name}", body, request, user, db)


@router.post("/repos/{group}/{repo_name}/download/stream/page", response_model=DownloadStreamPageResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def download_stream_page_group(
    group: str,
    repo_name: str,
    body: DownloadStreamPageRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return download_stream_page(f"{group}/{repo_name}", body, request, user, db)


@router.post("/repos/{group}/{repo_name}/token", response_model=RepoTokenResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_upload_token_group(
    group: str,
    repo_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_upload_token(f"{group}/{repo_name}", request, user, db)


@router.get("/repos/{group}/{repo_name}/token", response_model=RepoTokenResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_download_token_group(
    group: str,
    repo_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_download_token(f"{group}/{repo_name}", request, user, db)


@router.get("/repos/{group}/{repo_name}/content", response_model=ContentResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_content_group(
    group: str,
    repo_name: str,
    ref: str = "main",
    path: str = Query(..., description="파일 경로"),
    max_bytes: int = 10240,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_content(f"{group}/{repo_name}", ref, path, max_bytes, user, db)


# ── Copy / Stream ─────────────────────────────────────────────────────────────

@router.post("/repos/{group}/{repo_name}/copy/stream/open", response_model=CopyStreamOpenResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def copy_stream_open(
    group: str,
    repo_name: str,
    body: CopyStreamOpenRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Copy session 생성 — 소스 레포에서 청크 메타데이터를 복사할 준비."""
    dest_repo = f"{group}/{repo_name}"
    check_access(db, user, dest_repo, min_role="developer")

    session_id = str(uuid4())
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    session = CopySession(
        id=session_id,
        src_repo=body.src_repo,
        src_branch=body.src_branch,
        dest_repo=dest_repo,
        dest_branch=body.dest_branch,
        commit_message=body.commit_message,
        user_id=user.id,
        status="active",
        files_count=0,
        expires_at=expires,
    )
    db.add(session)
    db.commit()

    return CopyStreamOpenResponse(session_id=session_id, expires_at=expires.timestamp())


@router.post("/repos/{group}/{repo_name}/copy/stream/page", response_model=CopyStreamPageResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def copy_stream_page(
    group: str,
    repo_name: str,
    body: CopyStreamPageRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """소스 레포 매니페스트를 목적지 레포 세션에 복사 (청크 메타데이터만, 물리 파일 이동 없음)."""
    dest_repo = f"{group}/{repo_name}"
    check_access(db, user, dest_repo, min_role="developer")

    session = db.query(CopySession).filter(CopySession.id == body.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Copy session not found")

    files_accepted = 0
    files_skipped = 0

    for path in body.paths:
        dest_path = (
            f"{body.dest_prefix.rstrip('/')}/{path}".lstrip("/")
            if body.dest_prefix
            else path
        )

        src_manifest = (
            db.query(Manifest)
            .filter(Manifest.repo_name == session.src_repo)
            .filter(
                Manifest.branch == session.src_branch,
                Manifest.file_path == path,
            )
            .order_by(Manifest.created_at.desc())
            .first()
        )

        if not src_manifest:
            files_skipped += 1
            continue

        new_manifest_id = str(uuid4())
        db.add(
            Manifest(
                id=new_manifest_id,
                repo_name=dest_repo,
                branch=session.dest_branch,
                file_path=dest_path,
                total_size=src_manifest.total_size,
                created_by=session.user_id,
                session_id=session.id,
            )
        )
        for mc in src_manifest.manifest_chunks:
            db.add(
                ManifestChunk(
                    manifest_id=new_manifest_id,
                    chunk_oid=mc.chunk_oid,
                    offset=mc.offset,
                    physical_address=mc.physical_address,
                )
            )

        files_accepted += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    return CopyStreamPageResponse(files_accepted=files_accepted, files_skipped=files_skipped)


@router.post("/repos/{group}/{repo_name}/copy/stream/commit", response_model=CopyStreamCommitResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def copy_stream_commit(
    group: str,
    repo_name: str,
    body: CopyStreamCommitRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """세션의 모든 매니페스트를 LakeFS에 link + commit."""
    dest_repo = f"{group}/{repo_name}"
    dest_repo_obj = check_access(db, user, dest_repo, min_role="developer")
    lfs_dest_repo = dest_repo_obj.repo_name

    session = db.query(CopySession).filter(CopySession.id == body.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Copy session not found")

    manifests = db.query(Manifest).filter(Manifest.session_id == body.session_id).all()
    if not manifests:
        raise HTTPException(status_code=400, detail="No files staged in session")

    bucket = dest_repo_obj.bucket_name or f"{settings.gcp_bucket_prefix}-{lfs_dest_repo}"

    linked_paths: list[str] = []
    try:
        for manifest in manifests:
            first_mc = min(manifest.manifest_chunks, key=lambda mc: mc.offset)
            phys = first_mc.physical_address or _cas_path(bucket, first_mc.chunk_oid)
            _lakefs.link_physical_address(
                repo_name=lfs_dest_repo,
                branch=session.dest_branch,
                path=manifest.file_path,
                staging=StagingLocation(physical_address=phys),
                size_bytes=manifest.total_size,
                checksum=first_mc.chunk_oid,
            )
            linked_paths.append(manifest.file_path)

        commit_info = _lakefs.commit(
            repo_name=lfs_dest_repo,
            branch_name=session.dest_branch,
            message=session.commit_message or "Copy via DataHub",
            user_email=user.email,
        )

        session.status = "committed"
        session.commit_id = commit_info.id
        session.files_count = len(manifests)
        session.completed_at = datetime.now(timezone.utc)
        db.commit()

        return CopyStreamCommitResponse(commit_id=commit_info.id, files_committed=len(manifests))

    except HTTPException:
        raise
    except Exception as e:
        # 부분 link 성공 시 staging 잔재 제거
        for path in linked_paths:
            try:
                _lakefs.reset_branch_object(lfs_dest_repo, session.dest_branch, path)
            except Exception:
                pass  # best-effort; 실패해도 세션은 failed 처리
        session.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))

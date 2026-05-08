"""Upload/Download/Ls 스키마."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


# ── LFS Batch (Type A: preflight CAS check + GCS upload URL) ─────────────────

class LfsBatchObject(BaseModel):
    oid: str    # BLAKE3 hex digest
    size: int   # bytes


class LfsBatchAction(BaseModel):
    href: str
    header: Optional[dict[str, str]] = None
    expires_at: Optional[str] = None   # ISO 8601


class LfsBatchObjectResponse(BaseModel):
    oid: str
    actions: list[LfsBatchAction]   # empty list = CAS hit (upload not required)


class LfsBatchRequest(BaseModel):
    branch: str = "main"
    objects: list[LfsBatchObject]


class LfsBatchResponse(BaseModel):
    objects: list[LfsBatchObjectResponse]
    cab_token: str
    bucket: str
    token_expiry: Optional[str] = None
    expires_at: Optional[float] = None


# ── LFS Commits (Import API batch 1-call) ─────────────────────────────────────

class LfsCommitChunk(BaseModel):
    oid: str    # BLAKE3 hex
    size: int   # bytes
    offset: int # byte offset within the logical file


class LfsCommitObject(BaseModel):
    path: str                               # LakeFS 논리 경로 (예: data/file.bin)
    chunks: Optional[list[LfsCommitChunk]] = None  # fastcdc 청크 목록
    oid: Optional[str] = None              # legacy: BLAKE3 hex
    size: Optional[int] = None             # legacy: bytes


class LfsCommitRequest(BaseModel):
    branch: str = "main"
    message: str = ""
    objects: list[LfsCommitObject]


class LfsCommitResponse(BaseModel):
    commit_id: str


# ── Token ────────────────────────────────────────────

class RepoTokenResponse(BaseModel):
    cab_token: str
    bucket: str
    token_expiry: Optional[str] = None


# ── Download ────────────────────────────────────────

class DownloadRequest(BaseModel):
    branch: str = "main"
    paths: list[str]


class DownloadFileEntry(BaseModel):
    path: str
    signed_url: str
    physical_address: Optional[str] = None
    size_bytes: Optional[int] = None


class DownloadResponse(BaseModel):
    files: list[DownloadFileEntry]


class DownloadChunkInfo(BaseModel):
    oid: str
    size: int
    offset: int
    physical_address: str


class DownloadFileMapping(BaseModel):
    path: str
    physical_address: Optional[str] = None
    size_bytes: Optional[int] = None
    chunks: Optional[list[DownloadChunkInfo]] = None


class DownloadStreamOpenRequest(BaseModel):
    branch: str = "main"
    paths: list[str]


class DownloadStreamOpenResponse(BaseModel):
    token: str
    token_expiry: str
    expires_at: Optional[float] = None


class DownloadStreamPageRequest(BaseModel):
    branch: str = "main"
    paths: list[str]
    after: Optional[str] = None
    limit: int = 1000


class DownloadStreamPageResponse(BaseModel):
    files: list[DownloadFileMapping]
    has_more: bool = False
    next_offset: Optional[str] = None


# ── Ls ──────────────────────────────────────────────

class LsItem(BaseModel):
    path: str
    path_type: str = "object"
    size_bytes: Optional[int] = None
    mtime: Optional[int] = None


class LsResponse(BaseModel):
    items: list[LsItem]
    has_more: bool = False
    next_offset: Optional[str] = None


# ── Content ─────────────────────────────────────────

class ContentResponse(BaseModel):
    content: str
    total_size: int
    truncated: bool


# ── Migrate ─────────────────────────────────────────

class MigrateRequest(BaseModel):
    source_repo: str
    source_branch: str = "main"
    source_prefix: str = ""
    branch: str = "main"
    commit_message: Optional[str] = None


class MigrateResponse(BaseModel):
    files_copied: int
    commit_id: Optional[str] = None


# ── Copy / Stream ─────────────────────────────────────────────────────────────

class CopyStreamOpenRequest(BaseModel):
    src_repo: str
    src_branch: str = "main"
    dest_branch: str = "main"
    commit_message: Optional[str] = None


class CopyStreamOpenResponse(BaseModel):
    session_id: str
    expires_at: Optional[float] = None


class CopyStreamPageRequest(BaseModel):
    session_id: str
    paths: list[str]
    dest_prefix: str = ""


class CopyStreamPageResponse(BaseModel):
    files_accepted: int
    files_skipped: int = 0


class CopyStreamCommitRequest(BaseModel):
    session_id: str


class CopyStreamCommitResponse(BaseModel):
    commit_id: str
    files_committed: int

"""Branch/Commit/Merge 스키마."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


# ── Branch ──────────────────────────────────────────

class CreateBranchRequest(BaseModel):
    branch_name: str
    source: str = "main"


class BranchInfoResponse(BaseModel):
    name: str
    commit_id: str
    commit_message: str = ""
    commit_date: Optional[int] = None


class BranchListResponse(BaseModel):
    branches: list[BranchInfoResponse]


# ── Commit ──────────────────────────────────────────

class CommitRequest(BaseModel):
    branch: str
    message: str


class CommitResponse(BaseModel):
    id: str
    message: str
    committer: str
    metadata: Optional[dict[str, str]] = None


# ── Merge ───────────────────────────────────────────

class MergeRequest(BaseModel):
    source_branch: str
    into: str = "main"
    message: Optional[str] = None


class MergeResponse(BaseModel):
    status: str = "merged"


# ── Commit Log ──────────────────────────────────────

class CommitLogEntry(BaseModel):
    id: str
    message: str
    committer: str
    creation_date: Optional[int] = None
    parents: list[str] = []
    metadata: Optional[dict[str, str]] = None


class CommitLogResponse(BaseModel):
    results: list[CommitLogEntry]


# ── Diff ────────────────────────────────────────────

class DiffEntryResponse(BaseModel):
    path: str
    change_type: str  # "added", "removed", "changed"
    path_type: str = "object"
    size_bytes: Optional[int] = None


class DiffResponse(BaseModel):
    entries: list[DiffEntryResponse]

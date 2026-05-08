"""Versioning 엔드포인트.

- POST /repos/{repo}/branches: 브랜치 생성
- GET /repos/{repo}/branches: 브랜치 목록 (HEAD 커밋 정보 포함)
- DELETE /repos/{repo}/branches/{name}: 브랜치 삭제
- POST /repos/{repo}/commits: 커밋
- POST /repos/{repo}/merge: 머지 + UC sync
- GET /repos/{repo}/commits: 커밋 이력 (parents 포함)
- GET /repos/{repo}/diff: 브랜치 diff (change type 포함)
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_scope
from app.models import User
from app.services.authorization import check_access
from app.schemas.versioning import (
    BranchInfoResponse,
    BranchListResponse,
    CommitLogEntry,
    CommitLogResponse,
    CommitRequest,
    CommitResponse,
    CreateBranchRequest,
    DiffEntryResponse,
    DiffResponse,
    MergeRequest,
    MergeResponse,
)
from app.services.audit import AuditService
from app.services.lakefs import LakeFSService
logger = logging.getLogger(__name__)

router = APIRouter()
audit = AuditService()

_lakefs = LakeFSService()


@router.post("/repos/{repo}/branches",
    dependencies=[Depends(require_scope("repo", "write"))])
def create_branch(
    repo: str,
    body: CreateBranchRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """브랜치 생성."""
    repo_obj = check_access(db, user, repo, min_role="developer")

    _lakefs.create_branch(repo_obj.repo_name, body.branch_name, body.source)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="branch_create",
        resource_type="branch",
        resource_id=f"{repo}/{body.branch_name}",
        details={"source": body.source},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "created", "branch": body.branch_name}


@router.get("/repos/{repo}/branches", response_model=BranchListResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def list_branches(
    repo: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """브랜치 목록 (HEAD 커밋 정보 포함)."""
    repo_obj = check_access(db, user, repo, min_role="guest")
    branches = _lakefs.list_branches(repo_obj.repo_name)
    return BranchListResponse(
        branches=[
            BranchInfoResponse(
                name=b.name,
                commit_id=b.commit_id,
                commit_message=b.commit_message,
                commit_date=b.commit_date,
            )
            for b in branches
        ]
    )


@router.delete("/repos/{repo}/branches/{name}",
    dependencies=[Depends(require_scope("repo", "write"))])
def delete_branch(
    repo: str,
    name: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """브랜치 삭제."""
    repo_obj = check_access(db, user, repo, min_role="developer")

    if name == "main":
        raise HTTPException(status_code=400, detail="Cannot delete the main branch")

    _lakefs.delete_branch(repo_obj.repo_name, name)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="branch_delete",
        resource_type="branch",
        resource_id=f"{repo}/{name}",
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "deleted", "branch": name}


@router.post("/repos/{repo}/commits", response_model=CommitResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def create_commit(
    repo: str,
    body: CommitRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """브랜치에 커밋."""
    repo_obj = check_access(db, user, repo, min_role="developer")

    commit_info = _lakefs.commit(repo_obj.repo_name, body.branch, body.message, user_email=user.email)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="commit",
        resource_type="commit",
        resource_id=f"{repo}/{commit_info.id}",
        details={"branch": body.branch, "message": body.message},
        ip_address=request.client.host if request.client else None,
    )

    return CommitResponse(
        id=commit_info.id,
        message=commit_info.message,
        committer=commit_info.committer,
        metadata=commit_info.metadata,
    )


@router.post("/repos/{repo}/merge", response_model=MergeResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def merge_branch(
    repo: str,
    body: MergeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """브랜치 머지 + UC sync."""
    repo_obj = check_access(db, user, repo, min_role="developer")

    _lakefs.merge(repo_obj.repo_name, body.source_branch, body.into, body.message or "")

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="merge",
        resource_type="branch",
        resource_id=f"{repo}/{body.source_branch}",
        details={"into": body.into, "message": body.message},
        ip_address=request.client.host if request.client else None,
    )

    return MergeResponse(status="merged")


@router.get("/repos/{repo}/commits", response_model=CommitLogResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_commit_log(
    repo: str,
    ref: str = "main",
    amount: int = 30,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """커밋 이력 조회 (parents 포함)."""
    repo_obj = check_access(db, user, repo, min_role="guest")

    commits = _lakefs.get_commit_log(repo_obj.repo_name, ref, amount=amount)
    return CommitLogResponse(
        results=[
            CommitLogEntry(
                id=c.id,
                message=c.message,
                committer=c.committer,
                creation_date=c.creation_date,
                parents=c.parents or [],
                metadata=c.metadata,
            )
            for c in commits
        ]
    )


@router.get("/repos/{repo}/diff", response_model=DiffResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def diff_branches(
    repo: str,
    source: str = Query(..., description="소스 브랜치"),
    target: str = Query("main", description="대상 브랜치"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """두 브랜치 간 변경 목록 (change type 포함)."""
    repo_obj = check_access(db, user, repo, min_role="guest")

    entries = _lakefs.diff_branch(repo_obj.repo_name, source, target)
    return DiffResponse(
        entries=[
            DiffEntryResponse(
                path=e.path,
                change_type=e.change_type,
                path_type=e.path_type,
                size_bytes=e.size_bytes,
            )
            for e in entries
        ]
    )


# ── Group-scoped aliases ──────────────────────────────────────────────────────

@router.post("/repos/{group}/{repo_name}/branches",
    dependencies=[Depends(require_scope("repo", "write"))])
def create_branch_group(
    group: str, repo_name: str,
    body: CreateBranchRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_branch(f"{group}/{repo_name}", body, request, user, db)


@router.get("/repos/{group}/{repo_name}/branches", response_model=BranchListResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def list_branches_group(
    group: str, repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_branches(f"{group}/{repo_name}", user, db)


@router.delete("/repos/{group}/{repo_name}/branches/{name}",
    dependencies=[Depends(require_scope("repo", "write"))])
def delete_branch_group(
    group: str, repo_name: str, name: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return delete_branch(f"{group}/{repo_name}", name, request, user, db)


@router.post("/repos/{group}/{repo_name}/merge", response_model=MergeResponse,
    dependencies=[Depends(require_scope("repo", "write"))])
def merge_branch_group(
    group: str, repo_name: str,
    body: MergeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return merge_branch(f"{group}/{repo_name}", body, request, user, db)


@router.get("/repos/{group}/{repo_name}/commits", response_model=CommitLogResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def get_commit_log_group(
    group: str, repo_name: str,
    branch: str = Query("main"),
    amount: int = Query(10),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_commit_log(f"{group}/{repo_name}", branch, amount, user, db)


@router.get("/repos/{group}/{repo_name}/diff", response_model=DiffResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def diff_branches_group(
    group: str, repo_name: str,
    source: str = Query(...),
    target: str = Query("main"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return diff_branches(f"{group}/{repo_name}", source, target, user, db)

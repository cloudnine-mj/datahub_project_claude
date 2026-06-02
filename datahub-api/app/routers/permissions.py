"""권한 관리 엔드포인트.

- PUT /repos/{repo}/permissions: 권한 부여 (owner/maintainer)
- DELETE /repos/{repo}/permissions/{email}: 권한 회수 (owner/maintainer)
- GET /repos/{repo}/permissions: 권한 목록 (owner/maintainer)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_scope
from app.models import Permission, Repo, User
from app.schemas.permissions import (
    GrantPermissionRequest,
    PermissionInfo,
    PermissionListResponse,
    RepoMemberGrantRequest,
    RepoMemberInfo,
    RepoMemberListResponse,
)
from app.services.audit import AuditService
from app.services.authorization import (
    ASSIGNABLE_ROLES,
    can_assign_role,
    require_admin,
    resolve_role,
)
from app.services.idempotency import run_idempotent

router = APIRouter()
audit = AuditService()


def _ensure_assignable_role(actor_role: str, target_role: str) -> None:
    if target_role not in ASSIGNABLE_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Role must be one of: {', '.join(ASSIGNABLE_ROLES)}",
        )

    if not can_assign_role(actor_role, target_role):
        raise HTTPException(
            status_code=403,
            detail=f"Your role '{actor_role}' cannot assign '{target_role}'",
        )


def _member_items(db: Session, repo_obj: Repo) -> list[RepoMemberInfo]:
    items = [
        RepoMemberInfo(
            principal=repo_obj.owner.email,
            role="owner",
            granted_by="-",
            granted_at=repo_obj.created_at,
        ),
    ]
    for perm in db.query(Permission).filter(Permission.repo_name == repo_obj.repo_name).all():
        items.append(
            RepoMemberInfo(
                principal=perm.user.email,
                role=perm.role,
                granted_by=perm.granter.email,
                granted_at=perm.created_at,
            )
        )
    return items


def _grant_repo_member(
    repo_id: str,
    principal: str,
    role: str,
    request: Request,
    user: User,
    db: Session,
) -> dict:
    repo_obj = require_admin(db, user, repo_id)
    actor_role = resolve_role(db, user, repo_obj)

    _ensure_assignable_role(actor_role, role)

    target_user = db.query(User).filter(User.email == principal).first()
    if target_user is None:
        raise HTTPException(status_code=404, detail=f"User '{principal}' not found")

    # 자기 자신에게 부여 금지
    if target_user.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own permission")

    # Owner에게 부여 금지 (Owner는 permissions 테이블이 아닌 repos.owner_id로 관리)
    if repo_obj.owner_id == target_user.id:
        raise HTTPException(status_code=400, detail="Cannot change the owner's permission via this endpoint")

    existing = db.query(Permission).filter(
        Permission.repo_name == repo_obj.repo_name,
        Permission.user_id == target_user.id,
    ).first()

    if existing:
        # 기존 권한이 자기보다 높으면 변경 불가
        if not can_assign_role(actor_role, existing.role):
            raise HTTPException(
                status_code=403,
                detail=f"Cannot modify a user with '{existing.role}' role",
            )
        existing.role = role
        existing.granted_by = user.id
    else:
        perm = Permission(
            repo_name=repo_obj.repo_name,
            user_id=target_user.id,
            role=role,
            granted_by=user.id,
        )
        db.add(perm)

    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="member.upsert",
        resource_type="repo_member",
        resource_id=repo_id,
        details={"principal": principal, "role": role},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "active", "principal": principal, "role": role}


def _revoke_repo_member(
    repo_id: str,
    principal: str,
    request: Request,
    user: User,
    db: Session,
) -> dict:
    repo_obj = require_admin(db, user, repo_id)
    actor_role = resolve_role(db, user, repo_obj)

    target_user = db.query(User).filter(User.email == principal).first()
    if target_user is None:
        raise HTTPException(status_code=404, detail=f"User '{principal}' not found")

    # Owner 회수 불가
    if repo_obj.owner_id == target_user.id:
        raise HTTPException(status_code=400, detail="Cannot revoke the owner's permission")

    perm = db.query(Permission).filter(
        Permission.repo_name == repo_obj.repo_name,
        Permission.user_id == target_user.id,
    ).first()

    if perm is None:
        return {"status": "removed", "principal": principal}

    # 대상 역할이 자기보다 높으면 회수 불가
    if not can_assign_role(actor_role, perm.role):
        raise HTTPException(
            status_code=403,
            detail=f"Cannot revoke a user with '{perm.role}' role",
        )

    db.delete(perm)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="member.remove",
        resource_type="repo_member",
        resource_id=repo_id,
        details={"principal": principal},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "removed", "principal": principal}


@router.get(
    "/repos/{owner}/{repo}/members",
    response_model=RepoMemberListResponse,
    dependencies=[Depends(require_scope("repo", "admin"))],
)
def list_repo_members(
    owner: str,
    repo: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Canonical repository members list: GET /repos/{owner}/{repo}/members."""
    repo_id = f"{owner}/{repo}"
    repo_obj = require_admin(db, user, repo_id)
    return RepoMemberListResponse(items=_member_items(db, repo_obj))


@router.put(
    "/repos/{owner}/{repo}/members/{principal}",
    dependencies=[Depends(require_scope("repo", "admin"))],
)
def add_repo_member(
    owner: str,
    repo: str,
    principal: str,
    body: RepoMemberGrantRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Canonical repository member grant/update."""
    repo_id = f"{owner}/{repo}"
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"repo.member.upsert:{repo_id}:{principal}",
        body={"principal": principal, "role": body.role},
        response_factory=lambda: _grant_repo_member(repo_id, principal, body.role, request, user, db),
    )


@router.delete(
    "/repos/{owner}/{repo}/members/{principal}",
    dependencies=[Depends(require_scope("repo", "admin"))],
)
def remove_repo_member(
    owner: str,
    repo: str,
    principal: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Canonical repository member removal."""
    repo_id = f"{owner}/{repo}"
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"repo.member.remove:{repo_id}:{principal}",
        body={"principal": principal},
        response_factory=lambda: _revoke_repo_member(repo_id, principal, request, user, db),
    )


@router.put("/repos/{repo}/permissions",
    dependencies=[Depends(require_scope("repo", "admin"))])
def grant_permission(
    repo: str,
    body: GrantPermissionRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """권한 부여 (owner/maintainer)."""
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"repo.member.upsert:{repo}:{body.email}",
        body={"principal": body.email, "role": body.role},
        response_factory=lambda: _grant_repo_member(repo, body.email, body.role, request, user, db),
    )


@router.delete("/repos/{repo}/permissions/{email}",
    dependencies=[Depends(require_scope("repo", "admin"))])
def revoke_permission(
    repo: str,
    email: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """권한 회수 (owner/maintainer)."""
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"repo.member.remove:{repo}:{email}",
        body={"principal": email},
        response_factory=lambda: _revoke_repo_member(repo, email, request, user, db),
    )


@router.get("/repos/{repo}/permissions", response_model=PermissionListResponse,
    dependencies=[Depends(require_scope("repo", "admin"))])
def list_permissions(
    repo: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포의 권한 목록 (owner/maintainer)."""
    repo_obj = require_admin(db, user, repo)
    permissions = [
        PermissionInfo(
            email=item.principal,
            role=item.role,
            granted_by=item.granted_by,
        )
        for item in _member_items(db, repo_obj)
    ]
    return PermissionListResponse(permissions=permissions)


# ── Group-scoped aliases ──────────────────────────────────────────────────────

@router.put("/repos/{group}/{repo_name}/permissions",
    dependencies=[Depends(require_scope("repo", "admin"))])
def grant_permission_group(
    group: str, repo_name: str,
    body: GrantPermissionRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return grant_permission(f"{group}/{repo_name}", body, request, user, db)


@router.delete("/repos/{group}/{repo_name}/permissions/{email}",
    dependencies=[Depends(require_scope("repo", "admin"))])
def revoke_permission_group(
    group: str, repo_name: str, email: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return revoke_permission(f"{group}/{repo_name}", email, request, user, db)


@router.get("/repos/{group}/{repo_name}/permissions", response_model=PermissionListResponse,
    dependencies=[Depends(require_scope("repo", "admin"))])
def list_permissions_group(
    group: str, repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_permissions(f"{group}/{repo_name}", user, db)

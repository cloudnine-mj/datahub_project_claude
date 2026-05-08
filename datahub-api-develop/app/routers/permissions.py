"""권한 관리 엔드포인트.

- PUT /repos/{repo}/permissions: 권한 부여 (owner/maintainer)
- DELETE /repos/{repo}/permissions/{email}: 권한 회수 (owner/maintainer)
- GET /repos/{repo}/permissions: 권한 목록 (owner/maintainer)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_scope, get_or_create_user
from app.models import Permission, Repo, User
from app.schemas.permissions import GrantPermissionRequest, PermissionInfo, PermissionListResponse
from app.services.audit import AuditService
from app.services.authorization import (
    ASSIGNABLE_ROLES,
    can_assign_role,
    require_admin,
    resolve_role,
)

router = APIRouter()
audit = AuditService()


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
    repo_obj = require_admin(db, user, repo)
    actor_role = resolve_role(db, user, repo_obj)

    if body.role not in ASSIGNABLE_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Role must be one of: {', '.join(ASSIGNABLE_ROLES)}",
        )

    if not can_assign_role(actor_role, body.role):
        raise HTTPException(
            status_code=403,
            detail=f"Your role '{actor_role}' cannot assign '{body.role}'",
        )

    target_user = get_or_create_user(db, body.email)

    # 자기 자신에게 부여 금지
    if target_user.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own permission")

    # Owner에게 부여 금지 (Owner는 permissions 테이블이 아닌 repos.owner_id로 관리)
    if repo_obj.owner_id == target_user.id:
        raise HTTPException(status_code=400, detail="Cannot change the owner's permission via this endpoint")

    # 기존 권한 확인
    existing = db.query(Permission).filter(
        Permission.repo_name == repo,
        Permission.user_id == target_user.id,
    ).first()

    if existing:
        # 기존 권한이 자기보다 높으면 변경 불가
        if not can_assign_role(actor_role, existing.role):
            raise HTTPException(
                status_code=403,
                detail=f"Cannot modify a user with '{existing.role}' role",
            )
        existing.role = body.role
        existing.granted_by = user.id
    else:
        perm = Permission(
            repo_name=repo,
            user_id=target_user.id,
            role=body.role,
            granted_by=user.id,
        )
        db.add(perm)

    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="permission_grant",
        resource_type="permission",
        resource_id=repo,
        details={"target_email": body.email, "role": body.role},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "granted", "email": body.email, "role": body.role}


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
    repo_obj = require_admin(db, user, repo)
    actor_role = resolve_role(db, user, repo_obj)

    target_user = db.query(User).filter(User.email == email).first()
    if target_user is None:
        raise HTTPException(status_code=404, detail=f"User '{email}' not found")

    # Owner 회수 불가
    if repo_obj.owner_id == target_user.id:
        raise HTTPException(status_code=400, detail="Cannot revoke the owner's permission")

    perm = db.query(Permission).filter(
        Permission.repo_name == repo,
        Permission.user_id == target_user.id,
    ).first()

    if perm is None:
        raise HTTPException(status_code=404, detail=f"No permission found for '{email}' on '{repo}'")

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
        action="permission_revoke",
        resource_type="permission",
        resource_id=repo,
        details={"target_email": email},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "revoked", "email": email}


@router.get("/repos/{repo}/permissions", response_model=PermissionListResponse,
    dependencies=[Depends(require_scope("repo", "read"))])
def list_permissions(
    repo: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """레포의 권한 목록 (owner/maintainer)."""
    repo_obj = require_admin(db, user, repo)

    permissions = [
        PermissionInfo(email=repo_obj.owner.email, role="owner", granted_by="-"),
    ]
    for perm in db.query(Permission).filter(Permission.repo_name == repo).all():
        permissions.append(PermissionInfo(
            email=perm.user.email,
            role=perm.role,
            granted_by=perm.granter.email,
        ))

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
    dependencies=[Depends(require_scope("repo", "read"))])
def list_permissions_group(
    group: str, repo_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_permissions(f"{group}/{repo_name}", user, db)

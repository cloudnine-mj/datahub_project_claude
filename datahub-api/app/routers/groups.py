"""Canonical group namespace endpoints.

The current persistence layer still stores group namespaces in the legacy
organizations tables. This router keeps that detail behind the /groups API.
Alembic 017 migration unified the column names under `group`:
  - organizations.group_name (구 org_name)
  - repos.group_id (구 org_id)
  - organization_memberships.group_id (구 org_id)
  - teams.group_id (구 org_id)

RBAC role `owner` (Organization.owner_id, Repo.owner_id, Permission.role='owner')
는 보존 — namespace 와 role 은 서로 다른 개념.
"""

from __future__ import annotations

import base64
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import GroupRename, Organization, OrganizationMembership, Permission, Repo, Team, User
from app.schemas.groups import (
    GroupCreate,
    GroupInfo,
    GroupListResponse,
    GroupMemberGrant,
    GroupMemberInfo,
    GroupMemberListResponse,
    GroupRepoListResponse,
    GroupRole,
    GroupUpdate,
    RenameGroupRequest,
    RenameGroupResponse,
)
from app.schemas.repos import PublicAccess, RepoInfo, expand_preset
from app.services.audit import AuditService
from app.services.idempotency import run_idempotent
from app.services.repo_identity import personal_owner_from_email, validate_repo_segment

router = APIRouter()
audit = AuditService()


def _encode_page_token(offset: int) -> str:
    raw = json.dumps({"offset": offset}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_page_token(page_token: str | None) -> int:
    if not page_token:
        return 0
    try:
        padded = page_token + ("=" * (-len(page_token) % 4))
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        offset = int(payload["offset"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid page_token") from exc
    if offset < 0:
        raise HTTPException(status_code=400, detail="Invalid page_token")
    return offset


def _page(items: list, *, limit: int, page_token: str | None) -> tuple[list, bool, str | None]:
    start = _decode_page_token(page_token)
    end = start + limit
    page_items = items[start:end]
    has_more = end < len(items)
    return page_items, has_more, _encode_page_token(end) if has_more else None


def _get_group_or_404(db: Session, group_name: str) -> Organization:
    group = (
        db.query(Organization)
        .options(joinedload(Organization.owner))
        .filter(Organization.group_name == group_name)
        .first()
    )
    if group is None:
        raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")
    return group


def _storage_role_to_group_role(role: str | None) -> GroupRole | None:
    """Storage layer 의 role 값을 governance 4-tier 그대로 반환.

    016 마이그레이션에서 CHECK 가 4-tier 로 확장되고 legacy 'developer'/'member'
    값은 'contributor' 로 backfill 됨. 알 수 없는 값은 None.
    """
    if role in {"owner", "maintainer", "contributor", "guest"}:
        return role  # type: ignore[return-value]
    return None


def _group_role(db: Session, group: Organization, user: User) -> GroupRole | None:
    if group.owner_id == user.id:
        return "owner"
    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.group_id == group.id,
            OrganizationMembership.user_id == user.id,
        )
        .first()
    )
    return _storage_role_to_group_role(membership.role if membership else None)


def _has_direct_repo_access_in_group(db: Session, group: Organization, user: User) -> bool:
    if (
        db.query(Repo)
        .filter(Repo.group_id == group.id, Repo.owner_id == user.id)
        .first()
        is not None
    ):
        return True
    return (
        db.query(Permission)
        .join(Repo, Permission.repo_name == Repo.repo_name)
        .filter(Repo.group_id == group.id, Permission.user_id == user.id)
        .first()
    ) is not None


def _can_read_group(db: Session, group: Organization, user: User) -> bool:
    return (
        group.visibility == "public"
        or _group_role(db, group, user) is not None
        or _has_direct_repo_access_in_group(db, group, user)
    )


# Governance §그룹 권한 기준 (docs/api/groups.md): 4-tier 의 우선순위.
_GROUP_ROLE_RANK: dict[str, int] = {
    "owner": 40,
    "maintainer": 30,
    "contributor": 20,
    "guest": 10,
}


def _require_group_role(
    db: Session,
    group: Organization,
    user: User,
    min_role: str,
) -> GroupRole:
    """그룹의 최소 role 검증. 미달 시 403, 비멤버는 404 (존재 숨김).

    `min_role` 은 {guest, contributor, maintainer, owner} 중 하나. 호출자가
    원하는 동작별 최소 권한을 명시 — 추후 코드 리뷰어가 endpoint 의 권한 의도를
    한 줄로 읽을 수 있도록.
    """
    role = _group_role(db, group, user)
    if role is None:
        # 비멤버는 그룹 존재 자체도 가리지 않고 403 — 그룹 조회 자체는 visibility
        # 와 직접 저장소 접근으로 별도 판단 (`_can_view_group`). 본 헬퍼는 멤버
        # 가입 이후의 권한 평가만 다룬다.
        raise HTTPException(
            status_code=403,
            detail=f"Requires group '{min_role}' role or above",
        )
    if _GROUP_ROLE_RANK.get(role, 0) < _GROUP_ROLE_RANK.get(min_role, 0):
        raise HTTPException(
            status_code=403,
            detail=f"Requires group '{min_role}' role or above (current: '{role}')",
        )
    return role


def _require_group_owner(db: Session, group: Organization, user: User) -> None:
    _require_group_role(db, group, user, "owner")


def _require_group_maintainer(db: Session, group: Organization, user: User) -> GroupRole:
    """maintainer+ (멤버 추가/role 변경, 그룹 표시 정보 수정 등)."""
    return _require_group_role(db, group, user, "maintainer")


def _require_group_contributor(db: Session, group: Organization, user: User) -> GroupRole:
    """contributor+ (그룹 아래 저장소 생성)."""
    return _require_group_role(db, group, user, "contributor")


def _member_count(db: Session, group: Organization) -> int:
    return 1 + db.query(OrganizationMembership).filter(OrganizationMembership.group_id == group.id).count()


def _group_info(db: Session, group: Organization, user: User) -> GroupInfo:
    return GroupInfo(
        name=group.group_name,
        type="group",
        current_user_role=_group_role(db, group, user),
        description=group.description,
        repo_count=db.query(Repo).filter(Repo.group_id == group.id).count(),
        member_count=_member_count(db, group),
        created_at=group.created_at,
    )


def _personal_namespace_exists(db: Session, name: str) -> bool:
    return any(personal_owner_from_email(user.email) == name for user in db.query(User).all())


def _repo_public_access(repo: Repo) -> PublicAccess:
    policy = repo.public_access_policy
    if policy is None:
        return expand_preset(repo.visibility) if repo.visibility != "fine_grained" else PublicAccess(
            discoverable=False,
            metadata_read=False,
            file_list=False,
            file_read=False,
            lineage_read=False,
            stats_read=False,
        )
    return PublicAccess(
        discoverable=policy.discoverable,
        metadata_read=policy.metadata_read,
        file_list=policy.file_list,
        file_read=policy.file_read,
        lineage_read=policy.lineage_read,
        stats_read=policy.stats_read,
    )


def _build_repo_info(db: Session, repo: Repo, role: str) -> RepoInfo:
    return RepoInfo(
        repo_name=repo.repo_name,
        owner=repo.owner.email,
        role=role,
        visibility=repo.visibility,
        public_access=_repo_public_access(repo),
        public_access_version=getattr(repo.public_access_policy, "version", 1),
        description=repo.description,
        repo_type=repo.repo_type,
        member_count=db.query(Permission).filter(Permission.repo_name == repo.repo_name).count(),
        created_at=repo.created_at,
        updated_at=getattr(repo, "updated_at", None),
        file_count=None,
        total_size_bytes=None,
        group=repo.organization.group_name if repo.organization else None,
    )


def _visible_group_repos(db: Session, group: Organization, user: User) -> list[RepoInfo]:
    repos = (
        db.query(Repo)
        .options(joinedload(Repo.owner), joinedload(Repo.organization), joinedload(Repo.public_access_policy))
        .filter(Repo.group_id == group.id)
        .all()
    )
    repo_names = [repo.repo_name for repo in repos]
    user_perm_map = {
        perm.repo_name: perm.role
        for perm in db.query(Permission).filter(
            Permission.user_id == user.id,
            Permission.repo_name.in_(repo_names),
        ).all()
    } if repo_names else {}

    visible: list[RepoInfo] = []
    for repo in repos:
        if repo.owner_id == user.id:
            visible.append(_build_repo_info(db, repo, "owner"))
            continue
        if repo.repo_name in user_perm_map:
            visible.append(_build_repo_info(db, repo, user_perm_map[repo.repo_name]))
            continue
        policy = repo.public_access_policy
        if repo.visibility != "private" and policy is not None and policy.discoverable:
            visible.append(_build_repo_info(db, repo, "normal"))

    visible.sort(key=lambda item: item.repo_name)
    return visible


@router.get("/groups", response_model=GroupListResponse)
def list_groups(
    limit: int = Query(100, ge=1, le=1000),
    page_token: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member_group_ids = (
        db.query(OrganizationMembership.group_id.label("group_id"))
        .filter(OrganizationMembership.user_id == user.id)
        .subquery()
    )
    repo_group_ids = (
        db.query(Repo.group_id.label("group_id"))
        .filter(Repo.group_id.isnot(None), Repo.owner_id == user.id)
        .union(
            db.query(Repo.group_id.label("group_id"))
            .join(Permission, Permission.repo_name == Repo.repo_name)
            .filter(Repo.group_id.isnot(None), Permission.user_id == user.id)
        )
        .subquery()
    )

    groups = (
        db.query(Organization)
        .options(joinedload(Organization.owner))
        .filter(
            or_(
                Organization.visibility == "public",
                Organization.owner_id == user.id,
                Organization.id.in_(select(member_group_ids.c.group_id)),
                Organization.id.in_(select(repo_group_ids.c.group_id)),
            )
        )
        .order_by(Organization.created_at.desc(), Organization.group_name.asc())
        .all()
    )
    items = [_group_info(db, group, user) for group in groups]
    page_items, has_more, next_page_token = _page(items, limit=limit, page_token=page_token)
    return GroupListResponse(
        items=page_items,
        groups=page_items,
        has_more=has_more,
        next_page_token=next_page_token,
    )


@router.post("/groups", response_model=GroupInfo, status_code=201)
def create_group(
    body: GroupCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"group.create:{body.name}",
        body=body,
        response_factory=lambda: _create_group(body, request, user, db),
    )


def _create_group(
    body: GroupCreate,
    request: Request,
    user: User,
    db: Session,
) -> GroupInfo:
    try:
        validate_repo_segment(body.name, "group")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if db.query(Organization).filter(Organization.group_name == body.name).first() is not None:
        raise HTTPException(status_code=409, detail=f"Group '{body.name}' already exists")
    if _personal_namespace_exists(db, body.name):
        raise HTTPException(status_code=409, detail=f"Group namespace '{body.name}' already exists")

    # governance §repo-identity-spec: stable id (UUIDv7) 발급
    from app.services.repo_identity import new_uuid7

    group = Organization(
        uuid=str(new_uuid7()),
        group_name=body.name,
        owner_id=user.id,
        description=body.description,
        visibility="private",
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="group.create",
        resource_type="group",
        resource_id=body.name,
        ip_address=request.client.host if request.client else None,
    )
    return _group_info(db, group, user)


@router.get("/groups/{group}", response_model=GroupInfo)
def get_group(
    group: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = _get_group_or_404(db, group)
    if not _can_read_group(db, org, user):
        raise HTTPException(status_code=403, detail="Access denied")
    return _group_info(db, org, user)


@router.patch("/groups/{group}", response_model=GroupInfo)
def update_group(
    group: str,
    body: GroupUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"group.update:{group}",
        body=body,
        response_factory=lambda: _update_group(group, body, request, user, db),
    )


def _update_group(
    group: str,
    body: GroupUpdate,
    request: Request,
    user: User,
    db: Session,
) -> GroupInfo:
    org = _get_group_or_404(db, group)
    # governance: 그룹 표시 정보 수정은 maintainer+
    _require_group_maintainer(db, org, user)

    if "description" in body.model_fields_set:
        org.description = body.description
    db.commit()
    db.refresh(org)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="group.update",
        resource_type="group",
        resource_id=group,
        ip_address=request.client.host if request.client else None,
    )
    return _group_info(db, org, user)


@router.patch("/groups/{group}/slug", response_model=RenameGroupResponse)
def rename_group(
    group: str,
    body: RenameGroupRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Group slug rename (governance §repo-identity-spec).

    동작:
    - groups.id (UUID) / 산하 repo bucket / 종속 도메인 FK 모두 무변
    - groups.group_name (slug 컬럼) 만 변경
    - group_renames audit row insert (영구 — `_resolve` 301 source)
    - 단일 트랜잭션 (rename + audit)
    - 권한: group owner (`_require_group_owner`)
    - new_slug 검증: validate_repo_segment + 글로벌 unique
    """
    from app.services.repo_identity import validate_repo_segment, new_uuid7

    org = _get_group_or_404(db, group)
    _require_group_owner(db, org, user)

    try:
        new_slug = validate_repo_segment(body.new_slug, "group")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if new_slug == org.group_name:
        raise HTTPException(status_code=400, detail="new_slug must differ from current")

    existing = db.query(Organization).filter(Organization.group_name == new_slug).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"Group '{new_slug}' already exists")
    if _personal_namespace_exists(db, new_slug):
        raise HTTPException(status_code=409, detail=f"Group namespace '{new_slug}' already exists")

    old_slug = org.group_name
    rename_row = GroupRename(
        id=str(new_uuid7()),
        group_uuid=org.uuid,
        old_slug=old_slug,
        new_slug=new_slug,
        renamed_by=user.id,
        reason=body.reason,
    )
    db.add(rename_row)
    org.group_name = new_slug
    db.commit()
    db.refresh(org)

    # affected repo count (산하 repo)
    affected = db.query(Repo).filter(Repo.group_id == org.id).count()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="group.rename",
        resource_type="group",
        resource_id=f"id:{org.uuid}",
        details={
            "old_slug": old_slug,
            "new_slug": new_slug,
            "affected_repos": affected,
            "reason": body.reason,
        },
        ip_address=request.client.host if request.client else None,
    )
    return RenameGroupResponse(
        group_id=org.uuid,
        new_slug=new_slug,
        old_slug=old_slug,
        affected_repo_count=affected,
    )


@router.delete("/groups/{group}")
def delete_group(
    group: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"group.delete:{group}",
        body={},
        response_factory=lambda: _delete_group(group, request, user, db),
    )


def _delete_group(group: str, request: Request, user: User, db: Session) -> dict:
    org = _get_group_or_404(db, group)
    _require_group_owner(db, org, user)
    if db.query(Repo).filter(Repo.group_id == org.id).first() is not None:
        raise HTTPException(status_code=409, detail="Cannot delete a group with repositories")
    if db.query(Team).filter(Team.group_id == org.id).first() is not None:
        raise HTTPException(status_code=409, detail="Cannot delete a group with legacy teams")

    db.query(OrganizationMembership).filter(OrganizationMembership.group_id == org.id).delete()
    db.delete(org)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="group.delete",
        resource_type="group",
        resource_id=group,
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "deleted", "name": group}


@router.get("/groups/{group}/members", response_model=GroupMemberListResponse)
def list_group_members(
    group: str,
    limit: int = Query(100, ge=1, le=1000),
    page_token: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = _get_group_or_404(db, group)
    if _group_role(db, org, user) is None:
        raise HTTPException(status_code=403, detail="Access denied")

    items = [
        GroupMemberInfo(
            principal=org.owner.email,
            role="owner",
            granted_by=org.owner.email,
            created_at=org.created_at,
        )
    ]
    memberships = (
        db.query(OrganizationMembership)
        .options(joinedload(OrganizationMembership.user), joinedload(OrganizationMembership.granter))
        .filter(OrganizationMembership.group_id == org.id)
        .order_by(OrganizationMembership.created_at.asc(), OrganizationMembership.id.asc())
        .all()
    )
    for membership in memberships:
        role = _storage_role_to_group_role(membership.role)
        if role is None:
            continue
        items.append(
            GroupMemberInfo(
                principal=membership.user.email,
                role=role,
                granted_by=membership.granter.email if membership.granter else None,
                created_at=membership.created_at,
            )
        )

    page_items, has_more, next_page_token = _page(items, limit=limit, page_token=page_token)
    return GroupMemberListResponse(
        items=page_items,
        members=page_items,
        has_more=has_more,
        next_page_token=next_page_token,
    )


@router.put("/groups/{group}/members/{principal}")
def upsert_group_member(
    group: str,
    principal: str,
    body: GroupMemberGrant,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"group.member.upsert:{group}:{principal}",
        body=body,
        response_factory=lambda: _upsert_group_member(group, principal, body, request, user, db),
    )


def _upsert_group_member(
    group: str,
    principal: str,
    body: GroupMemberGrant,
    request: Request,
    user: User,
    db: Session,
) -> dict:
    org = _get_group_or_404(db, group)
    # governance: 멤버 추가/role 변경은 maintainer+ . 단 'owner' 부여는 별도
    # ownership 이전 경로 (현재 미지원) — 본 endpoint 는 400 으로 차단.
    _require_group_maintainer(db, org, user)
    # Governance §그룹 역할 (docs/api/groups.md): 멤버 upsert 로는 'owner' 부여 불가.
    # 4-tier 중 maintainer / contributor / guest 만 명시 부여 가능.
    if body.role == "owner":
        raise HTTPException(
            status_code=400,
            detail="Group ownership transfer is not supported by member upsert",
        )
    if body.role not in {"maintainer", "contributor", "guest"}:
        raise HTTPException(
            status_code=400,
            detail="Group member role must be one of 'maintainer', 'contributor', 'guest'",
        )

    # 사용자 보고(2026-05-08): 오타로 ghost user 가 생기지 않도록 auto-create 금지.
    # 등록 대상은 시스템에 이미 존재하는 사용자여야 함 (SSO 가입 후).
    target_user = db.query(User).filter(User.email == principal).first()
    if target_user is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"User '{principal}' not found. "
                "사용자가 먼저 시스템에 가입되어 있어야 합니다. "
                "`GET /api/v1/users/search?q=<keyword>` 또는 `dh user lookup <email>` 로 확인하세요."
            ),
        )
    if target_user.id == org.owner_id:
        raise HTTPException(status_code=400, detail="Group owner role cannot be changed through member upsert")

    # 4-tier role 그대로 storage 에 저장 (016 마이그레이션 이후 CHECK 통과).
    stored_role = body.role
    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.group_id == org.id,
            OrganizationMembership.user_id == target_user.id,
        )
        .first()
    )
    if membership:
        membership.role = stored_role
        membership.granted_by = user.id
    else:
        db.add(
            OrganizationMembership(
                group_id=org.id,
                user_id=target_user.id,
                role=stored_role,
                granted_by=user.id,
            )
        )
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="group.member_upsert",
        resource_type="group",
        resource_id=group,
        details={"principal": principal, "role": body.role},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "upserted", "principal": principal, "role": body.role}


@router.delete("/groups/{group}/members/{principal}")
def remove_group_member(
    group: str,
    principal: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return run_idempotent(
        request,
        actor_id=user.id,
        scope=f"group.member.remove:{group}:{principal}",
        body={},
        response_factory=lambda: _remove_group_member(group, principal, request, user, db),
    )


def _remove_group_member(
    group: str,
    principal: str,
    request: Request,
    user: User,
    db: Session,
) -> dict:
    org = _get_group_or_404(db, group)
    # governance: 멤버 제거는 maintainer+
    _require_group_maintainer(db, org, user)

    target_user = db.query(User).filter(User.email == principal).first()
    if target_user is None:
        raise HTTPException(status_code=404, detail=f"Group member '{principal}' not found")
    if target_user.id == org.owner_id:
        raise HTTPException(status_code=400, detail="Group owner cannot be removed through member remove")

    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.group_id == org.id,
            OrganizationMembership.user_id == target_user.id,
        )
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=404, detail=f"Group member '{principal}' not found")

    db.delete(membership)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="group.member_remove",
        resource_type="group",
        resource_id=group,
        details={"principal": principal},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "removed", "principal": principal}


@router.get("/groups/{group}/repos", response_model=GroupRepoListResponse)
def list_group_repos(
    group: str,
    limit: int = Query(100, ge=1, le=1000),
    page_token: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = _get_group_or_404(db, group)
    repos = _visible_group_repos(db, org, user)
    page_items, has_more, next_page_token = _page(repos, limit=limit, page_token=page_token)
    return GroupRepoListResponse(
        items=page_items,
        repos=page_items,
        has_more=has_more,
        next_page_token=next_page_token,
    )

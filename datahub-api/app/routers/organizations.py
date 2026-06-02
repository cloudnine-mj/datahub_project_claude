"""Organization CRUD 엔드포인트 (Deprecated).

> **DEPRECATED**: 본 라우터는 `/groups/*` (canonical, governance docs/api/groups.md)
> 로 대체됩니다. 모든 응답에 `Deprecation`, `Sunset`, `Link` 헤더가 부착되며,
> 다음 마이너 (2026-06) 에 제거 예정.
> 호출자는 새 `/groups/*` 로 이전 권장.

- POST   /organizations             # 조직 생성
- GET    /organizations             # 조직 목록 (탐색/검색, 페이지네이션)
- GET    /organizations/{org}       # 조직 Overview
- PATCH  /organizations/{org}       # 조직 설정 수정
- DELETE /organizations/{org}       # 조직 삭제
- GET    /organizations/{org}/repositories  # 조직 내 저장소 목록
- GET    /organizations/{org}/stats # 조직 통계
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    Organization,
    OrganizationMembership,
    Permission,
    Repo,
    Team,
    TeamMembership,
    TeamRepoPermission,
    User,
)
from app.schemas.organizations import (
    OrgRepoListResponse,
    OrgStatsResponse,
    OrganizationMemberGrant,
    OrganizationMemberInfo,
    OrganizationMemberListResponse,
    OrganizationCreate,
    OrganizationInfo,
    OrganizationListResponse,
    OrganizationUpdate,
    TeamCreate,
    TeamInfo,
    TeamListResponse,
    TeamMemberGrant,
    TeamMemberInfo,
    TeamMemberListResponse,
    TeamRepoGrant,
    TeamRepoPermissionInfo,
    TeamRepoPermissionListResponse,
)
from app.schemas.repos import RepoInfo
from app.services.audit import AuditService

logger = logging.getLogger(__name__)
router = APIRouter()
audit = AuditService()

# Governance: /organizations/* 는 /groups/* (docs/api/groups.md) 로 대체됨.
# RFC 8594/9111 의 Deprecation/Sunset 헤더는 main.py 의 ASGI middleware
# (DeprecationHeadersMiddleware) 가 모든 /organizations/* 응답에 자동 부착.


def _org_info(org: Organization) -> OrganizationInfo:
    # External legacy response schema 의 `org_name` 필드는 외부 client 호환을 위해
    # 유지 — ORM 컬럼은 017 마이그레이션에서 `group_name` 으로 rename 됐지만 매핑만 한다.
    return OrganizationInfo(
        id=org.id,
        org_name=org.group_name,
        owner=org.owner.email,
        description=org.description,
        visibility=org.visibility,
        avatar_url=org.avatar_url,
        created_at=org.created_at,
    )


def _get_org_or_404(db: Session, org_name: str) -> Organization:
    org = (
        db.query(Organization)
        .options(joinedload(Organization.owner))
        .filter(Organization.group_name == org_name)
        .first()
    )
    if org is None:
        raise HTTPException(status_code=404, detail=f"Organization '{org_name}' not found")
    return org


def _has_org_access(db: Session, org: Organization, user: User) -> bool:
    """private 조직 접근 권한 확인.

    public 조직은 항상 True.
    private 조직은 org owner이거나 소속 repo에 permission이 있으면 True.
    """
    if org.visibility == "public":
        return True
    if org.owner_id == user.id:
        return True
    if (
        db.query(OrganizationMembership)
        .filter(OrganizationMembership.group_id == org.id, OrganizationMembership.user_id == user.id)
        .first()
        is not None
    ):
        return True
    if (
        db.query(TeamMembership)
        .join(Team, TeamMembership.team_id == Team.id)
        .filter(Team.group_id == org.id, TeamMembership.user_id == user.id)
        .first()
        is not None
    ):
        return True
    # org 소속 repo에 Permission이 있는 경우 허용 (Reader 이상)
    return (
        db.query(Permission)
        .join(Repo, Permission.repo_name == Repo.repo_name)
        .filter(Repo.group_id == org.id, Permission.user_id == user.id)
        .first()
    ) is not None


def _require_org_owner(org: Organization, user: User) -> None:
    if org.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can manage this organization")


def _team_info(team: Team) -> TeamInfo:
    return TeamInfo(
        name=team.name,
        description=team.description,
        member_count=len(team.memberships),
    )


def _get_team_or_404(db: Session, group_id: int, name: str) -> Team:
    team = (
        db.query(Team)
        .options(joinedload(Team.memberships))
        .filter(Team.group_id == group_id, Team.name == name)
        .first()
    )
    if team is None:
        raise HTTPException(status_code=404, detail=f"Team '{name}' not found")
    return team


@router.post("/organizations", response_model=OrganizationInfo, status_code=201)
def create_organization(
    body: OrganizationCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """조직 생성."""
    existing = db.query(Organization).filter(Organization.group_name == body.org_name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Organization '{body.org_name}' already exists")

    # governance §repo-identity-spec: stable id (UUIDv7) 발급
    from app.services.repo_identity import new_uuid7

    org = Organization(
        uuid=str(new_uuid7()),
        group_name=body.org_name,
        owner_id=user.id,
        description=body.description,
        visibility=body.visibility,
        avatar_url=body.avatar_url,
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="org_create",
        resource_type="organization",
        resource_id=body.org_name,
        ip_address=request.client.host if request.client else None,
    )

    return _org_info(org)


@router.get("/organizations", response_model=OrganizationListResponse)
def list_organizations(
    search: str = Query(default="", description="org_name 부분 검색"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """조직 목록 (탐색/검색, 페이지네이션).

    - public 조직: 모두 표시
    - private 조직: owner 또는 소속 repo에 permission이 있는 경우 표시
    """
    # 현재 user 가 repo permission 을 통해 속한 group_id 목록
    member_group_ids_subq = (
        db.query(Repo.group_id)
        .join(Permission, Permission.repo_name == Repo.repo_name)
        .filter(Permission.user_id == user.id, Repo.group_id.isnot(None))
        .subquery()
    )

    query = (
        db.query(Organization)
        .options(joinedload(Organization.owner))
        .filter(
            or_(
                Organization.visibility == "public",
                Organization.owner_id == user.id,
                Organization.id.in_(select(member_group_ids_subq.c.group_id)),
            )
        )
    )

    if search:
        query = query.filter(Organization.group_name.ilike(f"%{search}%"))

    total = query.count()
    orgs = query.order_by(Organization.created_at.desc()).offset((page - 1) * size).limit(size).all()

    return OrganizationListResponse(
        orgs=[_org_info(o) for o in orgs],
        total=total,
        page=page,
        size=size,
    )


@router.get("/organizations/{org}", response_model=OrganizationInfo)
def get_organization(
    org: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """조직 Overview."""
    organization = _get_org_or_404(db, org)

    if not _has_org_access(db, organization, user):
        raise HTTPException(status_code=403, detail="Access denied")

    return _org_info(organization)


@router.patch("/organizations/{org}", response_model=OrganizationInfo)
def update_organization(
    org: str,
    body: OrganizationUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """조직 설정 수정 (owner only)."""
    organization = _get_org_or_404(db, org)

    _require_org_owner(organization, user)

    if body.visibility is not None:
        organization.visibility = body.visibility

    if body.description is not None:
        organization.description = body.description

    if body.avatar_url is not None:
        organization.avatar_url = body.avatar_url

    db.commit()
    db.refresh(organization)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="org_update",
        resource_type="organization",
        resource_id=org,
        ip_address=request.client.host if request.client else None,
    )

    return _org_info(organization)


@router.delete("/organizations/{org}")
def delete_organization(
    org: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """조직 삭제 (owner only). 소속 repo 의 group_id 를 NULL 로 해제 후 삭제."""
    organization = _get_org_or_404(db, org)

    _require_org_owner(organization, user)

    # 소속 repo 의 group_id 해제
    db.query(Repo).filter(Repo.group_id == organization.id).update({"group_id": None})

    db.delete(organization)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="org_delete",
        resource_type="organization",
        resource_id=org,
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "deleted", "org_name": org}


@router.put("/organizations/{org}/members")
def grant_organization_member(
    org: str,
    body: OrganizationMemberGrant,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    _require_org_owner(organization, user)

    # 사용자 보고(2026-05-08): 오타로 ghost user 가 생기지 않도록 auto-create 금지.
    target_user = db.query(User).filter(User.email == body.email).first()
    if target_user is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"User '{body.email}' not found. "
                "사용자가 먼저 시스템에 가입되어 있어야 합니다."
            ),
        )

    if target_user.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot change the owner's organization role")

    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.group_id == organization.id,
        OrganizationMembership.user_id == target_user.id,
    ).first()
    if membership:
        membership.role = body.role
        membership.granted_by = user.id
    else:
        db.add(
            OrganizationMembership(
                group_id=organization.id,
                user_id=target_user.id,
                role=body.role,
                granted_by=user.id,
            )
        )
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="org_member_grant",
        resource_type="organization",
        resource_id=org,
        details={"target_email": body.email, "role": body.role},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "granted", "email": body.email, "role": body.role}


@router.delete("/organizations/{org}/members/{email}")
def revoke_organization_member(
    org: str,
    email: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    _require_org_owner(organization, user)

    target_user = db.query(User).filter(User.email == email).first()
    if target_user is None:
        raise HTTPException(status_code=404, detail=f"User '{email}' not found")

    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.group_id == organization.id,
        OrganizationMembership.user_id == target_user.id,
    ).first()
    if membership is None:
        raise HTTPException(status_code=404, detail=f"Organization member '{email}' not found")

    db.delete(membership)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="org_member_revoke",
        resource_type="organization",
        resource_id=org,
        details={"target_email": email},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "revoked", "email": email}


@router.get("/organizations/{org}/members", response_model=OrganizationMemberListResponse)
def list_organization_members(
    org: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    if not _has_org_access(db, organization, user):
        raise HTTPException(status_code=403, detail="Access denied")

    memberships = (
        db.query(OrganizationMembership)
        .filter(OrganizationMembership.group_id == organization.id)
        .all()
    )
    members = [OrganizationMemberInfo(email=organization.owner.email, role="owner", granted_by="-")]
    for membership in memberships:
        members.append(
            OrganizationMemberInfo(
                email=membership.user.email,
                role=membership.role,
                granted_by=membership.granter.email,
            )
        )
    return OrganizationMemberListResponse(members=members)


@router.post("/organizations/{org}/teams", response_model=TeamInfo, status_code=201)
def create_team(
    org: str,
    body: TeamCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    _require_org_owner(organization, user)

    if db.query(Team).filter(Team.group_id == organization.id, Team.name == body.name).first():
        raise HTTPException(status_code=409, detail=f"Team '{body.name}' already exists")

    team = Team(group_id=organization.id, name=body.name, description=body.description, created_by=user.id)
    db.add(team)
    db.commit()
    db.refresh(team)

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="team_create",
        resource_type="organization",
        resource_id=org,
        details={"team": body.name},
        ip_address=request.client.host if request.client else None,
    )
    return _team_info(team)


@router.get("/organizations/{org}/teams", response_model=TeamListResponse)
def list_teams(
    org: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    if not _has_org_access(db, organization, user):
        raise HTTPException(status_code=403, detail="Access denied")

    teams = db.query(Team).options(joinedload(Team.memberships)).filter(Team.group_id == organization.id).all()
    return TeamListResponse(teams=[_team_info(team) for team in teams])


@router.put("/organizations/{org}/teams/{team_name}/members")
def add_team_member(
    org: str,
    team_name: str,
    body: TeamMemberGrant,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    _require_org_owner(organization, user)
    team = _get_team_or_404(db, organization.id, team_name)

    # 사용자 보고(2026-05-08): auto-create 금지 — 등록 대상은 사전 가입된 사용자만.
    target_user = db.query(User).filter(User.email == body.email).first()
    if target_user is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"User '{body.email}' not found. "
                "사용자가 먼저 시스템에 가입되어 있어야 합니다."
            ),
        )

    existing = db.query(TeamMembership).filter(
        TeamMembership.team_id == team.id,
        TeamMembership.user_id == target_user.id,
    ).first()
    if existing is None:
        db.add(TeamMembership(team_id=team.id, user_id=target_user.id, added_by=user.id))
        db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="team_member_add",
        resource_type="organization",
        resource_id=org,
        details={"team": team_name, "target_email": body.email},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "added", "team": team_name, "email": body.email}


@router.delete("/organizations/{org}/teams/{team_name}/members/{email}")
def remove_team_member(
    org: str,
    team_name: str,
    email: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    _require_org_owner(organization, user)
    team = _get_team_or_404(db, organization.id, team_name)

    membership = (
        db.query(TeamMembership)
        .join(User, TeamMembership.user_id == User.id)
        .filter(TeamMembership.team_id == team.id, User.email == email)
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=404, detail=f"Team member '{email}' not found")

    db.delete(membership)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="team_member_remove",
        resource_type="organization",
        resource_id=org,
        details={"team": team_name, "target_email": email},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "removed", "team": team_name, "email": email}


@router.get("/organizations/{org}/teams/{team_name}/members", response_model=TeamMemberListResponse)
def list_team_members(
    org: str,
    team_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    if not _has_org_access(db, organization, user):
        raise HTTPException(status_code=403, detail="Access denied")
    team = _get_team_or_404(db, organization.id, team_name)

    memberships = db.query(TeamMembership).join(User, TeamMembership.user_id == User.id).filter(TeamMembership.team_id == team.id).all()
    return TeamMemberListResponse(members=[TeamMemberInfo(email=membership.user.email) for membership in memberships])


@router.put("/organizations/{org}/teams/{team_name}/repos/{repo_name}")
def grant_team_repo_permission(
    org: str,
    team_name: str,
    repo_name: str,
    body: TeamRepoGrant,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    _require_org_owner(organization, user)
    team = _get_team_or_404(db, organization.id, team_name)
    repo = db.query(Repo).filter(Repo.repo_name == repo_name, Repo.group_id == organization.id).first()
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository '{repo_name}' not found in organization '{org}'")

    existing = db.query(TeamRepoPermission).filter(
        TeamRepoPermission.team_id == team.id,
        TeamRepoPermission.repo_name == repo_name,
    ).first()
    if existing:
        existing.role = body.role
        existing.granted_by = user.id
    else:
        db.add(TeamRepoPermission(team_id=team.id, repo_name=repo_name, role=body.role, granted_by=user.id))
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="team_repo_permission_grant",
        resource_type="repo",
        resource_id=repo_name,
        details={"team": team_name, "role": body.role},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "granted", "team": team_name, "repo_name": repo_name, "role": body.role}


@router.delete("/organizations/{org}/teams/{team_name}/repos/{repo_name}")
def revoke_team_repo_permission(
    org: str,
    team_name: str,
    repo_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    _require_org_owner(organization, user)
    team = _get_team_or_404(db, organization.id, team_name)

    team_permission = db.query(TeamRepoPermission).filter(
        TeamRepoPermission.team_id == team.id,
        TeamRepoPermission.repo_name == repo_name,
    ).first()
    if team_permission is None:
        raise HTTPException(status_code=404, detail="Team repository permission not found")

    db.delete(team_permission)
    db.commit()

    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="team_repo_permission_revoke",
        resource_type="repo",
        resource_id=repo_name,
        details={"team": team_name},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "revoked", "team": team_name, "repo_name": repo_name}


@router.get("/organizations/{org}/teams/{team_name}/repos", response_model=TeamRepoPermissionListResponse)
def list_team_repo_permissions(
    org: str,
    team_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    organization = _get_org_or_404(db, org)
    if not _has_org_access(db, organization, user):
        raise HTTPException(status_code=403, detail="Access denied")
    team = _get_team_or_404(db, organization.id, team_name)

    team_permissions = db.query(TeamRepoPermission).filter(TeamRepoPermission.team_id == team.id).all()
    return TeamRepoPermissionListResponse(
        permissions=[
            TeamRepoPermissionInfo(repo_name=team_permission.repo_name, role=team_permission.role)
            for team_permission in team_permissions
        ]
    )


@router.get("/organizations/{org}/repositories", response_model=OrgRepoListResponse)
def list_org_repositories(
    org: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """조직 내 저장소 목록."""
    organization = _get_org_or_404(db, org)

    if not _has_org_access(db, organization, user):
        raise HTTPException(status_code=403, detail="Access denied")

    # joinedload로 owner 한 번에 로드 (N+1 방지)
    repos = (
        db.query(Repo)
        .options(joinedload(Repo.owner))
        .filter(Repo.group_id == organization.id)
        .all()
    )

    if not repos:
        return OrgRepoListResponse(repos=[])

    # 현재 user의 permissions를 한 번에 조회
    repo_names = [r.repo_name for r in repos]
    user_perm_map = {
        perm.repo_name: perm.role
        for perm in db.query(Permission).filter(
            Permission.user_id == user.id,
            Permission.repo_name.in_(repo_names),
        ).all()
    }

    repo_infos = []
    for repo in repos:
        if repo.owner_id == user.id:
            role = "owner"
        else:
            role = user_perm_map.get(repo.repo_name, "normal")

        repo_infos.append(RepoInfo(
            repo_name=repo.repo_name,
            owner=repo.owner.email,
            role=role,
            visibility=repo.visibility,
            created_at=repo.created_at,
        ))

    return OrgRepoListResponse(repos=repo_infos)


@router.get("/organizations/{org}/stats", response_model=OrgStatsResponse)
def get_org_stats(
    org: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """조직 통계 (멤버 수, 저장소 수, 총 스토리지).

    멤버 = org owner + 소속 repo owner + 소속 repo permission 보유 사용자 (중복 제거).
    """
    organization = _get_org_or_404(db, org)

    if not _has_org_access(db, organization, user):
        raise HTTPException(status_code=403, detail="Access denied")

    repo_count: int = (
        db.query(Repo).filter(Repo.group_id == organization.id).count()
    )

    # 소속 repo owner ids
    repo_owner_ids: set[int] = {
        row[0]
        for row in db.query(Repo.owner_id).filter(Repo.group_id == organization.id).all()
    }
    # 소속 repo permission user ids
    perm_user_ids: set[int] = {
        row[0]
        for row in (
            db.query(Permission.user_id)
            .join(Repo, Permission.repo_name == Repo.repo_name)
            .filter(Repo.group_id == organization.id)
            .all()
        )
    }

    member_count = len({organization.owner_id} | repo_owner_ids | perm_user_ids)

    return OrgStatsResponse(
        org_name=org,
        member_count=member_count,
        repo_count=repo_count,
        total_size_bytes=0,  # 실시간 GCS 조회는 별도 구현 시 추가
    )



# ── Groups alias (저장소 생성 폼의 group 드롭다운 지원) ─────────────────────────
# "groups" 는 organizations 의 alias. 현재는 정적 빈 프로젝트 목록을 반환.
# 추후 Project 모델이 추가되면 DB 조회로 교체 예정.

class ProjectItem(BaseModel):
    id: str
    name: str


@router.get("/groups/{group}/projects", response_model=List[ProjectItem])
def list_group_projects(
    group: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """조직(group) 내 프로젝트 목록 조회.

    현재는 정적 빈 목록 반환 (Project 모델 미구현).
    조직 존재 여부만 확인하고 빈 배열을 반환.
    """
    org = db.query(Organization).filter(Organization.group_name == group).first()
    if org is None:
        raise HTTPException(status_code=404, detail=f"Group '{group}' not found")
    return []

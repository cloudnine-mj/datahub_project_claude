"""사용자 프로필 엔드포인트.

- GET /users/me: 현재 로그인 사용자 정보
- GET /users/search?q=: 이메일/username 검색 (Contributor 자동완성용)
- GET /users/{username}: 사용자 공개 프로필
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Organization, OrganizationMembership, Repo, User
from app.schemas.users import (
    GroupMembershipSummary,
    MeResponse,
    RepoSummary,
    UserProfile,
)
from app.services.repo_identity import personal_owner_from_email

router = APIRouter()


class UserSearchResult(BaseModel):
    id: int
    email: str
    name: str  # username derived from email


def _username_from_email(email: str) -> str:
    """이메일에서 username 파생 (@ 앞부분)."""
    return email.split("@")[0]


@router.get("/users/search", response_model=List[UserSearchResult])
def search_users(
    q: str = Query(default="", min_length=0),
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """이메일 또는 username 으로 사용자 검색 (Contributor/Maintainer 자동완성용).

    q가 비어 있으면 빈 목록 반환.
    """
    if not q.strip():
        return []
    pattern = f"%{q.strip()}%"
    users = (
        db.query(User)
        .filter(
            User.is_active == True,  # noqa: E712
            or_(User.email.ilike(pattern)),
        )
        .order_by(User.email)
        .limit(limit)
        .all()
    )
    return [
        UserSearchResult(id=u.id, email=u.email, name=_username_from_email(u.email))
        for u in users
    ]


@router.get("/users/me", response_model=MeResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """현재 로그인 사용자 정보 반환.

    governance §그룹 / §개인 owner:
      - `personal_namespace`: 이메일 기반 derived (저장소 owner 자리에 그대로 사용).
      - `groups`: 본인이 가입한 그룹 (owner 또는 membership row) 의 4-tier role.
    """
    personal = personal_owner_from_email(current_user.email)

    # 본인이 owner 인 그룹
    owned = db.query(Organization).filter(Organization.owner_id == current_user.id).all()
    summaries: list[GroupMembershipSummary] = [
        GroupMembershipSummary(name=org.group_name, role="owner") for org in owned
    ]

    # membership row (owner_id 와 별개)
    memberships = (
        db.query(OrganizationMembership, Organization)
        .join(Organization, OrganizationMembership.group_id == Organization.id)
        .filter(OrganizationMembership.user_id == current_user.id)
        .all()
    )
    owned_names = {org.group_name for org in owned}
    for m, org in memberships:
        if org.group_name in owned_names:
            continue  # owner role 이 우선
        summaries.append(GroupMembershipSummary(name=org.group_name, role=m.role))

    return MeResponse(
        user_id=current_user.id,
        email=current_user.email,
        username=_username_from_email(current_user.email),
        is_active=current_user.is_active,
        joined_at=current_user.created_at,
        personal_namespace=personal,
        groups=summaries,
    )


@router.get("/users/{username}", response_model=UserProfile)
def get_user_profile(username: str, db: Session = Depends(get_db)):
    """사용자 공개 프로필 조회.

    username은 이메일 앞부분 (@ 이전) 또는 이메일 전체로 조회 가능.
    공개(public) 저장소만 노출한다.
    """
    # username이 이메일 전체이거나 prefix인 경우 모두 처리
    user = db.query(User).filter(User.email == username).first()
    if user is None:
        # prefix 형태로 시도 (LIKE 검색)
        user = (
            db.query(User)
            .filter(User.email.like(f"{username}@%"))
            .first()
        )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    public_repos = (
        db.query(Repo)
        .filter(Repo.owner_id == user.id, Repo.visibility == "public")
        .order_by(Repo.created_at.desc())
        .all()
    )

    return UserProfile(
        username=_username_from_email(user.email),
        email=user.email,
        avatar_url=None,
        joined_at=user.created_at,
        repos=[
            RepoSummary(
                repo_name=r.repo_name,
                visibility=r.visibility,
                created_at=r.created_at,
            )
            for r in public_repos
        ],
    )

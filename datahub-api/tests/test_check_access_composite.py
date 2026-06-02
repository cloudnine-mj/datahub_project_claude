"""check_access — composite repo name (group/repo) 조회 테스트.

group-scoped 라우트에서 check_access("org/repo") 형태로 호출할 때
Organization join을 통해 올바르게 레포를 찾는지 검증한다.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, Organization, OrganizationMembership, Repo, User
from app.services.authorization import check_access

_TABLES = [
    Base.metadata.tables[t]
    for t in (
        "users",
        "organizations",
        "repos",
        "permissions",
        "organization_memberships",
        "teams",
        "team_memberships",
        "team_repo_permissions",
    )
]


def _make_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=_TABLES)
    return sessionmaker(bind=engine, expire_on_commit=False)()


def test_check_access_composite_name_finds_org_repo() -> None:
    """check_access("org/repo") 가 Organization join 으로 레포를 올바르게 찾는다."""
    db = _make_db()
    owner = User(email="owner@example.com", is_active=True)
    db.add(owner)
    db.flush()

    org = Organization(group_name="myorg", owner_id=owner.id, visibility="private")
    db.add(org)
    db.flush()

    repo = Repo(repo_name="myrepo", owner_id=owner.id, group_id=org.id, visibility="private")
    db.add(repo)
    db.commit()

    result = check_access(db, owner, "myorg/myrepo", min_role="owner")
    assert result.repo_name == "myrepo"


def test_check_access_composite_name_wrong_org_raises_404() -> None:
    """잘못된 org 이름으로 composite 조회 시 404."""
    db = _make_db()
    owner = User(email="owner@example.com", is_active=True)
    db.add(owner)
    db.flush()

    org = Organization(group_name="myorg", owner_id=owner.id, visibility="private")
    db.add(org)
    db.flush()

    repo = Repo(repo_name="myrepo", owner_id=owner.id, group_id=org.id, visibility="private")
    db.add(repo)
    db.commit()

    with pytest.raises(HTTPException) as exc:
        check_access(db, owner, "wrongorg/myrepo")
    assert exc.value.status_code == 404


def test_check_access_bare_name_still_works() -> None:
    """슬래시 없는 bare name 조회는 그대로 동작한다."""
    db = _make_db()
    owner = User(email="owner@example.com", is_active=True)
    db.add(owner)
    db.flush()

    repo = Repo(repo_name="barerepo", owner_id=owner.id, visibility="public")
    db.add(repo)
    db.commit()

    result = check_access(db, owner, "barerepo", min_role="owner")
    assert result.repo_name == "barerepo"


def test_check_access_composite_org_membership_does_not_grant_repo_access() -> None:
    """org membership만 있는 사용자는 private repo에 접근할 수 없다."""
    db = _make_db()
    owner = User(email="owner@example.com", is_active=True)
    member = User(email="member@example.com", is_active=True)
    db.add_all([owner, member])
    db.flush()

    org = Organization(group_name="myorg", owner_id=owner.id, visibility="private")
    db.add(org)
    db.flush()

    repo = Repo(repo_name="myrepo", owner_id=owner.id, group_id=org.id, visibility="private")
    db.add(repo)
    db.flush()

    db.add(OrganizationMembership(group_id=org.id, user_id=member.id, role="contributor", granted_by=owner.id))
    db.commit()

    with pytest.raises(HTTPException) as exc:
        check_access(db, member, "myorg/myrepo", min_role="guest")
    assert exc.value.status_code == 403

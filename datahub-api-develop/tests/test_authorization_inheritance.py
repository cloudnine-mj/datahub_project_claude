from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import (
    Base,
    Organization,
    OrganizationMembership,
    Permission,
    Repo,
    Team,
    TeamMembership,
    TeamRepoPermission,
    User,
)
from app.routers.organizations import _has_org_access
from app.services.authorization import resolve_role


_SQLITE_TABLES = [
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
    Base.metadata.create_all(engine, tables=_SQLITE_TABLES)
    return sessionmaker(bind=engine, expire_on_commit=False)()


def test_org_membership_role_is_inherited_by_repo_access() -> None:
    db = _make_db()
    owner = User(email="owner@example.com", is_active=True)
    member = User(email="member@example.com", is_active=True)
    db.add_all([owner, member])
    db.flush()

    org = Organization(org_name="vision", owner_id=owner.id, visibility="private")
    db.add(org)
    db.flush()

    repo = Repo(repo_name="dataset-a", owner_id=owner.id, org_id=org.id, visibility="private")
    db.add(repo)
    db.flush()

    db.add(OrganizationMembership(org_id=org.id, user_id=member.id, role="developer", granted_by=owner.id))
    db.commit()

    assert resolve_role(db, member, repo) == "developer"
    assert _has_org_access(db, org, member) is True


def test_team_repo_permission_is_inherited_by_repo_access() -> None:
    db = _make_db()
    owner = User(email="owner@example.com", is_active=True)
    member = User(email="member@example.com", is_active=True)
    db.add_all([owner, member])
    db.flush()

    org = Organization(org_name="vision", owner_id=owner.id, visibility="private")
    db.add(org)
    db.flush()

    repo = Repo(repo_name="dataset-a", owner_id=owner.id, org_id=org.id, visibility="private")
    db.add(repo)
    db.flush()

    team = Team(org_id=org.id, name="researchers", created_by=owner.id)
    db.add(team)
    db.flush()

    db.add(TeamMembership(team_id=team.id, user_id=member.id, added_by=owner.id))
    db.add(TeamRepoPermission(team_id=team.id, repo_name=repo.repo_name, role="guest", granted_by=owner.id))
    db.commit()

    assert resolve_role(db, member, repo) == "guest"
    assert _has_org_access(db, org, member) is True


def test_direct_repo_permission_still_wins_when_higher_than_org_or_team() -> None:
    db = _make_db()
    owner = User(email="owner@example.com", is_active=True)
    member = User(email="member@example.com", is_active=True)
    db.add_all([owner, member])
    db.flush()

    org = Organization(org_name="vision", owner_id=owner.id, visibility="private")
    db.add(org)
    db.flush()

    repo = Repo(repo_name="dataset-a", owner_id=owner.id, org_id=org.id, visibility="private")
    db.add(repo)
    db.flush()

    db.add(OrganizationMembership(org_id=org.id, user_id=member.id, role="guest", granted_by=owner.id))
    team = Team(org_id=org.id, name="researchers", created_by=owner.id)
    db.add(team)
    db.flush()
    db.add(TeamMembership(team_id=team.id, user_id=member.id, added_by=owner.id))
    db.add(TeamRepoPermission(team_id=team.id, repo_name=repo.repo_name, role="developer", granted_by=owner.id))
    db.add(Permission(repo_name=repo.repo_name, user_id=member.id, role="maintainer", granted_by=owner.id))
    db.commit()

    assert resolve_role(db, member, repo) == "maintainer"

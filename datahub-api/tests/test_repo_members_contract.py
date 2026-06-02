from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Base, Organization, OrganizationMembership, Permission, Repo, User
from app.routers import permissions as permissions_router
from app.services import audit as audit_module


_SQLITE_TABLES = [
    Base.metadata.tables[t]
    for t in (
        "users",
        "organizations",
        "repos",
        "permissions",
        "organization_memberships",
    )
]


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=_SQLITE_TABLES)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    session = SessionLocal()
    yield session
    session.close()
    engine.dispose()


def _seed_repo(db: Session) -> tuple[User, User, Repo]:
    owner = User(email="owner@example.com", is_active=True)
    member = User(email="member@example.com", is_active=True)
    db.add_all([owner, member])
    db.flush()

    org = Organization(group_name="owner", owner_id=owner.id, visibility="private")
    db.add(org)
    db.flush()

    repo = Repo(repo_name="repo", owner_id=owner.id, group_id=org.id, visibility="private")
    db.add(repo)
    db.commit()
    return owner, member, repo


def _client(db: Session, user: User, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(permissions_router.audit, "log", lambda *a, **kw: None)
    monkeypatch.setattr(audit_module.audit, "log", lambda *a, **kw: None)

    app = FastAPI()
    app.include_router(permissions_router.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_repo_members_add_list_remove_uses_bare_repo_fk(db, monkeypatch):
    owner, member, repo = _seed_repo(db)
    client = _client(db, owner, monkeypatch)

    response = client.put(
        "/api/v1/repos/owner/repo/members/member@example.com",
        json={"role": "contributor"},
    )
    assert response.status_code == 200, response.text

    perm = db.query(Permission).filter(Permission.user_id == member.id).one()
    assert perm.repo_name == repo.repo_name
    assert perm.role == "contributor"

    listed = client.get("/api/v1/repos/owner/repo/members")
    assert listed.status_code == 200, listed.text
    items = listed.json()["items"]
    assert [
        {k: item[k] for k in ("principal", "role", "granted_by")}
        for item in items
    ] == [
        {"principal": "owner@example.com", "role": "owner", "granted_by": "-"},
        {
            "principal": "member@example.com",
            "role": "contributor",
            "granted_by": "owner@example.com",
        },
    ]

    removed = client.delete("/api/v1/repos/owner/repo/members/member@example.com")
    assert removed.status_code == 200, removed.text
    assert db.query(Permission).filter(Permission.user_id == member.id).first() is None


def test_repo_members_grant_unknown_user_fails_without_autocreate(db, monkeypatch):
    owner, _, _ = _seed_repo(db)
    client = _client(db, owner, monkeypatch)

    response = client.put(
        "/api/v1/repos/owner/repo/members/missing@example.com",
        json={"role": "guest"},
    )

    assert response.status_code == 404
    assert db.query(User).filter(User.email == "missing@example.com").first() is None


def test_repo_members_rejects_developer_role(db, monkeypatch):
    owner, _, _ = _seed_repo(db)
    client = _client(db, owner, monkeypatch)

    response = client.put(
        "/api/v1/repos/owner/repo/members/member@example.com",
        json={"role": "developer"},
    )

    assert response.status_code == 422
    assert db.query(Permission).count() == 0


def test_org_membership_only_cannot_list_private_repo_members(db, monkeypatch):
    owner, member, repo = _seed_repo(db)
    db.add(
        OrganizationMembership(
            group_id=repo.group_id,
            user_id=member.id,
            role="contributor",
            granted_by=owner.id,
        )
    )
    db.commit()
    client = _client(db, member, monkeypatch)

    response = client.get("/api/v1/repos/owner/repo/members")

    assert response.status_code == 404

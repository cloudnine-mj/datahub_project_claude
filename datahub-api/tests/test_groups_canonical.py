"""Canonical /groups API contract tests."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Base, Organization, OrganizationMembership, Permission, Repo, RepoPublicAccessPolicy, User
from app.routers import groups as groups_mod
from app.services.idempotency import clear_idempotency


_SQLITE_TABLES = [
    Base.metadata.tables[t]
    for t in (
        "users",
        "organizations",
        "repos",
        "repo_public_access_policies",
        "permissions",
        "organization_memberships",
        "teams",
    )
]


def _make_test_app() -> FastAPI:
    app = FastAPI()
    app.include_router(groups_mod.router)
    return app


_test_app = _make_test_app()


@pytest.fixture
def db():
    clear_idempotency()
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
    Base.metadata.drop_all(engine, tables=_SQLITE_TABLES)


@pytest.fixture
def client(db: Session, monkeypatch: pytest.MonkeyPatch):
    current_user_holder: list[User] = []

    def override_get_db():
        yield db

    def override_get_current_user():
        return current_user_holder[0]

    monkeypatch.setattr(groups_mod.audit, "log", lambda *args, **kwargs: None)
    _test_app.dependency_overrides[get_db] = override_get_db
    _test_app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(_test_app) as test_client:
        test_client._current_user_holder = current_user_holder  # type: ignore[attr-defined]
        yield test_client

    _test_app.dependency_overrides.clear()


def set_user(client: TestClient, user: User) -> None:
    client._current_user_holder.clear()  # type: ignore[attr-defined]
    client._current_user_holder.append(user)  # type: ignore[attr-defined]


def make_user(db: Session, email: str) -> User:
    user = User(email=email, is_active=True)
    db.add(user)
    db.flush()
    return user


def make_group(
    db: Session,
    owner: User,
    name: str,
    *,
    visibility: str = "private",
    description: str | None = None,
) -> Organization:
    group = Organization(
        group_name=name,
        owner_id=owner.id,
        visibility=visibility,
        description=description,
    )
    db.add(group)
    db.flush()
    db.refresh(group)
    group.owner = owner
    return group


def make_membership(db: Session, group: Organization, user: User, role: str = "guest") -> OrganizationMembership:
    membership = OrganizationMembership(
        group_id=group.id,
        user_id=user.id,
        role=role,
        granted_by=group.owner_id,
    )
    db.add(membership)
    db.flush()
    db.refresh(membership)
    return membership


def make_repo(
    db: Session,
    owner: User,
    group: Organization,
    name: str,
    *,
    visibility: str = "private",
    discoverable: bool = False,
) -> Repo:
    repo = Repo(repo_name=name, owner_id=owner.id, group_id=group.id, visibility=visibility)
    db.add(repo)
    db.flush()
    policy = RepoPublicAccessPolicy(
        repo_name=name,
        discoverable=discoverable,
        metadata_read=discoverable,
        file_list=discoverable,
        file_read=discoverable,
        lineage_read=discoverable,
        stats_read=discoverable,
    )
    db.add(policy)
    db.flush()
    db.refresh(repo)
    repo.owner = owner
    repo.organization = group
    repo.public_access_policy = policy
    return repo


def make_permission(db: Session, repo: Repo, user: User, role: str = "guest") -> Permission:
    permission = Permission(
        repo_name=repo.repo_name,
        user_id=user.id,
        role=role,
        granted_by=repo.owner_id,
    )
    db.add(permission)
    db.flush()
    return permission


def test_group_crud_uses_canonical_shape(client: TestClient, db: Session):
    owner = make_user(db, "owner@example.com")
    set_user(client, owner)

    created = client.post("/groups", json={"name": "nlp-lab", "description": "NLP work"})
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "nlp-lab"
    assert body["type"] == "group"
    assert body["current_user_role"] == "owner"
    assert body["member_count"] == 1

    listed = client.get("/groups")
    assert listed.status_code == 200
    list_body = listed.json()
    assert [item["name"] for item in list_body["items"]] == ["nlp-lab"]
    assert [item["name"] for item in list_body["groups"]] == ["nlp-lab"]

    detail = client.get("/groups/nlp-lab")
    assert detail.status_code == 200
    assert detail.json()["description"] == "NLP work"

    updated = client.patch("/groups/nlp-lab", json={"description": "Updated"})
    assert updated.status_code == 200
    assert updated.json()["description"] == "Updated"

    deleted = client.delete("/groups/nlp-lab")
    assert deleted.status_code == 200
    assert deleted.json() == {"status": "deleted", "name": "nlp-lab"}


def test_group_list_pagination_and_invalid_token(client: TestClient, db: Session):
    owner = make_user(db, "owner@example.com")
    for name in ("alpha", "beta", "gamma"):
        make_group(db, owner, name, visibility="public")
    db.commit()
    set_user(client, owner)

    first = client.get("/groups?limit=2")
    assert first.status_code == 200
    first_body = first.json()
    assert len(first_body["items"]) == 2
    assert first_body["has_more"] is True
    assert first_body["next_page_token"]

    second = client.get(f"/groups?limit=2&page_token={first_body['next_page_token']}")
    assert second.status_code == 200
    assert len(second.json()["items"]) == 1

    invalid = client.get("/groups?page_token=not-a-token")
    assert invalid.status_code == 400


def test_personal_namespace_conflict(client: TestClient, db: Session):
    existing_user = make_user(db, "nlp.lab@example.com")
    actor = make_user(db, "owner@example.com")
    db.commit()
    assert existing_user.id is not None
    set_user(client, actor)

    response = client.post("/groups", json={"name": "nlp-lab"})
    assert response.status_code == 409


def test_members_list_upsert_remove_and_owner_rejected(client: TestClient, db: Session):
    owner = make_user(db, "owner@example.com")
    # 회귀 (2026-05-08): auto-create 제거 — 등록 대상 user 가 사전에 존재해야 함.
    make_user(db, "member@example.com")
    make_user(db, "other@example.com")
    group = make_group(db, owner, "nlp-lab")
    db.commit()
    set_user(client, owner)

    initial = client.get("/groups/nlp-lab/members")
    assert initial.status_code == 200
    assert initial.json()["items"] == [
        {
            "principal": "owner@example.com",
            "role": "owner",
            "granted_by": "owner@example.com",
            "created_at": initial.json()["items"][0]["created_at"],
        }
    ]

    upserted = client.put("/groups/nlp-lab/members/member@example.com", json={"role": "maintainer"})
    assert upserted.status_code == 200
    assert upserted.json()["role"] == "maintainer"

    members = client.get("/groups/nlp-lab/members").json()["items"]
    assert {member["principal"]: member["role"] for member in members} == {
        "owner@example.com": "owner",
        "member@example.com": "maintainer",
    }

    # governance 4-tier: contributor 또는 guest 로 데모트
    demoted = client.put("/groups/nlp-lab/members/member@example.com", json={"role": "contributor"})
    assert demoted.status_code == 200
    members = client.get("/groups/nlp-lab/members").json()["items"]
    assert {member["principal"]: member["role"] for member in members}["member@example.com"] == "contributor"

    # guest 로 추가 데모트도 가능
    guest = client.put("/groups/nlp-lab/members/member@example.com", json={"role": "guest"})
    assert guest.status_code == 200
    assert guest.json()["role"] == "guest"

    # legacy "member" 값은 더 이상 허용 안 됨 (400)
    legacy = client.put("/groups/nlp-lab/members/member@example.com", json={"role": "member"})
    assert legacy.status_code == 400

    owner_role = client.put("/groups/nlp-lab/members/other@example.com", json={"role": "owner"})
    assert owner_role.status_code == 400

    removed = client.delete("/groups/nlp-lab/members/member@example.com")
    assert removed.status_code == 200
    assert removed.json()["principal"] == "member@example.com"

    db.refresh(group)
    assert group.group_name == "nlp-lab"


def test_member_upsert_rejects_unknown_user(client: TestClient, db: Session):
    """회귀(2026-05-08): auto-create 제거. 미존재 user 는 404 + helpful detail."""
    owner = make_user(db, "owner@example.com")
    make_group(db, owner, "nlp-lab")
    db.commit()
    set_user(client, owner)

    resp = client.put(
        "/groups/nlp-lab/members/ghost-typo@example.com",
        json={"role": "contributor"},
    )
    assert resp.status_code == 404
    detail = resp.json().get("detail", "")
    assert "ghost-typo@example.com" in detail
    assert "users/search" in detail or "dh user lookup" in detail


def test_group_membership_does_not_expose_private_repos(client: TestClient, db: Session):
    owner = make_user(db, "owner@example.com")
    member = make_user(db, "member@example.com")
    group = make_group(db, owner, "secure-lab")
    make_membership(db, group, member, role="guest")
    private_repo = make_repo(db, owner, group, "private-data", visibility="private", discoverable=False)
    db.commit()
    set_user(client, member)

    hidden = client.get("/groups/secure-lab/repos")
    assert hidden.status_code == 200
    assert hidden.json()["items"] == []

    make_permission(db, private_repo, member, role="guest")
    db.commit()
    visible = client.get("/groups/secure-lab/repos")
    assert visible.status_code == 200
    assert [repo["repo_name"] for repo in visible.json()["items"]] == ["private-data"]


def test_group_repos_public_discoverable_filter(client: TestClient, db: Session):
    owner = make_user(db, "owner@example.com")
    stranger = make_user(db, "stranger@example.com")
    group = make_group(db, owner, "public-lab")
    make_repo(db, owner, group, "shown", visibility="public", discoverable=True)
    make_repo(db, owner, group, "hidden", visibility="fine_grained", discoverable=False)
    db.commit()
    set_user(client, stranger)

    response = client.get("/groups/public-lab/repos")
    assert response.status_code == 200
    body = response.json()
    assert [repo["repo_name"] for repo in body["items"]] == ["shown"]
    assert [repo["repo_name"] for repo in body["repos"]] == ["shown"]


def test_delete_non_empty_group_conflicts(client: TestClient, db: Session):
    owner = make_user(db, "owner@example.com")
    group = make_group(db, owner, "busy-lab")
    make_repo(db, owner, group, "dataset", visibility="private")
    db.commit()
    set_user(client, owner)

    response = client.delete("/groups/busy-lab")
    assert response.status_code == 409

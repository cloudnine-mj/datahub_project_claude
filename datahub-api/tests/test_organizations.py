"""Unit tests for _has_org_access() and list_organizations endpoint.

테스트 전략:
- SQLite in-memory DB로 실제 ORM 동작 검증 (mock 없음)
- 최소 FastAPI 앱(organizations 라우터만)으로 TestClient 사용
  → external storage 의존성 없이 실행 가능
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Base, Organization, Permission, Repo, User
from app.routers.organizations import _has_org_access, router as org_router

# SQLite에서 생성할 테이블만 지정 (JSONB 포함 테이블 제외)
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

# ── 최소 테스트 앱 ────────────────────────────────────────


def _make_test_app() -> FastAPI:
    test_app = FastAPI()
    test_app.include_router(org_router)
    return test_app


_test_app = _make_test_app()

# ── DB 픽스처 ────────────────────────────────────────────


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
    Base.metadata.drop_all(engine, tables=_SQLITE_TABLES)


# ── 공통 헬퍼 ────────────────────────────────────────────


def make_user(db: Session, email: str) -> User:
    user = User(email=email, is_active=True)
    db.add(user)
    db.flush()
    return user


def make_org(db: Session, owner: User, name: str, visibility: str = "private") -> Organization:
    org = Organization(group_name=name, owner_id=owner.id, visibility=visibility)
    db.add(org)
    db.flush()
    db.refresh(org)
    org.owner = owner
    return org


def make_repo(db: Session, owner: User, org: Organization | None, name: str) -> Repo:
    repo = Repo(repo_name=name, owner_id=owner.id, group_id=org.id if org else None, visibility="private")
    db.add(repo)
    db.flush()
    return repo


def make_permission(db: Session, repo: Repo, user: User, role: str = "contributor") -> Permission:
    perm = Permission(repo_name=repo.repo_name, user_id=user.id, role=role, granted_by=user.id)
    db.add(perm)
    db.flush()
    return perm


# ── _has_org_access 단위 테스트 ──────────────────────────


class TestHasOrgAccess:
    def test_public_org_always_accessible(self, db: Session):
        """public 조직은 누구나 접근 가능."""
        owner = make_user(db, "owner@example.com")
        stranger = make_user(db, "stranger@example.com")
        org = make_org(db, owner, "public-org", visibility="public")

        assert _has_org_access(db, org, stranger) is True

    def test_public_org_accessible_by_owner(self, db: Session):
        """public 조직 — owner도 접근 가능."""
        owner = make_user(db, "owner@example.com")
        org = make_org(db, owner, "public-org", visibility="public")

        assert _has_org_access(db, org, owner) is True

    def test_private_org_accessible_by_owner(self, db: Session):
        """private 조직 — owner는 접근 가능."""
        owner = make_user(db, "owner@example.com")
        org = make_org(db, owner, "private-org", visibility="private")

        assert _has_org_access(db, org, owner) is True

    def test_private_org_inaccessible_to_stranger(self, db: Session):
        """private 조직 — 권한 없는 사용자는 접근 불가."""
        owner = make_user(db, "owner@example.com")
        stranger = make_user(db, "stranger@example.com")
        org = make_org(db, owner, "private-org", visibility="private")

        assert _has_org_access(db, org, stranger) is False

    def test_private_org_accessible_via_repo_permission(self, db: Session):
        """private 조직 — 소속 repo에 permission 있으면 접근 가능."""
        owner = make_user(db, "owner@example.com")
        member = make_user(db, "member@example.com")
        org = make_org(db, owner, "private-org", visibility="private")
        repo = make_repo(db, owner, org, "repo-in-org")
        make_permission(db, repo, member, role="contributor")

        assert _has_org_access(db, org, member) is True

    def test_private_org_inaccessible_with_permission_on_other_org_repo(self, db: Session):
        """private 조직 — 다른 조직 repo의 permission은 접근 권한 부여 안 함."""
        owner = make_user(db, "owner@example.com")
        member = make_user(db, "member@example.com")

        org_a = make_org(db, owner, "org-a", visibility="private")
        org_b = make_org(db, owner, "org-b", visibility="private")

        repo_b = make_repo(db, owner, org_b, "repo-in-org-b")
        make_permission(db, repo_b, member, role="contributor")

        assert _has_org_access(db, org_a, member) is False

    def test_private_org_accessible_with_guest_role(self, db: Session):
        """private 조직 — guest role도 접근 허용."""
        owner = make_user(db, "owner@example.com")
        guest = make_user(db, "guest@example.com")
        org = make_org(db, owner, "private-org", visibility="private")
        repo = make_repo(db, owner, org, "repo-in-org")
        make_permission(db, repo, guest, role="guest")

        assert _has_org_access(db, org, guest) is True


# ── list_organizations 엔드포인트 테스트 ────────────────


@pytest.fixture
def client(db: Session):
    """TestClient — DB와 인증 의존성을 SQLite / 더미 유저로 교체."""
    current_user_holder: list[User] = []

    def override_get_db():
        yield db

    def override_get_current_user():
        return current_user_holder[0]

    _test_app.dependency_overrides[get_db] = override_get_db
    _test_app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(_test_app) as c:
        c._current_user_holder = current_user_holder  # type: ignore[attr-defined]
        yield c

    _test_app.dependency_overrides.clear()


class TestListOrganizations:
    def _set_user(self, client: TestClient, user: User):
        client._current_user_holder.clear()  # type: ignore[attr-defined]
        client._current_user_holder.append(user)  # type: ignore[attr-defined]

    def test_returns_public_orgs_to_all_users(self, client: TestClient, db: Session):
        """public 조직은 모든 사용자에게 반환."""
        owner = make_user(db, "owner@example.com")
        stranger = make_user(db, "stranger@example.com")
        make_org(db, owner, "public-org", visibility="public")
        db.commit()

        self._set_user(client, stranger)
        res = client.get("/organizations")
        assert res.status_code == 200
        names = [o["org_name"] for o in res.json()["orgs"]]
        assert "public-org" in names

    def test_excludes_private_org_from_non_members(self, client: TestClient, db: Session):
        """private 조직은 권한 없는 사용자에게 반환 안 함."""
        owner = make_user(db, "owner@example.com")
        stranger = make_user(db, "stranger@example.com")
        make_org(db, owner, "secret-org", visibility="private")
        db.commit()

        self._set_user(client, stranger)
        res = client.get("/organizations")
        assert res.status_code == 200
        names = [o["org_name"] for o in res.json()["orgs"]]
        assert "secret-org" not in names

    def test_returns_own_private_org_to_owner(self, client: TestClient, db: Session):
        """owner는 자신의 private 조직을 볼 수 있음."""
        owner = make_user(db, "owner@example.com")
        make_org(db, owner, "my-private-org", visibility="private")
        db.commit()

        self._set_user(client, owner)
        res = client.get("/organizations")
        assert res.status_code == 200
        names = [o["org_name"] for o in res.json()["orgs"]]
        assert "my-private-org" in names

    def test_returns_private_org_to_repo_member(self, client: TestClient, db: Session):
        """소속 repo permission이 있으면 private 조직 목록에 포함."""
        owner = make_user(db, "owner@example.com")
        member = make_user(db, "member@example.com")
        org = make_org(db, owner, "member-visible-org", visibility="private")
        repo = make_repo(db, owner, org, "member-repo")
        make_permission(db, repo, member, role="contributor")
        db.commit()

        self._set_user(client, member)
        res = client.get("/organizations")
        assert res.status_code == 200
        names = [o["org_name"] for o in res.json()["orgs"]]
        assert "member-visible-org" in names

    def test_search_filter(self, client: TestClient, db: Session):
        """search 파라미터로 org_name 부분 검색 동작."""
        owner = make_user(db, "owner@example.com")
        make_org(db, owner, "alpha-team", visibility="public")
        make_org(db, owner, "beta-squad", visibility="public")
        db.commit()

        self._set_user(client, owner)
        res = client.get("/organizations?search=alpha")
        assert res.status_code == 200
        names = [o["org_name"] for o in res.json()["orgs"]]
        assert "alpha-team" in names
        assert "beta-squad" not in names

    def test_pagination_size(self, client: TestClient, db: Session):
        """페이지네이션 — size=2이면 2개만 반환."""
        owner = make_user(db, "owner@example.com")
        for i in range(5):
            make_org(db, owner, f"org-{i}", visibility="public")
        db.commit()

        self._set_user(client, owner)
        res = client.get("/organizations?size=2&page=1")
        assert res.status_code == 200
        body = res.json()
        assert len(body["orgs"]) == 2
        assert body["total"] == 5
        assert body["size"] == 2

    def test_pagination_second_page(self, client: TestClient, db: Session):
        """2페이지 — 나머지 항목 반환."""
        owner = make_user(db, "owner@example.com")
        for i in range(3):
            make_org(db, owner, f"paged-org-{i}", visibility="public")
        db.commit()

        self._set_user(client, owner)
        res = client.get("/organizations?size=2&page=2")
        assert res.status_code == 200
        body = res.json()
        assert len(body["orgs"]) == 1

    def test_response_schema(self, client: TestClient, db: Session):
        """응답 스키마 필드 확인 — orgs, total, page, size."""
        owner = make_user(db, "owner@example.com")
        make_org(db, owner, "schema-test-org", visibility="public")
        db.commit()

        self._set_user(client, owner)
        res = client.get("/organizations")
        assert res.status_code == 200
        body = res.json()
        assert "orgs" in body
        assert "total" in body
        assert "page" in body
        assert "size" in body
        org = body["orgs"][0]
        assert "org_name" in org
        assert "owner" in org
        assert "visibility" in org

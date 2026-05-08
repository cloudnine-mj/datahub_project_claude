"""Tests for repo schema extension (Issue #91).

검증 대상:
1. CreateRepoRequest — 신규 필드 파싱 (description, repo_type, group, ai_card, ai_metadata)
2. RepoInfo — 신규 필드 포함 직렬화 (description, repo_type, member_count, last_commit)
3. GET /meta/licenses, /meta/tasks, /meta/languages, /meta/frameworks — 200 + 목록 반환
4. GET /users/search?q= — 빈 쿼리 빈 목록, 매칭 사용자 반환
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
from app.models import Base, User
from app.routers.meta import router as meta_router
from app.routers.users import router as users_router
from app.schemas.repos import CreateRepoRequest, LastCommitInfo, RepoInfo

# ── SQLite 테이블 선택 (JSONB 없는 것만) ───────────────────────────────────────

_SQLITE_TABLES = [
    Base.metadata.tables[t]
    for t in ("users", "repos", "permissions")
]

# ── 최소 테스트 앱 ────────────────────────────────────────────────────────────


def _make_test_app(db_session: Session) -> tuple[FastAPI, TestClient]:
    test_app = FastAPI()
    test_app.include_router(meta_router)
    test_app.include_router(users_router)

    def _fake_user():
        return db_session.query(User).first()

    test_app.dependency_overrides[get_current_user] = _fake_user
    test_app.dependency_overrides[get_db] = lambda: db_session
    return test_app, TestClient(test_app)


# ── DB 픽스처 ─────────────────────────────────────────────────────────────────


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

    # 기본 사용자 생성
    u = User(email="test@lgresearch.ai", is_active=True)
    session.add(u)
    session.commit()

    yield session
    session.close()
    engine.dispose()


# ── Schema Tests ──────────────────────────────────────────────────────────────


class TestCreateRepoRequestSchema:
    def test_minimal(self):
        req = CreateRepoRequest(repo_name="my-repo")
        assert req.repo_name == "my-repo"
        assert req.description is None
        assert req.repo_type is None
        assert req.group is None
        assert req.ai_card is False
        assert req.ai_metadata is False

    def test_full_fields(self):
        req = CreateRepoRequest(
            repo_name="ds-001",
            description="Test dataset",
            repo_type="A",
            group="data-governance",
            ai_card=True,
            ai_metadata=False,
        )
        assert req.repo_type == "A"
        assert req.ai_card is True
        assert req.description == "Test dataset"

    def test_repo_type_b(self):
        req = CreateRepoRequest(repo_name="model-001", repo_type="B")
        assert req.repo_type == "B"

    def test_invalid_repo_type_rejected(self):
        import pytest as pt
        with pt.raises(Exception):
            CreateRepoRequest(repo_name="x", repo_type="C")


class TestRepoInfoSchema:
    def test_new_fields_serialized(self):
        from datetime import datetime

        commit = LastCommitInfo(hash="abc123", message="init", author="user@a.com", created_at=1700000000)
        info = RepoInfo(
            repo_name="ds-001",
            owner="owner@a.com",
            role="owner",
            visibility="public",
            description="My dataset",
            repo_type="A",
            member_count=3,
            last_commit=commit,
            created_at=datetime(2026, 1, 1),
        )
        d = info.model_dump()
        assert d["description"] == "My dataset"
        assert d["repo_type"] == "A"
        assert d["member_count"] == 3
        assert d["last_commit"]["hash"] == "abc123"

    def test_optional_fields_default_to_none(self):
        from datetime import datetime

        info = RepoInfo(
            repo_name="ds-002",
            owner="owner@a.com",
            role="guest",
            visibility="private",
            created_at=datetime(2026, 1, 1),
        )
        assert info.description is None
        assert info.repo_type is None
        assert info.member_count == 0
        assert info.last_commit is None


# ── Meta Endpoint Tests ───────────────────────────────────────────────────────


class TestMetaEndpoints:
    def test_licenses_returns_list(self, db):
        _, client = _make_test_app(db)
        resp = client.get("/meta/licenses")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert all("id" in item and "name" in item for item in data)

    def test_tasks_returns_list(self, db):
        _, client = _make_test_app(db)
        resp = client.get("/meta/tasks")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) > 0

    def test_languages_returns_list(self, db):
        _, client = _make_test_app(db)
        resp = client.get("/meta/languages")
        assert resp.status_code == 200
        data = resp.json()
        assert any(item["id"] == "ko" for item in data)

    def test_frameworks_returns_list(self, db):
        _, client = _make_test_app(db)
        resp = client.get("/meta/frameworks")
        assert resp.status_code == 200
        data = resp.json()
        assert any(item["id"] == "pytorch" for item in data)


# ── Users Search Tests ────────────────────────────────────────────────────────


class TestUsersSearch:
    def test_empty_query_returns_empty(self, db):
        _, client = _make_test_app(db)
        resp = client.get("/users/search?q=")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_matching_query_returns_user(self, db):
        _, client = _make_test_app(db)
        resp = client.get("/users/search?q=lgresearch")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["email"] == "test@lgresearch.ai"
        assert "name" in data[0]

    def test_no_match_returns_empty(self, db):
        _, client = _make_test_app(db)
        resp = client.get("/users/search?q=nonexistent")
        assert resp.status_code == 200
        assert resp.json() == []

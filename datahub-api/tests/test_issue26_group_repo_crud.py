"""Issue #26 — create_repo group support + get/delete composite key unit tests.

엔드포인트 함수 직접 호출 + monkeypatch 패턴 (test_issue84_auth.py 준수).
alias 라우트 위임 검증은 TestClient 사용 (test_issue24_group_scoped_aliases.py 준수).
"""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.services.audit as audit_module
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Organization, Repo
from app.routers import repos as repos_mod
from app.services.repo_identity import RESERVED_REPO_NAMES, validate_repo_segment

GROUP = "myorg"
REPO = "myrepo"
GROUP_REPO = f"{GROUP}/{REPO}"
NEW_RESERVED_REPO_SEGMENTS = (
    "auth",
    "login",
    "logout",
    "whoami",
    "create",
    "list",
    "delete",
    "members",
    "metadata",
    "lineage",
    "search",
    "stats",
    "token",
)


def _mock_user():
    u = MagicMock()
    u.id = 1
    u.email = "tester@lgresearch.ai"
    return u


def _mock_request():
    r = MagicMock()
    r.client.host = "127.0.0.1"
    return r


def _patch_audit(monkeypatch):
    monkeypatch.setattr(audit_module.AuditService, "log", lambda self, *a, **kw: None)


def _make_app():
    """의존성 override된 미니 FastAPI 앱.

    require_scope 가 RBAC 1차 게이트로 db.query(Repo) 를 호출하므로 mock db
    가 owner repo 를 반환하도록 setup. 본 테스트는 alias 라우팅 위임 검증이
    목적이라 require_scope 자체는 owner-scoped path 로 통과시켜 무시한다.
    """
    mini = FastAPI()
    user = _mock_user()

    fake_repo = SimpleNamespace(
        repo_name=GROUP_REPO,
        owner_id=1,
        visibility="public",
        allow_anonymous_download=True,
    )
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = fake_repo
    mock_db.query.return_value.join.return_value.filter.return_value.first.return_value = fake_repo

    mini.dependency_overrides[get_current_user] = lambda: user
    mini.dependency_overrides[get_db] = lambda: mock_db
    mini.include_router(repos_mod.router, prefix="/api/v1")
    return mini


# ── create_repo + group ───────────────────────────────────────────────────────


def test_reserved_repo_names_match_governance_canonical():
    assert RESERVED_REPO_NAMES == frozenset(
        {
            "admin",
            "api",
            "health",
            "metrics",
            "static",
            "docs",
            "www",
            "auth",
            "login",
            "logout",
            "whoami",
            "create",
            "list",
            "delete",
            "members",
            "metadata",
            "lineage",
            "search",
            "stats",
            "token",
        }
    )


@pytest.mark.parametrize("reserved", NEW_RESERVED_REPO_SEGMENTS)
@pytest.mark.parametrize("label", ("owner", "repo"))
def test_new_reserved_segments_rejected_for_owner_and_repo(reserved, label):
    with pytest.raises(ValueError, match="reserved name"):
        validate_repo_segment(reserved, label)


class TestCreateRepoGroup:
    def _patch_provisioning(self, monkeypatch, bucket="datahub-test-myrepo"):
        monkeypatch.setattr(
            repos_mod._provisioning,
            "provision_repo",
            lambda name, gcs_key=None, **_: bucket,
        )
        # P1.D fix: 사전 충돌 검사 stub
        monkeypatch.setattr(
            repos_mod._gcs, "bucket_exists",
            lambda gcs_key: (False, f"prefix-{gcs_key}"),
        )

    def _make_db(self, org=None, existing_repo=None):
        """org lookup 과 repo 중복 체크 side_effect 가 있는 mock DB."""
        mock_db = MagicMock()

        def query_side(model):
            m = MagicMock()
            if model is Repo:
                m.filter.return_value.first.return_value = existing_repo
            elif model is Organization:
                m.filter.return_value.first.return_value = org
            return m

        mock_db.query.side_effect = query_side
        return mock_db

    def test_create_repo_with_group_sets_group_id(self, monkeypatch):
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        _patch_audit(monkeypatch)
        self._patch_provisioning(monkeypatch)

        fake_org = SimpleNamespace(id=5, group_name=GROUP, owner_id=1)
        db = self._make_db(org=fake_org)
        added_repos = []
        db.add.side_effect = added_repos.append

        body = CreateRepoRequest(repo_name=REPO, group=GROUP)
        create_repo(body, _mock_request(), _mock_user(), db)

        # Repo + RepoPublicAccessPolicy 두 row 가 추가됨 (governance §Backend Persistence)
        repo_rows = [r for r in added_repos if type(r).__name__ == "Repo"]
        assert len(repo_rows) == 1
        assert repo_rows[0].group_id == 5
        policy_rows = [r for r in added_repos if type(r).__name__ == "RepoPublicAccessPolicy"]
        assert len(policy_rows) == 1

    def test_create_repo_with_unknown_group_raises_404(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        _patch_audit(monkeypatch)
        provision = MagicMock()
        monkeypatch.setattr(repos_mod._provisioning, "provision_repo", provision)

        db = self._make_db(org=None)  # org not found

        body = CreateRepoRequest(repo_name=REPO, group="nonexistent-org")
        with pytest.raises(HTTPException) as exc_info:
            create_repo(body, _mock_request(), _mock_user(), db)
        assert exc_info.value.status_code == 404
        provision.assert_not_called()

    def test_create_repo_invalid_owner_format_raises_400_before_provisioning(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        provision = MagicMock()
        monkeypatch.setattr(repos_mod._provisioning, "provision_repo", provision)

        body = CreateRepoRequest(repo_name=REPO, group="Bad_Owner")
        with pytest.raises(HTTPException) as exc_info:
            create_repo(body, _mock_request(), _mock_user(), MagicMock())

        assert exc_info.value.status_code == 400
        provision.assert_not_called()

    @pytest.mark.parametrize("reserved", NEW_RESERVED_REPO_SEGMENTS)
    def test_create_repo_reserved_owner_raises_400_before_provisioning(self, monkeypatch, reserved):
        from fastapi import HTTPException
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        provision = MagicMock()
        monkeypatch.setattr(repos_mod._provisioning, "provision_repo", provision)

        body = CreateRepoRequest(repo_name=REPO, group=reserved)
        with pytest.raises(HTTPException) as exc_info:
            create_repo(body, _mock_request(), _mock_user(), MagicMock())

        assert exc_info.value.status_code == 400
        provision.assert_not_called()

    @pytest.mark.parametrize("reserved", NEW_RESERVED_REPO_SEGMENTS)
    def test_create_repo_reserved_repo_raises_400_before_provisioning(self, monkeypatch, reserved):
        from fastapi import HTTPException
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        provision = MagicMock()
        monkeypatch.setattr(repos_mod._provisioning, "provision_repo", provision)

        body = CreateRepoRequest(repo_name=reserved, group=GROUP)
        with pytest.raises(HTTPException) as exc_info:
            create_repo(body, _mock_request(), _mock_user(), MagicMock())

        assert exc_info.value.status_code == 400
        provision.assert_not_called()

    def test_create_repo_duplicate_owner_repo_raises_409_before_provisioning(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        fake_org = SimpleNamespace(id=5, group_name=GROUP, owner_id=1)
        existing_repo = SimpleNamespace(repo_name=REPO, group_id=5)
        db = self._make_db(org=fake_org, existing_repo=existing_repo)
        provision = MagicMock()
        monkeypatch.setattr(repos_mod._provisioning, "provision_repo", provision)

        body = CreateRepoRequest(repo_name=REPO, group=GROUP)
        with pytest.raises(HTTPException) as exc_info:
            create_repo(body, _mock_request(), _mock_user(), db)

        assert exc_info.value.status_code == 409
        provision.assert_not_called()

    def test_create_repo_without_group_group_id_is_none(self, monkeypatch):
        """group 없으면 group_id 설정 안 함."""
        from app.routers.repos import create_repo
        from app.schemas.repos import CreateRepoRequest

        _patch_audit(monkeypatch)
        self._patch_provisioning(monkeypatch)

        db = self._make_db()
        added_repos = []
        db.add.side_effect = added_repos.append

        body = CreateRepoRequest(repo_name=REPO)
        create_repo(body, _mock_request(), _mock_user(), db)

        repo_rows = [r for r in added_repos if type(r).__name__ == "Repo"]
        assert len(repo_rows) == 1
        assert repo_rows[0].group_id is None


# ── get_repo composite key ────────────────────────────────────────────────────


class TestGetRepoCompositeKey:
    def _make_fake_repo(self):
        r = SimpleNamespace(
            repo_name=REPO,
            owner_id=1,
            visibility="private",
            description="test",
            repo_type=None,
            created_at=datetime(2026, 1, 1),
            organization=SimpleNamespace(group_name=GROUP),
            owner=SimpleNamespace(email="tester@lgresearch.ai"),
        )
        return r

    def _make_db(self, fake_repo):
        from app.models import Permission, Repo

        db = MagicMock()
        repo_chain = MagicMock()
        repo_chain.join.return_value.filter.return_value.first.return_value = fake_repo
        repo_chain.filter.return_value.first.return_value = fake_repo
        perm_chain = MagicMock()
        perm_chain.filter.return_value.first.return_value = None
        perm_chain.filter.return_value.count.return_value = 0

        def _query(model):
            if model is Repo:
                return repo_chain
            if model is Permission:
                return perm_chain
            return MagicMock()

        db.query.side_effect = _query
        return db

    def test_get_repo_composite_key_200(self, monkeypatch):
        from app.routers.repos import get_repo

        fake_repo = self._make_fake_repo()
        db = self._make_db(fake_repo)

        result = get_repo(GROUP_REPO, _mock_user(), db)
        assert result.repo_name == REPO

    def test_get_repo_composite_key_404(self):
        from fastapi import HTTPException
        from app.routers.repos import get_repo

        db = MagicMock()
        # JOIN query returns None → 404
        db.query.return_value.join.return_value.filter.return_value.first.return_value = None
        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            get_repo(GROUP_REPO, _mock_user(), db)
        assert exc_info.value.status_code == 404


# ── delete_repo composite key ─────────────────────────────────────────────────


class TestDeleteRepoCompositeKey:
    def test_delete_repo_composite_key_200(self, monkeypatch):
        from app.routers.repos import delete_repo

        fake_repo = MagicMock()
        fake_repo.owner_id = 1
        fake_repo.repo_name = REPO
        fake_repo.bucket_name = None

        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = 0

        monkeypatch.setattr(repos_mod, "get_repo_by_name", lambda _db, repo_name: fake_repo)
        monkeypatch.setattr(repos_mod._provisioning, "deprovision_repo", lambda repo_name, gcs_key=None: None)
        _patch_audit(monkeypatch)

        result = delete_repo(GROUP_REPO, _mock_request(), _mock_user(), db)
        assert result["status"] == "deleted"

    def test_delete_repo_composite_key_404(self, monkeypatch):
        from fastapi import HTTPException
        from app.routers.repos import delete_repo

        db = MagicMock()
        monkeypatch.setattr(repos_mod, "get_repo_by_name", lambda _db, repo_name: None)

        with pytest.raises(HTTPException) as exc_info:
            delete_repo(GROUP_REPO, _mock_request(), _mock_user(), db)
        assert exc_info.value.status_code == 404


# ── group alias routes ────────────────────────────────────────────────────────


class TestRepoGroupAliases:
    def test_get_repo_group_alias_delegates_composite_key(self, monkeypatch):
        from app.schemas.repos import RepoInfo

        captured: dict = {}

        def fake_get(repo_name, user, db):
            captured["repo_name"] = repo_name
            return RepoInfo(
                repo_name=REPO,
                owner="tester@lgresearch.ai",
                role="owner",
                visibility="private",
                description="",
                repo_type=None,
                member_count=0,
                created_at=datetime(2026, 1, 1),
                group=GROUP,
            )

        monkeypatch.setattr(repos_mod, "get_repo", fake_get)
        client = TestClient(_make_app())

        resp = client.get(f"/api/v1/repos/{GROUP}/{REPO}")
        assert resp.status_code == 200
        assert captured["repo_name"] == GROUP_REPO

    def test_delete_repo_group_alias_delegates_composite_key(self, monkeypatch):
        captured: dict = {}

        def fake_delete(repo_name, request, user, db):
            captured["repo_name"] = repo_name
            return {"status": "deleted", "repo_name": repo_name}

        monkeypatch.setattr(repos_mod, "delete_repo", fake_delete)
        client = TestClient(_make_app())

        resp = client.delete(f"/api/v1/repos/{GROUP}/{REPO}")
        assert resp.status_code == 200
        assert captured["repo_name"] == GROUP_REPO

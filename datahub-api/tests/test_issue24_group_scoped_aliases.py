"""datahub-api #24: group-scoped alias 라우트 → flat handler 위임 검증.

TestClient를 통해 /repos/{group}/{repo_name}/... URL이 올바르게 라우팅되고,
flat handler를 composite repo key("{group}/{repo_name}")로 위임하는지 확인한다.

대상 라우터:
  - permissions.py: grant, revoke, list
  - files.py: ls compatibility alias
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.dependencies import get_current_user
from app.routers import files as files_mod
from app.routers import permissions as perm_mod

GROUP = "myorg"
REPO = "myrepo"
GROUP_REPO = f"{GROUP}/{REPO}"


def _mock_user():
    u = MagicMock()
    u.id = 1
    u.email = "tester@example.com"
    return u


def _make_app(*routers):
    """의존성 override된 미니 FastAPI 앱.

    require_scope 가 RBAC 1차 게이트로 db.query(Repo).first() 를 호출하므로
    mock db 가 'tester' 가 owner 인 repo 를 반환하도록 setup. 본 테스트는
    alias 라우팅 위임 검증이 목적이라 require_scope 자체는 owner-scoped path 로
    통과시켜 무시한다.
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
    for router in routers:
        mini.include_router(router, prefix="/api/v1")
    return mini


class TestPermissionsGroupAliases:
    """permissions group-scoped alias → flat handler composite key 위임."""

    def test_grant_permission_group_delegates_composite_key(self, monkeypatch):
        captured: dict = {}

        def fake(repo, body, request, user, db):
            captured["repo"] = repo
            return {"status": "granted", "email": body.email, "role": body.role}

        monkeypatch.setattr(perm_mod, "grant_permission", fake)
        client = TestClient(_make_app(perm_mod.router))

        resp = client.put(
            f"/api/v1/repos/{GROUP}/{REPO}/permissions",
            json={"email": "dev@example.com", "role": "contributor"},
        )

        assert resp.status_code == 200
        assert captured["repo"] == GROUP_REPO

    def test_revoke_permission_group_delegates_composite_key(self, monkeypatch):
        captured: dict = {}

        def fake(repo, email, request, user, db):
            captured["repo"] = repo
            return {"status": "revoked", "email": email}

        monkeypatch.setattr(perm_mod, "revoke_permission", fake)
        client = TestClient(_make_app(perm_mod.router))

        resp = client.delete(
            f"/api/v1/repos/{GROUP}/{REPO}/permissions/dev@example.com"
        )

        assert resp.status_code == 200
        assert captured["repo"] == GROUP_REPO

    def test_list_permissions_group_delegates_composite_key(self, monkeypatch):
        captured: dict = {}

        def fake(repo, user, db):
            captured["repo"] = repo
            return {"permissions": []}

        monkeypatch.setattr(perm_mod, "list_permissions", fake)
        client = TestClient(_make_app(perm_mod.router))

        resp = client.get(f"/api/v1/repos/{GROUP}/{REPO}/permissions")

        assert resp.status_code == 200
        assert captured["repo"] == GROUP_REPO


# ══════════════════════════════════════════════════════════════════════════════
# files.py ls alias
# ══════════════════════════════════════════════════════════════════════════════


class TestFilesLsGroupAlias:
    """files.py owner/repo ls compatibility alias → flat handler composite key 위임."""

    def test_ls_group_delegates_composite_key(self, monkeypatch):
        captured: dict = {}

        def fake(repo, prefix, recursive, amount, after, user, db):
            captured["repo"] = repo
            return {"items": [], "has_more": False, "next_offset": None}

        monkeypatch.setattr(files_mod, "ls_legacy", fake)
        client = TestClient(_make_app(files_mod.router))

        resp = client.get(f"/api/v1/repos/{GROUP}/{REPO}/ls")

        assert resp.status_code == 200
        assert captured["repo"] == GROUP_REPO

"""PATCH /repos/{repo_name}/visibility 단위 테스트.

governance:
  docs/dev_docs/api-specs/repository-api-spec.md §Visibility update
  docs/dev_docs/product-specs/repository-visibility-policy.md
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.routers.repos as repos_mod
from app.routers.repos import update_visibility
from app.schemas.repos import PublicAccess, UpdateVisibilityRequest


def _mock_user():
    return SimpleNamespace(id=1, email="tester@lgresearch.ai")


def _mock_request():
    req = MagicMock()
    req.client = SimpleNamespace(host="127.0.0.1")
    return req


def _make_repo_with_policy(version: int = 1):
    """ORM 흉내 — repo + public_access_policy 둘 다 갖는 객체."""
    policy = SimpleNamespace(
        repo_name="ner",
        discoverable=True,
        metadata_read=True,
        file_list=True,
        file_read=True,
        lineage_read=True,
        stats_read=True,
        version=version,
        updated_at=None,
    )
    repo = SimpleNamespace(
        repo_name="ner",
        owner_id=1,
        visibility="public",
        public_access_policy=policy,
    )
    return repo, policy


def _patch_admin(monkeypatch, repo):
    monkeypatch.setattr(repos_mod, "require_admin", lambda db, user, name: repo)


def _patch_audit(monkeypatch):
    monkeypatch.setattr(repos_mod.audit, "log", lambda *a, **kw: None)


def _make_db():
    db = MagicMock()
    return db


def test_public_to_private_normalizes_and_bumps_version(monkeypatch):
    repo, policy = _make_repo_with_policy(version=1)
    _patch_admin(monkeypatch, repo)
    _patch_audit(monkeypatch)
    db = _make_db()

    body = UpdateVisibilityRequest(visibility="private", version=1)
    result = update_visibility("ner", body, _mock_request(), _mock_user(), db)

    assert result["visibility"] == "private"
    assert result["version"] == 2
    assert all(not v for v in result["public_access"].values())
    assert policy.discoverable is False and policy.file_read is False


def test_fine_grained_requires_public_access(monkeypatch):
    repo, _ = _make_repo_with_policy()
    _patch_admin(monkeypatch, repo)
    _patch_audit(monkeypatch)

    body = UpdateVisibilityRequest(visibility="fine_grained", version=1)
    with pytest.raises(HTTPException) as exc:
        update_visibility("ner", body, _mock_request(), _mock_user(), _make_db())
    assert exc.value.status_code == 400
    assert "public_access" in exc.value.detail


def test_fine_grained_with_capabilities(monkeypatch):
    repo, policy = _make_repo_with_policy(version=3)
    _patch_admin(monkeypatch, repo)
    _patch_audit(monkeypatch)

    pa = PublicAccess(
        discoverable=True,
        metadata_read=True,
        file_list=False,
        file_read=False,
        lineage_read=True,
        stats_read=False,
    )
    body = UpdateVisibilityRequest(visibility="fine_grained", public_access=pa, version=3)
    result = update_visibility("ner", body, _mock_request(), _mock_user(), _make_db())

    assert result["visibility"] == "fine_grained"
    assert result["version"] == 4
    assert policy.metadata_read is True and policy.file_list is False


def test_dependency_violation_400(monkeypatch):
    repo, _ = _make_repo_with_policy()
    _patch_admin(monkeypatch, repo)
    _patch_audit(monkeypatch)

    # file_read=true 인데 file_list=false → dependency 위반
    pa = PublicAccess(
        discoverable=True,
        metadata_read=True,
        file_list=False,
        file_read=True,
        lineage_read=False,
        stats_read=False,
    )
    body = UpdateVisibilityRequest(visibility="fine_grained", public_access=pa, version=1)
    with pytest.raises(HTTPException) as exc:
        update_visibility("ner", body, _mock_request(), _mock_user(), _make_db())
    assert exc.value.status_code == 400
    assert "file_read" in exc.value.detail


def test_version_mismatch_409(monkeypatch):
    repo, _ = _make_repo_with_policy(version=5)
    _patch_admin(monkeypatch, repo)
    _patch_audit(monkeypatch)

    body = UpdateVisibilityRequest(visibility="private", version=4)
    with pytest.raises(HTTPException) as exc:
        update_visibility("ner", body, _mock_request(), _mock_user(), _make_db())
    assert exc.value.status_code == 409
    assert "version" in exc.value.detail.lower()


def test_normalize_all_true_to_public(monkeypatch):
    repo, policy = _make_repo_with_policy(version=1)
    repo.visibility = "fine_grained"
    _patch_admin(monkeypatch, repo)
    _patch_audit(monkeypatch)

    pa = PublicAccess()  # default 모두 True
    body = UpdateVisibilityRequest(visibility="fine_grained", public_access=pa, version=1)
    result = update_visibility("ner", body, _mock_request(), _mock_user(), _make_db())

    # 모두 true 면 자동 normalize → public
    assert result["visibility"] == "public"


def test_invalid_visibility_value(monkeypatch):
    repo, _ = _make_repo_with_policy()
    _patch_admin(monkeypatch, repo)
    _patch_audit(monkeypatch)

    # Pydantic 이 schema 레벨에서 거절 — UpdateVisibilityRequest 생성 자체가 실패
    with pytest.raises(Exception):
        UpdateVisibilityRequest(visibility="bogus", version=1)

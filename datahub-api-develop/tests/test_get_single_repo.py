"""GET /repos/{repo_name} 단건 조회 유닛 테스트 (datahub#26 / MR !35).

엔드포인트 함수 직접 호출 + monkeypatch 패턴 (test_issue84_auth.py 준수).
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException


# ── 공통 헬퍼 ────────────────────────────────────────────────────

_NOW = datetime(2026, 4, 23, 0, 0, 0, tzinfo=timezone.utc)


def _mock_user(user_id: int = 1, email: str = "tester@lgresearch.ai"):
    u = MagicMock()
    u.id = user_id
    u.email = email
    return u


def _mock_repo(
    repo_name: str,
    owner_id: int = 1,
    visibility: str = "public",
    description: str = "test repo",
    repo_type: str = "A",
    owner_email: str = "owner@lgresearch.ai",
):
    r = MagicMock()
    r.repo_name = repo_name
    r.owner_id = owner_id
    r.visibility = visibility
    r.description = description
    r.repo_type = repo_type
    r.created_at = _NOW
    r.owner = MagicMock()
    r.owner.email = owner_email
    r.organization = None
    return r


def _mock_perm(role: str = "viewer"):
    p = MagicMock()
    p.role = role
    return p


def _make_db(repo=None, perm=None, member_count: int = 1):
    """DB mock — query(Repo) → repo, query(Permission) → perm / count."""
    db = MagicMock()

    def _query(model):
        from app.models import Permission, Repo

        if model is Repo:
            q = MagicMock()
            q.filter.return_value.first.return_value = repo
            return q
        if model is Permission:
            q = MagicMock()
            q.filter.return_value.first.return_value = perm
            q.filter.return_value.count.return_value = member_count
            return q
        return MagicMock()

    db.query.side_effect = _query
    return db


def _patch_lakefs(monkeypatch, commits=None, raise_exc=False):
    from app.routers import repos as repos_mod

    if raise_exc:
        def _fail(*a, **kw):
            raise RuntimeError("lakefs down")
        monkeypatch.setattr(repos_mod._lakefs, "get_commit_log", _fail)
    else:
        monkeypatch.setattr(
            repos_mod._lakefs,
            "get_commit_log",
            lambda *a, **kw: commits if commits is not None else [],
        )


def _patch_capability(monkeypatch, repo=None, raises_status=None):
    """require_capability + resolve_role 을 정확히 시뮬 — 라우터 내부 분기 격리."""
    from app.routers import repos as repos_mod

    if raises_status is not None:
        def fake_cap(db, user, name, capability, min_member_role="guest"):
            raise HTTPException(status_code=raises_status, detail="denied")
        monkeypatch.setattr(repos_mod, "require_capability", fake_cap)
    else:
        monkeypatch.setattr(
            repos_mod, "require_capability",
            lambda db, user, name, capability, min_member_role="guest": repo,
        )


def _patch_role(monkeypatch, role):
    from app.routers import repos as repos_mod
    monkeypatch.setattr(repos_mod, "resolve_role", lambda db, user, repo: role)


# ── TestGetRepo ──────────────────────────────────────────────────

class TestGetRepo:

    def test_owner_gets_200_with_role_owner(self, monkeypatch):
        """소유자 → 200 + role=owner."""
        user = _mock_user(user_id=1)
        repo = _mock_repo("my-repo", owner_id=1, visibility="private")
        db = _make_db(repo=repo, perm=None, member_count=2)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role="owner")
        _patch_lakefs(monkeypatch)

        from app.routers.repos import get_repo
        result = get_repo("my-repo", user=user, db=db)

        assert result.repo_name == "my-repo"
        assert result.role == "owner"
        assert result.visibility == "private"
        assert result.member_count == 2

    def test_public_repo_accessible_without_permission(self, monkeypatch):
        """권한 없는 사용자도 public 레포 조회 가능 → role=normal."""
        user = _mock_user(user_id=99)
        repo = _mock_repo("pub-repo", owner_id=1, visibility="public")
        db = _make_db(repo=repo, perm=None, member_count=1)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role=None)  # 비멤버
        _patch_lakefs(monkeypatch)

        from app.routers.repos import get_repo
        result = get_repo("pub-repo", user=user, db=db)

        assert result.repo_name == "pub-repo"
        assert result.role == "normal"

    def test_has_perm_returns_permission_role(self, monkeypatch):
        """Permission 있는 사용자 → perm.role 반환."""
        user = _mock_user(user_id=5)
        repo = _mock_repo("collab-repo", owner_id=1, visibility="private")
        perm = _mock_perm(role="developer")
        db = _make_db(repo=repo, perm=perm, member_count=3)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role="developer")
        _patch_lakefs(monkeypatch)

        from app.routers.repos import get_repo
        result = get_repo("collab-repo", user=user, db=db)

        assert result.role == "developer"

    def test_nonexistent_repo_raises_404(self, monkeypatch):
        """존재하지 않는 repo → 404."""
        user = _mock_user()
        db = _make_db(repo=None)
        _patch_capability(monkeypatch, raises_status=404)
        _patch_lakefs(monkeypatch)

        from app.routers.repos import get_repo
        with pytest.raises(HTTPException) as exc:
            get_repo("ghost-repo", user=user, db=db)
        assert exc.value.status_code == 404

    def test_private_repo_no_access_raises_404(self, monkeypatch):
        """private repo + 권한 없는 사용자 → 404 (governance: discoverable=false)."""
        user = _mock_user(user_id=99)
        repo = _mock_repo("secret-repo", owner_id=1, visibility="private")
        db = _make_db(repo=repo, perm=None, member_count=0)
        _patch_capability(monkeypatch, raises_status=404)
        _patch_lakefs(monkeypatch)

        from app.routers.repos import get_repo
        with pytest.raises(HTTPException) as exc:
            get_repo("secret-repo", user=user, db=db)
        assert exc.value.status_code == 404

    def test_is_public_path(self, monkeypatch):
        """public visibility 응답 그대로."""
        user = _mock_user(user_id=7)
        repo = _mock_repo("open-repo", owner_id=3, visibility="public")
        db = _make_db(repo=repo, perm=None)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role=None)
        _patch_lakefs(monkeypatch)

        from app.routers.repos import get_repo
        result = get_repo("open-repo", user=user, db=db)

        assert result.visibility == "public"

    def test_lakefs_error_returns_last_commit_none(self, monkeypatch):
        """LakeFS 오류 시 last_commit=None으로 정상 응답."""
        user = _mock_user(user_id=1)
        repo = _mock_repo("my-repo", owner_id=1)
        db = _make_db(repo=repo)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role="owner")
        _patch_lakefs(monkeypatch, raise_exc=True)

        from app.routers.repos import get_repo
        result = get_repo("my-repo", user=user, db=db)

        assert result.last_commit is None

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
    r.updated_at = None
    r.bucket_name = "bucket-my-repo"
    r.public_access_policy = None
    r.owner = MagicMock()
    r.owner.email = owner_email
    r.organization = None
    return r


def _policy(**overrides):
    values = {
        "discoverable": True,
        "metadata_read": True,
        "file_list": True,
        "file_read": True,
        "lineage_read": True,
        "stats_read": True,
        "version": 1,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


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


@pytest.fixture(autouse=True)
def _disable_storage_stats(monkeypatch):
    from app.routers import repos as repos_mod

    monkeypatch.setattr(repos_mod, "_repo_info_storage_stats", lambda repo: (None, None))
    monkeypatch.setattr(repos_mod, "_repo_storage_updated_at", lambda repo: None)


# ── TestGetRepo ──────────────────────────────────────────────────

class TestGetRepo:

    def test_owner_gets_200_with_role_owner(self, monkeypatch):
        """소유자 → 200 + role=owner."""
        user = _mock_user(user_id=1)
        repo = _mock_repo("my-repo", owner_id=1, visibility="private")
        db = _make_db(repo=repo, perm=None, member_count=2)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role="owner")

        from app.routers.repos import get_repo
        result = get_repo("my-repo", user=user, db=db)

        assert result.repo_name == "my-repo"
        assert result.role == "owner"
        assert result.visibility == "private"
        assert result.member_count == 2

    def test_owner_gets_stats_fields_when_available(self, monkeypatch):
        from app.routers import repos as repos_mod

        user = _mock_user(user_id=1)
        repo = _mock_repo("my-repo", owner_id=1, visibility="private")
        repo.updated_at = datetime(2026, 5, 10, 1, 2, 3, tzinfo=timezone.utc)
        db = _make_db(repo=repo, perm=None, member_count=2)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role="owner")
        monkeypatch.setattr(repos_mod, "_repo_info_storage_stats", lambda repo: (3, 2048))

        from app.routers.repos import get_repo
        result = get_repo("my-repo", user=user, db=db)

        assert result.updated_at == repo.updated_at
        assert result.file_count == 3
        assert result.total_size_bytes == 2048

    def test_owner_gets_storage_updated_at_fallback(self, monkeypatch):
        from app.routers import repos as repos_mod

        user = _mock_user(user_id=1)
        repo = _mock_repo("my-repo", owner_id=1, visibility="private")
        storage_updated_at = datetime(2026, 5, 10, 2, 3, 4, tzinfo=timezone.utc)
        db = _make_db(repo=repo, perm=None, member_count=2)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role="owner")
        monkeypatch.setattr(repos_mod, "_repo_info_storage_stats", lambda repo: (1, 15))
        monkeypatch.setattr(repos_mod, "_repo_storage_updated_at", lambda repo: storage_updated_at)

        from app.routers.repos import get_repo
        result = get_repo("my-repo", user=user, db=db)

        assert result.updated_at == storage_updated_at
        assert result.file_count == 1
        assert result.total_size_bytes == 15

    def test_public_repo_accessible_without_permission(self, monkeypatch):
        """권한 없는 사용자도 public 레포 조회 가능 → role=normal."""
        user = _mock_user(user_id=99)
        repo = _mock_repo("pub-repo", owner_id=1, visibility="public")
        db = _make_db(repo=repo, perm=None, member_count=1)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role=None)  # 비멤버

        from app.routers.repos import get_repo
        result = get_repo("pub-repo", user=user, db=db)

        assert result.repo_name == "pub-repo"
        assert result.role == "normal"

    def test_nonmember_without_stats_read_gets_nullable_stats(self, monkeypatch):
        from app.routers import repos as repos_mod

        user = _mock_user(user_id=99)
        repo = _mock_repo("pub-repo", owner_id=1, visibility="fine_grained")
        repo.public_access_policy = _policy(stats_read=False)
        db = _make_db(repo=repo, perm=None, member_count=1)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role=None)
        storage_stats = MagicMock(return_value=(3, 2048))
        monkeypatch.setattr(repos_mod, "_repo_info_storage_stats", storage_stats)

        from app.routers.repos import get_repo
        result = get_repo("pub-repo", user=user, db=db)

        assert result.role == "normal"
        assert result.file_count is None
        assert result.total_size_bytes is None
        storage_stats.assert_not_called()

    def test_has_perm_returns_permission_role(self, monkeypatch):
        """Permission 있는 사용자 → perm.role 반환."""
        user = _mock_user(user_id=5)
        repo = _mock_repo("collab-repo", owner_id=1, visibility="private")
        perm = _mock_perm(role="contributor")
        db = _make_db(repo=repo, perm=perm, member_count=3)
        _patch_capability(monkeypatch, repo=repo)
        _patch_role(monkeypatch, role="contributor")

        from app.routers.repos import get_repo
        result = get_repo("collab-repo", user=user, db=db)

        assert result.role == "contributor"

    def test_nonexistent_repo_raises_404(self, monkeypatch):
        """존재하지 않는 repo → 404."""
        user = _mock_user()
        db = _make_db(repo=None)
        _patch_capability(monkeypatch, raises_status=404)

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

        from app.routers.repos import get_repo
        result = get_repo("open-repo", user=user, db=db)

        assert result.visibility == "public"

"""Rename API tests (governance §repo-identity-spec).

PATCH /repos/{group}/{repo}/name + PATCH /groups/{group}/slug.
slug rename invariant — id / bucket / 종속 FK 무변, audit row 영구 보존.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException


def _mock_request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={}, state=SimpleNamespace())


def _mock_user(uid: int = 1, email: str = "owner@example.com"):
    return SimpleNamespace(id=uid, email=email)


# ── repo rename ────────────────────────────────────────────


class TestRenameRepo:
    def test_rename_updates_repo_name_only(self, monkeypatch):
        """slug rename → repo_name 변경, uuid / bucket_name 무변, audit row 1개 추가."""
        from app.routers import repos as repos_mod
        from app.schemas.repos import RenameRepoRequest

        fake_repo = MagicMock()
        fake_repo.uuid = "01928f7c-1234-7abc-89de-fedcba012345"
        fake_repo.group_uuid = "01928f6b-1111-7abc-89de-fedcba000001"
        fake_repo.repo_name = "old-name"
        fake_repo.bucket_name = "lgair-dgdh-dev-r-deadbeef"
        fake_repo.owner_id = 1
        # require_admin 패치 — repo 반환
        monkeypatch.setattr(repos_mod, "require_admin", lambda *a, **kw: fake_repo)
        monkeypatch.setattr(repos_mod.audit, "log", lambda *a, **kw: None)

        db = MagicMock()
        # group 내 unique 체크 → 충돌 없음 (None 반환)
        db.query.return_value.filter.return_value.first.return_value = None

        added = []
        db.add.side_effect = added.append

        body = RenameRepoRequest(new_name="new-name", reason="ux update")
        res = repos_mod.rename_repo(
            "lab-foo", "old-name", body, _mock_request(), _mock_user(), db
        )

        # 응답 검증
        assert res.repo_id == fake_repo.uuid
        assert res.repo_name == "new-name"
        assert res.new_path == "lab-foo/new-name"
        assert res.old_path == "lab-foo/old-name"
        # rename audit row 추가됨
        rename_rows = [r for r in added if type(r).__name__ == "RepoRename"]
        assert len(rename_rows) == 1
        assert rename_rows[0].old_name == "old-name"
        assert rename_rows[0].new_name == "new-name"
        assert rename_rows[0].repo_uuid == fake_repo.uuid
        # repo_name 변경됨, uuid + bucket 무변
        assert fake_repo.repo_name == "new-name"
        assert fake_repo.uuid == "01928f7c-1234-7abc-89de-fedcba012345"
        assert fake_repo.bucket_name == "lgair-dgdh-dev-r-deadbeef"

    def test_rename_to_same_name_rejected(self, monkeypatch):
        from app.routers import repos as repos_mod
        from app.schemas.repos import RenameRepoRequest

        fake_repo = MagicMock()
        fake_repo.repo_name = "same"
        monkeypatch.setattr(repos_mod, "require_admin", lambda *a, **kw: fake_repo)

        with pytest.raises(HTTPException) as exc:
            repos_mod.rename_repo(
                "g", "same", RenameRepoRequest(new_name="same"),
                _mock_request(), _mock_user(), MagicMock(),
            )
        assert exc.value.status_code == 400
        assert "differ" in str(exc.value.detail).lower()

    def test_rename_collision_returns_409(self, monkeypatch):
        from app.routers import repos as repos_mod
        from app.schemas.repos import RenameRepoRequest

        fake_repo = MagicMock()
        fake_repo.repo_name = "old"
        monkeypatch.setattr(repos_mod, "require_admin", lambda *a, **kw: fake_repo)

        db = MagicMock()
        # collision: 같은 이름 repo 존재
        existing = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = existing

        with pytest.raises(HTTPException) as exc:
            repos_mod.rename_repo(
                "g", "old", RenameRepoRequest(new_name="taken"),
                _mock_request(), _mock_user(), db,
            )
        assert exc.value.status_code == 409
        assert "already exists" in str(exc.value.detail)

    def test_rename_invalid_segment_returns_400(self, monkeypatch):
        from app.routers import repos as repos_mod
        from app.schemas.repos import RenameRepoRequest

        fake_repo = MagicMock()
        fake_repo.repo_name = "old"
        monkeypatch.setattr(repos_mod, "require_admin", lambda *a, **kw: fake_repo)

        with pytest.raises(HTTPException) as exc:
            repos_mod.rename_repo(
                "g", "old", RenameRepoRequest(new_name="INVALID NAME"),
                _mock_request(), _mock_user(), MagicMock(),
            )
        assert exc.value.status_code == 400


# ── group rename ───────────────────────────────────────────


class TestRenameGroup:
    def test_rename_updates_group_name_only(self, monkeypatch):
        from app.routers import groups as groups_mod
        from app.schemas.groups import RenameGroupRequest

        fake_org = MagicMock()
        fake_org.uuid = "01928f6b-1111-7abc-89de-fedcba000001"
        fake_org.id = 5
        fake_org.group_name = "old-slug"
        fake_org.owner_id = 1

        monkeypatch.setattr(groups_mod, "_get_group_or_404", lambda db, g: fake_org)
        monkeypatch.setattr(groups_mod, "_require_group_owner", lambda db, o, u: None)
        monkeypatch.setattr(groups_mod, "_personal_namespace_exists", lambda db, name: False)
        monkeypatch.setattr(groups_mod.audit, "log", lambda *a, **kw: None)

        db = MagicMock()
        # Organization unique → None (no collision). Repo count → 3.
        from app.models import Organization, Repo

        def query_side(model):
            m = MagicMock()
            if model is Organization:
                m.filter.return_value.first.return_value = None
            elif model is Repo:
                m.filter.return_value.count.return_value = 3
            return m
        db.query.side_effect = query_side
        added = []
        db.add.side_effect = added.append

        body = RenameGroupRequest(new_slug="new-slug")
        res = groups_mod.rename_group(
            "old-slug", body, _mock_request(), _mock_user(), db,
        )

        assert res.group_id == fake_org.uuid
        assert res.new_slug == "new-slug"
        assert res.old_slug == "old-slug"
        assert res.affected_repo_count == 3
        # audit row
        rename_rows = [r for r in added if type(r).__name__ == "GroupRename"]
        assert len(rename_rows) == 1
        assert rename_rows[0].old_slug == "old-slug"
        assert rename_rows[0].new_slug == "new-slug"
        assert rename_rows[0].group_uuid == fake_org.uuid

    def test_rename_to_same_slug_rejected(self, monkeypatch):
        from app.routers import groups as groups_mod
        from app.schemas.groups import RenameGroupRequest

        fake_org = MagicMock()
        fake_org.group_name = "same"
        monkeypatch.setattr(groups_mod, "_get_group_or_404", lambda db, g: fake_org)
        monkeypatch.setattr(groups_mod, "_require_group_owner", lambda db, o, u: None)

        with pytest.raises(HTTPException) as exc:
            groups_mod.rename_group(
                "same", RenameGroupRequest(new_slug="same"),
                _mock_request(), _mock_user(), MagicMock(),
            )
        assert exc.value.status_code == 400

    def test_rename_collision_returns_409(self, monkeypatch):
        from app.routers import groups as groups_mod
        from app.schemas.groups import RenameGroupRequest

        fake_org = MagicMock()
        fake_org.group_name = "old"
        monkeypatch.setattr(groups_mod, "_get_group_or_404", lambda db, g: fake_org)
        monkeypatch.setattr(groups_mod, "_require_group_owner", lambda db, o, u: None)
        monkeypatch.setattr(groups_mod, "_personal_namespace_exists", lambda db, name: False)

        db = MagicMock()
        existing = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = existing

        with pytest.raises(HTTPException) as exc:
            groups_mod.rename_group(
                "old", RenameGroupRequest(new_slug="taken"),
                _mock_request(), _mock_user(), db,
            )
        assert exc.value.status_code == 409

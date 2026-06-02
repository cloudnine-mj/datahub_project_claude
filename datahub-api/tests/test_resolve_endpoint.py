"""`_resolve` endpoint (governance §repo-identity-spec — rename redirect source)."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException


def _mock_user():
    return SimpleNamespace(id=1, email="user@example.com")


# ── group resolve ──────────────────────────────────────────


class TestResolveGroup:
    def test_canonical_group_returns_unredirected(self, monkeypatch):
        from app.routers import resolve as resolve_mod

        org = MagicMock(group_name="lab-foo", uuid="01928f6b-1111-7abc-89de-aaa", id=5)

        db = MagicMock()
        from app.models import Organization
        org_q = MagicMock()
        org_q.filter.return_value.first.return_value = org
        db.query.return_value = org_q

        res = resolve_mod.resolve_group("lab-foo", db, _mock_user())
        assert res.canonical_group == "lab-foo"
        assert res.group_id == "01928f6b-1111-7abc-89de-aaa"
        assert res.redirected is False
        assert res.chain == []
        assert res.canonical_repo is None

    def test_renamed_group_follows_chain(self, monkeypatch):
        from app.routers import resolve as resolve_mod
        from app.models import Organization, GroupRename

        new_org = MagicMock(group_name="lab-bar", uuid="org-uuid", id=5)
        old_rename = SimpleNamespace(old_slug="lab-foo", new_slug="lab-bar", renamed_at=None)

        # 컨테이너 패턴: persistent mocks 으로 multi-call 추적
        org_mock = MagicMock()
        org_mock.filter.return_value.first.side_effect = [None, new_org]
        rename_mock = MagicMock()
        rename_mock.filter.return_value.order_by.return_value.first.return_value = old_rename

        def query_side(model):
            if model is Organization:
                return org_mock
            if model is GroupRename:
                return rename_mock
            return MagicMock()

        db = MagicMock()
        db.query.side_effect = query_side

        res = resolve_mod.resolve_group("lab-foo", db, _mock_user())
        assert res.canonical_group == "lab-bar"
        assert res.redirected is True
        assert res.chain == [{"from": "lab-foo", "to": "lab-bar"}]

    def test_unknown_group_404(self):
        from app.routers import resolve as resolve_mod
        from app.models import Organization, GroupRename

        def query_side(model):
            m = MagicMock()
            if model is Organization:
                m.filter.return_value.first.return_value = None
            elif model is GroupRename:
                m.filter.return_value.order_by.return_value.first.return_value = None
            return m

        db = MagicMock()
        db.query.side_effect = query_side

        with pytest.raises(HTTPException) as exc:
            resolve_mod.resolve_group("never-existed", db, _mock_user())
        assert exc.value.status_code == 404


# ── repo resolve ───────────────────────────────────────────


class TestResolveRepo:
    def test_canonical_path_returns_unredirected(self):
        from app.routers import resolve as resolve_mod
        from app.models import Organization, Repo, RepoRename

        org = MagicMock(group_name="lab-foo", uuid="org-uuid", id=5)
        repo = MagicMock(repo_name="ner-v4", uuid="repo-uuid")

        def query_side(model):
            m = MagicMock()
            if model is Organization:
                m.filter.return_value.first.return_value = org
            elif model is Repo:
                m.filter.return_value.first.return_value = repo
            return m

        db = MagicMock()
        db.query.side_effect = query_side

        res = resolve_mod.resolve_repo("lab-foo", "ner-v4", db, _mock_user())
        assert res.canonical_group == "lab-foo"
        assert res.canonical_repo == "ner-v4"
        assert res.repo_id == "repo-uuid"
        assert res.group_id == "org-uuid"
        assert res.redirected is False
        assert res.chain == []

    def test_renamed_repo_follows_chain(self):
        from app.routers import resolve as resolve_mod
        from app.models import Organization, Repo, RepoRename

        org = MagicMock(group_name="lab-foo", uuid="org-uuid", id=5)
        new_repo = MagicMock(repo_name="ner-v5", uuid="repo-uuid")
        rename = SimpleNamespace(group_uuid="org-uuid", old_name="ner-v4", new_name="ner-v5", renamed_at=None)

        org_mock = MagicMock()
        org_mock.filter.return_value.first.return_value = org
        repo_mock = MagicMock()
        repo_mock.filter.return_value.first.side_effect = [None, new_repo]
        rename_mock = MagicMock()
        rename_mock.filter.return_value.order_by.return_value.first.return_value = rename

        def query_side(model):
            if model is Organization:
                return org_mock
            if model is Repo:
                return repo_mock
            if model is RepoRename:
                return rename_mock
            return MagicMock()

        db = MagicMock()
        db.query.side_effect = query_side

        res = resolve_mod.resolve_repo("lab-foo", "ner-v4", db, _mock_user())
        assert res.canonical_repo == "ner-v5"
        assert res.repo_id == "repo-uuid"
        assert res.redirected is True
        assert res.chain == [{"from": "ner-v4", "to": "ner-v5"}]

    def test_renamed_group_and_repo_chains_both(self):
        """group + repo 둘 다 rename 된 경우 → chain 2 entries."""
        from app.routers import resolve as resolve_mod
        from app.models import Organization, Repo, RepoRename, GroupRename

        new_org = MagicMock(group_name="lab-bar", uuid="org-uuid", id=5)
        new_repo = MagicMock(repo_name="ner-v5", uuid="repo-uuid")
        group_rename = SimpleNamespace(old_slug="lab-foo", new_slug="lab-bar", renamed_at=None)
        repo_rename = SimpleNamespace(group_uuid="org-uuid", old_name="ner-v4", new_name="ner-v5", renamed_at=None)

        org_mock = MagicMock()
        org_mock.filter.return_value.first.side_effect = [None, new_org]
        repo_mock = MagicMock()
        repo_mock.filter.return_value.first.side_effect = [None, new_repo]
        group_rename_mock = MagicMock()
        group_rename_mock.filter.return_value.order_by.return_value.first.return_value = group_rename
        repo_rename_mock = MagicMock()
        repo_rename_mock.filter.return_value.order_by.return_value.first.return_value = repo_rename

        def query_side(model):
            if model is Organization:
                return org_mock
            if model is Repo:
                return repo_mock
            if model is GroupRename:
                return group_rename_mock
            if model is RepoRename:
                return repo_rename_mock
            return MagicMock()

        db = MagicMock()
        db.query.side_effect = query_side

        res = resolve_mod.resolve_repo("lab-foo", "ner-v4", db, _mock_user())
        assert res.canonical_group == "lab-bar"
        assert res.canonical_repo == "ner-v5"
        assert res.redirected is True
        # group + repo rename 모두 chain
        assert res.chain == [
            {"from": "lab-foo", "to": "lab-bar"},
            {"from": "ner-v4", "to": "ner-v5"},
        ]

    def test_unknown_repo_404(self):
        from app.routers import resolve as resolve_mod
        from app.models import Organization, Repo, RepoRename

        org = MagicMock(group_name="lab-foo", uuid="org-uuid", id=5)

        def query_side(model):
            m = MagicMock()
            if model is Organization:
                m.filter.return_value.first.return_value = org
            elif model is Repo:
                m.filter.return_value.first.return_value = None
            elif model is RepoRename:
                m.filter.return_value.order_by.return_value.first.return_value = None
            return m

        db = MagicMock()
        db.query.side_effect = query_side

        with pytest.raises(HTTPException) as exc:
            resolve_mod.resolve_repo("lab-foo", "missing", db, _mock_user())
        assert exc.value.status_code == 404

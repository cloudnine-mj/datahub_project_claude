"""Issue #66 — group-scoped alias가 LakeFS에 composite key를 전달하던 버그 수정 검증.

versioning.py와 files.py의 flat handler들이 check_access()의 반환값(Repo 객체)에서
bare repo_name을 추출해 LakeFS API에 전달하는지 확인한다.

수정 전: _lakefs.some_call("org/repo", ...)  → LakeFS 400 Bad Request
수정 후: _lakefs.some_call("repo", ...)       → 정상 동작
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest


GROUP = "myorg"
REPO_NAME = "myrepo"
COMPOSITE = f"{GROUP}/{REPO_NAME}"


def _mock_repo(repo_name=REPO_NAME):
    r = MagicMock()
    r.repo_name = repo_name
    return r


def _mock_user():
    u = MagicMock()
    u.id = 1
    u.email = "tester@lgresearch.ai"
    return u


def _mock_request():
    r = MagicMock()
    r.client.host = "127.0.0.1"
    return r


def _patch_versioning(monkeypatch, repo_obj=None):
    """versioning.py check_access를 mock Repo 반환으로 패치."""
    if repo_obj is None:
        repo_obj = _mock_repo()
    monkeypatch.setattr("app.routers.versioning.check_access", lambda db, user, repo, min_role: repo_obj)
    import app.services.audit as audit_module
    monkeypatch.setattr(audit_module.AuditService, "log", lambda self, *a, **kw: None)


# ══════════════════════════════════════════════════════════════════════════════
# versioning.py — list_branches, diff_branches, create_branch, get_commit_log
# ══════════════════════════════════════════════════════════════════════════════

class TestVersioningBareNamePassedToLakeFS:
    """composite key로 호출해도 LakeFS에는 bare name이 전달된다."""

    def test_list_branches_uses_bare_name(self, monkeypatch):
        from app.routers.versioning import list_branches
        from app.routers import versioning as vmod

        _patch_versioning(monkeypatch)
        received: list[str] = []
        monkeypatch.setattr(vmod._lakefs, "list_branches", lambda repo: (received.append(repo) or []))

        list_branches(COMPOSITE, _mock_user(), MagicMock())

        assert received == [REPO_NAME], f"Expected bare '{REPO_NAME}', got {received}"

    def test_diff_branches_uses_bare_name(self, monkeypatch):
        from app.routers.versioning import diff_branches
        from app.routers import versioning as vmod

        _patch_versioning(monkeypatch)
        received: list[str] = []

        def _fake_diff(repo, source, target):
            received.append(repo)
            return []

        monkeypatch.setattr(vmod._lakefs, "diff_branch", _fake_diff)

        diff_branches(COMPOSITE, source="feature", target="main", user=_mock_user(), db=MagicMock())

        assert received == [REPO_NAME]

    def test_create_branch_uses_bare_name(self, monkeypatch):
        from app.routers.versioning import create_branch
        from app.routers import versioning as vmod
        from app.schemas.versioning import CreateBranchRequest

        _patch_versioning(monkeypatch)
        received: list[str] = []
        monkeypatch.setattr(vmod._lakefs, "create_branch", lambda repo, name, src: received.append(repo))

        create_branch(COMPOSITE, CreateBranchRequest(branch_name="feat", source="main"),
                      _mock_request(), _mock_user(), MagicMock())

        assert received == [REPO_NAME]

    def test_get_commit_log_uses_bare_name(self, monkeypatch):
        from app.routers.versioning import get_commit_log
        from app.routers import versioning as vmod

        _patch_versioning(monkeypatch)
        received: list[str] = []
        monkeypatch.setattr(vmod._lakefs, "get_commit_log", lambda repo, ref, amount=30: (received.append(repo) or []))

        get_commit_log(COMPOSITE, ref="main", amount=10, user=_mock_user(), db=MagicMock())

        assert received == [REPO_NAME]


# ══════════════════════════════════════════════════════════════════════════════
# files.py — ls 핸들러
# ══════════════════════════════════════════════════════════════════════════════

class TestFilesLsBareNamePassedToLakeFS:
    """ls handler가 composite key 대신 bare name을 LakeFS에 전달한다."""

    def test_ls_uses_bare_name(self, monkeypatch):
        from app.routers.files import ls
        from app.routers import files as fmod
        from types import SimpleNamespace

        def _fake_check_access(db, user, repo, min_role):
            return _mock_repo()
        monkeypatch.setattr("app.routers.files.check_access", _fake_check_access)

        # P1.C.2: ls 가 require_capability("file_list") 로 전환됨 — 동일 시뮬
        def _fake_capability(db, user, repo, capability, min_member_role="guest"):
            return _mock_repo()
        monkeypatch.setattr("app.routers.files.require_capability", _fake_capability)

        received: list[str] = []
        monkeypatch.setattr(
            fmod._lakefs, "list_objects",
            lambda repo, branch, **kw: (received.append(repo) or ([], False, None))
        )

        ls(COMPOSITE, branch="main", user=_mock_user(), db=MagicMock())

        assert received == [REPO_NAME], f"Expected bare '{REPO_NAME}', got {received}"

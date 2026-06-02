"""group-scoped path aliases for repos (governance §Repo identity).

`/repos/{owner}/{repo}` 분리 path 가 기존 `/repos/{owner/repo}` 와 동일 핸들러로
위임되는지 검증.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import app.routers.repos as repos_mod
from app.routers.repos import (
    delete_repo_group,
    get_repo_group,
    get_repo_stats_group,
    update_visibility_group,
)
from app.schemas.repos import UpdateVisibilityRequest


def _user():
    return SimpleNamespace(id=1, email="t@a.com")


def _request():
    req = MagicMock()
    req.client = SimpleNamespace(host="127.0.0.1")
    return req


def test_get_repo_group_delegates_to_composite(monkeypatch):
    captured: list[str] = []
    monkeypatch.setattr(
        repos_mod, "get_repo", lambda name, user, db: captured.append(name) or "ok",
    )
    result = get_repo_group("nlp-lab", "ner-v4", _user(), MagicMock())
    assert captured == ["nlp-lab/ner-v4"]
    assert result == "ok"


def test_delete_repo_group_delegates(monkeypatch):
    captured: list[str] = []
    monkeypatch.setattr(
        repos_mod, "delete_repo",
        lambda name, request, user, db: captured.append(name) or {"status": "deleted"},
    )
    result = delete_repo_group("lab-foo", "ds", _request(), _user(), MagicMock())
    assert captured == ["lab-foo/ds"]
    assert result["status"] == "deleted"


def test_update_visibility_group_delegates(monkeypatch):
    captured: list[str] = []
    monkeypatch.setattr(
        repos_mod, "update_visibility",
        lambda name, body, request, user, db: captured.append(name) or {"version": 2},
    )
    body = UpdateVisibilityRequest(visibility="private", version=1)
    result = update_visibility_group("lab-foo", "ds", body, _request(), _user(), MagicMock())
    assert captured == ["lab-foo/ds"]
    assert result["version"] == 2


def test_get_repo_stats_group_delegates(monkeypatch):
    captured: list[str] = []
    monkeypatch.setattr(
        repos_mod, "get_repo_stats",
        lambda name, user, db: captured.append(name) or "stats",
    )
    result = get_repo_stats_group("lab-foo", "ds", _user(), MagicMock())
    assert captured == ["lab-foo/ds"]
    assert result == "stats"

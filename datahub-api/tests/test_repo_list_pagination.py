from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.routers.repos import _paginate_repo_infos
from app.schemas.repos import RepoInfo


def _repo(name: str) -> RepoInfo:
    return RepoInfo(
        repo_name=name,
        owner="owner@example.com",
        role="owner",
        visibility="public",
        created_at=datetime(2026, 5, 9, tzinfo=timezone.utc),
    )


def test_repo_list_pagination_keeps_repos_alias():
    repos = [_repo("a"), _repo("b"), _repo("c")]

    first = _paginate_repo_infos(repos, limit=2, page_token=None)
    assert [repo.repo_name for repo in first.items] == ["a", "b"]
    assert [repo.repo_name for repo in first.repos] == ["a", "b"]
    assert first.has_more is True
    assert first.next_page_token

    second = _paginate_repo_infos(repos, limit=2, page_token=first.next_page_token)
    assert [repo.repo_name for repo in second.items] == ["c"]
    assert second.has_more is False
    assert second.next_page_token is None


def test_repo_list_invalid_page_token():
    with pytest.raises(HTTPException) as exc:
        _paginate_repo_infos([_repo("a")], limit=2, page_token="not-a-token")

    assert exc.value.status_code == 400

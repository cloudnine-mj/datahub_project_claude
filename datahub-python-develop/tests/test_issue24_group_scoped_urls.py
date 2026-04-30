"""datahub-python #24: group-scoped repo에서 ls/branches/merge/diff/permissions URL 검증.

client 함수들이 repo_name = "org/repo" 형태로 호출 시
올바른 group-scoped URL을 생성하는지 확인한다.

datahub-api MR !46 (group-scoped aliases) 와 함께 동작한다.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


def _make_client():
    from datahub.client import DataClient
    from datahub.config import AuthConfig, DataHubConfig

    cfg = DataHubConfig(auth=AuthConfig(endpoint="http://api-test:8000", api_key="test-key"))
    with patch("httpx.Client") as mock_http_cls:
        mock_http = MagicMock()
        mock_http_cls.return_value = mock_http

        session_resp = MagicMock()
        session_resp.json.return_value = {"email": "tester@example.com", "user_id": 1}
        mock_http.post.return_value = session_resp

        client = DataClient(cfg)
        client._http = mock_http
        return client, mock_http


def _ok(json_data: dict):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    return resp


class TestGroupScopedUrls:
    """repo_name = 'org/repo' 형태 → URL에 /org/repo/ 포함 확인."""

    ORG_REPO = "myorg/myrepo"

    def test_ls_uses_group_repo_path(self):
        client, http = _make_client()
        http.get.return_value = _ok({"items": [], "has_more": False, "next_offset": None})

        client.ls(self.ORG_REPO)

        url = http.get.call_args[0][0]
        assert "/repos/myorg/myrepo/ls" in url

    def test_list_branches_uses_group_repo_path(self):
        client, http = _make_client()
        http.get.return_value = _ok({"branches": []})

        client.list_branches(self.ORG_REPO)

        url = http.get.call_args[0][0]
        assert "/repos/myorg/myrepo/branches" in url

    def test_create_branch_uses_group_repo_path(self):
        client, http = _make_client()
        http.post.return_value = _ok({"status": "created", "branch": "feat"})

        client.create_branch(self.ORG_REPO, "feat", source="main")

        url = http.post.call_args[0][0]
        assert "/repos/myorg/myrepo/branches" in url

    def test_delete_branch_uses_group_repo_path(self):
        client, http = _make_client()
        http.delete.return_value = _ok({"status": "deleted"})

        client.delete_branch(self.ORG_REPO, "feat")

        url = http.delete.call_args[0][0]
        assert "/repos/myorg/myrepo/branches/feat" in url

    def test_commit_uses_group_repo_path(self):
        client, http = _make_client()
        http.post.return_value = _ok({"id": "abc123", "message": "msg", "committer": "x"})

        client.commit(self.ORG_REPO, "main", "msg")

        url = http.post.call_args[0][0]
        assert "/repos/myorg/myrepo/commits" in url

    def test_merge_uses_group_repo_path(self):
        client, http = _make_client()
        http.post.return_value = _ok({"status": "merged", "commit_id": "abc"})

        client.merge(self.ORG_REPO, "feature", into="main")

        url = http.post.call_args[0][0]
        assert "/repos/myorg/myrepo/merge" in url

    def test_diff_uses_group_repo_path(self):
        client, http = _make_client()
        http.get.return_value = _ok({"entries": [], "paths": []})

        client.diff(self.ORG_REPO, "feature", target="main")

        url = http.get.call_args[0][0]
        assert "/repos/myorg/myrepo/diff" in url

    def test_grant_access_uses_group_repo_path(self):
        client, http = _make_client()
        http.put.return_value = _ok({"status": "granted"})

        client.grant_access(self.ORG_REPO, "dev@example.com", role="developer")

        url = http.put.call_args[0][0]
        assert "/repos/myorg/myrepo/permissions" in url

    def test_revoke_access_uses_group_repo_path(self):
        client, http = _make_client()
        http.delete.return_value = _ok({"status": "revoked"})

        client.revoke_access(self.ORG_REPO, "dev@example.com")

        url = http.delete.call_args[0][0]
        assert "/repos/myorg/myrepo/permissions/dev@example.com" in url

    def test_list_permissions_uses_group_repo_path(self):
        client, http = _make_client()
        http.get.return_value = _ok({"permissions": []})

        client.list_permissions(self.ORG_REPO)

        url = http.get.call_args[0][0]
        assert "/repos/myorg/myrepo/permissions" in url


class TestFlatRepoUrlsUnchanged:
    """bare repo_name (슬래시 없음) → 기존 flat URL 유지."""

    BARE_REPO = "myrepo"

    def test_ls_bare_repo(self):
        client, http = _make_client()
        http.get.return_value = _ok({"items": [], "has_more": False, "next_offset": None})

        client.ls(self.BARE_REPO)

        url = http.get.call_args[0][0]
        assert "/repos/myrepo/ls" in url
        assert "/repos/myrepo/myrepo" not in url

    def test_list_branches_bare_repo(self):
        client, http = _make_client()
        http.get.return_value = _ok({"branches": []})

        client.list_branches(self.BARE_REPO)

        url = http.get.call_args[0][0]
        assert "/repos/myrepo/branches" in url

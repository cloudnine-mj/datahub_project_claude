"""E2E tests for repository management: create, list, delete."""

from __future__ import annotations

import httpx
import pytest

from tests.e2e.conftest import run_dh

pytestmark = pytest.mark.e2e


# ---------------------------------------------------------------------------
# repo create
# ---------------------------------------------------------------------------

class TestRepoCreate:
    """Tests for ``dh repo create``."""

    def test_create_success(self, unique_repo: str, api: httpx.Client) -> None:
        """``repo create`` should create a repo visible via the API."""
        code, out, _ = run_dh("repo", "create", unique_repo)
        assert code == 0
        assert unique_repo in out

        # Verify server-side state
        resp = api.get("/api/v1/repos")
        resp.raise_for_status()
        repo_names = [r["repo_name"] for r in resp.json()["repos"]]
        assert unique_repo in repo_names

    def test_create_duplicate_fails(self, unique_repo: str) -> None:
        """Creating the same repo twice should not silently succeed."""
        run_dh("repo", "create", unique_repo)
        code, out, err = run_dh("repo", "create", unique_repo, check=False)
        # The CLI prints a warning for duplicates ("already exists")
        combined = out + err
        assert "already exists" in combined.lower() or code != 0

    def test_create_invalid_name(self) -> None:
        """Repo names with invalid characters should be rejected."""
        code, out, err = run_dh("repo", "create", "INVALID NAME!", check=False)
        assert code != 0


# ---------------------------------------------------------------------------
# repo list
# ---------------------------------------------------------------------------

class TestRepoList:
    """Tests for ``dh repo list``."""

    def test_list_shows_created_repo(self, unique_repo: str) -> None:
        """A freshly created repo should appear in ``repo list``."""
        run_dh("repo", "create", unique_repo)
        code, out, _ = run_dh("repo", "list")
        assert code == 0
        assert unique_repo in out

    def test_list_returns_zero(self) -> None:
        """``repo list`` should always succeed (exit 0), even if empty."""
        code, _out, _ = run_dh("repo", "list")
        assert code == 0


# ---------------------------------------------------------------------------
# repo delete
# ---------------------------------------------------------------------------

class TestRepoDelete:
    """Tests for ``dh repo delete``."""

    def test_delete_own_repo(self, unique_repo: str, api: httpx.Client) -> None:
        """Deleting an owned repo should remove it from the API listing."""
        run_dh("repo", "create", unique_repo)
        code, _, _ = run_dh("repo", "delete", unique_repo, "-y")
        assert code == 0

        # Verify server-side state — repo should be gone
        resp = api.get("/api/v1/repos")
        resp.raise_for_status()
        repo_names = [r["repo_name"] for r in resp.json()["repos"]]
        assert unique_repo not in repo_names

    def test_delete_nonexistent_fails(self) -> None:
        """Deleting a repo that does not exist should fail."""
        code, _, _ = run_dh(
            "repo", "delete", "nonexistent-repo-xyz-99999", "-y", check=False
        )
        assert code != 0

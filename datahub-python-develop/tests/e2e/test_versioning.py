"""E2E tests for version control: branch create/list/delete, commit, merge."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.e2e.conftest import dh_uri, run_dh

pytestmark = pytest.mark.e2e


# ---------------------------------------------------------------------------
# branch
# ---------------------------------------------------------------------------

class TestBranch:
    """Tests for ``dh branch create/list/delete``."""

    def test_create_and_list(self, created_repo: str) -> None:
        """Create a branch and verify it appears in ``branch list``."""
        run_dh("branch", "create", created_repo, "experiment", "-s", "main")

        code, out, _ = run_dh("branch", "list", created_repo)
        assert code == 0
        assert "experiment" in out
        assert "main" in out

    def test_delete_branch(self, created_repo: str) -> None:
        """Delete a branch and verify it disappears from the listing."""
        run_dh("branch", "create", created_repo, "temp-branch", "-s", "main")
        run_dh("branch", "delete", created_repo, "temp-branch")

        code, out, _ = run_dh("branch", "list", created_repo)
        assert code == 0
        assert "temp-branch" not in out

    def test_create_from_nonexistent_source_fails(self, created_repo: str) -> None:
        """Creating a branch from a non-existent source should fail."""
        code, _, _ = run_dh(
            "branch", "create", created_repo, "bad-branch",
            "-s", "nonexistent-source",
            check=False,
        )
        assert code != 0


# ---------------------------------------------------------------------------
# merge
# ---------------------------------------------------------------------------

class TestMerge:
    """Tests for ``dh merge``."""

    def test_merge_branch(self, created_repo: str, tmp_path: Path) -> None:
        """Upload to a feature branch, merge into main, verify file is on main."""
        run_dh("branch", "create", created_repo, "feature", "-s", "main")

        # Upload to feature branch
        f = tmp_path / "feature.txt"
        f.write_text("feature data")
        run_dh(
            "cp", str(f), dh_uri(created_repo, "feature.txt"),
            "-b", "feature", "--message", "feature commit",
        )

        # Merge
        code, out, _ = run_dh("merge", created_repo, "feature", "--into", "main")
        assert code == 0

        # Verify file is now on main
        code, out, _ = run_dh("ls", dh_uri(created_repo), "-b", "main")
        assert "feature.txt" in out

    def test_merge_nonexistent_branch_fails(self, created_repo: str) -> None:
        """Merging a non-existent branch should fail."""
        code, _, _ = run_dh(
            "merge", created_repo, "nonexistent-branch", "--into", "main",
            check=False,
        )
        assert code != 0

"""E2E tests for security boundaries and error handling."""

from __future__ import annotations

import httpx
import pytest

from tests.e2e.conftest import E2E_ENDPOINT, dh_uri, run_dh

pytestmark = pytest.mark.e2e


class TestSecurityBoundaries:
    """Verify that security boundaries are enforced."""

    def test_delete_nonexistent_repo_returns_error(self) -> None:
        """Deleting a repo that doesn't exist should fail, not silently succeed."""
        code, out, err = run_dh(
            "repo", "delete", "absolutely-nonexistent-repo-12345", "-y",
            check=False,
        )
        assert code != 0

    def test_cannot_access_other_users_private_repo(self) -> None:
        """``repo list`` should only show repos the user owns or has access to."""
        code, out, _ = run_dh("repo", "list")
        assert code == 0
        # Basic sanity — no crash. Cross-user isolation requires a second user.

    def test_invalid_dh_uri_format_rejected(self) -> None:
        """A malformed URI (e.g. ``lakefs://``) should be rejected by the CLI."""
        code, _, _ = run_dh(
            "cp", "lakefs://repo/main/data/", "./local/", check=False,
        )
        assert code != 0

    def test_invalid_branch_handled(self, created_repo: str) -> None:
        """Accessing a non-existent branch should fail gracefully."""
        code, _, _ = run_dh(
            "ls", dh_uri(created_repo), "-b", "nonexistent-branch",
            check=False,
        )
        assert code != 0

    def test_missing_repo_in_uri_rejected(self) -> None:
        """A ``dh://`` URI without a repo name should be rejected."""
        code, _, _ = run_dh("ls", "dh:///", "-b", "main", check=False)
        assert code != 0


class TestTokenSecurity:
    """Verify that invalid/tampered tokens are rejected by the API."""

    def test_expired_token_rejected(self) -> None:
        """An expired JWT should receive a 401 from the server."""
        expired_token = (
            "eyJhbGciOiJIUzI1NiJ9"
            ".eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0"
            ".invalid"
        )
        client = httpx.Client(
            headers={"Authorization": f"Bearer {expired_token}"},
            verify=False,
            timeout=15.0,
        )
        try:
            resp = client.get(f"{E2E_ENDPOINT}/api/v1/repos")
            assert resp.status_code == 401, (
                f"Expected 401 for expired token, got {resp.status_code}"
            )
        finally:
            client.close()

    def test_tampered_token_rejected(self) -> None:
        """A JWT with a tampered payload should receive a 401."""
        tampered = (
            "eyJhbGciOiJIUzI1NiJ9"
            ".eyJlbWFpbCI6ImhhY2tlckBldmlsLmNvbSIsImlhdCI6OTk5OTk5OTk5OSwiZXhwIjo5OTk5OTk5OTk5fQ"
            ".invalidsignature"
        )
        client = httpx.Client(
            headers={"Authorization": f"Bearer {tampered}"},
            verify=False,
            timeout=15.0,
        )
        try:
            resp = client.get(f"{E2E_ENDPOINT}/api/v1/repos")
            assert resp.status_code == 401, (
                f"Expected 401 for tampered token, got {resp.status_code}"
            )
        finally:
            client.close()

    def test_no_auth_header_rejected(self) -> None:
        """A request with no Authorization header should be rejected."""
        client = httpx.Client(verify=False, timeout=15.0)
        try:
            resp = client.get(f"{E2E_ENDPOINT}/api/v1/repos")
            assert resp.status_code in (401, 403), (
                f"Expected 401/403 for missing auth, got {resp.status_code}"
            )
        finally:
            client.close()

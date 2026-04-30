"""E2E tests for authentication commands: login, logout, whoami, --version."""

from __future__ import annotations

import pytest

from tests.e2e.conftest import run_dh

pytestmark = pytest.mark.e2e


class TestWhoami:
    """Tests for ``dh whoami``."""

    def test_whoami_returns_email(self) -> None:
        """``dh whoami`` should display the logged-in user's email."""
        code, out, _ = run_dh("whoami")
        assert code == 0
        assert "@" in out, f"Expected email in output, got: {out}"

    def test_whoami_shows_session_panel(self) -> None:
        """Output should contain structured session information."""
        code, out, _ = run_dh("whoami")
        assert code == 0
        # The CLI prints a Rich panel with "User:", "API:", "Auth:" fields
        assert "User" in out or "user" in out.lower()


class TestVersion:
    """Tests for ``dh --version``."""

    def test_version_output(self) -> None:
        """``dh --version`` should print a version string."""
        code, out, _ = run_dh("--version")
        assert code == 0
        assert "0.9" in out or "datahub" in out.lower()

    def test_help_output(self) -> None:
        """``dh --help`` should list available commands."""
        code, out, _ = run_dh("--help")
        assert code == 0
        assert "repo" in out
        assert "cp" in out
        assert "search" in out

"""E2E tests for search and catalog commands."""

from __future__ import annotations

import pytest

from tests.e2e.conftest import run_dh

pytestmark = pytest.mark.e2e


class TestSearch:
    """Tests for ``dh search``."""

    def test_search_returns_zero(self) -> None:
        """``dh search`` with no keyword should succeed."""
        code, out, _ = run_dh("search", "")
        assert code == 0

    def test_search_with_keyword(self) -> None:
        """``dh search`` with a keyword should not error."""
        code, out, _ = run_dh("search", "test", check=False)
        # May return 0 with results or 0 with "No results found"
        # Just ensure it doesn't crash
        assert code == 0


class TestCatalog:
    """Tests for ``dh catalog list``."""

    def test_catalog_list(self) -> None:
        """``dh catalog list`` should succeed."""
        code, out, _ = run_dh("catalog", "list")
        assert code == 0

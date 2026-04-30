"""E2E tests for data operations: cp (upload/download), ls, cat."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.e2e.conftest import dh_uri, run_dh

pytestmark = pytest.mark.e2e


# ---------------------------------------------------------------------------
# Upload (local → dh://)
# ---------------------------------------------------------------------------

class TestUpload:
    """Tests for ``dh cp <local> dh://...``."""

    def test_upload_single_file(self, created_repo: str, tmp_path: Path) -> None:
        """Upload a single file and verify it appears in ``ls``."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("hello datahub")

        code, out, _ = run_dh(
            "cp", str(test_file), dh_uri(created_repo, "test.txt"),
            "-b", "main", "--message", "upload single file",
        )
        assert code == 0

        # Verify via ls
        code, out, _ = run_dh("ls", dh_uri(created_repo), "-b", "main")
        assert "test.txt" in out

    def test_upload_directory(self, created_repo: str, tmp_path: Path) -> None:
        """Upload a directory with multiple files."""
        (tmp_path / "a.txt").write_text("file a")
        (tmp_path / "b.csv").write_text("col1,col2\n1,2")

        code, out, _ = run_dh(
            "cp", str(tmp_path) + "/", dh_uri(created_repo),
            "-b", "main", "--message", "multi upload",
        )
        assert code == 0


# ---------------------------------------------------------------------------
# Download (dh:// → local)
# ---------------------------------------------------------------------------

class TestDownload:
    """Tests for ``dh cp dh://... <local>``."""

    def test_download_roundtrip(self, created_repo: str, tmp_path: Path) -> None:
        """Upload then download should produce identical file contents."""
        # Create and upload
        src = tmp_path / "src"
        src.mkdir()
        (src / "data.txt").write_text("roundtrip test data")
        run_dh(
            "cp", str(src) + "/", dh_uri(created_repo),
            "-b", "main", "--message", "roundtrip test",
        )

        # Download
        dst = tmp_path / "dst"
        dst.mkdir()
        code, _, _ = run_dh(
            "cp", dh_uri(created_repo), str(dst) + "/", "-b", "main",
        )
        assert code == 0

        # Compare
        downloaded = dst / "data.txt"
        assert downloaded.exists(), f"Expected data.txt in {dst}"
        assert downloaded.read_text() == "roundtrip test data"


# ---------------------------------------------------------------------------
# ls
# ---------------------------------------------------------------------------

class TestLs:
    """Tests for ``dh ls``."""

    def test_ls_empty_repo(self, created_repo: str) -> None:
        """``ls`` on a newly created repo should succeed without error."""
        code, out, _ = run_dh("ls", dh_uri(created_repo), "-b", "main")
        assert code == 0

    def test_ls_shows_files(self, created_repo: str, tmp_path: Path) -> None:
        """``ls`` should list uploaded files."""
        test_file = tmp_path / "visible.txt"
        test_file.write_text("I should appear in ls")
        run_dh(
            "cp", str(test_file), dh_uri(created_repo, "visible.txt"),
            "-b", "main", "--message", "ls test",
        )

        code, out, _ = run_dh("ls", dh_uri(created_repo), "-b", "main")
        assert code == 0
        assert "visible.txt" in out


# ---------------------------------------------------------------------------
# cat
# ---------------------------------------------------------------------------

class TestCat:
    """Tests for ``dh cat``."""

    def test_cat_file_content(self, created_repo: str, tmp_path: Path) -> None:
        """``cat`` should output the file content to stdout."""
        test_file = tmp_path / "hello.txt"
        test_file.write_text("hello world content")
        run_dh(
            "cp", str(test_file), dh_uri(created_repo, "hello.txt"),
            "-b", "main", "--message", "cat test",
        )

        code, out, _ = run_dh("cat", dh_uri(created_repo, "hello.txt"), "-b", "main")
        assert code == 0
        assert "hello world content" in out

    def test_cat_nonexistent_fails(self, created_repo: str) -> None:
        """``cat`` on a non-existent file should fail."""
        code, _, _ = run_dh(
            "cat", dh_uri(created_repo, "nope.txt"), "-b", "main", check=False,
        )
        assert code != 0

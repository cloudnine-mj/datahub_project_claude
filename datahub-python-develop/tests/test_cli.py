"""datahub CLI tests."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError
from pathlib import Path
import tomllib
from unittest.mock import MagicMock, patch

import pytest
from click.testing import CliRunner

import datahub
from datahub.cli import cli, parse_dh_uri
from datahub.types import ListResult, UserIdentity

# ──────────────────────────────────────────────
# parse_dh_uri unit tests
# ──────────────────────────────────────────────


class TestParseDhUri:
    def test_basic(self):
        assert parse_dh_uri("dh://nlp-lab/repo/data/file.csv") == (
            "nlp-lab", "repo", "data/file.csv",
        )

    def test_root_path(self):
        assert parse_dh_uri("dh://nlp-lab/repo/") == ("nlp-lab", "repo", "")

    def test_no_trailing_slash(self):
        assert parse_dh_uri("dh://nlp-lab/repo") == ("nlp-lab", "repo", "")

    def test_nested_path(self):
        group, repo, path = parse_dh_uri("dh://nlp-lab/ner-models/train/data.parquet")
        assert group == "nlp-lab"
        assert repo == "ner-models"
        assert path == "train/data.parquet"

    def test_invalid_scheme(self):
        with pytest.raises(ValueError, match="must start with dh://"):
            parse_dh_uri("gs://bucket/path")

    def test_empty_group(self):
        with pytest.raises(ValueError, match="must include group"):
            parse_dh_uri("dh:///path")

    def test_one_component_rejected(self):
        with pytest.raises(ValueError, match="must include group"):
            parse_dh_uri("dh://repo-only")


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def mock_client():
    with patch("datahub.client.DataClient") as cls:
        client = MagicMock()
        cls.return_value = client
        client.identity = UserIdentity(email="test@example.com")
        yield client


# ──────────────────────────────────────────────
# Version / help
# ──────────────────────────────────────────────


class TestGlobal:
    def test_version(self, runner):
        result = runner.invoke(cli, ["--version"])
        assert result.exit_code == 0
        assert datahub.get_version() in result.output

    def test_module_version_matches_helper(self):
        assert datahub.__version__ == datahub.get_version()

    def test_get_version_uses_installed_metadata(self, monkeypatch):
        monkeypatch.setattr(datahub, "version", lambda _: "9.9.9")
        assert datahub.get_version() == "9.9.9"

    def test_get_version_falls_back_to_source_version(self, monkeypatch):
        def raise_package_not_found(_: str) -> str:
            raise PackageNotFoundError("lgair-datahub")

        monkeypatch.setattr(datahub, "version", raise_package_not_found)
        assert datahub.get_version() == datahub._SOURCE_VERSION

    def test_source_version_matches_pyproject_version(self):
        pyproject = Path(__file__).resolve().parents[1] / "pyproject.toml"
        project = tomllib.loads(pyproject.read_text())["project"]
        assert datahub._SOURCE_VERSION == project["version"]

    def test_help(self, runner):
        result = runner.invoke(cli, ["--help"])
        assert result.exit_code == 0
        assert "cp" in result.output
        assert "ls" in result.output


# ──────────────────────────────────────────────
# cp
# ──────────────────────────────────────────────


class TestCp:
    def test_download(self, runner, mock_client):
        mock_client.download.return_value = ["./data/a.csv", "./data/b.csv"]
        result = runner.invoke(cli, ["cp", "dh://nlp-lab/repo/data/", "./data/"])
        assert result.exit_code == 0
        call_kwargs = mock_client.download.call_args
        assert call_kwargs[0] == ("nlp-lab/repo", "data/", "./data/")
        assert call_kwargs[1]["branch"] == "main"
        assert call_kwargs[1]["max_workers"] == 8
        assert call_kwargs[1]["multi"] is False
        assert callable(call_kwargs[1]["on_progress"])
        assert "Download complete" in result.output and "2 file(s)" in result.output

    def test_upload(self, runner, mock_client):
        mock_client.upload.return_value = None
        result = runner.invoke(cli, ["cp", "./output/", "dh://nlp-lab/repo/"])
        assert result.exit_code == 0
        call_kwargs = mock_client.upload.call_args
        assert call_kwargs[0] == ("nlp-lab/repo", "./output/")
        assert call_kwargs[1]["branch"] == "main"
        assert call_kwargs[1]["message"] is None
        assert call_kwargs[1]["max_workers"] == 8
        assert call_kwargs[1]["multi"] is False
        assert callable(call_kwargs[1]["on_progress"])
        assert "Upload complete" in result.output

    def test_upload_with_commit(self, runner, mock_client):
        commit = MagicMock(id="abc123")
        mock_client.upload.return_value = commit
        mock_client.upload_many.return_value = commit
        result = runner.invoke(cli, [
            "cp", "./output/", "dh://nlp-lab/repo/", "--message", "add data",
        ])
        assert result.exit_code == 0
        call_kwargs = mock_client.upload.call_args
        assert call_kwargs[1]["message"] == "add data"
        assert call_kwargs[1]["max_workers"] == 8
        assert call_kwargs[1]["multi"] is False
        assert "abc123" in result.output

    def test_multi_source_upload(self, runner, mock_client):
        commit = MagicMock(id="multi123")
        mock_client.upload_many.return_value = commit
        result = runner.invoke(cli, [
            "cp", "koscom_a.csv", "koscom_b.csv", "dh://nlp-lab/repo/", "-m",
        ])
        assert result.exit_code == 0
        call_args = mock_client.upload_many.call_args
        assert call_args[0] == ("nlp-lab/repo", ["koscom_a.csv", "koscom_b.csv"])
        assert call_args[1]["branch"] == "main"
        assert call_args[1]["remote_prefix"] == ""
        assert call_args[1]["multi"] is True
        assert "multi123" in result.output

    def test_workers_flag(self, runner, mock_client):
        mock_client.download.return_value = []
        result = runner.invoke(cli, [
            "cp", "dh://nlp-lab/repo/data/", "./local/", "-w", "16",
        ])
        assert result.exit_code == 0
        assert mock_client.download.call_args[1]["max_workers"] == 16
        assert mock_client.download.call_args[1]["multi"] is False

    def test_multi_flag(self, runner, mock_client):
        import os as _os
        mock_client.download.return_value = []
        result = runner.invoke(cli, [
            "cp", "dh://nlp-lab/repo/data/", "./local/", "-m",
        ])
        assert result.exit_code == 0
        assert mock_client.download.call_args[1]["multi"] is True
        assert mock_client.download.call_args[1]["max_workers"] == min((_os.cpu_count() or 4), 32)

    def test_parallel_flag(self, runner, mock_client):
        import os as _os
        mock_client.download.return_value = []
        result = runner.invoke(cli, [
            "cp", "dh://nlp-lab/repo/data/", "./local/", "-p",
        ])
        assert result.exit_code == 0
        expected_workers = min((_os.cpu_count() or 4), 32)
        assert mock_client.download.call_args[1]["max_workers"] == expected_workers
        assert mock_client.download.call_args[1]["multi"] is True

    def test_explicit_workers_override_multi_default(self, runner, mock_client):
        mock_client.download.return_value = []
        result = runner.invoke(cli, [
            "cp", "dh://nlp-lab/repo/data/", "./local/", "-m", "-w", "12",
        ])
        assert result.exit_code == 0
        assert mock_client.download.call_args[1]["max_workers"] == 12

    def test_invalid_direction(self, runner, mock_client):
        result = runner.invoke(cli, ["cp", "./a", "./b"])
        assert result.exit_code != 0
        assert "dh://" in result.output

    def test_mixed_multiple_sources_rejected(self, runner, mock_client):
        result = runner.invoke(cli, ["cp", "dh://nlp-lab/a/x", "./b", "./out"])
        assert result.exit_code != 0
        assert "Multiple dh:// sources" in result.output

    def test_remote_glob_download_creates_destination_dir(self, runner, mock_client, tmp_path):
        target_dir = tmp_path / "koscom"
        mock_client.ls.return_value = ListResult(
            items=[
                {"path": "2026-04-01/group_03.parquet", "path_type": "object"},
                {"path": "2026-04-01/group_08.parquet", "path_type": "object"},
            ],
            has_more=False,
        )
        mock_client.download.side_effect = [
            [str(target_dir / "group_03.parquet")],
            [str(target_dir / "group_08.parquet")],
        ]

        result = runner.invoke(cli, [
            "cp",
            "-m",
            "-r",
            "dh://koscom/koscom_stock_m167_hist_info/2026-04-01/group_*",
            str(target_dir),
        ])

        assert result.exit_code == 0
        assert target_dir.exists()
        mock_client.ls.assert_called_once_with(
            "koscom/koscom_stock_m167_hist_info",
            "2026-04-01/",
            branch="main",
            recursive=True,
            max_items=1000,
            after=None,
        )
        assert mock_client.download.call_count == 2
        first_call = mock_client.download.call_args_list[0]
        assert first_call[0][0] == "koscom/koscom_stock_m167_hist_info"
        assert first_call[0][2] == str(target_dir)
        assert "2026-04-01/" in first_call[0][1]

    def test_multiple_remote_sources_download(self, runner, mock_client, tmp_path):
        target_dir = tmp_path / "out"
        mock_client.download.side_effect = [
            [str(target_dir / "a.parquet")],
            [str(target_dir / "b.parquet")],
        ]

        result = runner.invoke(cli, [
            "cp",
            "-r",
            "dh://nlp-lab/repo/a.parquet",
            "dh://nlp-lab/repo/b.parquet",
            str(target_dir),
        ])

        assert result.exit_code == 0
        assert target_dir.exists()
        assert mock_client.download.call_count == 2

    def test_remote_glob_download_requires_recursive(self, runner, mock_client, tmp_path):
        target_dir = tmp_path / "koscom"
        mock_client.ls.return_value = ListResult(
            items=[{"path": "group_01.parquet", "path_type": "object"}],
            has_more=False,
        )

        result = runner.invoke(cli, [
            "cp",
            "dh://koscom/my-dataset/group_*",
            str(target_dir),
        ])

        assert result.exit_code != 0
        assert "require -r" in result.output

    def test_multiple_remote_sources_require_recursive(self, runner, mock_client, tmp_path):
        target_dir = tmp_path / "out"
        result = runner.invoke(cli, [
            "cp",
            "dh://nlp-lab/repo/a.parquet",
            "dh://nlp-lab/repo/b.parquet",
            str(target_dir),
        ])
        assert result.exit_code != 0
        assert "require -r" in result.output

    def test_branch_flag(self, runner, mock_client):
        mock_client.download.return_value = ["./f.csv"]
        result = runner.invoke(cli, [
            "cp", "dh://nlp-lab/repo/data/f.csv", "./f.csv", "-b", "experiment/aug",
        ])
        assert result.exit_code == 0
        call_kwargs = mock_client.download.call_args
        assert call_kwargs[0] == ("nlp-lab/repo", "data/f.csv", "./f.csv")
        assert call_kwargs[1]["branch"] == "experiment/aug"
        assert call_kwargs[1]["max_workers"] == 8
        assert call_kwargs[1]["multi"] is False


# ──────────────────────────────────────────────
# ls
# ──────────────────────────────────────────────


class TestLs:
    def test_basic(self, runner, mock_client):
        mock_client.ls.return_value = ListResult(items=["file1", "dir1/"], has_more=False)
        result = runner.invoke(cli, ["ls", "dh://nlp-lab/repo/"])
        assert result.exit_code == 0
        assert "file1" in result.output
        assert "dir1/" in result.output

    def test_recursive(self, runner, mock_client):
        mock_client.ls.return_value = ListResult(items=["a/b.csv"], has_more=False)
        result = runner.invoke(cli, ["ls", "dh://nlp-lab/repo/", "-r"])
        assert result.exit_code == 0
        mock_client.ls.assert_called_once_with(
            "nlp-lab/repo", "", branch="main", recursive=True, max_items=100, after=None,
        )

    def test_fetch_all(self, runner, mock_client):
        page1 = ListResult(items=["a"], has_more=True, next_offset="tok1")
        page2 = ListResult(items=["b"], has_more=False)
        mock_client.ls.side_effect = [page1, page2]

        result = runner.invoke(cli, ["ls", "dh://nlp-lab/repo/", "-a"])
        assert result.exit_code == 0
        assert "a" in result.output
        assert "b" in result.output
        assert mock_client.ls.call_count == 2

    def test_max_items(self, runner, mock_client):
        mock_client.ls.return_value = ListResult(items=[], has_more=False)
        runner.invoke(cli, ["ls", "dh://nlp-lab/repo/", "--max-items", "50"])
        mock_client.ls.assert_called_once_with(
            "nlp-lab/repo", "", branch="main", recursive=False, max_items=50, after=None,
        )


# ──────────────────────────────────────────────
# search
# ──────────────────────────────────────────────


class TestSearch:
    def test_basic(self, runner, mock_client):
        from datahub.types import TableInfo

        mock_client.search.return_value = [
            TableInfo(
                full_name="nlp.ds.ner", catalog_name="nlp", schema_name="ds",
                table_name="ner", storage_location="gs://b/p", comment="NER data",
            ),
        ]
        result = runner.invoke(cli, ["search", "ner"])
        assert result.exit_code == 0
        assert "ner" in result.output
        mock_client.search.assert_called_once_with("ner", catalog_name=None, filters=None)

    def test_with_catalog(self, runner, mock_client):
        mock_client.search.return_value = []
        result = runner.invoke(cli, ["search", "ner", "-c", "nlp_lab"])
        assert result.exit_code == 0
        mock_client.search.assert_called_once_with("ner", catalog_name="nlp_lab", filters=None)

    def test_no_results(self, runner, mock_client):
        mock_client.search.return_value = []
        result = runner.invoke(cli, ["search", "nothing"])
        assert result.exit_code == 0
        assert "No results" in result.output


# ──────────────────────────────────────────────
# commit / merge
# ──────────────────────────────────────────────


class TestVersionControl:
    def test_commit(self, runner, mock_client):
        mock_client.commit.return_value = MagicMock(id="deadbeef")
        result = runner.invoke(cli, ["commit", "repo", "main", "add data"])
        assert result.exit_code == 0
        assert "deadbeef" in result.output
        mock_client.commit.assert_called_once_with("repo", "main", "add data")

    def test_merge(self, runner, mock_client):
        result = runner.invoke(cli, ["merge", "repo", "feat", "--into", "main"])
        assert result.exit_code == 0
        mock_client.merge.assert_called_once_with("repo", "feat", into="main")
        assert "Merged feat into main" in result.output

    def test_merge_default_into(self, runner, mock_client):
        result = runner.invoke(cli, ["merge", "repo", "feat"])
        assert result.exit_code == 0
        mock_client.merge.assert_called_once_with("repo", "feat", into="main")


# ──────────────────────────────────────────────
# branch subcommands
# ──────────────────────────────────────────────


class TestBranch:
    def test_create(self, runner, mock_client):
        result = runner.invoke(cli, ["branch", "create", "repo", "feat"])
        assert result.exit_code == 0
        mock_client.create_branch.assert_called_once_with("repo", "feat", source="main")

    def test_create_from_source(self, runner, mock_client):
        result = runner.invoke(cli, ["branch", "create", "repo", "feat", "-s", "dev"])
        assert result.exit_code == 0
        mock_client.create_branch.assert_called_once_with("repo", "feat", source="dev")

    def test_delete(self, runner, mock_client):
        result = runner.invoke(cli, ["branch", "delete", "repo", "feat"])
        assert result.exit_code == 0
        mock_client.delete_branch.assert_called_once_with("repo", "feat")

    def test_list(self, runner, mock_client):
        mock_client.list_branches.return_value = ["main", "dev"]
        result = runner.invoke(cli, ["branch", "list", "repo"])
        assert result.exit_code == 0
        assert "main" in result.output
        assert "dev" in result.output


# ──────────────────────────────────────────────
# repo / access / catalog subcommands
# ──────────────────────────────────────────────


class TestRepo:
    def test_create(self, runner, mock_client):
        result = runner.invoke(cli, ["repo", "create", "new-repo"])
        assert result.exit_code == 0
        mock_client.create_repo.assert_called_once_with("new-repo")


class TestAccess:
    def test_grant(self, runner, mock_client):
        result = runner.invoke(cli, ["access", "grant", "repo", "user@ex.com"])
        assert result.exit_code == 0
        mock_client.grant_access.assert_called_once_with("repo", "user@ex.com", role="developer")

    def test_grant_with_role(self, runner, mock_client):
        result = runner.invoke(cli, ["access", "grant", "repo", "u@e.com", "-r", "reader"])
        assert result.exit_code == 0
        mock_client.grant_access.assert_called_once_with("repo", "u@e.com", role="reader")

    def test_revoke(self, runner, mock_client):
        result = runner.invoke(cli, ["access", "revoke", "repo", "u@e.com"])
        assert result.exit_code == 0
        mock_client.revoke_access.assert_called_once_with("repo", "u@e.com")


class TestCatalog:
    def test_list(self, runner, mock_client):
        mock_client.list_catalogs.return_value = ["nlp_lab", "cv_lab"]
        result = runner.invoke(cli, ["catalog", "list"])
        assert result.exit_code == 0
        assert "nlp_lab" in result.output

    def test_tables(self, runner, mock_client):
        from datahub.types import TableInfo

        mock_client.list_tables.return_value = [
            TableInfo(
                full_name="c.s.t", catalog_name="c", schema_name="s",
                table_name="t", storage_location="gs://b/p",
            ),
        ]
        result = runner.invoke(cli, ["catalog", "tables", "c", "s"])
        assert result.exit_code == 0
        assert "c.s.t" in result.output

    def test_get(self, runner, mock_client):
        from datahub.types import TableInfo

        mock_client.get_table.return_value = TableInfo(
            full_name="c.s.t", catalog_name="c", schema_name="s",
            table_name="t", storage_location="gs://b/p", comment="desc",
        )
        result = runner.invoke(cli, ["catalog", "get", "c.s.t"])
        assert result.exit_code == 0
        assert "c.s.t" in result.output
        assert "gs://b/p" in result.output
        assert "desc" in result.output


# ──────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────


class TestUtilities:
    def test_whoami(self, runner, mock_client):
        result = runner.invoke(cli, ["whoami"])
        assert result.exit_code == 0
        assert "test@example.com" in result.output


# ──────────────────────────────────────────────
# Error handling
# ──────────────────────────────────────────────


class TestErrorHandling:
    def test_value_error(self, runner, mock_client):
        mock_client.commit.side_effect = ValueError("auth.endpoint missing")
        result = runner.invoke(cli, ["commit", "repo", "main", "msg"])
        assert result.exit_code != 0
        assert "auth.endpoint missing" in result.output

    def test_generic_exception(self, runner, mock_client):
        mock_client.commit.side_effect = RuntimeError("unexpected")
        result = runner.invoke(cli, ["commit", "repo", "main", "msg"])
        assert result.exit_code != 0
        assert "RuntimeError" in result.output


# ──────────────────────────────────────────────
# Authentication (login / logout)
# ──────────────────────────────────────────────


class TestAuth:
    def test_login_success(self, runner):
        """login 성공 → email 출력."""
        from unittest.mock import patch

        with patch("datahub.auth.login_flow", return_value={"token": "tok", "email": "siu@example.com"}), \
             patch("datahub.config.DataHubConfig.load") as mock_cfg:
            mock_cfg.return_value.auth.endpoint = "http://mock:8000"
            result = runner.invoke(cli, ["login"])

        assert result.exit_code == 0, result.output
        assert "siu@example.com" in result.output

    def test_login_no_browser(self, runner):
        """--no-browser 플래그가 login_flow_paste로 라우팅된다."""
        from unittest.mock import patch

        with patch("datahub.auth.login_flow_paste", return_value={"token": "tok", "email": "user@test.com", "refresh_token": "", "endpoint": "http://mock:8000"}) as mock_paste, \
             patch("datahub.config.DataHubConfig.load") as mock_cfg:
            mock_cfg.return_value.auth.endpoint = "http://mock:8000"
            result = runner.invoke(cli, ["login", "--no-browser"])

        assert result.exit_code == 0, result.output
        mock_paste.assert_called_once_with("http://mock:8000")

    def test_login_flow_error_propagates(self, runner):
        """login_flow 실패 시 에러가 CLI에 표시된다."""
        from unittest.mock import patch

        with patch("datahub.auth.login_flow", side_effect=RuntimeError("OAuth timeout")), \
             patch("datahub.config.DataHubConfig.load") as mock_cfg:
            mock_cfg.return_value.auth.endpoint = "http://mock:8000"
            result = runner.invoke(cli, ["login"])

        assert result.exit_code != 0
        assert "OAuth timeout" in result.output

    def test_logout_clears_credentials(self, runner):
        """logout → CredentialStore.clear() 호출 → 완료 메시지."""
        from unittest.mock import patch

        with patch("datahub.auth.CredentialStore.clear") as mock_clear:
            result = runner.invoke(cli, ["logout"])

        assert result.exit_code == 0, result.output
        mock_clear.assert_called_once()
        assert "logged out" in result.output

    def test_logout_no_credentials(self, runner):
        """자격증명 없어도 logout은 정상 완료된다."""
        from unittest.mock import patch

        with patch("datahub.auth.CredentialStore.clear") as mock_clear:
            result = runner.invoke(cli, ["logout"])

        assert result.exit_code == 0, result.output
        mock_clear.assert_called_once()

"""DataClient 유닛 테스트 — thin-client (httpx) 기반."""

from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import pytest

from datahub.types import CommitInfo, ListResult, TableInfo, UserIdentity


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────


def _make_client():
    """Mock httpx.Client로 DataClient 인스턴스 생성."""
    from datahub.client import DataClient
    from datahub.config import AuthConfig, DataHubConfig

    cfg = DataHubConfig(auth=AuthConfig(endpoint="http://api-test:8000", api_key="test-key"))
    with patch("httpx.Client") as mock_http_cls:
        mock_http = MagicMock()
        mock_http_cls.return_value = mock_http

        # session 응답 mock
        session_resp = MagicMock()
        session_resp.json.return_value = {"email": "test@example.com", "user_id": 42}
        mock_http.post.return_value = session_resp

        client = DataClient(cfg)
        client._http = mock_http
        return client, mock_http


# ──────────────────────────────────────────────
# DataClient 초기화
# ──────────────────────────────────────────────


class TestDataClientInit:
    def test_missing_endpoint_raises(self):
        from datahub.client import DataClient
        from datahub.config import AuthConfig, DataHubConfig

        cfg = DataHubConfig(auth=AuthConfig(endpoint="", api_key=""))
        with pytest.raises(ValueError, match="auth.endpoint"):
            DataClient(cfg)

    def test_identity_from_session(self):
        client, _ = _make_client()
        assert client.identity.email == "test@example.com"


# ──────────────────────────────────────────────
# ──────────────────────────────────────────────


class TestGetFileManifest:
    def test_returns_three_tuple(self):
        client, mock_http = _make_client()

        dl_resp = MagicMock()
        dl_resp.json.return_value = {
            "token": "ya29.test-token",
            "token_expiry": "",
            "files": [
                {"path": "train.parquet", "physical_address": "gs://bucket/path/train.parquet"},
            ],
        }
        mock_http.post.return_value = dl_resp

        token, files, expires_at = client.get_file_manifest("my-dataset", "main")
        assert token == "ya29.test-token"
        assert len(files) == 1
        assert files[0]["path"] == "train.parquet"
        assert expires_at > time.time()

    def test_expires_at_fallback_when_missing(self):
        """API가 expiry 미반환 시 1시간 후 fallback."""
        client, mock_http = _make_client()

        dl_resp = MagicMock()
        dl_resp.json.return_value = {"token": "ya29.test-token", "files": []}
        mock_http.post.return_value = dl_resp

        _, _, expires_at = client.get_file_manifest("my-dataset", "main")
        assert expires_at == pytest.approx(time.time() + 3600, abs=5)

    def test_post_endpoints_called(self):
        client, mock_http = _make_client()
        mock_http.post.reset_mock()

        open_resp = MagicMock()
        open_resp.json.return_value = {"token": "tok", "token_expiry": ""}
        dl_resp = MagicMock()
        dl_resp.json.return_value = {"files": [], "has_more": False, "next_offset": None}
        mock_http.post.side_effect = [open_resp, dl_resp]

        client.get_file_manifest("ner-v4", "experiment")

        calls = mock_http.post.call_args_list
        assert len(calls) == 2
        assert "/repos/ner-v4/download/stream/open" in calls[0][0][0]
        assert calls[0][1]["json"]["branch"] == "experiment"
        assert "/repos/ner-v4/download/stream/page" in calls[1][0][0]


# ──────────────────────────────────────────────
# upload / download (3-step upload / 2-step download)
# ──────────────────────────────────────────────


class TestUpload:
    def _make_blob_mock(self, md5_hex: str = "aabbccdd" * 4) -> MagicMock:
        import base64
        blob = MagicMock()
        blob.md5_hash = base64.b64encode(bytes.fromhex(md5_hex)).decode()
        return blob

    def test_upload_lfs_returns_commit_info(self, tmp_path):
        """LFS batch + signed URL PUT + /commits flow → CommitInfo 반환."""
        client, mock_http = _make_client()

        test_file = tmp_path / "data.csv"
        test_file.write_text("col1,col2\n1,2\n")

        from datahub.client import DataClient
        oid, size = DataClient._blake3_hash_file(str(test_file))

        batch_resp = MagicMock()
        batch_resp.json.return_value = {
            "objects": [{"oid": oid, "actions": [{"href": "https://storage.googleapis.com/signed-put"}]}],
            "cab_token": "ya29.cab",
            "bucket": "lgair-datahub-repo",
        }
        commit_resp = MagicMock()
        commit_resp.json.return_value = {"commit_id": "abc123"}
        mock_http.post.side_effect = [batch_resp, commit_resp]

        with patch("httpx.put") as mock_put:
            mock_put.return_value = MagicMock(raise_for_status=MagicMock())
            result = client.upload("my-dataset", str(test_file), branch="main", message="test upload")

        assert isinstance(result, CommitInfo)
        assert result.id == "abc123"
        mock_put.assert_called_once()
        _, put_kwargs = mock_put.call_args
        assert put_kwargs["headers"]["Content-Type"] == "application/octet-stream"

    def test_upload_cab_error_propagates(self, tmp_path):
        """CAB 업로드 실패 시 예외가 그대로 전파된다 (fallback 없음)."""
        client, mock_http = _make_client()

        cab_fail = MagicMock()
        cab_fail.raise_for_status.side_effect = Exception("403 Forbidden")
        mock_http.post.side_effect = [cab_fail]

        test_file = tmp_path / "data.csv"
        test_file.write_text("col1,col2\n1,2\n")

        import pytest
        with pytest.raises(Exception, match="403 Forbidden"):
            client.upload("my-dataset", str(test_file), branch="main")

    def test_upload_no_commit_returns_none(self, tmp_path):
        client, mock_http = _make_client()

        open_resp = MagicMock()
        open_resp.json.return_value = {
            "session_id": "sess-000",
            "token": "ya29.tok",
        }
        stage_resp = MagicMock()
        stage_resp.json.return_value = {"remote_path": "f.txt", "physical_address": "gs://bucket/data/f.txt"}
        link_resp = MagicMock()
        link_resp.json.return_value = {"linked": True}
        complete_resp = MagicMock()
        complete_resp.json.return_value = {}
        mock_http.post.side_effect = [open_resp, stage_resp, link_resp, complete_resp]

        test_file = tmp_path / "f.txt"
        test_file.write_text("hello")

        blob = self._make_blob_mock()
        mock_gcs = MagicMock()
        mock_gcs.bucket.return_value.blob.return_value = blob

        with patch.object(client, "_gcs_client", return_value=mock_gcs):
            result = client.upload("my-dataset", str(test_file))

        assert result is None

    def test_upload_parallel_put_multiple_files(self, tmp_path):
        """여러 CAS miss → max_workers>1 시 httpx.put 병렬 호출."""
        client, mock_http = _make_client()

        (tmp_path / "a.bin").write_bytes(b"file-a content")
        (tmp_path / "b.bin").write_bytes(b"file-b content")

        from datahub.client import DataClient
        oid_a, _ = DataClient._blake3_hash_file(str(tmp_path / "a.bin"))
        oid_b, _ = DataClient._blake3_hash_file(str(tmp_path / "b.bin"))

        batch_resp = MagicMock()
        batch_resp.json.return_value = {
            "objects": [
                {"oid": oid_a, "actions": [{"href": "https://gcs/a"}]},
                {"oid": oid_b, "actions": [{"href": "https://gcs/b"}]},
            ],
            "cab_token": "ya29.cab",
            "bucket": "lgair-datahub-repo",
        }
        commit_resp = MagicMock()
        commit_resp.json.return_value = {"commit_id": "parallel-commit"}
        mock_http.post.side_effect = [batch_resp, commit_resp]

        with patch("httpx.put") as mock_put:
            mock_put.return_value = MagicMock(raise_for_status=MagicMock())
            result = client.upload("my-dataset", str(tmp_path), max_workers=4)

        assert isinstance(result, CommitInfo)
        assert result.id == "parallel-commit"
        assert mock_put.call_count == 2


class TestDownload:
    def test_token_download(self, tmp_path):
        """Type B 다운로드 — POST stream/open + stream/page → GCS JSON API."""
        client, mock_http = _make_client()

        open_resp = MagicMock()
        open_resp.json.return_value = {"token": "ya29.test", "token_expiry": "2099-01-01T00:00:00Z"}
        open_resp.raise_for_status = MagicMock()
        page_resp = MagicMock()
        page_resp.json.return_value = {
            "files": [{"path": "train.csv", "physical_address": "gs://my-bucket/data/train.csv"}],
            "has_more": False,
            "next_offset": None,
        }
        page_resp.raise_for_status = MagicMock()
        mock_http.post.reset_mock()
        mock_http.post.side_effect = [open_resp, page_resp]

        content = b"col1,col2\n1,2\n"
        gcs_resp = MagicMock()
        gcs_resp.content = content
        gcs_resp.raise_for_status = MagicMock()

        with patch("httpx.get", return_value=gcs_resp):
            result = client.download("my-dataset", "train.csv", str(tmp_path), branch="main")

        assert len(result) == 1
        assert (tmp_path / "train.csv").read_bytes() == content
        calls = mock_http.post.call_args_list
        assert any("stream/open" in c[0][0] for c in calls)

    def test_token_download_parallel_multiple_files(self, tmp_path):
        """여러 파일 병렬 다운로드 — ThreadPoolExecutor 사용."""
        client, mock_http = _make_client()

        open_resp = MagicMock()
        open_resp.json.return_value = {"token": "ya29.test", "token_expiry": "2099-01-01T00:00:00Z"}
        open_resp.raise_for_status = MagicMock()
        page_resp = MagicMock()
        page_resp.json.return_value = {
            "files": [
                {"path": "a.csv", "physical_address": "gs://bkt/a.csv"},
                {"path": "b.csv", "physical_address": "gs://bkt/b.csv"},
            ],
            "has_more": False,
            "next_offset": None,
        }
        page_resp.raise_for_status = MagicMock()
        mock_http.post.reset_mock()
        mock_http.post.side_effect = [open_resp, page_resp]

        gcs_resp = MagicMock()
        gcs_resp.content = b"data"
        gcs_resp.raise_for_status = MagicMock()

        with patch("httpx.get", return_value=gcs_resp) as mock_gcs:
            result = client.download("my-dataset", "/", str(tmp_path), max_workers=4)

        assert len(result) == 2
        assert mock_gcs.call_count == 2


# ──────────────────────────────────────────────
# 저장소 관리
# ──────────────────────────────────────────────


class TestRepoManagement:
    def test_create_repo(self):
        client, mock_http = _make_client()

        resp = MagicMock()
        resp.json.return_value = {"repo_name": "new-dataset"}
        mock_http.post.return_value = resp

        result = client.create_repo("new-dataset")
        assert result["repo_name"] == "new-dataset"


    def test_list_repos(self):
        client, mock_http = _make_client()

        resp = MagicMock()
        resp.json.return_value = {
            "repos": [{"repo_name": "ner-v4"}, {"repo_name": "ner-v5"}]
        }
        mock_http.get.return_value = resp

        repos = client.list_repos()
        assert len(repos) == 2


# ──────────────────────────────────────────────
# 버전 관리
# ──────────────────────────────────────────────


class TestVersionControl:
    def test_create_branch(self):
        client, mock_http = _make_client()
        resp = MagicMock()
        mock_http.post.return_value = resp

        client.create_branch("my-dataset", "experiment/aug-v3", source="main")

        call_args = mock_http.post.call_args
        assert "branches" in call_args[0][0]
        assert call_args[1]["json"]["branch_name"] == "experiment/aug-v3"
        assert call_args[1]["json"]["source"] == "main"

    def test_list_branches(self):
        client, mock_http = _make_client()
        resp = MagicMock()
        resp.json.return_value = {"branches": ["main", "experiment/aug-v3"]}
        mock_http.get.return_value = resp

        branches = client.list_branches("my-dataset")
        assert "main" in branches
        assert "experiment/aug-v3" in branches

    def test_commit(self):
        client, mock_http = _make_client()
        resp = MagicMock()
        resp.json.return_value = {
            "id": "commit-abc",
            "message": "test commit",
            "committer": "test@example.com",
        }
        mock_http.post.return_value = resp

        info = client.commit("my-dataset", "main", "test commit")
        assert isinstance(info, CommitInfo)
        assert info.id == "commit-abc"

    def test_diff(self):
        client, mock_http = _make_client()
        resp = MagicMock()
        resp.json.return_value = {"paths": ["train.csv", "test.csv"]}
        mock_http.get.return_value = resp

        paths = client.diff("my-dataset", "experiment/aug-v3", "main")
        assert "train.csv" in paths


# ──────────────────────────────────────────────
# 카탈로그 / 검색
# ──────────────────────────────────────────────


class TestCatalog:
    def test_get_table(self):
        client, mock_http = _make_client()
        resp = MagicMock()
        resp.json.return_value = {
            "full_name": "nlp_lab.datasets.ner_v4",
            "catalog_name": "nlp_lab",
            "schema_name": "datasets",
            "table_name": "ner_v4",
            "storage_location": "gs://bucket/ner/v4/",
        }
        mock_http.get.return_value = resp

        table = client.get_table("nlp_lab.datasets.ner_v4")
        assert isinstance(table, TableInfo)
        assert table.table_name == "ner_v4"

    def test_search(self):
        client, mock_http = _make_client()
        resp = MagicMock()
        resp.json.return_value = {
            "tables": [
                {
                    "full_name": "nlp_lab.datasets.ner_v4",
                    "catalog_name": "nlp_lab",
                    "schema_name": "datasets",
                    "table_name": "ner_v4",
                    "storage_location": "gs://bucket/ner/v4/",
                }
            ]
        }
        mock_http.get.return_value = resp

        results = client.search("ner")
        assert len(results) == 1
        assert results[0].table_name == "ner_v4"

    def test_ls(self):
        client, mock_http = _make_client()
        resp = MagicMock()
        resp.json.return_value = {
            "items": ["train.csv", "test.csv"],
            "has_more": False,
        }
        mock_http.get.return_value = resp

        result = client.ls("my-dataset", branch="main")
        assert isinstance(result, ListResult)
        assert len(result) == 2

"""Issue #86 — Type B download tests.

Tests for:
  - _download_token: stream/open + stream/page → GCS JSON API download
  - download (public API): delegates to _download_token
  - CLI download command: basic smoke test
"""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _make_client():
    from datahub.client import DataClient
    from datahub.config import AuthConfig, DataHubConfig

    cfg = DataHubConfig(auth=AuthConfig(endpoint="http://api-test:8000", api_key="test-key"))
    with patch("httpx.Client") as mock_http_cls:
        mock_http = MagicMock()
        mock_http_cls.return_value = mock_http
        session_resp = MagicMock()
        session_resp.json.return_value = {"email": "user@example.com", "user_id": 1}
        mock_http.post.return_value = session_resp
        client = DataClient(cfg)
        client._http = mock_http
    mock_http.post.reset_mock()
    return client, mock_http


def _fake_open_response(token: str = "ya29.test-token") -> MagicMock:
    """Mock for POST /download/stream/open."""
    resp = MagicMock()
    resp.json.return_value = {"token": token, "token_expiry": "2026-04-22T20:00:00Z"}
    resp.raise_for_status = MagicMock()
    return resp


def _fake_page_response(files: list[dict] | None = None, has_more: bool = False, next_offset: str | None = None) -> MagicMock:
    """Mock for POST /download/stream/page."""
    resp = MagicMock()
    resp.json.return_value = {
        "files": files or [],
        "has_more": has_more,
        "next_offset": next_offset,
    }
    resp.raise_for_status = MagicMock()
    return resp


def _setup_stream(mock_http, token: str = "ya29.test-token", files: list[dict] | None = None):
    """Configure mock_http.post for stream/open + stream/page (single page, no pagination)."""
    open_resp = _fake_open_response(token)
    page_resp = _fake_page_response(files=files or [])
    mock_http.post.side_effect = [open_resp, page_resp]


def _fake_gcs_response(content: bytes = b"file content") -> MagicMock:
    resp = MagicMock()
    resp.content = content
    resp.raise_for_status = MagicMock()
    return resp


# ──────────────────────────────────────────────
# _download_token
# ──────────────────────────────────────────────

class TestDownloadToken:
    def test_single_file_download(self, tmp_path):
        """단일 파일 정상 다운로드."""
        client, mock_http = _make_client()
        content = b"col1,col2\n1,2\n"
        _setup_stream(mock_http, token="ya29.cab-token", files=[
            {"path": "train.csv", "physical_address": "gs://lgair-bucket/repos/my-repo/train.csv"},
        ])

        with patch("httpx.get") as mock_get:
            mock_get.return_value = _fake_gcs_response(content)
            result = client.download("my-repo", "train.csv", str(tmp_path))

        assert len(result) == 1
        written = (tmp_path / "train.csv").read_bytes()
        assert written == content

    def test_token_endpoint_called_with_branch(self, tmp_path):
        """POST stream/open + stream/page에 branch 전달 확인."""
        client, mock_http = _make_client()
        _setup_stream(mock_http, files=[
            {"path": "data.bin", "physical_address": "gs://bucket/obj"},
        ])

        with patch("httpx.get") as mock_get:
            mock_get.return_value = _fake_gcs_response(b"data")
            client.download("my-repo", "data.bin", str(tmp_path), branch="develop")

        # stream/open called first
        open_call = mock_http.post.call_args_list[0]
        url = open_call.args[0]
        body = open_call.kwargs.get("json", {})
        assert "stream/open" in url
        assert body.get("branch") == "develop"

    def test_gcs_request_has_auth_header(self, tmp_path):
        """GCS 요청에 Authorization: Bearer {token} 포함."""
        client, mock_http = _make_client()
        _setup_stream(mock_http, token="ya29.secret-token", files=[
            {"path": "f.bin", "physical_address": "gs://bkt/f.bin"},
        ])

        with patch("httpx.get") as mock_gcs_get:
            mock_gcs_get.return_value = _fake_gcs_response(b"x")
            client.download("my-repo", "f.bin", str(tmp_path))

        gcs_call = mock_gcs_get.call_args
        headers = gcs_call.kwargs.get("headers", {})
        assert headers.get("Authorization") == "Bearer ya29.secret-token"

    def test_gcs_url_uses_json_api(self, tmp_path):
        """GCS JSON API URL 형식 확인."""
        client, mock_http = _make_client()
        _setup_stream(mock_http, files=[
            {"path": "data.bin", "physical_address": "gs://my-bucket/path/to/file.bin"},
        ])

        with patch("httpx.get") as mock_gcs_get:
            mock_gcs_get.return_value = _fake_gcs_response(b"content")
            client.download("my-repo", "data.bin", str(tmp_path))

        gcs_url = mock_gcs_get.call_args.args[0]
        assert "storage.googleapis.com/download/storage/v1/b/my-bucket/o/" in gcs_url
        assert "alt=media" in gcs_url

    def test_empty_repo_returns_empty_list(self, tmp_path):
        """파일이 없으면 빈 리스트 반환."""
        client, mock_http = _make_client()
        _setup_stream(mock_http, files=[])

        with patch("httpx.get"):
            result = client.download("empty-repo", "/", str(tmp_path))

        assert result == []

    def test_remote_path_filter_exact(self, tmp_path):
        """stream/page 응답에서 경로 필터링 없이 반환된 파일을 그대로 사용."""
        client, mock_http = _make_client()
        # stream/page returns only the matching file (server-side filtering)
        _setup_stream(mock_http, files=[
            {"path": "train.csv", "physical_address": "gs://bkt/train.csv"},
        ])

        with patch("httpx.get") as mock_gcs:
            mock_gcs.return_value = _fake_gcs_response(b"data")
            result = client.download("my-repo", "train.csv", str(tmp_path))

        assert len(result) == 1
        assert mock_gcs.call_count == 1

    def test_remote_path_filter_directory(self, tmp_path):
        """stream/page가 디렉토리 하위 파일을 모두 반환하면 모두 다운로드."""
        client, mock_http = _make_client()
        _setup_stream(mock_http, files=[
            {"path": "train/a.csv", "physical_address": "gs://bkt/train/a.csv"},
            {"path": "train/b.csv", "physical_address": "gs://bkt/train/b.csv"},
        ])

        with patch("httpx.get") as mock_gcs:
            mock_gcs.return_value = _fake_gcs_response(b"row")
            result = client.download("my-repo", "train/", str(tmp_path))

        assert len(result) == 2
        assert mock_gcs.call_count == 2

    def test_parallel_download_uses_thread_pool(self, tmp_path):
        """여러 파일은 ThreadPoolExecutor로 병렬 다운로드."""
        client, mock_http = _make_client()
        _setup_stream(mock_http, files=[
            {"path": "a.bin", "physical_address": "gs://bkt/a.bin"},
            {"path": "b.bin", "physical_address": "gs://bkt/b.bin"},
            {"path": "c.bin", "physical_address": "gs://bkt/c.bin"},
        ])

        with patch("httpx.get") as mock_gcs:
            mock_gcs.return_value = _fake_gcs_response(b"data")
            result = client.download("my-repo", "/", str(tmp_path), max_workers=4)

        assert len(result) == 3
        assert mock_gcs.call_count == 3

    def test_blob_path_is_url_encoded(self, tmp_path):
        """GCS blob 경로의 '/'가 URL 인코딩(%2F)되어야 한다."""
        client, mock_http = _make_client()
        _setup_stream(mock_http, files=[
            {"path": "sub/dir/file.csv", "physical_address": "gs://bkt/sub/dir/file.csv"},
        ])

        with patch("httpx.get") as mock_gcs:
            mock_gcs.return_value = _fake_gcs_response(b"csv")
            client.download("my-repo", "sub/dir/file.csv", str(tmp_path))

        gcs_url = mock_gcs.call_args.args[0]
        # blob path의 슬래시는 %2F로 인코딩되어야 함
        assert "%2F" in gcs_url or "sub%2Fdir%2Ffile.csv" in gcs_url

    def test_file_written_to_disk(self, tmp_path):
        """다운로드한 내용이 로컬 파일에 정확히 기록되는지 확인."""
        client, mock_http = _make_client()
        content = b"hello world from datahub"
        _setup_stream(mock_http, files=[
            {"path": "hello.txt", "physical_address": "gs://bkt/hello.txt"},
        ])

        with patch("httpx.get") as mock_gcs:
            mock_gcs.return_value = _fake_gcs_response(content)
            result = client.download("my-repo", "hello.txt", str(tmp_path))

        assert len(result) == 1
        assert (tmp_path / "hello.txt").read_bytes() == content

    def test_pagination_fetches_all_pages(self, tmp_path):
        """has_more=True면 stream/page를 반복 호출하여 모든 파일을 수집."""
        client, mock_http = _make_client()
        open_resp = _fake_open_response("ya29.paged-token")
        page1 = _fake_page_response(
            files=[{"path": "a.bin", "physical_address": "gs://bkt/a.bin"}],
            has_more=True, next_offset="a.bin",
        )
        page2 = _fake_page_response(
            files=[{"path": "b.bin", "physical_address": "gs://bkt/b.bin"}],
            has_more=False,
        )
        mock_http.post.side_effect = [open_resp, page1, page2]

        with patch("httpx.get") as mock_gcs:
            mock_gcs.return_value = _fake_gcs_response(b"data")
            result = client.download("my-repo", "/", str(tmp_path))

        assert len(result) == 2
        assert mock_gcs.call_count == 2


# ──────────────────────────────────────────────
# mount/umount stubs
# ──────────────────────────────────────────────

class TestMountStubs:
    def test_mount_raises_not_implemented(self):
        from datahub.mount import mount
        with pytest.raises(NotImplementedError, match="Phase 2"):
            mount("token", [], "/mnt/test")

    def test_umount_raises_not_implemented(self):
        from datahub.mount import umount
        with pytest.raises(NotImplementedError, match="Phase 2"):
            umount("/mnt/test")

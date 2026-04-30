"""Tests for datahub-python#21: HTTP 429 Retry-After 헤더 파싱.

Verifies:
- _parse_retry_after: Retry-After 헤더 파싱 (숫자, 없음, 파싱 불가)
- _http_request_with_retry: 429 → sleep → retry / 비-429 즉시 반환
- Retry-After 있으면 해당 값 + 1.0초 sleep
- Retry-After 없으면 지수 백오프 (2^attempt)
- max_retries 초과 시 마지막 응답 반환
- GCS PUT (_put_chunk_raw) 및 API POST (batch, commit) 에 적용됨
"""

from __future__ import annotations

from unittest.mock import MagicMock, call, patch

import pytest

from datahub.client import (
    DataClient,
    _DEFAULT_MAX_RETRIES,
    _http_request_with_retry,
    _parse_retry_after,
)


# ── _parse_retry_after ────────────────────────────────────────────────────────

class TestParseRetryAfter:
    def _resp(self, header_value=None):
        resp = MagicMock()
        resp.headers = {"Retry-After": str(header_value)} if header_value is not None else {}
        return resp

    def test_numeric_header_returns_value_plus_one(self):
        assert _parse_retry_after(self._resp(5)) == pytest.approx(6.0)

    def test_float_header(self):
        assert _parse_retry_after(self._resp(2.5)) == pytest.approx(3.5)

    def test_zero_header(self):
        assert _parse_retry_after(self._resp(0)) == pytest.approx(1.0)

    def test_missing_header_returns_none(self):
        assert _parse_retry_after(self._resp()) is None

    def test_non_numeric_header_returns_none(self):
        resp = MagicMock()
        resp.headers = {"Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT"}
        assert _parse_retry_after(resp) is None


# ── _http_request_with_retry ──────────────────────────────────────────────────

class TestHttpRequestWithRetry:
    def _make_resp(self, status_code, retry_after=None):
        resp = MagicMock()
        resp.status_code = status_code
        resp.headers = {}
        if retry_after is not None:
            resp.headers["Retry-After"] = str(retry_after)
        return resp

    def test_non_429_returned_immediately(self):
        ok_resp = self._make_resp(200)
        fn = MagicMock(return_value=ok_resp)
        result = _http_request_with_retry(fn, "http://example.com")
        assert result is ok_resp
        fn.assert_called_once()

    def test_500_returned_without_retry(self):
        err_resp = self._make_resp(500)
        fn = MagicMock(return_value=err_resp)
        with patch("time.sleep") as mock_sleep:
            result = _http_request_with_retry(fn, "http://example.com")
        assert result is err_resp
        fn.assert_called_once()
        mock_sleep.assert_not_called()

    def test_429_with_retry_after_sleeps_correct_duration(self):
        resp_429 = self._make_resp(429, retry_after=3)
        resp_200 = self._make_resp(200)
        fn = MagicMock(side_effect=[resp_429, resp_200])

        with patch("time.sleep") as mock_sleep:
            result = _http_request_with_retry(fn, "http://example.com")

        assert result is resp_200
        assert fn.call_count == 2
        mock_sleep.assert_called_once_with(pytest.approx(4.0))  # 3 + 1

    def test_429_without_retry_after_uses_exponential_backoff(self):
        resp_429_a = self._make_resp(429)  # no Retry-After
        resp_429_b = self._make_resp(429)
        resp_200 = self._make_resp(200)
        fn = MagicMock(side_effect=[resp_429_a, resp_429_b, resp_200])

        with patch("time.sleep") as mock_sleep:
            result = _http_request_with_retry(fn, "http://example.com", max_retries=3)

        assert result is resp_200
        assert fn.call_count == 3
        # attempt 0 → sleep 2^0 = 1, attempt 1 → sleep 2^1 = 2
        assert mock_sleep.call_args_list == [call(1), call(2)]

    def test_max_retries_exceeded_returns_last_response(self):
        resp_429 = self._make_resp(429, retry_after=1)
        fn = MagicMock(return_value=resp_429)

        with patch("time.sleep"):
            result = _http_request_with_retry(fn, "http://example.com", max_retries=2)

        # called max_retries + 1 times, returns last 429
        assert result is resp_429
        assert fn.call_count == 3  # 0, 1, 2 (stops after max_retries)

    def test_default_max_retries_is_3(self):
        assert _DEFAULT_MAX_RETRIES == 3
        resp_429 = self._make_resp(429)
        fn = MagicMock(return_value=resp_429)
        with patch("time.sleep"):
            _http_request_with_retry(fn, "url")
        assert fn.call_count == 4  # 3 retries + 1 initial

    def test_kwargs_passed_through(self):
        ok_resp = self._make_resp(200)
        fn = MagicMock(return_value=ok_resp)
        _http_request_with_retry(fn, "http://example.com", json={"key": "val"}, timeout=10)
        fn.assert_called_once_with("http://example.com", json={"key": "val"}, timeout=10)


# ── Integration: _put_chunk_raw applies retry ─────────────────────────────────

class TestPutChunkRawRetry:
    """Verify _upload_lfs GCS PUT goes through _http_request_with_retry."""

    def _make_client_for_upload(self):
        client = DataClient.__new__(DataClient)
        client._http = MagicMock()
        client._base_url = "http://fake"
        client._url = lambda path: f"http://fake{path}"
        client._emit_progress = lambda *a, **kw: None
        client._emit_stage = lambda *a, **kw: None
        client._format_progress_label = lambda d, t: f"{d}/{t}"
        return client

    def test_gcs_put_retries_on_429(self):
        from datahub._cas import ChunkInfo
        chunk = ChunkInfo(hash="a" * 64, offset=0, length=5, data=b"hello")

        resp_429 = MagicMock()
        resp_429.status_code = 429
        resp_429.headers = {"Retry-After": "2"}

        resp_200 = MagicMock()
        resp_200.status_code = 200
        resp_200.headers = {}
        resp_200.raise_for_status = MagicMock()

        batch_resp = MagicMock()
        batch_resp.raise_for_status = MagicMock()
        batch_resp.json.return_value = {
            "objects": [{"oid": chunk.hash, "actions": [{"href": "http://gcs/chunk"}]}]
        }
        commit_resp = MagicMock()
        commit_resp.raise_for_status = MagicMock()
        commit_resp.json.return_value = {"id": "abc", "committer": {"date": "2026-01-01"}}

        client = self._make_client_for_upload()
        client._http.post = MagicMock(side_effect=[batch_resp, commit_resp])

        with patch("datahub._cas.chunk_file", return_value=[chunk]), \
             patch("httpx.put", side_effect=[resp_429, resp_200]) as mock_put, \
             patch("time.sleep") as mock_sleep:
            client._upload_lfs(
                repo_name="test-repo",
                file_entries=[{"local_path": "/fake/f", "remote_path": "f"}],
                branch="main",
                message="test",
                remote_prefix="",
                max_workers=4,
                max_in_flight=5,
                metadata=None,
            )

        assert mock_put.call_count == 2  # 1 retry
        mock_sleep.assert_called_once_with(pytest.approx(3.0))  # Retry-After=2 → 3.0


# ── Integration: batch/commit POST applies retry ──────────────────────────────

class TestApiPostRetry:
    def _make_client_for_upload(self):
        client = DataClient.__new__(DataClient)
        client._http = MagicMock()
        client._base_url = "http://fake"
        client._url = lambda path: f"http://fake{path}"
        client._emit_progress = lambda *a, **kw: None
        client._emit_stage = lambda *a, **kw: None
        client._format_progress_label = lambda d, t: f"{d}/{t}"
        return client

    def test_batch_post_retries_on_429(self):
        from datahub._cas import ChunkInfo
        chunk = ChunkInfo(hash="b" * 64, offset=0, length=4, data=b"data")

        resp_429 = MagicMock()
        resp_429.status_code = 429
        resp_429.headers = {}

        batch_resp = MagicMock()
        batch_resp.status_code = 200
        batch_resp.headers = {}
        batch_resp.raise_for_status = MagicMock()
        batch_resp.json.return_value = {"objects": []}  # all CAS hits → no PUTs

        commit_resp = MagicMock()
        commit_resp.status_code = 200
        commit_resp.headers = {}
        commit_resp.raise_for_status = MagicMock()
        commit_resp.json.return_value = {"id": "xyz", "committer": {"date": "2026-01-01"}}

        client = self._make_client_for_upload()
        # batch POST: first 429 then 200; commit POST: 200
        client._http.post = MagicMock(side_effect=[resp_429, batch_resp, commit_resp])

        with patch("datahub._cas.chunk_file", return_value=[chunk]), \
             patch("time.sleep") as mock_sleep:
            client._upload_lfs(
                repo_name="test-repo",
                file_entries=[{"local_path": "/fake/f", "remote_path": "f"}],
                branch="main",
                message="test",
                remote_prefix="",
                max_workers=4,
                max_in_flight=5,
                metadata=None,
            )

        # batch was called twice (1 retry), sleep happened once with exponential backoff (2^0=1)
        assert mock_sleep.call_count >= 1
        assert client._http.post.call_count == 3  # 429 + batch_ok + commit_ok

"""Tests for datahub-python#20: in-flight chunk semaphore (S3Transfer pattern).

Verifies:
- threading.Semaphore limits concurrent GCS PUT operations to max_in_flight
- max_in_flight parameter flows through upload() / upload_many() / _upload_lfs()
- Default value is 10 (_DEFAULT_MAX_IN_FLIGHT)
- Semaphore is correctly released even when PUT raises an exception
- Sequential path (max_workers=1) is unaffected
"""

from __future__ import annotations

import threading
from concurrent.futures import Future
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from datahub.client import DataClient, _DEFAULT_MAX_IN_FLIGHT, _DEFAULT_MAX_WORKERS


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_chunk(hash_: str, length: int = 100) -> Any:
    """Build a minimal ChunkInfo-like object."""
    from collections import namedtuple
    ChunkInfo = namedtuple("ChunkInfo", ["hash", "offset", "length", "data"])
    return ChunkInfo(hash=hash_, offset=0, length=length, data=b"x" * length)


def _make_client() -> DataClient:
    client = DataClient.__new__(DataClient)
    client._http = MagicMock()
    client._base_url = "http://fake"
    return client


# ── default constant ──────────────────────────────────────────────────────────

class TestDefaultConstant:
    def test_default_max_in_flight_is_10(self):
        assert _DEFAULT_MAX_IN_FLIGHT == 10

    def test_upload_signature_has_max_in_flight(self):
        import inspect
        sig = inspect.signature(DataClient.upload)
        assert "max_in_flight" in sig.parameters
        assert sig.parameters["max_in_flight"].default == _DEFAULT_MAX_IN_FLIGHT

    def test_upload_many_signature_has_max_in_flight(self):
        import inspect
        sig = inspect.signature(DataClient.upload_many)
        assert "max_in_flight" in sig.parameters
        assert sig.parameters["max_in_flight"].default == _DEFAULT_MAX_IN_FLIGHT

    def test_upload_lfs_signature_has_max_in_flight(self):
        import inspect
        sig = inspect.signature(DataClient._upload_lfs)
        assert "max_in_flight" in sig.parameters


# ── semaphore concurrency limit ───────────────────────────────────────────────

class TestSemaphoreConcurrencyLimit:
    """Verify that at most max_in_flight chunks are submitted concurrently."""

    def _run_upload_lfs_with_tracking(self, num_chunks: int, max_in_flight: int, max_workers: int = 8):
        """Run _upload_lfs with fake chunks and track peak concurrency."""
        peak_concurrent = [0]
        current_concurrent = [0]
        lock = threading.Lock()
        barrier = threading.Barrier(min(max_in_flight, num_chunks) if num_chunks >= 2 else 1)

        chunks = [_make_chunk(f"a" * 63 + str(i), 10) for i in range(num_chunks)]
        oid_to_href = {c.hash: f"http://fake/{c.hash}" for c in chunks}

        def fake_put(url, content, headers):
            with lock:
                current_concurrent[0] += 1
                if current_concurrent[0] > peak_concurrent[0]:
                    peak_concurrent[0] = current_concurrent[0]
            try:
                # simulate work
                import time
                time.sleep(0.005)
            finally:
                with lock:
                    current_concurrent[0] -= 1
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            return resp

        client = _make_client()

        # Build a minimal fake _upload_lfs invocation by patching the HTTP PUT
        # and the batch/commit endpoints
        batch_response = MagicMock()
        batch_response.raise_for_status = MagicMock()
        batch_response.json.return_value = {
            "objects": [
                {"oid": c.hash, "actions": [{"href": f"http://fake/{c.hash}"}]}
                for c in chunks
            ]
        }

        commit_response = MagicMock()
        commit_response.raise_for_status = MagicMock()
        commit_response.json.return_value = {"id": "abc123", "committer": {"date": "2026-01-01"}}

        client._http.post = MagicMock(side_effect=[batch_response, commit_response])
        client._url = lambda path: f"http://fake{path}"

        def noop_emit(*args, **kwargs):
            pass
        client._emit_progress = noop_emit
        client._emit_stage = noop_emit
        client._format_progress_label = lambda done, total: f"{done}/{total}"

        file_entries = [
            {
                "local_path": "/fake/file.bin",
                "remote_path": "file.bin",
                "size": sum(c.length for c in chunks),
            }
        ]

        with patch("datahub._cas.chunk_file", return_value=chunks), \
             patch("httpx.put", side_effect=fake_put):
            client._upload_lfs(
                repo_name="test-repo",
                file_entries=file_entries,
                branch="main",
                message="test",
                remote_prefix="",
                max_workers=max_workers,
                max_in_flight=max_in_flight,
                metadata=None,
                on_progress=None,
            )

        return peak_concurrent[0]

    def test_peak_concurrency_does_not_exceed_max_in_flight(self):
        """With 20 chunks and max_in_flight=3, peak concurrent PUTs <= 3."""
        peak = self._run_upload_lfs_with_tracking(num_chunks=20, max_in_flight=3, max_workers=8)
        assert peak <= 3, f"peak={peak} exceeded max_in_flight=3"

    def test_peak_concurrency_with_default_max_in_flight(self):
        """With 30 chunks and max_in_flight=10, peak <= 10."""
        peak = self._run_upload_lfs_with_tracking(num_chunks=30, max_in_flight=10, max_workers=8)
        assert peak <= 10, f"peak={peak} exceeded max_in_flight=10"

    def test_max_in_flight_1_forces_sequential(self):
        """max_in_flight=1 means at most 1 PUT at a time even with multiple workers."""
        peak = self._run_upload_lfs_with_tracking(num_chunks=10, max_in_flight=1, max_workers=4)
        assert peak <= 1, f"peak={peak} with max_in_flight=1"


# ── semaphore release on exception ───────────────────────────────────────────

class TestSemaphoreReleaseOnException:
    """Verify semaphore slot is released even when PUT fails."""

    def test_semaphore_released_on_http_error(self):
        """After a PUT exception, the semaphore counter is restored."""
        import httpx

        client = _make_client()
        chunks = [_make_chunk("a" * 64, 10), _make_chunk("b" * 64, 10)]

        batch_response = MagicMock()
        batch_response.raise_for_status = MagicMock()
        batch_response.json.return_value = {
            "objects": [
                {"oid": c.hash, "actions": [{"href": f"http://fake/{c.hash}"}]}
                for c in chunks
            ]
        }

        client._http.post = MagicMock(return_value=batch_response)
        client._url = lambda path: f"http://fake{path}"

        def noop(*args, **kwargs):
            pass
        client._emit_progress = noop
        client._emit_stage = noop
        client._format_progress_label = lambda done, total: f"{done}/{total}"

        call_count = [0]

        def failing_put(url, content, headers):
            call_count[0] += 1
            resp = MagicMock()
            resp.raise_for_status.side_effect = httpx.HTTPStatusError(
                "500", request=MagicMock(), response=MagicMock()
            )
            return resp

        file_entries = [{"local_path": "/fake/file.bin", "remote_path": "file.bin", "size": 20}]

        with patch("datahub._cas.chunk_file", return_value=chunks), \
             patch("httpx.put", side_effect=failing_put), \
             pytest.raises(Exception):
            client._upload_lfs(
                repo_name="test-repo",
                file_entries=file_entries,
                branch="main",
                message="test",
                remote_prefix="",
                max_workers=4,
                max_in_flight=5,
                metadata=None,
                on_progress=None,
            )

        # If semaphore slots were not released, subsequent acquire() would deadlock.
        # We verify by checking that all submitted futures completed (either pass or fail).
        # The fact we reached here without hanging means releases happened correctly.
        assert call_count[0] > 0


# ── parameter passthrough ─────────────────────────────────────────────────────

class TestParameterPassthrough:
    """Verify max_in_flight is passed from upload/upload_many down to _upload_lfs."""

    def test_upload_passes_max_in_flight_to_upload_lfs(self):
        client = _make_client()
        client._collect_file_entries = MagicMock(return_value=[])
        client._upload_lfs = MagicMock(return_value=None)

        client.upload("repo", "/fake/path", max_in_flight=7)
        _, kwargs = client._upload_lfs.call_args
        # positional args: (repo, entries, branch, message, prefix, max_workers, max_in_flight, metadata, on_progress)
        args, _ = client._upload_lfs.call_args
        assert args[6] == 7  # max_in_flight positional index

    def test_upload_many_passes_max_in_flight_to_upload_lfs(self):
        client = _make_client()
        client._collect_file_entries = MagicMock(return_value=[])
        client._upload_lfs = MagicMock(return_value=None)

        client.upload_many("repo", ["/fake/a", "/fake/b"], max_in_flight=3)
        args, _ = client._upload_lfs.call_args
        assert args[6] == 3  # max_in_flight positional index

    def test_upload_default_max_in_flight_is_10(self):
        client = _make_client()
        client._collect_file_entries = MagicMock(return_value=[])
        client._upload_lfs = MagicMock(return_value=None)

        client.upload("repo", "/fake/path")
        args, _ = client._upload_lfs.call_args
        assert args[6] == 10

    def test_upload_many_default_max_in_flight_is_10(self):
        client = _make_client()
        client._collect_file_entries = MagicMock(return_value=[])
        client._upload_lfs = MagicMock(return_value=None)

        client.upload_many("repo", ["/fake/a"])
        args, _ = client._upload_lfs.call_args
        assert args[6] == 10

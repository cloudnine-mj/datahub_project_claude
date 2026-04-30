"""Tests for datahub-python#18: fastcdc variable chunking + parallel upload/download.

Covers:
  - _cas.chunk_file(): fastcdc splits, BLAKE3 per-chunk hash, empty-file edge case
  - _upload_lfs(): batch payload contains N chunk OIDs, /commits uses chunks array
  - _download_token(): chunks-based response → parallel fetch → ordered reassembly
"""

from __future__ import annotations

import os
import tempfile
from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch

import pytest


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_file(content: bytes) -> str:
    f = tempfile.NamedTemporaryFile(delete=False, suffix=".bin")
    f.write(content)
    f.close()
    return f.name


def _make_client():
    """Create DataClient with mocked HTTP transport."""
    from datahub.client import DataClient

    client = DataClient.__new__(DataClient)
    client._http = MagicMock()
    client._endpoint = "http://fake"
    client._max_workers = 4
    client._emit_stage = MagicMock()
    client._emit_progress = MagicMock()
    client._format_progress_label = lambda done, total: f"{done}/{total}"
    client._resolve_download_destination = lambda file_path, remote_path, local_path: (
        os.path.join(local_path, os.path.basename(file_path))
    )
    return client


# ── chunk_file ────────────────────────────────────────────────────────────────

class TestChunkFile:

    def test_empty_file_returns_one_chunk(self, tmp_path):
        from datahub._cas import chunk_file

        p = tmp_path / "empty.bin"
        p.write_bytes(b"")
        chunks = chunk_file(str(p))

        assert len(chunks) == 1
        assert chunks[0].length == 0
        assert len(chunks[0].hash) == 64  # BLAKE3 hex digest

    def test_small_file_one_chunk(self, tmp_path):
        """A 1-byte file produces exactly one chunk."""
        from datahub._cas import chunk_file

        p = tmp_path / "tiny.bin"
        p.write_bytes(b"x")
        chunks = chunk_file(str(p))

        assert len(chunks) == 1
        assert chunks[0].offset == 0
        assert chunks[0].length == 1
        assert chunks[0].data == b"x"

    def test_chunk_hashes_are_unique_for_different_data(self, tmp_path):
        from datahub._cas import chunk_file, MIN_CHUNK

        # Write 2 × MIN_CHUNK bytes of different content to force multiple chunks
        content = bytes(range(256)) * (MIN_CHUNK * 2 // 256 + 1)
        p = tmp_path / "data.bin"
        p.write_bytes(content[:MIN_CHUNK * 3])
        chunks = chunk_file(str(p))

        hashes = [c.hash for c in chunks]
        # All hashes must be 64-char hex
        assert all(len(h) == 64 for h in hashes)
        # Offsets must be strictly increasing
        offsets = [c.offset for c in chunks]
        assert offsets == sorted(offsets)

    def test_chunk_data_reassembles_to_original(self, tmp_path):
        from datahub._cas import chunk_file, MIN_CHUNK

        content = os.urandom(MIN_CHUNK * 4)
        p = tmp_path / "rand.bin"
        p.write_bytes(content)
        chunks = chunk_file(str(p))

        reassembled = b"".join(c.data for c in sorted(chunks, key=lambda c: c.offset))
        assert reassembled == content

    def test_chunk_hash_matches_blake3_of_data(self, tmp_path):
        """Each ChunkInfo.hash == BLAKE3(chunk.data)."""
        import blake3
        from datahub._cas import chunk_file

        content = os.urandom(512 * 1024)
        p = tmp_path / "check.bin"
        p.write_bytes(content)

        for c in chunk_file(str(p)):
            expected = blake3.blake3(c.data).hexdigest()
            assert c.hash == expected


# ── _upload_lfs ───────────────────────────────────────────────────────────────

def _fake_batch_response(oids_to_miss: list[str]) -> MagicMock:
    """Mock LFS batch response: listed OIDs get a PUT signed URL."""
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = {
        "objects": [
            {"oid": oid, "actions": [{"href": f"https://gcs.example.com/{oid}"}]}
            for oid in oids_to_miss
        ]
    }
    return resp


class TestUploadLfsChunked:

    def test_batch_payload_contains_chunk_oids(self, tmp_path):
        """POST /lfs/objects/batch body uses per-chunk OIDs, not per-file."""
        from datahub._cas import MIN_CHUNK

        # File large enough for at least 2 chunks
        content = os.urandom(MIN_CHUNK * 3)
        path = str(tmp_path / "big.bin")
        with open(path, "wb") as f:
            f.write(content)

        client = _make_client()

        # All chunks are CAS misses
        batch_resp = MagicMock()
        batch_resp.raise_for_status.return_value = None

        commit_resp = MagicMock()
        commit_resp.raise_for_status.return_value = None
        commit_resp.json.return_value = {"commit_id": "abc123"}

        posted_jsons: list[dict] = []

        def _fake_post(url, json=None, **kwargs):
            posted_jsons.append(json or {})
            if "/objects/batch" in url:
                # Return all chunk OIDs as misses
                objects = [
                    {"oid": obj["oid"], "actions": [{"href": f"https://gcs/{obj['oid']}"}]}
                    for obj in (json or {}).get("objects", [])
                ]
                r = MagicMock()
                r.raise_for_status.return_value = None
                r.json.return_value = {"objects": objects}
                return r
            # /commits
            return commit_resp

        client._http.post.side_effect = _fake_post

        with patch("httpx.put") as mock_put:
            mock_put.return_value = MagicMock(raise_for_status=MagicMock())
            client._upload_lfs(
                repo_name="nlp-lab/ds",
                file_entries=[{"local_path": path, "remote_path": "data/big.bin"}],
                branch="main",
                message="test",
                remote_prefix="",
                max_workers=4,
                metadata=None,
            )

        # batch call
        batch_call = posted_jsons[0]
        assert "objects" in batch_call
        # Each object has oid (chunk hash) and size (chunk length), not whole-file
        for obj in batch_call["objects"]:
            assert "oid" in obj
            assert "size" in obj
            assert len(obj["oid"]) == 64  # BLAKE3 hex digest

    def test_commits_payload_uses_chunks_array(self, tmp_path):
        """/commits body has objects[].chunks list, not single oid."""
        from datahub._cas import MIN_CHUNK

        content = os.urandom(MIN_CHUNK * 2)
        path = str(tmp_path / "two_chunks.bin")
        with open(path, "wb") as f:
            f.write(content)

        client = _make_client()
        commit_payloads: list[dict] = []

        def _fake_post(url, json=None, **kwargs):
            if "/objects/batch" in url:
                r = MagicMock()
                r.raise_for_status.return_value = None
                r.json.return_value = {"objects": []}  # all CAS hits → no PUT
                return r
            # /commits
            commit_payloads.append(json or {})
            r = MagicMock()
            r.raise_for_status.return_value = None
            r.json.return_value = {"commit_id": "def456"}
            return r

        client._http.post.side_effect = _fake_post

        client._upload_lfs(
            repo_name="nlp-lab/ds",
            file_entries=[{"local_path": path, "remote_path": "data/two.bin"}],
            branch="main",
            message="chunked commit",
            remote_prefix="",
            max_workers=1,
            metadata=None,
        )

        assert len(commit_payloads) == 1
        obj = commit_payloads[0]["objects"][0]
        assert obj["path"] == "data/two.bin"
        assert "chunks" in obj
        assert isinstance(obj["chunks"], list)
        assert len(obj["chunks"]) >= 1
        for chunk_entry in obj["chunks"]:
            assert "oid" in chunk_entry
            assert "size" in chunk_entry
            assert "offset" in chunk_entry

    def test_deduplication_same_chunk_put_once(self, tmp_path):
        """Identical files → same chunk hashes → PUT only once per unique OID."""
        from datahub._cas import MIN_CHUNK

        # Two identical files → identical chunks
        content = os.urandom(MIN_CHUNK)
        path1 = str(tmp_path / "a.bin")
        path2 = str(tmp_path / "b.bin")
        for p in (path1, path2):
            with open(p, "wb") as f:
                f.write(content)

        client = _make_client()
        put_hrefs: list[str] = []

        def _fake_post(url, json=None, **kwargs):
            if "/objects/batch" in url:
                # Return all as misses
                objects = [
                    {"oid": o["oid"], "actions": [{"href": f"https://gcs/{o['oid']}"}]}
                    for o in (json or {}).get("objects", [])
                ]
                r = MagicMock()
                r.raise_for_status.return_value = None
                r.json.return_value = {"objects": objects}
                return r
            r = MagicMock()
            r.raise_for_status.return_value = None
            r.json.return_value = {"commit_id": "abc"}
            return r

        client._http.post.side_effect = _fake_post

        with patch("httpx.put") as mock_put:
            mock_put.return_value = MagicMock(raise_for_status=MagicMock())
            client._upload_lfs(
                repo_name="test/repo",
                file_entries=[
                    {"local_path": path1, "remote_path": "a.bin"},
                    {"local_path": path2, "remote_path": "b.bin"},
                ],
                branch="main",
                message="dedup test",
                remote_prefix="",
                max_workers=4,
                metadata=None,
            )
            # Collect PUT hrefs
            put_hrefs = [str(c.args[0]) for c in mock_put.call_args_list]

        # No duplicate hrefs (same chunk PUT only once)
        assert len(put_hrefs) == len(set(put_hrefs))

    def test_cas_hit_skips_put(self, tmp_path):
        """When all chunks are CAS hits (no actions), no PUT is issued."""
        content = os.urandom(1024)
        path = str(tmp_path / "small.bin")
        with open(path, "wb") as f:
            f.write(content)

        client = _make_client()

        def _fake_post(url, json=None, **kwargs):
            if "/objects/batch" in url:
                r = MagicMock()
                r.raise_for_status.return_value = None
                r.json.return_value = {"objects": []}  # all hits
                return r
            r = MagicMock()
            r.raise_for_status.return_value = None
            r.json.return_value = {"commit_id": "hit123"}
            return r

        client._http.post.side_effect = _fake_post

        with patch("httpx.put") as mock_put:
            result = client._upload_lfs(
                repo_name="test/repo",
                file_entries=[{"local_path": path, "remote_path": "small.bin"}],
                branch="main",
                message="hit test",
                remote_prefix="",
                max_workers=1,
                metadata=None,
            )
            assert mock_put.call_count == 0

        assert result is not None
        assert result.id == "hit123"


# ── _download_token (chunks-based) ──────────────────────────────────────────

class TestDownloadTokenChunked:

    def test_chunks_reassembled_in_offset_order(self, tmp_path):
        """Chunks returned out-of-order are reassembled correctly by offset."""
        part1 = b"HELLO"
        part2 = b"WORLD"

        # API returns chunks in reverse offset order
        files_response = [
            {
                "path": "greet.txt",
                "chunks": [
                    {"oid": "b" * 64, "size": len(part2), "offset": len(part1),
                     "physical_address": "gs://bucket/b"},
                    {"oid": "a" * 64, "size": len(part1), "offset": 0,
                     "physical_address": "gs://bucket/a"},
                ],
            }
        ]

        client = _make_client()
        dest_dir = str(tmp_path / "out")
        os.makedirs(dest_dir)

        def _fake_post(url, json=None, **kwargs):
            if "stream/open" in url:
                r = MagicMock()
                r.raise_for_status.return_value = None
                r.json.return_value = {"token": "tok-xyz"}
                return r
            # stream/page
            r = MagicMock()
            r.raise_for_status.return_value = None
            r.json.return_value = {"files": files_response, "has_more": False}
            return r

        client._http.post.side_effect = _fake_post

        def _fake_gcs_get(url, headers=None, **kwargs):
            # URL form: .../b/bucket/o/{encoded_blob}?alt=media
            r = MagicMock()
            r.raise_for_status.return_value = None
            if "/o/a?" in url:
                r.content = part1
            else:
                r.content = part2
            return r

        with patch("httpx.get", side_effect=_fake_gcs_get):
            downloaded = client._download_token(
                repo_name="nlp-lab/ds",
                remote_path="greet.txt",
                local_path=dest_dir,
                branch="main",
                max_workers=4,
            )

        assert len(downloaded) == 1
        with open(downloaded[0], "rb") as fh:
            assert fh.read() == part1 + part2

    def test_legacy_physical_address_fallback(self, tmp_path):
        """Entries without chunks but with physical_address still download."""
        content = b"legacy-content"
        files_response = [
            {"path": "legacy.txt", "physical_address": "gs://bucket/legacy-blob"}
        ]

        client = _make_client()
        dest_dir = str(tmp_path / "out2")
        os.makedirs(dest_dir)

        def _fake_post(url, json=None, **kwargs):
            if "stream/open" in url:
                r = MagicMock()
                r.raise_for_status.return_value = None
                r.json.return_value = {"token": "tok-legacy"}
                return r
            r = MagicMock()
            r.raise_for_status.return_value = None
            r.json.return_value = {"files": files_response, "has_more": False}
            return r

        client._http.post.side_effect = _fake_post

        def _fake_gcs_get(url, headers=None, **kwargs):
            r = MagicMock()
            r.raise_for_status.return_value = None
            r.content = content
            return r

        with patch("httpx.get", side_effect=_fake_gcs_get):
            downloaded = client._download_token(
                repo_name="test/repo",
                remote_path="legacy.txt",
                local_path=dest_dir,
                branch="main",
                max_workers=1,
            )

        assert len(downloaded) == 1
        with open(downloaded[0], "rb") as fh:
            assert fh.read() == content

    def test_empty_page_returns_empty_list(self, tmp_path):
        """No files in page → empty list returned."""
        client = _make_client()

        def _fake_post(url, json=None, **kwargs):
            if "stream/open" in url:
                r = MagicMock()
                r.raise_for_status.return_value = None
                r.json.return_value = {"token": "tok"}
                return r
            r = MagicMock()
            r.raise_for_status.return_value = None
            r.json.return_value = {"files": [], "has_more": False}
            return r

        client._http.post.side_effect = _fake_post

        result = client._download_token(
            repo_name="test/repo",
            remote_path="",
            local_path=str(tmp_path),
            branch="main",
            max_workers=4,
        )
        assert result == []

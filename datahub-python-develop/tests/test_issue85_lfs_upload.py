"""Issue #85 — Type A LFS upload tests.

Tests for:
  - _blake3_hash_file: BLAKE3 hash + size
  - _upload_lfs: LFS batch preflight + signed URL PUT + /commits
  - upload (public API): delegates to _upload_lfs
"""

from __future__ import annotations

import os
from unittest.mock import MagicMock, call, patch

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
    # Reset so test-specific call_args_list starts fresh
    mock_http.post.reset_mock()
    return client, mock_http


def _fake_batch_response(objects: list[dict]) -> MagicMock:
    """Build a mock batch response with given per-object results."""
    resp = MagicMock()
    resp.json.return_value = {
        "objects": objects,
        "cab_token": "ya29.cab",
        "bucket": "lgair-datahub-repo",
    }
    return resp


def _fake_commit_response(commit_id: str = "commit-abc") -> MagicMock:
    resp = MagicMock()
    resp.json.return_value = {"commit_id": commit_id}
    return resp


# ──────────────────────────────────────────────
# _blake3_hash_file
# ──────────────────────────────────────────────

class TestBlake3HashFile:
    def test_returns_hex_and_size(self, tmp_path):
        from datahub.client import DataClient

        f = tmp_path / "sample.bin"
        content = b"hello datahub"
        f.write_bytes(content)

        oid, size = DataClient._blake3_hash_file(str(f))

        assert len(oid) == 64  # BLAKE3 hex = 32 bytes = 64 chars
        assert size == len(content)
        # deterministic
        oid2, size2 = DataClient._blake3_hash_file(str(f))
        assert oid == oid2
        assert size == size2

    def test_different_content_gives_different_hash(self, tmp_path):
        from datahub.client import DataClient

        f1 = tmp_path / "a.bin"
        f2 = tmp_path / "b.bin"
        f1.write_bytes(b"aaa")
        f2.write_bytes(b"bbb")

        oid1, _ = DataClient._blake3_hash_file(str(f1))
        oid2, _ = DataClient._blake3_hash_file(str(f2))
        assert oid1 != oid2

    def test_empty_file(self, tmp_path):
        from datahub.client import DataClient

        f = tmp_path / "empty.bin"
        f.write_bytes(b"")
        oid, size = DataClient._blake3_hash_file(str(f))
        assert size == 0
        assert len(oid) == 64


# ──────────────────────────────────────────────
# _upload_lfs
# ──────────────────────────────────────────────

class TestUploadLfs:
    def _write_file(self, tmp_path, name: str, content: bytes = b"data") -> str:
        p = tmp_path / name
        p.write_bytes(content)
        return str(p)

    def test_cas_miss_calls_put_and_commit(self, tmp_path):
        """CAS miss: signed URL PUT 호출 후 /commits."""
        client, mock_http = _make_client()
        local = self._write_file(tmp_path, "data.csv", b"col1,col2\n1,2\n")

        from datahub.client import DataClient
        oid, size = DataClient._blake3_hash_file(local)

        batch_resp = _fake_batch_response([{
            "oid": oid,
            "actions": [{"href": "https://storage.googleapis.com/signed-put-url"}],
        }])
        commit_resp = _fake_commit_response("abc123")
        mock_http.post.side_effect = [batch_resp, commit_resp]

        with patch("httpx.put") as mock_put:
            mock_put.return_value = MagicMock(raise_for_status=MagicMock())
            result = client.upload("my-repo", local, branch="main", message="test")

        assert result is not None
        assert result.id == "abc123"
        mock_put.assert_called_once()
        _, put_kwargs = mock_put.call_args
        assert put_kwargs["headers"]["Content-Type"] == "application/octet-stream"

    def test_cas_hit_skips_put(self, tmp_path):
        """CAS hit: PUT 호출 없이 /commits만."""
        client, mock_http = _make_client()
        local = self._write_file(tmp_path, "data.bin", b"already in cas")

        from datahub.client import DataClient
        oid, size = DataClient._blake3_hash_file(local)

        batch_resp = _fake_batch_response([{"oid": oid, "actions": []}])
        commit_resp = _fake_commit_response("hit-commit")
        mock_http.post.side_effect = [batch_resp, commit_resp]

        with patch("httpx.put") as mock_put:
            result = client.upload("my-repo", local, branch="main", message="hit")

        assert result is not None
        assert result.id == "hit-commit"
        mock_put.assert_not_called()

    def test_mixed_hit_and_miss(self, tmp_path):
        """2 files: 1 hit + 1 miss."""
        import tempfile

        client, mock_http = _make_client()
        local_hit = self._write_file(tmp_path, "hit.bin", b"already exists")
        local_miss = self._write_file(tmp_path, "miss.bin", b"new content")

        from datahub.client import DataClient
        oid_hit, _ = DataClient._blake3_hash_file(local_hit)
        oid_miss, _ = DataClient._blake3_hash_file(local_miss)

        batch_resp = _fake_batch_response([
            {"oid": oid_hit, "actions": []},
            {"oid": oid_miss, "actions": [{"href": "https://gcs/signed"}]},
        ])
        commit_resp = _fake_commit_response("mixed-commit")
        mock_http.post.side_effect = [batch_resp, commit_resp]

        # Create a tmpdir with both files so upload() picks them both up
        upload_dir = tmp_path / "upload"
        upload_dir.mkdir()
        (upload_dir / "hit.bin").write_bytes(b"already exists")
        (upload_dir / "miss.bin").write_bytes(b"new content")

        with patch("httpx.put") as mock_put:
            mock_put.return_value = MagicMock(raise_for_status=MagicMock())
            result = client.upload("my-repo", str(upload_dir), branch="main", message="mixed")

        assert result.id == "mixed-commit"
        assert mock_put.call_count == 1
        put_url = mock_put.call_args[0][0]
        assert "gcs/signed" in put_url

    def test_commit_payload_has_path_and_chunks(self, tmp_path):
        """POST /commits payload에 path와 chunks 배열 포함 확인 (fastcdc #18)."""
        client, mock_http = _make_client()
        local = self._write_file(tmp_path, "train.jsonl", b'{"text":"hello"}\n')

        batch_resp = _fake_batch_response([])  # all CAS hits
        commit_resp = _fake_commit_response("payload-commit")
        mock_http.post.side_effect = [batch_resp, commit_resp]

        with patch("httpx.put"):
            client.upload("my-repo", local, branch="develop", message="payload check")

        # Second post call is /commits
        commit_call = mock_http.post.call_args_list[1]
        url = commit_call.args[0]
        body = commit_call.kwargs["json"]
        assert "commits" in url
        assert body["branch"] == "develop"
        assert body["message"] == "payload check"
        assert len(body["objects"]) == 1
        obj = body["objects"][0]
        assert "train.jsonl" in obj["path"]
        # New chunked format: chunks array instead of single oid
        assert "chunks" in obj
        assert isinstance(obj["chunks"], list)
        assert len(obj["chunks"]) >= 1
        total_size = sum(c["size"] for c in obj["chunks"])
        assert total_size == len(b'{"text":"hello"}\n')
        for c in obj["chunks"]:
            assert "oid" in c and "size" in c and "offset" in c

    def test_batch_payload_has_oid_and_size(self, tmp_path):
        """POST /lfs/objects/batch payload 구조 확인."""
        client, mock_http = _make_client()
        local = self._write_file(tmp_path, "file.bin", b"content")

        from datahub.client import DataClient
        oid, size = DataClient._blake3_hash_file(local)

        batch_resp = _fake_batch_response([{"oid": oid, "actions": []}])
        commit_resp = _fake_commit_response("batch-commit")
        mock_http.post.side_effect = [batch_resp, commit_resp]

        with patch("httpx.put"):
            client.upload("my-repo", local, branch="main", message="x")

        batch_call = mock_http.post.call_args_list[0]
        url = batch_call.args[0]
        body = batch_call.kwargs["json"]
        assert "lfs/objects/batch" in url
        assert body["branch"] == "main"
        assert len(body["objects"]) == 1
        assert body["objects"][0]["oid"] == oid
        assert body["objects"][0]["size"] == size

    def test_remote_prefix_applied(self, tmp_path):
        """remote_prefix가 remote_path에 적용된다."""
        client, mock_http = _make_client()
        local = self._write_file(tmp_path, "a.txt", b"hello")

        from datahub.client import DataClient
        oid, size = DataClient._blake3_hash_file(local)

        batch_resp = _fake_batch_response([{"oid": oid, "actions": []}])
        commit_resp = _fake_commit_response("prefix-commit")
        mock_http.post.side_effect = [batch_resp, commit_resp]

        with patch("httpx.put"):
            client.upload("my-repo", local, remote_prefix="subdir/", message="prefix")

        commit_call = mock_http.post.call_args_list[1]
        body = commit_call.kwargs["json"]
        assert body["objects"][0]["path"] == "subdir/a.txt"

    def test_empty_file_entries_returns_none(self):
        """파일이 없으면 None 반환."""
        client, _ = _make_client()
        result = client._upload_lfs("my-repo", [], "main", "msg", "", 4, None)
        assert result is None

    def test_commit_no_id_returns_none(self, tmp_path):
        """서버가 commit_id 없이 응답 시 None 반환."""
        client, mock_http = _make_client()
        local = self._write_file(tmp_path, "f.bin", b"data")

        from datahub.client import DataClient
        oid, _ = DataClient._blake3_hash_file(local)

        batch_resp = _fake_batch_response([{"oid": oid, "actions": []}])
        no_id_resp = MagicMock()
        no_id_resp.json.return_value = {}
        mock_http.post.side_effect = [batch_resp, no_id_resp]

        with patch("httpx.put"):
            result = client.upload("my-repo", local, message="no id")

        assert result is None

    def test_parallel_upload_uses_thread_pool(self, tmp_path):
        """여러 CAS miss는 ThreadPoolExecutor 병렬 업로드."""
        client, mock_http = _make_client()
        upload_dir = tmp_path / "multi"
        upload_dir.mkdir()
        (upload_dir / "a.bin").write_bytes(b"file a")
        (upload_dir / "b.bin").write_bytes(b"file b")
        (upload_dir / "c.bin").write_bytes(b"file c")

        from datahub.client import DataClient
        oid_a, _ = DataClient._blake3_hash_file(str(upload_dir / "a.bin"))
        oid_b, _ = DataClient._blake3_hash_file(str(upload_dir / "b.bin"))
        oid_c, _ = DataClient._blake3_hash_file(str(upload_dir / "c.bin"))

        batch_resp = _fake_batch_response([
            {"oid": oid_a, "actions": [{"href": "https://gcs/a"}]},
            {"oid": oid_b, "actions": [{"href": "https://gcs/b"}]},
            {"oid": oid_c, "actions": [{"href": "https://gcs/c"}]},
        ])
        commit_resp = _fake_commit_response("parallel-commit")
        mock_http.post.side_effect = [batch_resp, commit_resp]

        with patch("httpx.put") as mock_put:
            mock_put.return_value = MagicMock(raise_for_status=MagicMock())
            result = client.upload("my-repo", str(upload_dir), max_workers=4)

        assert result.id == "parallel-commit"
        assert mock_put.call_count == 3

    def test_upload_many_commits_multiple_dirs(self, tmp_path):
        """upload_many: 여러 로컬 경로 → 단일 커밋."""
        client, mock_http = _make_client()
        dir_a = tmp_path / "src_a"
        dir_a.mkdir()
        (dir_a / "x.bin").write_bytes(b"x")
        dir_b = tmp_path / "src_b"
        dir_b.mkdir()
        (dir_b / "y.bin").write_bytes(b"y")

        from datahub.client import DataClient
        oid_x, _ = DataClient._blake3_hash_file(str(dir_a / "x.bin"))
        oid_y, _ = DataClient._blake3_hash_file(str(dir_b / "y.bin"))

        batch_resp = _fake_batch_response([
            {"oid": oid_x, "actions": []},
            {"oid": oid_y, "actions": []},
        ])
        commit_resp = _fake_commit_response("many-commit")
        mock_http.post.side_effect = [batch_resp, commit_resp]

        with patch("httpx.put"):
            result = client.upload_many("my-repo", [str(dir_a), str(dir_b)])

        assert result.id == "many-commit"
        commit_call = mock_http.post.call_args_list[1]
        body = commit_call.kwargs["json"]
        paths = {o["path"] for o in body["objects"]}
        assert any("src_a/x.bin" in p for p in paths)
        assert any("src_b/y.bin" in p for p in paths)

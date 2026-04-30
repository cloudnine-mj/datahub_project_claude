"""datahub-python 통합 테스트 — httpx.MockTransport + GCS SDK mock 기반.

DataHub API 계층은 httpx.MockTransport로, GCS 전송 계층은 google-cloud-storage SDK
mock으로 시뮬레이션하여 upload → SDK upload_from_filename → complete /
download → GCS stream 전체 플로우를 검증한다.
"""

from __future__ import annotations

import base64
import hashlib
import json
import time
from datetime import datetime, timezone
from io import BytesIO
from typing import Callable
from unittest.mock import MagicMock, patch

import httpx
import pytest

from datahub.types import CommitInfo, ListResult


# ──────────────────────────────────────────────────────────────
# MockTransport helpers
# ──────────────────────────────────────────────────────────────


class Router:
    """간단한 URL-path 라우터. (method, path) → handler."""

    def __init__(self):
        self._routes: list[tuple[str, str, Callable]] = []

    def add(self, method: str, path: str, handler: Callable):
        self._routes.append((method.upper(), path, handler))

    def __call__(self, request: httpx.Request) -> httpx.Response:
        for method, path, handler in self._routes:
            if request.method == method and request.url.path == path:
                return handler(request)
        return httpx.Response(
            404,
            json={"error": f"Not Found: {request.method} {request.url.path}"},
        )


def _make_client_with_transport(transport: httpx.MockTransport):
    """MockTransport를 주입한 DataClient 인스턴스를 반환한다.

    patch 전에 실제 httpx.Client를 생성해야 mock 호출로 대체되지 않는다.
    """
    from datahub.client import DataClient
    from datahub.config import AuthConfig, DataHubConfig

    cfg = DataHubConfig(auth=AuthConfig(endpoint="http://mock-api:8000", api_key="test-key"))

    # patch 외부에서 진짜 httpx.Client 생성 (MockTransport 주입)
    real_client = httpx.Client(
        base_url="http://mock-api:8000",
        headers={"X-API-Key": "test-key"},
        transport=transport,
    )

    # DataClient.__init__에서 httpx.Client() 호출 → real_client 반환
    with patch("httpx.Client", return_value=real_client):
        client = DataClient(cfg)

    return client


# ──────────────────────────────────────────────────────────────
# ──────────────────────────────────────────────────────────────


def _make_upload_blob_mock(md5_hex: str = "deadbeef" * 4) -> MagicMock:
    """GCS blob mock. blob.reload() 후 md5_hash는 base64 인코딩 값을 반환."""
    blob = MagicMock()
    blob.md5_hash = base64.b64encode(bytes.fromhex(md5_hex)).decode()
    return blob


class TestUploadE2E:

    def _build_router(self, repo: str, captured_commits: list, oids_to_href: dict | None = None):
        """LFS batch + /commits 엔드포인트를 시뮬레이션하는 MockTransport 라우터.

        oids_to_href: {oid: signed_put_url} — 포함된 oid는 CAS miss (PUT 필요),
                      없는 oid는 CAS hit (PUT 불필요, actions=[]).
        """
        oids_to_href = oids_to_href or {}
        router = Router()

        def session(req):
            return httpx.Response(200, json={"email": "siu@example.com", "user_id": 7})

        def lfs_batch(req):
            body = json.loads(req.content)
            objects = []
            for obj in body.get("objects", []):
                oid = obj["oid"]
                href = oids_to_href.get(oid)
                if href:
                    objects.append({"oid": oid, "actions": [{"href": href}]})
                else:
                    objects.append({"oid": oid, "actions": []})
            return httpx.Response(200, json={
                "objects": objects,
                "cab_token": "ya29.e2e-token",
                "bucket": "lgair-datahub-repo",
            })

        def commits(req):
            body = json.loads(req.content)
            captured_commits.append(body)
            return httpx.Response(200, json={"commit_id": "e2e-commit-abc"})

        router.add("POST", "/api/v1/auth/session", session)
        router.add("POST", f"/api/v1/repos/{repo}/lfs/objects/batch", lfs_batch)
        router.add("POST", f"/api/v1/repos/{repo}/lfs/commits", commits)
        return router

    def test_single_file_upload(self, tmp_path):
        """단일 파일 → LFS batch + PUT + /commits → CommitInfo 반환."""
        captured_commits: list = []
        repo = "test-dataset"

        test_file = tmp_path / "train.csv"
        test_file.write_text("col1,col2\n1,2\n3,4\n")

        from datahub.client import DataClient
        oid, size = DataClient._blake3_hash_file(str(test_file))

        router = self._build_router(repo, captured_commits, oids_to_href={oid: "https://gcs/signed-put"})
        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        with patch("httpx.put") as mock_put:
            mock_put.return_value = MagicMock(raise_for_status=MagicMock())
            result = client.upload(repo, str(test_file), branch="main", message="e2e upload")

        assert isinstance(result, CommitInfo)
        assert result.id == "e2e-commit-abc"
        mock_put.assert_called_once()

        assert len(captured_commits) == 1
        body = captured_commits[0]
        assert body["message"] == "e2e upload"
        assert len(body["objects"]) == 1
        obj = body["objects"][0]
        # New chunked format: chunks array instead of single oid (#18)
        assert "chunks" in obj
        assert len(obj["chunks"]) >= 1
        # For small files, single chunk oid == whole-file hash
        assert obj["chunks"][0]["oid"] == oid
        assert sum(c["size"] for c in obj["chunks"]) == size

    def test_multi_file_upload(self, tmp_path):
        """디렉토리 업로드 (여러 파일) → 파일당 PUT 한 번씩."""
        captured_commits: list = []
        repo = "multi-dataset"

        (tmp_path / "train.csv").write_text("a,b\n1,2\n")
        (tmp_path / "test.csv").write_text("a,b\n3,4\n")
        (tmp_path / "meta.json").write_text('{"version": 1}')

        from datahub.client import DataClient
        oids_to_href = {
            DataClient._blake3_hash_file(str(tmp_path / "train.csv"))[0]: "https://gcs/train",
            DataClient._blake3_hash_file(str(tmp_path / "test.csv"))[0]: "https://gcs/test",
            DataClient._blake3_hash_file(str(tmp_path / "meta.json"))[0]: "https://gcs/meta",
        }

        router = self._build_router(repo, captured_commits, oids_to_href=oids_to_href)
        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        with patch("httpx.put") as mock_put:
            mock_put.return_value = MagicMock(raise_for_status=MagicMock())
            result = client.upload(repo, str(tmp_path), branch="main", message="multi upload")

        assert isinstance(result, CommitInfo)
        assert mock_put.call_count == 3  # 파일 3개 모두 CAS miss
        assert len(captured_commits) == 1
        assert len(captured_commits[0]["objects"]) == 3

    def test_commit_objects_have_correct_oid(self, tmp_path):
        """/commits body에 BLAKE3 oid와 size가 포함되는지 확인."""
        captured_commits: list = []
        repo = "checksum-test"

        content = b"hello,world\n1,2\n"
        test_file = tmp_path / "data.csv"
        test_file.write_bytes(content)

        from datahub.client import DataClient
        expected_oid, expected_size = DataClient._blake3_hash_file(str(test_file))

        # CAS hit (no PUT needed)
        router = self._build_router(repo, captured_commits, oids_to_href={})
        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        with patch("httpx.put"):
            client.upload(repo, str(test_file), branch="main")

        assert len(captured_commits) == 1
        obj = captured_commits[0]["objects"][0]
        # New chunked format: chunks array instead of single oid (#18)
        assert "chunks" in obj
        assert len(obj["chunks"]) >= 1
        # For small files, single chunk oid == whole-file BLAKE3 hash
        assert obj["chunks"][0]["oid"] == expected_oid
        assert sum(c["size"] for c in obj["chunks"]) == expected_size

    def test_cab_error_propagates(self, tmp_path):
        """upload-token 실패 시 fallback 없이 예외가 전파된다."""
        router = Router()

        def session(req):
            return httpx.Response(200, json={"email": "siu@example.com", "user_id": 7})

        def upload_open_fail(req):
            return httpx.Response(403, json={"error": "Access denied"})

        router.add("POST", "/api/v1/auth/session", session)
        router.add("POST", "/api/v1/repos/err-repo/upload/stream/open", upload_open_fail)

        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        test_file = tmp_path / "f.csv"
        test_file.write_text("x\n1\n")

        with pytest.raises(Exception):
            client.upload("err-repo", str(test_file), branch="main")


# ──────────────────────────────────────────────────────────────
# ──────────────────────────────────────────────────────────────


class TestDownloadE2E:

    def _build_router(self, repo: str, file_contents: dict[str, bytes]):
        """Type B 다운로드: POST stream/open + stream/page 엔드포인트를 mock."""
        router = Router()

        def session(req):
            return httpx.Response(200, json={"email": "siu@example.com", "user_id": 7})

        def stream_open(req):
            return httpx.Response(
                200,
                json={"token": "ya29.dl-token", "token_expiry": "2099-01-01T00:00:00Z"},
            )

        def stream_page(req):
            return httpx.Response(
                200,
                json={
                    "files": [
                        {
                            "path": name,
                            "physical_address": f"gs://lgair-datahub-repo/{repo}/data/{name}",
                        }
                        for name in file_contents
                    ],
                    "has_more": False,
                    "next_offset": None,
                },
            )

        router.add("POST", "/api/v1/auth/session", session)
        router.add("POST", f"/api/v1/repos/{repo}/download/stream/open", stream_open)
        router.add("POST", f"/api/v1/repos/{repo}/download/stream/page", stream_page)
        return router

    def _make_gcs_httpx_mock(self, file_contents: dict[str, bytes]) -> MagicMock:
        """httpx.get() 호출 시 파일 내용을 반환하는 mock."""
        def _gcs_side_effect(url, **kwargs):
            # URL 마지막 경로 세그먼트(인코딩 전 파일명) 추출
            filename = url.split("/")[-1].split("?")[0]
            import urllib.parse
            filename = urllib.parse.unquote(filename).split("/")[-1]
            content = file_contents.get(filename, b"")
            resp = MagicMock()
            resp.content = content
            resp.raise_for_status = MagicMock()
            return resp

        return MagicMock(side_effect=_gcs_side_effect)

    def test_single_file_download(self, tmp_path):
        """단일 파일 다운로드 → 로컬 파일로 저장."""
        file_contents = {"train.csv": b"col1,col2\n1,2\n3,4\n"}
        repo = "dl-dataset"
        router = self._build_router(repo, file_contents)
        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        dest = tmp_path / "train.csv"
        mock_gcs_get = self._make_gcs_httpx_mock(file_contents)

        with patch("httpx.get", mock_gcs_get):
            result = client.download(repo, "train.csv", str(dest), branch="main")

        assert len(result) == 1
        assert dest.exists()
        assert dest.read_bytes() == file_contents["train.csv"]

    def test_token_passed_as_bearer_header(self, tmp_path):
        """다운로드 토큰이 GCS 요청에 Authorization: Bearer로 전달되는지 확인."""
        file_contents = {"data.parquet": b"PAR1\x00\x00fake-parquet-content"}
        repo = "auth-check"
        router = self._build_router(repo, file_contents)
        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        dest = tmp_path / "data.parquet"
        captured_headers: list[dict] = []

        def capture_gcs_get(url, **kwargs):
            captured_headers.append(kwargs.get("headers", {}))
            resp = MagicMock()
            resp.content = file_contents["data.parquet"]
            resp.raise_for_status = MagicMock()
            return resp

        with patch("httpx.get", side_effect=capture_gcs_get):
            client.download(repo, "data.parquet", str(dest), branch="main")

        assert len(captured_headers) == 1
        assert captured_headers[0].get("Authorization") == "Bearer ya29.dl-token"

    def test_gcs_url_uses_json_api_format(self, tmp_path):
        """GCS JSON API URL 형식 확인 — bucket/blob 경로 인코딩 검증."""
        # gs://lgair-datahub-repo/url-conv/data/train.csv
        # → GET https://storage.googleapis.com/download/storage/v1/b/lgair-datahub-repo/o/url-conv%2Fdata%2Ftrain.csv?alt=media
        file_contents = {"train.csv": b"a,b\n1,2\n"}
        repo = "url-conv"
        router = self._build_router(repo, file_contents)
        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        dest = tmp_path / "train.csv"
        captured_urls: list[str] = []

        def capture_gcs_get(url, **kwargs):
            captured_urls.append(url)
            resp = MagicMock()
            resp.content = b"a,b\n1,2\n"
            resp.raise_for_status = MagicMock()
            return resp

        with patch("httpx.get", side_effect=capture_gcs_get):
            client.download(repo, "train.csv", str(dest), branch="main")

        assert len(captured_urls) == 1
        url = captured_urls[0]
        assert "storage.googleapis.com/download/storage/v1/b/lgair-datahub-repo/o/" in url
        assert "alt=media" in url
        assert "%2F" in url  # blob path slashes URL-encoded


# ──────────────────────────────────────────────────────────────
# ──────────────────────────────────────────────────────────────


class TestGetFileManifestE2E:
    """get_file_manifest() 3-tuple 반환 및 expires_at fallback."""

    def test_manifest_with_expiry(self):
        router = Router()
        expires = time.time() + 7200
        expires_iso = datetime.fromtimestamp(expires, tz=timezone.utc).isoformat()

        def session(req):
            return httpx.Response(200, json={"email": "siu@example.com", "user_id": 7})

        def download_open(req):
            return httpx.Response(200, json={
                "token": "ya29.manifest-token",
                "token_expiry": expires_iso,
            })

        def download_page(req):
            return httpx.Response(200, json={
                "files": [
                    {"path": "train.parquet", "physical_address": "gs://bucket/train.parquet"},
                    {"path": "test.parquet", "physical_address": "gs://bucket/test.parquet"},
                ],
                "has_more": False,
                "next_offset": None,
            })

        router.add("POST", "/api/v1/auth/session", session)
        router.add("POST", "/api/v1/repos/my-ds/download/stream/open", download_open)
        router.add("POST", "/api/v1/repos/my-ds/download/stream/page", download_page)

        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        token, files, exp = client.get_file_manifest("my-ds", "main")
        assert token == "ya29.manifest-token"
        assert len(files) == 2
        assert files[0]["path"] == "train.parquet"
        assert exp == pytest.approx(expires, abs=1)

    def test_manifest_expires_at_fallback(self):
        """API가 expiry 미반환 시 1시간 fallback."""
        router = Router()

        def session(req):
            return httpx.Response(200, json={"email": "siu@example.com", "user_id": 7})

        def download_open(req):
            return httpx.Response(200, json={"token": "ya29.no-expiry", "token_expiry": ""})

        def download_page(req):
            return httpx.Response(200, json={"files": [], "has_more": False, "next_offset": None})

        router.add("POST", "/api/v1/auth/session", session)
        router.add("POST", "/api/v1/repos/ds/download/stream/open", download_open)
        router.add("POST", "/api/v1/repos/ds/download/stream/page", download_page)

        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        _, _, exp = client.get_file_manifest("ds", "main")
        assert exp == pytest.approx(time.time() + 3600, abs=5)


# ──────────────────────────────────────────────────────────────
# CLI E2E — cp 커맨드 전체 플로우
# ──────────────────────────────────────────────────────────────


class TestCpE2E:
    """CLI `datahub cp` 커맨드 E2E — mock DataClient 사용."""

    def test_cli_upload_e2e(self, tmp_path):
        """CLI cp upload → client.upload() 정상 호출 → commit ID 출력."""
        from click.testing import CliRunner
        from datahub.cli import cli

        runner = CliRunner()
        test_file = tmp_path / "data.csv"
        test_file.write_text("a,b\n1,2\n")

        with patch("datahub.client.DataClient") as mock_cls:
            client = MagicMock()
            client.identity.email = "siu@example.com"
            client.upload.return_value = CommitInfo(id="cli-e2e-commit", message="e2e")
            mock_cls.return_value = client

            result = runner.invoke(cli, [
                "cp", str(test_file), "dh://nlp-lab/e2e-repo/",
                "--message", "e2e upload test",
            ])

        assert result.exit_code == 0, result.output
        assert "cli-e2e-commit" in result.output
        call_kwargs = client.upload.call_args
        assert call_kwargs[0] == ("nlp-lab/e2e-repo", str(test_file))
        assert call_kwargs[1]["branch"] == "main"
        assert call_kwargs[1]["message"] == "e2e upload test"
        assert call_kwargs[1]["max_workers"] == 8
        assert call_kwargs[1]["multi"] is False
        assert callable(call_kwargs[1]["on_progress"])

    def test_cli_download_e2e(self, tmp_path):
        """CLI cp download → client.download() 정상 호출 → 파일 수 출력."""
        from click.testing import CliRunner
        from datahub.cli import cli

        dest = str(tmp_path / "output/")
        downloaded_files = [str(tmp_path / "output" / "train.csv")]

        with patch("datahub.client.DataClient") as mock_cls:
            client = MagicMock()
            client.identity.email = "siu@example.com"
            client.download.return_value = downloaded_files
            mock_cls.return_value = client

            runner = CliRunner()
            result = runner.invoke(cli, [
                "cp", "dh://nlp-lab/e2e-repo/train.csv", dest,
            ])

        assert result.exit_code == 0, result.output
        assert "Download complete" in result.output and "1 file(s)" in result.output
        call_kwargs = client.download.call_args
        assert call_kwargs[0] == ("nlp-lab/e2e-repo", "train.csv", dest)
        assert call_kwargs[1]["branch"] == "main"
        assert call_kwargs[1]["max_workers"] == 8
        assert call_kwargs[1]["multi"] is False
        assert callable(call_kwargs[1]["on_progress"])

    def test_cli_branch_flag(self, tmp_path):
        """`-b experiment/aug-v3` 플래그로 브랜치 지정 후 정상 전달."""
        from click.testing import CliRunner
        from datahub.cli import cli

        with patch("datahub.client.DataClient") as mock_cls:
            client = MagicMock()
            client.identity.email = "siu@example.com"
            client.download.return_value = []
            mock_cls.return_value = client

            runner = CliRunner()
            result = runner.invoke(cli, [
                "cp",
                "dh://nlp-lab/datasets/train.parquet",
                str(tmp_path),
                "-b", "experiment/aug-v3",
            ])

        assert result.exit_code == 0, result.output
        call_kwargs = client.download.call_args
        assert call_kwargs[0] == ("nlp-lab/datasets", "train.parquet", str(tmp_path))
        assert call_kwargs[1]["branch"] == "experiment/aug-v3"
        assert call_kwargs[1]["max_workers"] == 8
        assert call_kwargs[1]["multi"] is False


# ──────────────────────────────────────────────────────────────
# dh:// → dh:// copy 테스트
# ──────────────────────────────────────────────────────────────


class TestCopyE2E:
    """client.copy() — dh:// → dh:// 전용 통합 테스트."""

    def test_copy_unsupported_raises(self):
        """dh:// URI가 아닌 조합은 ValueError."""
        router = Router()

        def session(req):
            return httpx.Response(200, json={"email": "siu@example.com", "user_id": 7})

        router.add("POST", "/api/v1/auth/session", session)
        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        with pytest.raises(ValueError, match="dh://"):
            client.copy("./local/", "./other/")

    def test_parse_physical_address(self):
        """_parse_physical_address() — bucket/path 분리."""
        from datahub.client import DataClient
        bucket, path = DataClient._parse_physical_address("gs://my-bucket/data/train.csv")
        assert bucket == "my-bucket"
        assert path == "data/train.csv"

    def test_parse_physical_address_root(self):
        """_parse_physical_address() — path 없는 경우."""
        from datahub.client import DataClient
        bucket, path = DataClient._parse_physical_address("gs://my-bucket")
        assert bucket == "my-bucket"
        assert path == ""

    def test_parse_physical_address_invalid(self):
        from datahub.client import DataClient
        with pytest.raises(ValueError, match="gs://"):
            DataClient._parse_physical_address("s3://bucket/path")

    def test_copy_dh_to_dh_via_streaming_copy(self):
        router = Router()

        def session(req):
            return httpx.Response(200, json={"email": "siu@example.com", "user_id": 7})

        def copy_open(req):
            body = json.loads(req.content)
            assert body["src_repo"] == "src-org/src-repo"
            assert body["src_branch"] == "main"
            assert body["dest_branch"] == "main"
            assert body["commit_message"] == "cross-repo copy"
            return httpx.Response(200, json={"session_id": "copy-sess-001", "expires_at": 9999999999})

        def copy_page(req):
            body = json.loads(req.content)
            assert body["session_id"] == "copy-sess-001"
            assert "paths" in body
            return httpx.Response(200, json={"files_accepted": 1, "files_skipped": 0})

        def copy_commit(req):
            body = json.loads(req.content)
            assert body["session_id"] == "copy-sess-001"
            return httpx.Response(200, json={"commit_id": "copy-commit-abc", "files_committed": 1})

        router.add("POST", "/api/v1/auth/session", session)
        router.add("POST", "/api/v1/repos/dst-org/dst-repo/copy/stream/open", copy_open)
        router.add("POST", "/api/v1/repos/dst-org/dst-repo/copy/stream/page", copy_page)
        router.add("POST", "/api/v1/repos/dst-org/dst-repo/copy/stream/commit", copy_commit)
        transport = httpx.MockTransport(router)
        client = _make_client_with_transport(transport)

        result = client.copy(
            "dh://src-org/src-repo/data/",
            "dh://dst-org/dst-repo/",
            message="cross-repo copy",
        )

        assert isinstance(result, CommitInfo)
        assert result.id == "copy-commit-abc"

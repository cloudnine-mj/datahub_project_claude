"""Live GCS-backed E2E tests for the canonical file API surface.

Run only against dev after the API runtime service account has object-level GCS
permissions on test buckets.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from urllib.parse import quote

import httpx
import pytest
from google.cloud import storage
from google.oauth2.credentials import Credentials

pytestmark = pytest.mark.e2e


def _required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        pytest.skip(f"{name} is required for live file API E2E tests")
    return value


def _load_access_token() -> str:
    token = os.environ.get("DATAHUB_ACCESS_TOKEN")
    if token:
        return token
    for path in (
        Path.home() / ".datahub" / "credentials.json",
        Path.home() / ".config" / "datahub" / "credentials.json",
    ):
        if not path.is_file():
            continue
        data = json.loads(path.read_text())
        token = data.get("token") or data.get("access_token")
        if token:
            return token
    pytest.skip("DATAHUB_ACCESS_TOKEN or ~/.datahub/credentials.json is required")


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@pytest.fixture(scope="module")
def api() -> httpx.Client:
    endpoint = _required_env("DATAHUB_E2E_ENDPOINT")
    token = _load_access_token()
    client = httpx.Client(
        base_url=endpoint.rstrip("/"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=60.0,
        verify=False,
    )
    try:
        yield client
    finally:
        client.close()


@pytest.fixture(scope="module")
def owner() -> str:
    return _required_env("DATAHUB_E2E_ORG")


@pytest.fixture(scope="module")
def repo(api: httpx.Client, owner: str) -> str:
    name = f"e2e-api-files-{int(time.time() * 1000) % 100000}"
    response = api.post("/api/v1/repos", json={"group": owner, "repo_name": name})
    response.raise_for_status()
    repo_id = f"{owner}/{name}"
    try:
        yield repo_id
    finally:
        api.delete(f"/api/v1/repos/{repo_id}", headers={"Idempotency-Key": f"cleanup-{name}"})


@pytest.fixture(scope="module")
def copy_repo(api: httpx.Client, owner: str) -> str:
    name = f"e2e-api-copy-{int(time.time() * 1000) % 100000}"
    response = api.post("/api/v1/repos", json={"group": owner, "repo_name": name})
    response.raise_for_status()
    repo_id = f"{owner}/{name}"
    try:
        yield repo_id
    finally:
        api.delete(f"/api/v1/repos/{repo_id}", headers={"Idempotency-Key": f"cleanup-{name}"})


def _storage_client(token: str) -> storage.Client:
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("DATAHUB_E2E_GCP_PROJECT")
    return storage.Client(project=project, credentials=Credentials(token=token))


def _put_gcs_object(transfer: dict, path: str, payload: bytes) -> None:
    token = transfer.get("token")
    client = _storage_client(token)
    bucket = client.bucket(transfer["bucket"])
    blob = bucket.blob(transfer.get("object_path") or path)
    blob.metadata = {"sha256": _sha(payload)}
    blob.upload_from_string(payload, content_type="application/octet-stream")


def _download_gcs_object(transfer: dict, path: str) -> bytes:
    token = transfer.get("token")
    client = _storage_client(token)
    bucket = client.bucket(transfer["bucket"])
    blob = bucket.blob(path)
    return blob.download_as_bytes()


def _file_url(repo_id: str, path: str) -> str:
    return f"/api/v1/repos/{repo_id}/files/{quote(path, safe='/')}"


def _prepare_upload(
    api: httpx.Client,
    repo_id: str,
    path: str,
    payload: bytes,
    *,
    key: str | None = None,
) -> dict:
    response = api.post(
        f"/api/v1/repos/{repo_id}/files/write-token",
        json={"path": path, "size": len(payload), "content_type": "application/octet-stream"},
        headers={"Idempotency-Key": key or f"write-{time.time_ns()}"},
    )
    response.raise_for_status()
    return response.json()


def _upload_and_confirm(
    api: httpx.Client,
    repo_id: str,
    path: str,
    payload: bytes,
    *,
    confirm_key: str | None = None,
) -> dict:
    prepared = _prepare_upload(api, repo_id, path, payload)
    _put_gcs_object(prepared["transfer"], path, payload)
    response = api.put(
        _file_url(repo_id, path),
        json={"upload_id": prepared["upload_id"], "size": len(payload), "checksum": _sha(payload)},
        headers={"Idempotency-Key": confirm_key or f"confirm-{time.time_ns()}"},
    )
    response.raise_for_status()
    return response.json()


def test_write_token_shape(api: httpx.Client, repo: str) -> None:
    prepared = _prepare_upload(api, repo, "shape/file.txt", b"shape")

    assert prepared["operation_id"].startswith("op_")
    assert prepared["upload_id"].startswith("upl_")
    assert prepared["transfer"]["method"] == "storage-client"
    assert prepared["transfer"]["bucket"]
    assert prepared["transfer"]["object_path"] == "shape/file.txt"


def test_write_token_idempotency_replay(api: httpx.Client, repo: str) -> None:
    key = f"write-replay-{time.time_ns()}"
    first = _prepare_upload(api, repo, "idem/replay.txt", b"same", key=key)
    second = _prepare_upload(api, repo, "idem/replay.txt", b"same", key=key)

    assert second == first


def test_write_token_idempotency_conflict(api: httpx.Client, repo: str) -> None:
    key = f"write-conflict-{time.time_ns()}"
    _prepare_upload(api, repo, "idem/conflict.txt", b"a", key=key)
    response = api.post(
        f"/api/v1/repos/{repo}/files/write-token",
        json={"path": "idem/conflict.txt", "size": 2, "content_type": "application/octet-stream"},
        headers={"Idempotency-Key": key},
    )

    assert response.status_code == 409
    assert response.json()["error"]["request_id"]


def test_write_token_requires_idempotency_key(api: httpx.Client, repo: str) -> None:
    response = api.post(
        f"/api/v1/repos/{repo}/files/write-token",
        json={"path": "idem/missing-key.txt", "size": 1},
    )

    assert response.status_code == 400


def test_confirm_upload_registers_file(api: httpx.Client, repo: str) -> None:
    path = "confirm/registered.txt"
    _upload_and_confirm(api, repo, path, b"registered")
    response = api.get(f"/api/v1/repos/{repo}/files", params={"prefix": "confirm/", "recursive": True})
    response.raise_for_status()

    assert path in [item["path"] for item in response.json()["items"]]


def test_confirm_upload_rejects_missing_object(api: httpx.Client, repo: str) -> None:
    path = "confirm/missing-object.txt"
    prepared = _prepare_upload(api, repo, path, b"missing")

    response = api.put(
        _file_url(repo, path),
        json={"upload_id": prepared["upload_id"], "size": 7},
        headers={"Idempotency-Key": f"confirm-missing-{time.time_ns()}"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "object_not_found"


def test_confirm_upload_rejects_wrong_size(api: httpx.Client, repo: str) -> None:
    path = "confirm/wrong-size.txt"
    payload = b"size"
    prepared = _prepare_upload(api, repo, path, payload)
    _put_gcs_object(prepared["transfer"], path, payload)

    response = api.put(
        _file_url(repo, path),
        json={"upload_id": prepared["upload_id"], "size": len(payload) + 1},
        headers={"Idempotency-Key": f"confirm-size-{time.time_ns()}"},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "size_mismatch"


def test_confirm_upload_rejects_wrong_checksum(api: httpx.Client, repo: str) -> None:
    path = "confirm/wrong-checksum.txt"
    payload = b"checksum"
    prepared = _prepare_upload(api, repo, path, payload)
    _put_gcs_object(prepared["transfer"], path, payload)

    response = api.put(
        _file_url(repo, path),
        json={"upload_id": prepared["upload_id"], "size": len(payload), "checksum": "sha256:bad"},
        headers={"Idempotency-Key": f"confirm-checksum-{time.time_ns()}"},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "checksum_mismatch"


def test_confirm_upload_idempotency_replay(api: httpx.Client, repo: str) -> None:
    path = "confirm/replay.txt"
    key = f"confirm-replay-{time.time_ns()}"
    payload = b"confirm replay"
    prepared = _prepare_upload(api, repo, path, payload)
    _put_gcs_object(prepared["transfer"], path, payload)
    body = {"upload_id": prepared["upload_id"], "size": len(payload)}
    first_response = api.put(
        _file_url(repo, path),
        json=body,
        headers={"Idempotency-Key": key},
    )
    first_response.raise_for_status()
    second_response = api.put(
        _file_url(repo, path),
        json=body,
        headers={"Idempotency-Key": key},
    )
    second_response.raise_for_status()

    assert second_response.json() == first_response.json()


def test_download_token_single_file_sha(api: httpx.Client, repo: str) -> None:
    path = "download/single.txt"
    payload = b"download sha\n"
    _upload_and_confirm(api, repo, path, payload)
    response = api.post(f"/api/v1/repos/{repo}/files/download-token", json={"path": path, "recursive": False})
    response.raise_for_status()
    data = response.json()

    assert data["operation_id"].startswith("op_")
    assert _sha(_download_gcs_object(data["transfer"], path)) == _sha(payload)


def test_download_token_recursive_lists_files(api: httpx.Client, repo: str) -> None:
    _upload_and_confirm(api, repo, "download/prefix/a.txt", b"a")
    _upload_and_confirm(api, repo, "download/prefix/b.txt", b"b")
    response = api.post(
        f"/api/v1/repos/{repo}/files/download-token",
        json={"path": "download/prefix/", "recursive": True},
    )
    response.raise_for_status()

    paths = {item["path"] for item in response.json()["files"]}
    assert {"download/prefix/a.txt", "download/prefix/b.txt"} <= paths


def test_operation_status_completed(api: httpx.Client, repo: str) -> None:
    confirmed = _upload_and_confirm(api, repo, "ops/status.txt", b"status")
    response = api.get(f"/api/v1/repos/{repo}/files/operations/{confirmed['operation_id']}")
    response.raise_for_status()

    assert response.json()["status"] == "completed"


def test_copy_same_repo(api: httpx.Client, repo: str) -> None:
    _upload_and_confirm(api, repo, "copy/source.txt", b"same repo")
    response = api.post(
        f"/api/v1/repos/{repo}/files/copy",
        json={"source_repo": repo, "source_path": "copy/source.txt", "target_path": "copy/same.txt"},
        headers={"Idempotency-Key": f"copy-same-{time.time_ns()}"},
    )
    response.raise_for_status()

    token_response = api.post(f"/api/v1/repos/{repo}/files/download-token", json={"path": "copy/same.txt"})
    token_response.raise_for_status()
    assert _download_gcs_object(token_response.json()["transfer"], "copy/same.txt") == b"same repo"


def test_copy_cross_repo(api: httpx.Client, repo: str, copy_repo: str) -> None:
    _upload_and_confirm(api, repo, "copy/cross-source.txt", b"cross repo")
    response = api.post(
        f"/api/v1/repos/{copy_repo}/files/copy",
        json={"source_repo": repo, "source_path": "copy/cross-source.txt", "target_path": "copy/cross-target.txt"},
        headers={"Idempotency-Key": f"copy-cross-{time.time_ns()}"},
    )
    response.raise_for_status()

    token_response = api.post(f"/api/v1/repos/{copy_repo}/files/download-token", json={"path": "copy/cross-target.txt"})
    token_response.raise_for_status()
    assert _download_gcs_object(token_response.json()["transfer"], "copy/cross-target.txt") == b"cross repo"


def test_delete_file(api: httpx.Client, repo: str) -> None:
    path = "delete/remove.txt"
    _upload_and_confirm(api, repo, path, b"delete me")
    response = api.delete(_file_url(repo, path), headers={"Idempotency-Key": f"delete-{time.time_ns()}"})
    response.raise_for_status()
    listed = api.get(f"/api/v1/repos/{repo}/files", params={"prefix": "delete/", "recursive": True})
    listed.raise_for_status()

    assert path not in [item["path"] for item in listed.json()["items"]]


def test_list_pagination(api: httpx.Client, repo: str) -> None:
    for index in range(3):
        _upload_and_confirm(api, repo, f"page/item-{index}.txt", f"{index}".encode())
    first = api.get(f"/api/v1/repos/{repo}/files", params={"prefix": "page/", "recursive": True, "limit": 1})
    first.raise_for_status()
    first_data = first.json()
    second = api.get(
        f"/api/v1/repos/{repo}/files",
        params={"prefix": "page/", "recursive": True, "limit": 1, "page_token": first_data["next_page_token"]},
    )
    second.raise_for_status()

    assert first_data["has_more"] is True
    assert first_data["items"][0]["path"] != second.json()["items"][0]["path"]


def test_repo_info_stats_and_updated_at(api: httpx.Client, repo: str) -> None:
    _upload_and_confirm(api, repo, "stats/nonzero.txt", b"repo stats")
    response = api.get(f"/api/v1/repos/{repo}")
    response.raise_for_status()
    data = response.json()

    assert data["file_count"] >= 1
    assert data["total_size_bytes"] >= len(b"repo stats")
    assert data["updated_at"]


def test_content_endpoint(api: httpx.Client, repo: str) -> None:
    _upload_and_confirm(api, repo, "content/read.txt", b"content endpoint")
    response = api.get(f"/api/v1/repos/{repo}/files/content", params={"path": "content/read.txt"})
    response.raise_for_status()

    assert response.json()["content"] == "content endpoint"


def test_invalid_path_returns_envelope(api: httpx.Client, repo: str) -> None:
    response = api.post(
        f"/api/v1/repos/{repo}/files/write-token",
        json={"path": "../bad.txt", "size": 1},
        headers={"Idempotency-Key": f"bad-path-{time.time_ns()}"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["request_id"]

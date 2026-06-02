from __future__ import annotations

import hashlib
import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers import files as files_mod
from app.schemas.files import UploadConfirmRequest


def _request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))


def _user():
    return SimpleNamespace(id=1, email="user@example.com")


def _repo():
    return SimpleNamespace(repo_name="repo", bucket_name="bucket")


def test_confirm_upload_validates_object_integrity(monkeypatch) -> None:
    monkeypatch.setattr(files_mod, "check_access", lambda *args, **kwargs: _repo())
    monkeypatch.setattr(files_mod.audit, "log", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        files_mod._gcs,
        "get_object_metadata",
        lambda bucket, path: {
            "exists": True,
            "size": 5,
            "crc32c": "crc",
            "md5_hash": "md5",
            "metadata": {"sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"},
        },
    )

    result = files_mod._confirm_upload(
        "owner",
        "repo",
        "data/file.txt",
        UploadConfirmRequest(upload_id="upl", size=5, checksum="sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"),
        _request(),
        _user(),
        object(),
    )

    assert result.status == "completed"
    assert result.path == "data/file.txt"


def test_confirm_bulk_upload_validates_manifest_and_objects(monkeypatch) -> None:
    records = [
        {"path": "bulk/a.txt", "size": 5, "checksum": "sha256:" + "a" * 64},
        {"path": "bulk/b.txt", "size": 7, "checksum": "sha256:" + "b" * 64},
    ]
    manifest = "".join(
        json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n"
        for record in records
    ).encode("utf-8")
    digest = "sha256:" + hashlib.sha256(manifest).hexdigest()
    checked: list[str] = []

    monkeypatch.setattr(files_mod, "check_access", lambda *args, **kwargs: _repo())
    monkeypatch.setattr(files_mod.audit, "log", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        files_mod._gcs,
        "read_object_bytes",
        lambda bucket, path, max_bytes: (manifest, len(manifest), False),
    )

    def _metadata(bucket, path):
        checked.append(path)
        size = 5 if path.endswith("a.txt") else 7
        checksum = "a" * 64 if path.endswith("a.txt") else "b" * 64
        return {"exists": True, "size": size, "metadata": {"sha256": checksum}}

    monkeypatch.setattr(files_mod._gcs, "get_object_metadata", _metadata)

    result = files_mod._confirm_bulk_upload(
        "owner",
        "repo",
        UploadConfirmRequest(
            mode="bulk",
            upload_id="upl",
            manifest_ref=".datahub/manifests/upl.jsonl",
            manifest_digest=digest,
            files_count=2,
            bytes_total=12,
        ),
        _request(),
        _user(),
        object(),
    )

    assert result.status == "completed"
    assert result.files_total == 2
    assert result.bytes_total == 12
    assert checked == ["bulk/a.txt", "bulk/b.txt"]


def test_confirm_bulk_upload_rejects_manifest_digest_mismatch(monkeypatch) -> None:
    manifest = b'{"path":"bulk/a.txt","size":5}\n'

    monkeypatch.setattr(files_mod, "check_access", lambda *args, **kwargs: _repo())
    monkeypatch.setattr(
        files_mod._gcs,
        "read_object_bytes",
        lambda bucket, path, max_bytes: (manifest, len(manifest), False),
    )

    with pytest.raises(HTTPException) as exc:
        files_mod._confirm_bulk_upload(
            "owner",
            "repo",
            UploadConfirmRequest(
                mode="bulk",
                upload_id="upl",
                manifest_ref=".datahub/manifests/upl.jsonl",
                manifest_digest="sha256:" + "0" * 64,
                files_count=1,
                bytes_total=5,
            ),
            _request(),
            _user(),
            object(),
        )

    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "manifest_digest_mismatch"


def test_confirm_upload_rejects_missing_object(monkeypatch) -> None:
    monkeypatch.setattr(files_mod, "check_access", lambda *args, **kwargs: _repo())
    monkeypatch.setattr(
        files_mod._gcs,
        "get_object_metadata",
        lambda bucket, path: {"exists": False, "size": None, "metadata": {}},
    )

    with pytest.raises(HTTPException) as exc:
        files_mod._confirm_upload(
            "owner",
            "repo",
            "missing.txt",
            UploadConfirmRequest(upload_id="upl", size=5),
            _request(),
            _user(),
            object(),
        )

    assert exc.value.status_code == 404
    assert exc.value.detail["code"] == "object_not_found"
    assert exc.value.detail["target"] == "missing.txt"


def test_confirm_upload_rejects_size_mismatch(monkeypatch) -> None:
    monkeypatch.setattr(files_mod, "check_access", lambda *args, **kwargs: _repo())
    monkeypatch.setattr(
        files_mod._gcs,
        "get_object_metadata",
        lambda bucket, path: {"exists": True, "size": 4, "metadata": {}},
    )

    with pytest.raises(HTTPException) as exc:
        files_mod._confirm_upload(
            "owner",
            "repo",
            "data/file.txt",
            UploadConfirmRequest(upload_id="upl", size=5),
            _request(),
            _user(),
            object(),
        )

    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "size_mismatch"


def test_confirm_upload_rejects_checksum_mismatch(monkeypatch) -> None:
    monkeypatch.setattr(files_mod, "check_access", lambda *args, **kwargs: _repo())
    monkeypatch.setattr(
        files_mod._gcs,
        "get_object_metadata",
        lambda bucket, path: {"exists": True, "size": 5, "metadata": {"sha256": "actual"}},
    )

    with pytest.raises(HTTPException) as exc:
        files_mod._confirm_upload(
            "owner",
            "repo",
            "data/file.txt",
            UploadConfirmRequest(upload_id="upl", size=5, checksum="sha256:expected"),
            _request(),
            _user(),
            object(),
        )

    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "checksum_mismatch"


def test_copy_file_rejects_missing_source(monkeypatch) -> None:
    monkeypatch.setattr(files_mod, "require_capability", lambda *args, **kwargs: _repo())
    monkeypatch.setattr(files_mod, "check_access", lambda *args, **kwargs: _repo())
    monkeypatch.setattr(
        files_mod._gcs,
        "get_object_metadata",
        lambda bucket, path: {"exists": False, "size": None, "metadata": {}},
    )

    with pytest.raises(HTTPException) as exc:
        files_mod._copy_file(
            "owner/target",
            "owner/source",
            "missing.txt",
            "copy.txt",
            _request(),
            _user(),
            object(),
        )

    assert exc.value.status_code == 404
    assert exc.value.detail["code"] == "object_not_found"

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers import files


def test_resolve_download_mapping_raises_precise_error_when_backing_object_missing(monkeypatch) -> None:
    monkeypatch.setattr(files._lakefs, "resolve_physical_path", lambda repo, branch, path: ("gs://bucket/missing-object", 123))
    monkeypatch.setattr(files._gcs, "object_exists", lambda physical_address: False)

    with pytest.raises(HTTPException) as exc:
        files._resolve_download_mapping("koscom", "main", "missing.parquet")

    assert exc.value.status_code == 409
    assert exc.value.detail == {
        "message": "Resolved backing object is missing from GCS",
        "repo": "koscom",
        "branch": "main",
        "path": "missing.parquet",
        "physical_address": "gs://bucket/missing-object",
    }


def test_resolve_download_mapping_returns_mapping_when_backing_object_exists(monkeypatch) -> None:
    monkeypatch.setattr(files._lakefs, "resolve_physical_path", lambda repo, branch, path: ("gs://bucket/existing-object", 456))
    monkeypatch.setattr(files._gcs, "object_exists", lambda physical_address: True)

    mapping = files._resolve_download_mapping("koscom", "main", "existing.parquet")

    assert mapping.path == "existing.parquet"
    assert mapping.physical_address == "gs://bucket/existing-object"
    assert mapping.size_bytes == 456

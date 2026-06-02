from __future__ import annotations

from unittest.mock import MagicMock, patch

from google.api_core.exceptions import NotFound

from app.services.gcs import GCSService


def test_get_object_metadata_returns_size_and_checksums() -> None:
    client = MagicMock()
    blob = MagicMock()
    blob.size = 12
    blob.crc32c = "crc"
    blob.md5_hash = "md5"
    blob.generation = "7"
    blob.metadata = {"sha256": "abc"}
    client.bucket.return_value.blob.return_value = blob

    with patch("app.services.gcs._get_gcs_client", return_value=client):
        metadata = GCSService().get_object_metadata("bucket", "data/file.txt")

    assert metadata == {
        "exists": True,
        "size": 12,
        "crc32c": "crc",
        "md5_hash": "md5",
        "generation": "7",
        "metadata": {"sha256": "abc"},
    }
    client.bucket.assert_called_once_with("bucket")
    client.bucket.return_value.blob.assert_called_once_with("data/file.txt")
    blob.reload.assert_called_once()


def test_get_object_metadata_maps_missing_object() -> None:
    client = MagicMock()
    blob = MagicMock()
    blob.reload.side_effect = NotFound("missing")
    client.bucket.return_value.blob.return_value = blob

    with patch("app.services.gcs._get_gcs_client", return_value=client):
        metadata = GCSService().get_object_metadata("bucket", "missing.txt")

    assert metadata["exists"] is False
    assert metadata["size"] is None
    assert metadata["metadata"] == {}

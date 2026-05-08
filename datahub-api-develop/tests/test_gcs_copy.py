from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.services.gcs import GCSService


def test_server_side_copy_reuses_split_gcs_uri() -> None:
    client = MagicMock()
    source_bucket = MagicMock()
    source_blob = MagicMock()
    destination_bucket = MagicMock()
    client.bucket.side_effect = [source_bucket, destination_bucket]
    source_bucket.blob.return_value = source_blob

    with patch("app.services.gcs._get_gcs_client", return_value=client):
        GCSService().server_side_copy("gs://source-bucket/a.txt", "gs://dest-bucket/b.txt")

    client.bucket.assert_any_call("source-bucket")
    client.bucket.assert_any_call("dest-bucket")
    source_bucket.blob.assert_called_once_with("a.txt")
    source_bucket.copy_blob.assert_called_once_with(source_blob, destination_bucket, "b.txt")

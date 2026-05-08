from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.services.gcs import GCSService


def test_create_bucket_does_not_apply_lifecycle_delete_rule() -> None:
    bucket = MagicMock()
    bucket.exists.return_value = False
    client = MagicMock()
    client.bucket.return_value = bucket

    with patch("app.services.gcs._get_gcs_client", return_value=client):
        bucket_name = GCSService().create_bucket("demo")

    assert bucket_name.endswith("-demo")
    bucket.add_lifecycle_delete_rule.assert_not_called()
    bucket.patch.assert_not_called()

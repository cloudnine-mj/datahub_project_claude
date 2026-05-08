"""GCSService.compose_objects 유닛 테스트 (migrate 엔드포인트에서 사용).

기존 테스트 패턴 (test_gcs_copy.py, test_download_resolution.py) 준수:
- GCSService.compose_objects: 직접 호출 + _get_gcs_client 모킹
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.gcs import GCSService


# ── GCSService.compose_objects 단위 테스트 ─────────────────────

class TestComposeObjects:
    def test_single_source_composes_to_destination(self):
        client = MagicMock()
        bucket = MagicMock()
        src_blob = MagicMock()
        dest_blob = MagicMock()
        dest_blob.size = 512
        # blob() 호출 순서: src first, then dest
        bucket.blob.side_effect = [src_blob, dest_blob]
        client.bucket.return_value = bucket

        with patch("app.services.gcs._get_gcs_client", return_value=client):
            size = GCSService().compose_objects(
                ["gs://my-bucket/src/chunk1"],
                "gs://my-bucket/staging/file",
            )

        dest_blob.compose.assert_called_once_with([src_blob])
        dest_blob.reload.assert_called_once()
        assert size == 512

    def test_multiple_sources_compose_in_order(self):
        client = MagicMock()
        bucket = MagicMock()
        src1 = MagicMock()
        src2 = MagicMock()
        dest_blob = MagicMock()
        dest_blob.size = 2048

        call_count = [0]

        def blob_factory(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return src1
            elif call_count[0] == 2:
                return src2
            else:
                return dest_blob

        bucket.blob.side_effect = blob_factory
        client.bucket.return_value = bucket

        with patch("app.services.gcs._get_gcs_client", return_value=client):
            size = GCSService().compose_objects(
                [
                    "gs://my-bucket/_cas/aa/aaa",
                    "gs://my-bucket/_cas/bb/bbb",
                ],
                "gs://my-bucket/staging/assembled",
            )

        dest_blob.compose.assert_called_once_with([src1, src2])
        assert size == 2048

    def test_raises_on_empty_sources(self):
        with pytest.raises(ValueError, match="source_uris must not be empty"):
            GCSService().compose_objects([], "gs://bucket/dest")

    def test_raises_on_more_than_32_sources(self):
        sources = [f"gs://bucket/chunk{i}" for i in range(33)]
        with pytest.raises(ValueError, match="at most 32"):
            GCSService().compose_objects(sources, "gs://bucket/dest")

    def test_raises_on_cross_bucket_sources(self):
        client = MagicMock()
        with patch("app.services.gcs._get_gcs_client", return_value=client):
            with pytest.raises(ValueError, match="same bucket"):
                GCSService().compose_objects(
                    ["gs://bucket-a/chunk1"],
                    "gs://bucket-b/dest",
                )


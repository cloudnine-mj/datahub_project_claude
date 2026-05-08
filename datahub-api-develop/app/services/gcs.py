"""GCS Signed URL 생성, 버킷 관리.

서버의 System SA로 서명하여 SDK가 GCS SDK 없이 HTTP PUT/GET으로 전송 가능.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Optional

from google.api_core.exceptions import NotFound
from google.cloud import storage as gcs_storage

from app.config import settings

logger = logging.getLogger(__name__)

_gcs_client: Optional[gcs_storage.Client] = None


def _get_gcs_client() -> gcs_storage.Client:
    """GCS 클라이언트 lazy init."""
    global _gcs_client
    if _gcs_client is None:
        _gcs_client = gcs_storage.Client(project=settings.gcp_project)
    return _gcs_client


class GCSService:
    """GCS 서비스."""

    @staticmethod
    def _split_gcs_uri(physical_address: str) -> tuple[str, str]:
        if not physical_address.startswith("gs://"):
            raise ValueError(f"Invalid GCS address: {physical_address}")

        path = physical_address[5:]
        bucket_name, _, blob_name = path.partition("/")
        if not bucket_name or not blob_name:
            raise ValueError(f"Invalid GCS address: {physical_address}")
        return bucket_name, blob_name

    def generate_signed_url(
        self,
        physical_address: str,
        method: str = "GET",
        expiry_minutes: Optional[int] = None,
        content_type: Optional[str] = None,
    ) -> str:
        """물리 GCS 주소에 대한 Signed URL 생성.

        Args:
            physical_address: gs://bucket/key 형식
            method: HTTP 메서드 (GET 또는 PUT)
            expiry_minutes: 만료 시간 (분). None이면 설정값 사용.
            content_type: PUT 시 Content-Type

        Returns:
            Signed URL
        """
        bucket_name, blob_name = self._split_gcs_uri(physical_address)

        client = _get_gcs_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)

        expiry = timedelta(minutes=expiry_minutes or settings.signed_url_expiry_minutes)

        kwargs: dict[str, Any] = {
            "version": "v4",
            "expiration": expiry,
            "method": method,
        }
        if content_type and method == "PUT":
            kwargs["content_type"] = content_type

        return blob.generate_signed_url(**kwargs)

    def create_bucket(self, repo_name: str) -> str:
        """GCS 버킷 생성 (이미 존재하면 건너뜀).

        Returns:
            버킷 이름
        """
        bucket_name = f"{settings.gcp_bucket_prefix}-{repo_name}"
        client = _get_gcs_client()
        bucket = client.bucket(bucket_name)

        if bucket.exists():
            logger.info("버킷이 이미 존재합니다: %s", bucket_name)
            return bucket_name

        bucket.storage_class = "STANDARD"
        client.create_bucket(bucket, location=settings.gcp_bucket_location)
        logger.info("버킷 생성 완료: %s (location=%s)", bucket_name, settings.gcp_bucket_location)

        if settings.gcp_system_sa_email:
            policy = bucket.get_iam_policy(requested_policy_version=3)
            policy.bindings.append({
                "role": "roles/storage.objectAdmin",
                "members": {f"serviceAccount:{settings.gcp_system_sa_email}"},
            })
            bucket.set_iam_policy(policy)
            logger.info("시스템 SA 권한 부여 완료: %s", settings.gcp_system_sa_email)

        return bucket_name

    def delete_bucket(self, repo_name: str) -> None:
        """GCS 버킷 내 모든 오브젝트 삭제 후 버킷 삭제.

        버킷이 존재하지 않으면 무시합니다.
        """
        bucket_name = f"{settings.gcp_bucket_prefix}-{repo_name}"
        client = _get_gcs_client()
        bucket = client.bucket(bucket_name)

        if not bucket.exists():
            logger.info("버킷이 존재하지 않습니다: %s", bucket_name)
            return

        # 버킷 내 모든 오브젝트 삭제 (비어있어야 삭제 가능)
        blobs = list(bucket.list_blobs())
        if blobs:
            bucket.delete_blobs(blobs)
            logger.info("버킷 내 %d개 오브젝트 삭제 완료: %s", len(blobs), bucket_name)

        bucket.delete()
        logger.info("버킷 삭제 완료: %s", bucket_name)

    def delete_objects(self, physical_addresses: list[str]) -> int:
        if not physical_addresses:
            return 0

        client = _get_gcs_client()
        deleted = 0

        for physical_address in physical_addresses:
            bucket_name, blob_name = self._split_gcs_uri(physical_address)
            blob = client.bucket(bucket_name).blob(blob_name)
            try:
                blob.delete()
                deleted += 1
            except NotFound:
                logger.info("삭제할 오브젝트가 이미 없습니다: %s", physical_address)

        return deleted

    def object_exists(self, physical_address: str) -> bool:
        bucket_name, blob_name = self._split_gcs_uri(physical_address)
        client = _get_gcs_client()
        return client.bucket(bucket_name).blob(blob_name).exists()

    def server_side_copy(self, source_uri: str, dest_uri: str) -> None:
        """GCS 서버사이드 복사.

        Args:
            source_uri: gs://bucket/key 형식
            dest_uri: gs://bucket/key 형식
        """
        client = _get_gcs_client()

        src_bucket_name, src_blob_name = self._split_gcs_uri(source_uri)
        src_bucket = client.bucket(src_bucket_name)
        src_blob = src_bucket.blob(src_blob_name)

        dst_bucket_name, dst_blob_name = self._split_gcs_uri(dest_uri)
        dst_bucket = client.bucket(dst_bucket_name)

        src_bucket.copy_blob(src_blob, dst_bucket, dst_blob_name)

    def compose_objects(self, source_uris: list[str], dest_uri: str) -> int:
        """GCS 오브젝트 여러 개를 하나로 합성 (GCS Compose, 최대 32개).

        Args:
            source_uris: 소스 GCS 주소 목록 (gs://bucket/key 형식, 순서 보존)
            dest_uri: 합성 결과물 GCS 주소 (gs://bucket/key 형식)

        Returns:
            합성된 오브젝트 크기 (bytes)
        """
        if not source_uris:
            raise ValueError("source_uris must not be empty")
        if len(source_uris) > 32:
            raise ValueError(f"GCS compose supports at most 32 sources, got {len(source_uris)}")

        dst_bucket_name, dst_blob_name = self._split_gcs_uri(dest_uri)
        client = _get_gcs_client()
        dst_bucket = client.bucket(dst_bucket_name)

        sources = []
        for uri in source_uris:
            src_bucket_name, src_blob_name = self._split_gcs_uri(uri)
            if src_bucket_name != dst_bucket_name:
                raise ValueError(
                    f"GCS compose requires all sources and destination to be in the same bucket. "
                    f"Source bucket: {src_bucket_name}, dest bucket: {dst_bucket_name}"
                )
            sources.append(dst_bucket.blob(src_blob_name))

        destination = dst_bucket.blob(dst_blob_name)
        destination.compose(sources)
        destination.reload()
        return destination.size or 0

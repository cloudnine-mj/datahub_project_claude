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

    def bucket_exists(self, gcs_key: str) -> tuple[bool, str]:
        """GCS 버킷 존재 여부. (exists, full_bucket_name) 반환.

        사전 충돌 검사용 (create_repo 가 명확한 409 detail 을 만들기 위해).
        """
        bucket_name = self._compose_bucket_name(gcs_key)
        client = _get_gcs_client()
        return client.bucket(bucket_name).exists(), bucket_name

    @staticmethod
    def _compose_bucket_name(gcs_key: str) -> str:
        """`{prefix}-{gcs_key}` 합성 + 63-char 한도 가드.

        router 에서 사전 검증 (`repo_naming.validate_bucket_name`) 하지만 다른
        호출 경로 (예: 직접 SDK / admin 스크립트) 대비 defense-in-depth.
        """
        bucket_name = f"{settings.gcp_bucket_prefix}-{gcs_key}"
        from app.services.repo_naming import MAX_GCS_BUCKET_LENGTH
        if len(bucket_name) > MAX_GCS_BUCKET_LENGTH:
            raise ValueError(
                "GCS bucket name exceeds the 63-character limit: "
                f"{bucket_name!r} (length={len(bucket_name)})"
            )
        return bucket_name

    def create_bucket(self, repo_name: str) -> str:
        """GCS 버킷 생성 (이미 존재하면 건너뜀).

        Returns:
            버킷 이름
        """
        bucket_name = self._compose_bucket_name(repo_name)
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
        # delete 시점에는 길이 가드 의미 없으므로 직접 합성 (잘못된 입력은 list/exists 가 자연스럽게 false-out).
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

    def get_object_metadata(self, bucket_name: str, path: str) -> dict[str, Any]:
        """Return object metadata needed for transfer integrity checks."""
        client = _get_gcs_client()
        blob = client.bucket(bucket_name).blob(path.lstrip("/"))
        try:
            blob.reload()
        except NotFound:
            return {
                "exists": False,
                "size": None,
                "crc32c": None,
                "md5_hash": None,
                "generation": None,
                "metadata": {},
            }
        return {
            "exists": True,
            "size": blob.size,
            "crc32c": blob.crc32c,
            "md5_hash": blob.md5_hash,
            "generation": blob.generation,
            "metadata": dict(blob.metadata or {}),
        }

    def list_objects(
        self,
        bucket_name: str,
        *,
        prefix: str = "",
        recursive: bool = False,
        max_items: int = 100,
        page_token: str | None = None,
    ) -> tuple[list[dict[str, Any]], bool, str | None]:
        """List objects in a bucket using repository-internal paths."""
        client = _get_gcs_client()
        bucket = client.bucket(bucket_name)
        iterator = bucket.list_blobs(
            prefix=prefix.lstrip("/"),
            delimiter=None if recursive else "/",
            max_results=max_items,
            page_token=page_token,
        )
        page = next(iterator.pages, None)
        if page is None:
            return [], False, None

        items: list[dict[str, Any]] = []
        for blob in page:
            items.append(
                {
                    "path": blob.name,
                    "path_type": "object",
                    "size_bytes": blob.size,
                    "mtime": int(blob.updated.timestamp()) if blob.updated else None,
                    "physical_address": f"gs://{bucket_name}/{blob.name}",
                }
            )
        for prefix_value in getattr(page, "prefixes", ()) or ():
            items.append(
                {
                    "path": prefix_value,
                    "path_type": "prefix",
                    "size_bytes": None,
                    "mtime": None,
                    "physical_address": None,
                }
            )
        return items, bool(iterator.next_page_token), iterator.next_page_token

    def read_text_object(self, bucket_name: str, path: str, max_bytes: int) -> tuple[str, int, bool]:
        """Read at most max_bytes from a UTF-8-ish object for preview."""
        client = _get_gcs_client()
        blob = client.bucket(bucket_name).blob(path.lstrip("/"))
        blob.reload()
        total_size = blob.size or 0
        end = max(max_bytes - 1, 0)
        data = blob.download_as_bytes(start=0, end=end)
        return data.decode("utf-8", errors="replace"), total_size, total_size > len(data)

    def read_object_bytes(self, bucket_name: str, path: str, max_bytes: int) -> tuple[bytes, int, bool]:
        """Read a bounded object as bytes."""
        client = _get_gcs_client()
        blob = client.bucket(bucket_name).blob(path.lstrip("/"))
        blob.reload()
        total_size = blob.size or 0
        if total_size > max_bytes:
            return b"", total_size, True
        return blob.download_as_bytes(), total_size, False

    def write_text_object(self, bucket_name: str, path: str, content: str, *, content_type: str = "application/json") -> None:
        """Write a UTF-8 text object (governance §architecture/storage-transfer — `_manifest.json`).

        bucket private 가정. write 실패 시 raise.
        """
        client = _get_gcs_client()
        blob = client.bucket(bucket_name).blob(path.lstrip("/"))
        blob.upload_from_string(content.encode("utf-8"), content_type=content_type)

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

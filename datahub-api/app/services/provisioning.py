"""Repository provisioning orchestration.

Launch-target repositories are control-plane records backed by object storage.
This service only manages the GCS bucket lifecycle; versioning engines are not
part of the current contract.
"""

from __future__ import annotations

import logging

from app.services.gcs import GCSService

logger = logging.getLogger(__name__)


class ProvisioningService:
    """Repository provisioning service."""

    def __init__(self, gcs: GCSService) -> None:
        self._gcs = gcs

    def provision_repo(
        self,
        repo_name: str,
        gcs_key: str | None = None,
    ) -> str:
        """Create the repository storage bucket.

        Args:
            repo_name: bare repository name, used as fallback bucket suffix.
            gcs_key: GCS bucket suffix. Owner-scoped repos pass an owner-aware key.

        Returns:
            Created or existing bucket name.
        """
        effective_gcs = gcs_key or repo_name
        bucket_name = self._gcs.create_bucket(effective_gcs)
        logger.info("Repository storage provisioned: %s (bucket=%s)", repo_name, bucket_name)
        return bucket_name

    def deprovision_repo(self, repo_name: str, gcs_key: str | None = None) -> None:
        """Delete the repository storage bucket.

        Args:
            repo_name: bare repository name, used as fallback bucket suffix.
            gcs_key: GCS 버킷 suffix. 신규 생성은 namespace 를 포함한
                `{namespace}--{repo}` 형식을 사용한다. None이면 legacy flat
                bucket cleanup 용으로 repo_name 그대로 사용.
        """
        effective_gcs = gcs_key or repo_name
        self._gcs.delete_bucket(effective_gcs)
        logger.info("Repository storage deleted: %s", repo_name)

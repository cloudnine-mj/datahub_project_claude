"""Credential Access Boundary (CAB) 토큰 생성.

사용자의 권한에 따라 GCS 버킷 접근 범위를 제한하는 downscoped 토큰을 발급합니다.
기존 token-service에서 이관.
"""

from __future__ import annotations

import logging
from typing import Optional

import google.auth
import google.auth.transport.requests
from google.auth import downscoped
from google.oauth2 import service_account

from app.config import settings

logger = logging.getLogger(__name__)

_system_credentials: Optional[service_account.Credentials] = None


def _get_system_credentials() -> service_account.Credentials:
    """시스템 서비스 어카운트 자격증명을 로드 (lazy init)."""
    global _system_credentials
    if _system_credentials is None:
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        _system_credentials = credentials
    return _system_credentials


def _resolve_bucket_name(repo_or_bucket_name: str) -> str:
    prefix = f"{settings.gcp_bucket_prefix}-"
    if repo_or_bucket_name.startswith(prefix):
        return repo_or_bucket_name
    return f"{prefix}{repo_or_bucket_name}"


def generate_repo_upload_token(
    repo_or_bucket_name: str,
) -> tuple[str, str]:
    """단일 레포 업로드용 CAB 토큰 생성.

    해당 레포의 GCS 버킷에 대해 objectAdmin 권한을 부여합니다.
    업로드 후 검증(object.get)을 위해 objectCreator가 아닌 objectAdmin 필요.
    owner-scoped repository는 실제 bucket_name을 넘겨야 CAB boundary가 맞습니다.

    실패 시 명시적으로 예외를 raise — silent null 반환 금지.
    호출 측(routers/files.py)에서 500 으로 매핑한다.

    Returns:
        (access_token, expiry_iso) 튜플.
    """
    bucket = _resolve_bucket_name(repo_or_bucket_name)
    try:
        rule = downscoped.AccessBoundaryRule(
            available_resource=f"//storage.googleapis.com/projects/_/buckets/{bucket}",
            available_permissions=["inRole:roles/storage.objectAdmin"],
        )
        cab = downscoped.CredentialAccessBoundary(rules=[rule])
        source_creds = _get_system_credentials()
        downscoped_creds = downscoped.Credentials(
            source_credentials=source_creds,
            credential_access_boundary=cab,
        )

        request = google.auth.transport.requests.Request()
        downscoped_creds.refresh(request)

        if not downscoped_creds.token:
            logger.error(
                "CAB upload token issuance returned empty token",
                extra={"bucket": bucket},
            )
            raise RuntimeError("CAB downscoped upload token is empty")

        expiry_iso = (
            downscoped_creds.expiry.isoformat() + "Z" if downscoped_creds.expiry else None
        )
        return downscoped_creds.token, expiry_iso
    except Exception as e:
        logger.error(
            "CAB upload token issuance failed",
            extra={
                "bucket": bucket,
                "error": str(e),
                "error_type": type(e).__name__,
            },
        )
        raise


def generate_repo_download_token(
    repo_or_bucket_name: str,
) -> tuple[str, str]:
    """단일 레포 다운로드용 CAB 토큰 생성.

    해당 레포의 GCS 버킷에 대해 objectViewer 권한만 부여합니다.

    실패 시 명시적으로 예외를 raise — silent null 반환 금지.

    Returns:
        (access_token, expiry_iso) 튜플.
    """
    bucket = _resolve_bucket_name(repo_or_bucket_name)
    try:
        rule = downscoped.AccessBoundaryRule(
            available_resource=f"//storage.googleapis.com/projects/_/buckets/{bucket}",
            available_permissions=["inRole:roles/storage.objectViewer"],
        )
        cab = downscoped.CredentialAccessBoundary(rules=[rule])
        source_creds = _get_system_credentials()
        downscoped_creds = downscoped.Credentials(
            source_credentials=source_creds,
            credential_access_boundary=cab,
        )

        request = google.auth.transport.requests.Request()
        downscoped_creds.refresh(request)

        if not downscoped_creds.token:
            logger.error(
                "CAB download token issuance returned empty token",
                extra={"bucket": bucket},
            )
            raise RuntimeError("CAB downscoped download token is empty")

        expiry_iso = (
            downscoped_creds.expiry.isoformat() + "Z" if downscoped_creds.expiry else None
        )
        return downscoped_creds.token, expiry_iso
    except Exception as e:
        logger.error(
            "CAB download token issuance failed",
            extra={
                "bucket": bucket,
                "error": str(e),
                "error_type": type(e).__name__,
            },
        )
        raise

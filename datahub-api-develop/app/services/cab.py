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


def generate_repo_upload_token(
    repo_name: str,
) -> tuple[str, str]:
    """단일 레포 업로드용 CAB 토큰 생성.

    해당 레포의 GCS 버킷에 대해 objectAdmin 권한을 부여합니다.
    업로드 후 검증(object.get)을 위해 objectCreator가 아닌 objectAdmin 필요.

    Returns:
        (access_token, expiry_iso) 튜플.
    """
    bucket = f"{settings.gcp_bucket_prefix}-{repo_name}"
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

    expiry_iso = downscoped_creds.expiry.isoformat() + "Z" if downscoped_creds.expiry else None
    return downscoped_creds.token, expiry_iso


def generate_repo_download_token(
    repo_name: str,
) -> tuple[str, str]:
    """단일 레포 다운로드용 CAB 토큰 생성.

    해당 레포의 GCS 버킷에 대해 objectViewer 권한만 부여합니다.

    Returns:
        (access_token, expiry_iso) 튜플.
    """
    bucket = f"{settings.gcp_bucket_prefix}-{repo_name}"
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

    expiry_iso = downscoped_creds.expiry.isoformat() + "Z" if downscoped_creds.expiry else None
    return downscoped_creds.token, expiry_iso


def generate_copy_token(
    source_repo: str,
    dest_repo: str,
) -> tuple[str, str]:
    src_bucket = f"{settings.gcp_bucket_prefix}-{source_repo}"
    dst_bucket = f"{settings.gcp_bucket_prefix}-{dest_repo}"

    rules = [
        downscoped.AccessBoundaryRule(
            available_resource=f"//storage.googleapis.com/projects/_/buckets/{src_bucket}",
            available_permissions=["inRole:roles/storage.objectViewer"],
        )
    ]
    if src_bucket == dst_bucket:
        rules = [
            downscoped.AccessBoundaryRule(
                available_resource=f"//storage.googleapis.com/projects/_/buckets/{src_bucket}",
                available_permissions=["inRole:roles/storage.objectAdmin"],
            )
        ]
    else:
        rules.append(
            downscoped.AccessBoundaryRule(
                available_resource=f"//storage.googleapis.com/projects/_/buckets/{dst_bucket}",
                available_permissions=["inRole:roles/storage.objectAdmin"],
            )
        )

    cab = downscoped.CredentialAccessBoundary(rules=rules)
    source_creds = _get_system_credentials()
    downscoped_creds = downscoped.Credentials(
        source_credentials=source_creds,
        credential_access_boundary=cab,
    )

    request = google.auth.transport.requests.Request()
    downscoped_creds.refresh(request)
    expiry_iso = downscoped_creds.expiry.isoformat() + "Z" if downscoped_creds.expiry else None
    return downscoped_creds.token, expiry_iso

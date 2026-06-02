"""Repository `_manifest.json` write/read (governance §architecture/storage-transfer).

각 bucket 의 루트에 `_manifest.json` 을 두어 DB 손상 시 storage 만으로 repos /
groups / members 재구성 가능. DB 가 truth, manifest 는 hint 위계.

Write 시점:
- create: 동기 1회 (`write_create_manifest`)
- rename / member 변경: background (queue + worker, PR 5)
- reconciler: 매 1시간 DB ↔ manifest drift 발견 시 자동 재enqueue (PR 5)

SLA (governance):
- p95 5분, hard cap 15분
- queue depth > 10 또는 oldest item age > 15분 → alert
- metric: `manifest_write_lag_seconds`, `manifest_drift_count`
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Iterable

from app.services.gcs import GCSService


logger = logging.getLogger(__name__)

MANIFEST_PATH = "_manifest.json"
SCHEMA_VERSION = 1
HASH_VERSION = 1


def build_manifest(
    *,
    repo_uuid: str,
    group_uuid: str | None,
    repo_full_name: str,
    group_slug: str | None,
    repo_name: str,
    repo_type: str | None,
    created_at: datetime,
    members: Iterable[dict[str, Any]] = (),
    last_updated_at: datetime | None = None,
) -> dict[str, Any]:
    """governance §architecture/storage-transfer 의 manifest schema."""
    return {
        "schema_version": SCHEMA_VERSION,
        "hash_version": HASH_VERSION,
        "repo_id": repo_uuid,
        "group_id": group_uuid,
        "repo_full_name": repo_full_name,
        "group_slug": group_slug,
        "repo_name": repo_name,
        "repo_type": repo_type,
        "created_at": _iso(created_at),
        "members": list(members),
        "last_updated_at": _iso(last_updated_at or datetime.now(timezone.utc)),
    }


def write_manifest(gcs: GCSService, bucket_name: str, manifest: dict[str, Any]) -> None:
    """동기 write. governance § manifest 갱신 시점 — create 시 사용."""
    content = json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2)
    gcs.write_text_object(bucket_name, MANIFEST_PATH, content, content_type="application/json")
    logger.info("manifest.write_ok bucket=%s repo_id=%s", bucket_name, manifest.get("repo_id"))


def read_manifest(gcs: GCSService, bucket_name: str, max_bytes: int = 1024 * 1024) -> dict[str, Any] | None:
    """manifest 읽기. 없거나 깨졌으면 None.

    reconstruction (`scripts/recover_repos_from_manifests.py`) + reconciler 용.
    """
    try:
        content, _, _ = gcs.read_text_object(bucket_name, MANIFEST_PATH, max_bytes=max_bytes)
    except Exception as exc:
        logger.warning("manifest.read_fail bucket=%s err=%s", bucket_name, exc)
        return None
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        logger.warning("manifest.parse_fail bucket=%s err=%s", bucket_name, exc)
        return None


def write_create_manifest(
    gcs: GCSService,
    *,
    bucket_name: str,
    repo_uuid: str,
    group_uuid: str | None,
    repo_full_name: str,
    group_slug: str | None,
    repo_name: str,
    repo_type: str | None,
    created_at: datetime,
    members: Iterable[dict[str, Any]] = (),
) -> None:
    """create 시 동기 호출. 실패해도 repo create 는 진행 (manifest 는 hint).

    reconciler 가 추후 drift 감지 시 재시도. silent fail 은 metric 으로 노출.
    """
    manifest = build_manifest(
        repo_uuid=repo_uuid,
        group_uuid=group_uuid,
        repo_full_name=repo_full_name,
        group_slug=group_slug,
        repo_name=repo_name,
        repo_type=repo_type,
        created_at=created_at,
        members=members,
    )
    try:
        write_manifest(gcs, bucket_name, manifest)
    except Exception as exc:
        # truth = DB. manifest 쓰기 실패는 alert 으로 노출하되 create 흐름은 차단 안 함.
        logger.error(
            "manifest.create_write_fail bucket=%s repo_id=%s err=%s",
            bucket_name, repo_uuid, exc,
        )


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

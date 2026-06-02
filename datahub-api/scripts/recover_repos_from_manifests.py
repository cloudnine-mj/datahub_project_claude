#!/usr/bin/env python3
"""DB 손상 시 `_manifest.json` 으로부터 repos / groups 재구성 (dry-run + apply).

governance §architecture/storage-transfer (manifest reconstruction).

흐름:
1. 환경의 모든 `lgair-dgdh-{env}-r-*` bucket 을 enumerate
2. 각 bucket 의 `_manifest.json` 읽기
3. dry-run 모드 → 인벤토리 리포트
4. apply 모드 → DB INSERT (충돌 시 timestamp 최신 우선)

사용법:
    python scripts/recover_repos_from_manifests.py --env dev --dry-run
    python scripts/recover_repos_from_manifests.py --env dev --apply
"""

from __future__ import annotations

import argparse
import logging
import sys
from typing import Iterator

logger = logging.getLogger("recover_repos")


def iter_manifest_buckets(env: str) -> Iterator[str]:
    """환경의 lgair-dgdh-{env}-r-* bucket 목록.

    Prefer GCS listBuckets API 로 수집 (gcs.Client.list_buckets).
    """
    from google.cloud import storage  # type: ignore[import]
    from app.config import settings

    client = storage.Client(project=settings.gcp_project)
    prefix = f"lgair-dgdh-{env}-r-"
    for b in client.list_buckets(prefix=prefix):
        yield b.name


def collect_manifests(env: str) -> list[dict]:
    """모든 bucket 의 manifest 를 dict 리스트로 수집."""
    from app.services.gcs import GCSService
    from app.services.repo_manifest import read_manifest

    gcs = GCSService()
    results = []
    for bucket_name in iter_manifest_buckets(env):
        m = read_manifest(gcs, bucket_name)
        if m is None:
            logger.warning("skip bucket=%s (no/invalid manifest)", bucket_name)
            continue
        m["__bucket_name"] = bucket_name
        results.append(m)
    return results


def dry_run(env: str) -> None:
    """인벤토리 리포트 — 실제 DB 변경 없음."""
    manifests = collect_manifests(env)
    print(f"# manifest reconstruction dry-run (env={env})")
    print(f"# total buckets with manifest: {len(manifests)}")
    print()
    for m in sorted(manifests, key=lambda x: x.get("created_at", "")):
        print(
            f"- repo={m.get('repo_full_name')!r:40} "
            f"id={m.get('repo_id')[:8]}... "
            f"group_id={(m.get('group_id') or '-')[:8]}... "
            f"bucket={m['__bucket_name']}"
        )


def apply(env: str) -> None:
    """실 DB 재구성. 신중하게 사용 — 기존 DB 가 있다면 충돌 우선순위 정책 필요."""
    logger.error("apply mode not yet implemented — use dry-run for now")
    sys.exit(2)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--env", required=True, choices=["dev", "stg", "prd"])
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.dry_run:
        dry_run(args.env)
    elif args.apply:
        apply(args.env)
    return 0


if __name__ == "__main__":
    sys.exit(main())

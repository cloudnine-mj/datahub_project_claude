#!/usr/bin/env python3
"""Legacy GCS bucket → opaque bucket cutover tool (PR 7, plan rev.6 §Legacy bucket cutover).

dev/stg/prd 환경에서 ``lgair-dgdh-{env}-{group}-{repo}`` 형식 bucket 을
``lgair-dgdh-{env}-r-<24hex>`` (opaque hash of repo.uuid) 로 이전.

각 sub-command 는 ``legacy_bucket_migrations`` row 의 status 를 보고 idempotent
하게 동작 — 어디서 중단되어도 재시작 안전.

Sub-command flow (per repo):
    pending  → prepare    : row insert + new_bucket_name 계산
    pending  → create     : 신규 GCS bucket provision
    created  → copy       : 객체 server-side rewrite (old → new)
    copied   → verify     : 객체 count + bytes 일치 확인
    verified → manifest   : 신규 bucket 에 _manifest.json 작성
    manifested → swap     : repos.bucket_name 단일 트랜잭션 교체
    swapped  → delete     : 옛 bucket 삭제 (dev 정책: 즉시. stg/prd 는 grace)

사용법:
    python scripts/migrate_legacy_buckets.py prepare --env dev [--repo group/name | --all] [--dry-run]
    python scripts/migrate_legacy_buckets.py create --env dev --all
    python scripts/migrate_legacy_buckets.py copy --env dev --all
    python scripts/migrate_legacy_buckets.py verify --env dev --all
    python scripts/migrate_legacy_buckets.py manifest --env dev --all
    python scripts/migrate_legacy_buckets.py swap --env dev --all
    python scripts/migrate_legacy_buckets.py delete --env dev --all
    python scripts/migrate_legacy_buckets.py status --env dev
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session


logger = logging.getLogger("migrate_legacy_buckets")


# ── status enum (DB CHECK 와 일치) ─────────────────────────────


STATUS_PENDING = "pending"
STATUS_CREATED = "created"
STATUS_COPIED = "copied"
STATUS_VERIFIED = "verified"
STATUS_MANIFESTED = "manifested"
STATUS_SWAPPED = "swapped"
STATUS_DELETED = "deleted"
STATUS_FAILED = "failed"


_STATUS_ORDER = [
    STATUS_PENDING,
    STATUS_CREATED,
    STATUS_COPIED,
    STATUS_VERIFIED,
    STATUS_MANIFESTED,
    STATUS_SWAPPED,
    STATUS_DELETED,
]


def _status_ge(s: str, target: str) -> bool:
    """status 가 target 이상 진행됐는지."""
    if s == STATUS_FAILED:
        return False
    return _STATUS_ORDER.index(s) >= _STATUS_ORDER.index(target)


# ── helpers ────────────────────────────────────────────────────


def _open_db() -> Session:
    from app.database import SessionLocal
    return SessionLocal()


def _get_gcs_client():
    from google.cloud import storage  # type: ignore[import]
    from app.config import settings
    return storage.Client(project=settings.gcp_project)


def _expected_bucket_prefix(env: str) -> str:
    return f"lgair-dgdh-{env}-"


def _opaque_bucket_name(env: str, repo_uuid: str) -> str:
    """plan rev.6 — ``{prefix}-r-<sha256(v1/<repo_uuid>)[:24]>``."""
    from app.services.repo_naming import make_opaque_gcs_key
    return f"{_expected_bucket_prefix(env)}{make_opaque_gcs_key(repo_uuid)}".rstrip("-").replace(
        f"--", "-",
    )


def _is_already_opaque(bucket_name: str, env: str) -> bool:
    return bucket_name.startswith(f"{_expected_bucket_prefix(env)}r-")


def _new_uuid7_str() -> str:
    from app.services.repo_identity import new_uuid7
    return str(new_uuid7())


def _row_filter(db: Session, env: str, repo: Optional[str]):
    """대상 row 필터. --repo (group/name) 또는 --all."""
    from app.models import LegacyBucketMigration, Organization, Repo

    q = db.query(LegacyBucketMigration).join(Repo, LegacyBucketMigration.repo_uuid == Repo.uuid)
    if repo:
        group, name = repo.split("/", 1)
        q = q.filter(Repo.repo_name == name)
        # group 확인 (외래키 통한 조인)
        q = q.join(Organization, Repo.group_id == Organization.id).filter(
            Organization.group_name == group,
        )
    return q


# ── sub-commands ───────────────────────────────────────────────


def cmd_prepare(args) -> int:
    """legacy bucket 을 쓰는 모든 repo 에 대해 진행 row insert + new_bucket_name 계산."""
    from app.models import LegacyBucketMigration, Organization, Repo

    db = _open_db()
    try:
        repos_q = db.query(Repo).filter(Repo.bucket_name.isnot(None))
        if args.repo:
            group, name = args.repo.split("/", 1)
            repos_q = repos_q.filter(Repo.repo_name == name)

        candidates = []
        for repo in repos_q.all():
            if _is_already_opaque(repo.bucket_name, args.env):
                continue  # 이미 opaque
            existing = (
                db.query(LegacyBucketMigration)
                .filter(LegacyBucketMigration.repo_uuid == repo.uuid)
                .first()
            )
            if existing:
                continue  # 이미 prepare 됨
            candidates.append(repo)

        if not candidates:
            print(f"# no candidates to prepare in env={args.env}")
            return 0

        print(f"# prepare {len(candidates)} repos (env={args.env}, dry_run={args.dry_run})")
        for repo in candidates:
            new_bucket = _opaque_bucket_name(args.env, repo.uuid)
            print(f"  {repo.repo_name:40} {repo.bucket_name} → {new_bucket}")
            if not args.dry_run:
                row = LegacyBucketMigration(
                    id=_new_uuid7_str(),
                    repo_uuid=repo.uuid,
                    old_bucket_name=repo.bucket_name,
                    new_bucket_name=new_bucket,
                    status=STATUS_PENDING,
                )
                db.add(row)
        if not args.dry_run:
            db.commit()
            print(f"# prepared {len(candidates)} rows")
        return 0
    finally:
        db.close()


def cmd_create(args) -> int:
    """status='pending' 인 row 들에 대해 신규 bucket provision."""
    from app.models import LegacyBucketMigration
    from app.config import settings

    db = _open_db()
    client = _get_gcs_client()
    try:
        rows = db.query(LegacyBucketMigration).filter(
            LegacyBucketMigration.status == STATUS_PENDING,
        ).all()
        if not rows:
            print(f"# no pending rows")
            return 0
        for row in rows:
            print(f"# create bucket: {row.new_bucket_name}")
            if args.dry_run:
                continue
            try:
                bucket = client.bucket(row.new_bucket_name)
                if not bucket.exists():
                    bucket.storage_class = "STANDARD"
                    client.create_bucket(bucket, location=settings.gcp_bucket_location)
                    if settings.gcp_system_sa_email:
                        policy = bucket.get_iam_policy(requested_policy_version=3)
                        policy.bindings.append({
                            "role": "roles/storage.objectAdmin",
                            "members": {f"serviceAccount:{settings.gcp_system_sa_email}"},
                        })
                        bucket.set_iam_policy(policy)
                row.status = STATUS_CREATED
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
            except Exception as exc:
                row.status = STATUS_FAILED
                row.error_message = f"create: {exc}"
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                logger.error("create_fail repo_uuid=%s err=%s", row.repo_uuid, exc)
        return 0
    finally:
        db.close()


def cmd_copy(args) -> int:
    """status='created' → 옛 bucket 의 모든 객체를 신규 bucket 으로 server-side rewrite."""
    from app.models import LegacyBucketMigration

    db = _open_db()
    client = _get_gcs_client()
    try:
        rows = db.query(LegacyBucketMigration).filter(
            LegacyBucketMigration.status == STATUS_CREATED,
        ).all()
        if not rows:
            print(f"# no rows in 'created' status")
            return 0
        for row in rows:
            print(f"# copy: {row.old_bucket_name} → {row.new_bucket_name}")
            if args.dry_run:
                continue
            try:
                src_bucket = client.bucket(row.old_bucket_name)
                dst_bucket = client.bucket(row.new_bucket_name)
                count = 0
                total_bytes = 0
                for blob in src_bucket.list_blobs():
                    # server-side rewrite (no bytes traverse client)
                    src_bucket.copy_blob(blob, dst_bucket, blob.name)
                    count += 1
                    total_bytes += blob.size or 0
                row.status = STATUS_COPIED
                row.objects_count = count
                row.objects_bytes = total_bytes
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                print(f"  ok: {count} objects, {total_bytes} bytes")
            except Exception as exc:
                row.status = STATUS_FAILED
                row.error_message = f"copy: {exc}"
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                logger.error("copy_fail repo_uuid=%s err=%s", row.repo_uuid, exc)
        return 0
    finally:
        db.close()


def cmd_verify(args) -> int:
    """status='copied' → 옛 bucket vs 신규 bucket 의 count/bytes 일치 확인."""
    from app.models import LegacyBucketMigration

    db = _open_db()
    client = _get_gcs_client()
    try:
        rows = db.query(LegacyBucketMigration).filter(
            LegacyBucketMigration.status == STATUS_COPIED,
        ).all()
        if not rows:
            print(f"# no rows in 'copied' status")
            return 0
        for row in rows:
            print(f"# verify: {row.new_bucket_name}")
            if args.dry_run:
                continue
            try:
                src = client.bucket(row.old_bucket_name)
                dst = client.bucket(row.new_bucket_name)
                src_blobs = list(src.list_blobs())
                dst_blobs = list(dst.list_blobs())
                src_count = len(src_blobs)
                dst_count = len(dst_blobs)
                src_bytes = sum(b.size or 0 for b in src_blobs)
                dst_bytes = sum(b.size or 0 for b in dst_blobs)
                if src_count != dst_count or src_bytes != dst_bytes:
                    raise RuntimeError(
                        f"mismatch: src=({src_count}, {src_bytes}) dst=({dst_count}, {dst_bytes})"
                    )
                row.status = STATUS_VERIFIED
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                print(f"  ok: {src_count} objects, {src_bytes} bytes match")
            except Exception as exc:
                row.status = STATUS_FAILED
                row.error_message = f"verify: {exc}"
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                logger.error("verify_fail repo_uuid=%s err=%s", row.repo_uuid, exc)
        return 0
    finally:
        db.close()


def cmd_manifest(args) -> int:
    """status='verified' → 신규 bucket 에 _manifest.json 작성."""
    from app.models import LegacyBucketMigration, Organization, Repo
    from app.services.gcs import GCSService
    from app.services.repo_manifest import build_manifest, write_manifest

    db = _open_db()
    gcs = GCSService()
    try:
        rows = db.query(LegacyBucketMigration).filter(
            LegacyBucketMigration.status == STATUS_VERIFIED,
        ).all()
        if not rows:
            print(f"# no rows in 'verified' status")
            return 0
        for row in rows:
            print(f"# manifest: {row.new_bucket_name}")
            if args.dry_run:
                continue
            try:
                repo = db.query(Repo).filter(Repo.uuid == row.repo_uuid).first()
                org = db.query(Organization).filter(Organization.id == repo.group_id).first() if repo.group_id else None
                group_slug = org.group_name if org else "personal"
                manifest = build_manifest(
                    repo_uuid=repo.uuid,
                    group_uuid=repo.group_uuid,
                    repo_full_name=f"{group_slug}/{repo.repo_name}",
                    group_slug=group_slug,
                    repo_name=repo.repo_name,
                    repo_type=repo.repo_type,
                    created_at=repo.created_at,
                )
                write_manifest(gcs, row.new_bucket_name, manifest)
                row.status = STATUS_MANIFESTED
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
            except Exception as exc:
                row.status = STATUS_FAILED
                row.error_message = f"manifest: {exc}"
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                logger.error("manifest_fail repo_uuid=%s err=%s", row.repo_uuid, exc)
        return 0
    finally:
        db.close()


def cmd_swap(args) -> int:
    """status='manifested' → repos.bucket_name 단일 트랜잭션 교체."""
    from app.models import LegacyBucketMigration, Repo

    db = _open_db()
    try:
        rows = db.query(LegacyBucketMigration).filter(
            LegacyBucketMigration.status == STATUS_MANIFESTED,
        ).all()
        if not rows:
            print(f"# no rows in 'manifested' status")
            return 0
        for row in rows:
            print(f"# swap: repos.bucket_name {row.old_bucket_name} → {row.new_bucket_name}")
            if args.dry_run:
                continue
            try:
                repo = db.query(Repo).filter(Repo.uuid == row.repo_uuid).first()
                repo.bucket_name = row.new_bucket_name
                row.status = STATUS_SWAPPED
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
            except Exception as exc:
                db.rollback()
                row.status = STATUS_FAILED
                row.error_message = f"swap: {exc}"
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                logger.error("swap_fail repo_uuid=%s err=%s", row.repo_uuid, exc)
        return 0
    finally:
        db.close()


def cmd_delete(args) -> int:
    """status='swapped' → 옛 bucket 삭제 (dev 정책: 즉시. stg/prd 는 grace 명시 필요)."""
    from app.models import LegacyBucketMigration

    if args.env in ("stg", "prd") and not args.force_delete:
        print(
            f"# refusing to delete in env={args.env} without --force-delete "
            f"(grace policy applies — see plan rev.6 §legacy bucket cutover)"
        )
        return 2

    db = _open_db()
    client = _get_gcs_client()
    try:
        rows = db.query(LegacyBucketMigration).filter(
            LegacyBucketMigration.status == STATUS_SWAPPED,
        ).all()
        if not rows:
            print(f"# no rows in 'swapped' status")
            return 0
        for row in rows:
            print(f"# delete: {row.old_bucket_name}")
            if args.dry_run:
                continue
            try:
                old_bucket = client.bucket(row.old_bucket_name)
                if old_bucket.exists():
                    # 비어 있어야 삭제 가능 — 객체가 남아 있을 수도 (rewrite 가 원본 보존)
                    blobs = list(old_bucket.list_blobs())
                    if blobs:
                        old_bucket.delete_blobs(blobs)
                    old_bucket.delete()
                row.status = STATUS_DELETED
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
            except Exception as exc:
                row.status = STATUS_FAILED
                row.error_message = f"delete: {exc}"
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                logger.error("delete_fail repo_uuid=%s err=%s", row.repo_uuid, exc)
        return 0
    finally:
        db.close()


def cmd_status(args) -> int:
    """현재 진행 상태 리포트."""
    from app.models import LegacyBucketMigration

    db = _open_db()
    try:
        from sqlalchemy import func as _f
        counts = (
            db.query(LegacyBucketMigration.status, _f.count())
            .group_by(LegacyBucketMigration.status)
            .all()
        )
        print(f"# legacy_bucket_migrations status summary (env={args.env})")
        for status, count in counts:
            print(f"  {status:14} {count}")
        # detail of failed rows
        failed = db.query(LegacyBucketMigration).filter(
            LegacyBucketMigration.status == STATUS_FAILED,
        ).all()
        if failed:
            print()
            print(f"# failed rows:")
            for row in failed:
                print(
                    f"  {row.old_bucket_name:50} status_was=? error={row.error_message!r}"
                )
        return 0
    finally:
        db.close()


# ── CLI ────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", required=True, choices=["dev", "stg", "prd"], help="Target environment.")

    sp = parser.add_subparsers(dest="cmd", required=True)
    for cmd_name in ("prepare", "create", "copy", "verify", "manifest", "swap", "delete", "status"):
        c = sp.add_parser(cmd_name)
        c.add_argument("--repo", default=None, help="Single repo 'group/name'. Omit with --all.")
        c.add_argument("--all", action="store_true", help="Process all eligible rows.")
        c.add_argument("--dry-run", action="store_true")
        if cmd_name == "delete":
            c.add_argument("--force-delete", action="store_true", help="Required for stg/prd.")

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.cmd != "status" and not args.repo and not args.all:
        parser.error("either --repo or --all is required")

    handlers = {
        "prepare": cmd_prepare,
        "create": cmd_create,
        "copy": cmd_copy,
        "verify": cmd_verify,
        "manifest": cmd_manifest,
        "swap": cmd_swap,
        "delete": cmd_delete,
        "status": cmd_status,
    }
    return handlers[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())

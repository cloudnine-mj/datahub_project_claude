"""Tests for migrate_legacy_buckets.py helpers + alembic 022 schema (PR 7).

E2E migration 자체는 실 GCS 가 필요해 dev OP-1 단계에서 검증 (사용자 manual).
본 테스트는 helper / model 정합성만 확인.
"""

import pytest

from scripts.migrate_legacy_buckets import (
    STATUS_PENDING,
    STATUS_CREATED,
    STATUS_COPIED,
    STATUS_VERIFIED,
    STATUS_MANIFESTED,
    STATUS_SWAPPED,
    STATUS_DELETED,
    STATUS_FAILED,
    _is_already_opaque,
    _opaque_bucket_name,
    _status_ge,
)


class TestStatusOrdering:
    def test_status_ge_progression(self):
        assert _status_ge(STATUS_SWAPPED, STATUS_VERIFIED)
        assert _status_ge(STATUS_DELETED, STATUS_PENDING)
        assert not _status_ge(STATUS_PENDING, STATUS_CREATED)
        assert not _status_ge(STATUS_CREATED, STATUS_COPIED)

    def test_failed_status_not_ge_anything(self):
        assert not _status_ge(STATUS_FAILED, STATUS_PENDING)
        assert not _status_ge(STATUS_FAILED, STATUS_SWAPPED)


class TestBucketNameClassification:
    def test_old_format_not_opaque(self):
        assert not _is_already_opaque("lgair-dgdh-dev-lab-foo-myrepo", "dev")

    def test_new_opaque_format(self):
        assert _is_already_opaque("lgair-dgdh-dev-r-deadbeef0011223344556677", "dev")

    def test_env_specific(self):
        # prd opaque 형식은 dev opaque 와 prefix 가 다름
        assert _is_already_opaque("lgair-dgdh-prd-r-deadbeef0011223344556677", "prd")
        assert not _is_already_opaque("lgair-dgdh-prd-r-deadbeef0011223344556677", "dev")


class TestOpaqueBucketName:
    def test_starts_with_env_prefix(self):
        name = _opaque_bucket_name("dev", "01928f7c-1234-7abc-89de-fedcba012345")
        assert name.startswith("lgair-dgdh-dev-r-")

    def test_stable_per_repo_uuid(self):
        u = "01928f7c-1234-7abc-89de-fedcba012345"
        assert _opaque_bucket_name("dev", u) == _opaque_bucket_name("dev", u)

    def test_within_63_chars(self):
        name = _opaque_bucket_name("dev", "01928f7c-1234-7abc-89de-fedcba012345")
        assert len(name) <= 63


class TestLegacyBucketMigrationModel:
    """ORM model exists and matches alembic 022 schema."""

    def test_can_construct(self):
        from app.models import LegacyBucketMigration

        row = LegacyBucketMigration(
            id="01928f7c-aaaa-7000-8000-aaaaaaaaaaaa",
            repo_uuid="01928f7c-bbbb-7000-8000-bbbbbbbbbbbb",
            old_bucket_name="lgair-dgdh-dev-lab-foo-old",
            new_bucket_name="lgair-dgdh-dev-r-abc",
            status=STATUS_PENDING,
        )
        assert row.status == STATUS_PENDING
        assert row.old_bucket_name != row.new_bucket_name

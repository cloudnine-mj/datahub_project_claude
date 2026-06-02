"""Tracking table for legacy GCS bucket → opaque cutover.

Revision ID: 022
Revises: 021
Create Date: 2026-05-19 12:00:00.000000

각 단계 (prepare/create/copy/verify/manifest/swap/delete) 별 idempotent 진행
상태 저장. governance §architecture/storage-transfer + plan rev.6 §Legacy bucket
cutover.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "legacy_bucket_migrations",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("repo_uuid", UUID(as_uuid=False), nullable=False),
        sa.Column("old_bucket_name", sa.String(256), nullable=False),
        sa.Column("new_bucket_name", sa.String(256), nullable=False),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("objects_count", sa.Integer, nullable=True),
        sa.Column("objects_bytes", sa.BigInteger, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.ForeignKeyConstraint(["repo_uuid"], ["repos.uuid"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('pending', 'created', 'copied', 'verified', 'manifested', 'swapped', 'deleted', 'failed')",
            name="ck_legacy_bucket_migrations_status",
        ),
        sa.UniqueConstraint("repo_uuid", name="uq_legacy_bucket_migrations_repo_uuid"),
    )
    op.create_index(
        "ix_legacy_bucket_migrations_status",
        "legacy_bucket_migrations",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_legacy_bucket_migrations_status", table_name="legacy_bucket_migrations")
    op.drop_table("legacy_bucket_migrations")

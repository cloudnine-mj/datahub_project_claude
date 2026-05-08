"""Add chunks, manifests, manifest_chunks, copy_sessions tables.

Revision ID: 009
Create Date: 2026-04-23 00:00:00.000000

Implements the CAS chunk registry and copy/stream session tables required for
datahub-api#58 (fastcdc chunked upload + group-scoped copy/stream).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # ── copy_sessions ──────────────────────────────────────────────────────────
    if "copy_sessions" not in existing_tables:
        op.create_table(
            "copy_sessions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("src_repo", sa.String(128), nullable=True),
            sa.Column("src_branch", sa.String(256), nullable=True),
            sa.Column("dest_repo", sa.String(128), nullable=False),
            sa.Column("dest_branch", sa.String(256), nullable=False),
            sa.Column("commit_message", sa.Text, nullable=True),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("status", sa.String(16), nullable=False, server_default="active"),
            sa.Column("files_count", sa.Integer, nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
            sa.Column("completed_at", sa.DateTime, nullable=True),
            sa.Column("commit_id", sa.String(256), nullable=True),
            sa.Column("expires_at", sa.DateTime, nullable=True),
            sa.CheckConstraint(
                "status IN ('pending', 'active', 'committed', 'failed', 'expired')",
                name="ck_copy_session_status",
            ),
        )
        op.create_index("ix_copy_sessions_dest_repo", "copy_sessions", ["dest_repo"])

    # ── chunks ─────────────────────────────────────────────────────────────────
    if "chunks" not in existing_tables:
        op.create_table(
            "chunks",
            sa.Column("oid", sa.String(64), primary_key=True),
            sa.Column("size", sa.BigInteger, nullable=False),
        )

    # ── manifests ──────────────────────────────────────────────────────────────
    if "manifests" not in existing_tables:
        op.create_table(
            "manifests",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("repo_name", sa.String(128), nullable=False),
            sa.Column("branch", sa.String(256), nullable=False),
            sa.Column("file_path", sa.Text, nullable=False),
            sa.Column("total_size", sa.BigInteger, nullable=False, server_default="0"),
            sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column(
                "session_id",
                sa.String(36),
                sa.ForeignKey("copy_sessions.id"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_manifests_repo_name", "manifests", ["repo_name"])
        op.create_index("ix_manifests_session_id", "manifests", ["session_id"])

    # ── manifest_chunks ────────────────────────────────────────────────────────
    if "manifest_chunks" not in existing_tables:
        op.create_table(
            "manifest_chunks",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column(
                "manifest_id",
                sa.String(36),
                sa.ForeignKey("manifests.id"),
                nullable=False,
            ),
            sa.Column("chunk_oid", sa.String(64), sa.ForeignKey("chunks.oid"), nullable=False),
            sa.Column("offset", sa.BigInteger, nullable=False),
            sa.Column("physical_address", sa.Text, nullable=True),
            sa.UniqueConstraint("manifest_id", "offset", name="uq_manifest_chunk_offset"),
        )
        op.create_index("ix_manifest_chunks_manifest_id", "manifest_chunks", ["manifest_id"])


def downgrade() -> None:
    op.drop_table("manifest_chunks")
    op.drop_table("manifests")
    op.drop_table("chunks")
    op.drop_table("copy_sessions")

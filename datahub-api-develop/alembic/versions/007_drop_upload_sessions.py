"""Drop upload_sessions and upload_session_files tables.

UploadSession 기반 다단계 업로드 세션 관리를 제거하고
단순 CAB 토큰 발행 방식으로 대체합니다.

Revision ID: 007
Revises: 006
Create Date: 2026-04-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF EXISTS: dev DB never had these tables (were added then removed before reaching dev)
    op.execute("DROP TABLE IF EXISTS upload_session_files")
    op.execute("DROP TABLE IF EXISTS upload_sessions")


def downgrade() -> None:
    op.create_table(
        "upload_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("repo_name", sa.String(128), nullable=False),
        sa.Column("branch", sa.String(128), nullable=False, server_default="main"),
        sa.Column("remote_prefix", sa.String(1024), nullable=False, server_default=""),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("files_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("files_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("commit_message", sa.Text(), nullable=True),
        sa.Column("commit_id", sa.String(128), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["repo_name"], ["repos.repo_name"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "upload_session_files",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("remote_path", sa.String(1024), nullable=False),
        sa.Column("physical_address", sa.String(1024), nullable=True),
        sa.Column("signed_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("checksum", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["upload_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_upload_session_files_session_id", "upload_session_files", ["session_id"])

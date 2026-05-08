"""Initial schema — 7 테이블.

Revision ID: 001
Create Date: 2025-01-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # api_keys
    op.create_table(
        "api_keys",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("key_prefix", sa.String(12), nullable=False),
        sa.Column("key_hash", sa.String(256), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("last_used", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_prefix"),
    )
    op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"])

    # repos
    op.create_table(
        "repos",
        sa.Column("repo_name", sa.String(128), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("bucket_name", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("repo_name"),
    )

    # permissions
    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("repo_name", sa.String(128), sa.ForeignKey("repos.repo_name"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("granted_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("repo_name", "user_id", name="uq_repo_user"),
        sa.CheckConstraint("role IN ('reader', 'writer')", name="ck_permission_role"),
    )
    op.create_index("ix_permissions_repo_name", "permissions", ["repo_name"])

    # audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("user_email", sa.String(320), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource_type", sa.String(64), nullable=True),
        sa.Column("resource_id", sa.String(256), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'success'")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    # upload_sessions
    op.create_table(
        "upload_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("repo_name", sa.String(128), sa.ForeignKey("repos.repo_name"), nullable=False),
        sa.Column("branch", sa.String(128), nullable=False, server_default=sa.text("'main'")),
        sa.Column("remote_prefix", sa.String(1024), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("files_total", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("files_completed", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("commit_message", sa.Text(), nullable=True),
        sa.Column("commit_id", sa.String(128), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # upload_session_files
    op.create_table(
        "upload_session_files",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("upload_sessions.id"), nullable=False),
        sa.Column("remote_path", sa.String(1024), nullable=False),
        sa.Column("physical_address", sa.String(1024), nullable=True),
        sa.Column("signed_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("checksum", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_upload_session_files_session_id", "upload_session_files", ["session_id"])


def downgrade() -> None:
    op.drop_table("upload_session_files")
    op.drop_table("upload_sessions")
    op.drop_table("audit_logs")
    op.drop_table("permissions")
    op.drop_table("repos")
    op.drop_table("api_keys")
    op.drop_table("users")

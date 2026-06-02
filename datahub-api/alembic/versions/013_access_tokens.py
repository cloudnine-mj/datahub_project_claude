"""access_tokens v2 — rename api_keys, grants 테이블, repos.allow_anonymous_download

Revision ID: 013
Revises: 012
Create Date: 2026-04-30

architecture/access-tokens.md §9.1 의 SQL 을 SQLAlchemy/Alembic 로 옮긴다.

요지
- api_keys → access_tokens (테이블 + key_prefix→token_prefix, key_hash→token_hash 컬럼명)
- access_tokens 의 scope 컬럼 제거, token_type 추가 (read | write | fine_grained)
- access_token_grants 신규 테이블 (token_id FK + (resource_type, resource_id, action) 유니크)
- repos.allow_anonymous_download (BOOLEAN, default FALSE)
- permissions.role enum 정합 (developer → contributor) + owner row 정리 + CHECK 제약
- 기존 활성 토큰을 fine_grained 로 분류 + (user, *, admin) 가상 grant 부착 + 30일 grace 만료
- audit_logs.action 일관화 (apikey_* → token_*)
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 0. api_keys → access_tokens (테이블/컬럼 rename) ────────────────────
    op.rename_table("api_keys", "access_tokens")
    op.alter_column("access_tokens", "key_prefix", new_column_name="token_prefix")
    op.alter_column("access_tokens", "key_hash", new_column_name="token_hash")

    # ── 1. access_tokens 컬럼 변경 (scope 삭제, token_type 추가) ──────────
    op.drop_column("access_tokens", "scope")
    op.add_column(
        "access_tokens",
        sa.Column(
            "token_type",
            sa.String(length=20),
            nullable=False,
            server_default="fine_grained",
        ),
    )

    # ── 2. access_token_grants 신규 테이블 ──────────────────────────────
    op.create_table(
        "access_token_grants",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "token_id",
            sa.Integer,
            sa.ForeignKey("access_tokens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("resource_type", sa.String(length=30), nullable=False),
        sa.Column("resource_id", sa.String(length=200), nullable=True),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime,
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "token_id",
            "resource_type",
            "resource_id",
            "action",
            name="uq_access_token_grants_quad",
        ),
    )
    op.create_index(
        "idx_access_token_grants_lookup",
        "access_token_grants",
        ["token_id"],
    )

    # ── 3. repos.allow_anonymous_download ──────────────────────────────
    op.add_column(
        "repos",
        sa.Column(
            "allow_anonymous_download",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("FALSE"),
        ),
    )

    # ── 4a. permissions.role 정합 (developer → contributor) ────────────
    op.execute(
        "UPDATE permissions SET role = 'contributor' WHERE role = 'developer'"
    )

    # 4b. permissions 의 owner row 정리 (repos.owner_id 가 진실 source)
    op.execute("DELETE FROM permissions WHERE role = 'owner'")

    # 4c. role CHECK 제약 추가 (owner 미포함). 012 까지는 'maintainer/developer/guest'
    #     CHECK 가 걸려있어 먼저 drop 후 재생성.
    op.execute("ALTER TABLE permissions DROP CONSTRAINT IF EXISTS ck_permission_role")
    op.create_check_constraint(
        "ck_permission_role",
        "permissions",
        "role IN ('maintainer', 'contributor', 'guest')",
    )

    # ── 5. 기존 활성 토큰 자동 변환 ─────────────────────────────────────
    # NOTE: 기존 v1 키는 단일 scope='full' 였으므로 fine_grained 로 분류하고
    #       (user, *, admin) 1건의 grant 를 부착해 RBAC 게이트만 거치게 한다.
    op.execute(
        """
        UPDATE access_tokens
           SET token_type = 'fine_grained',
               expires_at = COALESCE(expires_at, now() + interval '30 days')
         WHERE is_active = TRUE
        """
    )
    op.execute(
        """
        INSERT INTO access_token_grants (token_id, resource_type, resource_id, action)
        SELECT id, 'user', '*', 'admin'
          FROM access_tokens
         WHERE is_active = TRUE
        """
    )

    # ── 6. audit_logs action 일관화 (apikey_* → token_*) ────────────────
    op.execute(
        "UPDATE audit_logs SET action = REPLACE(action, 'apikey_', 'token_') "
        "WHERE action LIKE 'apikey_%'"
    )


def downgrade() -> None:
    # 6. audit_logs 역변환
    op.execute(
        "UPDATE audit_logs SET action = REPLACE(action, 'token_', 'apikey_') "
        "WHERE action LIKE 'token_%'"
    )

    # 5/2. token_grants 삭제 (정보 손실 — rollback 비파괴 보장 안 됨)
    op.drop_index("idx_access_token_grants_lookup", table_name="access_token_grants")
    op.drop_table("access_token_grants")

    # 1. token_type 제거, scope 복원
    op.drop_column("access_tokens", "token_type")
    op.add_column(
        "access_tokens",
        sa.Column(
            "scope",
            sa.String(length=20),
            nullable=False,
            server_default="full",
        ),
    )

    # 0. 컬럼/테이블 rename 역변환
    op.alter_column("access_tokens", "token_hash", new_column_name="key_hash")
    op.alter_column("access_tokens", "token_prefix", new_column_name="key_prefix")
    op.rename_table("access_tokens", "api_keys")

    # 3. repos.allow_anonymous_download 제거
    op.drop_column("repos", "allow_anonymous_download")

    # 4c/4a. permissions CHECK 역변환
    op.execute("ALTER TABLE permissions DROP CONSTRAINT IF EXISTS ck_permission_role")
    op.create_check_constraint(
        "ck_permission_role",
        "permissions",
        "role IN ('maintainer', 'developer', 'guest')",
    )
    op.execute(
        "UPDATE permissions SET role = 'developer' WHERE role = 'contributor'"
    )
    # 주의: 4b 의 owner row 삭제는 비가역. 별도 dump 에서 복원 필요.

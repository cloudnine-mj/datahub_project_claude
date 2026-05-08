"""apikey lifecycle columns: name/scope/expires_at/revoked_at/created_ip

Revision ID: 012
Revises: 011
Create Date: 2026-04-24

기존 api_keys 레코드는 name="" / scope="full" / 나머지 NULL 로 유지된다.
server_default 가 걸려 있어 마이그레이션 후 앱 재시작 없이도 NOT NULL 컬럼이
깨지지 않는다.
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "api_keys",
        sa.Column("name", sa.String(length=100), nullable=False, server_default=""),
    )
    op.add_column(
        "api_keys",
        sa.Column("scope", sa.String(length=20), nullable=False, server_default="full"),
    )
    op.add_column("api_keys", sa.Column("expires_at", sa.DateTime(), nullable=True))
    op.add_column("api_keys", sa.Column("revoked_at", sa.DateTime(), nullable=True))
    op.add_column("api_keys", sa.Column("created_ip", sa.String(length=45), nullable=True))


def downgrade() -> None:
    op.drop_column("api_keys", "created_ip")
    op.drop_column("api_keys", "revoked_at")
    op.drop_column("api_keys", "expires_at")
    op.drop_column("api_keys", "scope")
    op.drop_column("api_keys", "name")

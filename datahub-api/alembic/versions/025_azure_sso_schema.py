"""Add Azure AD SSO identity columns to users (PR 2 azure-ad-sso cycle).

Revision ID: 025
Revises: 024
Create Date: 2026-05-19 19:00:00.000000

governance §auth-and-api-keys §1.2 (email linking) + §database-model-spec (User
identity). transition 2주 동안 nullable, 종료 후 azure_oid NOT NULL 로 별 사이클.

추가 컬럼:
  - azure_oid TEXT NULL UNIQUE (azure object id, internal stable identity)
  - azure_tid TEXT NULL (azure tenant id, audit 용)
  - linked_at TIMESTAMPTZ NULL (Azure linking 완료 시점)
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("azure_oid", sa.Text, nullable=True))
    op.add_column("users", sa.Column("azure_tid", sa.Text, nullable=True))
    op.add_column("users", sa.Column("linked_at", sa.DateTime(timezone=True), nullable=True))

    # partial unique index — NULL 끼리는 충돌하지 않으면서 채워진 값만 UNIQUE
    op.create_index(
        "uq_users_azure_oid",
        "users",
        ["azure_oid"],
        unique=True,
        postgresql_where=sa.text("azure_oid IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_azure_oid", table_name="users")
    op.drop_column("users", "linked_at")
    op.drop_column("users", "azure_tid")
    op.drop_column("users", "azure_oid")

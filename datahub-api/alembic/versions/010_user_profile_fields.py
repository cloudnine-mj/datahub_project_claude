"""Add users.role / lab_id / tech_cell_id for unified auth across web/cli.

Revision ID: 010
Create Date: 2026-04-24 00:00:00.000000

Supports datahub-auth-redesign §16: datahub (Next.js) 가 자체 User 테이블에서
관리하던 role / labId / techCellId 를 platform-api 단일 소스로 이관하기 위한
컬럼 확장.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}

    if "role" not in existing_cols:
        op.add_column(
            "users",
            sa.Column(
                "role",
                sa.String(16),
                nullable=False,
                server_default="USER",
            ),
        )
    if "lab_id" not in existing_cols:
        op.add_column("users", sa.Column("lab_id", sa.String(64), nullable=True))
    if "tech_cell_id" not in existing_cols:
        op.add_column("users", sa.Column("tech_cell_id", sa.String(64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}

    if "tech_cell_id" in existing_cols:
        op.drop_column("users", "tech_cell_id")
    if "lab_id" in existing_cols:
        op.drop_column("users", "lab_id")
    if "role" in existing_cols:
        op.drop_column("users", "role")

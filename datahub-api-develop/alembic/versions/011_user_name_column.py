"""Add users.name column for unified profile (Google display name).

Revision ID: 011
Create Date: 2026-04-24 12:00:00.000000

datahub-auth-redesign §16 Phase W2: Web 이 화면에 표시할 사용자 이름을
platform-api 단일 소스에서 읽을 수 있도록 `name` 컬럼을 추가한다.
기존 row 는 NULL, 다음 로그인 시 Google userinfo 로 채움.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}

    if "name" not in existing_cols:
        op.add_column("users", sa.Column("name", sa.String(255), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}

    if "name" in existing_cols:
        op.drop_column("users", "name")

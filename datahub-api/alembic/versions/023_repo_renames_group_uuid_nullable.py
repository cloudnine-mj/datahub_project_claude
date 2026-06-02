"""repo_renames.group_uuid 를 nullable 로 (개인 레포는 group 없음).

Revision ID: 023
Revises: 022
Create Date: 2026-05-19 17:00:00.000000

PR 5 (alembic 021) 가 repo_renames.group_uuid NOT NULL 로 잘못 생성됨. 개인 레포
(group_id IS NULL) 의 rename 시 group_uuid 도 NULL 이어야 하므로 nullable=True 로
완화. governance §repo-identity-spec 정합.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "repo_renames",
        "group_uuid",
        existing_type=UUID(as_uuid=False),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "repo_renames",
        "group_uuid",
        existing_type=UUID(as_uuid=False),
        nullable=False,
    )

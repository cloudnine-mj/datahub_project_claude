"""Add repository metadata source-of-truth table.

Revision ID: 018
Revises: 017
Create Date: 2026-05-13 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _json_type():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.JSONB(astext_type=sa.Text())
    return sa.JSON()


def upgrade() -> None:
    op.create_table(
        "repo_metadata",
        sa.Column("repo_name", sa.String(length=128), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("tags", _json_type(), nullable=False),
        sa.Column("properties", _json_type(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["repo_name"], ["repos.repo_name"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("repo_name"),
    )
    op.execute(
        "INSERT INTO repo_metadata (repo_name, summary, tags, properties) "
        "SELECT repo_name, description, '[]', '{}' FROM repos"
    )


def downgrade() -> None:
    op.drop_table("repo_metadata")

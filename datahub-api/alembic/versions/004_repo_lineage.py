"""Add repo_lineage table for data lineage tracking.

Revision ID: 004
Create Date: 2026-03-23 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "repo_lineage",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("source_repo", sa.String(128), sa.ForeignKey("repos.repo_name"), nullable=False),
        sa.Column("derived_repo", sa.String(128), sa.ForeignKey("repos.repo_name"), nullable=False),
        sa.Column("relation_type", sa.String(32), nullable=False, server_default="derived_from"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source_repo", "derived_repo", name="uq_lineage_pair"),
        sa.CheckConstraint(
            "relation_type IN ('derived_from', 'augmented_from', 'filtered_from', 'merged_from')",
            name="ck_lineage_relation_type",
        ),
    )


def downgrade() -> None:
    op.drop_table("repo_lineage")

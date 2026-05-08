"""Add organizations table and org_id FK to repos.

Revision ID: 005
Create Date: 2026-04-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("org_name", sa.String(255), unique=True, nullable=False),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("visibility", sa.String(10), nullable=False, server_default="private"),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("visibility IN ('public', 'private')", name="ck_org_visibility"),
    )
    op.create_index("ix_organizations_org_name", "organizations", ["org_name"])

    op.add_column(
        "repos",
        sa.Column("org_id", sa.Integer, sa.ForeignKey("organizations.id"), nullable=True),
    )
    op.create_index("ix_repos_org_id", "repos", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_repos_org_id", table_name="repos")
    op.drop_column("repos", "org_id")

    op.drop_index("ix_organizations_org_name", table_name="organizations")
    op.drop_table("organizations")

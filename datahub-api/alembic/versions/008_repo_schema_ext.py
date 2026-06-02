"""Add description and repo_type columns to repos table.

Revision ID: 008
Create Date: 2026-04-22 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)
    existing_columns = {col["name"] for col in inspector.get_columns("repos")}
    existing_constraints = {c["name"] for c in inspector.get_check_constraints("repos")}

    if "description" not in existing_columns:
        op.add_column("repos", sa.Column("description", sa.Text, nullable=True))

    if "repo_type" not in existing_columns:
        op.add_column(
            "repos",
            sa.Column(
                "repo_type",
                sa.String(1),
                nullable=True,
                comment="A=dataset, B=model",
            ),
        )

    if "ck_repo_type" not in existing_constraints:
        op.create_check_constraint(
            "ck_repo_type",
            "repos",
            "repo_type IS NULL OR repo_type IN ('A', 'B')",
        )


def downgrade() -> None:
    op.drop_constraint("ck_repo_type", "repos", type_="check")
    op.drop_column("repos", "repo_type")
    op.drop_column("repos", "description")

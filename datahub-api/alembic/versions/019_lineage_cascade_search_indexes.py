"""Add lineage cascade and metadata search indexes.

Revision ID: 019
Revises: 018
Create Date: 2026-05-13 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_constraint("repo_lineage_source_repo_fkey", "repo_lineage", type_="foreignkey")
    op.drop_constraint("repo_lineage_derived_repo_fkey", "repo_lineage", type_="foreignkey")
    op.create_foreign_key(
        "repo_lineage_source_repo_fkey",
        "repo_lineage",
        "repos",
        ["source_repo"],
        ["repo_name"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "repo_lineage_derived_repo_fkey",
        "repo_lineage",
        "repos",
        ["derived_repo"],
        ["repo_name"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_repo_metadata_tags_gin",
        "repo_metadata",
        ["tags"],
        postgresql_using="gin",
    )
    op.create_index(
        "ix_repo_metadata_properties_gin",
        "repo_metadata",
        ["properties"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.drop_index("ix_repo_metadata_properties_gin", table_name="repo_metadata")
    op.drop_index("ix_repo_metadata_tags_gin", table_name="repo_metadata")
    op.drop_constraint("repo_lineage_source_repo_fkey", "repo_lineage", type_="foreignkey")
    op.drop_constraint("repo_lineage_derived_repo_fkey", "repo_lineage", type_="foreignkey")
    op.create_foreign_key(
        "repo_lineage_source_repo_fkey",
        "repo_lineage",
        "repos",
        ["source_repo"],
        ["repo_name"],
    )
    op.create_foreign_key(
        "repo_lineage_derived_repo_fkey",
        "repo_lineage",
        "repos",
        ["derived_repo"],
        ["repo_name"],
    )

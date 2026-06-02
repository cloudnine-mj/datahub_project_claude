"""Legacy repo_name FK 에 ON UPDATE CASCADE 추가 (rename invariant 지원).

Revision ID: 024
Revises: 023
Create Date: 2026-05-19 18:00:00.000000

PR 5 의 rename 흐름이 `UPDATE repos SET repo_name = ?` 를 수행한다. 종속 테이블
들이 `repos.repo_name` 을 FK 로 참조하는데 ON UPDATE 가 없어서 PostgreSQL 이
FK violation 으로 차단. 모든 legacy repo_name FK 에 ON UPDATE CASCADE 추가해
rename 자동 전파.

UUID FK (`repo_uuid`) 는 immutable 이라 무영향. 본 변경은 dual-write 의 legacy
경로만 보강.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 각 자식 테이블: (table, fk_constraint_name, fk_column, ondelete)
# fk_constraint_name 은 postgres auto-generated. 확인된 명칭.
_LEGACY_FKS = [
    # (table, fk_name, column, ondelete)
    ("repo_metadata", "repo_metadata_repo_name_fkey", "repo_name", "CASCADE"),
    ("permissions", "permissions_repo_name_fkey", "repo_name", None),
    ("repo_public_access_policies", "repo_public_access_policies_repo_name_fkey", "repo_name", "CASCADE"),
    ("team_repo_permissions", "team_repo_permissions_repo_name_fkey", "repo_name", None),
    ("repo_lineage", "repo_lineage_source_repo_fkey", "source_repo", "CASCADE"),
    ("repo_lineage", "repo_lineage_derived_repo_fkey", "derived_repo", "CASCADE"),
]


def upgrade() -> None:
    for table, fk_name, column, ondelete in _LEGACY_FKS:
        # drop existing FK
        op.drop_constraint(fk_name, table, type_="foreignkey")
        # recreate with ON UPDATE CASCADE (preserve ondelete)
        op.create_foreign_key(
            fk_name,
            table,
            "repos",
            [column],
            ["repo_name"],
            onupdate="CASCADE",
            ondelete=ondelete,
        )


def downgrade() -> None:
    for table, fk_name, column, ondelete in _LEGACY_FKS:
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(
            fk_name,
            table,
            "repos",
            [column],
            ["repo_name"],
            ondelete=ondelete,
        )

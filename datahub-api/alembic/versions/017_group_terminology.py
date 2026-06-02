"""Rename owner/org columns to group for terminology unification.

governance source-of-truth:
  datahub-governance !112 (2026-05-12 merged): namespace 표현을 `group` 으로 통일.
  RBAC role 의 `owner` (Permission.role, Repo.owner_id, Organization.owner_id) 는 보존.

변경:
  - organizations.org_name → group_name
    * index: ix_organizations_org_name → ix_organizations_group_name
  - repos.org_id → group_id
    * index: ix_repos_org_id → ix_repos_group_id
  - organization_memberships.org_id → group_id
    * index: ix_organization_memberships_org_id → ix_organization_memberships_group_id
    * unique: uq_org_membership_user → uq_group_membership_user
  - teams.org_id → group_id
    * index: ix_teams_org_id → ix_teams_group_id
    * unique: uq_team_org_name → uq_team_group_name

호환:
  - 테이블 이름 `organizations` / `organization_memberships` 는 유지
    (외부 API legacy contract). 다음 deprecation cycle 까지 alias 로만 사용.
  - 클라이언트 schema 의 `org_name` (OrganizationInfo) 응답 필드는 유지 — 라우터에서
    ORM `group_name` 을 그대로 매핑.

prd 적용:
  - 단순 ALTER COLUMN ... RENAME. PG 는 metadata-only lock (AccessExclusive 짧은
  순간). 적용 전 off-hour 점검 공지 필요 (사용자 결정 #2: a 안).

Revision ID: 017
Create Date: 2026-05-12 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector


revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _rename_index_if_present(
    inspector: Inspector,
    table: str,
    old: str,
    new: str,
) -> None:
    names = {idx["name"] for idx in inspector.get_indexes(table)}
    if old in names:
        op.execute(f'ALTER INDEX "{old}" RENAME TO "{new}"')


def _rename_constraint_if_present(
    inspector: Inspector,
    table: str,
    old: str,
    new: str,
    kind: str = "unique",
) -> None:
    """PG 의 ALTER TABLE ... RENAME CONSTRAINT 로 unique/check 이름 변경."""
    if kind == "unique":
        names = {uq["name"] for uq in inspector.get_unique_constraints(table)}
    elif kind == "check":
        names = {ck["name"] for ck in inspector.get_check_constraints(table)}
    else:
        names = set()
    if old in names:
        op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{old}" TO "{new}"')


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    inspector: Inspector = sa.inspect(bind)

    # 1. organizations.org_name → group_name
    op.alter_column("organizations", "org_name", new_column_name="group_name")
    if dialect == "postgresql":
        _rename_index_if_present(
            inspector,
            "organizations",
            "ix_organizations_org_name",
            "ix_organizations_group_name",
        )

    # 2. repos.org_id → group_id
    op.alter_column("repos", "org_id", new_column_name="group_id")
    if dialect == "postgresql":
        _rename_index_if_present(
            inspector,
            "repos",
            "ix_repos_org_id",
            "ix_repos_group_id",
        )

    # 3. organization_memberships.org_id → group_id (+ unique + index rename)
    op.alter_column("organization_memberships", "org_id", new_column_name="group_id")
    if dialect == "postgresql":
        _rename_index_if_present(
            inspector,
            "organization_memberships",
            "ix_organization_memberships_org_id",
            "ix_organization_memberships_group_id",
        )
        _rename_constraint_if_present(
            inspector,
            "organization_memberships",
            "uq_org_membership_user",
            "uq_group_membership_user",
            kind="unique",
        )

    # 4. teams.org_id → group_id (+ unique + index rename)
    op.alter_column("teams", "org_id", new_column_name="group_id")
    if dialect == "postgresql":
        _rename_index_if_present(
            inspector,
            "teams",
            "ix_teams_org_id",
            "ix_teams_group_id",
        )
        _rename_constraint_if_present(
            inspector,
            "teams",
            "uq_team_org_name",
            "uq_team_group_name",
            kind="unique",
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    inspector: Inspector = sa.inspect(bind)

    # 정확히 역순.

    # 4. teams.group_id → org_id
    op.alter_column("teams", "group_id", new_column_name="org_id")
    if dialect == "postgresql":
        _rename_index_if_present(
            inspector,
            "teams",
            "ix_teams_group_id",
            "ix_teams_org_id",
        )
        _rename_constraint_if_present(
            inspector,
            "teams",
            "uq_team_group_name",
            "uq_team_org_name",
            kind="unique",
        )

    # 3. organization_memberships.group_id → org_id
    op.alter_column("organization_memberships", "group_id", new_column_name="org_id")
    if dialect == "postgresql":
        _rename_index_if_present(
            inspector,
            "organization_memberships",
            "ix_organization_memberships_group_id",
            "ix_organization_memberships_org_id",
        )
        _rename_constraint_if_present(
            inspector,
            "organization_memberships",
            "uq_group_membership_user",
            "uq_org_membership_user",
            kind="unique",
        )

    # 2. repos.group_id → org_id
    op.alter_column("repos", "group_id", new_column_name="org_id")
    if dialect == "postgresql":
        _rename_index_if_present(
            inspector,
            "repos",
            "ix_repos_group_id",
            "ix_repos_org_id",
        )

    # 1. organizations.group_name → org_name
    op.alter_column("organizations", "group_name", new_column_name="org_name")
    if dialect == "postgresql":
        _rename_index_if_present(
            inspector,
            "organizations",
            "ix_organizations_group_name",
            "ix_organizations_org_name",
        )

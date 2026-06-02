"""Align repository roles on contributor naming.

Revision ID: 015
Revises: 014
Create Date: 2026-05-09
"""

from __future__ import annotations

from typing import Union

from alembic import op


revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.execute("UPDATE organization_memberships SET role = 'contributor' WHERE role = 'developer'")
    op.execute("UPDATE team_repo_permissions SET role = 'contributor' WHERE role = 'developer'")

    op.execute("ALTER TABLE organization_memberships DROP CONSTRAINT IF EXISTS ck_org_membership_role")
    op.create_check_constraint(
        "ck_org_membership_role",
        "organization_memberships",
        "role IN ('maintainer', 'contributor', 'guest')",
    )

    op.execute("ALTER TABLE team_repo_permissions DROP CONSTRAINT IF EXISTS ck_team_repo_permission_role")
    op.create_check_constraint(
        "ck_team_repo_permission_role",
        "team_repo_permissions",
        "role IN ('maintainer', 'contributor', 'guest')",
    )


def downgrade() -> None:
    op.execute("ALTER TABLE team_repo_permissions DROP CONSTRAINT IF EXISTS ck_team_repo_permission_role")
    op.create_check_constraint(
        "ck_team_repo_permission_role",
        "team_repo_permissions",
        "role IN ('maintainer', 'developer', 'guest')",
    )
    op.execute("UPDATE team_repo_permissions SET role = 'developer' WHERE role = 'contributor'")

    op.execute("ALTER TABLE organization_memberships DROP CONSTRAINT IF EXISTS ck_org_membership_role")
    op.create_check_constraint(
        "ck_org_membership_role",
        "organization_memberships",
        "role IN ('maintainer', 'developer', 'guest')",
    )
    op.execute("UPDATE organization_memberships SET role = 'developer' WHERE role = 'contributor'")

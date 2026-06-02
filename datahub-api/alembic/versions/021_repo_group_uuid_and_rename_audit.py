"""Repo/Group UUIDv7 stable identity + dependent FK + rename audit tables.

Revision ID: 021
Revises: 020
Create Date: 2026-05-19 00:00:00.000000

governance §repo-identity-spec ("Internal Stable Identity vs User-facing Slug"),
§database-model-spec (UUID FK 재포팅), §architecture/principles.md ("Opaque
immutable identity"). dual-write 패턴: 기존 PK 는 보존, UUID 컬럼은 alternate
unique key 로 추가. PK swap 은 별 사이클 (legacy_fk_drop).

Postgres 16 환경이므로 application-side UUIDv7 발급
(`app.services.repo_identity.new_uuid7`).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _new_uuid7_hex() -> str:
    """alembic context 에서 backfill 용 UUIDv7 문자열 생성.

    app.services.repo_identity.new_uuid7 와 동일 알고리즘이지만 alembic 환경에서
    application code 를 import 하지 않도록 inline 화.
    """
    import os
    import time
    import uuid

    unix_ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand_a = int.from_bytes(os.urandom(2), "big") & 0x0FFF
    rand_b = int.from_bytes(os.urandom(8), "big") & ((1 << 62) - 1)
    value = (unix_ms << 80) | (0x7 << 76) | (rand_a << 64) | (0b10 << 62) | rand_b
    return str(uuid.UUID(int=value))


def upgrade() -> None:
    bind = op.get_bind()

    # ── 1. organizations.uuid (groups stable id) ────────────────────────────
    op.add_column("organizations", sa.Column("uuid", UUID(as_uuid=False), nullable=True))
    # backfill
    orgs = bind.execute(sa.text("SELECT id FROM organizations")).fetchall()
    for (org_id,) in orgs:
        bind.execute(
            sa.text("UPDATE organizations SET uuid = :u WHERE id = :id"),
            {"u": _new_uuid7_hex(), "id": org_id},
        )
    op.alter_column("organizations", "uuid", nullable=False)
    op.create_unique_constraint("uq_organizations_uuid", "organizations", ["uuid"])

    # ── 2. repos.uuid (repos stable id) + group_uuid (FK to organizations.uuid) ─
    op.add_column("repos", sa.Column("uuid", UUID(as_uuid=False), nullable=True))
    op.add_column("repos", sa.Column("group_uuid", UUID(as_uuid=False), nullable=True))
    # backfill repos.uuid + group_uuid (join via group_id → organizations.id → uuid)
    repos = bind.execute(sa.text("SELECT repo_name, group_id FROM repos")).fetchall()
    for repo_name, group_id in repos:
        repo_uuid = _new_uuid7_hex()
        group_uuid = None
        if group_id is not None:
            row = bind.execute(
                sa.text("SELECT uuid FROM organizations WHERE id = :id"),
                {"id": group_id},
            ).fetchone()
            if row:
                group_uuid = row[0]
        bind.execute(
            sa.text("UPDATE repos SET uuid = :u, group_uuid = :gu WHERE repo_name = :name"),
            {"u": repo_uuid, "gu": group_uuid, "name": repo_name},
        )
    op.alter_column("repos", "uuid", nullable=False)
    op.create_unique_constraint("uq_repos_uuid", "repos", ["uuid"])
    op.create_foreign_key(
        "fk_repos_group_uuid", "repos", "organizations",
        ["group_uuid"], ["uuid"], ondelete="RESTRICT",
    )
    # group_uuid + repo_name composite unique — mutable slug 의 격리 단위
    op.create_unique_constraint(
        "uq_repos_group_uuid_repo_name",
        "repos",
        ["group_uuid", "repo_name"],
    )
    # bucket_name 도 unique — opaque hash 충돌 방어
    op.create_index("ix_repos_bucket_name_unique", "repos", ["bucket_name"], unique=True, postgresql_where=sa.text("bucket_name IS NOT NULL"))

    # ── 3. dependent FK columns (UUID 신규 추가, legacy column 유지 — dual write) ─
    # repo_metadata.repo_uuid
    op.add_column("repo_metadata", sa.Column("repo_uuid", UUID(as_uuid=False), nullable=True))
    bind.execute(sa.text(
        "UPDATE repo_metadata SET repo_uuid = r.uuid FROM repos r WHERE repo_metadata.repo_name = r.repo_name"
    ))
    op.create_foreign_key(
        "fk_repo_metadata_repo_uuid", "repo_metadata", "repos",
        ["repo_uuid"], ["uuid"], ondelete="CASCADE",
    )
    op.create_index("ix_repo_metadata_repo_uuid", "repo_metadata", ["repo_uuid"])

    # permissions.repo_uuid
    op.add_column("permissions", sa.Column("repo_uuid", UUID(as_uuid=False), nullable=True))
    bind.execute(sa.text(
        "UPDATE permissions SET repo_uuid = r.uuid FROM repos r WHERE permissions.repo_name = r.repo_name"
    ))
    op.create_foreign_key(
        "fk_permissions_repo_uuid", "permissions", "repos",
        ["repo_uuid"], ["uuid"], ondelete="CASCADE",
    )
    op.create_index("ix_permissions_repo_uuid", "permissions", ["repo_uuid"])

    # repo_public_access_policies.repo_uuid
    op.add_column("repo_public_access_policies", sa.Column("repo_uuid", UUID(as_uuid=False), nullable=True))
    bind.execute(sa.text(
        "UPDATE repo_public_access_policies SET repo_uuid = r.uuid FROM repos r WHERE repo_public_access_policies.repo_name = r.repo_name"
    ))
    op.create_foreign_key(
        "fk_repo_public_access_policies_repo_uuid", "repo_public_access_policies", "repos",
        ["repo_uuid"], ["uuid"], ondelete="CASCADE",
    )
    op.create_index("ix_repo_public_access_policies_repo_uuid", "repo_public_access_policies", ["repo_uuid"])

    # team_repo_permissions.repo_uuid
    op.add_column("team_repo_permissions", sa.Column("repo_uuid", UUID(as_uuid=False), nullable=True))
    bind.execute(sa.text(
        "UPDATE team_repo_permissions SET repo_uuid = r.uuid FROM repos r WHERE team_repo_permissions.repo_name = r.repo_name"
    ))
    op.create_foreign_key(
        "fk_team_repo_permissions_repo_uuid", "team_repo_permissions", "repos",
        ["repo_uuid"], ["uuid"], ondelete="CASCADE",
    )
    op.create_index("ix_team_repo_permissions_repo_uuid", "team_repo_permissions", ["repo_uuid"])

    # repo_lineage.source_repo_uuid, derived_repo_uuid
    op.add_column("repo_lineage", sa.Column("source_repo_uuid", UUID(as_uuid=False), nullable=True))
    op.add_column("repo_lineage", sa.Column("derived_repo_uuid", UUID(as_uuid=False), nullable=True))
    bind.execute(sa.text(
        "UPDATE repo_lineage SET source_repo_uuid = r.uuid FROM repos r WHERE repo_lineage.source_repo = r.repo_name"
    ))
    bind.execute(sa.text(
        "UPDATE repo_lineage SET derived_repo_uuid = r.uuid FROM repos r WHERE repo_lineage.derived_repo = r.repo_name"
    ))
    op.create_foreign_key(
        "fk_repo_lineage_source_repo_uuid", "repo_lineage", "repos",
        ["source_repo_uuid"], ["uuid"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_repo_lineage_derived_repo_uuid", "repo_lineage", "repos",
        ["derived_repo_uuid"], ["uuid"], ondelete="CASCADE",
    )
    op.create_index("ix_repo_lineage_source_repo_uuid", "repo_lineage", ["source_repo_uuid"])
    op.create_index("ix_repo_lineage_derived_repo_uuid", "repo_lineage", ["derived_repo_uuid"])

    # organization_memberships.group_uuid (legacy group_id FK 유지, dual write)
    op.add_column("organization_memberships", sa.Column("group_uuid", UUID(as_uuid=False), nullable=True))
    bind.execute(sa.text(
        "UPDATE organization_memberships SET group_uuid = o.uuid FROM organizations o WHERE organization_memberships.group_id = o.id"
    ))
    op.create_foreign_key(
        "fk_organization_memberships_group_uuid", "organization_memberships", "organizations",
        ["group_uuid"], ["uuid"], ondelete="CASCADE",
    )
    op.create_index("ix_organization_memberships_group_uuid", "organization_memberships", ["group_uuid"])

    # teams.group_uuid
    op.add_column("teams", sa.Column("group_uuid", UUID(as_uuid=False), nullable=True))
    bind.execute(sa.text(
        "UPDATE teams SET group_uuid = o.uuid FROM organizations o WHERE teams.group_id = o.id"
    ))
    op.create_foreign_key(
        "fk_teams_group_uuid", "teams", "organizations",
        ["group_uuid"], ["uuid"], ondelete="CASCADE",
    )
    op.create_index("ix_teams_group_uuid", "teams", ["group_uuid"])

    # ── 4. rename audit tables ───────────────────────────────────────────────
    op.create_table(
        "group_renames",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("group_uuid", UUID(as_uuid=False), nullable=False),
        sa.Column("old_slug", sa.String(255), nullable=False),
        sa.Column("new_slug", sa.String(255), nullable=False),
        sa.Column("renamed_by", sa.Integer, nullable=False),
        sa.Column("renamed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("reason", sa.Text, nullable=True),
        sa.ForeignKeyConstraint(["group_uuid"], ["organizations.uuid"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["renamed_by"], ["users.id"]),
    )
    op.create_index("ix_group_renames_group_uuid_at", "group_renames", ["group_uuid", "renamed_at"])
    op.create_index("ix_group_renames_old_slug", "group_renames", ["old_slug"])

    op.create_table(
        "repo_renames",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("repo_uuid", UUID(as_uuid=False), nullable=False),
        sa.Column("group_uuid", UUID(as_uuid=False), nullable=False),  # snapshot at rename time
        sa.Column("old_name", sa.String(128), nullable=False),
        sa.Column("new_name", sa.String(128), nullable=False),
        sa.Column("renamed_by", sa.Integer, nullable=False),
        sa.Column("renamed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("reason", sa.Text, nullable=True),
        sa.ForeignKeyConstraint(["repo_uuid"], ["repos.uuid"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["renamed_by"], ["users.id"]),
    )
    op.create_index("ix_repo_renames_repo_uuid_at", "repo_renames", ["repo_uuid", "renamed_at"])
    op.create_index("ix_repo_renames_group_old_name", "repo_renames", ["group_uuid", "old_name"])


def downgrade() -> None:
    # rename audit tables
    op.drop_index("ix_repo_renames_group_old_name", table_name="repo_renames")
    op.drop_index("ix_repo_renames_repo_uuid_at", table_name="repo_renames")
    op.drop_table("repo_renames")
    op.drop_index("ix_group_renames_old_slug", table_name="group_renames")
    op.drop_index("ix_group_renames_group_uuid_at", table_name="group_renames")
    op.drop_table("group_renames")

    # dependent FK columns
    op.drop_index("ix_teams_group_uuid", table_name="teams")
    op.drop_constraint("fk_teams_group_uuid", "teams", type_="foreignkey")
    op.drop_column("teams", "group_uuid")

    op.drop_index("ix_organization_memberships_group_uuid", table_name="organization_memberships")
    op.drop_constraint("fk_organization_memberships_group_uuid", "organization_memberships", type_="foreignkey")
    op.drop_column("organization_memberships", "group_uuid")

    op.drop_index("ix_repo_lineage_derived_repo_uuid", table_name="repo_lineage")
    op.drop_index("ix_repo_lineage_source_repo_uuid", table_name="repo_lineage")
    op.drop_constraint("fk_repo_lineage_derived_repo_uuid", "repo_lineage", type_="foreignkey")
    op.drop_constraint("fk_repo_lineage_source_repo_uuid", "repo_lineage", type_="foreignkey")
    op.drop_column("repo_lineage", "derived_repo_uuid")
    op.drop_column("repo_lineage", "source_repo_uuid")

    op.drop_index("ix_team_repo_permissions_repo_uuid", table_name="team_repo_permissions")
    op.drop_constraint("fk_team_repo_permissions_repo_uuid", "team_repo_permissions", type_="foreignkey")
    op.drop_column("team_repo_permissions", "repo_uuid")

    op.drop_index("ix_repo_public_access_policies_repo_uuid", table_name="repo_public_access_policies")
    op.drop_constraint("fk_repo_public_access_policies_repo_uuid", "repo_public_access_policies", type_="foreignkey")
    op.drop_column("repo_public_access_policies", "repo_uuid")

    op.drop_index("ix_permissions_repo_uuid", table_name="permissions")
    op.drop_constraint("fk_permissions_repo_uuid", "permissions", type_="foreignkey")
    op.drop_column("permissions", "repo_uuid")

    op.drop_index("ix_repo_metadata_repo_uuid", table_name="repo_metadata")
    op.drop_constraint("fk_repo_metadata_repo_uuid", "repo_metadata", type_="foreignkey")
    op.drop_column("repo_metadata", "repo_uuid")

    # repos.uuid + group_uuid
    op.drop_index("ix_repos_bucket_name_unique", table_name="repos")
    op.drop_constraint("uq_repos_group_uuid_repo_name", "repos", type_="unique")
    op.drop_constraint("fk_repos_group_uuid", "repos", type_="foreignkey")
    op.drop_constraint("uq_repos_uuid", "repos", type_="unique")
    op.drop_column("repos", "group_uuid")
    op.drop_column("repos", "uuid")

    # organizations.uuid
    op.drop_constraint("uq_organizations_uuid", "organizations", type_="unique")
    op.drop_column("organizations", "uuid")

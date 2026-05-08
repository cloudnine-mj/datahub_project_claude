"""repo_public_access_policies 테이블 + visibility fine_grained 확장

governance source-of-truth:
  - docs/dev_docs/product-specs/repository-visibility-policy.md (Accepted)
  - docs/dev_docs/api-specs/repository-api-spec.md
  - docs/dev_docs/cli-specs/repo-command-spec.md

변경 내용:
  1) repos.visibility CHECK constraint 를 ('public','private','fine_grained') 로 확장
  2) 신규 테이블 repo_public_access_policies — repository 별 6 capability set
  3) 기존 repos row 마다 policy row backfill (visibility 따라 capability 일괄 설정)

Capability 6개 (governance 명세 그대로):
  discoverable / metadata_read / file_list / file_read / lineage_read / stats_read

Revision ID: 014
Create Date: 2026-05-06 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)

    existing_constraints = {c["name"] for c in inspector.get_check_constraints("repos")}
    if "ck_repo_visibility" in existing_constraints:
        op.drop_constraint("ck_repo_visibility", "repos", type_="check")
    op.create_check_constraint(
        "ck_repo_visibility",
        "repos",
        "visibility IN ('public', 'private', 'fine_grained')",
    )

    existing_tables = set(inspector.get_table_names())
    if "repo_public_access_policies" not in existing_tables:
        op.create_table(
            "repo_public_access_policies",
            sa.Column(
                "repo_name",
                sa.String(128),
                sa.ForeignKey("repos.repo_name", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("discoverable", sa.Boolean, nullable=False, server_default=sa.text("true")),
            sa.Column("metadata_read", sa.Boolean, nullable=False, server_default=sa.text("true")),
            sa.Column("file_list", sa.Boolean, nullable=False, server_default=sa.text("true")),
            sa.Column("file_read", sa.Boolean, nullable=False, server_default=sa.text("true")),
            sa.Column("lineage_read", sa.Boolean, nullable=False, server_default=sa.text("true")),
            sa.Column("stats_read", sa.Boolean, nullable=False, server_default=sa.text("true")),
            sa.Column("version", sa.Integer, nullable=False, server_default="1"),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    # backfill: 기존 repo 마다 policy row 생성. visibility 에 따라 capability 일괄 결정.
    # 'public' → 모두 true (default), 'private' → 모두 false.
    # 기존 'allow_anonymous_download=false' 인 public 레포는 file_read 만 false 로 정정.
    op.execute(
        """
        INSERT INTO repo_public_access_policies (
            repo_name,
            discoverable, metadata_read, file_list, file_read, lineage_read, stats_read,
            version, updated_at
        )
        SELECT
            r.repo_name,
            CASE WHEN r.visibility = 'public' THEN true  ELSE false END,
            CASE WHEN r.visibility = 'public' THEN true  ELSE false END,
            CASE WHEN r.visibility = 'public' THEN true  ELSE false END,
            CASE
                WHEN r.visibility = 'public' AND r.allow_anonymous_download = true THEN true
                ELSE false
            END,
            CASE WHEN r.visibility = 'public' THEN true  ELSE false END,
            CASE WHEN r.visibility = 'public' THEN true  ELSE false END,
            1,
            NOW()
        FROM repos r
        WHERE NOT EXISTS (
            SELECT 1 FROM repo_public_access_policies p WHERE p.repo_name = r.repo_name
        )
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)

    if "repo_public_access_policies" in set(inspector.get_table_names()):
        op.drop_table("repo_public_access_policies")

    existing_constraints = {c["name"] for c in inspector.get_check_constraints("repos")}
    if "ck_repo_visibility" in existing_constraints:
        op.drop_constraint("ck_repo_visibility", "repos", type_="check")
    op.create_check_constraint(
        "ck_repo_visibility",
        "repos",
        "visibility IN ('public', 'private')",
    )
    # 기존에 fine_grained 였던 row 는 private 로 demote (안전)
    op.execute("UPDATE repos SET visibility = 'private' WHERE visibility = 'fine_grained'")

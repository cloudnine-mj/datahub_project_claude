"""RBAC: visibility on repos, new role set on permissions.

- repos: add visibility column (public/private, default public)
- permissions: change role constraint reader/writer -> maintainer/developer/guest
- migrate existing data: reader -> guest, writer -> developer

Revision ID: 003
Create Date: 2026-03-23 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── repos.visibility ──
    op.add_column(
        "repos",
        sa.Column("visibility", sa.VARCHAR(16), nullable=False, server_default="public"),
    )
    op.create_check_constraint("ck_repo_visibility", "repos", "visibility IN ('public', 'private')")

    # ── permissions.role 마이그레이션 ──
    # 1) 기존 데이터 변환
    op.execute("UPDATE permissions SET role = 'guest' WHERE role = 'reader'")
    op.execute("UPDATE permissions SET role = 'developer' WHERE role = 'writer'")

    # 2) 제약조건 교체
    op.drop_constraint("ck_permission_role", "permissions", type_="check")
    op.create_check_constraint(
        "ck_permission_role", "permissions",
        "role IN ('maintainer', 'developer', 'guest')",
    )


def downgrade() -> None:
    # ── permissions.role 롤백 ──
    op.drop_constraint("ck_permission_role", "permissions", type_="check")

    op.execute("UPDATE permissions SET role = 'reader' WHERE role = 'guest'")
    op.execute("UPDATE permissions SET role = 'writer' WHERE role IN ('developer', 'maintainer')")

    op.create_check_constraint(
        "ck_permission_role", "permissions",
        "role IN ('reader', 'writer')",
    )

    # ── repos.visibility 롤백 ──
    op.drop_constraint("ck_repo_visibility", "repos", type_="check")
    op.drop_column("repos", "visibility")

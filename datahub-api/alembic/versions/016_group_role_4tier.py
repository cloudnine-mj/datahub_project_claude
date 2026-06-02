"""Group membership role 4-tier (owner/maintainer/contributor/guest)

governance source-of-truth:
  docs/api/groups.md (2026-05-08 머지: 그룹 역할을 저장소와 동일한 4-tier 로 통일)

변경:
  - organization_memberships.role CHECK 를
    ('owner','maintainer','contributor','guest') 로 확장.
  - 기존 row 에 'developer' 또는 'member' 가 있으면 'contributor' 로 backfill
    (governance 마이그레이션 노트).
  - 'owner' role 은 organization_memberships 에 명시 row 로 들어가지 않음
    (organizations.owner_id 가 단일 owner 를 표현). CHECK 만 허용.

Revision ID: 016
Create Date: 2026-05-08 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)

    # 기존 row 의 'developer'/'member' 등 4-tier 외 값 → 'contributor' 매핑
    op.execute(
        """
        UPDATE organization_memberships
           SET role = 'contributor'
         WHERE role IN ('developer', 'member')
        """
    )

    existing = {c["name"] for c in inspector.get_check_constraints("organization_memberships")}
    if "ck_org_membership_role" in existing:
        op.drop_constraint("ck_org_membership_role", "organization_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_membership_role",
        "organization_memberships",
        "role IN ('owner', 'maintainer', 'contributor', 'guest')",
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector: Inspector = sa.inspect(bind)

    # 4-tier 외 값은 downgrade 시 더 강한 set 'guest' 로 demote
    op.execute(
        """
        UPDATE organization_memberships
           SET role = 'guest'
         WHERE role NOT IN ('maintainer', 'contributor', 'guest')
        """
    )

    existing = {c["name"] for c in inspector.get_check_constraints("organization_memberships")}
    if "ck_org_membership_role" in existing:
        op.drop_constraint("ck_org_membership_role", "organization_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_membership_role",
        "organization_memberships",
        "role IN ('maintainer', 'contributor', 'guest')",
    )

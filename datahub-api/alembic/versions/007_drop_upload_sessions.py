"""Reserve removed upload session cleanup revision.

The launch-target contract uses direct GCS CAB token issuance and does not
recreate the removed upload session tables on downgrade.

Revision ID: 007
Revises: 006
Create Date: 2026-04-22
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF EXISTS: dev DB never had these tables (were added then removed before reaching dev)
    op.execute("DROP TABLE IF EXISTS upload_session_files")
    op.execute("DROP TABLE IF EXISTS upload_sessions")


def downgrade() -> None:
    return None

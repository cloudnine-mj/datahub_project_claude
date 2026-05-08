"""Set default for upload_sessions.remote_prefix (1:1 repo-dataset refactor).

Revision ID: 002
Create Date: 2026-03-09 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "upload_sessions",
        "remote_prefix",
        server_default="",
    )


def downgrade() -> None:
    op.alter_column(
        "upload_sessions",
        "remote_prefix",
        server_default=None,
    )

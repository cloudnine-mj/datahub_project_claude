"""Reserved legacy upload-session revision.

Revision ID: 002
Create Date: 2026-03-09 00:00:00.000000

The upload session table is not part of the launch-target contract. Keep this
revision as a no-op so the migration chain remains linear.
"""

from typing import Sequence, Union

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    return None


def downgrade() -> None:
    return None

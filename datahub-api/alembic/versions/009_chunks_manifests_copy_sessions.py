"""Reserved legacy revision.

Revision ID: 009
Create Date: 2026-04-23 00:00:00.000000

The storage-engine PoC tables that originally occupied this revision are not
part of the launch-target contract. Keep the revision ID in the chain as a
no-op so later migrations remain linear.
"""

from typing import Sequence, Union

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    return None


def downgrade() -> None:
    return None

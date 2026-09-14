"""merge the calendar session_key and seo-analysis heads

Collapses the two independent heads that landed via separate PRs:

- ``c2d3e4f5a6b7`` — calendar_generation_sessions.session_key
- ``d8a1c2e4f5b6`` — seo_analyses / seo_analysis_history.triggered_by_user_id

Both branch from ``b2c3d4e5f6a7``. Without this merge revision the graph has
two heads and ``alembic upgrade head`` raises MultipleHeads, which breaks
every per-user ``init_user_database``. The revision is intentionally empty;
the child revision (``e2f3a4b5c6d7``) then adds the calendar SIF tables on
top of the single merged head.

Revision ID: d1e2f3a4b5c6
Revises: c2d3e4f5a6b7, d8a1c2e4f5b6
Create Date: 2026-09-13 15:10:00.000000

"""
from typing import Sequence, Union


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = ("c2d3e4f5a6b7", "d8a1c2e4f5b6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge point only — no schema changes."""


def downgrade() -> None:
    """Merge point only — no schema changes."""

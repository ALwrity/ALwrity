"""add calendar event strategic metadata columns

G2 (calendar production readiness):
- Dedicated, queryable strategic metadata columns on ``calendar_events``:
  content_pillar, target_keywords, content_angle, target_audience,
  estimated_engagement.
- Populated by ``_save_calendar_to_db`` from the 12-step pipeline's
  content items (steps 8/12); values remain ``NULL`` when the pipeline
  does not emit them — ``ai_recommendations`` JSON still carries the
  whole item for backward compatibility.

Revision ID: d3e4f5a6b7c8
Revises: c3d4e5f6a7b8
Create Date: 2026-09-15 16:40:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_STRATEGIC_COLUMNS = (
    ("content_pillar", sa.String(length=100)),
    ("target_keywords", sa.JSON()),
    ("content_angle", sa.String(length=200)),
    ("target_audience", sa.String(length=200)),
    ("estimated_engagement", sa.Float()),
)


def upgrade() -> None:
    """Add the strategic metadata columns to calendar_events."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "calendar_events" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("calendar_events")}
    for name, col_type in _STRATEGIC_COLUMNS:
        if name not in existing:
            op.add_column("calendar_events", sa.Column(name, col_type, nullable=True))


def downgrade() -> None:
    """Remove the strategic metadata columns (reverse order)."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "calendar_events" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("calendar_events")}
    for name, _ in reversed(_STRATEGIC_COLUMNS):
        if name in existing:
            op.drop_column("calendar_events", name)

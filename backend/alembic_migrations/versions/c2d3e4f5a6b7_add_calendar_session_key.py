"""add calendar session_key

Revision ID: c2d3e4f5a6b7
Revises: f102a3b4c5d6
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "f102a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "calendar_generation_sessions" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("calendar_generation_sessions")}
    if "session_key" not in existing:
        with op.batch_alter_table("calendar_generation_sessions", schema=None) as batch_op:
            batch_op.add_column(sa.Column("session_key", sa.String(length=255), nullable=True))
    # Backfill session_key from generation_params.session_id (DB-agnostic, Python-side).
    conn = bind
    try:
        rows = conn.execute(
            sa.text(
                "SELECT id, generation_params FROM calendar_generation_sessions "
                "WHERE session_key IS NULL"
            )
        ).fetchall()
    except Exception:
        rows = []
    for row_id, params in rows:
        sid = None
        if params:
            try:
                data = json.loads(params) if isinstance(params, str) else dict(params)
                sid = data.get("session_id")
            except Exception:
                sid = None
        if sid:
            try:
                conn.execute(
                    sa.text(
                        "UPDATE calendar_generation_sessions SET session_key = :sid "
                        "WHERE id = :rid AND session_key IS NULL"
                    ),
                    {"sid": str(sid), "rid": row_id},
                )
            except Exception:
                continue
    # Unique index (allows multiple NULLs on SQLite).
    indexes = {i["name"] for i in inspector.get_indexes("calendar_generation_sessions")}
    if "ix_calendar_generation_sessions_session_key" not in indexes:
        try:
            op.create_index(
                "ix_calendar_generation_sessions_session_key",
                "calendar_generation_sessions",
                ["session_key"],
                unique=True,
            )
        except Exception:
            pass
    if "ix_calendar_generation_sessions_status" not in indexes:
        try:
            op.create_index(
                "ix_calendar_generation_sessions_status",
                "calendar_generation_sessions",
                ["generation_status"],
                unique=False,
            )
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "calendar_generation_sessions" not in inspector.get_table_names():
        return
    for name in (
        "ix_calendar_generation_sessions_status",
        "ix_calendar_generation_sessions_session_key",
    ):
        try:
            op.drop_index(name, table_name="calendar_generation_sessions")
        except Exception:
            pass
    existing = {c["name"] for c in inspector.get_columns("calendar_generation_sessions")}
    if "session_key" in existing:
        with op.batch_alter_table("calendar_generation_sessions", schema=None) as batch_op:
            batch_op.drop_column("session_key")

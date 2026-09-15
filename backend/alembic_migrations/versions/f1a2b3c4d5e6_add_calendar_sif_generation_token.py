"""add generation_token to calendar_sif_indexing_watermarks

R4.2 (finding H3): generation fencing — the token (ISO generated_at of the
successfully indexed generation) lets a concurrent/slow lifecycle job detect
that a NEWER generation already indexed, and abort instead of overwriting.

Additive, NULL-safe: legacy rows without a token keep "" and cannot fence
anything (only rows written by a token-bearing lifecycle participate).

Revision ID: f1a2b3c4d5e6
Revises: e2f3a4b5c6d7
Create Date: 2026-09-14 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "calendar_sif_indexing_watermarks" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("calendar_sif_indexing_watermarks")}
    if "generation_token" in cols:
        return
    with op.batch_alter_table("calendar_sif_indexing_watermarks") as batch_op:
        batch_op.add_column(sa.Column("generation_token", sa.String(64), nullable=False, server_default=""))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "calendar_sif_indexing_watermarks" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("calendar_sif_indexing_watermarks")}
    if "generation_token" not in cols:
        return
    with op.batch_alter_table("calendar_sif_indexing_watermarks") as batch_op:
        batch_op.drop_column("generation_token")

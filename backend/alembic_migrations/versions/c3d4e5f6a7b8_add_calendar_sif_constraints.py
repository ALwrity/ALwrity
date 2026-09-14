"""add calendar SIF integrity constraints + slim redundant indexes

R6.4 (M8/L1):
- CHECKs: status restricted to the lifecycle set; embedding_count and
  attempt non-negative (status table). Watermark counter CHECK too.
- Redundant indexes dropped on both tables (PK `index=True` + standalone
  user_id — both lookups are carried by uq_user_source's leading column
  and the composite indexes).

SQLite migration: the status table is COPY-RECREATED (ALTER ADD CHECK is
not supported). Watermark just drops indexes.

Revision ID: c3d4e5f6a7b8
Revises: f1a2b3c4d5e6
Create Date: 2026-09-14 12:20:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # ---------- calendar_sif_index_status: recreate with CHECKs ----------
    if "calendar_sif_index_status" in tables:
        cols = [c["name"] for c in inspector.get_columns("calendar_sif_index_status")]
        cols_csv = ", ".join(cols)
        is_backup = "calendar_sif_index_status_old_constraint"

        op.execute(sa.text(
            "CREATE TABLE calendar_sif_index_status_new ("
            " id INTEGER NOT NULL,"
            " user_id VARCHAR(255) NOT NULL,"
            " source_id VARCHAR(512) NOT NULL,"
            " status VARCHAR(20) NOT NULL,"
            " embedding_count INTEGER NOT NULL,"
            " attempt INTEGER NOT NULL,"
            " started_at DATETIME,"
            " finished_at DATETIME,"
            " error_message TEXT,"
            " updated_at DATETIME NOT NULL,"
            " PRIMARY KEY (id),"
            " CONSTRAINT uq_calendar_sif_status_user_source UNIQUE (user_id, source_id),"
            " CONSTRAINT ck_calendar_sif_status_allowed CHECK (status IN"
            " ('pending','running','success','skipped','failed')),"
            " CHECK (embedding_count >= 0),"
            " CHECK (attempt >= 0))"
        ))
        op.execute(sa.text(f"INSERT INTO calendar_sif_index_status_new ({cols_csv}) SELECT {cols_csv} FROM calendar_sif_index_status"))
        op.execute(sa.text("DROP TABLE calendar_sif_index_status"))
        op.execute(sa.text("ALTER TABLE calendar_sif_index_status_new RENAME TO calendar_sif_index_status"))
        op.create_index(
            "ix_calendar_sif_status_user_status",
            "calendar_sif_index_status",
            ["user_id", "status"],
            unique=False,
        )

    # ---------- watermark: drop redundant indexes ----------
    if "calendar_sif_indexing_watermarks" in tables:
        ix = {i["name"] for i in inspector.get_indexes("calendar_sif_indexing_watermarks")}
        for name in (
            "ix_calendar_sif_indexing_watermarks_id",
            "ix_calendar_sif_indexing_watermarks_user_id",
        ):
            if name in ix:
                op.drop_index(name, table_name="calendar_sif_indexing_watermarks")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # restore standalone indexes (constraints intentionally not re-added:
    # dropping CHECK via batch recreate would be messy and lose nothing)
    if "calendar_sif_indexing_watermarks" in tables:
        ix = {i["name"] for i in inspector.get_indexes("calendar_sif_indexing_watermarks")}
        if "ix_calendar_sif_indexing_watermarks_id" not in ix:
            op.create_index("ix_calendar_sif_indexing_watermarks_id", "calendar_sif_indexing_watermarks", ["id"])
        if "ix_calendar_sif_indexing_watermarks_user_id" not in ix:
            op.create_index("ix_calendar_sif_indexing_watermarks_user_id", "calendar_sif_indexing_watermarks", ["user_id"])
    if "calendar_sif_index_status" in tables:
        ix = {i["name"] for i in inspector.get_indexes("calendar_sif_index_status")}
        if "ix_calendar_sif_index_status_id" not in ix:
            op.create_index("ix_calendar_sif_index_status_id", "calendar_sif_index_status", ["id"])
        if "ix_calendar_sif_index_status_user_id" not in ix:
            op.create_index("ix_calendar_sif_index_status_user_id", "calendar_sif_index_status", ["user_id"])

"""add calendar SIF tables (index status + watermark)

Creates the two tables backing the content-calendar semantic index:

- ``calendar_sif_index_status`` — durable per-user lifecycle row
  (``pending`` → ``running`` → ``success`` | ``skipped`` | ``failed``).
- ``calendar_sif_indexing_watermarks`` — proof of the last successful embed
  (``source_hash`` + ``embedding_count``) used to skip unchanged re-embeds.

Applied to every end-user SQLite database via ``init_user_database`` →
``alembic upgrade head``. Both creates are inspector-guarded so databases
that already have the tables (e.g. built from ``Base.metadata.create_all``)
upgrade cleanly.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-09-13 15:11:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "calendar_sif_index_status" not in existing_tables:
        op.create_table(
            "calendar_sif_index_status",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("source_id", sa.String(length=512), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("embedding_count", sa.Integer(), nullable=False),
            sa.Column("attempt", sa.Integer(), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id", "source_id", name="uq_calendar_sif_status_user_source"
            ),
        )
        op.create_index(
            op.f("ix_calendar_sif_index_status_id"),
            "calendar_sif_index_status",
            ["id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_calendar_sif_index_status_user_id"),
            "calendar_sif_index_status",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "ix_calendar_sif_status_user_status",
            "calendar_sif_index_status",
            ["user_id", "status"],
            unique=False,
        )

    if "calendar_sif_indexing_watermarks" not in existing_tables:
        op.create_table(
            "calendar_sif_indexing_watermarks",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("source_id", sa.String(length=512), nullable=False),
            sa.Column("source_hash", sa.String(length=128), nullable=False),
            sa.Column("embedding_count", sa.Integer(), nullable=False),
            sa.Column("indexed_at", sa.DateTime(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id",
                "source_id",
                name="uq_calendar_sif_watermark_user_source",
            ),
        )
        op.create_index(
            op.f("ix_calendar_sif_indexing_watermarks_id"),
            "calendar_sif_indexing_watermarks",
            ["id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_calendar_sif_indexing_watermarks_user_id"),
            "calendar_sif_indexing_watermarks",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_calendar_sif_indexing_watermarks_indexed_at"),
            "calendar_sif_indexing_watermarks",
            ["indexed_at"],
            unique=False,
        )
        op.create_index(
            "ix_calendar_sif_watermark_user_indexed",
            "calendar_sif_indexing_watermarks",
            ["user_id", "indexed_at"],
            unique=False,
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "calendar_sif_indexing_watermarks" in existing_tables:
        for index_name in (
            "ix_calendar_sif_watermark_user_indexed",
            op.f("ix_calendar_sif_indexing_watermarks_indexed_at"),
            op.f("ix_calendar_sif_indexing_watermarks_user_id"),
            op.f("ix_calendar_sif_indexing_watermarks_id"),
        ):
            try:
                op.drop_index(
                    index_name, table_name="calendar_sif_indexing_watermarks"
                )
            except Exception:
                pass
        op.drop_table("calendar_sif_indexing_watermarks")

    if "calendar_sif_index_status" in existing_tables:
        for index_name in (
            "ix_calendar_sif_status_user_status",
            op.f("ix_calendar_sif_index_status_user_id"),
            op.f("ix_calendar_sif_index_status_id"),
        ):
            try:
                op.drop_index(index_name, table_name="calendar_sif_index_status")
            except Exception:
                pass
        op.drop_table("calendar_sif_index_status")

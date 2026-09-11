"""add strategy_sif_index_status table

Stores the durable per-user indexing lifecycle for the active content
strategy's SIF embedding (``pending`` → ``running`` → ``success`` |
``skipped`` | ``failed``). Applied to every end-user SQLite database via
``init_user_database`` → ``alembic upgrade head``.

Revision ID: f102a3b4c5d6
Revises: b2c3d4e5f6a7
Create Date: 2026-09-10 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f102a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "strategy_sif_index_status" in existing_tables:
        return

    op.create_table(
        "strategy_sif_index_status",
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
            "user_id", "source_id", name="uq_strategy_sif_status_user_source"
        ),
    )
    op.create_index(
        op.f("ix_strategy_sif_index_status_id"),
        "strategy_sif_index_status",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_strategy_sif_index_status_user_id"),
        "strategy_sif_index_status",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_strategy_sif_status_user_status"),
        "strategy_sif_index_status",
        ["user_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "strategy_sif_index_status" not in existing_tables:
        return

    op.drop_index(
        op.f("ix_strategy_sif_status_user_status"),
        table_name="strategy_sif_index_status",
    )
    op.drop_index(
        op.f("ix_strategy_sif_index_status_user_id"),
        table_name="strategy_sif_index_status",
    )
    op.drop_index(
        op.f("ix_strategy_sif_index_status_id"),
        table_name="strategy_sif_index_status",
    )
    op.drop_table("strategy_sif_index_status")
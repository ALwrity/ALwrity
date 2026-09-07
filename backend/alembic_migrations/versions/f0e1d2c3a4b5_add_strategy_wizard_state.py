"""add strategy_wizard_state table

Stores per-user content strategy wizard progress. Applied to every end-user
SQLite database via ``init_user_database`` → ``alembic upgrade head``.

Revision ID: f0e1d2c3a4b5
Revises: a7b8c9d0e1f2
Create Date: 2026-09-06 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f0e1d2c3a4b5"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "strategy_wizard_state" in existing_tables:
        return

    op.create_table(
        "strategy_wizard_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("current_step", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("step_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_strategy_wizard_state_user_id"),
        "strategy_wizard_state",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "strategy_wizard_state" not in existing_tables:
        return

    op.drop_index(
        op.f("ix_strategy_wizard_state_user_id"),
        table_name="strategy_wizard_state",
    )
    op.drop_table("strategy_wizard_state")
"""add persona generation tasks

Revision ID: f6b1c2d3e4f5
Revises: f5a0b1c2d3e4
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6b1c2d3e4f5"
down_revision: Union[str, Sequence[str], None] = "f5a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "persona_generation_tasks" not in inspector.get_table_names():
        op.create_table(
            "persona_generation_tasks",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("task_id", sa.String(length=64), nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
            sa.Column("progress", sa.Integer(), nullable=True),
            sa.Column("current_step", sa.String(length=500), nullable=True),
            sa.Column("progress_messages", sa.JSON(), nullable=True),
            sa.Column("result", sa.JSON(), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("task_id", name="uq_persona_generation_tasks_task_id"),
        )
        op.create_index(
            op.f("ix_persona_generation_tasks_user_id"),
            "persona_generation_tasks",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "idx_persona_generation_tasks_user_status",
            "persona_generation_tasks",
            ["user_id", "status"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "persona_generation_tasks" in inspector.get_table_names():
        op.drop_index("idx_persona_generation_tasks_user_status", table_name="persona_generation_tasks")
        op.drop_index(op.f("ix_persona_generation_tasks_user_id"), table_name="persona_generation_tasks")
        op.drop_table("persona_generation_tasks")

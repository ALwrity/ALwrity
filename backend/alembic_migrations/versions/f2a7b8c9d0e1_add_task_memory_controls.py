"""add task memory controls

Revision ID: f2a7b8c9d0e1
Revises: e1f6a7b8c9d0
"""

from alembic import op
import sqlalchemy as sa


revision = "f2a7b8c9d0e1"
down_revision = "e1f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_history = {c["name"] for c in inspector.get_columns("task_history")}
    if "first_proposed_at" not in existing_history:
        with op.batch_alter_table("task_history", schema=None) as batch_op:
            batch_op.add_column(sa.Column("first_proposed_at", sa.DateTime(), nullable=True))
            batch_op.add_column(sa.Column("last_proposed_at", sa.DateTime(), nullable=True))
            batch_op.add_column(sa.Column("last_completed_at", sa.DateTime(), nullable=True))
            batch_op.add_column(sa.Column("last_rejected_at", sa.DateTime(), nullable=True))
            batch_op.add_column(sa.Column("last_failed_at", sa.DateTime(), nullable=True))
            batch_op.add_column(sa.Column("last_feedback", sa.JSON(), nullable=True))
            batch_op.add_column(sa.Column("feedback_history", sa.JSON(), nullable=True))
            batch_op.add_column(sa.Column("execution_result", sa.JSON(), nullable=True))
            batch_op.add_column(sa.Column("completion_count", sa.Integer(), nullable=False, server_default="0"))
            batch_op.add_column(sa.Column("rejection_count", sa.Integer(), nullable=False, server_default="0"))
            batch_op.add_column(sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"))

        for name, column in (
            ("ix_task_history_first_proposed_at", "first_proposed_at"),
            ("ix_task_history_last_proposed_at", "last_proposed_at"),
            ("ix_task_history_last_completed_at", "last_completed_at"),
            ("ix_task_history_last_rejected_at", "last_rejected_at"),
            ("ix_task_history_last_failed_at", "last_failed_at"),
        ):
            op.create_index(name, "task_history", [column], unique=False)

    if "task_memory_settings" not in inspector.get_table_names():
        op.create_table(
            "task_memory_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("exact_duplicate_window_days", sa.Integer(), nullable=False, server_default="7"),
            sa.Column("completed_repeat_window_days", sa.Integer(), nullable=False, server_default="7"),
            sa.Column("rejected_repeat_window_days", sa.Integer(), nullable=False, server_default="30"),
            sa.Column("failed_retry_window_days", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id"),
        )
        op.create_index("ix_task_memory_settings_user_id", "task_memory_settings", ["user_id"], unique=True)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "task_memory_settings" in inspector.get_table_names():
        op.drop_index("ix_task_memory_settings_user_id", table_name="task_memory_settings")
        op.drop_table("task_memory_settings")

    existing_history = {c["name"] for c in inspector.get_columns("task_history")}
    if "first_proposed_at" in existing_history:
        for name in (
            "ix_task_history_last_failed_at",
            "ix_task_history_last_rejected_at",
            "ix_task_history_last_completed_at",
            "ix_task_history_last_proposed_at",
            "ix_task_history_first_proposed_at",
        ):
            op.drop_index(name, table_name="task_history")
        with op.batch_alter_table("task_history", schema=None) as batch_op:
            for column in (
                "failure_count", "rejection_count", "completion_count", "execution_result",
                "feedback_history", "last_feedback", "last_failed_at", "last_rejected_at",
                "last_completed_at", "last_proposed_at", "first_proposed_at",
            ):
                batch_op.drop_column(column)

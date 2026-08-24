"""add workflow task executions

Revision ID: d0e5f6a7b8c9
Revises: c9d4e5f6a7b8
"""

from alembic import op
import sqlalchemy as sa


revision = "d0e5f6a7b8c9"
down_revision = "c9d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "workflow_task_executions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("action_id", sa.String(length=255), nullable=False),
        sa.Column("agent_type", sa.String(length=100), nullable=False),
        sa.Column("action_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("approval_request_id", sa.Integer(), nullable=True),
        sa.Column("result_json", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["task_id"], ["daily_workflow_tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_task_executions_id", "workflow_task_executions", ["id"], unique=False)
    op.create_index("ix_workflow_task_executions_task_id", "workflow_task_executions", ["task_id"], unique=False)
    op.create_index("ix_workflow_task_executions_user_id", "workflow_task_executions", ["user_id"], unique=False)
    op.create_index("ix_workflow_task_executions_status", "workflow_task_executions", ["status"], unique=False)
    op.create_index(
        "ix_workflow_execution_task_idempotency",
        "workflow_task_executions",
        ["task_id", "idempotency_key"],
        unique=True,
    )


def downgrade():
    op.drop_index("ix_workflow_execution_task_idempotency", table_name="workflow_task_executions")
    op.drop_index("ix_workflow_task_executions_status", table_name="workflow_task_executions")
    op.drop_index("ix_workflow_task_executions_user_id", table_name="workflow_task_executions")
    op.drop_index("ix_workflow_task_executions_task_id", table_name="workflow_task_executions")
    op.drop_index("ix_workflow_task_executions_id", table_name="workflow_task_executions")
    op.drop_table("workflow_task_executions")

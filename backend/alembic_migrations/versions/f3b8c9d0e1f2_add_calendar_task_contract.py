"""add calendar task contract

Revision ID: f3b8c9d0e1f2
Revises: f2a7b8c9d0e1
"""

from alembic import op
import sqlalchemy as sa


revision = "f3b8c9d0e1f2"
down_revision = "f2a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("calendar_events", schema=None) as batch_op:
        batch_op.add_column(sa.Column("owner_agent", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("recommendation_id", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("task_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("meeting_id", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("kpi", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("deadline", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("action_type", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("action_parameters", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("evidence", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("expected_outcome", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("user_approval_state", sa.String(length=30), nullable=False, server_default="pending"))
        batch_op.add_column(sa.Column("user_timezone", sa.String(length=100), nullable=True))
        batch_op.create_foreign_key("fk_calendar_events_task_id", "daily_workflow_tasks", ["task_id"], ["id"])

    for name, column in (
        ("ix_calendar_events_owner_agent", "owner_agent"),
        ("ix_calendar_events_recommendation_id", "recommendation_id"),
        ("ix_calendar_events_task_id", "task_id"),
        ("ix_calendar_events_meeting_id", "meeting_id"),
    ):
        op.create_index(name, "calendar_events", [column], unique=False)


def downgrade():
    for name in (
        "ix_calendar_events_meeting_id",
        "ix_calendar_events_task_id",
        "ix_calendar_events_recommendation_id",
        "ix_calendar_events_owner_agent",
    ):
        op.drop_index(name, table_name="calendar_events")
    with op.batch_alter_table("calendar_events", schema=None) as batch_op:
        batch_op.drop_constraint("fk_calendar_events_task_id", type_="foreignkey")
        for column in (
            "user_timezone", "user_approval_state", "expected_outcome", "evidence",
            "action_parameters", "action_type", "deadline", "kpi", "meeting_id",
            "task_id", "recommendation_id", "owner_agent",
        ):
            batch_op.drop_column(column)

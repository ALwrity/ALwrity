"""add daily meeting lifecycle records

Revision ID: f4c9d0e1f2a3
Revises: f3b8c9d0e1f2
"""

from alembic import op
import sqlalchemy as sa


revision = "f4c9d0e1f2a3"
down_revision = "f3b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "daily_meetings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meeting_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("meeting_date", sa.String(length=10), nullable=False),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("tenant_timezone", sa.String(length=100), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("preflight_json", sa.JSON(), nullable=True),
        sa.Column("schedule_json", sa.JSON(), nullable=True),
        sa.Column("evidence_json", sa.JSON(), nullable=True),
        sa.Column("proposal_review_json", sa.JSON(), nullable=True),
        sa.Column("guardian_review_json", sa.JSON(), nullable=True),
        sa.Column("prioritization_json", sa.JSON(), nullable=True),
        sa.Column("limitations_json", sa.JSON(), nullable=True),
        sa.Column("final_task_ids", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meeting_id"),
    )
    op.create_index("ix_daily_meetings_id", "daily_meetings", ["id"], unique=False)
    op.create_index("ix_daily_meetings_meeting_id", "daily_meetings", ["meeting_id"], unique=True)
    op.create_index("ix_daily_meetings_user_id", "daily_meetings", ["user_id"], unique=False)
    op.create_index("ix_daily_meetings_meeting_date", "daily_meetings", ["meeting_date"], unique=False)
    op.create_index("ix_daily_meetings_status", "daily_meetings", ["status"], unique=False)
    op.create_index("ix_daily_meetings_user_date", "daily_meetings", ["user_id", "meeting_date"], unique=False)


def downgrade():
    op.drop_index("ix_daily_meetings_user_date", table_name="daily_meetings")
    op.drop_index("ix_daily_meetings_status", table_name="daily_meetings")
    op.drop_index("ix_daily_meetings_meeting_date", table_name="daily_meetings")
    op.drop_index("ix_daily_meetings_user_id", table_name="daily_meetings")
    op.drop_index("ix_daily_meetings_meeting_id", table_name="daily_meetings")
    op.drop_index("ix_daily_meetings_id", table_name="daily_meetings")
    op.drop_table("daily_meetings")

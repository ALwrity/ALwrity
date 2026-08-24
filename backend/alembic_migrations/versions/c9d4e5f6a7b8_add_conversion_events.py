"""add conversion events

Revision ID: c9d4e5f6a7b8
Revises: b8c1d2e3f4a5
"""

from alembic import op
import sqlalchemy as sa


revision = "c9d4e5f6a7b8"
down_revision = "b8c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "conversion_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("event_name", sa.String(length=100), nullable=False),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("external_event_id", sa.String(length=255), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_conversion_events_id", "conversion_events", ["id"], unique=False)
    op.create_index("ix_conversion_events_user_id", "conversion_events", ["user_id"], unique=False)
    op.create_index("ix_conversion_events_occurred_at", "conversion_events", ["occurred_at"], unique=False)
    op.create_index(
        "ix_conversion_events_user_external",
        "conversion_events",
        ["user_id", "external_event_id"],
        unique=True,
    )


def downgrade():
    op.drop_index("ix_conversion_events_user_external", table_name="conversion_events")
    op.drop_index("ix_conversion_events_occurred_at", table_name="conversion_events")
    op.drop_index("ix_conversion_events_user_id", table_name="conversion_events")
    op.drop_index("ix_conversion_events_id", table_name="conversion_events")
    op.drop_table("conversion_events")

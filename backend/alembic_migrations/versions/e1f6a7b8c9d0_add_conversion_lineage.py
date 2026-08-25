"""add conversion lineage

Revision ID: e1f6a7b8c9d0
Revises: d0e5f6a7b8c9
"""

from alembic import op
import sqlalchemy as sa


revision = "e1f6a7b8c9d0"
down_revision = "d0e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("conversion_events")}
    if "agent_type" in existing:
        return
    with op.batch_alter_table("conversion_events", schema=None) as batch_op:
        batch_op.add_column(sa.Column("agent_type", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("recommendation_id", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("task_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("artifact_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("published_asset_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("campaign_id", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("platform", sa.String(length=50), nullable=True))
        batch_op.create_foreign_key(
            "fk_conversion_events_task_id",
            "daily_workflow_tasks",
            ["task_id"],
            ["id"],
        )
    for name, column in (
        ("ix_conversion_events_task_id", "task_id"),
        ("ix_conversion_events_agent_type", "agent_type"),
        ("ix_conversion_events_recommendation_id", "recommendation_id"),
        ("ix_conversion_events_artifact_id", "artifact_id"),
        ("ix_conversion_events_published_asset_id", "published_asset_id"),
        ("ix_conversion_events_campaign_id", "campaign_id"),
        ("ix_conversion_events_platform", "platform"),
    ):
        op.create_index(name, "conversion_events", [column], unique=False)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("conversion_events")}
    if "agent_type" not in existing:
        return
    for name in (
        "ix_conversion_events_platform",
        "ix_conversion_events_campaign_id",
        "ix_conversion_events_published_asset_id",
        "ix_conversion_events_artifact_id",
        "ix_conversion_events_task_id",
        "ix_conversion_events_recommendation_id",
        "ix_conversion_events_agent_type",
    ):
        op.drop_index(name, table_name="conversion_events")
    with op.batch_alter_table("conversion_events", schema=None) as batch_op:
        batch_op.drop_constraint("fk_conversion_events_task_id", type_="foreignkey")
        batch_op.drop_column("platform")
        batch_op.drop_column("campaign_id")
        batch_op.drop_column("published_asset_id")
        batch_op.drop_column("artifact_id")
        batch_op.drop_column("task_id")
        batch_op.drop_column("recommendation_id")
        batch_op.drop_column("agent_type")

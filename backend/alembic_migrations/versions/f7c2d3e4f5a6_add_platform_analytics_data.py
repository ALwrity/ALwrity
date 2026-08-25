"""add platform analytics data

Revision ID: f7c2d3e4f5a6
Revises: f6b1c2d3e4f5
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "f6b1c2d3e4f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "platform_analytics_data" not in inspector.get_table_names():
        op.create_table(
            "platform_analytics_data",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("platform", sa.String(length=50), nullable=False),
            sa.Column("site_url", sa.String(length=500), nullable=True),
            sa.Column("metrics_json", sa.Text(), nullable=True),
            sa.Column("summary_json", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=50), nullable=True),
            sa.Column("error_message", sa.String(), nullable=True),
            sa.Column("analysis_date", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_platform_analytics_data_user_id"),
            "platform_analytics_data",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "ix_platform_analytics_user_platform_site",
            "platform_analytics_data",
            ["user_id", "platform", "site_url"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "platform_analytics_data" in inspector.get_table_names():
        op.drop_index("ix_platform_analytics_user_platform_site", table_name="platform_analytics_data")
        op.drop_index(op.f("ix_platform_analytics_data_user_id"), table_name="platform_analytics_data")
        op.drop_table("platform_analytics_data")

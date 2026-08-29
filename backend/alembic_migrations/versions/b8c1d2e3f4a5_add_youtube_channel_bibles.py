"""add youtube_channel_bibles

Revision ID: b8c1d2e3f4a5
Revises: a4fe799f2cab
Create Date: 2026-08-15 20:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c1d2e3f4a5"
down_revision: Union[str, Sequence[str], None] = "a4fe799f2cab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "youtube_channel_bibles" not in inspector.get_table_names():
        op.create_table(
            "youtube_channel_bibles",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("profile", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_youtube_channel_bibles_user_id"),
            "youtube_channel_bibles",
            ["user_id"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "youtube_channel_bibles" in inspector.get_table_names():
        op.drop_index(op.f("ix_youtube_channel_bibles_user_id"), table_name="youtube_channel_bibles")
        op.drop_table("youtube_channel_bibles")

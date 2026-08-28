"""add presenter_reference_url to podcast_projects

Revision ID: c9d8e7f6a5b4
Revises: b8c1d2e3f4a5
Create Date: 2026-08-29 03:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d8e7f6a5b4"
down_revision: Union[str, Sequence[str], None] = "b8c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "podcast_projects" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("podcast_projects")]
        if "presenter_reference_url" not in existing_cols:
            op.add_column(
                "podcast_projects",
                sa.Column("presenter_reference_url", sa.String(length=1000), nullable=True),
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "podcast_projects" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("podcast_projects")]
        if "presenter_reference_url" in existing_cols:
            with op.batch_alter_table("podcast_projects") as batch_op:
                batch_op.drop_column("presenter_reference_url")

"""add wordpress tables

Revision ID: f5a0b1c2d3e4
Revises: f4c9d0e1f2a3
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5a0b1c2d3e4"
down_revision: Union[str, Sequence[str], None] = "f4c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "wordpress_sites" not in inspector.get_table_names():
        op.create_table(
            "wordpress_sites",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("site_url", sa.String(length=1024), nullable=False),
            sa.Column("site_name", sa.String(length=255), nullable=True),
            sa.Column("username", sa.String(length=255), nullable=False),
            sa.Column("app_password", sa.String(length=512), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "site_url", name="uq_wordpress_sites_user_site"),
        )
        op.create_index(op.f("ix_wordpress_sites_user_id"), "wordpress_sites", ["user_id"], unique=False)

    if "wordpress_posts" not in inspector.get_table_names():
        op.create_table(
            "wordpress_posts",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("site_id", sa.Integer(), nullable=False),
            sa.Column("wp_post_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=1024), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=True),
            sa.Column("published_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["site_id"], ["wordpress_sites.id"]),
        )
        op.create_index(op.f("ix_wordpress_posts_user_id"), "wordpress_posts", ["user_id"], unique=False)
        op.create_index(op.f("ix_wordpress_posts_site_id"), "wordpress_posts", ["site_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "wordpress_posts" in inspector.get_table_names():
        op.drop_index(op.f("ix_wordpress_posts_site_id"), table_name="wordpress_posts")
        op.drop_index(op.f("ix_wordpress_posts_user_id"), table_name="wordpress_posts")
        op.drop_table("wordpress_posts")

    if "wordpress_sites" in inspector.get_table_names():
        op.drop_index(op.f("ix_wordpress_sites_user_id"), table_name="wordpress_sites")
        op.drop_table("wordpress_sites")

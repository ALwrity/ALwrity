"""add oauth provider tables

Revision ID: f8d3e4f5a6b7
Revises: f7c2d3e4f5a6
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "f7c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if "gsc_credentials" not in existing:
        op.create_table(
            "gsc_credentials",
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("credentials_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.PrimaryKeyConstraint("user_id"),
        )

    if "gsc_data_cache" not in existing:
        op.create_table(
            "gsc_data_cache",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("site_url", sa.String(length=1024), nullable=False),
            sa.Column("data_type", sa.String(length=64), nullable=False),
            sa.Column("data_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["gsc_credentials.user_id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    if "gsc_oauth_states" not in existing:
        op.create_table(
            "gsc_oauth_states",
            sa.Column("state", sa.String(length=512), nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.PrimaryKeyConstraint("state"),
        )

    if "bing_oauth_tokens" not in existing:
        op.create_table(
            "bing_oauth_tokens",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("access_token", sa.Text(), nullable=False),
            sa.Column("refresh_token", sa.Text(), nullable=True),
            sa.Column("token_type", sa.String(length=64), server_default=sa.text("'bearer'")),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("scope", sa.Text(), nullable=True),
            sa.Column("site_url", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_bing_oauth_tokens_user_id"), "bing_oauth_tokens", ["user_id"], unique=False)

    if "bing_oauth_states" not in existing:
        op.create_table(
            "bing_oauth_states",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("state", sa.String(length=512), nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("state", name="uq_bing_oauth_states_state"),
        )

    if "wordpress_oauth_tokens" not in existing:
        op.create_table(
            "wordpress_oauth_tokens",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("access_token", sa.Text(), nullable=False),
            sa.Column("refresh_token", sa.Text(), nullable=True),
            sa.Column("token_type", sa.String(length=64), server_default=sa.text("'bearer'")),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("scope", sa.Text(), nullable=True),
            sa.Column("blog_id", sa.String(length=255), nullable=True),
            sa.Column("blog_url", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_wordpress_oauth_tokens_user_id"), "wordpress_oauth_tokens", ["user_id"], unique=False)

    if "wordpress_oauth_states" not in existing:
        op.create_table(
            "wordpress_oauth_states",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("state", sa.String(length=512), nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("state", name="uq_wordpress_oauth_states_state"),
        )

    if "wix_oauth_tokens" not in existing:
        op.create_table(
            "wix_oauth_tokens",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("access_token", sa.Text(), nullable=False),
            sa.Column("refresh_token", sa.Text(), nullable=True),
            sa.Column("token_type", sa.String(length=64), server_default=sa.text("'bearer'")),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("expires_in", sa.Integer(), nullable=True),
            sa.Column("scope", sa.Text(), nullable=True),
            sa.Column("site_id", sa.String(length=255), nullable=True),
            sa.Column("member_id", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_wix_oauth_tokens_user_id"), "wix_oauth_tokens", ["user_id"], unique=False)

    if "wix_oauth_pkce_states" not in existing:
        op.create_table(
            "wix_oauth_pkce_states",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("state", sa.String(length=512), nullable=False),
            sa.Column("code_verifier", sa.Text(), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("state", name="uq_wix_oauth_pkce_states_state"),
        )

    if "wix_oauth_pkce_states" in set(sa.inspect(bind).get_table_names()):
        index_names = {ix["name"] for ix in sa.inspect(bind).get_indexes("wix_oauth_pkce_states")}
        if "idx_wix_oauth_pkce_user_state" not in index_names:
            op.create_index(
                "idx_wix_oauth_pkce_user_state",
                "wix_oauth_pkce_states",
                ["user_id", "state"],
                unique=False,
            )

    if "youtube_oauth_tokens" not in existing:
        op.create_table(
            "youtube_oauth_tokens",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("access_token", sa.Text(), nullable=False),
            sa.Column("refresh_token", sa.Text(), nullable=True),
            sa.Column("token_type", sa.String(length=64), server_default=sa.text("'bearer'")),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("scope", sa.Text(), nullable=True),
            sa.Column("channel_id", sa.String(length=255), nullable=True),
            sa.Column("channel_name", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_youtube_oauth_tokens_user_id"), "youtube_oauth_tokens", ["user_id"], unique=False)

    if "youtube_oauth_states" not in existing:
        op.create_table(
            "youtube_oauth_states",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("state", sa.String(length=512), nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("state", name="uq_youtube_oauth_states_state"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if "youtube_oauth_states" in existing:
        op.drop_table("youtube_oauth_states")

    if "youtube_oauth_tokens" in existing:
        op.drop_index(op.f("ix_youtube_oauth_tokens_user_id"), table_name="youtube_oauth_tokens")
        op.drop_table("youtube_oauth_tokens")

    if "wix_oauth_pkce_states" in existing:
        index_names = {ix["name"] for ix in inspector.get_indexes("wix_oauth_pkce_states")}
        if "idx_wix_oauth_pkce_user_state" in index_names:
            op.drop_index("idx_wix_oauth_pkce_user_state", table_name="wix_oauth_pkce_states")
        op.drop_table("wix_oauth_pkce_states")

    if "wix_oauth_tokens" in existing:
        op.drop_index(op.f("ix_wix_oauth_tokens_user_id"), table_name="wix_oauth_tokens")
        op.drop_table("wix_oauth_tokens")

    if "wordpress_oauth_states" in existing:
        op.drop_table("wordpress_oauth_states")

    if "wordpress_oauth_tokens" in existing:
        op.drop_index(op.f("ix_wordpress_oauth_tokens_user_id"), table_name="wordpress_oauth_tokens")
        op.drop_table("wordpress_oauth_tokens")

    if "bing_oauth_states" in existing:
        op.drop_table("bing_oauth_states")

    if "bing_oauth_tokens" in existing:
        op.drop_index(op.f("ix_bing_oauth_tokens_user_id"), table_name="bing_oauth_tokens")
        op.drop_table("bing_oauth_tokens")

    if "gsc_oauth_states" in existing:
        op.drop_table("gsc_oauth_states")

    if "gsc_data_cache" in existing:
        op.drop_table("gsc_data_cache")

    if "gsc_credentials" in existing:
        op.drop_table("gsc_credentials")

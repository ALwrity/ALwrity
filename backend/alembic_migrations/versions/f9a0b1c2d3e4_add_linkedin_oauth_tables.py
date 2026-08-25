"""add linkedin oauth tables

Revision ID: f9a0b1c2d3e4
Revises: f8d3e4f5a6b7
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9a0b1c2d3e4"
down_revision: Union[str, Sequence[str], None] = "f8d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if "linkedin_oauth_tokens" not in existing:
        op.create_table(
            "linkedin_oauth_tokens",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("provider_mode", sa.String(length=32), nullable=False, server_default=sa.text("'unipile'")),
            sa.Column("linkedin_access_token", sa.Text(), nullable=True),
            sa.Column("linkedin_refresh_token", sa.Text(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("account_name", sa.String(length=255), nullable=True),
            sa.Column("profile_urn", sa.String(length=255), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("unipile_account_id", sa.String(length=255), nullable=True),
            sa.Column("unipile_org_account_id", sa.String(length=255), nullable=True),
            sa.Column("unipile_sync_status", sa.String(length=64), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "idx_linkedin_oauth_user_active",
            "linkedin_oauth_tokens",
            ["user_id", "is_active"],
            unique=False,
        )

    if "linkedin_oauth_states" not in existing:
        op.create_table(
            "linkedin_oauth_states",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("state", sa.String(length=512), nullable=False),
            sa.Column("code_verifier", sa.Text(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("state", name="uq_linkedin_oauth_states_state"),
        )

    if "linkedin_analysis_context" not in existing:
        op.create_table(
            "linkedin_analysis_context",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("unipile_account_id", sa.String(length=255), nullable=False),
            sa.Column("normalized_profile_json", sa.Text(), nullable=True),
            sa.Column("raw_userprofile_json", sa.Text(), nullable=True),
            sa.Column("profile_content_hash", sa.String(length=128), nullable=True),
            sa.Column("fetched_at", sa.DateTime(), nullable=True),
            sa.Column("profile_context_json", sa.Text(), nullable=True),
            sa.Column("profile_validation_json", sa.Text(), nullable=True),
            sa.Column("user_completion_json", sa.Text(), nullable=True),
            sa.Column("ai_profile_intelligence_json", sa.Text(), nullable=True),
            sa.Column("topic_recommendations_json", sa.Text(), nullable=True),
            sa.Column("profile_optimization_json", sa.Text(), nullable=True),
            sa.Column("profile_context_updated_at", sa.DateTime(), nullable=True),
            sa.Column("ai_intelligence_updated_at", sa.DateTime(), nullable=True),
            sa.Column("recommendations_updated_at", sa.DateTime(), nullable=True),
            sa.Column("profile_optimization_updated_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", name="uq_linkedin_analysis_context_user"),
        )
        op.create_index(
            "idx_linkedin_analysis_user",
            "linkedin_analysis_context",
            ["user_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if "linkedin_analysis_context" in existing:
        index_names = {ix["name"] for ix in inspector.get_indexes("linkedin_analysis_context")}
        if "idx_linkedin_analysis_user" in index_names:
            op.drop_index("idx_linkedin_analysis_user", table_name="linkedin_analysis_context")
        op.drop_table("linkedin_analysis_context")

    if "linkedin_oauth_states" in existing:
        op.drop_table("linkedin_oauth_states")

    if "linkedin_oauth_tokens" in existing:
        index_names = {ix["name"] for ix in inspector.get_indexes("linkedin_oauth_tokens")}
        if "idx_linkedin_oauth_user_active" in index_names:
            op.drop_index("idx_linkedin_oauth_user_active", table_name="linkedin_oauth_tokens")
        op.drop_table("linkedin_oauth_tokens")

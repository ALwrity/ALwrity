"""heal linkedin oauth columns

Revision ID: fb1c2d3e4f5a
Revises: f9a0b1c2d3e4
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "fb1c2d3e4f5a"
down_revision: Union[str, Sequence[str], None] = "f9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "linkedin_oauth_tokens" in tables:
        token_cols = {c["name"] for c in inspector.get_columns("linkedin_oauth_tokens")}

        if "provider_mode" not in token_cols:
            op.add_column(
                "linkedin_oauth_tokens",
                sa.Column("provider_mode", sa.String(length=32), nullable=False, server_default=sa.text("'unipile'")),
            )
        if "unipile_account_id" not in token_cols:
            op.add_column(
                "linkedin_oauth_tokens",
                sa.Column("unipile_account_id", sa.String(length=255), nullable=True),
            )
        if "unipile_org_account_id" not in token_cols:
            op.add_column(
                "linkedin_oauth_tokens",
                sa.Column("unipile_org_account_id", sa.String(length=255), nullable=True),
            )
        if "unipile_sync_status" not in token_cols:
            op.add_column(
                "linkedin_oauth_tokens",
                sa.Column("unipile_sync_status", sa.String(length=64), nullable=True),
            )

        index_names = {ix["name"] for ix in inspector.get_indexes("linkedin_oauth_tokens")}
        if "idx_linkedin_oauth_user_active" not in index_names:
            op.create_index(
                "idx_linkedin_oauth_user_active",
                "linkedin_oauth_tokens",
                ["user_id", "is_active"],
                unique=False,
            )

        # One-shot normalization: rows that have a Unipile account but no explicit
        # provider mode should be treated as Unipile. The writers now set the value
        # explicitly, so this update is only needed for legacy rows.
        if "provider_mode" in token_cols and "unipile_account_id" in token_cols:
            op.execute(
                """
                UPDATE linkedin_oauth_tokens
                SET provider_mode = 'unipile', updated_at = datetime('now')
                WHERE unipile_account_id IS NOT NULL
                  AND TRIM(unipile_account_id) != ''
                  AND LOWER(COALESCE(provider_mode, '')) NOT IN ('unipile', 'native')
                """
            )

    if "linkedin_oauth_states" in tables:
        state_cols = {c["name"] for c in inspector.get_columns("linkedin_oauth_states")}

        if "code_verifier" not in state_cols:
            op.add_column(
                "linkedin_oauth_states",
                sa.Column("code_verifier", sa.Text(), nullable=True),
            )
        if "expires_at" not in state_cols:
            op.add_column(
                "linkedin_oauth_states",
                sa.Column("expires_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            )
        if "used_at" not in state_cols:
            op.add_column(
                "linkedin_oauth_states",
                sa.Column("used_at", sa.DateTime(), nullable=True),
            )

    if "linkedin_analysis_context" in tables:
        ctx_cols = {c["name"] for c in inspector.get_columns("linkedin_analysis_context")}

        for col in (
            "topic_recommendations_json",
            "profile_optimization_json",
        ):
            if col not in ctx_cols:
                op.add_column(
                    "linkedin_analysis_context",
                    sa.Column(col, sa.Text(), nullable=True),
                )

        for col in (
            "recommendations_updated_at",
            "profile_optimization_updated_at",
        ):
            if col not in ctx_cols:
                op.add_column(
                    "linkedin_analysis_context",
                    sa.Column(col, sa.DateTime(), nullable=True),
                )

        index_names = {ix["name"] for ix in inspector.get_indexes("linkedin_analysis_context")}
        if "idx_linkedin_analysis_user" not in index_names:
            op.create_index(
                "idx_linkedin_analysis_user",
                "linkedin_analysis_context",
                ["user_id"],
                unique=False,
            )


def downgrade() -> None:
    # This is a forward-only healing migration; explicit downgrades of
    # per-column additions are intentionally not supported. The original
    # columns remain, and the data normalization update is one-way.
    pass

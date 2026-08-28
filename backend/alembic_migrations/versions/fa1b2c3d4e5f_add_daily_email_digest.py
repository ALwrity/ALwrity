"""add daily email digest ledger and onboarding fields

Revision ID: fa1b2c3d4e5f
Revises: fb1c2d3e4f5a
Create Date: 2026-08-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "fa1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "fb1c2d3e4f5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to onboarding_sessions table
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    if "onboarding_sessions" in inspector.get_table_names():
        cols = [c["name"] for c in inspector.get_columns("onboarding_sessions")]
        if "timezone" not in cols:
            op.add_column("onboarding_sessions", sa.Column("timezone", sa.String(length=50), nullable=True))
        if "contact_email" not in cols:
            op.add_column("onboarding_sessions", sa.Column("contact_email", sa.String(length=255), nullable=True))
        if "email_digest_opt_in" not in cols:
            op.add_column("onboarding_sessions", sa.Column("email_digest_opt_in", sa.Boolean(), nullable=True, server_default="0"))

    # Create daily_email_ledgers table
    if "daily_email_ledgers" not in inspector.get_table_names():
        op.create_table(
            "daily_email_ledgers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.String(length=255), nullable=False),
            sa.Column("plan_date", sa.String(length=10), nullable=False),
            sa.Column("email_type", sa.String(length=20), nullable=False, server_default="daily"),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("resend_message_id", sa.String(length=255), nullable=True),
            sa.Column("error_message", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_daily_email_ledgers_id", "daily_email_ledgers", ["id"], unique=False)
        op.create_index("ix_daily_email_ledgers_user_id", "daily_email_ledgers", ["user_id"], unique=False)
        op.create_index("idx_ledger_user_date_type", "daily_email_ledgers", ["user_id", "plan_date", "email_type"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Drop daily_email_ledgers table
    if "daily_email_ledgers" in inspector.get_table_names():
        op.drop_index("idx_ledger_user_date_type", "daily_email_ledgers")
        op.drop_index("ix_daily_email_ledgers_user_id", "daily_email_ledgers")
        op.drop_index("ix_daily_email_ledgers_id", "daily_email_ledgers")
        op.drop_table("daily_email_ledgers")

    # Remove columns from onboarding_sessions
    if "onboarding_sessions" in inspector.get_table_names():
        op.drop_column("onboarding_sessions", "email_digest_opt_in")
        op.drop_column("onboarding_sessions", "contact_email")
        op.drop_column("onboarding_sessions", "timezone")

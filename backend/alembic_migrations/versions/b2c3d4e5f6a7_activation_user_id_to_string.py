"""activation user_id integer -> string (Clerk ids)

The strategy activation SSOT (``strategy_activation_status``) stored
``user_id`` as INTEGER — a legacy assumption from the pre-Clerk era. Real
end-user ids are Clerk strings (``user_3HM34...``), so
``activate_strategy`` rejected EVERY real user with
400 "User ID must be numeric for strategy activation" and the SSOT could
never be written.

Applied to every end-user SQLite database via ``init_user_database`` →
``alembic upgrade head``. SQLite requires batch mode for ALTER COLUMN.

Revision ID: b2c3d4e5f6a7
Revises: f0e1d2c3a4b5
Create Date: 2026-09-07 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "f0e1d2c3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "strategy_activation_status" not in existing_tables:
        # Fresh DBs get the table from Base.metadata.create_all-era initializers
        # or a later full create; nothing to alter here.
        return

    cols = {c["name"]: c for c in inspector.get_columns("strategy_activation_status")}
    user_col = cols.get("user_id")
    if user_col is not None and "VARCHAR" in str(user_col.get("type", "")).upper():
        return

    with op.batch_alter_table("strategy_activation_status") as batch_op:
        batch_op.alter_column(
            "user_id",
            existing_type=sa.Integer(),
            type_=sa.String(length=255),
            existing_nullable=False,
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "strategy_activation_status" not in inspector.get_table_names():
        return

    with op.batch_alter_table("strategy_activation_status") as batch_op:
        batch_op.alter_column(
            "user_id",
            existing_type=sa.String(length=255),
            type_=sa.Integer(),
            existing_nullable=False,
        )
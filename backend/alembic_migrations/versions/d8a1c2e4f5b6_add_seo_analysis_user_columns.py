"""seo_analyses + seo_analysis_history: per-user scoping columns

Phase 8 of the seo-tools UI completion plan. The dashboard analyzers
(/api/seo-dashboard/analyze-comprehensive et al.) persisted analyses with no
owner: seo_analyses / seo_analysis_history were global, URL-keyed tables.
Column precedent already exists in these surfaces —
seo_analysis_sessions.triggered_by_user_id / seo_action_runs.triggered_by_user_id
(baseline a4fe799f2cab) — this migration adds the same nullable String(64)
column to the two analyzer persistence tables so
SEOAnalysisService.store_analysis_result(result, triggered_by_user_id=...)
can scope stored analyses to the authenticated Clerk user.

Applied to every end-user SQLite database via init_user_database →
alembic upgrade head. SQLite requires batch mode for ALTER TABLE.

Legacy rows keep NULL (no backfill) and are treated as legacy-global by reads.

Revision ID: d8a1c2e4f5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-09-13 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8a1c2e4f5b6"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TARGET_COLUMNS = {
    "seo_analyses": "triggered_by_user_id",
    "seo_analysis_history": "triggered_by_user_id",
}


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    for table, column in _TARGET_COLUMNS.items():
        if table not in existing_tables:
            # Fresh DBs get the column from Base.metadata.create_all-era
            # initializers (the model already declares it); nothing to alter.
            continue

        cols = {c["name"] for c in inspector.get_columns(table)}
        if column in cols:
            # Idempotent guard: a parallel branch (or a previous failed run)
            # may have added it already.
            continue

        # Phase 8: batch mode is required by SQLite for ALTER TABLE.
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column(column, sa.String(64), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    for table, column in _TARGET_COLUMNS.items():
        if table not in existing_tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(table)}
        if column not in cols:
            continue
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_column(column)

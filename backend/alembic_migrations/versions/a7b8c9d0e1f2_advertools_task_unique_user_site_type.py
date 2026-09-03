"""advertools tasks: unique (user, site, type) + deny duplicate rows

Revision ID: a7b8c9d0e1f2
Revises: b0c1d2e3f4a5
Create Date: 2026-09-03 16:50:00.000000

Why:
    Duplicate AdvertoolsTask rows (same user, site, and payload type) were
    created by a mix of raw ``db.add()`` call sites and a SELECT-then-INSERT
    pattern that is inherently race-prone. Each duplicate row became due and
    ran the full sitemap/content pipeline concurrently, amplifying origin HTTP
    429s. This migration makes one-row-per-(user, website_url, type) a
    DATABASE-level guarantee by:
      1. Adding a denormalized, queryable ``task_type`` column (mirrors
         ``payload['type']`` so it can be indexed/constrained).
      2. Backfilling it from the JSON payload.
      3. Collapsing existing duplicate rows (older duplicates have their
         execution logs re-homed to the newest row, then are deleted) so the
         unique constraint can be created on clean data.
      4. Creating a UNIQUE constraint on (user_id, website_url, task_type).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = 'b0c1d2e3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "advertools_tasks"
_LOGS = "advertools_execution_logs"
_UNIQUE = "uq_advertools_tasks_user_site_type"


def _json_type_expr(dialect_name: str) -> str:
    """SQL expression extracting ``payload['type']`` for the active dialect."""
    if dialect_name == "sqlite":
        return "json_extract(payload, '$.type')"
    return "payload->>'type'"


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    dialect = conn.dialect.name

    if _TABLE not in inspector.get_table_names():
        return

    existing_cols = [c["name"] for c in inspector.get_columns(_TABLE)]
    if "task_type" not in existing_cols:
        op.add_column(_TABLE, sa.Column("task_type", sa.String(length=50), nullable=True))

    # Data phase (backfill + dedup) runs in an autocommit block. This is the
    # canonical alembic way to commit data mutations on drivers like SQLite:
    #   - the COLLAPSE of duplicate rows MUST be committed before the batch
    #     rebuild below reflects the table, otherwise the deleted duplicates
    #     get copied back into the rebuilt table; AND
    #   - a bare `conn.commit()` would tear down alembic's own transaction and
    #     prevent the revision from being stamped, re-running the migration.
    with op.get_context().autocommit_block():
        type_expr = _json_type_expr(dialect)
        # Backfill from payload['type'], falling back to 'content_audit' for
        # legacy rows that carried no type (they were the default audit flavor).
        op.execute(
            f"UPDATE {_TABLE} SET task_type = "
            f"CASE WHEN {type_expr} IS NOT NULL AND {type_expr} != '' "
            f"THEN {type_expr} ELSE 'content_audit' END "
            f"WHERE task_type IS NULL OR task_type = ''"
        )

        # Collapse duplicate rows per (user, website_url, task_type): newest
        # wins, its id becomes the canonical task; older duplicates' execution
        # logs are re-homed to the canonical row, then the duplicates are
        # deleted. This preserves log history while making the unique
        # constraint creatable.
        dup_row = conn.execute(sa.text(
            f"SELECT id FROM {_TABLE} AS d "
            f"WHERE d.id != ("
            f"  SELECT t.id FROM {_TABLE} AS t "
            f"  WHERE t.user_id = d.user_id AND t.website_url = d.website_url "
            f"    AND t.task_type = d.task_type "
            f"  ORDER BY COALESCE(t.updated_at, t.created_at, t.id) DESC, t.id DESC "
            f"  LIMIT 1"
            f")"
        ))
        dup_ids = [row[0] for row in dup_row]

        for dup_id in dup_ids:
            keep_id = conn.execute(sa.text(
                f"SELECT t.id FROM {_TABLE} AS t "
                f"WHERE t.id != :dupid AND t.user_id = ("
                f"  SELECT user_id FROM {_TABLE} WHERE id = :dupid"
                f") AND t.website_url = ("
                f"  SELECT website_url FROM {_TABLE} WHERE id = :dupid"
                f") AND t.task_type = ("
                f"  SELECT task_type FROM {_TABLE} WHERE id = :dupid"
                f") ORDER BY COALESCE(t.updated_at, t.created_at, t.id) DESC, t.id DESC "
                f"LIMIT 1"
            ), {"dupid": dup_id}).scalar()
            if keep_id is None:
                continue
            conn.execute(sa.text(
                f"UPDATE {_LOGS} SET task_id = :keep WHERE task_id = :dup"
            ), {"keep": keep_id, "dup": dup_id})

        for dup_id in dup_ids:
            conn.execute(sa.text(f"DELETE FROM {_TABLE} WHERE id = :id"), {"id": dup_id})

    # Schema phase: enforce NOT NULL + create the unique constraint via batch
    # mode (batch rebuilds the table, required on SQLite for NOT NULL and
    # unique-constraint changes; safe on postgres/mysql too). The unique
    # constraint auto-creates its backing index; no separate index is needed.
    #
    # Idempotency guard: ``create_all``-based init (init_user_database) builds
    # the table straight from the model metadata, which already includes
    # ``task_type`` + the unique constraint. When alembic then runs this
    # migration on that table, the constraint already exists — a batch rebuild
    # to re-add it would fail (`_alembic_tmp_... already exists`). So only
    # batch-rebuild when the constraint is genuinely absent.
    inspector = sa.inspect(conn)
    existing_constraints = {
        c["name"]
        for c in inspector.get_unique_constraints(_TABLE)
        if c.get("name")
    }
    if _UNIQUE not in existing_constraints:
        with op.batch_alter_table(_TABLE) as batch_op:
            batch_op.alter_column(
                "task_type",
                existing_type=sa.String(length=50),
                nullable=False,
            )
            batch_op.create_unique_constraint(
                _UNIQUE, ["user_id", "website_url", "task_type"],
            )
    else:
        # Constraint already present (create_all path). Only the NOT NULL
        # guarantee may still be missing if the column pre-existed without it;
        # enforce it cheaply via batch only when needed.
        task_type_col = next(
            (c for c in inspector.get_columns(_TABLE) if c["name"] == "task_type"),
            None,
        )
        if task_type_col is not None and task_type_col.get("nullable", True):
            with op.batch_alter_table(_TABLE) as batch_op:
                batch_op.alter_column(
                    "task_type",
                    existing_type=sa.String(length=50),
                    nullable=False,
                )


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if _TABLE not in inspector.get_table_names():
        return

    existing_cols = [c["name"] for c in inspector.get_columns(_TABLE)]
    if "task_type" not in existing_cols:
        return

    with op.batch_alter_table(_TABLE) as batch_op:
        try:
            batch_op.drop_constraint(_UNIQUE, type_="unique")
        except Exception:
            pass
        batch_op.alter_column(
            "task_type",
            existing_type=sa.String(length=50),
            nullable=True,
        )

    op.drop_column(_TABLE, "task_type")

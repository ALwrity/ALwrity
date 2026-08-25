#!/usr/bin/env python3
"""
Apply subscription-table constraints and indexes safely on existing SQLite databases.

This migration performs:
1) Deduplication of `usage_summaries` rows by (user_id, billing_period).
2) Deduplication of `subscription_renewal_history` rows by renewal event tuple.
3) Creation of unique and performance indexes used by subscription usage queries.
"""

import argparse
import sqlite3
import sys
from pathlib import Path
from typing import List, Optional

from loguru import logger

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.database import get_all_user_ids, get_user_db_path


API_USAGE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_api_usage_logs_billing_period ON api_usage_logs (billing_period)",
    "CREATE INDEX IF NOT EXISTS idx_api_usage_logs_timestamp ON api_usage_logs (timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_api_usage_logs_provider ON api_usage_logs (provider)",
    "CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_period ON api_usage_logs (user_id, billing_period)",
    "CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_provider_period ON api_usage_logs (user_id, provider, billing_period)",
]

USAGE_SUMMARY_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_usage_summaries_user_period ON usage_summaries (user_id, billing_period)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_summaries_user_period ON usage_summaries (user_id, billing_period)",
]

RENEWAL_HISTORY_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_subscription_renewal_history_user_id ON subscription_renewal_history (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_renewal_history_created_at ON subscription_renewal_history (created_at)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_renewal_history_user_created ON subscription_renewal_history (user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_subscription_renewal_history_user_period ON subscription_renewal_history (user_id, new_period_start, new_period_end)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_renewal_event ON subscription_renewal_history (user_id, new_period_start, new_period_end, renewal_type)",
]


def table_exists(cursor: sqlite3.Cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?",
        (table_name,),
    )
    return cursor.fetchone() is not None


def dedupe_usage_summaries(cursor: sqlite3.Cursor) -> int:
    """Keep the most recently updated row per (user_id, billing_period)."""
    cursor.execute(
        """
        SELECT user_id, billing_period, COUNT(*)
        FROM usage_summaries
        GROUP BY user_id, billing_period
        HAVING COUNT(*) > 1
        """
    )
    duplicates = cursor.fetchall()

    removed = 0
    for user_id, billing_period, _ in duplicates:
        cursor.execute(
            """
            SELECT id
            FROM usage_summaries
            WHERE user_id = ? AND billing_period = ?
            ORDER BY
                CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END,
                updated_at DESC,
                CASE WHEN created_at IS NULL THEN 1 ELSE 0 END,
                created_at DESC,
                id DESC
            LIMIT 1
            """,
            (user_id, billing_period),
        )
        keeper = cursor.fetchone()
        if not keeper:
            continue

        keeper_id = keeper[0]
        cursor.execute(
            "DELETE FROM usage_summaries WHERE user_id = ? AND billing_period = ? AND id != ?",
            (user_id, billing_period, keeper_id),
        )
        removed += cursor.rowcount

    return removed


def dedupe_renewal_history(cursor: sqlite3.Cursor) -> int:
    """Keep latest row per renewal event tuple used by the unique constraint."""
    cursor.execute(
        """
        SELECT user_id, new_period_start, new_period_end, renewal_type, COUNT(*)
        FROM subscription_renewal_history
        GROUP BY user_id, new_period_start, new_period_end, renewal_type
        HAVING COUNT(*) > 1
        """
    )
    duplicates = cursor.fetchall()

    removed = 0
    for user_id, new_period_start, new_period_end, renewal_type, _ in duplicates:
        cursor.execute(
            """
            SELECT id
            FROM subscription_renewal_history
            WHERE user_id = ?
              AND new_period_start = ?
              AND new_period_end = ?
              AND renewal_type = ?
            ORDER BY
                CASE WHEN created_at IS NULL THEN 1 ELSE 0 END,
                created_at DESC,
                id DESC
            LIMIT 1
            """,
            (user_id, new_period_start, new_period_end, renewal_type),
        )
        keeper = cursor.fetchone()
        if not keeper:
            continue

        keeper_id = keeper[0]
        cursor.execute(
            """
            DELETE FROM subscription_renewal_history
            WHERE user_id = ?
              AND new_period_start = ?
              AND new_period_end = ?
              AND renewal_type = ?
              AND id != ?
            """,
            (user_id, new_period_start, new_period_end, renewal_type, keeper_id),
        )
        removed += cursor.rowcount

    return removed


def run_migration_for_db(db_path: Path) -> bool:
    if not db_path.exists():
        logger.warning(f"Skipping missing database: {db_path}")
        return True

    logger.info(f"Running subscription constraint migration for: {db_path}")

    connection = sqlite3.connect(str(db_path))
    cursor = connection.cursor()

    try:
        cursor.execute("BEGIN")

        if table_exists(cursor, "usage_summaries"):
            removed = dedupe_usage_summaries(cursor)
            logger.info(f"usage_summaries dedupe removed {removed} duplicate row(s)")
            for statement in USAGE_SUMMARY_INDEXES:
                cursor.execute(statement)
        else:
            logger.warning("Table usage_summaries not found; skipping related constraints")

        if table_exists(cursor, "api_usage_logs"):
            for statement in API_USAGE_INDEXES:
                cursor.execute(statement)
        else:
            logger.warning("Table api_usage_logs not found; skipping related indexes")

        if table_exists(cursor, "subscription_renewal_history"):
            removed = dedupe_renewal_history(cursor)
            logger.info(f"subscription_renewal_history dedupe removed {removed} duplicate row(s)")
            for statement in RENEWAL_HISTORY_INDEXES:
                cursor.execute(statement)
        else:
            logger.warning("Table subscription_renewal_history not found; skipping related constraints")

        connection.commit()
        logger.info("✅ Migration completed successfully")
        return True
    except Exception as exc:
        connection.rollback()
        logger.error(f"❌ Migration failed for {db_path}: {exc}")
        return False
    finally:
        connection.close()


def resolve_targets(user_id: Optional[str]) -> List[Path]:
    if user_id:
        return [Path(get_user_db_path(user_id))]

    user_ids = get_all_user_ids()
    return [Path(get_user_db_path(uid)) for uid in user_ids]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Apply subscription usage constraints/indexes and dedupe old rows.",
    )
    parser.add_argument("--user_id", help="Target one user database instead of all discovered users")
    args = parser.parse_args()

    targets = resolve_targets(args.user_id)
    if not targets:
        logger.warning("No user databases discovered. Nothing to migrate.")
        return 0

    failures = 0
    for db_path in targets:
        success = run_migration_for_db(db_path)
        if not success:
            failures += 1

    if failures:
        logger.error(f"Migration finished with {failures} failure(s)")
        return 1

    logger.info("All targeted databases migrated successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

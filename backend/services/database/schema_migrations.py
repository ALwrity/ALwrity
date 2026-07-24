"""Legacy SQLite schema backfills for per-user tenant databases."""

from __future__ import annotations

from loguru import logger


def ensure_daily_workflow_schema(engine, user_id: str) -> None:
    """Backfill required daily_workflow_plans columns for legacy tenant DBs."""
    required_columns = {
        "workflow_type": "VARCHAR(20) NOT NULL DEFAULT 'main'",
        "source": "VARCHAR(30) NOT NULL DEFAULT 'agent'",
        "generation_mode": "VARCHAR(30) NOT NULL DEFAULT 'llm_generation'",
        "committee_agent_count": "INTEGER NOT NULL DEFAULT 0",
        "fallback_used": "BOOLEAN NOT NULL DEFAULT 0",
        "generation_run_id": "INTEGER",
    }

    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_workflow_plans'"
            ).fetchone()
            if not table_check:
                return

            existing_cols = {
                row[1]
                for row in conn.exec_driver_sql("PRAGMA table_info(daily_workflow_plans)").fetchall()
            }

            for col_name, col_def in required_columns.items():
                if col_name not in existing_cols:
                    conn.exec_driver_sql(
                        f"ALTER TABLE daily_workflow_plans ADD COLUMN {col_name} {col_def}"
                    )
                    logger.info(
                        f"Auto-migrated daily_workflow_plans column '{col_name}' for user {user_id}"
                    )
    except Exception as e:
        logger.error(f"Failed daily_workflow_plans schema compatibility check for user {user_id}: {e}")

    task_required_columns = {
        "workflow_type": "VARCHAR(20) NOT NULL DEFAULT 'main'",
        "decided_at": "DATETIME",
        "completion_notes": "TEXT",
    }
    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_workflow_tasks'"
            ).fetchone()
            if not table_check:
                return

            existing_cols = {
                row[1]
                for row in conn.exec_driver_sql("PRAGMA table_info(daily_workflow_tasks)").fetchall()
            }

            for col_name, col_def in task_required_columns.items():
                if col_name not in existing_cols:
                    conn.exec_driver_sql(
                        f"ALTER TABLE daily_workflow_tasks ADD COLUMN {col_name} {col_def}"
                    )
                    logger.info(
                        f"Auto-migrated daily_workflow_tasks column '{col_name}' for user {user_id}"
                    )
    except Exception as e:
        logger.error(f"Failed daily_workflow_tasks schema compatibility check for user {user_id}: {e}")


def ensure_task_history_unique_index(engine, user_id: str) -> None:
    """Enforce unique index on task_history(user_id, task_hash)."""
    index_name = "ix_task_history_user_hash"
    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='task_history'"
            ).fetchone()
            if not table_check:
                return

            existing_idx = conn.exec_driver_sql("PRAGMA index_list('task_history')").fetchall()
            target_idx = next((row for row in existing_idx if row[1] == index_name), None)

            if target_idx and target_idx[2] == 1:
                return

            cursor = conn.exec_driver_sql(
                """
                DELETE FROM task_history WHERE rowid NOT IN (
                    SELECT MIN(rowid) FROM task_history
                    WHERE user_id = ?
                    GROUP BY user_id, task_hash
                ) AND user_id = ?
                """,
                (user_id, user_id),
            )
            if cursor.rowcount > 0:
                logger.warning(
                    f"Removed {cursor.rowcount} duplicate task_history rows for user {user_id}"
                )

            if target_idx:
                conn.exec_driver_sql(f"DROP INDEX {index_name}")

            conn.exec_driver_sql(
                f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} ON task_history (user_id, task_hash)"
            )
            logger.info(f"Auto-migrated task_history unique index '{index_name}' for user {user_id}")
    except Exception as e:
        logger.error(f"Failed task_history unique index migration for user {user_id}: {e}")


def ensure_scheduler_task_columns(engine, user_id: str) -> None:
    """Backfill started_at and last_heartbeat columns for all scheduler task tables."""
    task_tables = {
        "advertools_tasks": ["started_at", "last_heartbeat"],
        "onboarding_full_website_analysis_tasks": ["started_at", "last_heartbeat"],
        "deep_competitor_analysis_tasks": ["started_at", "last_heartbeat"],
        "deep_website_crawl_tasks": ["started_at", "last_heartbeat"],
        "sif_indexing_tasks": ["started_at", "last_heartbeat"],
        "market_trends_tasks": ["started_at", "last_heartbeat"],
        "website_analysis_tasks": ["started_at", "last_heartbeat"],
    }

    try:
        with engine.begin() as conn:
            for table_name, columns in task_tables.items():
                table_check = conn.exec_driver_sql(
                    f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'"
                ).fetchone()
                if not table_check:
                    continue

                existing_cols = {
                    row[1]
                    for row in conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
                }

                for col_name in columns:
                    if col_name not in existing_cols:
                        conn.exec_driver_sql(
                            f"ALTER TABLE {table_name} ADD COLUMN {col_name} DATETIME NULL"
                        )
                        logger.warning(
                            f"Auto-migrated {table_name} column '{col_name}' for user {user_id}"
                        )
    except Exception as e:
        logger.error(f"Failed scheduler task schema migration for user {user_id}: {e}")

    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='deep_website_crawl_tasks'"
            ).fetchone()
            if table_check:
                existing_cols = {
                    row[1]
                    for row in conn.exec_driver_sql(
                        "PRAGMA table_info(deep_website_crawl_tasks)"
                    ).fetchall()
                }
                if "frequency_days" not in existing_cols:
                    conn.exec_driver_sql(
                        "ALTER TABLE deep_website_crawl_tasks ADD COLUMN frequency_days INTEGER DEFAULT 7"
                    )
                    logger.warning(
                        f"Auto-migrated deep_website_crawl_tasks column 'frequency_days' for user {user_id}"
                    )
    except Exception as e:
        logger.error(f"Failed frequency_days schema migration for user {user_id}: {e}")


def ensure_sif_indexing_watermark_table(engine, user_id: str) -> None:
    """Phase 3.4: backfill the per-user sif_indexing_watermarks table."""
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS sif_indexing_watermarks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id VARCHAR(255) NOT NULL,
                    source_id VARCHAR(512) NOT NULL,
                    source_hash VARCHAR(128) NOT NULL DEFAULT '',
                    embedding_count INTEGER NOT NULL DEFAULT 0,
                    indexed_at DATETIME NOT NULL,
                    notes TEXT NULL
                )
                """
            )
            conn.exec_driver_sql(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_sif_watermark_user_source
                ON sif_indexing_watermarks (user_id, source_id)
                """
            )
            conn.exec_driver_sql(
                """
                CREATE INDEX IF NOT EXISTS ix_sif_watermark_user_indexed
                ON sif_indexing_watermarks (user_id, indexed_at)
                """
            )
    except Exception as e:
        logger.error(f"Failed sif_indexing_watermarks schema migration for user {user_id}: {e}")


def ensure_semantic_health_checks_table(engine, user_id: str) -> None:
    """Phase 5: backfill the per-user semantic_health_checks table."""
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS semantic_health_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id VARCHAR(255) NOT NULL,
                    last_check_at DATETIME NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'unknown',
                    value INTEGER NOT NULL DEFAULT 0,
                    description TEXT NULL,
                    recommendations_json TEXT NULL,
                    snapshot_json TEXT NULL
                )
                """
            )
            conn.exec_driver_sql(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_semantic_health_check_user
                ON semantic_health_checks (user_id)
                """
            )
            conn.exec_driver_sql(
                """
                CREATE INDEX IF NOT EXISTS ix_semantic_health_check_user
                ON semantic_health_checks (user_id)
                """
            )
    except Exception as e:
        logger.error(f"Failed semantic_health_checks schema migration for user {user_id}: {e}")


def ensure_semantic_monitoring_snapshots_table(engine, user_id: str) -> None:
    """Phase 5: backfill the per-user semantic_monitoring_snapshots table."""
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS semantic_monitoring_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id VARCHAR(255) NOT NULL,
                    captured_at DATETIME NOT NULL,
                    snapshot_json TEXT NOT NULL
                )
                """
            )
            conn.exec_driver_sql(
                """
                CREATE INDEX IF NOT EXISTS ix_semantic_snapshot_user_captured
                ON semantic_monitoring_snapshots (user_id, captured_at)
                """
            )
    except Exception as e:
        logger.error(
            f"Failed semantic_monitoring_snapshots schema migration for user {user_id}: {e}"
        )


def ensure_onboarding_data_integration_columns(engine, user_id: str) -> None:
    """Backfill required onboarding_data_integrations columns for legacy tenant DBs."""
    required_columns = {"canonical_profile": "JSON NULL"}

    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='onboarding_data_integrations'"
            ).fetchone()
            if not table_check:
                return

            existing_cols = {
                row[1]
                for row in conn.exec_driver_sql(
                    "PRAGMA table_info(onboarding_data_integrations)"
                ).fetchall()
            }

            for col_name, col_def in required_columns.items():
                if col_name not in existing_cols:
                    conn.exec_driver_sql(
                        f"ALTER TABLE onboarding_data_integrations ADD COLUMN {col_name} {col_def}"
                    )
                    logger.warning(
                        f"Auto-migrated onboarding_data_integrations column '{col_name}' for user {user_id}"
                    )
    except Exception as e:
        logger.error(
            f"Failed onboarding_data_integrations schema compatibility check for user {user_id}: {e}"
        )


def ensure_onboarding_session_payload_column(engine, user_id: str) -> None:
    """Backfill payload column for onboarding_sessions table."""
    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='onboarding_sessions'"
            ).fetchone()
            if not table_check:
                return

            existing_cols = {
                row[1]
                for row in conn.exec_driver_sql("PRAGMA table_info(onboarding_sessions)").fetchall()
            }

            if "payload" not in existing_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE onboarding_sessions ADD COLUMN payload JSON NULL"
                )
                logger.warning(
                    f"Auto-migrated onboarding_sessions column 'payload' for user {user_id}"
                )
    except Exception as e:
        logger.error(f"Failed onboarding_sessions payload schema migration for user {user_id}: {e}")


def ensure_calendar_events_user_id_column(engine, user_id: str) -> None:
    """Backfill user_id column for calendar_events table."""
    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_events'"
            ).fetchone()
            if not table_check:
                return

            existing_cols = {
                row[1]
                for row in conn.exec_driver_sql("PRAGMA table_info(calendar_events)").fetchall()
            }

            if "user_id" not in existing_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE calendar_events ADD COLUMN user_id VARCHAR(255) NOT NULL DEFAULT ''"
                )
                conn.exec_driver_sql(
                    "CREATE INDEX IF NOT EXISTS ix_calendar_events_user_id ON calendar_events (user_id)"
                )
                logger.warning(
                    f"Auto-migrated calendar_events column 'user_id' for user {user_id}"
                )
    except Exception as e:
        logger.error(f"Failed calendar_events user_id schema migration for user {user_id}: {e}")


def ensure_enhanced_calendar_user_id_type(engine, user_id: str) -> None:
    """Migrate user_id from INTEGER to VARCHAR(255) in enhanced calendar tables."""
    from models.content_planning import Base as EnhancedBase

    tables = [
        "ai_calendar_recommendations",
        "content_trend_analysis",
        "content_optimizations",
        "calendar_generation_sessions",
    ]
    for table in tables:
        try:
            with engine.connect() as conn:
                exists = conn.exec_driver_sql(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
                ).fetchone()
                if not exists:
                    continue

                col_info = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
                col_map = {row[1]: row[2] for row in col_info}

                if col_map.get("user_id", "").upper().startswith("VARCHAR"):
                    continue

                if "user_id" not in col_map:
                    continue

                conn.exec_driver_sql(f"CREATE TABLE {table}_backup AS SELECT * FROM {table}")
                col_names = ", ".join(f'"{c}"' for c in col_map.keys())
                cast_select = ", ".join(
                    "CAST(user_id AS TEXT)" if c == "user_id" else f'"{c}"'
                    for c in col_map.keys()
                )
                conn.exec_driver_sql(f"DROP TABLE {table}")
                EnhancedBase.metadata.create_all(conn)
                conn.exec_driver_sql(
                    f"INSERT INTO {table} ({col_names}) SELECT {cast_select} FROM {table}_backup"
                )
                conn.exec_driver_sql(f"DROP TABLE {table}_backup")
                conn.commit()

                logger.info(
                    f"Migrated {table}.user_id from INTEGER to VARCHAR for user {user_id}"
                )
        except Exception as e:
            logger.error(f"Failed {table} user_id type migration for user {user_id}: {e}")


def ensure_linkedin_post_analytics_attachments_column(engine, user_id: str) -> None:
    """Backfill attachments_json column for linkedin_post_analytics (post media cache)."""
    try:
        with engine.begin() as conn:
            table_check = conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='linkedin_post_analytics'"
            ).fetchone()
            if not table_check:
                return

            existing_cols = {
                row[1]
                for row in conn.exec_driver_sql(
                    "PRAGMA table_info(linkedin_post_analytics)"
                ).fetchall()
            }

            if "attachments_json" not in existing_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE linkedin_post_analytics ADD COLUMN attachments_json JSON NULL"
                )
                logger.warning(
                    "Auto-migrated linkedin_post_analytics column 'attachments_json' for user {}",
                    user_id,
                )
    except Exception as e:
        logger.error(
            "Failed linkedin_post_analytics attachments_json schema migration for user {}: {}",
            user_id,
            e,
        )


def run_user_schema_migrations(engine, user_id: str) -> None:
    """Run all legacy schema backfills for a tenant database."""
    ensure_scheduler_task_columns(engine, user_id)
    ensure_onboarding_data_integration_columns(engine, user_id)
    ensure_onboarding_session_payload_column(engine, user_id)
    ensure_calendar_events_user_id_column(engine, user_id)
    ensure_enhanced_calendar_user_id_type(engine, user_id)
    ensure_linkedin_post_analytics_attachments_column(engine, user_id)
    ensure_daily_workflow_schema(engine, user_id)
    ensure_task_history_unique_index(engine, user_id)

    from alwrity_utils.linkedin_lean_mode import should_run_sif_schema_ensures

    if should_run_sif_schema_ensures():
        ensure_sif_indexing_watermark_table(engine, user_id)
        ensure_semantic_health_checks_table(engine, user_id)
        ensure_semantic_monitoring_snapshots_table(engine, user_id)

"""
Podcast Schema Utilities

Defensive schema verification and migration helpers for podcast SQLite tables.
Ensures required columns exist at runtime so queries never crash on unmigrated user DBs.
"""

from typing import Set
from sqlalchemy.orm import Session
from sqlalchemy import text
from loguru import logger


def ensure_podcast_projects_columns(db: Session) -> None:
    """Ensure required columns exist on podcast_projects for runtime safety.

    This is a defensive guard for environments where SQLite migrations have
    not yet been applied to existing user database files.
    """
    try:
        result = db.execute(text("PRAGMA table_info(podcast_projects)"))
        cols: Set[str] = {row[1] for row in result}

        if not cols:
            # Table doesn't exist yet; create_all will create it with full schema.
            return

        required_columns = {
            "presenter_reference_url": "VARCHAR(1000) NULL",
            "final_video_url": "VARCHAR(1000) NULL",
            "avatar_url": "VARCHAR(1000) NULL",
            "avatar_prompt": "TEXT NULL",
            "avatar_persona_id": "VARCHAR(255) NULL",
        }

        for col_name, ddl in required_columns.items():
            if col_name not in cols:
                logger.info(f"[SchemaGuard] Adding missing column {col_name} to podcast_projects table")
                try:
                    db.execute(text(f"ALTER TABLE podcast_projects ADD COLUMN {col_name} {ddl}"))
                    db.commit()
                    logger.info(f"[SchemaGuard] Successfully added column {col_name} to podcast_projects")
                except Exception as alter_err:
                    if "duplicate column" in str(alter_err).lower():
                        logger.debug(f"[SchemaGuard] Column {col_name} already added concurrently")
                    else:
                        logger.error(f"[SchemaGuard] Failed to add column {col_name}: {alter_err}")
                        db.rollback()
                        raise
    except Exception as e:
        logger.warning(f"[SchemaGuard] Error ensuring podcast_projects columns: {e}")
        try:
            db.rollback()
        except Exception:
            pass

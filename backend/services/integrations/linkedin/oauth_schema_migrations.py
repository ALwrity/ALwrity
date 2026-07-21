"""Idempotent LinkedIn OAuth SQLite schema migrations (per-tenant).

Runs inside the existing multi-tenant workspace DB via LinkedInOAuthService._init_db.
Ensures columns required by the Unipile connect path exist on legacy tables.
Does not create new databases or touch non-LinkedIn tables.
"""

from __future__ import annotations

import sqlite3
from typing import Dict, List, Optional

from loguru import logger

# Columns required by LinkedInOAuthService._TOKEN_SELECT_COLUMNS and Unipile store/read.
# Types match CREATE TABLE in linkedin_oauth._init_db. ALTER uses nullable/default-safe defs.
LINKEDIN_OAUTH_TOKEN_REQUIRED_COLUMNS: Dict[str, str] = {
    "user_id": "TEXT",
    "provider_mode": "TEXT NOT NULL DEFAULT 'unipile'",
    "linkedin_access_token": "TEXT",
    "linkedin_refresh_token": "TEXT",
    "expires_at": "TIMESTAMP",
    "account_name": "TEXT",
    "profile_urn": "TEXT",
    "is_active": "BOOLEAN DEFAULT TRUE",
    "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "unipile_account_id": "TEXT",
    "unipile_org_account_id": "TEXT",
}

# Columns used by plaintext token encryption migration (never assume they exist).
TOKEN_ENCRYPTION_COLUMNS = ("linkedin_access_token", "linkedin_refresh_token")


def _table_columns(cursor: sqlite3.Cursor, table: str) -> set[str]:
    cursor.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}


def ensure_linkedin_oauth_token_columns(
    cursor: sqlite3.Cursor,
    *,
    user_id: Optional[str] = None,
) -> List[str]:
    """Add any missing Unipile-era columns to linkedin_oauth_tokens.

    Idempotent. Leaves legacy zernio_* columns untouched if present.
    Returns the list of columns added.
    """
    existing = _table_columns(cursor, "linkedin_oauth_tokens")
    added: List[str] = []

    for column, col_def in LINKEDIN_OAUTH_TOKEN_REQUIRED_COLUMNS.items():
        if column in existing:
            continue
        cursor.execute(
            f"ALTER TABLE linkedin_oauth_tokens ADD COLUMN {column} {col_def}"
        )
        added.append(column)

    if added:
        logger.info(
            "[LinkedInOAuthSchema] Added missing linkedin_oauth_tokens columns "
            f"user_id={user_id or 'n/a'} columns={added}"
        )
    return added


def normalize_unipile_provider_mode(cursor: sqlite3.Cursor) -> int:
    """Set provider_mode=unipile where a Unipile account id is already stored.

    Returns number of rows updated.
    """
    existing = _table_columns(cursor, "linkedin_oauth_tokens")
    if "unipile_account_id" not in existing or "provider_mode" not in existing:
        return 0

    cursor.execute(
        """
        UPDATE linkedin_oauth_tokens
        SET provider_mode = 'unipile', updated_at = datetime('now')
        WHERE unipile_account_id IS NOT NULL
          AND TRIM(unipile_account_id) != ''
          AND LOWER(COALESCE(provider_mode, '')) NOT IN ('unipile', 'native')
        """
    )
    return cursor.rowcount if cursor.rowcount and cursor.rowcount > 0 else 0


def existing_token_encryption_columns(cursor: sqlite3.Cursor) -> List[str]:
    """Return which token-encryption columns exist on linkedin_oauth_tokens."""
    existing = _table_columns(cursor, "linkedin_oauth_tokens")
    return [col for col in TOKEN_ENCRYPTION_COLUMNS if col in existing]

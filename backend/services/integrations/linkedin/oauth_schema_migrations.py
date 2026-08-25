"""Legacy LinkedIn OAuth schema helpers.

The column-ensuring helpers previously lived here; their work has moved to
Alembic migration ``fb1c2d3e4f5a_heal_linkedin_oauth_columns``. The only
remaining runtime helper is the plaintext-token encryption detector, which is
still used by ``LinkedInOAuthService._migrate_plaintext_tokens_if_needed``.
"""

from __future__ import annotations

import sqlite3


# Columns used by plaintext token encryption migration (never assume they exist).
TOKEN_ENCRYPTION_COLUMNS = ("linkedin_access_token", "linkedin_refresh_token")


def _table_columns(cursor: sqlite3.Cursor, table: str) -> set[str]:
    cursor.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}


def existing_token_encryption_columns(cursor: sqlite3.Cursor) -> list[str]:
    """Return which token-encryption columns exist on linkedin_oauth_tokens."""
    existing = _table_columns(cursor, "linkedin_oauth_tokens")
    return [col for col in TOKEN_ENCRYPTION_COLUMNS if col in existing]

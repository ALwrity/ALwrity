"""
Persistence helpers for LinkedIn OAuth token rows.

Keeps row-level write logic modular and reusable outside linkedin_oauth.py.
"""

from __future__ import annotations

import sqlite3
from typing import Optional, Tuple

from loguru import logger

LOG_PREFIX = "[LinkedInOAuthTokenStore]"


def upsert_unipile_credentials_row(
    *,
    db_path: str,
    user_id: str,
    unipile_account_id: str,
    unipile_org_account_id: Optional[str],
    account_name: Optional[str],
    profile_urn: Optional[str],
) -> Tuple[bool, str]:
    """
    Store Unipile credentials while preventing duplicate rows for same account_id.

    Returns:
        (success, action) where action is one of: "updated", "inserted", "failed".
    """
    account_id = (unipile_account_id or "").strip()
    if not account_id:
        logger.error(f"{LOG_PREFIX} empty unipile_account_id user_id={user_id}")
        return False, "failed"

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE linkedin_oauth_tokens SET is_active = 0 WHERE user_id = ?",
                (user_id,),
            )

            cursor.execute(
                """
                UPDATE linkedin_oauth_tokens
                SET provider_mode = 'unipile',
                    unipile_org_account_id = ?,
                    account_name = ?,
                    profile_urn = ?,
                    is_active = 1,
                    updated_at = datetime('now')
                WHERE user_id = ? AND unipile_account_id = ?
                """,
                (
                    unipile_org_account_id,
                    account_name,
                    profile_urn,
                    user_id,
                    account_id,
                ),
            )
            if cursor.rowcount > 0:
                conn.commit()
                return True, "updated"

            cursor.execute(
                """
                INSERT INTO linkedin_oauth_tokens (
                    user_id, provider_mode, unipile_account_id,
                    unipile_org_account_id, account_name, profile_urn, is_active
                ) VALUES (?, 'unipile', ?, ?, ?, ?, 1)
                """,
                (
                    user_id,
                    account_id,
                    unipile_org_account_id,
                    account_name,
                    profile_urn,
                ),
            )
            conn.commit()
            return True, "inserted"
    except Exception as exc:
        logger.exception(
            f"{LOG_PREFIX} failed to upsert Unipile credentials user_id={user_id} "
            f"account_id={account_id}: {exc}"
        )
        return False, "failed"

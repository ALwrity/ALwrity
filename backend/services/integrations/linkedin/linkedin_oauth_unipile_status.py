"""
Unipile account sync status helpers for LinkedIn OAuth tokens.

Keeps unipile_sync_status read/write out of linkedin_oauth.py (already large).
"""

from __future__ import annotations

import os
import sqlite3
from typing import Any, Dict, Optional, TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from services.integrations.linkedin_oauth import LinkedInOAuthService

LOG_PREFIX = "[LinkedInUnipileStatus]"

USER_SOFT_DISCONNECTED_STATUS = "USER_DISCONNECTED"

DISCONNECTED_UNIPILE_STATUSES = frozenset(
    {
        "CREDENTIALS",
        "ERROR",
        "STOPPED",
        "DELETED",
        USER_SOFT_DISCONNECTED_STATUS,
    }
)

HEALTHY_UNIPILE_STATUSES = frozenset(
    {
        "OK",
        "RECONNECTED",
        "SYNC_SUCCESS",
        "CREATION_SUCCESS",
        "CONNECTING",
        "RUNNING",
        "CONNECTED",
        "SUCCESS",
    }
)


def normalize_unipile_status(status: Optional[str]) -> Optional[str]:
    """Normalize Unipile AccountStatus message to uppercase token."""
    if not status or not str(status).strip():
        return None
    return str(status).strip().upper()


def is_disconnected_unipile_status(status: Optional[str]) -> bool:
    normalized = normalize_unipile_status(status)
    return normalized in DISCONNECTED_UNIPILE_STATUSES if normalized else False


def _latest_token_row(
    oauth: "LinkedInOAuthService", user_id: str
) -> Optional[tuple]:
    """Return the most relevant token row (active first, then latest updated)."""
    oauth._init_db(user_id)
    db_path = oauth._get_db_path(user_id)
    if not os.path.exists(db_path):
        return None
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT {oauth._TOKEN_SELECT_COLUMNS}
            FROM linkedin_oauth_tokens
            WHERE user_id = ?
            ORDER BY is_active DESC, updated_at DESC, id DESC
            LIMIT 1
            """,
            (user_id,),
        )
        return cursor.fetchone()


def _row_dict(oauth: "LinkedInOAuthService", row: tuple) -> Dict[str, Any]:
    col_names = [c.strip() for c in oauth._TOKEN_SELECT_COLUMNS.split(",")]
    return dict(zip(col_names, row))


def get_stored_unipile_account_id(
    oauth: "LinkedInOAuthService", user_id: str
) -> Optional[str]:
    """Return Unipile account id from the active token row, if any."""
    row = oauth._get_active_token_row(user_id)
    if not row:
        return None
    account_id = _row_dict(oauth, row).get("unipile_account_id")
    if isinstance(account_id, str) and account_id.strip():
        return account_id.strip()
    return None


def get_reconnect_unipile_account_id(
    oauth: "LinkedInOAuthService", user_id: str
) -> Optional[str]:
    """
    Return preserved Unipile account id for reconnect (active or latest inactive row).

    Used after soft disconnect so returning users reconnect the same Unipile account.
    """
    row = _latest_token_row(oauth, user_id)
    if not row:
        return None
    account_id = _row_dict(oauth, row).get("unipile_account_id")
    if isinstance(account_id, str) and account_id.strip():
        return account_id.strip()
    return None


def get_unipile_sync_status(
    oauth: "LinkedInOAuthService", user_id: str
) -> Optional[str]:
    """Return sync status from the most relevant token row."""
    row = _latest_token_row(oauth, user_id)
    if not row:
        return None
    return normalize_unipile_status(_row_dict(oauth, row).get("unipile_sync_status"))


def set_unipile_sync_status(
    oauth: "LinkedInOAuthService",
    user_id: str,
    status: Optional[str],
    *,
    account_id: Optional[str] = None,
) -> bool:
    """Persist Unipile sync status on the active or matching token row."""
    normalized = normalize_unipile_status(status)
    try:
        oauth._init_db(user_id)
        db_path = oauth._get_db_path(user_id)
        if not os.path.exists(db_path):
            return False
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            if account_id:
                cursor.execute(
                    """
                    UPDATE linkedin_oauth_tokens
                    SET unipile_sync_status = ?, updated_at = datetime('now')
                    WHERE user_id = ? AND unipile_account_id = ?
                    """,
                    (normalized, user_id, account_id.strip()),
                )
            else:
                cursor.execute(
                    """
                    UPDATE linkedin_oauth_tokens
                    SET unipile_sync_status = ?, updated_at = datetime('now')
                    WHERE user_id = ? AND is_active = 1
                    """,
                    (normalized, user_id),
                )
            conn.commit()
            updated = cursor.rowcount > 0
        if updated:
            logger.info(
                f"{LOG_PREFIX} sync status updated user_id={user_id} "
                f"status={normalized} account_id={account_id or 'active-row'}"
            )
        else:
            logger.warning(
                f"{LOG_PREFIX} sync status not updated user_id={user_id} "
                f"status={normalized} account_id={account_id or 'active-row'}"
            )
        return updated
    except Exception as exc:
        logger.exception(
            f"{LOG_PREFIX} failed to set sync status user_id={user_id}: {exc}"
        )
        return False


def mark_user_soft_disconnected(oauth: "LinkedInOAuthService", user_id: str) -> bool:
    """
    Mark active token as user-disconnected, then deactivate (preserve account_id row).
    """
    try:
        oauth._init_db(user_id)
        db_path = oauth._get_db_path(user_id)
        if not os.path.exists(db_path):
            return False
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE linkedin_oauth_tokens
                SET unipile_sync_status = ?, updated_at = datetime('now')
                WHERE user_id = ? AND is_active = 1
                """,
                (USER_SOFT_DISCONNECTED_STATUS, user_id),
            )
            conn.commit()
        revoked = oauth.revoke_token(user_id)
        logger.info(
            f"{LOG_PREFIX} soft disconnect user_id={user_id} revoked={revoked}"
        )
        return revoked
    except Exception as exc:
        logger.exception(
            f"{LOG_PREFIX} soft disconnect failed user_id={user_id}: {exc}"
        )
        return False


def clear_stale_unipile_account_id(
    oauth: "LinkedInOAuthService",
    user_id: str,
    *,
    account_id: Optional[str] = None,
) -> bool:
    """
    Clear a preserved Unipile account_id that no longer exists on Unipile.

    Used when reconnect returns 404 or Unipile reports DELETED so the next
    connect creates a fresh account instead of clinging to a ghost id.
    """
    try:
        oauth._init_db(user_id)
        db_path = oauth._get_db_path(user_id)
        if not os.path.exists(db_path):
            return False

        target = account_id.strip() if isinstance(account_id, str) and account_id.strip() else None
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            if target:
                cursor.execute(
                    """
                    UPDATE linkedin_oauth_tokens
                    SET unipile_account_id = NULL,
                        unipile_sync_status = ?,
                        updated_at = datetime('now')
                    WHERE user_id = ? AND unipile_account_id = ?
                    """,
                    ("DELETED", user_id, target),
                )
            else:
                cursor.execute(
                    """
                    UPDATE linkedin_oauth_tokens
                    SET unipile_account_id = NULL,
                        unipile_sync_status = ?,
                        updated_at = datetime('now')
                    WHERE user_id = ? AND unipile_account_id IS NOT NULL
                    """,
                    ("DELETED", user_id),
                )
            conn.commit()
            updated = cursor.rowcount > 0

        if updated:
            logger.warning(
                f"{LOG_PREFIX} cleared stale Unipile account_id user_id={user_id} "
                f"account_id={target or 'all-rows'}"
            )
        else:
            logger.info(
                f"{LOG_PREFIX} no stale Unipile account_id to clear user_id={user_id} "
                f"account_id={target or 'all-rows'}"
            )
        return updated
    except Exception as exc:
        logger.exception(
            f"{LOG_PREFIX} failed to clear stale account_id user_id={user_id}: {exc}"
        )
        return False


def needs_unipile_reconnect(oauth: "LinkedInOAuthService", user_id: str) -> bool:
    """True when a preserved account_id exists and the user is not connected."""
    reconnect_id = get_reconnect_unipile_account_id(oauth, user_id)
    if not reconnect_id:
        return False
    try:
        oauth.resolve_credentials(user_id)
        return False
    except Exception:
        return True


def enrich_connection_status(
    oauth: "LinkedInOAuthService",
    user_id: str,
    status: Dict[str, Any],
) -> Dict[str, Any]:
    """Add reconnect lifecycle fields to connection status payload."""
    reconnect_id = get_reconnect_unipile_account_id(oauth, user_id)
    sync_status = get_unipile_sync_status(oauth, user_id)
    connected = bool(status.get("connected"))

    needs_reconnect = bool(reconnect_id and not connected)

    if is_disconnected_unipile_status(sync_status):
        status = {
            **status,
            "connected": False,
            "needs_reconnect": True,
        }
    else:
        status = {**status, "needs_reconnect": needs_reconnect}

    status["unipile_sync_status"] = sync_status
    status["stored_unipile_account_id"] = reconnect_id
    return status

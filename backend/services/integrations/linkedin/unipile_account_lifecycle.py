"""
Unipile account lifecycle — reconnect flow, webhook status handling, duplicate cleanup.

Follows Unipile guidance: preserve account_id, use reconnect endpoint, delete duplicates.
Docs: https://developer.unipile.com/docs/account-lifecycle
"""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional, TYPE_CHECKING

from loguru import logger

from services.integrations.linkedin.linkedin_oauth_unipile_status import (
    HEALTHY_UNIPILE_STATUSES,
    DISCONNECTED_UNIPILE_STATUSES,
    get_reconnect_unipile_account_id,
    normalize_unipile_status,
    set_unipile_sync_status,
)
from services.integrations.linkedin.unipile_client import UnipileAPIError, UnipileClient
from services.workspace_paths import get_workspace_root

if TYPE_CHECKING:
    from services.integrations.linkedin_oauth import LinkedInOAuthService

LOG_PREFIX = "[UnipileAccountLifecycle]"


def find_user_id_by_unipile_account_id(account_id: str) -> Optional[str]:
    """
    Resolve ALwrity user_id from a Unipile account_id by scanning workspace DBs.

    Used when AccountStatus webhooks omit the hosted-auth ``name`` field.
    """
    if not account_id or not account_id.strip():
        return None

    target = account_id.strip()
    workspace_root = get_workspace_root()
    if not workspace_root.is_dir():
        return None

    for entry in workspace_root.iterdir():
        if not entry.is_dir() or not entry.name.startswith("workspace_"):
            continue
        user_id = entry.name.removeprefix("workspace_")
        db_dir = entry / "db"
        if not db_dir.is_dir():
            db_dir = entry / "database"
        if not db_dir.is_dir():
            continue

        for db_file in db_dir.glob("*.db"):
            try:
                with sqlite3.connect(str(db_file)) as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        """
                        SELECT user_id FROM linkedin_oauth_tokens
                        WHERE unipile_account_id = ?
                        ORDER BY is_active DESC, updated_at DESC
                        LIMIT 1
                        """,
                        (target,),
                    )
                    row = cursor.fetchone()
                    if row and row[0]:
                        logger.info(
                            f"{LOG_PREFIX} resolved user_id={row[0]} "
                            f"from account_id={target}"
                        )
                        return str(row[0])
            except sqlite3.Error as exc:
                logger.debug(
                    f"{LOG_PREFIX} skip db scan path={db_file} error={exc}"
                )
    logger.warning(
        f"{LOG_PREFIX} no user found for account_id={target} after workspace scan"
    )
    return None


class UnipileAccountLifecycleService:
    """Reconnect URL generation, webhook lifecycle, and duplicate account cleanup."""

    def __init__(self, oauth_service: "LinkedInOAuthService"):
        self._oauth = oauth_service

    async def generate_connect_or_reconnect_url(
        self,
        user_id: str,
        *,
        callback_base: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Return hosted auth URL — reconnect when a stored account_id needs restoration,
        otherwise create a new connection link.
        """
        redirect_urls = self._oauth._get_unipile_redirect_urls(user_id, callback_base)
        client = UnipileClient()
        stored_id = get_reconnect_unipile_account_id(self._oauth, user_id)

        if stored_id:
            try:
                result = await client.reconnect_account(
                    account_id=stored_id,
                    success_redirect_url=redirect_urls["success"],
                    failure_redirect_url=redirect_urls["failure"],
                    notify_url=redirect_urls["notify"],
                )
                logger.info(
                    f"{LOG_PREFIX} reconnect link created user_id={user_id} "
                    f"account_id={stored_id}"
                )
                return {
                    "auth_url": result.auth_url,
                    "state": user_id,
                    "provider": "unipile",
                    "purpose": "reconnect",
                }
            except UnipileAPIError as exc:
                if exc.status_code == 404:
                    logger.warning(
                        f"{LOG_PREFIX} stored account missing on Unipile — "
                        f"falling back to create user_id={user_id} account_id={stored_id}"
                    )
                else:
                    logger.warning(
                        f"{LOG_PREFIX} reconnect link failed user_id={user_id} "
                        f"account_id={stored_id}: {exc}; falling back to create"
                    )

        result = await client.create_hosted_auth_link(
            user_id=user_id,
            success_redirect_url=redirect_urls["success"],
            failure_redirect_url=redirect_urls["failure"],
            notify_url=redirect_urls["notify"],
            providers=["LINKEDIN"],
        )
        logger.info(
            f"{LOG_PREFIX} create link generated user_id={user_id} "
            f"had_stored_id={bool(stored_id)}"
        )
        return {
            "auth_url": result.auth_url,
            "state": user_id,
            "provider": "unipile",
            "purpose": "connect",
        }

    async def resolve_duplicate_account_id(
        self,
        user_id: str,
        incoming_account_id: str,
    ) -> str:
        """
        Keep original account_id when Unipile returns a new duplicate.

        Deletes the duplicate on Unipile to avoid extra billed accounts.
        """
        stored_id = get_reconnect_unipile_account_id(self._oauth, user_id)
        incoming = incoming_account_id.strip()
        if not stored_id or stored_id == incoming:
            return incoming

        logger.warning(
            f"{LOG_PREFIX} duplicate account detected user_id={user_id} "
            f"stored_id={stored_id} incoming_id={incoming}; deleting duplicate"
        )
        client = UnipileClient()
        try:
            deleted = await client.delete_account(incoming)
            logger.info(
                f"{LOG_PREFIX} duplicate deleted user_id={user_id} "
                f"incoming_id={incoming} success={deleted}"
            )
        except Exception as exc:
            logger.warning(
                f"{LOG_PREFIX} duplicate delete failed user_id={user_id} "
                f"incoming_id={incoming}: {exc}"
            )
        return stored_id

    async def handle_account_status(
        self,
        account_id: str,
        status: Optional[str],
        user_id: Optional[str] = None,
    ) -> bool:
        """
        Process Unipile AccountStatus webhook payload.

        Returns True when status was applied to a user record.
        """
        normalized = normalize_unipile_status(status)
        if not normalized:
            logger.warning(
                f"{LOG_PREFIX} account status missing message account_id={account_id}"
            )
            return False

        resolved_user_id = user_id or find_user_id_by_unipile_account_id(account_id)
        if not resolved_user_id:
            logger.warning(
                f"{LOG_PREFIX} account status skipped — user not resolved "
                f"account_id={account_id} status={normalized}"
            )
            return False

        if normalized in DISCONNECTED_UNIPILE_STATUSES:
            updated = set_unipile_sync_status(
                self._oauth,
                resolved_user_id,
                normalized,
                account_id=account_id,
            )
            logger.warning(
                f"{LOG_PREFIX} account disconnected user_id={resolved_user_id} "
                f"account_id={account_id} status={normalized} updated={updated}"
            )
            return updated

        if normalized in HEALTHY_UNIPILE_STATUSES or normalized == "RECONNECTED":
            updated = set_unipile_sync_status(
                self._oauth,
                resolved_user_id,
                "OK",
                account_id=account_id,
            )
            logger.info(
                f"{LOG_PREFIX} account healthy user_id={resolved_user_id} "
                f"account_id={account_id} status={normalized} updated={updated}"
            )
            return updated

        logger.info(
            f"{LOG_PREFIX} account status ignored user_id={resolved_user_id} "
            f"account_id={account_id} status={normalized}"
        )
        return False

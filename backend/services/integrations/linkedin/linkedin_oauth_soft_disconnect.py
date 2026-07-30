"""
Soft disconnect for LinkedIn / Unipile — preserve account_id for reconnect billing.

When a user disconnects in LinkedIn Studio we deactivate the local token but keep
the Unipile account_id in their workspace DB so the next connect uses reconnect
(same id) instead of creating a billable duplicate on Unipile.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional, TYPE_CHECKING

from loguru import logger

from services.integrations.linkedin.linkedin_oauth_unipile_status import (
    USER_SOFT_DISCONNECTED_STATUS,
    get_reconnect_unipile_account_id,
    mark_user_soft_disconnected,
)

if TYPE_CHECKING:
    from services.integrations.linkedin_oauth import LinkedInOAuthService

LOG_PREFIX = "[LinkedInSoftDisconnect]"


def _hard_delete_on_disconnect_enabled() -> bool:
    """Opt-in hard delete on Unipile (legacy behaviour). Default: soft disconnect."""
    return os.getenv("LINKEDIN_UNIPILE_HARD_DELETE_ON_DISCONNECT", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


async def soft_disconnect_linkedin_user(
    oauth: "LinkedInOAuthService",
    user_id: str,
) -> Dict[str, Any]:
    """
    Soft-disconnect LinkedIn for a user: local revoke + preserved Unipile account_id.

    Optionally deletes on Unipile when LINKEDIN_UNIPILE_HARD_DELETE_ON_DISCONNECT=true.
    """
    provider = os.getenv("LINKEDIN_PROVIDER", "unipile").lower()
    preserved_id = get_reconnect_unipile_account_id(oauth, user_id)
    unipile_account_deleted = False

    logger.info(
        f"{LOG_PREFIX} start user_id={user_id} provider={provider} "
        f"preserved_account_id={preserved_id or 'none'} "
        f"hard_delete={_hard_delete_on_disconnect_enabled()}"
    )

    if provider == "unipile" and preserved_id and _hard_delete_on_disconnect_enabled():
        try:
            from services.integrations.linkedin.unipile_client import UnipileClient

            client = UnipileClient()
            unipile_account_deleted = await client.delete_account(preserved_id)
            logger.info(
                f"{LOG_PREFIX} hard delete on Unipile user_id={user_id} "
                f"account_id={preserved_id} success={unipile_account_deleted}"
            )
        except Exception as exc:
            logger.warning(
                f"{LOG_PREFIX} hard delete failed user_id={user_id} "
                f"account_id={preserved_id}: {exc}"
            )

    revoked = mark_user_soft_disconnected(oauth, user_id)
    status = oauth.get_connection_status(user_id)

    logger.info(
        f"{LOG_PREFIX} done user_id={user_id} revoked={revoked} "
        f"preserved_account_id={preserved_id or 'none'} "
        f"unipile_account_deleted={unipile_account_deleted} "
        f"needs_reconnect={status.get('needs_reconnect')}"
    )

    return {
        "success": revoked,
        "revoked": revoked,
        "provider": provider,
        "unipile_account_deleted": unipile_account_deleted,
        "preserved_unipile_account_id": preserved_id,
        "needs_reconnect": bool(status.get("needs_reconnect")),
        "connected": status.get("connected", False),
        "has_env_fallback": False,
    }

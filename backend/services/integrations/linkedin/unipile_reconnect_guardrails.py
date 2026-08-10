"""
Guardrails for Unipile reconnect/account mapping flows.

Keeps reconnect preflight and ownership validation logic out of larger services.
"""

from __future__ import annotations

from typing import Any, Optional, TYPE_CHECKING

from loguru import logger

from services.integrations.linkedin.linkedin_oauth_unipile_status import (
    clear_stale_unipile_account_id,
)
from services.integrations.linkedin.unipile_client import UnipileAPIError, UnipileClient

if TYPE_CHECKING:
    from services.integrations.linkedin_oauth import LinkedInOAuthService

LOG_PREFIX = "[UnipileReconnectGuardrails]"


def extract_unipile_owner_name(account_data: dict[str, Any]) -> Optional[str]:
    """
    Return owner name from Unipile account payload when present.

    Unipile may return ownership hints under different keys depending on endpoint
    and account type. We only compare when a non-empty string is present.
    """
    for key in ("name", "client_name", "external_id", "reference"):
        value = account_data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def should_enforce_owner_match(owner_value: Optional[str]) -> bool:
    """
    Decide whether an owner value should be treated as strict identity claim.

    Unipile may return human display names (e.g. "Umesh Sharma") in ``name``.
    We enforce mismatch checks only when the value looks like an ALwrity user id.
    """
    if not owner_value:
        return False
    return owner_value.strip().startswith("user_")


async def preflight_reconnect_account_id(
    oauth: "LinkedInOAuthService",
    user_id: str,
    account_id: str,
    *,
    client: Optional[UnipileClient] = None,
    trace_id: Optional[str] = None,
) -> Optional[str]:
    """
    Validate preserved account_id before generating reconnect link.

    Returns account_id when safe to reconnect; otherwise returns None and clears
    stale account mapping where appropriate.
    """
    candidate = account_id.strip()
    if not candidate:
        return None

    unipile_client = client or UnipileClient()
    trace = trace_id or "na"
    try:
        account_data = await unipile_client.get_account(candidate)
    except UnipileAPIError as exc:
        if exc.status_code == 404:
            logger.warning(
                f"{LOG_PREFIX} reconnect preflight missing account; clearing stale mapping "
                f"user_id={user_id} account_id={candidate} trace_id={trace}"
            )
            clear_stale_unipile_account_id(oauth, user_id, account_id=candidate)
            return None
        logger.warning(
            f"{LOG_PREFIX} reconnect preflight failed user_id={user_id} "
            f"account_id={candidate} trace_id={trace} error={exc}; proceeding"
        )
        return candidate
    except Exception as exc:
        logger.warning(
            f"{LOG_PREFIX} reconnect preflight unexpected error user_id={user_id} "
            f"account_id={candidate} trace_id={trace} error={exc}; proceeding"
        )
        return candidate

    owner = extract_unipile_owner_name(account_data if isinstance(account_data, dict) else {})
    if should_enforce_owner_match(owner) and owner != user_id:
        logger.error(
            f"{LOG_PREFIX} reconnect preflight ownership mismatch user_id={user_id} "
            f"account_id={candidate} owner={owner} trace_id={trace}; clearing stale mapping"
        )
        clear_stale_unipile_account_id(oauth, user_id, account_id=candidate)
        return None
    if owner and not should_enforce_owner_match(owner):
        logger.info(
            f"{LOG_PREFIX} reconnect preflight owner is display label; skipping strict match "
            f"user_id={user_id} account_id={candidate} owner={owner} trace_id={trace}"
        )

    status = str((account_data or {}).get("status") or "").strip().upper()
    if status == "DELETED":
        logger.warning(
            f"{LOG_PREFIX} reconnect preflight account is deleted user_id={user_id} "
            f"account_id={candidate} trace_id={trace}; clearing stale mapping"
        )
        clear_stale_unipile_account_id(oauth, user_id, account_id=candidate)
        return None

    logger.info(
        f"{LOG_PREFIX} reconnect preflight ok user_id={user_id} "
        f"account_id={candidate} status={status or 'unknown'} trace_id={trace}"
    )
    return candidate

"""
Unipile webhook routes for Hosted Auth account notifications.

Unipile calls notify_url server-to-server when a user completes Hosted Auth.
This provides a fallback when the browser success redirect fails.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from loguru import logger

from services.integrations.linkedin_oauth import LinkedInOAuthService

router = APIRouter(prefix="/api/unipile", tags=["Unipile"])
_oauth_service = LinkedInOAuthService()

_SUCCESS_STATUSES = frozenset(
    {
        "OK",
        "RUNNING",
        "CONNECTED",
        "CREATION_SUCCESS",
        "SYNC_SUCCESS",
        "SUCCESS",
    }
)


def _extract_webhook_fields(payload: Dict[str, Any]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Parse account_id, ALwrity user id (name), and status from Unipile webhook payloads."""
    account_id = payload.get("account_id") or payload.get("accountId")
    user_id = payload.get("name")
    status = payload.get("status") or payload.get("message")

    account_status = payload.get("AccountStatus")
    if isinstance(account_status, dict):
        account_id = account_id or account_status.get("account_id")
        status = status or account_status.get("message") or account_status.get("status")

    account = payload.get("account")
    if isinstance(account, dict):
        account_id = account_id or account.get("id") or account.get("account_id")
        user_id = user_id or account.get("name")
        status = status or account.get("status")

    return (
        str(account_id) if account_id else None,
        str(user_id) if user_id else None,
        str(status) if status else None,
    )


@router.post("/webhook")
async def handle_unipile_webhook(request: Request) -> Dict[str, bool]:
    """
    Receive Unipile Hosted Auth / account status notifications.

    Unipile requires HTTP 200 within 30 seconds; always return 200 when parsed.
    """
    try:
        payload = await request.json()
    except Exception as exc:
        logger.warning(f"[UnipileWebhook] Invalid JSON body: {exc}")
        return {"ok": True}

    if not isinstance(payload, dict):
        logger.warning("[UnipileWebhook] Payload is not a JSON object")
        return {"ok": True}

    account_id, user_id, status = _extract_webhook_fields(payload)
    logger.info(
        f"[UnipileWebhook] Received notification account_id={account_id} "
        f"user_id={user_id} status={status} keys={list(payload.keys())}"
    )

    if not account_id or not user_id:
        logger.warning(
            "[UnipileWebhook] Missing account_id or name; skipping credential storage"
        )
        return {"ok": True}

    normalized_status = (status or "OK").upper()
    if normalized_status not in _SUCCESS_STATUSES:
        logger.info(
            f"[UnipileWebhook] Non-success status={normalized_status} for user_id={user_id}; "
            "skipping credential storage"
        )
        return {"ok": True}

    stored = await _oauth_service.handle_unipile_callback(
        user_id=user_id,
        account_id=account_id,
        status="success",
    )
    logger.info(
        f"[UnipileWebhook] Credential storage user_id={user_id} "
        f"account_id={account_id} stored={stored}"
    )
    return {"ok": stored}

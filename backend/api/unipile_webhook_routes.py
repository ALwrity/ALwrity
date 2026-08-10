"""
Unipile webhook routes for Hosted Auth and Account Status notifications.

Unipile calls notify_url server-to-server when auth completes or account status changes.
Docs: https://developer.unipile.com/docs/account-lifecycle
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from loguru import logger

from services.integrations.linkedin.unipile_account_lifecycle import (
    UnipileAccountLifecycleService,
    find_user_id_by_unipile_account_id,
)
from services.integrations.linkedin.linkedin_oauth_unipile_status import (
    HEALTHY_UNIPILE_STATUSES,
    is_disconnected_unipile_status,
    normalize_unipile_status,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.database import get_session_for_user

router = APIRouter(prefix="/api/unipile", tags=["Unipile"])
_oauth_service = LinkedInOAuthService()
_lifecycle = UnipileAccountLifecycleService(_oauth_service)


def _webhook_trace_id(payload: Dict[str, Any]) -> str:
    """Build stable trace id for webhook logs."""
    for key in ("event_id", "eventId", "request_id", "requestId", "id"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return uuid.uuid4().hex[:12]


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


async def _create_monitoring_task(user_id: str) -> None:
    """Best-effort OAuth monitoring task; lazy-import keeps lean LinkedIn mounts working."""
    try:
        # Lazy import so Unipile webhook mounts without GSC/Google deps.
        from services.oauth_token_monitoring_service import (
            create_oauth_monitoring_tasks,
        )

        db = get_session_for_user(user_id)
        if db:
            try:
                create_oauth_monitoring_tasks(user_id, db, ["linkedin"])
            finally:
                db.close()
    except Exception as exc:
        logger.warning(f"[UnipileWebhook] Failed to create monitoring task: {exc}")


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

    trace_id = _webhook_trace_id(payload)
    account_id, user_id, status = _extract_webhook_fields(payload)
    normalized_status = normalize_unipile_status(status)

    logger.info(
        f"[UnipileWebhook] Received notification account_id={account_id} "
        f"user_id={user_id} status={normalized_status} trace_id={trace_id} "
        f"keys={list(payload.keys())}"
    )

    if not account_id:
        logger.warning(f"[UnipileWebhook] Missing account_id; skipping trace_id={trace_id}")
        return {"ok": True}

    if not user_id:
        user_id = find_user_id_by_unipile_account_id(account_id)
        if user_id:
            logger.info(
                f"[UnipileWebhook] resolved user from account_id account_id={account_id} "
                f"user_id={user_id} trace_id={trace_id}"
            )
        else:
            logger.warning(
                f"[UnipileWebhook] could not resolve user for account_id={account_id} "
                f"trace_id={trace_id}"
            )

    if user_id and normalized_status:
        await _lifecycle.handle_account_status(
            account_id=account_id,
            status=normalized_status,
            user_id=user_id,
        )

    if is_disconnected_unipile_status(normalized_status):
        return {"ok": True}

    should_store_credentials = (
        user_id
        and (
            normalized_status is None
            or normalized_status in HEALTHY_UNIPILE_STATUSES
            or normalized_status == "RECONNECTED"
        )
    )
    if not should_store_credentials:
        logger.info(
            f"[UnipileWebhook] Skipping credential storage account_id={account_id} "
            f"status={normalized_status} trace_id={trace_id}"
        )
        return {"ok": True}

    stored = await _oauth_service.handle_unipile_callback(
        user_id=user_id,
        account_id=account_id,
        status="success",
        trace_id=trace_id,
    )
    logger.info(
        f"[UnipileWebhook] Credential storage user_id={user_id} "
        f"account_id={account_id} stored={stored} trace_id={trace_id}"
    )

    if stored:
        await _create_monitoring_task(user_id)

    return {"ok": stored}

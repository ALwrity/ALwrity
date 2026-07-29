"""
Scheduled LinkedIn industry cache sync — hybrid autocomplete backend.

Resolves any connected Unipile account and refreshes the global industry cache.
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, Optional

from loguru import logger

from services.database import get_all_user_ids
from services.integrations.linkedin.linkedin_industry_cache_service import (
    cache_file_exists,
    sync_industries_from_unipile,
)
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin_oauth import LinkedInOAuthService

LOG_PREFIX = "[LinkedInIndustrySync]"


def _mask_account_id(account_id: Optional[str]) -> str:
    if not account_id:
        return "none"
    if len(account_id) <= 4:
        return "****"
    return f"{account_id[:4]}...{account_id[-2:]}"


def resolve_sync_user_id(oauth: Optional[LinkedInOAuthService] = None) -> Optional[str]:
    """
    Resolve the user id used to sync industries from Unipile.

    Priority:
    1. LINKEDIN_INDUSTRY_SYNC_USER_ID env override
    2. First user in the system with an active Unipile LinkedIn connection
    """
    explicit = (os.getenv("LINKEDIN_INDUSTRY_SYNC_USER_ID") or "").strip()
    if explicit:
        logger.info("{} using explicit sync user_id={}", LOG_PREFIX, explicit)
        return explicit

    service = oauth or LinkedInOAuthService()
    for user_id in get_all_user_ids():
        try:
            creds = service.resolve_credentials(user_id)
        except LinkedInNotConnectedError:
            continue
        except Exception as exc:
            logger.warning(
                "{} skipped user_id={} while resolving sync account: {}",
                LOG_PREFIX,
                user_id,
                exc,
            )
            continue

        if creds.provider_mode == "unipile" and creds.unipile_account_id:
            logger.info("{} resolved sync user_id={}", LOG_PREFIX, user_id)
            return user_id

    logger.warning("{} no connected Unipile account found for industry sync", LOG_PREFIX)
    return None


async def sync_linkedin_industries_scheduled() -> Dict[str, Any]:
    """Daily cron entry — refresh LinkedIn industry cache from Unipile."""
    started = time.monotonic()
    logger.info("{} scheduled sync starting", LOG_PREFIX)
    user_id = resolve_sync_user_id()
    if not user_id:
        return {"success": False, "item_count": 0, "reason": "no_sync_account"}

    account_id: Optional[str] = None
    try:
        creds = LinkedInOAuthService().resolve_credentials(user_id)
        account_id = creds.unipile_account_id
    except Exception as exc:
        logger.warning(
            "{} could not resolve account_id for user_id={} error_type={}: {}",
            LOG_PREFIX,
            user_id,
            type(exc).__name__,
            exc,
        )

    logger.info(
        "{} sync start user_id={} account_id={} strategy=scheduled",
        LOG_PREFIX,
        user_id,
        _mask_account_id(account_id),
    )

    try:
        item_count = await sync_industries_from_unipile(user_id, account_id=account_id)
    except Exception as exc:
        duration_ms = int((time.monotonic() - started) * 1000)
        logger.error(
            "{} scheduled sync failed user_id={} error_type={} duration_ms={}: {}",
            LOG_PREFIX,
            user_id,
            type(exc).__name__,
            duration_ms,
            exc,
        )
        return {"success": False, "item_count": 0, "reason": str(exc)}

    duration_ms = int((time.monotonic() - started) * 1000)
    success = item_count > 0
    if not success:
        logger.warning(
            "{} scheduled sync finished with zero industries user_id={} duration_ms={}",
            LOG_PREFIX,
            user_id,
            duration_ms,
        )
    else:
        logger.info(
            "{} scheduled sync complete user_id={} item_count={} duration_ms={}",
            LOG_PREFIX,
            user_id,
            item_count,
            duration_ms,
        )

    return {"success": success, "item_count": item_count, "user_id": user_id}


def schedule_bootstrap_sync_if_missing(scheduler: Any) -> None:
    """Queue a one-time sync shortly after startup when cache file is absent."""
    if cache_file_exists():
        return

    from datetime import datetime, timedelta, timezone

    from apscheduler.triggers.date import DateTrigger

    run_at = datetime.now(timezone.utc) + timedelta(seconds=30)
    scheduler.add_job(
        sync_linkedin_industries_scheduled,
        trigger=DateTrigger(run_date=run_at),
        id="linkedin_industry_cache_bootstrap",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    logger.info(
        "{} bootstrap sync scheduled at {} (cache file missing)",
        LOG_PREFIX,
        run_at.isoformat(),
    )


__all__ = [
    "resolve_sync_user_id",
    "schedule_bootstrap_sync_if_missing",
    "sync_linkedin_industries_scheduled",
]

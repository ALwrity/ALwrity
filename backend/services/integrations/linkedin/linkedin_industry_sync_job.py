"""
Scheduled LinkedIn industry cache sync — hybrid autocomplete backend.

Resolves any connected Unipile account and refreshes the global industry cache.
"""

from __future__ import annotations

import os
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
    logger.info("{} scheduled sync starting", LOG_PREFIX)
    user_id = resolve_sync_user_id()
    if not user_id:
        return {"success": False, "item_count": 0, "reason": "no_sync_account"}

    try:
        item_count = await sync_industries_from_unipile(user_id)
    except Exception as exc:
        logger.exception("{} scheduled sync failed user_id={}: {}", LOG_PREFIX, user_id, exc)
        return {"success": False, "item_count": 0, "reason": str(exc)}

    success = item_count > 0
    if not success:
        logger.warning("{} scheduled sync finished with zero industries user_id={}", LOG_PREFIX, user_id)
    else:
        logger.info("{} scheduled sync complete item_count={}", LOG_PREFIX, item_count)

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

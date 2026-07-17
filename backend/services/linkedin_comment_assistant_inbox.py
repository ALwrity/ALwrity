"""
Comment Assistant inbox entrypoint — cache gate (Phase 4) over live Unipile build.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.linkedin_comment_assistant_models import (
    CommentAssistantInboxResponse,
    CommentAssistantPriority,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.linkedin_comment_assistant_cache_service import (
    DEFAULT_TTL_SECONDS,
    LinkedInCommentAssistantCacheService,
    mask_user_id,
)
from services.linkedin_comment_assistant_service import (
    build_comment_assistant_inbox_live,
    filter_groups_by_priority,
)


def _iso_utc(dt: datetime) -> str:
    """Serialize naive UTC datetime to ISO string with Z."""
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt.isoformat() + "Z"


def _with_priority(
    full: CommentAssistantInboxResponse,
    priority: CommentAssistantPriority,
    *,
    last_synced_at: Optional[str],
    from_cache: bool,
) -> CommentAssistantInboxResponse:
    return CommentAssistantInboxResponse(
        groups=filter_groups_by_priority(full.groups, priority),
        priority=priority,
        posts_considered=full.posts_considered,
        older_days=full.older_days,
        counts=full.counts,
        last_synced_at=last_synced_at,
        from_cache=from_cache,
    )


async def get_comment_assistant_inbox(
    user_id: str,
    db: Session,
    *,
    priority: CommentAssistantPriority = "needs_reply",
    refresh: bool = False,
    oauth: Optional[LinkedInOAuthService] = None,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> CommentAssistantInboxResponse:
    """
    Serve inbox from workspace cache when fresh; otherwise live Unipile build.

    ``refresh=True`` (Sync) bypasses TTL and overwrites the cache.
    """
    cache = LinkedInCommentAssistantCacheService(db)

    if not refresh:
        fresh = cache.get_fresh(user_id, ttl_seconds=ttl_seconds)
        if fresh:
            full, synced = fresh
            logger.info(
                "[CommentAssistant] inbox cache_hit user={} priority={} ttl_s={}",
                mask_user_id(user_id),
                priority,
                ttl_seconds,
            )
            return _with_priority(
                full,
                priority,
                last_synced_at=_iso_utc(synced),
                from_cache=True,
            )

    logger.info(
        "[CommentAssistant] inbox cache_miss_or_refresh user={} priority={} refresh={}",
        mask_user_id(user_id),
        priority,
        refresh,
    )
    live = await build_comment_assistant_inbox_live(user_id, db, oauth=oauth)
    synced = cache.store(user_id, live)
    return _with_priority(
        live,
        priority,
        last_synced_at=_iso_utc(synced),
        from_cache=False,
    )

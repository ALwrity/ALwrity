"""
Enrich list-posts items with creator analytics from Unipile retrieve-post.

List ``GET /users/{id}/posts`` often returns top-level counters only.
``GET /posts/{post_id}`` is more likely to include the nested ``analytics`` object
(followers gained, page viewers, engagements, CTR, members reached).
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional, Protocol

from loguru import logger

from services.integrations.linkedin.unipile_client import UnipileAPIError

# Cap concurrent retrieve-post calls to avoid Unipile/LinkedIn rate limits.
_ENRICH_CONCURRENCY = 4
# Cap how many list items we enrich per fetch (newest first).
_ENRICH_MAX_POSTS = 30

_CREATOR_ANALYTICS_KEYS = (
    "followers_gained_from_this_post",
    "followers_gained_from_this_post_counter",
    "engagements",
    "engagements_counter",
    "page_viewers_from_this_post",
    "page_viewers_from_this_post_counter",
    "members_reached",
    "users_reached_counter",
    "members_reached_counter",
    "clicks",
    "clicks_counter",
    "clickthrough_rate",
    "clickthrough_rate_counter",
)


class SupportsGetPost(Protocol):
    async def get_post(self, account_id: str, post_id: str) -> dict[str, Any]: ...


def item_has_creator_analytics(item: dict[str, Any]) -> bool:
    """True when the list item already carries creator analytics fields."""
    analytics = item.get("analytics")
    if not isinstance(analytics, dict) or not analytics:
        return False
    return any(
        key in analytics and analytics[key] is not None
        for key in _CREATOR_ANALYTICS_KEYS
    )


def resolve_retrieve_post_id(item: dict[str, Any]) -> Optional[str]:
    """Pick the best Unipile post id for retrieve-post."""
    for key in ("id", "social_id"):
        value = item.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def merge_post_analytics(
    list_item: dict[str, Any], detail: dict[str, Any]
) -> dict[str, Any]:
    """
    Merge retrieve-post ``analytics`` onto a list-post item.

    Does not invent metrics — only copies provider fields when present.
    """
    detail_analytics = detail.get("analytics")
    if not isinstance(detail_analytics, dict) or not detail_analytics:
        return list_item

    merged = dict(list_item)
    existing = merged.get("analytics")
    base = dict(existing) if isinstance(existing, dict) else {}
    # Detail analytics win for overlapping keys (richer creator payload).
    merged["analytics"] = {**base, **detail_analytics}
    return merged


async def enrich_posts_with_retrieve_analytics(
    client: SupportsGetPost,
    account_id: str,
    items: list[Any],
    *,
    max_posts: int = _ENRICH_MAX_POSTS,
    concurrency: int = _ENRICH_CONCURRENCY,
) -> list[Any]:
    """
    For list items missing creator analytics, call retrieve-post and merge.

    Failures on individual posts are logged and skipped — list data still returns.
    """
    if not items:
        return items

    targets: list[tuple[int, str]] = []
    for index, item in enumerate(items):
        if len(targets) >= max_posts:
            break
        if not isinstance(item, dict):
            continue
        if item_has_creator_analytics(item):
            continue
        post_id = resolve_retrieve_post_id(item)
        if not post_id:
            logger.warning(
                "[PostAnalyticsEnrichment] skip item index={} — no post id",
                index,
            )
            continue
        targets.append((index, post_id))

    if not targets:
        logger.info(
            "[PostAnalyticsEnrichment] no enrichment needed "
            "(list already has creator analytics or empty)"
        )
        return items

    logger.info(
        "[PostAnalyticsEnrichment] enriching {}/{} posts via retrieve-post "
        "account_id={} concurrency={}",
        len(targets),
        len(items),
        account_id,
        concurrency,
    )

    semaphore = asyncio.Semaphore(max(1, concurrency))
    enriched_items = list(items)
    ok = 0
    failed = 0
    with_followers = 0
    with_page_viewers = 0
    with_engagements = 0
    with_reach = 0

    async def _enrich_one(index: int, post_id: str) -> None:
        nonlocal ok, failed, with_followers, with_page_viewers, with_engagements, with_reach
        async with semaphore:
            try:
                detail = await client.get_post(account_id, post_id)
            except UnipileAPIError as exc:
                failed += 1
                logger.warning(
                    "[PostAnalyticsEnrichment] get_post failed post_id={} "
                    "status={} type={}: {}",
                    post_id,
                    exc.status_code,
                    exc.error_type,
                    exc,
                )
                return
            except Exception as exc:
                failed += 1
                logger.warning(
                    "[PostAnalyticsEnrichment] get_post unexpected error post_id={}: {}",
                    post_id,
                    exc,
                )
                return

            current = enriched_items[index]
            if not isinstance(current, dict):
                return
            merged = merge_post_analytics(current, detail)
            enriched_items[index] = merged
            ok += 1
            analytics = merged.get("analytics")
            if isinstance(analytics, dict):
                if (
                    analytics.get("followers_gained_from_this_post") is not None
                    or analytics.get("followers_gained_from_this_post_counter") is not None
                ):
                    with_followers += 1
                if (
                    analytics.get("page_viewers_from_this_post") is not None
                    or analytics.get("page_viewers_from_this_post_counter") is not None
                ):
                    with_page_viewers += 1
                if (
                    analytics.get("engagements") is not None
                    or analytics.get("engagements_counter") is not None
                ):
                    with_engagements += 1
                if (
                    analytics.get("members_reached") is not None
                    or analytics.get("users_reached_counter") is not None
                    or analytics.get("members_reached_counter") is not None
                ):
                    with_reach += 1

    await asyncio.gather(
        *(_enrich_one(index, post_id) for index, post_id in targets)
    )

    logger.info(
        "[PostAnalyticsEnrichment] done ok={} failed={} with_followers={} "
        "with_page_viewers={} with_engagements={} with_reach={}",
        ok,
        failed,
        with_followers,
        with_page_viewers,
        with_engagements,
        with_reach,
    )
    return enriched_items

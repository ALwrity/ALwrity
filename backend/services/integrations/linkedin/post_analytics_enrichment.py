"""
Enrich list-posts items with creator analytics from Unipile retrieve-post.

List ``GET /users/{id}/posts`` often returns partial ``analytics`` (e.g. followers
+ reach) while omitting engagements / page viewers. We re-fetch via
``GET /posts/{post_id}`` using ``social_id`` first (numeric ``id`` often 404s).
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional, Protocol

from loguru import logger

from services.integrations.linkedin.unipile_client import UnipileAPIError

_ENRICH_CONCURRENCY = 4
_ENRICH_MAX_POSTS = 30

_ENGAGEMENTS_KEYS = ("engagements", "engagements_counter")
_PAGE_VIEWERS_KEYS = (
    "page_viewers_from_this_post",
    "page_viewers_from_this_post_counter",
    "profile_viewers_from_this_post",
    "profile_viewers_from_this_post_counter",
)
_FOLLOWERS_KEYS = (
    "followers_gained_from_this_post",
    "followers_gained_from_this_post_counter",
)
_REACH_KEYS = (
    "members_reached",
    "users_reached_counter",
    "members_reached_counter",
)


class SupportsGetPost(Protocol):
    async def get_post(self, account_id: str, post_id: str) -> dict[str, Any]: ...


def _analytics_has_any(analytics: dict[str, Any], keys: tuple[str, ...]) -> bool:
    return any(key in analytics and analytics[key] is not None for key in keys)


def item_needs_analytics_enrichment(item: dict[str, Any]) -> bool:
    """
    True when retrieve-post may still add missing creator fields.

    Partial list analytics (followers/reach only) must still be enriched so
    engagements and page viewers are not skipped forever.
    """
    analytics = item.get("analytics")
    if not isinstance(analytics, dict) or not analytics:
        return True
    has_engagements = _analytics_has_any(analytics, _ENGAGEMENTS_KEYS)
    has_page_viewers = _analytics_has_any(analytics, _PAGE_VIEWERS_KEYS)
    return not (has_engagements and has_page_viewers)


# Backward-compatible alias used by tests / callers
def item_has_creator_analytics(item: dict[str, Any]) -> bool:
    return not item_needs_analytics_enrichment(item)


def resolve_retrieve_post_ids(item: dict[str, Any]) -> list[str]:
    """
    Candidate Unipile post ids for retrieve-post, preferred order.

    ``social_id`` (urn:li:activity:...) is more reliable than bare numeric ``id``,
    which frequently returns 404 from Unipile.
    """
    candidates: list[str] = []
    for key in ("social_id", "id"):
        value = item.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if not text or text in candidates:
            continue
        candidates.append(text)
    return candidates


def resolve_retrieve_post_id(item: dict[str, Any]) -> Optional[str]:
    """Pick the best Unipile post id for retrieve-post."""
    ids = resolve_retrieve_post_ids(item)
    return ids[0] if ids else None


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
    merged["analytics"] = {**base, **detail_analytics}
    return merged


def _count_analytics_presence(analytics: dict[str, Any]) -> tuple[int, int, int, int]:
    return (
        1 if _analytics_has_any(analytics, _FOLLOWERS_KEYS) else 0,
        1 if _analytics_has_any(analytics, _PAGE_VIEWERS_KEYS) else 0,
        1 if _analytics_has_any(analytics, _ENGAGEMENTS_KEYS) else 0,
        1 if _analytics_has_any(analytics, _REACH_KEYS) else 0,
    )


async def enrich_posts_with_retrieve_analytics(
    client: SupportsGetPost,
    account_id: str,
    items: list[Any],
    *,
    max_posts: int = _ENRICH_MAX_POSTS,
    concurrency: int = _ENRICH_CONCURRENCY,
) -> list[Any]:
    """
    For list items missing engagements/page viewers, call retrieve-post and merge.

    Failures on individual posts are logged and skipped — list data still returns.
    """
    if not items:
        return items

    targets: list[tuple[int, list[str]]] = []
    for index, item in enumerate(items):
        if len(targets) >= max_posts:
            break
        if not isinstance(item, dict):
            continue
        if not item_needs_analytics_enrichment(item):
            continue
        post_ids = resolve_retrieve_post_ids(item)
        if not post_ids:
            logger.warning(
                "[PostAnalyticsEnrichment] skip item index={} — no post id",
                index,
            )
            continue
        targets.append((index, post_ids))

    if not targets:
        logger.info(
            "[PostAnalyticsEnrichment] no enrichment needed "
            "(list already has engagements + page viewers, or empty)"
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

    async def _fetch_detail(post_ids: list[str]) -> Optional[dict[str, Any]]:
        last_error: Optional[Exception] = None
        for post_id in post_ids:
            try:
                return await client.get_post(account_id, post_id)
            except UnipileAPIError as exc:
                last_error = exc
                logger.warning(
                    "[PostAnalyticsEnrichment] get_post failed post_id={} "
                    "status={} type={}: {}",
                    post_id,
                    exc.status_code,
                    exc.error_type,
                    exc,
                )
                if exc.status_code != 404:
                    break
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "[PostAnalyticsEnrichment] get_post unexpected error post_id={}: {}",
                    post_id,
                    exc,
                )
                break
        if last_error is not None:
            return None
        return None

    async def _enrich_one(index: int, post_ids: list[str]) -> None:
        nonlocal ok, failed, with_followers, with_page_viewers, with_engagements, with_reach
        async with semaphore:
            detail = await _fetch_detail(post_ids)
            if detail is None:
                failed += 1
                return

            current = enriched_items[index]
            if not isinstance(current, dict):
                return
            merged = merge_post_analytics(current, detail)
            enriched_items[index] = merged
            ok += 1
            analytics = merged.get("analytics")
            if isinstance(analytics, dict):
                f, p, e, r = _count_analytics_presence(analytics)
                with_followers += f
                with_page_viewers += p
                with_engagements += e
                with_reach += r
                logger.info(
                    "[PostAnalyticsEnrichment] merged post index={} "
                    "analytics_keys={}",
                    index,
                    sorted(analytics.keys()),
                )

    await asyncio.gather(
        *(_enrich_one(index, post_ids) for index, post_ids in targets)
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

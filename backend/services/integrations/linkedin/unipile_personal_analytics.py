"""
Build Profile Growth personal analytics from Unipile post metrics.

Reuses PostsService + LinkedInPostAnalyticsService (same path as
/api/linkedin/post-analytics). Sums lifetime metrics for posts published
inside the selected date window — Unipile has no profile-aggregate endpoint.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.linkedin_posts_models import LinkedInPost
from services.integrations.linkedin.analytics_dates import (
    AnalyticsDateRange,
    date_range_to_response,
)
from services.integrations.linkedin.posts_service import PostsService, PostsServiceError
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import (
    UnipileClient,
    personal_profile_provider_id_from_owner,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.linkedin_post_analytics_service import LinkedInPostAnalyticsService

_FETCH_LIMIT = 50


def _post_date(post: LinkedInPost) -> date:
    created = post.created_at
    if created.tzinfo is not None:
        created = created.astimezone(timezone.utc).replace(tzinfo=None)
    return created.date()


def _posts_in_range(
    posts: list[LinkedInPost], date_range: AnalyticsDateRange
) -> list[LinkedInPost]:
    return [
        p
        for p in posts
        if date_range.start <= _post_date(p) < date_range.end_exclusive
    ]


def _engagement_rate(reactions: int, comments: int, reposts: int, clicks: int, impressions: int) -> Optional[float]:
    if impressions <= 0:
        return None
    return round((reactions + comments + reposts + clicks) / impressions, 4)


def _post_engagements_count(eng: Any) -> int:
    """
    Real LinkedIn engagements for a post.

    Prefer Unipile ``engagements`` when stored; otherwise sum reaction/comment/
    repost/click counters (same definition LinkedIn uses).
    """
    if getattr(eng, "engagements", None) is not None:
        return max(0, int(eng.engagements or 0))
    return max(
        0,
        (eng.reactions or 0)
        + (eng.comments or 0)
        + (eng.reposts or 0)
        + (eng.clicks or 0),
    )


def _sum_page_viewers(posts: list[LinkedInPost]) -> Optional[int]:
    """Sum Unipile page viewers across posts; None when provider omitted on all."""
    total = 0
    known = False
    for post in posts:
        value = post.engagement.page_viewers
        if value is not None:
            known = True
            total += max(0, int(value))
    return total if known else None


def _aggregate(posts: list[LinkedInPost]) -> dict[str, Any]:
    """Sum widget metrics for Profile Growth. Always include engagements."""
    impressions = reactions = comments = shares = clicks = followers = 0
    engagements_total = 0
    reach_total = 0
    reach_known = False
    ctr_weighted_num = 0.0
    ctr_weighted_den = 0

    for post in posts:
        eng = post.engagement
        impressions += eng.impressions or 0
        reactions += eng.reactions or 0
        comments += eng.comments or 0
        shares += eng.reposts or 0
        clicks += eng.clicks or 0
        followers += eng.followers_gained or 0
        engagements_total += _post_engagements_count(eng)
        if eng.reach is not None:
            reach_known = True
            reach_total += eng.reach
        if eng.clickthrough_rate is not None and (eng.impressions or 0) > 0:
            ctr_weighted_num += eng.clickthrough_rate * eng.impressions
            ctr_weighted_den += eng.impressions

    page_viewers_total = _sum_page_viewers(posts)

    analytics: dict[str, Any] = {
        "impressions": impressions,
        "reactions": reactions,
        "shares": shares,
        "followers_gained": followers,
        "clicks": clicks,
        "engagements": engagements_total,
        "engagementRate": _engagement_rate(
            reactions, comments, shares, clicks, impressions
        ),
    }
    if reach_known:
        analytics["reach"] = reach_total
    if page_viewers_total is not None:
        analytics["page_viewers"] = page_viewers_total
    if ctr_weighted_den > 0:
        analytics["clickthroughRate"] = round(ctr_weighted_num / ctr_weighted_den, 4)
    elif impressions > 0:
        analytics["clickthroughRate"] = round(clicks / impressions, 4)

    logger.info(
        "[UnipilePersonalAnalytics] aggregate posts={} impressions={} "
        "engagements={} page_viewers={} reach={} followers={}",
        len(posts),
        impressions,
        engagements_total,
        analytics.get("page_viewers"),
        analytics.get("reach"),
        followers,
    )
    return analytics


async def _resolve_account_and_identifier(
    user_id: str, oauth: LinkedInOAuthService
) -> tuple[str, str]:
    creds = oauth.resolve_credentials(user_id)
    account_id = creds.unipile_account_id or creds.primary_account_id
    if not account_id:
        raise LinkedInNotConnectedError(
            "Personal LinkedIn account not connected. Connect your LinkedIn profile first."
        )

    client = UnipileClient()
    profile = await client.get_own_profile(account_id)
    identifier = personal_profile_provider_id_from_owner(profile) if isinstance(profile, dict) else None
    if not identifier:
        raise LinkedInNotConnectedError(
            "LinkedIn personal profile provider id not found. Try reconnecting LinkedIn."
        )
    return account_id, identifier


_CREATOR_ANALYTICS_RETRY_MINUTES = 5


def _creator_analytics_incomplete(posts: list[LinkedInPost]) -> bool:
    """
    True when cached posts lack Unipile creator analytics.

    Engagements are derived from reaction/comment/repost/click counters when
    Unipile omits them, so incompleteness focuses on provider-only fields
    (followers, reach, page viewers, clicks, CTR).
    """
    if not posts:
        return True
    for post in posts[:30]:
        eng = post.engagement
        if (
            eng.page_viewers is not None
            or eng.reach is not None
            or (eng.followers_gained or 0) > 0
            or (eng.clicks or 0) > 0
            or eng.clickthrough_rate is not None
        ):
            return False
    return True


def _should_refresh_posts(
    analytics_service: LinkedInPostAnalyticsService,
    user_id: str,
    cached_posts: list[LinkedInPost],
) -> bool:
    """Refresh when empty, or when creator analytics are missing and last sync is stale."""
    stored_count = analytics_service.count_stored(user_id)
    if stored_count == 0:
        return True
    if not _creator_analytics_incomplete(cached_posts):
        return False

    last_synced = analytics_service.get_last_synced_at(user_id)
    if last_synced is None:
        return True

    synced = last_synced
    if synced.tzinfo is not None:
        synced = synced.astimezone(timezone.utc).replace(tzinfo=None)
    age_minutes = (datetime.utcnow() - synced).total_seconds() / 60.0
    if age_minutes < _CREATOR_ANALYTICS_RETRY_MINUTES:
        logger.info(
            "[UnipilePersonalAnalytics] skip enrich retry user_id={} "
            "age_minutes={:.1f} (wait {}m)",
            user_id,
            age_minutes,
            _CREATOR_ANALYTICS_RETRY_MINUTES,
        )
        return False
    return True


async def build_personal_analytics_payload(
    user_id: str,
    date_range: AnalyticsDateRange,
    *,
    db: Session,
    posts_service: PostsService,
    oauth_service: Optional[LinkedInOAuthService] = None,
) -> dict[str, Any]:
    """
    Build LinkedInPersonalAnalyticsResponse-compatible payload.

    Uses cached post analytics when present; refreshes from Unipile via the same
    PostsService.fetch_user_posts + store_posts path when empty or when creator
    analytics were never stored (list-posts omit nested analytics).
    """
    oauth = oauth_service or LinkedInOAuthService()
    analytics_service = LinkedInPostAnalyticsService(db)

    logger.info(
        "[UnipilePersonalAnalytics] build start user_id={} range={}..{}",
        user_id,
        date_range.start_iso,
        date_range.end_exclusive_iso,
    )

    creds = oauth.resolve_credentials(user_id)
    account_id = creds.unipile_account_id or creds.primary_account_id or ""

    posts: list[LinkedInPost] = []
    stored_count = analytics_service.count_stored(user_id)
    cached_posts = (
        analytics_service.get_stored_analytics(user_id).posts if stored_count > 0 else []
    )
    needs_refresh = _should_refresh_posts(analytics_service, user_id, cached_posts)

    if needs_refresh:
        logger.info(
            "[UnipilePersonalAnalytics] refreshing via PostsService user_id={} "
            "stored={} creator_incomplete={}",
            user_id,
            stored_count,
            _creator_analytics_incomplete(cached_posts) if cached_posts else True,
        )
        resolved_account, identifier = await _resolve_account_and_identifier(user_id, oauth)
        account_id = resolved_account
        try:
            result = await posts_service.fetch_user_posts(
                account_id=account_id,
                identifier=identifier,
                limit=_FETCH_LIMIT,
                enrich_analytics=True,
            )
        except PostsServiceError as exc:
            logger.warning(
                "[UnipilePersonalAnalytics] Unipile fetch failed user_id={}: {}",
                user_id,
                exc,
            )
            raise
        analytics_service.store_posts(user_id, result.posts)
        posts = result.posts
    else:
        posts = cached_posts

    in_range = _posts_in_range(posts, date_range)
    avatar_url = None
    for post in in_range or posts:
        if post.author and post.author.avatar_url:
            avatar_url = post.author.avatar_url
            break

    personal_error: Optional[str] = None
    if not posts:
        personal_error = "No LinkedIn posts are available yet. Open Post Analytics to sync, then try again."
        analytics: dict[str, Any] = {}
    elif not in_range:
        personal_error = "No posts published in this date range."
        # Still surface page viewers from all synced posts so Profile Growth
        # matches the Post engagement chip when the window filter is empty.
        analytics = {}
        page_viewers_all = _sum_page_viewers(posts)
        if page_viewers_all is not None:
            analytics["page_viewers"] = page_viewers_all
    else:
        analytics = _aggregate(in_range)
        # If date-window posts lack page_viewers but other synced posts have
        # them (Post engagement chip), include that real total for Profile Growth.
        if analytics.get("page_viewers") is None:
            page_viewers_all = _sum_page_viewers(posts)
            if page_viewers_all is not None:
                analytics["page_viewers"] = page_viewers_all
                logger.info(
                    "[UnipilePersonalAnalytics] page_viewers filled from all "
                    "stored posts={} total={}",
                    len(posts),
                    page_viewers_all,
                )

    logger.info(
        "[UnipilePersonalAnalytics] build done user_id={} stored={} in_range={} "
        "impressions={} followers_gained={} engagements={} page_viewers={} reach={}",
        user_id,
        len(posts),
        len(in_range),
        analytics.get("impressions"),
        analytics.get("followers_gained"),
        analytics.get("engagements"),
        analytics.get("page_viewers"),
        analytics.get("reach"),
    )

    return {
        "dateRange": date_range_to_response(date_range),
        "personal": {
            "accountId": account_id,
            "avatarUrl": avatar_url,
            "analytics": analytics,
            "error": personal_error,
        },
        "provider": "unipile",
    }

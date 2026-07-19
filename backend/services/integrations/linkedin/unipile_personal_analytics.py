"""
Build Profile Growth personal analytics from Unipile post metrics.

Reuses PostsService + LinkedInPostAnalyticsService (same path as
/api/linkedin/post-analytics). Sums lifetime metrics for posts published
inside the selected date window — Unipile has no profile-aggregate endpoint.
"""

from __future__ import annotations

from datetime import date, timezone
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


def _aggregate(posts: list[LinkedInPost]) -> dict[str, Any]:
    """Sum widget metrics. Omit reach when Unipile did not provide it on any post."""
    impressions = reactions = comments = shares = clicks = followers = 0
    reach_total = 0
    reach_known = False

    for post in posts:
        eng = post.engagement
        impressions += eng.impressions or 0
        reactions += eng.reactions or 0
        comments += eng.comments or 0
        shares += eng.reposts or 0
        clicks += eng.clicks or 0
        followers += eng.followers_gained or 0
        if eng.reach is not None:
            reach_known = True
            reach_total += eng.reach

    analytics: dict[str, Any] = {
        "impressions": impressions,
        "reactions": reactions,
        "shares": shares,
        "followers_gained": followers,
        "engagementRate": _engagement_rate(
            reactions, comments, shares, clicks, impressions
        ),
    }
    if reach_known:
        analytics["reach"] = reach_total
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
    PostsService.fetch_user_posts + store_posts path as post-analytics when empty.
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
    if analytics_service.count_stored(user_id) == 0:
        logger.info(
            "[UnipilePersonalAnalytics] cache empty; refreshing via PostsService user_id={}",
            user_id,
        )
        resolved_account, identifier = await _resolve_account_and_identifier(user_id, oauth)
        account_id = resolved_account
        try:
            result = await posts_service.fetch_user_posts(
                account_id=account_id,
                identifier=identifier,
                limit=_FETCH_LIMIT,
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
        posts = analytics_service.get_stored_analytics(user_id).posts

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
        analytics = {}
    else:
        analytics = _aggregate(in_range)

    logger.info(
        "[UnipilePersonalAnalytics] build done user_id={} stored={} in_range={} "
        "impressions={}",
        user_id,
        len(posts),
        len(in_range),
        analytics.get("impressions"),
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

"""
Engagement field helpers for LinkedIn post analytics persistence.

Keeps ORM read/write of Unipile analytics metrics out of the large
LinkedInPostAnalyticsService module.
"""

from __future__ import annotations

from typing import Optional

from models.linkedin_post_analytics_model import LinkedInPostAnalytics
from models.linkedin_posts_models import PostEngagementMetrics


def engagement_from_row(row: LinkedInPostAnalytics) -> PostEngagementMetrics:
    """Build PostEngagementMetrics from a persisted analytics row."""
    return PostEngagementMetrics(
        reactions=row.reactions or 0,
        comments=row.comments or 0,
        reposts=row.reposts or 0,
        impressions=row.impressions or 0,
        clicks=row.clicks or 0,
        followers_gained=row.followers_gained or 0,
        engagement_rate=row.engagement_rate or 0.0,
        engagements=row.engagements,
        clickthrough_rate=row.clickthrough_rate,
        page_viewers=row.page_viewers,
        reach=row.members_reached,
    )


def apply_engagement_to_row(
    row: LinkedInPostAnalytics, eng: PostEngagementMetrics
) -> None:
    """Copy engagement metrics onto an existing analytics row."""
    row.reactions = eng.reactions
    row.comments = eng.comments
    row.reposts = eng.reposts
    row.impressions = eng.impressions
    row.clicks = eng.clicks
    row.followers_gained = eng.followers_gained
    row.engagement_rate = eng.engagement_rate
    row.engagements = eng.engagements
    row.clickthrough_rate = eng.clickthrough_rate
    row.page_viewers = eng.page_viewers
    row.members_reached = eng.reach


def engagement_kwargs_for_insert(eng: PostEngagementMetrics) -> dict:
    """Keyword args for LinkedInPostAnalytics(...) construction."""
    return {
        "reactions": eng.reactions,
        "comments": eng.comments,
        "reposts": eng.reposts,
        "impressions": eng.impressions,
        "clicks": eng.clicks,
        "followers_gained": eng.followers_gained,
        "engagement_rate": eng.engagement_rate,
        "engagements": eng.engagements,
        "clickthrough_rate": eng.clickthrough_rate,
        "page_viewers": eng.page_viewers,
        "members_reached": eng.reach,
    }


def engagement_metrics_unchanged(
    row: LinkedInPostAnalytics, eng: PostEngagementMetrics
) -> bool:
    """True when stored metrics match the incoming engagement payload."""
    return (
        row.reactions == eng.reactions
        and row.comments == eng.comments
        and row.reposts == eng.reposts
        and row.impressions == eng.impressions
        and row.clicks == eng.clicks
        and row.followers_gained == eng.followers_gained
        and abs((row.engagement_rate or 0.0) - (eng.engagement_rate or 0.0)) < 1e-9
        and row.engagements == eng.engagements
        and _float_eq(row.clickthrough_rate, eng.clickthrough_rate)
        and row.page_viewers == eng.page_viewers
        and row.members_reached == eng.reach
    )


def _float_eq(a: Optional[float], b: Optional[float]) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return abs(a - b) < 1e-9

"""Mappers for LinkedIn post analytics DB rows → API models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from models.linkedin_post_analytics_model import LinkedInPostAnalytics
from models.linkedin_posts_models import LinkedInPost, PostAuthor, PostEngagementMetrics


def utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Serialize a naive UTC datetime as an ISO-8601 string with Z suffix."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat() + "Z"


def as_naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def row_to_linkedin_post(row: LinkedInPostAnalytics) -> LinkedInPost:
    """Convert a DB row to a Pydantic LinkedInPost for external consumption."""
    return LinkedInPost(
        id=row.post_id,
        social_id=row.social_id,
        text=row.text or "",
        title=row.title,
        created_at=row.created_at or datetime.utcnow(),
        engagement=PostEngagementMetrics(
            reactions=row.reactions or 0,
            comments=row.comments or 0,
            reposts=row.reposts or 0,
            impressions=row.impressions or 0,
            clicks=row.clicks or 0,
            followers_gained=row.followers_gained or 0,
            engagement_rate=row.engagement_rate or 0.0,
        ),
        author=PostAuthor(
            name=row.author_name or "Unknown",
            avatar_url=row.author_avatar_url,
            headline=row.author_headline,
            public_identifier=row.author_public_identifier,
        ),
        share_url=row.share_url,
        is_repost=row.is_repost or False,
        is_company_post=row.is_company_post or False,
    )

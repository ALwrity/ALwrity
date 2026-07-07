"""LinkedIn Post Analytics Service — DB persistence for fetched post metrics."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from loguru import logger
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.linkedin_post_analytics_model import LinkedInPostAnalytics
from models.linkedin_posts_models import (
    LinkedInPost,
    PostListResponse,
    PostAnalyticsHistoryResponse,
    EngagementSummary,
    MetricDelta,
    PostDelta,
)
from models.post_analytics_snapshot_model import PostAnalyticsSnapshot


class LinkedInPostAnalyticsService:
    """CRUD + sync service for LinkedIn post analytics in the workspace DB."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Query ──────────────────────────────────────────────────────────────

    def get_stored_analytics(self, user_id: str) -> PostListResponse:
        """Return all persisted analytics rows for *user_id* as a PostListResponse."""
        rows: list[LinkedInPostAnalytics] = (
            self.db.query(LinkedInPostAnalytics)
            .filter(LinkedInPostAnalytics.user_id == user_id)
            .order_by(LinkedInPostAnalytics.created_at.desc())
            .all()
        )
        posts = [_row_to_linkedin_post(r) for r in rows]
        return PostListResponse(
            posts=posts,
            cursor=None,
            has_more=False,
            total_count=len(posts),
        )

    def get_last_synced_at(self, user_id: str) -> Optional[datetime]:
        """When the most recent sync occurred for this user."""
        row: Optional[LinkedInPostAnalytics] = (
            self.db.query(LinkedInPostAnalytics)
            .filter(LinkedInPostAnalytics.user_id == user_id)
            .order_by(LinkedInPostAnalytics.last_synced_at.desc())
            .first()
        )
        return row.last_synced_at if row else None

    def count_stored(self, user_id: str) -> int:
        """Number of analytics rows persisted for this user."""
        return (
            self.db.query(func.count(LinkedInPostAnalytics.id))
            .filter(LinkedInPostAnalytics.user_id == user_id)
            .scalar()
            or 0
        )

    # ── Persist ────────────────────────────────────────────────────────────

    def store_posts(self, user_id: str, posts: list[LinkedInPost]) -> int:
        """Upsert a batch of LinkedInPost models into the analytics table.

        Returns the number of rows upserted (inserted + updated).
        """
        now = datetime.utcnow()
        upserted = 0

        for post in posts:
            existing: Optional[LinkedInPostAnalytics] = (
                self.db.query(LinkedInPostAnalytics)
                .filter(
                    LinkedInPostAnalytics.user_id == user_id,
                    LinkedInPostAnalytics.post_id == post.id,
                )
                .first()
            )

            if existing:
                self._update_row(existing, post, now)
            else:
                self._insert_row(user_id, post, now)
            upserted += 1

        self.db.commit()
        logger.info(
            f"[PostAnalyticsService] Stored {upserted} analytics rows for user={user_id}"
        )
        return upserted

    # ── Engagement Trends (time-series) ────────────────────────────────────

    def get_engagement_trends(self, user_id: str) -> PostAnalyticsHistoryResponse:
        """Compare the latest two snapshot epochs and return deltas."""
        # 1. Find the two most recent distinct snapshot timestamps
        epochs = (
            self.db.query(PostAnalyticsSnapshot.snapshot_at)
            .filter(PostAnalyticsSnapshot.user_id == user_id)
            .distinct()
            .order_by(PostAnalyticsSnapshot.snapshot_at.desc())
            .limit(2)
            .all()
        )
        if len(epochs) < 2:
            now = datetime.utcnow()
            return PostAnalyticsHistoryResponse(
                period={"from": now, "to": now},
                summary=EngagementSummary(
                    total_posts=0,
                    reactions=MetricDelta(before=0, now=0, delta=0, pct_change=0.0),
                    comments=MetricDelta(before=0, now=0, delta=0, pct_change=0.0),
                    impressions=MetricDelta(before=0, now=0, delta=0, pct_change=0.0),
                    avg_engagement_rate_before=0.0,
                    avg_engagement_rate_now=0.0,
                ),
                top_gainers=[],
                top_decliners=[],
            )

        t1, t2 = epochs[0][0], epochs[1][0]  # t1 = latest, t2 = previous
        # Ensure t1 is the later timestamp
        if t1 < t2:
            t1, t2 = t2, t1

        # 2. Fetch snapshots for both epochs, keyed by post_id
        latest_rows = (
            self.db.query(PostAnalyticsSnapshot)
            .filter(
                PostAnalyticsSnapshot.user_id == user_id,
                PostAnalyticsSnapshot.snapshot_at == t1,
            )
            .all()
        )
        prev_rows = (
            self.db.query(PostAnalyticsSnapshot)
            .filter(
                PostAnalyticsSnapshot.user_id == user_id,
                PostAnalyticsSnapshot.snapshot_at == t2,
            )
            .all()
        )

        latest_map: dict[str, PostAnalyticsSnapshot] = {r.post_id: r for r in latest_rows}
        prev_map: dict[str, PostAnalyticsSnapshot] = {r.post_id: r for r in prev_rows}
        all_post_ids = set(latest_map.keys()) | set(prev_map.keys())

        # 3. Compute per-post deltas (only for posts in both epochs)
        deltas: list[PostDelta] = []
        for pid in all_post_ids:
            latest = latest_map.get(pid)
            prev = prev_map.get(pid)
            if not latest or not prev:
                continue
            deltas.append(PostDelta(
                post_id=pid,
                text="",
                author_name="",
                share_url=None,
                reactions_delta=latest.reactions - prev.reactions,
                comments_delta=latest.comments - prev.comments,
                impressions_delta=latest.impressions - prev.impressions,
                engagement_rate_now=latest.engagement_rate or 0.0,
                engagement_rate_before=prev.engagement_rate or 0.0,
            ))

        # 4. Enrich with post text/author from main analytics table
        if deltas:
            pid_list = [d.post_id for d in deltas]
            post_rows = (
                self.db.query(LinkedInPostAnalytics)
                .filter(
                    LinkedInPostAnalytics.user_id == user_id,
                    LinkedInPostAnalytics.post_id.in_(pid_list),
                )
                .all()
            )
            post_map = {r.post_id: r for r in post_rows}
            for d in deltas:
                row = post_map.get(d.post_id)
                if row:
                    d.text = (row.text or "")[:200]
                    d.author_name = row.author_name or ""
                    d.share_url = row.share_url

        # 5. Aggregate summary stats (O(n) via dict lookups)
        total = len(deltas)
        if total > 0:
            sum_reactions_before = sum((prev_map.get(d.post_id).reactions or 0) for d in deltas)
            sum_reactions_now = sum((latest_map.get(d.post_id).reactions or 0) for d in deltas)
            sum_comments_before = sum((prev_map.get(d.post_id).comments or 0) for d in deltas)
            sum_comments_now = sum((latest_map.get(d.post_id).comments or 0) for d in deltas)
            sum_impressions_before = sum((prev_map.get(d.post_id).impressions or 0) for d in deltas)
            sum_impressions_now = sum((latest_map.get(d.post_id).impressions or 0) for d in deltas)
            avg_er_before = sum(d.engagement_rate_before for d in deltas) / total
            avg_er_now = sum(d.engagement_rate_now for d in deltas) / total
        else:
            sum_reactions_before = sum_reactions_now = 0
            sum_comments_before = sum_comments_now = 0
            sum_impressions_before = sum_impressions_now = 0
            avg_er_before = avg_er_now = 0.0

        def _pct(b: int, n: int) -> float:
            if b == 0:
                return 0.0
            return round((n - b) / b * 100, 1)

        summary = EngagementSummary(
            total_posts=total,
            reactions=MetricDelta(
                before=sum_reactions_before,
                now=sum_reactions_now,
                delta=sum_reactions_now - sum_reactions_before,
                pct_change=_pct(sum_reactions_before, sum_reactions_now),
            ),
            comments=MetricDelta(
                before=sum_comments_before,
                now=sum_comments_now,
                delta=sum_comments_now - sum_comments_before,
                pct_change=_pct(sum_comments_before, sum_comments_now),
            ),
            impressions=MetricDelta(
                before=sum_impressions_before,
                now=sum_impressions_now,
                delta=sum_impressions_now - sum_impressions_before,
                pct_change=_pct(sum_impressions_before, sum_impressions_now),
            ),
            avg_engagement_rate_before=round(avg_er_before, 4),
            avg_engagement_rate_now=round(avg_er_now, 4),
        )

        # 6. Sort by total delta magnitude → gainers / decliners
        def _sort_key(d: PostDelta) -> int:
            return d.reactions_delta + d.comments_delta + d.impressions_delta

        sorted_deltas = sorted(deltas, key=_sort_key, reverse=True)
        top_gainers = [d for d in sorted_deltas if _sort_key(d) > 0][:limit]
        top_decliners = [d for d in reversed(sorted_deltas) if _sort_key(d) < 0][:limit]

        return PostAnalyticsHistoryResponse(
            period={"from": t2.isoformat(), "to": t1.isoformat()},
            summary=summary,
            top_gainers=top_gainers,
            top_decliners=top_decliners,
        )

    # ── Internal helpers ───────────────────────────────────────────────────

    def _snapshot_if_changed(
        self, row: LinkedInPostAnalytics, post: LinkedInPost, now: datetime
    ) -> None:
        """Snapshot old values if any metric changed vs the incoming post."""
        eng = post.engagement
        if (row.reactions == eng.reactions and
                row.comments == eng.comments and
                row.reposts == eng.reposts and
                row.impressions == eng.impressions and
                row.clicks == eng.clicks and
                row.followers_gained == eng.followers_gained and
                abs((row.engagement_rate or 0.0) - (eng.engagement_rate or 0.0)) < 1e-9):
            return
        snapshot = PostAnalyticsSnapshot(
            user_id=row.user_id,
            post_id=row.post_id,
            snapshot_at=now,
            reactions=row.reactions or 0,
            comments=row.comments or 0,
            reposts=row.reposts or 0,
            impressions=row.impressions or 0,
            clicks=row.clicks or 0,
            followers_gained=row.followers_gained or 0,
            engagement_rate=row.engagement_rate or 0.0,
        )
        self.db.add(snapshot)

    def _update_row(
        self, row: LinkedInPostAnalytics, post: LinkedInPost, now: datetime
    ) -> None:
        self._snapshot_if_changed(row, post, now)
        row.text = post.text
        row.title = post.title
        row.created_at = post.created_at
        row.reactions = post.engagement.reactions
        row.comments = post.engagement.comments
        row.reposts = post.engagement.reposts
        row.impressions = post.engagement.impressions
        row.clicks = post.engagement.clicks
        row.followers_gained = post.engagement.followers_gained
        row.engagement_rate = post.engagement.engagement_rate
        row.author_name = post.author.name
        row.author_headline = post.author.headline
        row.author_public_identifier = post.author.public_identifier
        row.author_avatar_url = post.author.avatar_url
        row.share_url = post.share_url
        row.is_repost = post.is_repost
        row.is_company_post = post.is_company_post
        row.last_synced_at = now

    def _insert_row(
        self, user_id: str, post: LinkedInPost, now: datetime
    ) -> LinkedInPostAnalytics:
        row = LinkedInPostAnalytics(
            user_id=user_id,
            post_id=post.id,
            social_id=post.social_id,
            text=post.text,
            title=post.title,
            created_at=post.created_at,
            reactions=post.engagement.reactions,
            comments=post.engagement.comments,
            reposts=post.engagement.reposts,
            impressions=post.engagement.impressions,
            clicks=post.engagement.clicks,
            followers_gained=post.engagement.followers_gained,
            engagement_rate=post.engagement.engagement_rate,
            author_name=post.author.name,
            author_headline=post.author.headline,
            author_public_identifier=post.author.public_identifier,
            author_avatar_url=post.author.avatar_url,
            share_url=post.share_url,
            is_repost=post.is_repost,
            is_company_post=post.is_company_post,
            last_synced_at=now,
            stored_at=now,
        )
        self.db.add(row)
        return row

    def clear_user_analytics(self, user_id: str) -> int:
        """Remove all analytics rows for *user_id*. Returns count deleted."""
        deleted = (
            self.db.query(LinkedInPostAnalytics)
            .filter(LinkedInPostAnalytics.user_id == user_id)
            .delete(synchronize_session="fetch")
        )
        self.db.commit()
        logger.info(
            f"[PostAnalyticsService] Cleared {deleted} analytics rows for user={user_id}"
        )
        return deleted


# ── Helpers ────────────────────────────────────────────────────────────────


def _row_to_linkedin_post(row: LinkedInPostAnalytics) -> LinkedInPost:
    """Convert a DB row to a Pydantic LinkedInPost for external consumption."""
    from models.linkedin_posts_models import PostAuthor, PostEngagementMetrics

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

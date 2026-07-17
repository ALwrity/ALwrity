"""LinkedIn Post Analytics Service — DB persistence for fetched post metrics."""

from __future__ import annotations

from datetime import datetime, timezone
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
from services.engagement_growth_contribution import (
    attach_growth_contributions,
    post_growth_score_from_delta,
)
from services.engagement_trends_period import (
    RECOMMENDED_SYNC_COOLDOWN_SECONDS,
    mask_user_id_for_log,
    metric_delta,
    normalize_period_key,
    select_baseline_epoch,
)
from services.linkedin_post_analytics_mappers import (
    as_naive_utc,
    row_to_linkedin_post,
    utc_iso,
)

TOP_TREND_POSTS_LIMIT = 5


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
        posts = [row_to_linkedin_post(r) for r in rows]
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
        """Upsert posts; write initial + daily-anchor snapshots for Trends windows."""
        now = datetime.utcnow()
        inserted = updated = change_snaps = daily_anchors = flat_skips = 0
        safe_uid = mask_user_id_for_log(user_id)
        logger.info(
            "[PostAnalyticsService] Sync start user={} posts={}",
            safe_uid,
            len(posts),
        )

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
                snap_kind = self._update_row(existing, post, now)
                updated += 1
                if snap_kind == "change":
                    change_snaps += 1
                elif snap_kind == "anchor":
                    daily_anchors += 1
                else:
                    flat_skips += 1
            else:
                self._insert_row(user_id, post, now)
                inserted += 1

        self.db.commit()
        logger.info(
            "[PostAnalyticsService] Sync done user={} inserted={} updated={} "
            "change_snapshots={} daily_anchors={} unchanged_no_snapshot={} total={}",
            safe_uid,
            inserted,
            updated,
            change_snaps,
            daily_anchors,
            flat_skips,
            inserted + updated,
        )
        return inserted + updated

    # ── Engagement Trends (period windows) ─────────────────────────────────

    def get_engagement_trends(
        self,
        user_id: str,
        period: str = "since_joining",
    ) -> PostAnalyticsHistoryResponse:
        """Compare current metrics vs a period baseline (not last two syncs)."""
        period_key = normalize_period_key(period)
        safe_uid = mask_user_id_for_log(user_id)
        now = datetime.utcnow()
        last_synced = self.get_last_synced_at(user_id)
        now_ts = as_naive_utc(last_synced) if last_synced else now
        logger.info(
            "[PostAnalyticsService] Trends start user={} period={}",
            safe_uid,
            period_key,
        )

        epochs = [
            as_naive_utc(row[0])
            for row in (
                self.db.query(PostAnalyticsSnapshot.snapshot_at)
                .filter(PostAnalyticsSnapshot.user_id == user_id)
                .distinct()
                .all()
            )
            if row[0] is not None
        ]

        baseline_at, baseline_reason = select_baseline_epoch(epochs, now_ts, period_key)
        if baseline_at is None:
            logger.info(
                "[PostAnalyticsService] Trends empty user={} period={} "
                "reason={} epochs={}",
                safe_uid,
                period_key,
                baseline_reason,
                len(epochs),
            )
            return self._empty_trends(
                user_id=user_id,
                period_key=period_key,
                baseline_reason=baseline_reason,
                now_ts=now_ts,
            )

        current_rows = (
            self.db.query(LinkedInPostAnalytics)
            .filter(LinkedInPostAnalytics.user_id == user_id)
            .all()
        )
        if not current_rows:
            logger.info(
                "[PostAnalyticsService] Trends empty user={} period={} reason=no_current_posts",
                safe_uid,
                period_key,
            )
            return self._empty_trends(
                user_id=user_id,
                period_key=period_key,
                baseline_reason="no_current_posts",
                now_ts=now_ts,
            )

        baseline_rows = (
            self.db.query(PostAnalyticsSnapshot)
            .filter(
                PostAnalyticsSnapshot.user_id == user_id,
                PostAnalyticsSnapshot.snapshot_at == baseline_at,
            )
            .all()
        )
        prev_map: dict[str, PostAnalyticsSnapshot] = {r.post_id: r for r in baseline_rows}
        if not prev_map:
            prev_map = self._nearest_snapshots_at_or_before(user_id, baseline_at)

        now_map = {r.post_id: r for r in current_rows}
        skipped = 0
        deltas: list[PostDelta] = []
        for pid, current in now_map.items():
            prev = prev_map.get(pid)
            if not prev:
                skipped += 1
                continue
            deltas.append(
                PostDelta(
                    post_id=pid,
                    social_id=current.social_id,
                    text=(current.text or "")[:200],
                    author_name=current.author_name or "",
                    share_url=current.share_url,
                    reactions_delta=(current.reactions or 0) - (prev.reactions or 0),
                    comments_delta=(current.comments or 0) - (prev.comments or 0),
                    impressions_delta=(current.impressions or 0) - (prev.impressions or 0),
                    followers_delta=(current.followers_gained or 0) - (prev.followers_gained or 0),
                    clicks_delta=(current.clicks or 0) - (prev.clicks or 0),
                    reposts_delta=(current.reposts or 0) - (prev.reposts or 0),
                    engagement_rate_now=current.engagement_rate or 0.0,
                    engagement_rate_before=prev.engagement_rate or 0.0,
                    impressions_now=current.impressions or 0,
                    reactions_now=current.reactions or 0,
                )
            )

        summary = self._build_summary(deltas, prev_map, now_map)
        rising = sorted(
            [d for d in deltas if post_growth_score_from_delta(d) > 0],
            key=post_growth_score_from_delta,
            reverse=True,
        )[:TOP_TREND_POSTS_LIMIT]
        falling = sorted(
            [d for d in deltas if post_growth_score_from_delta(d) < 0],
            key=post_growth_score_from_delta,
        )[:TOP_TREND_POSTS_LIMIT]
        rising = attach_growth_contributions(rising, deltas)

        top_posts = sorted(
            deltas,
            key=lambda d: (d.impressions_now, d.reactions_now),
            reverse=True,
        )[:TOP_TREND_POSTS_LIMIT]

        gap_hours = round((now_ts - baseline_at).total_seconds() / 3600, 1)
        outcome = (
            "no_changes"
            if summary.total_posts > 0 and not rising and not falling
            else "ok"
        )
        logger.info(
            "[PostAnalyticsService] Trends done user={} period={} baseline={} "
            "reason={} gap_hours={} current={} comparable={} skipped={} "
            "rising={} falling={} top={} outcome={}",
            safe_uid,
            period_key,
            baseline_at,
            baseline_reason,
            gap_hours,
            len(now_map),
            len(deltas),
            skipped,
            len(rising),
            len(falling),
            len(top_posts),
            outcome,
        )

        return PostAnalyticsHistoryResponse(
            period={"from": utc_iso(baseline_at), "to": utc_iso(now_ts)},
            summary=summary,
            top_gainers=rising,
            top_decliners=falling,
            top_posts=top_posts,
            rising_posts=rising,
            falling_posts=falling,
            period_key=period_key,
            baseline_reason=baseline_reason,
            recommended_sync_cooldown_seconds=RECOMMENDED_SYNC_COOLDOWN_SECONDS,
            last_synced_at=last_synced,
        )

    # ── Internal helpers ───────────────────────────────────────────────────

    def _empty_trends(
        self,
        user_id: str,
        period_key: str,
        baseline_reason: str,
        now_ts: datetime,
    ) -> PostAnalyticsHistoryResponse:
        zero = MetricDelta(before=0, now=0, delta=0, pct_change=0.0)
        return PostAnalyticsHistoryResponse(
            period={"from": utc_iso(now_ts), "to": utc_iso(now_ts)},
            summary=EngagementSummary(
                total_posts=0,
                reactions=zero,
                comments=zero,
                impressions=zero,
                followers=zero,
                clicks=zero,
                reposts=zero,
                avg_engagement_rate_before=0.0,
                avg_engagement_rate_now=0.0,
            ),
            top_gainers=[],
            top_decliners=[],
            top_posts=[],
            rising_posts=[],
            falling_posts=[],
            period_key=period_key,
            baseline_reason=baseline_reason,
            recommended_sync_cooldown_seconds=RECOMMENDED_SYNC_COOLDOWN_SECONDS,
            last_synced_at=self.get_last_synced_at(user_id),
        )

    def _nearest_snapshots_at_or_before(
        self, user_id: str, baseline_at: datetime
    ) -> dict[str, PostAnalyticsSnapshot]:
        """Best-effort map: latest snapshot per post at or before baseline_at."""
        rows = (
            self.db.query(PostAnalyticsSnapshot)
            .filter(
                PostAnalyticsSnapshot.user_id == user_id,
                PostAnalyticsSnapshot.snapshot_at <= baseline_at,
            )
            .order_by(PostAnalyticsSnapshot.snapshot_at.desc())
            .all()
        )
        out: dict[str, PostAnalyticsSnapshot] = {}
        for row in rows:
            if row.post_id not in out:
                out[row.post_id] = row
        return out

    def _build_summary(
        self,
        deltas: list[PostDelta],
        prev_map: dict[str, PostAnalyticsSnapshot],
        now_map: dict[str, LinkedInPostAnalytics],
    ) -> EngagementSummary:
        total = len(deltas)
        if total == 0:
            zero = MetricDelta(before=0, now=0, delta=0, pct_change=0.0)
            return EngagementSummary(
                total_posts=0,
                reactions=zero,
                comments=zero,
                impressions=zero,
                followers=zero,
                clicks=zero,
                reposts=zero,
                avg_engagement_rate_before=0.0,
                avg_engagement_rate_now=0.0,
            )

        def _sums(attr_prev: str, attr_now: str) -> tuple[int, int]:
            before = sum(getattr(prev_map[d.post_id], attr_prev) or 0 for d in deltas)
            now_v = sum(getattr(now_map[d.post_id], attr_now) or 0 for d in deltas)
            return before, now_v

        r_b, r_n = _sums("reactions", "reactions")
        c_b, c_n = _sums("comments", "comments")
        i_b, i_n = _sums("impressions", "impressions")
        f_b, f_n = _sums("followers_gained", "followers_gained")
        k_b, k_n = _sums("clicks", "clicks")
        p_b, p_n = _sums("reposts", "reposts")
        avg_er_before = sum(d.engagement_rate_before for d in deltas) / total
        avg_er_now = sum(d.engagement_rate_now for d in deltas) / total

        return EngagementSummary(
            total_posts=total,
            reactions=MetricDelta(**metric_delta(r_b, r_n)),
            comments=MetricDelta(**metric_delta(c_b, c_n)),
            impressions=MetricDelta(**metric_delta(i_b, i_n)),
            followers=MetricDelta(**metric_delta(f_b, f_n)),
            clicks=MetricDelta(**metric_delta(k_b, k_n)),
            reposts=MetricDelta(**metric_delta(p_b, p_n)),
            avg_engagement_rate_before=round(avg_er_before, 4),
            avg_engagement_rate_now=round(avg_er_now, 4),
        )

    def _snapshot_from_row(
        self, row: LinkedInPostAnalytics, snapshot_at: datetime
    ) -> PostAnalyticsSnapshot:
        return PostAnalyticsSnapshot(
            user_id=row.user_id,
            post_id=row.post_id,
            snapshot_at=snapshot_at,
            reactions=row.reactions or 0,
            comments=row.comments or 0,
            reposts=row.reposts or 0,
            impressions=row.impressions or 0,
            clicks=row.clicks or 0,
            followers_gained=row.followers_gained or 0,
            engagement_rate=row.engagement_rate or 0.0,
        )

    def _has_snapshot_on_utc_day(
        self, user_id: str, post_id: str, day: datetime
    ) -> bool:
        day_start = datetime(day.year, day.month, day.day)
        day_end = day_start.replace(hour=23, minute=59, second=59, microsecond=999999)
        exists = (
            self.db.query(PostAnalyticsSnapshot.id)
            .filter(
                PostAnalyticsSnapshot.user_id == user_id,
                PostAnalyticsSnapshot.post_id == post_id,
                PostAnalyticsSnapshot.snapshot_at >= day_start,
                PostAnalyticsSnapshot.snapshot_at <= day_end,
            )
            .first()
        )
        return exists is not None

    def _metrics_unchanged(self, row: LinkedInPostAnalytics, post: LinkedInPost) -> bool:
        eng = post.engagement
        return (
            row.reactions == eng.reactions
            and row.comments == eng.comments
            and row.reposts == eng.reposts
            and row.impressions == eng.impressions
            and row.clicks == eng.clicks
            and row.followers_gained == eng.followers_gained
            and abs((row.engagement_rate or 0.0) - (eng.engagement_rate or 0.0)) < 1e-9
        )

    def _snapshot_if_changed(
        self, row: LinkedInPostAnalytics, post: LinkedInPost, now: datetime
    ) -> bool:
        """Snapshot old values if metrics changed. Returns True when snapshot written."""
        if self._metrics_unchanged(row, post):
            return False
        self.db.add(self._snapshot_from_row(row, now))
        return True

    def _update_row(
        self, row: LinkedInPostAnalytics, post: LinkedInPost, now: datetime
    ) -> Optional[str]:
        """Update row. Returns snapshot kind: change | anchor | None."""
        wrote_change = self._snapshot_if_changed(row, post, now)
        snap_kind: Optional[str] = "change" if wrote_change else None
        if not wrote_change and not self._has_snapshot_on_utc_day(row.user_id, row.post_id, now):
            self.db.add(self._snapshot_from_row(row, now))
            snap_kind = "anchor"

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
        return snap_kind

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
        self.db.flush()
        # Initial baseline so "since joining" can start after the next sync.
        self.db.add(self._snapshot_from_row(row, now))
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
            "[PostAnalyticsService] Cleared {} analytics rows for user={}",
            deleted,
            mask_user_id_for_log(user_id),
        )
        return deleted

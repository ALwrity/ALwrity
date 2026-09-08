"""
YouTube Analytics + channel pulse helpers.

Uses Data API v3 for lifetime channel stats and YouTube Analytics API v2
for rolling window metrics (views, watch time, avg view duration).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from googleapiclient.discovery import build
from loguru import logger

from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_analytics_overview_query import (
    VIDEO_TOP_METRICS,
    VIDEO_TOP_METRICS_WITH_PERCENT,
    analytics_error_kind,
    execute_channel_window,
    execute_top_videos,
    execute_views_by_day,
    parse_video_metric_rows,
    parse_views_by_day,
    parse_window_totals,
    window_payload,
)
from services.youtube.youtube_analytics_overview_window import (
    OverviewWindowError,
    lifetime_bounds,
    resolve_overview_query,
)


class YouTubeAnalyticsService:
    def __init__(self, oauth_service: YouTubeOAuthService):
        self.oauth_service = oauth_service

    def get_channel_pulse(
        self,
        user_id: str,
        token_id: Optional[int] = None,
        days: int = 28,
    ) -> Dict[str, Any]:
        """Aggregate channel health for Studio Hub sidebar / Analysis wedge."""
        try:
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                return {
                    "success": False,
                    "error_code": "not_connected",
                    "message": "Connect YouTube to load channel pulse.",
                }

            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
            channel = youtube.channels().list(
                part="snippet,statistics,contentDetails",
                mine=True,
            ).execute()
            items = channel.get("items") or []
            if not items:
                return {
                    "success": False,
                    "error_code": "no_channel",
                    "message": "No YouTube channel found for this account.",
                }

            ch = items[0]
            stats = ch.get("statistics") or {}
            snippet = ch.get("snippet") or {}
            uploads_playlist = (
                (ch.get("contentDetails") or {})
                .get("relatedPlaylists", {})
                .get("uploads")
            )

            end = date.today()
            start = end - timedelta(days=max(1, min(days, 90)))
            window = self._query_analytics_window(creds, start, end)

            top_videos = self._list_recent_uploads(
                youtube, uploads_playlist, max_results=5
            )

            return {
                "success": True,
                "channel": {
                    "id": ch.get("id"),
                    "title": snippet.get("title"),
                    "thumbnail": ((snippet.get("thumbnails") or {}).get("default") or {}).get(
                        "url"
                    ),
                },
                "lifetime": {
                    "subscriber_count": _int(stats.get("subscriberCount")),
                    "view_count": _int(stats.get("viewCount")),
                    "video_count": _int(stats.get("videoCount")),
                    "hidden_subscriber_count": bool(stats.get("hiddenSubscriberCount")),
                },
                "window_days": days,
                "window": window,
                "top_videos": top_videos,
                "analytics_available": window.get("available", False),
                "message": "Channel pulse loaded.",
            }
        except Exception as e:
            logger.error(f"YouTube analytics pulse failed for {user_id}: {e}")
            return {
                "success": False,
                "error_code": "pulse_failed",
                "message": str(e),
            }

    def get_retention_summary(
        self,
        user_id: str,
        token_id: Optional[int] = None,
        days: int = 28,
    ) -> Dict[str, Any]:
        """Avg view duration + watch minutes as a practical retention proxy."""
        pulse = self.get_channel_pulse(user_id, token_id, days=days)
        if not pulse.get("success"):
            return pulse

        window = pulse.get("window") or {}
        avg_sec = window.get("average_view_duration_seconds")
        tips: List[str] = []
        if avg_sec is None:
            tips.append(
                "Reconnect YouTube with Analytics scope to unlock average view duration."
            )
        elif avg_sec < 30:
            tips.append("Avg view duration is under 30s — strengthen the first-hook scene.")
        elif avg_sec < 90:
            tips.append("Solid mid-range retention — tighten mid-video CTA and pacing.")
        else:
            tips.append("Strong watch time — remarket winners into Shorts and sequels.")

        return {
            "success": True,
            "window_days": days,
            "average_view_duration_seconds": avg_sec,
            "estimated_minutes_watched": window.get("estimated_minutes_watched"),
            "views": window.get("views"),
            "tips": tips,
            "top_videos": pulse.get("top_videos") or [],
            "message": "Retention summary ready.",
        }

    def get_channel_overview(
        self,
        user_id: str,
        days: Optional[int] = None,
        token_id: Optional[int] = None,
        window: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Channel Overview for Video Analytics: window totals, chart, top and latest."""
        today = date.today()
        logger.info(
            "YouTube channel overview start window={} has_days={} has_dates={}",
            window,
            days is not None,
            start_date is not None and end_date is not None,
        )
        try:
            resolved = resolve_overview_query(
                window=window,
                days=days,
                start_date=start_date,
                end_date=end_date,
                today=today,
            )
        except OverviewWindowError as exc:
            logger.warning(
                "YouTube channel overview window rejected code={}",
                exc.error_code,
            )
            raise

        try:
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                logger.warning("YouTube channel overview not connected")
                return {
                    "success": False,
                    "error_code": "not_connected",
                    "message": "Connect YouTube to load channel overview.",
                }

            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
            channel = youtube.channels().list(
                part="snippet,statistics,contentDetails",
                mine=True,
            ).execute()
            items = channel.get("items") or []
            if not items:
                logger.warning("YouTube channel overview no channel")
                return {
                    "success": False,
                    "error_code": "no_channel",
                    "message": "No YouTube channel found for this account.",
                }

            snippet = items[0].get("snippet") or {}
            published_at = snippet.get("publishedAt")
            uploads_playlist = (
                (items[0].get("contentDetails") or {})
                .get("relatedPlaylists", {})
                .get("uploads")
            )
            if resolved.get("needs_published_at"):
                try:
                    start, end = lifetime_bounds(published_at, today)
                except OverviewWindowError as exc:
                    logger.warning("YouTube channel overview lifetime unavailable")
                    return {
                        "success": False,
                        "error_code": exc.error_code,
                        "message": exc.message,
                    }
                prev_start = None
                prev_end = None
            else:
                start = resolved["start"]
                end = resolved["end"]
                prev_start = resolved.get("prev_start")
                prev_end = resolved.get("prev_end")

            analytics = build(
                "youtubeAnalytics", "v2", credentials=creds, cache_discovery=False
            )
            try:
                current_report = execute_channel_window(analytics, start, end)
            except Exception as exc:
                logger.warning(
                    "YouTube channel overview window unavailable kind={}",
                    analytics_error_kind(exc),
                )
                return {
                    "success": False,
                    "error_code": "analytics_unavailable",
                    "message": "Channel overview is unavailable for this window.",
                }

            current = window_payload(parse_window_totals(current_report))
            previous = None
            if resolved.get("compare") and prev_start and prev_end:
                previous = self._overview_previous_window(
                    analytics, prev_start, prev_end
                )
            views_by_day = self._overview_views_by_day(analytics, start, end)
            top_videos = self._overview_top_videos(analytics, youtube, start, end)
            latest_videos = self._overview_latest_videos(youtube, uploads_playlist)
            logger.info(
                "YouTube channel overview complete kind={} day_points={} top_count={} latest_count={}",
                resolved.get("kind"),
                len(views_by_day),
                len(top_videos),
                len(latest_videos),
            )
            return {
                "success": True,
                "window_kind": resolved.get("kind"),
                "window_days": resolved.get("window_days"),
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "compare": bool(resolved.get("compare")),
                "published_at": published_at,
                "current": current,
                "previous": previous,
                "views_by_day": views_by_day,
                "top_videos": top_videos,
                "latest_videos": latest_videos,
                "message": "Channel overview loaded.",
            }
        except OverviewWindowError:
            raise
        except Exception as exc:
            logger.warning(
                "YouTube channel overview failed kind={}",
                analytics_error_kind(exc),
            )
            return {
                "success": False,
                "error_code": "analytics_unavailable",
                "message": "Channel overview is unavailable for this window.",
            }

    def _overview_previous_window(self, analytics, start: date, end: date) -> Optional[Dict[str, Any]]:
        try:
            report = execute_channel_window(analytics, start, end)
            return window_payload(parse_window_totals(report))
        except Exception as exc:
            logger.warning(
                "YouTube channel overview previous window skipped kind={}",
                analytics_error_kind(exc),
            )
            return None

    def _overview_views_by_day(self, analytics, start: date, end: date) -> List[Dict[str, Any]]:
        try:
            report = execute_views_by_day(analytics, start, end)
            return parse_views_by_day(report)
        except Exception as exc:
            logger.warning(
                "YouTube channel overview day series skipped kind={}",
                analytics_error_kind(exc),
            )
            return []

    def _overview_top_videos(
        self,
        analytics,
        youtube,
        start: date,
        end: date,
    ) -> List[Dict[str, Any]]:
        try:
            try:
                report = execute_top_videos(
                    analytics, start, end, VIDEO_TOP_METRICS_WITH_PERCENT
                )
            except Exception as exc:
                logger.warning(
                    "YouTube channel overview percentage metric skipped kind={}",
                    analytics_error_kind(exc),
                )
                report = execute_top_videos(analytics, start, end, VIDEO_TOP_METRICS)
            rows = parse_video_metric_rows(report)
            return self._join_top_video_snippets(youtube, rows)
        except Exception as exc:
            logger.warning(
                "YouTube channel overview top videos skipped kind={}",
                analytics_error_kind(exc),
            )
            return []

    def _join_top_video_snippets(
        self,
        youtube,
        rows: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        ids = [row["video_id"] for row in rows if row.get("video_id")]
        if not ids:
            return []
        try:
            listed = (
                youtube.videos()
                .list(part="snippet", id=",".join(ids))
                .execute()
            )
        except Exception as exc:
            logger.warning(
                "YouTube channel overview top snippets skipped kind={}",
                analytics_error_kind(exc),
            )
            return []
        by_id: Dict[str, Dict[str, Any]] = {}
        for item in listed.get("items") or []:
            video_id = str(item.get("id") or "").strip()
            snippet = item.get("snippet") or {}
            if not video_id:
                continue
            thumbs = snippet.get("thumbnails") or {}
            by_id[video_id] = {
                "title": snippet.get("title"),
                "published_at": snippet.get("publishedAt"),
                "thumbnail": (
                    (thumbs.get("medium") or thumbs.get("default") or {}).get("url")
                ),
            }
        joined: List[Dict[str, Any]] = []
        for row in rows:
            extra = by_id.get(row["video_id"])
            if not extra:
                continue
            joined.append({**row, **extra})
        return joined

    def _overview_latest_videos(
        self,
        youtube,
        uploads_playlist: Optional[str],
    ) -> List[Dict[str, Any]]:
        latest = self._list_recent_uploads(youtube, uploads_playlist, max_results=2)
        ids = [row.get("video_id") for row in latest if row.get("video_id")]
        if not ids:
            return latest
        try:
            listed = (
                youtube.videos()
                .list(part="statistics", id=",".join(ids))
                .execute()
            )
        except Exception as exc:
            logger.warning(
                "YouTube channel overview latest stats skipped kind={}",
                analytics_error_kind(exc),
            )
            for row in latest:
                row["view_count"] = None
                row["like_count"] = None
            return latest
        stats_by_id = {
            str(item.get("id") or ""): item.get("statistics") or {}
            for item in listed.get("items") or []
        }
        for row in latest:
            stats = stats_by_id.get(str(row.get("video_id") or "")) or {}
            row["view_count"] = _int(stats.get("viewCount"))
            row["like_count"] = _int(stats.get("likeCount"))
        return latest

    def _query_analytics_window(
        self,
        creds,
        start: date,
        end: date,
    ) -> Dict[str, Any]:
        try:
            analytics = build(
                "youtubeAnalytics", "v2", credentials=creds, cache_discovery=False
            )
            report = (
                analytics.reports()
                .query(
                    ids="channel==MINE",
                    startDate=start.isoformat(),
                    endDate=end.isoformat(),
                    metrics=(
                        "views,estimatedMinutesWatched,averageViewDuration,"
                        "subscribersGained,subscribersLost"
                    ),
                )
                .execute()
            )
            rows = report.get("rows") or []
            if not rows:
                return {
                    "available": True,
                    "views": 0,
                    "estimated_minutes_watched": 0,
                    "average_view_duration_seconds": 0,
                    "subscribers_gained": 0,
                    "subscribers_lost": 0,
                }
            row = rows[0]
            return {
                "available": True,
                "views": _num(row[0]),
                "estimated_minutes_watched": _num(row[1]),
                "average_view_duration_seconds": _num(row[2]),
                "subscribers_gained": _num(row[3]),
                "subscribers_lost": _num(row[4]),
            }
        except Exception as e:
            logger.warning(f"YouTube Analytics window query unavailable: {e}")
            return {
                "available": False,
                "error": str(e),
                "views": None,
                "estimated_minutes_watched": None,
                "average_view_duration_seconds": None,
                "subscribers_gained": None,
                "subscribers_lost": None,
            }

    def _list_recent_uploads(
        self,
        youtube,
        uploads_playlist: Optional[str],
        max_results: int = 5,
    ) -> List[Dict[str, Any]]:
        if not uploads_playlist:
            return []
        try:
            resp = (
                youtube.playlistItems()
                .list(
                    part="snippet,contentDetails",
                    playlistId=uploads_playlist,
                    maxResults=max_results,
                )
                .execute()
            )
            out: List[Dict[str, Any]] = []
            for item in resp.get("items") or []:
                sn = item.get("snippet") or {}
                out.append(
                    {
                        "video_id": (item.get("contentDetails") or {}).get("videoId")
                        or sn.get("resourceId", {}).get("videoId"),
                        "title": sn.get("title"),
                        "published_at": sn.get("publishedAt"),
                        "thumbnail": (
                            (sn.get("thumbnails") or {}).get("medium")
                            or (sn.get("thumbnails") or {}).get("default")
                            or {}
                        ).get("url"),
                    }
                )
            return out
        except Exception as e:
            logger.warning(f"YouTube recent uploads list failed: {e}")
            return []


def _int(value: Any) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _num(value: Any) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None

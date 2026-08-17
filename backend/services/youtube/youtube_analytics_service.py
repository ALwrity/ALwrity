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

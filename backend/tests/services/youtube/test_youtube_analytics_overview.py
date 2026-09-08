"""YouTubeAnalyticsService.get_channel_overview — no invented channel metrics."""

from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_channel_overview"


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_analytics_service import YouTubeAnalyticsService

    return YouTubeAnalyticsService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _channel_ok(youtube: MagicMock) -> None:
    youtube.channels.return_value.list.return_value.execute.return_value = {
        "items": [
            {
                "id": "UC123",
                "snippet": {"title": "Test", "thumbnails": {}},
                "statistics": {},
                "contentDetails": {"relatedPlaylists": {"uploads": "UU123"}},
            }
        ],
    }


class TestYouTubeAnalyticsOverview:
    def test_not_connected_returns_error_without_fake_views(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        result = _service(oauth).get_channel_overview(USER_ID, days=28)

        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        assert result.get("views") is None
        assert result.get("current") is None

    def test_no_channel_returns_error_without_metrics(self):
        youtube = MagicMock()
        youtube.channels.return_value.list.return_value.execute.return_value = {
            "items": [],
        }
        with patch("services.youtube.youtube_analytics_service.build", return_value=youtube):
            result = _service(_connected_oauth()).get_channel_overview(USER_ID, days=28)

        assert result["success"] is False
        assert result["error_code"] == "no_channel"

    def test_queries_current_and_previous_windows_and_day_series(self):
        from services.youtube.youtube_analytics_overview_query import (
            overview_window_bounds,
            previous_window_bounds,
        )

        youtube = MagicMock()
        _channel_ok(youtube)
        youtube.playlistItems.return_value.list.return_value.execute.return_value = {
            "items": [],
        }
        youtube.videos.return_value.list.return_value.execute.return_value = {"items": []}

        analytics = MagicMock()
        start, end = overview_window_bounds(28)
        prev_start, prev_end = previous_window_bounds(start, 28)

        def _query(**kwargs):
            mock = MagicMock()
            dims = kwargs.get("dimensions")
            metrics = kwargs.get("metrics") or ""
            start_date = kwargs.get("startDate")
            if dims == "day":
                mock.execute.return_value = {
                    "rows": [[end.isoformat(), 27], [start.isoformat(), 5]],
                }
            elif dims == "video":
                mock.execute.return_value = {"rows": []}
            elif start_date == start.isoformat():
                mock.execute.return_value = {"rows": [[127, 42, 40, 3, 1]]}
            elif start_date == prev_start.isoformat():
                mock.execute.return_value = {"rows": [[62, 20, 30, 1, 0]]}
            else:
                mock.execute.return_value = {"rows": []}
            return mock

        analytics.reports.return_value.query.side_effect = _query

        def _build(api, version, **kwargs):
            if api == "youtubeAnalytics":
                return analytics
            return youtube

        with patch("services.youtube.youtube_analytics_service.build", side_effect=_build):
            result = _service(_connected_oauth()).get_channel_overview(USER_ID, days=28)

        assert result["success"] is True
        assert result["window_days"] == 28
        assert result["current"]["views"] == 127
        assert result["current"]["watch_hours"] == 0.7
        assert result["current"]["subscribers_net"] == 2
        assert result["previous"]["views"] == 62
        assert result["views_by_day"][0]["date"] == start.isoformat()
        assert result["views_by_day"][0]["views"] == 5
        query_kwargs = [
            call.kwargs for call in analytics.reports.return_value.query.call_args_list
        ]
        window_starts = {
            k["startDate"]
            for k in query_kwargs
            if not k.get("dimensions")
        }
        assert start.isoformat() in window_starts
        assert prev_start.isoformat() in window_starts
        day_q = next(k for k in query_kwargs if k.get("dimensions") == "day")
        assert day_q["metrics"] == "views"
        assert day_q["endDate"] == end.isoformat()
        assert prev_end == start - timedelta(days=1)
        assert "subscribersGained" in next(
            k["metrics"] for k in query_kwargs if not k.get("dimensions")
        )

    def test_top_videos_join_snippets_and_omit_unknown_ids(self):
        youtube = MagicMock()
        _channel_ok(youtube)
        youtube.playlistItems.return_value.list.return_value.execute.return_value = {
            "items": [],
        }

        def _videos_list(**kwargs):
            mock = MagicMock()
            mock.execute.return_value = {
                "items": [
                    {
                        "id": "vid-1",
                        "snippet": {
                            "title": "Known",
                            "publishedAt": "2024-05-01T00:00:00Z",
                            "thumbnails": {"medium": {"url": "https://i.ytimg.com/vi/vid-1/mq.jpg"}},
                        },
                    }
                ],
            }
            return mock

        youtube.videos.return_value.list.side_effect = _videos_list

        analytics = MagicMock()

        def _query(**kwargs):
            mock = MagicMock()
            dims = kwargs.get("dimensions")
            if dims == "video":
                mock.execute.return_value = {
                    "rows": [["vid-1", 40, 18], ["vid-orphan", 99, 10]],
                }
            elif dims == "day":
                mock.execute.return_value = {"rows": []}
            else:
                mock.execute.return_value = {"rows": [[10, 1, 1, 0, 0]]}
            return mock

        analytics.reports.return_value.query.side_effect = _query

        def _build(api, version, **kwargs):
            if api == "youtubeAnalytics":
                return analytics
            return youtube

        with patch("services.youtube.youtube_analytics_service.build", side_effect=_build):
            result = _service(_connected_oauth()).get_channel_overview(USER_ID, days=7)

        ids = [row["video_id"] for row in result["top_videos"]]
        assert ids == ["vid-1"]
        assert result["top_videos"][0]["views"] == 40
        assert result["top_videos"][0]["title"] == "Known"
        assert "vid-orphan" not in ids

    def test_retries_top_videos_without_percentage_metric(self):
        youtube = MagicMock()
        _channel_ok(youtube)
        youtube.playlistItems.return_value.list.return_value.execute.return_value = {
            "items": [],
        }
        youtube.videos.return_value.list.return_value.execute.return_value = {
            "items": [{"id": "vid-1", "snippet": {"title": "A", "thumbnails": {}}}],
        }
        analytics = MagicMock()

        def _query(**kwargs):
            mock = MagicMock()
            metrics = kwargs.get("metrics") or ""
            dims = kwargs.get("dimensions")
            if dims == "video" and "averageViewPercentage" in metrics:
                raise RuntimeError("query not supported")
            if dims == "video":
                mock.execute.return_value = {"rows": [["vid-1", 8, 20]]}
            elif dims == "day":
                mock.execute.return_value = {"rows": []}
            else:
                mock.execute.return_value = {"rows": [[1, 1, 1, 0, 0]]}
            return mock

        analytics.reports.return_value.query.side_effect = _query

        def _build(api, version, **kwargs):
            if api == "youtubeAnalytics":
                return analytics
            return youtube

        with patch("services.youtube.youtube_analytics_service.build", side_effect=_build):
            result = _service(_connected_oauth()).get_channel_overview(USER_ID, days=7)

        assert result["top_videos"][0]["video_id"] == "vid-1"
        assert result["top_videos"][0].get("average_view_percentage") is None

    def test_latest_keeps_title_when_statistics_fail(self):
        youtube = MagicMock()
        _channel_ok(youtube)
        youtube.playlistItems.return_value.list.return_value.execute.return_value = {
            "items": [
                {
                    "snippet": {
                        "title": "Newest",
                        "publishedAt": "2026-09-01T00:00:00Z",
                        "thumbnails": {"medium": {"url": "https://i.ytimg.com/x.jpg"}},
                        "resourceId": {"videoId": "new-1"},
                    },
                    "contentDetails": {"videoId": "new-1"},
                }
            ],
        }
        youtube.videos.return_value.list.return_value.execute.side_effect = RuntimeError(
            "quota"
        )
        analytics = MagicMock()

        def _query(**kwargs):
            mock = MagicMock()
            if kwargs.get("dimensions") == "video":
                mock.execute.return_value = {"rows": []}
            elif kwargs.get("dimensions") == "day":
                mock.execute.return_value = {"rows": []}
            else:
                mock.execute.return_value = {"rows": [[1, 1, 1, 0, 0]]}
            return mock

        analytics.reports.return_value.query.side_effect = _query

        def _build(api, version, **kwargs):
            if api == "youtubeAnalytics":
                return analytics
            return youtube

        with patch("services.youtube.youtube_analytics_service.build", side_effect=_build):
            result = _service(_connected_oauth()).get_channel_overview(USER_ID, days=7)

        assert result["latest_videos"][0]["title"] == "Newest"
        assert result["latest_videos"][0]["like_count"] is None

    def test_core_window_failure_is_unavailable_without_invented_views(self):
        youtube = MagicMock()
        _channel_ok(youtube)
        analytics = MagicMock()
        analytics.reports.return_value.query.side_effect = RuntimeError("quota")

        def _build(api, version, **kwargs):
            if api == "youtubeAnalytics":
                return analytics
            return youtube

        with patch("services.youtube.youtube_analytics_service.build", side_effect=_build):
            result = _service(_connected_oauth()).get_channel_overview(USER_ID, days=28)

        assert result["success"] is False
        assert result["error_code"] == "analytics_unavailable"
        assert result.get("current") is None

    def test_previous_window_failure_keeps_current_totals(self):
        from services.youtube.youtube_analytics_overview_query import (
            overview_window_bounds,
        )

        youtube = MagicMock()
        _channel_ok(youtube)
        youtube.playlistItems.return_value.list.return_value.execute.return_value = {
            "items": [],
        }
        analytics = MagicMock()
        start, _end = overview_window_bounds(7)

        def _query(**kwargs):
            mock = MagicMock()
            if kwargs.get("dimensions"):
                mock.execute.return_value = {"rows": []}
            elif kwargs.get("startDate") == start.isoformat():
                mock.execute.return_value = {"rows": [[71, 12, 20, 1, 0]]}
            else:
                raise RuntimeError("previous window quota")
            return mock

        analytics.reports.return_value.query.side_effect = _query

        def _build(api, version, **kwargs):
            if api == "youtubeAnalytics":
                return analytics
            return youtube

        with patch("services.youtube.youtube_analytics_service.build", side_effect=_build):
            result = _service(_connected_oauth()).get_channel_overview(USER_ID, days=7)

        assert result["success"] is True
        assert result["current"]["views"] == 71
        assert result["previous"] is None

    def test_latest_includes_statistics_when_available(self):
        youtube = MagicMock()
        _channel_ok(youtube)
        youtube.playlistItems.return_value.list.return_value.execute.return_value = {
            "items": [
                {
                    "snippet": {
                        "title": "Animation Video Generation Test",
                        "thumbnails": {"medium": {"url": "https://i.ytimg.com/x.jpg"}},
                    },
                    "contentDetails": {"videoId": "new-1"},
                }
            ],
        }
        youtube.videos.return_value.list.return_value.execute.return_value = {
            "items": [
                {
                    "id": "new-1",
                    "statistics": {"viewCount": "15", "likeCount": "2"},
                }
            ],
        }
        analytics = MagicMock()

        def _query(**kwargs):
            mock = MagicMock()
            mock.execute.return_value = {"rows": [[1, 1, 1, 0, 0]]}
            if kwargs.get("dimensions") in {"day", "video"}:
                mock.execute.return_value = {"rows": []}
            return mock

        analytics.reports.return_value.query.side_effect = _query

        def _build(api, version, **kwargs):
            if api == "youtubeAnalytics":
                return analytics
            return youtube

        with patch("services.youtube.youtube_analytics_service.build", side_effect=_build):
            result = _service(_connected_oauth()).get_channel_overview(USER_ID, days=7)

        assert result["latest_videos"][0]["title"] == "Animation Video Generation Test"
        assert result["latest_videos"][0]["view_count"] == 15
        assert result["latest_videos"][0]["like_count"] == 2

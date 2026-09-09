"""YouTubeAnalyticsService.get_channel_audience — independent section failures."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_channel_audience"


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
                "snippet": {"title": "Test", "publishedAt": "2020-01-15T00:00:00Z"},
            }
        ],
    }


class TestYouTubeAnalyticsAudience:
    def test_not_connected_returns_error_without_fake_demographics(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        result = _service(oauth).get_channel_audience(USER_ID, days=28)
        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        assert result.get("demographics") is None
        assert result.get("countries") is None

    def test_no_channel_returns_error_without_metrics(self):
        youtube = MagicMock()
        youtube.channels.return_value.list.return_value.execute.return_value = {"items": []}
        with patch("services.youtube.youtube_analytics_audience.build", return_value=youtube):
            result = _service(_connected_oauth()).get_channel_audience(USER_ID, days=28)
        assert result["success"] is False
        assert result["error_code"] == "no_channel"

    def test_one_query_failure_leaves_other_sections(self):
        youtube = MagicMock()
        _channel_ok(youtube)

        def _build(api, version, **kwargs):
            if api == "youtubeAnalytics":
                return MagicMock()
            return youtube

        with patch("services.youtube.youtube_analytics_audience.build", side_effect=_build):
            with patch(
                "services.youtube.youtube_analytics_audience.execute_demographics",
                side_effect=RuntimeError("query not supported"),
            ):
                with patch(
                    "services.youtube.youtube_analytics_audience.execute_countries",
                    return_value={"rows": [["US", 50, 60], ["ZZ", 10, 12]]},
                ):
                    with patch(
                        "services.youtube.youtube_analytics_audience.execute_subscribed",
                        return_value={"rows": [["SUBSCRIBED", 40, 30]]},
                    ):
                        result = _service(_connected_oauth()).get_channel_audience(
                            USER_ID, days=28
                        )

        assert result["success"] is True
        assert result["demographics"]["available"] is False
        assert result["demographics"]["rows"] == []
        assert "unavailable" in result["demographics"]["message"].lower()
        assert result["countries"]["available"] is True
        assert result["countries"]["rows"][0]["country"] == "US"
        assert result["subscribed"]["available"] is True
        assert result["subscribed"]["rows"][0]["status"] == "SUBSCRIBED"

    def test_empty_demographics_are_available_without_invented_percent(self):
        youtube = MagicMock()
        _channel_ok(youtube)

        def _build(api, version, **kwargs):
            if api == "youtubeAnalytics":
                return MagicMock()
            return youtube

        with patch("services.youtube.youtube_analytics_audience.build", side_effect=_build):
            with patch(
                "services.youtube.youtube_analytics_audience.execute_demographics",
                return_value={"rows": []},
            ):
                with patch(
                    "services.youtube.youtube_analytics_audience.execute_countries",
                    return_value={"rows": []},
                ):
                    with patch(
                        "services.youtube.youtube_analytics_audience.execute_subscribed",
                        return_value={"rows": []},
                    ):
                        result = _service(_connected_oauth()).get_channel_audience(
                            USER_ID, days=28
                        )

        assert result["success"] is True
        assert result["demographics"]["available"] is True
        assert result["demographics"]["rows"] == []
        assert "No demographic" in result["demographics"]["message"]
        assert result["countries"]["rows"] == []
        assert result["subscribed"]["rows"] == []

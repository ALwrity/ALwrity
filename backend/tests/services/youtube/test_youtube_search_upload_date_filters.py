"""TDD: YouTube Search.list UPLOAD DATE filter.

Search.list has no upload-date enum. Map UI buckets to ``publishedAfter``
(RFC 3339). Do not invent Last hour. Do not send ``publishedBefore``.

Frontend ``upload_date`` ids → UTC calendar start (use ``_youtube_search_utc_now``):

- today  → start of current UTC day
- week   → Monday 00:00:00Z of the current ISO week
- month  → first day of the current UTC month
- year   → 1 January 00:00:00Z of the current UTC year

Frozen clock in these tests: 2026-08-26T12:00:00Z (Wednesday).
This slice is tests only; publishedAfter is not applied yet.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_search_upload_date_tdd"
FROZEN_NOW = datetime(2026, 8, 26, 12, 0, 0, tzinfo=timezone.utc)
PUBLISHED_AFTER_TODAY = "2026-08-26T00:00:00Z"
PUBLISHED_AFTER_WEEK = "2026-08-24T00:00:00Z"
PUBLISHED_AFTER_MONTH = "2026-08-01T00:00:00Z"
PUBLISHED_AFTER_YEAR = "2026-01-01T00:00:00Z"


def _youtube_client(payload: dict) -> MagicMock:
    youtube = MagicMock()
    youtube.search.return_value.list.return_value.execute.return_value = payload
    return youtube


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_search_service import YouTubeSearchService

    return YouTubeSearchService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _video_payload(video_id: str = "vid123", title: str = "How to train dogs") -> dict:
    return {
        "items": [
            {
                "id": {"kind": "youtube#video", "videoId": video_id},
                "snippet": {"title": title},
            }
        ]
    }


def _search_with_upload_date(youtube: MagicMock, upload_date: str):
    with patch(
        "services.youtube.youtube_search_service.build",
        return_value=youtube,
    ), patch(
        "services.youtube.youtube_search_service._youtube_search_utc_now",
        return_value=FROZEN_NOW,
        create=True,
    ):
        return _service(_connected_oauth()).search_by_keyword(
            USER_ID,
            "dogs",
            upload_date=upload_date,
        )


class TestYouTubeSearchUploadDateFilters:
    def test_today_sets_published_after_start_of_utc_day(self):
        youtube = _youtube_client(_video_payload())
        result = _search_with_upload_date(youtube, "today")

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_TODAY
        assert "publishedBefore" not in list_kwargs
        assert result["items"] == [
            {"video_id": "vid123", "title": "How to train dogs"}
        ]

    def test_week_sets_published_after_iso_week_monday_utc(self):
        youtube = _youtube_client(_video_payload("vidweek", "This week dogs"))
        result = _search_with_upload_date(youtube, "week")

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_WEEK
        assert result["items"] == [
            {"video_id": "vidweek", "title": "This week dogs"}
        ]

    def test_month_sets_published_after_first_of_utc_month(self):
        youtube = _youtube_client(_video_payload("vidmonth", "This month dogs"))
        result = _search_with_upload_date(youtube, "month")

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_MONTH
        assert result["items"] == [
            {"video_id": "vidmonth", "title": "This month dogs"}
        ]

    def test_year_sets_published_after_first_of_utc_year(self):
        youtube = _youtube_client(_video_payload("vidyear", "This year dogs"))
        result = _search_with_upload_date(youtube, "year")

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_YEAR
        assert result["items"] == [
            {"video_id": "vidyear", "title": "This year dogs"}
        ]

    def test_upload_date_is_kept_for_channel_search_type(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {
                            "kind": "youtube#channel",
                            "channelId": "UCdogs",
                        },
                        "snippet": {"title": "Dog Channel"},
                    }
                ]
            }
        )

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ), patch(
            "services.youtube.youtube_search_service._youtube_search_utc_now",
            return_value=FROZEN_NOW,
            create=True,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                upload_date="today",
                search_type="channel",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "channel"
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_TODAY
        assert result["items"] == [
            {"channel_id": "UCdogs", "title": "Dog Channel"}
        ]

    def test_unsupported_upload_date_is_ignored(self):
        youtube = _youtube_client(_video_payload())
        _search_with_upload_date(youtube, "yesterday")

        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert "publishedAfter" not in list_kwargs
        assert "publishedBefore" not in list_kwargs

    def test_empty_upload_date_results_are_empty_not_fake_hits(self):
        youtube = _youtube_client({"items": []})
        result = _search_with_upload_date(youtube, "month")

        assert result["success"] is True
        assert result["items"] == []
        assert "video_id" not in result

    def test_upload_date_does_not_filter_shorts_hashtags(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "plain"},
                        "snippet": {"title": "How to train dogs"},
                    }
                ]
            }
        )
        result = _search_with_upload_date(youtube, "week")

        assert result["success"] is True
        assert result["items"] == [
            {"video_id": "plain", "title": "How to train dogs"}
        ]

    def test_today_uses_viewer_iana_time_zone_not_a_hardcoded_city(self):
        youtube = _youtube_client(_video_payload())

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ), patch(
            "services.youtube.youtube_search_service._youtube_search_utc_now",
            return_value=FROZEN_NOW,
            create=True,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                upload_date="today",
                time_zone="Asia/Kolkata",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        # 2026-08-26 00:00 IST = 2026-08-25T18:30:00Z
        assert list_kwargs["publishedAfter"] == "2026-08-25T18:30:00Z"

    def test_invalid_time_zone_falls_back_to_utc_calendar(self):
        youtube = _youtube_client(_video_payload())

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ), patch(
            "services.youtube.youtube_search_service._youtube_search_utc_now",
            return_value=FROZEN_NOW,
            create=True,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                upload_date="today",
                time_zone="Not/AZone",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_TODAY

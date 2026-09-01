"""TDD slice 2: FEATURES 3D → Search.list videoDimension=3d.

Do not map 360° or VR180 to 3D. Run after slice 1 is implemented.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_search_feature_3d_tdd"


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


class TestYouTubeSearchFeatureFiltersSlice2:
    def test_3d_uses_video_dimension_3d_and_type_video(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "vid3d"},
                        "snippet": {"title": "3D dogs"},
                    }
                ]
            }
        )

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_feature="3d",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDimension"] == "3d"
        assert result["items"] == [{"video_id": "vid3d", "title": "3D dogs"}]

    def test_360_is_not_mapped_to_3d(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "vid123"},
                        "snippet": {"title": "How to train dogs"},
                    }
                ]
            }
        )

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_feature="360",
            )

        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert "videoDimension" not in list_kwargs

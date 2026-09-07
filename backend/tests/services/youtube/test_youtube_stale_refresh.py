"""Stale Refresh suggest + HITL metadata update (Remarket)."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_stale_refresh"


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_studio_ops_service import YouTubeStudioOpsService

    return YouTubeStudioOpsService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


class TestYouTubeStaleRefreshService:
    def test_suggest_returns_llm_pack_without_writing_youtube(self):
        pack = {
            "new_title": "Rank YouTube Videos in 7 Days (2026)",
            "new_description": "Updated",
            "new_tags": ["seo"],
            "pin_comment": "What next?",
            "rationale": "Year refresh",
        }
        with patch(
            "services.youtube.youtube_studio_ops_service.llm_text_gen",
            return_value=pack,
        ) as llm:
            result = _service(_connected_oauth()).suggest_stale_refresh(
                USER_ID,
                title="Rank Videos in 7 Days",
                description="How to rank",
                tags=["seo"],
                niche="seo",
            )

        assert result["success"] is True
        assert result["suggestion"]["new_title"] == pack["new_title"]
        llm.assert_called_once()
        assert llm.call_args.kwargs["flow_type"] == "youtube_stale_refresh"
        assert llm.call_args.kwargs["user_id"] == USER_ID

    def test_suggest_failure_does_not_invent_a_pack(self):
        with patch(
            "services.youtube.youtube_studio_ops_service.llm_text_gen",
            side_effect=RuntimeError("llm down"),
        ):
            result = _service(_connected_oauth()).suggest_stale_refresh(
                USER_ID, title="Rank Videos"
            )

        assert result["success"] is False
        assert result["error_code"] == "refresh_failed"
        assert "suggestion" not in result or result.get("suggestion") in (None, {})

    def test_update_metadata_writes_snippet_after_videos_list(self):
        youtube = MagicMock()
        youtube.videos.return_value.list.return_value.execute.return_value = {
            "items": [
                {
                    "id": "vid-1",
                    "snippet": {
                        "title": "Old",
                        "description": "Old desc",
                        "tags": ["old"],
                        "categoryId": "22",
                    },
                }
            ]
        }
        youtube.videos.return_value.update.return_value.execute.return_value = {}
        with patch(
            "services.youtube.youtube_studio_ops_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).update_video_metadata(
                USER_ID,
                video_id="vid-1",
                title="New title",
                description="New desc",
                tags=["seo"],
            )

        assert result["success"] is True
        assert result["video_id"] == "vid-1"
        youtube.videos.return_value.update.assert_called_once()
        body = youtube.videos.return_value.update.call_args.kwargs["body"]
        assert body["id"] == "vid-1"
        assert body["snippet"]["title"] == "New title"
        assert body["snippet"]["description"] == "New desc"
        assert body["snippet"]["tags"] == ["seo"]

    def test_update_metadata_not_connected(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        result = _service(oauth).update_video_metadata(USER_ID, video_id="vid-1", title="x")

        assert result["success"] is False
        assert result["error_code"] == "not_connected"

    def test_update_metadata_video_not_found(self):
        youtube = MagicMock()
        youtube.videos.return_value.list.return_value.execute.return_value = {"items": []}
        with patch(
            "services.youtube.youtube_studio_ops_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).update_video_metadata(
                USER_ID, video_id="missing", title="x"
            )

        assert result["success"] is False
        assert result["error_code"] == "video_not_found"
        youtube.videos.return_value.update.assert_not_called()

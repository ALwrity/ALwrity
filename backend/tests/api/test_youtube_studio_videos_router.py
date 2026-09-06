"""GET /api/youtube/studio/videos and related Stale Refresh HITL routes."""

from __future__ import annotations

from unittest.mock import MagicMock

from api.youtube.studio_ops_router import get_studio_ops
from tests.api.youtube_studio_test_client import youtube_studio_client


class TestYouTubeStudioVideosRouter:
    def test_list_videos_forwards_max_results(self):
        service = MagicMock()
        service.list_channel_videos.return_value = {
            "success": True,
            "videos": [
                {
                    "video_id": "vid-1",
                    "title": "Rank Videos in 7 Days",
                    "view_count": 1200,
                    "like_count": 10,
                    "comment_count": 2,
                }
            ],
            "message": "Loaded 1 videos.",
        }
        client = youtube_studio_client({get_studio_ops: lambda: service})

        resp = client.get("/api/youtube/studio/videos", params={"max_results": 12})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["videos"][0]["video_id"] == "vid-1"
        assert body["videos"][0]["view_count"] == 1200
        assert body["videos"][0]["like_count"] == 10
        service.list_channel_videos.assert_called_once()
        kwargs = service.list_channel_videos.call_args.kwargs
        assert kwargs["max_results"] == 12

    def test_list_videos_rejects_unauthenticated_user(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from api.youtube.router import router as youtube_router

        app = FastAPI()
        app.include_router(youtube_router, prefix="/api")
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/youtube/studio/videos")
        assert resp.status_code in (401, 403)

    def test_update_metadata_returns_service_payload(self):
        service = MagicMock()
        service.update_video_metadata.return_value = {
            "success": True,
            "video_id": "vid-1",
            "message": "Metadata updated.",
        }
        client = youtube_studio_client({get_studio_ops: lambda: service})

        resp = client.post(
            "/api/youtube/studio/videos/update-metadata",
            json={
                "video_id": "vid-1",
                "title": "New title",
                "description": "New desc",
                "tags": ["seo"],
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["video_id"] == "vid-1"
        service.update_video_metadata.assert_called_once()

    def test_stale_refresh_suggest_returns_service_pack(self):
        service = MagicMock()
        service.suggest_stale_refresh.return_value = {
            "success": True,
            "suggestion": {"new_title": "Refreshed", "new_tags": ["a"]},
            "message": "Refresh pack ready — review before applying (HITL).",
        }
        client = youtube_studio_client({get_studio_ops: lambda: service})

        resp = client.post(
            "/api/youtube/studio/stale-refresh/suggest",
            json={"title": "Old title", "description": "d", "tags": ["seo"], "niche": "seo"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["suggestion"]["new_title"] == "Refreshed"
        service.suggest_stale_refresh.assert_called_once()

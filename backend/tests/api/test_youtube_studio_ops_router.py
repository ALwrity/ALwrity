"""YouTube studio ops router — playlists, stale refresh, gaps. Error paths only."""

from __future__ import annotations

from unittest.mock import MagicMock

from api.youtube.studio_ops_router import get_studio_ops
from tests.api.youtube_studio_test_client import youtube_studio_client


class TestYouTubeStudioOpsRouter:
    def test_ops_paths_are_mounted(self):
        from api.youtube.router import router as youtube_router

        paths = {getattr(r, "path", "") for r in youtube_router.routes}
        assert "/youtube/studio/videos" in paths
        assert "/youtube/studio/playlists" in paths
        assert "/youtube/studio/playlists/add" in paths
        assert "/youtube/studio/stale-refresh/suggest" in paths
        assert "/youtube/studio/videos/update-metadata" in paths

    def test_list_videos_returns_empty_on_not_connected(self):
        service = MagicMock()
        service.list_channel_videos.return_value = {
            "success": False,
            "error_code": "not_connected",
            "message": "Connect YouTube first.",
            "videos": [],
        }
        client = youtube_studio_client({get_studio_ops: lambda: service})

        resp = client.get("/api/youtube/studio/videos")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body.get("videos") == []
        assert body.get("view_count") is None

    def test_playlists_add_returns_service_error(self):
        service = MagicMock()
        service.add_video_to_playlist.return_value = {
            "success": False,
            "message": "Connect YouTube to attach playlists.",
        }
        client = youtube_studio_client({get_studio_ops: lambda: service})

        resp = client.post(
            "/api/youtube/studio/playlists/add",
            json={"playlist_id": "PL1", "video_id": "vid1"},
        )

        assert resp.status_code == 200
        assert resp.json()["success"] is False

    def test_stale_refresh_requires_title(self):
        service = MagicMock()
        client = youtube_studio_client({get_studio_ops: lambda: service})

        resp = client.post(
            "/api/youtube/studio/stale-refresh/suggest",
            json={"title": "", "description": "x"},
        )

        assert resp.status_code == 422
        service.suggest_stale_refresh.assert_not_called()

    def test_content_gaps_returns_empty_gaps_on_failure(self):
        service = MagicMock()
        service.content_gap_ideas.return_value = {
            "success": False,
            "message": "Could not generate gaps.",
            "gaps": [],
        }
        client = youtube_studio_client({get_studio_ops: lambda: service})

        resp = client.post("/api/youtube/studio/content-gaps", json={"niche": "saas"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["gaps"] == []

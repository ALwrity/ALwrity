"""
Phase 1 data-layer routes: OAuth path (no double /youtube), analytics/comments
error payloads, optional publish_at. Does not invent channel metrics.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _fake_user(uid: str = "user_data_layer") -> dict:
    return {"id": uid, "email": "test@example.com"}


def _studio_client(overrides: dict | None = None) -> TestClient:
    from middleware.auth_middleware import get_current_user
    from api.youtube.router import router as youtube_router

    app = FastAPI()
    app.include_router(youtube_router, prefix="/api")
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    for dep, fn in (overrides or {}).items():
        app.dependency_overrides[dep] = fn
    return TestClient(app, raise_server_exceptions=False)


class TestYouTubeRoutePrefixes:
    def test_oauth_status_path_is_single_youtube_segment(self):
        from api.youtube.router import router as youtube_router

        paths = {getattr(r, "path", "") for r in youtube_router.routes}
        assert "/youtube/oauth/status" in paths
        assert "/youtube/youtube/oauth/status" not in paths

    def test_publish_path_is_single_youtube_segment(self):
        from api.youtube.router import router as youtube_router

        paths = {getattr(r, "path", "") for r in youtube_router.routes}
        assert "/youtube/publish" in paths
        assert "/youtube/youtube/publish" not in paths

    def test_analytics_and_comments_paths_are_mounted(self):
        from api.youtube.router import router as youtube_router

        paths = {getattr(r, "path", "") for r in youtube_router.routes}
        assert "/youtube/analytics/pulse" in paths
        assert "/youtube/analytics/retention" in paths
        assert "/youtube/comments/inbox" in paths
        assert "/youtube/studio/videos" in paths


class TestOAuthStatusEndpoint:
    def test_status_returns_200_not_404(self):
        from api.youtube.oauth_router import get_oauth_service

        oauth = MagicMock()
        oauth.get_connection_status.return_value = {
            "connected": False,
            "channels": [],
            "analytics_ready": False,
        }
        client = _studio_client({get_oauth_service: lambda: oauth})

        resp = client.get("/api/youtube/oauth/status")

        assert resp.status_code == 200
        body = resp.json()
        assert body.get("success") is True
        assert body.get("connected") is False
        assert "channels" in body
        oauth.get_connection_status.assert_called_once_with("user_data_layer")

    def test_legacy_double_prefix_is_not_found(self):
        from api.youtube.oauth_router import get_oauth_service

        oauth = MagicMock()
        oauth.get_connection_status.return_value = {"connected": False, "channels": []}
        client = _studio_client({get_oauth_service: lambda: oauth})

        resp = client.get("/api/youtube/youtube/oauth/status")
        assert resp.status_code == 404


class TestAnalyticsAndCommentsErrorPayloads:
    def test_pulse_returns_service_error_not_fake_metrics(self):
        from api.youtube.analytics_router import get_analytics_service

        service = MagicMock()
        service.get_channel_pulse.return_value = {
            "success": False,
            "message": "YouTube is not connected.",
        }
        client = _studio_client({get_analytics_service: lambda: service})

        resp = client.get("/api/youtube/analytics/pulse")

        assert resp.status_code == 200
        body = resp.json()
        assert body.get("success") is False
        assert body.get("message")
        assert "views" not in body or body.get("views") in (None, 0)

    def test_inbox_returns_service_error_not_fake_comments(self):
        from api.youtube.comments_router import get_comments_service

        service = MagicMock()
        service.list_inbox.return_value = {
            "success": False,
            "message": "YouTube is not connected.",
            "comments": [],
        }
        client = _studio_client({get_comments_service: lambda: service})

        resp = client.get("/api/youtube/comments/inbox")

        assert resp.status_code == 200
        body = resp.json()
        assert body.get("success") is False
        assert body.get("comments") == []


class TestPublishAtIsOptional:
    def test_publish_request_accepts_omitted_publish_at(self):
        from api.youtube.publish_router import PublishRequest

        req = PublishRequest(
            token_id=1,
            video_source="/tmp/video.mp4",
            title="Test video title",
        )
        assert req.publish_at is None
        assert req.privacy_status == "unlisted"

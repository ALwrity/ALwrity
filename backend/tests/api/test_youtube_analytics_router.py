"""YouTube analytics router — error paths, no invented channel metrics."""

from __future__ import annotations

from unittest.mock import MagicMock

from api.youtube.analytics_router import get_analytics_service
from tests.api.youtube_studio_test_client import youtube_studio_client


class TestYouTubeAnalyticsRouter:
    def test_pulse_path_is_mounted_once(self):
        from api.youtube.router import router as youtube_router

        paths = {getattr(r, "path", "") for r in youtube_router.routes}
        assert "/youtube/analytics/pulse" in paths
        assert "/youtube/analytics/retention" in paths
        assert "/youtube/youtube/analytics/pulse" not in paths

    def test_pulse_returns_service_error_without_fake_views(self):
        service = MagicMock()
        service.get_channel_pulse.return_value = {
            "success": False,
            "error_code": "not_connected",
            "message": "Connect YouTube to load channel pulse.",
        }
        client = youtube_studio_client({get_analytics_service: lambda: service})

        resp = client.get("/api/youtube/analytics/pulse")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert "Connect YouTube" in body["message"]
        assert "subscriber_count" not in body
        assert body.get("views") is None
        service.get_channel_pulse.assert_called_once()

    def test_retention_propagates_reconnect_payload(self):
        service = MagicMock()
        service.get_retention_summary.return_value = {
            "success": False,
            "error_code": "not_connected",
            "message": "Connect YouTube to load channel pulse.",
        }
        client = youtube_studio_client({get_analytics_service: lambda: service})

        resp = client.get("/api/youtube/analytics/retention?days=28")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body.get("average_view_duration_seconds") is None
        assert body.get("estimated_minutes_watched") is None

    def test_pulse_rejects_unauthenticated_user(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from api.youtube.router import router as youtube_router

        app = FastAPI()
        app.include_router(youtube_router, prefix="/api")
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/youtube/analytics/pulse")
        assert resp.status_code in (401, 403)

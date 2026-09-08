"""YouTube analytics router — error paths, no invented channel metrics."""

from __future__ import annotations

from unittest.mock import MagicMock

from api.youtube.analytics_router import get_analytics_service
from tests.api.youtube_studio_test_client import youtube_studio_client


def _mounted_youtube_paths() -> set[str]:
    from api.youtube.router import router as youtube_router

    found: set[str] = set()
    for route in youtube_router.routes:
        orig = getattr(route, "original_router", None)
        ctx = getattr(route, "include_context", None)
        parent = getattr(ctx, "prefix", "") or ""
        if orig is None:
            path = getattr(route, "path", "") or ""
            if path:
                found.add(path)
            continue
        for child in orig.routes:
            child_path = getattr(child, "path", "") or ""
            if child_path:
                found.add(f"{parent}{child_path}")
    return found


class TestYouTubeAnalyticsRouter:
    def test_pulse_path_is_mounted_once(self):
        paths = _mounted_youtube_paths()
        assert "/youtube/analytics/pulse" in paths
        assert "/youtube/analytics/retention" in paths
        assert "/youtube/analytics/overview" in paths
        assert "/youtube/youtube/analytics/pulse" not in paths
        assert "/youtube/youtube/analytics/overview" not in paths

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

    def test_overview_rejects_unauthenticated_user(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from api.youtube.router import router as youtube_router

        app = FastAPI()
        app.include_router(youtube_router, prefix="/api")
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/youtube/analytics/overview")
        assert resp.status_code in (401, 403)

    def test_overview_rejects_days_outside_pulse_window(self):
        service = MagicMock()
        client = youtube_studio_client({get_analytics_service: lambda: service})
        too_low = client.get("/api/youtube/analytics/overview?days=0")
        too_high = client.get("/api/youtube/analytics/overview?days=91")
        assert too_low.status_code == 422
        assert too_high.status_code == 422
        service.get_channel_overview.assert_not_called()

    def test_overview_returns_service_payload_without_fake_views(self):
        service = MagicMock()
        service.get_channel_overview.return_value = {
            "success": False,
            "error_code": "analytics_unavailable",
            "message": "Channel overview is unavailable for this window.",
        }
        client = youtube_studio_client({get_analytics_service: lambda: service})
        resp = client.get("/api/youtube/analytics/overview?days=28")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body.get("current") is None
        service.get_channel_overview.assert_called_once()
        assert service.get_channel_overview.call_args.kwargs["days"] == 28

    def test_overview_route_hides_unexpected_error_text(self):
        service = MagicMock()
        service.get_channel_overview.side_effect = RuntimeError("filters=video==secret")
        client = youtube_studio_client({get_analytics_service: lambda: service})
        resp = client.get("/api/youtube/analytics/overview?days=28")
        assert resp.status_code == 500
        detail = resp.json().get("detail") or ""
        assert detail == "Channel overview request failed."
        assert "video==" not in detail

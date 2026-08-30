"""Functional journey: Connect YouTube → status connected → Disconnect → status disconnected.

Exercises the FastAPI HTTP path used by Creator Studio. Google token
exchange is stubbed on the OAuth service so this suite validates wiring,
not live Google Cloud.
"""

from __future__ import annotations

import pytest

from api.youtube.oauth_router import get_oauth_service
from tests.api.youtube_studio_test_client import youtube_studio_client
from tests.framework.http import assert_status

pytestmark = [pytest.mark.functional]


class _StudioYouTubeOAuthStub:
    """In-memory stand-in for YouTubeOAuthService across one user journey."""

    def __init__(self) -> None:
        self.connected = False
        self.channels: list[dict] = []

    def generate_authorization_url(self, user_id: str):
        assert user_id
        return (
            "https://accounts.google.com/o/oauth2/auth"
            "?client_id=test&redirect_uri=http://localhost:8000/api/youtube/oauth/callback"
        )

    def get_connection_status(self, user_id: str) -> dict:
        assert user_id
        return {
            "connected": self.connected,
            "channels": list(self.channels),
            "analytics_ready": self.connected,
        }

    def handle_oauth_callback(self, authorization_code: str, state: str) -> dict:
        assert authorization_code
        assert ":" in state
        self.connected = True
        self.channels = [
            {
                "token_id": 42,
                "channel_id": "UCjourney",
                "channel_name": "Journey Channel",
                "is_active": True,
            }
        ]
        return {
            "success": True,
            "channel_id": "UCjourney",
            "channel_name": "Journey Channel",
        }

    def revoke_token(self, user_id: str, token_id: int) -> bool:
        assert user_id
        if token_id != 42:
            return False
        self.connected = False
        for channel in self.channels:
            channel["is_active"] = False
        return True


class TestYouTubeOAuthConnectDisconnectJourney:
    def test_connect_then_disconnect_updates_status(self):
        stub = _StudioYouTubeOAuthStub()
        client = youtube_studio_client({get_oauth_service: lambda: stub})

        status = client.get("/api/youtube/oauth/status")
        assert_status(status, 200)
        assert status.json()["connected"] is False

        auth = client.get("/api/youtube/oauth/auth/url")
        assert_status(auth, 200)
        assert "accounts.google.com" in auth.json()["auth_url"]
        assert "redirect_uri=" in auth.json()["auth_url"]

        callback = client.get(
            "/api/youtube/oauth/callback",
            params={"code": "google-auth-code", "state": "user_studio_hardening:nonce"},
        )
        assert_status(callback, 200)
        assert "YOUTUBE_OAUTH_SUCCESS" in callback.text
        assert "Journey Channel" in callback.text

        connected = client.get("/api/youtube/oauth/status")
        assert_status(connected, 200)
        body = connected.json()
        assert body["connected"] is True
        assert body["channels"][0]["token_id"] == 42

        disconnect = client.delete("/api/youtube/oauth/disconnect/42")
        assert_status(disconnect, 200)
        assert disconnect.json()["success"] is True

        after = client.get("/api/youtube/oauth/status")
        assert_status(after, 200)
        assert after.json()["connected"] is False
        assert after.json()["channels"][0]["is_active"] is False

"""YouTube OAuth router HTTP contract (connect / disconnect / callback)."""

from __future__ import annotations

from unittest.mock import MagicMock

from fastapi import HTTPException

from api.youtube.oauth_router import get_oauth_service
from middleware.auth_middleware import get_current_user
from tests.api.youtube_studio_test_client import youtube_studio_client


def _oauth_service(**methods) -> MagicMock:
    service = MagicMock()
    service.generate_authorization_url.return_value = (
        "https://accounts.google.com/o/oauth2/auth?client_id=test"
    )
    service.get_connection_status.return_value = {
        "connected": False,
        "channels": [],
        "analytics_ready": False,
    }
    service.handle_oauth_callback.return_value = {"success": False, "error": "unused"}
    service.revoke_token.return_value = True
    for name, value in methods.items():
        getattr(service, name).return_value = value
    return service


def _client(service: MagicMock):
    return youtube_studio_client({get_oauth_service: lambda: service})


class TestYouTubeOAuthAuthUrl:
    def test_returns_google_auth_url_for_authenticated_user(self):
        service = _oauth_service()
        resp = _client(service).get("/api/youtube/oauth/auth/url")

        assert resp.status_code == 200
        assert resp.json()["auth_url"].startswith("https://accounts.google.com/")
        service.generate_authorization_url.assert_called_once_with("user_studio_hardening")

    def test_returns_500_when_auth_url_cannot_be_generated(self):
        service = _oauth_service(generate_authorization_url=None)
        resp = _client(service).get("/api/youtube/oauth/auth/url")

        assert resp.status_code == 500
        assert "authorization" in resp.json()["detail"].lower()

    def test_requires_authentication(self):
        service = _oauth_service()

        def _deny():
            raise HTTPException(status_code=401, detail="Authentication required")

        client = youtube_studio_client(
            {get_oauth_service: lambda: service, get_current_user: _deny}
        )
        resp = client.get("/api/youtube/oauth/auth/url")
        assert resp.status_code == 401


class TestYouTubeOAuthStatus:
    def test_returns_disconnected_payload(self):
        service = _oauth_service()
        resp = _client(service).get("/api/youtube/oauth/status")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["connected"] is False
        assert body["channels"] == []
        service.get_connection_status.assert_called_once_with("user_studio_hardening")

    def test_returns_connected_channel(self):
        service = _oauth_service(
            get_connection_status={
                "connected": True,
                "channels": [
                    {
                        "token_id": 12,
                        "channel_id": "UCabc",
                        "channel_name": "Studio Channel",
                        "is_active": True,
                    }
                ],
                "analytics_ready": True,
            }
        )
        resp = _client(service).get("/api/youtube/oauth/status")

        assert resp.status_code == 200
        body = resp.json()
        assert body["connected"] is True
        assert body["channels"][0]["token_id"] == 12
        assert body["channels"][0]["channel_name"] == "Studio Channel"


class TestYouTubeOAuthDisconnect:
    def test_disconnect_revokes_token_for_current_user(self):
        service = _oauth_service()
        resp = _client(service).delete("/api/youtube/oauth/disconnect/12")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "disconnected" in body["message"].lower()
        service.revoke_token.assert_called_once_with("user_studio_hardening", 12)

    def test_disconnect_reports_failure_when_revoke_fails(self):
        service = _oauth_service(revoke_token=False)
        resp = _client(service).delete("/api/youtube/oauth/disconnect/12")

        assert resp.status_code == 200
        assert resp.json()["success"] is False

    def test_disconnect_requires_authentication(self):
        service = _oauth_service()

        def _deny():
            raise HTTPException(status_code=401, detail="Authentication required")

        client = youtube_studio_client(
            {get_oauth_service: lambda: service, get_current_user: _deny}
        )
        resp = client.delete("/api/youtube/oauth/disconnect/12")
        assert resp.status_code == 401


class TestYouTubeOAuthCallback:
    def test_user_denied_posts_oauth_error(self):
        service = _oauth_service()
        resp = _client(service).get(
            "/api/youtube/oauth/callback",
            params={"error": "access_denied"},
        )

        assert resp.status_code == 200
        assert "YOUTUBE_OAUTH_ERROR" in resp.text
        assert "access_denied" in resp.text
        service.handle_oauth_callback.assert_not_called()

    def test_missing_code_or_state_is_an_error(self):
        service = _oauth_service()
        resp = _client(service).get("/api/youtube/oauth/callback")

        assert resp.status_code == 200
        assert "YOUTUBE_OAUTH_ERROR" in resp.text
        service.handle_oauth_callback.assert_not_called()

    def test_successful_exchange_posts_oauth_success(self):
        service = _oauth_service(
            handle_oauth_callback={
                "success": True,
                "channel_id": "UCabc",
                "channel_name": "Studio Channel",
            }
        )
        resp = _client(service).get(
            "/api/youtube/oauth/callback",
            params={"code": "auth-code", "state": "user_studio_hardening:nonce"},
        )

        assert resp.status_code == 200
        assert "YOUTUBE_OAUTH_SUCCESS" in resp.text
        assert "Studio Channel" in resp.text
        service.handle_oauth_callback.assert_called_once_with(
            authorization_code="auth-code",
            state="user_studio_hardening:nonce",
        )

    def test_failed_exchange_posts_oauth_error(self):
        service = _oauth_service(
            handle_oauth_callback={"success": False, "error": "Invalid or expired state"}
        )
        resp = _client(service).get(
            "/api/youtube/oauth/callback",
            params={"code": "auth-code", "state": "user_x:nonce"},
        )

        assert resp.status_code == 200
        assert "YOUTUBE_OAUTH_ERROR" in resp.text
        assert "Invalid or expired state" in resp.text

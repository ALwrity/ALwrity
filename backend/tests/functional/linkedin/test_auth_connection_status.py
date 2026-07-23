"""Functional tests for LinkedIn account connection / OAuth-connection surface.

Endpoints covered:
* GET  /api/linkedin-social/connection/status
* GET  /api/linkedin-social/unipile/health
* GET  /api/linkedin-social/auth/url
* POST /api/linkedin-social/disconnect

These tests run through the full FastAPI HTTP path (``linkedin_client``
is a ``TestClient`` over the LinkedIn test app with auth overridden to
a fake user). Service-layer behaviour is replaced with monkeypatched
stubs so we exercise wiring, not OAuth token plumbing.

Note: a deeper end-to-end test that hits ``connection/status`` against
a real per-user OAuth SQLite row is intentionally not part of this
MVP — it's covered indirectly by ``test_linkedin_oauth.py`` at the
service level. Adding it here would require the ``linkedin_oauth_db``
fixture to also redirect OAuth-specific DB lookups (the current
``patch_user_db_path`` fixture patches DB-path resolution but the
oauth service resolves its own path through different aliases).
"""

from __future__ import annotations

import pytest

from tests.framework.http import assert_status

pytestmark = [pytest.mark.linkedin, pytest.mark.functional]


# -------------------------------------------------------------------------
# /connection/status — covers the most common UX flow (is the user connected?)
# -------------------------------------------------------------------------
class TestConnectionStatus:
    """GET /api/linkedin-social/connection/status."""

    def test_returns_disconnected_for_unconnected_user(
        self, linkedin_client, monkeypatch
    ):
        """An user with no OAuth row must report disconnected (provider=unipile)."""
        from api.linkedin_oauth_connection_routes import _oauth_service

        def _fake_status(self, user_id):
            return {
                "connected": False,
                "provider": "unipile",
                "has_per_user_token": False,
                "has_env_fallback": False,
                "accounts": [],
                "account_name": None,
            }

        monkeypatch.setattr(
            type(_oauth_service), "get_connection_status", _fake_status
        )

        response = linkedin_client.get(
            "/api/linkedin-social/connection/status"
        )
        assert_status(response, 200)
        payload = response.json()
        assert payload["connected"] is False
        assert payload["provider"] == "unipile"
        assert payload["accounts"] == []
        assert payload["organizations"] == []
        assert payload["has_per_user_token"] is False

    def test_returns_connected_with_env_fallback_accounts(
        self, linkedin_client, monkeypatch
    ):
        """If the OAuth service reports accounts, route must return them."""
        from api.linkedin_oauth_connection_routes import _oauth_service

        def _fake_status(self, user_id):
            return {
                "connected": True,
                "provider": "unipile",
                "has_per_user_token": False,
                "has_env_fallback": True,
                "accounts": [
                    {
                        "account_id": "AC_ENV",
                        "account_type": "personal",
                        "source": "env_fallback",
                    },
                    {
                        "account_id": "ORG_ENV",
                        "account_type": "organization",
                        "source": "env_fallback",
                    },
                ],
                "account_name": "Env User",
            }

        monkeypatch.setattr(
            type(_oauth_service), "get_connection_status", _fake_status
        )

        response = linkedin_client.get(
            "/api/linkedin-social/connection/status"
        )
        assert_status(response, 200)
        payload = response.json()
        assert payload["connected"] is True
        assert payload["provider"] == "unipile"
        assert payload["has_env_fallback"] is True
        assert {a["account_id"] for a in payload["accounts"]} == {
            "AC_ENV",
            "ORG_ENV",
        }


# -------------------------------------------------------------------------
# /unipile/health — pre-connect diagnostics
# -------------------------------------------------------------------------
class TestUnipileHealth:
    """GET /api/linkedin-social/unipile/health."""

    def test_503_when_probes_fail(self, linkedin_client, monkeypatch):
        """If the cached Unipile health probe is unhealthy, return 503."""
        monkeypatch.setattr(
            "api.linkedin_oauth_connection_routes.get_cached_unipile_health",
            lambda: {"healthy": False, "reason": "no_api_key"},
        )

        response = linkedin_client.get(
            "/api/linkedin-social/unipile/health"
        )
        assert_status(response, 503)
        assert response.json()["detail"]["reason"] == "no_api_key"


# -------------------------------------------------------------------------
# /auth/url — what URL we send the browser to
# -------------------------------------------------------------------------
class TestAuthorizationURL:
    """GET /api/linkedin-social/auth/url."""

    def test_returns_unipile_url_when_provider_present(
        self, linkedin_client, monkeypatch
    ):
        from services.integrations.linkedin_oauth import LinkedInOAuthService

        async def _fake_generate(self, user_id, state=None, callback_base=None):
            return {
                "auth_url": "https://unipile.example/auth?token=abc",
                "state": "user_linkedin:dummy",
                "provider": "unipile",
            }

        monkeypatch.setattr(
            LinkedInOAuthService,
            "generate_authorization_url",
            _fake_generate,
        )

        response = linkedin_client.get(
            "/api/linkedin-social/auth/url",
            params={"state": "user_linkedin"},
        )
        assert_status(response, 200)
        payload = response.json()
        # Route returns "authorization_url" key.
        assert payload["authorization_url"].startswith("https://unipile.example/")
        assert payload["state"] == "user_linkedin:dummy"


# -------------------------------------------------------------------------
# /disconnect — wipes the per-user token row
# -------------------------------------------------------------------------
class TestDisconnect:
    """POST /api/linkedin-social/disconnect."""

    def test_disconnect_invokes_oauth_service_with_current_user(
        self, linkedin_client, monkeypatch
    ):
        from api.linkedin_oauth_connection_routes import _oauth_service

        captured = {"called_with": None}

        async def _fake_disconnect(self, user_id):
            captured["called_with"] = user_id
            return {
                "success": True,
                "connected": False,
                "revoked": 1,
                "unipile_account_deleted": True,
            }

        monkeypatch.setattr(
            type(_oauth_service), "disconnect_user", _fake_disconnect
        )

        response = linkedin_client.post("/api/linkedin-social/disconnect")
        assert_status(response, 200)
        assert captured["called_with"] == "user_linkedin"
        payload = response.json()
        assert payload["success"] is True
        assert payload["connected"] is False

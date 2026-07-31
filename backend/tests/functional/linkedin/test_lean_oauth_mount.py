"""Lean LinkedIn-only mount regression tests.

Protects the Connect LinkedIn flow when ``ALWRITY_ENABLED_FEATURES=linkedin``
runs without Google/GSC packages (``requirements-linkedin.txt``).

Regression: eager ``create_oauth_monitoring_tasks`` / GSC imports caused
``Failed to mount linkedin_oauth_connection`` and a frontend 404 on
``GET /api/linkedin-social/auth/url``.
"""

from __future__ import annotations

import pytest

from tests.framework.http import assert_status

pytestmark = [pytest.mark.linkedin, pytest.mark.functional]


class TestLeanOauthConnectionMount:
    """LinkedIn OAuth connection router must load without monitoring deps."""

    def test_connection_router_exposes_auth_url_route(self):
        from api.linkedin_oauth_connection_routes import router

        paths = [getattr(route, "path", "") for route in router.routes]
        assert "/api/linkedin-social/auth/url" in paths
        assert "/api/linkedin-social/connection/status" in paths
        assert "/api/linkedin-social/callback" in paths

    def test_connection_module_has_no_eager_monitoring_import(self):
        """Monitoring helper must be imported inside callback, not at module load."""
        import api.linkedin_oauth_connection_routes as mod

        assert "create_oauth_monitoring_tasks" not in mod.__dict__, (
            "create_oauth_monitoring_tasks must be lazy-imported so LinkedIn "
            "Connect mounts in lean mode without GSC/Google packages"
        )

    def test_unipile_webhook_module_has_no_eager_monitoring_import(self):
        import api.unipile_webhook_routes as mod

        assert "create_oauth_monitoring_tasks" not in mod.__dict__, (
            "create_oauth_monitoring_tasks must be lazy-imported so Unipile "
            "webhook mounts in lean LinkedIn-only mode"
        )


class TestAuthUrlRouteStillWorks:
    """HTTP path for /auth/url must keep working after the lean-import change."""

    def test_auth_url_returns_provider_payload(self, linkedin_client, monkeypatch):
        from services.integrations.linkedin_oauth import LinkedInOAuthService

        async def _fake_generate(self, user_id, state=None, callback_base=None):
            return {
                "auth_url": "https://unipile.example/auth?token=lean",
                "state": "user_linkedin:lean",
                "provider": "unipile",
            }

        monkeypatch.setattr(
            LinkedInOAuthService,
            "generate_authorization_url",
            _fake_generate,
        )

        response = linkedin_client.get(
            "/api/linkedin-social/auth/url",
            params={"callback_base": "http://127.0.0.1:8000"},
        )
        assert_status(response, 200)
        payload = response.json()
        assert payload["authorization_url"].startswith("https://unipile.example/")
        assert payload["provider"] == "unipile"
        assert payload["state"] == "user_linkedin:lean"

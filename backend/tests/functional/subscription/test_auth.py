"""Tests for authentication and access control enforcement.

Validates that:
- Anonymous (unsigned) users cannot access protected endpoints
- Signed-in users can access protected endpoints within their limits
- The auth middleware correctly identifies signed-in vs anonymous users
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

pytestmark = [pytest.mark.subscription_sanity, pytest.mark.functional]


# ==========================================================================
# Auth middleware unit tests
# ==========================================================================

class TestAuthMiddleware:
    """Verify auth dependency injection correctly identifies user state."""

    def test_get_optional_user_returns_none_for_anonymous(self):
        """An anonymous request (no token) gets None from get_optional_user."""
        from middleware.auth_middleware import get_optional_user

        app = FastAPI()

        @app.get("/test")
        async def test_route(user=Depends(get_optional_user)):
            return {"authenticated": user is not None, "user": user}

        client = TestClient(app)
        resp = client.get("/test")
        assert resp.status_code == 200
        assert resp.json()["authenticated"] is False
        assert resp.json()["user"] is None

    def test_get_current_user_rejects_anonymous(self):
        """An anonymous request (no token) gets 401 from get_current_user."""
        from middleware.auth_middleware import get_current_user

        app = FastAPI()

        @app.get("/test")
        async def test_route(user=Depends(get_current_user)):
            return {"user": str(user)}

        client = TestClient(app)
        resp = client.get("/test")
        assert resp.status_code == 401

    def test_get_current_user_with_token_rejects_anonymous(self):
        """An anonymous request gets 401 from get_current_user_with_query_token."""
        from middleware.auth_middleware import get_current_user_with_query_token

        app = FastAPI()

        @app.get("/test")
        async def test_route(user=Depends(get_current_user_with_query_token)):
            return {"user": str(user)}

        client = TestClient(app)
        resp = client.get("/test")
        assert resp.status_code == 401


# ==========================================================================
# Route protection: anonymous vs signed-in
# ==========================================================================

class TestRouteProtection:
    """Verify that protected endpoints reject anonymous access and accept
    signed-in access when auth is overridden."""

    def test_anonymous_blocked_from_subscription_status(self, monkeypatch):
        """Anonymous users should get 401 from subscription status endpoint."""
        monkeypatch.setenv("STRIPE_PLAN_PRICE_MAPPING_TEST", '{"free":{"monthly":"price_test"},"basic":{"monthly":"price_test"},"pro":{"monthly":"price_test"},"enterprise":{"monthly":"price_test"}}')
        from api.subscription.routes.subscriptions import router as subs_router
        app = FastAPI()
        app.include_router(subs_router)
        client = TestClient(app)
        resp = client.get("/status/user_anonymous")
        assert resp.status_code == 401

    def test_signed_in_user_can_access_status(self):
        """Signed-in user with auth override should access subscription status."""
        from api.subscription.routes.subscriptions import router as subs_router
        from tests.framework.auth import fake_user_factory

        app = FastAPI()
        app.include_router(subs_router)

        async def _fake_user():
            return fake_user_factory(uid="user_test_123")

        app.dependency_overrides[
            __import__("middleware.auth_middleware", fromlist=["get_current_user"]).get_current_user
        ] = _fake_user

        client = TestClient(app)
        resp = client.get("/status/user_test_123")
        assert resp.status_code == 200

    def test_anonymous_blocked_from_usage_endpoint(self):
        """Anonymous users should get 401 from usage endpoint."""
        from api.subscription.routes.usage import router as usage_router
        app = FastAPI()
        app.include_router(usage_router)
        client = TestClient(app)
        resp = client.get("/usage/user_anonymous")
        assert resp.status_code == 401

    def test_anonymous_blocked_from_dashboard(self):
        """Anonymous users should get 401 from dashboard endpoint."""
        from api.subscription.routes.dashboard import router as dashboard_router
        app = FastAPI()
        app.include_router(dashboard_router)
        client = TestClient(app)
        resp = client.get("/dashboard/user_anonymous")
        assert resp.status_code == 401

    def test_anonymous_blocked_from_preflight(self):
        """Anonymous users should get 401 from preflight endpoint."""
        from api.subscription.routes.preflight import router as preflight_router
        app = FastAPI()
        app.include_router(preflight_router)
        client = TestClient(app)
        resp = client.post("/preflight-check", json={})
        assert resp.status_code == 401

    def test_optional_auth_allows_anonymous(self, monkeypatch):
        """Endpoints with optional auth should allow anonymous access."""
        monkeypatch.setenv("STRIPE_PLAN_PRICE_MAPPING_TEST", "free=price_test,basic=price_test,pro=price_test,enterprise=price_test")
        from tests.framework.service_stubs import install_llm_image_stubs
        install_llm_image_stubs()
        from api.brainstorm import router as brainstorm_router
        from tests.framework.auth import fake_user_factory

        app = FastAPI()
        app.include_router(brainstorm_router)

        # The brainstorm /ideas endpoint uses get_optional_user via Depends
        # When no token is present, get_optional_user returns None
        # But the LLM call would fail — we just check auth isn't blocking
        resp = TestClient(app).post("/ideas", json={"seed": "test", "count": 3})
        # 422 = validation error (missing user context, not auth) or 401
        # Either way, auth_is_not_the_blocker — 401 only if auth blocks
        assert resp.status_code != 401, (
            f"Optional auth endpoint returned 401 — should allow anonymous. "
            f"Got {resp.status_code}: {resp.text[:200]}"
        )


# ==========================================================================
# Fake user factory for tests
# ==========================================================================

class TestFakeUserFactory:
    """Verify the test auth framework can produce valid fake users."""

    def test_fake_user_has_required_fields(self):
        from tests.framework.auth import fake_user_factory
        user = fake_user_factory(uid="user_test_001")
        assert user["id"] == "user_test_001"
        assert user["email"] == "test@example.com"
        assert user["is_active"] is True
        assert "clerk_user_id" in user

    def test_fake_user_for_returns_callable(self):
        from tests.framework.auth import fake_user_for
        factory = fake_user_for("uid_custom_99")
        user = factory()
        assert user["id"] == "uid_custom_99"
        assert callable(factory)

    def test_fake_user_with_extras(self):
        from tests.framework.auth import fake_user_factory
        user = fake_user_factory(uid="extra_user", extras={"custom_field": "value"})
        assert user["custom_field"] == "value"


# ==========================================================================
# Auth dependency override tests
# ==========================================================================

class TestAuthOverride:
    """Verify the auth dependency override mechanism works correctly."""

    def test_override_applies_to_both_deps(self):
        from tests.framework.auth import fake_user_factory, override_auth_deps
        from middleware.auth_middleware import (
            get_current_user,
            get_current_user_with_query_token,
        )

        app = FastAPI()
        override_auth_deps(app, lambda: fake_user_factory(uid="override_test"))

        assert get_current_user in app.dependency_overrides
        assert get_current_user_with_query_token in app.dependency_overrides

    def test_clear_removes_overrides(self):
        from tests.framework.auth import fake_user_factory, override_auth_deps, clear_auth_overrides

        app = FastAPI()
        override_auth_deps(app, lambda: fake_user_factory())
        clear_auth_overrides(app)

        from middleware.auth_middleware import get_current_user
        assert get_current_user not in app.dependency_overrides


# ==========================================================================
# Subscription plan-based access control
# ==========================================================================

class TestPlanBasedAccess:
    """Verify that different subscription plans get appropriate access levels."""

    def test_free_plan_has_limited_features(self):
        """Free plan features list must not include premium features."""
        import yaml
        pricing_path = _BACKEND_ROOT / "config" / "pricing.yaml"
        with open(pricing_path, "r") as f:
            raw = yaml.safe_load(f)

        free = raw["plans"][0]
        assert free["name"] == "Free"
        assert "unlimited_everything" not in free["features"]
        assert "white_label" not in free["features"]
        assert "dedicated_support" not in free["features"]

    def test_enterprise_has_all_features(self):
        """Enterprise plan must have premium features."""
        import yaml
        pricing_path = _BACKEND_ROOT / "config" / "pricing.yaml"
        with open(pricing_path, "r") as f:
            raw = yaml.safe_load(f)

        ent = raw["plans"][3]
        assert ent["name"] == "Enterprise"
        assert "unlimited_everything" in ent["features"]
        assert "white_label" in ent["features"]
        assert "dedicated_support" in ent["features"]
        assert "custom_integrations" in ent["features"]

    def test_free_plan_ai_text_limit_constrains_access(self):
        """Free plan with 50 calls limits what users can do."""
        import yaml
        pricing_path = _BACKEND_ROOT / "config" / "pricing.yaml"
        with open(pricing_path, "r") as f:
            raw = yaml.safe_load(f)

        free = raw["plans"][0]
        assert free["limits"]["ai_text_generation_calls_limit"] == 50
        # Free users should be constrained — the limit is > 0 and finite
        assert free["limits"]["ai_text_generation_calls_limit"] > 0
        assert free["limits"]["ai_text_generation_calls_limit"] < 999999

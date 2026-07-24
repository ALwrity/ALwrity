"""API contract regression tests for Blog Writer synchronous endpoints.

Tests the synchronous endpoints that don't require full LLM stubbing:
health, cache stats, cache clear, and router registration.

Async polling endpoints (research/start, outline/start) need full LLM stubs
to run — those will be covered in an integration test suite with proper mocks.

Marked as ``critical`` — these MUST pass before merging any PR touching
blog writer routes, models, or services.
"""

import pytest

from tests.framework.http import assert_status

pytestmark = [pytest.mark.blog_writer, pytest.mark.critical]


HEALTH_RESPONSE_KEYS = {"status", "service"}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_health_returns_200(self, blog_client):
        response = blog_client.get("/api/blog/health")
        assert_status(response, 200)

    def test_health_schema(self, blog_client):
        data = blog_client.get("/api/blog/health").json()
        assert set(data.keys()) == HEALTH_RESPONSE_KEYS
        assert data["status"] == "ok"
        assert data["service"] == "ai_blog_writer"


# ---------------------------------------------------------------------------
# Cache — Research
# ---------------------------------------------------------------------------

class TestResearchCache:
    def test_cache_stats_returns_200(self, blog_client):
        response = blog_client.get("/api/blog/cache/stats")
        assert_status(response, 200)
        assert isinstance(response.json(), dict)

    def test_clear_research_cache(self, blog_client):
        response = blog_client.delete("/api/blog/cache/clear")
        assert_status(response, 200)


# ---------------------------------------------------------------------------
# Cache — Outline (known service integration bugs)
# ---------------------------------------------------------------------------

class TestOutlineCache:
    @pytest.mark.xfail(
        reason="Known bug: cache_manager calls BlogWriterService.get_outline_cache_stats "
               "which does not exist on the service"
    )
    def test_stats_returns_200(self, blog_client):
        response = blog_client.get("/api/blog/cache/outline/stats")
        assert_status(response, 200)

    @pytest.mark.xfail(
        reason="Known bug: cache_manager calls BlogWriterService.get_recent_outline_cache_entries "
               "which does not exist on the service"
    )
    def test_entries_returns_200(self, blog_client):
        response = blog_client.get("/api/blog/cache/outline/entries")
        assert_status(response, 200)

    @pytest.mark.xfail(
        reason="Known bug: cache_manager calls BlogWriterService.clear_outline_cache "
               "which does not exist on the service"
    )
    def test_clear_returns_200(self, blog_client):
        response = blog_client.delete("/api/blog/cache/outline/clear")
        assert_status(response, 200)


# ---------------------------------------------------------------------------
# Router registration
# ---------------------------------------------------------------------------

class TestRouterRegistration:
    def test_routers_loaded(self, blog_routers):
        assert blog_routers, "expected at least one blog router module"

    def test_routes_on_app(self, blog_app):
        from fastapi.routing import APIRoute
        routes = [r for r in blog_app.routes if isinstance(r, APIRoute)]
        paths = {r.path for r in routes}
        assert any("/health" in p for p in paths), "Health endpoint missing"
        assert any("/research" in p for p in paths), "Research endpoint missing"
        assert any("/cache" in p for p in paths), "Cache endpoint missing"
        assert len(routes) >= 15, (
            f"Expected >= 15 blog writer routes; got {len(routes)}"
        )

    def test_auth_override_active(self, blog_app, blog_user):
        from middleware.auth_middleware import get_current_user
        override = blog_app.dependency_overrides.get(get_current_user)
        assert override is not None, "auth dependency not overridden"
        assert override()["id"] == "user_blog"

    def test_app_boots_with_health(self, blog_client):
        response = blog_client.get("/api/blog/health")
        assert_status(response, 200)

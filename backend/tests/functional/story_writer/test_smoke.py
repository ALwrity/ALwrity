"""Smoke tests for the Story Writer test framework integration.

Verifies the router mounts correctly, auth overrides are in place,
and the health endpoint responds. Fast, no stubs beyond the session-
scoped LLM image stub — safe for CI gate.
"""

import pytest

from tests.framework.http import assert_status

pytestmark = [pytest.mark.story_writer, pytest.mark.smoke]


# ---------------------------------------------------------------------------
# Router registration
# ---------------------------------------------------------------------------

def test_router_imports_cleanly():
    """The story writer router module must have a `router` attribute."""
    from api.story_writer.router import router

    assert router is not None
    assert hasattr(router, "routes")


def test_story_writer_app_collects_routes(story_writer_app):
    """The test app should have story writer endpoints mounted."""
    from fastapi.routing import APIRoute

    routes = [r for r in story_writer_app.routes if isinstance(r, APIRoute)]
    # Story writer mounts 9 sub-routers covering setup, content, projects,
    # tasks, media generation, scene animation, video, export, and cache.
    assert len(routes) >= 15, (
        f"expected >= 15 story writer routes; got {len(routes)}. "
        "Likely cause: a sub-router failed to import."
    )
    paths = {r.path for r in routes}
    assert "/api/story/health" in paths, "health endpoint missing"


# ---------------------------------------------------------------------------
# Auth override
# ---------------------------------------------------------------------------

def test_auth_dependency_overridden(story_writer_app, story_writer_user):
    """``get_current_user`` override should produce our fake user."""
    from middleware.auth_middleware import get_current_user

    override = story_writer_app.dependency_overrides.get(get_current_user)
    assert override is not None, "auth dependency was not overridden"
    result = override()
    assert result["id"] == "user_storywriter"


def test_query_token_auth_overridden(story_writer_app, story_writer_user):
    """``get_current_user_with_query_token`` should also be overridden."""
    from middleware.auth_middleware import get_current_user_with_query_token

    override = story_writer_app.dependency_overrides.get(
        get_current_user_with_query_token
    )
    assert override is not None, "query-token auth dependency was not overridden"
    result = override()
    assert result["id"] == "user_storywriter"


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

def test_health_endpoint_returns_200(story_writer_client):
    """GET /api/story/health should return 200 with a status dict."""
    response = story_writer_client.get("/api/story/health")
    assert_status(response, 200)
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "story_writer"

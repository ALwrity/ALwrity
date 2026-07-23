"""Targeted smoke test of the test framework's app_factory.

Purpose: catch regressions when LinkedIn routes are added/renamed/moved.
"""
import os


def test_router_imports_cleanly():
    """Verify module-level imports work via pytest's path setup."""
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "test_avatar_proxy",
        os.path.join(os.getcwd(), "api", "linkedin_avatar_proxy_routes.py"),
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert hasattr(mod, "router")
    routes = [r.path for r in mod.router.routes]
    assert "/api/linkedin-social/avatar-proxy" in routes


def test_router_loader_returns_objects(linkedin_routers):
    """`_load_linkedin_routers` should return a list of `_RoutedModule`."""
    assert isinstance(linkedin_routers, list)
    assert linkedin_routers, "expected at least one LinkedIn router to load"
    for r in linkedin_routers:
        assert hasattr(r, "module_path")
        assert hasattr(r, "router")


def test_build_linkedin_app_collects_routes(linkedin_app):
    """All LinkedIn routers should mount their own routes on the test app."""
    from fastapi.routing import APIRoute

    routes = [
        r for r in linkedin_app.routes
        if isinstance(r, APIRoute)
    ]
    # 57 routes total registered across all 16 LinkedIn router files.
    # Sanity bound — if releases drop below this, a router probably
    # failed to import (likely missing stub).
    assert len(routes) >= 50, (
        f"expected >= 50 LinkedIn routes; got {len(routes)}. "
        "Likely cause: a LinkedIn router failed to import."
    )


def test_auth_dependency_overridden(linkedin_app, linkedin_user):
    """`get_current_user` override should produce our fake user."""
    from middleware.auth_middleware import get_current_user
    from tests.framework.auth import fake_user_factory

    override = linkedin_app.dependency_overrides.get(get_current_user)
    assert override is not None, "auth dependency was not overridden"
    result = override()
    assert result["id"] == "user_linkedin"

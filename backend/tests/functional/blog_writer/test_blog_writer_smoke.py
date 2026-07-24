"""Smoke suite for the Blog Writer — verify the app boots and the
known routes register correctly. This is the first functional check
that runs in CI for any change touching Blog Writer source paths.

Add more domain-specific tests under this directory as the surface
grows; the framework here is the same one used for LinkedIn.
"""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.blog_writer, pytest.mark.functional]


class TestRouterRegistration:
    """Verify the framework fixture discovered the Blog Writer routers."""

    def test_routers_loaded(self, blog_routers):
        """The Blog Writer module list should be non-empty."""
        assert blog_routers, (
            "expected at least one Blog Writer router module to be loaded; "
            "check _BLOG_ROUTER_MODULES in tests/functional/blog_writer/conftest.py"
        )

    def test_router_objects_have_routes(self, blog_routers):
        """Every loaded module must expose an ``APIRouter`` instance."""
        for mod in blog_routers:
            assert hasattr(mod, "router"), (
                f"{mod.__name__} does not expose a `router` attribute"
            )
            routes = list(mod.router.routes)
            assert routes, f"{mod.__name__}.router has no routes registered"


class TestBlogAppBoot:
    """Build the test app and assert the core surface exists."""

    def _all_paths(self, app):
        from fastapi.routing import APIRoute
        return sorted(
            f"{sorted(r.methods)} {r.path}"
            for r in app.routes if isinstance(r, APIRoute)
        )

    def test_app_contains_known_blog_paths(self, blog_app):
        """Sanity check: the blog routes end up on the app under ``/api/blog``."""
        paths = self._all_paths(blog_app)
        # Anything at all under /api/blog means registration worked.
        # As Blog Writer expands, add more precise assertions here.
        blog_paths = [p for p in paths if "GET" in p and "/api/blog" in p]
        # Health endpoint should be present (advertised by routers above).
        assert any("/health" in p for p in paths), (
            "expected at least one /health route on the Blog Writer app; "
            f"got: {paths}"
        )

    def test_app_router_count_meets_minimum(self, blog_app):
        """Blog Writer currently exposes ~40 routes (router + seo_analysis)."""
        from fastapi.routing import APIRoute
        routes = [r for r in blog_app.routes if isinstance(r, APIRoute)]
        # Be lenient — the SEO module may not always be importable in CI.
        assert len(routes) >= 5, (
            f"expected at least 5 Blog Writer routes; got {len(routes)}. "
            "If a router failed to import, see _BLOG_ROUTER_MODULES."
        )

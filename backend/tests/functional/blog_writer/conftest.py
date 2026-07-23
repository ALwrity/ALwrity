"""Shared fixtures for the Blog Writer functional suite.

The framework in ``tests/framework/`` already provides
``build_app``, ``fake_user_factory``, ``build_client`` and the
LLM / Fernet stubs. This conftest wires those primitives to the
Blog Writer prefix (``/api/blog``) and adds any fixtures that are
specific to this suite as the test surface grows.
"""

from __future__ import annotations

from typing import Any, Dict

import pytest


# -------------------------------------------------------------------------
# Fake users
# -------------------------------------------------------------------------
@pytest.fixture
def blog_user() -> Dict[str, Any]:
    """A dict shaped like what ``get_current_user`` would return."""
    from tests.framework.auth import fake_user_factory
    return fake_user_factory(uid="user_blog", email="blog@example.com")


@pytest.fixture
def blog_user_factory():
    """Return a callable that produces a fresh fake-user dict each call."""

    def _make(uid: str = "user_blog", **extras) -> Dict[str, Any]:
        from tests.framework.auth import fake_user_factory
        return fake_user_factory(uid=uid, **extras)

    return _make


# -------------------------------------------------------------------------
# Router / app / client
# -------------------------------------------------------------------------
#
# Blog Writer routes live behind ``/api/blog``:
#   * ``api.blog_writer.router``     (prefix /api/blog)
#   * ``api.blog_writer.seo_analysis`` (prefix /api/blog/seo)
#
# The framework's ``_load_linkedin_routers`` is repurposed to load
# only the Blog Writer-defined entries from the registry, but in
# practice for suite-level wiring a static list is clearer and
# doesn't require importing every other LinkedIn module just to
# pull its registry entries.
#
# To extend the suite as more blog routes land, append to
# ``_BLOG_ROUTER_MODULES`` below.

_BLOG_ROUTER_MODULES = (
    "api.blog_writer.router",   # /api/blog/* — main app
    "api.blog_writer.seo_analysis",  # /api/blog/seo/* — SEO
)


def _load_blog_routers():
    """Lazily import the known Blog Writer router modules.

    Falls back to ``None`` for any module that throws on import —
    those entries are filtered out so the suite can still run as
    the codebase grows.
    """
    routers = []
    for module_path in _BLOG_ROUTER_MODULES:
        try:
            module = __import__(module_path, fromlist=["router"])
        except Exception:
            continue
        if hasattr(module, "router"):
            routers.append(module)
    return routers


@pytest.fixture(scope="session", autouse=True)
def _install_blog_write_stubs():
    """Stub modules Blog Writer imports at module-load time.

    This is a no-op placeholder; expand as Blog Writer modules
    pull in LLM image / text services during import.
    """
    from tests.framework.service_stubs import install_llm_image_stubs
    install_llm_image_stubs()
    yield


@pytest.fixture
def blog_routers():
    """List of imported Blog Writer router modules (mounted in ``blog_app``)."""
    return _load_blog_routers()


@pytest.fixture
def blog_app(blog_user_factory):
    """A fresh FastAPI app with all known Blog Writer routers mounted.

    Auth is wired so every request yields a fresh fake-user dict —
    no leakage between test invocations.
    """
    from tests.framework.app_factory import build_app

    modules = _load_blog_routers()
    return build_app(
        routers=[m.router for m in modules],
        auth_user_factory=blog_user_factory,
        title="ALwrity Blog Writer Test App",
    )


@pytest.fixture
def blog_client(blog_app, blog_user_factory):
    """``TestClient`` over the Blog Writer app with auth wired to ``user_blog``."""
    from tests.framework.http import build_client
    return build_client(blog_app, base_user_factory=blog_user_factory)

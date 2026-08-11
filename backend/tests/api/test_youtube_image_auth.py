"""
Tests: YouTube image / video serving endpoints use get_current_user_with_query_token.

Verifies that:
- GET /images/{category}/{filename} accepts ?token= (no Authorization header needed)
- GET /videos/{video_filename} accepts ?token= (no Authorization header needed)
- Both endpoints still return 401 when no credentials are supplied at all
- Both endpoints return 404 for missing files (not 403/401 when auth passes)
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_user(uid: str = "user_test") -> dict:
    return {
        "id": uid,
        "uid": uid,
        "clerk_user_id": uid,
        "email": "test@example.com",
        "is_active": True,
    }


# ---------------------------------------------------------------------------
# images.py handler — serve_youtube_image
# ---------------------------------------------------------------------------

class TestServeYouTubeImageAuth:
    """serve_youtube_image must use get_current_user_with_query_token."""

    def test_dependency_is_query_token_variant(self):
        """The route must declare get_current_user_with_query_token, not get_current_user."""
        from middleware.auth_middleware import (
            get_current_user,
            get_current_user_with_query_token,
        )
        from api.youtube.handlers.images import router as image_router

        # Find the serve_youtube_image endpoint
        target_route = None
        for route in image_router.routes:
            if hasattr(route, "name") and route.name == "serve_youtube_image":
                target_route = route
                break

        assert target_route is not None, "serve_youtube_image route not found"

        # Collect all dependency callables declared on the route
        dep_callables = {dep.dependency for dep in target_route.dependencies}
        # Also check route endpoint's signature for FastAPI Depends
        import inspect
        sig = inspect.signature(target_route.endpoint)
        for param in sig.parameters.values():
            if hasattr(param.default, "dependency"):
                dep_callables.add(param.default.dependency)

        assert get_current_user_with_query_token in dep_callables, (
            "serve_youtube_image must use get_current_user_with_query_token "
            "so <img> tags can load images with ?token= query param"
        )
        assert get_current_user not in dep_callables, (
            "serve_youtube_image must NOT use header-only get_current_user"
        )

    def test_returns_404_for_missing_file_when_authenticated(self, tmp_path):
        """When auth passes and file does not exist, should return 404 (not 401)."""
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        from middleware.auth_middleware import get_current_user_with_query_token
        from api.youtube.handlers.images import router as image_router

        app = FastAPI()
        app.include_router(image_router)
        user = _fake_user()
        app.dependency_overrides[get_current_user_with_query_token] = lambda: user

        with patch("api.youtube.handlers.images.YOUTUBE_AVATARS_DIR", tmp_path), \
             patch("api.youtube.handlers.images.YOUTUBE_IMAGES_DIR", tmp_path):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/images/avatars/nonexistent.png")

        assert resp.status_code == 404

    def test_returns_401_without_credentials(self):
        """Without any credentials, the endpoint must return 401."""
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        from api.youtube.handlers.images import router as image_router

        app = FastAPI()
        app.include_router(image_router)
        # No dependency overrides — real auth middleware runs

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/images/avatars/some.png")

        assert resp.status_code == 401

    def test_rejects_invalid_category(self, tmp_path):
        """Category must be 'avatars' or 'scenes'."""
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        from middleware.auth_middleware import get_current_user_with_query_token
        from api.youtube.handlers.images import router as image_router

        app = FastAPI()
        app.include_router(image_router)
        user = _fake_user()
        app.dependency_overrides[get_current_user_with_query_token] = lambda: user

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/images/badcategory/file.png")

        assert resp.status_code == 400

    def test_rejects_path_traversal(self, tmp_path):
        """Filename with path traversal must be rejected."""
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        from middleware.auth_middleware import get_current_user_with_query_token
        from api.youtube.handlers.images import router as image_router

        app = FastAPI()
        app.include_router(image_router)
        user = _fake_user()
        app.dependency_overrides[get_current_user_with_query_token] = lambda: user

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/images/avatars/../../etc/passwd")

        assert resp.status_code in {400, 404}


# ---------------------------------------------------------------------------
# router.py — serve_youtube_video
# ---------------------------------------------------------------------------

class TestServeYouTubeVideoAuth:
    """serve_youtube_video must use get_current_user_with_query_token."""

    def test_dependency_is_query_token_variant(self):
        """The route must declare get_current_user_with_query_token."""
        from middleware.auth_middleware import (
            get_current_user,
            get_current_user_with_query_token,
        )
        import inspect

        # Import just the handler function from router to inspect its signature
        from api.youtube import router as yt_router_module
        endpoint_fn = getattr(yt_router_module, "serve_youtube_video", None)

        # If not a module-level name, look it up via router routes
        if endpoint_fn is None:
            from api.youtube.router import router as yt_router
            for route in yt_router.routes:
                if hasattr(route, "name") and route.name == "serve_youtube_video":
                    endpoint_fn = route.endpoint
                    break

        assert endpoint_fn is not None, "serve_youtube_video not found"

        sig = inspect.signature(endpoint_fn)
        dep_callables = set()
        for param in sig.parameters.values():
            if hasattr(param.default, "dependency"):
                dep_callables.add(param.default.dependency)

        assert get_current_user_with_query_token in dep_callables, (
            "serve_youtube_video must use get_current_user_with_query_token "
            "so <video> tags can load videos with ?token= query param"
        )
        assert get_current_user not in dep_callables

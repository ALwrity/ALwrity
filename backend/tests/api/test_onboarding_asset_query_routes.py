"""Tests for lightweight onboarding asset query routes."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _fake_user(uid: str = "user_test") -> dict:
    return {
        "id": uid,
        "uid": uid,
        "clerk_user_id": uid,
        "email": "test@example.com",
        "is_active": True,
    }


def _build_test_app(fake_db):
    from api.onboarding_utils.asset_query_routes import router
    from middleware.auth_middleware import get_current_user
    from services.database import get_db

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    app.dependency_overrides[get_db] = lambda: fake_db
    return app


class TestOnboardingAssetQueryRoutes:
    def test_latest_avatar_returns_success_false_when_not_found(self):
        fake_db = MagicMock()
        fake_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []

        app = _build_test_app(fake_db)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/api/onboarding/assets/latest-avatar")
        assert response.status_code == 200
        assert response.json() == {"success": False, "message": "No avatar found"}

    def test_latest_avatar_returns_latest_brand_avatar(self):
        fake_asset = SimpleNamespace(
            id=42,
            file_url="/api/youtube/images/avatars/avatar.png",
            prompt="A smiling presenter avatar",
            provider="openai",
            source_module="brand_avatar_generator",
            asset_metadata={"category": "brand_avatar"},
        )

        fake_db = MagicMock()
        fake_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
            fake_asset
        ]

        app = _build_test_app(fake_db)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/api/onboarding/assets/latest-avatar")
        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["asset_id"] == 42
        assert payload["image_url"] == "/api/youtube/images/avatars/avatar.png"

    def test_latest_voice_clone_returns_success_false_when_not_found(self):
        fake_db = MagicMock()
        fake_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

        app = _build_test_app(fake_db)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/api/onboarding/assets/latest-voice-clone")
        assert response.status_code == 200
        assert response.json() == {"success": False, "message": "No voice clone found"}


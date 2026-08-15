"""Tests for the extracted persona test-drive routes.

Written first (TDD) to lock in behavior while moving test-text/test-voice/
test-image out of step4_persona_routes.py. Targets the new module namespace
so providers + get_session_for_user are patched at their import site.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "api.onboarding_utils.step4_test_drive_routes"


def _fake_user(uid: str = "user_test") -> dict:
    return {"id": uid, "uid": uid, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}


def _build_app() -> FastAPI:
    from api.onboarding_utils.step4_test_drive_routes import router
    from middleware.auth_middleware import get_current_user

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    return app


def _db_with_asset(asset) -> MagicMock:
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = asset
    return db


def _voice_asset() -> SimpleNamespace:
    return SimpleNamespace(
        id=1,
        asset_metadata={"custom_voice_id": "voice-abc", "engine": "qwen3"},
    )


@pytest.fixture(autouse=True)
def _reset_test_drive_usage():
    from api.onboarding_utils import step4_test_drive_routes as m

    m._test_drive_usage.clear()
    yield
    m._test_drive_usage.clear()


# --- route registration -------------------------------------------------

class TestRouteRegistration:
    def test_test_drive_paths_are_mounted(self):
        from api.onboarding_utils.step4_test_drive_routes import router
        paths = {getattr(r, "path", None) for r in router.routes}
        assert "/step4/test-text" in paths
        assert "/step4/test-voice" in paths
        assert "/step4/test-image" in paths


# --- OnboardingManager regression (guard the untouched generation routes) --

class TestOnboardingManagerRegression:
    def test_persona_generation_routes_remain_registered(self):
        from alwrity_utils.onboarding_manager import OnboardingManager

        app = FastAPI()
        OnboardingManager(app)

        paths = {getattr(r, "path", None) for r in app.routes}
        assert "/api/onboarding/step4/generate-personas-async" in paths
        assert "/api/onboarding/step4/persona-latest" in paths


# --- /test-voice --------------------------------------------------------

class TestVoice:
    def test_empty_text(self):
        client = TestClient(_build_app(), raise_server_exceptions=False)
        resp = client.post("/step4/test-voice", json={"text": "   "})
        assert resp.status_code == 200
        assert resp.json()["error"] == "empty_text"

    def test_text_too_long(self):
        client = TestClient(_build_app(), raise_server_exceptions=False)
        resp = client.post("/step4/test-voice", json={"text": "x" * 501})
        assert resp.status_code == 200
        assert resp.json()["error"] == "text_too_long"

    def test_no_voice_clone(self):
        with patch(f"{MOD}.get_session_for_user") as gs:
            gs.return_value = _db_with_asset(None)
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.post("/step4/test-voice", json={"text": "hello"})
        assert resp.status_code == 200
        assert resp.json()["error"] == "no_voice_clone"

    def test_success(self):
        with patch(f"{MOD}.get_session_for_user") as gs, \
             patch(f"{MOD}.generate_audio") as gen:
            gs.return_value = _db_with_asset(_voice_asset())
            gen.return_value = {"audio_url": "/audio/1.mp3", "format": "audio/mpeg"}
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.post("/step4/test-voice", json={"text": "hello"})
        body = resp.json()
        assert body["success"] is True
        assert body["audio_url"] == "/audio/1.mp3"
        assert body["voice_id"] == "voice-abc"


# --- /test-text ---------------------------------------------------------

class TestText:
    def test_empty_prompt(self):
        client = TestClient(_build_app(), raise_server_exceptions=False)
        resp = client.post("/step4/test-text", json={"prompt": "", "persona": {}, "platform": "blog"})
        assert resp.status_code == 200
        assert resp.json()["error"] == "empty_prompt"

    def test_prompt_too_long(self):
        client = TestClient(_build_app(), raise_server_exceptions=False)
        resp = client.post("/step4/test-text", json={"prompt": "x" * 1001, "persona": {}, "platform": "blog"})
        assert resp.status_code == 200
        assert resp.json()["error"] == "prompt_too_long"

    def test_success_two_variants(self):
        def fake_llm(prompt=None, system_prompt=None, flow_type=None, **kwargs):
            return "WITH" if flow_type == "test_drive_with_voice" else "WITHOUT"

        with patch(f"{MOD}.llm_text_gen", side_effect=fake_llm):
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.post(
                "/step4/test-text",
                json={"prompt": "Write a post", "persona": {"identity": {"persona_name": "X"}}, "platform": "blog"},
            )
        body = resp.json()
        assert body["success"] is True
        assert body["with_voice"] == "WITH"
        assert body["without_voice"] == "WITHOUT"


# --- /test-image --------------------------------------------------------

class TestImage:
    def test_invalid_platform(self):
        client = TestClient(_build_app(), raise_server_exceptions=False)
        resp = client.post("/step4/test-image", json={"platform": "myspace"})
        assert resp.status_code == 200
        assert resp.json()["error"] == "invalid_platform"

    def test_no_brand_avatar(self):
        with patch(f"{MOD}.get_session_for_user") as gs:
            db = MagicMock()
            db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
            db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
            gs.return_value = db
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.post("/step4/test-image", json={"platform": "blog"})
        assert resp.status_code == 200
        assert resp.json()["error"] == "no_brand_avatar"

    def test_success(self, tmp_path):
        avatar = tmp_path / "avatar.png"
        avatar.write_bytes(b"fake-avatar-bytes")

        asset = SimpleNamespace(
            id=7,
            file_path=str(avatar),
            prompt="a brand avatar",
            asset_metadata={},
        )

        db = _db_with_asset(asset)

        with patch(f"{MOD}.get_session_for_user") as gs, \
             patch(f"{MOD}.generate_image_variation", new=AsyncMock(return_value={
                 "success": True,
                 "image_base64": base64.b64encode(b"fake-image").decode(),
             })), \
             patch(f"{MOD}.generate_unique_filename", return_value="x.png"), \
             patch(f"{MOD}.get_user_workspace", return_value=tmp_path), \
             patch(f"{MOD}.save_file_safely", return_value=(str(tmp_path / "x.png"), None)), \
             patch(f"{MOD}.save_asset_to_library"):
            gs.return_value = db
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.post("/step4/test-image", json={"platform": "blog"})

        body = resp.json()
        assert body["success"] is True
        assert body["platform"] == "blog"
        assert body["image_base64"] == base64.b64encode(b"fake-image").decode()


# --- server-side session caps -------------------------------------------

class TestRateLimit:
    def test_limit_hit_after_recorded_usage(self):
        from api.onboarding_utils import step4_test_drive_routes as m

        for feature, limit in m.TEST_DRIVE_LIMITS.items():
            m._test_drive_usage.clear()
            for _ in range(limit):
                assert m._test_drive_limit_hit("u1", feature) is False
                m._record_test_drive_usage("u1", feature)
            assert m._test_drive_limit_hit("u1", feature) is True

    def test_unknown_feature_not_blocked(self):
        from api.onboarding_utils import step4_test_drive_routes as m

        assert m._test_drive_limit_hit("u1", "unknown") is False

    def test_text_cap_enforced_over_http(self):
        with patch(f"{MOD}.llm_text_gen", return_value="ok"):
            client = TestClient(_build_app(), raise_server_exceptions=False)
            payload = {"prompt": "hi", "persona": {}, "platform": "blog"}
            for _ in range(5):
                resp = client.post("/step4/test-text", json=payload)
                assert resp.json()["success"] is True
            resp = client.post("/step4/test-text", json=payload)
            body = resp.json()
            assert body["success"] is False
            assert body["error"] == "rate_limit_reached"

    def test_voice_cap_enforced_over_http(self):
        with patch(f"{MOD}.get_session_for_user") as gs, \
             patch(f"{MOD}.generate_audio") as gen:
            gs.return_value = _db_with_asset(_voice_asset())
            gen.return_value = {"audio_url": "/audio/1.mp3", "format": "audio/mpeg"}
            client = TestClient(_build_app(), raise_server_exceptions=False)
            for _ in range(5):
                resp = client.post("/step4/test-voice", json={"text": "hello"})
                assert resp.json()["success"] is True
            resp = client.post("/step4/test-voice", json={"text": "hello"})
            body = resp.json()
            assert body["success"] is False
            assert body["error"] == "rate_limit_reached"

    def test_image_cap_enforced_over_http(self, tmp_path):
        avatar = tmp_path / "avatar.png"
        avatar.write_bytes(b"fake-avatar-bytes")
        asset = SimpleNamespace(id=7, file_path=str(avatar), prompt="a", asset_metadata={})
        db = _db_with_asset(asset)

        with patch(f"{MOD}.get_session_for_user") as gs, \
             patch(f"{MOD}.generate_image_variation", new=AsyncMock(return_value={
                 "success": True,
                 "image_base64": base64.b64encode(b"fake-image").decode(),
             })), \
             patch(f"{MOD}.generate_unique_filename", return_value="x.png"), \
             patch(f"{MOD}.get_user_workspace", return_value=tmp_path), \
             patch(f"{MOD}.save_file_safely", return_value=(str(tmp_path / "x.png"), None)), \
             patch(f"{MOD}.save_asset_to_library"):
            gs.return_value = db
            client = TestClient(_build_app(), raise_server_exceptions=False)
            for _ in range(3):
                resp = client.post("/step4/test-image", json={"platform": "blog"})
                assert resp.json()["success"] is True
            resp = client.post("/step4/test-image", json={"platform": "blog"})
            body = resp.json()
            assert body["success"] is False
            assert body["error"] == "rate_limit_reached"

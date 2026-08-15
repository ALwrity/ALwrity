"""Tests for the persona-save endpoint (debounced auto-save contract).

Verifies the request shape the frontend sends (snake_case keys) is persisted
via _save_persona_data. The endpoint itself is pre-existing; this locks the
contract so future refactors don't silently change the wire format.
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "api.onboarding_utils.step4_persona_routes"


def _fake_user(uid: str = "user_test") -> dict:
    return {"id": uid, "uid": uid, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}


def _build_app() -> FastAPI:
    from api.onboarding_utils.step4_persona_routes import router
    from middleware.auth_middleware import get_current_user

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    return app


def test_save_persona_persists_snake_case_payload():
    fake_pd = SimpleNamespace(
        core_persona=None, platform_personas={}, quality_metrics={}, selected_platforms=[]
    )
    fake_session = SimpleNamespace(id=1, persona_data=fake_pd)

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = fake_session

    with patch(f"{MOD}.get_session_for_user", return_value=db), \
         patch(f"{MOD}.AgentFlatContextStore") as flat_store_cls:
        flat_store_cls.return_value.save_step4_persona_data = MagicMock()

        client = TestClient(_build_app(), raise_server_exceptions=False)
        resp = client.post(
            "/step4/persona-save",
            json={
                "core_persona": {"identity": {"persona_name": "The Plain-Spoken Operator"}},
                "platform_personas": {"blog": {"platform_type": "blog"}},
                "quality_metrics": {"overall_score": 80},
                "selected_platforms": ["blog"],
            },
        )

    body = resp.json()
    assert body["success"] is True
    assert fake_pd.core_persona == {"identity": {"persona_name": "The Plain-Spoken Operator"}}
    assert fake_pd.platform_personas == {"blog": {"platform_type": "blog"}}
    assert fake_pd.quality_metrics == {"overall_score": 80}
    assert fake_pd.selected_platforms == ["blog"]
    # Flat context should also be updated for agent access.
    assert flat_store_cls.return_value.save_step4_persona_data.called

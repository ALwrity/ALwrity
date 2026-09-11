"""SIF x Strategy integration — Phase SIF-D: activation hook (HTTP tests).

Proves ``POST /strategy/activate`` dispatches the SIF indexing pipeline
(markdown mirror + async embed) AFTER commit and cache clear, and that a
dispatch failure can never fail the activation itself (activation must
stay 200 + committed even if the SIF layer is broken).

Uses the established endpoint-test pattern: FastAPI app with the wizard
router, ``get_current_user`` overridden, ``get_session_for_user``
patched at the endpoint's import site, and a mock DB session.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import StrategyActivationStatus

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints"

DISPATCH_TARGET = "services.intelligence.strategy_vfs_companion.dispatch_activation_indexing"


def _fake_user(uid: str = "42") -> dict:
    return {"id": uid, "uid": uid, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}


def _build_app() -> FastAPI:
    from api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints import router
    from middleware.auth_middleware import get_current_user

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: _fake_user()
    return app


def _strategy_row(**overrides):
    strategy = MagicMock(name="strategy")
    strategy.id = 7
    strategy.user_id = "42"
    snapshot = {
        "id": 7,
        "user_id": "42",
        "name": "Growth Plan",
        "industry": "SaaS",
        "business_objectives": ["grow"],
        "comprehensive_ai_analysis": {
            "strategy_metadata": {"version": "2.0", "generated_at": "2026-09-09T09:00:00",
                                  "grounding_status": "grounded"},
            "base_strategy": {"pillars": ["ownership"]},
        },
    }
    snapshot.update(overrides)
    strategy.to_dict.return_value = snapshot
    return strategy


def _fake_session_factory(strategy, existing=None):
    """Query dispatcher: model-level routing so the one mock DB 'works'."""
    db = MagicMock()

    def _query(model):
        lowered = model.__name__.lower()

        def _filter(*args, **kwargs):
            m = MagicMock(name=f"filter[{lowered}]")
            if lowered == "strategyactivationstatus":
                m.first.return_value = existing
                m.order_by.return_value = m
            else:
                m.first.return_value = strategy
            return m

        q = MagicMock(name=f"query[{lowered}]")
        q.filter.side_effect = _filter
        return q

    db.query.side_effect = _query
    return db


class TestActivationHook:
    def test_activate_dispatches_sif_indexing(self):
        strategy = _strategy_row()
        db = _fake_session_factory(strategy)
        captured = {}

        def _dispatch(db_arg, user_id, strategy_data, activation_date, sif_service=None):
            captured["db"] = db_arg
            captured["user_id"] = user_id
            captured["data"] = strategy_data
            captured["activation_date"] = activation_date

        with patch(f"{MOD}.get_session_for_user", return_value=db), \
             patch(DISPATCH_TARGET, side_effect=_dispatch):
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.post("/strategy/activate", json={"strategy_id": 7})

        assert resp.status_code == 200, resp.text
        assert captured["user_id"] == "42"
        assert captured["data"]["id"] == 7
        assert captured["data"]["name"] == "Growth Plan"
        assert captured["activation_date"] is not None
        db.commit.assert_called()

    def test_activate_completes_when_dispatch_raises(self):
        strategy = _strategy_row()
        db = _fake_session_factory(strategy)

        with patch(f"{MOD}.get_session_for_user", return_value=db), \
             patch(DISPATCH_TARGET, side_effect=RuntimeError("SIF exploded")):
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.post("/strategy/activate", json={"strategy_id": 7})

        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["strategy_id"] == 7

    def test_re_activation_dispatches_with_existing_activation(self):
        strategy = _strategy_row()
        existing = MagicMock(spec=StrategyActivationStatus)
        existing.status = "active"
        existing.activation_date = None
        existing.last_updated = None
        db = _fake_session_factory(strategy, existing=existing)
        captured = {}

        def _dispatch(db_arg, user_id, strategy_data, activation_date, sif_service=None):
            captured["activation_date"] = activation_date

        with patch(f"{MOD}.get_session_for_user", return_value=db), \
             patch(DISPATCH_TARGET, side_effect=_dispatch):
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.post("/strategy/activate", json={"strategy_id": 7})

        assert resp.status_code == 200, resp.text
        assert captured["activation_date"] is not None

    def test_activate_404_when_strategy_missing_no_dispatch(self):
        db = _fake_session_factory(None)
        with patch(f"{MOD}.get_session_for_user", return_value=db), \
             patch(DISPATCH_TARGET) as dispatch:
            client = TestClient(_build_app(), raise_server_exceptions=False)
            resp = client.post("/strategy/activate", json={"strategy_id": 999})

        assert resp.status_code == 404
        dispatch.assert_not_called()
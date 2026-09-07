"""Wizard route mounting + activation single-source-of-truth tests.

A4 scope: the ``strategy_wizard_endpoints`` router (``/wizard/state``,
``/strategy/activate``, ``/strategy/active``, ``/strategy/latest``) must be
mounted in ``routes.py`` and must reuse the existing ``strategy_activation_status``
table (status ``'active'``, latest-activation-wins) — the SSOT already read by
``_has_active_strategy`` and ``ActiveStrategyService``. No parallel
``active_strategy`` table may exist.

Tests:
- Route-presence (auth-gated, not 404) — proves the router is mounted.
- Activation writes to ``strategy_activation_status`` (idempotent, latest-wins).
- Wizard state persists to ``strategy_wizard_state``.
- Fresh per-user DB (alembic upgrade head) gains the ``strategy_wizard_state`` table.
"""

from __future__ import annotations

import sys
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

WIZARD_MOD = "api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints"

_WIZARD_PATHS = [
    ("GET", "/enhanced-strategies/wizard/state"),
    ("PUT", "/enhanced-strategies/wizard/state"),
    ("POST", "/enhanced-strategies/wizard/complete"),
    ("DELETE", "/enhanced-strategies/wizard/state"),
    ("GET", "/enhanced-strategies/strategy/latest"),
    ("POST", "/enhanced-strategies/strategy/activate"),
    ("GET", "/enhanced-strategies/strategy/active"),
]


def _unauthorized_user() -> dict:
    raise HTTPException(status_code=401, detail="Unauthorized")


def _fake_user(uid: str = "999") -> dict:
    return {"id": uid, "uid": uid, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}


def _build_layered_app():
    """Build the real enhanced-strategies surface (routes.py) with auth gated out."""
    from api.content_planning.api.content_strategy.routes import router
    from middleware.auth_middleware import get_current_user

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = _unauthorized_user
    return app


class TestWizardRoutesMounted:
    """RED: before the mount the layered app returns 404 for every wizard path."""

    def test_wizard_paths_auth_gated_not_404(self):
        client = TestClient(_build_layered_app(), raise_server_exceptions=False)
        for method, path in _WIZARD_PATHS:
            resp = client.request(method, path)
            assert resp.status_code != 404, f"{method} {path} -> 404 (router not mounted)"
            assert resp.status_code in (401, 403), f"{method} {path} -> {resp.status_code}"


class TestActivationUsesExistingSSOT:
    """POST /strategy/activate must write strategy_activation_status (no new table)."""

    @pytest.fixture
    def engine(self, tmp_path):
        from models.enhanced_strategy_models import EnhancedContentStrategy
        from models.monitoring_models import StrategyActivationStatus
        from models.base import Base

        engine = create_engine(f"sqlite:///{tmp_path / 'wizard.db'}")
        Base.metadata.create_all(
            bind=engine,
            tables=[
                EnhancedContentStrategy.__table__,
                StrategyActivationStatus.__table__,
            ],
        )
        return engine

    @contextmanager
    def _client(self, engine):
        from middleware.auth_middleware import get_current_user
        from api.content_planning.api.content_strategy.endpoints import strategy_wizard_endpoints as m

        session_factory = lambda uid: sessionmaker(bind=engine)()
        app = FastAPI()
        app.include_router(m.router)
        app.dependency_overrides[get_current_user] = _fake_user
        with patch(f"{WIZARD_MOD}.get_session_for_user", side_effect=session_factory):
            yield TestClient(app, raise_server_exceptions=False)

    def _seed_strategy(self, engine, user_id="999"):
        from models.enhanced_strategy_models import EnhancedContentStrategy

        db = sessionmaker(bind=engine)()
        strategy = EnhancedContentStrategy(user_id=user_id, name="Test Strategy")
        db.add(strategy)
        db.commit()
        db.refresh(strategy)
        db.close()
        return strategy.id

    def _count_active_rows(self, engine, user_id):
        from models.monitoring_models import StrategyActivationStatus

        db = sessionmaker(bind=engine)()
        count = (
            db.query(StrategyActivationStatus)
            .filter(
                StrategyActivationStatus.user_id == int(user_id),
                StrategyActivationStatus.status == "active",
            )
            .count()
        )
        db.close()
        return count

    def test_activate_writes_active_row_to_ssot(self, engine):
        sid = self._seed_strategy(engine)
        with self._client(engine) as client:
            client.post("/strategy/activate", json={"strategy_id": sid})
        assert self._count_active_rows(engine, "999") == 1

    def test_activate_is_idempotent_no_duplicate_active_row(self, engine):
        sid = self._seed_strategy(engine)
        with self._client(engine) as client:
            client.post("/strategy/activate", json={"strategy_id": sid})
            client.post("/strategy/activate", json={"strategy_id": sid})
        assert self._count_active_rows(engine, "999") == 1

    def test_get_active_returns_activated_strategy(self, engine):
        sid = self._seed_strategy(engine)
        with self._client(engine) as client:
            client.post("/strategy/activate", json={"strategy_id": sid})
            resp = client.get("/strategy/active")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data is not None
        assert data["strategy"]["id"] == sid
        assert data["activated_at"] is not None

    def test_activate_missing_strategy_returns_404(self, engine):
        with self._client(engine) as client:
            resp = client.post("/strategy/activate", json={"strategy_id": 999999})
        assert resp.status_code == 404

    def test_activate_foreign_strategy_returns_403(self, engine):
        sid = self._seed_strategy(engine, user_id="someone_else")
        with self._client(engine) as client:
            resp = client.post("/strategy/activate", json={"strategy_id": sid})
        assert resp.status_code == 403


class TestWizardStatePersistence:
    """Wizard progress persists to strategy_wizard_state (new table)."""

    @pytest.fixture
    def engine(self, tmp_path):
        from models.base import Base
        from models.content_strategy_state_models import StrategyWizardState

        engine = create_engine(f"sqlite:///{tmp_path / 'wizard_state.db'}")
        Base.metadata.create_all(bind=engine, tables=[StrategyWizardState.__table__])
        return engine

    @contextmanager
    def _client(self, engine):
        from middleware.auth_middleware import get_current_user
        from api.content_planning.api.content_strategy.endpoints import strategy_wizard_endpoints as m

        session_factory = lambda uid: sessionmaker(bind=engine)()
        app = FastAPI()
        app.include_router(m.router)
        app.dependency_overrides[get_current_user] = _fake_user
        with patch(f"{WIZARD_MOD}.get_session_for_user", side_effect=session_factory):
            yield TestClient(app, raise_server_exceptions=False)

    def test_update_then_get_roundtrip(self, engine):
        with self._client(engine) as client:
            put_resp = client.put(
                "/wizard/state",
                json={"current_step": 2, "status": "in_progress", "progress": 40, "step_data": {"x": 1}},
            )
            assert put_resp.status_code == 200
            get_resp = client.get("/wizard/state")
        data = get_resp.json()["data"]
        assert data["current_step"] == 2
        assert data["progress"] == 40
        assert data["step_data"] == {"x": 1}

    def test_complete_marks_status_completed(self, engine):
        with self._client(engine) as client:
            client.put("/wizard/state", json={"current_step": 1, "progress": 10})
            resp = client.post("/wizard/complete")
        data = resp.json()["data"]
        assert data["status"] == "completed"
        assert data["progress"] == 100
        assert data["current_step"] == 4


class TestWizardMigrationPerUser:
    """alembic upgrade head (via init_user_database) must create strategy_wizard_state."""

    def test_strategy_wizard_state_table_created_for_fresh_user(self):
        from services.database import get_engine_for_user
        from services.database.init_db import init_user_database

        user_id = "test_wizard_mig_user"
        init_user_database(user_id)
        engine = get_engine_for_user(user_id)
        tables = set(inspect(engine).get_table_names())
        assert "strategy_wizard_state" in tables
        assert "active_strategy" not in tables
        engine.dispose()
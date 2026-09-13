"""Phase 3: preflight + rate-limit + billing gates on calendar AI routes."""

from __future__ import annotations

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from middleware.auth_middleware import get_current_user
from services.database import get_db
import api.content_planning.api.routes.calendar_generation as cal_routes
from api.content_planning.api.routes.calendar_generation import (
    router as calendar_generation_router,
)
from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
    _global_orchestrator_sessions,
)
from api.content_planning.utils import rate_limiter


@pytest.fixture(autouse=True)
def _clean_state():
    _global_orchestrator_sessions.clear()
    rate_limiter._clear()
    yield
    _global_orchestrator_sessions.clear()
    rate_limiter._clear()


@pytest.fixture
def sqlite_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from models.base import Base  # noqa: F401
    import models.content_planning  # noqa: F401
    import models.enhanced_calendar_models  # noqa: F401
    import models.enhanced_strategy_models  # noqa: F401
    import models.onboarding  # noqa: F401

    # StaticPool: one shared in-memory connection across TestClient threads.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _seed_onboarding(db, user_id: str):
    from models.onboarding import OnboardingSession

    db.add(OnboardingSession(user_id=user_id))
    db.commit()


def _build_app(db, user_id: str | None = "user-A") -> TestClient:
    app = FastAPI()
    app.include_router(calendar_generation_router)
    if user_id is not None:
        app.dependency_overrides[get_current_user] = lambda: {"id": user_id}
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app, raise_server_exceptions=False)


def _noop_validate(*a, **k):
    return None


def _start_payload(strategy_id=None):
    body: dict = {"calendar_type": "monthly"}
    if strategy_id is not None:
        body["strategy_id"] = strategy_id
    return body


def test_start_requires_onboarding(monkeypatch, sqlite_db):
    monkeypatch.setattr(
        cal_routes, "validate_calendar_generation_operations", _noop_validate
    )
    client = _build_app(sqlite_db, "user-A")

    resp = client.post("/calendar-generation/start", json=_start_payload())

    assert resp.status_code == 400
    assert "Onboarding" in resp.json()["detail"]


def test_start_rejects_foreign_legacy_strategy(monkeypatch, sqlite_db):
    from models.content_planning import ContentStrategy

    _seed_onboarding(sqlite_db, "user-A")
    other = ContentStrategy(user_id=999999, name="Other", industry="saas")
    sqlite_db.add(other)
    sqlite_db.commit()
    monkeypatch.setattr(
        cal_routes, "validate_calendar_generation_operations", _noop_validate
    )
    client = _build_app(sqlite_db, "user-A")

    resp = client.post("/calendar-generation/start", json=_start_payload(other.id))

    assert resp.status_code == 403


def test_start_rejects_foreign_enhanced_strategy(monkeypatch, sqlite_db):
    from models.enhanced_strategy_models import EnhancedContentStrategy

    _seed_onboarding(sqlite_db, "user-A")
    other = EnhancedContentStrategy(user_id="user-B", name="Other")
    sqlite_db.add(other)
    sqlite_db.commit()
    monkeypatch.setattr(
        cal_routes, "validate_calendar_generation_operations", _noop_validate
    )
    client = _build_app(sqlite_db, "user-A")

    resp = client.post("/calendar-generation/start", json=_start_payload(other.id))

    assert resp.status_code == 403


def test_start_rate_limited_after_3_per_hour(monkeypatch, sqlite_db):
    _seed_onboarding(sqlite_db, "user-A")
    monkeypatch.setattr(
        cal_routes, "validate_calendar_generation_operations", _noop_validate
    )
    monkeypatch.setattr(
        CalendarGenerationService, "initialize_orchestrator_session", lambda s, *a, **k: True
    )

    async def _noop_start(self, *a, **k):
        return None

    monkeypatch.setattr(CalendarGenerationService, "start_orchestrator_generation", _noop_start)
    # New sessions each call (avoid the existing-session short-circuit).
    monkeypatch.setattr(
        CalendarGenerationService, "_get_active_session_for_user", lambda s, u: None
    )
    client = _build_app(sqlite_db, "user-A")

    statuses = [
        client.post("/calendar-generation/start", json=_start_payload()).status_code
        for _ in range(4)
    ]
    assert statuses[:3] == [200, 200, 200]
    assert statuses[3] == 429


def test_billing_429_propagates_verbatim(monkeypatch, sqlite_db):
    _seed_onboarding(sqlite_db, "user-A")

    def _blocked(*a, **k):
        raise HTTPException(status_code=429, detail={"error": "quota", "message": "quota"})

    monkeypatch.setattr(cal_routes, "validate_calendar_generation_operations", _blocked)
    client = _build_app(sqlite_db, "user-A")

    resp = client.post("/calendar-generation/start", json=_start_payload())

    assert resp.status_code == 429
    assert resp.json()["detail"]["error"] == "quota"


def test_optimize_requires_onboarding(monkeypatch, sqlite_db):
    monkeypatch.setattr(
        cal_routes, "validate_calendar_generation_operations", _noop_validate
    )
    client = _build_app(sqlite_db, "user-A")

    resp = client.post(
        "/calendar-generation/optimize-content",
        json={"title": "T", "description": "D", "content_type": "blog_post",
              "target_platform": "linkedin"},
    )

    assert resp.status_code in (400, 500)
    if resp.status_code == 500:
        assert "Onboarding" in resp.json()["detail"]
    else:
        assert "Onboarding" in resp.json()["detail"]


def test_cache_invalidate_forbidden_cross_user(sqlite_db):
    client = _build_app(sqlite_db, "user-B")

    resp = client.delete("/calendar-generation/cache/invalidate/user-A")

    assert resp.status_code == 403


def test_health_live_is_public(sqlite_db):
    app = FastAPI()
    app.include_router(calendar_generation_router)
    app.dependency_overrides[get_db] = lambda: sqlite_db
    client = TestClient(app, raise_server_exceptions=False)

    resp = client.get("/calendar-generation/health/live")

    assert resp.status_code == 200
    assert resp.json()["status"] == "up"

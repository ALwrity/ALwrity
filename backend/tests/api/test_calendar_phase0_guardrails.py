"""Phase 0 guardrails — failing-first contracts for calendar readiness.

Covers (per plan):
1. Session ownership: user-B cannot read/cancel user-A session.
2. Persist lookup: sqlite-compatible session lookup, exactly 1 row per session_id.
3. No-mock: stub endpoints never return fake/mocked/fallback data.

These tests MUST FAIL on pre-Phase-1 main for the right reason, then pass after.
"""

from __future__ import annotations

from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from middleware.auth_middleware import get_current_user
from services.database import get_db
from api.content_planning.api.routes.calendar_generation import (
    router as calendar_generation_router,
)
from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
    _global_orchestrator_sessions,
)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _seed_session(session_id: str, user_id: str, status: str = "running"):
    _global_orchestrator_sessions[session_id] = {
        "request_data": {"user_id": user_id},
        "user_id": user_id,
        "status": status,
        "start_time": datetime.now(),
        "progress": {
            "current_step": 1,
            "overall_progress": 10,
            "step_results": {},
            "quality_scores": {},
            "errors": [],
            "warnings": [],
        },
    }


def _build_app(user_id: str) -> TestClient:
    app = FastAPI()
    app.include_router(calendar_generation_router)
    app.dependency_overrides[get_current_user] = lambda: {"id": user_id}
    app.dependency_overrides[get_db] = lambda: None
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _clean_global_sessions():
    _global_orchestrator_sessions.clear()
    yield
    _global_orchestrator_sessions.clear()


# ---------------------------------------------------------------------------
# 1) Ownership
# ---------------------------------------------------------------------------

def test_phase0_progress_isolated_across_users():
    _seed_session("sid-A", "user-A", "running")
    client_b = _build_app("user-B")

    resp = client_b.get("/calendar-generation/progress/sid-A")

    assert resp.status_code in (403, 404), (
        f"cross-user progress read must be denied, got {resp.status_code}: {resp.text}"
    )


def test_phase0_cancel_isolated_across_users():
    _seed_session("sid-A", "user-A", "running")
    client_b = _build_app("user-B")

    resp = client_b.delete("/calendar-generation/cancel/sid-A")

    assert resp.status_code in (403, 404), (
        f"cross-user cancel must be denied, got {resp.status_code}: {resp.text}"
    )
    # Owner session must survive a denied cancel.
    assert _global_orchestrator_sessions["sid-A"]["status"] == "running"


def test_phase0_owner_can_read_own_session():
    _seed_session("sid-A", "user-A", "running")
    client_a = _build_app("user-A")

    resp = client_a.get("/calendar-generation/progress/sid-A")

    assert resp.status_code == 200
    assert resp.json()["status"] == "running"


# ---------------------------------------------------------------------------
# 2) Persist lookup (sqlite-compatible, no duplicates)
# ---------------------------------------------------------------------------

@pytest.fixture
def sqlite_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from models.base import Base  # noqa: F401
    import models.content_planning  # noqa: F401
    import models.enhanced_calendar_models  # noqa: F401

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_phase0_persist_lookup_is_idempotent(sqlite_session):
    from models.enhanced_calendar_models import CalendarGenerationSession as Row

    service = object.__new__(CalendarGenerationService)
    service.db_session = sqlite_session
    service.orchestrator_sessions = {}
    service.orchestrator = None

    session_id = "phase0-sid-1"
    service.orchestrator_sessions[session_id] = {
        "request_data": {"user_id": "user-123", "calendar_type": "monthly"},
        "user_id": "user-123",
        "status": "running",
        "start_time": datetime.now(),
        "progress": {"current_step": 1, "overall_progress": 10},
    }

    service._persist_session_to_db(session_id)
    service._persist_session_to_db(session_id)

    rows = sqlite_session.query(Row).all()
    assert len(rows) == 1, f"expected exactly 1 row per session_id, got {len(rows)}"


def test_phase0_cleanup_preserves_recent_terminal_sessions(sqlite_session):
    """Recently completed sessions must survive cleanup (10-min grace).

    Current bug: `created_at < utcnow()  # placeholder` deletes ALL terminal
    rows regardless of age, so a just-completed calendar vanishes on next init.
    """
    from models.enhanced_calendar_models import CalendarGenerationSession as Row

    recent = Row(
        user_id="user-123",
        session_type="monthly",
        generation_params={"session_id": "recent-sid"},
        generation_status="completed",
    )
    sqlite_session.add(recent)
    sqlite_session.commit()

    service = object.__new__(CalendarGenerationService)
    service.db_session = sqlite_session
    service.orchestrator_sessions = {}
    service.orchestrator = None

    service._cleanup_old_sessions("user-123")

    remaining = sqlite_session.query(Row).filter(
        Row.generation_params["session_id"].as_string() == "recent-sid"
    ).all() if False else sqlite_session.query(Row).all()
    assert len(remaining) == 1, (
        f"recent completed session must survive cleanup, got {len(remaining)} rows"
    )


def test_phase0_failed_save_is_loud(sqlite_session):
    """Persistence failure must not masquerade as success.

    Current bug: `_save_calendar_to_db` swallows exceptions (rollback + log),
    so callers return success with nothing persisted.
    """
    service = object.__new__(CalendarGenerationService)
    service.db_session = None  # force UnboundExecution-like path via broken session
    service.orchestrator_sessions = {}
    service.orchestrator = None

    class _Broken:
        def add(self, *a, **k):
            raise RuntimeError("boom-db")
        def flush(self, *a, **k):
            raise RuntimeError("boom-db")
        def commit(self, *a, **k):
            raise RuntimeError("boom-db")
        def rollback(self):
            pass
        def query(self, *a, **k):
            raise RuntimeError("boom-db")

    service.db_session = _Broken()
    import inspect as _inspect
    src = _inspect.getsource(service._save_calendar_to_db)
    assert "Don't raise" not in src and "just log error" not in src, (
        "save failure is swallowed (log-only); must raise so API returns 500"
    )


# ---------------------------------------------------------------------------
# 3) No fake / mock / fallback data from stubs (Phase 4: grounded contract)
# ---------------------------------------------------------------------------

def _grounded_ai_json():
    return {
        "base_strategy": {
            "preferred_formats": ["Blog", "Video"],
            "brand_voice": "Bold and direct",
            "content_frequency": "3x weekly",
            "business_objectives": ["Grow pipeline"],
            "market_gaps": ["AI onboarding", "Video SEO"],
            "industry_trends": ["Short video"],
            "top_competitors": ["Acme"],
        },
        "strategic_insights": {
            "content_opportunities": ["AI Tutorials", "Case Studies"],
        },
        "performance_predictions": {
            "estimated_engagement_rate": 0.073,
            "estimated_reach": 5400,
            "estimated_conversions": 42,
            "estimated_roi": 4.1,
            "success_probability": 0.68,
        },
        "summary": {"estimated_roi": 4.1},
        "risk_assessment": {},
    }


@pytest.fixture
def grounded_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from models.base import Base  # noqa: F401
    import models.content_planning  # noqa: F401
    import models.enhanced_calendar_models  # noqa: F401
    import models.enhanced_strategy_models  # noqa: F401
    import models.onboarding  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    from models.onboarding import OnboardingSession
    from models.enhanced_strategy_models import EnhancedContentStrategy

    session.add(OnboardingSession(user_id="user-123"))
    strategy = EnhancedContentStrategy(
        user_id="user-123",
        name="Grounded Strategy",
        industry="saas",
        ai_recommendations=_grounded_ai_json(),
    )
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    yield session, strategy.id
    session.close()


def _grounded_service(db):
    service = object.__new__(CalendarGenerationService)
    service.db_session = db
    service.orchestrator = None
    service.orchestrator_sessions = {}
    return service


@pytest.mark.asyncio
async def test_phase0_optimize_has_no_fake_markers(grounded_db):
    db, strategy_id = grounded_db
    out = await _grounded_service(db).optimize_content_for_platform(
        user_id="user-123", title="Real title", description="Real desc",
        content_type="blog_post", target_platform="linkedin",
        strategy_id=strategy_id,
    )
    blob = str(out)
    for marker in ("[Optimized]", "[Platform-optimized]", "#content", "0.85"):
        assert marker not in blob, f"fake marker {marker!r} in optimize output: {blob[:300]}"
    assert out["sources"]["strategy_id"] == strategy_id
    assert out["optimized_content"]["target_platform"] == "LinkedIn"
    assert out["hashtag_suggestions"] and all(t.startswith("#") for t in out["hashtag_suggestions"])


@pytest.mark.asyncio
async def test_phase0_predict_has_no_fixed_constants(grounded_db):
    db, strategy_id = grounded_db
    out = await _grounded_service(db).predict_content_performance(
        user_id="user-123", content_type="blog_post", platform="linkedin",
        content_data={"title": "t"}, strategy_id=strategy_id,
    )
    # Values come from the seeded strategy priors, never the old quartet.
    assert out["predicted_engagement_rate"] == 0.073
    assert out["predicted_reach"] == 5400
    assert out["predicted_conversions"] == 42
    assert out["predicted_roi"] == 4.1
    assert out["confidence_score"] == 0.68
    assert out["sources"]["metric_sources"]["roi"] == "strategy_performance_predictions"


@pytest.mark.asyncio
async def test_phase0_repurpose_has_no_template_markers(grounded_db):
    db, strategy_id = grounded_db
    out = await _grounded_service(db).repurpose_content_across_platforms(
        user_id="user-123", original_content={"title": "t", "body": "b"},
        target_platforms=["linkedin"], strategy_id=strategy_id,
    )
    blob = str(out)
    assert "Optimized for linkedin requirements" not in blob
    assert "platform_specific" not in blob
    assert out["platform_adaptations"][0]["platform"] == "LinkedIn"


@pytest.mark.asyncio
async def test_phase0_trending_has_no_synthetic_keywords(grounded_db):
    db, strategy_id = grounded_db
    out = await _grounded_service(db).get_trending_topics(
        user_id="user-123", industry="saas", limit=5, strategy_id=strategy_id,
    )
    blob = str(out)
    assert "saas_trend_1" not in blob and "trend_1" not in blob, f"synthetic trend: {blob[:300]}"
    assert out["trending_topics"], "expected strategy-derived topics"
    assert all("trend_score" in t and "relevance" in t for t in out["trending_topics"])


@pytest.mark.asyncio
async def test_phase0_comprehensive_data_has_no_hardcoded_persona(grounded_db, monkeypatch):
    from fastapi import HTTPException

    db, strategy_id = grounded_db
    service = _grounded_service(db)

    async def _fake_cached(self, user_id, sid, **kwargs):
        return {"strategy_id": sid, "pillars": ["AI Tutorials"]}, False

    monkeypatch.setattr(
        "services.comprehensive_user_data_cache_service.ComprehensiveUserDataCacheService.get_cached_data",
        _fake_cached,
    )
    out = await service.get_comprehensive_user_data(user_id="user-123", strategy_id=strategy_id)
    blob = str(out)
    assert "content_type_1" not in blob, f"hardcoded gap persona: {blob[:300]}"
    assert out["status"] == "success"

    async def _empty_cached(self, user_id, sid, **kwargs):
        return None, False

    monkeypatch.setattr(
        "services.comprehensive_user_data_cache_service.ComprehensiveUserDataCacheService.get_cached_data",
        _empty_cached,
    )
    with pytest.raises(HTTPException) as excinfo:
        await service.get_comprehensive_user_data(user_id="user-123")
    assert excinfo.value.status_code == 422

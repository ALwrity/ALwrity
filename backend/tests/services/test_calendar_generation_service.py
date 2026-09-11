"""
B3: Calendar generation service contract tests.

Pins the two service seams:
1. ``generate_comprehensive_calendar`` returns the orchestrator's final
   assembled calendar (session ``result``) enriched with ``processing_time``
   and a guaranteed ``generated_at``, instead of the empty
   ``progress["step_results"]["step_12"]["result"]`` metadata read.
2. ``_save_calendar_to_db`` materializes ``CalendarEvent`` rows from the
   projected ``daily_schedule[].content_items[]`` with the real
   ``content_type``/``target_platform`` keys produced by the pipeline.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from api.content_planning.services.calendar_generation_service import (  # noqa: E402
    CalendarGenerationService,
)
from api.content_planning.api.models.responses import (  # noqa: E402
    CalendarGenerationResponse,
)


@pytest.fixture
def service():
    return object.__new__(CalendarGenerationService)


@pytest.fixture
def completed_session():
    return {
        "status": "completed",
        "result": {
            "user_id": "user-123",
            "strategy_id": 42,
            "calendar_type": "monthly",
            "industry": "saas",
            "business_size": "sme",
            "generated_at": "2026-01-10T00:00:00",
            "content_pillars": ["Thought Leadership"],
            "platform_strategies": {"LinkedIn": {"frequency": 3}},
            "content_mix": {"blog": 1.0},
            "daily_schedule": [
                {
                    "date": "2026-01-05",
                    "week_number": 1,
                    "theme": "AI Foundations",
                    "content_items": [
                        {
                            "title": "AI 101",
                            "description": "Explainer",
                            "content_type": "blog",
                            "target_platform": "LinkedIn",
                        }
                    ],
                }
            ],
            "weekly_themes": [{"week_number": 1, "theme": "AI Foundations"}],
            "content_recommendations": [],
            "optimal_timing": {},
            "performance_predictions": {},
            "trending_topics": [],
            "repurposing_opportunities": [],
            "ai_insights": [],
            "competitor_analysis": {},
            "gap_analysis_insights": {},
            "strategy_insights": {},
            "onboarding_insights": {},
            "ai_confidence": 0.87,
        },
        "progress": {
            "step_results": {
                # The progress tracker only stores per-step *metadata* here
                # (no full result payload), so the old read path returns {}.
                "step_12": {"step_number": 12, "status": "completed"},
            }
        },
    }


async def _noop_async(*args, **kwargs):
    return None


# ============================================================================
# 1) generate_comprehensive_calendar return path
# ============================================================================

@pytest.mark.asyncio
async def test_generate_calendar_returns_session_result(service, completed_session, monkeypatch):
    service.orchestrator = object()
    service.orchestrator_sessions = {}

    def fake_init(session_id, request_data):
        service.orchestrator_sessions[session_id] = completed_session
        return True

    monkeypatch.setattr(service, "initialize_orchestrator_session", fake_init)
    monkeypatch.setattr(service, "start_orchestrator_generation", _noop_async)
    monkeypatch.setattr(service, "get_orchestrator_progress", lambda *a, **k: {
        "status": "completed",
        "step_results": completed_session["progress"]["step_results"],
    })
    saved = {}
    monkeypatch.setattr(service, "_save_calendar_to_db", _noop_async)

    result = await service.generate_comprehensive_calendar(
        user_id="user-123", strategy_id=42, calendar_type="monthly"
    )

    assert result["calendar_type"] == "monthly"
    assert result["daily_schedule"][0]["content_items"][0]["title"] == "AI 101"
    assert result["processing_time"] > 0
    assert result["generated_at"] is not None


@pytest.mark.asyncio
async def test_generate_calendar_result_builds_response_model(service, completed_session, monkeypatch):
    service.orchestrator = object()
    service.orchestrator_sessions = {}

    def fake_init(session_id, request_data):
        service.orchestrator_sessions[session_id] = completed_session
        return True

    monkeypatch.setattr(service, "initialize_orchestrator_session", fake_init)
    monkeypatch.setattr(service, "start_orchestrator_generation", _noop_async)
    monkeypatch.setattr(service, "get_orchestrator_progress", lambda *a, **k: {
        "status": "completed",
        "step_results": completed_session["progress"]["step_results"],
    })
    monkeypatch.setattr(service, "_save_calendar_to_db", _noop_async)

    result = await service.generate_comprehensive_calendar(
        user_id="user-123", strategy_id=42, calendar_type="monthly"
    )
    model = CalendarGenerationResponse(**result)
    assert model.daily_schedule[0]["content_items"][0]["title"] == "AI 101"


@pytest.mark.asyncio
async def test_generate_calendar_injects_generated_at_when_missing(service, monkeypatch):
    session = {
        "status": "completed",
        "result": {"calendar_type": "monthly"},
        "progress": {"step_results": {}},
    }
    service.orchestrator = object()
    service.orchestrator_sessions = {}

    def fake_init(session_id, request_data):
        service.orchestrator_sessions[session_id] = session
        return True

    monkeypatch.setattr(service, "initialize_orchestrator_session", fake_init)
    monkeypatch.setattr(service, "start_orchestrator_generation", _noop_async)
    monkeypatch.setattr(service, "get_orchestrator_progress", lambda *a, **k: {
        "status": "completed",
        "step_results": {},
    })
    monkeypatch.setattr(service, "_save_calendar_to_db", _noop_async)

    result = await service.generate_comprehensive_calendar(
        user_id="user-123", strategy_id=42, calendar_type="monthly"
    )
    assert result["generated_at"] is not None
    assert result["processing_time"] > 0


# ============================================================================
# 2) _save_calendar_to_db persistence
# ============================================================================

@pytest.fixture
def db_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from models.base import Base  # noqa: E402
    import models.content_planning  # noqa: F401,E402
    import models.enhanced_calendar_models  # noqa: F401,E402

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine)
    session = testing_session()

    # Seed the ContentStrategy the CalendarEvent FK requires.
    from models.content_planning import ContentStrategy

    strategy = ContentStrategy(user_id=1, name="Test Strategy", industry="saas")
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    yield session, strategy.id
    session.close()


@pytest.mark.asyncio
async def test_save_calendar_to_db_materializes_events(db_session):
    session, strategy_id = db_session
    service = object.__new__(CalendarGenerationService)
    service.db_session = session

    from models.content_planning import CalendarEvent

    calendar_data = {
        "calendar_type": "monthly",
        "daily_schedule": [
            {
                "date": "2026-01-05",
                "week_number": 1,
                "theme": "AI Foundations",
                "content_items": [
                    {
                        "title": "AI 101",
                        "description": "Foundational explainer",
                        "content_type": "blog",
                        "target_platform": "LinkedIn",
                    },
                    {
                        "title": "Short clip",
                        "description": "Vertical video",
                        "content_type": "short_video",
                        "target_platform": "Instagram",
                    },
                ],
            }
        ],
    }

    await service._save_calendar_to_db("user-123", strategy_id, calendar_data, "session-1")

    events = session.query(CalendarEvent).all()
    assert len(events) == 2

    blog = next(e for e in events if e.title == "AI 101")
    assert blog.content_type == "blog"
    assert blog.platform == "LinkedIn"
    assert blog.strategy_id == strategy_id
    assert blog.status == "draft"

    clip = next(e for e in events if e.title == "Short clip")
    assert clip.content_type == "short_video"
    assert clip.platform == "Instagram"


@pytest.mark.asyncio
async def test_save_calendar_skips_events_without_strategy(db_session):
    session, strategy_id = db_session
    service = object.__new__(CalendarGenerationService)
    service.db_session = session

    from models.content_planning import CalendarEvent

    calendar_data = {
        "daily_schedule": [
            {
                "date": "2026-01-05",
                "content_items": [
                    {"title": "T", "description": "D", "content_type": "blog", "target_platform": "LinkedIn"}
                ],
            }
        ]
    }

    await service._save_calendar_to_db("user-123", None, calendar_data, "session-1")

    events = session.query(CalendarEvent).all()
    assert len(events) == 0


# ============================================================================
# 3) F4/F5: session/status truthfulness
# ============================================================================

class _FakeOrchestrator:
    """Minimal stand-in whose generate_calendar returns a fixed result."""

    def __init__(self, result):
        self._result = result

    async def generate_calendar(self, **kwargs):
        return self._result


def _session_service(result):
    service = object.__new__(CalendarGenerationService)
    service.orchestrator = _FakeOrchestrator(result)
    service.orchestrator_sessions = {}
    service.db_session = None
    return service


def _seed_session(service, session_id="sid-1"):
    service.orchestrator_sessions[session_id] = {
        "status": "initializing",
        "user_id": "user-123",
        "progress": {
            "current_step": 0,
            "overall_progress": 0,
            "step_results": {},
            "quality_scores": {},
            "errors": [],
            "warnings": [],
        },
    }
    return service.orchestrator_sessions[session_id]


@pytest.mark.asyncio
async def test_start_generation_error_result_sets_error_status():
    service = _session_service({
        "status": "error",
        "error_type": "step_execution_error",
        "error_message": "Step 5 exploded",
        "user_id": "user-123",
    })
    session = _seed_session(service)

    await service.start_orchestrator_generation("sid-1", {"user_id": "user-123"})

    assert session["status"] == "error"
    assert session["error"] == "Step 5 exploded"
    assert "result" not in session
    assert any(e["message"] == "Step 5 exploded" for e in session["progress"]["errors"])


@pytest.mark.asyncio
async def test_start_generation_completed_when_result_carries_calendar():
    real_calendar = {
        "status": "completed",
        "daily_schedule": [
            {"date": "2026-01-05", "content_items": [{"title": "AI 101"}]}
        ],
        "user_id": "user-123",
    }
    service = _session_service(real_calendar)
    session = _seed_session(service)

    await service.start_orchestrator_generation("sid-1", {"user_id": "user-123"})

    assert session["status"] == "completed"
    assert session["result"] is real_calendar
    assert not session["progress"]["errors"]


@pytest.mark.asyncio
async def test_start_generation_completed_status_without_calendar_is_error():
    service = _session_service({"status": "completed", "user_id": "user-123"})
    session = _seed_session(service)

    await service.start_orchestrator_generation("sid-1", {"user_id": "user-123"})

    assert session["status"] == "error"
    assert session["error"]
    assert "result" not in session


@pytest.mark.asyncio
async def test_poll_loop_raises_promptly_on_error_status(monkeypatch):
    service = object.__new__(CalendarGenerationService)
    service.orchestrator = object()
    service.orchestrator_sessions = {}
    service.db_session = None

    def fake_init(session_id, request_data):
        service.orchestrator_sessions[session_id] = {"status": "error"}
        return True

    monkeypatch.setattr(service, "initialize_orchestrator_session", fake_init)
    monkeypatch.setattr(service, "start_orchestrator_generation", _noop_async)
    monkeypatch.setattr(service, "get_orchestrator_progress", lambda *a, **k: {
        "status": "error",
        "errors": [{"message": "boom"}],
    })

    with pytest.raises(Exception) as excinfo:
        await service.generate_comprehensive_calendar(user_id="user-123", strategy_id=1)

    assert "boom" in str(excinfo.value)


@pytest.mark.asyncio
async def test_save_calendar_to_db_skips_error_result(db_session):
    session, strategy_id = db_session
    service = object.__new__(CalendarGenerationService)
    service.db_session = session

    from models.content_planning import CalendarEvent

    error_data = {
        "status": "error",
        "error_message": "boom",
        "calendar_type": "monthly",
    }

    await service._save_calendar_to_db("user-123", strategy_id, error_data, "session-1")

    events = session.query(CalendarEvent).all()
    assert len(events) == 0

    from models.enhanced_calendar_models import CalendarGenerationSession as SessionRecord

    records = session.query(SessionRecord).all()
    assert all(r.generation_status != "completed" for r in records)


# ============================================================================
# 4) B4: get_orchestrator_progress delivers the assembled result
# ============================================================================

def _progress_session():
    return {
        "status": "completed",
        "last_updated": "2026-01-10T00:00:00Z",
        "result": {"daily_schedule": [{"date": "2026-01-05"}]},
        "progress": {
            "current_step": 12,
            "step_progress": 100,
            "overall_progress": 100,
            "step_results": {},
            "quality_scores": {},
            "errors": [],
            "warnings": [],
        },
    }


def test_progress_includes_result_when_completed():
    service = object.__new__(CalendarGenerationService)
    service.orchestrator_sessions = {"sid-1": _progress_session()}

    progress = service.get_orchestrator_progress("sid-1")

    assert progress is not None
    assert progress["status"] == "completed"
    assert progress["result"] == {"daily_schedule": [{"date": "2026-01-05"}]}


def test_progress_excludes_result_while_running():
    session = _progress_session()
    session["status"] = "running"
    del session["result"]
    service = object.__new__(CalendarGenerationService)
    service.orchestrator_sessions = {"sid-1": session}

    progress = service.get_orchestrator_progress("sid-1")

    assert progress["status"] == "running"
    assert progress["result"] is None
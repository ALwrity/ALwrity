"""Calendar SIF — Phase A: trigger hook tests.

Proves the calendar SIF indexing dispatch from
``CalendarGenerationService._save_calendar_to_db``:

- calling it with a completed calendar dispatches
  ``index_calendar_async``;
- a dispatch failure does NOT fail the calendar save;
- disabled feature flag skips dispatch entirely.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.calendar_sif_index_status import CalendarSifIndexStatus
from models.calendar_sif_watermark import CalendarSifWatermark
from models.content_planning import CalendarEvent
from models.enhanced_calendar_models import CalendarGenerationSession
from services.database import get_db

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import middleware.auth_middleware as _auth
import api.content_planning.api.routes.calendar_generation as _cal_router_mod
from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
)

UID = "user-42"
SOURCE = "user:user-42:calendar_latest"

DISPATCH_TARGET = "services.calendar_sif_indexer.index_calendar_async"


def _make_calendar(**overrides):
    cal = {
        "calendar_type": "monthly",
        "industry": "SaaS",
        "business_size": "SME",
        "generated_at": "2026-09-13T10:00:00",
        "daily_schedule": [
            {
                "date": "2026-09-14",
                "week_number": 38,
                "theme": "AI Foundations",
                "content_items": [
                    {
                        "title": "AI 101",
                        "content_type": "blog_post",
                        "platform": "website",
                        "status": "draft",
                        "kpi": "engagement",
                        "expected_outcome": "1000 views",
                    }
                ],
                "platform_distribution": {"website": 1},
                "quality_metrics": {"score": 0.9},
            }
        ],
        "weekly_themes": [
            {"week_number": 38, "theme": "AI Foundations", "content_count": 3, "platforms": ["website", "linkedin"]},
        ],
        "content_recommendations": [
            {"type": "blog_post", "topic": "AI Tutorials", "priority": "high", "estimated_roi": 0.15},
        ],
        "performance_predictions": {
            "estimated_engagement": 75,
            "estimated_reach": 5000,
            "estimated_conversions": 200,
        },
        "ai_insights": [
            {"insight": "Post mornings", "action": "Schedule for 9am", "confidence": 0.85},
        ],
        "strategy_insights": {"alignment_score": 0.9},
        "gap_analysis_insights": {"gaps": ["Video content"]},
        "strategy_digest": {"pillars": ["AI Tutorials"]},
        "quality_score": 0.85,
    }
    cal.update(overrides)
    return cal


@pytest.fixture()
def ctx(tmp_path):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    CalendarSifIndexStatus.__table__.create(engine)
    CalendarSifWatermark.__table__.create(engine)
    CalendarGenerationSession.__table__.create(engine)
    CalendarEvent.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


def _make_service(ctx):
    service = CalendarGenerationService.__new__(CalendarGenerationService)
    service.db_session = ctx
    service.orchestrator = None
    service.orchestrator_sessions = {}
    return service


class TestCalendarSifTrigger:
    def test_completion_dispatches_sif_indexing(self, ctx):
        calendar = _make_calendar()
        service = _make_service(ctx)
        captured = {}

        def _dispatch(user_id, calendar_data, generated_at, sif_service=None):
            captured["session"] = None  # task opens its own session (R2.1)
            captured["user_id"] = user_id
            captured["calendar_data"] = calendar_data
            captured["generated_at"] = generated_at

        with patch(DISPATCH_TARGET, side_effect=_dispatch):
            import asyncio
            asyncio.run(service._save_calendar_to_db(UID, 1, calendar, "session-1"))

        assert captured["user_id"] == UID
        assert captured["calendar_data"]["calendar_type"] == "monthly"
        assert captured["generated_at"] == "2026-09-13T10:00:00"

    def test_dispatch_failure_does_not_fail_save(self, ctx):
        calendar = _make_calendar()
        service = _make_service(ctx)

        with patch(DISPATCH_TARGET, side_effect=RuntimeError("txtai unavailable")):
            import asyncio
            asyncio.run(service._save_calendar_to_db(UID, 1, calendar, "session-1"))

    def test_disabled_feature_flag_skips_dispatch(self, ctx, monkeypatch):
        old_env = os.environ.get("CALENDAR_SIF_INDEXING_ENABLED")
        monkeypatch.setenv("CALENDAR_SIF_INDEXING_ENABLED", "0")

        calendar = _make_calendar()
        service = _make_service(ctx)
        captured = {}

        def _dispatch(*args, **kwargs):
            captured["called"] = True

        with patch(DISPATCH_TARGET, side_effect=_dispatch):
            import asyncio
            asyncio.run(service._save_calendar_to_db(UID, 1, calendar, "session-1"))

        assert not captured.get("called", False)

        if old_env is not None:
            monkeypatch.setenv("CALENDAR_SIF_INDEXING_ENABLED", old_env)
        else:
            monkeypatch.delenv("CALENDAR_SIF_INDEXING_ENABLED", raising=False)

    def test_trigger_uses_fire_and_forget(self, ctx):
        """index_calendar_async is called and does not block the save."""
        calendar = _make_calendar()
        service = _make_service(ctx)

        called = {}

        def _dispatch(user_id, calendar_data, generated_at, sif_service=None):
            called["invoked"] = True

        with patch(DISPATCH_TARGET, side_effect=_dispatch):
            import asyncio
            asyncio.run(service._save_calendar_to_db(UID, 1, calendar, "session-1"))

        assert called.get("invoked") is True

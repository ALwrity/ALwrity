"""Phase 2: strategy_context wired into build_grounding_context (TDD).

Monkeypatches ``services.today_workflow_service.build_strategy_context``
with a stub. Verifies the key lands verbatim and that a failure degrades to
``{status:'error'}`` without crashing the grounding builder.
"""
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.base import Base
from services.today_workflow_service import build_grounding_context


def _session():
    import models.agent_activity_models  # noqa: F401
    import models.content_planning  # noqa: F401
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_grounding_contains_strategy_context_key_verbatim():
    expected = {"status": "available", "strategy_id": 7, "kpi_targets": [
        {"metric": "visibility_score", "target": "70"}]}
    db = _session()
    import services.today_workflow_service as svc
    with patch.object(svc, "build_strategy_context", return_value=expected):
        grounding = build_grounding_context(db, "u1", "2026-09-13")
        assert grounding.get("strategy_context") is expected
    db.close()


def test_grounding_strategy_context_failure_degrades_not_crashes():
    db = _session()
    import services.today_workflow_service as svc
    with patch.object(svc, "build_strategy_context",
                      side_effect=RuntimeError("boom")):
        grounding = build_grounding_context(db, "u1", "2026-09-13")
        assert isinstance(grounding.get("strategy_context"), dict)
        assert grounding["strategy_context"].get("status") == "error"
        for key in ("recent_agent_alerts", "onboarding_data",
                    "workflow_config", "calendar_events_today"):
            assert key in grounding
    db.close()


def test_grounding_strategy_context_inactive_returns_inactive():
    db = _session()
    import services.today_workflow_service as svc
    envelope = {"status": "inactive", "strategy_id": None, "kpi_targets": []}
    with patch.object(svc, "build_strategy_context", return_value=envelope):
        grounding = build_grounding_context(db, "u1", "2026-09-13")
        assert grounding["strategy_context"]["status"] == "inactive"
    db.close()
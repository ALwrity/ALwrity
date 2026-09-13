"""Phase 2: strategy_monitoring wired into build_grounding_context (TDD).

Tests use a real in-memory SQLite session (all required models share
models.base.Base) and monkeypatch
``services.today_workflow_service.build_strategy_monitoring_evidence``
with a stub. Verifies the monitoring key lands verbatim and that a
monitoring_evidence failure degrades to ``{status:'error'}`` without
crashed grounding.
"""
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.base import Base
from services.today_workflow_service import build_grounding_context


def _session():
    # Import models so their tables register on Base.metadata before create_all
    import models.agent_activity_models  # noqa: F401
    import models.content_planning  # noqa: F401
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_grounding_contains_strategy_monitoring_key_verbatim():
    expected = {"status": "available", "strategy_id": 7, "overall": "degraded"}
    db = _session()
    import services.today_workflow_service as svc
    with patch.object(svc, "build_strategy_monitoring_evidence",
                      return_value=expected):
        grounding = build_grounding_context(db, "u1", "2026-09-13")
        assert grounding.get("strategy_monitoring") is expected
    db.close()


def test_grounding_monitoring_failure_degrades_not_crashes():
    db = _session()
    import services.today_workflow_service as svc
    with patch.object(
        svc,
        "build_strategy_monitoring_evidence",
        side_effect=RuntimeError("boom"),
    ):
        grounding = build_grounding_context(db, "u1", "2026-09-13")
        assert isinstance(grounding.get("strategy_monitoring"), dict)
        assert grounding["strategy_monitoring"].get("status") == "error"
        assert "monitoring" in grounding["strategy_monitoring"].get("limitations")[0].lower() \
            or "evidence" in grounding["strategy_monitoring"].get("limitations")[0].lower()
        for key in ("recent_agent_alerts", "onboarding_data",
                    "workflow_config", "calendar_events_today"):
            assert key in grounding
    db.close()


def test_grounding_monitoring_inactive_returns_inactive():
    db = _session()
    import services.today_workflow_service as svc
    envelope = {"status": "inactive", "strategy_id": None, "overall": None}
    with patch.object(svc, "build_strategy_monitoring_evidence",
                      return_value=envelope):
        grounding = build_grounding_context(db, "u1", "2026-09-13")
        assert grounding["strategy_monitoring"]["status"] == "inactive"
    db.close()
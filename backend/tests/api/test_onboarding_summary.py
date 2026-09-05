"""
Tests for the onboarding tasks-status endpoint (Phase 1: completion detection).

These tests exercise the REAL ``get_tasks_status`` logic through a faked DB
session — no mocking of the function under test.

Completion semantics: ``has_completed_onboarding`` is sourced from
``OnboardingSession`` (``progress_service.complete_onboarding`` sets
``current_step=5`` / ``progress=100``) — the same record the route guards
use. It must NOT depend on background task tables: pre-scheduling users
have no task rows, and recurring/failed tasks would otherwise keep the
flag False forever (user-reported bug).
"""
import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from api.onboarding_utils.endpoints_tasks import get_tasks_status
from models.website_analysis_monitoring_models import (
    OnboardingFullWebsiteAnalysisTask,
    DeepCompetitorAnalysisTask,
    DeepWebsiteCrawlTask,
    SIFIndexingTask,
    MarketTrendsTask,
    SIFIndexingExecutionLog,
)
from models.monitoring_models import StrategyActivationStatus
from models.onboarding import OnboardingSession
from models.advertools_monitoring_models import AdvertoolsTask

TASK_MODELS = {
    OnboardingFullWebsiteAnalysisTask: "full_site_seo_audit",
    DeepCompetitorAnalysisTask: "deep_competitor_analysis",
    SIFIndexingTask: "sif_indexing",
    MarketTrendsTask: "market_trends",
    AdvertoolsTask: "advertools",
    DeepWebsiteCrawlTask: "deep_website_crawl",
}


def _task(status: str):
    """Build a task row shaped like the monitoring models expect."""
    done = status == "completed"
    return SimpleNamespace(
        id=1,
        status=status,
        last_executed=datetime.now(timezone.utc) if status != "pending" else None,
        last_success=datetime.now(timezone.utc) if done else None,
        next_execution=None,
        failure_reason="boom" if status == "failed" else None,
        payload={},  # SIF branch reads this
    )


def _session(step: int, progress: float):
    return SimpleNamespace(current_step=step, progress=progress)


def _fake_db(task_status: str = "pending", activation_row=None, session_row=None):
    """Session fake whose query chain returns per-model configured rows.

    Simulates basic WHERE semantics: a ``column == value`` filter clause is
    checked against the row (when the row has that attribute); a row that
    fails the filter is treated as not found — mirroring the real DB.
    """

    def _matches(row, filter_args):
        for f in filter_args:
            right = getattr(f, "right", None)
            val = getattr(right, "value", None)
            col = getattr(getattr(f, "left", None), "key", None)
            if col and val is not None and hasattr(row, col):
                if getattr(row, col) != val:
                    return False
        return True

    def _query(model):
        chain = SimpleNamespace()
        if model in TASK_MODELS:
            row = _task(task_status)
        elif model is SIFIndexingExecutionLog:
            row = None  # no execution log
        elif model is StrategyActivationStatus:
            row = activation_row
        elif model is OnboardingSession:
            row = session_row
        else:
            row = None

        def _filter(*fargs, **fkwargs):
            visible = row if (row is None or _matches(row, fargs)) else None
            return SimpleNamespace(
                order_by=lambda *a, **k: SimpleNamespace(first=lambda: visible),
                first=lambda: visible,
            )

        chain.filter = _filter
        chain.first = lambda: row
        return chain

    db = SimpleNamespace(query=_query, close=lambda: None)
    return db


def _run(user_id="123", db=None):
    with patch(
        "api.onboarding_utils.endpoints_tasks.get_session_for_user",
        return_value=db,
    ):
        return asyncio.run(get_tasks_status({"id": user_id}))


# ============================================================
# Endpoint contract
# ============================================================

def test_no_db_session_returns_error():
    result = _run(db=None)
    assert result == {"error": "Database connection failed"}


def test_no_tasks_and_no_session_all_pending_not_complete():
    """Brand-new user, nothing on record: all 6 tasks pending, not complete."""
    result = _run(db=_fake_db())

    assert result["total"] == 6
    assert result["completed_count"] == 0
    assert result["failed_count"] == 0
    assert result["all_done"] is False
    assert result["has_completed_onboarding"] is False
    assert result["has_active_strategy"] is False
    assert result["onboarding_data_available"] is True


# ============================================================
# has_completed_onboarding: sourced from OnboardingSession
# ============================================================

def test_completed_session_reports_complete_even_without_task_rows():
    """THE user-reported bug: a user who onboarded before task scheduling
    (or whose tasks are still pending/failed) has NO task rows — but the
    session record says complete. The CTA flag must be True."""
    db = _fake_db(
        task_status="pending",
        session_row=_session(step=5, progress=100.0),
    )
    result = _run(db=db)

    assert result["has_completed_onboarding"] is True
    # Background tasks are still churning — the status card keeps polling.
    assert result["all_done"] is False
    assert result["completed_count"] == 0


def test_completed_session_true_when_tasks_failed():
    """Terminal task failures must not block the completion flag."""
    db = _fake_db(
        task_status="failed",
        session_row=_session(step=5, progress=100.0),
    )
    result = _run(db=db)

    assert result["has_completed_onboarding"] is True
    assert result["all_done"] is True  # failed is terminal for all_done
    assert result["failed_count"] == 6


def test_incomplete_session_not_complete_even_if_tasks_done():
    """Session is the source of truth: a mid-onboarding session (step 3)
    stays incomplete even if background tasks happen to be done."""
    db = _fake_db(
        task_status="completed",
        session_row=_session(step=3, progress=50.0),
    )
    result = _run(db=db)

    assert result["has_completed_onboarding"] is False
    assert result["all_done"] is True


def test_no_session_row_not_complete():
    """No OnboardingSession row at all → user never onboarded."""
    db = _fake_db(task_status="completed", session_row=None)
    result = _run(db=db)

    assert result["has_completed_onboarding"] is False


def test_progress_100_counts_as_complete():
    """Belt-and-braces: progress=100 marks completion even if step lagged."""
    db = _fake_db(
        task_status="pending",
        session_row=_session(step=4, progress=100.0),
    )
    result = _run(db=db)

    assert result["has_completed_onboarding"] is True


def test_session_check_failure_degrades_to_false():
    """A failure reading the session must not break the whole endpoint."""

    def _boom(model):
        if model is OnboardingSession:
            raise RuntimeError("db down")
        return SimpleNamespace(
            filter=lambda *a, **k: SimpleNamespace(
                order_by=lambda *a, **k: SimpleNamespace(first=lambda: None),
                first=lambda: None,
            ),
            first=lambda: None,
        )

    db = SimpleNamespace(query=_boom, close=lambda: None)
    result = _run(db=db)

    assert result["has_completed_onboarding"] is False
    assert result["total"] == 6  # rest of the payload intact


# ============================================================
# has_active_strategy: real StrategyActivationStatus query
# ============================================================

def test_active_strategy_detected():
    db = _fake_db(
        task_status="completed",
        activation_row=SimpleNamespace(status="active"),
        session_row=_session(step=5, progress=100.0),
    )
    result = _run(db=db)
    assert result["has_active_strategy"] is True
    assert result["has_completed_onboarding"] is True


def test_inactive_or_paused_strategy_not_detected():
    db = _fake_db(
        task_status="completed",
        activation_row=SimpleNamespace(status="inactive"),
        session_row=_session(step=5, progress=100.0),
    )
    result = _run(db=db)
    assert result["has_active_strategy"] is False


def test_activation_check_failure_degrades_to_false():
    """DB hiccup on the activation query must not break the endpoint."""

    def _boom(model):
        if model is StrategyActivationStatus:
            raise RuntimeError("db down")
        if model is OnboardingSession:
            row = _session(step=5, progress=100.0)
        elif model in TASK_MODELS:
            row = _task("completed")
        else:
            row = None
        return SimpleNamespace(
            filter=lambda *a, **k: SimpleNamespace(
                order_by=lambda *a, **k: SimpleNamespace(first=lambda: row),
                first=lambda: row,
            ),
            first=lambda: row,
        )

    db = SimpleNamespace(query=_boom, close=lambda: None)
    result = _run(db=db)

    assert result["has_active_strategy"] is False
    assert result["all_done"] is True  # rest of the payload still intact


def test_non_numeric_user_id_degrades_to_false():
    """StrategyActivationStatus.user_id is an Integer; a non-numeric id
    must degrade to False, not crash."""
    db = _fake_db(
        task_status="completed",
        activation_row=SimpleNamespace(status="active"),
        session_row=_session(step=5, progress=100.0),
    )
    result = _run(user_id="clerk_nonnumeric", db=db)
    assert result["has_active_strategy"] is False
    # Task tables (String user_id) still resolve fine
    assert result["completed_count"] == 6

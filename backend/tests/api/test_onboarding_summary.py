"""
Tests for the onboarding tasks-status endpoint (Phase 1: completion detection).

These tests exercise the REAL ``get_tasks_status`` logic through a faked DB
session — no mocking of the function under test — so the completion flags
(``all_done``, ``has_completed_onboarding``, ``has_active_strategy``) are
verified against actual behaviour.
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
from models.advertools_monitoring_models import AdvertoolsTask

TASK_MODELS = {
    OnboardingFullWebsiteAnalysisTask: "full_site_seo_audit",
    DeepCompetitorAnalysisTask: "deep_competitor_analysis",
    SIFIndexingTask: "sif_indexing",
    MarketTrendsTask: "market_trends",
    AdvertoolsTask: "advertools",
    DeepWebsiteCrawlTask: "deep_website_crawl",
}

CRITICAL = ("full_site_seo_audit", "deep_competitor_analysis", "sif_indexing")


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


def _fake_db(task_status: str = "pending", activation_row=None):
    """Session fake whose query chain returns per-model configured rows.

    Simulates basic WHERE semantics: a ``column == value`` filter clause is
    checked against the row (when the row has that attribute), and a row that
    does not satisfy the filter is treated as not found — mirroring what the
    real database would return.
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


def test_no_tasks_all_pending_not_complete():
    """A brand-new user: all 6 tasks pending, nothing complete."""
    result = _run(db=_fake_db())

    assert result["total"] == 6
    assert result["completed_count"] == 0
    assert result["failed_count"] == 0
    assert result["all_done"] is False
    assert result["has_completed_onboarding"] is False
    assert result["has_active_strategy"] is False
    assert result["onboarding_data_available"] is True
    for key in TASK_MODELS.values():
        assert result["tasks"][key]["status"] == "pending"


# ============================================================
# has_completed_onboarding: critical tasks vs all_done
# ============================================================

def test_critical_tasks_done_but_recurring_pending():
    """The 3 critical tasks completed but recurring ones pending:
    onboarding counts as complete (strategy data available) while
    all_done stays False (background polling continues)."""
    db = _fake_db()
    real_query = db.query

    critical_models = [
        OnboardingFullWebsiteAnalysisTask,
        DeepCompetitorAnalysisTask,
        SIFIndexingTask,
    ]

    def _query(model):
        if model in critical_models:
            return _chain_for(_task("completed"))
        return real_query(model)

    db.query = _query
    result = _run(db=db)

    assert result["has_completed_onboarding"] is True
    assert result["all_done"] is False
    assert result["completed_count"] == 3


def test_all_tasks_completed_flags_all_true():
    db = _fake_db(task_status="completed")
    result = _run(db=db)

    assert result["completed_count"] == 6
    assert result["all_done"] is True
    assert result["has_completed_onboarding"] is True


def test_failed_task_counts_toward_all_done():
    """A failed task is terminal: all_done True, failed_count 1, and the
    critical-task check still sees completed only for non-failed."""
    db = _fake_db(task_status="completed")
    real_query = db.query

    def _query(model):
        if model is DeepCompetitorAnalysisTask:
            return _chain_for(_task("failed"))
        return real_query(model)

    db.query = _query
    result = _run(db=db)

    assert result["failed_count"] == 1
    assert result["all_done"] is True
    # competitor analysis is critical and failed → not completed → flags False
    assert result["has_completed_onboarding"] is False


def _chain_for(row):
    return SimpleNamespace(
        filter=lambda *a, **k: SimpleNamespace(
            order_by=lambda *a, **k: SimpleNamespace(first=lambda: row)
        ),
        first=lambda: row,
    )


# ============================================================
# has_active_strategy: real StrategyActivationStatus query
# ============================================================

def test_active_strategy_detected():
    db = _fake_db(task_status="completed", activation_row=SimpleNamespace(status="active"))
    result = _run(db=db)
    assert result["has_active_strategy"] is True


def test_inactive_or_paused_strategy_not_detected():
    db = _fake_db(task_status="completed", activation_row=SimpleNamespace(status="inactive"))
    result = _run(db=db)
    assert result["has_active_strategy"] is False


def test_activation_check_failure_degrades_to_false():
    """DB hiccup on the activation query must not break the endpoint."""

    def _boom(model):
        if model is StrategyActivationStatus:
            raise RuntimeError("db down")
        return _chain_for(_task("completed") if model in TASK_MODELS else None)

    db = SimpleNamespace(query=_boom, close=lambda: None)
    result = _run(db=db)

    assert result["has_active_strategy"] is False
    assert result["all_done"] is True  # rest of the payload still intact


def test_non_numeric_user_id_degrades_to_false():
    """StrategyActivationStatus.user_id is an Integer; a non-numeric id
    must degrade to False, not crash."""
    db = _fake_db(task_status="completed", activation_row=SimpleNamespace(status="active"))
    result = _run(user_id="clerk_nonnumeric", db=db)
    assert result["has_active_strategy"] is False
    # Task tables (String user_id) still resolve fine
    assert result["completed_count"] == 6

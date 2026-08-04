"""
Unit + service tests for the Onboarding Scheduled Task Health enrichment.

Covers the fields added to the SEO Dashboard task-health payload:

    * ``RESULTS_KEY_BY_TASK_MODEL`` — maps each onboarding task model to the
      UI section that should open for its results.
    * ``_summarize_execution_result`` — human-readable per-task summaries
      derived from each executor's ``result_data`` shape.
    * ``_get_single_task_health`` / ``get_onboarding_scheduled_task_health`` —
      the enriched task-level ``results_key`` + ``result_summary`` fields,
      plus the preserved ``latest_execution`` block.

Runs against a throwaway user + temp-workspace SQLite DB (same pattern as
``test_website_analysis_monitoring_loop.py``); the real workspace is never
touched and the per-user engine cache is cleared in teardown.
"""

import asyncio
import importlib
import shutil
from datetime import datetime
from uuid import uuid4

import pytest

db_engine_mod = importlib.import_module("services.database.engine")
import services.workspace_paths as workspace_paths
import utils.storage_paths as storage_paths
from services.database import get_session_for_user

from models.website_analysis_monitoring_models import (
    DeepCompetitorAnalysisTask,
    DeepCompetitorAnalysisExecutionLog,
    MarketTrendsTask,
    MarketTrendsExecutionLog,
    OnboardingFullWebsiteAnalysisTask,
    OnboardingFullWebsiteAnalysisExecutionLog,
    SIFIndexingTask,
    SIFIndexingExecutionLog,
)
from services.seo.dashboard_service import SEODashboardService, RESULTS_KEY_BY_TASK_MODEL, TASK_TYPE_BY_MODEL

USER_URL = "https://acme-corp.example.com"


# ---------------------------------------------------------------------------
# Fixtures (mirrors the monitoring-loop harness)
# ---------------------------------------------------------------------------

@pytest.fixture
def workspace_redirect(tmp_path, monkeypatch):
    root = tmp_path / "workspace"
    root.mkdir()
    monkeypatch.setattr(workspace_paths, "get_workspace_root", lambda: root)
    monkeypatch.setattr(storage_paths, "get_workspace_root", lambda: root)
    return root


@pytest.fixture
def user_db(workspace_redirect):
    user_id = f"e2e_health_{uuid4().hex[:10]}"
    db = get_session_for_user(user_id)
    ctx = {"user_id": user_id, "db": db, "workspace": workspace_redirect}
    try:
        yield ctx
    finally:
        try:
            db.close()
        finally:
            engine = db_engine_mod._user_engines.pop(user_id, None)
            if engine is not None:
                engine.dispose()
            shutil.rmtree(str(workspace_redirect), ignore_errors=True)


def _make_service(db):
    """Build a SEODashboardService without the heavy __init__ side effects."""
    svc = SEODashboardService.__new__(SEODashboardService)
    svc.db = db
    return svc


# ---------------------------------------------------------------------------
# RESULTS_KEY_BY_TASK_MODEL
# ---------------------------------------------------------------------------

def test_results_key_mapping_has_all_four_onboarding_tasks():
    expected = {
        OnboardingFullWebsiteAnalysisTask: "website_analysis",
        DeepCompetitorAnalysisTask: "competitor_analysis",
        SIFIndexingTask: "sif_indexing",
        MarketTrendsTask: "market_trends",
    }
    assert RESULTS_KEY_BY_TASK_MODEL == expected


def test_task_type_mapping_has_all_four_onboarding_tasks():
    expected = {
        OnboardingFullWebsiteAnalysisTask: "onboarding_full_website_analysis",
        DeepCompetitorAnalysisTask: "deep_competitor_analysis",
        SIFIndexingTask: "sif_indexing",
        MarketTrendsTask: "market_trends",
    }
    assert TASK_TYPE_BY_MODEL == expected


# ---------------------------------------------------------------------------
# _summarize_execution_result
# ---------------------------------------------------------------------------

def test_summarize_website_analysis_result():
    svc = _make_service(None)
    summary = svc._summarize_execution_result(
        {
            "crawl_result": {"pages": [{"url": "a"}, {"url": "b"}, {"url": "c"}]},
            "style_analysis": {"writing_style": "concise"},
            "seo_audit": {"overall_score": 80},
        }
    )
    assert summary == "3 pages crawled; style analysis complete; SEO audit complete"


def test_summarize_website_analysis_crawl_without_pages_list():
    svc = _make_service(None)
    summary = svc._summarize_execution_result({"crawl_result": {"url": USER_URL}})
    assert summary == "website crawled"


def test_summarize_competitor_analysis_result():
    svc = _make_service(None)
    summary = svc._summarize_execution_result(
        {
            "competitors": [{"url": "a"}, {"url": "b"}],
            "metadata": {"competitors_analyzed": 2},
        }
    )
    assert summary == "2 competitors analyzed"


def test_summarize_competitor_analysis_falls_back_to_list_length():
    svc = _make_service(None)
    summary = svc._summarize_execution_result({"competitors": [{"url": "a"}, {"url": "b"}, {"url": "c"}]})
    assert summary == "3 competitors analyzed"


def test_summarize_sif_indexing_result():
    svc = _make_service(None)
    summary = svc._summarize_execution_result(
        {
            "metadata_synced": 7,
            "content_synced": True,
            "guardian_report": {
                "pillars_found": 4,
                "pages_analyzed": 12,
            },
        }
    )
    assert summary == "metadata items synced: 7; content pages indexed: yes; pillars found: 4; pages analyzed: 12"


def test_summarize_market_trends_result():
    svc = _make_service(None)
    summary = svc._summarize_execution_result(
        {
            "run_id": "trend_123",
            "keywords": ["seo tools", "ai writing"],
            "geo": "US",
            "timeframe": "today 12-m",
        }
    )
    assert summary == "trends run for 2 keyword(s); US / today 12-m"


def test_summarize_prefers_explicit_summary():
    svc = _make_service(None)
    summary = svc._summarize_execution_result(
        {"summary": "Completed with 12 recommendations", "crawl_result": {"pages": [1]}}
    )
    assert summary == "Completed with 12 recommendations"


def test_summarize_skipped_reason():
    svc = _make_service(None)
    summary = svc._summarize_execution_result({"reason": "no competitors configured"})
    assert summary == "Skipped: no competitors configured"


def test_summarize_fallback_to_keys():
    svc = _make_service(None)
    summary = svc._summarize_execution_result({"zeta": 1, "alpha": 2})
    assert summary == "Result keys: alpha, zeta"


def test_summarize_none_or_empty_returns_none():
    svc = _make_service(None)
    assert svc._summarize_execution_result(None) is None
    assert svc._summarize_execution_result("not a dict") is None
    assert svc._summarize_execution_result({}) is None


# ---------------------------------------------------------------------------
# _get_single_task_health / aggregate
# ---------------------------------------------------------------------------

def test_single_task_health_not_scheduled(user_db):
    svc = _make_service(user_db["db"])
    health = svc._get_single_task_health(
        user_id=user_db["user_id"],
        task_model=MarketTrendsTask,
        log_model=MarketTrendsExecutionLog,
        label="Market Trends",
        site_key="",
    )
    assert health["label"] == "Market Trends"
    assert health["results_key"] == "market_trends"
    assert health["task_id"] is None
    assert health["task_type"] == "market_trends"
    assert health["status"] == "not_scheduled"
    assert health["result_summary"] is None
    assert health["latest_execution"] is None


def test_single_task_health_includes_results_key_and_summary(user_db):
    db = user_db["db"]
    user_id = user_db["user_id"]

    task = OnboardingFullWebsiteAnalysisTask(
        user_id=user_id,
        website_url=USER_URL,
        status="active",
        last_success=datetime.utcnow(),
        consecutive_failures=0,
    )
    db.add(task)
    db.flush()

    db.add(
        OnboardingFullWebsiteAnalysisExecutionLog(
            task_id=task.id,
            status="success",
            result_data={
                "crawl_result": {"pages": [{"url": "a"}, {"url": "b"}]},
                "style_analysis": {"writing_style": "concise"},
                "seo_audit": {"overall_score": 80},
            },
        )
    )
    db.commit()

    svc = _make_service(db)
    health = svc._get_single_task_health(
        user_id=user_id,
        task_model=OnboardingFullWebsiteAnalysisTask,
        log_model=OnboardingFullWebsiteAnalysisExecutionLog,
        label="Onboarding Full Website Analysis",
        site_key="",
    )
    assert health["status"] == "active"
    assert health["results_key"] == "website_analysis"
    assert health["task_id"] == task.id
    assert health["task_type"] == "onboarding_full_website_analysis"
    assert health["result_summary"] == "2 pages crawled; style analysis complete; SEO audit complete"
    assert health["latest_execution"]["status"] == "success"
    assert health["latest_execution"]["result_summary"] == health["result_summary"]


def test_single_task_health_no_latest_execution_keeps_task_fields(user_db):
    db = user_db["db"]
    user_id = user_db["user_id"]

    task = SIFIndexingTask(user_id=user_id, website_url=USER_URL, status="active")
    db.add(task)
    db.commit()

    svc = _make_service(db)
    health = svc._get_single_task_health(
        user_id=user_id,
        task_model=SIFIndexingTask,
        log_model=SIFIndexingExecutionLog,
        label="SIF Indexing",
        site_key="",
    )
    assert health["results_key"] == "sif_indexing"
    assert health["task_id"] == task.id
    assert health["task_type"] == "sif_indexing"
    assert health["status"] == "active"
    assert health["result_summary"] is None
    assert health["latest_execution"] is None


def test_aggregate_health_returns_all_tasks_with_results_key(user_db):
    db = user_db["db"]
    user_id = user_db["user_id"]

    def seed(task_model, log_model, result_data):
        task = task_model(user_id=user_id, website_url=USER_URL, status="active")
        db.add(task)
        db.flush()
        db.add(log_model(task_id=task.id, status="success", result_data=result_data))

    seed(
        OnboardingFullWebsiteAnalysisTask,
        OnboardingFullWebsiteAnalysisExecutionLog,
        {"crawl_result": {"pages": [{"url": "a"}]}, "seo_audit": {"overall_score": 80}},
    )
    seed(
        DeepCompetitorAnalysisTask,
        DeepCompetitorAnalysisExecutionLog,
        {"competitors": [{"url": "a"}, {"url": "b"}]},
    )
    seed(
        SIFIndexingTask,
        SIFIndexingExecutionLog,
        {"metadata_synced": 3, "content_synced": True},
    )
    seed(
        MarketTrendsTask,
        MarketTrendsExecutionLog,
        {"run_id": "trend_9", "keywords": ["seo"], "geo": "US"},
    )
    db.commit()

    svc = _make_service(db)
    payload = asyncio.run(svc.get_onboarding_scheduled_task_health(user_id=user_id))

    assert payload["status"] == "ok"
    assert set(payload["tasks"].keys()) == {
        "OnboardingFullWebsiteAnalysisTask",
        "DeepCompetitorAnalysisTask",
        "SIFIndexingTask",
        "MarketTrendsTask",
    }
    by_key = {t["results_key"]: t for t in payload["tasks"].values()}
    assert by_key["website_analysis"]["result_summary"] == "1 pages crawled; SEO audit complete"
    assert by_key["competitor_analysis"]["result_summary"] == "2 competitors analyzed"
    assert by_key["sif_indexing"]["result_summary"].startswith("metadata items synced: 3")
    assert by_key["market_trends"]["result_summary"].startswith("trends run for 1 keyword(s)")
    for task in payload["tasks"].values():
        assert task["results_key"] is not None
        assert task["task_id"] is not None
        assert task["task_type"] is not None
        assert task["result_summary"]
        assert task["latest_execution"]["result_summary"] == task["result_summary"]

    expected_types = {
        "website_analysis": "onboarding_full_website_analysis",
        "competitor_analysis": "deep_competitor_analysis",
        "sif_indexing": "sif_indexing",
        "market_trends": "market_trends",
    }
    for results_key, expected_type in expected_types.items():
        assert by_key[results_key]["task_type"] == expected_type

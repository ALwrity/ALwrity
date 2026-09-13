"""
Phase 8G — unified SEO summary card contract (TDD).

Phase 6B of the seo-tools UI completion plan: a ONE-CALL thin composer for the
Main Dashboard "SEO summary card". It aggregates PERSISTED, per-user pieces —
platform connections, health score (+ a real trend delta from the timeseries,
not the hardcoded `change: 0`), page-audit aggregates, scheduled background
task health, guardian audit, latest strategic insight and the competitive
benchmark status — with null-state safety and per-piece fault isolation
(one failing source never breaks the whole card).

Conventions carried over:
  P8-1: the route requires get_current_user.
  P8-2: get_seo_summary_card(current_user) is a REQUIRED-param composer.
  P8G-3: delta math: first-half vs second-half clicks buckets; None when
         insufficient data; ±5% stable classification.
  P8G-4: task aggregation: failing window counts latest_execution failures;
         overall failing if consecutive_failures > 2, degraded at >= 1.
  P8G-5: any sub-source failure is captured in `errors`, never a 500.
"""

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest


# ---------------------------------------------------------------------------
# Route-level contract (mirrors the Phase-8 dashboard-auth walker)
# ---------------------------------------------------------------------------

def test_p8g_route_registered_and_requires_user():
    import os
    import types as types_mod
    import importlib

    os.environ.setdefault("STRIPE_MODE", "test")
    os.environ.setdefault(
        "STRIPE_PLAN_PRICE_MAPPING_TEST",
        '{"free":{"monthly":"price_test_free"},"basic":{"monthly":"price_test_basic"},"pro":{"monthly":"price_test_pro"}}',
    )
    os.environ.setdefault(
        "OAUTH_TOKEN_ENCRYPTION_KEY",
        "1KLwO81o21nJVGkxTIihuog680QmlyCx0FB4y-_76PA=",
    )
    if "spacy" not in sys.modules:
        spacy_stub = types_mod.ModuleType("spacy")
        spacy_stub.load = lambda _model: object()
        sys.modules["spacy"] = spacy_stub

    import backend.app as app_mod

    from middleware.auth_middleware import get_current_user

    route = next(
        (r for r in app_mod.app.routes if getattr(r, "path", "") == "/api/seo-dashboard/seo-summary-card"),
        None,
    )
    assert route is not None, "seo-summary-card route not registered"
    stack = list(getattr(getattr(route, "dependant", None), "dependencies", []) or [])
    seen = set()
    while stack:
        dep = stack.pop()
        if id(dep) in seen:
            continue
        seen.add(id(dep))
        if getattr(dep, "call", None) == get_current_user:
            return
        stack.extend(getattr(getattr(dep, "dependant", None), "dependencies", []) or [])
    pytest.fail("seo-summary-card route missing get_current_user")


# ---------------------------------------------------------------------------
# Composer unit tests (sub-pieces stubbed at the api.seo_dashboard module)
# ---------------------------------------------------------------------------

def _stub_pieces(overview=None, task_health=None, guardian=None, history=None,
                 platforms=None, competitor=None, db_rows=None):
    """Patch each composer dependency at its import site; returns (module, mocks)."""
    import api.seo_dashboard as dash

    mocks = SimpleNamespace(
        platforms=AsyncMock(return_value=platforms if platforms is not None else {}),
        overview=AsyncMock(return_value=overview if overview is not None else {}),
        task_health=AsyncMock(return_value=task_health if task_health is not None else {}),
        guardian=AsyncMock(return_value=guardian if guardian is not None else {"has_audit": False}),
        history=AsyncMock(return_value=history if history is not None else []),
        competitor=AsyncMock(
            return_value=competitor if competitor is not None else {"status": "no_data", "report": None}
        ),
    )

    db_bundle = MagicMock()
    rows = db_rows if db_rows is not None else []
    db_bundle.query.return_value.filter.return_value.all.return_value = rows
    mocks.db = db_bundle

    patchers = [
        patch.object(dash, "get_platform_status", mocks.platforms),
        patch.object(dash, "get_seo_dashboard_overview", mocks.overview),
        patch.object(dash, "get_onboarding_task_health", mocks.task_health),
        patch.object(dash, "get_guardian_audit", mocks.guardian),
        patch.object(dash, "get_strategic_insights_history", mocks.history),
        patch.object(dash, "get_deep_competitor_analysis", mocks.competitor),
        patch.object(dash, "get_db_session", MagicMock(return_value=db_bundle)),
    ]
    import contextlib

    stack = contextlib.ExitStack()
    for p in patchers:
        stack.enter_context(p)
    return dash, mocks, stack


def _make_overview(health_score="__DEFAULT__", timeseries=None, website_url="https://example.com"):
    return {
        "website_url": website_url,
        "health_score": ({"score": 40, "change": 0, "trend": "stable", "label": "Good"}
                         if health_score == "__DEFAULT__" else health_score),
        "timeseries": timeseries or [],
        "summary": {"clicks": 100},
        "platforms": {},
        "last_updated": "2026-09-13T00:00:00Z",
    }


def _make_task_health(entries):
    """4-entry matrix per the onboarding-task-health contract."""
    return {
        "tasks": {
            f"task_{i}": {"status": entry.get("status", "success"),
                          "last_success": entry.get("last_success"),
                          "next_execution": entry.get("next_execution"),
                          "consecutive_failures": entry.get("consecutive_failures", 0),
                          "latest_execution": entry.get("latest_execution")}
            for i, entry in enumerate(entries)
        }
    }


def test_p8g_composer_exists_and_requires_current_user():
    import inspect
    import api.seo_dashboard as dash

    fn = getattr(dash, "get_seo_summary_card", None)
    assert fn is not None, "get_seo_summary_card missing"
    import contextlib
    params = __import__("inspect").signature(fn).parameters
    assert "current_user" in params
    assert params["current_user"].default is __import__("inspect").Parameter.empty


def test_p8g_happy_path_composes_everything():
    import asyncio
    import contextlib
    import api.seo_dashboard as dash

    overview = _make_overview(timeseries=[
        {"date": "2026-09-01", "clicks": 10},
        {"date": "2026-09-02", "clicks": 10},
        {"date": "2026-09-03", "clicks": 20},
        {"date": "2026-09-04", "clicks": 20},
    ])
    task_health = _make_task_health([
        {"status": "success", "latest_execution": {"status": "success"}, "last_success": "2026-09-10T10:00:00Z", "next_execution": "2026-09-14T10:00:00Z"},
        {"status": "success", "latest_execution": {"status": "success"}},
        {"status": "failed", "latest_execution": {"status": "failed"}, "consecutive_failures": 3},
        {"status": "success", "latest_execution": {"status": "success"}},
    ])
    guardian = {
        "has_audit": True,
        "status": "success",
        "content_quality": {"score": 81},
        "safety_issues": [],
        "last_execution_time": "2026-09-09T00:00:00Z",
    }
    history = [{"generated_at": "2026-09-08T00:00:00Z", "metrics": {"market_velocity": "hot"}, "insights": {"the_big_move": "X"}}]
    platforms = {"gsc": {"connected": True, "sites": ["s"]}, "bing": {"connected": False}}
    competitor = {"status": "success", "last_run": "2026-09-07T00:00:00Z"}
    rows = [
        SimpleNamespace(overall_score=80, last_analyzed_at="2026-09-10T00:00:00Z"),
        SimpleNamespace(overall_score=40, last_analyzed_at="2026-09-10T01:00:00Z"),
        SimpleNamespace(overall_score=60, last_analyzed_at="2026-09-09T01:00:00Z"),
    ]

    dash_mod, _mocks, stack = _stub_pieces(
        overview=overview, task_health=task_health, guardian=guardian,
        history=history, platforms=platforms, competitor=competitor, db_rows=rows,
    )
    with stack:
        card = asyncio.run(dash_mod.get_seo_summary_card({"id": "u1"}))

    assert card["status"] == "ok"
    assert card["has_data"] is True
    assert card["website_url"] == "https://example.com"
    assert card["platform_connections"]["gsc"]["connected"] is True
    # Delta NOT hardcoded: first-half clicks 20 vs second-half 20+10=... exact: 10+10=20 | 20+20=40 → +100% up
    hs = card["health_score"]
    assert hs["score"] == 40
    assert hs["change_pct"] == 100.0
    assert hs["trend"] == "up"
    # page aggregates
    pages = card["pages"]
    assert pages["audited"] == 3
    assert pages["avg_score"] == 60.0
    assert pages["needs_fix"] == 2  # 40 and 60 below the 70 line
    assert pages["last_audit_at"] == "2026-09-10T01:00:00Z"
    # background task aggregation
    tasks = card["background_tasks"]
    assert tasks["overall_status"] == "failing"      # consecutive_failures 3 > 2
    assert tasks["failing_count"] == 1
    assert tasks["max_consecutive_failures"] == 3
    assert tasks["next_execution"] == "2026-09-14T10:00:00Z"
    # guardian + insight + benchmark
    assert card["last_guardian_audit"]["has_audit"] is True
    assert card["latest_strategic_insight"]["generated_at"] == "2026-09-08T00:00:00Z"
    assert card["benchmark_status"]["status"] == "success"
    assert card["last_updated"]
    assert card.get("errors") in (None, [])


def test_p8g_fresh_user_null_state_is_safe():
    import asyncio
    import api.seo_dashboard as dash

    overview = _make_overview(health_score=None, timeseries=[], website_url="")
    task_health = {"tasks": {}}
    dash_mod, _mocks, stack = _stub_pieces(overview=overview, task_health=task_health)
    with stack:
        card = asyncio.run(dash_mod.get_seo_summary_card({"id": "u-new"}))

    assert card["status"] == "ok"
    assert card["has_data"] is False
    assert card["health_score"]["score"] is None
    assert card["health_score"]["change_pct"] is None
    assert card["health_score"]["trend"] == "stable"
    assert card["pages"]["audited"] == 0
    assert card["background_tasks"]["overall_status"] == "ok"
    assert card["background_tasks"]["failing_count"] == 0
    assert card["last_guardian_audit"] is None
    assert card["latest_strategic_insight"] is None


def test_p8g_degraded_vs_failing_thresholds():
    import asyncio
    import api.seo_dashboard as dash

    # consecutive_failures 1 → degraded
    degraded = _make_task_health([
        {"status": "failed", "latest_execution": {"status": "failed"}, "consecutive_failures": 1},
    ])
    dash_mod, _mocks, stack = _stub_pieces(
        task_health=degraded, overview=_make_overview(health_score=None, timeseries=[])
    )
    with stack:
        card = asyncio.run(dash_mod.get_seo_summary_card({"id": "u1"}))
    assert card["background_tasks"]["overall_status"] == "degraded"

    # healthy → ok
    ok = _make_task_health([
        {"status": "success", "latest_execution": {"status": "success"}},
    ])
    dash_mod2, _mocks2, stack2 = _stub_pieces(task_health=ok, overview=_make_overview(health_score=None, timeseries=[]))
    with stack2:
        card2 = asyncio.run(dash_mod2.get_seo_summary_card({"id": "u1"}))
    assert card2["background_tasks"]["overall_status"] == "ok"


def test_p8g_sub_source_failure_is_isolated_in_errors():
    import asyncio
    import api.seo_dashboard as dash

    dash_mod, mocks, stack = _stub_pieces(overview=_make_overview(health_score=None), task_health=_make_task_health([]))

    async def _boom(*_a, **_k):
        raise RuntimeError("task health exploded")
    mocks.task_health.side_effect = _boom

    with stack:
        card = asyncio.run(dash_mod.get_seo_summary_card({"id": "u1"}))
    assert card["status"] == "ok"  # card doesn't die from one source
    assert card["background_tasks"] is None
    assert any(e["source"] == "task_health" for e in card["errors"])


def test_p8g_health_delta_insufficient_timeseries_stays_none():
    import asyncio
    import api.seo_dashboard as dash

    overview = _make_overview(timeseries=[{"date": "2026-09-01", "clicks": 5}])
    dash_mod, _mocks, stack = _stub_pieces(overview=overview, task_health=_make_task_health([]))
    with stack:
        card = asyncio.run(dash_mod.get_seo_summary_card({"id": "u1"}))
    assert card["health_score"]["change_pct"] is None
    assert card["health_score"]["trend"] == "stable"
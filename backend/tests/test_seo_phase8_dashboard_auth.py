"""
Phase 8 — dashboard analyzer auth + per-user context forwarding (TDD).

Phase 1 of the seo-tools UI completion plan:
  P8-1: every /api/seo-dashboard analyzer route requires get_current_user.
  P8-2: every handler FORWARDS the authenticated user into the api-layer
        function (payload, current_user) — the established
        analyze_urls_ai/get_analyzed_pages signature convention.
  P8-3: storage is user-scoped — store_analysis_result threads
        triggered_by_user_id into seo_analyses / seo_analysis_history
        (column precedent: SEOAnalysisSession.triggered_by_user_id).
  P8-4: blog-writer /analysis/{analysis_id} requires auth like its siblings.

Copies the env-defaults/stub pattern of test_seo_dashboard_routes_smoke.py
(backend.app import is heavy and needs it) and keeps every test network-free
by patching the api-layer functions.
"""

import importlib
import inspect
import os
import re
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
for entry in (str(REPO_ROOT), str(BACKEND_ROOT)):
    if entry not in sys.path:
        sys.path.insert(0, entry)


def _install_environment_defaults() -> None:
    """Minimal env defaults for importing app entrypoints (smoke-test pattern)."""
    os.environ.setdefault("STRIPE_MODE", "test")
    os.environ.setdefault(
        "STRIPE_PLAN_PRICE_MAPPING_TEST",
        '{"free":{"monthly":"price_test_free"},"basic":{"monthly":"price_test_basic"},"pro":{"monthly":"price_test_pro"}}',
    )
    # Analytics services construct OAuth providers at import time; without a
    # key the import itself raises. Test-only key (from the smoke test).
    os.environ.setdefault(
        "OAUTH_TOKEN_ENCRYPTION_KEY",
        "1KLwO81o21nJVGkxTIihuog680QmlyCx0FB4y-_76PA=",
    )


def _install_dependency_stubs() -> None:
    if "spacy" not in sys.modules:
        spacy_stub = types.ModuleType("spacy")
        spacy_stub.load = lambda _model: object()
        sys.modules["spacy"] = spacy_stub


# ---------------------------------------------------------------------------
# P8-1: the 7 analyzer routes must require get_current_user
# ---------------------------------------------------------------------------

DASHBOARD_ANALYSIS_PATHS = {
    "/api/seo-dashboard/summary",
    "/api/seo-dashboard/metrics/{url:path}",
    "/api/seo-dashboard/analyze-comprehensive",
    # Phase 8C: /analyze-full (deprecated alias) is retired — removed end-to-end.
    "/api/seo-dashboard/metrics-detailed",
    "/api/seo-dashboard/analysis-summary",
    "/api/seo-dashboard/batch-analyze",
}


def _route_requires_auth(route) -> bool:
    """Dependency-graph walk (P0 wrapper walker style, app-level)."""
    from middleware.auth_middleware import get_current_user

    stack = list(getattr(getattr(route, "dependant", None), "dependencies", []) or [])
    seen = set()
    while stack:
        dep = stack.pop()
        if id(dep) in seen:
            continue
        seen.add(id(dep))
        if getattr(dep, "call", None) == get_current_user:
            return True
        stack.extend(getattr(getattr(dep, "dependant", None), "dependencies", []) or [])
    return False


def _app_route(path: str):
    import backend.app as app_mod

    # Normalize converter suffixes ("/x/{url:path}" -> "/x/{url:path}" stays),
    # routes carry the raw declared path so exact match works.
    for route in app_mod.app.routes:
        if getattr(route, "path", "") == path:
            return route
    raise AssertionError(f"route not registered: {path}")


def test_p81_dashboard_analysis_routes_require_user():
    _install_environment_defaults()
    _install_dependency_stubs()
    importlib.import_module("backend.app")

    for path in sorted(DASHBOARD_ANALYSIS_PATHS):
        assert _route_requires_auth(_app_route(path)), f"{path} missing auth"


def test_p81_blog_seo_analysis_detail_requires_user():
    from middleware.auth_middleware import get_current_user
    import backend.api.blog_writer.seo_analysis as blog_seo

    # APIRouter(prefix=...) stores prefixed paths; match by suffix to stay
    # robust against repo-wide prefix changes.
    route = next(
        (
            r
            for r in blog_seo.router.routes
            if getattr(r, "path", "").endswith("/analysis/{analysis_id}")
        ),
        None,
    )
    assert route is not None, "blog analysis/{analysis_id} route missing"
    stack = list(getattr(getattr(route, "dependant", None), "dependencies", []) or [])
    seen = set()
    while stack:
        dep = stack.pop()
        if id(dep) in seen:
            continue
        seen.add(id(dep))
        # Same shape as the app-level walker / P0 wrapper: dep.call is the
        # dependency callable itself.
        if getattr(dep, "call", None) == get_current_user:
            return
        stack.extend(getattr(getattr(dep, "dependant", None), "dependencies", []) or [])
    pytest.fail("blog GET /analysis/{analysis_id} missing get_current_user")


# ---------------------------------------------------------------------------
# P8-2: handlers forward current_user (signature + api-layer contract)
# ---------------------------------------------------------------------------

FORWARDING_ROUTE_PARAMS = {
    # route path -> query/body param that must coexist with current_user
    "/api/seo-dashboard/summary": ("url",),
    "/api/seo-dashboard/metrics/{url:path}": ("url",),
    "/api/seo-dashboard/analyze-comprehensive": ("request",),
    # Phase 8C: /analyze-full retired — no forwarding contract needed.
    "/api/seo-dashboard/metrics-detailed": ("url",),
    "/api/seo-dashboard/analysis-summary": ("url",),
    "/api/seo-dashboard/batch-analyze": ("urls",),
}


@pytest.mark.parametrize(
    "path", sorted(FORWARDING_ROUTE_PARAMS), ids=lambda p: p.rsplit("/", 1)[-1]
)
def test_p82_handlers_forward_current_user(path):
    _install_environment_defaults()
    _install_dependency_stubs()
    importlib.import_module("backend.app")

    route = _app_route(path)
    handler = route.dependant.call
    params = inspect.signature(handler).parameters
    assert "current_user" in params, f"{path} handler does not accept current_user"

    # The api-layer function must accept it too, so the forward is real, not
    # a swallowed parameter (established analyze_urls_ai(request, current_user)
    # signature convention).
    api_source = Path(REPO_ROOT / "backend" / "api" / "seo_dashboard.py").read_text("utf-8")
    for fn in (
        "analyze_seo_comprehensive",
        "get_seo_metrics_detailed",
        "get_analysis_summary",
        "batch_analyze_urls",
    ):
        fn_def = re.search(rf"async def {fn}\((.*?)\)", api_source, re.DOTALL)
        assert fn_def, f"api fn missing: {fn}"
        assert "current_user" in fn_def.group(1), f"{fn} does not accept current_user"


@pytest.mark.parametrize(
    "fn_name", ["analyze_seo_comprehensive", "get_seo_metrics_detailed", "get_analysis_summary", "batch_analyze_urls"]
)
def test_p82_api_layer_signatures_accept_current_user(fn_name):
    import api.seo_dashboard as seo_dash

    params = inspect.signature(getattr(seo_dash, fn_name)).parameters
    assert "current_user" in params, f"{fn_name} does not accept current_user"
    # Binding must be required (no None default) — optional-None defaults mask
    # forgot-to-forward bugs, the exact bug class this phase closes.
    assert params["current_user"].default is inspect.Parameter.empty, (
        f"{fn_name} current_user must be a required parameter"
    )


# ---------------------------------------------------------------------------
# P8-3: 401 without credentials, 200 with auth override (network-free)
# ---------------------------------------------------------------------------

def _test_client():
    _install_environment_defaults()
    _install_dependency_stubs()
    import backend.app as app_mod
    from fastapi.testclient import TestClient

    # Keep every test network-free and DB-free: the analyzer api functions are
    # patched at the app.py import site so handlers return instantly.
    app_mod.analyze_seo_comprehensive = AsyncMock(
        return_value={"url": "https://example.com", "success": True}
    )
    app_mod.get_analysis_summary = AsyncMock(return_value={"url": "https://example.com"})
    return TestClient(app_mod.app), app_mod


def test_p83_no_token_is_401_not_silent_success():
    client, _ = _test_client()
    response = client.post(
        "/api/seo-dashboard/analyze-comprehensive",
        json={"url": "https://example.com"},
    )
    assert response.status_code == 401, f"expected 401, got {response.status_code}"
    assert response.json()["detail"] == "Not authenticated"

    response_get = client.get("/api/seo-dashboard/analysis-summary?url=https://example.com")
    assert response_get.status_code == 401


def test_p84_with_auth_dependency_override_endpoint_succeeds():
    client, app_mod = _test_client()
    from middleware.auth_middleware import get_current_user

    app_mod.app.dependency_overrides[get_current_user] = lambda: {"id": "u1"}
    try:
        response = client.post(
            "/api/seo-dashboard/analyze-comprehensive",
            json={"url": "https://example.com"},
        )
        assert response.status_code == 200, response.text
        # The handler forwarded current_user into the api-layer fn.
        assert app_mod.analyze_seo_comprehensive.await_count == 1
        _, kwargs = app_mod.analyze_seo_comprehensive.await_args
        assert kwargs.get("current_user", None) or (
            len(app_mod.analyze_seo_comprehensive.await_args.args) >= 2
        ), "handler did not forward current_user to the api-layer function"
    finally:
        app_mod.app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# P8-5: storage scoping — store_analysis_result threads triggered_by_user_id
# ---------------------------------------------------------------------------

def test_p85_model_columns_exist():
    # Plain `models` import — the repo's canonical module path (services and
    # other tests import it this way). Importing backend.models.* too would
    # run the module twice and collide in the shared declarative Base.
    import models.seo_analysis as models

    analysis_cols = {c.name for c in models.SEOAnalysis.__table__.columns}
    history_cols = {c.name for c in models.SEOAnalysisHistory.__table__.columns}
    assert "triggered_by_user_id" in analysis_cols
    assert "triggered_by_user_id" in history_cols


def test_p85_store_analysis_result_threads_user_id():
    import services.seo_analyzer.service as service_mod

    record = MagicMock()
    history = MagicMock()
    with patch.object(
        service_mod, "create_analysis_from_result", return_value=record
    ), patch.object(
        service_mod, "create_issues_from_result", return_value=[]
    ), patch.object(
        service_mod, "create_warnings_from_result", return_value=[]
    ), patch.object(
        service_mod, "create_recommendations_from_result", return_value=[]
    ), patch.object(
        service_mod, "create_category_scores_from_result", return_value=[]
    ), patch.object(
        service_mod, "SEOAnalysisHistory", return_value=MagicMock()
    ) as history_ctor:
        result = MagicMock(
            url="https://example.com",
            overall_score=80,
            health_status="good",
            critical_issues=[],
            warnings=[],
            recommendations=[],
            data={},
        )
        result.timestamp = "2026-09-13T00:00:00"
        service = service_mod.SEOAnalysisService(MagicMock())
        service.store_analysis_result(result, triggered_by_user_id="u9")

        assert record.triggered_by_user_id == "u9"
        assert service_mod.SEOAnalysisHistory.call_args.kwargs.get(
            "triggered_by_user_id"
        ) == "u9"


def test_p85_store_analysis_result_without_user_is_explicit_none():
    """Backward-compatible kwarg: legacy/global rows keep NULL explicitly."""
    import services.seo_analyzer.service as service_mod

    record = MagicMock()
    with patch.object(
        service_mod, "create_analysis_from_result", return_value=record
    ), patch.object(
        service_mod, "create_issues_from_result", return_value=[]
    ), patch.object(
        service_mod, "create_warnings_from_result", return_value=[]
    ), patch.object(
        service_mod, "create_recommendations_from_result", return_value=[]
    ), patch.object(
        service_mod, "create_category_scores_from_result", return_value=[]
    ), patch.object(
        service_mod, "SEOAnalysisHistory", return_value=MagicMock()
    ):
        result = MagicMock(
            url="https://example.com",
            overall_score=1,
            health_status="good",
            critical_issues=[],
            warnings=[],
            recommendations=[],
            data={},
        )
        result.timestamp = "2026-09-13T00:00:00"
        service = service_mod.SEOAnalysisService(MagicMock())
        service.store_analysis_result(result)
        assert record.triggered_by_user_id is None


# ---------------------------------------------------------------------------
# P8-6: migration adds triggered_by_user_id to both tables (inspector-guarded)
# ---------------------------------------------------------------------------

def test_p86_migration_file_adds_user_columns():
    versions_dir = BACKEND_ROOT / "alembic_migrations" / "versions"
    assert versions_dir.is_dir(), "alembic versions dir missing"
    matches = []
    for path in versions_dir.glob("*.py"):
        src = path.read_text("utf-8")
        if "triggered_by_user_id" not in src:
            continue
        if "seo_analyses" in src and "seo_analysis_history" in src and "batch_alter_table" in src:
            matches.append(path.name)
    assert matches, (
        "no migration adds triggered_by_user_id to seo_analyses and "
        "seo_analysis_history with batch_alter_table (SQLite safe)"
    )

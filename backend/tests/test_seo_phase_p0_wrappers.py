"""Phase P0 TDD — broken dashboard wrappers + orphaned routes.

P0-1: /api/seo-dashboard/{data,health-score,metrics,insights} must forward
the authenticated user instead of calling inner functions with zero args
(which 500s on current_user.get). Slow (imports app), like the smoke test.
Leaves content-strategy / calendar untouched.
"""
import importlib
import os
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

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
    _spacy = types.ModuleType("spacy")
    _spacy.load = lambda _m: object()
    sys.modules["spacy"] = _spacy

P0_1_PATHS = [
    "/api/seo-dashboard/data",
    "/api/seo-dashboard/health-score",
    "/api/seo-dashboard/metrics",
    "/api/seo-dashboard/insights",
]

_OVERVIEW = {
    "health_score": {"score": 80, "change": 0, "trend": "up", "label": "GOOD", "color": "#2196F3"},
    "key_insight": "ok",
    "priority_alert": "none",
    "summary": {},
    "platforms": {},
    "ai_insights": [],
}


def _client_with_auth():
    from fastapi.testclient import TestClient

    mod = importlib.import_module("backend.app")
    from middleware.auth_middleware import get_current_user

    mod.app.dependency_overrides[get_current_user] = lambda: {"id": "u1"}
    return mod, TestClient(mod.app, raise_server_exceptions=False)


def test_p02_no_orphaned_router_decorators():
    """P0-2: router in seo_dashboard.py is never included; decorators on
    refresh_analytics_data / get_strategic_insights_history are dead and
    shadow the live app.py paths (/refresh, /strategic-insights/history)."""
    import re

    src = (BACKEND_ROOT / "api" / "seo_dashboard.py").read_text(
        encoding="utf-8", errors="ignore"
    )
    orphans = re.findall(r"^@router\.(?:get|post)\(", src, re.M)
    assert not orphans, f"orphaned router decorators present: {len(orphans)}"

    # Functions themselves must survive (app.py wires them directly).
    import api.seo_dashboard as dash

    assert callable(dash.refresh_analytics_data)
    assert callable(dash.get_strategic_insights_history)


def test_p03_gsc_methods_public_and_fields_forwarded():
    """P0-3: router must not call private service methods; request fields
    must reach the service instead of being silently dropped."""
    import api.seo_dashboard  # noqa - ensures seo stack imports cleanly
    import routers.seo_tools as router_mod
    from services.seo_tools.gsc_strategy_insights_service import (
        GSCStrategyInsightsService,
    )

    for public in (
        "get_ranked_opportunities",
        "calculate_health_metrics",
        "analyze_performance_trends",
    ):
        assert callable(getattr(GSCStrategyInsightsService, public, None)), (
            f"{public} must be a public service method"
        )

    router_src = (
        (BACKEND_ROOT / "routers" / "seo_tools.py")
        .read_text(encoding="utf-8", errors="ignore")
    )
    for private in (
        "service._get_ranked_opportunities",
        "service._calculate_health_metrics",
        "service._analyze_performance_trends",
    ):
        assert private not in router_src, f"router still calls private {private}"

    # include_trends is unimplementable without history — the health-metrics
    # model must not accept it. (GSCStrategyInsightsRequest keeps its own
    # include_trends, which IS forwarded to get_dashboard_strategy.)
    import re as _re

    health_model = _re.search(
        r"class GSCHealthMetricsRequest\(BaseModel\):(.*?)(?=\n\S|\Z)",
        router_src,
        _re.S,
    )
    assert health_model, "GSCHealthMetricsRequest missing"
    assert "include_trends" not in health_model.group(1), "dropped field still accepted"

    # Health endpoint honors include_distribution via the service.
    import asyncio
    from unittest.mock import AsyncMock, MagicMock

    svc = GSCStrategyInsightsService.__new__(GSCStrategyInsightsService)
    summary = {
        "health_score": 80,
        "total_keywords_analyzed": 10,
        "keyword_distribution": {"positions_1_3": 5},
        "avg_position": 4.0,
        "avg_ctr": 3.5,
        "ctr_vs_benchmark": 0.4,
        "total_impressions": 1000,
        "total_clicks": 40,
    }
    fake_brainstorm = MagicMock()
    fake_brainstorm.brainstorm_topics = AsyncMock(
        return_value={"summary": summary}
    )
    svc.brainstorm_service = fake_brainstorm
    with_dist = asyncio.run(
        svc.calculate_health_metrics("https://x.test", include_distribution=True)
    )
    assert with_dist["keyword_distribution"] == {"positions_1_3": 5}
    without_dist = asyncio.run(
        svc.calculate_health_metrics("https://x.test", include_distribution=False)
    )
    assert "keyword_distribution" not in without_dist

    # Phase 8F: the trend analysis is no longer a stub — it computes the
    # per-metric comparison over two GSC date windows via get_daily_metrics.
    daily_rows = [
        {"keys": ["2026-09-01"], "clicks": 2.0, "impressions": 10.0, "ctr": 0.2, "position": 5.0},
        {"keys": ["2026-09-02"], "clicks": 2.0, "impressions": 10.0, "ctr": 0.2, "position": 5.0},
    ]
    svc.gsc_service = MagicMock()
    svc.gsc_service.get_daily_metrics = MagicMock(
        return_value={
            "status": "success",
            "rows": [dict(r) for r in daily_rows],
            "startDate": "2026-09-01",
            "endDate": "2026-09-02",
        }
    )
    ok = asyncio.run(
        svc.analyze_performance_trends("https://x.test", user_id="u1", metric="clicks", days_back=30)
    )
    assert ok["status"] == "success"
    assert ok["metric"] == "clicks"
    assert ok["totals"]["clicks"]["current"] == 4.0
    # user_id forwarded into GSCService
    assert svc.gsc_service.get_daily_metrics.call_args.kwargs.get("user_id") == "u1"


def _route_dependant_has_auth(router_mod, path: str) -> bool:
    from middleware.auth_middleware import get_current_user

    # NOTE: APIRouter stores unprefixed paths until included in the app.
    short = path.replace("/api/seo", "", 1)
    for route in router_mod.router.routes:
        if getattr(route, "path", "") in (path, short):
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
    raise AssertionError(f"route not found: {path}")


def test_p04_no_auth_tool_routes_require_user():
    """P0-4: tool routes must enforce auth like their siblings."""
    import routers.seo_tools as router_mod

    for path in (
        "/api/seo/image-alt-text",
        "/api/seo/opengraph-tags",
        "/api/seo/on-page-analysis",
        "/api/seo/technical-seo",
        "/api/seo/workflow/website-audit",
    ):
        assert _route_dependant_has_auth(router_mod, path), f"{path} missing auth"


def test_p04_image_alt_text_accepts_json_and_multipart():
    """P0-4: JSON {image_url} (what the frontend sends) and multipart file
    uploads must both succeed; BackgroundTasks must be injected, not
    default-constructed."""
    import inspect
    from unittest.mock import AsyncMock, patch

    import routers.seo_tools as router_mod
    from fastapi import BackgroundTasks
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from middleware.auth_middleware import get_current_user

    sig = inspect.signature(router_mod.generate_image_alt_text)
    bt = sig.parameters["background_tasks"]
    assert bt.default is inspect.Parameter.empty, "BackgroundTasks must be injected"

    app = FastAPI()
    app.include_router(router_mod.router)
    app.dependency_overrides[get_current_user] = lambda: {"id": "u1"}
    client = TestClient(app, raise_server_exceptions=False)

    with patch.object(
        router_mod.ImageAltService, "generate_alt_text_from_url",
        new=AsyncMock(return_value={"alt_text": "a cat", "source": "url"}),
    ):
        r = client.post("/api/seo/image-alt-text", json={"image_url": "https://x.test/a.png"})
        assert r.status_code == 200, r.text[:200]
        assert r.json()["success"] is True, r.text[:200]
        assert r.json()["data"]["alt_text"] == "a cat"

    with patch.object(
        router_mod.ImageAltService, "generate_alt_text_from_file",
        new=AsyncMock(return_value={"alt_text": "uploaded", "source": "file"}),
    ):
        r = client.post(
            "/api/seo/image-alt-text",
            files={"image_file": ("a.png", b"fakepng", "image/png")},
            data={"context": "test"},
        )
        assert r.status_code == 200, r.text[:200]
        assert r.json()["success"] is True, r.text[:200]


def test_p01_wrappers_forward_authenticated_user():
    mod, client = _client_with_auth()
    try:
        session = MagicMock()
        session.close = MagicMock()
        svc = MagicMock()
        svc.get_dashboard_overview = AsyncMock(return_value=dict(_OVERVIEW))
        with (
            patch("api.seo_dashboard.get_db_session", return_value=session),
            patch("api.seo_dashboard.SEODashboardService", return_value=svc),
        ):
            for path in P0_1_PATHS:
                r = client.get(path)
                assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:200]}"
    finally:
        mod.app.dependency_overrides.clear()

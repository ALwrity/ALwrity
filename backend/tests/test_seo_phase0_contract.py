"""Phase 0 — SEO contract guards (TDD baseline).

Leaves content-strategy / calendar code untouched; covers only SEO routers.
Reuses backend/tests/conftest.py stubs + smoke-test env defaults.
"""
import inspect
import os
import sys
import types
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
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


EXPECTED_SEO_PATHS = {
    "/api/seo/meta-description",
    "/api/seo/pagespeed-analysis",
    "/api/seo/sitemap-analysis",
    "/api/seo/image-alt-text",
    "/api/seo/opengraph-tags",
    "/api/seo/on-page-analysis",
    "/api/seo/technical-seo",
    "/api/seo/workflow/website-audit",
    "/api/seo/workflow/content-analysis",
    "/api/seo/competitive-sitemap-benchmarking/run",
    "/api/seo/competitive-sitemap-benchmarking",
    "/api/seo/health",
    "/api/seo/tools/status",
    "/api/seo/enterprise/complete-audit",
    "/api/seo/enterprise/quick-audit",
    "/api/seo/enterprise/health",
    "/api/seo/gsc/analyze-search-performance",
    "/api/seo/gsc/content-opportunities",
    "/api/seo/gsc/strategy-insights",
    "/api/seo/gsc/opportunity-ranking",
    "/api/seo/gsc/health-metrics",
    "/api/seo/gsc/trend-analysis",
    "/api/seo/llm/generate-audit-insights",
    "/api/seo/llm/generate-gsc-insights",
    "/api/seo/llm/generate-content-strategy",
    "/api/seo/llm/generate-traffic-roadmap",
    "/api/seo/llm/generate-competitive-insights",
    "/api/seo/llm/prioritized-recommendations",
    "/api/seo/llm/quick-wins",
    "/api/seo/llm/keyword-expansion",
    "/api/seo/llm/health",
}


def _load_router():
    import routers.seo_tools as mod

    return mod


def test_seo_router_has_all_expected_paths():
    mod = _load_router()
    registered = {r.path for r in mod.router.routes}
    missing = EXPECTED_SEO_PATHS - registered
    assert not missing, f"missing /api/seo routes: {sorted(missing)}"
    assert len(registered) >= len(EXPECTED_SEO_PATHS)


def test_quick_audit_accepts_json_body_model():
    """Phase 1A TDD gate: quick-audit must take a Pydantic Body model.

    Fails while endpoint signature is `website_url: HttpUrl` query param
    (JSON body -> 422). Passes after fix to `request: QuickAuditRequest`.
    """
    mod = _load_router()
    assert hasattr(mod, "QuickAuditRequest"), "QuickAuditRequest model missing"
    fn = mod.execute_quick_enterprise_audit
    sig = inspect.signature(fn)
    first = list(sig.parameters.values())[0]
    ann = first.annotation
    name = getattr(ann, "__name__", str(ann))
    assert name == "QuickAuditRequest", (
        f"quick-audit first param must be QuickAuditRequest body, got {name}. "
        "JSON clients currently get 422."
    )


def test_serp_gap_helpers_exist_but_unwired():
    """Phase 1C complete: helpers defined AND wired in app.py."""
    import api.seo_dashboard as dash

    assert hasattr(dash, "get_serp_gaps")
    assert hasattr(dash, "get_competitor_content")
    app_py = (BACKEND_ROOT / "app.py").read_text(encoding="utf-8", errors="ignore")
    assert "get_serp_gaps" in app_py and "serp-gaps" in app_py
    assert "get_competitor_content" in app_py and "competitor-content" in app_py

"""Phase 2 TDD — backend dedupe guards (no behavior change).

Leaves content-strategy / calendar untouched.
"""
import re
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _src(rel: str) -> str:
    return (BACKEND_ROOT / rel).read_text(encoding="utf-8", errors="ignore")


def test_2d_single_run_strategic_insights_def():
    """Phase 2D: shadow def at old line 268 deleted; only the winning def remains."""
    src = _src("api/seo_dashboard.py")
    count = len(re.findall(r"^async def run_strategic_insights\(", src, re.M))
    assert count == 1, f"expected 1 def, found {count} (shadowing)"


def test_2e_seo_tools_exports_all_services():
    """Phase 2E: hidden services exported from services.seo_tools."""
    src = _src("services/seo_tools/__init__.py")
    for name in (
        "GSCAnalyzer",
        "GSCStrategyInsights",
        "LLMInsights",
        "AIVisibility",
    ):
        assert name in src, f"{name} missing from services/seo_tools/__init__.py"


def test_2c_duplicate_endpoints_alias_canonical():
    """Phase 2C → superseded by Phase 8C (analyze-full retirement).

    The deprecated /analyze-full alias had zero frontend callers
    (analyzeSEOFull was never invoked). Phase 8C deletes it end-to-end:
    the route registration AND the api-layer wrapper are gone, and the
    canonical /analyze-comprehensive path is the only comprehensive entry.
    """
    src = _src("api/seo_dashboard.py")
    # The wrapper must be GONE (not recreated as an unscoped copy).
    assert "analyze_seo_full" not in src, (
        "analyze_seo_full wrapper must be removed (Phase 8C retirement)"
    )
    # The canonical comprehensive pipeline stays.
    assert "async def analyze_seo_comprehensive(" in src

    app_src = _src("app.py")
    # The route registration must be GONE.
    assert "/api/seo-dashboard/analyze-full" not in app_src, (
        "analyze-full route must be removed (Phase 8C retirement)"
    )

"""Phase 5 TDD — health-score contracts per domain (no silent defaults).

Three distinct formulas, three domains; each must be bounded 0-100,
empty-input → 0 (never a fake 75/78), errors explicit. These lock current
correct behavior; unifying them into one formula would be wrong.
Leaves content-strategy / calendar untouched.
"""
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _kw(keyword, position, impressions=100, clicks=5):
    return {"keyword": keyword, "position": position, "impressions": impressions,
            "clicks": clicks, "ctr": round(clicks / impressions, 4)}


def test_gsc_keyword_health_empty_is_zero_not_fake():
    from services.gsc_brainstorm_service import GSCBrainstormService

    summary = GSCBrainstormService._compute_summary([], [], "https://x.test", "s", "e")
    assert summary["health_score"] == 0
    assert summary["total_keywords_analyzed"] == 0


def test_gsc_keyword_health_bounded_and_top3_capped():
    from services.gsc_brainstorm_service import GSCBrainstormService

    kws = [_kw(f"k{i}", 1 if i < 5 else 15) for i in range(10)]
    summary = GSCBrainstormService._compute_summary(kws, [], "https://x.test", "s", "e")
    assert 0 <= summary["health_score"] <= 100

    all_top = [_kw(f"k{i}", 2) for i in range(10)]
    full = GSCBrainstormService._compute_summary(all_top, [], "https://x.test", "s", "e")
    assert full["health_score"] == 100


def test_dashboard_health_no_platforms_no_traffic_is_zero():
    from services.seo.dashboard_service import SEODashboardService

    svc = SEODashboardService.__new__(SEODashboardService)
    result = svc._calculate_health_score({}, {})
    assert result["score"] == 0
    assert result["label"] == "POOR"


def test_dashboard_health_full_signals_and_bands():
    from services.seo.dashboard_service import SEODashboardService

    svc = SEODashboardService.__new__(SEODashboardService)
    full = svc._calculate_health_score(
        {"clicks": 2000, "ctr": 0.06},
        {"gsc": {"connected": True}, "bing": {"connected": True}},
    )
    assert full["score"] == 100  # 30 + 20 + 30 + 20
    assert full["label"] == "EXCELLENT"
    mid = svc._calculate_health_score({"clicks": 600, "ctr": 0.04}, {"gsc": {"connected": True}})
    assert mid["score"] == 30 + 20 + 15
    assert mid["label"] == "GOOD"


def test_page_audit_mean_and_bands_and_empty():
    from services.seo_analyzer.core import ComprehensiveSEOAnalyzer

    analyzer = ComprehensiveSEOAnalyzer()
    score, status, _, _, _ = analyzer._calculate_overall_health(
        {"a": {"score": 90, "issues": [], "warnings": [], "recommendations": []},
         "b": {"score": 70, "issues": [], "warnings": [], "recommendations": []}},
        [],
    )
    assert score == 80
    assert status == "excellent"

    score, status, _, _, _ = analyzer._calculate_overall_health({}, [])
    assert score == 0
    assert status == "poor"

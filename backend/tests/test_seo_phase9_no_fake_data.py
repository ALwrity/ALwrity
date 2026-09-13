"""
Phase 9 (plan Phase A) — SEO data integrity: stop fabricated data + fix the
double-store regression.

A1: analyze_seo_comprehensive stored the analysis TWICE (our Phase-1 scoped
    call plus a leftover unscoped call at seo_dashboard.py:1042).
A2: ContentGapAnalyzer._analyze_serp_landscape fabricated search volumes /
    difficulty / competitor positions via hash() placeholders while claiming
    adv.serp_goog. It now uses the real SerpGapService and degrades to an
    explicit "unavailable" data_source with NO invented fields.
A3: ContentGapAnalyzer._expand_keyword_research fabricated keyword variants
    with f-string templates. It now uses the real LLMInsightsService keyword
    expansion and degrades to "unavailable".
A4: GSCAnalyzerService._fetch_gsc_data returned hardcoded mock keywords/
    pages/devices with no marker. It now reads the real GSCService search
    analytics, maps rows minimally (query/page + clicks/impressions/ctr/
    position) and marks data_source; unconnected/empty -> "no_data".
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from loguru import logger

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.content_gap_analyzer.content_gap_analyzer import ContentGapAnalyzer
from services.seo_tools.gsc_analyzer_service import GSCAnalyzerService


# ---------------------------------------------------------------------------
# A1 — exactly one persisted analysis, user-scoped
# ---------------------------------------------------------------------------

def test_a1_analyze_comprehensive_stores_once_and_scoped():
    import api.seo_dashboard as dash

    result = MagicMock()
    result.url = "https://example.com"
    result.timestamp = datetime(2026, 9, 13, 12, 0, 0)
    result.overall_score = 80
    result.health_status = "good"
    result.critical_issues = []
    result.warnings = []
    result.recommendations = []
    result.data = {}

    fake_service = MagicMock()
    fake_service.store_analysis_result = MagicMock(return_value=SimpleNamespace(id=7))

    with (
        patch.object(
            dash, "seo_analyzer",
            MagicMock(analyze_url_progressive=MagicMock(return_value=result)),
        ),
        patch.object(dash, "SEOAnalysisService", MagicMock(return_value=fake_service)),
        patch.object(dash, "get_db_session", MagicMock(return_value=MagicMock())),
    ):
        request = dash.SEOAnalysisRequest(url="https://example.com")
        response = asyncio.run(dash.analyze_seo_comprehensive(request, {"id": "u1"}))

    assert getattr(response, "success", True) is True
    # The regression: two stores (one unscoped). Must be exactly one, scoped.
    assert fake_service.store_analysis_result.call_count == 1, (
        "analyze_seo_comprehensive must persist the analysis exactly once"
    )
    _, kwargs = fake_service.store_analysis_result.call_args
    assert kwargs.get("triggered_by_user_id") == "u1"


# ---------------------------------------------------------------------------
# A2 — SERP landscape: real SerpGapService, no invented metrics
# ---------------------------------------------------------------------------

SERP_FIXTURE = {
    "gaps": [
        {
            "topic": "seo tools",
            "competitors_found": [{"domain": "a.com", "url": "https://a.com/x"}],
            "competitor_count": 1,
            "domains_with_content": ["a.com"],
            "failed_queries": 0,
            "total_domains_checked": 2,
        },
        {
            "topic": "content gap",
            "competitors_found": [],
            "competitor_count": 0,
            "domains_with_content": [],
            "failed_queries": 0,
            "total_domains_checked": 2,
        },
    ],
    "total_topics_analyzed": 2,
    "total_competitors": 2,
    "cached": False,
}


def _gap_analyzer_with_serp(return_value=None, side_effect=None) -> ContentGapAnalyzer:
    analyzer = ContentGapAnalyzer.__new__(ContentGapAnalyzer)
    analyzer.serp_gap_service = MagicMock()
    analyzer.serp_gap_service.analyze_topic_gaps = AsyncMock(
        return_value=return_value, side_effect=side_effect
    )
    return analyzer


def test_a2_serp_landscape_maps_real_gap_results():
    analyzer = _gap_analyzer_with_serp(return_value=SERP_FIXTURE)
    res = asyncio.run(
        analyzer._analyze_serp_landscape(
            ["seo tools", "content gap"],
            ["https://a.com", "https://b.com"],
        )
    )

    assert res["data_source"] == "serp_gap"
    ranking = res["keyword_rankings"]["seo tools"]
    assert ranking["domains_with_content"] == ["a.com"]
    assert ranking["competitor_count"] == 1
    # NO fabricated metrics may appear anywhere in the rankings.
    for forbidden in ("search_volume", "difficulty", "competition", "competitor_positions"):
        assert forbidden not in ranking, f"fabricated field survived: {forbidden}"
    # Real opportunity signal: topic with zero competitor content.
    assert any(o["keyword"] == "content gap" for o in res["ranking_opportunities"])
    assert res["competitor_presence"] == {"a.com": 1}

    # The service call carries the real inputs.
    _, kwargs = analyzer.serp_gap_service.analyze_topic_gaps.call_args
    assert kwargs.get("topics") == ["seo tools", "content gap"]
    assert kwargs.get("competitor_domains") == ["a.com", "b.com"]


def test_a2_serp_landscape_unavailable_is_honest_empty_not_fake():
    analyzer = _gap_analyzer_with_serp(side_effect=RuntimeError("no SERP provider key"))
    res = asyncio.run(
        analyzer._analyze_serp_landscape(["seo tools"], ["https://a.com"])
    )

    assert res["data_source"] == "unavailable"
    assert res["keyword_rankings"] == {}
    assert res["ranking_opportunities"] == []
    assert "search_volume" not in str(res)


# ---------------------------------------------------------------------------
# A3 — keyword expansion: real LLM service, no f-string templates
# ---------------------------------------------------------------------------

def _gap_analyzer_with_llm(return_value=None, side_effect=None) -> ContentGapAnalyzer:
    analyzer = ContentGapAnalyzer.__new__(ContentGapAnalyzer)
    analyzer.llm_insights = MagicMock()
    analyzer.llm_insights.generate_keyword_expansion = AsyncMock(
        return_value=return_value, side_effect=side_effect
    )
    return analyzer


def test_a3_keyword_expansion_uses_real_llm_output():
    analyzer = _gap_analyzer_with_llm(
        return_value={
            "new_keywords": [
                "seo tools guide",
                "how to seo tools",
                "best seo tools",
                "seo tools",  # duplicate of the seed -> deduped away
            ]
        }
    )
    res = asyncio.run(analyzer._expand_keyword_research(["seo tools"], "saas"))

    assert res["data_source"] == "llm"
    assert set(res["expanded_keywords"]) == {
        "seo tools guide",
        "how to seo tools",
        "best seo tools",
    }
    assert "seo tools guide" in res["long_tail_opportunities"]
    assert res["keyword_categories"]["informational"]
    # No template-only fabrication: a keyword is NOT auto-added just because
    # the seed exists.
    assert "seo tools tips" not in res["expanded_keywords"]


def test_a3_keyword_expansion_unavailable_is_honest_empty():
    analyzer = _gap_analyzer_with_llm(side_effect=RuntimeError("LLM down"))
    res = asyncio.run(analyzer._expand_keyword_research(["seo tools"], "saas"))

    assert res["data_source"] == "unavailable"
    assert res["expanded_keywords"] == []
    assert res["long_tail_opportunities"] == []


# ---------------------------------------------------------------------------
# A4 — real GSC rows, explicit data_source, mock generators deleted
# ---------------------------------------------------------------------------

GSC_ANALYTICS_FIXTURE = {
    "query_data": {
        "rows": [
            {"keys": ["seo tools"], "clicks": 450, "impressions": 2500, "ctr": 0.18, "position": 2.5},
        ],
    },
    "page_data": {
        "rows": [
            {"keys": ["https://x.com/a"], "clicks": 250, "impressions": 1250, "ctr": 0.2, "position": 1.8},
        ],
    },
}


def _gsc_service_with(analytics) -> GSCAnalyzerService:
    service = GSCAnalyzerService.__new__(GSCAnalyzerService)
    service.service_name = "gsc_analyzer"
    service.gsc_service = MagicMock()
    service.gsc_service.get_search_analytics = MagicMock(return_value=analytics)
    return service


def test_a4_fetch_gsc_data_maps_real_rows():
    service = _gsc_service_with(GSC_ANALYTICS_FIXTURE)
    data = asyncio.run(service._fetch_gsc_data("https://x.com", 30, "u1"))

    assert data["data_source"] == "gsc"
    assert data["keywords"] == [
        {"keyword": "seo tools", "impressions": 2500, "clicks": 450, "ctr": 18.0, "position": 2.5},
    ]
    assert data["pages"] == [
        {"url": "https://x.com/a", "clicks": 250, "impressions": 1250, "ctr": 20.0, "position": 1.8},
    ]
    # The old mock dataset must be gone entirely.
    assert "AI content creation" not in str(data)
    assert "meta description generator" not in str(data)
    # The user_id is forwarded to the real GSC accessor.
    _, args, _ = service.gsc_service.get_search_analytics.mock_calls[0]
    assert args[0] == "u1"


def test_a4_fetch_gsc_data_no_user_or_not_connected_is_no_data():
    service = _gsc_service_with(GSC_ANALYTICS_FIXTURE)
    no_user = asyncio.run(service._fetch_gsc_data("https://x.com", 30, None))
    assert no_user["data_source"] == "no_data"
    assert no_user["keywords"] == [] and no_user["pages"] == []
    assert service.gsc_service.get_search_analytics.call_count == 0

    service2 = _gsc_service_with({"error": "User not connected to GSC", "query_data": {"rows": []}})
    not_connected = asyncio.run(service2._fetch_gsc_data("https://x.com", 30, "u2"))
    assert not_connected["data_source"] == "no_data"
    assert not_connected["keywords"] == []


def test_a4_analyze_search_performance_surfaces_data_source():
    service = _gsc_service_with(GSC_ANALYTICS_FIXTURE)
    result = asyncio.run(service.analyze_search_performance("https://x.com", 30, "u1"))
    assert result["data_source"] == "gsc"

    service2 = _gsc_service_with({"error": "not connected", "query_data": {"rows": []}})
    result2 = asyncio.run(service2.analyze_search_performance("https://x.com", 30, "u2"))
    assert result2["data_source"] == "no_data"


def test_a4_mock_generators_deleted():
    assert not hasattr(GSCAnalyzerService, "_generate_mock_keywords")
    assert not hasattr(GSCAnalyzerService, "_generate_mock_pages")

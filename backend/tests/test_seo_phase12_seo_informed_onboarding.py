"""
Phase 12 (plan Phase C) — SEO-informed onboarding.

C1: persist the Step-0 on-page audit into website_analyses.seo_audit
    ('on_page_audit') under the per-user lock, merging (never clobbering).
C2: derive + persist a post-GSC-connect snapshot (striking distance / low CTR)
    from REAL GSC rows; honest no_data when unconnected.
C3: build_seo_prefill exposes onboarding content pillars + site URL for the
    dashboard meta tool — empty when onboarding has no data (no fabrication).
"""

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.onboarding_seo_insights import (
    build_seo_prefill,
    compact_on_page_audit,
    persist_gsc_snapshot,
    persist_on_page_audit,
    summarize_gsc_rows,
)


def _db_with(session, analysis, prefs=None):
    db = MagicMock()
    firsts = MagicMock()
    firsts.side_effect = [session, analysis]
    db.query.return_value.filter.return_value.first = firsts
    if prefs is not None:
        # Second query (ResearchPreferences) resolves to prefs.
        db.query.return_value.filter.return_value.first.side_effect = [session, analysis]
        db.query.side_effect = None
        # Simpler: make filter().first() return session, analysis, prefs in order.
        db.query.return_value.filter.return_value.first.side_effect = [session, analysis, prefs]
    return db


# ---------------------------------------------------------------------------
# C1
# ---------------------------------------------------------------------------

def test_c1_compact_on_page_audit_keeps_ssot_fields_and_counts_issues():
    compact = compact_on_page_audit(
        {
            "overall_score": 74,
            "meta": {"score": 80},
            "technical": {"score": 70},
            "content_health": {"word_count": 1200, "score": 65},
            "issues": ["a", "b", "c"],
        },
        "https://x.com",
    )
    assert compact["overall_score"] == 74
    assert compact["website_url"] == "https://x.com"
    assert compact["issue_count"] == 3
    assert compact["data_source"] == "on_page_service"


def test_c1_persist_on_page_audit_merges_into_seo_audit():
    session = SimpleNamespace(id=1, user_id="u1")
    analysis = SimpleNamespace(seo_audit={"sitemap_analysis": {"kept": True}})
    db = _db_with(session, analysis)

    with patch("services.onboarding_seo_insights.flag_modified"):
        persisted = asyncio.run(
            persist_on_page_audit(
                "u1", "https://x.com", {"overall_score": 88, "issues": ["x"]}, db
            )
        )

    assert persisted["overall_score"] == 88
    assert analysis.seo_audit["sitemap_analysis"] == {"kept": True}  # merge, no clobber
    assert analysis.seo_audit["on_page_audit"]["issue_count"] == 1
    assert "last_on_page_audit_at" in analysis.seo_audit


# ---------------------------------------------------------------------------
# C2
# ---------------------------------------------------------------------------

def test_c2_summarize_gsc_rows_striking_distance_and_low_ctr():
    rows = [
        {"keys": ["strike me"], "position": 5.0, "ctr": 0.03, "impressions": 200, "clicks": 6},
        {"keys": ["low ctr"], "position": 2.0, "ctr": 0.005, "impressions": 500, "clicks": 2},
        {"keys": ["healthy"], "position": 3.0, "ctr": 0.05, "impressions": 500, "clicks": 25},
    ]
    result = summarize_gsc_rows(rows)

    assert [e["keyword"] for e in result["striking_distance"]] == ["strike me"]
    assert [e["keyword"] for e in result["low_ctr"]] == ["low ctr"]
    assert result["totals"] == {
        "keywords_analyzed": 3,
        "striking_distance": 1,
        "low_ctr": 1,
    }
    # ctr converted to percent for the UI
    assert result["striking_distance"][0]["ctr"] == 3.0


def test_c2_summarize_empty_is_honest():
    result = summarize_gsc_rows([])
    assert result["striking_distance"] == []
    assert result["low_ctr"] == []
    assert result["totals"]["keywords_analyzed"] == 0


def test_c2_persist_gsc_snapshot_merges_and_keeps_siblings():
    session = SimpleNamespace(id=1, user_id="u1")
    analysis = SimpleNamespace(seo_audit={"on_page_audit": {"overall_score": 88}})
    db = _db_with(session, analysis)

    snapshot = {"status": "success", "striking_distance": [], "low_ctr": [], "totals": {}}
    with patch("services.onboarding_seo_insights.flag_modified"):
        persisted = asyncio.run(persist_gsc_snapshot("u1", "https://x.com", snapshot, db))

    assert persisted["site_url"] == "https://x.com"
    assert analysis.seo_audit["on_page_audit"] == {"overall_score": 88}
    assert analysis.seo_audit["gsc_snapshot"]["site_url"] == "https://x.com"
    assert "last_gsc_snapshot_at" in analysis.seo_audit


# ---------------------------------------------------------------------------
# C3
# ---------------------------------------------------------------------------

def test_c3_build_seo_prefill_dedupes_pillars():
    session = SimpleNamespace(id=1, user_id="u1")
    analysis = SimpleNamespace(website_url="https://x.com", seo_audit={})
    prefs = SimpleNamespace(content_pillars=["seo", "content", "seo", "  "])
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [session, analysis, prefs]

    prefill = build_seo_prefill("u1", db)
    assert prefill["website_url"] == "https://x.com"
    assert prefill["keywords"] == ["seo", "content"]
    assert prefill["source"] == "onboarding"


def test_c3_build_seo_prefill_without_data_is_empty():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    prefill = build_seo_prefill("u1", db)
    assert prefill == {"website_url": "", "keywords": [], "source": "onboarding"}


# ---------------------------------------------------------------------------
# Route wiring contract
# ---------------------------------------------------------------------------

def test_c_router_registered_in_app():
    app_src = (BACKEND_ROOT / "app.py").read_text(encoding="utf-8", errors="ignore")
    assert "api.onboarding_utils.seo_insights_routes" in app_src, (
        "SEO-informed onboarding router must be registered in app.py"
    )

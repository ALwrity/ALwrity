"""
Tests for services/seo_tools/onboarding_context.build_onboarding_opportunity_context.

Pins down the digest contract for the "Strategic Content Opportunities" LLM
call:

- No user_id -> {} (no point building a digest without a session).
- DB absent / query raises / no session -> {} (graceful degradation, the
  sitemap analysis must never break because context enrichment failed).
- Full Step-1 + Step-2 data -> labeled sections (audience + brand voice,
  brand positioning, research findings capped to _MAX_SECONDS, grounded
  competitor intel).
- Empty data collapses to fewer sections; competitor fallback to plain URL
  strings only when there are no stored competitor records.
- Section cap (_SECTION_CHAR_CAP) and overall digest cap (_TOTAL_CHAR_CAP)
  bound every output so the prompt is never overstuffed.
- cap_text truncates on a word boundary and appends an ellipsis.

No DB is used: get_session_for_user is patched and the query chain is a fake.
"""

from unittest.mock import MagicMock

import services.seo_tools.onboarding_context as ctx
from models.onboarding import (
    CompetitorAnalysis,
    OnboardingSession,
    ResearchPreferences,
    WebsiteAnalysis,
)

_SECTION_CAP = ctx._ONBOARDING_CTX_SECTION_CHAR_CAP
_TOTAL_CAP = ctx._ONBOARDING_CTX_TOTAL_CHAR_CAP
_MAX_SECONDS = ctx._ONBOARDING_CTX_MAX_SECONDS
_MAX_COMPETITORS = ctx._ONBOARDING_CTX_MAX_COMPETITORS


def _rec(**kwargs):
    """Build a fake ORM-like record with the given attributes."""
    obj = MagicMock()
    for key, value in kwargs.items():
        setattr(obj, key, value)
    return obj


def _q_single(result):
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.first = MagicMock(return_value=result)
    return q


def _q_all(results):
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=results)
    return q


def _fake_db(session=None, website=None, research=None, competitors=None):
    """Fake DB session routing per model class to canned query results."""
    competitors = competitors or []
    db = MagicMock()

    def query_for(model):
        if model is OnboardingSession:
            return _q_single(session)
        if model is WebsiteAnalysis:
            return _q_single(website)
        if model is ResearchPreferences:
            return _q_single(research)
        if model is CompetitorAnalysis:
            return _q_all(competitors)
        return MagicMock()

    db.query = MagicMock(side_effect=query_for)
    return db


def _full_website():
    return _rec(
        session_id=1,
        target_audience={"demographics": "B2B SaaS marketers", "location": "US"},
        writing_style={"tone": "professional, data-led", "persona": "analyst"},
        brand_analysis={"positioning": "premium SEO platform"},
        content_strategy_insights={
            "strengths": ["Deep SEO knowledge"],
            "opportunities": ["Thought leadership"],
        },
    )


def _full_research():
    return _rec(
        session_id=1,
        content_types=["Blog Posts", "LinkedIn", "Newsletter"],
        research_depth="Comprehensive",
        research_summary={
            "key_findings": [f"Finding {i}" for i in range(8)],
            "recommendations": ["Publish weekly", "Build pillar pages"],
        },
        content_pillars={"pillars": [{"name": "SEO Guides"}, {"name": "Case Studies"}]},
    )


def _full_competitor():
    return _rec(
        session_id=1,
        competitor_url="https://competitor.com",
        competitor_domain="competitor.com",
        analysis_data={
            "title": "Competitor Corp",
            "content_insights": {
                "content_focus": "enterprise SEO",
                "publishing_frequency": "daily",
            },
            "competitive_analysis": {
                "threat_level": "high",
                "competitive_strengths": ["Large team", "Big brand"],
                "differentiation_opportunities": ["Transparent pricing"],
            },
            "market_positioning": {"market_tier": "enterprise"},
        },
    )


def _build_context(monkeypatch, db, user_id="user-1", competitor_urls=None):
    monkeypatch.setattr("services.database.get_session_for_user", lambda uid: db)
    return ctx.build_onboarding_opportunity_context(user_id, competitor_urls)


# ---------------------------------------------------------------- cap_text


def test_cap_text_empty():
    assert ctx.cap_text("", 100) == ""
    assert ctx.cap_text(None, 100) == ""
    assert ctx.cap_text("   hello   ", 100) == "hello"


def test_cap_text_max_chars_non_positive():
    assert ctx.cap_text("hello", 0) == ""
    assert ctx.cap_text("hello", -5) == ""


def test_cap_text_passthrough_short():
    assert ctx.cap_text("short text", 100) == "short text"


def test_cap_text_truncates_on_word_boundary():
    long_text = "alpha " * 300
    result = ctx.cap_text(long_text, 100)
    assert result.endswith("...")
    assert "..." not in result[:-3]
    assert len(result) <= 103


def test_cap_text_preserves_mid_sentence_words():
    text = ("x" * 10 + " ") * 40
    result = ctx.cap_text(text, 80)
    assert len(result) <= 83


# ------------------------------------------------------------- fallbacks


def test_no_user_id_returns_empty(monkeypatch):
    monkeypatch.setattr("services.database.get_session_for_user", lambda uid: _fake_db())
    assert ctx.build_onboarding_opportunity_context(None) == {}
    assert ctx.build_onboarding_opportunity_context("") == {}
    assert ctx.build_onboarding_opportunity_context("   ") == {}


def test_no_db_returns_empty(monkeypatch):
    monkeypatch.setattr("services.database.get_session_for_user", lambda uid: None)
    assert ctx.build_onboarding_opportunity_context("user-1") == {}


def test_db_query_error_returns_empty(monkeypatch):
    bad_db = MagicMock()
    bad_db.query = MagicMock(side_effect=RuntimeError("db exploded"))
    assert _build_context(monkeypatch, bad_db) == {}
    assert bad_db.close.called


def test_no_session_returns_empty(monkeypatch):
    db = _fake_db(session=None)
    assert _build_context(monkeypatch, db) == {}
    assert db.close.called


# ----------------------------------------------------------------- digest


def test_builds_full_digest_sections(monkeypatch):
    db = _fake_db(
        session=_rec(id=1, user_id="user-1", updated_at=None),
        website=_full_website(),
        research=_full_research(),
        competitors=[_full_competitor()],
    )
    sections = _build_context(monkeypatch, db)

    assert set(sections) == {
        "AUDIENCE & BRAND VOICE",
        "BRAND POSITIONING & STRATEGY",
        "STEP 2 RESEARCH (ALREADY LEARNED)",
        "COMPETITOR INTEL (GROUNDED)",
    }

    audience = sections["AUDIENCE & BRAND VOICE"]
    assert "B2B SaaS marketers" in audience
    assert "professional, data-led" in audience

    brand = sections["BRAND POSITIONING & STRATEGY"]
    assert "premium SEO platform" in brand
    assert "Deep SEO knowledge" in brand

    research = sections["STEP 2 RESEARCH (ALREADY LEARNED)"]
    assert "Blog Posts" in research
    assert "Comprehensive" in research
    assert "Publish weekly" in research
    assert "SEO Guides" in research


def test_research_key_findings_capped_to_max_seconds(monkeypatch):
    db = _fake_db(
        session=_rec(id=1, user_id="user-1", updated_at=None),
        website=_full_website(),
        research=_full_research(),
        competitors=[_full_competitor()],
    )
    sections = _build_context(monkeypatch, db)
    text = sections["STEP 2 RESEARCH (ALREADY LEARNED)"]
    expecting = '"Finding 0", "Finding 1", "Finding 2", "Finding 3"'
    assert expecting in text
    assert '"Finding 4"' not in text


def test_bad_shape_research_summary_does_not_kill_digest(monkeypatch):
    """Regression: a dict/string (not list) key_findings or recommendations
    must skip that bit instead of raising and collapsing the whole digest."""
    research = _rec(
        session_id=1,
        content_types=["Blog Posts"],
        research_depth="Comprehensive",
        research_summary={
            "key_findings": {"left": "right"},  # dict, not list
            "recommendations": "just a string",  # string, not list
        },
        content_pillars={"pillars": [{"name": "SEO Guides"}]},
    )
    db = _fake_db(
        session=_rec(id=1, user_id="user-1", updated_at=None),
        website=_full_website(),
        research=research,
        competitors=[_full_competitor()],
    )
    sections = _build_context(monkeypatch, db)

    assert "AUDIENCE & BRAND VOICE" in sections
    assert "COMPETITOR INTEL (GROUNDED)" in sections

    research_text = sections["STEP 2 RESEARCH (ALREADY LEARNED)"]
    assert "Blog Posts" in research_text
    assert "Comprehensive" in research_text
    assert "SEO Guides" in research_text
    assert "Key findings" not in research_text
    assert "Earlier recommendations" not in research_text


def test_competitor_intel_is_grounded(monkeypatch):
    db = _fake_db(
        session=_rec(id=1, user_id="user-1", updated_at=None),
        website=_full_website(),
        research=_full_research(),
        competitors=[_full_competitor()],
    )
    line = _build_context(monkeypatch, db)["COMPETITOR INTEL (GROUNDED)"]
    assert "Competitor Corp (competitor.com)" in line
    assert "content_focus=enterprise SEO" in line
    assert "threat=high" in line
    assert "tier=enterprise" in line
    assert "frequency=daily" in line
    assert "Large team, Big brand" in line
    assert "Transparent pricing" in line


def test_partial_data_excludes_empty_sections(monkeypatch):
    sparse_website = _rec(
        session_id=1,
        target_audience={"demographics": "B2B marketers"},
        writing_style=None,
        brand_analysis=None,
        content_strategy_insights=None,
    )
    sparse_research = _rec(
        session_id=1,
        content_types=None,
        research_depth="Light",
        research_summary=None,
        content_pillars=None,
    )
    db = _fake_db(
        session=_rec(id=1, user_id="user-1", updated_at=None),
        website=sparse_website,
        research=sparse_research,
        competitors=[],
    )
    sections = _build_context(monkeypatch, db)

    assert set(sections) == {"AUDIENCE & BRAND VOICE", "STEP 2 RESEARCH (ALREADY LEARNED)"}
    assert "B2B marketers" in sections["AUDIENCE & BRAND VOICE"]
    assert sections["STEP 2 RESEARCH (ALREADY LEARNED)"] == "Research depth: Light"


def test_competitor_fallback_to_urls_only(monkeypatch):
    db = _fake_db(
        session=_rec(id=1, user_id="user-1", updated_at=None),
        website=None,
        research=None,
        competitors=[],
    )
    urls = [f"https://comp{i}.com" for i in range(10)]
    sections = _build_context(monkeypatch, db, competitor_urls=urls)

    assert set(sections) == {"COMPETITOR INTEL (GROUNDED)"}
    text = sections["COMPETITOR INTEL (GROUNDED)"]
    for i in range(_MAX_COMPETITORS):
        assert f"- https://comp{i}.com" in text
    assert "https://comp6.com" not in text


def test_competitor_ignores_non_dict_analysis_data(monkeypatch):
    comp = _rec(
        session_id=1,
        competitor_domain="plain.com",
        competitor_url="https://plain.com",
        analysis_data=None,
    )
    db = _fake_db(
        session=_rec(id=1, user_id="user-1", updated_at=None),
        website=None,
        research=None,
        competitors=[comp],
    )
    sections = _build_context(monkeypatch, db)
    text = sections["COMPETITOR INTEL (GROUNDED)"]
    assert "plain.com (plain.com)" in text
    assert "content_focus" not in text


# ------------------------------------------------------------------- caps


def test_section_cap_is_enforced(monkeypatch):
    huge = {"demographics": "A" * 5000}
    website = _rec(
        session_id=1,
        target_audience=huge,
        writing_style=huge,
        brand_analysis=None,
        content_strategy_insights=None,
    )
    db = _fake_db(
        session=_rec(id=1, user_id="user-1", updated_at=None),
        website=website,
        research=None,
        competitors=[],
    )
    sections = _build_context(monkeypatch, db)
    assert len(sections["AUDIENCE & BRAND VOICE"]) <= _SECTION_CAP + 3


def test_total_digest_cap_is_enforced(monkeypatch):
    huge = {
        "demographics": "A" * 5000,
        "interests": "B" * 5000,
        "challenges": "C" * 5000,
    }
    website = _rec(
        session_id=1,
        target_audience=huge,
        writing_style=huge,
        brand_analysis=huge,
        content_strategy_insights=huge,
    )
    research = _rec(
        session_id=1,
        content_types=["A" * 3000],
        research_depth="Comprehensive",
        research_summary={"key_findings": ["F" * 3000], "recommendations": ["R" * 3000]},
        content_pillars={"pillars": [{"name": "P" * 3000}]},
    )
    comp = _rec(
        session_id=1,
        competitor_domain="comp.com",
        competitor_url="https://comp.com",
        analysis_data={
            "title": "T" * 3000,
            "content_insights": {"content_focus": "F" * 3000, "publishing_frequency": "D" * 3000},
            "competitive_analysis": {"threat_level": "high", "competitive_strengths": ["S" * 3000]},
            "market_positioning": {"market_tier": "T" * 3000},
        },
    )
    db = _fake_db(
        session=_rec(id=1, user_id="user-1", updated_at=None),
        website=website,
        research=research,
        competitors=[comp],
    )
    sections = _build_context(monkeypatch, db)
    total = sum(len(t) for t in sections.values())
    assert total <= _TOTAL_CAP
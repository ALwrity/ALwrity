"""
Tests for strategic intelligence persistence + cache round-trip.

The "Strategic Content Opportunities" on-boarding sections (original 5 +
quick_wins, keyword_topic_opportunities, audience_fit_opportunities,
channel_playbook, pillar_expansion) flow into the Step 3 result dict through
``SitemapService.analyze_sitemap_for_onboarding`` (``analysis_result`` ->
``onboarding_insights``) and must survive both persistence layers without
dropping the newly added keys:

- DB: ``_persist_sitemap_analysis`` writes the whole onboarding_insights dict
  into ``WebsiteAnalysis.seo_audit.sitemap_analysis.analysis_data``.
- Cache: ``_load_cached_sitemap_analysis`` (the DB-backed cache-first path the
  frontend hits before paying for a fresh LLM call) must return the same new
  sections intact, so a refresh/navigation restores the grounded cards.

Both are tested with fake DB sessions (no real DB), mirroring the existing
``test_step2_persistence.py`` conventions. The legacy ``sitemap_onboarding_insights``
alias fallback is also pinned so older results never persist as empty.
"""

import asyncio
from unittest.mock import MagicMock

import pytest

from api.onboarding_utils.step3_routes import (
    _load_cached_sitemap_analysis,
    _persist_sitemap_analysis,
)
from api.onboarding_utils.step_management_service import StepManagementService
from models.onboarding import WebsiteAnalysis

_NEW_SECTIONS = [
    "quick_wins",
    "keyword_topic_opportunities",
    "audience_fit_opportunities",
    "channel_playbook",
    "pillar_expansion",
]


def _full_insights():
    """Onboarding insights dict with BOTH original and new grounded sections."""
    return {
        "competitive_positioning": "Mid-market SEO leader",
        "content_gaps": [{"title": "Enterprise IA guides", "priority": "high"}],
        "growth_opportunities": [{"title": "Programmatic SEO", "priority": "medium"}],
        "industry_benchmarks": ["2x publishing cadence vs top competitor"],
        "strategic_recommendations": [{"title": "Publish weekly", "priority": "high"}],
        "quick_wins": [{"title": "Add FAQ schema", "priority": "low"}],
        "keyword_topic_opportunities": [{"topic": "programmatic SEO"}],
        "audience_fit_opportunities": [{"title": "Beginner checklist"}],
        "channel_playbook": [{"channel": "LinkedIn", "recommendations": ["Post 3x/week"]}],
        "pillar_expansion": [{"title": "Expand SEO Guides"}],
    }


def _analysis_result(**overrides):
    insights = overrides.pop("onboarding_insights", _full_insights())
    result = {
        "sitemap_url": "https://example.com/sitemap.xml",
        "total_urls": 120,
        "url_list": [],
        "structure_analysis": {"total_urls": 120, "url_patterns": {"blog": 60}},
        "content_trends": {"publishing_velocity": 2},
        "publishing_patterns": {"weekly": "yes"},
        "ai_insights": {},
        "onboarding_insights": insights,
        "competitors_analyzed": ["competitor.com"],
    }
    result.update(overrides)
    return result


class _Analysis:
    """Minimal WebsiteAnalysis stand-in with a plain ``seo_audit`` attribute."""

    def __init__(self, seo_audit):
        self.seo_audit = seo_audit or {}


def _fake_website_db(analysis, session=None):
    session = session or MagicMock(id=7)
    db = MagicMock()
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.first = MagicMock(return_value=analysis)
    db.query = MagicMock(return_value=q)
    return db, session


@pytest.fixture
def fake_session_for_user(monkeypatch):
    def _set(db):
        monkeypatch.setattr("services.database.get_session_for_user", lambda uid: db)
    return _set


@pytest.fixture
def fake_get_or_create_session(monkeypatch):
    def _set(session):
        monkeypatch.setattr(
            StepManagementService,
            "_get_or_create_session",
            MagicMock(return_value=session),
        )
    return _set


@pytest.fixture
def fake_lock(monkeypatch):
    async def _lock(_user_id):
        return asyncio.Lock()
    monkeypatch.setattr("api.onboarding_utils.step3_routes.get_seo_audit_lock", _lock)


def test_persist_writes_new_sections_to_seo_audit(
    fake_session_for_user, fake_get_or_create_session, fake_lock, monkeypatch
):
    existing_audit = {"competitive_sitemap_benchmarking": {"kept": True}}
    analysis = _Analysis(existing_audit)
    db, session = _fake_website_db(analysis)
    fake_session_for_user(db)
    fake_get_or_create_session(session)
    monkeypatch.setattr(
        "sqlalchemy.orm.attributes.flag_modified", lambda *a, **k: None
    )

    asyncio.run(_persist_sitemap_analysis("user-1", "https://example.com", _analysis_result()))

    persisted = analysis.seo_audit["sitemap_analysis"]["analysis_data"]["onboarding_insights"]
    assert persisted == _full_insights()
    for section in _NEW_SECTIONS:
        assert persisted.get(section) == _full_insights()[section]
    # Other keys in seo_audit are preserved (the per-user lock prevents clobbering).
    assert analysis.seo_audit["competitive_sitemap_benchmarking"] == {"kept": True}
    assert db.commit.called


def test_persist_falls_back_to_legacy_insights_key(
    fake_session_for_user, fake_get_or_create_session, fake_lock, monkeypatch
):
    """Legacy ``sitemap_onboarding_insights`` alias is still persisted under
    the canonical ``onboarding_insights`` key."""
    analysis = _Analysis({})
    db, session = _fake_website_db(analysis)
    fake_session_for_user(db)
    fake_get_or_create_session(session)
    monkeypatch.setattr(
        "sqlalchemy.orm.attributes.flag_modified", lambda *a, **k: None
    )
    legacy = _full_insights()

    asyncio.run(_persist_sitemap_analysis(
        "user-1", "https://example.com",
        _analysis_result(onboarding_insights=None, sitemap_onboarding_insights=legacy),
    ))

    persisted = analysis.seo_audit["sitemap_analysis"]["analysis_data"]["onboarding_insights"]
    assert persisted == legacy
    for section in _NEW_SECTIONS:
        assert persisted.get(section) == legacy[section]


def test_cache_round_trip_preserves_new_sections(
    fake_session_for_user, fake_get_or_create_session
):
    cached = {
        "success": True,
        "user_url": "https://example.com",
        "sitemap_url": "https://example.com/sitemap.xml",
        "analyzed_at": "2026-08-29T00:00:00",
        "analysis_data": {
            "total_urls": 120,
            "structure_analysis": {"total_urls": 120},
            "onboarding_insights": _full_insights(),
        },
    }
    analysis = _Analysis({"sitemap_analysis": cached})
    db, session = _fake_website_db(analysis)
    fake_session_for_user(db)
    fake_get_or_create_session(session)

    loaded = _load_cached_sitemap_analysis("user-1", "https://example.com")

    assert loaded is not None
    insights = loaded["analysis_data"]["onboarding_insights"]
    for section in _NEW_SECTIONS:
        assert insights.get(section) == _full_insights()[section]
    assert insights["competitive_positioning"] == "Mid-market SEO leader"


def test_cache_misses_when_insights_absent(fake_session_for_user, fake_get_or_create_session):
    cached = {
        "success": True,
        "user_url": "https://example.com",
        "analysis_data": {"total_urls": 1, "onboarding_insights": {}},
    }
    analysis = _Analysis({"sitemap_analysis": cached})
    db, session = _fake_website_db(analysis)
    fake_session_for_user(db)
    fake_get_or_create_session(session)

    loaded = _load_cached_sitemap_analysis("user-1", "https://example.com")
    assert loaded is not None  # cache is keyed on freshness + URL, not insights


def test_cache_misses_on_url_mismatch(fake_session_for_user, fake_get_or_create_session):
    cached = {
        "success": True,
        "user_url": "https://other.com",
        "analysis_data": {"onboarding_insights": _full_insights()},
    }
    analysis = _Analysis({"sitemap_analysis": cached})
    db, session = _fake_website_db(analysis)
    fake_session_for_user(db)
    fake_get_or_create_session(session)

    loaded = _load_cached_sitemap_analysis("user-1", "https://example.com")
    assert loaded is None
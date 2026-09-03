"""TDD tests for the contextual SIF query builder (Phase A).

``build_contextual_query`` composes semantic-index queries from the user's
onboarding context (grounding / flat context) instead of hardcoded generic
keyword bags.

Contract:
- Context-rich grounding -> the query contains the user's own terms
  (industry, brand voice, content types, competitor domains, platforms).
- Thin/missing grounding (and no flat-context data) -> returns the caller's
  legacy fallback string UNCHANGED (zero regression for existing behavior).
- Deterministic: identical inputs produce identical queries so the
  semantic cache can serve repeats within its TTL.
"""
from pathlib import Path
import shutil

import pytest

from services.intelligence.sif_query_builder import build_contextual_query


GROUNDING_RICH = {
    "onboarding_data": {
        "canonical_profile": {
            "industry": "SaaS marketing automation",
            "content_types": ["blog_post", "comparison_page"],
            "writing_tone": "Professional",
            "target_audience": "Marketing teams",
            "platform_preferences": ["linkedin"],
        },
        "website_analysis": {
            "website_url": "https://acme.example.com",
            "brand_analysis": {"brand_voice": "Bold"},
            "target_audience": {"industry_focus": "SaaS marketing automation"},
        },
        "research_preferences": {"content_types": ["blog_post"]},
        "competitor_analysis": [
            {"competitor_domain": "jasper.example.com", "competitor_url": "https://jasper.example.com"},
            {"domain": "copyai.example.net"},
        ],
        "persona_data": {"selectedPlatforms": ["linkedin"]},
        "platform_integrations": {"connected_platforms": ["linkedin"]},
    }
}


def test_context_rich_grounding_produces_user_terms():
    query = build_contextual_query(
        "content_strategist", GROUNDING_RICH, fallback="content gaps"
    )
    lowered = query.lower()
    assert "saas marketing automation" in lowered, f"industry missing: {query}"
    assert "blog_post" in lowered or "blog post" in lowered, f"content type missing: {query}"
    assert "bold" in lowered, f"brand voice missing: {query}"
    # legacy fallback string must NOT be used when context exists
    assert query != "content gaps"


def test_empty_grounding_returns_fallback_exactly():
    query = build_contextual_query("seo_specialist", {}, fallback="seo issue problem error fix")
    assert query == "seo issue problem error fix"


def test_none_grounding_returns_fallback_exactly():
    query = build_contextual_query("seo_specialist", None, fallback="seo website analysis x")
    assert query == "seo website analysis x"


def test_deterministic_output():
    q1 = build_contextual_query("strategy_architect", GROUNDING_RICH, fallback="marketing")
    q2 = build_contextual_query("strategy_architect", GROUNDING_RICH, fallback="marketing")
    assert q1 == q2


def test_agent_intents_differ_for_same_grounding():
    q_strategy = build_contextual_query("strategy_architect", GROUNDING_RICH, fallback="marketing")
    q_seo = build_contextual_query("seo_specialist", GROUNDING_RICH, fallback="seo audit")
    assert q_strategy != q_seo
    assert "content pillars" in q_strategy.lower()
    assert "seo" in q_seo.lower()


def test_competitor_domains_included_for_competitor_agent():
    query = build_contextual_query("competitor_analyst", GROUNDING_RICH, fallback="competitor x")
    lowered = query.lower()
    assert "jasper.example.com" in lowered, f"competitor domain missing: {query}"
    assert "copyai.example.net" in lowered, f"second competitor missing: {query}"


def test_hints_included_and_terms_capped():
    query = build_contextual_query(
        "content_strategist",
        GROUNDING_RICH,
        hints=["refresh stale posts"],
        max_terms=3,
    )
    lowered = query.lower()
    assert "refresh stale posts" in lowered
    # max_terms bounds the term groups: intent(1) + content_types(2) + industry(3);
    # later categories (audience) must be dropped, not appended unbounded.
    assert "marketing teams" not in lowered


def test_platforms_included_for_social_agent():
    query = build_contextual_query("social_media_manager", GROUNDING_RICH, fallback="social media")
    assert "linkedin" in query.lower()


def _cleanup_workspace(user_id: str, backend_root: Path) -> None:
    ws = backend_root / "workspace" / f"workspace_{user_id}"
    if ws.exists():
        shutil.rmtree(ws, ignore_errors=True)


def test_vfs_fallback_when_grounding_thin(tmp_path):
    """When grounding carries no context but the user's flat context docs do,
    the builder reads through AgentContextVFS and still produces a
    user-specific query (VFS becomes a production consumer)."""
    from services.intelligence.agent_flat_context import AgentFlatContextStore

    backend_root = Path(__file__).resolve().parents[3]
    user_id = "pytest_qb_vfs_user"
    _cleanup_workspace(user_id, backend_root)
    try:
        store = AgentFlatContextStore(user_id)
        assert store.save_step2_website_analysis(
            {
                "website_url": "https://vfs.example.org",
                "brand_analysis": {"brand_voice": "Witty"},
            }
        )

        query = build_contextual_query(
            "content_guardian",
            {"onboarding_data": {}},
            user_id=user_id,
            fallback="website analysis brand voice style",
        )
        lowered = query.lower()
        assert "witty" in lowered, f"flat-context brand voice missing: {query}"
    finally:
        _cleanup_workspace(user_id, backend_root)


def test_no_context_at_all_returns_fallback():
    query = build_contextual_query("content_guardian", {"onboarding_data": {}}, fallback="legacy query")
    assert query == "legacy query"


def test_comma_separated_values_become_distinct_terms():
    """'digital marketing, SaaS, AI tools' must not become one giant
    comma-laden term - it splits into separate, readable terms."""
    grounding = {
        "onboarding_data": {
            "canonical_profile": {"industry": "digital marketing, SaaS, AI tools"},
        },
    }
    query = build_contextual_query("strategy_architect", grounding, fallback="marketing")
    assert "digital marketing" in query
    assert "saas" in query.lower()
    # the raw comma string must not survive as a single term
    assert "digital marketing, saas, ai tools" not in query.lower()


def test_multi_word_brand_voice_is_capped_not_dumped():
    """A long descriptive brand voice ('confident tech-forward
    community-focused') must not dump all of its words into the query."""
    grounding = {
        "onboarding_data": {
            "website_analysis": {"brand_analysis": {"brand_voice": "confident tech-forward community-focused"}},
            "canonical_profile": {"industry": "SaaS", "content_types": ["blog_post"]},
        },
    }
    query = build_contextual_query("seo_specialist", grounding, fallback="seo audit")
    # at most 2 words of the brand voice survive the cap
    assert "community-focused" not in query and "community focused" not in query


def test_terms_are_capped_in_length():
    """No single term should exceed ~60 chars (giant JSON dumps, urls, etc.)."""
    grounding = {
        "onboarding_data": {
            "canonical_profile": {"industry": "x" * 200},
        },
    }
    query = build_contextual_query("strategy_architect", grounding, fallback="marketing")
    assert all(len(term) <= 80 for term in query.split())


def test_sif_base_agent_query_uses_remembered_grounding():
    """The base-agent helpers (_remember_grounding + _sif_query) must compose
    user-specific queries from the committee grounding the agent received."""
    from services.intelligence.agents.specialized.base import SIFBaseAgent

    agent = SIFBaseAgent.__new__(SIFBaseAgent)
    agent.user_id = "pytest_qb_agent_user"
    agent.agent_type = "content_strategist"
    agent._remember_grounding(GROUNDING_RICH)

    query = agent._sif_query(fallback="content gaps")
    lowered = query.lower()
    assert "saas marketing automation" in lowered, f"industry missing: {query}"
    assert "blog post" in lowered, f"content type missing: {query}"


def test_sif_base_agent_query_falls_back_without_grounding():
    from services.intelligence.agents.specialized.base import SIFBaseAgent

    agent = SIFBaseAgent.__new__(SIFBaseAgent)
    agent.user_id = "pytest_qb_no_ctx_user"
    agent.agent_type = "content_strategist"

    assert agent._sif_query(fallback="content gaps") == "content gaps"

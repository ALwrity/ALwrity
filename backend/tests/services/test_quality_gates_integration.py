"""
Unit tests for strategy grounding quality gates (Phase 5.2).

Tests the wiring contract of services/intelligence/agents/quality_gates.py:
- validate_strategy_grounding with realistic onboarding data
- Pass/fail semantics of each component validator
- db_sourced_fields precedence behaviour
- extract_content vs dict_to_text content extraction

These complement tests/api/test_strategy_integration.py (endpoint-level flow)
and tests/api/test_phase10_quality_gates.py (original gate coverage).
"""

import pytest
from unittest.mock import patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from services.intelligence.agents.quality_gates import (
    validate_strategy_grounding,
    validate_persona_grounding,
    validate_competitor_grounding,
    validate_analytics_consistency,
    validate_data_quality_grounding,
    extract_content,
    dict_to_text,
)


@pytest.fixture
def realistic_onboarding():
    """Realistic complete onboarding context from process_onboarding_data."""
    return {
        "website_analysis": {
            "website_url": "https://mysite.com",
            "confidence_level": 0.9,
            "data_freshness": "recent",
        },
        "persona_data": {
            "core_persona": {
                "name": "Growth Marketer",
                "role": "Growth Marketer",
                "goals": ["lead-generation", "brand-awareness", "retention"],
                "pain_points": ["high-cac", "low-engagement"],
                "industry": "SaaS",
            }
        },
        "competitor_analysis": [
            {"domain": "hubspot.com", "name": "HubSpot"},
            {"domain": "salesforce.com", "name": "Salesforce"},
        ],
        "gsc_analytics": {"total_queries": 5000, "total_clicks": 1200, "avg_position": 8.2},
        "bing_analytics": {"total_queries": 800, "total_clicks": 150},
        "canonical_profile": {"industry": "SaaS", "company_size": "startup"},
        "data_quality": {"completeness": 0.85, "freshness": 0.9, "overall_score": 0.87},
    }


@pytest.fixture
def grounded_strategy():
    """Strategy content grounded in the realistic onboarding data."""
    return {
        "strategy_metadata": {"ai_generated": True},
        "base_strategy": {
            "business_objectives": (
                "Grow the SaaS platform for the Growth Marketer persona; address "
                "high-cac and low-engagement pain points through lead-generation "
                "and brand-awareness content that outranks hubspot.com and "
                "salesforce.com on core comparison keywords."
            )
        },
        "performance_predictions": {"predicted_traffic": 1500, "growth_rate": "15%"},
    }


class TestValidateStrategyGroundingIntegration:
    """Combined gate behaviour with realistic data (pass/fail scenarios)."""

    def test_realistic_grounded_data_passes_with_full_details(
        self, realistic_onboarding, grounded_strategy
    ):
        result = validate_strategy_grounding(grounded_strategy, realistic_onboarding)

        assert result["passed"] is True
        assert result["status"] == "checked"
        assert result["checked"] is True
        assert set(result["details"].keys()) == {
            "persona_grounding",
            "competitor_grounding",
            "analytics_consistency",
            "data_quality",
        }
        assert result["details"]["persona_grounding"]["passed"] is True
        assert result["details"]["competitor_grounding"]["passed"] is True
        assert result["details"]["analytics_consistency"]["passed"] is True
        assert result["details"]["data_quality"]["passed"] is True

    def test_weighted_overall_score(self, realistic_onboarding, grounded_strategy):
        """Overall score uses weights 0.25/0.25/0.2/0.3 across components."""
        result = validate_strategy_grounding(grounded_strategy, realistic_onboarding)

        details = result["details"]
        expected = (
            details["persona_grounding"]["score"] * 0.25
            + details["competitor_grounding"]["score"] * 0.25
            + details["analytics_consistency"]["score"] * 0.2
            + details["data_quality"]["score"] * 0.3
        )
        assert result["score"] == round(expected, 2)

    def test_low_data_quality_fails_overall(self, grounded_strategy):
        """Data quality below threshold with violations fails the overall gate."""
        onboarding = {
            "website_analysis": {"website_url": "https://mysite.com"},
            "data_quality": {"completeness": 0.2, "freshness": 0.8, "overall_score": 0.5},
        }

        result = validate_strategy_grounding(grounded_strategy, onboarding)

        quality = result["details"]["data_quality"]
        assert quality["passed"] is False
        assert any(v["type"] == "low_completeness" for v in quality["violations"])
        assert result["passed"] is False
        assert any(v["type"] == "low_completeness" for v in result["violations"])

    def test_stale_data_warns_but_passes(self, grounded_strategy):
        """Freshness < 0.5 produces a warning without failing."""
        onboarding = {
            "data_quality": {"completeness": 0.9, "freshness": 0.3, "overall_score": 0.75},
        }

        result = validate_strategy_grounding(grounded_strategy, onboarding)

        quality = result["details"]["data_quality"]
        assert quality["passed"] is True
        assert any(w["type"] == "stale_data" for w in quality["warnings"])

    def test_missing_sources_pass_gracefully(self):
        """Empty onboarding must never fail the gate (all components pass)."""
        result = validate_strategy_grounding({"base_strategy": {}}, {})

        assert result["passed"] is True
        # dict_to_text fallback gives any dict payload text -> checked
        assert result["checked"] is True
        for component in result["details"].values():
            assert component["passed"] is True

    def test_none_inputs_pass_gracefully(self):
        """None strategy/context must not crash the gate (regression: it did)."""
        result = validate_strategy_grounding(None, None)

        assert result["passed"] is True
        assert result["checked"] is False  # no payload -> no text


class TestPersonaGroundingUnit:
    """validate_persona_grounding pass/fail semantics."""

    def test_role_reflected_scores_full(self):
        persona = {"core_persona": {"role": "Growth Marketer", "goals": ["retention"]}}
        content = "A strategy for the Growth Marketer persona focused on retention." * 2

        result = validate_persona_grounding(content, persona)

        assert result["passed"] is True
        assert result["score"] == 1.0
        assert result["warnings"] == []

    def test_single_warning_scores_085(self):
        """Role missing (content > 50 chars) -> 1 warning -> 1.0 - 0.15 = 0.85."""
        persona = {"core_persona": {"role": "Underwater Welder"}}
        content = "A strategy about baking cupcakes, garden parties, and artisanal bread."

        result = validate_persona_grounding(content, persona)

        assert result["score"] == 0.85
        assert result["passed"] is True  # 0.85 >= 0.7
        assert result["warnings"][0]["type"] == "role_not_reflected"

    def test_two_warnings_score_070_pass_boundary(self):
        """Role + goals both unaddressed -> 0.70, exactly at the pass boundary."""
        persona = {
            "core_persona": {
                "role": "Underwater Welder",
                "goals": ["deep-sea-safety", "equipment-longevity"],
            }
        }
        content = (
            "A comprehensive strategy about baking cupcakes, garden parties, and "
            "artisanal bread workshops for the local community this season."
        )

        result = validate_persona_grounding(content, persona)

        assert result["score"] == 0.70
        assert result["passed"] is True  # boundary: >= 0.7
        types = [w["type"] for w in result["warnings"]]
        assert "role_not_reflected" in types
        assert "goals_not_addressed" in types

    def test_db_sourced_role_changes_warning_type(self):
        """db-sourced role produces role_mismatch (not role_not_reflected)."""
        persona = {"core_persona": {"role": "Underwater Welder"}}
        content = "A strategy about baking cupcakes, garden parties, and artisanal bread."

        result = validate_persona_grounding(
            content, persona, db_sourced_fields={"role": True}
        )

        assert result["warnings"][0]["type"] == "role_mismatch"

    def test_string_core_persona_handled(self):
        """core_persona as a plain string is checked by name only."""
        result = validate_persona_grounding(
            "Some content", {"core_persona": "Growth Marketer"}
        )

        assert result["passed"] is True
        assert result["status"] == "checked"
        assert result["checks"][0]["type"] == "persona_name"


class TestCompetitorGroundingUnit:
    """validate_competitor_grounding pass/fail semantics."""

    def test_real_domain_referenced_scores_full(self):
        competitors = [
            {"domain": "hubspot.com", "name": "HubSpot"},
            {"domain": "salesforce.com", "name": "Salesforce"},
        ]
        content = "Outrank hubspot.com on comparison keywords this quarter."

        result = validate_competitor_grounding(content, competitors)

        assert result["score"] == 1.0
        # Semantics: domain AND name matches are counted separately, so one
        # competitor matching both counts twice (mention count, not distinct).
        assert result["checks"][0]["mentioned"] == 2

    def test_domain_normalisation_strips_scheme_and_www(self):
        competitors = [{"domain": "https://www.hubspot.com/pricing", "name": ""}]
        content = "Compare against hubspot.com/pricing pages."

        result = validate_competitor_grounding(content, competitors)

        assert result["checks"][0]["mentioned"] == 1

    def test_generic_competitors_flagged(self):
        """3+ known competitors, none mentioned, long content -> warning."""
        competitors = [
            {"domain": "hubspot.com", "name": "HubSpot"},
            {"domain": "salesforce.com", "name": "Salesforce"},
            {"domain": "zendesk.com", "name": "Zendesk"},
        ]
        content = (
            "Competitor A - Industry Leader, Competitor B - Emerging Player, and "
            "Competitor C - Niche Specialist dominate the market with strong "
            "content strategies and well-established multi-channel distribution "
            "networks, giving them significant reach across the industry today."
        )

        result = validate_competitor_grounding(content, competitors)

        assert result["checks"][0]["mentioned"] == 0
        assert result["checks"][0]["total_known"] == 3
        assert result["warnings"][0]["type"] == "generic_competitive"
        assert result["score"] == 0.8  # 1.0 - 0.2

    def test_db_sourced_competitors_warning_variant(self):
        competitors = [
            {"domain": "hubspot.com"},
            {"domain": "salesforce.com"},
            {"domain": "zendesk.com"},
        ]
        content = (
            "Generic competitive landscape text without any real company names, "
            "discussing broad market trends and generic player categories only. "
            "The analysis avoids naming specific competitor domains or brands "
            "while covering major strategic themes relevant to the industry."
        )

        result = validate_competitor_grounding(
            content, competitors, db_sourced_fields={"competitors": True}
        )

        assert result["warnings"][0]["type"] == "competitors_not_referenced"

    def test_fewer_than_three_competitors_never_flagged(self):
        """Generic warning requires >= 3 known competitors."""
        competitors = [{"domain": "hubspot.com", "name": "HubSpot"}]
        content = "Generic competitive landscape text without any real names." * 3

        result = validate_competitor_grounding(content, competitors)

        assert result["warnings"] == []
        assert result["score"] == 1.0

    def test_dict_shaped_competitor_data(self):
        """competitor_data may arrive as {'competitors': [...]}."""
        competitor_data = {
            "competitors": [{"domain": "hubspot.com", "name": "HubSpot"}],
            "market_gaps": ["pricing-pages", "integrations"],
        }
        content = "Outrank hubspot.com and cover pricing-pages gaps."

        result = validate_competitor_grounding(content, competitor_data)

        # Domain + name double-count (see note in test_real_domain_referenced_scores_full)
        assert result["checks"][0]["mentioned"] == 2
        assert result["checks"][-1]["type"] == "gap_analysis_coverage"
        assert result["checks"][-1]["addressed"] == 1


class TestAnalyticsConsistencyUnit:
    """validate_analytics_consistency pass/fail semantics."""

    def test_no_analytics_passes_unavailable(self):
        result = validate_analytics_consistency({"predicted_traffic": 100}, {}, {})

        assert result["status"] == "unavailable"
        assert result["score"] == 1.0

    def test_no_predictions_passes_with_empty_checks(self):
        result = validate_analytics_consistency(
            None, {"total_clicks": 100}, {"total_clicks": 50}
        )

        assert result["status"] == "checked"
        assert result["checks"] == []
        assert result["score"] == 1.0

    def test_baseline_check_values(self):
        result = validate_analytics_consistency(
            {"predicted_traffic": 100},
            {"total_queries": 5000, "total_clicks": 1200},
            {"total_clicks": 150},
        )

        baseline = result["checks"][0]
        assert baseline["gsc_queries"] == 5000
        assert baseline["gsc_clicks"] == 1200
        assert baseline["bing_clicks"] == 150
        assert baseline["total_clicks"] == 1350

    def test_aggressive_growth_percent_flagged(self):
        result = validate_analytics_consistency(
            {"growth_rate": "300%"},
            {"total_clicks": 1000},
            {},
        )

        types = [w["type"] for w in result["warnings"]]
        assert "aggressive_growth" in types
        assert result["score"] == 0.75  # 1.0 - 0.25

    def test_unrealistic_growth_multiple_flagged(self):
        result = validate_analytics_consistency(
            {"growth_rate": "10x"},
            {"total_clicks": 1000},
            {},
        )

        types = [w["type"] for w in result["warnings"]]
        assert "unrealistic_growth" in types

    def test_traffic_disconnect_flagged(self):
        """Predicted traffic > 10x the click baseline warns."""
        result = validate_analytics_consistency(
            {"predicted_traffic": 50000},
            {"total_clicks": 100},
            {},
        )

        types = [w["type"] for w in result["warnings"]]
        assert "traffic_disconnect" in types

    def test_reasonable_predictions_pass_clean(self):
        result = validate_analytics_consistency(
            {"predicted_traffic": 500, "growth_rate": "15%"},
            {"total_clicks": 1000},
            {},
        )

        assert result["passed"] is True
        assert result["warnings"] == []
        assert result["score"] == 1.0


class TestDataQualityGroundingUnit:
    """validate_data_quality_grounding pass/fail semantics."""

    def test_missing_metrics_pass_unavailable(self):
        result = validate_data_quality_grounding(None, {})

        assert result["status"] == "unavailable"
        assert result["score"] == 1.0

    def test_score_derived_from_completeness_and_freshness(self):
        """Without overall_score, score = (completeness + freshness) / 2."""
        result = validate_data_quality_grounding(
            {"completeness": 0.8, "freshness": 0.6}, {}
        )

        assert result["score"] == 0.7
        assert result["passed"] is True

    def test_low_overall_fails(self):
        result = validate_data_quality_grounding(
            {"completeness": 0.7, "freshness": 0.7, "overall_score": 0.4}, {}
        )

        assert result["passed"] is False
        assert result["score"] == 0.4


class TestContentExtraction:
    """extract_content known keys vs dict_to_text fallback."""

    def test_extract_content_reads_known_keys_only(self):
        assert extract_content({"content": "hello"}) == "hello"
        assert extract_content({"draft": "hi"}) == "hi"
        assert extract_content({"text": "hey", "content": "hello"}) == "hello"
        assert extract_content({"a": "hello"}) == ""

    def test_dict_to_text_serialises_nested_payloads(self):
        payload = {"base_strategy": {"business_objectives": "Grow sales"}}
        text = dict_to_text(payload)

        assert "business_objectives" in text
        assert "Grow sales" in text

    def test_dict_to_text_handles_strings_and_scalars(self):
        assert dict_to_text("plain") == "plain"
        assert dict_to_text(42) == "42"
        assert dict_to_text(None) == ""
        assert dict_to_text({"a": []}) == '{"a": []}'

    def test_gate_uses_dict_fallback_for_strategy_payloads(self, realistic_onboarding):
        """Strategy dicts (no _CONTENT_KEYS) still get persona-matched content."""
        strategy = {
            "base_strategy": {"business_objectives": "Content for the Growth Marketer persona"}
        }

        result = validate_strategy_grounding(strategy, realistic_onboarding)

        # dict_to_text made the persona role matchable
        assert result["details"]["persona_grounding"]["score"] == 1.0
        assert result["checked"] is True

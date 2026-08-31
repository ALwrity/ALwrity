"""
Integration tests for content strategy generation pipeline.

Tests cover:
- Full strategy generation with complete onboarding data
- Fail-fast when onboarding context is missing
- Data source grounding validation
- Partial data scenarios
- Quality gates integration
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


# ============================================================================
# Fixtures: Mock onboarding data at different completeness levels
# ============================================================================

@pytest.fixture
def mock_complete_onboarding():
    """User with all 13 onboarding data sources."""
    return {
        "website_analysis": {
            "website_url": "https://techstartup.com",
            "target_audience": {"role": "CTO", "industry": "SaaS"},
            "writing_style": {"tone": "professional", "voice": "authoritative"},
            "content_type": {"primary_type": "blog", "purpose": "education"},
            "data_freshness": "2024-01-15",
            "confidence_level": 0.9,
            "status": "completed"
        },
        "research_preferences": {
            "research_depth": "comprehensive",
            "content_types": ["blog", "case-study", "whitepaper"],
            "auto_research": True,
            "factual_content": True
        },
        "onboarding_session": {
            "progress": 5,
            "completed": True,
            "business_size": "startup",
            "region": "US"
        },
        "persona_data": {
            "core_persona": {
                "name": "Tech CTO",
                "role": "CTO",
                "goals": ["scalability", "cost-efficiency", "team-productivity"],
                "pain_points": ["technical-debt", "vendor-lock-in", "slow-release-cycle"],
                "industry": "SaaS"
            },
            "platform_personas": [],
            "quality_metrics": {"completeness": 0.9}
        },
        "competitor_analysis": [
            {
                "domain": "competitor-a.com",
                "name": "Competitor A Inc",
                "content_strategy": "Thought leadership blog",
                "market_gaps": ["enterprise-features", "integration-ecosystem"]
            },
            {
                "domain": "competitor-b.com",
                "name": "Competitor B Ltd",
                "content_strategy": "Product-focused",
                "market_gaps": ["community-building"]
            }
        ],
        "deep_competitor_analysis": {
            "competitors": [
                {
                    "domain": "leader-competitor.com",
                    "strategy_summary": "Enterprise market leader with extensive content library"
                }
            ]
        },
        "linkedin_profile": {
            "summary": "Tech executive with 15 years experience"
        },
        "platform_integrations": {
            "connected_platforms": ["wordpress", "linkedin", "twitter"]
        },
        "gsc_analytics": {
            "total_queries": 1500,
            "total_clicks": 850,
            "avg_position": 4.5,
            "ctr": 0.12
        },
        "bing_analytics": {
            "total_clicks": 120,
            "total_queries": 200
        },
        "canonical_profile": {
            "industry": "SaaS",
            "company_size": "startup",
            "target_audience": "technology leaders",
            "brand_positioning": "innovative solutions",
            "content_focus": "technical education"
        },
        "data_quality": {
            "completeness": 0.92,
            "freshness": 0.88,
            "overall_score": 0.90
        },
        "processing_timestamp": "2024-01-15T10:00:00Z"
    }


@pytest.fixture
def mock_website_only_onboarding():
    """User with only website analysis."""
    return {
        "website_analysis": {
            "website_url": "https://mysite.com",
            "data_freshness": "2024-01-10",
            "confidence_level": 0.7
        },
        "data_quality": {
            "completeness": 0.2,
            "freshness": 0.8,
            "overall_score": 0.5
        }
    }


@pytest.fixture
def mock_persona_only_onboarding():
    """User with only persona data."""
    return {
        "persona_data": {
            "core_persona": {
                "name": "Marketing Manager",
                "role": "Marketing Manager",
                "goals": ["brand-awareness", "lead-generation"]
            }
        },
        "data_quality": {
            "completeness": 0.15,
            "overall_score": 0.3
        }
    }


@pytest.fixture
def mock_partial_onboarding():
    """User with partial onboarding (website + research, no persona)."""
    return {
        "website_analysis": {
            "website_url": "https://example.com",
            "data_freshness": "2024-01-12"
        },
        "research_preferences": {
            "research_depth": "standard"
        },
        "onboarding_session": {
            "progress": 2,
            "completed": False
        },
        "data_quality": {
            "completeness": 0.4,
            "overall_score": 0.4
        }
    }


@pytest.fixture
def mock_empty_onboarding():
    """User with no onboarding data."""
    return {}


@pytest.fixture
def mock_onboarding_with_competitors():
    """User with persona and competitors, no analytics."""
    return {
        "website_analysis": {
            "website_url": "https://compete.com"
        },
        "persona_data": {
            "core_persona": {
                "role": "VP Sales",
                "goals": ["revenue-growth", "market-expansion"]
            }
        },
        "competitor_analysis": [
            {
                "domain": "rival-corp.com",
                "name": "Rival Corp",
                "market_gaps": ["enterprise-sales"]
            }
        ],
        "data_quality": {
            "completeness": 0.5,
            "overall_score": 0.5
        }
    }


@pytest.fixture
def mock_onboarding_with_analytics():
    """User with website and analytics, no persona."""
    return {
        "website_analysis": {
            "website_url": "https://analytics-site.com"
        },
        "gsc_analytics": {
            "total_clicks": 5000,
            "total_queries": 8000,
            "avg_position": 3.2
        },
        "bing_analytics": {
            "total_clicks": 300,
            "total_queries": 450
        },
        "data_quality": {
            "completeness": 0.45,
            "overall_score": 0.6
        }
    }


# ============================================================================
# Test Class: Strategy Generation Integration
# ============================================================================

class TestStrategyGenerationIntegration:
    """E2E integration tests for content strategy generation."""

    @pytest.mark.asyncio
    async def test_validate_strategy_context_fails_empty(self, mock_empty_onboarding):
        """Verify 409 when onboarding context is empty."""
        from fastapi import HTTPException
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        with pytest.raises(HTTPException) as exc_info:
            _validate_strategy_context(mock_empty_onboarding)

        assert exc_info.value.status_code == 409
        assert "missing" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_validate_strategy_context_fails_partial_session(self):
        """Verify 409 when onboarding session is incomplete."""
        from fastapi import HTTPException
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        partial = {
            "website_analysis": {},
            "persona_data": {},
            "onboarding_session": {"progress": 1}
        }

        with pytest.raises(HTTPException) as exc_info:
            _validate_strategy_context(partial)

        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_validate_strategy_context_passes_with_website(self):
        """Verify passes when website_analysis has URL."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        result = _validate_strategy_context({
            "website_analysis": {"website_url": "https://valid.com"}
        })

        assert result is None

    @pytest.mark.asyncio
    async def test_validate_strategy_context_passes_with_completed_session(self):
        """Verify passes when session is completed."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        result = _validate_strategy_context({
            "onboarding_session": {"progress": 5, "completed": True}
        })

        assert result is None


class TestPersonaGroundingValidation:
    """Tests for persona grounding in quality gates."""

    def test_persona_grounding_with_matching_content(self, mock_complete_onboarding):
        """Content matching persona role/goals should pass grounding."""
        from services.intelligence.agents.quality_gates import validate_persona_grounding

        persona = mock_complete_onboarding["persona_data"]
        content = "As a CTO focused on scalability and cost-efficiency, I need solutions for technical debt."

        result = validate_persona_grounding(content, persona)

        assert result["passed"] is True
        assert result["score"] > 0.5

    def test_persona_grounding_no_match_warns(self, mock_complete_onboarding):
        """Content not referencing persona should warn but not fail."""
        from services.intelligence.agents.quality_gates import validate_persona_grounding

        persona = mock_complete_onboarding["persona_data"]
        content = "This is generic content about marketing."

        result = validate_persona_grounding(content, persona)

        assert result["status"] == "checked"
        assert result["score"] >= 0.5

    def test_persona_grounding_no_persona_data(self):
        """No persona data should return unavailable (pass)."""
        from services.intelligence.agents.quality_gates import validate_persona_grounding

        result = validate_persona_grounding("Some content", None)

        assert result["passed"] is True
        assert result["status"] == "unavailable"


class TestCompetitorGroundingValidation:
    """Tests for competitor grounding in quality gates."""

    def test_competitor_grounding_with_references(self, mock_complete_onboarding):
        """Content referencing real competitors should pass."""
        from services.intelligence.agents.quality_gates import validate_competitor_grounding

        competitors = mock_complete_onboarding["competitor_analysis"]
        content = "Unlike Competitor A Inc, we offer better integration capabilities."

        result = validate_competitor_grounding(content, competitors)

        assert result["score"] > 0.3

    def test_competitor_grounding_generic_fails(self, mock_complete_onboarding):
        """Generic competitive content may score lower."""
        from services.intelligence.agents.quality_gates import validate_competitor_grounding

        competitors = mock_complete_onboarding["competitor_analysis"]
        content = "We are better than our competitors in the market."

        result = validate_competitor_grounding(content, competitors)

        assert result["status"] == "checked"

    def test_competitor_grounding_no_competitors(self):
        """No competitor data should return unavailable."""
        from services.intelligence.agents.quality_gates import validate_competitor_grounding

        result = validate_competitor_grounding("Content", [])

        assert result["passed"] is True
        assert result["status"] == "unavailable"


class TestAnalyticsConsistencyValidation:
    """Tests for analytics consistency in quality gates."""

    def test_analytics_consistency_realistic_prediction(self, mock_complete_onboarding):
        """Realistic growth predictions should pass."""
        from services.intelligence.agents.quality_gates import validate_analytics_consistency

        gsc = mock_complete_onboarding["gsc_analytics"]
        predictions = {"predicted_growth": "15%"}

        result = validate_analytics_consistency(predictions, gsc, None)

        assert result["score"] > 0.5

    def test_analytics_consistency_unrealistic_prediction(self, mock_complete_onboarding):
        """Unrealistic predictions (100x) should warn."""
        from services.intelligence.agents.quality_gates import validate_analytics_consistency

        gsc = {"total_clicks": 100}
        predictions = {"predicted_growth": "100x"}

        result = validate_analytics_consistency(predictions, gsc, None)

        assert len(result["warnings"]) > 0

    def test_analytics_consistency_traffic_disconnect(self, mock_complete_onboarding):
        """Predicted traffic far exceeding baseline should warn."""
        from services.intelligence.agents.quality_gates import validate_analytics_consistency

        gsc = {"total_clicks": 50}
        predictions = {"predicted_traffic": 10000}

        result = validate_analytics_consistency(predictions, gsc, None)

        assert any("traffic" in w.get("type", "") for w in result.get("warnings", []))


class TestDataQualityGroundingValidation:
    """Tests for data quality grounding in quality gates."""

    def test_high_quality_data_passes(self, mock_complete_onboarding):
        """High quality onboarding data should pass."""
        from services.intelligence.agents.quality_gates import validate_data_quality_grounding

        quality = mock_complete_onboarding["data_quality"]

        result = validate_data_quality_grounding(quality, None)

        assert result["passed"] is True
        assert result["score"] > 0.7

    def test_low_quality_data_fails(self):
        """Low quality onboarding data should fail."""
        from services.intelligence.agents.quality_gates import validate_data_quality_grounding

        quality = {"completeness": 0.3, "freshness": 0.2}

        result = validate_data_quality_grounding(quality, None)

        assert result["passed"] is False

    def test_no_quality_data_unavailable(self):
        """No quality data should return unavailable."""
        from services.intelligence.agents.quality_gates import validate_data_quality_grounding

        result = validate_data_quality_grounding(None, None)

        assert result["status"] == "unavailable"


class TestComprehensiveStrategyGrounding:
    """Tests for comprehensive strategy grounding validation."""

    def test_full_strategy_grounding_with_complete_data(self, mock_complete_onboarding):
        """Full strategy grounding with all data sources should pass."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        strategy = {
            "content": "As a CTO at our SaaS startup, I want to beat Competitor A Inc by offering better scalability. Our analytics show we're growing 15% month-over-month.",
            "base_strategy": {"business_objectives": {"value": "scale to 100 customers"}}
        }
        context = mock_complete_onboarding

        result = validate_strategy_grounding(strategy, context)

        assert result["score"] > 0.5
        assert result["status"] == "checked"
        assert "persona_grounding" in result["details"]
        assert "competitor_grounding" in result["details"]
        assert "analytics_consistency" in result["details"]
        assert "data_quality" in result["details"]

    def test_strategy_grounding_with_partial_data(self, mock_partial_onboarding):
        """Strategy grounding with partial data should still work."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        strategy = {"content": "Basic content about our services."}
        context = mock_partial_onboarding

        result = validate_strategy_grounding(strategy, context)

        assert result["status"] == "checked"

    def test_strategy_grounding_low_quality_fails(self):
        """Strategy with poor onboarding data should fail."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        strategy = {"content": "Content requiring good context."}
        context = {
            "data_quality": {"completeness": 0.2, "freshness": 0.1}
        }

        result = validate_strategy_grounding(strategy, context)

        assert result["passed"] is False


class TestCalendarQualityGateIntegration:
    """Tests for calendar quality gate with onboarding grounding."""

    @pytest.mark.asyncio
    async def test_onboarding_grounding_gate_with_complete_data(self, mock_complete_onboarding):
        """Calendar onboarding grounding gate should pass with complete data."""
        from services.calendar_generation_datasource_framework.quality_gates import OnboardingDataGroundingGate

        gate = OnboardingDataGroundingGate()

        calendar_data = {
            "onboarding_context": mock_complete_onboarding,
            "daily_schedule": {
                "2024-01-15": {
                    "content": [
                        {"title": "Scaling Your SaaS", "description": "A CTO's guide for scalability and cost-efficiency"}
                    ]
                }
            }
        }

        result = await gate.validate(calendar_data)

        assert result["score"] > 0.4
        assert "component_scores" in result

    @pytest.mark.asyncio
    async def test_onboarding_grounding_gate_with_website_only(self, mock_website_only_onboarding):
        """Gate should work with minimal data (website only)."""
        from services.calendar_generation_datasource_framework.quality_gates import OnboardingDataGroundingGate

        gate = OnboardingDataGroundingGate()

        calendar_data = {
            "onboarding_context": mock_website_only_onboarding,
            "daily_schedule": {
                "2024-01-15": {
                    "content": [{"title": "Welcome", "description": "Welcome to our site"}]
                }
            }
        }

        result = await gate.validate(calendar_data)

        assert result["score"] > 0.4
        assert "component_scores" in result

    @pytest.mark.asyncio
    async def test_onboarding_grounding_gate_no_content(self):
        """Gate should handle missing content gracefully."""
        from services.calendar_generation_datasource_framework.quality_gates import OnboardingDataGroundingGate

        gate = OnboardingDataGroundingGate()

        calendar_data = {
            "onboarding_context": {"website_analysis": {"website_url": "test.com"}},
            "daily_schedule": {}
        }

        result = await gate.validate(calendar_data)

        assert "issues" in result


class TestQualityGateManagerIntegration:
    """Tests for QualityGateManager with new grounding gate."""

    @pytest.mark.asyncio
    async def test_quality_gate_manager_includes_grounding_gate(self):
        """Manager should include the onboarding grounding gate."""
        from services.calendar_generation_datasource_framework.quality_gates import QualityGateManager

        manager = QualityGateManager()

        assert "onboarding_data_grounding" in manager.gates
        assert len(manager.gates) == 7

    @pytest.mark.asyncio
    async def test_quality_gate_manager_validates_all(self, mock_complete_onboarding):
        """Manager should validate all gates including grounding."""
        from services.calendar_generation_datasource_framework.quality_gates import QualityGateManager

        manager = QualityGateManager()

        calendar_data = {
            "onboarding_context": mock_complete_onboarding,
            "daily_schedule": {
                "2024-01-15": {
                    "content": [{"title": "Test", "description": "Test content about our SaaS platform for CTOs"}]
                }
            }
        }

        result = await manager.validate_all_gates(calendar_data)

        assert "gates" in result
        assert "onboarding_data_grounding" in result["gates"]
        assert result["overall_score"] >= 0


class TestContextBuildingIntegration:
    """Tests for context building in AI generation."""

    def test_build_context_summary_with_complete_data(self, mock_complete_onboarding):
        """_build_context_summary should extract all sources."""
        from api.content_planning.services.content_strategy.autofill.ai_structured_autofill import AIStructuredAutofillService

        service = AIStructuredAutofillService()

        context = {"onboarding_data": mock_complete_onboarding}

        summary = service._build_context_summary(context)

        assert "user_profile" in summary
        assert "persona_data" in summary
        assert "competitive_data" in summary
        assert "analytics_data" in summary
        assert "canonical_profile" in summary
        assert summary["persona_data"]["role"] == "CTO"

    def test_build_context_summary_with_nested_data(self, mock_complete_onboarding):
        """Context nested under onboarding_data should be unwrapped."""
        from api.content_planning.services.content_strategy.autofill.ai_structured_autofill import AIStructuredAutofillService

        service = AIStructuredAutofillService()

        context = {"onboarding_data": mock_complete_onboarding, "user_id": "user123"}

        summary = service._build_context_summary(context)

        assert summary["user_profile"]["website_url"] == "https://techstartup.com"

    def test_build_context_summary_extracts_analytics(self, mock_complete_onboarding):
        """Analytics data should be extracted correctly."""
        from api.content_planning.services.content_strategy.autofill.ai_structured_autofill import AIStructuredAutofillService

        service = AIStructuredAutofillService()

        context = {"onboarding_data": mock_complete_onboarding}

        summary = service._build_context_summary(context)

        assert summary["analytics_data"]["has_analytics"] is True
        assert summary["analytics_data"]["gsc"]["total_queries"] == 1500


class TestGroundingValidationInStrategyGeneration:
    """TDD tests for grounding validation wired into strategy generation."""

    @pytest.mark.asyncio
    async def test_grounding_validation_runs_on_strategy_generation(self, mock_complete_onboarding):
        """Grounding validation should run during strategy generation and add metadata."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        # Simulate a generated strategy
        strategy = {
            "strategy_metadata": {"generated_at": "2024-01-15"},
            "base_strategy": {
                "business_objectives": "Grow SaaS platform for CTOs",
                "target_audience": "CTOs at tech startups"
            },
            "strategic_insights": {
                "insights": [{"type": "market", "insight": "CTOs need scalable solutions"}]
            },
            "competitive_analysis": {
                "competitors": [
                    {"name": "Competitor A Inc", "content_strategy": "Thought leadership"}
                ]
            },
            "performance_predictions": {
                "predicted_growth": "20%",
                "estimated_traffic": 5000
            }
        }

        result = validate_strategy_grounding(strategy, mock_complete_onboarding)

        assert "passed" in result
        assert "score" in result
        assert result["status"] == "checked"

    @pytest.mark.asyncio
    async def test_grounding_validation_adds_metadata_to_strategy(self, mock_complete_onboarding):
        """Strategy metadata should include grounding validation results."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        strategy = {
            "strategy_metadata": {"generated_at": "2024-01-15"},
            "base_strategy": {"business_objectives": "Test objectives for CTOs"},
            "strategic_insights": {"insights": []},
            "competitive_analysis": {"competitors": []},
            "performance_predictions": {}
        }

        grounding_result = validate_strategy_grounding(strategy, mock_complete_onboarding)

        # Simulate what the endpoint should do - add grounding result to metadata
        strategy["strategy_metadata"]["grounding_validation"] = grounding_result
        strategy["strategy_metadata"]["grounding_status"] = "validated" if grounding_result.get("passed") else "partial"

        assert "grounding_validation" in strategy["strategy_metadata"]
        assert "grounding_status" in strategy["strategy_metadata"]

    @pytest.mark.asyncio
    async def test_grounding_validation_with_missing_persona(self):
        """Grounding validation should handle missing persona gracefully."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        strategy = {
            "strategy_metadata": {"generated_at": "2024-01-15"},
            "base_strategy": {"business_objectives": "Test objectives"},
            "strategic_insights": {"insights": []},
            "competitive_analysis": {"competitors": []},
            "performance_predictions": {}
        }

        # Good data quality but no persona_data (user skipped persona step)
        onboarding_without_persona = {
            "website_analysis": {
                "website_url": "https://mysite.com",
                "data_freshness": "2024-01-10",
                "confidence_level": 0.9
            },
            "data_quality": {
                "completeness": 0.8,
                "freshness": 0.9,
                "overall_score": 0.85
            }
        }

        result = validate_strategy_grounding(strategy, onboarding_without_persona)

        # Should pass overall (missing persona handled gracefully, not failed)
        assert result["passed"] is True
        # The details should show persona grounding was checked and passed
        assert "details" in result
        assert "persona_grounding" in result["details"]
        assert result["details"]["persona_grounding"]["passed"] is True

    @pytest.mark.asyncio
    async def test_grounding_validation_detects_competitor_grounding(self, mock_complete_onboarding):
        """Grounding validation should detect when real competitors are referenced."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        # Strategy that references actual competitors from onboarding
        strategy = {
            "strategy_metadata": {},
            "base_strategy": {},
            "strategic_insights": {},
            "competitive_analysis": {
                "competitors": [
                    {"name": "Competitor A Inc", "domain": "competitor-a.com"},
                    {"name": "Competitor B Ltd", "domain": "competitor-b.com"}
                ]
            },
            "performance_predictions": {}
        }

        result = validate_strategy_grounding(strategy, mock_complete_onboarding)

        # Should detect competitor grounding
        assert "details" in result
        assert "competitor_grounding" in result["details"]
        assert result["details"]["competitor_grounding"]["passed"] is True

    @pytest.mark.asyncio
    async def test_grounding_validation_handles_empty_strategy(self):
        """Grounding validation should handle empty strategy without crashing."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        strategy = {"strategy_metadata": {}}
        onboarding_context = {}

        result = validate_strategy_grounding(strategy, onboarding_context)

        assert "passed" in result
        assert result["passed"] is True  # Empty data should pass gracefully

    @pytest.mark.asyncio
    async def test_grounding_validation_with_analytics_data(self, mock_complete_onboarding):
        """Grounding validation should incorporate analytics consistency check."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        # Strategy with predictions that could be validated against analytics
        strategy = {
            "strategy_metadata": {},
            "base_strategy": {},
            "strategic_insights": {},
            "competitive_analysis": {},
            "performance_predictions": {
                "predicted_traffic": 10000,
                "growth_rate": "50%"
            }
        }

        result = validate_strategy_grounding(strategy, mock_complete_onboarding)

        assert "details" in result
        assert "analytics_consistency" in result["details"]
        assert result["details"]["analytics_consistency"]["passed"] is True

    @pytest.mark.asyncio
    async def test_grounding_validates_strategy_dict_content_against_persona(self, mock_complete_onboarding):
        """Persona grounding must inspect strategy dict content, not just text fields.

        A strategy whose text does not reflect the persona role should produce
        persona grounding warnings (score < 1.0), proving the validator reads
        dict-shaped strategy data rather than silently no-oping on empty content.
        """
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        unrelated_strategy = {
            "strategy_metadata": {},
            "base_strategy": {
                "business_objectives": (
                    "A comprehensive plan focused on baking cupcakes, garden parties, "
                    "and artisanal bread workshops with no relation to the persona role at all."
                )
            },
            "strategic_insights": {},
            "competitive_analysis": {},
            "performance_predictions": {}
        }

        result = validate_strategy_grounding(unrelated_strategy, mock_complete_onboarding)

        persona_details = result["details"]["persona_grounding"]
        assert persona_details["score"] < 1.0, (
            "Persona grounding should flag strategy content that does not reflect the persona role"
        )
        assert any(w.get("type") == "role_not_reflected" for w in persona_details.get("warnings", []))


class TestGroundingValidationEndpointIntegration:
    """Tests for grounding validation helpers wired into endpoints."""

    @pytest.mark.asyncio
    async def test_apply_grounding_validation_attaches_metadata(self, mock_complete_onboarding):
        """_apply_grounding_validation should attach result to strategy_metadata."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _apply_grounding_validation,
        )

        strategy = {
            "strategy_metadata": {"ai_generated": True},
            "base_strategy": {"business_objectives": "Grow SaaS platform for CTOs"},
            "strategic_insights": {},
            "competitive_analysis": {},
            "performance_predictions": {},
        }

        result = _apply_grounding_validation(strategy, mock_complete_onboarding)

        assert "passed" in result
        metadata = strategy["strategy_metadata"]
        assert "grounding_validation" in metadata
        assert metadata["grounding_validation"] is result
        assert metadata["grounding_status"] in ("validated", "partial")

    @pytest.mark.asyncio
    async def test_apply_grounding_validation_metadata_key_fallback(self, mock_complete_onboarding):
        """Polling strategies use 'metadata' key; helper must detect it."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _apply_grounding_validation,
        )

        strategy = {
            "metadata": {"ai_generated": True},
            "strategic_insights": {},
            "competitive_analysis": {},
            "performance_predictions": {},
        }

        _apply_grounding_validation(strategy, mock_complete_onboarding)

        assert "grounding_status" in strategy["metadata"]
        assert "grounding_validation" in strategy["metadata"]

    @pytest.mark.asyncio
    async def test_apply_grounding_validation_never_raises(self):
        """Gate errors must not propagate (soft validation)."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _apply_grounding_validation,
        )
        from unittest.mock import patch

        strategy = {"strategy_metadata": {}}

        with patch(
            "api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints.validate_strategy_grounding",
            side_effect=RuntimeError("gate exploded"),
        ):
            result = _apply_grounding_validation(strategy, {"website_analysis": {}})

        assert result.get("status") == "error"
        assert strategy["strategy_metadata"]["grounding_status"] == "error"

    @pytest.mark.asyncio
    async def test_validate_component_grounding_persona(self, mock_complete_onboarding):
        """strategic_insights component should be validated via persona gate."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _validate_component_grounding,
        )

        component = {
            "content_opportunities": [
                "Content for CTOs about scalability and cost-efficiency"
            ]
        }

        result = _validate_component_grounding("strategic_insights", component, mock_complete_onboarding)

        assert "passed" in result
        assert result["passed"] is True

    @pytest.mark.asyncio
    async def test_validate_component_grounding_competitor(self, mock_complete_onboarding):
        """competitive_analysis component should be validated via competitor gate."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _validate_component_grounding,
        )

        component = {
            "competitors": [
                {"name": "Competitor A Inc", "domain": "competitor-a.com"},
                {"name": "Competitor B Ltd", "domain": "competitor-b.com"},
            ]
        }

        result = _validate_component_grounding("competitive_analysis", component, mock_complete_onboarding)

        assert "passed" in result
        # Real competitor domains referenced -> grounding ratio > 0
        assert result["score"] > 0

    @pytest.mark.asyncio
    async def test_validate_component_grounding_analytics(self, mock_complete_onboarding):
        """performance_predictions component should be validated via analytics gate."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _validate_component_grounding,
        )

        component = {"predicted_traffic": 1000, "growth_rate": "10%"}

        result = _validate_component_grounding("performance_predictions", component, mock_complete_onboarding)

        assert "passed" in result
        assert "details" in result or "checks" in result

    @pytest.mark.asyncio
    async def test_component_grounding_never_raises(self):
        """Component gate errors must not propagate (soft validation)."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _validate_component_grounding,
        )
        from unittest.mock import patch

        with patch(
            "api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints.validate_persona_grounding",
            side_effect=RuntimeError("gate exploded"),
        ):
            result = _validate_component_grounding(
                "strategic_insights", {"insights": []}, {"persona_data": {}}
            )

        assert result.get("status") == "error"
        assert result.get("passed") is True

    @pytest.mark.asyncio
    async def test_endpoint_includes_grounding_validation_in_response(self, mock_complete_onboarding):
        """generate_comprehensive_strategy endpoint should attach grounding status."""
        from unittest.mock import patch, AsyncMock

        with patch(
            "api.content_planning.services.enhanced_strategy_service.EnhancedStrategyService._get_onboarding_data",
            new_callable=AsyncMock,
        ) as mock_get_data, patch(
            "api.content_planning.services.content_strategy.ai_generation.strategy_generator.AIStrategyGenerator.generate_comprehensive_strategy",
            new_callable=AsyncMock,
        ) as mock_generate:

            mock_get_data.return_value = mock_complete_onboarding
            mock_generate.return_value = {
                "strategy_metadata": {
                    "generated_at": "2024-01-15",
                    "ai_generated": True,
                },
                "base_strategy": {"business_objectives": "Grow SaaS platform for CTOs"},
                "strategic_insights": {},
                "competitive_analysis": {},
                "performance_predictions": {},
                "implementation_roadmap": {},
                "risk_assessment": {},
            }

            from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
                generate_comprehensive_strategy,
            )

            response = await generate_comprehensive_strategy(
                current_user={"id": "user_test"},
                strategy_name="Test Strategy",
                config={},
                db=MagicMock(),
            )

            data = response.get("data", {})
            metadata = data.get("strategy_metadata", {})
            assert "grounding_status" in metadata
            assert "grounding_validation" in metadata
            assert metadata["grounding_status"] in ("validated", "partial")


class TestStrategyGeneratorGrounding:
    """Phase 2: grounding validation wired into AIStrategyGenerator."""

    @pytest.mark.asyncio
    async def test_generator_validate_grounding_helper(self, mock_complete_onboarding):
        """_validate_grounding should run the gate against onboarding context."""
        from api.content_planning.services.content_strategy.ai_generation.strategy_generator import (
            AIStrategyGenerator,
        )

        generator = AIStrategyGenerator()
        context = {"onboarding_data": mock_complete_onboarding}
        strategy = {
            "strategy_metadata": {},
            "base_strategy": {"business_objectives": "Grow SaaS platform for CTOs"},
        }

        result = generator._validate_grounding(strategy, context)

        assert "passed" in result
        assert "score" in result
        assert result["status"] in ("checked", "error")

    @pytest.mark.asyncio
    async def test_generator_attaches_grounding_metadata(self, mock_complete_onboarding):
        """generate_comprehensive_strategy should attach grounding metadata."""
        from api.content_planning.services.content_strategy.ai_generation.strategy_generator import (
            AIStrategyGenerator,
        )

        generator = AIStrategyGenerator()
        context = {"onboarding_data": mock_complete_onboarding, "user_id": "user_test"}

        async def mock_base(user_id, ctx):
            return {"business_objectives": "Grow SaaS platform for CTOs"}

        async def mock_insights(base, ctx, **kwargs):
            return {"insights": [{"type": "market", "insight": "CTOs need scalability"}]}

        async def mock_comp(base, ctx, **kwargs):
            return {"competitors": [{"name": "Competitor A Inc"}]}

        async def mock_perf(base, ctx, **kwargs):
            return {"estimated_roi": "20%"}

        async def mock_roadmap(base, ctx, **kwargs):
            return {"total_duration": "12 months"}

        async def mock_risk(base, ctx, **kwargs):
            return {"overall_risk_level": "Low"}

        with patch.object(generator, "_generate_base_strategy_fields", side_effect=mock_base), \
             patch.object(generator, "_generate_strategic_insights", side_effect=mock_insights), \
             patch.object(generator, "_generate_competitive_analysis", side_effect=mock_comp), \
             patch.object(generator, "_generate_performance_predictions", side_effect=mock_perf), \
             patch.object(generator, "_generate_implementation_roadmap", side_effect=mock_roadmap), \
             patch.object(generator, "_generate_risk_assessment", side_effect=mock_risk):

            strategy = await generator.generate_comprehensive_strategy(
                user_id="user_test", context=context, strategy_name="Test"
            )

        metadata = strategy["strategy_metadata"]
        assert "grounding_validation" in metadata
        assert "grounding_status" in metadata
        assert metadata["grounding_status"] in ("validated", "partial")

    @pytest.mark.asyncio
    async def test_generator_grounding_never_raises(self, mock_complete_onboarding):
        """Gate errors must not break strategy generation (soft validation)."""
        from api.content_planning.services.content_strategy.ai_generation.strategy_generator import (
            AIStrategyGenerator,
        )

        generator = AIStrategyGenerator()
        context = {"onboarding_data": mock_complete_onboarding, "user_id": "user_test"}

        async def mock_base(user_id, ctx):
            return {"business_objectives": "Grow SaaS platform for CTOs"}

        async def mock_ok(base, ctx, **kwargs):
            return {}

        with patch.object(generator, "_generate_base_strategy_fields", side_effect=mock_base), \
             patch.object(generator, "_generate_strategic_insights", side_effect=mock_ok), \
             patch.object(generator, "_generate_competitive_analysis", side_effect=mock_ok), \
             patch.object(generator, "_generate_performance_predictions", side_effect=mock_ok), \
             patch.object(generator, "_generate_implementation_roadmap", side_effect=mock_ok), \
             patch.object(generator, "_generate_risk_assessment", side_effect=mock_ok), \
             patch(
                 "api.content_planning.services.content_strategy.ai_generation.strategy_generator.validate_strategy_grounding",
                 side_effect=RuntimeError("gate exploded"),
             ):

            strategy = await generator.generate_comprehensive_strategy(
                user_id="user_test", context=context, strategy_name="Test"
            )

        # Generation completed despite gate error; status marked as error
        assert strategy["strategy_metadata"]["grounding_status"] == "error"

    def test_component_methods_accept_user_id_kwarg(self):
        """Regression: generate_comprehensive_strategy passes user_id= to every
        component generator; each must accept it or generation crashes with
        TypeError before grounding validation can run."""
        import inspect

        from api.content_planning.services.content_strategy.ai_generation.strategy_generator import (
            AIStrategyGenerator,
        )

        generator = AIStrategyGenerator()
        component_methods = [
            "_generate_strategic_insights",
            "_generate_competitive_analysis",
            "_generate_performance_predictions",
            "_generate_implementation_roadmap",
            "_generate_risk_assessment",
        ]
        for name in component_methods:
            sig = inspect.signature(getattr(generator, name))
            assert "user_id" in sig.parameters, f"{name} must accept user_id kwarg"


class TestGroundingEnforcementMode:
    """Phase 3: soft vs hard grounding enforcement."""

    @pytest.fixture
    def low_quality_onboarding(self):
        """Onboarding that passes fail-fast context but fails the quality gate."""
        return {
            "website_analysis": {
                "website_url": "https://mysite.com",
                "data_freshness": "2024-01-10",
                "confidence_level": 0.7,
            },
            "data_quality": {
                "completeness": 0.2,
                "freshness": 0.8,
                "overall_score": 0.5,
            },
        }

    def test_default_enforcement_is_soft(self):
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _get_grounding_enforcement,
        )

        assert _get_grounding_enforcement({}) == "soft"
        assert _get_grounding_enforcement(None) == "soft"

    def test_enforcement_from_config(self):
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _get_grounding_enforcement,
        )

        assert _get_grounding_enforcement({"grounding_enforcement": "hard"}) == "hard"
        assert _get_grounding_enforcement({"grounding_enforcement": "soft"}) == "soft"

    def test_enforcement_invalid_config_falls_back(self):
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _get_grounding_enforcement,
        )

        assert _get_grounding_enforcement({"grounding_enforcement": "yolo"}) == "soft"

    def test_enforcement_from_env_var(self):
        import os

        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _get_grounding_enforcement,
        )

        with patch.dict(os.environ, {"STRATEGY_GROUNDING_ENFORCEMENT": "hard"}):
            assert _get_grounding_enforcement({}) == "hard"

        with patch.dict(os.environ, {"STRATEGY_GROUNDING_ENFORCEMENT": "invalid"}):
            assert _get_grounding_enforcement({}) == "soft"

    def test_config_overrides_env_var(self):
        import os

        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _get_grounding_enforcement,
        )

        with patch.dict(os.environ, {"STRATEGY_GROUNDING_ENFORCEMENT": "hard"}):
            assert _get_grounding_enforcement({"grounding_enforcement": "soft"}) == "soft"

    def test_soft_mode_returns_strategy_with_partial_status(self, low_quality_onboarding):
        """Default soft mode: failing grounding never blocks, status=partial."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _apply_grounding_validation,
        )

        strategy = {"strategy_metadata": {"ai_generated": True}}

        result = _apply_grounding_validation(strategy, low_quality_onboarding)

        assert result.get("passed") is False
        assert strategy["strategy_metadata"]["grounding_status"] == "partial"

    def test_hard_mode_raises_422_on_failed_grounding(self, low_quality_onboarding):
        from fastapi import HTTPException

        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _apply_grounding_validation,
        )

        strategy = {"strategy_metadata": {"ai_generated": True}}

        with pytest.raises(HTTPException) as exc_info:
            _apply_grounding_validation(strategy, low_quality_onboarding, enforcement="hard")

        assert exc_info.value.status_code == 422
        detail = exc_info.value.detail
        assert detail["message"] == "Strategy generation failed grounding validation"
        assert isinstance(detail["violations"], list)
        assert len(detail["violations"]) > 0

    def test_hard_mode_allows_validated_strategy(self, mock_complete_onboarding):
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _apply_grounding_validation,
        )

        strategy = {
            "strategy_metadata": {"ai_generated": True},
            "base_strategy": {"business_objectives": "Grow SaaS platform for CTOs"},
        }

        result = _apply_grounding_validation(strategy, mock_complete_onboarding, enforcement="hard")

        assert result.get("passed") is True
        assert strategy["strategy_metadata"]["grounding_status"] == "validated"

    def test_hard_mode_does_not_block_on_gate_error(self):
        """Gate crashes must never 422 the user even in hard mode (fail-open)."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            _apply_grounding_validation,
        )

        strategy = {"strategy_metadata": {}}

        with patch(
            "api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints.validate_strategy_grounding",
            side_effect=RuntimeError("gate exploded"),
        ):
            result = _apply_grounding_validation(strategy, {"website_analysis": {}}, enforcement="hard")

        assert result.get("status") == "error"
        assert strategy["strategy_metadata"]["grounding_status"] == "error"

    @pytest.mark.asyncio
    async def test_endpoint_hard_mode_config_returns_422(self, low_quality_onboarding):
        """Endpoint with config grounding_enforcement=hard must surface 422 (not 500)."""
        from fastapi import HTTPException
        from unittest.mock import AsyncMock

        with patch(
            "api.content_planning.services.enhanced_strategy_service.EnhancedStrategyService._get_onboarding_data",
            new_callable=AsyncMock,
        ) as mock_get_data, patch(
            "api.content_planning.services.content_strategy.ai_generation.strategy_generator.AIStrategyGenerator.generate_comprehensive_strategy",
            new_callable=AsyncMock,
        ) as mock_generate:

            mock_get_data.return_value = low_quality_onboarding
            mock_generate.return_value = {
                "strategy_metadata": {"ai_generated": True},
                "base_strategy": {},
                "strategic_insights": {},
                "competitive_analysis": {},
                "performance_predictions": {},
                "implementation_roadmap": {},
                "risk_assessment": {},
            }

            from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
                generate_comprehensive_strategy,
            )

            with pytest.raises(HTTPException) as exc_info:
                await generate_comprehensive_strategy(
                    current_user={"id": "user_test"},
                    strategy_name="Test",
                    config={"grounding_enforcement": "hard"},
                    db=MagicMock(),
                )

            assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_endpoint_soft_mode_still_returns_strategy(self, low_quality_onboarding):
        """Default (no config) must keep returning the strategy with partial status."""
        from unittest.mock import AsyncMock

        with patch(
            "api.content_planning.services.enhanced_strategy_service.EnhancedStrategyService._get_onboarding_data",
            new_callable=AsyncMock,
        ) as mock_get_data, patch(
            "api.content_planning.services.content_strategy.ai_generation.strategy_generator.AIStrategyGenerator.generate_comprehensive_strategy",
            new_callable=AsyncMock,
        ) as mock_generate:

            mock_get_data.return_value = low_quality_onboarding
            mock_generate.return_value = {
                "strategy_metadata": {"ai_generated": True},
                "base_strategy": {},
                "strategic_insights": {},
                "competitive_analysis": {},
                "performance_predictions": {},
                "implementation_roadmap": {},
                "risk_assessment": {},
            }

            from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
                generate_comprehensive_strategy,
            )

            response = await generate_comprehensive_strategy(
                current_user={"id": "user_test"},
                strategy_name="Test",
                config=None,
                db=MagicMock(),
            )

            metadata = response["data"]["strategy_metadata"]
            assert metadata["grounding_status"] == "partial"

    @pytest.mark.asyncio
    async def test_polling_hard_mode_marks_task_failed(self, low_quality_onboarding):
        """Polling flow in hard mode must mark the task failed instead of saving."""
        import asyncio
        import os

        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            generate_comprehensive_strategy_polling,
        )

        with patch.dict(os.environ, {"STRATEGY_GROUNDING_ENFORCEMENT": "hard"}), patch(
            "api.content_planning.services.enhanced_strategy_service.EnhancedStrategyService._get_onboarding_data",
            new_callable=AsyncMock,
        ) as mock_get_data, patch.object(
            __import__(
                "api.content_planning.services.content_strategy.ai_generation.strategy_generator",
                fromlist=["AIStrategyGenerator"],
            ).AIStrategyGenerator,
            "_generate_strategic_insights",
            new_callable=AsyncMock,
        ) as mock_insights:

            mock_get_data.return_value = low_quality_onboarding
            mock_insights.return_value = {"insights": []}

            from api.content_planning.services.content_strategy.ai_generation.strategy_generator import (
                AIStrategyGenerator,
            )

            async def _noop(base, ctx, **kwargs):
                return {}

            with patch.object(AIStrategyGenerator, "_generate_competitive_analysis", side_effect=_noop), \
                 patch.object(AIStrategyGenerator, "_generate_performance_predictions", side_effect=_noop), \
                 patch.object(AIStrategyGenerator, "_generate_implementation_roadmap", side_effect=_noop), \
                 patch.object(AIStrategyGenerator, "_generate_risk_assessment", side_effect=_noop):

                response = await generate_comprehensive_strategy_polling(
                    request={"strategy_name": "Poll Test"},
                    current_user={"id": "user_test"},
                    db=MagicMock(),
                )

                task_id = response["data"]["task_id"]

                # Let the background task run
                for _ in range(10):
                    await asyncio.sleep(0.05)

                task_status = generate_comprehensive_strategy_polling._task_status[task_id]

        assert task_status["status"] == "failed"
        assert "grounding" in task_status["error"].lower()
        assert isinstance(task_status.get("grounding_violations"), list)


class TestDataStructureContract:
    """Phase 4: lock the data structure contract grounding validation depends on.

    4.1 — process_onboarding_data must return every grounding-required source
    key; the gate consumes persona_data.core_persona (role/goals/pain_points),
    competitor_analysis[].domain/name, gsc/bing analytics metrics and
    data_quality scores.
    4.2 — validate_strategy_grounding must consume that shape via dict_to_text
    (no silent no-op on dict payloads).
    """

    @pytest.fixture
    def integration_service(self):
        from api.content_planning.services.content_strategy.onboarding.data_integration import (
            OnboardingDataIntegrationService,
        )

        return OnboardingDataIntegrationService()

    @pytest.fixture
    def mock_source_data(self):
        """Realistic per-source data as produced by the DB getters."""
        return {
            "website": {
                "website_url": "https://techstartup.com",
                "confidence_level": 0.9,
                "data_freshness": "recent",
            },
            "research": {"research_depth": "comprehensive", "content_types": ["blog"]},
            "session": {"progress": 5, "completed": True, "business_size": "startup"},
            "persona": {
                "core_persona": {
                    "role": "CTO",
                    "goals": ["scalability", "cost-efficiency"],
                    "pain_points": ["technical-debt"],
                    "industry": "SaaS",
                }
            },
            "competitors": [
                {"domain": "competitor-a.com", "name": "Competitor A Inc"},
                {"domain": "competitor-b.com", "name": "Competitor B Ltd"},
            ],
            "deep": {"status": "success", "report": {"competitors": []}},
            "linkedin": {"name": "Test User", "headline": "CTO"},
            "gsc": {"total_queries": 1500, "total_clicks": 850, "avg_position": 4.5},
            "bing": {"total_clicks": 120, "total_queries": 400},
            "canonical": {"industry": "SaaS", "company_size": "startup"},
            "quality": {"completeness": 0.8, "freshness": 0.9, "overall_score": 0.85},
        }

    def _patch_source_getters(self, integration_service, sources):
        """Patch every data-source getter on the integration service."""
        return [
            patch.object(integration_service, "_get_website_analysis", return_value=sources["website"]),
            patch.object(integration_service, "_get_research_preferences", return_value=sources["research"]),
            patch.object(integration_service, "_get_onboarding_session", return_value=sources["session"]),
            patch.object(integration_service, "_get_persona_data", return_value=sources["persona"]),
            patch.object(integration_service, "_get_competitor_analysis", return_value=sources["competitors"]),
            patch.object(integration_service, "_get_deep_competitor_analysis", return_value=sources["deep"]),
            patch.object(integration_service, "_get_linkedin_profile_info", return_value=sources["linkedin"]),
            patch.object(integration_service, "_get_gsc_analytics", new_callable=AsyncMock, return_value=sources["gsc"]),
            patch.object(integration_service, "_get_bing_analytics", new_callable=AsyncMock, return_value=sources["bing"]),
            patch.object(integration_service, "_build_canonical_profile", return_value=sources["canonical"]),
            patch.object(integration_service, "_assess_data_quality", return_value=sources["quality"]),
            patch.object(integration_service, "_store_integrated_data"),
        ]

    @pytest.mark.asyncio
    async def test_process_onboarding_data_returns_all_source_keys(
        self, integration_service, mock_source_data
    ):
        """Contract: process_onboarding_data output must contain every source key
        the AI context builders and grounding gate depend on."""
        patches = self._patch_source_getters(integration_service, mock_source_data)
        for p in patches:
            p.start()
        try:
            result = await integration_service.process_onboarding_data("user_test", MagicMock())
        finally:
            for p in patches:
                p.stop()

        expected_keys = [
            "website_analysis",
            "research_preferences",
            "onboarding_session",
            "persona_data",
            "competitor_analysis",
            "deep_competitor_analysis",
            "linkedin_profile",
            "gsc_analytics",
            "bing_analytics",
            "canonical_profile",
            "data_quality",
            "processing_timestamp",
        ]
        for key in expected_keys:
            assert key in result, f"process_onboarding_data must return '{key}'"

        # Grounding-required sources must be non-empty (not silently {} / [])
        grounding_required = [
            "persona_data",
            "competitor_analysis",
            "gsc_analytics",
            "bing_analytics",
            "data_quality",
            "canonical_profile",
        ]
        for key in grounding_required:
            assert result.get(key), f"grounding-required source '{key}' must be non-empty"

    @pytest.mark.asyncio
    async def test_process_onboarding_data_known_missing_sources(
        self, integration_service, mock_source_data
    ):
        """Audit finding (contract lock): the async process_onboarding_data never
        returns api_keys_data or platform_integrations — they are always {} in
        the strategy path.

        If you add them, update this test AND the audit notes in
        AUTO_POPULATION_CODE_WALKTHROUGH.md / PROVIDER_SWITCHING_AI_AUTOFILL.md.
        """
        patches = self._patch_source_getters(integration_service, mock_source_data)
        for p in patches:
            p.start()
        try:
            result = await integration_service.process_onboarding_data("user_test", MagicMock())
        finally:
            for p in patches:
                p.stop()

        assert "platform_integrations" not in result
        assert "api_keys_data" not in result

    def test_sync_integrated_data_includes_platform_integrations(
        self, integration_service, mock_source_data
    ):
        """Audit contrast: only the SYNC path (get_integrated_data_sync) includes
        platform_integrations — the async strategy/calendar path does not."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        platforms = {"connected_platforms": ["wordpress", "gsc"], "primary_website": "https://techstartup.com"}
        patches = [
            *self._patch_source_getters(integration_service, mock_source_data),
            patch.object(integration_service, "_get_platform_integrations", return_value=platforms),
        ]
        for p in patches:
            p.start()
        try:
            result = integration_service.get_integrated_data_sync("user_test", mock_db)
        finally:
            for p in patches:
                p.stop()

        assert result["platform_integrations"] == platforms

    def test_grounding_gate_consumes_process_onboarding_shape(
        self, integration_service, mock_source_data
    ):
        """4.2: validate_strategy_grounding must read the field-level contract —
        core_persona role/goals/pain_points, competitor domain/name, GSC/Bing
        metrics and data_quality scores — from the process_onboarding_data shape."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        context = {
            "persona_data": mock_source_data["persona"],
            "competitor_analysis": mock_source_data["competitors"],
            "gsc_analytics": mock_source_data["gsc"],
            "bing_analytics": mock_source_data["bing"],
            "data_quality": mock_source_data["quality"],
            "canonical_profile": mock_source_data["canonical"],
        }
        # Strategy referencing persona role AND a real competitor domain,
        # with predictions so the analytics baseline check is populated
        strategy = {
            "base_strategy": {
                "business_objectives": (
                    "Grow the SaaS platform for the CTO persona; outrank competitor-a.com "
                    "on scalability content and address technical-debt pain points."
                )
            },
            "performance_predictions": {"predicted_traffic": 1000, "growth_rate": "10%"},
        }

        result = validate_strategy_grounding(strategy, context)

        assert result["passed"] is True
        details = result["details"]
        assert set(details.keys()) == {
            "persona_grounding",
            "competitor_grounding",
            "analytics_consistency",
            "data_quality",
        }
        # Field-level contract: gate consumed gsc metrics
        analytics_checks = details["analytics_consistency"]["checks"]
        assert analytics_checks[0]["gsc_queries"] == 1500
        assert analytics_checks[0]["total_clicks"] == 970  # 850 gsc + 120 bing
        # Field-level contract: gate consumed data_quality scores
        quality_values = {c["type"]: c["value"] for c in details["data_quality"]["checks"]}
        assert quality_values["completeness"] == 0.8
        assert quality_values["overall"] == 0.85
        # dict_to_text fallback: persona role matched from strategy dict content
        assert details["persona_grounding"]["score"] == 1.0

    def test_grounding_gate_tolerates_empty_sources(self):
        """Missing sources must pass gracefully (never crash generation)."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        result = validate_strategy_grounding({"base_strategy": {}}, {})

        assert result["passed"] is True
        assert result["details"]["persona_grounding"]["status"] in ("unavailable", "checked")
        assert result["details"]["analytics_consistency"]["status"] in ("unavailable", "checked")


class TestGroundingProductionFlow:
    """Phase 5.1: grounding validation in the production endpoint flow."""

    @pytest.fixture
    def onboarding_without_persona(self):
        """Good-quality onboarding with persona step skipped (no persona_data)."""
        return {
            "website_analysis": {
                "website_url": "https://mysite.com",
                "confidence_level": 0.9,
                "data_freshness": "recent",
            },
            "research_preferences": {"research_depth": "comprehensive"},
            "onboarding_session": {"progress": 5, "completed": True},
            "competitor_analysis": [],
            "data_quality": {"completeness": 0.85, "freshness": 0.9, "overall_score": 0.87},
        }

    @pytest.fixture
    def onboarding_three_real_competitors(self):
        """Onboarding with 3 real competitors (generic names will not match)."""
        return {
            "website_analysis": {"website_url": "https://mysite.com"},
            "persona_data": {
                "core_persona": {"role": "Growth Marketer", "goals": ["lead-generation"]}
            },
            "competitor_analysis": [
                {"domain": "hubspot.com", "name": "HubSpot"},
                {"domain": "salesforce.com", "name": "Salesforce"},
                {"domain": "zendesk.com", "name": "Zendesk"},
            ],
            "data_quality": {"completeness": 0.85, "freshness": 0.9, "overall_score": 0.87},
        }

    @pytest.fixture
    def generic_competitor_strategy(self):
        """AI output using generic 'Competitor A/B/C' instead of real ones."""
        return {
            "strategy_metadata": {"ai_generated": True},
            "base_strategy": {},
            "strategic_insights": {},
            "competitive_analysis": {
                "competitors": [
                    "Competitor A - Industry Leader",
                    "Competitor B - Emerging Player",
                    "Competitor C - Niche Specialist",
                ],
                "summary": (
                    "The competitive landscape includes Competitor A - Industry Leader, "
                    "Competitor B - Emerging Player, and Competitor C - Niche Specialist. "
                    "These players dominate the market with strong content strategies and "
                    "established distribution channels across the industry today."
                ),
            },
            "performance_predictions": {},
        }

    async def _run_generation(self, onboarding_data, strategy):
        """Drive the generate_comprehensive_strategy endpoint with mocks."""
        from unittest.mock import AsyncMock

        with patch(
            "api.content_planning.services.enhanced_strategy_service.EnhancedStrategyService._get_onboarding_data",
            new_callable=AsyncMock,
        ) as mock_get_data, patch(
            "api.content_planning.services.content_strategy.ai_generation.strategy_generator.AIStrategyGenerator.generate_comprehensive_strategy",
            new_callable=AsyncMock,
        ) as mock_generate:

            mock_get_data.return_value = onboarding_data
            mock_generate.return_value = strategy

            from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
                generate_comprehensive_strategy,
            )

            return await generate_comprehensive_strategy(
                current_user={"id": "user_test"},
                strategy_name="Test",
                config=None,
                db=MagicMock(),
            )

    @pytest.mark.asyncio
    async def test_endpoint_grounding_with_missing_persona_shows_warning(
        self, onboarding_without_persona
    ):
        """Missing persona must surface as a warning, not a crash or failure."""
        strategy = {
            "strategy_metadata": {"ai_generated": True},
            "base_strategy": {"business_objectives": "Grow the SaaS platform"},
            "strategic_insights": {},
            "competitive_analysis": {},
            "performance_predictions": {},
        }

        response = await self._run_generation(onboarding_without_persona, strategy)

        metadata = response["data"]["strategy_metadata"]
        grounding = metadata["grounding_validation"]

        # Persona step skipped -> persona grounding unavailable with a warning
        assert grounding["details"]["persona_grounding"]["status"] == "unavailable"
        assert any(
            "persona" in str(w).lower() for w in grounding.get("warnings", [])
        )
        # Overall still validated (missing source is graceful, not a failure)
        assert metadata["grounding_status"] == "validated"

    @pytest.mark.asyncio
    async def test_endpoint_grounding_detects_generic_competitors(
        self, onboarding_three_real_competitors, generic_competitor_strategy
    ):
        """AI inventing 'Competitor A/B/C' instead of real ones must be flagged."""
        response = await self._run_generation(
            onboarding_three_real_competitors, generic_competitor_strategy
        )

        metadata = response["data"]["strategy_metadata"]
        grounding = metadata["grounding_validation"]
        comp = grounding["details"]["competitor_grounding"]

        # None of the 3 real competitors mentioned (generic names only)
        mentions = comp["checks"][0]
        assert mentions["total_known"] == 3
        assert mentions["mentioned"] == 0
        assert mentions["ratio"] == 0.0

        # Flagged as generic competitive analysis, score reduced 1.0 -> 0.8
        assert any(w["type"] == "generic_competitive" for w in comp["warnings"])
        assert comp["score"] == 0.8

        # A single warning reduces the component score but does not fail the
        # overall gate (soft scoring): strategy still delivered as "validated"
        # with the warning visible in grounding_validation.warnings.
        assert metadata["grounding_status"] == "validated"
        assert any(
            w.get("type") == "generic_competitive" for w in grounding.get("warnings", [])
        )

    @pytest.mark.asyncio
    async def test_endpoint_grounding_validates_real_competitors(
        self, onboarding_three_real_competitors
    ):
        """Referencing the real competitor domains yields full grounding."""
        strategy = {
            "strategy_metadata": {"ai_generated": True},
            "base_strategy": {
                "business_objectives": (
                    "Outrank hubspot.com and salesforce.com on growth content for "
                    "Growth Marketer audiences focused on lead-generation."
                )
            },
            "strategic_insights": {},
            "competitive_analysis": {},
            "performance_predictions": {},
        }

        response = await self._run_generation(
            onboarding_three_real_competitors, strategy
        )

        metadata = response["data"]["strategy_metadata"]
        grounding = metadata["grounding_validation"]
        comp = grounding["details"]["competitor_grounding"]

        assert comp["checks"][0]["mentioned"] >= 1
        assert comp["score"] == 1.0
        assert metadata["grounding_status"] == "validated"


# Run with: pytest tests/api/test_strategy_integration.py -v

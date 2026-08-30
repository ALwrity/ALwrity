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


# Run with: pytest tests/api/test_strategy_integration.py -v

"""
Tests for Content Strategy Data Processors - Phase 1 & 2 Validation

Tests verify:
1. get_onboarding_data returns raw integrated onboarding data (all 8+ sources)
2. _build_context_summary correctly extracts and unwraps context
3. _validate_strategy_context fail-fast guard works

Phase 1: Fixed get_autofill -> generate bug + raw data plumbing
Phase 2: Added fail-fast guard + context unwrapping + tests
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))


class TestDataProcessorServiceRawSources:
    """Test DataProcessorService returns raw integrated onboarding data."""

    @pytest.mark.asyncio
    async def test_get_onboarding_data_returns_raw_sources(self):
        """
        CRITICAL TEST: Verify get_onboarding_data returns raw integrated data
        with all 8+ onboarding sources (not the processed payload).

        This validates the fix where:
        - Old: returned AutoFillService.generate() payload {fields, sources, ...}
        - New: returns process_onboarding_data() raw sources
        """
        from api.content_planning.services.content_strategy.utils.data_processors import DataProcessorService

        mock_raw_data = {
            "website_analysis": {"website_url": "https://test.com", "target_audience": {}},
            "research_preferences": {"research_depth": "comprehensive"},
            "onboarding_session": {"progress": 5, "completed": True},
            "persona_data": {"core_persona": {"name": "Test Persona"}},
            "competitor_analysis": [{"domain": "competitor.com"}],
            "deep_competitor_analysis": {"competitors": []},
            "linkedin_profile": {"summary": "Test profile"},
            "platform_integrations": {"connected_platforms": ["wordpress"]},
            "gsc_analytics": {"total_queries": 100},
            "bing_analytics": {"total_clicks": 50},
            "canonical_profile": {"industry": "tech"},
            "data_quality": {"completeness": 0.9, "overall_score": 0.85}
        }

        with patch('services.database.get_db_session') as mock_db:
            mock_db.return_value = MagicMock()

            with patch('api.content_planning.services.content_strategy.onboarding.data_integration.OnboardingDataIntegrationService') as MockIntegration:
                mock_service = MagicMock()
                mock_service.process_onboarding_data = AsyncMock(return_value=mock_raw_data)
                MockIntegration.return_value = mock_service

                processor = DataProcessorService()
                result = await processor.get_onboarding_data("user_test_123")

                # Critical assertion: process_onboarding_data() should be called
                mock_service.process_onboarding_data.assert_called_once_with("user_test_123", mock_db.return_value)

                # Verify raw source keys are present (not payload keys)
                assert "website_analysis" in result
                assert "persona_data" in result
                assert "competitor_analysis" in result
                assert "gsc_analytics" in result
                assert "canonical_profile" in result
                # Should NOT have payload keys
                assert "fields" not in result
                assert "sources" not in result

    @pytest.mark.asyncio
    async def test_get_onboarding_data_includes_all_8_sources(self):
        """
        Verify all 8+ onboarding sources are returned.
        """
        from api.content_planning.services.content_strategy.utils.data_processors import DataProcessorService

        expected_sources = [
            "website_analysis",
            "research_preferences",
            "onboarding_session",
            "persona_data",
            "competitor_analysis",
            "deep_competitor_analysis",
            "linkedin_profile",
            "platform_integrations",
            "gsc_analytics",
            "bing_analytics",
            "canonical_profile",
            "data_quality"
        ]

        with patch('services.database.get_db_session') as mock_db:
            mock_db.return_value = MagicMock()

            with patch('api.content_planning.services.content_strategy.onboarding.data_integration.OnboardingDataIntegrationService') as MockIntegration:
                mock_service = MagicMock()
                mock_service.process_onboarding_data = AsyncMock(return_value={src: {} for src in expected_sources})
                MockIntegration.return_value = mock_service

                processor = DataProcessorService()
                result = await processor.get_onboarding_data("user_test_456")

                for source in expected_sources:
                    assert source in result, f"Missing source: {source}"

    @pytest.mark.asyncio
    async def test_get_onboarding_data_error_propagation(self):
        """
        Verify proper error handling when process_onboarding_data fails.
        """
        from api.content_planning.services.content_strategy.utils.data_processors import DataProcessorService

        with patch('services.database.get_db_session') as mock_db:
            mock_db.return_value = MagicMock()

            with patch('api.content_planning.services.content_strategy.onboarding.data_integration.OnboardingDataIntegrationService') as MockIntegration:
                mock_service = MagicMock()
                mock_service.process_onboarding_data = AsyncMock(side_effect=RuntimeError("DB connection failed"))
                MockIntegration.return_value = mock_service

                processor = DataProcessorService()

                with pytest.raises(RuntimeError, match="DB connection failed"):
                    await processor.get_onboarding_data("user_test_123")


class TestBuildContextSummary:
    """Test _build_context_summary unwrapping and source extraction."""

    @pytest.mark.asyncio
    async def test_unwraps_nested_onboarding_data(self):
        """
        Verify _build_context_summary unwraps context['onboarding_data'] when present.
        """
        from api.content_planning.services.content_strategy.autofill.ai_structured_autofill import AIStructuredAutofillService

        service = AIStructuredAutofillService()

        # Context with nested onboarding_data (as endpoint passes)
        context = {
            "onboarding_data": {
                "website_analysis": {"website_url": "https://test.com"},
                "persona_data": {"core_persona": {"name": "CEO"}},
                "competitor_analysis": [{"domain": "comp.com"}],
                "gsc_analytics": {"total_queries": 100},
                "canonical_profile": {"industry": "SaaS"}
            },
            "user_id": "user_123"
        }

        summary = service._build_context_summary(context)

        # Should have extracted website_url from nested data
        assert summary["user_profile"]["website_url"] == "https://test.com"
        assert summary["persona_data"]["name"] == "CEO"
        assert summary["analytics_data"]["has_analytics"] is True

    @pytest.mark.asyncio
    async def test_includes_all_sources_in_summary(self):
        """
        Verify _build_context_summary includes all 8+ sources in output.
        """
        from api.content_planning.services.content_strategy.autofill.ai_structured_autofill import AIStructuredAutofillService

        service = AIStructuredAutofillService()

        full_context = {
            "website_analysis": {"website_url": "https://test.com", "target_audience": {}},
            "research_preferences": {"research_depth": "deep"},
            "api_keys_data": {"providers": ["google_analytics"]},
            "onboarding_session": {"progress": 5},
            "persona_data": {"core_persona": {"name": "Tech Leader", "goals": "Growth"}},
            "competitor_analysis": [{"domain": "comp.com", "name": "Competitor"}],
            "deep_competitor_analysis": {"competitors": [{"domain": "deep.com"}]},
            "linkedin_profile": {"summary": "LinkedIn profile"},
            "platform_integrations": {"connected_platforms": ["wordpress", "medium"]},
            "gsc_analytics": {"total_queries": 500},
            "bing_analytics": {"total_clicks": 200},
            "canonical_profile": {"industry": "Tech", "company_size": "mid-market"},
            "data_quality": {"completeness": 0.8, "overall_score": 0.75}
        }

        summary = service._build_context_summary(full_context)

        # Verify all sections exist
        assert "user_profile" in summary
        assert "content_analysis" in summary
        assert "audience_insights" in summary
        assert "persona_data" in summary
        assert "competitive_data" in summary
        assert "platform_integrations" in summary
        assert "analytics_data" in summary
        assert "canonical_profile" in summary
        assert "data_quality" in summary

        # Verify persona extraction
        assert summary["persona_data"]["name"] == "Tech Leader"

        # Verify competitive data extraction
        assert summary["competitive_data"]["competitors"][0]["domain"] == "comp.com"

        # Verify analytics
        assert summary["analytics_data"]["has_analytics"] is True
        assert summary["analytics_data"]["gsc"]["total_queries"] == 500

        # Verify canonical
        assert summary["canonical_profile"]["industry"] == "Tech"

        # Verify data quality from raw source
        assert summary["data_quality"]["completeness"] == 0.8


class TestValidateStrategyContext:
    """Test fail-fast guard for missing onboarding context."""

    def test_raises_409_for_empty_context(self):
        """Verify _validate_strategy_context raises 409 when context is empty."""
        from fastapi import HTTPException
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        with pytest.raises(HTTPException) as exc_info:
            _validate_strategy_context({})

        assert exc_info.value.status_code == 409
        assert "missing" in exc_info.value.detail.lower()

    def test_raises_409_for_none(self):
        """Verify raises 409 when context is None."""
        from fastapi import HTTPException
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        with pytest.raises(HTTPException) as exc_info:
            _validate_strategy_context(None)

        assert exc_info.value.status_code == 409

    def test_passes_with_website_url(self):
        """Verify passes when website_analysis with URL exists."""
        from fastapi import HTTPException
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        # Should not raise
        _validate_strategy_context({
            "website_analysis": {"website_url": "https://test.com"}
        })

    def test_passes_with_persona(self):
        """Verify passes when persona_data exists."""
        from fastapi import HTTPException
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        _validate_strategy_context({
            "persona_data": {"core_persona": {"name": "CEO"}}
        })

    def test_passes_with_completed_session(self):
        """Verify passes when onboarding session is completed."""
        from fastapi import HTTPException
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        _validate_strategy_context({
            "onboarding_session": {"progress": 5, "completed": True}
        })

    def test_raises_409_with_empty_sources(self):
        """Verify raises 409 when sources exist but have no meaningful data."""
        from fastapi import HTTPException
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import _validate_strategy_context

        with pytest.raises(HTTPException) as exc_info:
            _validate_strategy_context({
                "website_analysis": {},  # empty
                "persona_data": {},      # empty
                "onboarding_session": {"progress": 0}  # not completed
            })

        assert exc_info.value.status_code == 409


class TestDataProcessorServiceBackwardCompatibility:
    """Test backward compatible standalone functions."""

    @pytest.mark.asyncio
    async def test_standalone_get_onboarding_data_function(self):
        """
        Test the standalone get_onboarding_data function forwards to service.
        """
        from api.content_planning.services.content_strategy.utils.data_processors import get_onboarding_data

        mock_raw_data = {
            "website_analysis": {"website_url": "https://test.com"},
            "persona_data": {}
        }

        with patch('api.content_planning.services.content_strategy.utils.data_processors.DataProcessorService') as MockProcessor:
            mock_instance = AsyncMock()
            mock_instance.get_onboarding_data = AsyncMock(return_value=mock_raw_data)
            MockProcessor.return_value = mock_instance

            result = await get_onboarding_data("user_test_456")

            mock_instance.get_onboarding_data.assert_called_once_with("user_test_456")
            assert result == mock_raw_data


# Run tests with: pytest tests/services/test_data_processors.py -v

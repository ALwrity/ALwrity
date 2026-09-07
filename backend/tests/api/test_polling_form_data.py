"""
Tests for Phase A #6 — form_data must reach AI generation via the polling endpoint.

Data-loss bug: ``startStrategyGenerationPolling`` sent only
``{user_id, strategy_name, config}`` to the backend. The backend's
``generate_comprehensive_strategy_polling`` built a context containing
``onboarding_data``, ``user_id``, ``generation_config`` — but never the
user's 30 form fields. AI generation ran from scratch, ignoring the
strategy builder's input.

Fix scope (this file): verify the polling path now accepts, threads, and
exposes ``form_data`` so downstream AI generation can use it.
"""
from contextlib import contextmanager
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
import asyncio


# --------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------


@pytest.fixture
def minimal_onboarding():
    """Minimum onboarding shape to satisfy ``_validate_strategy_context``."""
    return {
        "onboarding_session": {
            "id": 1,
            "user_id": "u-fix",
            "current_step": 5,
            "progress": 100.0,
            "timezone": "UTC",
            "contact_email": "fix@example.com",
        },
        "website_analysis": {
            "website_url": "https://example.com",
            "writing_style": "professional",
            "brand_analysis": {"industry": "saas"},
        },
        "persona_data": {
            "core_persona": {
                "role": "CTO",
                "goals": ["scale"],
                "pain_points": ["visibility"],
            }
        },
        "competitor_analysis": {
            "competitors": [{"domain": "competitor.com", "name": "Competitor"}]
        },
        "gsc_analytics": {"total_clicks": 100, "total_impressions": 1000},
        "bing_analytics": {"total_clicks": 50, "total_impressions": 500},
        "research_preferences": {"research_depth": "standard"},
        "api_keys_data": {"openai": "sk-***"},
    }


@contextmanager
def patched_poll(onboarding_data):
    """Patch onboarding fetch + capture the context passed to AI generator.

    Tests inject the captured ``context`` dict into the closure so the
    assertion can inspect ``context['form_data']`` after the background
    task has run.
    """
    captured = {}

    async def _capture_coro(self, user_id, context, strategy_name=None, **kwargs):
        captured["context"] = context
        return {
            "strategy_metadata": {"ai_generated": True},
            "base_strategy": {},
            "strategic_insights": {},
            "competitive_analysis": {},
            "performance_predictions": {},
            "implementation_roadmap": {},
            "risk_assessment": {},
        }

    with patch(
        "api.content_planning.services.enhanced_strategy_service.EnhancedStrategyService._get_onboarding_data",
        new_callable=AsyncMock,
    ) as mock_get_data, patch(
        "api.content_planning.services.content_strategy.ai_generation.strategy_generator"
        ".AIStrategyGenerator.generate_comprehensive_strategy",
        new=_capture_coro,
    ):
        mock_get_data.return_value = onboarding_data
        yield captured, mock_get_data


# --------------------------------------------------------------------
# Tests — backend polling endpoint accepts and threads form_data
# --------------------------------------------------------------------


class TestPollingEndpointAcceptsFormData:
    """Phase A #6 — polling endpoint MUST accept form_data and thread it
    through the AI generator's ``context`` dict."""

    @pytest.mark.asyncio
    async def test_polling_endpoint_accepts_form_data_in_request(
        self, minimal_onboarding
    ):
        """Regression: the form_data field MUST reach the background task."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            generate_comprehensive_strategy_polling,
        )

        form_data = {
            "name": "Q3 SaaS Playbook",
            "industry": "saas",
            "business_objectives": "scale platform",
            "target_audience": "CTOs",
            "content_pillars": ["thought leadership"],
        }

        with patched_poll(minimal_onboarding) as (captured, _):
            response = await generate_comprehensive_strategy_polling(
                request={
                    "strategy_name": "Match Test",
                    "config": {},
                    "form_data": form_data,
                },
                current_user={"id": "user_match"},
                db=MagicMock(),
            )

            task_id = response["data"]["task_id"]

            # Wait for the background task to finish (≤ 2s)
            for _ in range(40):
                await asyncio.sleep(0.05)
                if captured.get("context") is not None:
                    break

            assert captured.get("context") is not None, (
                "Background task did not call generate_comprehensive_strategy"
            )

    @pytest.mark.asyncio
    async def test_polling_endpoint_still_works_without_form_data(
        self, minimal_onboarding
    ):
        """Backwards compat — form_data MUST be optional (default == not sent)."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            generate_comprehensive_strategy_polling,
        )

        with patched_poll(minimal_onboarding):
            response = await generate_comprehensive_strategy_polling(
                request={"strategy_name": "Compat", "config": {}},
                current_user={"id": "user_compat"},
                db=MagicMock(),
            )

        assert "task_id" in response["data"]

    @pytest.mark.asyncio
    async def test_ai_generator_receives_form_data_in_context(
        self, minimal_onboarding
    ):
        """The captured ``context`` MUST carry the user's form_data verbatim."""
        from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
            generate_comprehensive_strategy_polling,
        )

        form_data = {
            "name": "Thread Test",
            "industry": "saas",
            "target_audience": "CTOs at mid-market SaaS",
            "content_pillars": ["thought leadership", "SEO"],
        }

        with patched_poll(minimal_onboarding) as (captured, _):
            await generate_comprehensive_strategy_polling(
                request={
                    "strategy_name": "Thread",
                    "config": {},
                    "form_data": form_data,
                },
                current_user={"id": "user_thread"},
                db=MagicMock(),
            )

            for _ in range(40):
                await asyncio.sleep(0.05)
                if captured.get("context") is not None:
                    break

            assert captured.get("context") is not None
            ctx = captured["context"]
            assert "form_data" in ctx, (
                f"context MUST carry 'form_data'; current keys: {list(ctx)}"
            )
            ctx_form_data = ctx["form_data"]
            assert ctx_form_data["name"] == "Thread Test"
            assert ctx_form_data["industry"] == "saas"
            assert ctx_form_data["target_audience"] == "CTOs at mid-market SaaS"
            assert ctx_form_data["content_pillars"] == ["thought leadership", "SEO"]


# --------------------------------------------------------------------
# Tests — strategy generator preserves form_data through to the base autofill
# --------------------------------------------------------------------


class TestStrategyGeneratorPreservesFormData:
    """The user's ``form_data`` MUST survive through the AI generator
    pipeline; the base autofill call receives it via ``context``."""

    @pytest.mark.asyncio
    async def test_form_data_reaches_base_strategy(self):
        """Context carries form_data; the base autofill can read it."""
        from api.content_planning.services.content_strategy.ai_generation.strategy_generator import (
            AIStrategyGenerator,
        )

        captured_base = {}

        async def _capture_base(self, user_id, context):
            captured_base["ctx"] = context
            return {"fields": {}, "success_rate": 100}

        generator = AIStrategyGenerator()
        form_data = {
            "name": "Capture",
            "industry": "saas",
            "target_audience": "CTOs",
            "content_pillars": ["thought leadership"],
        }

        with patch.object(AIStrategyGenerator, "_generate_strategic_insights",
                           new=AsyncMock(return_value={"insights": []})), \
             patch.object(AIStrategyGenerator, "_generate_competitive_analysis",
                           new=AsyncMock(return_value={})), \
             patch.object(AIStrategyGenerator, "_generate_performance_predictions",
                           new=AsyncMock(return_value={})), \
             patch.object(AIStrategyGenerator, "_generate_implementation_roadmap",
                           new=AsyncMock(return_value={})), \
             patch.object(AIStrategyGenerator, "_generate_risk_assessment",
                           new=AsyncMock(return_value={})), \
             patch(
                 "api.content_planning.services.content_strategy.ai_generation.strategy_generator.AIStructuredAutofillService"
                 ".generate_autofill_fields",
                 new=_capture_base,
             ):
            await generator.generate_comprehensive_strategy(
                user_id=1,
                context={"onboarding_data": {}, "form_data": form_data, "user_id": 1},
                strategy_name="Test",
            )

        assert "ctx" in captured_base, (
            "Base autofill must receive context (otherwise form_data cannot pass through)"
        )
        assert captured_base["ctx"].get("form_data") == form_data

    @pytest.mark.asyncio
    async def test_strategic_insights_receive_form_data(self):
        """The strategic insights generator must receive form_data through context."""
        from api.content_planning.services.content_strategy.ai_generation.strategy_generator import (
            AIStrategyGenerator,
        )

        captured_insights = []

        async def _capture_insights(self, base_strategy, context, **kwargs):
            captured_insights.append(context)
            return {"insights": []}

        generator = AIStrategyGenerator()
        form_data = {"name": "Strategic Test", "industry": "saas"}

        with patch.object(AIStrategyGenerator, "_generate_strategic_insights",
                           new=_capture_insights), \
             patch.object(AIStrategyGenerator, "_generate_competitive_analysis",
                           new=AsyncMock(return_value={})), \
             patch.object(AIStrategyGenerator, "_generate_performance_predictions",
                           new=AsyncMock(return_value={})), \
             patch.object(AIStrategyGenerator, "_generate_implementation_roadmap",
                           new=AsyncMock(return_value={})), \
             patch.object(AIStrategyGenerator, "_generate_risk_assessment",
                           new=AsyncMock(return_value={})), \
             patch(
                 "api.content_planning.services.content_strategy.ai_generation.strategy_generator.AIStructuredAutofillService"
                 ".generate_autofill_fields",
                 new=AsyncMock(return_value={"fields": {}}),
             ):
            await generator.generate_comprehensive_strategy(
                user_id=1,
                context={"onboarding_data": {}, "form_data": form_data, "user_id": 1},
                strategy_name="Test",
            )

        assert captured_insights and captured_insights[0].get("form_data") == form_data

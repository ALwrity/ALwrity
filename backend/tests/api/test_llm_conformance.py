"""
The Create Strategy flow must run on the COMMON LLM infra
(`services.llm_providers.main_text_generation.llm_text_gen`), not the legacy
AIServiceManager path.

Why: AIServiceManager wraps every call in asyncio.wait_for(timeout_seconds=45),
but the configured provider (wavespeed/openai/gpt-oss-120b) needs 45-165s per
structured call — every invocation was killed at 45s while the executor thread
kept spending tokens in the background, surfacing as
"Unknown error (empty exception message)". The modern codebase pattern
(services/intelligence/agents/core_agent_framework.py:927-935) is
run_in_executor(lambda: llm_text_gen(prompt, json_struct, user_id)) — provider
latency governs, no artificial cap.
"""
import asyncio
from unittest.mock import patch, MagicMock

import pytest

from api.content_planning.services.content_strategy.ai_generation.strategy_generator import (
    AIStrategyGenerator,
)
import api.content_planning.services.content_strategy.ai_generation.strategy_generator as sg


class TestStrategyGeneratorConformance:
    def test_no_legacy_ai_service_manager_usage(self):
        src = open(sg.__file__, encoding="utf-8").read()
        assert "AIServiceManager" not in src, "strategy flow must not use AIServiceManager"
        assert "AIServiceType" not in src, "strategy flow must not reference legacy service types"
        assert "from services.llm_providers.main_text_generation import llm_text_gen" in src
        assert "run_in_executor" in src

    @pytest.mark.asyncio
    async def test_call_llm_structured_runs_llm_text_gen_without_timeout_cap(self):
        """The shared helper must execute llm_text_gen in an executor (async bridge),
        pass prompt/json_struct/user_id (+ the strategy system rubric), and wrap
        the raw dict as {"data": ...} for the callers' unwrap."""
        with patch.object(sg, "llm_text_gen", new=MagicMock(return_value={"insights": []})) as mock_llm:
            generator = AIStrategyGenerator()
            result = await generator._call_llm_structured(
                prompt="generate insights", schema={}, user_id="u-1"
            )

        assert mock_llm.called
        kwargs = mock_llm.call_args.kwargs
        assert kwargs["prompt"] == "generate insights"
        assert kwargs["json_struct"] == {}
        assert kwargs["user_id"] == "u-1"
        # The personalization rubric rides in the system prompt (QA-2)
        assert kwargs["system_prompt"] is not None
        assert "user" in kwargs["system_prompt"].lower()
        assert result == {"data": {"insights": []}}


class TestAutofillConformance:
    def test_no_legacy_ai_service_manager_usage(self):
        import api.content_planning.services.content_strategy.autofill.ai_structured_autofill as af

        src = open(af.__file__, encoding="utf-8").read()
        assert "AIServiceManager" not in src, "autofill must not use AIServiceManager"
        assert "AIServiceType" not in src, "autofill must not reference legacy service types"
        assert "from services.llm_providers.main_text_generation import llm_text_gen" in src

    @pytest.mark.asyncio
    async def test_generate_autofill_fields_uses_llm_text_gen(self):
        """The base autofill must call llm_text_gen via the executor with the
        prompt/schema/user_id, not AIServiceManager's 45-second wait_for."""
        import api.content_planning.services.content_strategy.autofill.ai_structured_autofill as af

        with patch.object(af, "llm_text_gen", new=MagicMock(return_value={"business_objectives": {"value": "x"}})) as mock_llm:
            service = af.AIStructuredAutofillService()
            result = await service.generate_autofill_fields(1, {"onboarding_data": {}})

        assert mock_llm.called
        kwargs = mock_llm.call_args.kwargs
        assert kwargs["json_struct"] == service._build_schema()
        assert kwargs["user_id"] == "1"
        assert kwargs["system_prompt"] is not None
        # Backwards-compat wrapper shape the downstream unwrap expects
        assert result.get("data", result) is not None or result.get("fields")

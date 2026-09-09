"""QA-6 — Calendar handoff: the compact strategy digest (pillars, preferred
formats, publishing frequency, brand voice, best timing) must travel from the
calendar-generation request into the orchestrator context and the final
calendar, so content scheduling inherits the confirmed strategy instead of
starting a parallel universe.

Source-guard tests follow the repo convention (asserting wiring), plus one
behavioral test on the context merge.
"""

from pathlib import Path

import pytest
from unittest.mock import AsyncMock, patch

from services.calendar_generation_datasource_framework.prompt_chaining.orchestrator import (
    PromptChainOrchestrator,
)


SERVICE_PATH = Path(
    "api/content_planning/services/calendar_generation_service.py"
)
ORCHESTRATOR_PATH = Path(
    "services/calendar_generation_datasource_framework/prompt_chaining/orchestrator.py"
)


class TestCalendarDigestRequestModel:
    def test_request_accepts_strategy_digest(self):
        """The /start payload model must carry the QA-6 strategy digest."""
        from api.content_planning.api.models.requests import CalendarGenerationRequest

        request = CalendarGenerationRequest(
            user_id="user-1",
            strategy_id=7,
            strategy_digest={
                "content_pillars": ["Tech Tips"],
                "content_frequency": "3x weekly",
                "brand_voice": "Professional",
            },
        )

        payload = request.dict()
        assert payload["strategy_digest"]["content_pillars"] == ["Tech Tips"]
        assert payload["strategy_digest"]["content_frequency"] == "3x weekly"

    def test_request_strategy_digest_defaults_to_none(self):
        from api.content_planning.api.models.requests import CalendarGenerationRequest

        assert CalendarGenerationRequest().strategy_digest is None


class TestCalendarDigestServiceThreading:
    def test_service_forwards_digest_to_orchestrator(self):
        """start_orchestrator_generation must pass strategy_digest through to
        orchestrator.generate_calendar (round-trips from the /start request)."""
        source = SERVICE_PATH.read_text(encoding="utf-8")
        assert "strategy_digest=request_data.get(\"strategy_digest\")" in source
        assert "strategy_digest=request_data.get(\"strategy_digest\") or {}" in source

    def test_sync_service_builds_request_data_with_digest(self):
        """generate_comprehensive_calendar must accept strategy_digest and seed
        it into the orchestrator session request_data."""
        source = SERVICE_PATH.read_text(encoding="utf-8")
        assert 'def generate_comprehensive_calendar(self, user_id: str, strategy_id: Optional[int] = None, ' in source
        assert "strategy_digest: Optional[Dict[str, Any]] = None" in source
        assert '"strategy_digest": strategy_digest or {}' in source


class TestCalendarDigestOrchestratorThreading:
    def test_generate_calendar_accepts_and_initializes_digest(self):
        """generate_calendar must accept strategy_digest and pass it into
        _initialize_context."""
        source = ORCHESTRATOR_PATH.read_text(encoding="utf-8")
        assert "strategy_digest: Optional[Dict[str, Any]] = None" in source
        assert "business_size, strategy_digest" in source

    def test_initialize_context_stores_digest_and_merges_into_user_data(self):
        """_initialize_context must expose the digest both on context and
        inside user_data so steps that serialize user_data inherit it."""
        source = ORCHESTRATOR_PATH.read_text(encoding="utf-8")
        assert '"strategy_digest": digest' in source
        assert 'user_data["strategy_digest"] = digest' in source

    def test_final_calendar_echoes_digest(self):
        """_generate_final_calendar must echo the digest into the calendar
        output so the strategy handoff is visible to persistence/UI."""
        source = ORCHESTRATOR_PATH.read_text(encoding="utf-8")
        assert '"strategy_digest": context.get("strategy_digest") or {}' in source

    @pytest.mark.asyncio
    async def test_initialize_context_merges_digest_behaviorally(self):
        """Behavioral check: after _initialize_context, context['strategy_digest']
        holds the request digest and it is merged into user_data."""
        orchestrator = PromptChainOrchestrator.__new__(PromptChainOrchestrator)
        orchestrator._get_comprehensive_user_data = AsyncMock(
            return_value={"industry": "technology", "onboarding_data": {}}
        )
        orchestrator.context_manager = AsyncMock()
        orchestrator.context_manager.initialize = AsyncMock()

        digest = {
            "content_pillars": ["Tech Tips", "Product News"],
            "preferred_formats": ["Blog", "Video"],
            "content_frequency": "3x weekly",
            "brand_voice": "Professional",
            "best_timing": "Roadmap: 12 months",
        }

        context = await orchestrator._initialize_context(
            1, 7, "monthly", None, "sme", digest
        )

        assert context["strategy_digest"] == digest
        assert context["user_data"]["strategy_digest"] == digest
        assert context["user_data"]["industry"] == "technology"
        orchestrator.context_manager.initialize.assert_awaited_once()
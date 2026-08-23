"""Phase 6 tests for shared runtime/API prompt context."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import services.intelligence.agents.core_agent_framework as caf
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent
from services.intelligence.agents.prompt_context import (
    build_prompt_context,
    comma_join_context,
)


class _StubAgent(BaseALwrityAgent):
    def _create_txtai_agent(self):
        return None


class _DB:
    def close(self):
        pass


def make_agent(user_id="phase6-user"):
    agent = object.__new__(_StubAgent)
    agent.user_id = user_id
    agent.agent_key = "content_strategist"
    agent.agent_type = "content_strategist"
    return agent


def integrated_fixture():
    return {
        "website_analysis": {
            "website_url": "https://www.acme.com",
            "domain": "acme.com",
            "style_analysis": {
                "content_strategy_insights": {
                    "content_pillars": [{"topic": "AI tooling"}, {"name": "DevOps"}]
                }
            },
            "style_guidelines": {"aesthetic": "clean", "visual_style": "technical"},
            "seo_audit": {"overall_score": 0, "summary": "Needs technical fixes"},
        },
        "competitor_analysis": [{"competitor_domain": "rival.io"}],
        "canonical_profile": {
            "brand_voice": "canonical voice",
            "target_audience": "engineering leaders",
            "business_goals": ["Grow qualified traffic"],
            "content_pillars": ["fallback pillar"],
        },
        "research_preferences": {
            "industry": "B2B SaaS",
            "research_depth": "deep",
            "content_types": ["blog"],
            "posting_cadence": "weekly",
        },
        "platform_integrations": {"connected_platforms": ["wordpress"]},
        "persona_data": {
            "core_persona": {
                "identity": {
                    "persona_name": "Ace",
                    "brand_voice_description": "Evidence-first voice",
                    "archetype": "Sage",
                    "core_belief": "Clarity wins",
                },
                "tonal_range": {
                    "default_tone": "direct",
                    "permissible_tones": ["warm"],
                    "forbidden_tones": ["hype"],
                },
                "linguistic_fingerprint": {
                    "lexical_features": {
                        "go_to_phrases": ["the data shows"],
                        "go_to_words": ["signal"],
                        "avoid_words": ["revolutionary"],
                    }
                },
            }
        },
    }


@pytest.fixture(autouse=True)
def clear_context_cache():
    BaseALwrityAgent._prompt_context_cache.clear()
    yield
    BaseALwrityAgent._prompt_context_cache.clear()


class TestRuntimeContextParity:
    def test_runtime_matches_shared_flattened_builder(self, monkeypatch):
        data = integrated_fixture()
        monkeypatch.setattr(
            "services.intelligence.agents.core_agent_framework.get_session_for_user",
            lambda user_id: _DB(),
        )
        monkeypatch.setattr(
            "api.content_planning.services.content_strategy.onboarding.data_integration.OnboardingDataIntegrationService.get_integrated_data_sync",
            lambda self, user_id, db: data,
        )

        runtime = make_agent()._load_prompt_context()
        expected = comma_join_context(build_prompt_context(data))
        expected["user_id"] = "phase6-user"

        assert runtime == expected
        assert runtime["content_pillars"] == "AI tooling, DevOps"
        assert runtime["competitors"] == "rival.io"
        assert runtime["style_guidelines"] == "clean; technical"
        assert runtime["seo_summary"] == "Needs technical fixes"
        assert runtime["forbidden_tones"] == "hype"

    def test_existing_runtime_truncation_limits_are_preserved(self, monkeypatch):
        data = integrated_fixture()
        data["persona_data"]["core_persona"]["identity"]["brand_voice_description"] = "x" * 3000
        data["persona_data"]["core_persona"]["identity"]["core_belief"] = "y" * 1000
        monkeypatch.setattr(
            "services.intelligence.agents.core_agent_framework.get_session_for_user",
            lambda user_id: _DB(),
        )
        monkeypatch.setattr(
            "api.content_planning.services.content_strategy.onboarding.data_integration.OnboardingDataIntegrationService.get_integrated_data_sync",
            lambda self, user_id, db: data,
        )

        runtime = make_agent()._load_prompt_context()

        assert len(runtime["brand_voice"]) <= 1200
        assert runtime["brand_voice"].endswith("…(truncated)")
        assert len(runtime["core_belief"]) <= 400
        assert runtime["core_belief"].endswith("…(truncated)")

    def test_failure_keeps_minimal_fallback_and_caches(self, monkeypatch):
        calls = []
        db = _DB()
        monkeypatch.setattr(
            "services.intelligence.agents.core_agent_framework.get_session_for_user",
            lambda user_id: db,
        )

        def fail(self, user_id, session):
            calls.append(user_id)
            raise RuntimeError("integration unavailable")

        monkeypatch.setattr(
            "api.content_planning.services.content_strategy.onboarding.data_integration.OnboardingDataIntegrationService.get_integrated_data_sync",
            fail,
        )
        agent = make_agent()

        first = agent._load_prompt_context()
        second = agent._load_prompt_context()

        assert first == {"website_name": "Your", "website_url": "", "user_id": "phase6-user"}
        assert second is first
        assert calls == ["phase6-user"]


class TestOrchestratorContextParity:
    @pytest.mark.asyncio
    async def test_orchestrator_uses_shared_flattened_context(self, monkeypatch):
        from services.intelligence.agents.agent_orchestrator import ALwrityAgentOrchestrator

        data = integrated_fixture()
        db = _DB()
        monkeypatch.setattr(
            "services.database.get_session_for_user",
            lambda user_id: db,
        )
        monkeypatch.setattr(
            "api.content_planning.services.content_strategy.onboarding.data_integration.OnboardingDataIntegrationService.get_integrated_data_sync",
            lambda self, user_id, session: data,
        )

        orchestrator = object.__new__(ALwrityAgentOrchestrator)
        orchestrator.user_id = "phase6-user"
        orchestrator.agents = {"seo": object()}
        orchestrator._get_agent_capabilities = lambda: {}

        async def get_agent_status():
            return {"status": "ready"}

        orchestrator.get_agent_status = get_agent_status

        result = await orchestrator._prepare_orchestrator_context({"trend": "stable"})

        expected = comma_join_context(build_prompt_context(data))
        assert result["onboarding_data"] == expected
        assert result["onboarding_data"]["content_pillars"] == "AI tooling, DevOps"
        assert result["onboarding_data"]["competitors"] == "rival.io"

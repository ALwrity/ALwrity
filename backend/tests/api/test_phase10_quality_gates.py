"""Phase 10 tests for brand and content quality gates."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import services.intelligence.agents.core_agent_framework as caf
from services.intelligence.agents.core_agent_framework import AgentAction, BaseALwrityAgent
from services.intelligence.agents.quality_gates import (
    extract_content,
    validate_action_content,
    validate_content_quality,
)
from services.intelligence.agents.specialized.content_guardian import ContentGuardianAgent


class _StubAgent(BaseALwrityAgent):
    def _create_txtai_agent(self):
        return None


def make_agent():
    agent = object.__new__(_StubAgent)
    agent.user_id = "quality-user"
    agent.agent_id = "quality-agent"
    agent.agent_type = "content_strategist"
    agent._load_prompt_context = lambda: {
        "avoid_words": "revolutionary, synergy",
        "forbidden_tones": "hype, sarcastic",
    }
    return agent


class TestQualityGate:
    def test_clean_content_passes(self):
        result = validate_content_quality(
            "A practical guide for engineering leaders.",
            {"avoid_words": ["synergy"], "forbidden_tones": ["hype"]},
        )

        assert result["is_compliant"] is True
        assert result["violations"] == []
        assert result["checked"] is True

    def test_avoid_word_blocks_and_provides_correction(self):
        result = validate_content_quality(
            "Our revolutionary workflow helps teams.",
            {"avoid_words": ["revolutionary"]},
        )

        assert result["is_compliant"] is False
        assert result["violations"] == [{"type": "avoid_word", "value": "revolutionary"}]
        assert result["corrections"]

    def test_unsafe_term_is_word_boundary_checked(self):
        assert validate_content_quality("Attack competitors with facts.")["is_compliant"] is False
        assert validate_content_quality("An attacker model is documented.")["is_compliant"] is True

    def test_forbidden_tone_marker_blocks(self):
        result = validate_content_quality(
            "Get guaranteed overnight success.",
            {"forbidden_tones": ["hype"]},
        )

        assert result["is_compliant"] is False
        assert any(item["type"] == "forbidden_tone" for item in result["violations"])

    def test_unverified_statistic_is_warning_not_block(self):
        result = validate_content_quality("Teams improve output by 40%.", {})

        assert result["is_compliant"] is True
        assert result["warnings"][0]["type"] == "unsupported_statistic"

    def test_content_extraction_ignores_arbitrary_metadata(self):
        assert extract_content({"content": "draft", "task_id": 4}) == "draft"
        assert extract_content({"task_id": 4, "description": "not content"}) == ""
        assert validate_action_content({"task_id": 4}, {})["checked"] is False


class TestAgentExecutionQualityGate:
    @pytest.mark.asyncio
    async def test_blocked_content_never_reaches_agent_execution(self, monkeypatch):
        agent = make_agent()
        action = AgentAction(
            action_id="quality-1",
            agent_type="content_strategist",
            action_type="create_content",
            target_resource="blog draft",
            parameters={"content": "A revolutionary and synergy-filled claim."},
            expected_outcome="draft",
            risk_level=0.2,
        )

        result = await agent.execute_action(action)

        assert result["success"] is False
        assert result["quality_gate"]["is_compliant"] is False
        assert result["quality_gate"]["violations"]

    @pytest.mark.asyncio
    async def test_content_free_action_is_not_blocked_by_quality_gate(self, monkeypatch):
        agent = make_agent()
        action = AgentAction(
            action_id="quality-2",
            agent_type="content_strategist",
            action_type="navigate",
            target_resource="/blog-writer",
            parameters={},
            expected_outcome="Open writer",
            risk_level=0.1,
        )

        async def safety(_action):
            return False

        monkeypatch.setattr(agent, "_validate_action_safety", safety)
        result = await agent.execute_action(action)

        assert result["quality_gate"]["checked"] is False
        assert "safety validation" in result["error"]

    @pytest.mark.asyncio
    async def test_quality_override_requires_agent_approval_path(self, monkeypatch):
        import services.intelligence.agents.agent_orchestrator as orchestrator_module

        class Agent:
            async def execute_action(self, action):
                return {
                    "success": False,
                    "requires_approval": True,
                    "approval_request_id": 12,
                    "action_id": action.action_id,
                }

        class Orchestrator:
            agents = {"content": Agent()}

        async def get_or_create(user_id):
            return Orchestrator()

        monkeypatch.setattr(
            orchestrator_module.orchestration_service,
            "get_or_create_orchestrator",
            get_or_create,
        )
        from services.intelligence.agents.core_agent_framework import AgentAction

        action = AgentAction(
            action_id="override-1",
            agent_type="content_strategist",
            action_type="publish",
            target_resource="website",
            parameters={
                "platform": "wordpress",
                "content": "A revolutionary claim.",
                "quality_override_requested": True,
            },
            expected_outcome="publish",
            risk_level=0.9,
            requires_approval=True,
        )

        result = await orchestrator_module.execute_agent_action(
            "quality-user", "content_strategist", action
        )

        assert result["requires_approval"] is True
        assert result["approval_request_id"] == 12


class TestContentGuardianIntegration:
    @pytest.mark.asyncio
    async def test_guardian_reports_shared_brand_violations(self):
        guardian = object.__new__(ContentGuardianAgent)
        guardian.sif_service = None
        guardian._log_agent_operation = lambda *args, **kwargs: None
        guardian._load_prompt_context = lambda: {
            "avoid_words": "synergy",
            "forbidden_tones": "hype",
        }

        result = await guardian.style_enforcer("A revolutionary synergy solution.")

        assert result["is_compliant"] is False
        assert result["quality_gate"]["is_compliant"] is False
        assert result["issues"]


class TestOnboardingDataGroundingGates:
    """Tests for the new onboarding data grounding quality gates."""

    def test_validate_persona_grounding_with_matching_content(self):
        """Content that includes persona role/goals should pass."""
        from services.intelligence.agents.quality_gates import validate_persona_grounding

        persona = {"core_persona": {"role": "CTO", "goals": ["scalability", "performance"]}}
        content = "As a CTO focused on scalability, I need high-performance solutions."

        result = validate_persona_grounding(content, persona)

        assert result["score"] > 0.5
        assert result["status"] == "checked"

    def test_validate_persona_grounding_no_persona_data(self):
        """No persona data should return unavailable (pass)."""
        from services.intelligence.agents.quality_gates import validate_persona_grounding

        result = validate_persona_grounding("Some content", None)

        assert result["passed"] is True
        assert result["status"] == "unavailable"

    def test_validate_competitor_grounding_with_references(self):
        """Content referencing real competitors should pass."""
        from services.intelligence.agents.quality_gates import validate_competitor_grounding

        competitors = [{"domain": "competitor.com", "name": "Competitor Inc"}]
        content = "Unlike Competitor Inc, we offer better pricing."

        result = validate_competitor_grounding(content, competitors)

        assert result["score"] > 0.5

    def test_validate_competitor_grounding_no_competitors(self):
        """No competitor data should return unavailable (pass)."""
        from services.intelligence.agents.quality_gates import validate_competitor_grounding

        result = validate_competitor_grounding("Some content", [])

        assert result["passed"] is True
        assert result["status"] == "unavailable"

    def test_validate_analytics_consistency_realistic_prediction(self):
        """Realistic growth predictions should pass."""
        from services.intelligence.agents.quality_gates import validate_analytics_consistency

        gsc = {"total_clicks": 1000, "total_queries": 500}
        predictions = {"predicted_growth": "20%"}

        result = validate_analytics_consistency(predictions, gsc, None)

        assert result["score"] > 0.5

    def test_validate_analytics_consistency_unrealistic_prediction(self):
        """Unrealistic predictions (100x growth) should warn."""
        from services.intelligence.agents.quality_gates import validate_analytics_consistency

        gsc = {"total_clicks": 100}
        predictions = {"predicted_growth": "100x"}

        result = validate_analytics_consistency(predictions, gsc, None)

        assert len(result["warnings"]) > 0

    def test_validate_data_quality_grounding_high_quality(self):
        """High quality data should pass."""
        from services.intelligence.agents.quality_gates import validate_data_quality_grounding

        quality = {"completeness": 0.9, "freshness": 0.85, "overall_score": 0.88}

        result = validate_data_quality_grounding(quality, None)

        assert result["passed"] is True
        assert result["score"] > 0.7

    def test_validate_data_quality_grounding_low_quality(self):
        """Low quality data should fail."""
        from services.intelligence.agents.quality_gates import validate_data_quality_grounding

        quality = {"completeness": 0.3, "freshness": 0.2}

        result = validate_data_quality_grounding(quality, None)

        assert result["passed"] is False
        assert len(result["violations"]) > 0

    def test_validate_strategy_grounding_comprehensive(self):
        """Full strategy grounding check with all data."""
        from services.intelligence.agents.quality_gates import validate_strategy_grounding

        strategy = {"content": "As a CEO, I want to beat competitor.com with better ROI."}
        context = {
            "persona_data": {"core_persona": {"role": "CEO", "goals": ["ROI"]}},
            "competitor_analysis": [{"domain": "competitor.com"}],
            "gsc_analytics": {"total_clicks": 500},
            "data_quality": {"completeness": 0.8, "freshness": 0.9, "overall_score": 0.85}
        }

        result = validate_strategy_grounding(strategy, context)

        assert result["score"] > 0.5
        assert result["status"] == "checked"
        assert "persona_grounding" in result["details"]
        assert "competitor_grounding" in result["details"]

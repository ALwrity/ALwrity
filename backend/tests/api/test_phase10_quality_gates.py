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

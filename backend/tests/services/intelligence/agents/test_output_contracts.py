"""Phase 8 tests for additive role-specific task output contracts."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import services.intelligence.agents.core_agent_framework as caf
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent, TaskProposal
from services.intelligence.agents.output_contracts import (
    ACTION_TYPES,
    get_role_contract,
    normalize_contract_text,
    resolve_recommendation_action,
    task_output_schema,
)
from services.intelligence.agents.team_catalog import get_agent_catalog_entry


class _StubAgent(BaseALwrityAgent):
    def _create_txtai_agent(self):
        return None


def make_agent(agent_key="seo_specialist"):
    agent = object.__new__(_StubAgent)
    agent.user_id = "contract-user"
    agent.agent_key = agent_key
    agent.agent_type = agent_key
    return agent


@pytest.fixture(autouse=True)
def clear_context_cache():
    BaseALwrityAgent._prompt_context_cache.clear()
    BaseALwrityAgent._profile_cache.clear()
    yield
    BaseALwrityAgent._prompt_context_cache.clear()
    BaseALwrityAgent._profile_cache.clear()


class TestOutputContractDefinitions:
    def test_declared_action_types_are_complete(self):
        assert ACTION_TYPES == {
            "navigate",
            "create_content",
            "seo_analyze",
            "create_seo_task",
            "calendar_insert",
            "linkedin_draft",
            "facebook_draft",
            "publish",
        }

    def test_schema_contains_actionability_fields(self):
        schema = task_output_schema("content_strategist")
        properties = schema["properties"]["tasks"]["items"]["properties"]

        for field in ("evidence", "expected_impact", "effort", "risk_level", "measurement"):
            assert field in properties
        assert get_role_contract("content_strategist")["evidence"]

    def test_roles_have_specific_guidance(self):
        assert "SEO" in get_role_contract("seo_specialist")["evidence"]
        assert "platform" in get_role_contract("social_media_manager")["evidence"]
        assert get_role_contract("unknown") == get_role_contract("another_unknown")

    def test_optional_text_is_bounded_and_empty_values_are_absent(self):
        assert normalize_contract_text(None) is None
        assert normalize_contract_text("  ") is None
        assert normalize_contract_text("x" * 600) == "x" * 500

    def test_schema_contains_recommendation_contract_fields(self):
        properties = task_output_schema("seo_specialist")["properties"]["tasks"]["items"]["properties"]
        for field in ("recommendation", "next_action", "owner_agent", "kpi", "deadline", "action_parameters"):
            assert field in properties

    def test_shared_task_agents_use_tasks_contract(self):
        for agent_key in (
            "content_strategist",
            "competitor_analyst",
            "seo_specialist",
            "social_media_manager",
            "content_guardian",
            "strategy_architect",
        ):
            template = get_agent_catalog_entry(agent_key)["defaults"]["task_prompt_template"]
            assert "tasks array" in template, f"{agent_key} does not use the common tasks contract"


class TestTaskProposalContract:
    def test_existing_positional_constructor_remains_compatible(self):
        proposal = TaskProposal(
            "Title",
            "Description",
            "generate",
            "high",
            30,
            "Agent",
            "Reason",
            {"source": "test"},
            "navigate",
            "/blog-writer",
        )

        assert proposal.title == "Title"
        assert proposal.action_url == "/blog-writer"
        assert proposal.evidence is None
        assert proposal.risk_level == "low"

    def test_parser_populates_and_normalizes_contract_fields(self):
        agent = make_agent()
        result = {
            "tasks": [
                {
                    "title": "Fix title tags",
                    "pillar_id": "analyze",
                    "priority": "high",
                    "estimated_time": "25",
                    "evidence": "  Audit flagged duplicate titles  ",
                    "expected_impact": "Improve crawl relevance",
                    "effort": "small",
                    "risk_level": "URGENT",
                    "measurement": "Organic clicks",
                }
            ]
        }

        proposals = agent._parse_task_proposals(result)

        assert len(proposals) == 1
        proposal = proposals[0]
        assert proposal.evidence == "Audit flagged duplicate titles"
        assert proposal.expected_impact == "Improve crawl relevance"
        assert proposal.effort == "small"
        assert proposal.risk_level == "low"
        assert proposal.measurement == "Organic clicks"

    def test_parser_bounds_contract_text(self):
        agent = make_agent()
        proposals = agent._parse_task_proposals(
            {
                "tasks": [
                    {
                        "title": "Task",
                        "pillar_id": "plan",
                        "priority": "medium",
                        "evidence": "e" * 1000,
                    }
                ]
            }
        )

        assert len(proposals[0].evidence) == 500


class TestRecommendationActionResolution:
    def test_missing_content_topic_falls_back_to_navigation(self):
        result = resolve_recommendation_action({
            "pillarId": "generate",
            "source_agent": "ContentStrategyAgent",
            "actionType": "create_content",
            "metadata": {},
        })
        assert result["action_type"] == "navigate"
        assert result["execution_ready"] is False
        assert result["missing_parameters"]

    def test_supported_platform_drafts_are_executable(self):
        for action_type, platform in (("facebook_draft", "facebook"), ("linkedin_draft", "linkedin")):
            result = resolve_recommendation_action({
                "pillarId": "engage",
                "source_agent": "SocialAmplificationAgent",
                "actionType": action_type,
                "metadata": {"context_data": {"platform": platform, "topic": "A useful topic"}},
            })
            assert result["action_type"] == action_type
            assert result["execution_ready"] is True

    def test_unsupported_platform_falls_back(self):
        result = resolve_recommendation_action({
            "pillarId": "engage",
            "source_agent": "SocialAmplificationAgent",
            "actionType": "facebook_draft",
            "metadata": {"context_data": {"platform": "instagram", "topic": "Topic"}},
        })
        assert result["action_type"] == "navigate"
        assert "Unsupported platform" in result["reason"]

    def test_publish_requires_rollback_verification_and_approval(self):
        base = {
            "action_type": "publish",
            "context_data": {
                "platform": "facebook",
                "content": "draft",
                "approval_id": 4,
            },
        }
        result = resolve_recommendation_action(base)
        assert result["action_type"] == "navigate"
        assert "rollback" in result["reason"].lower()

        base["context_data"]["rollback_verified"] = True
        assert resolve_recommendation_action(base)["execution_ready"] is True


class TestTaskSynthesisPrompt:
    @pytest.mark.asyncio
    async def test_prompt_requests_role_contract_fields(self, monkeypatch):
        captured = {}
        agent = make_agent("seo_specialist")

        def fake_prompt(instruction, task_context):
            captured["instruction"] = instruction
            return "prompt"

        async def fake_executor(*args, **kwargs):
            return None

        monkeypatch.setattr(agent, "build_task_prompt", fake_prompt)

        def fake_llm(**kwargs):
            return {
                "tasks": [
                    {
                        "title": "Audit metadata",
                        "pillar_id": "analyze",
                        "priority": "high",
                        "evidence": "SEO audit finding",
                        "expected_impact": "Improve crawlability",
                        "effort": "small",
                        "risk_level": "low",
                        "measurement": "Indexed pages",
                    }
                ]
            }

        monkeypatch.setattr(caf, "llm_text_gen", fake_llm)
        proposals = await agent._synthesize_task_proposals(
            {}, [], "Propose SEO actions"
        )

        assert proposals[0].evidence == "SEO audit finding"
        instruction = captured["instruction"]
        assert "evidence" in instruction
        assert "SEO audit" in instruction

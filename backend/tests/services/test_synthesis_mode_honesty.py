"""Phase 2 honesty fixes: template-fallback proposals must be flagged end-to-end.

When LLM synthesis fails, agents substitute static template proposals. These
tests verify the degradation is explicitly labeled (``synthesis_mode``),
carried through normalization, surfaced by the Guardian gate as
``approved_with_warning``, and stamped onto task dicts — never silently
presented as personalized output.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import services.intelligence.agents.core_agent_framework as caf
from services.intelligence.agents.core_agent_framework import (
    BaseALwrityAgent,
    TaskProposal,
)
from services.daily_meeting_review import normalize_proposal


class _StubAgent(BaseALwrityAgent):
    def _create_txtai_agent(self):
        return None


def make_agent(agent_key="seo_specialist"):
    agent = object.__new__(_StubAgent)
    agent.user_id = "synthesis-user"
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


def _template_proposal() -> TaskProposal:
    return TaskProposal(
        title="Review Strategic Goals",
        description="Ensure your content output aligns with your quarterly business goals.",
        pillar_id="plan",
        priority="low",
        estimated_time=10,
        source_agent="StrategyArchitectAgent",
        reasoning="Routine strategy maintenance.",
        action_type="navigate",
        action_url="/content-planning-dashboard",
    )


# ---------------------------------------------------------------------------
# 1. Tagging at the synthesis boundary
# ---------------------------------------------------------------------------

def test_static_constructions_default_to_template_fallback():
    assert _template_proposal().synthesis_mode == "template_fallback"


def test_parsed_llm_tasks_are_tagged_llm():
    agent = make_agent()
    result = {
        "tasks": [
            {
                "title": "Audit metadata",
                "pillar_id": "analyze",
                "priority": "high",
                "evidence": "SEO audit finding",
            }
        ]
    }
    proposals = agent._parse_task_proposals(result, max_tasks=5)
    assert len(proposals) == 1
    assert proposals[0].synthesis_mode == "llm"


@pytest.mark.asyncio
async def test_fallback_on_llm_failure_stamps_template_fallback(monkeypatch):
    agent = make_agent()

    def failing_llm(**kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(caf, "llm_text_gen", failing_llm)

    defaults = [_template_proposal()]
    proposals = await agent._synthesize_task_proposals({}, defaults, "Propose tasks")

    assert proposals is defaults
    assert all(p.synthesis_mode == "template_fallback" for p in proposals)


@pytest.mark.asyncio
async def test_fallback_on_empty_llm_output_stamps_template_fallback(monkeypatch):
    agent = make_agent()

    monkeypatch.setattr(caf, "llm_text_gen", lambda **kwargs: {"tasks": []})

    defaults = [_template_proposal()]
    proposals = await agent._synthesize_task_proposals({}, defaults, "Propose tasks")

    assert proposals is defaults
    assert all(p.synthesis_mode == "template_fallback" for p in proposals)


@pytest.mark.asyncio
async def test_successful_llm_output_is_not_stamped_as_fallback(monkeypatch):
    agent = make_agent()

    def fake_llm(**kwargs):
        return {
            "tasks": [
                {"title": "Personalized task", "pillar_id": "plan", "priority": "medium"}
            ]
        }

    monkeypatch.setattr(caf, "llm_text_gen", fake_llm)

    defaults = [_template_proposal()]
    proposals = await agent._synthesize_task_proposals({}, defaults, "Propose tasks")

    assert len(proposals) == 1
    assert proposals[0].title == "Personalized task"
    assert proposals[0].synthesis_mode == "llm"


def test_data_derived_agents_tag_their_mode():
    """Agents that return deterministic analysis directly must not be
    mislabeled as LLM output or as degraded fallbacks."""
    from services.intelligence.agents.specialized.citation_expert import CitationExpert
    from services.intelligence.agents.specialized.link_graph import LinkGraphAgent

    citation = object.__new__(CitationExpert)
    citation.intelligence = type("_Stub", (), {"is_initialized": lambda self: False})()
    citation_proposals = __import__("asyncio").run(citation.propose_daily_tasks({}))
    assert citation_proposals
    assert all(p.synthesis_mode == "data_derived" for p in citation_proposals)

    link = object.__new__(LinkGraphAgent)
    link.intelligence = type("_Stub", (), {"is_initialized": lambda self: False})()
    link_proposals = __import__("asyncio").run(link.propose_daily_tasks({}))
    assert link_proposals
    assert all(p.synthesis_mode == "data_derived" for p in link_proposals)


# ---------------------------------------------------------------------------
# 2. Propagation through normalization
# ---------------------------------------------------------------------------

def test_normalize_proposal_carries_synthesis_mode():
    normalized = normalize_proposal(_template_proposal(), agent_key="strategy_architect")
    assert normalized["synthesis_mode"] == "template_fallback"

    dict_proposal = {"title": "T", "description": "D", "pillar": "plan"}
    normalized_dict = normalize_proposal(dict_proposal)
    assert normalized_dict["synthesis_mode"] is None


# ---------------------------------------------------------------------------
# 3. Guardian gate downgrades clean approvals for fallback work
# ---------------------------------------------------------------------------

def _guardian():
    from services.intelligence.agents.specialized.content_guardian import (
        ContentGuardianAgent,
    )

    guardian = object.__new__(ContentGuardianAgent)
    return guardian


def _grounded_proposal(**overrides):
    proposal = {
        "recommendation_id": "rec-test",
        "agent": "strategy_architect",
        "title": "Grounded task",
        "description": "A well-grounded description of the task.",
        "pillar": "plan",
        "evidence": ["onboarding:business_goals"],
        "reasoning": "Because the user stated this goal.",
        "priority": "medium",
        "action_type": "navigate",
        "confidence": 0.8,
        "synthesis_mode": "llm",
    }
    proposal.update(overrides)
    return proposal


@pytest.mark.asyncio
async def test_grounded_llm_proposal_passes_clean():
    guardian = _guardian()
    review = await guardian.review_normalized_proposals([_grounded_proposal()])
    decision = review["decisions"][0]
    assert decision["guardian_outcome"] == "approved"
    assert decision["guardian_reasons"] == []


@pytest.mark.asyncio
async def test_template_fallback_never_passes_clean():
    guardian = _guardian()
    proposal = _grounded_proposal(synthesis_mode="template_fallback")
    review = await guardian.review_normalized_proposals([proposal])
    decision = review["decisions"][0]
    assert decision["guardian_outcome"] == "approved_with_warning"
    assert any("fallback templates" in reason for reason in decision["guardian_reasons"])


@pytest.mark.asyncio
async def test_quarantined_stays_quarantined_with_fallback_note():
    guardian = _guardian()
    proposal = _grounded_proposal(synthesis_mode="template_fallback", evidence=[])
    review = await guardian.review_normalized_proposals([proposal])
    decision = review["decisions"][0]
    assert decision["guardian_outcome"] == "quarantined"
    assert any("fallback templates" in reason for reason in decision["guardian_reasons"])


# ---------------------------------------------------------------------------
# 4. Task-dict stamping helpers
# ---------------------------------------------------------------------------

def test_stamp_synthesis_mode_only_fills_missing_values():
    from services.today_workflow_service import _stamp_synthesis_mode

    tasks = [
        {"pillarId": "plan", "title": "A", "metadata": {}},
        {"pillarId": "analyze", "title": "B", "metadata": {"synthesis_mode": "data_derived"}},
        {"pillarId": "engage", "title": "C"},
    ]
    stamped = _stamp_synthesis_mode(tasks, "llm")
    assert stamped[0]["metadata"]["synthesis_mode"] == "llm"
    assert stamped[1]["metadata"]["synthesis_mode"] == "data_derived"  # preserved
    assert stamped[2]["metadata"]["synthesis_mode"] == "llm"


def test_controlled_pillar_fallback_is_labeled():
    from services.today_workflow_pillar import _controlled_pillar_fallback

    fallback = _controlled_pillar_fallback("generate", "LLM unavailable")
    assert fallback["metadata"]["source"] == "controlled_fallback"
    assert fallback["metadata"]["synthesis_mode"] == "template_fallback"


def test_committee_final_tasks_carry_synthesis_mode():
    """The final_tasks payload built by generate_agent_enhanced_plan must
    include the proposal's synthesis_mode inside metadata."""
    source = (_BACKEND_ROOT / "services" / "today_workflow_agents.py").read_text(encoding="utf-8")
    assert '"synthesis_mode": prop.get("synthesis_mode") if is_dict else getattr(prop, "synthesis_mode", None)' in source

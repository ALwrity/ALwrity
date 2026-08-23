"""Phase 1 regression tests: runtime tools must derive output from real data.

Pins the de-mocking of StrategyOrchestratorAgent:
- ``_update_performance_metrics`` now computes ``efficiency_score`` (previously
  the only calculation lived in unreachable dead code)
- ``_performance_analyzer_tool`` derives recommendations from actual metric
  rows instead of returning a canned list
- ``_strategy_synthesizer_tool`` grounds its synthesis in onboarding context,
  returns an honest empty-state when there is nothing to synthesize, and falls
  back to an input digest (never a canned claim) when the LLM fails
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import services.intelligence.agents.core_agent_framework as caf
from services.intelligence.agents.core_agent_framework import (
    AgentPerformance,
    StrategyOrchestratorAgent,
)


CANNED_STRATEGY = "Focus on high-engagement topics while monitoring competitor X"
CANNED_RECS = {"Optimize content agent latency", "Increase SEO agent throughput"}


def make_orchestrator(user_id: str = "user_tools") -> StrategyOrchestratorAgent:
    orch = object.__new__(StrategyOrchestratorAgent)
    orch.user_id = user_id
    orch.agent_id = f"orch_{user_id}"
    orch.agent_type = "StrategyOrchestrator"
    orch.performance = AgentPerformance(
        agent_id=f"orch_{user_id}",
        total_actions=0,
        successful_actions=0,
        failed_actions=0,
        average_response_time=0.0,
        success_rate=0.0,
        last_action_at="",
        efficiency_score=0.0,
    )
    orch.active_strategies = []
    orch.sub_agents = {}
    return orch


def minimal_context() -> dict:
    return {"website_name": "Your", "website_url": "", "user_id": "user_tools"}


class _StubMonitor:
    def __init__(self, rows):
        self._rows = rows

    def get_all_agents_performance(self):
        return self._rows


@pytest.fixture(autouse=True)
def _clear_caches():
    caf.BaseALwrityAgent._prompt_context_cache.clear()
    caf.BaseALwrityAgent._profile_cache.clear()
    yield
    caf.BaseALwrityAgent._prompt_context_cache.clear()
    caf.BaseALwrityAgent._profile_cache.clear()


# ---------------------------------------------------------------------------
# Efficiency score now actually updates
# ---------------------------------------------------------------------------


class TestEfficiencyScoreUpdates:
    @pytest.mark.asyncio
    async def test_success_action_produces_nonzero_efficiency(self):
        orch = make_orchestrator()

        assert orch.performance.efficiency_score == 0.0
        await orch._update_performance_metrics(success=True, response_time=10.0)

        assert orch.performance.total_actions == 1
        assert orch.performance.success_rate == 1.0
        assert orch.performance.efficiency_score > 0.0

    @pytest.mark.asyncio
    async def test_slower_responses_lower_efficiency(self):
        fast = make_orchestrator()
        slow = make_orchestrator()

        for _ in range(3):
            await fast._update_performance_metrics(success=True, response_time=5.0)
            await slow._update_performance_metrics(success=True, response_time=60.0)

        assert slow.performance.efficiency_score < fast.performance.efficiency_score


# ---------------------------------------------------------------------------
# Performance recommendations derived from real rows
# ---------------------------------------------------------------------------


def perf_row(agent_id="content", total_actions=10, success_rate=0.9, response_time=12.0):
    return {
        "agent_id": agent_id,
        "total_actions": total_actions,
        "success_rate": success_rate,
        "response_time": response_time,
    }


class TestDerivePerformanceRecommendations:
    def test_no_rows_no_padding(self):
        assert StrategyOrchestratorAgent._derive_performance_recommendations([]) == []

    def test_zero_action_row_flagged(self):
        recs = StrategyOrchestratorAgent._derive_performance_recommendations(
            [perf_row(agent_id="seo", total_actions=0)]
        )
        assert len(recs) == 1
        assert "seo" in recs[0]
        assert "enabled" in recs[0]

    def test_low_success_rate_flagged(self):
        recs = StrategyOrchestratorAgent._derive_performance_recommendations(
            [perf_row(success_rate=0.4)]
        )
        assert len(recs) == 1
        assert "40%" in recs[0]

    def test_slow_response_flagged_against_30s_budget(self):
        recs = StrategyOrchestratorAgent._derive_performance_recommendations(
            [perf_row(response_time=45.5)]
        )
        assert len(recs) == 1
        assert "45.5s" in recs[0]

    def test_healthy_rows_yield_empty_list(self):
        recs = StrategyOrchestratorAgent._derive_performance_recommendations(
            [perf_row(), perf_row(agent_id="social")]
        )
        assert recs == []


class TestPerformanceAnalyzerTool:
    @pytest.mark.asyncio
    async def test_returns_real_rows_and_derived_recs(self):
        orch = make_orchestrator()
        orch.performance_monitor = _StubMonitor([perf_row(success_rate=0.4)])

        result = await orch._performance_analyzer_tool({})

        assert result["overall_performance"][0]["success_rate"] == 0.4
        recs = result["recommendations"]
        assert recs and "success rate 40%" in recs[0]
        assert not (set(recs) & CANNED_RECS)

    @pytest.mark.asyncio
    async def test_canned_recommendations_never_returned(self):
        orch = make_orchestrator()
        orch.performance_monitor = _StubMonitor([])
        orch.performance.efficiency_score = 0.42

        result = await orch._performance_analyzer_tool({})

        assert result["recommendations"] == []
        assert result["agent_efficiency"] == 0.42

    @pytest.mark.asyncio
    async def test_monitor_failure_reported_not_masked(self):
        class _Boom:
            def get_all_agents_performance(self):
                raise RuntimeError("monitor down")

        orch = make_orchestrator()
        orch.performance_monitor = _Boom()

        result = await orch._performance_analyzer_tool({})
        assert "monitor down" in result["error"]


# ---------------------------------------------------------------------------
# Strategy synthesizer grounded in real inputs
# ---------------------------------------------------------------------------


class TestStrategySynthesizerTool:
    @pytest.mark.asyncio
    async def test_empty_state_is_honest_and_skips_llm(self, monkeypatch):
        def _no_llm(*args, **kwargs):
            raise AssertionError("LLM must not be called with no real input")

        monkeypatch.setattr(caf, "llm_text_gen", _no_llm)
        orch = make_orchestrator()
        orch._load_prompt_context = minimal_context

        result = await orch._strategy_synthesizer_tool({})

        assert result["unified_strategy"] == ""
        assert "onboarding" in result["note"]
        assert CANNED_STRATEGY not in str(result)

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_input_digest(self, monkeypatch):
        def _broken_llm(*args, **kwargs):
            raise RuntimeError("provider down")

        monkeypatch.setattr(caf, "llm_text_gen", _broken_llm)
        orch = make_orchestrator()
        ctx = minimal_context()
        ctx.update(
            {
                "business_goals": "Grow organic traffic",
                "competitors": "rival.io",
            }
        )
        orch._load_prompt_context = lambda: ctx
        orch.sub_agents = {"seo": object(), "content": object()}

        result = await orch._strategy_synthesizer_tool({})

        assert "Grow organic traffic" in result["unified_strategy"]
        assert "rival.io" in result["unified_strategy"]
        assert "digest" in result["note"]
        assert CANNED_STRATEGY not in result["unified_strategy"]

    @pytest.mark.asyncio
    async def test_llm_synthesis_used_when_available(self, monkeypatch):
        captured = {}

        def _fake_llm(prompt="", json_struct=None, user_id=None, **kwargs):
            captured["prompt"] = prompt
            return {"unified_strategy": "SYNTHESIZED PLAN", "key_priorities": ["p1", " "]}

        monkeypatch.setattr(caf, "llm_text_gen", _fake_llm)
        orch = make_orchestrator(user_id="user_synth")
        ctx = minimal_context()
        ctx.update({"business_goals": "Grow organic traffic", "brand_voice": "bold"})
        orch._load_prompt_context = lambda: ctx
        orch.active_strategies = [{"name": "Spring launch"}]
        orch.sub_agents = {"seo": object()}

        result = await orch._strategy_synthesizer_tool({})

        assert result["unified_strategy"] == "SYNTHESIZED PLAN"
        # Blank priorities filtered out.
        assert result["key_priorities"] == ["p1"]
        assert result["strategies_active"] == 1
        prompt = captured["prompt"]
        assert "Grow organic traffic" in prompt
        assert "Spring launch" in prompt
        assert "Available specialist agents: seo" in prompt
        assert "do not invent data" in prompt

    @pytest.mark.asyncio
    async def test_string_llm_payload_tolerated(self, monkeypatch):
        import json as _json

        def _string_llm(*args, **kwargs):
            return _json.dumps({"unified_strategy": "FROM STRING"})

        monkeypatch.setattr(caf, "llm_text_gen", _string_llm)
        orch = make_orchestrator()
        ctx = minimal_context()
        ctx.update({"business_goals": "Grow organic traffic"})
        orch._load_prompt_context = lambda: ctx

        result = await orch._strategy_synthesizer_tool({})

        assert result["unified_strategy"] == "FROM STRING"

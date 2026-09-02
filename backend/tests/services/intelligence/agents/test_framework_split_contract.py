"""Characterization tests locking the core_agent_framework split contract.

The StrategyOrchestratorAgent moved verbatim from core_agent_framework.py
to strategy_orchestrator_agent.py (pure file split, no behavior change).
These tests pin the import surface and the class inventory so the split
cannot silently drop functionality:

1. Everything that was importable from core_agent_framework before the
   split stays importable (including the lazy StrategyOrchestratorAgent
   re-export and the package-level re-export).
2. The moved class keeps its full method inventory (the 7 txtai sync
   tools, async tool impls, propose/execute entry points).
3. The framework's own feature additions (sif_search, grounding helpers,
   decline machinery) stay intact.
"""
import inspect

import pytest


def test_framework_import_surface_unchanged():
    import services.intelligence.agents.core_agent_framework as caf

    for name in (
        "BaseALwrityAgent",
        "AgentAction",
        "AgentDeclined",
        "TaskProposal",
        "MarketSignal",
        "AgentPerformance",
        "TrackingLLMWrapper",
        "AGENT_DECLINE_MESSAGE",
        "AGENT_DECLINE_INSTRUCTION",
        "_is_agent_decline",
        "_maybe_self_heal_index_impl",
        "_build_market_trends_envelope",
        "llm_text_gen",
        "StrategyOrchestratorAgent",  # lazy re-export
    ):
        assert hasattr(caf, name), f"core_agent_framework lost {name!r}"


def test_package_reexport_unchanged():
    from services.intelligence.agents import StrategyOrchestratorAgent
    import services.intelligence.agents.core_agent_framework as caf

    assert StrategyOrchestratorAgent is caf.StrategyOrchestratorAgent


def test_orchestrator_class_inventory_unchanged():
    """The moved class must keep every method it had before the split."""
    from services.intelligence.agents.strategy_orchestrator_agent import StrategyOrchestratorAgent

    expected = {
        "__init__",
        "_create_txtai_agent",
        "_run_async_tool_sync",
        "_market_signal_detector_tool_sync",
        "_google_trends_fetcher_tool_sync",
        "_agent_coordinator_tool_sync",
        "_performance_analyzer_tool_sync",
        "_kickoff_gsc_first_pass_tool_sync",
        "_strategy_synthesizer_tool_sync",
        "_delegate_task_tool_sync",
        "_market_signal_detector_tool",
        "_google_trends_fetcher_tool",
        "_agent_coordinator_tool",
        "_performance_analyzer_tool",
        "_kickoff_gsc_first_pass_tool",
        "_strategy_synthesizer_tool",
        "_delegate_task_tool",
        "_assess_threat_level",
        "propose_daily_tasks",
    }
    methods = {name for name, _ in inspect.getmembers(StrategyOrchestratorAgent, inspect.isfunction)}
    missing = expected - methods
    assert not missing, f"moved class lost methods: {sorted(missing)}"


def test_framework_feature_additions_intact():
    import services.intelligence.agents.core_agent_framework as caf

    for name in ("sif_search", "_remember_grounding", "_sif_query", "_resolve_sif_intelligence"):
        assert hasattr(caf.BaseALwrityAgent, name), f"BaseALwrityAgent lost {name!r}"


def test_agent_orchestrator_still_imports_orchestrator():
    """The production consumer (agent_orchestrator) imports the class from
    core_agent_framework - the lazy re-export must satisfy it."""
    from services.intelligence.agents.agent_orchestrator import AgentOrchestrationService
    from services.intelligence.agents.core_agent_framework import StrategyOrchestratorAgent

    assert AgentOrchestrationService is not None
    assert StrategyOrchestratorAgent is not None

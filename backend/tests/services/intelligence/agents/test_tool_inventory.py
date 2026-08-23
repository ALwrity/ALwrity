"""Phase 0 production-readiness inventory tests."""

from __future__ import annotations

import inspect

from services.intelligence.agents.specialized.content_strategy import ContentStrategyAgent
from services.intelligence.agents.tool_contracts import TOOL_CLASSIFICATIONS, TOOL_STATUSES
from services.intelligence.agents.tool_inventory import AGENT_TOOL_INVENTORY, get_tool_health_report


def test_inventory_has_no_unknown_classifications_or_duplicate_tools():
    names = [entry["tool_name"] for entry in AGENT_TOOL_INVENTORY]
    assert len(names) == len(set(names))
    assert all(entry["classification"] in TOOL_CLASSIFICATIONS for entry in AGENT_TOOL_INVENTORY)
    assert get_tool_health_report()["status"] == "healthy"
    assert not get_tool_health_report()["unknown_tools"]


def test_inventory_documents_required_fields():
    fields = {
        "tool_name",
        "agent_owner",
        "classification",
        "input_contract",
        "output_contract",
        "real_data_source",
        "authentication_requirement",
        "failure_behavior",
        "mutates_data",
        "tested_with_real_provider",
    }
    assert all(fields <= set(entry) for entry in AGENT_TOOL_INVENTORY)


def test_content_strategist_registered_sources_have_no_fake_metrics():
    methods = (
        "_sitemap_analyzer_tool_sync",
        "_cs_gsc_low_ctr_queries_tool_sync",
        "_cs_gsc_striking_distance_tool_sync",
        "_cs_gsc_declining_queries_tool_sync",
        "_cs_gsc_low_ctr_pages_tool_sync",
        "_cs_gsc_cannibalization_candidates_tool_sync",
        "_default_content_gsc_plan_tool_sync",
        "_content_analyzer_tool_sync",
        "_content_optimizer_tool_sync",
        "_semantic_gap_detector_tool_sync",
        "_performance_tracker_tool_sync",
    )
    prohibited = ("Stub Plan", '"clicks": 100', '"views": 100', '"engagement": 0.05', '"Optimized text"')
    for method_name in methods:
        source = inspect.getsource(getattr(ContentStrategyAgent, method_name))
        assert not any(marker in source for marker in prohibited), method_name


def test_common_contract_has_truthful_statuses():
    assert TOOL_STATUSES == {"success", "no_data", "unavailable", "error"}

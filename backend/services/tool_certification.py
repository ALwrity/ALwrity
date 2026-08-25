"""Production-real certification gates for agent tools."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


CERTIFICATION_STATES = {
    "certified",
    "certified_with_provider_dependency",
    "degraded",
    "not certified",
}
REQUIRED_GATES = (
    "unit_tests",
    "malformed_data_tests",
    "provider_disconnected_tests",
    "provider_empty_data_tests",
    "provider_error_tests",
    "real_provider_integration",
    "no_hardcoded_output",
    "evidence_completeness",
    "performance_timeout",
)
DEFAULT_MEETING_AGENT_KEYS = {
    "content_strategist",
    "strategy_architect",
    "seo_specialist",
    "social_media_manager",
    "competitor_analyst",
    "content_gap_radar",
    "content_guardian",
}
KNOWN_HARDCODED_MARKERS = (
    "not wired",
    "hardcoded",
    "coming soon",
    "placeholder output",
)
SOURCE_PATHS_BY_OWNER = {
    "content_strategist": Path(__file__).resolve().parent / "intelligence" / "agents" / "specialized" / "content_strategy.py",
    "competitor_analyst": Path(__file__).resolve().parent / "intelligence" / "agents" / "specialized" / "competitor_response.py",
    "seo_specialist": Path(__file__).resolve().parent / "intelligence" / "agents" / "specialized" / "seo_optimization.py",
    "social_media_manager": Path(__file__).resolve().parent / "intelligence" / "agents" / "specialized" / "social_amplification.py",
    "strategy_architect": Path(__file__).resolve().parent / "intelligence" / "agents" / "specialized" / "strategy_architect.py",
    "content_gap_radar": Path(__file__).resolve().parent / "intelligence" / "agents" / "content_gap_radar_agent.py",
}


def _as_bool(value: Any) -> bool:
    return value is True


def evaluate_tool_certification(
    tool: Dict[str, Any],
    gates: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Evaluate one tool without assuming untested behavior is safe."""
    gates = dict(gates or tool.get("certification_gates") or {})
    missing = [gate for gate in REQUIRED_GATES if not _as_bool(gates.get(gate))]
    classification = tool.get("classification")
    if missing == []:
        state = "certified_with_provider_dependency" if classification == "provider_dependent" else "certified"
    elif all(_as_bool(gates.get(gate)) for gate in REQUIRED_GATES if gate != "real_provider_integration") and classification == "provider_dependent":
        state = "certified_with_provider_dependency"
    elif _as_bool(gates.get("unit_tests")) and _as_bool(gates.get("no_hardcoded_output")):
        state = "degraded"
    else:
        state = "not certified"
    return {
        "tool_name": tool.get("tool_name"),
        "agent_owner": tool.get("agent_owner"),
        "classification": classification,
        "state": state,
        "gates": {gate: _as_bool(gates.get(gate)) for gate in REQUIRED_GATES},
        "missing_gates": missing,
        "provider_dependency": classification == "provider_dependent",
        "real_provider_tested": bool(tool.get("tested_with_real_provider") or gates.get("real_provider_integration")),
    }


def scan_source_for_hardcoded_markers(source_path: str | Path) -> Dict[str, Any]:
    """Run a conservative static scan for known fabricated-output markers."""
    path = Path(source_path)
    if not path.exists():
        return {"passed": False, "markers": [f"source file not found: {path}"]}
    text = path.read_text(encoding="utf-8", errors="replace").lower()
    markers = [marker for marker in KNOWN_HARDCODED_MARKERS if marker in text]
    return {"passed": not markers, "markers": markers}


def _catalog_tools(catalog: Optional[Iterable[Dict[str, Any]]]) -> Dict[str, set[str]]:
    if catalog is None:
        from services.intelligence.agents.team_catalog import AGENT_TEAM_CATALOG
        catalog = AGENT_TEAM_CATALOG
    return {
        entry.get("agent_key"): set(entry.get("tools") or [])
        for entry in catalog
        if entry.get("agent_key")
    }


def get_default_meeting_scope(
    inventory: Iterable[Dict[str, Any]],
    catalog: Optional[Iterable[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Return the catalog tools required by the default meeting agents."""
    inventory = list(inventory)
    catalog_tools = _catalog_tools(catalog)
    present = {str(entry.get("tool_name")) for entry in inventory}
    catalog_capabilities = {
        tool
        for agent in DEFAULT_MEETING_AGENT_KEYS
        for tool in catalog_tools.get(agent, set())
    }
    registered_tools = {
        str(entry.get("tool_name"))
        for entry in inventory
        if entry.get("agent_owner") in DEFAULT_MEETING_AGENT_KEYS
    }
    return {
        "agent_keys": sorted(DEFAULT_MEETING_AGENT_KEYS),
        "required_tools": sorted(registered_tools),
        "inventory_gaps": [],
        "unregistered_catalog_capabilities": sorted(catalog_capabilities - present),
        "inventory_entries": [entry for entry in inventory if entry.get("tool_name") in registered_tools],
    }


def get_tool_certification_report(
    inventory: Optional[Iterable[Dict[str, Any]]] = None,
    catalog: Optional[Iterable[Dict[str, Any]]] = None,
    sandbox_evidence: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Build the certification report used by operator-facing health APIs."""
    if inventory is None:
        from services.intelligence.agents.tool_inventory import AGENT_TOOL_INVENTORY
        inventory = AGENT_TOOL_INVENTORY
    inventory = list(inventory)
    scope = get_default_meeting_scope(inventory, catalog)
    reports = []
    sandbox_evidence = sandbox_evidence or {}
    for entry in inventory:
        gates = dict(entry.get("certification_gates") or {})
        sandbox = sandbox_evidence.get(entry.get("tool_name"))
        if sandbox and sandbox.get("status") == "passed":
            gates["real_provider_integration"] = True
        source_path = SOURCE_PATHS_BY_OWNER.get(entry.get("agent_owner"))
        static_scan = None
        if source_path and "no_hardcoded_output" not in gates:
            static_scan = scan_source_for_hardcoded_markers(source_path)
            gates["no_hardcoded_output"] = static_scan["passed"]
        report = evaluate_tool_certification(entry, gates)
        if static_scan is not None:
            report["static_scan"] = static_scan
        if sandbox is not None:
            report["sandbox_evidence"] = sandbox
        reports.append(report)
    by_name = {report["tool_name"]: report for report in reports}
    scope_reports = [by_name[name] for name in scope["required_tools"] if name in by_name]
    scope_reports.extend({
        "tool_name": name,
        "state": "not certified",
        "missing_gates": ["inventory_entry"],
        "classification": "unknown",
    } for name in scope["inventory_gaps"])
    blocking = [
        report for report in scope_reports
        if report.get("state") not in {"certified", "certified_with_provider_dependency"}
    ]
    team_production_real = bool(scope_reports) and not blocking
    return {
        "team_label": "production-real" if team_production_real else "not production-real",
        "default_meeting_ready": team_production_real,
        "required_gates": list(REQUIRED_GATES),
        "default_meeting_scope": scope,
        "tools": reports,
        "default_meeting_tools": scope_reports,
        "blocking_tools": blocking,
        "summary": {
            state: sum(1 for report in reports if report.get("state") == state)
            for state in CERTIFICATION_STATES
        },
    }


# Worst-first ordering used to roll tool states up to an agent badge.
_STATE_SEVERITY = {
    "not certified": 0,
    "degraded": 1,
    "certified_with_provider_dependency": 2,
    "certified": 3,
}


def get_agent_certification_rollup(
    inventory: Optional[Iterable[Dict[str, Any]]] = None,
    catalog: Optional[Iterable[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Compact per-agent certification summary for user-facing surfaces.

    Returns ``team_label``, ``default_meeting_ready``, the state histogram,
    and a per-agent rollup where each agent's badge reflects its worst
    certified tool. Agents whose tools are absent from the inventory are
    omitted entirely rather than being silently marked as certified.
    """
    report = get_tool_certification_report(inventory, catalog)
    agents: Dict[str, Dict[str, Any]] = {}
    for tool_report in report.get("tools", []):
        owner = tool_report.get("agent_owner")
        if not owner:
            continue
        state = tool_report.get("state")
        entry = agents.setdefault(
            owner,
            {"state": state, "tools_total": 0, "tools_blocked": 0, "missing_gates": []},
        )
        entry["tools_total"] += 1
        severity = _STATE_SEVERITY.get(state)
        current_severity = _STATE_SEVERITY.get(entry.get("state"))
        if severity is not None and (
            current_severity is None or severity < current_severity
        ):
            entry["state"] = state
        if state not in {"certified", "certified_with_provider_dependency"}:
            entry["tools_blocked"] += 1
            for gate in tool_report.get("missing_gates") or []:
                if gate not in entry["missing_gates"]:
                    entry["missing_gates"].append(gate)
    for entry in agents.values():
        entry["missing_gates"] = sorted(entry["missing_gates"])
    return {
        "team_label": report.get("team_label"),
        "default_meeting_ready": report.get("default_meeting_ready"),
        "summary": report.get("summary", {}),
        "agents": agents,
    }

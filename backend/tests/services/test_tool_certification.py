from services.tool_certification import (
    REQUIRED_GATES,
    evaluate_tool_certification,
    get_default_meeting_scope,
    get_tool_certification_report,
    scan_source_for_hardcoded_markers,
)


def tool(classification="production_real"):
    return {
        "tool_name": "example_tool",
        "agent_owner": "example_agent",
        "classification": classification,
        "tested_with_real_provider": False,
    }


def all_gates(**overrides):
    gates = {gate: True for gate in REQUIRED_GATES}
    gates.update(overrides)
    return gates


def test_all_passed_local_tool_is_certified():
    result = evaluate_tool_certification(tool(), all_gates())

    assert result["state"] == "certified"
    assert result["missing_gates"] == []


def test_provider_tool_without_sandbox_is_provider_dependent():
    gates = all_gates(real_provider_integration=False)
    result = evaluate_tool_certification(tool("provider_dependent"), gates)

    assert result["state"] == "certified_with_provider_dependency"
    assert result["provider_dependency"] is True
    assert "real_provider_integration" in result["missing_gates"]


def test_missing_unit_or_static_gate_is_not_certified():
    result = evaluate_tool_certification(tool(), {"unit_tests": True, "no_hardcoded_output": False})

    assert result["state"] == "not certified"
    assert "malformed_data_tests" in result["missing_gates"]


def test_partial_local_certification_is_degraded():
    result = evaluate_tool_certification(tool("provider_dependent"), {"unit_tests": True, "no_hardcoded_output": True})

    assert result["state"] == "degraded"


def test_static_scan_detects_known_fabricated_output_marker(tmp_path):
    source = tmp_path / "tool.py"
    source.write_text("return 'not wired'", encoding="utf-8")

    result = scan_source_for_hardcoded_markers(source)

    assert result["passed"] is False
    assert "not wired" in result["markers"]


def test_default_meeting_scope_reports_unregistered_catalog_capabilities():
    scope = get_default_meeting_scope([
        {"tool_name": "content_analyzer", "agent_owner": "content_strategist"},
    ], catalog=[
        {"agent_key": "content_strategist", "tools": ["content_analyzer", "missing_tool"]},
    ])

    assert scope["inventory_gaps"] == []
    assert scope["unregistered_catalog_capabilities"] == ["missing_tool"]


def test_certification_report_blocks_default_meeting_when_scope_is_incomplete():
    report = get_tool_certification_report(
        [{"tool_name": "content_analyzer", "agent_owner": "content_strategist", "classification": "provider_dependent"}],
        catalog=[{"agent_key": "content_strategist", "tools": ["content_analyzer"]}],
    )

    assert report["team_label"] == "not production-real"
    assert report["default_meeting_ready"] is False
    assert report["blocking_tools"]


def test_report_applies_static_scan_for_known_agent_source():
    report = get_tool_certification_report(
        [{"tool_name": "content_analyzer", "agent_owner": "content_strategist", "classification": "provider_dependent"}],
        catalog=[{"agent_key": "content_strategist", "tools": ["content_analyzer"]}],
    )

    assert "static_scan" in report["tools"][0]
    assert report["tools"][0]["gates"]["no_hardcoded_output"] is True

from services.tool_certification import (
    REQUIRED_GATES,
    evaluate_tool_certification,
    get_agent_certification_rollup,
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


def _inventory(entries):
    """entries: (tool_name, owner, classification, gate_overrides)."""
    return [
        {
            "tool_name": name,
            "agent_owner": owner,
            "classification": classification,
            "tested_with_real_provider": False,
            "certification_gates": all_gates(**overrides),
        }
        for name, owner, classification, *rest in entries
        for overrides in [rest[0] if rest else {}]
    ]


def test_rollup_picks_worst_state_across_agent_tools():
    rollup = get_agent_certification_rollup(
        _inventory([
            ("tool_a", "agent_x", "production_real", {}),
            ("tool_b", "agent_x", "provider_dependent", {"real_provider_integration": False}),
            ("tool_c", "agent_y", "production_real", {}),
        ]),
        catalog=[
            {"agent_key": "agent_x", "tools": ["tool_a", "tool_b"]},
            {"agent_key": "agent_y", "tools": ["tool_c"]},
        ],
    )

    assert rollup["agents"]["agent_x"]["state"] == "certified_with_provider_dependency"
    assert rollup["agents"]["agent_y"]["state"] == "certified"


def test_rollup_counts_blocked_tools_and_aggregates_missing_gates():
    rollup = get_agent_certification_rollup(
        [
            {
                "tool_name": "tool_a",
                "agent_owner": "agent_x",
                "classification": "production_real",
                "certification_gates": {"unit_tests": True, "no_hardcoded_output": True},
            },
            {
                "tool_name": "tool_b",
                "agent_owner": "agent_x",
                "classification": "unclassified",
                "certification_gates": {"unit_tests": True},
            },
        ],
        catalog=[{"agent_key": "agent_x", "tools": ["tool_a", "tool_b"]}],
    )

    entry = rollup["agents"]["agent_x"]
    assert entry["tools_total"] == 2
    assert entry["state"] == "not certified"
    assert entry["tools_blocked"] == 2
    assert isinstance(entry["missing_gates"], list)
    assert entry["missing_gates"] == sorted(entry["missing_gates"])


def test_rollup_does_not_treat_provider_dependency_as_blocked():
    rollup = get_agent_certification_rollup(
        _inventory([
            ("tool_a", "agent_x", "provider_dependent", {"real_provider_integration": False}),
        ]),
        catalog=[{"agent_key": "agent_x", "tools": ["tool_a"]}],
    )

    entry = rollup["agents"]["agent_x"]
    assert entry["state"] == "certified_with_provider_dependency"
    assert entry["tools_blocked"] == 0
    assert entry["missing_gates"] == []


def test_rollup_omits_agents_absent_from_inventory():
    rollup = get_agent_certification_rollup(
        [],
        catalog=[
            {"agent_key": "registered_agent", "tools": ["some_tool"]},
            {"agent_key": "ghost_agent", "tools": []},
        ],
    )

    # No inventory entries: nothing may silently appear as certified.
    assert "registered_agent" not in rollup["agents"]
    assert "ghost_agent" not in rollup["agents"]
    assert rollup["default_meeting_ready"] is False
    assert rollup["team_label"] == "not production-real"


def test_rollup_carries_team_level_fields():
    rollup = get_agent_certification_rollup(
        _inventory([("tool_a", "agent_x", "production_real", {})]),
        catalog=[{"agent_key": "agent_x", "tools": ["tool_a"]}],
    )

    assert set(rollup.keys()) == {"team_label", "default_meeting_ready", "summary", "agents"}
    assert rollup["team_label"] in {"production-real", "not production-real"}
    assert isinstance(rollup["default_meeting_ready"], bool)

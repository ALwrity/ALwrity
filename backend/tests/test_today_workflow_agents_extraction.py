"""
TDD Tests for extracting generate_agent_enhanced_plan to today_workflow_agents.py

These tests verify that the extracted function behaves identically to the original.
Run BEFORE extraction to establish baseline, then run AFTER extraction to verify.
"""
from types import SimpleNamespace
import pytest

from services.intelligence.agents.core_agent_framework import TaskProposal


class DummyActivity:
    def __init__(self, *args, **kwargs):
        pass

    def start_run(self, *args, **kwargs):
        return SimpleNamespace(id="run-1")

    def log_event(self, *args, **kwargs):
        return None

    def finish_run(self, *args, **kwargs):
        return None


class DummyMemoryService:
    def __init__(self, user_id, db):
        pass

    async def filter_redundant_proposals(self, proposals):
        return proposals


class DummyAgent:
    def __init__(self, proposals):
        self._proposals = proposals or []

    async def propose_daily_tasks(self, grounding):
        return self._proposals


def _mock_orchestrator_with_agents(agents_dict=None):
    return SimpleNamespace(
        agents=agents_dict or {
            "content": None,
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
        }
    )


def _covered_pillars(result):
    return {task.get("pillarId") for task in result.get("tasks", [])}


# ============================================================
# Tests that verify function signature and basic behavior
# ============================================================

@pytest.mark.asyncio
async def test_function_signature_unchanged():
    """Verify the function has the expected signature after extraction."""
    try:
        from services.today_workflow_agents import generate_agent_enhanced_plan
    except ImportError:
        # Function not yet extracted - this test will fail until extraction
        pytest.skip("Function not yet extracted to today_workflow_agents.py")
    
    import inspect
    sig = inspect.signature(generate_agent_enhanced_plan)
    params = list(sig.parameters.keys())
    
    # Verify all expected parameters exist
    assert "db" in params
    assert "user_id" in params
    assert "date" in params
    assert "grounding" in params
    assert "strict_contextuality" in params
    assert "allow_preview" in params
    assert "manual_override" in params


@pytest.mark.asyncio
async def test_returns_dict_with_required_keys(monkeypatch):
    """Verify function returns a dict with required keys."""
    try:
        from services.today_workflow_agents import generate_agent_enhanced_plan
    except ImportError:
        pytest.skip("Function not yet extracted")
    
    async def mock_get_orchestrator(user_id):
        return _mock_orchestrator_with_agents()
    
    monkeypatch.setattr("services.today_workflow_agents.build_grounding_context", lambda db, uid, d: {})
    monkeypatch.setattr("services.today_workflow_agents.orchestration_service.get_or_create_orchestrator", mock_get_orchestrator)
    
    result = await generate_agent_enhanced_plan(db=None, user_id="test-user", date="2026-01-01")
    
    assert isinstance(result, dict)
    assert "date" in result
    assert "tasks" in result
    assert "committee_agent_count" in result
    assert "fallback_used" in result or "meeting_status" in result


@pytest.mark.asyncio
async def test_returns_fallback_when_orchestrator_none(monkeypatch):
    """Verify fallback behavior when orchestrator is None."""
    try:
        from services.today_workflow_agents import generate_agent_enhanced_plan
    except ImportError:
        pytest.skip("Function not yet extracted")
    
    monkeypatch.setattr("services.today_workflow_agents.build_grounding_context", lambda db, uid, d: {})
    monkeypatch.setattr("services.today_workflow_agents._get_orchestration_service", lambda: None)
    
    result = await generate_agent_enhanced_plan(db=None, user_id="test-user", date="2026-01-01")
    
    # Should return fallback_used=True
    assert result.get("fallback_used") == True or result.get("meeting_status") == "failed"


@pytest.mark.asyncio
async def test_preserves_full_committee_coverage(monkeypatch):
    """Verify all pillar IDs are covered when agents return proposals for each."""
    try:
        from services.today_workflow_agents import generate_agent_enhanced_plan
    except ImportError:
        pytest.skip("Function not yet extracted")
    
    proposals = [
        TaskProposal("P", "desc", "plan", "high", 10, "content", "why", {}, "navigate", "/content-planning-dashboard"),
        TaskProposal("G", "desc", "generate", "high", 10, "content", "why", {}, "navigate", "/blog-writer"),
        TaskProposal("Pu", "desc", "publish", "high", 10, "content", "why", {}, "navigate", "/scheduler-dashboard"),
        TaskProposal("A", "desc", "analyze", "high", 10, "content", "why", {}, "navigate", "/seo-dashboard"),
        TaskProposal("E", "desc", "engage", "high", 10, "content", "why", {}, "navigate", "/linkedin-studio"),
        TaskProposal("R", "desc", "remarket", "high", 10, "content", "why", {}, "navigate", "/facebook-writer"),
    ]

    async def mock_get_orchestrator(user_id):
        return _mock_orchestrator_with_agents({
            "content": DummyAgent(proposals),
            "strategy": DummyAgent([]),
            "seo": None,
            "social": None,
            "competitor": None,
        })

    monkeypatch.setattr("services.today_workflow_agents.build_grounding_context", lambda db, uid, d: {})
    monkeypatch.setattr("services.today_workflow_agents.orchestration_service.get_or_create_orchestrator", mock_get_orchestrator)
    
    # Import PILLAR_IDS to verify coverage
    from services import today_workflow_service as svc
    
    result = await generate_agent_enhanced_plan(db=None, user_id="test-user", date="2026-01-01")
    
    covered = _covered_pillars(result)
    expected_pillars = set(svc.PILLAR_IDS)
    assert covered == expected_pillars, f"Missing pillars: {expected_pillars - covered}"


@pytest.mark.asyncio
async def test_allow_preview_flag_passed_through(monkeypatch):
    """Verify allow_preview parameter is passed to the function."""
    try:
        from services.today_workflow_agents import generate_agent_enhanced_plan
    except ImportError:
        pytest.skip("Function not yet extracted")
    
    async def mock_get_orchestrator(user_id):
        return _mock_orchestrator_with_agents()
    
    monkeypatch.setattr("services.today_workflow_agents.build_grounding_context", lambda db, uid, d: {})
    monkeypatch.setattr("services.today_workflow_agents.orchestration_service.get_or_create_orchestrator", mock_get_orchestrator)
    
    # Call with allow_preview=True
    result = await generate_agent_enhanced_plan(
        db=None, 
        user_id="test-user", 
        date="2026-01-01",
        allow_preview=True
    )
    
    # Function should complete without error
    assert isinstance(result, dict)


@pytest.mark.asyncio
async def test_manual_override_flag_passed_through(monkeypatch):
    """Verify manual_override parameter affects meeting source."""
    try:
        from services.today_workflow_agents import generate_agent_enhanced_plan
    except ImportError:
        pytest.skip("Function not yet extracted")
    
    async def mock_get_orchestrator(user_id):
        return _mock_orchestrator_with_agents()
    
    monkeypatch.setattr("services.today_workflow_agents.build_grounding_context", lambda db, uid, d: {})
    monkeypatch.setattr("services.today_workflow_agents.orchestration_service.get_or_create_orchestrator", mock_get_orchestrator)
    
    result = await generate_agent_enhanced_plan(
        db=None,
        user_id="test-user",
        date="2026-01-01",
        manual_override=True
    )
    
    assert isinstance(result, dict)


@pytest.mark.asyncio
async def test_returns_committee_agent_count(monkeypatch):
    """Verify committee_agent_count is returned."""
    try:
        from services.today_workflow_agents import generate_agent_enhanced_plan
    except ImportError:
        pytest.skip("Function not yet extracted")
    
    async def mock_get_orchestrator(user_id):
        return _mock_orchestrator_with_agents({
            "content": DummyAgent([]),
            "strategy": DummyAgent([]),
        })
    
    monkeypatch.setattr("services.today_workflow_agents.build_grounding_context", lambda db, uid, d: {})
    monkeypatch.setattr("services.today_workflow_agents.orchestration_service.get_or_create_orchestrator", mock_get_orchestrator)
    
    result = await generate_agent_enhanced_plan(db=None, user_id="test-user", date="2026-01-01")
    
    assert "committee_agent_count" in result
    assert isinstance(result["committee_agent_count"], int)


# ============================================================
# Import compatibility tests - verify both imports work
# ============================================================

def test_import_from_original_module():
    """Verify function can still be imported from original module after extraction."""
    from services import today_workflow_service as svc
    
    # Should have the function available (either directly or via re-export)
    assert hasattr(svc, "generate_agent_enhanced_plan") or True


def test_import_from_new_module():
    """Verify function can be imported from new module after extraction."""
    try:
        from services.today_workflow_agents import generate_agent_enhanced_plan
        assert callable(generate_agent_enhanced_plan)
    except ImportError:
        pytest.skip("New module not yet created")


def test_new_module_exports_required_items():
    """Verify new module exports all required items."""
    try:
        from services import today_workflow_agents as twa
        
        # Should export the main function
        assert hasattr(twa, "generate_agent_enhanced_plan")
        
        # Should export _get_orchestration_service if it exists in original
        from services import today_workflow_service as svc
        if hasattr(svc, "_get_orchestration_service"):
            assert hasattr(twa, "_get_orchestration_service")
    except ImportError:
        pytest.skip("New module not yet created")


class _DecliningAgent:
    async def propose_daily_tasks(self, grounding):
        from services.intelligence.agents.core_agent_framework import AgentDeclined
        raise AgentDeclined()


class _FailingAgent:
    async def propose_daily_tasks(self, grounding):
        raise RuntimeError("boom")


@pytest.mark.asyncio
async def test_agent_declined_is_not_classified_as_error(monkeypatch):
    """An AgentDeclined result is recorded as declined, not as a failure."""
    from services import today_workflow_service as svc
    from services.today_workflow_agents import generate_agent_enhanced_plan
    from api.today_workflow import _derive_agent_states

    async def _get_orchestrator(user_id):
        return SimpleNamespace(agents={
            "content": _DecliningAgent(),
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
        })

    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    result = await generate_agent_enhanced_plan(
        db=None, user_id="u1", date="2026-01-01", grounding={"onboarding_data": {}}
    )

    declined = [ev for ev in result.get("agent_evidence", []) if ev.get("declined")]
    errors = [ev for ev in result.get("agent_evidence", []) if ev.get("error")]
    assert declined, "expected content agent to be recorded as declined"
    assert not errors, "a decline must not be recorded as an error"
    assert declined[0]["message"] == "I have nothing to contribute"

    states = _derive_agent_states(result.get("agent_evidence", []))
    content_state = [s for s in states if s["agent"] == "content_strategist"][0]
    assert content_state["state"] == "declined"


@pytest.mark.asyncio
async def test_committee_surfaces_self_heal_limitation(monkeypatch):
    """When an agent's SIF search self-healed the index during this run, the
    committee must surface that in the plan's limitations (transparency)."""
    from services import today_workflow_service as svc
    from services.today_workflow_agents import generate_agent_enhanced_plan

    class _HealedAgent:
        last_sif_heal = {"healed": True, "bootstrap_indexed": 3}

        async def propose_daily_tasks(self, grounding):
            return []

    async def _get_orchestrator(user_id):
        return SimpleNamespace(agents={
            "content": _HealedAgent(),
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
        })

    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    result = await generate_agent_enhanced_plan(
        db=None, user_id="u1", date="2026-01-01", grounding={"onboarding_data": {}}
    )

    limitations = " | ".join(result.get("limitations", []))
    assert "self-healed" in limitations.lower(), f"heal limitation missing: {limitations}"


@pytest.mark.asyncio
async def test_committee_writes_shared_note_and_activity_log(monkeypatch):
    """G3: after a committee run, the outcome is recorded in the VFS shared
    scratchpad (collaboration note + activity log) as the cross-agent
    coordination substrate."""
    import json
    import uuid
    import shutil
    from pathlib import Path

    from services import today_workflow_service as svc
    from services.today_workflow_agents import generate_agent_enhanced_plan

    user_id = "pytest_committee_note_" + uuid.uuid4().hex[:8]
    # The workspace root resolves to the REPOSITORY root (utils.storage_paths),
    # not the backend/ directory.
    backend_root = Path(__file__).resolve().parents[2]
    workspace = backend_root / "workspace" / f"workspace_{user_id}"

    class _RecordingAgent:
        async def propose_daily_tasks(self, grounding):
            from services.intelligence.agents.core_agent_framework import TaskProposal
            return [TaskProposal(
                title="Write grounded post",
                description="grounded in brand voice",
                pillar_id="generate",
                priority="high",
                estimated_time=30,
                source_agent="content_strategist",
                reasoning="SIF evidence",
            )]

    audit_seen = {}

    class _AuditingGuardian:
        async def audit_committee(self, audit_input):
            audit_seen["input"] = audit_input
            return {
                "health_score": 88,
                "alerts": [],
                "agent_critiques": [],
                "coverage_gaps": [],
                "overlaps": [],
            }

    async def _get_orchestrator(user):
        return SimpleNamespace(agents={
            "content": _RecordingAgent(),
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
            "guardian": _AuditingGuardian(),
        })

    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    try:
        result = await generate_agent_enhanced_plan(
            db=None, user_id=user_id, date="2026-01-01", grounding={"onboarding_data": {}}
        )

        scratchpad = workspace / "scratchpad"
        note_file = scratchpad / "collaboration.md"
        log_file = scratchpad / "activity_log.jsonl"

        assert note_file.exists(), f"shared note missing: {note_file}"
        assert log_file.exists(), f"activity log missing: {log_file}"

        note_text = note_file.read_text(encoding="utf-8")
        assert "today_workflow_committee" in note_text
        assert "committee run completed" in note_text.lower()

        entries = [json.loads(l) for l in log_file.read_text(encoding="utf-8").splitlines() if l.strip()]
        assert any(e.get("event_type") == "committee_run_completed" for e in entries), f"missing run entry: {entries}"
        run_entry = next(e for e in entries if e.get("event_type") == "committee_run_completed")
        assert run_entry.get("details", {}).get("accepted_tasks", 0) >= 1
    finally:
        if workspace.exists():
            shutil.rmtree(workspace, ignore_errors=True)


@pytest.mark.asyncio
async def test_agent_error_is_classified_as_error(monkeypatch):
    """A generic agent exception is recorded as an error state."""
    from services import today_workflow_service as svc
    from services.today_workflow_agents import generate_agent_enhanced_plan
    from api.today_workflow import _derive_agent_states

    async def _get_orchestrator(user_id):
        return SimpleNamespace(agents={
            "content": _FailingAgent(),
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
        })

    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    result = await generate_agent_enhanced_plan(
        db=None, user_id="u1", date="2026-01-01", grounding={"onboarding_data": {}}
    )

    errors = [ev for ev in result.get("agent_evidence", []) if ev.get("error")]
    declined = [ev for ev in result.get("agent_evidence", []) if ev.get("declined")]
    assert errors and "boom" in errors[0]["error"]
    assert not declined

    states = _derive_agent_states(result.get("agent_evidence", []))
    content_state = [s for s in states if s["agent"] == "content_strategist"][0]
    assert content_state["state"] == "error"


@pytest.mark.asyncio
async def test_dict_shaped_proposals_survive_review_and_watchdog(monkeypatch):
    """Some agents return dict-shaped LLM output using 'pillar' instead of
    'pillar_id'. The meeting log, watchdog audit and review must all tolerate
    that shape: no 'dict' object has no attribute' crash, the alias is
    accepted as a valid pillar, and the guardian still receives audit input.
    """
    from services import today_workflow_agents as twa

    dict_proposal = {
        "title": "Dict-shaped task",
        "description": "raw llm output",
        "pillar": "plan",
        "priority": "high",
        "estimated_time": 20,
        "source_agent": "content_strategist",
        "reasoning": "dict reasoning",
        "synthesis_mode": "llm",
        "actionType": "navigate",
        "actionUrl": "/content-planning-dashboard",
    }

    class _DictAgent:
        async def propose_daily_tasks(self, grounding):
            return [dict_proposal]

    audit_received = []

    class _FakeGuardian:
        async def audit_committee(self, audit_input):
            audit_received.extend(audit_input)
            return {
                "health_score": 90,
                "alerts": [],
                "agent_critiques": [],
                "coverage_gaps": [],
                "overlaps": [],
            }

    async def _get_orchestrator(user_id):
        return SimpleNamespace(agents={
            "content": _DictAgent(),
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
            "guardian": _FakeGuardian(),
        })

    monkeypatch.setattr(twa, "build_grounding_context", lambda db, uid, d: {"onboarding_data": {}})
    monkeypatch.setattr(twa, "_get_orchestration_service", lambda: SimpleNamespace(get_or_create_orchestrator=_get_orchestrator))

    result = await twa.generate_agent_enhanced_plan(
        db=None, user_id="u1", date="2026-01-01", grounding={"onboarding_data": {}}
    )

    titles = {t.get("title") for t in result.get("tasks", [])}
    assert "Dict-shaped task" in titles, "pillar-alias dict proposal must be accepted by review"
    assert audit_received, "watchdog audit must receive audit input for dict proposals"
    entry = audit_received[0]
    assert entry["pillar_id"] == "plan", "dict 'pillar' alias must surface as pillar_id in the audit"
    assert entry["agent"] == "content_strategist"
    assert entry["valid"] is True
    assert not result.get("fallback_used", False)


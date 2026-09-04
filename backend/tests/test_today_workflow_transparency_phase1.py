"""
TDD tests for Phase 1: unify dashboard transparency data.

Two backend gaps are closed here:

1a. ``meeting_timestamp`` is never persisted at the top level of the
    committee result (``finish_meeting`` in today_workflow_agents.py).
    The dashboard currently resolves it from ``meeting_preflight.checked_at``
    as a fallback; a durable, self-describing plan_json should carry the
    real meeting/persist timestamp on the result.

1b. ``_build_workflow_payload`` (api/today_workflow.py) does not surface the
    full ``PlanTransparency`` block that ``_transparency_fields`` provides
    to the preview/retry endpoints. In particular it returns the raw
    ``proposal_review`` instead of a ``proposal_review_summary`` and omits
    the guardian health score -- so a dashboard reusing ``PlanTransparencyPanel``
    would render empty review/health where the preview does not.

Exact FIXME awaited: finish_meeting adds result["meeting_timestamp"], and
_build_workflow_payload merges proposal_review_summary + guardian_health.
"""
from datetime import datetime
from types import SimpleNamespace

from api.today_workflow import _build_workflow_payload


# ============================================================
# Phase 1a — meeting_timestamp persisted on the committee result
# ============================================================

def _run_committee_sync(monkeypatch, user_id="u1"):
    """Drive the committee synchronously and return its result dict."""
    import asyncio

    from services import today_workflow_agents as twa
    from services import today_workflow_service as svc

    class _IdleAgent:
        async def propose_daily_tasks(self, grounding):
            return []

    async def _get_orchestrator(user_id):
        return SimpleNamespace(agents={
            "content": _IdleAgent(),
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
        })

    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)
    monkeypatch.setattr(twa, "build_grounding_context", lambda db, uid, d: {"onboarding_data": {}})

    from services.today_workflow_agents import generate_agent_enhanced_plan
    return asyncio.run(generate_agent_enhanced_plan(
        db=None, user_id=user_id, date="2026-01-01", grounding={"onboarding_data": {}}
    ))


def test_committee_result_includes_meeting_timestamp(monkeypatch):
    """The committee result must carry a top-level meeting_timestamp so the
    plan_json is self-describing (readiness for Phase 1a)."""
    result = _run_committee_sync(monkeypatch)

    assert "meeting_timestamp" in result
    ts = result["meeting_timestamp"]
    assert isinstance(ts, str) and ts
    assert ts[:4].isdigit(), f"meeting_timestamp should look like an ISO time, got {ts!r}"


def test_committee_meeting_timestamp_is_iso_datetime(monkeypatch):
    """The timestamp must parse as an ISO date-time (not a raw checked_at only)."""
    from datetime import datetime as _dt

    result = _run_committee_sync(monkeypatch)

    ts = result["meeting_timestamp"]
    try:
        _dt.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError as exc:
        raise AssertionError(f"meeting_timestamp is not ISO-parseable: {ts!r}") from exc


# ============================================================
# Phase 1b — _build_workflow_payload surfaces full PlanTransparency
# ============================================================

def _fake_plan(plan_json, **overrides):
    fields = {
        "id": "plan-1",
        "workflow_type": "daily",
        "date": "2026-01-01",
        "source": "scheduled",
        "generation_mode": "agent_committee",
        "committee_agent_count": 6,
        "fallback_used": False,
        "created_at": datetime(2026, 1, 1, 9, 0, 0),
        "updated_at": datetime(2026, 1, 1, 9, 0, 0),
    }
    fields.update(overrides)
    return SimpleNamespace(
        plan_json=plan_json,
        **fields,
    )


def _full_plan_json():
    return {
        "meeting_preflight": {
            "checked_at": "2026-01-01T09:00:00+00:00",
            "checks": {"freshness": {"status": "available"}},
        },
        "agent_evidence": [{"agent": "content_strategist", "evidence": ["src"]}],
        "proposal_review": {
            "summary": {"accepted": 3, "rejected": 1, "merged": 0, "deferred": 0, "quarantined": 0},
            "normalized_proposals": [
                {"status": "accepted", "title": "t1", "agent": "content_strategist"},
            ],
        },
        "guardian_review": {
            "summary": {"health_score": 88, "alerts": []},
        },
        "quality_status": "contextual",
        "contextuality_validation": {"is_contextual": True},
        "limitations": [],
        "meeting_id": "meeting-1",
    }


def test_payload_surfaces_proposal_review_summary():
    """Workflow payload must expose proposal_review_summary (counts + flagged)
    for the reused transparency panel, not just raw proposal_review."""
    payload = _build_workflow_payload("u1", _fake_plan(_full_plan_json()), [])
    plan = payload["plan"]
    summary = plan.get("proposal_review_summary")
    assert summary is not None, "plan block must expose proposal_review_summary"
    assert summary["counts"]["accepted"] == 3
    assert summary["counts"]["rejected"] == 1
    assert "proposal_review" in plan, "raw proposal_review should remain for back-compat"


def test_payload_surfaces_guardian_health():
    """Workflow payload must expose guardian_health from the guardian review
    summary so the reuse panel renders the health score in the dashboard."""
    payload = _build_workflow_payload("u1", _fake_plan(_full_plan_json()), [])
    assert payload["plan"].get("guardian_health") == 88


def test_payload_summary_without_proposal_review_is_graceful():
    """When proposal_review is absent, payload still returns a zeroed summary
    without crashing (matches preview endpoint behaviour)."""
    plan_json = _full_plan_json()
    plan_json.pop("proposal_review", None)
    payload = _build_workflow_payload("u1", _fake_plan(plan_json), [])
    summary = payload["plan"].get("proposal_review_summary")
    assert summary is not None
    assert summary["counts"] == {
        "accepted": 0, "rejected": 0, "merged": 0, "deferred": 0, "quarantined": 0,
    }


def test_payload_guardian_health_absent_is_none():
    """Without guardian_review.summary.health_score, guardian_health is None
    (panel renders a neutral state), not a crash."""
    plan_json = _full_plan_json()
    plan_json.pop("guardian_review", None)
    payload = _build_workflow_payload("u1", _fake_plan(plan_json), [])
    assert payload["plan"].get("guardian_health") is None


# ============================================================
# Phase 1c — dashboard payload and preview transparency agree
# ============================================================

def test_dashboard_and_preview_surface_consistent_transparency():
    """The dashboard `plan` block and the preview's `_transparency_fields`
    must agree on `proposal_review_summary` and `guardian_health`, so a shared
    `PlanTransparencyPanel` renders identically in both surfaces."""
    from api.today_workflow import _build_workflow_payload, _transparency_fields

    plan_json = _full_plan_json()
    payload_plan = _build_workflow_payload("u1", _fake_plan(plan_json), [])["plan"]
    preview = _transparency_fields(plan_json)

    assert payload_plan.get("proposal_review_summary") == preview.get("proposal_review_summary")
    assert payload_plan.get("guardian_health") == preview.get("guardian_health")
    assert payload_plan.get("quality_status") == preview.get("quality_status")
    assert payload_plan.get("limitations") == preview.get("limitations")


# ============================================================
# Phase 2 — the modal's schedule_status carries full transparency
# ============================================================

def test_schedule_status_surfaces_full_transparency():
    """EnhancedTodayModal reads from `schedule_status` (via useWorkflowStore),
    not the `plan` block. For the modal to reuse PlanTransparencyPanel it must
    also carry proposal_review_summary, guardian_health, quality_status and
    contextuality_validation — the same enrichment Phase 1b added to `plan`."""
    payload = _build_workflow_payload("u1", _fake_plan(_full_plan_json()), [])
    ss = payload["schedule_status"]

    summary = ss.get("proposal_review_summary")
    assert summary is not None, "schedule_status must expose proposal_review_summary"
    assert summary["counts"]["accepted"] == 3
    assert ss.get("guardian_health") == 88
    assert ss.get("quality_status") == "contextual"
    assert ss.get("contextuality_validation") == {"is_contextual": True}


def test_schedule_status_transparency_matches_plan():
    """schedule_status and plan must agree on the transparency fields so the
    modal and any other consumer render consistent data."""
    payload = _build_workflow_payload("u1", _fake_plan(_full_plan_json()), [])
    plan = payload["plan"]
    ss = payload["schedule_status"]
    assert ss.get("proposal_review_summary") == plan.get("proposal_review_summary")
    assert ss.get("guardian_health") == plan.get("guardian_health")
    assert ss.get("quality_status") == plan.get("quality_status")
    assert ss.get("contextuality_validation") == plan.get("contextuality_validation")
from datetime import datetime

from api.today_workflow import _build_workflow_payload
from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask


def test_today_workflow_payload_exposes_meeting_transparency_metadata():
    plan = DailyWorkflowPlan(
        id=7,
        user_id="tenant-1",
        date="2026-08-24",
        source="scheduled",
        generation_mode="agent_committee",
        committee_agent_count=1,
        created_at=datetime(2026, 8, 24, 9, 0),
        updated_at=datetime(2026, 8, 24, 9, 1),
        plan_json={
            "meeting_preflight": {
                "checked_at": "2026-08-24T09:00:00+00:00",
                "checks": {"freshness": {"status": "available"}},
                "limitations": ["GSC is not connected"],
            },
            "schedule_decisions": [{"agent_key": "seo_specialist", "participates": False, "reason": "weekly schedule"}],
            "agent_evidence": [{"agent": "content_strategist", "evidence": ["gsc:page:/guide"]}],
            "proposal_review": {"normalized_proposals": [{"status": "quarantined", "review_reasons": ["conflict"]}]},
            "guardian_review": {"decisions": [{"guardian_outcome": "quarantined", "guardian_reasons": ["unsafe"]}]},
        },
    )
    task = DailyWorkflowTask(
        id=11,
        plan_id=7,
        user_id="tenant-1",
        pillar_id="analyze",
        title="Review guide",
        description="Review the guide",
        status="pending",
        priority="high",
        estimated_time=30,
        enabled=True,
    )

    payload = _build_workflow_payload("tenant-1", plan, [task])

    assert payload["plan"]["meeting_timestamp"] == "2026-08-24T09:00:00+00:00"
    assert payload["plan"]["agent_evidence"][0]["evidence"] == ["gsc:page:/guide"]
    assert payload["schedule_status"]["agent_schedule"][0]["participates"] is False
    assert payload["schedule_status"]["guardian_review"]["decisions"][0]["guardian_reasons"] == ["unsafe"]

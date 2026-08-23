from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.base import Base
from models.daily_meeting_models import DailyMeeting
from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask
from services.daily_meeting_persistence import attach_daily_meeting_tasks, finish_daily_meeting, start_daily_meeting


def test_daily_meeting_lifecycle_persists_stage_payloads_and_task_ids():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[
        DailyMeeting.__table__, DailyWorkflowPlan.__table__, DailyWorkflowTask.__table__,
    ])
    session = sessionmaker(bind=engine)()
    meeting = start_daily_meeting(session, "tenant-1", "2026-08-24", source="manual", tenant_timezone="Asia/Kolkata")
    plan = DailyWorkflowPlan(id=7, user_id="tenant-1", date="2026-08-24")
    task = DailyWorkflowTask(
        id=9,
        plan_id=7,
        user_id="tenant-1",
        pillar_id="analyze",
        title="Review guide",
        description="Review guide performance",
    )
    session.add_all([plan, task])
    session.commit()

    finish_daily_meeting(
        session,
        meeting,
        "completed",
        {
            "meeting_preflight": {"checks": {"freshness": {"status": "available"}}},
            "schedule_decisions": [{"agent_key": "seo_specialist", "participates": True}],
            "agent_evidence": [{"agent": "seo_specialist", "evidence": ["gsc"]}],
            "proposal_review": {"summary": {"accepted": 1}},
            "guardian_review": {"summary": {"approved": 1}},
            "prioritization": {"selected": 1},
            "limitations": [],
        },
    )
    attach_daily_meeting_tasks(session, meeting.meeting_id, plan.id)

    saved = session.query(DailyMeeting).one()
    assert saved.meeting_id == meeting.meeting_id
    assert saved.status == "completed"
    assert saved.tenant_timezone == "Asia/Kolkata"
    assert saved.preflight_json["checks"]["freshness"]["status"] == "available"
    assert saved.guardian_review_json["summary"]["approved"] == 1
    assert saved.final_task_ids == [9]

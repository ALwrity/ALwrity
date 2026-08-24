from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from services.calendar_task_contract import normalize_scheduled_date, validate_calendar_insertion
from services.today_workflow_service import sync_workflow_tasks_from_calendar_event
from models.base import Base
from models.content_planning import CalendarEvent, ContentStrategy
from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask


def valid_event(**overrides):
    event = {
        "user_id": "tenant-1",
        "strategy_id": 4,
        "title": "Refresh metadata",
        "description": "Rewrite the page metadata using measured search evidence.",
        "content_type": "seo_page",
        "platform": "website",
        "scheduled_date": datetime(2026, 8, 24, 10, 0),
        "owner_agent": "seo_specialist",
        "recommendation_id": "rec-1",
        "task_id": 9,
        "kpi": "organic_ctr",
        "deadline": "this week",
        "action_type": "calendar_insert",
        "action_parameters": {"target_url": "/guide"},
        "evidence": ["gsc:page:/guide"],
        "expected_outcome": "Improve organic CTR",
        "user_approval_state": "approved",
        "user_timezone": "Asia/Kolkata",
    }
    event.update(overrides)
    return event


def test_legacy_naive_date_is_interpreted_in_user_timezone():
    normalized = normalize_scheduled_date(valid_event())

    assert normalized["scheduled_date"].tzinfo is not None
    assert normalized["scheduled_date"].isoformat().endswith("+05:30")


def test_complete_workflow_calendar_contract_is_valid_without_live_provider():
    errors = validate_calendar_insertion(valid_event(), db=None, require_contract=True)

    assert errors == []


def test_contract_rejects_missing_lineage_and_auto_publish():
    event = valid_event(
        owner_agent=None,
        recommendation_id=None,
        task_id=None,
        kpi=None,
        deadline=None,
        evidence=None,
        expected_outcome=None,
        action_type="publish",
        status="published",
    )

    errors = validate_calendar_insertion(event, db=None, require_contract=True)

    assert "owner_agent is required for workflow-backed insertion" in errors
    assert "recommendation_id is required for workflow-backed insertion" in errors
    assert "calendar insertion cannot publish automatically" in errors
    assert "calendar insertion cannot create a published event" in errors


def test_contract_rejects_invalid_timezone_and_content_type():
    errors = validate_calendar_insertion(
        valid_event(user_timezone="Not/AZone", content_type="unknown"),
        db=None,
        require_contract=True,
    )

    assert "unsupported content_type: unknown" in errors
    assert "invalid user timezone: Not/AZone" in errors


def test_calendar_status_sync_updates_linked_workflow_task():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[
        ContentStrategy.__table__, CalendarEvent.__table__,
        DailyWorkflowPlan.__table__, DailyWorkflowTask.__table__,
    ])
    session = sessionmaker(bind=engine)()
    strategy = ContentStrategy(id=1, user_id="tenant-1", name="Strategy")
    plan = DailyWorkflowPlan(id=1, user_id="tenant-1", date="2026-08-24")
    task = DailyWorkflowTask(
        id=1,
        plan_id=1,
        user_id="tenant-1",
        pillar_id="publish",
        title="Publish guide",
        description="Publish the guide",
        status="pending",
        metadata_json={"source": "calendar_event", "source_event_id": 4},
    )
    event = CalendarEvent(
        id=4,
        user_id="tenant-1",
        strategy_id=1,
        title="Guide",
        description="Publish the guide",
        content_type="blog_post",
        platform="website",
        scheduled_date=datetime(2026, 8, 24, 10, 0),
        status="published",
    )
    session.add_all([strategy, plan, task, event])
    session.commit()

    assert sync_workflow_tasks_from_calendar_event(session, "tenant-1", event) == 1
    session.refresh(task)
    assert task.status == "completed"
    assert task.metadata_json["calendar_status"] == "published"

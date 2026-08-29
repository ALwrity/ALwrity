from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.base import Base
from models.daily_workflow_models import DailyWorkflowTask, TaskHistory
from models.task_memory_models import TaskMemorySettings
from services.intelligence.agents.core_agent_framework import TaskProposal
from services.task_memory_service import TaskMemoryService


class FakeIntelligence:
    async def index_content(self, items):
        return None

    async def search(self, *args, **kwargs):
        return []


def make_memory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[
        TaskHistory.__table__, TaskMemorySettings.__table__, DailyWorkflowTask.__table__,
    ])
    session = sessionmaker(bind=engine)()
    memory = TaskMemoryService("tenant-1", session)
    memory.intelligence = FakeIntelligence()
    memory._schedule_debounced_flush = lambda: None
    return memory, session


def make_task(status="completed", metadata=None):
    task = DailyWorkflowTask(
        plan_id=1,
        user_id="tenant-1",
        pillar_id="generate",
        title="Create onboarding guide",
        description="Write a useful onboarding guide",
        status=status,
        metadata_json=metadata or {},
        created_at=datetime.utcnow() - timedelta(hours=1),
    )
    return task


@pytest.mark.asyncio
async def test_record_task_outcome_upserts_and_preserves_feedback_history():
    memory, session = make_memory()
    task = make_task("completed", {"execution_result": {"status": "success"}})

    await memory.record_task_outcome(task, feedback_score=1, feedback_text="Useful")
    task.status = "rejected"
    await memory.record_task_outcome(task, feedback_score=-1, feedback_text="Too broad")

    rows = session.query(TaskHistory).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.status == "rejected"
    assert row.first_proposed_at == task.created_at
    assert row.last_completed_at is not None
    assert row.last_rejected_at is not None
    assert row.last_feedback["text"] == "Too broad"
    assert [entry["text"] for entry in row.feedback_history] == ["Useful", "Too broad"]
    assert row.execution_result == {"status": "success"}


def test_tenant_windows_are_persisted_and_used():
    memory, session = make_memory()

    configured = memory.configure_suppression_windows(
        exact_duplicate_window_days=2,
        completed_repeat_window_days=3,
        rejected_repeat_window_days=4,
        failed_retry_window_days=5,
    )

    assert configured["rejected_repeat_window_days"] == 4
    settings = session.query(TaskMemorySettings).one()
    assert settings.failed_retry_window_days == 5


@pytest.mark.asyncio
async def test_accepted_proposal_records_first_and_last_proposed_times():
    memory, session = make_memory()
    proposal = TaskProposal("Plan a newsletter", "Outline the next newsletter", "plan", "low", 10, "agent", "")

    await memory.record_task_proposal(proposal)
    row = session.query(TaskHistory).one()

    assert row.status == "proposed"
    assert row.first_proposed_at is not None
    assert row.last_proposed_at is not None
    assert row.first_proposed_at == row.last_proposed_at


@pytest.mark.asyncio
async def test_completed_success_is_suppressed_but_changed_variant_is_allowed():
    memory, session = make_memory()
    await memory.record_task_outcome(make_task("completed", {"execution_result": {"status": "success"}}), feedback_score=1)

    exact = TaskProposal("Create onboarding guide", "Write a useful onboarding guide", "generate", "medium", 15, "agent", "")
    variant = TaskProposal("Create onboarding guide", "Write a useful onboarding guide for SaaS founders", "generate", "medium", 15, "agent", "")

    filtered = await memory.filter_redundant_proposals([exact, variant])

    assert exact not in filtered
    assert variant in filtered
    assert any("completed successfully" in (decision["reason"] or "") for decision in memory.last_filter_decisions)


@pytest.mark.asyncio
async def test_repeated_rejection_is_suppressed_and_failed_retry_is_explainable():
    memory, session = make_memory()
    task = make_task("rejected")
    await memory.record_task_outcome(task, feedback_score=-1, feedback_text="No")
    await memory.record_task_outcome(task, feedback_score=-1, feedback_text="Still no")
    proposal = TaskProposal(task.title, task.description, "generate", "medium", 15, "agent", "")

    assert await memory.filter_redundant_proposals([proposal]) == []
    assert "rejected" in memory.last_filter_decisions[0]["reason"]

    failed = make_task("failed")
    failed.title = "Publish onboarding guide"
    await memory.record_task_outcome(failed, feedback_score=0)
    failed_proposal = TaskProposal(failed.title, failed.description, "generate", "medium", 15, "agent", "")
    assert await memory.filter_redundant_proposals([failed_proposal]) == []
    assert "failed execution" in memory.last_filter_decisions[0]["reason"]

    explicit_retry = TaskProposal(
        failed.title,
        failed.description,
        "generate",
        "medium",
        15,
        "agent",
        "",
        context_data={"explicit_request": True},
    )
    assert await memory.filter_redundant_proposals([explicit_retry]) == [explicit_retry]

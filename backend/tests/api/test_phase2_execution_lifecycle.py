"""Phase 2 tests for durable, idempotent workflow execution."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import api.today_workflow as today_workflow
from models.workflow_execution_models import WorkflowTaskExecution
from models.daily_workflow_models import TaskHistory
from models.task_memory_models import TaskMemorySettings


class Task:
    id = 51
    user_id = "lifecycle-user"
    title = "Generate draft"
    description = "Generate the requested draft."
    action_type = "create_content"
    action_url = "/blog-writer"
    pillar_id = "generate"
    status = "pending"
    metadata_json = {"source_agent": "ContentStrategyAgent", "context_data": {"pillar_topic": "AI"}}
    updated_at = None
    completion_notes = None


class Query:
    def __init__(self, value):
        self.value = value

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return self.value


class DB:
    def __init__(self, task, execution=None):
        self.task = task
        self.executions = [execution] if execution else []
        self.commits = 0
        self.skip_first_execution_lookup = False

    def query(self, model):
        if model is WorkflowTaskExecution:
            if self.skip_first_execution_lookup:
                self.skip_first_execution_lookup = False
                return Query(None)
            return Query(self.executions[0] if self.executions else None)
        if model in {TaskHistory, TaskMemorySettings}:
            return Query(None)
        return Query(self.task)

    def add(self, value):
        if isinstance(value, WorkflowTaskExecution):
            if value.id is None:
                value.id = len(self.executions) + 1
            if value not in self.executions:
                self.executions.append(value)
        else:
            self.task = value

    def commit(self):
        self.commits += 1

    def refresh(self, value):
        if isinstance(value, WorkflowTaskExecution) and value.id is None:
            value.id = len(self.executions) or 1


class Activity:
    next_id = 1

    def __init__(self, db, user_id):
        pass

    def start_run(self, **kwargs):
        run = type("Run", (), {"id": Activity.next_id})()
        Activity.next_id += 1
        return run

    def log_event(self, **kwargs):
        pass

    def finish_run(self, *args, **kwargs):
        pass


@pytest.fixture
def adapter_environment(monkeypatch):
    monkeypatch.setattr(today_workflow, "AgentActivityService", Activity)
    monkeypatch.setattr(
        today_workflow,
        "record_agent_action_performance",
        lambda *args: _completed_future(),
    )


async def _completed_future():
    return True


@pytest.mark.asyncio
async def test_execution_persists_lifecycle_and_replays_same_key(monkeypatch, adapter_environment):
    task = Task()
    db = DB(task)

    async def adapter(*args):
        return {"success": True, "artifact_type": "content_draft", "content": "draft"}

    monkeypatch.setattr(today_workflow, "execute_supported_recommendation", adapter)
    body = today_workflow.TaskExecutionRequest(
        action_type="create_content",
        idempotency_key="recommendation-51-v1",
        parameters={"topic": "AI"},
    )

    first = await today_workflow.execute_workflow_task(
        51, body, {"id": "lifecycle-user"}, db
    )
    replay = await today_workflow.execute_workflow_task(
        51, body, {"id": "lifecycle-user"}, db
    )

    assert first["data"]["status"] == "completed"
    assert replay["data"]["idempotent_replay"] is True
    assert len(db.executions) == 1
    record = db.executions[0]
    assert record.status == "succeeded"
    assert record.started_at is not None
    assert record.completed_at is not None
    assert record.result_json["artifact_type"] == "content_draft"


@pytest.mark.asyncio
async def test_adapter_exception_resets_task_and_records_failure(monkeypatch, adapter_environment):
    task = Task()
    db = DB(task)

    async def broken_adapter(*args):
        raise RuntimeError("generator unavailable")

    monkeypatch.setattr(today_workflow, "execute_supported_recommendation", broken_adapter)
    result = await today_workflow.execute_workflow_task(
        51,
        today_workflow.TaskExecutionRequest(
            action_type="create_content", idempotency_key="retryable-51"
        ),
        {"id": "lifecycle-user"},
        db,
    )

    assert result["success"] is False
    assert result["data"]["status"] == "pending"
    assert task.status == "pending"
    assert db.executions[0].status == "failed"
    assert "generator unavailable" in db.executions[0].error_message
    assert db.executions[0].completed_at is not None


@pytest.mark.asyncio
async def test_active_task_rejects_second_execution(adapter_environment):
    task = Task()
    task.status = "in_progress"
    task.updated_at = datetime.utcnow()
    db = DB(task)

    with pytest.raises(HTTPException) as exc:
        await today_workflow.execute_workflow_task(
            51,
            today_workflow.TaskExecutionRequest(action_type="create_content"),
            {"id": "lifecycle-user"},
            db,
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_stale_task_is_released_for_explicit_retry(monkeypatch, adapter_environment):
    task = Task()
    task.status = "in_progress"
    task.updated_at = datetime.utcnow() - timedelta(minutes=45)
    stale = WorkflowTaskExecution(
        id=1,
        task_id=51,
        user_id="lifecycle-user",
        idempotency_key="stale",
        action_id="task_51",
        agent_type="ContentStrategyAgent",
        action_type="create_content",
        status="running",
        started_at=datetime.utcnow() - timedelta(minutes=45),
    )
    db = DB(task, stale)
    db.skip_first_execution_lookup = True

    async def adapter(*args):
        return {"success": True, "content": "retried"}

    monkeypatch.setattr(today_workflow, "execute_supported_recommendation", adapter)
    result = await today_workflow.execute_workflow_task(
        51,
        today_workflow.TaskExecutionRequest(
            action_type="create_content", idempotency_key="retry-2"
        ),
        {"id": "lifecycle-user"},
        db,
    )

    assert result["data"]["status"] == "completed"
    assert stale.status == "failed"

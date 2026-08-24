"""Phase 12 tests for controlled feedback and optimization signals."""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from api.today_workflow import (
    TaskFeedbackRequest,
    get_workflow_optimization_signals,
    record_workflow_task_feedback,
)
from services.feedback_optimization import build_optimization_signals


class Task:
    id = 11
    user_id = "feedback-user"
    pillar_id = "analyze"
    status = "completed"
    created_at = datetime.utcnow()

    def __init__(self, metadata_json=None):
        self.metadata_json = metadata_json or {}
        self.updated_at = None


class Query:
    def __init__(self, value):
        self.value = value

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.value

    def all(self):
        return self.value if isinstance(self.value, list) else [self.value]


class DB:
    def __init__(self, value):
        self.value = value
        self.commits = 0

    def query(self, model):
        return Query(self.value)

    def add(self, value):
        self.value = value

    def commit(self):
        self.commits += 1


def task_with_feedback(score, agent="ContentStrategyAgent", pillar="analyze"):
    task = Task({"source_agent": agent, "feedback": {"score": score}})
    task.pillar_id = pillar
    return task


def test_negative_signal_requires_minimum_samples():
    result = build_optimization_signals(
        [
            task_with_feedback(-1),
            task_with_feedback(-1),
            task_with_feedback(-1),
        ]
    )

    assert result["agent_feedback"]["ContentStrategyAgent"]["eligible_for_optimization"] is True
    assert result["control"]["status"] == "review_required"
    assert result["control"]["auto_changes_applied"] is False
    assert any(signal["type"] == "agent_quality_review" for signal in result["signals"])


def test_sparse_feedback_is_reported_but_not_actionable():
    result = build_optimization_signals([task_with_feedback(-1), task_with_feedback(-1)])

    summary = result["agent_feedback"]["ContentStrategyAgent"]
    assert summary["samples"] == 2
    assert summary["eligible_for_optimization"] is False
    assert result["signals"] == []
    assert result["control"]["status"] == "no_actionable_signal"


def test_positive_feedback_creates_no_negative_signal():
    result = build_optimization_signals(
        [task_with_feedback(1), task_with_feedback(1), task_with_feedback(0)]
    )
    assert result["signals"] == []


@pytest.mark.asyncio
async def test_feedback_endpoint_persists_feedback_without_changing_status():
    task = Task()
    db = DB(task)

    result = await record_workflow_task_feedback(
        task_id=11,
        body=TaskFeedbackRequest(score=-1, feedback_text="Not relevant"),
        current_user={"id": "feedback-user"},
        db=db,
    )

    assert result["success"] is True
    assert task.status == "completed"
    assert task.metadata_json["feedback"]["score"] == -1
    assert task.metadata_json["feedback"]["feedback_text"] == "Not relevant"


@pytest.mark.asyncio
async def test_optimization_endpoint_returns_control_metadata():
    tasks = [task_with_feedback(-1), task_with_feedback(-1), task_with_feedback(-1)]

    result = await get_workflow_optimization_signals(
        days=30,
        current_user={"id": "feedback-user"},
        db=DB(tasks),
    )

    optimization = result["data"]["optimization"]
    assert result["success"] is True
    assert optimization["control"]["auto_changes_applied"] is False
    assert optimization["signals"]

"""Phase 11 tests for user-visible marketing outcome reporting."""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from api.today_workflow import (
    ConversionEventRequest,
    get_workflow_outcomes,
    record_conversion_event,
)
from services.outcome_reporting import summarize_workflow_outcomes


class Task:
    def __init__(self, status, pillar_id, metadata_json=None):
        self.status = status
        self.pillar_id = pillar_id
        self.metadata_json = metadata_json or {}
        self.created_at = datetime.utcnow()


class Query:
    def __init__(self, tasks):
        self.tasks = tasks

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.tasks if not isinstance(self.tasks, list) else None

    def all(self):
        return self.tasks


class DB:
    def __init__(self, tasks):
        self.tasks = tasks

    def query(self, model):
        return Query(self.tasks)

    def add(self, value):
        self.tasks = value

    def commit(self):
        pass

    def refresh(self, value):
        value.id = 17


def test_summary_reports_acceptance_execution_and_publishing():
    tasks = [
        Task(
            "completed",
            "publish",
            {
                "execution": {"attempts": 1, "success": True},
                "outcome_metrics": {"channel": "social", "engagement_rate": 0.12},
            },
        ),
        Task(
            "skipped",
            "publish",
            {"execution": {"attempts": 1, "success": False}},
        ),
        Task(
            "in_progress",
            "analyze",
            {"outcome_metrics": {"channel": "seo", "organic_clicks": 42}},
        ),
        Task("pending", "engage"),
    ]

    result = summarize_workflow_outcomes(tasks)

    assert result["tasks"]["planned"] == 4
    assert result["tasks"]["accepted"] == 2
    assert result["tasks"]["rejected"] == 1
    assert result["tasks"]["undecided"] == 1
    assert result["tasks"]["acceptance_rate"] == round(2 / 3, 4)
    assert result["execution"]["attempts"] == 2
    assert result["execution"]["successful"] == 1
    assert result["execution"]["failed"] == 1
    assert result["execution"]["success_rate"] == 0.5
    assert result["publishing"]["planned"] == 2
    assert result["publishing"]["completed"] == 1
    assert result["publishing"]["consistency_rate"] == 0.5
    assert result["seo_performance"]["organic_clicks"]["latest"] == 42.0
    assert result["social_performance"]["engagement_rate"]["average"] == 0.12
    assert result["measurement"]["status"] == "measured"


def test_summary_does_not_invent_missing_measurements():
    result = summarize_workflow_outcomes([Task("pending", "plan")])

    assert result["execution"]["success_rate"] is None
    assert result["publishing"]["consistency_rate"] is None
    assert result["seo_performance"] == {}
    assert result["social_performance"] == {}
    assert result["measurement"]["status"] == "awaiting_measurements"


@pytest.mark.asyncio
async def test_outcomes_endpoint_is_user_scoped_and_windowed():
    response = await get_workflow_outcomes(
        days=14,
        current_user={"id": "outcome-user"},
        db=DB([Task("completed", "analyze")]),
    )

    assert response["success"] is True
    assert response["user_id"] == "outcome-user"
    assert response["data"]["window_days"] == 14
    assert response["data"]["outcomes"]["tasks"]["planned"] == 1


@pytest.mark.asyncio
async def test_outcomes_endpoint_rejects_invalid_window():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await get_workflow_outcomes(
            days=0,
            current_user={"id": "outcome-user"},
            db=DB([]),
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_conversion_event_ingestion_is_user_scoped_and_idempotent():
    task_db = DB(None)
    first = await record_conversion_event(
        ConversionEventRequest(
            event_name="signup",
            value=10,
            currency="usd",
            external_event_id="event-1",
        ),
        current_user={"id": "outcome-user"},
        db=task_db,
    )

    assert first["success"] is True
    assert first["data"]["duplicate"] is False
    assert first["data"]["event_id"] == 17

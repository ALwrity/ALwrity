from types import SimpleNamespace

import pytest


@pytest.mark.asyncio
async def test_failed_execution_records_failure_snapshot(monkeypatch):
    captured = {}

    class FakeMemory:
        def __init__(self, user_id, db):
            captured["user_id"] = user_id
            captured["db"] = db

        async def record_task_outcome(self, task, feedback_score, feedback_text):
            captured["task"] = task
            captured["score"] = feedback_score
            captured["feedback"] = feedback_text
            return {"status": "recorded"}

    monkeypatch.setattr("services.task_memory_service.TaskMemoryService", FakeMemory)
    from services.task_outcome_integration import record_failed_execution_outcome

    task = SimpleNamespace(
        title="Run analysis",
        description="Run analysis",
        pillar_id="analyze",
        status="pending",
        metadata_json={"source_agent": "seo_specialist"},
    )
    result = await record_failed_execution_outcome("tenant-1", task, object(), {"error": "provider down"})

    assert result["status"] == "recorded"
    assert task.status == "pending"
    assert captured["task"].status == "failed"
    assert captured["task"].metadata_json["execution_result"]["error"] == "provider down"

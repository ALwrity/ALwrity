"""Tests for doc_rag job queue helpers."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from arq.jobs import JobResult, JobStatus

from doc_rag.queue.jobs import JobState, _job_type_from_function, _map_arq_status, get_job_status


def test_map_arq_status_not_found():
    assert _map_arq_status(None) == JobState.not_found


def test_map_arq_status_complete():
    assert _map_arq_status(JobStatus.complete) == JobState.completed


def test_map_arq_status_in_progress():
    assert _map_arq_status(JobStatus.in_progress) == JobState.running


def test_job_type_from_function():
    assert _job_type_from_function("ingest_task") == "ingest"
    assert _job_type_from_function("rag_task") == "rag"
    assert _job_type_from_function("other_task") == "other_task"


def test_ingest_job_request_defaults():
    from doc_rag.queue.jobs import IngestJobRequest

    req = IngestJobRequest()
    assert req.force is False
    assert req.docs_path is None


@pytest.mark.asyncio
async def test_get_job_status_completed():
    pool = MagicMock()
    result_info = JobResult(
        function="ingest_task",
        args=(),
        kwargs={},
        job_try=1,
        enqueue_time=datetime.utcnow(),
        score=None,
        job_id="abc123",
        success=True,
        result={"chunk_count": 42},
        start_time=datetime.utcnow(),
        finish_time=datetime.utcnow(),
        queue_name="doc_rag_ingest",
    )

    mock_job = MagicMock()
    mock_job.status = AsyncMock(return_value=JobStatus.complete)
    mock_job.info = AsyncMock(return_value=result_info)
    mock_job.result_info = AsyncMock(return_value=result_info)

    with patch("doc_rag.queue.jobs._resolve_job", AsyncMock(return_value=(mock_job, JobStatus.complete))):
        response = await get_job_status(pool, "abc123")

    assert response.status == JobState.completed
    assert response.job_type == "ingest"
    assert response.result == {"chunk_count": 42}
    assert response.error is None


@pytest.mark.asyncio
async def test_get_job_status_failed():
    pool = MagicMock()
    result_info = JobResult(
        function="ingest_task",
        args=(),
        kwargs={},
        job_try=1,
        enqueue_time=datetime.utcnow(),
        score=None,
        job_id="abc123",
        success=False,
        result=RuntimeError("Ingest lock busy"),
        start_time=datetime.utcnow(),
        finish_time=datetime.utcnow(),
        queue_name="doc_rag_ingest",
    )

    mock_job = MagicMock()
    mock_job.status = AsyncMock(return_value=JobStatus.complete)
    mock_job.info = AsyncMock(return_value=result_info)
    mock_job.result_info = AsyncMock(return_value=result_info)

    with patch("doc_rag.queue.jobs._resolve_job", AsyncMock(return_value=(mock_job, JobStatus.complete))):
        response = await get_job_status(pool, "abc123")

    assert response.status == JobState.failed
    assert response.job_type == "ingest"
    assert response.result is None
    assert "Ingest lock busy" in response.error

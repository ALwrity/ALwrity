"""
Job payload schemas, ARQ pool helpers, and enqueue functions.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from arq import ArqRedis, create_pool
from arq.jobs import Job, JobStatus
from pydantic import BaseModel

from doc_rag.logging_utils import FnLogger
from doc_rag.queue.settings import INGEST_TASK_NAME, RAG_TASK_NAME, redis_settings

log = FnLogger("queue.jobs")


class JobState(str, Enum):
    """Normalized job status for API responses."""

    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    not_found = "not_found"


class IngestJobRequest(BaseModel):
    """POST /jobs/ingest body."""

    docs_path: Optional[str] = None
    force: bool = False


class JobSubmitResponse(BaseModel):
    """Response when a job is enqueued."""

    job_id: str
    status: JobState = JobState.queued
    job_type: str


class JobStatusResponse(BaseModel):
    """GET /jobs/{job_id} response."""

    job_id: str
    status: JobState
    job_type: Optional[str] = None
    result: Optional[Any] = None
    error: Optional[str] = None


async def create_arq_pool() -> ArqRedis:
    """Create ARQ Redis connection pool for enqueueing and job polling."""
    log.trace("create_arq_pool", "Connecting to Redis")
    return await create_pool(redis_settings())


def _map_arq_status(arq_status: JobStatus | None) -> JobState:
    if arq_status is None:
        return JobState.not_found
    mapping = {
        JobStatus.queued: JobState.queued,
        JobStatus.deferred: JobState.queued,
        JobStatus.in_progress: JobState.running,
        JobStatus.complete: JobState.completed,
        JobStatus.not_found: JobState.not_found,
    }
    return mapping.get(arq_status, JobState.failed)


def _job_type_from_function(function: str) -> str | None:
    if function == INGEST_TASK_NAME:
        return "ingest"
    if function == RAG_TASK_NAME:
        return "rag"
    return function


_DOC_RAG_QUEUES = ("doc_rag_ingest", "doc_rag_rag")


async def _resolve_job(pool: ArqRedis, job_id: str) -> tuple[Job, JobStatus]:
    """Find job on default or doc_rag-specific ARQ queues."""
    job = Job(job_id, pool)
    arq_status = await job.status()
    if arq_status != JobStatus.not_found:
        return job, arq_status

    for queue_name in _DOC_RAG_QUEUES:
        candidate = Job(job_id, pool, _queue_name=queue_name)
        arq_status = await candidate.status()
        if arq_status != JobStatus.not_found:
            return candidate, arq_status

    return job, arq_status


async def enqueue_ingest(pool: ArqRedis, request: IngestJobRequest) -> JobSubmitResponse:
    """Enqueue a folder ingest job."""
    log.info("enqueue_ingest", "Enqueue ingest force={} docs_path={}", request.force, request.docs_path)
    job = await pool.enqueue_job(
        INGEST_TASK_NAME,
        docs_path=request.docs_path,
        force=request.force,
        _queue_name="doc_rag_ingest",
    )
    return JobSubmitResponse(job_id=job.job_id, status=JobState.queued, job_type="ingest")


async def enqueue_rag(
    pool: ArqRedis,
    query: str,
    company: str,
    limit: int = 5,
    maxlength: int = 2048,
) -> JobSubmitResponse:
    """Enqueue a RAG generation job."""
    log.info("enqueue_rag", "Enqueue RAG company='{}' query='{}'", company, query[:80])
    job = await pool.enqueue_job(
        RAG_TASK_NAME,
        query=query,
        company=company,
        limit=limit,
        maxlength=maxlength,
        _queue_name="doc_rag_rag",
    )
    return JobSubmitResponse(job_id=job.job_id, status=JobState.queued, job_type="rag")


async def get_job_status(pool: ArqRedis, job_id: str) -> JobStatusResponse:
    """Poll ARQ for job status and result."""
    job, arq_status = await _resolve_job(pool, job_id)
    status = _map_arq_status(arq_status)

    result: Any = None
    error: str | None = None
    job_type: str | None = None

    info = await job.info()
    result_info = await job.result_info()

    if info:
        job_type = _job_type_from_function(info.function)

    if result_info is not None:
        if result_info.success:
            status = JobState.completed
            result = result_info.result
        else:
            status = JobState.failed
            error = str(result_info.result) if result_info.result else "Job failed"

    log.trace("get_job_status", "job_id={} status={} type={}", job_id, status, job_type)
    return JobStatusResponse(
        job_id=job_id,
        status=status,
        job_type=job_type,
        result=result,
        error=error,
    )

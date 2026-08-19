"""
ARQ WorkerSettings for ingest and RAG worker processes.
"""

from __future__ import annotations

from doc_rag.queue.settings import ingest_max_jobs, job_timeout_seconds, rag_max_jobs, redis_settings
from doc_rag.workers.tasks import ingest_task, rag_task


class IngestWorkerSettings:
    """Worker that runs ingest jobs (max 1 concurrent by default)."""

    functions = [ingest_task]
    redis_settings = redis_settings()
    max_jobs = ingest_max_jobs()
    job_timeout = job_timeout_seconds()
    queue_name = "doc_rag_ingest"


class RAGWorkerSettings:
    """Worker that runs RAG generation jobs."""

    functions = [rag_task]
    redis_settings = redis_settings()
    max_jobs = rag_max_jobs()
    job_timeout = job_timeout_seconds()
    queue_name = "doc_rag_rag"


def worker_settings_for(mode: str):
    if mode == "ingest":
        return IngestWorkerSettings
    if mode == "rag":
        return RAGWorkerSettings
    raise ValueError(f"Unknown worker mode: {mode}. Use 'ingest' or 'rag'.")

"""
Redis and ARQ configuration for doc_rag job queues.

Env vars:
  DOC_RAG_REDIS_URL          Redis DSN (default redis://localhost:6379/0)
  DOC_RAG_INGEST_MAX_JOBS    Max concurrent ingest jobs (default 1)
  DOC_RAG_RAG_MAX_JOBS       Max concurrent RAG jobs (default 2)
  DOC_RAG_JOB_TIMEOUT        Job timeout seconds (default 7200)
"""

from __future__ import annotations

import os

from arq.connections import RedisSettings

INGEST_TASK_NAME = "ingest_task"
RAG_TASK_NAME = "rag_task"

INGEST_LOCK_KEY = "doc_rag:ingest:lock"
INDEX_VERSION_KEY = "doc_rag:index_version"
INGEST_LOCK_TTL_SECONDS = 7200


def redis_url() -> str:
    return os.getenv("DOC_RAG_REDIS_URL", "redis://127.0.0.1:6379/0")


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(redis_url())


def ingest_max_jobs() -> int:
    return int(os.getenv("DOC_RAG_INGEST_MAX_JOBS", "1"))


def rag_max_jobs() -> int:
    return int(os.getenv("DOC_RAG_RAG_MAX_JOBS", "2"))


def job_timeout_seconds() -> int:
    return int(os.getenv("DOC_RAG_JOB_TIMEOUT", "7200"))

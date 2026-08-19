"""
ARQ worker task functions for ingest and RAG jobs.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from doc_rag.config import DocRagConfig
from doc_rag.index_manager import IndexManager
from doc_rag.index_sync import publish_index_version
from doc_rag.ingest import run_ingest
from doc_rag.logging_utils import FnLogger, configure_logging
from doc_rag.queue.settings import INGEST_LOCK_KEY, INGEST_LOCK_TTL_SECONDS
from doc_rag.rag import CompanyRAGService

log = FnLogger("workers.tasks")

# Cached embeddings + RAG service for the RAG worker process.
_worker_embeddings: Any = None
_worker_rag: CompanyRAGService | None = None
_worker_content_hash: str | None = None


async def _acquire_ingest_lock(redis: Any, job_id: str) -> bool:
    """Try to acquire exclusive ingest lock (one ingest at a time)."""
    acquired = await redis.set(INGEST_LOCK_KEY, job_id, nx=True, ex=INGEST_LOCK_TTL_SECONDS)
    log.trace("_acquire_ingest_lock", "job_id={} acquired={}", job_id, bool(acquired))
    return bool(acquired)


async def _release_ingest_lock(redis: Any, job_id: str) -> None:
    """Release ingest lock if still held by this job."""
    current = await redis.get(INGEST_LOCK_KEY)
    if current is None:
        return
    current_val = current.decode() if isinstance(current, bytes) else str(current)
    if current_val == job_id:
        await redis.delete(INGEST_LOCK_KEY)
        log.trace("_release_ingest_lock", "Released lock for job_id={}", job_id)


def _get_worker_rag(config: DocRagConfig) -> tuple[Any, CompanyRAGService]:
    """Lazy-load or reload embeddings and RAG service in worker process."""
    global _worker_embeddings, _worker_rag, _worker_content_hash

    from doc_rag.index_sync import manifest_content_hash

    manager = IndexManager(config)
    current_hash = manifest_content_hash(manager)

    if _worker_embeddings is None or _worker_content_hash != current_hash:
        log.info("_get_worker_rag", "Loading index for RAG worker hash={}", (current_hash or "")[:12])
        manager.release()
        _worker_embeddings = manager.load()
        _worker_rag = CompanyRAGService(
            embeddings=_worker_embeddings,
            llm_model=config.llm_model,
            default_limit=config.default_search_limit,
        )
        _worker_content_hash = current_hash

    assert _worker_rag is not None
    return _worker_embeddings, _worker_rag


async def ingest_task(ctx: dict[str, Any], docs_path: str | None = None, force: bool = False) -> dict[str, Any]:
    """
    ARQ task: build hybrid index from a docs folder.

    Acquires a global Redis lock so only one ingest runs at a time.
    """
    configure_logging(verbose=True, debug=False)
    redis = ctx["redis"]
    job_id = ctx.get("job_id", "unknown")

    if not await _acquire_ingest_lock(redis, job_id):
        log.warning("ingest_task", "Ingest lock busy; job_id={} rejected", job_id)
        raise RuntimeError("Another ingest job is already running")

    try:
        config = DocRagConfig.from_env()
        if docs_path:
            config.docs_path = Path(docs_path).resolve()

        manager = IndexManager(config)
        log.info("ingest_task", "Starting ingest docs_path={} force={}", config.docs_path, force)

        manifest = await asyncio.to_thread(run_ingest, config, force, manager)

        content_hash = manifest.get("content_hash", "")
        if content_hash:
            await publish_index_version(redis, content_hash)

        global _worker_embeddings, _worker_rag, _worker_content_hash
        _worker_embeddings = None
        _worker_rag = None
        _worker_content_hash = None

        log.info("ingest_task", "Ingest complete chunks={}", manifest.get("chunk_count"))
        return manifest
    finally:
        await _release_ingest_lock(redis, job_id)


async def rag_task(
    ctx: dict[str, Any],
    query: str,
    company: str,
    limit: int = 5,
    maxlength: int = 2048,
) -> dict[str, Any]:
    """ARQ task: company-scoped RAG with citations."""
    configure_logging(verbose=True, debug=False)
    config = DocRagConfig.from_env()
    _, rag_service = _get_worker_rag(config)

    log.info("rag_task", "RAG company='{}' query='{}'", company, query[:80])
    response = await asyncio.to_thread(
        rag_service.generate,
        query=query,
        company=company,
        limit=limit,
        maxlength=maxlength,
    )
    return response.model_dump()

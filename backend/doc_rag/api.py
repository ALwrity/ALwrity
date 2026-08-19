"""
FastAPI application for doc RAG search and ingestion.

Endpoints:
  GET  /health        - service and index status
  GET  /companies     - tenant list with doc/chunk counts
  GET  /stats         - ingest manifest and paths
  GET/POST /search    - hybrid company-scoped search with citations (sync)
  POST /rag           - sync RAG when workers disabled; else use /jobs/rag
  POST /ingest        - enqueues ingest job (non-blocking)
  POST /jobs/ingest   - enqueue ingest job
  POST /jobs/rag      - enqueue RAG job
  GET  /jobs/{job_id} - poll job status and result
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request

from doc_rag import __version__
from doc_rag.config import DocRagConfig
from doc_rag.index_sync import manifest_content_hash, maybe_reload_index
from doc_rag.ingest import load_company_mappings
from doc_rag.index_manager import IndexManager
from doc_rag.logging_utils import FnLogger
from doc_rag.models import (
    CompaniesResponse,
    CompanyInfo,
    HealthResponse,
    IngestResponse,
    RAGRequest,
    RAGResponse,
    SearchRequest,
    SearchResponse,
    StatsResponse,
)
from doc_rag.queue.jobs import (
    IngestJobRequest,
    JobStatusResponse,
    JobSubmitResponse,
    create_arq_pool,
    enqueue_ingest,
    enqueue_rag,
    get_job_status,
)
from doc_rag.rag import CompanyRAGService
from doc_rag.search import company_search

log = FnLogger("api")


def create_app(config: DocRagConfig, embeddings: Any) -> FastAPI:
    """Build FastAPI app with shared embeddings, ARQ pool, and job routes."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if config.use_job_queue:
            try:
                app.state.arq_pool = await create_arq_pool()
                log.info("lifespan", "ARQ pool connected redis={}", config.redis_url)
            except Exception as exc:  # noqa: BLE001
                log.warning("lifespan", "ARQ pool unavailable: {}", exc)
                app.state.arq_pool = None
        else:
            app.state.arq_pool = None

        manifest_hash = manifest_content_hash(app.state.index_manager)
        app.state.embeddings_holder = {
            "embeddings": embeddings,
            "content_hash": manifest_hash,
        }
        if manifest_hash and app.state.arq_pool is not None:
            try:
                await app.state.arq_pool.set("doc_rag:index_version", manifest_hash)
            except Exception:  # noqa: BLE001
                pass

        yield

        if app.state.arq_pool is not None:
            await app.state.arq_pool.close()
            log.trace("lifespan", "ARQ pool closed")

    log.trace("create_app", "Creating FastAPI app version={}", __version__)

    app = FastAPI(
        title="ALwrity Doc RAG",
        description="Hybrid FAISS+BM25 doc search and RAG with company-scoped citations",
        version=__version__,
        lifespan=lifespan,
    )

    app.state.config = config
    app.state.embeddings = embeddings
    app.state.index_manager = IndexManager(config)
    app.state.rag_service = CompanyRAGService(
        embeddings=embeddings,
        llm_model=config.llm_model,
        default_limit=config.default_search_limit,
    )
    index_manager = app.state.index_manager
    rag_service = app.state.rag_service

    async def _ensure_index_fresh(request: Request) -> None:
        """Reload embeddings if a worker published a new index version."""
        pool = getattr(request.app.state, "arq_pool", None)
        if pool is None:
            return
        holder = request.app.state.embeddings_holder
        reloaded = await maybe_reload_index(
            pool,
            index_manager,
            holder,
            rag_service=request.app.state.rag_service,
        )
        if reloaded:
            request.app.state.embeddings = holder["embeddings"]
            log.info("_ensure_index_fresh", "API reloaded index after worker ingest")

    def _require_pool(request: Request):
        pool = getattr(request.app.state, "arq_pool", None)
        if pool is None:
            raise HTTPException(
                status_code=503,
                detail="Job queue unavailable. Start Redis and set DOC_RAG_USE_QUEUE=true.",
            )
        return pool

    @app.get("/health", response_model=HealthResponse)
    async def health(request: Request) -> HealthResponse:
        """Liveness check; LLM probe skipped when RAG is delegated to workers."""
        log.trace("health", "GET /health")
        llm_available = False
        if not config.delegate_rag_to_workers:
            llm_available = request.app.state.rag_service.llm_available()
        return HealthResponse(
            status="ok",
            index_loaded=request.app.state.embeddings is not None,
            llm_available=llm_available,
            version=__version__,
        )

    @app.get("/companies", response_model=CompaniesResponse)
    def companies() -> CompaniesResponse:
        log.trace("companies", "GET /companies")
        mappings = load_company_mappings(config.companies_config)
        manifest = index_manager.load_manifest()
        doc_counts = manifest.get("company_doc_counts", {})
        chunk_counts = manifest.get("company_chunk_counts", {})
        return CompaniesResponse(
            companies=[
                CompanyInfo(
                    name=m.name,
                    description=m.description,
                    document_count=int(doc_counts.get(m.name, 0)),
                    chunk_count=int(chunk_counts.get(m.name, 0)),
                )
                for m in mappings
            ]
        )

    @app.get("/stats", response_model=StatsResponse)
    def stats() -> StatsResponse:
        log.trace("stats", "GET /stats")
        return StatsResponse(
            manifest=index_manager.load_manifest(),
            index_dir=str(config.index_dir),
            docs_path=str(config.docs_path),
        )

    def _validate_company(company: str) -> None:
        mappings = load_company_mappings(config.companies_config)
        names = {m.name for m in mappings}
        if company not in names:
            log.warning("_validate_company", "Unknown company '{}'; valid={}", company, sorted(names))
            raise HTTPException(
                status_code=400,
                detail=f"Unknown company '{company}'. Valid: {sorted(names)}",
            )

    @app.get("/search", response_model=SearchResponse)
    async def search_get(
        request: Request,
        query: str = Query(..., min_length=1),
        company: str = Query(..., min_length=1),
        limit: int = Query(default=5, ge=1, le=50),
    ) -> SearchResponse:
        log.trace("search_get", "GET /search query='{}' company='{}'", query[:80], company)
        return await _search(query, company, limit, request)

    @app.post("/search", response_model=SearchResponse)
    async def search_post(body: SearchRequest, request: Request) -> SearchResponse:
        log.trace("search_post", "POST /search query='{}' company='{}'", body.query[:80], body.company)
        return await _search(body.query, body.company, body.limit, request)

    async def _search(query: str, company: str, limit: int, request: Request) -> SearchResponse:
        await _ensure_index_fresh(request)
        _validate_company(company)
        embeddings = request.app.state.embeddings_holder["embeddings"]
        request.app.state.embeddings = embeddings
        results = company_search(embeddings, query, company, limit=limit)
        log.info("_search", "Search returned {} results company='{}'", len(results), company)
        return SearchResponse(query=query, company=company, results=results, count=len(results))

    @app.post("/jobs/ingest", response_model=JobSubmitResponse)
    async def jobs_ingest(body: IngestJobRequest, request: Request) -> JobSubmitResponse:
        """Enqueue a non-blocking ingest job."""
        pool = _require_pool(request)
        return await enqueue_ingest(pool, body)

    @app.post("/jobs/rag", response_model=JobSubmitResponse)
    async def jobs_rag(body: RAGRequest, request: Request) -> JobSubmitResponse:
        """Enqueue a RAG job (runs in rag worker with LLM)."""
        _validate_company(body.company)
        pool = _require_pool(request)
        return await enqueue_rag(
            pool,
            query=body.query,
            company=body.company,
            limit=body.limit,
            maxlength=body.maxlength,
        )

    @app.get("/jobs/{job_id}", response_model=JobStatusResponse)
    async def jobs_status(job_id: str, request: Request) -> JobStatusResponse:
        """Poll queued job status and result."""
        pool = _require_pool(request)
        return await get_job_status(pool, job_id)

    @app.post("/rag", response_model=RAGResponse)
    async def rag(body: RAGRequest, request: Request) -> RAGResponse:
        """Sync RAG when workers disabled; otherwise directs client to /jobs/rag."""
        log.trace("rag", "POST /rag query='{}' company='{}'", body.query[:80], body.company)
        _validate_company(body.company)

        if config.delegate_rag_to_workers and config.use_job_queue:
            raise HTTPException(
                status_code=409,
                detail="RAG is handled by workers. POST /jobs/rag and poll GET /jobs/{job_id}.",
            )

        if not rag_service.llm_available():
            raise HTTPException(
                status_code=503,
                detail="LLM is not available. Start rag worker or set DOC_RAG_DELEGATE_RAG=false.",
            )
        try:
            await _ensure_index_fresh(request)
            response = rag_service.generate(
                query=body.query,
                company=body.company,
                limit=body.limit,
                maxlength=body.maxlength,
            )
            log.info("rag", "RAG answer_len={} citations={}", len(response.answer), len(response.citations))
            return response
        except Exception as exc:  # noqa: BLE001
            log.exception("rag", "RAG generation failed")
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/ingest", response_model=IngestResponse)
    async def ingest(
        request: Request,
        force: bool = Query(default=False),
        docs_path: str | None = Query(default=None),
    ) -> IngestResponse:
        """
        Enqueue ingest job (non-blocking). Replaces synchronous blocking ingest.

        Poll GET /jobs/{job_id} for completion.
        """
        log.trace("ingest", "POST /ingest force={} docs_path={}", force, docs_path)
        if not config.use_job_queue:
            raise HTTPException(
                status_code=503,
                detail="Job queue disabled. Set DOC_RAG_USE_QUEUE=true and start Redis.",
            )
        pool = _require_pool(request)
        submitted = await enqueue_ingest(pool, IngestJobRequest(docs_path=docs_path, force=force))
        return IngestResponse(
            status="queued",
            message=f"Ingest job queued. Poll GET /jobs/{submitted.job_id}",
            manifest={"job_id": submitted.job_id},
        )

    log.info(
        "create_app",
        "FastAPI ready: /search /jobs/ingest /jobs/rag /jobs/{{id}} queue={} delegate_rag={}",
        config.use_job_queue,
        config.delegate_rag_to_workers,
    )
    return app

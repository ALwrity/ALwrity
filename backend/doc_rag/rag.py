"""
RAG pipeline with company-scoped retrieval and reference citations.

Combines hybrid search (retrieval) with an LLM (generation). The retriever is
company-filtered; txtai ``RAG`` is configured with ``output="reference"`` so
responses include a primary citation id.
"""

from __future__ import annotations

from typing import Any, Optional

from doc_rag.logging_utils import FnLogger
from doc_rag.models import RAGResponse, SearchResult
from doc_rag.search import company_search, resolve_reference

log = FnLogger("rag")

try:
    from txtai import RAG

    TXTAI_RAG_AVAILABLE = True
except ImportError:
    RAG = None  # type: ignore[misc, assignment]
    TXTAI_RAG_AVAILABLE = False


class CompanyScopedRetriever:
    """
    Embeddings-like adapter for txtai RAG.

    txtai RAG needs ``batchsearch`` for retrieval and ``batchsimilarity`` when
    ``output="reference"`` scores answers against retrieved chunks. A plain
    function only satisfies the first path.
    """

    def __init__(self, embeddings: Any, company: str, default_limit: int):
        self.embeddings = embeddings
        self.company = company
        self.default_limit = default_limit

    def batchsearch(self, queries: list[str], limit: int | None = None) -> list[list[dict[str, Any]]]:
        """Company-filtered hybrid search; one result list per query."""
        effective_limit = limit or self.default_limit
        per_query: list[list[dict[str, Any]]] = []
        log.trace(
            "batchsearch",
            "company='{}' queries={} limit={}",
            self.company,
            len(queries),
            effective_limit,
        )
        for query in queries:
            merged: list[dict[str, Any]] = []
            seen: set[str] = set()
            for result in company_search(self.embeddings, query, self.company, limit=effective_limit):
                if result.id in seen:
                    continue
                seen.add(result.id)
                merged.append(
                    {
                        "id": result.id,
                        "text": result.text,
                        "score": result.score,
                        "company": result.citation.company,
                        "source": result.citation.source,
                        "title": result.citation.title,
                        "chunk_index": result.citation.chunk_index,
                    }
                )
            per_query.append(merged[:effective_limit])
        return per_query

    def batchsimilarity(self, queries: list[Any], data: list[Any]) -> list[list[tuple[int, float]]]:
        """Delegate to underlying embeddings for reference scoring."""
        return self.embeddings.batchsimilarity(queries, data)

    def batchterms(self, queries: list[str]) -> list[str]:
        """Delegate keyword extraction when embeddings supports it."""
        if hasattr(self.embeddings, "batchterms"):
            return self.embeddings.batchterms(queries)
        return queries


class CompanyRAGService:
    """
    Wraps txtai RAG with company-filtered hybrid retrieval.

    LLM loading is lazy: the model is only initialized on first ``generate()``
    or explicit ``llm_available()`` check.
    """

    def __init__(
        self,
        embeddings: Any,
        llm_model: str,
        default_limit: int = 5,
    ):
        self.embeddings = embeddings
        self.llm_model = llm_model
        self.default_limit = default_limit
        self._rag: Any = None
        self._llm_available: Optional[bool] = None
        log.trace(
            "__init__",
            "CompanyRAGService created llm_model={} default_limit={}",
            llm_model,
            default_limit,
        )

    def _ensure_rag(self, company: str, limit: int) -> Any:
        """Create txtai RAG pipeline with company-scoped retriever and reference output."""
        if not TXTAI_RAG_AVAILABLE:
            raise RuntimeError("txtai RAG is not available")

        log.trace("_ensure_rag", "Initializing RAG llm_model={} company='{}'", self.llm_model, company)
        retriever = CompanyScopedRetriever(self.embeddings, company, limit)
        template = (
            "Answer the question using only the provided context.\n\n"
            "Question:\n{question}\n\n"
            "Context:\n{context}"
        )
        return RAG(
            retriever,
            self.llm_model,
            template=template,
            output="reference",
            context=limit,
        )

    def llm_available(self) -> bool:
        """
        Probe whether the configured LLM can be loaded.

        Result is cached. Does not block /search if LLM fails.
        """
        if self._llm_available is not None:
            log.trace("llm_available", "Cached result={}", self._llm_available)
            return self._llm_available
        try:
            log.trace("llm_available", "Probing LLM availability model={}", self.llm_model)
            self._ensure_rag("AcmeContent", 1)
            self._llm_available = True
            log.info("llm_available", "LLM available: {}", self.llm_model)
        except Exception as exc:  # noqa: BLE001
            log.warning("llm_available", "LLM not available for RAG: {}", exc)
            self._llm_available = False
        return self._llm_available

    def generate(
        self,
        query: str,
        company: str,
        limit: int | None = None,
        maxlength: int = 2048,
    ) -> RAGResponse:
        """
        Run full RAG: retrieve company-scoped chunks, generate answer, attach citations.

        Returns answer text, primary reference id, and all retrieval citations.
        """
        top_k = limit or self.default_limit
        log.trace(
            "generate",
            "RAG query='{}' company='{}' limit={} maxlength={}",
            query[:80],
            company,
            top_k,
            maxlength,
        )

        citations = company_search(self.embeddings, query, company, limit=top_k)
        log.trace("generate", "Retrieved {} citation chunks before LLM", len(citations))

        if not TXTAI_RAG_AVAILABLE:
            raise RuntimeError("txtai RAG is not available. Install txtai[pipeline-data].")

        rag = self._ensure_rag(company, top_k)
        log.trace("generate", "Calling LLM generate")
        result = rag(query, maxlength=maxlength)

        answer = ""
        reference_id: Optional[str] = None

        if isinstance(result, dict):
            answer = str(result.get("answer") or result.get("text") or "")
            reference_id = result.get("reference")
            if reference_id is not None:
                reference_id = str(reference_id)
        else:
            answer = str(result)

        log.trace(
            "generate",
            "LLM done answer_len={} reference={}",
            len(answer),
            reference_id,
        )

        if reference_id and not any(c.id == reference_id for c in citations):
            ref = resolve_reference(self.embeddings, reference_id)
            if ref:
                citations = [ref, *citations]

        return RAGResponse(
            query=query,
            company=company,
            answer=answer,
            reference=reference_id,
            citations=citations,
        )

"""
Company-scoped hybrid search with citation formatting.

Runs txtai SQL hybrid search (FAISS + BM25) with a mandatory ``company`` filter.
Each hit is normalized into a ``SearchResult`` with structured citation metadata.
"""

from __future__ import annotations

from typing import Any

from doc_rag.logging_utils import FnLogger, is_debug
from doc_rag.models import Citation, SearchResult

log = FnLogger("search")

# Hybrid semantic + BM25 search filtered by company metadata column.
SEARCH_SQL = """
SELECT id, text, score, company, source, title, chunk_index
FROM txtai
WHERE similar(:q) AND company = :company
"""


def _normalize_hit(hit: Any) -> dict[str, Any]:
    """Convert txtai search result (dict or tuple) into a uniform dict."""
    if isinstance(hit, dict):
        return hit
    if isinstance(hit, (list, tuple)):
        if len(hit) == 2 and isinstance(hit[0], (str, int)):
            return {"id": hit[0], "score": float(hit[1])}
        if len(hit) >= 3:
            return {"id": hit[0], "text": hit[1], "score": float(hit[2])}
    return {"id": str(hit)}


def _lookup_metadata(embeddings: Any, doc_id: str) -> dict[str, Any]:
    """Fetch full metadata row for a chunk id when the search hit is sparse."""
    log.debug("_lookup_metadata", "Looking up id={}", doc_id)
    rows = embeddings.search(
        "SELECT id, text, company, source, title, chunk_index FROM txtai WHERE id = :id",
        limit=1,
        parameters={"id": doc_id},
    )
    if not rows:
        log.debug("_lookup_metadata", "No row found for id={}", doc_id)
        return {}
    row = _normalize_hit(rows[0])
    return row


def format_search_result(hit: Any, embeddings: Any | None = None) -> SearchResult:
    """
    Build a ``SearchResult`` with nested ``Citation`` from a raw txtai hit.

    If the hit lacks source metadata, looks up the full row by id.
    """
    row = _normalize_hit(hit)
    doc_id = str(row.get("id", ""))

    if embeddings is not None and not row.get("source"):
        meta = _lookup_metadata(embeddings, doc_id)
        row = {**meta, **row}

    company = str(row.get("company", ""))
    source = str(row.get("source", ""))
    title = str(row.get("title", ""))
    chunk_index = int(row.get("chunk_index", 0) or 0)
    text = str(row.get("text", ""))
    score = float(row.get("score", 0.0) or 0.0)

    return SearchResult(
        id=doc_id,
        text=text,
        score=score,
        citation=Citation(
            company=company,
            source=source,
            title=title,
            chunk_index=chunk_index,
        ),
    )


def company_search(
    embeddings: Any,
    query: str,
    company: str,
    limit: int = 5,
) -> list[SearchResult]:
    """
    Run hybrid search scoped to one company tenant.

    Returns ranked chunks with scores and source citations.
    """
    log.trace(
        "company_search",
        "query='{}' company='{}' limit={}",
        query[:80],
        company,
        limit,
    )
    if is_debug():
        log.debug("company_search", "SQL parameters q='{}' company='{}'", query, company)

    hits = embeddings.search(
        SEARCH_SQL,
        limit=limit,
        parameters={"q": query, "company": company},
    )
    results = [format_search_result(hit, embeddings) for hit in hits]
    log.trace("company_search", "Returned {} results for company '{}'", len(results), company)
    if is_debug() and results:
        log.debug(
            "company_search",
            "Top hit score={:.4f} source={}",
            results[0].score,
            results[0].citation.source,
        )
    return results


def resolve_reference(embeddings: Any, reference_id: str) -> SearchResult | None:
    """Look up a single chunk by id (used to resolve RAG ``reference`` citations)."""
    log.trace("resolve_reference", "Resolving reference id={}", reference_id)
    rows = embeddings.search(
        "SELECT id, text, score, company, source, title, chunk_index FROM txtai WHERE id = :id",
        limit=1,
        parameters={"id": reference_id},
    )
    if not rows:
        log.debug("resolve_reference", "Reference id not found: {}", reference_id)
        return None
    return format_search_result(rows[0], embeddings)

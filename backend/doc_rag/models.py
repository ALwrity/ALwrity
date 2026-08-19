"""
Pydantic request/response schemas for the doc RAG FastAPI endpoints.

Search results include a nested ``Citation`` (company, source file, title, chunk index)
so clients can display source references without parsing chunk ids.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class Citation(BaseModel):
    """Source reference for a retrieved or generated doc chunk."""

    company: str
    source: str
    title: str
    chunk_index: int


class SearchResult(BaseModel):
    """One hybrid search hit with score and structured citation."""

    id: str
    text: str
    score: float
    citation: Citation


class SearchRequest(BaseModel):
    """POST /search body."""

    query: str
    company: str
    limit: int = Field(default=5, ge=1, le=50)


class SearchResponse(BaseModel):
    """GET/POST /search response."""

    query: str
    company: str
    results: list[SearchResult]
    count: int


class RAGRequest(BaseModel):
    """POST /rag body."""

    query: str
    company: str
    limit: int = Field(default=5, ge=1, le=20)
    maxlength: int = Field(default=2048, ge=256, le=8192)


class RAGResponse(BaseModel):
    """POST /rag response: LLM answer plus retrieval citations."""

    query: str
    company: str
    answer: str
    reference: Optional[str] = None
    citations: list[SearchResult] = Field(default_factory=list)


class CompanyInfo(BaseModel):
    """One tenant from companies.yaml with indexed counts."""

    name: str
    description: str
    document_count: int = 0
    chunk_count: int = 0


class CompaniesResponse(BaseModel):
    """GET /companies response."""

    companies: list[CompanyInfo]


class HealthResponse(BaseModel):
    """GET /health response."""

    status: str
    index_loaded: bool
    llm_available: bool
    version: str


class StatsResponse(BaseModel):
    """GET /stats response."""

    manifest: dict[str, Any]
    index_dir: str
    docs_path: str


class IngestResponse(BaseModel):
    """POST /ingest response."""

    status: str
    message: str
    manifest: Optional[dict[str, Any]] = None

"""
Runtime configuration for the doc RAG service.

Paths, model names, chunking defaults, and txtai hybrid-index settings are defined
here. Values can be overridden via environment variables or CLI flags in
``__main__.py``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from doc_rag.logging_utils import FnLogger, configure_logging, is_debug, is_verbose
from utils.storage_paths import find_repo_root

log = FnLogger("config")


def _repo_root() -> Path:
    """Resolve ALwrity repository root for default docs/index paths."""
    return find_repo_root()


@dataclass
class DocRagConfig:
    """
    All settings needed to ingest docs, build the hybrid index, and serve the API.

    The hybrid index combines FAISS dense vectors with BM25 sparse terms (SQLite).
    Company scoping is stored as metadata on each chunk, not as separate indexes.
    """

    docs_path: Path = field(default_factory=lambda: _repo_root() / "docs")
    index_dir: Path = field(default_factory=lambda: _repo_root() / "workspace" / "doc_rag" / "index")
    manifest_path: Path = field(default_factory=lambda: _repo_root() / "workspace" / "doc_rag" / "manifest.json")
    companies_config: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent / "companies.yaml"
    )
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    llm_model: str = field(default_factory=lambda: os.getenv("DOC_RAG_LLM", "Qwen/Qwen3-0.6B"))
    host: str = "0.0.0.0"
    port: int = 8001
    chunk_size: int = 800
    chunk_overlap: int = 100
    default_search_limit: int = 5
    ingest_extensions: tuple[str, ...] = (".md", ".txt")
    exclude_dirs: tuple[str, ...] = ("presentations",)
    verbose: bool = False
    debug: bool = False
    redis_url: str = field(default_factory=lambda: os.getenv("DOC_RAG_REDIS_URL", "redis://localhost:6379/0"))
    use_job_queue: bool = field(
        default_factory=lambda: os.getenv("DOC_RAG_USE_QUEUE", "true").strip().lower() in {"1", "true", "yes", "on"}
    )
    delegate_rag_to_workers: bool = field(
        default_factory=lambda: os.getenv("DOC_RAG_DELEGATE_RAG", "true").strip().lower()
        in {"1", "true", "yes", "on"}
    )

    @property
    def embeddings_config(self) -> dict:
        """
        txtai Embeddings config: hybrid FAISS + BM25.

        See txtai examples 48/52 and benchmarks.py Hybrid class.
        """
        return {
            "content": True,
            "path": self.embedding_model,
            "hybrid": True,
            "batch": 8192,
            "encodebatch": 128,
            "faiss": {"quantize": True, "sample": 0.05},
            "scoring": {"method": "bm25", "terms": True, "normalize": True},
        }

    @classmethod
    def from_env(cls, **overrides) -> "DocRagConfig":
        """
        Build config from defaults, environment variables, and CLI overrides.

        Env vars: DOC_RAG_DOCS_PATH, DOC_RAG_INDEX_DIR, DOC_RAG_EMBEDDING_MODEL,
        DOC_RAG_LLM, DOC_RAG_HOST, DOC_RAG_PORT, DOC_RAG_VERBOSE, DOC_RAG_DEBUG.
        """
        cfg = cls()
        if docs_path := os.getenv("DOC_RAG_DOCS_PATH"):
            cfg.docs_path = Path(docs_path).resolve()
        if index_dir := os.getenv("DOC_RAG_INDEX_DIR"):
            cfg.index_dir = Path(index_dir).resolve()
            cfg.manifest_path = cfg.index_dir.parent / "manifest.json"
        if model := os.getenv("DOC_RAG_EMBEDDING_MODEL"):
            cfg.embedding_model = model
        if llm := os.getenv("DOC_RAG_LLM"):
            cfg.llm_model = llm
        if host := os.getenv("DOC_RAG_HOST"):
            cfg.host = host
        if port := os.getenv("DOC_RAG_PORT"):
            cfg.port = int(port)
        for key, value in overrides.items():
            if hasattr(cfg, key):
                setattr(cfg, key, value)

        configure_logging(verbose=cfg.verbose, debug=cfg.debug)

        log.trace(
            "from_env",
            "Config loaded docs_path={} index_dir={} embedding_model={} llm_model={} verbose={} debug={}",
            cfg.docs_path,
            cfg.index_dir,
            cfg.embedding_model,
            cfg.llm_model,
            is_verbose(),
            is_debug(),
        )
        if is_debug():
            log.debug("from_env", "embeddings_config={}", cfg.embeddings_config)

        return cfg

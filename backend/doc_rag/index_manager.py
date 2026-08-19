"""
Hybrid embeddings index build, load, and manifest management.

Wraps txtai ``Embeddings`` with hybrid=True (FAISS dense + BM25 sparse in SQLite).
The index is persisted under ``workspace/doc_rag/index/``; a JSON manifest tracks
document/chunk counts and content hash for skip-on-restart logic.
"""

from __future__ import annotations

import gc
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from doc_rag.config import DocRagConfig
from doc_rag.logging_utils import FnLogger

log = FnLogger("index_manager")

try:
    from txtai import Embeddings

    TXTAI_AVAILABLE = True
except ImportError:
    Embeddings = None  # type: ignore[misc, assignment]
    TXTAI_AVAILABLE = False


class IndexManager:
    """
    Manages txtai hybrid index persistence and loading.

    Lifecycle: ``build_index()`` (first run) -> ``save()`` -> later ``load()``.
    """

    def __init__(self, config: DocRagConfig):
        self.config = config
        self.embeddings: Optional[Any] = None

    def index_exists(self) -> bool:
        """True when both index directory and manifest file are present."""
        exists = self.config.index_dir.is_dir() and self.config.manifest_path.is_file()
        log.trace(
            "index_exists",
            "index_dir={} manifest={} -> {}",
            self.config.index_dir,
            self.config.manifest_path,
            exists,
        )
        return exists

    def load_manifest(self) -> dict[str, Any]:
        """Read ingest manifest JSON; return empty dict if missing."""
        if not self.config.manifest_path.is_file():
            log.debug("load_manifest", "No manifest at {}", self.config.manifest_path)
            return {}
        with open(self.config.manifest_path, encoding="utf-8") as handle:
            manifest = json.load(handle)
        log.trace(
            "load_manifest",
            "Loaded manifest chunk_count={} document_count={}",
            manifest.get("chunk_count"),
            manifest.get("document_count"),
        )
        return manifest

    def save_manifest(self, manifest: dict[str, Any]) -> None:
        """Write ingest manifest JSON next to the index directory."""
        self.config.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config.manifest_path, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2)
        log.debug("save_manifest", "Wrote manifest to {}", self.config.manifest_path)

    def create_embeddings(self) -> Any:
        """Instantiate a new txtai Embeddings object with hybrid config."""
        if not TXTAI_AVAILABLE:
            raise RuntimeError(
                "txtai is not installed. Run: pip install -r requirements-doc-rag.txt"
            )
        log.trace("create_embeddings", "Creating Embeddings model={}", self.config.embedding_model)
        return Embeddings(self.config.embeddings_config)

    def release(self) -> None:
        """
        Release open index handles so the index directory can be deleted on Windows.

        Call before force re-ingest while the server is running.
        """
        if self.embeddings is None:
            log.trace("release", "No embeddings instance to release")
            return
        log.trace("release", "Releasing embeddings and running gc.collect()")
        self.embeddings = None
        gc.collect()

    def build_index(self, records: list[dict[str, Any]], manifest: dict[str, Any]) -> Any:
        """
        Build a fresh hybrid index from chunk records and persist to disk.

        Deletes any existing index directory first (requires ``release()`` if loaded).
        """
        log.info("build_index", "Building hybrid index with {} chunks", len(records))
        if self.config.index_dir.exists():
            log.trace("build_index", "Removing existing index dir {}", self.config.index_dir)
            shutil.rmtree(self.config.index_dir)

        embeddings = self.create_embeddings()
        log.trace("build_index", "Calling embeddings.index() on {} records", len(records))
        embeddings.index(records)
        self.config.index_dir.mkdir(parents=True, exist_ok=True)
        log.trace("build_index", "Saving index to {}", self.config.index_dir)
        embeddings.save(str(self.config.index_dir))

        manifest["indexed_at"] = datetime.now(timezone.utc).isoformat()
        self.save_manifest(manifest)
        self.embeddings = embeddings
        log.info("build_index", "Index saved to {}", self.config.index_dir)
        return embeddings

    def load(self) -> Any:
        """Load a previously saved hybrid index from disk into memory."""
        if not TXTAI_AVAILABLE:
            raise RuntimeError(
                "txtai is not installed. Run: pip install -r requirements-doc-rag.txt"
            )
        if not self.index_exists():
            raise FileNotFoundError(
                f"No index found at {self.config.index_dir}. Run ingest first."
            )

        log.trace("load", "Loading index from {}", self.config.index_dir)
        embeddings = self.create_embeddings()
        embeddings.load(str(self.config.index_dir))
        self.embeddings = embeddings
        log.info("load", "Loaded index from {}", self.config.index_dir)
        return embeddings

    def get_embeddings(self) -> Any:
        """Return cached embeddings or load from disk if not yet loaded."""
        if self.embeddings is None:
            log.trace("get_embeddings", "Embeddings not cached; loading from disk")
            return self.load()
        log.trace("get_embeddings", "Returning cached embeddings instance")
        return self.embeddings

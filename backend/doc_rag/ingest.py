"""
Document discovery, company mapping, chunking, and ingest orchestration.

Pipeline:
  1. Walk ``docs/`` for ``.md`` / ``.txt`` files
  2. Assign each file to a fictional company tenant via ``companies.yaml``
  3. Split file content into heading-aware chunks
  4. Build txtai index records with ``company``, ``source``, ``title`` metadata
  5. Delegate to ``IndexManager.build_index()`` for hybrid FAISS+BM25 indexing
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

import yaml

from doc_rag.config import DocRagConfig
from doc_rag.index_manager import IndexManager
from doc_rag.logging_utils import FnLogger, is_debug

log = FnLogger("ingest")


@dataclass
class CompanyMapping:
    """One fictional tenant and the docs/ folder prefixes it owns."""

    name: str
    description: str
    prefixes: list[str]
    root_files: bool = False


def load_company_mappings(config_path: Path) -> list[CompanyMapping]:
    """Load company -> folder mappings from ``companies.yaml``."""
    log.trace("load_company_mappings", "Reading {}", config_path)
    with open(config_path, encoding="utf-8") as handle:
        data = yaml.safe_load(handle)

    mappings: list[CompanyMapping] = []
    for name, info in data.get("companies", {}).items():
        prefixes = [f"{folder}/" for folder in info.get("folders", [])]
        mappings.append(
            CompanyMapping(
                name=name,
                description=info.get("description", ""),
                prefixes=prefixes,
                root_files=bool(info.get("root_files", False)),
            )
        )
    log.debug("load_company_mappings", "Loaded {} company mappings", len(mappings))
    return mappings


def resolve_company(relative_path: str, mappings: list[CompanyMapping]) -> str | None:
    """
    Map a docs-relative path to a company name.

    Uses longest matching folder prefix; root-level ``docs/*.md`` maps to the
    company with ``root_files: true`` (PlatformOps).
    """
    normalized = relative_path.replace("\\", "/")

    best_match: tuple[int, str] | None = None
    for mapping in mappings:
        for prefix in mapping.prefixes:
            if normalized.startswith(prefix) or normalized == prefix.rstrip("/"):
                score = len(prefix)
                if best_match is None or score > best_match[0]:
                    best_match = (score, mapping.name)

    if best_match:
        log.debug("resolve_company", "Path '{}' -> company '{}'", normalized, best_match[1])
        return best_match[1]

    if "/" not in normalized:
        for mapping in mappings:
            if mapping.root_files:
                log.debug("resolve_company", "Root file '{}' -> company '{}'", normalized, mapping.name)
                return mapping.name

    log.debug("resolve_company", "No company match for '{}'", normalized)
    return None


def discover_documents(config: DocRagConfig, mappings: list[CompanyMapping]) -> list[tuple[str, str, Path]]:
    """
    Recursively find ingestible files under ``config.docs_path``.

    Returns list of ``(company, relative_path, absolute_path)`` tuples.
    Skips excluded dirs (e.g. presentations/) and unmapped paths.
    """
    docs: list[tuple[str, str, Path]] = []
    docs_root = config.docs_path.resolve()
    log.trace("discover_documents", "Scanning {} for {}", docs_root, config.ingest_extensions)

    for path in sorted(docs_root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in config.ingest_extensions:
            continue

        relative = path.relative_to(docs_root).as_posix()
        parts = relative.split("/")
        if any(part in config.exclude_dirs for part in parts):
            log.debug("discover_documents", "Excluded (dir filter): {}", relative)
            continue

        company = resolve_company(relative, mappings)
        if company is None:
            log.debug("discover_documents", "Skipped unmapped: {}", relative)
            continue

        docs.append((company, relative, path))
        if is_debug():
            log.debug("discover_documents", "Accepted {} -> {}", relative, company)

    log.info("discover_documents", "Discovered {} documents under {}", len(docs), docs_root)
    return docs


def _title_from_path(relative_path: str) -> str:
    """Derive a human-readable title from the file stem."""
    stem = Path(relative_path).stem
    title = re.sub(r"[_-]+", " ", stem).strip()
    return title or stem


def _split_long_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Fixed-size word-window chunking with overlap for oversized paragraphs."""
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(len(words), start + chunk_size)
        chunk = " ".join(words[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(words):
            break
        start = max(end - overlap, start + 1)

    return chunks


def chunk_markdown(text: str, chunk_size: int, overlap: int) -> list[str]:
    """
    Split markdown into chunks by heading, then paragraph, then word window.

    ``chunk_size`` and ``overlap`` are in words (approximate token count).
    """
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []

    sections = re.split(r"\n(?=#{1,6}\s)", text)
    chunks: list[str] = []

    for section in sections:
        section = section.strip()
        if not section:
            continue

        words = section.split()
        if len(words) <= chunk_size:
            chunks.append(section)
            continue

        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", section) if p.strip()]
        buffer: list[str] = []
        buffer_words = 0

        for paragraph in paragraphs:
            para_words = len(paragraph.split())
            if para_words > chunk_size:
                if buffer:
                    chunks.append("\n\n".join(buffer))
                    buffer = []
                    buffer_words = 0
                chunks.extend(_split_long_text(paragraph, chunk_size, overlap))
                continue

            if buffer_words + para_words > chunk_size and buffer:
                chunks.append("\n\n".join(buffer))
                buffer = [paragraph]
                buffer_words = para_words
            else:
                buffer.append(paragraph)
                buffer_words += para_words

        if buffer:
            chunks.append("\n\n".join(buffer))

    return chunks


def build_records(
    documents: list[tuple[str, str, Path]],
    config: DocRagConfig,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Convert discovered files into txtai index records plus an ingest manifest.

    Each record includes filterable metadata: ``company``, ``source``, ``title``,
    ``chunk_index``.
    """
    records: list[dict[str, Any]] = []
    company_doc_counts: dict[str, int] = {}
    company_chunk_counts: dict[str, int] = {}
    source_hashes: list[str] = []

    log.trace("build_records", "Chunking {} documents (chunk_size={})", len(documents), config.chunk_size)

    for company, relative, path in documents:
        text = path.read_text(encoding="utf-8", errors="ignore")
        source_hashes.append(f"{relative}:{hashlib.sha256(text.encode()).hexdigest()[:16]}")

        chunks = chunk_markdown(text, config.chunk_size, config.chunk_overlap)
        if not chunks:
            log.debug("build_records", "No chunks produced for {}", relative)
            continue

        title = _title_from_path(relative)
        company_doc_counts[company] = company_doc_counts.get(company, 0) + 1

        for chunk_index, chunk_text in enumerate(chunks):
            record_id = f"{company}:{relative}:{chunk_index}"
            records.append(
                {
                    "id": record_id,
                    "text": chunk_text,
                    "company": company,
                    "source": f"docs/{relative}",
                    "title": title,
                    "chunk_index": chunk_index,
                }
            )
            company_chunk_counts[company] = company_chunk_counts.get(company, 0) + 1

        if is_debug():
            log.debug("build_records", "File {} -> {} chunks (company={})", relative, len(chunks), company)

    content_hash = hashlib.sha256("\n".join(sorted(source_hashes)).encode()).hexdigest()
    manifest = {
        "docs_path": str(config.docs_path),
        "document_count": len(documents),
        "chunk_count": len(records),
        "company_doc_counts": company_doc_counts,
        "company_chunk_counts": company_chunk_counts,
        "content_hash": content_hash,
    }
    log.info(
        "build_records",
        "Built {} chunks from {} docs (content_hash={})",
        len(records),
        len(documents),
        content_hash[:12],
    )
    log.trace("build_records", "Per-company chunk counts: {}", company_chunk_counts)
    return records, manifest


def run_ingest(config: DocRagConfig, force: bool = False, manager: IndexManager | None = None) -> dict[str, Any]:
    """
    Main ingest entry point.

    Skips if index+manifest exist unless ``force=True``. On force, releases any
    open index handles before rebuilding (needed on Windows).
    """
    index_manager = manager or IndexManager(config)

    if index_manager.index_exists() and not force:
        manifest = index_manager.load_manifest()
        log.info(
            "run_ingest",
            "Index already exists ({} chunks). Skipping ingest.",
            manifest.get("chunk_count", "?"),
        )
        return manifest

    if force:
        log.trace("run_ingest", "Force re-ingest: releasing open index handles")
        index_manager.release()

    mappings = load_company_mappings(config.companies_config)
    documents = discover_documents(config, mappings)
    if not documents:
        log.error("run_ingest", "No documents found under {}", config.docs_path)
        raise RuntimeError(f"No documents found under {config.docs_path}")

    records, manifest = build_records(documents, config)
    if not records:
        log.error("run_ingest", "No chunks produced from {} documents", len(documents))
        raise RuntimeError("No chunks produced from discovered documents")

    index_manager.build_index(records, manifest)
    log.info("run_ingest", "Ingest complete: {} chunks indexed", manifest["chunk_count"])
    return manifest


def iter_records_for_debug(config: DocRagConfig) -> Iterator[dict[str, Any]]:
    """Yield index records without building the index (debug helper)."""
    mappings = load_company_mappings(config.companies_config)
    documents = discover_documents(config, mappings)
    records, _ = build_records(documents, config)
    yield from records

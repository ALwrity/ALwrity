"""SIF x Strategy integration — Phase SIF-B: indexing pipeline.

Turns one *active* content strategy into 8 txtai documents for the
user's existing SIF index, guarded by the ``SIFIndexingWatermark``.

Contract (locked in ``docs/planning/sif-strategy-integration.md``):

- 8 kinds per activation: ``form_summary`` (rendered 30-column form) +
  6 ``comprehensive_ai_analysis`` components + ``user_persona_digest``.
  The analysis ``summary`` key is NOT indexed.
- Doc ids ``user:{uid}:strategy_active:current:{kind}`` — upsert in
  place, so re-activation replaces the previous activation's docs and
  no stale kinds accumulate.
- ``source_hash`` = sha256 over canonical ``{user_id, activation_date,
  strategy_data}``; the watermark treats unchanged reactivation as fresh
  and skips re-embedding.
- Non-blocking by design: the activation hook calls
  ``index_active_strategy_async`` (fire-and-forget, 3 retries with
  1s/2s/4s backoff). Indexing must never fail activation.

The module is caller-agnostic: ``strategy_data`` is a plain dict (the
model's ``to_dict()`` snapshot), ``db`` is an active SQLAlchemy session,
and ``sif_service`` can be injected (a ``TxtaiIntelligenceService`` is
built per user when omitted) — which keeps upload-time unit tests free
of txtai.
"""
from __future__ import annotations

import asyncio
import json
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from models.sif_indexing_watermark import SIFIndexingWatermark
from services.intelligence.txtai_service import TxtaiIntelligenceService

from .sif_strategy_source_ids import (
    PERSONA_FORM_FIELDS,
    STRATEGY_FORM_FIELDS,
    STRATEGY_KINDS,
    active_strategy_doc_id,
    active_strategy_source_id,
    build_form_text,
    compute_source_hash,
)

# Analysis components from ``comprehensive_ai_analysis`` indexed one
# document per kind. Order is contractual (fixed in SIF-A).
ANALYSIS_KINDS: tuple = (
    "base_strategy",
    "strategic_insights",
    "competitive_analysis",
    "performance_predictions",
    "implementation_roadmap",
    "risk_assessment",
)

DEFAULT_STRATEGY_VERSION = "2.0"
SIF_STRATEGY_FEATURE_FLAG = "STRATEGY_SIF_INDEXING_ENABLED"
DEFAULT_INDEX_RETRIES = 3
DEFAULT_RETRY_BASE_DELAY = 1.0


def strategy_sif_indexing_enabled() -> bool:
    """Feature flag: gate the whole SIF x Strategy integration."""
    raw = os.getenv(SIF_STRATEGY_FEATURE_FLAG, "1")
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _to_iso(value: Any) -> str:
    """Normalize a date/datetime/str into an ISO-8601 string."""
    if value is None:
        return datetime.utcnow().isoformat()
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _dump_json(obj: Any) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False, default=str)


def extract_form_fields(strategy_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract exactly the 30 form columns (contract order) from a snapshot."""
    return {label: strategy_data.get(label) for label in STRATEGY_FORM_FIELDS}


def _strategy_metadata(comprehensive: Dict[str, Any]) -> Dict[str, Any]:
    """Shared metadata for every chunk, from the analysis pre-wired keys."""
    meta = comprehensive.get("strategy_metadata") or {}
    return {
        "version": meta.get("version") or DEFAULT_STRATEGY_VERSION,
        "generated_at": _to_iso(meta.get("generated_at")),
        "grounding_status": meta.get("grounding_status") or "unknown",
        "content_categories": meta.get("content_categories"),
    }


def _chunk_text(kind: str, strategy_data: Dict[str, Any], comprehensive: Dict[str, Any],
                persona_fields: Tuple[str, ...] = PERSONA_FORM_FIELDS) -> Optional[str]:
    """Return the embeddable text for one strategy ``kind`` (None = skip)."""
    if kind == "form_summary":
        return build_form_text(extract_form_fields(strategy_data))
    if kind == "user_persona_digest":
        fields = tuple(f for f in persona_fields if strategy_data.get(f) is not None)
        if not fields:
            return None
        return build_form_text(strategy_data, fields=fields)
    component = comprehensive.get(kind)
    if component is None or component == {} or component == [] or component == "":
        return None
    return component if isinstance(component, str) else _dump_json(component)


def build_strategy_chunks(
    strategy_data: Dict[str, Any],
    user_id: str,
    activation_date: Any,
) -> List[Tuple[str, str, Dict[str, Any]]]:
    """Build the 8 ``(doc_id, text, metadata)`` tuples for one activation.

    Components that are missing/empty are skipped (a partial activation
    with e.g. 5/6 analysis components indexed is acceptable); at minimum
    the 30-line ``form_summary`` renders from whatever form data exists.
    """
    comprehensive = strategy_data.get("comprehensive_ai_analysis") or {}
    source_id = active_strategy_source_id(user_id)
    activation_iso = _to_iso(activation_date)
    shared = _strategy_metadata(comprehensive)
    shared["strategy_id"] = strategy_data.get("id")
    shared["source_id"] = source_id
    shared["activation_date"] = activation_iso

    chunks: List[Tuple[str, str, Dict[str, Any]]] = []
    for kind in STRATEGY_KINDS:
        text = _chunk_text(kind, strategy_data, comprehensive)
        if not text:
            continue
        metadata = {**shared, "kind": kind}
        chunks.append((active_strategy_doc_id(user_id, kind), text, metadata))
    return chunks


def compute_strategy_source_hash(
    user_id: str,
    strategy_data: Dict[str, Any],
    activation_date: Any,
) -> str:
    """sha256 watermark hash for an activation snapshot."""
    return compute_source_hash(
        user_id, strategy_data, activation_date=_to_iso(activation_date)
    )


def _record_strategy_event(operation: str, user_id: str, outcome: str, **extra):
    from .sif_metrics import inc_counter, log_sif_event

    inc_counter(f"sif_{operation}_total", outcome, value=extra.pop("value", 1))
    log_sif_event(operation, user_id=user_id, outcome=outcome, extra=extra or None)


def get_document_metadata(sif_service, doc_id: str) -> Dict[str, Any]:
    """Return the stored metadata dict for one strategy doc id.

    ``SIF-G`` uses this as a post-filter accessor: search returns
    ``(id, score)`` pairs, and this reads each hit's embedded metadata
    (kind, strategy_id, activation_date, ...) without a second index.
    Missing/unparseable metadata yields ``{}`` (callers treat the hit
    as pass-through).
    """
    try:
        doc = sif_service.embeddings.get(doc_id)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"get_document_metadata failed for {doc_id}: {exc}")
        return {}
    if not isinstance(doc, dict):
        return {}
    raw = doc.get("metadata") or doc.get("tags") or "{}"
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError):
        return {}


async def index_active_strategy(
    db,
    user_id: str,
    strategy_data: Dict[str, Any],
    *,
    activation_date: Any,
    sif_service=None,
) -> int:
    """Embed (or skip-as-fresh) the active strategy's docs synchronously.

    Returns the number of docs actually upserted. A fresh watermark
    returns 0 without touching the index. A zero-embed result (e.g. the
    txtai Windows file-lock path) is NOT recorded in the watermark so a
    future dispatch retries rather than skip forever. Watermark commits
    are best-effort and never raise.
    """
    source_id = active_strategy_source_id(user_id)
    source_hash = compute_strategy_source_hash(user_id, strategy_data, activation_date)

    if SIFIndexingWatermark.is_fresh(db, user_id, source_id, source_hash):
        logger.info(f"SIF strategy watermark fresh for user {user_id} — skipping embed")
        return 0

    chunks = build_strategy_chunks(strategy_data, user_id, activation_date)
    if not chunks:
        logger.warning(f"No strategy chunks to index for user {user_id}")
        _record_strategy_event("strategy_index", user_id=user_id, outcome="skipped",
                               reason="no_chunks", value=1)
        return 0

    service = sif_service or TxtaiIntelligenceService(user_id)
    count = await service.index_content(chunks)
    if count <= 0:
        logger.warning(
            f"SIF strategy embed produced 0 docs for user {user_id} "
            f"(lock/partial?) — watermark NOT recorded so we retry later"
        )
        _record_strategy_event("strategy_index", user_id=user_id, outcome="skipped",
                               reason="zero_embeds", value=1)
        return 0

    try:
        SIFIndexingWatermark.upsert(
            db,
            user_id,
            source_id,
            source_hash,
            embedding_count=count,
            notes=f"strategy activation {_to_iso(activation_date)}",
        )
        db.commit()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"SIF strategy watermark commit failed for user {user_id}: {exc}")
        try:
            db.rollback()
        except Exception:
            pass

    _record_strategy_event("strategy_index", user_id=user_id, outcome="success",
                           count=count, value=count)
    return count


async def _index_with_retries(
    db,
    user_id: str,
    strategy_data: Dict[str, Any],
    *,
    activation_date: Any,
    sif_service,
    retries: int,
    base_delay: float,
) -> int:
    for attempt in range(1, retries + 1):
        try:
            count = await index_active_strategy(
                db, user_id, strategy_data,
                activation_date=activation_date, sif_service=sif_service,
            )
            return count
        except Exception as exc:
            logger.warning(
                f"SIF strategy index attempt {attempt}/{retries} failed for "
                f"user {user_id}: {exc}"
            )
            if attempt == retries:
                _record_strategy_event("strategy_index", user_id=user_id,
                                       outcome="failure", reason=str(exc), value=1)
                return 0
            await asyncio.sleep(base_delay * (2 ** (attempt - 1)))
    return 0


def index_active_strategy_async(
    db,
    user_id: str,
    strategy_data: Dict[str, Any],
    *,
    activation_date: Any,
    sif_service=None,
    retries: int = DEFAULT_INDEX_RETRIES,
    base_delay: float = DEFAULT_RETRY_BASE_DELAY,
) -> "asyncio.Task":
    """Fire-and-forget indexing task for the activation hook.

    Returns the ``asyncio.Task`` immediately; the endpoint must NOT await
    it. Failures are logged, metered via ``sif_strategy_index_total``,
    and never propagate (activation already committed by the caller).
    """
    return asyncio.create_task(
        _index_with_retries(
            db, user_id, strategy_data,
            activation_date=activation_date,
            sif_service=sif_service,
            retries=retries,
            base_delay=base_delay,
        )
    )
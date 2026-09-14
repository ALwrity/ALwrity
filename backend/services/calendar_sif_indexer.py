"""Calendar SIF x Calendar integration — Phase B: chunk builder.

Builds 8 ``(doc_id, text, metadata)`` tuples from a generated
content calendar for the per-user SIF index. Mirrors
``strategy_indexer.py`` but for calendar output instead of
strategy data.

Contract:
- 8 kinds: ``calendar_overview``, ``daily_schedule``, ``weekly_themes``,
  ``content_recommendations``, ``performance_predictions``, ``ai_insights``,
  ``strategy_alignment``, ``calendar_events``.
- Doc ids ``user:{uid}:calendar_latest:{kind}`` — upsert in place on
  each generation so earlier generations' docs are replaced.
- ``source_hash`` = sha256 over canonical ``{user_id, generated_at, calendar}``;
  the watermark treats unchanged re-generation as fresh and skips re-embed.
- Non-blocking by design: the generation completion handler calls
  ``index_calendar_async`` (fire-and-forget). Indexing must never fail
  calendar generation.
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from models.calendar_sif_watermark import CalendarSifWatermark
from models.calendar_sif_index_status import (
    STATUS_FAILED,
    STATUS_RUNNING,
    STATUS_SKIPPED,
    STATUS_SUCCESS,
    CalendarSifIndexStatus,
)

from services.intelligence.txtai_service import TxtaiIntelligenceService

from .calendar_sif_source_ids import (
    CALENDAR_KINDS,
    compute_calendar_source_hash,
    calendar_latest_doc_id,
    calendar_latest_source_id,
)

DEFAULT_INDEX_RETRIES = 3
DEFAULT_RETRY_BASE_DELAY = 1.0
CALENDAR_SIF_FEATURE_FLAG = "CALENDAR_SIF_INDEXING_ENABLED"


def calendar_sif_indexing_enabled() -> bool:
    raw = os.getenv(CALENDAR_SIF_FEATURE_FLAG, "1")
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _to_iso(value: Any) -> str:
    if value is None:
        return datetime.utcnow().isoformat()
    if isinstance(value, (datetime, datetime)):
        return value.isoformat()
    return str(value)


def _dump_json(obj: Any) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False, default=str)


def _build_overview_text(calendar: Dict[str, Any]) -> str:
    lines = []
    for label in (
        "calendar_type", "industry", "business_size", "content_pillars",
        "platform_strategies", "content_mix", "optimal_timing", "generated_at",
    ):
        value = calendar.get(label)
        if isinstance(value, (dict, list)):
            value = _dump_json(value)
        lines.append(f"{label}: {value if value is not None else ''}")
    return "\n".join(lines) + "\n"


def _build_events_text(calendar: Dict[str, Any]) -> Optional[str]:
    schedule = calendar.get("daily_schedule") or []
    events: list = []
    for day in schedule:
        for item in day.get("content_items") or []:
            events.append(item)
    if not events:
        return None
    lines = []
    for evt in events:
        title = evt.get("title", "")
        content_type = evt.get("content_type", "")
        platform = evt.get("platform", "")
        date = evt.get("date") or evt.get("scheduled_date", "")
        status = evt.get("status", "")
        kpi = evt.get("kpi", "")
        outcome = evt.get("expected_outcome", "")
        lines.append(
            f"title: {title} | content_type: {content_type} | "
            f"platform: {platform} | date: {date} | "
            f"status: {status} | kpi: {kpi} | outcome: {outcome}"
        )
    return "\n".join(lines) + "\n" if lines else None


def _build_alignment_text(calendar: Dict[str, Any]) -> str:
    parts = []
    quality = calendar.get("quality_score")
    if quality is not None:
        parts.append(f"quality_score: {quality}")
    digest = calendar.get("strategy_digest")
    if digest:
        parts.append(_dump_json(digest))
    insights = calendar.get("strategy_insights")
    if insights:
        parts.append(_dump_json(insights))
    gaps = calendar.get("gap_analysis_insights")
    if gaps:
        parts.append(_dump_json(gaps))
    return "\n".join(parts) if parts else ""


def build_calendar_chunks(
    calendar_data: Dict[str, Any],
    user_id: str,
    generated_at: str,
) -> List[Tuple[str, str, Dict[str, Any]]]:
    """Build the 8 ``(doc_id, text, metadata)`` tuples for one generation.

    Components that are missing/empty are skipped (a partial generation
    with e.g. 5/8 chunks indexed is acceptable); at minimum
    ``calendar_overview`` is always emitted if the calendar has metadata.
    """
    source_id = calendar_latest_source_id(user_id)
    chunks: List[Tuple[str, str, Dict[str, Any]]] = []
    shared = {
        "version": "1.0",
        "generated_at": _to_iso(generated_at),
        "calendar_type": calendar_data.get("calendar_type", ""),
        "strategy_id": calendar_data.get("strategy_id"),
        "source_id": source_id,
    }

    # 1. calendar_overview — always included
    overview_text = _build_overview_text(calendar_data)
    chunks.append((
        calendar_latest_doc_id(user_id, "calendar_overview"),
        overview_text,
        {**shared, "kind": "calendar_overview"},
    ))

    # 2. daily_schedule
    schedule = calendar_data.get("daily_schedule")
    if schedule:
        chunks.append((
            calendar_latest_doc_id(user_id, "daily_schedule"),
            _dump_json(schedule),
            {**shared, "kind": "daily_schedule"},
        ))

    # 3. weekly_themes
    themes = calendar_data.get("weekly_themes")
    if themes:
        chunks.append((
            calendar_latest_doc_id(user_id, "weekly_themes"),
            _dump_json(themes),
            {**shared, "kind": "weekly_themes"},
        ))

    # 4. content_recommendations
    recs = calendar_data.get("content_recommendations")
    if recs:
        chunks.append((
            calendar_latest_doc_id(user_id, "content_recommendations"),
            _dump_json(recs),
            {**shared, "kind": "content_recommendations"},
        ))

    # 5. performance_predictions
    preds = calendar_data.get("performance_predictions")
    if preds:
        pred_text = "\n".join(
            f"{k}: {v}" for k, v in preds.items()
        )
        chunks.append((
            calendar_latest_doc_id(user_id, "performance_predictions"),
            pred_text,
            {**shared, "kind": "performance_predictions"},
        ))

    # 6. ai_insights
    insights = calendar_data.get("ai_insights")
    if insights:
        chunks.append((
            calendar_latest_doc_id(user_id, "ai_insights"),
            _dump_json(insights),
            {**shared, "kind": "ai_insights"},
        ))

    # 7. strategy_alignment
    alignment_text = _build_alignment_text(calendar_data)
    if alignment_text:
        chunks.append((
            calendar_latest_doc_id(user_id, "strategy_alignment"),
            alignment_text,
            {**shared, "kind": "strategy_alignment"},
        ))

    # 8. calendar_events
    events_text = _build_events_text(calendar_data)
    if events_text:
        chunks.append((
            calendar_latest_doc_id(user_id, "calendar_events"),
            events_text,
            {**shared, "kind": "calendar_events"},
        ))

    # Add source_hash for watermark
    source_hash = compute_calendar_source_hash(user_id, calendar_data, generated_at)
    for i, (doc_id, text, meta) in enumerate(chunks):
        chunks[i] = (doc_id, text, {**meta, "source_hash": source_hash})

    return chunks


def _default_sif_session_factory(user_id: str):
    """Open a fresh per-user session for the background indexing task.

    The returned session is owned by the task (R2.1) and closed in
    ``finally`` — the caller's request-scoped session never crosses the
    task boundary.
    """
    from services.database.sessions import get_session_for_user

    return get_session_for_user(user_id)


def index_calendar_async(
    user_id: str,
    calendar_data: Dict[str, Any],
    generated_at: str,
    sif_service: Optional[TxtaiIntelligenceService] = None,
    session_factory=None,
):
    """Fire-and-forget entry point for calendar SIF indexing.

    R2.1: takes NO session parameter — the background task opens its own
    dedicated session via ``get_session_for_user`` (or the injected
    ``session_factory`` in tests), runs the lifecycle inside it, and closes
    it in ``finally``. Returns the created asyncio task (or ``None`` when
    dispatch failed). Never raises — indexing must never fail calendar
    generation.
    """
    import asyncio

    if session_factory is None:
        session_factory = _default_sif_session_factory

    async def _run():
        session = session_factory(user_id)
        try:
            await _run_indexing_lifecycle(
                session, user_id, calendar_data, generated_at, sif_service
            )
        finally:
            try:
                session.close()
            except Exception:
                pass

    try:
        return asyncio.create_task(_run())
    except Exception as exc:
        logger.warning(f"⚠️ Calendar SIF dispatch failed: {exc}")
        return None


async def _run_indexing_lifecycle(
    session,
    user_id: str,
    calendar_data: Dict[str, Any],
    generated_at: str,
    sif_service: Optional[TxtaiIntelligenceService] = None,
) -> None:
    """Full lifecycle with status tracking and watermark dedup."""
    source_id = calendar_latest_source_id(user_id)

    # Record pending/running
    CalendarSifIndexStatus.set_status(
        session, user_id, source_id, STATUS_RUNNING
    )
    session.commit()

    try:
        # Check watermark freshness
        source_hash = compute_calendar_source_hash(
            user_id, calendar_data, generated_at
        )
        if CalendarSifWatermark.is_fresh(session, user_id, source_id, source_hash):
            logger.info(f"📅 Calendar SIF index fresh for {source_id}; skipping")
            CalendarSifIndexStatus.set_status(
                session, user_id, source_id, STATUS_SKIPPED
            )
            session.commit()
            return

        # Build chunks
        chunks = build_calendar_chunks(calendar_data, user_id, generated_at)
        if not chunks:
            logger.info(f"📅 No calendar chunks to index for {source_id}")
            CalendarSifIndexStatus.set_status(
                session, user_id, source_id, STATUS_SKIPPED
            )
            session.commit()
            return

        # Index via txtai
        if sif_service is None:
            from services.intelligence.txtai_service import TxtaiIntelligenceService
            sif_service = TxtaiIntelligenceService(user_id)

        embedded = await sif_service.index_content(chunks)
        try:
            embedded_count = int(embedded)
        except (TypeError, ValueError):
            embedded_count = 0
        if embedded_count <= 0:
            raise RuntimeError(
                f"Calendar SIF embed produced {embedded_count} embeddings "
                f"for {source_id}"
            )

        # Record watermark with the ACTUAL embedded count
        CalendarSifWatermark.upsert(
            session,
            user_id,
            source_id,
            source_hash,
            embedding_count=embedded_count,
            notes="calendar generation completion",
        )

        CalendarSifIndexStatus.set_status(
            session,
            user_id,
            source_id,
            STATUS_SUCCESS,
            embedding_count=embedded_count,
        )
        session.commit()
        logger.info(
            f"📅 Calendar SIF indexed {embedded_count} chunks for {source_id}"
        )

    except Exception as exc:
        logger.error(f"❌ Calendar SIF indexing failed: {exc}")
        CalendarSifIndexStatus.set_status(
            session,
            user_id,
            source_id,
            STATUS_FAILED,
            error_message=str(exc),
        )
        session.commit()


def compute_calendar_source_hash_wrapper(
    user_id: str,
    calendar_data: Dict[str, Any],
    generated_at: str,
) -> str:
    """Public wrapper for source hash computation."""
    return compute_calendar_source_hash(user_id, calendar_data, generated_at)

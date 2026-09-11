"""SIF x Strategy — Phase 1: read-only status builder for the active
content strategy's indexing lifecycle.

Pure read path used by ``GET /strategy/sif-status``. Never writes, never
touches txtai (a per-kind presence check would force an index load — that
is deferred; the payload states ``document_kinds_checked: false``).

The payload combines four signals so the UI can answer "what happened to
my strategy's semantic index?":

- ``indexing``: the ``strategy_sif_index_status`` lifecycle row
  (``pending``/``running``/``success``/``skipped``/``failed``) or the
  derived ``phase`` label when no row exists.
- ``watermark``: the ``sif_indexing_watermarks`` row (proof of a last
  successful embed, with count + hash).
- ``vfs_mirror``: whether ``strategy/active.md`` exists on disk.
- ``document_kinds``: the 8 canonical kinds + doc ids, with per-kind
  presence left unchecked.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, Optional

from loguru import logger

from models.monitoring_models import StrategyActivationStatus
from models.sif_indexing_watermark import SIFIndexingWatermark
from models.strategy_sif_index_status import StrategySifIndexStatus
from services.workspace_paths import get_user_workspace_dir

from .sif_strategy_source_ids import (
    STRATEGY_KINDS,
    active_strategy_doc_id,
    active_strategy_source_id,
)

PHASE_NOT_INDEXED = "not_indexed"
PHASE_NO_ACTIVE_STRATEGY = "no_active_strategy"

# Human-readable framing for each lifecycle row status. ``phase`` is the
# UI-facing signal; keep it in plain language.
STATUS_PHASE_MAP = {
    "pending": "pending",
    "running": "running",
    "success": "success",
    "failure": "failed",
    "failed": "failed",
    "skipped": "skipped",
}

STATUS_SUMMARY_MAP = {
    "pending": "Indexing scheduled — embedding has not started yet.",
    "running": "Embedding is running in the background.",
    "success": "Indexed — your strategy is searchable by agents.",
    "failed": "Indexing failed — see error_message; try re-activating.",
    "skipped": "No new content to index (strategy unchanged).",
}


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def query_active_activation(session, user_id: str, uid: Optional[int] = None):
    """Return the latest ``'active'`` activation row for a user.

    Resolves by BOTH the legacy numeric ``uid`` and the raw (Clerk) string
    ``user_id``: ``strategy_activation_status.user_id`` now stores the raw
    Clerk id while historical rows keep the integer uid, so a numeric-only
    lookup silently reports "no active strategy" for every string-id user.
    SQLite's type-affinity comparison makes either binding match regardless
    of the column's declared type. Degrades to ``None`` (never raises).
    """
    candidates: list = []
    numeric = None
    try:
        numeric = int(user_id)
    except (TypeError, ValueError):
        pass
    for candidate in (uid, numeric, user_id):
        if candidate is None or candidate in candidates:
            continue
        candidates.append(candidate)

    for candidate in candidates:
        try:
            row = (
                session.query(StrategyActivationStatus)
                .filter(
                    StrategyActivationStatus.user_id == candidate,
                    StrategyActivationStatus.status == "active",
                )
                .order_by(StrategyActivationStatus.activation_date.desc())
                .first()
            )
        except Exception as exc:
            logger.warning(
                f"strategy_sif_status activation lookup failed for {user_id!r} "
                f"(candidate={candidate!r}): {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            continue
        if row is not None:
            return row
    return None


def _strategy_sif_status_payload(session, user_id: str, source_id: str) -> dict:
    """Build the ``indexing`` block from the lifecycle row (+ derived label)."""
    row = StrategySifIndexStatus.get(session, user_id, source_id)
    if row is None:
        return {"status": None, "phase": PHASE_NOT_INDEXED, "summary": None, "error_message": None,
                "embedding_count": 0, "attempt": 0, "started_at": None, "finished_at": None,
                "updated_at": None}
    status = row.status or "pending"
    return {
        "status": status,
        "phase": STATUS_PHASE_MAP.get(status, status),
        "summary": STATUS_SUMMARY_MAP.get(status, "Unknown state."),
        "error_message": getattr(row, "error_message", None),
        "embedding_count": row.embedding_count or 0,
        "attempt": row.attempt or 0,
        "started_at": _iso(getattr(row, "started_at", None)),
        "finished_at": _iso(getattr(row, "finished_at", None)),
        "updated_at": _iso(getattr(row, "updated_at", None)),
    }


def _watermark_payload(session, user_id: str, source_id: str) -> Optional[dict]:
    try:
        row = (
            session.query(SIFIndexingWatermark)
            .filter(
                SIFIndexingWatermark.user_id == user_id,
                SIFIndexingWatermark.source_id == source_id,
            )
            .one_or_none()
        )
    except Exception as exc:
        logger.warning(f"strategy_sif_status watermark read failed for {user_id}: {exc}")
        try:
            session.rollback()
        except Exception:
            pass
        return None
    if row is None:
        return None
    return {
        "source_id": row.source_id,
        "source_hash": row.source_hash,
        "embedding_count": row.embedding_count,
        "indexed_at": _iso(getattr(row, "indexed_at", None)),
        "notes": getattr(row, "notes", None),
    }


def _vfs_mirror_payload(user_id: str) -> dict:
    try:
        path = get_user_workspace_dir(user_id) / "strategy" / "active.md"
        return {"exists": path.exists(), "path": str(path)}
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"strategy_sif_status mirror check failed for {user_id}: {exc}")
        return {"exists": False, "path": None}


def build_strategy_sif_status_payload(
    session, user_id: str, uid: Optional[int] = None
) -> Dict[str, Any]:
    """Assemble the full ``GET /strategy/sif-status`` data payload.

    ``uid`` is the legacy numeric SSOT user id (may be ``None`` for
    non-numeric Clerk ids). The active strategy row is resolved by BOTH the
    numeric uid and the raw string ``user_id`` — activation rows store the
    raw Clerk id, so numeric-only lookups would report "no active strategy"
    for every string-id user. Raw model rows are never leaked: every
    blocking value is a plain dict/timestamp/string.
    """
    source_id = active_strategy_source_id(user_id)

    active = query_active_activation(session, user_id, uid)

    indexing = _strategy_sif_status_payload(session, user_id, source_id)
    if active is None:
        indexing["phase"] = PHASE_NO_ACTIVE_STRATEGY
        indexing["summary"] = "No active content strategy yet."

    return {
        "activation": (
            {
                "strategy_id": active.strategy_id,
                "activated_at": _iso(active.activation_date),
            }
            if active is not None
            else None
        ),
        "indexing": {
            **indexing,
            "source_id": source_id,
        },
        "watermark": _watermark_payload(session, user_id, source_id),
        "vfs_mirror": _vfs_mirror_payload(user_id),
        "document_kinds": {
            "names": list(STRATEGY_KINDS),
            "doc_ids": [active_strategy_doc_id(user_id, k) for k in STRATEGY_KINDS],
            "checked": False,
        },
    }
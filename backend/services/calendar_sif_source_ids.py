"""Calendar SIF x Calendar integration — Phase C: source-id contracts.

Pure functions shared by the calendar indexer, the calendar SIF
API layer, and tests. No DB, no txtai — importable in isolation.

Identifier scheme (mirrors ``sif_strategy_source_ids.py``):

- One ``source_id`` per user for the latest calendar:
  ``user:{uid}:calendar_latest``. Re-generation with changed content
  produces a different ``source_hash`` (re-embed in place).
- One txtai *document id* per ``kind`` (child of the source id):
  ``user:{uid}:calendar_latest:{kind}``.
- The hash is computed from the full calendar snapshot so unchanged
  re-generations are deduped by the watermark.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from typing import Any, Dict

CALENDAR_KINDS: tuple = (
    "calendar_overview",
    "daily_schedule",
    "weekly_themes",
    "content_recommendations",
    "performance_predictions",
    "ai_insights",
    "strategy_alignment",
    "calendar_events",
)

CALENDAR_LATEST_SOURCE_PREFIX = "user:{uid}:calendar_latest"


def calendar_latest_source_id(user_id: str) -> str:
    """Return the watermark/dedupe source id for a user's latest calendar."""
    return CALENDAR_LATEST_SOURCE_PREFIX.format(uid=user_id)


def calendar_latest_doc_id(user_id: str, kind: str) -> str:
    """Return the txtai document id for one calendar ``kind``.

    Upserting exactly these ids on each generation means an earlier
    generation's docs are overwritten by the new one, and there is
    never more than 8 kinds per user.
    """
    return f"{calendar_latest_source_id(user_id)}:{kind}"


def _to_canonical_value(value: Any) -> Any:
    """Flatten non-JSON objects into JSON-serializable primitives."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _to_canonical_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_canonical_value(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def to_canonical(obj: Any) -> str:
    """Deterministic canonical JSON string for hashing.

    ``sort_keys`` + compact separators make the digest independent of
    dict insertion order, so re-generation with unchanged content built
    from differently-ordered sources still produces the same hash.
    """
    return json.dumps(
        _to_canonical_value(obj),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def compute_calendar_source_hash(
    user_id: str,
    calendar_data: Dict[str, Any],
    generated_at: str,
) -> str:
    """sha256 over the canonical form of ``{user_id, generated_at, data}``.

    Changing any calendar field changes the digest and forces a re-embed.
    ``generated_at`` should already be an ISO string.
    """
    canonical = to_canonical({
        "user_id": user_id,
        "generated_at": generated_at,
        "data": calendar_data,
    })
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

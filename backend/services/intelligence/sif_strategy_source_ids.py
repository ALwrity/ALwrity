"""SIF x Strategy integration — Phase SIF-A: source-id contracts (pure).

Stable identifiers + deterministic serialization shared by the
strategy indexer, the VFS companion, and the activation hook.

Identifier scheme (locked in ``docs/planning/sif-strategy-integration.md``):

- One ``source_id`` per user for the active strategy:
  ``user:{uid}:strategy_active:current``. Because a user has exactly
  one *active* strategy, a single source id is enough; re-activating a
  different strategy produces a different ``source_hash`` (re-embed in
  place) and the watermark never misses a real change.
- One txtai *document id* per ``kind`` (child of the source id):
  ``user:{uid}:strategy_active:current:{kind}``. Upserting these ids on
  every activation means an earlier activation's docs are replaced, not
  accumulated, and no orphaned kinds linger in the index.
- The VFS companion lives under a *separate* source id
  ``user:{uid}:strategy_vfs:current`` so the filesystem mirror never
  steps on the txtai watermark.

Everything here is a pure function over plain dicts — no DB, no txtai —
so the contracts are unit-testable without bootstrapping the stack.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional

SIF_STRATEGY_SOURCE_PREFIX = "user:{uid}:strategy_active:current"
SIF_STRATEGY_VFS_SOURCE_PREFIX = "user:{uid}:strategy_vfs:current"

# The 8 indexed chunks. ``form_summary`` is the free-text rendering of
# the 30 form fields; each ``comprehensive_ai_analysis`` component gets
# its own document so re-activation replaces per-component docs in place.
# The analysis ``summary`` key is intentionally NOT indexed (it is a
# bolt-on convenience, not source content). Order is contractual — it is
# used to build hashes and must not drift between releases.
STRATEGY_KINDS: tuple = (
    "form_summary",
    "base_strategy",
    "strategic_insights",
    "competitive_analysis",
    "performance_predictions",
    "implementation_roadmap",
    "risk_assessment",
    "user_persona_digest",
)

# The 30 user-facing form columns rendered into the embedded text.
# Mirrors the EnhancedContentStrategy columns (``name`` + ``industry`` +
# the 28 ``STRATEGY_REQUIRED_FIELDS`` in ``enhanced_strategy_models.py``).
# Kept local (not imported from the model module) because this module is
# intentionally dependency-free and must stay importable in isolation.
STRATEGY_FORM_FIELDS: tuple = (
    "name",
    "industry",
    "business_objectives",
    "target_metrics",
    "content_budget",
    "team_size",
    "implementation_timeline",
    "market_share",
    "competitive_position",
    "content_preferences",
    "consumption_patterns",
    "audience_pain_points",
    "buying_journey",
    "seasonal_trends",
    "engagement_metrics",
    "top_competitors",
    "competitor_content_strategies",
    "market_gaps",
    "industry_trends",
    "emerging_trends",
    "preferred_formats",
    "content_mix",
    "content_frequency",
    "optimal_timing",
    "quality_metrics",
    "editorial_guidelines",
    "brand_voice",
    "traffic_sources",
    "conversion_rates",
    "content_roi_targets",
)

# Form fields describing the audience/brand persona, extracted into the
# ``user_persona_digest`` chunk.
PERSONA_FORM_FIELDS: tuple = (
    "brand_voice",
    "content_preferences",
    "consumption_patterns",
    "audience_pain_points",
    "buying_journey",
    "content_pillars",
)


def active_strategy_source_id(user_id: str) -> str:
    """Return the watermark/dedupe source id for a user's active strategy."""
    return SIF_STRATEGY_SOURCE_PREFIX.format(uid=user_id)


def strategy_vfs_source_id(user_id: str) -> str:
    """Return the source id namespace for the user's VFS strategy mirror."""
    return SIF_STRATEGY_VFS_SOURCE_PREFIX.format(uid=user_id)


def active_strategy_doc_id(user_id: str, kind: str) -> str:
    """Return the txtai document id for one strategy ``kind``.

    Upserting exactly these ids on activation guarantees in-place
    replacement semantics: an old activation's docs are overwritten by
    the new one, and there is never more than the 8 kinds per user.
    """
    return f"{active_strategy_source_id(user_id)}:{kind}"


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
    dict insertion order, so re-activation with unchanged content bulit
    from differently-ordered sources still produces the same hash.
    """
    return json.dumps(
        _to_canonical_value(obj),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def compute_source_hash(
    user_id: str,
    data: Dict[str, Any],
    activation_date: Optional[str] = None,
) -> str:
    """sha256 over the canonical form of ``{user_id, activation_date, data}``.

    ``data`` is the caller-supplied snapshot (typically ``strategy.to_dict()``):
    changing any form field, the AI analysis, or the activation moment
    changes the digest and forces a re-embed. ``activation_date`` is
    normalized to an ISO string when a ``datetime``/``date`` is passed.
    """
    if activation_date is not None and not isinstance(activation_date, str):
        activation_date = activation_date.isoformat()
    canonical = to_canonical({
        "user_id": user_id,
        "activation_date": activation_date,
        "data": data,
    })
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def source_hash_for(
    user_id: str,
    form_snapshot: Dict[str, Any],
    activation_date: Optional[str] = None,
) -> str:
    """Alias returning the digest over a form snapshot.

    Used when the caller already extracted the 30 form columns and wants
    the hash without the surrounding full strategy payload.
    """
    return compute_source_hash(
        user_id, {"form": form_snapshot}, activation_date=activation_date
    )


def _stringify_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, tuple)):
        return ", ".join(_stringify_value(v) for v in value)
    if isinstance(value, dict):
        return ", ".join(f"{k}: {_stringify_value(v)}" for k, v in value.items())
    return str(value)


def build_form_text(form_fields: Dict[str, Any], fields: Iterable[str] = STRATEGY_FORM_FIELDS) -> str:
    """Render form fields as stable ``"{label}: {value}"`` lines.

    Iterates ``fields`` (default the 30-column contract) so the line
    order is deterministic regardless of the input dict's key order.
    Missing keys / ``None`` values still emit a line for the contract
    label so the shape is always the same count.
    """
    lines: List[str] = []
    for label in fields:
        value = _stringify_value(form_fields.get(label))
        lines.append(f"{label}: {value}".rstrip())
    return "\n".join(lines) + "\n"
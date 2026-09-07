"""
Canonical select-field option values — MUST match the frontend
`STRATEGIC_INPUT_FIELDS` options exactly (frontend/src/stores/strategyBuilderStore.ts).

History: the backend emitted {"Leader"/"Niche"/"Emerging"} for
competitive_position and drifted lists for content_frequency / brand_voice,
which the frontend select fields silently DROPPED ("⏭️ Skipping
competitive_position: autofill value ... is not one of").

`normalize_option_field_value` runs at the unified-autofill boundary so the
frontend only ever receives in-range values (mapped case-insensitively where
possible; unmapped -> None).
"""

from typing import Any, Optional

COMPETITIVE_POSITION_OPTIONS = ["Market Leader", "Challenger", "Follower", "Niche Player"]
CONTENT_FREQUENCY_OPTIONS = ["Daily", "2-3 times per week", "Weekly", "Bi-weekly", "Monthly", "Quarterly"]
BRAND_VOICE_OPTIONS = ["Professional", "Casual", "Friendly", "Authoritative", "Humorous", "Inspirational", "Educational"]
IMPLEMENTATION_TIMELINE_OPTIONS = ["3 months", "6 months", "1 year", "2 years", "Ongoing"]

# Legacy/free-form aliases the AI (or older stored data) may emit.
_ALIAS_MAP = {
    "competitive_position": {
        "market leader": "Market Leader",
        "leader": "Market Leader",
        "challenger": "Challenger",
        "follower": "Follower",
        "fast follower": "Follower",
        "niche": "Niche Player",
        "niche player": "Niche Player",
        "emerging": "Niche Player",
    },
    "content_frequency": {
        "daily": "Daily",
        "2-3 times per week": "2-3 times per week",
        "2-3 per week": "2-3 times per week",
        "2-3x per week": "2-3 times per week",
        "weekly": "Weekly",
        "bi-weekly": "Bi-weekly",
        "biweekly": "Bi-weekly",
        "monthly": "Monthly",
        "quarterly": "Quarterly",
    },
    "brand_voice": {v.lower(): v for v in BRAND_VOICE_OPTIONS},
    "implementation_timeline": {v.lower(): v for v in IMPLEMENTATION_TIMELINE_OPTIONS},
    "optimal_timing": {},  # free-form multiselect — normalized by exact-set matching of its own options? covered by non-select passthrough
}

_SELECT_FIELDS = set(_ALIAS_MAP.keys())


def canonical_options(field_id: str) -> list:
    if field_id == "competitive_position":
        return list(COMPETITIVE_POSITION_OPTIONS)
    if field_id == "content_frequency":
        return list(CONTENT_FREQUENCY_OPTIONS)
    if field_id == "brand_voice":
        return list(BRAND_VOICE_OPTIONS)
    if field_id == "implementation_timeline":
        return list(IMPLEMENTATION_TIMELINE_OPTIONS)
    return []


def normalize_option_field_value(field_id: str, value: Any) -> Any:
    """Map a free-form autofill value to the frontend's canonical option.

    - non-select fields pass through untouched
    - exact match wins, then case-insensitive, then legacy aliases / token match
    - unmapped (including non-string garbage) -> None so the UI skips the
      field instead of rendering an out-of-range select value
    """
    if field_id not in _SELECT_FIELDS:
        return value

    if not isinstance(value, str):
        return None

    trimmed = value.strip()
    if not trimmed:
        return None

    options = canonical_options(field_id)
    if trimmed in options:
        return trimmed

    lowered = trimmed.lower().strip()
    alias = _ALIAS_MAP.get(field_id, {}).get(lowered)
    if alias:
        return alias

    # Token-based fallback: "market leader", "niche player" etc.
    for option in options:
        if lowered in option.lower() or option.lower() in lowered:
            return option

    return None


def normalize_fields_payload(fields: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Normalize option-typed values across a full autofill fields payload.

    `fields` is the {field_id: {value, source, ...}} shape the builder
    hydrates from. Values that cannot map to a canonical option become None.
    """
    normalized = dict(fields)
    for field_id, field_data in fields.items():
        if not isinstance(field_data, dict) or "value" not in field_data:
            continue
        normalized[field_id] = {
            **field_data,
            "value": normalize_option_field_value(field_id, field_data.get("value")),
        }
    return normalized

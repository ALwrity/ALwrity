"""Content-pillar normalization helpers.

The Exa discovery APIs return a structured envelope
(``competitors[].content_pillars`` + ``target_company.content_pillars``) that
the onboarding frontend renders directly. Agent prompts, however, need a flat
list of pillar topic strings. This module flattens every known pillar shape
into that flat list so the onboarding persistence layer and the agent-team
prompt-context builder share a single extractor.

Known input shapes:

* Exa envelope: ``{competitors: [{website, company_name, content_pillars:
  [str]}], target_company: {domain, content_pillars: [str]}}`` (optionally
  tagged with ``status``/``timestamp``/``pillar_topics``).
* Flat lists of strings or pillar objects (``{"content_pillars": [...]}``,
  ``{"pillars": [...]}``), e.g. canonical profile / step-2 SIF insights.
* A single pillar object (``{"name": ...}`` / ``{"topic": ...}``).
"""

from typing import Any, Dict, List

# Dict keys that may hold a flat list of pillar topics (strings or dicts).
_CONTENT_PILLAR_LIST_KEYS: tuple = (
    "content_pillars",
    "pillars",
    "pillar_topics",
    "topic_clusters",
    "topics",
)

# Keys that name a single pillar object/dict.
_CONTENT_PILLAR_NAME_KEYS: tuple = ("name", "topic", "title", "label")


def _dedupe_strings(items: List[str]) -> List[str]:
    """Collapse to unique, non-empty, order-preserving strings."""
    seen = set()
    out: List[str] = []
    for item in items:
        text = str(item or "").strip()
        key = text.lower()
        if text and key not in seen:
            seen.add(key)
            out.append(text)
    return out


def _pillar_strings(value: Any) -> List[str]:
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []

    if isinstance(value, dict):
        # Explicit flat list under a known key wins first (canonical / SIF /
        # legacy test shapes).
        for key in _CONTENT_PILLAR_LIST_KEYS:
            if key in value:
                raw = value[key]
                if isinstance(raw, list):
                    found = _pillar_strings(raw)
                    if found:
                        return found
                if isinstance(raw, str) and raw.strip():
                    return [raw.strip()]

        # Exa envelope: the brand's own pillars live on target_company, then
        # each competitor contributes its pillars.
        target = value.get("target_company")
        if isinstance(target, dict):
            owned = _pillar_strings(target)
            if owned:
                merged = list(owned)
                competitors = value.get("competitors")
                if isinstance(competitors, list):
                    for comp in competitors:
                        if isinstance(comp, dict):
                            merged.extend(_pillar_strings(comp))
                return _dedupe_strings(merged)

        # Exa envelope without a target_company: competitor pillars alone.
        competitors = value.get("competitors")
        if isinstance(competitors, list):
            merged: List[str] = []
            for comp in competitors:
                if isinstance(comp, dict):
                    merged.extend(_pillar_strings(comp))
            return _dedupe_strings(merged)

        # A single pillar object.
        for key in _CONTENT_PILLAR_NAME_KEYS:
            raw = value.get(key)
            if isinstance(raw, str) and raw.strip():
                return [raw.strip()]

        return []

    if isinstance(value, (list, tuple)):
        merged = []
        for item in value:
            merged.extend(_pillar_strings(item))
        return _dedupe_strings(merged)

    return []


def extract_content_pillar_topics(value: Any) -> List[str]:
    """Flatten any known content-pillar shape into a deduped topic list.

    Shared by the onboarding persistence layer (stored payloads carry the
    normalized list) and the agent-team prompt-context builder.
    """
    return _pillar_strings(value)
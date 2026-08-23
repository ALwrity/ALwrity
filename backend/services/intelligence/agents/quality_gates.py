"""Deterministic quality gates for content-bearing agent actions."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


_CONTENT_KEYS = ("content", "draft", "text", "copy", "body", "caption")
_UNSAFE_TERMS = {
    "hate",
    "kill",
    "murder",
    "attack",
    "scam",
    "fraud",
    "steal",
    "explicit",
}
_FORBIDDEN_TONE_MARKERS = {
    "sarcastic": {"sarcasm", "obviously", "yeah right"},
    "condescending": {"idiot", "stupid", "you should know"},
    "hype": {"guaranteed", "get rich quick", "overnight success"},
}
_STATISTIC_RE = re.compile(
    r"\b\d+(?:\.\d+)?%(?!\w)|\b\d+(?:\.\d+)?x\b",
    re.IGNORECASE,
)
_TOKEN_RE = re.compile(r"[a-z0-9]{3,}", re.IGNORECASE)


def _as_words(value: Any) -> List[str]:
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    if isinstance(value, (list, tuple, set)):
        return [str(part).strip() for part in value if str(part).strip()]
    return []


def extract_content(parameters: Optional[Dict[str, Any]]) -> str:
    """Extract content only from known fields; arbitrary metadata is ignored."""
    if not isinstance(parameters, dict):
        return ""
    for key in _CONTENT_KEYS:
        value = parameters.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def validate_content_quality(
    text: str,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Validate content against deterministic brand and safety rules.

    The validator intentionally does not infer tone from vague prose. It only
    blocks exact configured words and known high-confidence unsafe markers;
    uncertain claims are returned as warnings for human review.
    """
    content = str(text or "").strip()
    if not content:
        return {
            "is_compliant": True,
            "violations": [],
            "warnings": [],
            "corrections": [],
            "score": 1.0,
            "checked": False,
        }

    lowered = content.casefold()
    violations: List[Dict[str, str]] = []
    warnings: List[Dict[str, str]] = []
    corrections: List[str] = []
    rules = context or {}

    avoid_words = _as_words(rules.get("avoid_words"))
    for word in avoid_words:
        if re.search(rf"(?<!\w){re.escape(word.casefold())}(?!\w)", lowered):
            violations.append({"type": "avoid_word", "value": word})
            corrections.append(f"Remove or replace the avoid-word '{word}'.")

    unsafe_found = [
        term
        for term in sorted(_UNSAFE_TERMS)
        if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", lowered)
    ]
    for term in unsafe_found:
        violations.append({"type": "unsafe_term", "value": term})
        corrections.append(f"Remove unsafe language containing '{term}'.")

    for tone in _as_words(rules.get("forbidden_tones")):
        markers = _FORBIDDEN_TONE_MARKERS.get(tone.casefold(), set())
        for marker in sorted(markers):
            if marker in lowered:
                violations.append({"type": "forbidden_tone", "value": tone})
                corrections.append(f"Rewrite the copy without the forbidden '{tone}' tone.")
                break

    if _STATISTIC_RE.search(content) and not rules.get("evidence"):
        warnings.append({
            "type": "unsupported_statistic",
            "message": "Verify percentage or multiplier claims before publishing.",
        })

    violation_count = len(violations)
    return {
        "is_compliant": violation_count == 0,
        "violations": violations,
        "warnings": warnings,
        "corrections": list(dict.fromkeys(corrections)),
        "score": max(0.0, 1.0 - min(1.0, violation_count * 0.2)),
        "checked": True,
    }


def _meaningful_tokens(value: Any) -> set[str]:
    return {token.casefold() for token in _TOKEN_RE.findall(str(value or ""))}


def validate_pre_publish_quality(
    parameters: Optional[Dict[str, Any]],
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Run the complete deterministic gate required before publishing.

    Originality and cannibalization are supplied by their existing analysis
    services. Publishing is blocked when those checks were not run, rather
    than treating missing analysis as a pass.
    """
    params = parameters if isinstance(parameters, dict) else {}
    onboarding_context = params.get("onboarding_context") if isinstance(params.get("onboarding_context"), dict) else {}
    rules = {**onboarding_context, **(context or {}), **params}
    content = extract_content(params)
    base = validate_content_quality(content, rules)
    violations = list(base.get("violations", []))
    warnings = list(base.get("warnings", []))
    corrections = list(base.get("corrections", []))

    audience = str(rules.get("target_audience") or "").strip()
    content_tokens = _meaningful_tokens(content)
    audience_tokens = _meaningful_tokens(audience)
    audience_overlap = len(content_tokens & audience_tokens) / len(audience_tokens) if audience_tokens else None
    if audience and audience_overlap == 0:
        warnings.append({
            "type": "audience_alignment",
            "message": "Content has no obvious overlap with the configured target audience; review before publishing.",
        })

    brand_voice = str(rules.get("brand_voice") or "").strip()
    brand_voice_tokens = _meaningful_tokens(brand_voice)
    voice_overlap = len(content_tokens & brand_voice_tokens) / len(brand_voice_tokens) if brand_voice_tokens else None
    brand_voice_check = {
        "status": "checked" if brand_voice else "unavailable",
        "overlap": round(voice_overlap, 4) if voice_overlap is not None else None,
    }

    if _STATISTIC_RE.search(content) and not rules.get("evidence"):
        violations.append({
            "type": "unsupported_statistic",
            "value": "content contains percentage or multiplier claims without evidence",
        })
        corrections.append("Attach evidence or remove unsupported percentage/multiplier claims.")

    originality = rules.get("originality_score")
    if originality is None:
        violations.append({"type": "originality_check_required", "value": "missing"})
        corrections.append("Run the originality check before publishing.")
    else:
        try:
            if float(originality) < 0.75:
                violations.append({"type": "originality", "value": float(originality)})
                corrections.append("Revise the content to reduce overlap with existing or competitor content.")
        except (TypeError, ValueError):
            violations.append({"type": "originality_check_invalid", "value": str(originality)})

    cannibalization = rules.get("cannibalization_warning")
    if cannibalization is None:
        violations.append({"type": "cannibalization_check_required", "value": "missing"})
        corrections.append("Run the cannibalization check before publishing.")
    elif bool(cannibalization):
        violations.append({"type": "cannibalization", "value": True})
        corrections.append("Choose a distinct angle or consolidate overlapping content.")

    violations = list(dict.fromkeys(tuple(sorted(item.items())) for item in violations))
    normalized_violations = [dict(item) for item in violations]
    return {
        "allowed": not normalized_violations,
        "is_compliant": not normalized_violations,
        "violations": normalized_violations,
        "warnings": warnings,
        "corrections": list(dict.fromkeys(corrections)),
        "brand_voice": brand_voice_check,
        "audience_alignment": {
            "status": "checked" if audience else "unavailable",
            "overlap": round(audience_overlap, 4) if audience_overlap is not None else None,
        },
        "originality_score": originality,
        "cannibalization_warning": cannibalization,
        "checked": bool(content),
    }


def validate_action_content(
    parameters: Optional[Dict[str, Any]],
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Validate an action's known content payload, if it has one."""
    return validate_content_quality(extract_content(parameters), context)

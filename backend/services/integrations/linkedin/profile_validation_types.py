"""
Phase 3/4 — shared profile validation field keys and ordering.

Phase 3 emits ``missing_fields`` using these keys; Phase 4 question generation
consumes the same vocabulary without re-deriving completeness rules.
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from services.integrations.linkedin.field_coercion import clean_str

# Sentinel when skills, experience, and education are all empty (OR-group).
PROFESSIONAL_BACKGROUND_FIELD: Literal["professional_background"] = "professional_background"

# Canonical keys Phase 3 may place in ``missing_fields``.
MISSING_FIELD_KEYS: tuple[str, ...] = (
    "name",
    "headline",
    "job_title",
    "company",
    "about",
    PROFESSIONAL_BACKGROUND_FIELD,
    "skills",
    "experience",
    "education",
    "industry",
)

# Priority when capping completion questions (highest first).
FIELD_PRIORITY_ORDER: tuple[str, ...] = MISSING_FIELD_KEYS


class ProfileValidationResult(TypedDict, total=False):
    """Standardized Phase 3 validation payload."""

    is_profile_complete: bool
    completeness_score: int
    missing_fields: list[str]
    optional_missing_fields: list[str]


def is_field_empty(value: Any) -> bool:
    """
    Return True when a profile field is considered missing/empty.

    Matches Phase 3 completeness rules: ``None``, blank strings, and empty lists
    are empty. Used by Phase 3 validator and Phase 4 patcher no-overwrite checks.

    Args:
        value: Scalar, list, or other profile field value

    Returns:
        True when the value should be treated as missing
    """
    if value is None:
        return True
    if isinstance(value, str):
        return clean_str(value) == ""
    if isinstance(value, list):
        return len(value) == 0
    if isinstance(value, dict):
        return len(value) == 0
    return False

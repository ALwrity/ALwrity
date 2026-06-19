"""
Phase 3 — Profile completeness validator (pure engine).

Evaluates semantic completeness of a Phase 2 ``LinkedInProfileContext``.
No DB, HTTP, or Unipile calls.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from loguru import logger

from services.integrations.linkedin.profile_context_types import (
    COMPLETENESS_SCORING_UNIT_COUNT,
    COMPOSITE_PROFESSIONAL_BACKGROUND_CHECK,
    OPTIONAL_ENRICHMENT_CHECKS,
    PROFILE_VALIDATION_SCHEMA_VERSION,
    REQUIRED_SCALAR_FIELD_CHECKS,
    SUPPLEMENTAL_FIELD_CHECKS,
    ProfileValidationError,
)

_LOG_PREFIX = "[LinkedInProfileValidation]"

_REQUIRED_SECTIONS: tuple[str, ...] = (
    "personal_information",
    "professional_information",
    "linkedin_information",
)


def _assert_validatable_context(context: Any) -> dict[str, Any]:
    """
    Ensure ``context`` has the minimum shape required for completeness checks.

    Raises:
        ProfileValidationError: When input is not a validatable profile context dict
    """
    if not isinstance(context, dict):
        logger.error(
            "{} validate_profile_completeness invalid input type={}",
            _LOG_PREFIX,
            type(context).__name__,
        )
        raise ProfileValidationError(
            f"profile context must be a dict, got {type(context).__name__}"
        )

    for section in _REQUIRED_SECTIONS:
        value = context.get(section)
        if not isinstance(value, dict):
            logger.error(
                "{} validate_profile_completeness invalid section={} type={}",
                _LOG_PREFIX,
                section,
                type(value).__name__,
            )
            raise ProfileValidationError(f"{section} must be a dict")

    return context


def _extract_content_hash(context: dict[str, Any]) -> str:
    """Return ``built_from_profile_content_hash`` from context meta when present."""
    meta = context.get("meta")
    if not isinstance(meta, dict):
        return ""
    stored_hash = meta.get("built_from_profile_content_hash")
    return stored_hash if isinstance(stored_hash, str) else ""


def validate_profile_completeness(context: dict[str, Any]) -> dict[str, Any]:
    """
    Evaluate semantic completeness of a Phase 2 ``LinkedInProfileContext``.

    Incomplete profiles return a result with ``is_profile_complete=False``.
    Invalid input shape raises ``ProfileValidationError``.

    Args:
        context: Phase 2 grouped profile context dict

    Returns:
        ``ProfileValidationResult`` dict including embedded ``meta``
    """
    logger.info("{} validate_profile_completeness start", _LOG_PREFIX)
    valid_context = _assert_validatable_context(context)

    logger.info("{} checking required scalar fields", _LOG_PREFIX)
    missing_fields: list[str] = []
    completed_units = 0

    for check in REQUIRED_SCALAR_FIELD_CHECKS:
        if check.predicate(valid_context):
            completed_units += 1
        else:
            missing_fields.append(check.missing_key)
            logger.info(
                "{} required field missing key={} path={}.{}",
                _LOG_PREFIX,
                check.missing_key,
                check.section,
                check.field,
            )

    logger.info("{} checking composite professional_background", _LOG_PREFIX)
    if COMPOSITE_PROFESSIONAL_BACKGROUND_CHECK.is_present(valid_context):
        completed_units += 1
    else:
        missing_fields.append(COMPOSITE_PROFESSIONAL_BACKGROUND_CHECK.missing_key)
        logger.info(
            "{} required composite missing key={}",
            _LOG_PREFIX,
            COMPOSITE_PROFESSIONAL_BACKGROUND_CHECK.missing_key,
        )

    completeness_score = round(
        completed_units / COMPLETENESS_SCORING_UNIT_COUNT * 100
    )
    is_profile_complete = len(missing_fields) == 0

    logger.info("{} checking optional enrichment fields", _LOG_PREFIX)
    optional_missing_fields: list[str] = []
    for check in OPTIONAL_ENRICHMENT_CHECKS:
        if not check.is_present(valid_context):
            optional_missing_fields.append(check.missing_key)

    supplemental_fields: list[str] = []
    for check in SUPPLEMENTAL_FIELD_CHECKS:
        if check.is_supplemental_needed(valid_context):
            supplemental_fields.append(check.supplemental_key)

    validated_at = datetime.now(timezone.utc).isoformat()
    result: dict[str, Any] = {
        "is_profile_complete": is_profile_complete,
        "completeness_score": completeness_score,
        "missing_fields": missing_fields,
        "optional_missing_fields": optional_missing_fields,
        "supplemental_fields": supplemental_fields,
        "meta": {
            "built_from_profile_content_hash": _extract_content_hash(valid_context),
            "schema_version": PROFILE_VALIDATION_SCHEMA_VERSION,
            "validated_at": validated_at,
        },
    }

    logger.info(
        "{} validate_profile_completeness complete score={}% complete={} "
        "missing_count={} optional_missing_count={} supplemental_count={}",
        _LOG_PREFIX,
        completeness_score,
        is_profile_complete,
        len(missing_fields),
        len(optional_missing_fields),
        len(supplemental_fields),
    )
    if missing_fields:
        logger.info(
            "{} missing required fields: {}",
            _LOG_PREFIX,
            ", ".join(missing_fields),
        )

    return result

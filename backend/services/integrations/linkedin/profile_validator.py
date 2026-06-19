"""
Phase 3 — pure profile completeness validation (no AI, no persistence).

Evaluates ``LinkedInProfileContext`` and returns standardized missing-field keys.
"""

from __future__ import annotations

from typing import Any

from loguru import logger

from services.integrations.linkedin.profile_validation_types import (
    PROFESSIONAL_BACKGROUND_FIELD,
    ProfileValidationResult,
    is_field_empty,
)

_LOG_PREFIX = "[ProfileValidator]"

_REQUIRED_SCALAR_FIELDS: tuple[tuple[str, str, str], ...] = (
    ("name", "personal_information", "name"),
    ("headline", "personal_information", "headline"),
    ("job_title", "professional_information", "job_title"),
    ("company", "professional_information", "company"),
    ("about", "personal_information", "about"),
)

_OPTIONAL_FIELDS: tuple[tuple[str, str, str], ...] = (
    ("location", "personal_information", "location"),
    ("profile_url", "linkedin_information", "profile_url"),
    ("profile_picture", "linkedin_information", "profile_picture"),
    ("followers", "linkedin_information", "followers"),
    ("connections", "linkedin_information", "connections"),
)

_REQUIRED_FIELD_COUNT = len(_REQUIRED_SCALAR_FIELDS) + 1  # OR-group counts as one


def validate_profile_completeness(context: dict[str, Any]) -> ProfileValidationResult:
    """
    Validate whether ``LinkedInProfileContext`` has enough data for Phase 5.

    Args:
        context: Built profile context dict

    Returns:
        Validation result with completeness score and missing field keys
    """
    logger.info("{} validate_profile_completeness start", _LOG_PREFIX)

    missing_fields: list[str] = []
    optional_missing_fields: list[str] = []
    completed_count = 0

    for field_key, section, path in _REQUIRED_SCALAR_FIELDS:
        value = _read_context_field(context, section, path)
        if is_field_empty(value):
            missing_fields.append(field_key)
        else:
            completed_count += 1

    if _professional_background_missing(context):
        missing_fields.append(PROFESSIONAL_BACKGROUND_FIELD)
    else:
        completed_count += 1

    for field_key, section, path in _OPTIONAL_FIELDS:
        value = _read_context_field(context, section, path)
        if is_field_empty(value):
            optional_missing_fields.append(field_key)

    completeness_score = round(completed_count / _REQUIRED_FIELD_COUNT * 100)
    is_profile_complete = len(missing_fields) == 0

    result: ProfileValidationResult = {
        "is_profile_complete": is_profile_complete,
        "completeness_score": completeness_score,
        "missing_fields": missing_fields,
        "optional_missing_fields": optional_missing_fields,
    }

    logger.info(
        "{} validate_profile_completeness complete is_profile_complete={} "
        "score={} missing_count={}",
        _LOG_PREFIX,
        is_profile_complete,
        completeness_score,
        len(missing_fields),
    )
    return result


def _read_context_field(context: dict[str, Any], section: str, path: str) -> Any:
    section_data = context.get(section)
    if not isinstance(section_data, dict):
        return None
    return section_data.get(path)


def _professional_background_missing(context: dict[str, Any]) -> bool:
    """True when skills, experience, and education are all empty."""
    professional = context.get("professional_information")
    if not isinstance(professional, dict):
        return True

    skills = professional.get("skills")
    experience = professional.get("experience")
    education = professional.get("education")

    return (
        is_field_empty(skills)
        and is_field_empty(experience)
        and is_field_empty(education)
    )

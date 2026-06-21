"""
Phase 4 — apply user completion answers to ``LinkedInProfileContext`` without overwrite.

Deterministic coercion only; no validation or AI logic.
"""

from __future__ import annotations

import copy
from typing import Any

from loguru import logger

from services.integrations.linkedin.field_coercion import clean_str, coerce_list
from services.integrations.linkedin.profile_validation_types import (
    PROFESSIONAL_BACKGROUND_FIELD,
    is_field_empty,
)

_LOG_PREFIX = "[ProfileCompletion]"

PERSONAL_SCALAR_FIELDS = frozenset({"name", "headline", "about"})
PROFESSIONAL_SCALAR_FIELDS = frozenset({"job_title", "company", "industry"})


class ProfileCompletionPatchError(Exception):
    """Raised when profile context cannot be patched."""


def apply_completion_answers(
    context: dict[str, Any],
    answers: dict[str, Any],
    allowed_keys: list[str],
) -> dict[str, Any]:
    """
    Patch ``LinkedInProfileContext`` with user answers for allowed missing fields.

    Never overwrites non-empty LinkedIn-derived values. Ignores answer keys outside
    ``allowed_keys``.

    Args:
        context: Current ``LinkedInProfileContext`` dict
        answers: Field-keyed user answers (strings or string lists)
        allowed_keys: Phase 3 ``missing_fields`` keys permitted for this submit

    Returns:
        Patched profile context dict (deep copy of input)

    Raises:
        ProfileCompletionPatchError: When ``context`` is not a dict
    """
    logger.info(
        "{} apply_completion_answers allowed_keys={} answer_keys={}",
        _LOG_PREFIX,
        allowed_keys,
        sorted(answers.keys()) if isinstance(answers, dict) else None,
    )
    if not isinstance(context, dict):
        raise ProfileCompletionPatchError("profile context must be a dict")
    if not isinstance(answers, dict):
        raise ProfileCompletionPatchError("completion answers must be a dict")

    allowed = set(allowed_keys)
    patched = copy.deepcopy(context)
    _ensure_sections(patched)

    patched_fields: list[str] = []

    for field_key, answer in answers.items():
        if field_key not in allowed:
            logger.warning(
                "{} apply_completion_answers ignoring disallowed key={}",
                _LOG_PREFIX,
                field_key,
            )
            continue

        if _apply_field_patch(patched, field_key, answer):
            patched_fields.append(field_key)

    logger.info(
        "{} apply_completion_answers complete patched_fields={}",
        _LOG_PREFIX,
        patched_fields,
    )
    return patched


def _ensure_sections(context: dict[str, Any]) -> None:
    personal = context.get("personal_information")
    if not isinstance(personal, dict):
        context["personal_information"] = {}
    professional = context.get("professional_information")
    if not isinstance(professional, dict):
        context["professional_information"] = {}


def _apply_field_patch(
    context: dict[str, Any],
    field_key: str,
    answer: Any,
) -> bool:
    """Apply a single field patch; return True when context was modified."""
    if field_key == PROFESSIONAL_BACKGROUND_FIELD:
        return _patch_professional_background(context, answer)

    if field_key in PERSONAL_SCALAR_FIELDS:
        return _patch_personal_scalar(context, field_key, answer)

    if field_key in PROFESSIONAL_SCALAR_FIELDS:
        return _patch_professional_scalar(context, field_key, answer)

    if field_key == "skills":
        return _patch_skills(context, answer)

    if field_key == "experience":
        return _patch_experience(context, answer)

    if field_key == "education":
        return _patch_education(context, answer)

    logger.warning(
        "{} apply_completion_answers unknown field key={} — skipping",
        _LOG_PREFIX,
        field_key,
    )
    return False


def _patch_personal_scalar(
    context: dict[str, Any],
    field_key: str,
    answer: Any,
) -> bool:
    personal = context["personal_information"]
    current = personal.get(field_key)
    if not is_field_empty(current):
        logger.warning(
            "{} apply_completion_answers skip non-empty personal field={}",
            _LOG_PREFIX,
            field_key,
        )
        return False

    value = clean_str(answer)
    if field_key == "name":
        full_name, first_name, last_name = _split_full_name(value)
        personal["name"] = full_name
        if is_field_empty(personal.get("first_name")):
            personal["first_name"] = first_name
        if is_field_empty(personal.get("last_name")):
            personal["last_name"] = last_name
        return bool(full_name)

    personal[field_key] = value
    return bool(value)


def _patch_professional_scalar(
    context: dict[str, Any],
    field_key: str,
    answer: Any,
) -> bool:
    professional = context["professional_information"]
    current = professional.get(field_key)
    if not is_field_empty(current):
        logger.warning(
            "{} apply_completion_answers skip non-empty professional field={}",
            _LOG_PREFIX,
            field_key,
        )
        return False

    value = clean_str(answer)
    professional[field_key] = value
    return bool(value)


def _patch_skills(context: dict[str, Any], answer: Any) -> bool:
    professional = context["professional_information"]
    current_skills = professional.get("skills")
    if not is_field_empty(current_skills):
        logger.warning(
            "{} apply_completion_answers skip non-empty skills",
            _LOG_PREFIX,
        )
        return False

    skills = _coerce_skills_answer(answer)
    if not skills:
        return False

    professional["skills"] = skills
    professional["skills_total_count"] = len(skills)
    return True


def _patch_experience(context: dict[str, Any], answer: Any) -> bool:
    professional = context["professional_information"]
    experience = professional.get("experience")
    if not isinstance(experience, list):
        experience = []
        professional["experience"] = experience

    if not is_field_empty(experience):
        logger.warning(
            "{} apply_completion_answers skip non-empty experience",
            _LOG_PREFIX,
        )
        return False

    description = clean_str(answer)
    if not description:
        return False

    experience.append(_empty_experience_entry(description))
    professional["experience_total_count"] = len(experience)
    return True


def _patch_education(context: dict[str, Any], answer: Any) -> bool:
    professional = context["professional_information"]
    education = professional.get("education")
    if not isinstance(education, list):
        education = []
        professional["education"] = education

    if not is_field_empty(education):
        logger.warning(
            "{} apply_completion_answers skip non-empty education",
            _LOG_PREFIX,
        )
        return False

    school = clean_str(answer)
    if not school:
        return False

    education.append(_empty_education_entry(school))
    professional["education_total_count"] = len(education)
    return True


def _patch_professional_background(context: dict[str, Any], answer: Any) -> bool:
    text = clean_str(answer)
    if not text:
        return False

    if _looks_like_comma_separated_skills(text):
        return _patch_skills(context, _split_skill_tokens(text))

    return _patch_experience(context, text)


def _split_full_name(full_name: str) -> tuple[str, str, str]:
    """Return (full_name, first_name, last_name) from user input."""
    cleaned = clean_str(full_name)
    if not cleaned:
        return "", "", ""

    parts = cleaned.split(None, 1)
    if len(parts) == 1:
        return cleaned, parts[0], ""
    return cleaned, parts[0], parts[1]


def _looks_like_comma_separated_skills(text: str) -> bool:
    """True when free text appears to be a comma-separated skill list."""
    parts = [clean_str(part) for part in text.split(",") if clean_str(part)]
    return len(parts) >= 2


def _split_skill_tokens(text: str) -> list[str]:
    return [clean_str(part) for part in text.split(",") if clean_str(part)]


def _coerce_skills_answer(answer: Any) -> list[dict[str, Any]]:
    """Convert user skills answer into ``ProfileSkillContext`` dicts."""
    raw_items: list[Any]
    if isinstance(answer, str):
        raw_items = _split_skill_tokens(answer) if "," in answer else [clean_str(answer)]
    elif isinstance(answer, list):
        raw_items = coerce_list(answer)
    else:
        return []

    skills: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw_items:
        name = clean_str(item)
        if not name or name in seen:
            continue
        seen.add(name)
        skills.append({"name": name, "endorsement_count": 0})
    return skills


def _empty_experience_entry(description: str) -> dict[str, Any]:
    return {
        "title": "",
        "company": "",
        "company_id": "",
        "company_picture_url": "",
        "start": "",
        "end": None,
        "location": "",
        "description": clean_str(description),
        "skills": [],
    }


def _empty_education_entry(school: str) -> dict[str, Any]:
    return {
        "school": clean_str(school),
        "school_id": "",
        "school_picture_url": "",
        "degree": "",
        "start": "",
        "end": "",
    }

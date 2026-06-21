"""
Phase 4 — deterministic profile completion question generation.

Maps Phase 3 ``missing_fields`` keys to static UI questions. No AI.
"""

from __future__ import annotations

from typing import Literal, TypedDict

from loguru import logger

from services.integrations.linkedin.profile_validation_types import (
    FIELD_PRIORITY_ORDER,
    PROFESSIONAL_BACKGROUND_FIELD,
)

_LOG_PREFIX = "[ProfileCompletion]"

CompletionInputType = Literal["text", "textarea", "tags"]

MAX_COMPLETION_QUESTIONS = 5


class CompletionQuestion(TypedDict):
    """Single question shown in the profile completion form."""

    field_key: str
    label: str
    input_type: CompletionInputType
    required: bool


class _QuestionDefinition(TypedDict):
    label: str
    input_type: CompletionInputType


QUESTION_DEFINITIONS: dict[str, _QuestionDefinition] = {
    "name": {
        "label": "What is your full name?",
        "input_type": "text",
    },
    "headline": {
        "label": "What is your professional headline?",
        "input_type": "text",
    },
    "job_title": {
        "label": "What is your current job title?",
        "input_type": "text",
    },
    "company": {
        "label": "Which company do you currently work for?",
        "input_type": "text",
    },
    "about": {
        "label": "Tell us a little about yourself.",
        "input_type": "textarea",
    },
    "industry": {
        "label": "Which industry do you work in?",
        "input_type": "text",
    },
    PROFESSIONAL_BACKGROUND_FIELD: {
        "label": (
            "What are your primary professional skills, or briefly describe "
            "your experience or education?"
        ),
        "input_type": "textarea",
    },
    "skills": {
        "label": "What are your primary professional skills?",
        "input_type": "tags",
    },
    "experience": {
        "label": "Please briefly describe your professional experience.",
        "input_type": "textarea",
    },
    "education": {
        "label": "What is your educational background?",
        "input_type": "textarea",
    },
}

_PRIORITY_INDEX = {key: index for index, key in enumerate(FIELD_PRIORITY_ORDER)}


def build_completion_questions(missing_fields: list[str]) -> list[CompletionQuestion]:
    """
    Build ordered completion questions for Phase 3 ``missing_fields``.

    Args:
        missing_fields: Required field keys reported by the profile validator

    Returns:
        Up to ``MAX_COMPLETION_QUESTIONS`` questions in priority order
    """
    logger.info(
        "{} build_completion_questions missing_fields={}",
        _LOG_PREFIX,
        missing_fields,
    )
    if not missing_fields:
        logger.info(
            "{} build_completion_questions complete profile — no questions",
            _LOG_PREFIX,
        )
        return []

    ordered_keys = _select_fields_by_priority(missing_fields)
    capped_keys = ordered_keys[:MAX_COMPLETION_QUESTIONS]

    questions: list[CompletionQuestion] = [
        _to_completion_question(field_key) for field_key in capped_keys
    ]

    logger.info(
        "{} build_completion_questions generated count={} field_keys={}",
        _LOG_PREFIX,
        len(questions),
        [question["field_key"] for question in questions],
    )
    return questions


def _select_fields_by_priority(missing_fields: list[str]) -> list[str]:
    """Deduplicate, drop unknown keys, and sort by ``FIELD_PRIORITY_ORDER``."""
    seen: set[str] = set()
    known: list[str] = []

    for field_key in missing_fields:
        if field_key in seen:
            continue
        seen.add(field_key)

        if field_key not in QUESTION_DEFINITIONS:
            logger.warning(
                "{} build_completion_questions unknown missing field key={} — skipping",
                _LOG_PREFIX,
                field_key,
            )
            continue

        known.append(field_key)

    known.sort(key=lambda key: _PRIORITY_INDEX.get(key, len(FIELD_PRIORITY_ORDER)))
    return known


def _to_completion_question(field_key: str) -> CompletionQuestion:
    definition = QUESTION_DEFINITIONS[field_key]
    return {
        "field_key": field_key,
        "label": definition["label"],
        "input_type": definition["input_type"],
        "required": True,
    }

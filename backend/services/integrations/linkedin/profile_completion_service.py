"""
Phase 4 — profile completion orchestration.

Loads validation, patches context, persists answers, and re-validates.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.profile_completion_questions import (
    CompletionQuestion,
    build_completion_questions,
)
from services.integrations.linkedin.profile_context_patcher import (
    ProfileCompletionPatchError,
    apply_completion_answers,
)
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin.profile_validation_service import (
    get_or_validate_profile_context,
)
from services.integrations.linkedin.profile_validation_types import ProfileValidationResult

_LOG_PREFIX = "[ProfileCompletion]"


class ProfileCompletionError(Exception):
    """Raised when profile completion cannot proceed."""


class ProfileAlreadyCompleteError(ProfileCompletionError):
    """Raised when submission occurs on an already-complete profile."""


@dataclass(frozen=True)
class ProfileCompletionResult:
    """Outcome of a profile completion submit."""

    profile_context: dict[str, Any]
    profile_validation: ProfileValidationResult
    questions: list[CompletionQuestion]


def complete_profile(
    user_id: str,
    answers: dict[str, Any],
    *,
    repository: Optional[ProfileRepository] = None,
) -> ProfileCompletionResult:
    """
    Apply user completion answers and re-run profile validation.

    Args:
        user_id: ALwrity user ID
        answers: Field-keyed answers from the client
        repository: Optional ``ProfileRepository`` (for testing)

    Returns:
        Updated context, validation, and remaining completion questions

    Raises:
        ProfileAlreadyCompleteError: When profile is already complete
        ProfileCompletionError: When prerequisites are missing or answers invalid
        ProfileCompletionPatchError: When patching fails
        ValueError: When persistence or revalidation fails
    """
    logger.info(
        "{} complete_profile start user_id={} answer_keys={}",
        _LOG_PREFIX,
        user_id,
        sorted(answers.keys()) if isinstance(answers, dict) else None,
    )

    if not isinstance(answers, dict):
        raise ProfileCompletionError("completion answers must be a dict")

    repo = repository or ProfileRepository()
    row = repo.get_analysis_row(user_id)
    if not row:
        logger.error(
            "{} complete_profile no analysis row user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ProfileCompletionError(
            f"No linkedin_analysis_context row for user_id={user_id!r}"
        )

    context = repo.get_profile_context(user_id, row=row)
    if not context:
        logger.error(
            "{} complete_profile missing profile_context user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ProfileCompletionError("Profile context is not available")

    validation, _validation_meta = get_or_validate_profile_context(
        user_id,
        context,
        repository=repo,
    )
    if validation.get("is_profile_complete"):
        logger.info(
            "{} complete_profile already complete user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ProfileAlreadyCompleteError("Profile is already complete")

    missing_fields = list(validation.get("missing_fields") or [])
    questions_before = build_completion_questions(missing_fields)
    logger.info(
        "{} complete_profile missing_fields={} questions_before={}",
        _LOG_PREFIX,
        missing_fields,
        len(questions_before),
    )

    accepted_answers = {
        key: value
        for key, value in answers.items()
        if key in missing_fields
    }
    if not accepted_answers:
        logger.error(
            "{} complete_profile no accepted answers user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ProfileCompletionError("No valid answers provided for missing fields")

    patched_context = apply_completion_answers(
        context,
        accepted_answers,
        missing_fields,
    )
    repo.save_profile_context(user_id, patched_context)
    repo.save_user_completion(user_id, accepted_answers)

    updated_validation, _ = get_or_validate_profile_context(
        user_id,
        patched_context,
        repository=repo,
        force_revalidate=True,
    )
    remaining_questions = build_completion_questions(
        list(updated_validation.get("missing_fields") or [])
    )

    logger.info(
        "{} complete_profile finished user_id={} is_profile_complete={} "
        "remaining_questions={}",
        _LOG_PREFIX,
        user_id,
        updated_validation.get("is_profile_complete"),
        len(remaining_questions),
    )

    return ProfileCompletionResult(
        profile_context=patched_context,
        profile_validation=updated_validation,
        questions=remaining_questions,
    )

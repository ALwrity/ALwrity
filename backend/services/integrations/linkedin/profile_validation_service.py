"""
Phase 3 — profile validation orchestration (validate + cache).

Never calls Unipile or generates questions.
"""

from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict

from loguru import logger

from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin.profile_validation_types import ProfileValidationResult
from services.integrations.linkedin.profile_validator import validate_profile_completeness

_LOG_PREFIX = "[ProfileValidation]"


class ProfileValidationAcquireMeta(TypedDict):
    """Metadata for validation acquisition."""

    source: Literal["cache", "validated"]


def get_or_validate_profile_context(
    user_id: str,
    profile_context: dict[str, Any],
    *,
    repository: Optional[ProfileRepository] = None,
    force_revalidate: bool = False,
) -> tuple[ProfileValidationResult, ProfileValidationAcquireMeta]:
    """
    Validate profile context and persist ``profile_validation_json``.

    Serves cached validation when present unless ``force_revalidate`` is True.

    Args:
        user_id: ALwrity user ID
        profile_context: Current ``LinkedInProfileContext`` dict
        repository: Optional ``ProfileRepository`` (for testing)
        force_revalidate: Skip cache and always run validator

    Returns:
        Tuple of (validation result, acquire meta)

    Raises:
        ValueError: When no analysis row exists for ``user_id``
    """
    logger.info(
        "{} get_or_validate_profile_context user_id={} force_revalidate={}",
        _LOG_PREFIX,
        user_id,
        force_revalidate,
    )
    repo = repository or ProfileRepository()
    row = repo.get_analysis_row(user_id)
    if not row:
        logger.error(
            "{} get_or_validate_profile_context no analysis row user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ValueError(
            f"No linkedin_analysis_context row for user_id={user_id!r}; "
            "acquire normalized profile first"
        )

    if not force_revalidate:
        cached = repo.get_profile_validation(user_id, row=row)
        if cached:
            meta: ProfileValidationAcquireMeta = {"source": "cache"}
            logger.info(
                "{} get_or_validate_profile_context source=cache user_id={}",
                _LOG_PREFIX,
                user_id,
            )
            return cached, meta

    validation = validate_profile_completeness(profile_context)
    repo.save_profile_validation(user_id, validation)

    validated_meta: ProfileValidationAcquireMeta = {"source": "validated"}
    logger.info(
        "{} get_or_validate_profile_context source=validated user_id={} "
        "is_profile_complete={}",
        _LOG_PREFIX,
        user_id,
        validation.get("is_profile_complete"),
    )
    return validation, validated_meta

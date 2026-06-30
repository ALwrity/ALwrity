"""
Phase 3 — profile validation orchestration (validate + cache).

Never calls Unipile or generates questions.
"""

from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict

from loguru import logger

from services.integrations.linkedin.profile_optimization_rubric import (
    enrich_profile_validation_strength,
    enrich_validation_with_progress_boost,
)
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin.profile_validation_types import ProfileValidationResult
from services.integrations.linkedin.profile_validator import validate_profile_completeness

_LOG_PREFIX = "[ProfileValidation]"


def _completed_optimization_ids(
    repo: ProfileRepository,
    user_id: str,
    *,
    row: dict[str, Any] | None = None,
) -> list[str]:
    stored = repo.get_profile_optimization(user_id, row=row)
    if not stored or not isinstance(stored.get("meta"), dict):
        return []
    raw = stored["meta"].get("completed_ids")
    if not isinstance(raw, list):
        return []
    return [str(item) for item in raw if item]


def _enrich_validation_strength(
    profile_context: dict[str, Any],
    validation: ProfileValidationResult,
    completed_ids: list[str],
) -> ProfileValidationResult:
    if completed_ids:
        return enrich_validation_with_progress_boost(
            profile_context, validation, completed_ids
        )
    return enrich_profile_validation_strength(profile_context, validation)


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
            completed_ids = _completed_optimization_ids(repo, user_id, row=row)
            enriched = _enrich_validation_strength(profile_context, cached, completed_ids)
            logger.info(
                "{} get_or_validate_profile_context source=cache user_id={} "
                "optimization_score={} completed_count={}",
                _LOG_PREFIX,
                user_id,
                enriched.get("optimization_score"),
                len(completed_ids),
            )
            return enriched, meta

    validation = validate_profile_completeness(profile_context)
    completed_ids = _completed_optimization_ids(repo, user_id, row=row)
    validation = _enrich_validation_strength(profile_context, validation, completed_ids)
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


def refresh_validation_with_optimization_progress(
    user_id: str,
    completed_ids: list[str],
    *,
    repository: Optional[ProfileRepository] = None,
) -> ProfileValidationResult | None:
    """
    Recompute rubric score with Phase 7 progress boost and persist.

    Called after marking optimization items done/skipped so header/profile hub
    can reflect user progress without a full profile refetch.
    """
    repo = repository or ProfileRepository()
    row = repo.get_analysis_row(user_id)
    if not row:
        logger.warning(
            "{} refresh_validation_with_optimization_progress no row user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        return None

    validation = repo.get_profile_validation(user_id, row=row)
    if not validation:
        logger.warning(
            "{} refresh_validation_with_optimization_progress no validation user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        return None

    profile_context = repo.get_profile_context(user_id, row=row)
    if not profile_context:
        logger.warning(
            "{} refresh_validation_with_optimization_progress no context user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        return validation

    enriched = enrich_validation_with_progress_boost(
        profile_context, validation, completed_ids
    )
    repo.save_profile_validation(user_id, enriched)
    logger.info(
        "{} refresh_validation_with_optimization_progress user_id={} "
        "completed_count={} optimization_score={}",
        _LOG_PREFIX,
        user_id,
        len(completed_ids),
        enriched.get("optimization_score"),
    )
    return enriched

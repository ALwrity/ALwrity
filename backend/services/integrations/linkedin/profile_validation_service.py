"""
Phase 3 — Profile validation orchestration (cache-first validate).

Invoked after Phase 2 context build; never calls Unipile or Phase 1 normalizer.
"""

from __future__ import annotations

from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.profile_context_types import (
    ProfileContextSource,
    ProfileValidationAcquireMeta,
    ProfileValidationError,
)
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin.profile_validator import validate_profile_completeness

_LOG_PREFIX = "[LinkedInProfileValidation]"


def _validation_hash_matches(
    cached_validation: dict[str, Any],
    profile_content_hash: Optional[str],
) -> bool:
    """Return True when cached validation meta matches the current profile hash."""
    if not profile_content_hash:
        return False
    meta = cached_validation.get("meta")
    if not isinstance(meta, dict):
        return False
    stored_hash = meta.get("built_from_profile_content_hash")
    return isinstance(stored_hash, str) and stored_hash == profile_content_hash


def _extract_validated_at(validation: dict[str, Any]) -> Optional[str]:
    """Return ``validated_at`` from validation meta when present."""
    meta = validation.get("meta")
    if not isinstance(meta, dict):
        return None
    validated_at = meta.get("validated_at")
    return validated_at if isinstance(validated_at, str) else None


def get_or_validate_profile_context(
    user_id: str,
    profile_context: dict[str, Any],
    *,
    profile_content_hash: Optional[str] = None,
    repository: Optional[ProfileRepository] = None,
    force_revalidate: bool = False,
    context_source: Optional[ProfileContextSource] = None,
) -> tuple[dict[str, Any], ProfileValidationAcquireMeta]:
    """
    Cache-first orchestrator: return profile validation and acquisition metadata.

    Serves from ``profile_validation_json`` when present and ``profile_content_hash``
    matches the stored snapshot. Otherwise validates ``profile_context``, persists,
    and returns ``meta.source = "validated"``.

    When ``context_source`` is ``"built"``, cache is skipped so validation always
    runs after a fresh Phase 2 context build.

    Args:
        user_id: ALwrity user ID (Clerk)
        profile_context: Phase 2 ``LinkedInProfileContext`` dict
        profile_content_hash: Current normalized profile hash from Phase 1 meta
        repository: Optional ``ProfileRepository`` (for testing)
        force_revalidate: Skip cache and recompute validation
        context_source: Phase 2 acquire source (``cache`` or ``built``)

    Returns:
        Tuple of (validation result dict, acquire meta with source cache|validated)

    Raises:
        ProfileValidationError: When context cannot be validated
        ValueError: When persistence fails (e.g. missing analysis row)
    """
    logger.info(
        "{} get_or_validate_profile_context user_id={} force_revalidate={} "
        "context_source={} hash={}",
        _LOG_PREFIX,
        user_id,
        force_revalidate,
        context_source,
        profile_content_hash[:12] if profile_content_hash else None,
    )
    repo = repository or ProfileRepository()
    skip_cache = force_revalidate or context_source == "built"

    if not skip_cache:
        row = repo.get_analysis_row(user_id)
        cached = repo.get_profile_validation(user_id, row=row) if row else None
        row_hash = row.get("profile_content_hash") if row else None
        if (
            cached
            and profile_content_hash
            and row_hash == profile_content_hash
            and _validation_hash_matches(cached, profile_content_hash)
        ):
            meta: ProfileValidationAcquireMeta = {
                "source": "cache",
                "validated_at": _extract_validated_at(cached),
            }
            logger.info(
                "{} get_or_validate_profile_context source=cache user_id={}",
                _LOG_PREFIX,
                user_id,
            )
            return cached, meta

        if cached and profile_content_hash and row_hash != profile_content_hash:
            logger.info(
                "{} profile_content_hash mismatch — revalidating user_id={}",
                _LOG_PREFIX,
                user_id,
            )
        elif row and not cached:
            logger.info(
                "{} profile_validation_json empty — validating user_id={}",
                _LOG_PREFIX,
                user_id,
            )
    elif context_source == "built":
        logger.info(
            "{} context_source=built — revalidating user_id={}",
            _LOG_PREFIX,
            user_id,
        )

    try:
        validation = validate_profile_completeness(profile_context)
        validated_at = repo.save_profile_validation(
            user_id,
            validation,
            content_hash=profile_content_hash,
        )
    except ProfileValidationError:
        logger.exception(
            "{} get_or_validate_profile_context validation failed user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise
    except Exception as exc:
        logger.exception(
            "{} get_or_validate_profile_context unexpected error user_id={}: {}",
            _LOG_PREFIX,
            user_id,
            exc,
        )
        raise ProfileValidationError(
            "Unable to validate LinkedIn profile context"
        ) from exc

    validated_meta: ProfileValidationAcquireMeta = {
        "source": "validated",
        "validated_at": validated_at,
    }
    logger.info(
        "{} get_or_validate_profile_context source=validated user_id={} validated_at={}",
        _LOG_PREFIX,
        user_id,
        validated_at,
    )
    return validation, validated_meta

"""
Phase 5 — AI profile intelligence orchestration (cache-first generate).

Gates on profile completeness, coordinates LLM + validation + persistence.
"""

from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict

from loguru import logger

from prompts.linkedin.profile_intelligence_prompt import (
    PROFILE_INTELLIGENCE_SYSTEM_PROMPT,
    build_profile_intelligence_user_prompt,
)
from services.integrations.linkedin.profile_intelligence_llm import (
    ProfileIntelligenceGenerateFn,
    ProfileIntelligenceLLMError,
    call_profile_intelligence_llm,
)
from services.integrations.linkedin.profile_intelligence_validator import (
    ProfileIntelligenceValidationError,
    build_stored_ai_profile_intelligence,
    normalize_ai_profile_intelligence_raw,
    validate_ai_profile_intelligence_payload,
)
from services.integrations.linkedin.profile_repository import (
    ProfileRepository,
    compute_profile_context_hash,
)
from services.integrations.linkedin.profile_validation_types import ProfileValidationResult
from services.llm_providers.gemini_provider import gemini_structured_json_response

_LOG_PREFIX = "[ProfileIntelligence]"

VALIDATION_RETRY_USER_SUFFIX = (
    "\n\nPrevious response failed schema validation. "
    "Return valid JSON only matching the required schema exactly."
)


class ProfileIntelligenceError(Exception):
    """Base error for profile intelligence orchestration."""


class ProfileIntelligenceAcquireMeta(TypedDict, total=False):
    """Metadata for intelligence acquisition."""

    source: Literal["cache", "generated"]
    ai_intelligence_updated_at: Optional[str]


def get_or_generate_profile_intelligence(
    user_id: str,
    profile_context: dict[str, Any],
    *,
    profile_validation: ProfileValidationResult,
    repository: Optional[ProfileRepository] = None,
    force_regenerate: bool = False,
    generate_fn: ProfileIntelligenceGenerateFn = gemini_structured_json_response,
) -> tuple[Optional[dict[str, Any]], ProfileIntelligenceAcquireMeta]:
    """
    Return cached or newly generated AI profile intelligence.

    Skips LLM when ``profile_validation.is_profile_complete`` is False.

    Args:
        user_id: ALwrity user ID
        profile_context: Current ``LinkedInProfileContext`` dict
        profile_validation: Phase 3 validation result (completeness gate)
        repository: Optional ``ProfileRepository`` (for testing)
        force_regenerate: Bypass cache and regenerate via LLM
        generate_fn: Injectable LLM adapter (for testing)

    Returns:
        Tuple of (intelligence dict or ``None`` when incomplete, acquire meta)

    Raises:
        ProfileIntelligenceLLMError: When LLM fails after validation retry
        ProfileIntelligenceValidationError: When validation fails after retry
        ValueError: When analysis row is missing during generation
    """
    logger.info(
        "{} ============================================================",
        _LOG_PREFIX,
    )
    logger.info("{} Starting AI profile understanding user_id={}", _LOG_PREFIX, user_id)
    logger.info(
        "{} Gate check is_profile_complete={} force_regenerate={}",
        _LOG_PREFIX,
        profile_validation.get("is_profile_complete"),
        force_regenerate,
    )

    if not profile_validation.get("is_profile_complete"):
        logger.info(
            "{} Skipping intelligence — profile incomplete user_id={} missing_fields={}",
            _LOG_PREFIX,
            user_id,
            profile_validation.get("missing_fields"),
        )
        return None, {"ai_intelligence_updated_at": None}

    if not isinstance(profile_context, dict):
        logger.error(
            "{} Invalid profile_context type={} user_id={}",
            _LOG_PREFIX,
            type(profile_context).__name__,
            user_id,
        )
        raise ProfileIntelligenceError("profile context must be a dict")

    repo = repository or ProfileRepository()
    row = repo.get_analysis_row(user_id)
    if not row:
        logger.error(
            "{} No analysis row for intelligence user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ValueError(
            f"No linkedin_analysis_context row for user_id={user_id!r}; "
            "acquire normalized profile first"
        )

    context_hash = compute_profile_context_hash(profile_context)
    logger.info(
        "{} Context hash computed user_id={} hash={}",
        _LOG_PREFIX,
        user_id,
        context_hash[:12],
    )

    if not force_regenerate:
        cached = repo.get_ai_profile_intelligence(user_id, row=row)
        if cached and _is_intelligence_cache_valid(
            cached,
            context_hash=context_hash,
            row=row,
            user_id=user_id,
        ):
            meta: ProfileIntelligenceAcquireMeta = {
                "source": "cache",
                "ai_intelligence_updated_at": row.get("ai_intelligence_updated_at"),
            }
            logger.info(
                "{} Cache hit user_id={} ai_intelligence_updated_at={}",
                _LOG_PREFIX,
                user_id,
                meta.get("ai_intelligence_updated_at"),
            )
            logger.info("{} AI profile understanding finished source=cache", _LOG_PREFIX)
            return cached, meta

        logger.info(
            "{} Cache miss user_id={} cached_present={}",
            _LOG_PREFIX,
            user_id,
            cached is not None,
        )
    else:
        logger.info(
            "{} force_regenerate=True — bypassing cache user_id={}",
            _LOG_PREFIX,
            user_id,
        )

    stored = _generate_and_persist_intelligence(
        user_id,
        profile_context,
        context_hash=context_hash,
        repository=repo,
        generate_fn=generate_fn,
    )
    updated_at = repo.get_analysis_row(user_id)
    ai_updated = updated_at.get("ai_intelligence_updated_at") if updated_at else None

    generated_meta: ProfileIntelligenceAcquireMeta = {
        "source": "generated",
        "ai_intelligence_updated_at": ai_updated,
    }
    logger.info(
        "{} AI profile understanding finished source=generated user_id={}",
        _LOG_PREFIX,
        user_id,
    )
    return stored, generated_meta


def _is_intelligence_cache_valid(
    cached: dict[str, Any],
    *,
    context_hash: str,
    row: dict[str, Any],
    user_id: str,
) -> bool:
    """Return True when cached intelligence matches the current profile context."""
    meta = cached.get("meta")
    if not isinstance(meta, dict):
        logger.warning(
            "{} Cache invalid — missing meta user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        return False

    stored_hash = meta.get("built_from_profile_context_hash")
    if not isinstance(stored_hash, str) or stored_hash != context_hash:
        logger.info(
            "{} Cache invalid — context hash mismatch user_id={} stored={} current={}",
            _LOG_PREFIX,
            user_id,
            stored_hash[:12] if isinstance(stored_hash, str) and stored_hash else None,
            context_hash[:12],
        )
        return False

    context_updated_at = row.get("profile_context_updated_at")
    ai_updated_at = row.get("ai_intelligence_updated_at")
    if (
        isinstance(context_updated_at, str)
        and isinstance(ai_updated_at, str)
        and context_updated_at > ai_updated_at
    ):
        logger.info(
            "{} Cache invalid — profile_context_updated_at newer user_id={} "
            "context_updated_at={} ai_updated_at={}",
            _LOG_PREFIX,
            user_id,
            context_updated_at,
            ai_updated_at,
        )
        return False

    logger.debug(
        "{} Cache valid user_id={} hash={}",
        _LOG_PREFIX,
        user_id,
        context_hash[:12],
    )
    return True


def _generate_and_persist_intelligence(
    user_id: str,
    profile_context: dict[str, Any],
    *,
    context_hash: str,
    repository: ProfileRepository,
    generate_fn: ProfileIntelligenceGenerateFn,
) -> dict[str, Any]:
    """Run LLM (with one validation retry), validate, and persist intelligence."""
    logger.info("{} Preparing LLM prompt user_id={}", _LOG_PREFIX, user_id)
    user_prompt = build_profile_intelligence_user_prompt(profile_context)
    logger.info(
        "{} User prompt ready user_id={} prompt_len={}",
        _LOG_PREFIX,
        user_id,
        len(user_prompt),
    )

    raw = _call_llm_with_validation_retry(
        user_id=user_id,
        user_prompt=user_prompt,
        generate_fn=generate_fn,
    )

    payload = validate_ai_profile_intelligence_payload(raw)
    stored = build_stored_ai_profile_intelligence(payload, context_hash=context_hash)
    logger.info(
        "{} Persisting ai_profile_intelligence_json user_id={} hash={}",
        _LOG_PREFIX,
        user_id,
        context_hash[:12],
    )
    try:
        repository.save_ai_profile_intelligence(
            user_id,
            stored,
            context_hash=context_hash,
        )
    except ValueError as exc:
        logger.exception(
            "{} Failed to persist intelligence user_id={}: {}",
            _LOG_PREFIX,
            user_id,
            exc,
        )
        raise ProfileIntelligenceError(
            "Unable to persist AI profile intelligence"
        ) from exc

    logger.info("{} Persisted ai_profile_intelligence_json user_id={}", _LOG_PREFIX, user_id)
    return stored


def _call_llm_with_validation_retry(
    *,
    user_id: str,
    user_prompt: str,
    generate_fn: ProfileIntelligenceGenerateFn,
) -> dict[str, Any]:
    """Call LLM once; retry once when validation fails on the parsed response."""
    logger.info("{} Sending request to LLM user_id={}", _LOG_PREFIX, user_id)
    raw = call_profile_intelligence_llm(
        system_prompt=PROFILE_INTELLIGENCE_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        user_id=user_id,
        generate_fn=generate_fn,
    )
    logger.info(
        "{} AI response received user_id={} keys={}",
        _LOG_PREFIX,
        user_id,
        sorted(raw.keys()) if isinstance(raw, dict) else None,
    )

    normalized = normalize_ai_profile_intelligence_raw(raw) if isinstance(raw, dict) else raw

    try:
        validate_ai_profile_intelligence_payload(normalized)
        logger.info("{} Validation passed on first attempt user_id={}", _LOG_PREFIX, user_id)
        return normalized
    except ProfileIntelligenceValidationError as first_error:
        logger.warning(
            "{} Validation failed — retrying LLM once user_id={} code={}: {}",
            _LOG_PREFIX,
            user_id,
            first_error.validation_code,
            first_error,
        )

    retry_prompt = f"{user_prompt}{VALIDATION_RETRY_USER_SUFFIX}"
    logger.info("{} Sending validation retry to LLM user_id={}", _LOG_PREFIX, user_id)
    retry_raw = call_profile_intelligence_llm(
        system_prompt=PROFILE_INTELLIGENCE_SYSTEM_PROMPT,
        user_prompt=retry_prompt,
        user_id=user_id,
        generate_fn=generate_fn,
    )
    logger.info(
        "{} Retry AI response received user_id={} keys={}",
        _LOG_PREFIX,
        user_id,
        sorted(retry_raw.keys()) if isinstance(retry_raw, dict) else None,
    )

    retry_normalized = (
        normalize_ai_profile_intelligence_raw(retry_raw)
        if isinstance(retry_raw, dict)
        else retry_raw
    )

    try:
        validate_ai_profile_intelligence_payload(retry_normalized)
        logger.info("{} Validation passed on retry user_id={}", _LOG_PREFIX, user_id)
        return retry_normalized
    except ProfileIntelligenceValidationError as retry_error:
        logger.exception(
            "{} Validation failed after retry user_id={} code={}: {}",
            _LOG_PREFIX,
            user_id,
            retry_error.validation_code,
            retry_error,
        )
        raise ProfileIntelligenceValidationError(
            f"AI profile intelligence failed validation after retry ({retry_error})",
            validation_code=retry_error.validation_code,
        ) from retry_error

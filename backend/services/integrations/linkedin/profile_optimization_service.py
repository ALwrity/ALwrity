"""
Phase 7 — profile optimization orchestration (cache-first generate).

Gates on profile completeness and AI intelligence; coordinates rubric, LLM, validation,
and persistence.
"""

from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict

from loguru import logger

from prompts.linkedin.profile_optimization_prompt import (
    PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
    build_profile_optimization_user_prompt,
)
from services.integrations.linkedin.profile_optimization_llm import (
    ProfileOptimizationGenerateFn,
    ProfileOptimizationLLMError,
    call_profile_optimization_llm,
)
from services.integrations.linkedin.profile_optimization_rubric import (
    detect_profile_optimization_gaps,
)
from services.integrations.linkedin.profile_optimization_types import (
    PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE,
)
from services.integrations.linkedin.profile_optimization_validator import (
    VALIDATION_RETRY_BATCH_SUFFIX,
    ProfileOptimizationValidationError,
    build_stored_profile_optimization,
    extract_active_recommendations_list,
    normalize_profile_optimization_raw,
    validate_profile_optimization_batch_payload,
)
from services.integrations.linkedin.profile_repository import (
    ProfileRepository,
    compute_ai_intelligence_hash,
    compute_profile_context_hash,
)
from services.integrations.linkedin.profile_validation_types import ProfileValidationResult
from services.llm_providers.gemini_provider import gemini_structured_json_response

_LOG_PREFIX = "[ProfileOptimization]"

PROFILE_LOOKS_STRONG_MESSAGE = "Your profile looks strong — no major optimization gaps detected."

VALIDATION_RETRY_USER_SUFFIX = VALIDATION_RETRY_BATCH_SUFFIX


class ProfileOptimizationError(Exception):
    """Base error for profile optimization orchestration."""


class ProfileOptimizationAcquireMeta(TypedDict, total=False):
    """Metadata for profile optimization acquisition."""

    source: Literal["cache", "generated", "no_gaps"]
    profile_optimization_updated_at: Optional[str]
    remaining_in_backlog: int
    message: Optional[str]


def get_or_generate_profile_optimization(
    user_id: str,
    profile_context: dict[str, Any],
    profile_validation: ProfileValidationResult,
    ai_profile_intelligence: dict[str, Any],
    *,
    repository: Optional[ProfileRepository] = None,
    force_regenerate: bool = False,
    generate_fn: ProfileOptimizationGenerateFn = gemini_structured_json_response,
) -> tuple[Optional[list[dict[str, Any]]], ProfileOptimizationAcquireMeta]:
    """
    Return cached or newly generated profile optimization recommendations.

    Skips LLM when profile is incomplete, intelligence is missing, or rubric finds
    no gaps.

    Args:
        user_id: ALwrity user ID
        profile_context: Phase 2 ``LinkedInProfileContext`` dict
        profile_validation: Phase 3 validation result (completeness gate)
        ai_profile_intelligence: Phase 5 AI profile intelligence dict
        repository: Optional ``ProfileRepository`` (for testing)
        force_regenerate: Bypass cache and regenerate via LLM
        generate_fn: Injectable LLM adapter (for testing)

    Returns:
        Tuple of (active recommendations list or ``None`` when gated, acquire meta)

    Raises:
        ProfileOptimizationLLMError: When LLM fails after validation retry
        ProfileOptimizationValidationError: When validation fails after retry
        ValueError: When analysis row is missing during generation
        ProfileOptimizationError: When persistence fails
    """
    logger.info(
        "{} ============================================================",
        _LOG_PREFIX,
    )
    logger.info(
        "{} Starting profile optimization user_id={}",
        _LOG_PREFIX,
        user_id,
    )
    logger.info(
        "{} Gate check is_profile_complete={} intelligence_present={} force_regenerate={}",
        _LOG_PREFIX,
        profile_validation.get("is_profile_complete"),
        isinstance(ai_profile_intelligence, dict) and bool(ai_profile_intelligence),
        force_regenerate,
    )

    if not profile_validation.get("is_profile_complete"):
        logger.info(
            "{} Skipping optimization — profile incomplete user_id={} missing_fields={}",
            _LOG_PREFIX,
            user_id,
            profile_validation.get("missing_fields"),
        )
        return None, {"profile_optimization_updated_at": None}

    if not isinstance(ai_profile_intelligence, dict) or not ai_profile_intelligence:
        logger.info(
            "{} Skipping optimization — AI profile intelligence missing user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        return None, {"profile_optimization_updated_at": None}

    if not isinstance(profile_context, dict) or not profile_context:
        logger.info(
            "{} Skipping optimization — profile context missing user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        return None, {"profile_optimization_updated_at": None}

    repo = repository or ProfileRepository()
    row = repo.get_analysis_row(user_id)
    if not row:
        logger.error(
            "{} No analysis row for optimization user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ValueError(
            f"No linkedin_analysis_context row for user_id={user_id!r}; "
            "acquire normalized profile first"
        )

    profile_context_hash = compute_profile_context_hash(profile_context)
    intelligence_hash = compute_ai_intelligence_hash(ai_profile_intelligence)
    logger.info(
        "{} Hashes computed user_id={} context_hash={} intelligence_hash={}",
        _LOG_PREFIX,
        user_id,
        profile_context_hash[:12],
        intelligence_hash[:12],
    )

    if not force_regenerate:
        cached = repo.get_profile_optimization(user_id, row=row)
        if cached and _is_profile_optimization_cache_valid(
            cached,
            profile_context_hash=profile_context_hash,
            intelligence_hash=intelligence_hash,
            row=row,
            user_id=user_id,
        ):
            recommendations = extract_active_recommendations_list(cached)
            backlog = cached.get("backlog")
            remaining = len(backlog) if isinstance(backlog, list) else 0
            meta: ProfileOptimizationAcquireMeta = {
                "source": "cache",
                "profile_optimization_updated_at": row.get("profile_optimization_updated_at"),
                "remaining_in_backlog": remaining,
            }
            logger.info(
                "{} Cache hit user_id={} profile_optimization_updated_at={} "
                "active_count={} remaining_in_backlog={}",
                _LOG_PREFIX,
                user_id,
                meta.get("profile_optimization_updated_at"),
                len(recommendations),
                remaining,
            )
            return recommendations, meta

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

    gaps = detect_profile_optimization_gaps(profile_context, profile_validation)
    logger.info(
        "{} Rubric complete user_id={} detected_gaps={}",
        _LOG_PREFIX,
        user_id,
        len(gaps),
    )

    if not gaps:
        logger.info(
            "{} No gaps detected — skipping LLM user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        no_gaps_meta: ProfileOptimizationAcquireMeta = {
            "source": "no_gaps",
            "profile_optimization_updated_at": None,
            "remaining_in_backlog": 0,
            "message": PROFILE_LOOKS_STRONG_MESSAGE,
        }
        return [], no_gaps_meta

    stored = _generate_and_persist_optimization(
        user_id,
        profile_context,
        profile_validation,
        ai_profile_intelligence,
        gaps=gaps,
        profile_context_hash=profile_context_hash,
        intelligence_hash=intelligence_hash,
        repository=repo,
        generate_fn=generate_fn,
    )
    recommendations = extract_active_recommendations_list(stored)
    backlog = stored.get("backlog")
    remaining = len(backlog) if isinstance(backlog, list) else 0
    updated_row = repo.get_analysis_row(user_id)
    opt_updated = (
        updated_row.get("profile_optimization_updated_at") if updated_row else None
    )

    generated_meta: ProfileOptimizationAcquireMeta = {
        "source": "generated",
        "profile_optimization_updated_at": opt_updated,
        "remaining_in_backlog": remaining,
    }
    logger.info(
        "{} Profile optimization finished source=generated user_id={} active_count={} "
        "remaining_in_backlog={}",
        _LOG_PREFIX,
        user_id,
        len(recommendations),
        remaining,
    )
    return recommendations, generated_meta


def _is_profile_optimization_cache_valid(
    cached: dict[str, Any],
    *,
    profile_context_hash: str,
    intelligence_hash: str,
    row: dict[str, Any],
    user_id: str,
) -> bool:
    """Return True when cached optimization matches current context and intelligence."""
    meta = cached.get("meta")
    if not isinstance(meta, dict):
        logger.warning(
            "{} Cache invalid — missing meta user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        return False

    stored_context_hash = meta.get("built_from_profile_context_hash")
    if not isinstance(stored_context_hash, str) or stored_context_hash != profile_context_hash:
        logger.info(
            "{} Cache invalid — profile context hash mismatch user_id={} stored={} current={}",
            _LOG_PREFIX,
            user_id,
            stored_context_hash[:12]
            if isinstance(stored_context_hash, str) and stored_context_hash
            else None,
            profile_context_hash[:12],
        )
        return False

    stored_intelligence_hash = meta.get("built_from_intelligence_hash")
    if (
        not isinstance(stored_intelligence_hash, str)
        or stored_intelligence_hash != intelligence_hash
    ):
        logger.info(
            "{} Cache invalid — intelligence hash mismatch user_id={} stored={} current={}",
            _LOG_PREFIX,
            user_id,
            stored_intelligence_hash[:12]
            if isinstance(stored_intelligence_hash, str) and stored_intelligence_hash
            else None,
            intelligence_hash[:12],
        )
        return False

    context_updated_at = row.get("profile_context_updated_at")
    opt_updated_at = row.get("profile_optimization_updated_at")
    if (
        isinstance(context_updated_at, str)
        and isinstance(opt_updated_at, str)
        and context_updated_at > opt_updated_at
    ):
        logger.info(
            "{} Cache invalid — profile_context_updated_at newer user_id={} "
            "context_updated_at={} opt_updated_at={}",
            _LOG_PREFIX,
            user_id,
            context_updated_at,
            opt_updated_at,
        )
        return False

    ai_updated_at = row.get("ai_intelligence_updated_at")
    if (
        isinstance(ai_updated_at, str)
        and isinstance(opt_updated_at, str)
        and ai_updated_at > opt_updated_at
    ):
        logger.info(
            "{} Cache invalid — ai_intelligence_updated_at newer user_id={} "
            "ai_updated_at={} opt_updated_at={}",
            _LOG_PREFIX,
            user_id,
            ai_updated_at,
            opt_updated_at,
        )
        return False

    recommendations = cached.get("recommendations")
    active_count = len(recommendations) if isinstance(recommendations, list) else 0
    if active_count < 1 or active_count > PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE:
        logger.warning(
            "{} Cache invalid — active recommendations count user_id={} count={}",
            _LOG_PREFIX,
            user_id,
            active_count,
        )
        return False

    logger.debug(
        "{} Cache valid user_id={} context_hash={} intelligence_hash={}",
        _LOG_PREFIX,
        user_id,
        profile_context_hash[:12],
        intelligence_hash[:12],
    )
    return True


def _generate_and_persist_optimization(
    user_id: str,
    profile_context: dict[str, Any],
    profile_validation: ProfileValidationResult,
    ai_profile_intelligence: dict[str, Any],
    *,
    gaps: list[Any],
    profile_context_hash: str,
    intelligence_hash: str,
    repository: ProfileRepository,
    generate_fn: ProfileOptimizationGenerateFn,
) -> dict[str, Any]:
    """Run LLM (with one validation retry), validate batch, assign IDs, and persist."""
    logger.info("{} Preparing LLM prompt user_id={} gap_count={}", _LOG_PREFIX, user_id, len(gaps))
    user_prompt = build_profile_optimization_user_prompt(
        profile_context,
        profile_validation,
        gaps,
        ai_profile_intelligence,
    )
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

    logger.info("{} Validating optimization batch user_id={}", _LOG_PREFIX, user_id)
    payload = validate_profile_optimization_batch_payload(raw)
    stored = build_stored_profile_optimization(
        payload,
        profile_context_hash=profile_context_hash,
        intelligence_hash=intelligence_hash,
    )
    logger.info(
        "{} Assigning optimization IDs complete user_id={} active_count={} backlog_count={}",
        _LOG_PREFIX,
        user_id,
        len(stored.get("recommendations", [])),
        len(stored.get("backlog", [])),
    )
    logger.info(
        "{} Persisting profile_optimization_json user_id={} context_hash={} intelligence_hash={}",
        _LOG_PREFIX,
        user_id,
        profile_context_hash[:12],
        intelligence_hash[:12],
    )
    try:
        repository.save_profile_optimization(
            user_id,
            stored,
            profile_context_hash=profile_context_hash,
            intelligence_hash=intelligence_hash,
        )
    except ValueError as exc:
        logger.exception(
            "{} Failed to persist profile optimization user_id={}: {}",
            _LOG_PREFIX,
            user_id,
            exc,
        )
        raise ProfileOptimizationError(
            "Unable to persist profile optimization recommendations"
        ) from exc

    logger.info(
        "{} Profile optimization batch generated successfully user_id={}",
        _LOG_PREFIX,
        user_id,
    )
    return stored


def _call_llm_with_validation_retry(
    *,
    user_id: str,
    user_prompt: str,
    generate_fn: ProfileOptimizationGenerateFn,
) -> dict[str, Any]:
    """Call LLM once; retry once when batch validation fails on the parsed response."""
    logger.info("{} Sending request to LLM user_id={}", _LOG_PREFIX, user_id)
    raw = call_profile_optimization_llm(
        system_prompt=PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        user_id=user_id,
        generate_fn=generate_fn,
    )
    logger.info(
        "{} LLM response received user_id={} keys={}",
        _LOG_PREFIX,
        user_id,
        sorted(raw.keys()) if isinstance(raw, dict) else None,
    )

    normalized = normalize_profile_optimization_raw(raw) if isinstance(raw, dict) else raw

    try:
        validate_profile_optimization_batch_payload(normalized)
        logger.info("{} Validation passed on first attempt user_id={}", _LOG_PREFIX, user_id)
        return normalized
    except ProfileOptimizationValidationError as first_error:
        logger.warning(
            "{} Validation failed — retrying LLM once user_id={} code={}: {}",
            _LOG_PREFIX,
            user_id,
            first_error.validation_code,
            first_error,
        )

    retry_prompt = f"{user_prompt}{VALIDATION_RETRY_USER_SUFFIX}"
    logger.info("{} Sending validation retry to LLM user_id={}", _LOG_PREFIX, user_id)
    retry_raw = call_profile_optimization_llm(
        system_prompt=PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
        user_prompt=retry_prompt,
        user_id=user_id,
        generate_fn=generate_fn,
    )
    logger.info(
        "{} Retry LLM response received user_id={} keys={}",
        _LOG_PREFIX,
        user_id,
        sorted(retry_raw.keys()) if isinstance(retry_raw, dict) else None,
    )

    retry_normalized = (
        normalize_profile_optimization_raw(retry_raw)
        if isinstance(retry_raw, dict)
        else retry_raw
    )

    try:
        validate_profile_optimization_batch_payload(retry_normalized)
        logger.info("{} Validation passed on retry user_id={}", _LOG_PREFIX, user_id)
        return retry_normalized
    except ProfileOptimizationValidationError as retry_error:
        logger.exception(
            "{} Validation failed after retry user_id={} code={}: {}",
            _LOG_PREFIX,
            user_id,
            retry_error.validation_code,
            retry_error,
        )
        raise ProfileOptimizationValidationError(
            f"Profile optimization failed validation after retry ({retry_error})",
            validation_code=retry_error.validation_code,
        ) from retry_error

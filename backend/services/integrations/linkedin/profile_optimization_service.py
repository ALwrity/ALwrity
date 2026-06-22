"""
Phase 7 — profile optimization orchestration (cache-first generate).

Gates on profile completeness and AI intelligence; coordinates rubric, LLM, validation,
and persistence.

Uses the centralized llm_text_gen service for all LLM calls, ensuring:
- Subscription checking and usage tracking
- Provider routing and fallback handling
- Routing observability
"""

from __future__ import annotations

import json
from typing import Any, Callable, Literal, Optional, TypedDict

from loguru import logger

from prompts.linkedin.profile_optimization_prompt import (
    PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
    build_profile_optimization_user_prompt,
)
from services.integrations.linkedin.profile_optimization_rubric import (
    detect_profile_optimization_gaps,
)
from services.integrations.linkedin.profile_optimization_types import (
    PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE,
    profile_optimization_gemini_json_schema,
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
from services.llm_providers.main_text_generation import llm_text_gen

_LOG_PREFIX = "[ProfileOptimization]"

PROFILE_LOOKS_STRONG_MESSAGE = "Your profile looks strong — no major optimization gaps detected."

VALIDATION_RETRY_USER_SUFFIX = VALIDATION_RETRY_BATCH_SUFFIX


def _classify_llm_error(exc: Exception) -> str:
    """Return a safe error category for LLM/provider failures (for logging)."""
    msg = str(exc).lower()
    if "resource_exhausted" in msg or "quota" in msg or "rate limit" in msg:
        return "quota_or_rate_limit"
    if "401" in msg or "403" in msg or "api key" in msg or "authentication" in msg:
        return "auth"
    if "timeout" in msg or "timed out" in msg or "deadline" in msg:
        return "timeout"
    if "invalid json" in msg or "json" in msg:
        return "invalid_json"
    if "subscription" in msg or "429" in msg:
        return "subscription_limit"
    return "provider_error"


class ProfileOptimizationError(Exception):
    """Base error for profile optimization orchestration."""


class ProfileOptimizationLLMError(Exception):
    """Raised when the LLM provider fails for profile optimization generation."""

    def __init__(self, message: str, *, error_kind: str = "unknown") -> None:
        super().__init__(message)
        self.error_kind = error_kind


# Type alias for the LLM generation function (for test injection)
ProfileOptimizationGenerateFn = Callable[..., str]


class ProfileOptimizationAcquireMeta(TypedDict, total=False):
    """Metadata for profile optimization acquisition."""

    source: Literal["cache", "generated", "no_gaps", "batch_advanced"]
    profile_optimization_updated_at: Optional[str]
    remaining_in_backlog: int
    active_batch_index: int
    message: Optional[str]


class ProfileOptimizationNotStoredError(ProfileOptimizationError):
    """Raised when no stored profile optimization exists for the user."""


class ProfileOptimizationItemNotFoundError(ProfileOptimizationError):
    """Raised when the recommendation id is not in the active batch."""


class ProfileOptimizationBatchNotReadyError(ProfileOptimizationError):
    """Raised when the next batch cannot be loaded yet."""


def get_or_generate_profile_optimization(
    user_id: str,
    profile_context: dict[str, Any],
    profile_validation: ProfileValidationResult,
    ai_profile_intelligence: dict[str, Any],
    *,
    repository: Optional[ProfileRepository] = None,
    force_regenerate: bool = False,
    generate_fn: Optional[ProfileOptimizationGenerateFn] = None,
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
            meta: ProfileOptimizationAcquireMeta = _meta_from_stored(
                cached,
                row,
                source="cache",
            )
            if not recommendations and meta.get("remaining_in_backlog", 0) > 0:
                logger.info(
                    "{} Cache hit with cleared active batch user_id={} remaining_in_backlog={}",
                    _LOG_PREFIX,
                    user_id,
                    meta.get("remaining_in_backlog"),
                )
            else:
                logger.info(
                    "{} Cache hit user_id={} profile_optimization_updated_at={} "
                    "active_count={} remaining_in_backlog={}",
                    _LOG_PREFIX,
                    user_id,
                    meta.get("profile_optimization_updated_at"),
                    len(recommendations),
                    meta.get("remaining_in_backlog"),
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
    updated_row = repo.get_analysis_row(user_id)
    generated_meta: ProfileOptimizationAcquireMeta = _meta_from_stored(
        stored,
        updated_row or row,
        source="generated",
    )
    logger.info(
        "{} Profile optimization finished source=generated user_id={} active_count={} "
        "remaining_in_backlog={}",
        _LOG_PREFIX,
        user_id,
        len(recommendations),
        generated_meta.get("remaining_in_backlog"),
    )
    return recommendations, generated_meta


def advance_profile_optimization_batch(
    user_id: str,
    recommendation_id: str,
    status: Literal["done", "skipped"],
    *,
    repository: Optional[ProfileRepository] = None,
) -> tuple[list[dict[str, Any]], ProfileOptimizationAcquireMeta]:
    """
    Mark an active recommendation done/skipped and remove it from the active batch.

    Does not pull from backlog until ``get_next_profile_optimization_batch`` is called
    after the active batch is fully cleared.

    Args:
        user_id: ALwrity user ID
        recommendation_id: Server-assigned recommendation ``id``
        status: ``done`` or ``skipped``
        repository: Optional ``ProfileRepository`` (for testing)

    Returns:
        Updated active recommendations and acquire meta

    Raises:
        ProfileOptimizationNotStoredError: When optimization was never generated
        ProfileOptimizationItemNotFoundError: When id is not in the active batch
        ProfileOptimizationError: When persistence fails
    """
    logger.info(
        "{} advance_profile_optimization_batch start user_id={} recommendation_id={} status={}",
        _LOG_PREFIX,
        user_id,
        recommendation_id,
        status,
    )
    repo = repository or ProfileRepository()
    row = repo.get_analysis_row(user_id)
    if not row:
        logger.error(
            "{} advance_profile_optimization_batch no analysis row user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ProfileOptimizationNotStoredError(
            f"No linkedin_analysis_context row for user_id={user_id!r}"
        )

    stored = repo.get_profile_optimization(user_id, row=row)
    if not stored:
        logger.warning(
            "{} advance_profile_optimization_batch no stored optimization user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ProfileOptimizationNotStoredError(
            "No profile optimization recommendations stored for this user"
        )

    meta_block = stored.get("meta")
    if not isinstance(meta_block, dict):
        meta_block = {}
        stored["meta"] = meta_block

    completed_ids = meta_block.get("completed_ids")
    if not isinstance(completed_ids, list):
        completed_ids = []
        meta_block["completed_ids"] = completed_ids

    if recommendation_id in completed_ids:
        logger.info(
            "{} advance_profile_optimization_batch idempotent hit user_id={} "
            "recommendation_id={} already_completed=true",
            _LOG_PREFIX,
            user_id,
            recommendation_id,
        )
        recommendations = extract_active_recommendations_list(stored)
        return recommendations, _meta_from_stored(stored, row, source="cache")

    recommendations_raw = stored.get("recommendations")
    if not isinstance(recommendations_raw, list):
        recommendations_raw = []

    active_items = [item for item in recommendations_raw if isinstance(item, dict)]
    match_index = next(
        (index for index, item in enumerate(active_items) if item.get("id") == recommendation_id),
        None,
    )
    if match_index is None:
        logger.warning(
            "{} advance_profile_optimization_batch item not found user_id={} "
            "recommendation_id={} active_ids={}",
            _LOG_PREFIX,
            user_id,
            recommendation_id,
            [item.get("id") for item in active_items],
        )
        raise ProfileOptimizationItemNotFoundError(
            f"Recommendation {recommendation_id!r} is not in the active batch"
        )

    removed = active_items.pop(match_index)
    stored["recommendations"] = active_items
    completed_ids.append(recommendation_id)

    logger.info(
        "{} advance_profile_optimization_batch removed user_id={} recommendation_id={} "
        "status={} section={} active_remaining={} backlog_remaining={}",
        _LOG_PREFIX,
        user_id,
        recommendation_id,
        status,
        removed.get("profile_section"),
        len(active_items),
        len(stored.get("backlog") or []),
    )

    try:
        updated_at = repo.save_profile_optimization(user_id, stored)
        row = repo.get_analysis_row(user_id) or row
        row["profile_optimization_updated_at"] = updated_at
    except ValueError as exc:
        logger.exception(
            "{} advance_profile_optimization_batch persist failed user_id={}: {}",
            _LOG_PREFIX,
            user_id,
            exc,
        )
        raise ProfileOptimizationError(
            "Unable to persist profile optimization batch progress"
        ) from exc

    batch_meta = _meta_from_stored(stored, row, source="batch_advanced")
    logger.info(
        "{} advance_profile_optimization_batch complete user_id={} active_count={} "
        "remaining_in_backlog={} show_next_batch_cta={}",
        _LOG_PREFIX,
        user_id,
        len(active_items),
        batch_meta.get("remaining_in_backlog"),
        len(active_items) == 0 and bool(batch_meta.get("remaining_in_backlog")),
    )
    return active_items, batch_meta


def get_next_profile_optimization_batch(
    user_id: str,
    *,
    repository: Optional[ProfileRepository] = None,
) -> tuple[list[dict[str, Any]], ProfileOptimizationAcquireMeta]:
    """
    Promote the next active batch from backlog when the current batch is fully cleared.

    Args:
        user_id: ALwrity user ID
        repository: Optional ``ProfileRepository`` (for testing)

    Returns:
        New active recommendations and acquire meta

    Raises:
        ProfileOptimizationNotStoredError: When optimization was never generated
        ProfileOptimizationBatchNotReadyError: When active batch is not empty or backlog empty
        ProfileOptimizationError: When persistence fails
    """
    logger.info(
        "{} get_next_profile_optimization_batch start user_id={}",
        _LOG_PREFIX,
        user_id,
    )
    repo = repository or ProfileRepository()
    row = repo.get_analysis_row(user_id)
    if not row:
        raise ProfileOptimizationNotStoredError(
            f"No linkedin_analysis_context row for user_id={user_id!r}"
        )

    stored = repo.get_profile_optimization(user_id, row=row)
    if not stored:
        raise ProfileOptimizationNotStoredError(
            "No profile optimization recommendations stored for this user"
        )

    active_items = extract_active_recommendations_list(stored)
    if active_items:
        logger.warning(
            "{} get_next_profile_optimization_batch active batch not cleared user_id={} "
            "active_count={}",
            _LOG_PREFIX,
            user_id,
            len(active_items),
        )
        raise ProfileOptimizationBatchNotReadyError(
            "Complete or skip all recommendations in the current batch first"
        )

    backlog_raw = stored.get("backlog")
    backlog = [item for item in backlog_raw if isinstance(item, dict)] if isinstance(
        backlog_raw, list
    ) else []

    if not backlog:
        logger.info(
            "{} get_next_profile_optimization_batch backlog empty user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ProfileOptimizationBatchNotReadyError(
            "No more recommendations in backlog — refresh to regenerate"
        )

    next_active = backlog[:PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE]
    remaining_backlog = backlog[PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE:]
    stored["recommendations"] = next_active
    stored["backlog"] = remaining_backlog

    meta_block = stored.get("meta")
    if not isinstance(meta_block, dict):
        meta_block = {}
        stored["meta"] = meta_block
    previous_index = int(meta_block.get("active_batch_index") or 0)
    meta_block["active_batch_index"] = previous_index + 1

    logger.info(
        "{} get_next_profile_optimization_batch rotating user_id={} "
        "previous_batch_index={} new_batch_index={} promoted_count={} "
        "remaining_in_backlog={}",
        _LOG_PREFIX,
        user_id,
        previous_index,
        meta_block["active_batch_index"],
        len(next_active),
        len(remaining_backlog),
    )

    try:
        updated_at = repo.save_profile_optimization(user_id, stored)
        row = repo.get_analysis_row(user_id) or row
        row["profile_optimization_updated_at"] = updated_at
    except ValueError as exc:
        logger.exception(
            "{} get_next_profile_optimization_batch persist failed user_id={}: {}",
            _LOG_PREFIX,
            user_id,
            exc,
        )
        raise ProfileOptimizationError(
            "Unable to persist next profile optimization batch"
        ) from exc

    batch_meta = _meta_from_stored(stored, row, source="batch_advanced")
    logger.info(
        "{} get_next_profile_optimization_batch complete user_id={} active_count={} "
        "remaining_in_backlog={}",
        _LOG_PREFIX,
        user_id,
        len(next_active),
        batch_meta.get("remaining_in_backlog"),
    )
    return next_active, batch_meta


def _meta_from_stored(
    stored: dict[str, Any],
    row: dict[str, Any],
    *,
    source: Literal["cache", "generated", "no_gaps", "batch_advanced"],
) -> ProfileOptimizationAcquireMeta:
    """Build acquire meta from persisted optimization JSON and analysis row."""
    backlog = stored.get("backlog")
    remaining = len(backlog) if isinstance(backlog, list) else 0
    meta_block = stored.get("meta")
    active_batch_index = 0
    if isinstance(meta_block, dict):
        active_batch_index = int(meta_block.get("active_batch_index") or 0)
    return {
        "source": source,
        "profile_optimization_updated_at": row.get("profile_optimization_updated_at"),
        "remaining_in_backlog": remaining,
        "active_batch_index": active_batch_index,
    }


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
    backlog = cached.get("backlog")
    backlog_count = len(backlog) if isinstance(backlog, list) else 0
    if active_count < 1 or active_count > PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE:
        if active_count == 0 and backlog_count > 0:
            logger.debug(
                "{} Cache valid with empty active batch user_id={} backlog_count={}",
                _LOG_PREFIX,
                user_id,
                backlog_count,
            )
        else:
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
    generate_fn: Optional[ProfileOptimizationGenerateFn] = None,
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
    generate_fn: Optional[ProfileOptimizationGenerateFn] = None,
) -> dict[str, Any]:
    """Call LLM once; retry once when batch validation fails on the parsed response.

    Uses llm_text_gen for subscription checking, usage tracking, and provider routing.
    """
    logger.info("{} Sending request to LLM user_id={}", _LOG_PREFIX, user_id)

    schema = profile_optimization_gemini_json_schema()

    def _call_llm(prompt: str) -> dict[str, Any]:
        """Inner helper to call LLM and parse JSON response."""
        try:
            # Use the centralized llm_text_gen which handles:
            # - Subscription preflight checks
            # - Provider routing and fallbacks
            # - Usage tracking
            # - Routing observability
            if generate_fn is not None:
                # Test path: use injected mock function
                response_text = generate_fn(
                    prompt=prompt,
                    system_prompt=PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
                    json_struct=schema,
                    user_id=user_id,
                )
            else:
                # Production path: use centralized service
                response_text = llm_text_gen(
                    prompt=prompt,
                    system_prompt=PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
                    json_struct=schema,
                    user_id=user_id,
                    flow_type="linkedin_profile_optimization",
                )

            # Parse JSON response
            if isinstance(response_text, dict):
                return response_text
            if isinstance(response_text, str):
                try:
                    parsed = json.loads(response_text)
                    if not isinstance(parsed, dict):
                        raise ProfileOptimizationLLMError(
                            "LLM JSON response must be an object",
                            error_kind="invalid_json",
                        )
                    if parsed.get("error"):
                        error_message = str(parsed.get("error"))
                        logger.error(
                            "{} LLM returned error payload message={}",
                            _LOG_PREFIX,
                            error_message[:500],
                        )
                        raise ProfileOptimizationLLMError(
                            "LLM provider returned an error response",
                            error_kind="provider_error",
                        )
                    return parsed
                except json.JSONDecodeError as exc:
                    logger.error(
                        "{} LLM returned invalid JSON string error={}",
                        _LOG_PREFIX,
                        exc,
                    )
                    raise ProfileOptimizationLLMError(
                        "LLM returned invalid JSON string",
                        error_kind="invalid_json",
                    ) from exc
            raise ProfileOptimizationLLMError(
                f"Unexpected LLM response type: {type(response_text).__name__}",
                error_kind="invalid_response",
            )
        except ProfileOptimizationLLMError:
            raise
        except Exception as exc:
            error_kind = _classify_llm_error(exc)
            logger.error(
                "{} LLM failure kind={} type={} user_id={} message={}",
                _LOG_PREFIX,
                error_kind,
                type(exc).__name__,
                user_id,
                str(exc)[:500],
            )
            raise ProfileOptimizationLLMError(
                "Unable to generate profile optimization recommendations from LLM",
                error_kind=error_kind,
            ) from exc

    raw = _call_llm(user_prompt)
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
    retry_raw = _call_llm(retry_prompt)
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

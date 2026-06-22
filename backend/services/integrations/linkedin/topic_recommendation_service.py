"""
Phase 6 — topic recommendation orchestration (cache-first generate).

Gates on profile completeness and AI intelligence presence; coordinates LLM + validation + persistence.

Uses the centralized llm_text_gen service for all LLM calls, ensuring:
- Subscription checking and usage tracking
- Provider routing and fallback handling
- Routing observability
"""

from __future__ import annotations

import json
from typing import Any, Callable, Literal, Optional, TypedDict

from loguru import logger

from prompts.linkedin.topic_recommendation_prompt import (
    TOPIC_RECOMMENDATION_SYSTEM_PROMPT,
    build_topic_recommendation_user_prompt,
)
from services.integrations.linkedin.profile_repository import (
    ProfileRepository,
    compute_ai_intelligence_hash,
)
from services.integrations.linkedin.profile_validation_types import ProfileValidationResult
from services.integrations.linkedin.topic_recommendation_types import (
    topic_recommendation_json_schema,
)
from services.integrations.linkedin.topic_recommendation_validator import (
    TopicRecommendationValidationError,
    build_stored_topic_recommendations,
    extract_recommendations_list,
    normalize_topic_recommendation_raw,
    validate_topic_recommendation_payload,
)
from services.llm_providers.main_text_generation import llm_text_gen

_LOG_PREFIX = "[TopicRecommendation]"

VALIDATION_RETRY_USER_SUFFIX = (
    "\n\nPrevious response failed schema validation. "
    "Return valid JSON only matching the required schema exactly with exactly five recommendations."
)

# Type alias for the LLM generation function (for test injection)
TopicRecommendationGenerateFn = Callable[..., str]


class TopicRecommendationError(Exception):
    """Base error for topic recommendation orchestration."""


class TopicRecommendationLLMError(Exception):
    """Raised when the LLM provider fails for topic recommendation generation."""

    def __init__(self, message: str, *, error_kind: str = "unknown") -> None:
        super().__init__(message)
        self.error_kind = error_kind


class TopicRecommendationAcquireMeta(TypedDict, total=False):
    """Metadata for topic recommendation acquisition."""

    source: Literal["cache", "generated"]
    recommendations_updated_at: Optional[str]


def get_or_generate_topic_recommendations(
    user_id: str,
    ai_profile_intelligence: dict[str, Any],
    *,
    profile_validation: ProfileValidationResult,
    repository: Optional[ProfileRepository] = None,
    force_regenerate: bool = False,
    generate_fn: Optional[TopicRecommendationGenerateFn] = None,
) -> tuple[Optional[list[dict[str, Any]]], TopicRecommendationAcquireMeta]:
    """
    Return cached or newly generated topic recommendations.

    Skips LLM when profile is incomplete or intelligence is missing.

    Args:
        user_id: ALwrity user ID
        ai_profile_intelligence: Phase 5 AI profile intelligence dict
        profile_validation: Phase 3 validation result (completeness gate)
        repository: Optional ``ProfileRepository`` (for testing)
        force_regenerate: Bypass cache and regenerate via LLM
        generate_fn: Injectable LLM adapter (for testing)

    Returns:
        Tuple of (recommendations list or ``None`` when gated, acquire meta)

    Raises:
        TopicRecommendationLLMError: When LLM fails after validation retry
        TopicRecommendationValidationError: When validation fails after retry
        ValueError: When analysis row is missing during generation
        TopicRecommendationError: When persistence fails
    """
    logger.info(
        "{} ============================================================",
        _LOG_PREFIX,
    )
    logger.info(
        "{} Starting recommendation generation user_id={}",
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
            "{} Skipping recommendations — profile incomplete user_id={} missing_fields={}",
            _LOG_PREFIX,
            user_id,
            profile_validation.get("missing_fields"),
        )
        return None, {"recommendations_updated_at": None}

    if not isinstance(ai_profile_intelligence, dict) or not ai_profile_intelligence:
        logger.info(
            "{} Skipping recommendations — AI profile intelligence missing user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        return None, {"recommendations_updated_at": None}

    repo = repository or ProfileRepository()
    row = repo.get_analysis_row(user_id)
    if not row:
        logger.error(
            "{} No analysis row for recommendations user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        raise ValueError(
            f"No linkedin_analysis_context row for user_id={user_id!r}; "
            "acquire normalized profile first"
        )

    intelligence_hash = compute_ai_intelligence_hash(ai_profile_intelligence)
    logger.info(
        "{} Intelligence hash computed user_id={} hash={}",
        _LOG_PREFIX,
        user_id,
        intelligence_hash[:12],
    )

    if not force_regenerate:
        cached = repo.get_topic_recommendations(user_id, row=row)
        if cached and _is_recommendations_cache_valid(
            cached,
            intelligence_hash=intelligence_hash,
            row=row,
            user_id=user_id,
        ):
            recommendations = extract_recommendations_list(cached)
            meta: TopicRecommendationAcquireMeta = {
                "source": "cache",
                "recommendations_updated_at": row.get("recommendations_updated_at"),
            }
            logger.info(
                "{} Cache hit user_id={} recommendations_updated_at={} count={}",
                _LOG_PREFIX,
                user_id,
                meta.get("recommendations_updated_at"),
                len(recommendations),
            )
            logger.info(
                "{} Five recommendations served from cache user_id={}",
                _LOG_PREFIX,
                user_id,
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

    stored = _generate_and_persist_recommendations(
        user_id,
        ai_profile_intelligence,
        intelligence_hash=intelligence_hash,
        repository=repo,
        generate_fn=generate_fn,
    )
    recommendations = extract_recommendations_list(stored)
    updated_row = repo.get_analysis_row(user_id)
    rec_updated = updated_row.get("recommendations_updated_at") if updated_row else None

    generated_meta: TopicRecommendationAcquireMeta = {
        "source": "generated",
        "recommendations_updated_at": rec_updated,
    }
    logger.info(
        "{} Recommendation generation finished source=generated user_id={} count={}",
        _LOG_PREFIX,
        user_id,
        len(recommendations),
    )
    return recommendations, generated_meta


def _is_recommendations_cache_valid(
    cached: dict[str, Any],
    *,
    intelligence_hash: str,
    row: dict[str, Any],
    user_id: str,
) -> bool:
    """Return True when cached recommendations match the current AI profile intelligence."""
    meta = cached.get("meta")
    if not isinstance(meta, dict):
        logger.warning(
            "{} Cache invalid — missing meta user_id={}",
            _LOG_PREFIX,
            user_id,
        )
        return False

    stored_hash = meta.get("built_from_intelligence_hash")
    if not isinstance(stored_hash, str) or stored_hash != intelligence_hash:
        logger.info(
            "{} Cache invalid — intelligence hash mismatch user_id={} stored={} current={}",
            _LOG_PREFIX,
            user_id,
            stored_hash[:12] if isinstance(stored_hash, str) and stored_hash else None,
            intelligence_hash[:12],
        )
        return False

    ai_updated_at = row.get("ai_intelligence_updated_at")
    rec_updated_at = row.get("recommendations_updated_at")
    if (
        isinstance(ai_updated_at, str)
        and isinstance(rec_updated_at, str)
        and ai_updated_at > rec_updated_at
    ):
        logger.info(
            "{} Cache invalid — ai_intelligence_updated_at newer user_id={} "
            "ai_updated_at={} rec_updated_at={}",
            _LOG_PREFIX,
            user_id,
            ai_updated_at,
            rec_updated_at,
        )
        return False

    recommendations = cached.get("recommendations")
    if not isinstance(recommendations, list) or len(recommendations) != 5:
        logger.warning(
            "{} Cache invalid — recommendations count user_id={} count={}",
            _LOG_PREFIX,
            user_id,
            len(recommendations) if isinstance(recommendations, list) else None,
        )
        return False

    logger.debug(
        "{} Cache valid user_id={} hash={}",
        _LOG_PREFIX,
        user_id,
        intelligence_hash[:12],
    )
    return True


def _generate_and_persist_recommendations(
    user_id: str,
    ai_profile_intelligence: dict[str, Any],
    *,
    intelligence_hash: str,
    repository: ProfileRepository,
    generate_fn: TopicRecommendationGenerateFn,
) -> dict[str, Any]:
    """Run LLM (with one validation retry), validate, assign IDs, and persist."""
    logger.info("{} Reading AI Profile Intelligence user_id={}", _LOG_PREFIX, user_id)
    logger.info("{} Preparing LLM prompt user_id={}", _LOG_PREFIX, user_id)
    user_prompt = build_topic_recommendation_user_prompt(ai_profile_intelligence)
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

    logger.info("{} Validating recommendations user_id={}", _LOG_PREFIX, user_id)
    payload = validate_topic_recommendation_payload(raw)
    stored = build_stored_topic_recommendations(
        payload,
        intelligence_hash=intelligence_hash,
    )
    logger.info(
        "{} Assigning recommendation IDs complete user_id={} count={}",
        _LOG_PREFIX,
        user_id,
        len(stored.get("recommendations", [])),
    )
    logger.info(
        "{} Persisting topic_recommendations_json user_id={} hash={}",
        _LOG_PREFIX,
        user_id,
        intelligence_hash[:12],
    )
    try:
        repository.save_topic_recommendations(
            user_id,
            stored,
            intelligence_hash=intelligence_hash,
        )
    except ValueError as exc:
        logger.exception(
            "{} Failed to persist recommendations user_id={}: {}",
            _LOG_PREFIX,
            user_id,
            exc,
        )
        raise TopicRecommendationError(
            "Unable to persist topic recommendations"
        ) from exc

    logger.info(
        "{} Five recommendations generated successfully user_id={}",
        _LOG_PREFIX,
        user_id,
    )
    return stored


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


def _call_llm_with_validation_retry(
    *,
    user_id: str,
    user_prompt: str,
    generate_fn: Optional[TopicRecommendationGenerateFn] = None,
) -> dict[str, Any]:
    """Call LLM once; retry once when validation fails on the parsed response.

    Uses llm_text_gen for subscription checking, usage tracking, and provider routing.
    """
    logger.info("{} Sending request to LLM user_id={}", _LOG_PREFIX, user_id)

    schema = topic_recommendation_json_schema()

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
                    system_prompt=TOPIC_RECOMMENDATION_SYSTEM_PROMPT,
                    json_struct=schema,
                    user_id=user_id,
                )
            else:
                # Production path: use centralized service
                response_text = llm_text_gen(
                    prompt=prompt,
                    system_prompt=TOPIC_RECOMMENDATION_SYSTEM_PROMPT,
                    json_struct=schema,
                    user_id=user_id,
                    flow_type="linkedin_topic_recommendations",
                )

            # Parse JSON response
            if isinstance(response_text, dict):
                return response_text
            if isinstance(response_text, str):
                try:
                    parsed = json.loads(response_text)
                    if not isinstance(parsed, dict):
                        raise TopicRecommendationLLMError(
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
                        raise TopicRecommendationLLMError(
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
                    raise TopicRecommendationLLMError(
                        "LLM returned invalid JSON string",
                        error_kind="invalid_json",
                    ) from exc
            raise TopicRecommendationLLMError(
                f"Unexpected LLM response type: {type(response_text).__name__}",
                error_kind="invalid_response",
            )
        except TopicRecommendationLLMError:
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
            raise TopicRecommendationLLMError(
                "Unable to generate topic recommendations from LLM",
                error_kind=error_kind,
            ) from exc

    raw = _call_llm(user_prompt)
    logger.info(
        "{} Recommendations received user_id={} keys={}",
        _LOG_PREFIX,
        user_id,
        sorted(raw.keys()) if isinstance(raw, dict) else None,
    )

    normalized = normalize_topic_recommendation_raw(raw) if isinstance(raw, dict) else raw

    try:
        validate_topic_recommendation_payload(normalized)
        logger.info("{} Validation passed on first attempt user_id={}", _LOG_PREFIX, user_id)
        return normalized
    except TopicRecommendationValidationError as first_error:
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
        "{} Retry recommendations received user_id={} keys={}",
        _LOG_PREFIX,
        user_id,
        sorted(retry_raw.keys()) if isinstance(retry_raw, dict) else None,
    )

    retry_normalized = (
        normalize_topic_recommendation_raw(retry_raw)
        if isinstance(retry_raw, dict)
        else retry_raw
    )

    try:
        validate_topic_recommendation_payload(retry_normalized)
        logger.info("{} Validation passed on retry user_id={}", _LOG_PREFIX, user_id)
        return retry_normalized
    except TopicRecommendationValidationError as retry_error:
        logger.exception(
            "{} Validation failed after retry user_id={} code={}: {}",
            _LOG_PREFIX,
            user_id,
            retry_error.validation_code,
            retry_error,
        )
        raise TopicRecommendationValidationError(
            f"Topic recommendations failed validation after retry ({retry_error})",
            validation_code=retry_error.validation_code,
        ) from retry_error

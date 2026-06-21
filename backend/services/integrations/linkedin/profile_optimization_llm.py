"""
Phase 7 — LLM adapter for profile optimization (Gemini structured JSON).

Thin wrapper over injectable ``generate_fn``; no validation or persistence.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Optional

from loguru import logger

from services.integrations.linkedin.profile_optimization_types import (
    DEFAULT_PROFILE_OPTIMIZATION_MODEL,
    PROFILE_OPTIMIZATION_LLM_BATCH_SIZE,
    profile_optimization_gemini_json_schema,
)
from services.llm_providers.gemini_provider import gemini_structured_json_response

_LOG_PREFIX = "[ProfileOptimization]"

PROFILE_OPTIMIZATION_LLM_TEMPERATURE = 0.3
PROFILE_OPTIMIZATION_LLM_MAX_TOKENS = 4096

ProfileOptimizationGenerateFn = Callable[..., Any]


class ProfileOptimizationLLMError(Exception):
    """Raised when the LLM provider fails for profile optimization generation."""

    def __init__(self, message: str, *, error_kind: str = "unknown") -> None:
        super().__init__(message)
        self.error_kind = error_kind


def _classify_gemini_error(exc: Exception) -> str:
    """Return a safe error category for Gemini/provider failures (for logging)."""
    msg = str(exc).lower()
    if "resource_exhausted" in msg or "quota" in msg or "rate limit" in msg:
        return "quota_or_rate_limit"
    if "401" in msg or "403" in msg or "api key" in msg or "authentication" in msg:
        return "auth"
    if "timeout" in msg or "timed out" in msg or "deadline" in msg:
        return "timeout"
    if "invalid json" in msg or "json" in msg:
        return "invalid_json"
    return "provider_error"


def _log_gemini_provider_error(exc: Exception, *, user_id: Optional[str]) -> None:
    """Log Gemini/provider failures with safe metadata for production debugging."""
    error_kind = _classify_gemini_error(exc)
    logger.error(
        "{} Gemini/provider failure kind={} type={} user_id={} message={}",
        _LOG_PREFIX,
        error_kind,
        type(exc).__name__,
        user_id,
        str(exc)[:500],
    )
    logger.exception(
        "{} Gemini/provider traceback user_id={} kind={}",
        _LOG_PREFIX,
        user_id,
        error_kind,
    )


def call_profile_optimization_llm(
    *,
    system_prompt: str,
    user_prompt: str,
    user_id: Optional[str] = None,
    generate_fn: ProfileOptimizationGenerateFn = gemini_structured_json_response,
) -> dict[str, Any]:
    """
    Call the LLM to generate structured profile optimization JSON.

    Args:
        system_prompt: System instruction for the model
        user_prompt: User message (profile snippets, gaps, validation, intelligence)
        user_id: Optional ALwrity user ID for provider usage tracking
        generate_fn: Injectable structured JSON generator (default: Gemini)

    Returns:
        Parsed dict from the LLM (not yet validated by Pydantic)

    Raises:
        ProfileOptimizationLLMError: When the provider fails or returns unusable output
    """
    schema = profile_optimization_gemini_json_schema()
    logger.info(
        "{} call_profile_optimization_llm start model={} user_prompt_len={} "
        "batch_size={} user_id={}",
        _LOG_PREFIX,
        DEFAULT_PROFILE_OPTIMIZATION_MODEL,
        len(user_prompt) if isinstance(user_prompt, str) else None,
        PROFILE_OPTIMIZATION_LLM_BATCH_SIZE,
        user_id,
    )

    try:
        response = generate_fn(
            prompt=user_prompt,
            schema=schema,
            temperature=PROFILE_OPTIMIZATION_LLM_TEMPERATURE,
            max_tokens=PROFILE_OPTIMIZATION_LLM_MAX_TOKENS,
            system_prompt=system_prompt,
            user_id=user_id,
        )
    except ProfileOptimizationLLMError:
        raise
    except Exception as exc:
        _log_gemini_provider_error(exc, user_id=user_id)
        error_kind = _classify_gemini_error(exc)
        raise ProfileOptimizationLLMError(
            "Unable to generate profile optimization recommendations from LLM",
            error_kind=error_kind,
        ) from exc

    try:
        result = _coerce_llm_dict(response)
    except ProfileOptimizationLLMError as exc:
        logger.error(
            "{} call_profile_optimization_llm invalid response user_id={} kind={} "
            "type={} message={}",
            _LOG_PREFIX,
            user_id,
            exc.error_kind,
            type(response).__name__,
            str(exc),
        )
        raise

    recommendation_count = None
    if isinstance(result.get("recommendations"), list):
        recommendation_count = len(result["recommendations"])

    logger.info(
        "{} call_profile_optimization_llm complete user_id={} response_keys={} "
        "recommendation_count={}",
        _LOG_PREFIX,
        user_id,
        sorted(result.keys()),
        recommendation_count,
    )
    return result


def _coerce_llm_dict(response: Any) -> dict[str, Any]:
    """Normalize provider output to a dict."""
    if isinstance(response, dict):
        if response.get("error"):
            error_message = str(response.get("error"))
            logger.error(
                "{} LLM returned error payload message={}",
                _LOG_PREFIX,
                error_message[:500],
            )
            raise ProfileOptimizationLLMError(
                "LLM provider returned an error response",
                error_kind="provider_error",
            )
        return response
    if isinstance(response, str):
        try:
            parsed = json.loads(response)
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
        if not isinstance(parsed, dict):
            raise ProfileOptimizationLLMError(
                "LLM JSON response must be an object",
                error_kind="invalid_json",
            )
        return parsed
    raise ProfileOptimizationLLMError(
        f"Unexpected LLM response type: {type(response).__name__}",
        error_kind="invalid_response",
    )

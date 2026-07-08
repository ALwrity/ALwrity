"""
Phase 5 — LLM adapter for AI profile intelligence (Gemini structured JSON).

Thin wrapper over injectable ``generate_fn``; no validation or persistence.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Optional

from loguru import logger

from services.integrations.linkedin.profile_intelligence_types import (
    DEFAULT_PROFILE_INTELLIGENCE_MODEL,
    ai_profile_intelligence_json_schema,
)
from services.llm_providers.gemini_provider import gemini_structured_json_response

_LOG_PREFIX = "[ProfileIntelligence]"

PROFILE_INTELLIGENCE_LLM_TEMPERATURE = 0.2
PROFILE_INTELLIGENCE_LLM_MAX_TOKENS = 4096

ProfileIntelligenceGenerateFn = Callable[..., Any]


class ProfileIntelligenceLLMError(Exception):
    """Raised when the LLM provider fails for profile intelligence generation."""

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


def call_profile_intelligence_llm(
    *,
    system_prompt: str,
    user_prompt: str,
    user_id: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    generate_fn: ProfileIntelligenceGenerateFn = gemini_structured_json_response,
) -> dict[str, Any]:
    """
    Call the LLM to generate structured profile intelligence JSON.

    Args:
        system_prompt: System instruction for the model
        user_prompt: User message (serialized ``LinkedInProfileContext`` JSON)
        user_id: Optional ALwrity user ID for provider usage tracking
        generate_fn: Injectable structured JSON generator (default: Gemini)

    Returns:
        Parsed dict from the LLM (not yet validated by Pydantic)

    Raises:
        ProfileIntelligenceLLMError: When the provider fails or returns unusable output
    """
    schema = ai_profile_intelligence_json_schema()
    # Show which model/params are being requested; fall back to defaults when not provided
    effective_model = model or DEFAULT_PROFILE_INTELLIGENCE_MODEL
    effective_temperature = (
        temperature if isinstance(temperature, (int, float)) else PROFILE_INTELLIGENCE_LLM_TEMPERATURE
    )
    effective_max_tokens = (
        int(max_tokens) if isinstance(max_tokens, int) and max_tokens > 0 else PROFILE_INTELLIGENCE_LLM_MAX_TOKENS
    )

    logger.info(
        "{} call_profile_intelligence_llm start model={} temp={} max_tokens={} user_prompt_len={} user_id={}",
        _LOG_PREFIX,
        effective_model,
        effective_temperature,
        effective_max_tokens,
        len(user_prompt) if isinstance(user_prompt, str) else None,
        user_id,
    )

    try:
        # Pass through per-request params to the provider adapter when supported.
        gen_kwargs: dict[str, Any] = {
            "prompt": user_prompt,
            "schema": schema,
            "system_prompt": system_prompt,
            "user_id": user_id,
        }
        # Only include optional params when provided to avoid breaking adapters that don't accept them
        if temperature is not None:
            gen_kwargs["temperature"] = effective_temperature
        if max_tokens is not None:
            gen_kwargs["max_tokens"] = effective_max_tokens
        if model is not None:
            gen_kwargs["model"] = model

        response = generate_fn(**gen_kwargs)
    except ProfileIntelligenceLLMError:
        raise
    except Exception as exc:
        _log_gemini_provider_error(exc, user_id=user_id)
        error_kind = _classify_gemini_error(exc)
        raise ProfileIntelligenceLLMError(
            "Unable to generate AI profile intelligence from LLM",
            error_kind=error_kind,
        ) from exc

    try:
        result = _coerce_llm_dict(response)
    except ProfileIntelligenceLLMError as exc:
        logger.error(
            "{} call_profile_intelligence_llm invalid response user_id={} kind={} "
            "type={} message={}",
            _LOG_PREFIX,
            user_id,
            exc.error_kind,
            type(response).__name__,
            str(exc),
        )
        raise

    logger.info(
        "{} call_profile_intelligence_llm complete user_id={} response_keys={}",
        _LOG_PREFIX,
        user_id,
        sorted(result.keys()),
    )
    return result


def _coerce_llm_dict(response: Any) -> dict[str, Any]:
    """Normalize provider output to a dict."""
    if isinstance(response, dict):
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
            raise ProfileIntelligenceLLMError(
                "LLM returned invalid JSON string",
                error_kind="invalid_json",
            ) from exc
        if not isinstance(parsed, dict):
            raise ProfileIntelligenceLLMError(
                "LLM JSON response must be an object",
                error_kind="invalid_json",
            )
        return parsed
    raise ProfileIntelligenceLLMError(
        f"Unexpected LLM response type: {type(response).__name__}",
        error_kind="invalid_response",
    )

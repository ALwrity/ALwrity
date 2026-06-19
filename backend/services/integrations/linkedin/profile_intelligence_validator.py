"""
Phase 5 — pure AI profile intelligence validation (no LLM, no persistence).

Parses LLM output with Pydantic and applies post-checks before meta attachment.
"""

from __future__ import annotations

from typing import Any

from loguru import logger
from pydantic import ValidationError

from services.integrations.linkedin.field_coercion import clean_str
from services.integrations.linkedin.profile_intelligence_types import (
    AIProfileIntelligenceMeta,
    AIProfileIntelligencePayload,
    DEFAULT_PROFILE_INTELLIGENCE_MODEL,
    PROFILE_INTELLIGENCE_SCHEMA_VERSION,
    UNKNOWN_SENTINEL,
    StoredAIProfileIntelligence,
)

_LOG_PREFIX = "[ProfileIntelligence]"

_SCALAR_FIELDS: tuple[str, ...] = (
    "professional_identity",
    "industry",
    "experience_level",
    "communication_style",
    "brand_positioning",
    "summary",
)

_LIST_FIELDS: tuple[str, ...] = (
    "primary_expertise",
    "knowledge_domains",
    "writing_opportunities",
    "target_audience",
)


class ProfileIntelligenceValidationError(Exception):
    """Raised when AI profile intelligence output fails validation."""


def validate_ai_profile_intelligence_payload(
    raw: Any,
) -> AIProfileIntelligencePayload:
    """
    Validate raw LLM output into ``AIProfileIntelligencePayload``.

    Applies Pydantic parsing (``extra='forbid'``) and deterministic post-checks.

    Args:
        raw: Parsed JSON object from the LLM

    Returns:
        Validated payload model

    Raises:
        ProfileIntelligenceValidationError: When parsing or post-checks fail
    """
    logger.info("{} validate_ai_profile_intelligence_payload start", _LOG_PREFIX)

    if not isinstance(raw, dict):
        logger.error(
            "{} validate_ai_profile_intelligence_payload not a dict type={}",
            _LOG_PREFIX,
            type(raw).__name__,
        )
        raise ProfileIntelligenceValidationError(
            "AI profile intelligence must be a JSON object"
        )

    try:
        payload = AIProfileIntelligencePayload.model_validate(raw)
    except ValidationError as exc:
        logger.exception(
            "{} validate_ai_profile_intelligence_payload pydantic error: {}",
            _LOG_PREFIX,
            exc,
        )
        raise ProfileIntelligenceValidationError(
            "AI profile intelligence failed schema validation"
        ) from exc

    _run_post_checks(payload)
    logger.info(
        "{} validate_ai_profile_intelligence_payload ok fields={}",
        _LOG_PREFIX,
        len(_SCALAR_FIELDS) + len(_LIST_FIELDS),
    )
    return payload


def build_stored_ai_profile_intelligence(
    payload: AIProfileIntelligencePayload,
    *,
    context_hash: str = "",
    model: str = DEFAULT_PROFILE_INTELLIGENCE_MODEL,
) -> dict[str, Any]:
    """
    Attach server-side ``meta`` and return a persistence-ready dict.

    Args:
        payload: Validated LLM output
        context_hash: Canonical hash of source ``LinkedInProfileContext``
        model: LLM model identifier used for generation

    Returns:
        Dict matching ``StoredAIProfileIntelligence`` shape
    """
    logger.info(
        "{} build_stored_ai_profile_intelligence context_hash={} model={}",
        _LOG_PREFIX,
        context_hash[:12] if context_hash else None,
        model,
    )
    stored = StoredAIProfileIntelligence(
        meta=AIProfileIntelligenceMeta(
            built_from_profile_context_hash=context_hash,
            schema_version=PROFILE_INTELLIGENCE_SCHEMA_VERSION,
            model=model,
        ),
        **payload.model_dump(),
    )
    return stored.model_dump()


def _run_post_checks(payload: AIProfileIntelligencePayload) -> None:
    """Apply scalar and list item rules beyond Pydantic type checks."""
    data = payload.model_dump()

    for field_name in _SCALAR_FIELDS:
        value = data[field_name]
        cleaned = clean_str(value)
        if isinstance(value, str) and value != "" and cleaned == "":
            logger.error(
                "{} post-check whitespace-only scalar field={}",
                _LOG_PREFIX,
                field_name,
            )
            raise ProfileIntelligenceValidationError(
                f"AI profile intelligence field {field_name!r} must not be whitespace-only"
            )
        if cleaned == "":
            logger.error(
                "{} post-check empty scalar field={}",
                _LOG_PREFIX,
                field_name,
            )
            raise ProfileIntelligenceValidationError(
                f"AI profile intelligence field {field_name!r} must not be empty"
            )
        if cleaned != value:
            logger.error(
                "{} post-check untrimmed scalar field={}",
                _LOG_PREFIX,
                field_name,
            )
            raise ProfileIntelligenceValidationError(
                f"AI profile intelligence field {field_name!r} must not contain "
                "leading or trailing whitespace"
            )

    for field_name in _LIST_FIELDS:
        items = data[field_name]
        if not isinstance(items, list):
            continue
        for index, item in enumerate(items):
            if not isinstance(item, str):
                logger.error(
                    "{} post-check list item not string field={} index={}",
                    _LOG_PREFIX,
                    field_name,
                    index,
                )
                raise ProfileIntelligenceValidationError(
                    f"AI profile intelligence field {field_name!r} items must be strings"
                )
            if clean_str(item) == "":
                logger.error(
                    "{} post-check empty list item field={} index={}",
                    _LOG_PREFIX,
                    field_name,
                    index,
                )
                raise ProfileIntelligenceValidationError(
                    f"AI profile intelligence field {field_name!r} "
                    f"contains an empty list item"
                )


def is_unknown_scalar(value: str) -> bool:
    """Return True when a scalar uses the sparse-profile sentinel."""
    return clean_str(value) == UNKNOWN_SENTINEL

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

    def __init__(self, message: str, *, validation_code: str = "validation_failed") -> None:
        super().__init__(message)
        self.validation_code = validation_code


def normalize_ai_profile_intelligence_raw(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Best-effort normalize LLM JSON before strict Pydantic validation.

    Strips strings, replaces empty scalars with ``Unknown``, drops empty list
    items, and ignores unexpected keys from the model.
    """
    normalized: dict[str, Any] = {}

    for field_name in _SCALAR_FIELDS:
        cleaned = clean_str(raw.get(field_name))
        normalized[field_name] = cleaned if cleaned else UNKNOWN_SENTINEL

    for field_name in _LIST_FIELDS:
        items = raw.get(field_name)
        if not isinstance(items, list):
            normalized[field_name] = []
            continue
        normalized[field_name] = [
            cleaned
            for item in items
            if isinstance(item, str) and (cleaned := clean_str(item))
        ]

    logger.debug(
        "{} normalize_ai_profile_intelligence_raw scalar_unknowns={} list_counts={}",
        _LOG_PREFIX,
        sum(1 for key in _SCALAR_FIELDS if normalized[key] == UNKNOWN_SENTINEL),
        {key: len(normalized[key]) for key in _LIST_FIELDS},
    )
    return normalized


def _first_pydantic_field_hint(exc: ValidationError) -> str:
    """Extract a concise field hint from a Pydantic validation error."""
    for error in exc.errors():
        loc = error.get("loc") or ()
        field = ".".join(str(part) for part in loc if part != "__root__")
        msg = error.get("msg", "invalid value")
        if field:
            return f"{field}: {msg}"
        return str(msg)
    return "schema validation failed"


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
        field_hint = _first_pydantic_field_hint(exc)
        logger.exception(
            "{} validate_ai_profile_intelligence_payload pydantic error hint={}: {}",
            _LOG_PREFIX,
            field_hint,
            exc,
        )
        raise ProfileIntelligenceValidationError(
            f"AI profile intelligence failed schema validation ({field_hint})",
            validation_code="schema_validation",
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
                f"AI profile intelligence field {field_name!r} must not be whitespace-only",
                validation_code="empty_scalar",
            )
        if cleaned == "":
            logger.error(
                "{} post-check empty scalar field={}",
                _LOG_PREFIX,
                field_name,
            )
            raise ProfileIntelligenceValidationError(
                f"AI profile intelligence field {field_name!r} must not be empty",
                validation_code="empty_scalar",
            )
        if cleaned != value:
            logger.error(
                "{} post-check untrimmed scalar field={}",
                _LOG_PREFIX,
                field_name,
            )
            raise ProfileIntelligenceValidationError(
                f"AI profile intelligence field {field_name!r} must not contain "
                "leading or trailing whitespace",
                validation_code="untrimmed_scalar",
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
                    f"AI profile intelligence field {field_name!r} items must be strings",
                    validation_code="invalid_list_item",
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
                    f"contains an empty list item",
                    validation_code="empty_list_item",
                )


def is_unknown_scalar(value: str) -> bool:
    """Return True when a scalar uses the sparse-profile sentinel."""
    return clean_str(value) == UNKNOWN_SENTINEL

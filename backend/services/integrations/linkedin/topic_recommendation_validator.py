"""
Phase 6 — pure topic recommendation validation (no LLM, no persistence).

Parses LLM output with Pydantic and applies post-checks before meta/id attachment.
"""

from __future__ import annotations

import uuid
from typing import Any

from loguru import logger
from pydantic import ValidationError

from services.integrations.linkedin.field_coercion import clean_str
from services.integrations.linkedin.topic_recommendation_types import (
    DEFAULT_TOPIC_RECOMMENDATION_MODEL,
    GROWTH_IMPACTS,
    RECOMMENDED_FORMATS,
    TOPIC_RECOMMENDATION_COUNT,
    TOPIC_RECOMMENDATION_SCHEMA_VERSION,
    StoredTopicRecommendations,
    TopicRecommendationItem,
    TopicRecommendationItemPayload,
    TopicRecommendationLLMResponse,
    TopicRecommendationMeta,
)

_LOG_PREFIX = "[TopicRecommendation]"

_ITEM_SCALAR_FIELDS: tuple[str, ...] = ("title", "why_this_fits")


class TopicRecommendationValidationError(Exception):
    """Raised when topic recommendation LLM output fails validation."""

    def __init__(self, message: str, *, validation_code: str = "validation_failed") -> None:
        super().__init__(message)
        self.validation_code = validation_code


def _normalize_recommended_format(value: Any) -> str:
    """Map common LLM format variants to allowed enum values."""
    if not isinstance(value, str):
        if value is None:
            logger.warning(
                "{} normalize recommended_format missing value — defaulting to LinkedIn Post",
                _LOG_PREFIX,
            )
            return "LinkedIn Post"
        cleaned_non_str = clean_str(value)
        if cleaned_non_str in RECOMMENDED_FORMATS:
            return cleaned_non_str
        logger.warning(
            "{} normalize recommended_format non-string value={} — defaulting to LinkedIn Post",
            _LOG_PREFIX,
            type(value).__name__,
        )
        return "LinkedIn Post"

    cleaned = clean_str(value)
    if cleaned in RECOMMENDED_FORMATS:
        return cleaned
    lower = cleaned.lower()
    if "article" in lower or "long-form" in lower or "longform" in lower or "blog" in lower:
        return "LinkedIn Article"
    if "post" in lower or "short" in lower or "update" in lower or "text" in lower:
        return "LinkedIn Post"
    if cleaned == "":
        logger.warning(
            "{} normalize recommended_format empty value — defaulting to LinkedIn Post",
            _LOG_PREFIX,
        )
        return "LinkedIn Post"

    logger.warning(
        "{} normalize recommended_format unrecognized value={!r} — defaulting to LinkedIn Post",
        _LOG_PREFIX,
        cleaned,
    )
    return "LinkedIn Post"


def _normalize_growth_impact(value: Any) -> str:
    """Map common LLM growth-impact variants to allowed enum values."""
    if not isinstance(value, str):
        if value is None:
            logger.warning(
                "{} normalize growth_impact missing value — defaulting to Medium",
                _LOG_PREFIX,
            )
            return "Medium"
        cleaned_non_str = clean_str(value)
        if cleaned_non_str in GROWTH_IMPACTS:
            return cleaned_non_str
        logger.warning(
            "{} normalize growth_impact non-string value={} — defaulting to Medium",
            _LOG_PREFIX,
            type(value).__name__,
        )
        return "Medium"

    cleaned = clean_str(value)
    if cleaned in GROWTH_IMPACTS:
        return cleaned
    lower = cleaned.lower()
    for impact in GROWTH_IMPACTS:
        if impact.lower() == lower:
            return impact
    if "high" in lower:
        return "High"
    if "low" in lower:
        return "Low"
    if "medium" in lower or "moderate" in lower:
        return "Medium"
    if cleaned == "":
        logger.warning(
            "{} normalize growth_impact empty value — defaulting to Medium",
            _LOG_PREFIX,
        )
        return "Medium"

    logger.warning(
        "{} normalize growth_impact unrecognized value={!r} — defaulting to Medium",
        _LOG_PREFIX,
        cleaned,
    )
    return "Medium"


def _normalize_recommendation_item(raw_item: Any) -> dict[str, Any]:
    """Best-effort normalize a single recommendation object."""
    if not isinstance(raw_item, dict):
        return {
            "title": "",
            "why_this_fits": "",
            "recommended_format": "",
            "target_audience": [],
            "growth_impact": "",
        }

    audience_raw = raw_item.get("target_audience")
    audience: list[str] = []
    if isinstance(audience_raw, list):
        audience = [
            cleaned
            for item in audience_raw
            if isinstance(item, str) and (cleaned := clean_str(item))
        ]

    return {
        "title": clean_str(raw_item.get("title")),
        "why_this_fits": clean_str(raw_item.get("why_this_fits")),
        "recommended_format": _normalize_recommended_format(raw_item.get("recommended_format")),
        "target_audience": audience,
        "growth_impact": _normalize_growth_impact(raw_item.get("growth_impact")),
    }


def normalize_topic_recommendation_raw(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Best-effort normalize LLM JSON before strict Pydantic validation.

    Strips strings, normalizes enum-like fields, filters empty audience labels,
    and drops unexpected keys.
    """
    recommendations_raw = raw.get("recommendations")
    if not isinstance(recommendations_raw, list):
        return {"recommendations": []}

    normalized_items = [_normalize_recommendation_item(item) for item in recommendations_raw]
    if len(normalized_items) > TOPIC_RECOMMENDATION_COUNT:
        logger.warning(
            "{} normalize_topic_recommendation_raw truncating count={} to {}",
            _LOG_PREFIX,
            len(normalized_items),
            TOPIC_RECOMMENDATION_COUNT,
        )
        normalized_items = normalized_items[:TOPIC_RECOMMENDATION_COUNT]

    logger.debug(
        "{} normalize_topic_recommendation_raw count={}",
        _LOG_PREFIX,
        len(normalized_items),
    )
    return {"recommendations": normalized_items}


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


def validate_topic_recommendation_payload(raw: Any) -> TopicRecommendationLLMResponse:
    """
    Validate raw LLM output into ``TopicRecommendationLLMResponse``.

    Applies Pydantic parsing (``extra='forbid'``) and deterministic post-checks.

    Args:
        raw: Parsed JSON object from the LLM

    Returns:
        Validated LLM response model

    Raises:
        TopicRecommendationValidationError: When parsing or post-checks fail
    """
    logger.info("{} validate_topic_recommendation_payload start", _LOG_PREFIX)

    if not isinstance(raw, dict):
        logger.error(
            "{} validate_topic_recommendation_payload not a dict type={}",
            _LOG_PREFIX,
            type(raw).__name__,
        )
        raise TopicRecommendationValidationError(
            "Topic recommendations must be a JSON object",
            validation_code="invalid_type",
        )

    raw = normalize_topic_recommendation_raw(raw)

    try:
        payload = TopicRecommendationLLMResponse.model_validate(raw)
    except ValidationError as exc:
        field_hint = _first_pydantic_field_hint(exc)
        logger.exception(
            "{} validate_topic_recommendation_payload pydantic error hint={}: {}",
            _LOG_PREFIX,
            field_hint,
            exc,
        )
        raise TopicRecommendationValidationError(
            f"Topic recommendations failed schema validation ({field_hint})",
            validation_code="schema_validation",
        ) from exc

    if len(payload.recommendations) != TOPIC_RECOMMENDATION_COUNT:
        logger.error(
            "{} validate_topic_recommendation_payload wrong count={} expected={}",
            _LOG_PREFIX,
            len(payload.recommendations),
            TOPIC_RECOMMENDATION_COUNT,
        )
        raise TopicRecommendationValidationError(
            f"Topic recommendations must contain exactly {TOPIC_RECOMMENDATION_COUNT} items",
            validation_code="wrong_count",
        )

    for index, item in enumerate(payload.recommendations):
        _run_item_post_checks(item, index=index)

    logger.info(
        "{} validate_topic_recommendation_payload ok count={}",
        _LOG_PREFIX,
        len(payload.recommendations),
    )
    return payload


def build_stored_topic_recommendations(
    payload: TopicRecommendationLLMResponse,
    *,
    intelligence_hash: str = "",
    model: str = DEFAULT_TOPIC_RECOMMENDATION_MODEL,
) -> dict[str, Any]:
    """
    Assign server-side ``id`` values, attach ``meta``, and return a persistence-ready dict.

    Args:
        payload: Validated LLM output
        intelligence_hash: Canonical hash of source ``AIProfileIntelligence``
        model: LLM model identifier used for generation

    Returns:
        Dict matching ``StoredTopicRecommendations`` shape
    """
    logger.info(
        "{} build_stored_topic_recommendations intelligence_hash={} model={} count={}",
        _LOG_PREFIX,
        intelligence_hash[:12] if intelligence_hash else None,
        model,
        len(payload.recommendations),
    )

    items_with_ids: list[TopicRecommendationItem] = []
    for index, item in enumerate(payload.recommendations):
        recommendation_id = str(uuid.uuid4())
        logger.debug(
            "{} assign recommendation id index={} id={}",
            _LOG_PREFIX,
            index,
            recommendation_id,
        )
        items_with_ids.append(
            TopicRecommendationItem(
                id=recommendation_id,
                **item.model_dump(),
            )
        )

    stored = StoredTopicRecommendations(
        meta=TopicRecommendationMeta(
            built_from_intelligence_hash=intelligence_hash,
            schema_version=TOPIC_RECOMMENDATION_SCHEMA_VERSION,
            model=model,
        ),
        recommendations=items_with_ids,
    )
    logger.info(
        "{} build_stored_topic_recommendations complete ids_assigned={}",
        _LOG_PREFIX,
        len(items_with_ids),
    )
    return stored.model_dump()


def extract_recommendations_list(stored: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Extract the recommendations array from a stored payload dict.

    Args:
        stored: Stored topic recommendations dict

    Returns:
        List of recommendation dicts with ``id`` fields
    """
    recommendations = stored.get("recommendations")
    if not isinstance(recommendations, list):
        logger.error(
            "{} extract_recommendations_list invalid recommendations type={}",
            _LOG_PREFIX,
            type(recommendations).__name__,
        )
        return []
    return [item for item in recommendations if isinstance(item, dict)]


def _run_item_post_checks(item: TopicRecommendationItemPayload, *, index: int) -> None:
    """Apply scalar and list item rules beyond Pydantic type checks."""
    data = item.model_dump()

    for field_name in _ITEM_SCALAR_FIELDS:
        value = data[field_name]
        cleaned = clean_str(value)
        if cleaned == "":
            logger.error(
                "{} post-check empty scalar field={} index={}",
                _LOG_PREFIX,
                field_name,
                index,
            )
            raise TopicRecommendationValidationError(
                f"Topic recommendation[{index}] field {field_name!r} must not be empty",
                validation_code="empty_scalar",
            )
        if cleaned != value:
            logger.error(
                "{} post-check untrimmed scalar field={} index={}",
                _LOG_PREFIX,
                field_name,
                index,
            )
            raise TopicRecommendationValidationError(
                f"Topic recommendation[{index}] field {field_name!r} must not contain "
                "leading or trailing whitespace",
                validation_code="untrimmed_scalar",
            )

    if data["recommended_format"] not in RECOMMENDED_FORMATS:
        logger.error(
            "{} post-check invalid recommended_format={} index={} allowed={}",
            _LOG_PREFIX,
            data["recommended_format"],
            index,
            RECOMMENDED_FORMATS,
        )
        raise TopicRecommendationValidationError(
            f"Topic recommendation[{index}] recommended_format is invalid",
            validation_code="invalid_format",
        )

    if data["growth_impact"] not in GROWTH_IMPACTS:
        logger.error(
            "{} post-check invalid growth_impact={} index={} allowed={}",
            _LOG_PREFIX,
            data["growth_impact"],
            index,
            GROWTH_IMPACTS,
        )
        raise TopicRecommendationValidationError(
            f"Topic recommendation[{index}] growth_impact is invalid",
            validation_code="invalid_growth_impact",
        )

    audience = data["target_audience"]
    if not audience:
        logger.error(
            "{} post-check empty target_audience index={}",
            _LOG_PREFIX,
            index,
        )
        raise TopicRecommendationValidationError(
            f"Topic recommendation[{index}] target_audience must not be empty",
            validation_code="empty_audience",
        )

    for audience_index, audience_item in enumerate(audience):
        if not isinstance(audience_item, str):
            logger.error(
                "{} post-check audience item not string index={} audience_index={}",
                _LOG_PREFIX,
                index,
                audience_index,
            )
            raise TopicRecommendationValidationError(
                f"Topic recommendation[{index}] target_audience items must be strings",
                validation_code="invalid_audience_item",
            )
        if clean_str(audience_item) == "":
            logger.error(
                "{} post-check empty audience item index={} audience_index={}",
                _LOG_PREFIX,
                index,
                audience_index,
            )
            raise TopicRecommendationValidationError(
                f"Topic recommendation[{index}] target_audience contains an empty item",
                validation_code="empty_audience_item",
            )

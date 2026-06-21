"""
Phase 7 — pure profile optimization validation (no LLM, no persistence).

Parses LLM output with Pydantic and applies post-checks before meta/id attachment.
"""

from __future__ import annotations

import uuid
from typing import Any

from loguru import logger
from pydantic import ValidationError

from services.integrations.linkedin.field_coercion import clean_str
from services.integrations.linkedin.profile_optimization_types import (
    DEFAULT_PROFILE_OPTIMIZATION_MODEL,
    OPTIMIZATION_EFFORTS,
    OPTIMIZATION_IMPACTS,
    PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE,
    PROFILE_OPTIMIZATION_BACKLOG_MAX,
    PROFILE_OPTIMIZATION_BACKLOG_MIN,
    PROFILE_OPTIMIZATION_LLM_BATCH_SIZE,
    PROFILE_OPTIMIZATION_SCHEMA_VERSION,
    PROFILE_SECTIONS,
    ProfileOptimizationBatchLLMResponse,
    ProfileOptimizationItem,
    ProfileOptimizationItemPayload,
    ProfileOptimizationLLMResponse,
    ProfileOptimizationMeta,
    StoredProfileOptimization,
)

_LOG_PREFIX = "[ProfileOptimization]"

VALIDATION_RETRY_USER_SUFFIX = (
    "\n\nPrevious response failed schema validation. "
    "Return valid JSON only matching the required schema exactly."
)

VALIDATION_RETRY_BATCH_SUFFIX = (
    "\n\nPrevious response failed schema validation. "
    f"Return valid JSON only with exactly {PROFILE_OPTIMIZATION_LLM_BATCH_SIZE} "
    "recommendations ranked by impact."
)

VALIDATION_RETRY_FULL_BACKLOG_SUFFIX = (
    "\n\nPrevious response failed schema validation. "
    f"Return valid JSON only with {PROFILE_OPTIMIZATION_BACKLOG_MIN} to "
    f"{PROFILE_OPTIMIZATION_BACKLOG_MAX} recommendations ranked by impact."
)

_ITEM_SCALAR_FIELDS: tuple[str, ...] = (
    "issue",
    "why_it_matters",
    "current_state_summary",
    "recommended_action",
)

_SECTIONS_REQUIRING_COPY: frozenset[str] = frozenset({"headline", "summary"})

_SECTION_ALIASES: dict[str, str] = {
    "about": "summary",
    "bio": "summary",
    "profile summary": "summary",
    "photo": "profile_photo",
    "profile picture": "profile_photo",
    "profile_picture": "profile_photo",
    "avatar": "profile_photo",
    "picture": "profile_photo",
    "custom url": "custom_url",
    "custom_url": "custom_url",
    "vanity_url": "custom_url",
    "vanity url": "custom_url",
    "url": "custom_url",
    "skill": "skills",
    "recommendation": "recommendations",
    "endorsement": "recommendations",
    "certification": "certifications",
    "education & certifications": "education",
    "featured section": "featured",
    "work experience": "experience",
    "job history": "experience",
}


class ProfileOptimizationValidationError(Exception):
    """Raised when profile optimization LLM output fails validation."""

    def __init__(self, message: str, *, validation_code: str = "validation_failed") -> None:
        super().__init__(message)
        self.validation_code = validation_code


def _normalize_profile_section(value: Any) -> str:
    """Map common LLM section variants to allowed ``profile_section`` values."""
    if not isinstance(value, str):
        if value is None:
            logger.warning(
                "{} normalize profile_section missing value — defaulting to summary",
                _LOG_PREFIX,
            )
            return "summary"
        cleaned_non_str = clean_str(value)
        if cleaned_non_str in PROFILE_SECTIONS:
            return cleaned_non_str
        logger.warning(
            "{} normalize profile_section non-string value={} — defaulting to summary",
            _LOG_PREFIX,
            type(value).__name__,
        )
        return "summary"

    cleaned = clean_str(value)
    if cleaned in PROFILE_SECTIONS:
        return cleaned

    lowered = cleaned.lower().replace("-", " ").replace("_", " ")
    alias_key = lowered.replace("  ", " ").strip()
    if alias_key in _SECTION_ALIASES:
        mapped = _SECTION_ALIASES[alias_key]
        logger.debug(
            "{} normalize profile_section alias mapped from={} to={}",
            _LOG_PREFIX,
            cleaned,
            mapped,
        )
        return mapped

    underscored = alias_key.replace(" ", "_")
    if underscored in PROFILE_SECTIONS:
        return underscored
    if underscored in _SECTION_ALIASES:
        return _SECTION_ALIASES[underscored]

    for section in PROFILE_SECTIONS:
        if section.replace("_", " ") == alias_key or section == underscored:
            return section

    if cleaned == "":
        logger.warning(
            "{} normalize profile_section empty value — defaulting to summary",
            _LOG_PREFIX,
        )
        return "summary"

    logger.warning(
        "{} normalize profile_section unrecognized value={!r} — defaulting to summary",
        _LOG_PREFIX,
        cleaned,
    )
    return "summary"


def _normalize_impact(value: Any) -> str:
    """Map common LLM impact variants to allowed enum values."""
    return _normalize_tri_state_enum(
        value,
        allowed=OPTIMIZATION_IMPACTS,
        field_name="impact",
        default="Medium",
    )


def _normalize_effort(value: Any) -> str:
    """Map common LLM effort variants to allowed enum values."""
    return _normalize_tri_state_enum(
        value,
        allowed=OPTIMIZATION_EFFORTS,
        field_name="effort",
        default="Medium",
    )


def _normalize_tri_state_enum(
    value: Any,
    *,
    allowed: tuple[str, ...],
    field_name: str,
    default: str,
) -> str:
    """Normalize High/Medium/Low-style enum fields."""
    if not isinstance(value, str):
        if value is None:
            logger.warning(
                "{} normalize {} missing value — defaulting to {}",
                _LOG_PREFIX,
                field_name,
                default,
            )
            return default
        cleaned_non_str = clean_str(value)
        if cleaned_non_str in allowed:
            return cleaned_non_str
        logger.warning(
            "{} normalize {} non-string value={} — defaulting to {}",
            _LOG_PREFIX,
            field_name,
            type(value).__name__,
            default,
        )
        return default

    cleaned = clean_str(value)
    if cleaned in allowed:
        return cleaned

    lower = cleaned.lower()
    for option in allowed:
        if option.lower() == lower:
            return option
    if "high" in lower:
        return "High"
    if "low" in lower:
        return "Low"
    if "medium" in lower or "moderate" in lower:
        return "Medium"
    if cleaned == "":
        logger.warning(
            "{} normalize {} empty value — defaulting to {}",
            _LOG_PREFIX,
            field_name,
            default,
        )
        return default

    logger.warning(
        "{} normalize {} unrecognized value={!r} — defaulting to {}",
        _LOG_PREFIX,
        field_name,
        cleaned,
        default,
    )
    return default


def _normalize_recommendation_item(raw_item: Any) -> dict[str, Any]:
    """Best-effort normalize a single profile optimization recommendation object."""
    if not isinstance(raw_item, dict):
        return {
            "profile_section": "",
            "issue": "",
            "why_it_matters": "",
            "current_state_summary": "",
            "recommended_action": "",
            "suggested_copy": "",
            "impact": "",
            "effort": "",
            "best_practice_ref": "",
            "completion_criteria": "",
        }

    return {
        "profile_section": _normalize_profile_section(raw_item.get("profile_section")),
        "issue": clean_str(raw_item.get("issue")),
        "why_it_matters": clean_str(raw_item.get("why_it_matters")),
        "current_state_summary": clean_str(raw_item.get("current_state_summary")),
        "recommended_action": clean_str(raw_item.get("recommended_action")),
        "suggested_copy": clean_str(raw_item.get("suggested_copy")),
        "impact": _normalize_impact(raw_item.get("impact")),
        "effort": _normalize_effort(raw_item.get("effort")),
        "best_practice_ref": clean_str(raw_item.get("best_practice_ref")),
        "completion_criteria": clean_str(raw_item.get("completion_criteria")),
    }


def normalize_profile_optimization_raw(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Best-effort normalize LLM JSON before strict Pydantic validation.

    Strips strings, normalizes enum-like fields, and drops unexpected keys.
    """
    recommendations_raw = raw.get("recommendations")
    if not isinstance(recommendations_raw, list):
        logger.warning(
            "{} normalize_profile_optimization_raw missing recommendations list",
            _LOG_PREFIX,
        )
        return {"recommendations": []}

    normalized_items = [_normalize_recommendation_item(item) for item in recommendations_raw]
    logger.debug(
        "{} normalize_profile_optimization_raw count={}",
        _LOG_PREFIX,
        len(normalized_items),
    )
    return {"recommendations": normalized_items}


def merge_profile_optimization_batches(batches: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Merge multiple normalized LLM batch payloads into one backlog dict.

    Used by the Step 4 service after multiple Gemini calls (Layer 2).
    """
    logger.info(
        "{} merge_profile_optimization_batches start batch_count={}",
        _LOG_PREFIX,
        len(batches),
    )
    merged_items: list[dict[str, Any]] = []
    for batch_index, batch in enumerate(batches):
        if not isinstance(batch, dict):
            logger.warning(
                "{} merge_profile_optimization_batches skipping non-dict batch_index={}",
                _LOG_PREFIX,
                batch_index,
            )
            continue
        normalized = normalize_profile_optimization_raw(batch)
        items = normalized.get("recommendations")
        if isinstance(items, list):
            merged_items.extend(item for item in items if isinstance(item, dict))

    logger.info(
        "{} merge_profile_optimization_batches complete merged_count={}",
        _LOG_PREFIX,
        len(merged_items),
    )
    return {"recommendations": merged_items}


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


def validate_profile_optimization_batch_payload(
    raw: Any,
) -> ProfileOptimizationBatchLLMResponse:
    """
    Validate a single Gemini batch (1–5 recommendations).

    Args:
        raw: Parsed JSON object from one LLM call

    Returns:
        Validated batch response model

    Raises:
        ProfileOptimizationValidationError: When parsing or post-checks fail
    """
    logger.info("{} validate_profile_optimization_batch_payload start", _LOG_PREFIX)

    if not isinstance(raw, dict):
        logger.error(
            "{} validate_profile_optimization_batch_payload not a dict type={}",
            _LOG_PREFIX,
            type(raw).__name__,
        )
        raise ProfileOptimizationValidationError(
            "Profile optimization batch must be a JSON object",
            validation_code="invalid_type",
        )

    raw = normalize_profile_optimization_raw(raw)

    try:
        payload = ProfileOptimizationBatchLLMResponse.model_validate(raw)
    except ValidationError as exc:
        field_hint = _first_pydantic_field_hint(exc)
        logger.exception(
            "{} validate_profile_optimization_batch_payload pydantic error hint={}: {}",
            _LOG_PREFIX,
            field_hint,
            exc,
        )
        raise ProfileOptimizationValidationError(
            f"Profile optimization batch failed schema validation ({field_hint})",
            validation_code="schema_validation",
        ) from exc

    if not payload.recommendations:
        logger.error("{} validate_profile_optimization_batch_payload empty batch", _LOG_PREFIX)
        raise ProfileOptimizationValidationError(
            "Profile optimization batch must contain at least one recommendation",
            validation_code="wrong_count",
        )

    if len(payload.recommendations) > PROFILE_OPTIMIZATION_LLM_BATCH_SIZE:
        logger.error(
            "{} validate_profile_optimization_batch_payload count={} exceeds max={}",
            _LOG_PREFIX,
            len(payload.recommendations),
            PROFILE_OPTIMIZATION_LLM_BATCH_SIZE,
        )
        raise ProfileOptimizationValidationError(
            f"Profile optimization batch must contain at most "
            f"{PROFILE_OPTIMIZATION_LLM_BATCH_SIZE} items",
            validation_code="wrong_count",
        )

    for index, item in enumerate(payload.recommendations):
        _run_item_post_checks(item, index=index)

    logger.info(
        "{} validate_profile_optimization_batch_payload ok count={}",
        _LOG_PREFIX,
        len(payload.recommendations),
    )
    return payload


def validate_profile_optimization_payload(raw: Any) -> ProfileOptimizationLLMResponse:
    """
    Validate merged LLM output into ``ProfileOptimizationLLMResponse``.

    Applies Pydantic parsing (``extra='forbid'``) and deterministic post-checks.
    Expects a full backlog of 10–15 items after batch merge (Layer 2).

    Args:
        raw: Parsed JSON object from merged LLM batches

    Returns:
        Validated full backlog response model

    Raises:
        ProfileOptimizationValidationError: When parsing or post-checks fail
    """
    logger.info("{} validate_profile_optimization_payload start", _LOG_PREFIX)

    if not isinstance(raw, dict):
        logger.error(
            "{} validate_profile_optimization_payload not a dict type={}",
            _LOG_PREFIX,
            type(raw).__name__,
        )
        raise ProfileOptimizationValidationError(
            "Profile optimization payload must be a JSON object",
            validation_code="invalid_type",
        )

    raw = normalize_profile_optimization_raw(raw)

    try:
        payload = ProfileOptimizationLLMResponse.model_validate(raw)
    except ValidationError as exc:
        field_hint = _first_pydantic_field_hint(exc)
        logger.exception(
            "{} validate_profile_optimization_payload pydantic error hint={}: {}",
            _LOG_PREFIX,
            field_hint,
            exc,
        )
        raise ProfileOptimizationValidationError(
            f"Profile optimization failed schema validation ({field_hint})",
            validation_code="schema_validation",
        ) from exc

    count = len(payload.recommendations)
    if count < PROFILE_OPTIMIZATION_BACKLOG_MIN or count > PROFILE_OPTIMIZATION_BACKLOG_MAX:
        logger.error(
            "{} validate_profile_optimization_payload wrong count={} expected={}-{}",
            _LOG_PREFIX,
            count,
            PROFILE_OPTIMIZATION_BACKLOG_MIN,
            PROFILE_OPTIMIZATION_BACKLOG_MAX,
        )
        raise ProfileOptimizationValidationError(
            f"Profile optimization must contain {PROFILE_OPTIMIZATION_BACKLOG_MIN} to "
            f"{PROFILE_OPTIMIZATION_BACKLOG_MAX} recommendations",
            validation_code="wrong_count",
        )

    for index, item in enumerate(payload.recommendations):
        _run_item_post_checks(item, index=index)

    logger.info(
        "{} validate_profile_optimization_payload ok count={}",
        _LOG_PREFIX,
        count,
    )
    return payload


def build_stored_profile_optimization(
    payload: ProfileOptimizationLLMResponse | ProfileOptimizationBatchLLMResponse,
    *,
    profile_context_hash: str = "",
    intelligence_hash: str = "",
    model: str = DEFAULT_PROFILE_OPTIMIZATION_MODEL,
) -> dict[str, Any]:
    """
    Assign server-side ``id`` values, split active/backlog batches, attach ``meta``.

    First ``PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE`` items become the active batch;
    remaining items are stored in ``backlog``.

    Args:
        payload: Validated LLM output (single batch or full merged backlog)
        profile_context_hash: Canonical hash of source profile context
        intelligence_hash: Canonical hash of source AI profile intelligence
        model: LLM model identifier used for generation

    Returns:
        Dict matching ``StoredProfileOptimization`` shape
    """
    total_count = len(payload.recommendations)
    logger.info(
        "{} build_stored_profile_optimization profile_context_hash={} "
        "intelligence_hash={} model={} total_count={}",
        _LOG_PREFIX,
        profile_context_hash[:12] if profile_context_hash else None,
        intelligence_hash[:12] if intelligence_hash else None,
        model,
        total_count,
    )

    items_with_ids: list[ProfileOptimizationItem] = []
    for index, item in enumerate(payload.recommendations):
        recommendation_id = str(uuid.uuid4())
        logger.debug(
            "{} assign optimization id index={} id={} section={}",
            _LOG_PREFIX,
            index,
            recommendation_id,
            item.profile_section,
        )
        items_with_ids.append(
            ProfileOptimizationItem(
                id=recommendation_id,
                **item.model_dump(),
            )
        )

    active_items = items_with_ids[:PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE]
    backlog_items = items_with_ids[PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE:]

    stored = StoredProfileOptimization(
        meta=ProfileOptimizationMeta(
            built_from_profile_context_hash=profile_context_hash,
            built_from_intelligence_hash=intelligence_hash,
            schema_version=PROFILE_OPTIMIZATION_SCHEMA_VERSION,
            model=model,
        ),
        recommendations=active_items,
        backlog=backlog_items,
    )
    logger.info(
        "{} build_stored_profile_optimization complete active_count={} backlog_count={}",
        _LOG_PREFIX,
        len(active_items),
        len(backlog_items),
    )
    return stored.model_dump()


def extract_active_recommendations_list(stored: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Extract the active recommendations array from a stored payload dict.

    Args:
        stored: Stored profile optimization dict

    Returns:
        List of active recommendation dicts with ``id`` fields
    """
    recommendations = stored.get("recommendations")
    if not isinstance(recommendations, list):
        logger.error(
            "{} extract_active_recommendations_list invalid recommendations type={}",
            _LOG_PREFIX,
            type(recommendations).__name__,
        )
        return []
    return [item for item in recommendations if isinstance(item, dict)]


def _run_item_post_checks(item: ProfileOptimizationItemPayload, *, index: int) -> None:
    """Apply scalar and section-specific rules beyond Pydantic type checks."""
    data = item.model_dump()

    if data["profile_section"] not in PROFILE_SECTIONS:
        logger.error(
            "{} post-check invalid profile_section={} index={} allowed={}",
            _LOG_PREFIX,
            data["profile_section"],
            index,
            PROFILE_SECTIONS,
        )
        raise ProfileOptimizationValidationError(
            f"Profile optimization[{index}] profile_section is invalid",
            validation_code="invalid_section",
        )

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
            raise ProfileOptimizationValidationError(
                f"Profile optimization[{index}] field {field_name!r} must not be empty",
                validation_code="empty_scalar",
            )
        if cleaned != value:
            logger.error(
                "{} post-check untrimmed scalar field={} index={}",
                _LOG_PREFIX,
                field_name,
                index,
            )
            raise ProfileOptimizationValidationError(
                f"Profile optimization[{index}] field {field_name!r} must not contain "
                "leading or trailing whitespace",
                validation_code="untrimmed_scalar",
            )

    if data["profile_section"] in _SECTIONS_REQUIRING_COPY:
        suggested_copy = clean_str(data["suggested_copy"])
        if suggested_copy == "":
            logger.error(
                "{} post-check missing suggested_copy section={} index={}",
                _LOG_PREFIX,
                data["profile_section"],
                index,
            )
            raise ProfileOptimizationValidationError(
                f"Profile optimization[{index}] suggested_copy is required for "
                f"{data['profile_section']!r} sections",
                validation_code="missing_suggested_copy",
            )

    if data["impact"] not in OPTIMIZATION_IMPACTS:
        logger.error(
            "{} post-check invalid impact={} index={}",
            _LOG_PREFIX,
            data["impact"],
            index,
            OPTIMIZATION_IMPACTS,
        )
        raise ProfileOptimizationValidationError(
            f"Profile optimization[{index}] impact is invalid",
            validation_code="invalid_impact",
        )

    if data["effort"] not in OPTIMIZATION_EFFORTS:
        logger.error(
            "{} post-check invalid effort={} index={}",
            _LOG_PREFIX,
            data["effort"],
            index,
            OPTIMIZATION_EFFORTS,
        )
        raise ProfileOptimizationValidationError(
            f"Profile optimization[{index}] effort is invalid",
            validation_code="invalid_effort",
        )

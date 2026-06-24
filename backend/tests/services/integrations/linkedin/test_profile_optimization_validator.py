"""Tests for Phase 7 profile optimization validator."""

from __future__ import annotations

import pytest

from services.integrations.linkedin.profile_optimization_types import (
    DEFAULT_PROFILE_OPTIMIZATION_MODEL,
    PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE,
    PROFILE_OPTIMIZATION_SCHEMA_VERSION,
)
from services.integrations.linkedin.profile_optimization_validator import (
    ProfileOptimizationValidationError,
    build_stored_profile_optimization,
    extract_active_recommendations_list,
    merge_profile_optimization_batches,
    normalize_profile_optimization_raw,
    validate_profile_optimization_batch_payload,
    validate_profile_optimization_payload,
)


def _valid_item(index: int, *, section: str = "experience") -> dict:
    item: dict = {
        "profile_section": section,
        "issue": f"Issue {index}",
        "why_it_matters": f"Why it matters {index}.",
        "current_state_summary": f"Current state {index}.",
        "recommended_action": f"Recommended action {index}.",
        "suggested_copy": "",
        "impact": "High",
        "effort": "Low",
        "best_practice_ref": "Enhancement Report §1.5",
        "completion_criteria": f"Done when {index} is fixed.",
    }
    if section in {"headline", "summary"}:
        item["suggested_copy"] = f"Suggested copy {index}."
    return item


def _valid_full_llm_response(count: int = 12) -> dict:
    sections = [
        "headline",
        "summary",
        "profile_photo",
        "custom_url",
        "experience",
        "skills",
        "recommendations",
        "education",
        "certifications",
        "featured",
        "experience",
        "skills",
    ]
    return {
        "recommendations": [
            _valid_item(i + 1, section=sections[i % len(sections)])
            for i in range(count)
        ]
    }


def _valid_batch_llm_response(count: int = 5) -> dict:
    sections = ["headline", "summary", "experience", "skills", "custom_url"]
    return {
        "recommendations": [
            _valid_item(i + 1, section=sections[i])
            for i in range(count)
        ]
    }


def test_valid_full_payload_passes_validation() -> None:
    payload = validate_profile_optimization_payload(_valid_full_llm_response(12))
    assert len(payload.recommendations) == 12
    assert payload.recommendations[0].profile_section == "headline"


def test_valid_batch_payload_passes_validation() -> None:
    payload = validate_profile_optimization_batch_payload(_valid_batch_llm_response())
    assert len(payload.recommendations) == 5


def test_wrong_full_count_rejected() -> None:
    raw = _valid_full_llm_response(5)
    with pytest.raises(ProfileOptimizationValidationError) as exc_info:
        validate_profile_optimization_payload(raw)
    assert exc_info.value.validation_code == "schema_validation"


def test_too_many_full_count_rejected() -> None:
    raw = _valid_full_llm_response(16)
    with pytest.raises(ProfileOptimizationValidationError) as exc_info:
        validate_profile_optimization_payload(raw)
    assert exc_info.value.validation_code == "schema_validation"


def test_unknown_section_normalized_via_alias() -> None:
    raw = _valid_batch_llm_response(1)
    raw["recommendations"][0]["profile_section"] = "about"
    raw["recommendations"][0]["suggested_copy"] = "Updated summary copy."
    payload = validate_profile_optimization_batch_payload(raw)
    assert payload.recommendations[0].profile_section == "summary"


def test_normalize_fixes_impact_and_effort_casing() -> None:
    raw = _valid_batch_llm_response(1)
    raw["recommendations"][0]["impact"] = "high"
    raw["recommendations"][0]["effort"] = "medium"
    normalized = normalize_profile_optimization_raw(raw)
    payload = validate_profile_optimization_batch_payload(normalized)
    assert payload.recommendations[0].impact == "High"
    assert payload.recommendations[0].effort == "Medium"


def test_empty_issue_rejected() -> None:
    raw = _valid_batch_llm_response(1)
    raw["recommendations"][0]["issue"] = ""
    with pytest.raises(ProfileOptimizationValidationError, match="must not be empty"):
        validate_profile_optimization_batch_payload(raw)


def test_missing_suggested_copy_for_headline_rejected() -> None:
    raw = _valid_batch_llm_response(1)
    raw["recommendations"][0]["profile_section"] = "headline"
    raw["recommendations"][0]["suggested_copy"] = ""
    with pytest.raises(ProfileOptimizationValidationError, match="suggested_copy"):
        validate_profile_optimization_batch_payload(raw)


def test_extra_top_level_keys_stripped_during_normalize() -> None:
    raw = _valid_batch_llm_response()
    raw["unexpected"] = True
    payload = validate_profile_optimization_batch_payload(raw)
    assert len(payload.recommendations) == 5


def test_non_object_input_rejected() -> None:
    with pytest.raises(ProfileOptimizationValidationError, match="JSON object"):
        validate_profile_optimization_payload(["not", "a", "dict"])


def test_build_stored_assigns_ids_and_splits_backlog() -> None:
    payload = validate_profile_optimization_payload(_valid_full_llm_response(12))
    stored = build_stored_profile_optimization(
        payload,
        profile_context_hash="ctx-hash-abc",
        intelligence_hash="intel-hash-xyz",
        model=DEFAULT_PROFILE_OPTIMIZATION_MODEL,
    )

    assert stored["meta"]["built_from_profile_context_hash"] == "ctx-hash-abc"
    assert stored["meta"]["built_from_intelligence_hash"] == "intel-hash-xyz"
    assert stored["meta"]["schema_version"] == PROFILE_OPTIMIZATION_SCHEMA_VERSION
    assert stored["meta"]["model"] == DEFAULT_PROFILE_OPTIMIZATION_MODEL
    assert len(stored["recommendations"]) == PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE
    assert len(stored["backlog"]) == 7

    active_ids = {item["id"] for item in stored["recommendations"]}
    backlog_ids = {item["id"] for item in stored["backlog"]}
    assert len(active_ids) == PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE
    assert len(backlog_ids) == 7
    assert active_ids.isdisjoint(backlog_ids)


def test_build_stored_single_batch_all_active() -> None:
    payload = validate_profile_optimization_batch_payload(_valid_batch_llm_response())
    stored = build_stored_profile_optimization(payload, profile_context_hash="ctx")

    assert len(stored["recommendations"]) == 5
    assert stored["backlog"] == []


def test_extract_active_recommendations_list() -> None:
    payload = validate_profile_optimization_batch_payload(_valid_batch_llm_response())
    stored = build_stored_profile_optimization(payload, profile_context_hash="ctx")
    extracted = extract_active_recommendations_list(stored)
    assert len(extracted) == 5
    assert extracted[0]["id"]


def test_merge_profile_optimization_batches() -> None:
    batch_one = _valid_batch_llm_response(5)
    batch_two = _valid_full_llm_response(7)
    merged = merge_profile_optimization_batches([batch_one, batch_two])
    assert len(merged["recommendations"]) == 12

    payload = validate_profile_optimization_payload(merged)
    assert len(payload.recommendations) == 12

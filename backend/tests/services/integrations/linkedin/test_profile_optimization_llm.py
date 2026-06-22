"""Tests for Phase 7 profile optimization prompt and LLM integration.

Tests the service-level LLM integration via get_or_generate_profile_optimization,
which uses llm_text_gen for subscription checking, usage tracking, and provider routing.
"""

from __future__ import annotations

import json

import pytest

from prompts.linkedin.profile_optimization_prompt import (
    PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
    build_profile_optimization_user_prompt,
)
from services.integrations.linkedin.profile_optimization_rubric import (
    detect_profile_optimization_gaps,
)
from services.integrations.linkedin.profile_optimization_service import (
    ProfileOptimizationLLMError,
    get_or_generate_profile_optimization,
)
from services.integrations.linkedin.profile_optimization_types import (
    DetectedGap,
    PROFILE_OPTIMIZATION_LLM_BATCH_SIZE,
    profile_optimization_gemini_json_schema,
    profile_optimization_json_schema,
)
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin.profile_validator import validate_profile_completeness


def _sample_context() -> dict:
    return {
        "personal_information": {
            "name": "Jane Doe",
            "headline": "Engineer",
            "about": "Short about",
        },
        "professional_information": {
            "skills": [],
            "skills_total_count": 5,
            "experience": [{"title": "Engineer", "company": "Acme", "description": ""}],
            "recommendations_received_count": 0,
            "recommendations": {"received": []},
            "education": [],
            "certifications": [],
            "projects": [],
        },
        "linkedin_information": {
            "profile_picture": "",
            "public_identifier": "",
            "profile_url": "",
        },
    }


def _sample_intelligence() -> dict:
    return {
        "professional_identity": "Software Engineer",
        "primary_expertise": ["Python"],
        "industry": "Software",
        "experience_level": "Senior",
        "knowledge_domains": ["Backend"],
        "writing_opportunities": ["Cloud"],
        "target_audience": ["Developers"],
        "communication_style": "Professional",
        "brand_positioning": "Technical leader",
        "summary": "Backend specialist",
    }


def test_user_prompt_includes_detected_gaps_and_snippets() -> None:
    context = _sample_context()
    validation = {
        "is_profile_complete": True,
        "missing_fields": [],
        "optional_missing_fields": [],
    }
    gaps = detect_profile_optimization_gaps(context, validation)
    user_prompt = build_profile_optimization_user_prompt(
        context,
        validation,
        gaps,
        _sample_intelligence(),
    )
    payload = json.loads(user_prompt)

    assert payload["detected_gaps"]
    assert payload["profile_field_snippets"]["headline"] == "Engineer"
    assert "ai_profile_intelligence" in payload
    assert "meta" not in payload["ai_profile_intelligence"]


def test_system_prompt_forbids_engagement_tactics() -> None:
    assert "posting frequency" in PROFILE_OPTIMIZATION_SYSTEM_PROMPT.lower()
    assert "profile advisor" in PROFILE_OPTIMIZATION_SYSTEM_PROMPT.lower()


def test_system_prompt_requests_single_batch_of_five() -> None:
    assert f"exactly {PROFILE_OPTIMIZATION_LLM_BATCH_SIZE} recommendations" in (
        PROFILE_OPTIMIZATION_SYSTEM_PROMPT
    )


def test_gemini_schema_is_lightweight_and_capped() -> None:
    gemini_schema = profile_optimization_gemini_json_schema()
    strict_schema = profile_optimization_json_schema()

    assert gemini_schema != strict_schema
    recs = gemini_schema["properties"]["recommendations"]
    assert recs["maxItems"] == PROFILE_OPTIMIZATION_LLM_BATCH_SIZE
    assert "minItems" not in recs

    items_schema = recs["items"]
    assert items_schema["type"] == "object"
    assert "enum" not in json.dumps(items_schema)

    strict_dump = json.dumps(strict_schema)
    assert "minItems" in strict_dump or "minLength" in strict_dump


def _complete_context() -> dict:
    """Create a complete profile context that passes validation."""
    from services.integrations.linkedin.profile_context_types import default_profile_context

    context = default_profile_context()
    context["personal_information"].update({
        "name": "Jane Doe",
        "first_name": "Jane",
        "last_name": "Doe",
        "headline": "Senior Engineer | Cloud | Python",
        "about": "Backend engineer with 8 years of experience.",
    })
    context["professional_information"].update({
        "job_title": "Senior Engineer",
        "company": "ACME Corp",
        "skills": [{"name": "Python", "endorsement_count": 5}],
        "skills_total_count": 1,
        "experience": [
            {"title": "Senior Engineer", "company": "ACME", "description": "Building APIs"}
        ],
    })
    context["linkedin_information"].update({
        "profile_picture": "https://example.com/pic.jpg",
        "public_identifier": "jane-doe",
        "profile_url": "https://linkedin.com/in/jane-doe",
    })
    return context


def test_service_uses_gemini_schema_via_mock(tmp_path) -> None:
    """Test that the service passes the correct schema to the LLM."""
    captured: dict = {}

    def mock_generate_fn(**kwargs: object) -> str:
        captured.update(kwargs)
        return json.dumps({
            "recommendations": [
                {
                    "profile_section": "headline",
                    "issue": "Test",
                    "why_it_matters": "Test",
                    "current_state_summary": "Test",
                    "recommended_action": "Test",
                    "suggested_copy": "Test",
                    "impact": "High",
                    "effort": "Low",
                    "best_practice_ref": "Test",
                    "completion_criteria": "Test",
                }
            ]
        })

    # Setup minimal repository
    db_file = tmp_path / "test.db"
    repo = ProfileRepository(db_path=str(db_file))
    repo.save_normalized_profile("test-user", "acc-1", {"name": "Test"})

    context = _complete_context()

    repo.save_profile_context("test-user", context)
    validation = validate_profile_completeness(context)

    # Call with mock generate_fn
    get_or_generate_profile_optimization(
        "test-user",
        context,
        validation,
        _sample_intelligence(),
        repository=repo,
        generate_fn=mock_generate_fn,
    )

    # Verify schema was passed
    assert "json_struct" in captured
    assert captured["json_struct"] == profile_optimization_gemini_json_schema()


def test_service_handles_json_string_response(tmp_path) -> None:
    """Test that the service correctly parses JSON string responses from llm_text_gen."""
    mock_response = {
        "recommendations": [
            {
                "profile_section": "headline",
                "issue": "Title only",
                "why_it_matters": "Headlines drive search visibility.",
                "current_state_summary": "Your headline is: Engineer",
                "recommended_action": "Expand headline with value proposition.",
                "suggested_copy": "Engineer | Cloud platforms | Python",
                "impact": "High",
                "effort": "Low",
                "best_practice_ref": "Enhancement Report §1.2",
                "completion_criteria": "Headline updated on LinkedIn",
            }
        ]
    }

    def mock_generate_fn(**kwargs: object) -> str:
        assert kwargs.get("system_prompt")
        assert kwargs.get("json_struct") == profile_optimization_gemini_json_schema()
        return json.dumps(mock_response)

    # Setup minimal repository
    db_file = tmp_path / "test.db"
    repo = ProfileRepository(db_path=str(db_file))
    repo.save_normalized_profile("test-user", "acc-1", {"name": "Test"})

    context = _complete_context()

    repo.save_profile_context("test-user", context)
    validation = validate_profile_completeness(context)

    result, meta = get_or_generate_profile_optimization(
        "test-user",
        context,
        validation,
        _sample_intelligence(),
        repository=repo,
        generate_fn=mock_generate_fn,
    )

    assert result is not None
    assert len(result) == 1
    assert result[0]["profile_section"] == "headline"


def test_service_invalid_json_raises_llm_error(tmp_path) -> None:
    """Test that invalid JSON responses raise ProfileOptimizationLLMError."""
    def mock_generate_fn(**kwargs: object) -> str:
        return "not-json"

    # Setup minimal repository
    db_file = tmp_path / "test.db"
    repo = ProfileRepository(db_path=str(db_file))
    repo.save_normalized_profile("test-user", "acc-1", {"name": "Test"})

    context = _complete_context()

    repo.save_profile_context("test-user", context)
    validation = validate_profile_completeness(context)

    with pytest.raises(ProfileOptimizationLLMError) as exc_info:
        get_or_generate_profile_optimization(
            "test-user",
            context,
            validation,
            _sample_intelligence(),
            repository=repo,
            generate_fn=mock_generate_fn,
        )
    assert exc_info.value.error_kind == "invalid_json"


def test_service_provider_error_mapped(tmp_path) -> None:
    """Test that provider errors are correctly classified."""
    def mock_generate_fn(**kwargs: object) -> None:
        raise RuntimeError("429 rate limit exceeded")

    # Setup minimal repository
    db_file = tmp_path / "test.db"
    repo = ProfileRepository(db_path=str(db_file))
    repo.save_normalized_profile("test-user", "acc-1", {"name": "Test"})

    context = _complete_context()

    repo.save_profile_context("test-user", context)
    validation = validate_profile_completeness(context)

    with pytest.raises(ProfileOptimizationLLMError) as exc_info:
        get_or_generate_profile_optimization(
            "test-user",
            context,
            validation,
            _sample_intelligence(),
            repository=repo,
            generate_fn=mock_generate_fn,
        )
    assert exc_info.value.error_kind == "quota_or_rate_limit"


def test_build_user_prompt_accepts_detected_gap_models() -> None:
    gap = DetectedGap(
        section="headline",
        severity="High",
        rule_id="headline_title_only",
        current_snippet="Engineer",
    )
    prompt = build_profile_optimization_user_prompt(
        _sample_context(),
        {"is_profile_complete": True, "missing_fields": []},
        [gap],
        _sample_intelligence(),
    )
    payload = json.loads(prompt)
    assert payload["detected_gaps"][0]["rule_id"] == "headline_title_only"

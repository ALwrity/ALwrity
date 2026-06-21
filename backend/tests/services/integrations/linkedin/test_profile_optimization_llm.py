"""Tests for Phase 7 profile optimization prompt and LLM adapter."""

from __future__ import annotations

import json

import pytest

from prompts.linkedin.profile_optimization_prompt import (
    PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
    build_profile_optimization_user_prompt,
)
from services.integrations.linkedin.profile_optimization_llm import (
    ProfileOptimizationLLMError,
    call_profile_optimization_llm,
)
from services.integrations.linkedin.profile_optimization_rubric import (
    detect_profile_optimization_gaps,
)
from services.integrations.linkedin.profile_optimization_types import (
    DetectedGap,
    PROFILE_OPTIMIZATION_LLM_BATCH_SIZE,
    profile_optimization_gemini_json_schema,
    profile_optimization_json_schema,
)


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


def test_call_profile_optimization_llm_uses_gemini_schema() -> None:
    captured: dict = {}

    def mock_generate_fn(**kwargs: object) -> dict:
        captured.update(kwargs)
        return {"recommendations": []}

    call_profile_optimization_llm(
        system_prompt=PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
        user_prompt="{}",
        generate_fn=mock_generate_fn,
    )
    assert captured["schema"] == profile_optimization_gemini_json_schema()


def test_call_profile_optimization_llm_with_mock_generate_fn() -> None:
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

    def mock_generate_fn(**kwargs: object) -> dict:
        assert kwargs.get("system_prompt")
        assert kwargs.get("schema") == profile_optimization_gemini_json_schema()
        return mock_response

    result = call_profile_optimization_llm(
        system_prompt=PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
        user_prompt='{"detected_gaps":[]}',
        user_id="user-1",
        generate_fn=mock_generate_fn,
    )
    assert result == mock_response


def test_call_profile_optimization_llm_invalid_json_raises() -> None:
    with pytest.raises(ProfileOptimizationLLMError) as exc_info:
        call_profile_optimization_llm(
            system_prompt=PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
            user_prompt="{}",
            generate_fn=lambda **kwargs: "not-json",
        )
    assert exc_info.value.error_kind == "invalid_json"


def test_call_profile_optimization_llm_provider_error_mapped() -> None:
    def mock_generate_fn(**kwargs: object) -> None:
        raise RuntimeError("429 rate limit exceeded")

    with pytest.raises(ProfileOptimizationLLMError) as exc_info:
        call_profile_optimization_llm(
            system_prompt=PROFILE_OPTIMIZATION_SYSTEM_PROMPT,
            user_prompt="{}",
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

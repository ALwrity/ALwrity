"""Tests for validate_step_data under the canonical 4-step onboarding model.

1=Connect Platforms (website), 2=Research, 3=Personalization (persona).
"Finish" (4) is handled by complete_onboarding, not this validator.
"""

from services.validation import validate_step_data


def test_step1_connect_validates_website_url():
    assert validate_step_data(1, {"website": "https://example.com"}) == []
    assert validate_step_data(1, {"website_url": "https://example.com"}) == []
    assert "Website URL is required" in validate_step_data(1, {})
    assert "Invalid website URL format" in validate_step_data(1, {"website": "not-a-url"})


def test_step2_research_validates_research_fields():
    assert validate_step_data(2, {"competitors": ["https://a.com"]}) == []
    assert validate_step_data(2, {"researchSummary": "x"}) == []
    assert validate_step_data(2, {"sitemapAnalysis": {"pages": 1}}) == []
    assert validate_step_data(2, {}) != []


def test_step3_personalization_validates_persona():
    assert (
        validate_step_data(
            3, {"corePersona": {"identity": {}}, "platformPersonas": {"linkedin": {}}}
        )
        == []
    )
    assert validate_step_data(3, {}) != []
    # corePersona present but missing identity is invalid
    errors = validate_step_data(
        3, {"corePersona": {"foo": "bar"}, "platformPersonas": {"linkedin": {}}}
    )
    assert any("identity" in e for e in errors)


def test_finish_and_unknown_steps_have_no_validation():
    assert validate_step_data(4, {}) == []
    assert validate_step_data(5, {}) == []
    assert validate_step_data(6, {}) == []

"""Tests for Phase 7 profile optimization rubric."""

from __future__ import annotations

from services.integrations.linkedin.profile_optimization_rubric import (
    detect_profile_optimization_gaps,
)


def _base_context(**overrides: object) -> dict:
    context: dict = {
        "personal_information": {
            "first_name": "Jane",
            "last_name": "Doe",
            "name": "Jane Doe",
            "headline": (
                "Senior Engineer | Building cloud platforms | Python & AWS | "
                "Helping teams ship reliable software"
            ),
            "about": (
                "I help engineering teams deliver scalable products. "
                "Connect with me to discuss platform strategy and cloud architecture. "
                "Reach out at jane@example.com for collaborations."
            ),
            "location": "San Francisco",
        },
        "professional_information": {
            "job_title": "Senior Engineer",
            "company": "Acme",
            "industry": "Software",
            "skills": [{"name": f"Skill {index}", "endorsement_count": 1} for index in range(35)],
            "skills_total_count": 35,
            "experience": [
                {
                    "title": "Senior Engineer",
                    "company": "Acme",
                    "description": "Reduced latency by 40% and saved $2M annually.",
                }
            ],
            "experience_total_count": 1,
            "education": [{"school": "State University", "degree": "BSc Computer Science"}],
            "education_total_count": 1,
            "certifications": [{"name": "AWS Solutions Architect"}],
            "certifications_total_count": 1,
            "projects": [{"title": "Open Source Toolkit"}],
            "projects_total_count": 1,
            "recommendations_received_count": 2,
            "recommendations": {"given": [], "received": [{}, {}]},
        },
        "linkedin_information": {
            "profile_picture": "https://example.com/photo.jpg",
            "public_identifier": "jane-doe",
            "profile_url": "https://linkedin.com/in/jane-doe",
        },
    }
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(context.get(key), dict):
            context[key] = {**context[key], **value}
        else:
            context[key] = value
    return context


def _complete_validation() -> dict:
    return {
        "is_profile_complete": True,
        "completeness_score": 100,
        "missing_fields": [],
        "optional_missing_fields": [],
    }


def test_title_only_headline_detects_gap() -> None:
    context = _base_context(
        personal_information={
            "headline": "Software Engineer",
            "about": _base_context()["personal_information"]["about"],
        }
    )
    gaps = detect_profile_optimization_gaps(context, _complete_validation())
    rule_ids = {gap.rule_id for gap in gaps}
    assert "headline_title_only" in rule_ids


def test_strong_profile_has_fewer_gaps() -> None:
    gaps = detect_profile_optimization_gaps(_base_context(), _complete_validation())
    assert len(gaps) <= 2


def test_validation_missing_fields_create_gaps() -> None:
    validation = {
        "is_profile_complete": False,
        "missing_fields": ["headline", "about"],
        "optional_missing_fields": ["profile_picture"],
    }
    gaps = detect_profile_optimization_gaps(_base_context(), validation)
    rule_ids = [gap.rule_id for gap in gaps]
    assert rule_ids.count("validation_missing_required") == 2
    assert "validation_missing_optional" in rule_ids


def test_custom_url_missing_detected() -> None:
    context = _base_context(
        linkedin_information={
            "profile_picture": "https://example.com/photo.jpg",
            "public_identifier": "",
            "profile_url": "",
        }
    )
    gaps = detect_profile_optimization_gaps(context, _complete_validation())
    assert any(gap.rule_id == "custom_url_missing" for gap in gaps)


def test_gaps_sorted_by_severity() -> None:
    context = _base_context(
        personal_information={"headline": "", "about": ""},
        linkedin_information={"profile_picture": ""},
    )
    validation = {
        "is_profile_complete": False,
        "missing_fields": ["headline"],
        "optional_missing_fields": ["profile_picture"],
    }
    gaps = detect_profile_optimization_gaps(context, validation)
    severities = [gap.severity for gap in gaps]
    rank = {"High": 0, "Medium": 1, "Low": 2}
    assert len(severities) >= 2
    for index in range(len(severities) - 1):
        assert rank[severities[index]] <= rank[severities[index + 1]]

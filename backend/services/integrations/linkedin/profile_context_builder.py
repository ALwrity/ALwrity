"""
Phase 2 — Profile Context Builder (pure transform).

Maps Phase 1 flat normalized profile → grouped ``LinkedInProfileContext``.
No DB, HTTP, or Unipile calls.
"""

from __future__ import annotations

from typing import Any

from loguru import logger

from services.integrations.linkedin.field_coercion import (
    clean_str,
    coerce_bool,
    coerce_int,
    coerce_list,
)
from services.integrations.linkedin.profile_context_types import (
    ProfileContextBuildError,
    default_profile_context,
    default_primary_locale,
    validate_profile_context,
)

_LOG_PREFIX = "[LinkedInProfileContext]"


def build_profile_context(
    normalized_profile: dict[str, Any],
    *,
    content_hash: str = "",
) -> dict[str, Any]:
    """
    Map Phase 1 flat normalized profile → ``LinkedInProfileContext``.

    Missing normalized fields become empty defaults; never raises on sparse input.
    Raises ``ProfileContextBuildError`` only when ``normalized_profile`` is not a dict.

    Args:
        normalized_profile: Phase 1 normalized ALwrity profile dict
        content_hash: Optional Phase 1 hash stored in context meta

    Returns:
        Structurally complete profile context dict
    """
    if not isinstance(normalized_profile, dict):
        logger.error(
            "{} build_profile_context invalid input type={}",
            _LOG_PREFIX,
            type(normalized_profile).__name__,
        )
        raise ProfileContextBuildError(
            f"normalized profile must be a dict, got {type(normalized_profile).__name__}"
        )

    logger.info("{} build_profile_context start", _LOG_PREFIX)

    context = default_profile_context(content_hash=content_hash)
    context["personal_information"] = _build_personal_information(normalized_profile)
    context["professional_information"] = _build_professional_information(normalized_profile)
    context["linkedin_information"] = _build_linkedin_information(normalized_profile)

    professional = context["professional_information"]
    logger.info(
        "{} build_profile_context complete name={!r} experience_count={} "
        "education_count={} skills_count={}",
        _LOG_PREFIX,
        context["personal_information"].get("name"),
        len(professional.get("experience", [])),
        len(professional.get("education", [])),
        len(professional.get("skills", [])),
    )

    validation_errors = validate_profile_context(context)
    if validation_errors:
        logger.error(
            "{} built profile context failed validation: {}",
            _LOG_PREFIX,
            validation_errors,
        )
        raise ProfileContextBuildError(
            "built profile context failed structural validation: "
            + "; ".join(validation_errors)
        )

    return context


def _build_personal_information(profile: dict[str, Any]) -> dict[str, Any]:
    """Map normalized personal fields into ``personal_information``."""
    logger.info("{} normalizing personal_information", _LOG_PREFIX)
    return {
        "first_name": clean_str(profile.get("first_name")),
        "last_name": clean_str(profile.get("last_name")),
        "name": clean_str(profile.get("name")),
        "headline": clean_str(profile.get("headline")),
        "about": clean_str(profile.get("about")),
        "location": clean_str(profile.get("location")),
    }


def _build_professional_information(profile: dict[str, Any]) -> dict[str, Any]:
    """Map normalized professional fields into ``professional_information``."""
    logger.info("{} normalizing professional_information", _LOG_PREFIX)

    skills, skills_total = _normalize_skills_section(profile)
    experience, experience_total = _normalize_experience_section(profile)
    education, education_total = _normalize_education_section(profile)
    languages, languages_total = _normalize_languages_section(profile)
    certifications, certifications_total = _normalize_object_list_section(
        profile,
        list_key="certifications",
        total_key="certifications_total_count",
    )
    projects, projects_total = _normalize_object_list_section(
        profile,
        list_key="projects",
        total_key="projects_total_count",
    )
    volunteering, volunteering_total = _normalize_object_list_section(
        profile,
        list_key="volunteering_experience",
        total_key="volunteering_experience_total_count",
    )
    recommendations, given_count, received_count = _normalize_recommendations_section(
        profile
    )

    return {
        "job_title": clean_str(profile.get("job_title")),
        "company": clean_str(profile.get("company")),
        "industry": clean_str(profile.get("industry")),
        "skills": skills,
        "skills_total_count": skills_total,
        "experience": experience,
        "experience_total_count": experience_total,
        "education": education,
        "education_total_count": education_total,
        "languages": languages,
        "languages_total_count": languages_total,
        "certifications": certifications,
        "certifications_total_count": certifications_total,
        "projects": projects,
        "projects_total_count": projects_total,
        "volunteering_experience": volunteering,
        "volunteering_experience_total_count": volunteering_total,
        "recommendations": recommendations,
        "recommendations_given_count": given_count,
        "recommendations_received_count": received_count,
    }


def _build_linkedin_information(profile: dict[str, Any]) -> dict[str, Any]:
    """Map normalized LinkedIn platform fields into ``linkedin_information``."""
    logger.info("{} normalizing linkedin_information", _LOG_PREFIX)
    return {
        "followers": coerce_int(profile.get("followers")),
        "connections": coerce_int(profile.get("connections")),
        "creator_mode": coerce_bool(profile.get("creator_mode")),
        "is_premium": coerce_bool(profile.get("is_premium")),
        "is_influencer": coerce_bool(profile.get("is_influencer")),
        "is_open_profile": coerce_bool(profile.get("is_open_profile")),
        "is_self": coerce_bool(profile.get("is_self"), default=True),
        "profile_url": clean_str(profile.get("profile_url")),
        "profile_picture": clean_str(profile.get("profile_picture")),
        "background_picture": clean_str(profile.get("background_picture")),
        "websites": _normalize_string_list(profile.get("websites")),
        "hashtags": _normalize_string_list(profile.get("hashtags")),
        "primary_locale": _normalize_primary_locale_section(profile.get("primary_locale")),
        "public_identifier": clean_str(profile.get("public_identifier")),
        "provider_id": clean_str(profile.get("provider_id")),
        "member_urn": clean_str(profile.get("member_urn")),
    }


def _normalize_string_list(value: Any) -> list[str]:
    """Coerce a list of values to trimmed non-empty strings."""
    return [
        cleaned
        for item in coerce_list(value)
        if (cleaned := clean_str(item))
    ]


def _normalize_primary_locale_section(value: Any) -> dict[str, str]:
    """Normalize primary locale from Phase 1 shape."""
    locale = default_primary_locale()
    if not isinstance(value, dict):
        return locale
    locale["country"] = clean_str(value.get("country"))
    locale["language"] = clean_str(value.get("language"))
    return locale


def _normalize_skills_section(profile: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    """Defensively normalize skills from Phase 1 normalized profile."""
    items = coerce_list(profile.get("skills"))
    total = coerce_int(profile.get("skills_total_count"), default=len(items))
    skills: list[dict[str, Any]] = []

    for item in items:
        if isinstance(item, str):
            name = clean_str(item)
            if name:
                skills.append({"name": name, "endorsement_count": 0})
            continue
        if not isinstance(item, dict):
            continue
        name = clean_str(item.get("name"))
        if not name:
            continue
        skills.append(
            {
                "name": name,
                "endorsement_count": coerce_int(item.get("endorsement_count")),
            }
        )

    if not total and skills:
        total = len(skills)
    return skills, total


def _normalize_experience_section(
    profile: dict[str, Any],
) -> tuple[list[dict[str, Any]], int]:
    """Defensively normalize experience from Phase 1 normalized profile."""
    items = coerce_list(profile.get("experience"))
    total = coerce_int(
        profile.get("work_experience_total_count"),
        default=len(items),
    )
    experience: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        end_value = item.get("end")
        role_skills = _normalize_string_list(item.get("skills"))
        experience.append(
            {
                "title": clean_str(item.get("title")),
                "company": clean_str(item.get("company")),
                "company_id": clean_str(item.get("company_id")),
                "company_picture_url": clean_str(item.get("company_picture_url")),
                "start": clean_str(item.get("start")),
                "end": None if end_value is None else clean_str(end_value),
                "location": clean_str(item.get("location")),
                "description": clean_str(item.get("description")),
                "skills": role_skills,
            }
        )

    if not total and experience:
        total = len(experience)
    return experience, total


def _normalize_education_section(
    profile: dict[str, Any],
) -> tuple[list[dict[str, Any]], int]:
    """Defensively normalize education from Phase 1 normalized profile."""
    items = coerce_list(profile.get("education"))
    total = coerce_int(profile.get("education_total_count"), default=len(items))
    education: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        end_value = item.get("end")
        start_value = item.get("start")
        education.append(
            {
                "school": clean_str(item.get("school")),
                "school_id": clean_str(item.get("school_id")),
                "school_picture_url": clean_str(item.get("school_picture_url")),
                "degree": clean_str(item.get("degree")),
                "start": clean_str(start_value),
                "end": clean_str(end_value),
            }
        )

    if not total and education:
        total = len(education)
    return education, total


def _normalize_languages_section(
    profile: dict[str, Any],
) -> tuple[list[dict[str, Any]], int]:
    """Defensively normalize languages from Phase 1 normalized profile."""
    items = coerce_list(profile.get("languages"))
    total = coerce_int(profile.get("languages_total_count"), default=len(items))
    languages: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        name = clean_str(item.get("name"))
        if not name:
            continue
        languages.append(
            {
                "name": name,
                "proficiency": clean_str(item.get("proficiency")),
            }
        )

    if not total and languages:
        total = len(languages)
    return languages, total


def _normalize_object_list_section(
    profile: dict[str, Any],
    *,
    list_key: str,
    total_key: str,
) -> tuple[list[dict[str, Any]], int]:
    """Defensively normalize list-of-dict sections (certifications, projects, etc.)."""
    items = coerce_list(profile.get(list_key))
    total = coerce_int(profile.get(total_key), default=len(items))
    normalized: list[dict[str, Any]] = []
    for item in items:
        if isinstance(item, dict):
            normalized.append(dict(item))
    if not total and normalized:
        total = len(normalized)
    return normalized, total


def _normalize_recommendation_actor(actor: Any) -> dict[str, str]:
    """Normalize recommendation actor sub-object."""
    if not isinstance(actor, dict):
        return {
            "first_name": "",
            "last_name": "",
            "headline": "",
            "public_profile_url": "",
            "profile_picture_url": "",
        }
    return {
        "first_name": clean_str(actor.get("first_name")),
        "last_name": clean_str(actor.get("last_name")),
        "headline": clean_str(actor.get("headline")),
        "public_profile_url": clean_str(
            actor.get("public_profile_url") or actor.get("profile_url")
        ),
        "profile_picture_url": clean_str(actor.get("profile_picture_url")),
    }


def _normalize_recommendation_entries(items: Any) -> list[dict[str, Any]]:
    """Normalize given/received recommendation lists."""
    entries: list[dict[str, Any]] = []
    for item in coerce_list(items):
        if not isinstance(item, dict):
            continue
        entries.append(
            {
                "caption": clean_str(item.get("caption")),
                "text": clean_str(item.get("text")),
                "actor": _normalize_recommendation_actor(item.get("actor")),
            }
        )
    return entries


def _normalize_recommendations_section(
    profile: dict[str, Any],
) -> tuple[dict[str, Any], int, int]:
    """Defensively normalize recommendations from Phase 1 normalized profile."""
    recs = profile.get("recommendations")
    if not isinstance(recs, dict):
        given_count = coerce_int(profile.get("recommendations_given_count"))
        received_count = coerce_int(profile.get("recommendations_received_count"))
        return {"given": [], "received": []}, given_count, received_count

    given = _normalize_recommendation_entries(recs.get("given"))
    received = _normalize_recommendation_entries(recs.get("received"))
    given_count = coerce_int(
        profile.get("recommendations_given_count"),
        default=coerce_int(recs.get("given_total_count"), default=len(given)),
    )
    received_count = coerce_int(
        profile.get("recommendations_received_count"),
        default=coerce_int(recs.get("received_total_count"), default=len(received)),
    )
    return {"given": given, "received": received}, given_count, received_count

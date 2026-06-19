"""
LinkedIn profile acquisition service — Phase 1 (fetch + normalize + cache).

Maps Unipile AccountOwnerProfile / UserProfile payloads to ALwrity's normalized
profile shape for Phases 2–6. Orchestrates cache-first acquire via ProfileRepository.
"""

from __future__ import annotations

from typing import Any, Optional, TypedDict

from loguru import logger

from services.integrations.linkedin.field_coercion import (
    clean_str as _clean_str,
    coerce_bool as _coerce_bool,
    coerce_int as _coerce_int,
    coerce_list as _coerce_list,
)
# Backward compatibility: ``_clean_str`` / ``_coerce_*`` were historically defined in
# this module. They remain importable here; new code should use ``field_coercion`` directly.
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import avatar_url_from_user_profile
from services.integrations.linkedin.unipile_provider import (
    UnipileProvider,
    unipile_display_name_from_item,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService


class ProfileMeta(TypedDict):
    """Metadata returned alongside a normalized profile."""

    source: str
    fetched_at: Optional[str]
    profile_content_hash: Optional[str]


async def fetch_linkedin_profile(
    user_id: str,
    *,
    provider: Optional[UnipileProvider] = None,
    linkedin_sections: str = "*",
) -> dict[str, Any]:
    """
    Fetch raw Unipile UserProfile for the connected user (no cache, no normalize).

    Args:
        user_id: ALwrity user ID (Clerk)
        provider: Optional UnipileProvider instance (for testing)
        linkedin_sections: Unipile sections query for step 2

    Returns:
        Raw Unipile UserProfile dictionary
    """
    logger.info("[LinkedInProfile] fetch_linkedin_profile user_id={}", user_id)
    unipile = provider or UnipileProvider()
    raw = await unipile.fetch_own_linkedin_profile(
        user_id,
        linkedin_sections=linkedin_sections,
    )
    if not isinstance(raw, dict):
        raise TypeError(f"Expected dict UserProfile, got {type(raw).__name__}")
    logger.info(
        "[LinkedInProfile] UserProfile fetched is_self={} "
        "work_experience_total_count={} skills_total_count={}",
        raw.get("is_self"),
        raw.get("work_experience_total_count"),
        raw.get("skills_total_count"),
    )
    return raw


async def get_or_fetch_profile(
    user_id: str,
    *,
    refresh: bool = False,
    provider: Optional[UnipileProvider] = None,
    repository: Optional[ProfileRepository] = None,
    oauth: Optional[LinkedInOAuthService] = None,
    linkedin_sections: str = "*",
) -> tuple[dict[str, Any], ProfileMeta]:
    """
    Cache-first orchestrator: return normalized profile and acquisition metadata.

    Cache hit (no Unipile HTTP) when a row exists, ``unipile_account_id`` matches,
    and ``refresh`` is False. Otherwise fetches from Unipile, normalizes, and persists.

    Args:
        user_id: ALwrity user ID (Clerk)
        refresh: Force Unipile fetch and DB update
        provider: Optional UnipileProvider (for testing)
        repository: Optional ProfileRepository (for testing)
        oauth: Optional LinkedInOAuthService (for testing)
        linkedin_sections: Unipile sections query for step 2

    Returns:
        Tuple of (normalized profile dict, meta dict with source/cache fields)

    Raises:
        LinkedInNotConnectedError: When user has no connected Unipile account
    """
    logger.info(
        "[LinkedInProfile] get_or_fetch_profile user_id={} refresh={}",
        user_id,
        refresh,
    )
    oauth_service = oauth or LinkedInOAuthService()
    repo = repository or ProfileRepository(oauth=oauth_service)
    unipile = provider or UnipileProvider(oauth_service=oauth_service)

    creds = oauth_service.resolve_credentials(user_id)
    account_id = creds.unipile_account_id
    if not account_id:
        raise LinkedInNotConnectedError(
            "No Unipile LinkedIn account connected. "
            "Connect via hosted OAuth before fetching profile."
        )

    if not refresh:
        row = repo.get_analysis_row(user_id)
        cached = repo.get_normalized_profile(user_id, row=row) if row else None
        if (
            row
            and cached
            and row.get("unipile_account_id") == account_id
            and row.get("normalized_profile_json")
        ):
            meta: ProfileMeta = {
                "source": "cache",
                "fetched_at": row.get("fetched_at"),
                "profile_content_hash": row.get("profile_content_hash"),
            }
            logger.info(
                "[LinkedInProfile] get_or_fetch_profile source=cache user_id={} "
                "fetched_at={}",
                user_id,
                meta["fetched_at"],
            )
            return cached, meta

        if row and row.get("unipile_account_id") != account_id:
            logger.info(
                "[LinkedInProfile] unipile_account_id changed — cache stale user_id={}",
                user_id,
            )

    logger.info(
        "[LinkedInProfile] Calling Unipile GET /users/me linkedin_sections={} "
        "(step 2 only)",
        linkedin_sections,
    )
    raw = await fetch_linkedin_profile(
        user_id,
        provider=unipile,
        linkedin_sections=linkedin_sections,
    )
    normalized = normalize_unipile_profile(
        raw,
        stored_account_name=creds.account_name,
    )
    content_hash = repo.save_normalized_profile(
        user_id,
        account_id,
        normalized,
        raw=raw,
    )
    row = repo.get_analysis_row(user_id)
    meta = {
        "source": "unipile",
        "fetched_at": row.get("fetched_at") if row else None,
        "profile_content_hash": content_hash,
    }
    logger.info(
        "[LinkedInProfile] get_or_fetch_profile source=unipile user_id={} "
        "fetched_at={}",
        user_id,
        meta["fetched_at"],
    )
    return normalized, meta


# Top-level keys on the Phase 1 normalized profile (API-safe output).
NORMALIZED_PROFILE_KEYS: frozenset[str] = frozenset(
    {
        "first_name",
        "last_name",
        "name",
        "headline",
        "about",
        "job_title",
        "company",
        "location",
        "provider_id",
        "public_identifier",
        "member_urn",
        "primary_locale",
        "is_open_profile",
        "is_premium",
        "is_influencer",
        "creator_mode",
        "is_self",
        "websites",
        "hashtags",
        "followers",
        "connections",
        "profile_url",
        "profile_picture",
        "background_picture",
        "skills_total_count",
        "skills",
        "work_experience_total_count",
        "experience",
        "education_total_count",
        "education",
        "languages_total_count",
        "languages",
        "certifications_total_count",
        "certifications",
        "volunteering_experience_total_count",
        "volunteering_experience",
        "projects_total_count",
        "projects",
        "recommendations_given_count",
        "recommendations_received_count",
        "recommendations",
    }
)

# Raw Unipile keys that must not appear on normalized output.
FORBIDDEN_RAW_KEYS: frozenset[str] = frozenset(
    {
        "object",
        "provider",
        "summary",
        "work_experience",
        "follower_count",
        "connections_count",
        "profile_picture_url",
        "profile_picture_url_large",
        "background_picture_url",
        "is_creator",
        "entity_urn",
        "object_urn",
        "premium",
        "open_profile",
    }
)


def _normalize_primary_locale(raw: dict[str, Any]) -> dict[str, str]:
    """Map Unipile primary_locale to ALwrity shape."""
    locale = raw.get("primary_locale")
    if not isinstance(locale, dict):
        return {"country": "", "language": ""}
    return {
        "country": _clean_str(locale.get("country")),
        "language": _clean_str(locale.get("language")),
    }


def _normalize_experience(raw: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    """Map work_experience[] to experience[] plus total count."""
    items = _coerce_list(raw.get("work_experience"))
    total = _coerce_int(raw.get("work_experience_total_count"), default=len(items))
    experience: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        role_skills = _coerce_list(item.get("skills"))
        normalized_skills = [
            _clean_str(skill) if isinstance(skill, str) else _clean_str(skill.get("name"))
            for skill in role_skills
            if (isinstance(skill, str) and skill.strip())
            or (isinstance(skill, dict) and _clean_str(skill.get("name")))
        ]
        end_value = item.get("end")
        experience.append(
            {
                "title": _clean_str(item.get("position")),
                "company": _clean_str(item.get("company")),
                "company_id": _clean_str(item.get("company_id")),
                "company_picture_url": _clean_str(item.get("company_picture_url")),
                "start": _clean_str(item.get("start")),
                "end": end_value if end_value is None else _clean_str(end_value),
                "location": _clean_str(item.get("location")),
                "description": _clean_str(item.get("description")),
                "skills": normalized_skills,
            }
        )

    if not total and experience:
        total = len(experience)
    return experience, total


def _derive_current_role(
    experience: list[dict[str, Any]],
) -> tuple[str, str]:
    """Return job_title and company from the first current role (end is null)."""
    for role in experience:
        if role.get("end") is None:
            return _clean_str(role.get("title")), _clean_str(role.get("company"))
    if experience:
        first = experience[0]
        return _clean_str(first.get("title")), _clean_str(first.get("company"))
    return "", ""


def _normalize_education(raw: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    """Map education[] plus total count."""
    items = _coerce_list(raw.get("education"))
    total = _coerce_int(raw.get("education_total_count"), default=len(items))
    education: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        end_value = item.get("end")
        start_value = item.get("start")
        education.append(
            {
                "school": _clean_str(item.get("school")),
                "school_id": _clean_str(item.get("school_id")),
                "school_picture_url": _clean_str(item.get("school_picture_url")),
                "degree": _clean_str(item.get("degree")),
                "start": "" if start_value is None else _clean_str(start_value),
                "end": "" if end_value is None else _clean_str(end_value),
            }
        )

    if not total and education:
        total = len(education)
    return education, total


def _normalize_skills(raw: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    """Map skills[] to {name, endorsement_count} entries."""
    items = _coerce_list(raw.get("skills"))
    total = _coerce_int(raw.get("skills_total_count"), default=len(items))
    skills: list[dict[str, Any]] = []

    for item in items:
        if isinstance(item, str):
            name = _clean_str(item)
            if name:
                skills.append({"name": name, "endorsement_count": 0})
            continue
        if not isinstance(item, dict):
            continue
        name = _clean_str(item.get("name"))
        if not name:
            continue
        skills.append(
            {
                "name": name,
                "endorsement_count": _coerce_int(item.get("endorsement_count")),
            }
        )

    if not total and skills:
        total = len(skills)
    return skills, total


def _normalize_languages(raw: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    """Map languages[] to {name, proficiency}."""
    items = _coerce_list(raw.get("languages"))
    total = _coerce_int(raw.get("languages_total_count"), default=len(items))
    languages: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        name = _clean_str(item.get("name"))
        if not name:
            continue
        languages.append(
            {
                "name": name,
                "proficiency": _clean_str(item.get("proficiency")),
            }
        )

    if not total and languages:
        total = len(languages)
    return languages, total


def _normalize_object_list(raw: dict[str, Any], key: str, total_key: str) -> tuple[list[dict[str, Any]], int]:
    """Pass through list-of-dict sections (certifications, projects, volunteering)."""
    items = _coerce_list(raw.get(key))
    total = _coerce_int(raw.get(total_key), default=len(items))
    normalized: list[dict[str, Any]] = []
    for item in items:
        if isinstance(item, dict):
            normalized.append({k: v for k, v in item.items()})
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
        "first_name": _clean_str(actor.get("first_name")),
        "last_name": _clean_str(actor.get("last_name")),
        "headline": _clean_str(actor.get("headline")),
        "public_profile_url": _clean_str(
            actor.get("public_profile_url") or actor.get("profile_url")
        ),
        "profile_picture_url": _clean_str(actor.get("profile_picture_url")),
    }


def _normalize_recommendation_entries(items: Any) -> list[dict[str, Any]]:
    """Normalize given/received recommendation lists."""
    entries: list[dict[str, Any]] = []
    for item in _coerce_list(items):
        if not isinstance(item, dict):
            continue
        entries.append(
            {
                "caption": _clean_str(item.get("caption")),
                "text": _clean_str(item.get("text")),
                "actor": _normalize_recommendation_actor(item.get("actor")),
            }
        )
    return entries


def _normalize_recommendations(raw: dict[str, Any]) -> tuple[dict[str, Any], int, int]:
    """Map recommendations object and counts."""
    recs = raw.get("recommendations")
    if not isinstance(recs, dict):
        return {"given": [], "received": []}, 0, 0

    given = _normalize_recommendation_entries(recs.get("given"))
    received = _normalize_recommendation_entries(recs.get("received"))
    given_count = _coerce_int(recs.get("given_total_count"), default=len(given))
    received_count = _coerce_int(recs.get("received_total_count"), default=len(received))
    return {"given": given, "received": received}, given_count, received_count


def _resolve_profile_url(raw: dict[str, Any]) -> str:
    """Build LinkedIn profile URL from public_profile_url or public_identifier."""
    direct = _clean_str(raw.get("public_profile_url"))
    if direct.startswith("http"):
        return direct
    public_id = _clean_str(raw.get("public_identifier"))
    if public_id:
        return f"https://www.linkedin.com/in/{public_id}"
    return ""


def _resolve_is_self(raw: dict[str, Any]) -> bool:
    """
    Resolve is_self for normalized own-profile output.

    AccountOwnerProfile (/users/me) does not include is_self; treat as True.
    """
    if raw.get("is_self") is True:
        return True
    if raw.get("is_self") is False:
        return False
    if raw.get("object") == "AccountOwnerProfile":
        return True
    return True


def normalize_unipile_profile(
    raw: dict[str, Any],
    *,
    stored_account_name: Optional[str] = None,
) -> dict[str, Any]:
    """
    Convert a Unipile own-profile payload to ALwrity's normalized profile shape.

    Accepts ``AccountOwnerProfile`` (GET /users/me) and enriched ``UserProfile``
    payloads. Never includes raw Unipile-only keys in the result.

    Args:
        raw: Raw dict from fetch_own_linkedin_profile (UserProfile) or fixture
        stored_account_name: Optional fallback display name from linkedin_oauth_tokens

    Returns:
        Normalized profile dict matching Phase 1 response model
    """
    if not isinstance(raw, dict):
        logger.warning("[LinkedInProfile] normalize_unipile_profile received non-dict input")
        raw = {}

    logger.info("[LinkedInProfile] Normalizing Unipile profile object={!r}", raw.get("object"))

    experience, work_total = _normalize_experience(raw)
    job_title, company = _derive_current_role(experience)
    education, education_total = _normalize_education(raw)
    skills, skills_total = _normalize_skills(raw)
    languages, languages_total = _normalize_languages(raw)
    certifications, certifications_total = _normalize_object_list(
        raw, "certifications", "certifications_total_count"
    )
    volunteering, volunteering_total = _normalize_object_list(
        raw, "volunteering_experience", "volunteering_experience_total_count"
    )
    projects, projects_total = _normalize_object_list(raw, "projects", "projects_total_count")
    recommendations, rec_given, rec_received = _normalize_recommendations(raw)

    first_name = _clean_str(raw.get("first_name"))
    last_name = _clean_str(raw.get("last_name"))
    name = unipile_display_name_from_item(
        raw,
        user_id="",
        stored_account_name=stored_account_name,
    )
    if not name:
        name = f"{first_name} {last_name}".strip()

    profile_picture = avatar_url_from_user_profile(raw) or ""

    normalized: dict[str, Any] = {
        "first_name": first_name,
        "last_name": last_name,
        "name": name,
        "headline": _clean_str(raw.get("headline")),
        "about": _clean_str(raw.get("summary")),
        "job_title": job_title,
        "company": company,
        "location": _clean_str(raw.get("location")),
        "provider_id": _clean_str(raw.get("provider_id")),
        "public_identifier": _clean_str(raw.get("public_identifier")),
        "member_urn": _clean_str(
            raw.get("member_urn") or raw.get("object_urn") or raw.get("entity_urn")
        ),
        "primary_locale": _normalize_primary_locale(raw),
        "is_open_profile": _coerce_bool(raw.get("is_open_profile", raw.get("open_profile"))),
        "is_premium": _coerce_bool(raw.get("is_premium", raw.get("premium"))),
        "is_influencer": _coerce_bool(raw.get("is_influencer")),
        "creator_mode": _coerce_bool(raw.get("is_creator")),
        "is_self": _resolve_is_self(raw),
        "websites": [
            _clean_str(url)
            for url in _coerce_list(raw.get("websites"))
            if _clean_str(url)
        ],
        "hashtags": [
            _clean_str(tag)
            for tag in _coerce_list(raw.get("hashtags"))
            if _clean_str(tag)
        ],
        "followers": _coerce_int(raw.get("follower_count")),
        "connections": _coerce_int(raw.get("connections_count")),
        "profile_url": _resolve_profile_url(raw),
        "profile_picture": profile_picture,
        "background_picture": _clean_str(
            raw.get("background_picture_url") or raw.get("background_picture")
        ),
        "skills_total_count": skills_total,
        "skills": skills,
        "work_experience_total_count": work_total,
        "experience": experience,
        "education_total_count": education_total,
        "education": education,
        "languages_total_count": languages_total,
        "languages": languages,
        "certifications_total_count": certifications_total,
        "certifications": certifications,
        "volunteering_experience_total_count": volunteering_total,
        "volunteering_experience": volunteering,
        "projects_total_count": projects_total,
        "projects": projects,
        "recommendations_given_count": rec_given,
        "recommendations_received_count": rec_received,
        "recommendations": recommendations,
    }

    logger.info(
        "[LinkedInProfile] Normalized profile name={!r} experience_count={} "
        "education_count={} skills_count={}",
        normalized.get("name"),
        len(normalized.get("experience", [])),
        len(normalized.get("education", [])),
        len(normalized.get("skills", [])),
    )
    return normalized


def validate_normalized_profile(profile: dict[str, Any]) -> list[str]:
    """
    Validate Step 1.2 gate: normalized output shape and no raw Unipile leakage.

    Returns:
        List of error messages (empty when valid).
    """
    errors: list[str] = []

    if not isinstance(profile, dict):
        return ["normalized profile must be a dict"]

    keys = set(profile.keys())
    missing = NORMALIZED_PROFILE_KEYS - keys
    extra = keys - NORMALIZED_PROFILE_KEYS
    if missing:
        errors.append(f"missing normalized keys: {sorted(missing)}")
    if extra:
        errors.append(f"unexpected extra keys: {sorted(extra)}")

    leaked = keys & FORBIDDEN_RAW_KEYS
    if leaked:
        errors.append(f"raw Unipile keys leaked into output: {sorted(leaked)}")

    for list_key in (
        "skills",
        "experience",
        "education",
        "languages",
        "websites",
        "hashtags",
        "certifications",
        "volunteering_experience",
        "projects",
    ):
        if not isinstance(profile.get(list_key), list):
            errors.append(f"{list_key} must be a list")

    recs = profile.get("recommendations")
    if not isinstance(recs, dict):
        errors.append("recommendations must be a dict")
    elif not isinstance(recs.get("given"), list) or not isinstance(recs.get("received"), list):
        errors.append("recommendations.given and recommendations.received must be lists")

    locale = profile.get("primary_locale")
    if not isinstance(locale, dict):
        errors.append("primary_locale must be a dict")
    elif set(locale.keys()) != {"country", "language"}:
        errors.append("primary_locale must contain country and language only")

    for int_key in (
        "followers",
        "connections",
        "skills_total_count",
        "work_experience_total_count",
        "education_total_count",
        "languages_total_count",
        "certifications_total_count",
        "volunteering_experience_total_count",
        "projects_total_count",
        "recommendations_given_count",
        "recommendations_received_count",
    ):
        if not isinstance(profile.get(int_key), int):
            errors.append(f"{int_key} must be an int")

    for bool_key in (
        "is_open_profile",
        "is_premium",
        "is_influencer",
        "creator_mode",
        "is_self",
    ):
        if not isinstance(profile.get(bool_key), bool):
            errors.append(f"{bool_key} must be a bool")

    return errors

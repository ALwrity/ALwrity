"""
Phase 2–3 — LinkedIn Profile Context types, field contracts, and validation.

Phase 2: ``LinkedInProfileContext`` shape, normalization→context mapping,
structural gate validation (Step 2.1).

Phase 3: completeness validation types, field registries, and predicates (Step 3.1).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Literal, Optional, TypedDict

from services.integrations.linkedin.field_coercion import clean_str

# Bump when ``LinkedInProfileContext`` top-level or nested keys change.
PROFILE_CONTEXT_SCHEMA_VERSION = 1

ProfileContextSource = Literal["cache", "built"]


class ProfileContextBuildError(Exception):
    """Raised when profile context cannot be built from normalized input."""


class PrimaryLocaleContext(TypedDict):
    country: str
    language: str


class ProfileSkillContext(TypedDict):
    name: str
    endorsement_count: int


class ProfileExperienceContext(TypedDict):
    title: str
    company: str
    company_id: str
    company_picture_url: str
    start: str
    end: Optional[str]
    location: str
    description: str
    skills: list[str]


class ProfileEducationContext(TypedDict):
    school: str
    school_id: str
    school_picture_url: str
    degree: str
    start: str
    end: str


class ProfileLanguageContext(TypedDict):
    name: str
    proficiency: str


class RecommendationActorContext(TypedDict):
    first_name: str
    last_name: str
    headline: str
    public_profile_url: str
    profile_picture_url: str


class RecommendationEntryContext(TypedDict):
    caption: str
    text: str
    actor: RecommendationActorContext


class ProfileRecommendationsContext(TypedDict):
    given: list[RecommendationEntryContext]
    received: list[RecommendationEntryContext]


class PersonalInformationContext(TypedDict):
    first_name: str
    last_name: str
    name: str
    headline: str
    about: str
    location: str


class ProfessionalInformationContext(TypedDict):
    job_title: str
    company: str
    industry: str
    skills: list[ProfileSkillContext]
    skills_total_count: int
    experience: list[ProfileExperienceContext]
    experience_total_count: int
    education: list[ProfileEducationContext]
    education_total_count: int
    languages: list[ProfileLanguageContext]
    languages_total_count: int
    certifications: list[dict[str, Any]]
    certifications_total_count: int
    projects: list[dict[str, Any]]
    projects_total_count: int
    volunteering_experience: list[dict[str, Any]]
    volunteering_experience_total_count: int
    recommendations: ProfileRecommendationsContext
    recommendations_given_count: int
    recommendations_received_count: int


class LinkedInInformationContext(TypedDict):
    followers: int
    connections: int
    creator_mode: bool
    is_premium: bool
    is_influencer: bool
    is_open_profile: bool
    is_self: bool
    profile_url: str
    profile_picture: str
    background_picture: str
    websites: list[str]
    hashtags: list[str]
    primary_locale: PrimaryLocaleContext
    public_identifier: str
    provider_id: str
    member_urn: str


class ProfileContextMeta(TypedDict):
    built_from_profile_content_hash: str
    schema_version: int


class LinkedInProfileContext(TypedDict):
    personal_information: PersonalInformationContext
    professional_information: ProfessionalInformationContext
    linkedin_information: LinkedInInformationContext
    meta: ProfileContextMeta


class ProfileContextMetaResponse(TypedDict, total=False):
    """Orchestration metadata returned alongside profile context."""

    source: ProfileContextSource
    profile_context_updated_at: Optional[str]


class ProfileContextAcquireMeta(TypedDict):
    """Metadata returned by ``get_or_build_profile_context`` (Step 2.4)."""

    source: ProfileContextSource
    profile_context_updated_at: Optional[str]


# Bump when ``ProfileValidationResult`` top-level or nested keys change.
PROFILE_VALIDATION_SCHEMA_VERSION = 1

# Required scalar checks (5) + composite professional_background (1).
COMPLETENESS_SCORING_UNIT_COUNT = 6

ProfileValidationSource = Literal["cache", "validated"]


class ProfileValidationError(Exception):
    """Raised when profile context cannot be validated (invalid input shape)."""


class ProfileValidationMeta(TypedDict):
    """Embedded metadata on persisted ``ProfileValidationResult``."""

    built_from_profile_content_hash: str
    schema_version: int
    validated_at: str


class ProfileValidationResult(TypedDict):
    """Semantic completeness output consumed by Phase 4+."""

    is_profile_complete: bool
    completeness_score: int
    missing_fields: list[str]
    optional_missing_fields: list[str]
    supplemental_fields: list[str]
    meta: ProfileValidationMeta


class ProfileValidationAcquireMeta(TypedDict):
    """Metadata returned by ``get_or_validate_profile_context`` (Step 3.4)."""

    source: ProfileValidationSource
    validated_at: Optional[str]


PROFILE_VALIDATION_RESULT_KEYS: frozenset[str] = frozenset(
    {
        "is_profile_complete",
        "completeness_score",
        "missing_fields",
        "optional_missing_fields",
        "supplemental_fields",
        "meta",
    }
)

PROFILE_VALIDATION_META_KEYS: frozenset[str] = frozenset(
    {
        "built_from_profile_content_hash",
        "schema_version",
        "validated_at",
    }
)

# Top-level keys on LinkedInProfileContext (Step 2.1 gate).
PROFILE_CONTEXT_KEYS: frozenset[str] = frozenset(
    {
        "personal_information",
        "professional_information",
        "linkedin_information",
        "meta",
    }
)

PERSONAL_INFORMATION_KEYS: frozenset[str] = frozenset(
    {
        "first_name",
        "last_name",
        "name",
        "headline",
        "about",
        "location",
    }
)

PROFESSIONAL_INFORMATION_KEYS: frozenset[str] = frozenset(
    {
        "job_title",
        "company",
        "industry",
        "skills",
        "skills_total_count",
        "experience",
        "experience_total_count",
        "education",
        "education_total_count",
        "languages",
        "languages_total_count",
        "certifications",
        "certifications_total_count",
        "projects",
        "projects_total_count",
        "volunteering_experience",
        "volunteering_experience_total_count",
        "recommendations",
        "recommendations_given_count",
        "recommendations_received_count",
    }
)

LINKEDIN_INFORMATION_KEYS: frozenset[str] = frozenset(
    {
        "followers",
        "connections",
        "creator_mode",
        "is_premium",
        "is_influencer",
        "is_open_profile",
        "is_self",
        "profile_url",
        "profile_picture",
        "background_picture",
        "websites",
        "hashtags",
        "primary_locale",
        "public_identifier",
        "provider_id",
        "member_urn",
    }
)

PROFILE_CONTEXT_META_KEYS: frozenset[str] = frozenset(
    {
        "built_from_profile_content_hash",
        "schema_version",
    }
)

PRIMARY_LOCALE_KEYS: frozenset[str] = frozenset({"country", "language"})

RECOMMENDATIONS_KEYS: frozenset[str] = frozenset({"given", "received"})

# Phase 1 normalized key → (section, field) on LinkedInProfileContext.
# ``industry`` and ``meta.*`` are not sourced from normalized profile keys.
NORMALIZED_TO_PROFILE_CONTEXT_MAP: dict[str, tuple[str, str]] = {
    "first_name": ("personal_information", "first_name"),
    "last_name": ("personal_information", "last_name"),
    "name": ("personal_information", "name"),
    "headline": ("personal_information", "headline"),
    "about": ("personal_information", "about"),
    "location": ("personal_information", "location"),
    "job_title": ("professional_information", "job_title"),
    "company": ("professional_information", "company"),
    "skills": ("professional_information", "skills"),
    "skills_total_count": ("professional_information", "skills_total_count"),
    "experience": ("professional_information", "experience"),
    "work_experience_total_count": (
        "professional_information",
        "experience_total_count",
    ),
    "education": ("professional_information", "education"),
    "education_total_count": ("professional_information", "education_total_count"),
    "languages": ("professional_information", "languages"),
    "languages_total_count": ("professional_information", "languages_total_count"),
    "certifications": ("professional_information", "certifications"),
    "certifications_total_count": (
        "professional_information",
        "certifications_total_count",
    ),
    "projects": ("professional_information", "projects"),
    "projects_total_count": ("professional_information", "projects_total_count"),
    "volunteering_experience": (
        "professional_information",
        "volunteering_experience",
    ),
    "volunteering_experience_total_count": (
        "professional_information",
        "volunteering_experience_total_count",
    ),
    "recommendations": ("professional_information", "recommendations"),
    "recommendations_given_count": (
        "professional_information",
        "recommendations_given_count",
    ),
    "recommendations_received_count": (
        "professional_information",
        "recommendations_received_count",
    ),
    "followers": ("linkedin_information", "followers"),
    "connections": ("linkedin_information", "connections"),
    "creator_mode": ("linkedin_information", "creator_mode"),
    "is_premium": ("linkedin_information", "is_premium"),
    "is_influencer": ("linkedin_information", "is_influencer"),
    "is_open_profile": ("linkedin_information", "is_open_profile"),
    "is_self": ("linkedin_information", "is_self"),
    "profile_url": ("linkedin_information", "profile_url"),
    "profile_picture": ("linkedin_information", "profile_picture"),
    "background_picture": ("linkedin_information", "background_picture"),
    "websites": ("linkedin_information", "websites"),
    "hashtags": ("linkedin_information", "hashtags"),
    "primary_locale": ("linkedin_information", "primary_locale"),
    "public_identifier": ("linkedin_information", "public_identifier"),
    "provider_id": ("linkedin_information", "provider_id"),
    "member_urn": ("linkedin_information", "member_urn"),
}


def default_primary_locale() -> PrimaryLocaleContext:
    """Return empty primary locale."""
    return {"country": "", "language": ""}


def default_recommendations() -> ProfileRecommendationsContext:
    """Return empty recommendations container."""
    return {"given": [], "received": []}


def default_personal_information() -> PersonalInformationContext:
    """Return empty personal information section."""
    return {
        "first_name": "",
        "last_name": "",
        "name": "",
        "headline": "",
        "about": "",
        "location": "",
    }


def default_professional_information() -> ProfessionalInformationContext:
    """Return empty professional information section."""
    return {
        "job_title": "",
        "company": "",
        "industry": "",
        "skills": [],
        "skills_total_count": 0,
        "experience": [],
        "experience_total_count": 0,
        "education": [],
        "education_total_count": 0,
        "languages": [],
        "languages_total_count": 0,
        "certifications": [],
        "certifications_total_count": 0,
        "projects": [],
        "projects_total_count": 0,
        "volunteering_experience": [],
        "volunteering_experience_total_count": 0,
        "recommendations": default_recommendations(),
        "recommendations_given_count": 0,
        "recommendations_received_count": 0,
    }


def default_linkedin_information() -> LinkedInInformationContext:
    """Return empty LinkedIn platform metadata section."""
    return {
        "followers": 0,
        "connections": 0,
        "creator_mode": False,
        "is_premium": False,
        "is_influencer": False,
        "is_open_profile": False,
        "is_self": True,
        "profile_url": "",
        "profile_picture": "",
        "background_picture": "",
        "websites": [],
        "hashtags": [],
        "primary_locale": default_primary_locale(),
        "public_identifier": "",
        "provider_id": "",
        "member_urn": "",
    }


def default_profile_context_meta(
    *,
    content_hash: str = "",
) -> ProfileContextMeta:
    """Return profile context meta with schema version."""
    return {
        "built_from_profile_content_hash": content_hash,
        "schema_version": PROFILE_CONTEXT_SCHEMA_VERSION,
    }


def default_profile_context(
    *,
    content_hash: str = "",
) -> dict[str, Any]:
    """
    Return a structurally complete ``LinkedInProfileContext`` with empty defaults.

    Args:
        content_hash: Optional Phase 1 ``profile_content_hash`` for meta linkage

    Returns:
        Dict matching ``PROFILE_CONTEXT_KEYS`` and nested key contracts
    """
    return {
        "personal_information": default_personal_information(),
        "professional_information": default_professional_information(),
        "linkedin_information": default_linkedin_information(),
        "meta": default_profile_context_meta(content_hash=content_hash),
    }


def validate_profile_context(context: dict[str, Any]) -> list[str]:
    """
    Validate Step 2.1 gate: profile context shape matches ``PROFILE_CONTEXT_KEYS``.

    Args:
        context: Candidate ``LinkedInProfileContext`` dict

    Returns:
        List of error messages (empty when valid)
    """
    errors: list[str] = []

    if not isinstance(context, dict):
        return ["profile context must be a dict"]

    keys = set(context.keys())
    missing = PROFILE_CONTEXT_KEYS - keys
    extra = keys - PROFILE_CONTEXT_KEYS
    if missing:
        errors.append(f"missing profile context keys: {sorted(missing)}")
    if extra:
        errors.append(f"unexpected extra keys: {sorted(extra)}")

    personal = context.get("personal_information")
    if not isinstance(personal, dict):
        errors.append("personal_information must be a dict")
    else:
        personal_keys = set(personal.keys())
        personal_missing = PERSONAL_INFORMATION_KEYS - personal_keys
        personal_extra = personal_keys - PERSONAL_INFORMATION_KEYS
        if personal_missing:
            errors.append(
                f"missing personal_information keys: {sorted(personal_missing)}"
            )
        if personal_extra:
            errors.append(
                f"unexpected personal_information keys: {sorted(personal_extra)}"
            )

    professional = context.get("professional_information")
    if not isinstance(professional, dict):
        errors.append("professional_information must be a dict")
    else:
        prof_keys = set(professional.keys())
        prof_missing = PROFESSIONAL_INFORMATION_KEYS - prof_keys
        prof_extra = prof_keys - PROFESSIONAL_INFORMATION_KEYS
        if prof_missing:
            errors.append(
                f"missing professional_information keys: {sorted(prof_missing)}"
            )
        if prof_extra:
            errors.append(
                f"unexpected professional_information keys: {sorted(prof_extra)}"
            )

        for list_key in (
            "skills",
            "experience",
            "education",
            "languages",
            "certifications",
            "projects",
            "volunteering_experience",
        ):
            if not isinstance(professional.get(list_key), list):
                errors.append(f"professional_information.{list_key} must be a list")

        recs = professional.get("recommendations")
        if not isinstance(recs, dict):
            errors.append("professional_information.recommendations must be a dict")
        else:
            rec_keys = set(recs.keys())
            if rec_keys != RECOMMENDATIONS_KEYS:
                errors.append(
                    "professional_information.recommendations must contain "
                    "given and received only"
                )
            elif not isinstance(recs.get("given"), list) or not isinstance(
                recs.get("received"), list
            ):
                errors.append(
                    "professional_information.recommendations.given/received "
                    "must be lists"
                )

        for int_key in (
            "skills_total_count",
            "experience_total_count",
            "education_total_count",
            "languages_total_count",
            "certifications_total_count",
            "projects_total_count",
            "volunteering_experience_total_count",
            "recommendations_given_count",
            "recommendations_received_count",
        ):
            if not isinstance(professional.get(int_key), int):
                errors.append(f"professional_information.{int_key} must be an int")

    linkedin = context.get("linkedin_information")
    if not isinstance(linkedin, dict):
        errors.append("linkedin_information must be a dict")
    else:
        li_keys = set(linkedin.keys())
        li_missing = LINKEDIN_INFORMATION_KEYS - li_keys
        li_extra = li_keys - LINKEDIN_INFORMATION_KEYS
        if li_missing:
            errors.append(f"missing linkedin_information keys: {sorted(li_missing)}")
        if li_extra:
            errors.append(f"unexpected linkedin_information keys: {sorted(li_extra)}")

        for list_key in ("websites", "hashtags"):
            if not isinstance(linkedin.get(list_key), list):
                errors.append(f"linkedin_information.{list_key} must be a list")

        locale = linkedin.get("primary_locale")
        if not isinstance(locale, dict):
            errors.append("linkedin_information.primary_locale must be a dict")
        elif set(locale.keys()) != PRIMARY_LOCALE_KEYS:
            errors.append(
                "linkedin_information.primary_locale must contain country and language only"
            )

        for int_key in ("followers", "connections"):
            if not isinstance(linkedin.get(int_key), int):
                errors.append(f"linkedin_information.{int_key} must be an int")

        for bool_key in (
            "creator_mode",
            "is_premium",
            "is_influencer",
            "is_open_profile",
            "is_self",
        ):
            if not isinstance(linkedin.get(bool_key), bool):
                errors.append(f"linkedin_information.{bool_key} must be a bool")

    meta = context.get("meta")
    if not isinstance(meta, dict):
        errors.append("meta must be a dict")
    else:
        meta_keys = set(meta.keys())
        meta_missing = PROFILE_CONTEXT_META_KEYS - meta_keys
        meta_extra = meta_keys - PROFILE_CONTEXT_META_KEYS
        if meta_missing:
            errors.append(f"missing meta keys: {sorted(meta_missing)}")
        if meta_extra:
            errors.append(f"unexpected meta keys: {sorted(meta_extra)}")
        if not isinstance(meta.get("schema_version"), int):
            errors.append("meta.schema_version must be an int")
        if not isinstance(meta.get("built_from_profile_content_hash"), str):
            errors.append("meta.built_from_profile_content_hash must be a str")

    return errors


# ---------------------------------------------------------------------------
# Phase 3 — completeness field registries (Step 3.1)
# ---------------------------------------------------------------------------

ContextSection = Literal[
    "personal_information", "professional_information", "linkedin_information"
]

_CONTEXT_SECTION_KEYS: dict[str, frozenset[str]] = {
    "personal_information": PERSONAL_INFORMATION_KEYS,
    "professional_information": PROFESSIONAL_INFORMATION_KEYS,
    "linkedin_information": LINKEDIN_INFORMATION_KEYS,
}


def _get_context_section(context: dict[str, Any], section: str) -> dict[str, Any]:
    """Return a context section dict, or empty dict when absent or wrong type."""
    value = context.get(section)
    return value if isinstance(value, dict) else {}


def _is_non_empty_string_field(
    context: dict[str, Any],
    *,
    section: str,
    field: str,
) -> bool:
    """Return True when a string field is non-empty after ``clean_str``."""
    return bool(clean_str(_get_context_section(context, section).get(field)))


def _is_positive_int_field(
    context: dict[str, Any],
    *,
    section: str,
    field: str,
) -> bool:
    """Return True when an integer field is strictly greater than zero."""
    value = _get_context_section(context, section).get(field)
    return isinstance(value, int) and value > 0


def _is_name_present(context: dict[str, Any]) -> bool:
    """
    Return True when display name is present.

    Primary path: ``personal_information.name``. Falls back to ``first_name``
    and/or ``last_name`` when combined name is empty.
    """
    personal = _get_context_section(context, "personal_information")
    if clean_str(personal.get("name")):
        return True
    return bool(
        clean_str(personal.get("first_name")) or clean_str(personal.get("last_name"))
    )


def _list_has_nonempty_entry(
    context: dict[str, Any],
    *,
    section: str,
    field: str,
    entry_field: str,
) -> bool:
    """Return True when a list section contains at least one non-empty entry field."""
    items = _get_context_section(context, section).get(field)
    if not isinstance(items, list):
        return False
    for item in items:
        if isinstance(item, dict) and clean_str(item.get(entry_field)):
            return True
    return False


@dataclass(frozen=True)
class ScalarValidationCheck:
    """Required scalar completeness check mapped to a ``missing_fields`` key."""

    section: ContextSection
    field: str
    missing_key: str
    predicate: Callable[[dict[str, Any]], bool]

    @classmethod
    def non_empty_string(
        cls,
        section: ContextSection,
        field: str,
        missing_key: str,
    ) -> ScalarValidationCheck:
        """Factory for standard non-empty string field checks."""

        def _predicate(context: dict[str, Any]) -> bool:
            return _is_non_empty_string_field(context, section=section, field=field)

        return cls(
            section=section,
            field=field,
            missing_key=missing_key,
            predicate=_predicate,
        )


@dataclass(frozen=True)
class ListEntryValidationSource:
    """One list source evaluated by the composite professional-background rule."""

    section: ContextSection
    field: str
    entry_field: str

    def is_present(self, context: dict[str, Any]) -> bool:
        """Return True when this list contains at least one meaningful entry."""
        return _list_has_nonempty_entry(
            context,
            section=self.section,
            field=self.field,
            entry_field=self.entry_field,
        )


@dataclass(frozen=True)
class CompositeValidationCheck:
    """OR-group completeness check mapped to a single ``missing_fields`` key."""

    missing_key: str
    sources: tuple[ListEntryValidationSource, ...]

    def is_present(self, context: dict[str, Any]) -> bool:
        """Return True when any source list has meaningful content."""
        return any(source.is_present(context) for source in self.sources)


@dataclass(frozen=True)
class EnrichmentValidationCheck:
    """Optional enrichment field tracked in ``optional_missing_fields``."""

    section: ContextSection
    field: str
    missing_key: str
    predicate: Callable[[dict[str, Any]], bool]

    def is_present(self, context: dict[str, Any]) -> bool:
        """Return True when optional enrichment data is available."""
        return self.predicate(context)


@dataclass(frozen=True)
class SupplementalValidationCheck:
    """Patchable placeholder tracked in ``supplemental_fields`` when empty."""

    section: ContextSection
    field: str
    supplemental_key: str

    def is_supplemental_needed(self, context: dict[str, Any]) -> bool:
        """Return True when the placeholder is still empty and may be filled later."""
        return not _is_non_empty_string_field(
            context, section=self.section, field=self.field
        )


REQUIRED_SCALAR_FIELD_CHECKS: tuple[ScalarValidationCheck, ...] = (
    ScalarValidationCheck(
        section="personal_information",
        field="name",
        missing_key="name",
        predicate=_is_name_present,
    ),
    ScalarValidationCheck.non_empty_string(
        "personal_information", "headline", "headline"
    ),
    ScalarValidationCheck.non_empty_string(
        "professional_information", "job_title", "job_title"
    ),
    ScalarValidationCheck.non_empty_string(
        "professional_information", "company", "company"
    ),
    ScalarValidationCheck.non_empty_string("personal_information", "about", "about"),
)

COMPOSITE_PROFESSIONAL_BACKGROUND_CHECK = CompositeValidationCheck(
    missing_key="professional_background",
    sources=(
        ListEntryValidationSource(
            section="professional_information",
            field="skills",
            entry_field="name",
        ),
        ListEntryValidationSource(
            section="professional_information",
            field="experience",
            entry_field="title",
        ),
        ListEntryValidationSource(
            section="professional_information",
            field="education",
            entry_field="school",
        ),
    ),
)

OPTIONAL_ENRICHMENT_CHECKS: tuple[EnrichmentValidationCheck, ...] = (
    EnrichmentValidationCheck(
        section="personal_information",
        field="location",
        missing_key="location",
        predicate=lambda ctx: _is_non_empty_string_field(
            ctx, section="personal_information", field="location"
        ),
    ),
    EnrichmentValidationCheck(
        section="linkedin_information",
        field="followers",
        missing_key="followers",
        predicate=lambda ctx: _is_positive_int_field(
            ctx, section="linkedin_information", field="followers"
        ),
    ),
    EnrichmentValidationCheck(
        section="linkedin_information",
        field="connections",
        missing_key="connections",
        predicate=lambda ctx: _is_positive_int_field(
            ctx, section="linkedin_information", field="connections"
        ),
    ),
    EnrichmentValidationCheck(
        section="linkedin_information",
        field="profile_picture",
        missing_key="profile_picture",
        predicate=lambda ctx: _is_non_empty_string_field(
            ctx, section="linkedin_information", field="profile_picture"
        ),
    ),
    EnrichmentValidationCheck(
        section="linkedin_information",
        field="profile_url",
        missing_key="profile_url",
        predicate=lambda ctx: _is_non_empty_string_field(
            ctx, section="linkedin_information", field="profile_url"
        ),
    ),
)

SUPPLEMENTAL_FIELD_CHECKS: tuple[SupplementalValidationCheck, ...] = (
    SupplementalValidationCheck(
        section="professional_information",
        field="industry",
        supplemental_key="industry",
    ),
)


def validation_registry_context_paths() -> set[tuple[str, str]]:
    """
    Return all ``(section, field)`` paths referenced by Phase 3 registries.

    Includes name-fallback paths ``first_name`` and ``last_name``.
    """
    paths: set[tuple[str, str]] = set()

    for check in REQUIRED_SCALAR_FIELD_CHECKS:
        paths.add((check.section, check.field))
        if check.missing_key == "name":
            paths.add(("personal_information", "first_name"))
            paths.add(("personal_information", "last_name"))

    for source in COMPOSITE_PROFESSIONAL_BACKGROUND_CHECK.sources:
        paths.add((source.section, source.field))

    for check in OPTIONAL_ENRICHMENT_CHECKS:
        paths.add((check.section, check.field))

    for check in SUPPLEMENTAL_FIELD_CHECKS:
        paths.add((check.section, check.field))

    return paths


def validate_validation_registry_contract() -> list[str]:
    """
    Verify Phase 3 registry keys align with ``LinkedInProfileContext`` schema.

    Returns:
        List of contract violation messages (empty when valid)
    """
    errors: list[str] = []

    scalar_keys = {check.missing_key for check in REQUIRED_SCALAR_FIELD_CHECKS}
    optional_keys = {check.missing_key for check in OPTIONAL_ENRICHMENT_CHECKS}
    supplemental_keys = {
        check.supplemental_key for check in SUPPLEMENTAL_FIELD_CHECKS
    }
    required_keys = scalar_keys | {COMPOSITE_PROFESSIONAL_BACKGROUND_CHECK.missing_key}

    overlap = (required_keys & optional_keys) | (required_keys & supplemental_keys)
    if overlap:
        errors.append(f"registry missing keys overlap required keys: {sorted(overlap)}")

    overlap_optional_supplemental = optional_keys & supplemental_keys
    if overlap_optional_supplemental:
        errors.append(
            "registry missing keys overlap supplemental keys: "
            f"{sorted(overlap_optional_supplemental)}"
        )

    if len(scalar_keys) + 1 != COMPLETENESS_SCORING_UNIT_COUNT:
        errors.append(
            "COMPLETENESS_SCORING_UNIT_COUNT must equal scalar checks + composite"
        )

    for section, field in sorted(validation_registry_context_paths()):
        allowed = _CONTEXT_SECTION_KEYS.get(section)
        if allowed is None:
            errors.append(f"unknown registry section: {section}")
            continue
        if field not in allowed:
            errors.append(
                f"registry path {section}.{field} is not in LinkedInProfileContext schema"
            )

    return errors

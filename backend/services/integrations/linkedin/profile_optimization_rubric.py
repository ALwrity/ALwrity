"""
Phase 7 — deterministic profile optimization gap detection (no LLM, no DB).

Encodes LinkedIn best-practice heuristics from the enhancement report as pure rules.
"""

from __future__ import annotations

import re
from typing import Any

from loguru import logger

from services.integrations.linkedin.field_coercion import clean_str
from services.integrations.linkedin.profile_optimization_types import (
    DetectedGap,
    ProfileSection,
    gap_severity_rank,
)
from services.integrations.linkedin.profile_validation_types import (
    ProfileValidationResult,
    is_field_empty,
)

_LOG_PREFIX = "[ProfileOptimization]"

HEADLINE_MIN_STRONG_CHARS = 40
HEADLINE_TARGET_CHARS = 120
HEADLINE_MAX_CHARS = 220
SUMMARY_MIN_CHARS = 100
SKILLS_MIN_COUNT = 15
SKILLS_TARGET_COUNT = 30

_CTA_KEYWORDS = (
    "connect",
    "contact",
    "email",
    "reach",
    "message",
    "dm ",
    " call",
    "schedule",
    "book",
    "http",
    "www.",
    "@",
    "let's talk",
    "get in touch",
)

_CREDENTIAL_INDUSTRIES = (
    "tech",
    "software",
    "engineer",
    "finance",
    "health",
    "legal",
    "consult",
    "data",
    "cloud",
    "security",
)

_TITLE_ONLY_MAX_WORDS = 5

# Canonical sections displayed in the per-section score breakdown.
# Order matters — this is the order the UI renders them in.
PROFILE_SECTIONS: tuple[str, ...] = (
    "profile_photo",
    "headline",
    "custom_url",
    "summary",
    "experience",
    "skills",
    "recommendations",
    "education",
    "certifications",
    "featured",
)


class ProfileOptimizationRubricError(Exception):
    """Raised when rubric inputs are invalid."""


def detect_profile_optimization_gaps(
    profile_context: dict[str, Any],
    profile_validation: dict[str, Any],
) -> list[DetectedGap]:
    """
    Detect best-practice profile gaps from context and Phase 3 validation.

    Args:
        profile_context: Phase 2 ``LinkedInProfileContext`` dict
        profile_validation: Phase 3 validation result dict

    Returns:
        Gaps sorted by severity (High → Medium → Low), then ``rule_id``

    Raises:
        ProfileOptimizationRubricError: When inputs are not dicts
    """
    logger.info("{} detect_profile_optimization_gaps start", _LOG_PREFIX)

    if not isinstance(profile_context, dict):
        logger.error(
            "{} invalid profile_context type={}",
            _LOG_PREFIX,
            type(profile_context).__name__,
        )
        raise ProfileOptimizationRubricError("profile_context must be a dict")
    if not isinstance(profile_validation, dict):
        logger.error(
            "{} invalid profile_validation type={}",
            _LOG_PREFIX,
            type(profile_validation).__name__,
        )
        raise ProfileOptimizationRubricError("profile_validation must be a dict")

    gaps: list[DetectedGap] = []
    personal = _section(profile_context, "personal_information")
    professional = _section(profile_context, "professional_information")
    linkedin_info = _section(profile_context, "linkedin_information")

    headline = clean_str(personal.get("headline"))
    about = clean_str(personal.get("about"))
    profile_picture = clean_str(linkedin_info.get("profile_picture"))
    public_identifier = clean_str(linkedin_info.get("public_identifier"))
    profile_url = clean_str(linkedin_info.get("profile_url"))

    _check_photo(gaps, profile_picture)
    _check_headline(gaps, headline)
    _check_custom_url(gaps, public_identifier, profile_url)
    _check_summary(gaps, about)
    _check_experience(gaps, professional)
    _check_skills(gaps, professional)
    _check_recommendations(gaps, professional)
    _check_education(gaps, professional)
    _check_certifications(gaps, professional)
    _check_featured(gaps, professional)
    _check_validation_gaps(gaps, profile_validation)

    gaps.sort(key=lambda gap: (gap_severity_rank(gap.severity), gap.rule_id))

    rule_ids = [gap.rule_id for gap in gaps]
    logger.info(
        "{} rubric detected_gaps count={} rule_ids={}",
        _LOG_PREFIX,
        len(gaps),
        rule_ids[:20],
    )
    logger.info("{} detect_profile_optimization_gaps complete count={}", _LOG_PREFIX, len(gaps))
    return gaps


def _section(context: dict[str, Any], key: str) -> dict[str, Any]:
    section = context.get(key)
    return section if isinstance(section, dict) else {}


def _append_gap(
    gaps: list[DetectedGap],
    *,
    section: ProfileSection,
    severity: str,
    rule_id: str,
    current_snippet: str,
) -> None:
    snippet = clean_str(current_snippet)[:500] or "(empty)"
    gaps.append(
        DetectedGap(
            section=section,
            severity=severity,  # type: ignore[arg-type]
            rule_id=rule_id,
            current_snippet=snippet,
        )
    )


def _check_photo(gaps: list[DetectedGap], profile_picture: str) -> None:
    if is_field_empty(profile_picture):
        _append_gap(
            gaps,
            section="profile_photo",
            severity="High",
            rule_id="photo_missing",
            current_snippet="No profile photo URL on record",
        )


def _check_headline(gaps: list[DetectedGap], headline: str) -> None:
    if is_field_empty(headline):
        _append_gap(
            gaps,
            section="headline",
            severity="High",
            rule_id="headline_empty",
            current_snippet="Headline is blank",
        )
        return

    if _is_title_only_headline(headline):
        _append_gap(
            gaps,
            section="headline",
            severity="High",
            rule_id="headline_title_only",
            current_snippet=headline,
        )
        return

    if len(headline) < HEADLINE_TARGET_CHARS:
        _append_gap(
            gaps,
            section="headline",
            severity="Medium",
            rule_id="headline_underutilized",
            current_snippet=f"{headline} ({len(headline)}/{HEADLINE_MAX_CHARS} chars used)",
        )


def _is_title_only_headline(headline: str) -> bool:
    """True when headline looks like a bare job title without value proposition."""
    if len(headline) < HEADLINE_MIN_STRONG_CHARS:
        return True
    if "|" in headline:
        return False
    words = headline.split()
    if len(words) <= _TITLE_ONLY_MAX_WORDS and len(headline) < 60:
        return True
    if re.match(r"^[\w\s\-]+(\s+at\s+[\w\s\-\.&]+)?\.?$", headline, re.IGNORECASE):
        if len(headline) < 50 and "|" not in headline:
            return True
    return False


def _check_custom_url(
    gaps: list[DetectedGap],
    public_identifier: str,
    profile_url: str,
) -> None:
    if is_field_empty(public_identifier) and is_field_empty(profile_url):
        _append_gap(
            gaps,
            section="custom_url",
            severity="Medium",
            rule_id="custom_url_missing",
            current_snippet="No custom LinkedIn URL / public identifier found",
        )


def _check_summary(gaps: list[DetectedGap], about: str) -> None:
    if is_field_empty(about):
        _append_gap(
            gaps,
            section="summary",
            severity="High",
            rule_id="summary_empty",
            current_snippet="About / summary section is blank",
        )
        return

    if len(about) < SUMMARY_MIN_CHARS:
        _append_gap(
            gaps,
            section="summary",
            severity="High",
            rule_id="summary_too_short",
            current_snippet=f"{about[:80]}… ({len(about)} chars)",
        )
        return

    lower_about = about.lower()
    if not any(keyword in lower_about for keyword in _CTA_KEYWORDS):
        _append_gap(
            gaps,
            section="summary",
            severity="Low",
            rule_id="summary_no_cta",
            current_snippet=f"{about[:120]}…",
        )


def _check_experience(gaps: list[DetectedGap], professional: dict[str, Any]) -> None:
    experience = professional.get("experience")
    if not isinstance(experience, list) or not experience:
        return

    top = experience[0]
    if not isinstance(top, dict):
        return

    title = clean_str(top.get("title")) or "Role"
    company = clean_str(top.get("company"))
    description = clean_str(top.get("description"))
    label = f"{title} at {company}" if company else title

    if is_field_empty(description):
        _append_gap(
            gaps,
            section="experience",
            severity="Medium",
            rule_id="experience_top_role_thin",
            current_snippet=f"{label} — no description",
        )
        return

    if not re.search(r"\d", description):
        _append_gap(
            gaps,
            section="experience",
            severity="Low",
            rule_id="experience_no_metrics",
            current_snippet=f"{label} — description lacks metrics/numbers",
        )


def _check_skills(gaps: list[DetectedGap], professional: dict[str, Any]) -> None:
    skills = professional.get("skills")
    skills_list = skills if isinstance(skills, list) else []
    total = professional.get("skills_total_count")
    count = int(total) if isinstance(total, int) and total > 0 else len(skills_list)

    if count < SKILLS_MIN_COUNT:
        _append_gap(
            gaps,
            section="skills",
            severity="Medium",
            rule_id="skills_count_low",
            current_snippet=f"{count} skills listed (target {SKILLS_MIN_COUNT}+)",
        )
    elif count < SKILLS_TARGET_COUNT:
        _append_gap(
            gaps,
            section="skills",
            severity="Low",
            rule_id="skills_count_suboptimal",
            current_snippet=f"{count} skills listed (target {SKILLS_TARGET_COUNT}–50)",
        )


def _check_recommendations(gaps: list[DetectedGap], professional: dict[str, Any]) -> None:
    received_count = professional.get("recommendations_received_count", 0)
    count = int(received_count) if isinstance(received_count, int) else 0

    recommendations = professional.get("recommendations")
    if isinstance(recommendations, dict):
        received = recommendations.get("received")
        if isinstance(received, list) and len(received) > count:
            count = len(received)

    if count == 0:
        _append_gap(
            gaps,
            section="recommendations",
            severity="Medium",
            rule_id="recommendations_missing",
            current_snippet="No received recommendations on profile",
        )


def _check_education(gaps: list[DetectedGap], professional: dict[str, Any]) -> None:
    education = professional.get("education")
    if not isinstance(education, list) or not education:
        return

    for entry in education:
        if not isinstance(entry, dict):
            continue
        school = clean_str(entry.get("school")) or "School"
        degree = clean_str(entry.get("degree"))
        if is_field_empty(degree):
            _append_gap(
                gaps,
                section="education",
                severity="Low",
                rule_id="education_incomplete",
                current_snippet=f"{school} — missing degree or field of study",
            )
            return


def _check_certifications(gaps: list[DetectedGap], professional: dict[str, Any]) -> None:
    certifications = professional.get("certifications")
    cert_list = certifications if isinstance(certifications, list) else []
    cert_total = professional.get("certifications_total_count", 0)
    count = int(cert_total) if isinstance(cert_total, int) else len(cert_list)

    industry = clean_str(professional.get("industry")).lower()
    suggests_credentials = any(token in industry for token in _CREDENTIAL_INDUSTRIES)

    skills = professional.get("skills")
    skills_count = len(skills) if isinstance(skills, list) else 0

    if count == 0 and (suggests_credentials or skills_count >= 10):
        _append_gap(
            gaps,
            section="certifications",
            severity="Low",
            rule_id="certifications_missing",
            current_snippet="No certifications listed",
        )


def _check_featured(gaps: list[DetectedGap], professional: dict[str, Any]) -> None:
    projects = professional.get("projects")
    project_list = projects if isinstance(projects, list) else []
    project_total = professional.get("projects_total_count", 0)
    count = int(project_total) if isinstance(project_total, int) else len(project_list)

    if count == 0:
        _append_gap(
            gaps,
            section="featured",
            severity="Low",
            rule_id="featured_empty",
            current_snippet="No featured items or projects visible in profile data",
        )


def _check_validation_gaps(gaps: list[DetectedGap], profile_validation: dict[str, Any]) -> None:
    missing_required = profile_validation.get("missing_fields") or []
    if isinstance(missing_required, list):
        for field_key in missing_required:
            if not isinstance(field_key, str) or not field_key.strip():
                continue
            _append_gap(
                gaps,
                section=_field_to_section(field_key),
                severity="High",
                rule_id="validation_missing_required",
                current_snippet=f"Required field missing: {field_key}",
            )

    missing_optional = profile_validation.get("optional_missing_fields") or []
    if isinstance(missing_optional, list):
        for field_key in missing_optional:
            if not isinstance(field_key, str) or not field_key.strip():
                continue
            _append_gap(
                gaps,
                section=_field_to_section(field_key),
                severity="Medium",
                rule_id="validation_missing_optional",
                current_snippet=f"Optional field missing: {field_key}",
            )


def _field_to_section(field_key: str) -> ProfileSection:
    mapping: dict[str, ProfileSection] = {
        "name": "headline",
        "headline": "headline",
        "about": "summary",
        "job_title": "experience",
        "company": "experience",
        "skills": "skills",
        "experience": "experience",
        "education": "education",
        "industry": "headline",
        "professional_background": "experience",
        "location": "summary",
        "profile_url": "custom_url",
        "profile_picture": "profile_photo",
    }
    return mapping.get(field_key, "headline")


# Penalty weights for rubric-based profile strength (Phase A — no LLM).
_SEVERITY_PENALTY: dict[str, int] = {"High": 10, "Medium": 5, "Low": 2}


def compute_profile_optimization_score(gaps: list[DetectedGap]) -> int:
    """
    Derive a 0–100 optimization score from detected rubric gaps.

    Starts at 100 and subtracts severity-weighted penalties (floor 0).
    """
    penalty = sum(_SEVERITY_PENALTY.get(gap.severity, 0) for gap in gaps)
    return max(0, 100 - penalty)


def compute_section_scores(gaps: list[DetectedGap]) -> dict[str, int]:
    """
    Compute 0–100 score per profile section from detected rubric gaps.

    Each section starts at 100, then severity-weighted penalties are
    subtracted per gap in that section (floor 0). Sections with no
    detected gaps default to 100. Output is keyed by section name and
    always contains all :data:`PROFILE_SECTIONS`.
    """
    scores: dict[str, int] = {section: 100 for section in PROFILE_SECTIONS}
    for gap in gaps:
        section = gap.section
        if section not in scores:
            # Unknown section — start at 100 then apply penalty
            scores[section] = 100
        scores[section] = max(0, scores[section] - _SEVERITY_PENALTY.get(gap.severity, 0))
    return scores


def enrich_profile_validation_strength(
    profile_context: dict[str, Any],
    validation: ProfileValidationResult,
) -> ProfileValidationResult:
    """
    Attach rubric-based optimization score to Phase 3 validation.

    Evaluates content quality heuristics (headline depth, summary length,
    skills count, etc.) — not merely field presence.
    """
    try:
        gaps = detect_profile_optimization_gaps(profile_context, validation)
    except ProfileOptimizationRubricError as exc:
        logger.warning(
            "{} enrich_profile_validation_strength rubric failed: {}",
            _LOG_PREFIX,
            exc,
        )
        fallback = int(validation.get("completeness_score") or 0)
        return {
            **validation,
            "optimization_score": fallback,
            "optimization_gaps_count": 0,
            "section_scores": {section: fallback for section in PROFILE_SECTIONS},
            "score_basis": "completeness_fallback",
        }

    score = compute_profile_optimization_score(gaps)
    section_scores = compute_section_scores(gaps)
    enriched: ProfileValidationResult = {
        **validation,
        "optimization_score": score,
        "optimization_gaps_count": len(gaps),
        "section_scores": section_scores,
        "score_basis": "rubric",
    }
    logger.info(
        "{} enrich_profile_validation_strength score={} gaps={}",
        _LOG_PREFIX,
        score,
        len(gaps),
    )
    return enriched


# Phase B — reward marking optimization backlog items done/skipped (capped boost).
_PROGRESS_BOOST_PER_ITEM = 3
_MAX_PROGRESS_BOOST = 15


def apply_optimization_progress_boost(base_score: int, completed_count: int) -> int:
    """Add up to +15 points for completed optimization items (3 per item)."""
    if completed_count <= 0:
        return max(0, min(100, base_score))
    boost = min(_MAX_PROGRESS_BOOST, completed_count * _PROGRESS_BOOST_PER_ITEM)
    return min(100, base_score + boost)


def enrich_validation_with_progress_boost(
    profile_context: dict[str, Any],
    validation: ProfileValidationResult,
    completed_ids: list[str],
) -> ProfileValidationResult:
    """
    Recompute rubric score and apply progress boost from completed Phase 7 items.

    Profile content is unchanged when items are marked done/skipped; the boost
    reflects user progress through the optimization backlog.
    """
    enriched = enrich_profile_validation_strength(profile_context, validation)
    base_score = int(enriched.get("optimization_score") or 0)
    count = len(completed_ids) if isinstance(completed_ids, list) else 0
    boosted = apply_optimization_progress_boost(base_score, count)
    progress_boost = boosted - base_score
    enriched["optimization_score"] = boosted
    if progress_boost > 0:
        enriched["score_basis"] = "rubric_with_progress"
    logger.info(
        "{} enrich_validation_with_progress_boost base={} completed={} boosted={}",
        _LOG_PREFIX,
        base_score,
        count,
        boosted,
    )
    return enriched

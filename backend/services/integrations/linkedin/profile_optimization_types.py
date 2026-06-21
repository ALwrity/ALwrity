"""
Phase 7 — profile optimization Pydantic types and JSON schema export.

Defines LLM output shape (without ``id`` or ``meta``) and stored payload with server-side meta.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

PROFILE_OPTIMIZATION_SCHEMA_VERSION = 1
PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE = 5
PROFILE_OPTIMIZATION_BACKLOG_MIN = 10
PROFILE_OPTIMIZATION_BACKLOG_MAX = 15
DEFAULT_PROFILE_OPTIMIZATION_MODEL = "gemini-2.5-flash"

ProfileSection = Literal[
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
]

OptimizationImpact = Literal["High", "Medium", "Low"]
OptimizationEffort = Literal["Low", "Medium", "High"]
GapSeverity = Literal["High", "Medium", "Low"]

PROFILE_SECTIONS: tuple[ProfileSection, ...] = (
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
)
OPTIMIZATION_IMPACTS: tuple[OptimizationImpact, ...] = ("High", "Medium", "Low")
OPTIMIZATION_EFFORTS: tuple[OptimizationEffort, ...] = ("Low", "Medium", "High")
GAP_SEVERITIES: tuple[GapSeverity, ...] = ("High", "Medium", "Low")

_SEVERITY_RANK: dict[str, int] = {"High": 0, "Medium": 1, "Low": 2}


class DetectedGap(BaseModel):
    """Deterministic rubric gap (no LLM)."""

    model_config = ConfigDict(extra="forbid")

    section: ProfileSection
    severity: GapSeverity
    rule_id: str
    current_snippet: str = Field(max_length=500)


class ProfileOptimizationItemPayload(BaseModel):
    """Single LLM recommendation item (no server ``id``)."""

    model_config = ConfigDict(extra="forbid")

    profile_section: ProfileSection
    issue: str
    why_it_matters: str
    current_state_summary: str
    recommended_action: str
    suggested_copy: str = ""
    impact: OptimizationImpact
    effort: OptimizationEffort
    best_practice_ref: str = ""
    completion_criteria: str = ""


class ProfileOptimizationLLMResponse(BaseModel):
    """Structured LLM output for profile optimization backlog generation."""

    model_config = ConfigDict(extra="forbid")

    recommendations: list[ProfileOptimizationItemPayload] = Field(
        min_length=PROFILE_OPTIMIZATION_BACKLOG_MIN,
        max_length=PROFILE_OPTIMIZATION_BACKLOG_MAX,
    )


class ProfileOptimizationItem(BaseModel):
    """API/stored recommendation item with server-assigned ``id``."""

    model_config = ConfigDict(extra="forbid")

    id: str
    profile_section: ProfileSection
    issue: str
    why_it_matters: str
    current_state_summary: str
    recommended_action: str
    suggested_copy: str = ""
    impact: OptimizationImpact
    effort: OptimizationEffort
    best_practice_ref: str = ""
    completion_criteria: str = ""


class ProfileOptimizationMeta(BaseModel):
    """Server-owned metadata for cached profile optimization recommendations."""

    model_config = ConfigDict(extra="forbid")

    built_from_profile_context_hash: str = ""
    built_from_intelligence_hash: str = ""
    schema_version: int = Field(default=PROFILE_OPTIMIZATION_SCHEMA_VERSION)
    model: str = Field(default=DEFAULT_PROFILE_OPTIMIZATION_MODEL)
    active_batch_index: int = Field(default=0, ge=0)
    completed_ids: list[str] = Field(default_factory=list)


class StoredProfileOptimization(BaseModel):
    """Full persisted optimization object including server ``meta``."""

    model_config = ConfigDict(extra="forbid")

    meta: ProfileOptimizationMeta
    recommendations: list[ProfileOptimizationItem] = Field(
        min_length=1,
        max_length=PROFILE_OPTIMIZATION_ACTIVE_BATCH_SIZE,
    )
    backlog: list[ProfileOptimizationItem] = Field(default_factory=list)


def gap_severity_rank(severity: str) -> int:
    """Return sort rank for gap severity (lower = higher priority)."""
    return _SEVERITY_RANK.get(severity, 99)


def profile_optimization_json_schema() -> dict[str, Any]:
    """
    Return JSON schema for Gemini structured output (LLM fields only).

    Returns:
        JSON schema dict suitable for ``gemini_structured_json_response``
    """
    return ProfileOptimizationLLMResponse.model_json_schema()

"""
Phase 5 — AI profile intelligence Pydantic types and JSON schema export.

Defines LLM output shape (without ``meta``) and stored payload with server-side meta.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

PROFILE_INTELLIGENCE_SCHEMA_VERSION = 1
DEFAULT_PROFILE_INTELLIGENCE_MODEL = "gemini-2.5-flash"
UNKNOWN_SENTINEL = "Unknown"


class AIProfileIntelligencePayload(BaseModel):
    """
    Structured LLM output for profile understanding.

    Does not include ``meta`` — attached server-side after validation.
    """

    model_config = ConfigDict(extra="forbid")

    professional_identity: str
    primary_expertise: list[str]
    industry: str
    experience_level: str
    knowledge_domains: list[str]
    writing_opportunities: list[str]
    target_audience: list[str]
    communication_style: str
    brand_positioning: str
    summary: str


class AIProfileIntelligenceMeta(BaseModel):
    """Server-owned metadata for cached AI profile intelligence."""

    model_config = ConfigDict(extra="forbid")

    built_from_profile_context_hash: str = ""
    schema_version: int = Field(default=PROFILE_INTELLIGENCE_SCHEMA_VERSION)
    model: str = Field(default=DEFAULT_PROFILE_INTELLIGENCE_MODEL)


class StoredAIProfileIntelligence(BaseModel):
    """Full persisted intelligence object including server ``meta``."""

    model_config = ConfigDict(extra="forbid")

    meta: AIProfileIntelligenceMeta
    professional_identity: str
    primary_expertise: list[str]
    industry: str
    experience_level: str
    knowledge_domains: list[str]
    writing_opportunities: list[str]
    target_audience: list[str]
    communication_style: str
    brand_positioning: str
    summary: str


def ai_profile_intelligence_json_schema() -> dict[str, Any]:
    """
    Return JSON schema for Gemini structured output (LLM fields only).

    Returns:
        JSON schema dict suitable for ``gemini_structured_json_response``
    """
    return AIProfileIntelligencePayload.model_json_schema()

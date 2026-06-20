"""
Phase 6 — topic recommendation Pydantic types and JSON schema export.

Defines LLM output shape (without ``id`` or ``meta``) and stored payload with server-side meta.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

TOPIC_RECOMMENDATION_SCHEMA_VERSION = 1
TOPIC_RECOMMENDATION_COUNT = 5
DEFAULT_TOPIC_RECOMMENDATION_MODEL = "gemini-2.5-flash"

RecommendedFormat = Literal["LinkedIn Post", "LinkedIn Article"]
GrowthImpact = Literal["High", "Medium", "Low"]

RECOMMENDED_FORMATS: tuple[RecommendedFormat, ...] = (
    "LinkedIn Post",
    "LinkedIn Article",
)
GROWTH_IMPACTS: tuple[GrowthImpact, ...] = ("High", "Medium", "Low")


class TopicRecommendationItemPayload(BaseModel):
    """Single LLM recommendation item (no server ``id``)."""

    model_config = ConfigDict(extra="forbid")

    title: str
    why_this_fits: str
    recommended_format: RecommendedFormat
    target_audience: list[str] = Field(min_length=1)
    growth_impact: GrowthImpact


class TopicRecommendationLLMResponse(BaseModel):
    """Structured LLM output for topic recommendations."""

    model_config = ConfigDict(extra="forbid")

    recommendations: list[TopicRecommendationItemPayload] = Field(min_length=5, max_length=5)


class TopicRecommendationItem(BaseModel):
    """API/stored recommendation item with server-assigned ``id``."""

    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    why_this_fits: str
    recommended_format: RecommendedFormat
    target_audience: list[str] = Field(min_length=1)
    growth_impact: GrowthImpact


class TopicRecommendationMeta(BaseModel):
    """Server-owned metadata for cached topic recommendations."""

    model_config = ConfigDict(extra="forbid")

    built_from_intelligence_hash: str = ""
    schema_version: int = Field(default=TOPIC_RECOMMENDATION_SCHEMA_VERSION)
    model: str = Field(default=DEFAULT_TOPIC_RECOMMENDATION_MODEL)


class StoredTopicRecommendations(BaseModel):
    """Full persisted recommendations object including server ``meta``."""

    model_config = ConfigDict(extra="forbid")

    meta: TopicRecommendationMeta
    recommendations: list[TopicRecommendationItem] = Field(min_length=5, max_length=5)


def topic_recommendation_json_schema() -> dict[str, Any]:
    """
    Return JSON schema for Gemini structured output (LLM fields only).

    Returns:
        JSON schema dict suitable for ``gemini_structured_json_response``
    """
    return TopicRecommendationLLMResponse.model_json_schema()

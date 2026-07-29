"""Pydantic models for LinkedIn People You May Know (PYMK) API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


PymkCohortLiteral = Literal[
    "recent_activity",
    "same_school",
    "same_job",
    "same_industry",
]


class PymkSuggestionItem(BaseModel):
    """Normalized person suggestion from LinkedIn PYMK."""

    profile_id: str = Field(..., description="LinkedIn provider profile id (ACo...)")
    name: str
    first_name: str = ""
    last_name: str = ""
    profile_url: str
    headline: Optional[str] = None
    photo_url: Optional[str] = None
    background_url: Optional[str] = None
    reason: str = Field(..., description="Why LinkedIn suggested this person")
    mutual_connections_text: Optional[str] = None
    connection_state: Optional[str] = Field(
        None,
        description="e.g. invitation_pending, connected, unknown",
    )


class PymkListResponse(BaseModel):
    """Paginated PYMK suggestions for the UI."""

    cohort: PymkCohortLiteral
    cohort_label: str
    suggestions: list[PymkSuggestionItem] = Field(default_factory=list)
    page_start: int = 0
    page_size: int = 10
    has_more: bool = False
    fetched_at: datetime
    data_source_summary: str = "Live LinkedIn People You May Know via Unipile"


class PymkCohortDefaultsResponse(BaseModel):
    """Auto-detected cohort ids from the connected LinkedIn profile."""

    school_id: Optional[str] = None
    industry_id: Optional[str] = None
    industry_name: Optional[str] = None
    super_title_id: Optional[str] = None

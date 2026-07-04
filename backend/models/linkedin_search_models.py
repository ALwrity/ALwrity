"""
Pydantic models for LinkedIn Studio search API (Unipile Classic Search proxy).
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


LinkedInSearchCategory = Literal["posts", "jobs", "people", "companies"]


class LinkedInSearchFilters(BaseModel):
    """Optional Classic search filters passed through to Unipile."""

    location: List[str] = Field(default_factory=list)
    industry: List[str] = Field(default_factory=list)
    company: List[str] = Field(default_factory=list)
    past_company: List[str] = Field(default_factory=list)
    school: List[str] = Field(default_factory=list)
    service: List[str] = Field(default_factory=list)
    network_distance: List[int] = Field(default_factory=list)
    sort_by: Optional[Literal["relevance", "date"]] = None
    date_posted: Optional[str] = None


class LinkedInSearchRequest(BaseModel):
    """Request body for POST /api/linkedin-social/search."""

    keywords: str = Field(..., min_length=1, max_length=500)
    category: LinkedInSearchCategory = "posts"
    api: Literal["classic"] = "classic"
    limit: int = Field(default=10, ge=1, le=50)
    cursor: Optional[str] = None
    account_id: Optional[str] = None
    filters: LinkedInSearchFilters = Field(default_factory=LinkedInSearchFilters)


class LinkedInSearchPagingResponse(BaseModel):
    """Paging metadata from Unipile search."""

    start: Optional[int] = None
    page_count: Optional[int] = None
    total_count: Optional[int] = None


class LinkedInSearchResponse(BaseModel):
    """Normalized search response for the frontend."""

    success: bool = True
    object: str = "LinkedinSearch"
    items: List[Dict[str, Any]] = Field(default_factory=list)
    paging: LinkedInSearchPagingResponse = Field(default_factory=LinkedInSearchPagingResponse)
    cursor: Optional[str] = None
    active_category: LinkedInSearchCategory
    provider: str = "unipile"


class LinkedInSearchParameterItem(BaseModel):
    """Single autocomplete parameter from Unipile."""

    id: str
    title: str
    picture_url: Optional[str] = None
    additional_data: Dict[str, Any] = Field(default_factory=dict)


class LinkedInSearchParametersPagingResponse(BaseModel):
    """Paging for parameter list responses."""

    page_count: Optional[int] = None


class LinkedInSearchParametersResponse(BaseModel):
    """Response for GET /api/linkedin-social/search/parameters."""

    success: bool = True
    object: str = "LinkedinSearchParametersList"
    items: List[LinkedInSearchParameterItem] = Field(default_factory=list)
    paging: LinkedInSearchParametersPagingResponse = Field(
        default_factory=LinkedInSearchParametersPagingResponse
    )
    provider: str = "unipile"

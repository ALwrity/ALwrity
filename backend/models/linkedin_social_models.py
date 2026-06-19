"""
Pydantic models for LinkedIn Social API (Growth Engine).
Separate from linkedin_models.py (Writer content generation).
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class LinkedInConnectionStatusResponse(BaseModel):
    connected: bool
    provider: str
    has_per_user_token: bool = False
    has_env_fallback: bool = False
    accounts: List[Dict[str, Any]] = Field(default_factory=list)
    organizations: List[Dict[str, Any]] = Field(default_factory=list)
    account_name: Optional[str] = None


class LinkedInAccountResponse(BaseModel):
    account_id: str
    account_type: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    platform: str = "linkedin"


class LinkedInAccountsListResponse(BaseModel):
    accounts: List[LinkedInAccountResponse]
    provider: str


class LinkedInOrganizationResponse(BaseModel):
    organization_id: str
    name: Optional[str] = None
    urn: Optional[str] = None


class LinkedInOrganizationsListResponse(BaseModel):
    organizations: List[LinkedInOrganizationResponse]
    account_id: str


class LinkedInAnalyticsResponse(BaseModel):
    success: bool = True
    data: Dict[str, Any] = Field(default_factory=dict)
    provider: str


class LinkedInAnalyticsDateRangeResponse(BaseModel):
    start: str
    endExclusive: str
    label: str
    dataLagDays: int = 2


class LinkedInLandingPersonalAnalyticsResponse(BaseModel):
    accountId: str
    avatarUrl: Optional[str] = None
    analytics: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


class LinkedInLandingOrgAnalyticsResponse(BaseModel):
    accountId: Optional[str] = None
    orgId: Optional[str] = None
    orgName: Optional[str] = None
    avatarUrl: Optional[str] = None
    analytics: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


class LinkedInLandingAnalyticsResponse(BaseModel):
    dateRange: LinkedInAnalyticsDateRangeResponse
    personal: LinkedInLandingPersonalAnalyticsResponse
    organization: Optional[LinkedInLandingOrgAnalyticsResponse] = None
    dataDelayNote: Optional[str] = None
    provider: str


class LinkedInPersonalAnalyticsResponse(BaseModel):
    dateRange: LinkedInAnalyticsDateRangeResponse
    personal: LinkedInLandingPersonalAnalyticsResponse
    provider: str


class LinkedInProfileMetaResponse(BaseModel):
    """Acquisition metadata for GET /api/linkedin-social/profile."""

    source: Literal["cache", "unipile"]
    fetched_at: Optional[str] = None
    profile_content_hash: Optional[str] = None


class LinkedInProfileAcquireResponse(BaseModel):
    """Normalized own-profile snapshot (Phase 1 — no raw Unipile payload)."""

    profile: Dict[str, Any] = Field(default_factory=dict)
    meta: LinkedInProfileMetaResponse

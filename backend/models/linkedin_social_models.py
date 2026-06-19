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


class LinkedInProfileContextMetaResponse(BaseModel):
    """Profile context build/cache metadata (Phase 2)."""

    source: Literal["cache", "built"]
    profile_context_updated_at: Optional[str] = None


class LinkedInProfileValidationResponse(BaseModel):
    """Semantic completeness result for GET /api/linkedin-social/profile (Phase 3)."""

    is_profile_complete: bool
    completeness_score: int
    missing_fields: List[str] = Field(default_factory=list)
    optional_missing_fields: List[str] = Field(default_factory=list)
    supplemental_fields: List[str] = Field(default_factory=list)

    @classmethod
    def from_validation_result(cls, validation: Dict[str, Any]) -> LinkedInProfileValidationResponse:
        """Build API payload from persisted validation dict (excludes embedded ``meta``)."""
        return cls(
            is_profile_complete=bool(validation.get("is_profile_complete")),
            completeness_score=int(validation.get("completeness_score", 0)),
            missing_fields=list(validation.get("missing_fields") or []),
            optional_missing_fields=list(validation.get("optional_missing_fields") or []),
            supplemental_fields=list(validation.get("supplemental_fields") or []),
        )


class LinkedInProfileValidationMetaResponse(BaseModel):
    """Profile validation cache metadata (Phase 3)."""

    source: Literal["cache", "validated"]
    validated_at: Optional[str] = None


class LinkedInProfileAcquireResponse(BaseModel):
    """Normalized own-profile snapshot with Phase 2 context and Phase 3 validation."""

    profile: Dict[str, Any] = Field(default_factory=dict)
    meta: LinkedInProfileMetaResponse
    profile_context: Dict[str, Any] = Field(default_factory=dict)
    profile_context_meta: LinkedInProfileContextMetaResponse
    profile_validation: LinkedInProfileValidationResponse
    profile_validation_meta: LinkedInProfileValidationMetaResponse

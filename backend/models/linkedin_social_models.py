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


class ProfileValidationResponse(BaseModel):
    """Phase 3 profile completeness validation result."""

    is_profile_complete: bool
    completeness_score: int
    missing_fields: List[str] = Field(default_factory=list)
    optional_missing_fields: List[str] = Field(default_factory=list)


class CompletionQuestionResponse(BaseModel):
    """Single profile completion question for the UI."""

    field_key: str
    label: str
    input_type: Literal["text", "textarea", "tags"]
    required: bool = True


class ProfileCompletionResponse(BaseModel):
    """Profile completion questions derived from validation."""

    questions: List[CompletionQuestionResponse] = Field(default_factory=list)


class AIProfileIntelligenceResponse(BaseModel):
    """Phase 5 AI profile understanding (LLM fields only — no server meta)."""

    professional_identity: str
    primary_expertise: List[str] = Field(default_factory=list)
    industry: str
    experience_level: str
    knowledge_domains: List[str] = Field(default_factory=list)
    writing_opportunities: List[str] = Field(default_factory=list)
    target_audience: List[str] = Field(default_factory=list)
    communication_style: str
    brand_positioning: str
    summary: str


class ProfileIntelligenceMetaResponse(BaseModel):
    """Phase 5 intelligence acquisition metadata."""

    source: Literal["cache", "generated"]
    ai_intelligence_updated_at: Optional[str] = None


class TopicRecommendationResponse(BaseModel):
    """Phase 6 single personalized content recommendation."""

    id: str
    title: str
    why_this_fits: str
    recommended_format: Literal["LinkedIn Post", "LinkedIn Article"]
    target_audience: List[str] = Field(default_factory=list)
    growth_impact: Literal["High", "Medium", "Low"]


class TopicRecommendationsMetaResponse(BaseModel):
    """Phase 6 recommendations acquisition metadata."""

    source: Literal["cache", "generated"]
    recommendations_updated_at: Optional[str] = None


class ProfileAnalysisErrorResponse(BaseModel):
    """Structured failure from the LinkedIn analysis pipeline (Phases 1–7)."""

    failed_phase: int = Field(..., ge=1, le=7)
    phase_label: str
    error_code: str
    user_message: str
    debug_message: Optional[str] = None


class ProfileOptimizationDebugResponse(BaseModel):
    """Dev-only rubric output for Step 1 manual testing (no LLM)."""

    detected_gaps_count: int = Field(ge=0)
    rule_ids: List[str] = Field(default_factory=list)


class LinkedInProfileAcquireResponse(BaseModel):
    """Normalized own-profile snapshot with Phase 2–6 analysis context."""

    profile: Dict[str, Any] = Field(default_factory=dict)
    meta: LinkedInProfileMetaResponse
    profile_context: Dict[str, Any] = Field(default_factory=dict)
    profile_context_meta: LinkedInProfileContextMetaResponse
    profile_validation: Optional[ProfileValidationResponse] = None
    profile_completion: Optional[ProfileCompletionResponse] = None
    ai_profile_intelligence: Optional[AIProfileIntelligenceResponse] = None
    ai_profile_intelligence_meta: Optional[ProfileIntelligenceMetaResponse] = None
    recommendations: Optional[List[TopicRecommendationResponse]] = None
    recommendations_meta: Optional[TopicRecommendationsMetaResponse] = None
    recommendations_error: Optional[str] = None
    last_completed_phase: Optional[int] = Field(
        None,
        ge=1,
        le=7,
        description="Highest pipeline phase that completed successfully in this request",
    )
    analysis_error: Optional[ProfileAnalysisErrorResponse] = None
    profile_optimization_debug: Optional[ProfileOptimizationDebugResponse] = None


class LinkedInProfileCompleteRequest(BaseModel):
    """Request body for POST /api/linkedin-social/profile/complete."""

    answers: Dict[str, Any] = Field(default_factory=dict)


class LinkedInProfileCompleteResponse(BaseModel):
    """Response for POST /api/linkedin-social/profile/complete."""

    profile_context: Dict[str, Any] = Field(default_factory=dict)
    profile_validation: ProfileValidationResponse
    profile_completion: ProfileCompletionResponse
    ai_profile_intelligence: Optional[AIProfileIntelligenceResponse] = None
    ai_profile_intelligence_meta: Optional[ProfileIntelligenceMetaResponse] = None

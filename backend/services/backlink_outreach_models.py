from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl
from typing import Dict, List, Optional
from typing_extensions import Literal


class BacklinkKeywordInput(BaseModel):
    keyword: str = Field(..., min_length=2, max_length=120)
    max_results: int = Field(default=10, ge=1, le=50)


class OpportunityContactInfo(BaseModel):
    email: Optional[str] = None
    contact_page: Optional[HttpUrl] = None


class OpportunityRecord(BaseModel):
    url: HttpUrl
    title: str
    snippet: str
    metadata: Dict[str, str] = Field(default_factory=dict)
    contact_info: OpportunityContactInfo = Field(default_factory=OpportunityContactInfo)
    confidence_score: float = Field(..., ge=0.0, le=1.0)


class BacklinkDiscoveryResponse(BaseModel):
    keyword: str
    queries: List[str]
    opportunities: List[OpportunityRecord]


# -- Deep Discovery Models --

class DeepKeywordInput(BaseModel):
    keyword: str = Field(..., min_length=2, max_length=120)
    max_results: int = Field(default=15, ge=1, le=50)
    campaign_id: Optional[str] = Field(default=None, description="If set, auto-saves leads to this campaign")


class EnrichedOpportunity(BaseModel):
    url: str
    domain: str
    page_title: str = ""
    snippet: str = ""
    full_text: str = ""
    email: Optional[str] = None
    contact_page: Optional[str] = None
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    quality_score: float = Field(default=0.0, ge=0.0, le=1.0)
    word_count: int = 0
    has_guest_post_guidelines: bool = False
    discovery_source: str = "duckduckgo"


class DeepDiscoveryResponse(BaseModel):
    keyword: str
    source: str
    total_found: int
    opportunities: List[EnrichedOpportunity]


# -- AI Prospecting Models --

class AiProspectOpportunityInput(BaseModel):
    url: str
    domain: str = ""
    page_title: str = ""
    snippet: str = ""
    full_text: str = ""
    email: Optional[str] = None
    contact_page: Optional[str] = None
    quality_score: float = Field(default=0.5, ge=0.0, le=1.0)
    discovery_source: str = ""

class AiProspectRequest(BaseModel):
    keyword: str = Field(..., min_length=2, max_length=120)
    opportunities: List[AiProspectOpportunityInput] = Field(..., min_length=1, max_length=50)


class AiProspectResult(BaseModel):
    url: str
    email: Optional[str] = None
    contact_page_url: Optional[str] = None
    site_active: Optional[bool] = None
    accepts_guest_posts: Optional[bool] = None
    guidelines_summary: str = ""
    relevance_score: float = Field(default=0.5, ge=0.0, le=1.0)
    editor_name: str = ""
    pitch_angle: str = ""
    risk_flags: List[str] = Field(default_factory=list)
    ai_prospected: bool = True


class AiProspectResponse(BaseModel):
    keyword: str
    total_analyzed: int
    total_emails_found: int
    results: List[AiProspectResult]


# -- Lead Models --

class LeadCreateRequest(BaseModel):
    campaign_id: str = Field(..., min_length=1)
    url: str = Field(..., min_length=1)
    domain: str = Field(..., min_length=1)
    email: Optional[str] = None
    page_title: Optional[str] = None
    snippet: Optional[str] = None
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    notes: Optional[str] = None
    exa_author: Optional[str] = None
    exa_published_date: Optional[str] = None
    exa_summary: Optional[str] = None
    ai_editor_name: Optional[str] = None
    ai_pitch_angle: Optional[str] = None
    ai_guidelines_summary: Optional[str] = None
    ai_relevance_score: Optional[float] = None
    ai_risk_flags: Optional[str] = None


class LeadRecord(BaseModel):
    lead_id: str
    campaign_id: str
    url: Optional[str]
    domain: str
    page_title: Optional[str] = ""
    snippet: Optional[str] = ""
    email: Optional[str] = None
    confidence_score: float = 0.0
    discovery_source: Optional[str] = "duckduckgo"
    status: str = "discovered"
    notes: Optional[str] = None
    created_at: Optional[str] = None
    exa_author: Optional[str] = None
    exa_published_date: Optional[str] = None
    exa_summary: Optional[str] = None
    ai_editor_name: Optional[str] = None
    ai_pitch_angle: Optional[str] = None
    ai_guidelines_summary: Optional[str] = None
    ai_relevance_score: Optional[float] = None
    ai_risk_flags: Optional[str] = None


class LeadListResponse(BaseModel):
    leads: List[LeadRecord]
    total: int


class LeadStatusUpdateRequest(BaseModel):
    status: Literal["discovered", "contacted", "replied", "placed", "bounced", "unsubscribed"]
    notes: Optional[str] = None
    campaign_id: Optional[str] = Field(default=None, min_length=1)


class CampaignDetailResponse(BaseModel):
    campaign_id: str
    name: str
    status: str
    created_at: Optional[str] = None
    lead_count: int = 0
    leads: List[LeadRecord] = Field(default_factory=list)


class GenerateEmailRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500)
    target_site: Optional[str] = Field(None, description="Target website for guest post pitch")
    tone: str = Field(default="professional", pattern="^(professional|friendly|casual|formal)$")
    existing_template_id: Optional[str] = None


class GeneratedEmailResponse(BaseModel):
    subject: str
    body: str


class PersonalizeEmailRequest(BaseModel):
    lead_name: str = Field(..., min_length=1, max_length=200)
    lead_site: str = Field(..., min_length=1, max_length=500)
    lead_content_topic: str = Field(..., min_length=1, max_length=500)
    pitch_topic: str = Field(..., min_length=2, max_length=500)
    existing_body: str = Field(default="", max_length=10000)
    tone: str = Field(default="professional", pattern="^(professional|friendly|casual|formal)$")
    lead_summary: Optional[str] = Field(None, max_length=3000)
    lead_highlights: Optional[str] = Field(None, max_length=3000)
    lead_guidelines: Optional[str] = Field(None, max_length=3000)
    lead_pitch_angle: Optional[str] = Field(None, max_length=2000)
    lead_published_date: Optional[str] = Field(None, max_length=200)


class SubjectLinesRequest(BaseModel):
    body: str = Field(..., min_length=10, max_length=10000)
    count: int = Field(default=5, ge=1, le=10)


class SubjectLinesResponse(BaseModel):
    subjects: list[str]


class FollowUpRequest(BaseModel):
    original_subject: str = Field(..., min_length=1, max_length=500)
    original_body: str = Field(..., min_length=10, max_length=10000)
    days_elapsed: int = Field(default=7, ge=1, le=90)
    reply_context: str = Field(default="", max_length=2000)


class OutreachStatusRecord(BaseModel):
    opportunity_url: HttpUrl
    status: str
    notes: Optional[str] = None



class SenderIdentity(BaseModel):
    name: str = Field(default="", description="Human sender name displayed to the recipient")
    email: str = Field(default="")
    organization: str = Field(default="", description="Organization or brand responsible for the outreach")
    physical_mailing_address: str = Field(default="", description="Postal address required for commercial outreach compliance")
    reply_to_email: Optional[str] = Field(None, description="Optional reply-to mailbox if different from sender email")


class OneClickUnsubscribe(BaseModel):
    enabled: bool = Field(default=False)
    mailto: Optional[str] = Field(None, description="Mailbox for one-click unsubscribe requests")
    header_value: Optional[str] = Field(None, description="List-Unsubscribe / one-click unsubscribe header value")


class SendOutreachRequest(BaseModel):
    lead_id: str = Field(..., min_length=1)
    campaign_id: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    workspace_id: str = Field(default="default")
    sender_email: str = Field(..., min_length=3)
    subject: str = Field(..., min_length=1)
    body: str = Field(..., min_length=1)
    idempotency_key: str = Field(..., min_length=8)
    sender_identity: Optional[SenderIdentity] = None
    legal_basis: str = Field(default="")
    contact_discovery_source: str = Field(default="")
    recipient_region: str = Field(default="unknown")
    recipient_region_source: str = Field(default="user_attested", min_length=2)
    consent_status: str = Field(default="unknown", min_length=2)
    approved_by_human: bool = False
    unsubscribe_url: Optional[HttpUrl] = None
    one_click_unsubscribe: Optional[OneClickUnsubscribe] = None
    template_id: Optional[str] = Field(None, description="Optional template ID for personalization")
    template_variables: Optional[dict] = Field(None, description="Variable values for template personalization")


class SendOutreachResponse(BaseModel):
    attempt_id: str
    status: str
    policy_allowed: bool
    policy_reasons: List[str] = Field(default_factory=list)
    effective_sender_email: Optional[str] = None
    duplicate: bool = False
    retry_policy: Optional[str] = None


class OutreachAttemptRecord(BaseModel):
    attempt_id: str
    lead_id: str
    campaign_id: str
    idempotency_key: str
    sender_email: Optional[str] = None
    subject: Optional[str] = None
    status: str = "queued"
    decision_reason: Optional[str] = None
    sent_at: Optional[str] = None
    created_at: Optional[str] = None


class OutreachAttemptListResponse(BaseModel):
    attempts: List[OutreachAttemptRecord]
    total: int


class OutreachReplyRecord(BaseModel):
    reply_id: str
    attempt_id: str
    from_email: Optional[str] = None
    subject: Optional[str] = None
    received_at: Optional[str] = None
    classification: str = "replied"
    body: Optional[str] = None


class OutreachReplyListResponse(BaseModel):
    replies: List[OutreachReplyRecord]
    total: int


class ScheduleFollowUpRequest(BaseModel):
    attempt_id: str = Field(..., min_length=1)
    scheduled_for: str = Field(..., min_length=1)
    subject: Optional[str] = None
    body: Optional[str] = None


class FollowUpScheduleRecord(BaseModel):
    schedule_id: str
    attempt_id: str
    subject: Optional[str] = None
    scheduled_for: str
    sent: bool = False


class EmailTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    subject_template: str = Field(..., min_length=1)
    body_template: str = Field(..., min_length=1)
    variables: Optional[List[str]] = None


class EmailTemplateRecord(BaseModel):
    template_id: str
    user_id: str
    name: str
    subject_template: str
    body_template: str
    variables: Optional[List[str]] = None
    created_at: Optional[str] = None


class PolicyValidationRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    workspace_id: str = Field(..., min_length=1)
    campaign_id: str = Field(..., min_length=1)
    recipient_email: str = Field(..., min_length=1)
    recipient_domain: str
    recipient_region: str = Field(default="unknown")
    recipient_region_source: str = Field(default="user_attested", min_length=2)
    legal_basis: str = Field(default="")
    contact_discovery_source: str = Field(default="")
    consent_status: str = Field(default="unknown", min_length=2)
    approved_by_human: bool = False
    unsubscribe_url: Optional[HttpUrl] = None
    one_click_unsubscribe: Optional[OneClickUnsubscribe] = None
    sender_identity: Optional[SenderIdentity] = None
    sender_email: Optional[str] = Field(None, description="Transport sender email, if separate from identity")
    idempotency_key: str = Field(..., min_length=8)


class PolicyValidationResponse(BaseModel):
    allowed: bool
    reasons: List[str] = Field(default_factory=list)
    final_status: str


# -- Analytics & Reporting Models --

class CampaignAnalyticsResponse(BaseModel):
    campaign_id: str
    lead_count: int = 0
    send_volume: int = 0
    blocked_count: int = 0
    reply_count: int = 0
    response_rate: float = 0.0
    placement_rate: float = 0.0
    reply_classification: Dict[str, int] = Field(default_factory=dict)


class BacklinkReportingSnapshot(BaseModel):
    send_volume: int = 0
    decision_events: int = 0
    response_rate: float = 0.0
    placement_conversion: float = 0.0


class CampaignVolumePoint(BaseModel):
    date: str
    count: int = 0


class CampaignVolumeResponse(BaseModel):
    campaign_id: str
    days: int = 30
    volume: List[CampaignVolumePoint] = Field(default_factory=list)


class FunnelStage(BaseModel):
    status: str
    count: int = 0


class ConversionFunnelResponse(BaseModel):
    campaign_id: str
    stages: List[FunnelStage] = Field(default_factory=list)


class BulkStatusUpdateRequest(BaseModel):
    lead_ids: List[str] = Field(..., min_length=1)
    status: Literal["discovered", "contacted", "replied", "placed", "bounced", "unsubscribed"]
    notes: Optional[str] = None
    campaign_id: Optional[str] = Field(default=None, min_length=1)


class BulkStatusUpdateResponse(BaseModel):
    updated: int = 0
    failed: List[str] = Field(default_factory=list)


class SuppressionAddRequest(BaseModel):
    email: str = Field(..., min_length=3)
    reason: str = Field(default="")
    domain: str = Field(default="")

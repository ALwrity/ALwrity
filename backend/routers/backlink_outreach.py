"""Backlink outreach router with Clerk auth."""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response

from services.backlink_outreach_models import (
    AiProspectRequest, AiProspectResponse, AiProspectResult,
    BacklinkDiscoveryResponse, BacklinkKeywordInput, DeepKeywordInput,
    LeadCreateRequest, LeadStatusUpdateRequest,
    PolicyValidationRequest, PolicyValidationResponse,
    SendOutreachRequest, SendOutreachResponse,
    OutreachAttemptListResponse, OutreachAttemptRecord,
    OutreachReplyListResponse, OutreachReplyRecord,
    ScheduleFollowUpRequest, FollowUpScheduleRecord,
    EmailTemplateRequest, EmailTemplateRecord,
    GenerateEmailRequest, GeneratedEmailResponse,
    PersonalizeEmailRequest, SubjectLinesRequest, SubjectLinesResponse,
    FollowUpRequest,
    BacklinkReportingSnapshot,
    CampaignAnalyticsResponse, CampaignVolumeResponse,
    ConversionFunnelResponse, BulkStatusUpdateRequest, BulkStatusUpdateResponse,
    SuppressionAddRequest,
)
from services.backlink_outreach_service import backlink_outreach_service
from services.backlink_outreach_storage import (
    BacklinkCampaignNotFoundError,
    BacklinkOutreachStorageService,
)
from services.backlink_outreach_sender import backlink_outreach_sender, BacklinkOutreachSender
from services.backlink_outreach_followup_processor import process_due_followups
from services.backlink_outreach_reply_monitor import backlink_outreach_reply_monitor
from services.backlink_outreach_template_generator import (
    generate_outreach_email,
    generate_personalized_email,
    generate_subject_lines,
    generate_follow_up,
)
from middleware.auth_middleware import get_current_user
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/backlink-outreach", tags=["backlink-outreach"])


class BacklinkCampaignCreateRequest(BaseModel):
    workspace_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=3)


class SmtpConfigUpdateRequest(BaseModel):
    host: str = Field(default="smtp.gmail.com")
    port: int = Field(default=587, ge=1, le=65535)
    username: str = Field(default="")
    password: str = Field(default="")
    from_email: str = Field(default="")
    use_tls: bool = Field(default=True)
    verify_tls: bool = Field(default=True)
    timeout: int = Field(default=30, ge=1, le=120)


def _resolve_user_id(current_user: Dict[str, Any]) -> str:
    return current_user.get("id") or current_user.get("clerk_user_id") or "default"


# -- Auth-Required Endpoints --

@router.get("/modules")
async def get_backlink_module_registry(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return {"feature": "backlink_outreach", "modules": backlink_outreach_service.list_backlink_modules()}


@router.get("/query-templates")
async def get_backlink_query_templates(
    keyword: str = Query(..., min_length=1),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return {"keyword": keyword, "queries": backlink_outreach_service.generate_guest_post_queries(keyword)}


@router.post("/discover", response_model=BacklinkDiscoveryResponse)
async def discover_backlink_opportunities(
    payload: BacklinkKeywordInput,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return await backlink_outreach_service.discover_opportunities_async(payload.keyword, payload.max_results)


@router.get("/migration-coverage")
async def get_backlink_migration_coverage(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return backlink_outreach_service.get_migration_coverage()


# -- Auth-Required Endpoints --

@router.post("/discover/deep")
async def discover_deep_backlink_opportunities(
    payload: DeepKeywordInput,
    current_user: Dict[str, Any] = Depends(get_current_user),
    scrape_timeout_seconds: float = Query(15.0, ge=1.0, le=60.0),
    scrape_max_concurrency: int = Query(5, ge=1, le=20),
):
    """Enhanced discovery using Exa neural search + DuckDuckGo with full-page scraping."""
    user_id = _resolve_user_id(current_user)
    storage = None
    if payload.campaign_id:
        storage = BacklinkOutreachStorageService()
        if not storage.get_campaign(payload.campaign_id, user_id):
            raise HTTPException(status_code=404, detail="Campaign not found")

    result = await backlink_outreach_service.deep_discover(
        payload.keyword,
        payload.max_results,
        user_id=user_id,
        scrape_timeout_seconds=scrape_timeout_seconds,
        scrape_max_concurrency=scrape_max_concurrency,
    )
    if payload.campaign_id:
        saved = 0
        save_failed = 0
        for opp in result.get("opportunities", []):
            try:
                storage.add_lead(
                    campaign_id=payload.campaign_id,
                    user_id=user_id,
                    url=opp["url"],
                    domain=opp["domain"],
                    page_title=opp.get("page_title", ""),
                    snippet=opp.get("snippet", ""),
                    email=opp.get("email"),
                    confidence_score=opp.get("confidence_score", 0.0),
                    discovery_source=opp.get("discovery_source", "duckduckgo"),
                    exa_author=opp.get("exa_author"),
                    exa_published_date=opp.get("exa_published_date"),
                    exa_summary=opp.get("exa_summary"),
                )
                saved += 1
            except Exception:
                save_failed += 1
        result["saved_to_campaign"] = saved
        result["save_failed"] = save_failed
    return result


@router.post("/ai-prospect", response_model=AiProspectResponse)
async def ai_prospect_leads(
    payload: AiProspectRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Run LLM-powered analysis on discovered opportunities to extract emails and enrichment data."""
    user_id = _resolve_user_id(current_user)
    opportunities = [opp.model_dump() for opp in payload.opportunities]
    enriched = await backlink_outreach_service.ai_prospect(
        keyword=payload.keyword,
        opportunities=opportunities,
        user_id=user_id,
    )
    results = []
    emails_found = 0
    for opp in enriched:
        result = AiProspectResult(
            url=opp.get("url", ""),
            email=opp.get("email"),
            contact_page_url=opp.get("ai_contact_page") or opp.get("contact_page"),
            site_active=opp.get("ai_site_active"),
            accepts_guest_posts=opp.get("ai_accepts_guest_posts"),
            guidelines_summary=opp.get("ai_guidelines_summary", ""),
            relevance_score=opp.get("ai_relevance_score", opp.get("quality_score", 0.5)),
            editor_name=opp.get("ai_editor_name", ""),
            pitch_angle=opp.get("ai_pitch_angle", ""),
            risk_flags=opp.get("ai_risk_flags", []),
            ai_prospected=opp.get("ai_prospected", True),
        )
        if result.email:
            emails_found += 1
        results.append(result)

    return AiProspectResponse(
        keyword=payload.keyword,
        total_analyzed=len(enriched),
        total_emails_found=emails_found,
        results=results,
    )


@router.post("/campaigns")
async def create_backlink_campaign(
    payload: BacklinkCampaignCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    return storage.create_campaign(user_id, payload.workspace_id, payload.name)


@router.get("/campaigns")
async def list_backlink_campaigns(
    workspace_id: str = Query(None),
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    return {"campaigns": storage.list_campaigns(user_id, workspace_id or user_id, limit)}


@router.get("/campaigns/{campaign_id}")
async def get_backlink_campaign(
    campaign_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get campaign detail with leads."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    campaign = storage.get_campaign(campaign_id, user_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.get("/campaigns/{campaign_id}/leads")
async def list_campaign_leads(
    campaign_id: str,
    status: str = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List leads for a campaign, optionally filtered by status."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    leads = storage.list_leads(campaign_id, user_id, status=status or None)
    return {"leads": leads, "total": len(leads)}


@router.post("/campaigns/{campaign_id}/leads")
async def add_campaign_lead(
    campaign_id: str,
    payload: LeadCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Add a single lead to a campaign."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    try:
        lead = storage.add_lead(
            campaign_id=campaign_id,
            user_id=user_id,
            url=payload.url,
            domain=payload.domain,
            page_title=payload.page_title or "",
            snippet=payload.snippet or "",
            email=payload.email,
            confidence_score=payload.confidence_score,
            notes=payload.notes,
            exa_author=payload.exa_author,
            exa_published_date=payload.exa_published_date,
            exa_summary=payload.exa_summary,
            ai_editor_name=payload.ai_editor_name,
            ai_pitch_angle=payload.ai_pitch_angle,
            ai_guidelines_summary=payload.ai_guidelines_summary,
            ai_relevance_score=payload.ai_relevance_score,
            ai_risk_flags=payload.ai_risk_flags,
        )
        return lead
    except BacklinkCampaignNotFoundError:
        raise HTTPException(status_code=404, detail="Campaign not found")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to add lead")


@router.post("/leads/bulk-status", response_model=BulkStatusUpdateResponse)
async def bulk_update_lead_status(
    payload: BulkStatusUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Bulk update lead statuses for leads owned by the current user."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    access_issues = storage.get_lead_access_issues(
        payload.lead_ids, user_id, campaign_id=payload.campaign_id
    )
    if access_issues["unauthorized"]:
        raise HTTPException(
            status_code=403,
            detail={
                "message": "One or more leads do not belong to the current user",
                "lead_ids": access_issues["unauthorized"],
            },
        )
    if access_issues["missing"]:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "One or more leads were not found",
                "lead_ids": access_issues["missing"],
            },
        )

    updated = 0
    failed: list[str] = []
    for lid in payload.lead_ids:
        try:
            lead = storage.update_lead_status(
                lid,
                user_id,
                payload.status,
                payload.notes,
                campaign_id=payload.campaign_id,
            )
            if lead:
                updated += 1
            else:
                failed.append(lid)
        except PermissionError:
            raise HTTPException(
                status_code=403, detail="Lead does not belong to the current user"
            )
        except Exception:
            failed.append(lid)
    return BulkStatusUpdateResponse(updated=updated, failed=failed)


@router.patch("/leads/{lead_id}/status")
async def update_lead_status(
    lead_id: str,
    payload: LeadStatusUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update lead status (discovered -> contacted -> replied -> placed)."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    try:
        lead = storage.update_lead_status(
            lead_id,
            user_id,
            payload.status,
            payload.notes,
            campaign_id=payload.campaign_id,
        )
    except PermissionError:
        raise HTTPException(
            status_code=403, detail="Lead does not belong to the current user"
        )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.post("/policy-validate", response_model=PolicyValidationResponse)
async def validate_outreach_policy(
    payload: PolicyValidationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return backlink_outreach_service.validate_send_policy(payload)


@router.get("/reporting", response_model=BacklinkReportingSnapshot)
async def get_backlink_reporting_snapshot(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _resolve_user_id(current_user)
    return backlink_outreach_service.get_reporting_snapshot(user_id=user_id)


# -- Outreach Attempts --

@router.post("/send-outreach", response_model=SendOutreachResponse)
async def send_outreach(
    payload: SendOutreachRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Validate policy, record attempt, personalize, and send email."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    subject = payload.subject
    body = payload.body

    if payload.template_id:
        tmpl = storage.get_template(payload.template_id, user_id)
        if tmpl:
            variables = payload.template_variables or {}
            subject = backlink_outreach_sender.personalize(tmpl.get("subject_template", subject), variables)
            body = backlink_outreach_sender.personalize(tmpl.get("body_template", body), variables)

    sender_validation = backlink_outreach_sender.validate_sender_alias(payload.sender_email)
    if not sender_validation.authorized:
        return SendOutreachResponse(
            attempt_id="",
            status="failed",
            policy_allowed=False,
            policy_reasons=sender_validation.failure_reasons,
            effective_sender_email=sender_validation.effective_sender_email or None,
        )

    try:
        result = backlink_outreach_service.send_outreach(
            SendOutreachRequest(
                lead_id=payload.lead_id,
                campaign_id=payload.campaign_id,
                user_id=user_id,
                workspace_id=payload.workspace_id,
                sender_email=sender_validation.effective_sender_email,
                subject=subject,
                body=body,
                idempotency_key=payload.idempotency_key,
                sender_identity=payload.sender_identity,
                legal_basis=payload.legal_basis,
                contact_discovery_source=payload.contact_discovery_source,
                recipient_region=payload.recipient_region,
                recipient_region_source=payload.recipient_region_source,
                consent_status=payload.consent_status,
                approved_by_human=payload.approved_by_human,
                unsubscribe_url=payload.unsubscribe_url,
                one_click_unsubscribe=payload.one_click_unsubscribe,
            )
        )
    except Exception:
        existing = storage.get_attempt_by_idempotency_key(payload.idempotency_key, user_id=user_id)
        if existing:
            result = backlink_outreach_service.response_from_attempt(existing, duplicate=True)
            if sender_validation.effective_sender_email:
                result.effective_sender_email = sender_validation.effective_sender_email
            return result
        raise HTTPException(status_code=409, detail="Unable to reserve idempotency key")

    result.effective_sender_email = sender_validation.effective_sender_email

    lead_email = ""
    if result.attempt_id and result.status == "approved" and not result.duplicate:
        lead = storage.get_lead(payload.lead_id, user_id=user_id)
        lead_email = (lead.get("email") or "") if lead else ""

    if result.status == "approved" and result.policy_allowed and not result.duplicate and lead_email:
        domain = lead_email.split("@")[-1] if "@" in lead_email else "unknown"

        user_within_cap, _ = storage.try_increment_user_send_counter(user_id)
        domain_within_cap, _ = storage.try_increment_domain_send_counter(domain, user_id=user_id)
        if not (user_within_cap and domain_within_cap):
            reasons = []
            if not user_within_cap:
                reasons.append("user_daily_cap_exceeded")
            if not domain_within_cap:
                reasons.append("domain_daily_cap_exceeded")
            reason_str = f"rate_limit_hit; retry_policy={backlink_outreach_service.SMTP_RETRY_POLICY}"
            storage.update_attempt_status(result.attempt_id, "blocked", decision_reason=reason_str, user_id=user_id)
            result.status = "blocked"
            result.policy_reasons = reasons
        else:
            user_smtp = storage.get_smtp_config(user_id)
            sender = BacklinkOutreachSender(smtp_config=user_smtp) if user_smtp else backlink_outreach_sender
            send_result = await sender.send_email(
                to_email=lead_email,
                subject=subject,
                body=body,
                from_email=payload.sender_email,
            )
            if send_result.success:
                storage.update_attempt_status(result.attempt_id, "sent", user_id=user_id)
                result.status = "sent"
                result.effective_sender_email = send_result.effective_sender_email or result.effective_sender_email
                if send_result.message_id:
                    storage.update_attempt_message_id(result.attempt_id, send_result.message_id, user_id=user_id)
                storage.mark_idempotency(payload.idempotency_key, user_id)
            else:
                reason = f"smtp_send_failed; retry_policy={backlink_outreach_service.SMTP_RETRY_POLICY}"
                storage.update_attempt_status(result.attempt_id, "failed", decision_reason=reason, user_id=user_id)
                result.status = "failed"
                result.policy_reasons = ["smtp_send_failed"]
                result.retry_policy = backlink_outreach_service.SMTP_RETRY_POLICY
    elif result.status == "approved" and result.policy_allowed and not result.duplicate and not lead_email:
        reason = f"lead_has_no_email; retry_policy={backlink_outreach_service.SMTP_RETRY_POLICY}"
        storage.update_attempt_status(result.attempt_id, "failed", decision_reason=reason, user_id=user_id)
        result.status = "failed"
        result.policy_reasons = (result.policy_reasons or []) + ["lead_has_no_email"]
        result.retry_policy = backlink_outreach_service.SMTP_RETRY_POLICY

    return result


@router.get("/campaigns/{campaign_id}/attempts", response_model=OutreachAttemptListResponse)
async def list_campaign_attempts(
    campaign_id: str,
    limit: int = Query(50),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List outreach attempts for a campaign."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    attempts = storage.list_attempts(campaign_id, limit, user_id=user_id)
    return {"attempts": attempts, "total": len(attempts)}


# -- Replies --

@router.get("/campaigns/{campaign_id}/replies", response_model=OutreachReplyListResponse)
async def list_campaign_replies(
    campaign_id: str,
    limit: int = Query(50),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List received replies for a campaign."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    replies = storage.list_replies(campaign_id, limit, user_id=user_id)
    return {"replies": replies, "total": len(replies)}


@router.post("/replies/poll")
async def poll_replies(
    sent_from_email: str = Query(..., min_length=3),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Poll IMAP inbox for new replies and store them."""
    user_id = _resolve_user_id(current_user)
    if not backlink_outreach_reply_monitor.is_configured():
        raise HTTPException(status_code=503, detail="IMAP not configured")

    storage = BacklinkOutreachStorageService()
    raw_replies = await backlink_outreach_reply_monitor.poll_replies(sent_from_email)
    stored = []
    skipped = 0
    failed = 0
    for raw in raw_replies:
        try:
            from_email = raw.get("from_email", "")
            subject = raw.get("subject", "")
            if storage.reply_exists(from_email, subject, user_id=user_id):
                skipped += 1
                continue

            attempt_id = ""
            in_reply_to = raw.get("in_reply_to", "")
            references = raw.get("references", "")
            if in_reply_to:
                attempt_id = storage.find_attempt_by_message_id(in_reply_to, user_id=user_id) or ""
            if not attempt_id and references:
                mid = references.split()[-1]
                attempt_id = storage.find_attempt_by_message_id(mid, user_id=user_id) or ""
            if not attempt_id:
                attempt_id = storage.find_attempt_by_from_email(from_email, user_id=user_id) or ""

            reply = storage.add_reply(
                attempt_id=attempt_id,
                from_email=from_email,
                subject=subject,
                body=raw.get("body", ""),
                classification=raw.get("classification", "replied"),
                user_id=user_id,
            )
            stored.append(reply)
        except Exception:
            failed += 1
    return {"polled": len(raw_replies), "stored": len(stored), "skipped": skipped, "failed": failed, "replies": stored}


# -- Follow-ups --

@router.post("/campaigns/{campaign_id}/schedule-followup")
async def schedule_followup(
    campaign_id: str,
    payload: ScheduleFollowUpRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Schedule a follow-up for an outreach attempt."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    sched = storage.schedule_followup(
        attempt_id=payload.attempt_id,
        scheduled_for=payload.scheduled_for,
        subject=payload.subject or "",
        body=payload.body or "",
        user_id=user_id,
    )
    return {"campaign_id": campaign_id, "schedule": sched}


@router.get("/campaigns/{campaign_id}/followups")
async def list_followups(
    campaign_id: str,
    limit: int = Query(50),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List scheduled follow-ups for a campaign. Processes due follow-ups before returning."""
    user_id = _resolve_user_id(current_user)
    process_due_followups(user_id=user_id)
    storage = BacklinkOutreachStorageService()
    followups = storage.list_followups(campaign_id, limit, user_id=user_id)
    return {"followups": followups, "total": len(followups)}


@router.post("/followups/process")
async def process_due_followups_endpoint(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Manually trigger processing of due follow-ups."""
    user_id = _resolve_user_id(current_user)
    sent_count = process_due_followups(user_id=user_id)
    return {"processed": True, "sent_count": sent_count}


# -- Email Templates --

@router.post("/templates")
async def create_template(
    payload: EmailTemplateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create an email template."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    return storage.create_template(
        user_id=user_id,
        name=payload.name,
        subject_template=payload.subject_template,
        body_template=payload.body_template,
        variables=payload.variables,
    )


@router.get("/templates")
async def list_templates(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List email templates for the authenticated user."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    return {"templates": storage.list_templates(user_id)}


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get a specific email template."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    tmpl = storage.get_template(template_id, user_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tmpl


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete an email template."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    if not storage.delete_template(template_id, user_id):
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True}


@router.post("/templates/generate", response_model=GeneratedEmailResponse)
async def generate_email_template(
    payload: GenerateEmailRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate an outreach email using AI."""
    user_id = _resolve_user_id(current_user)
    existing_body = None
    if payload.existing_template_id:
        storage = BacklinkOutreachStorageService()
        tmpl = storage.get_template(payload.existing_template_id, user_id)
        if tmpl:
            existing_body = tmpl.get("body_template")

    result = generate_outreach_email(
        topic=payload.topic,
        target_site=payload.target_site,
        tone=payload.tone,
        user_id=user_id,
        existing_body=existing_body,
    )
    return result


@router.post("/generate/personalized", response_model=GeneratedEmailResponse)
async def generate_personalized_email_endpoint(
    payload: PersonalizeEmailRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate a personalized outreach email for a specific lead with contextual data."""
    user_id = _resolve_user_id(current_user)
    result = generate_personalized_email(
        lead_name=payload.lead_name,
        lead_site=payload.lead_site,
        lead_content_topic=payload.lead_content_topic,
        pitch_topic=payload.pitch_topic,
        existing_body=payload.existing_body,
        user_id=user_id,
        tone=payload.tone,
        lead_summary=payload.lead_summary,
        lead_highlights=payload.lead_highlights,
        lead_guidelines=payload.lead_guidelines,
        lead_pitch_angle=payload.lead_pitch_angle,
        lead_published_date=payload.lead_published_date,
    )
    return result


@router.post("/generate/subject-lines", response_model=SubjectLinesResponse)
async def generate_subject_lines_endpoint(
    payload: SubjectLinesRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate subject line suggestions for an email body."""
    user_id = _resolve_user_id(current_user)
    subjects = generate_subject_lines(
        body=payload.body,
        count=payload.count,
        user_id=user_id,
    )
    return {"subjects": subjects}


@router.post("/generate/follow-up", response_model=GeneratedEmailResponse)
async def generate_follow_up_endpoint(
    payload: FollowUpRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate a follow-up email for an outreach attempt."""
    user_id = _resolve_user_id(current_user)
    result = generate_follow_up(
        original_subject=payload.original_subject,
        original_body=payload.original_body,
        days_elapsed=payload.days_elapsed,
        reply_context=payload.reply_context,
        user_id=user_id,
    )
    return result


# -- Suppression --

@router.get("/suppression")
async def list_suppression(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List suppressed recipients."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    return {"suppressed": storage.list_suppressed(user_id)}


@router.post("/suppression")
async def add_suppression(
    payload: SuppressionAddRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Add a recipient to the suppression list."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    return storage.add_suppressed(email=payload.email, domain=payload.domain, reason=payload.reason, user_id=user_id)


@router.delete("/suppression/{suppression_id}")
async def delete_suppression(
    suppression_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Remove a recipient from the suppression list."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    if not storage.delete_suppressed(suppression_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Suppression entry not found")
    return {"deleted": True}


# -- User SMTP Config --

@router.get("/smtp-config")
async def get_user_smtp_config(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get the authenticated user's SMTP configuration."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    cfg = storage.get_smtp_config(user_id)
    if not cfg:
        return {}
    return cfg


@router.put("/smtp-config")
async def set_user_smtp_config(
    payload: SmtpConfigUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create or update the authenticated user's SMTP configuration."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    return storage.set_smtp_config(user_id=user_id, **payload.model_dump())


@router.delete("/smtp-config")
async def delete_user_smtp_config(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete the authenticated user's SMTP configuration (revert to env defaults)."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    if not storage.delete_smtp_config(user_id):
        raise HTTPException(status_code=404, detail="SMTP config not found")
    return {"deleted": True}


@router.get("/campaigns/{campaign_id}/analytics/volume", response_model=CampaignVolumeResponse)
async def get_campaign_analytics_volume(
    campaign_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get daily send volume for a campaign over the last N days."""
    user_id = _resolve_user_id(current_user)
    return backlink_outreach_service.get_campaign_volume(campaign_id, days, user_id=user_id)


@router.get("/campaigns/{campaign_id}/analytics/funnel", response_model=ConversionFunnelResponse)
async def get_campaign_analytics_funnel(
    campaign_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get conversion funnel (lead status breakdown) for a campaign."""
    user_id = _resolve_user_id(current_user)
    return backlink_outreach_service.get_campaign_funnel(campaign_id, user_id=user_id)


@router.get("/campaigns/{campaign_id}/export/leads")
async def export_campaign_leads_csv(
    campaign_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Export campaign leads as CSV."""
    user_id = _resolve_user_id(current_user)
    csv_content = backlink_outreach_service.export_leads_csv(campaign_id, user_id=user_id)
    return Response(content=csv_content, media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=leads_{campaign_id}.csv"})


@router.get("/campaigns/{campaign_id}/export/attempts")
async def export_campaign_attempts_csv(
    campaign_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Export campaign outreach attempts as CSV."""
    user_id = _resolve_user_id(current_user)
    csv_content = backlink_outreach_service.export_attempts_csv(campaign_id, user_id=user_id)
    return Response(content=csv_content, media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=attempts_{campaign_id}.csv"})


@router.get("/campaigns/{campaign_id}/export/replies")
async def export_campaign_replies_csv(
    campaign_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Export campaign replies as CSV."""
    user_id = _resolve_user_id(current_user)
    csv_content = backlink_outreach_service.export_replies_csv(campaign_id, user_id=user_id)
    return Response(content=csv_content, media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=replies_{campaign_id}.csv"})


# -- Audit Log --

@router.get("/audit-logs")
async def list_audit_logs(
    campaign_id: str = Query(None),
    limit: int = Query(100),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List audit log entries, optionally filtered by campaign."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    return {"logs": storage.list_audit_logs(campaign_id or None, limit, user_id=user_id)}


# -- Analytics --

@router.get("/campaigns/{campaign_id}/analytics", response_model=CampaignAnalyticsResponse)
async def get_campaign_analytics(
    campaign_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get campaign analytics: send volume, response/placement rates, reply breakdown."""
    user_id = _resolve_user_id(current_user)
    storage = BacklinkOutreachStorageService()
    campaign = storage.get_campaign(campaign_id, user_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    attempts = storage.list_attempts(campaign_id, user_id=user_id)
    replies = storage.list_replies(campaign_id, user_id=user_id)
    leads = storage.list_leads_all(campaign_id, user_id=user_id)

    total_sent = sum(1 for a in attempts if a.get("status") == "sent")
    total_blocked = sum(1 for a in attempts if a.get("status") == "blocked")
    total_replied = len(replies)
    total_placed = sum(1 for l in leads if l.get("status") == "placed")

    reply_classification = {}
    for r in replies:
        cls = r.get("classification", "replied")
        reply_classification[cls] = reply_classification.get(cls, 0) + 1

    return CampaignAnalyticsResponse(
        campaign_id=campaign_id,
        lead_count=campaign.get("lead_count", 0),
        send_volume=total_sent,
        blocked_count=total_blocked,
        reply_count=total_replied,
        response_rate=round(total_replied / total_sent, 4) if total_sent > 0 else 0.0,
        placement_rate=round(total_placed / campaign.get("lead_count", 1), 4) if campaign.get("lead_count", 0) > 0 else 0.0,
        reply_classification=reply_classification,
    )
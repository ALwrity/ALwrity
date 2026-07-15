"""Canonical backlink outreach service entrypoint."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import quote
import asyncio
import re

import httpx
from bs4 import BeautifulSoup

import csv
import io

from services.backlink_outreach_models import (
    OpportunityContactInfo, OpportunityRecord,
    PolicyValidationRequest, PolicyValidationResponse,
    SendOutreachRequest, SendOutreachResponse,
    CampaignVolumeResponse, CampaignVolumePoint,
    ConversionFunnelResponse, FunnelStage,
)
from services.backlink_outreach_storage import BacklinkOutreachStorageService

@dataclass
class SearchResult:
    url: str
    title: str
    snippet: str


class BacklinkOutreachService:
    def list_backlink_modules(self) -> List[Dict[str, Any]]:
        return [
            {"identifier": "backlink", "module_path": "backend/services/backlink_outreach_service.py", "purpose": "Canonical backlink service facade"},
            {"identifier": "outreach", "module_path": "backend/routers/backlink_outreach.py", "purpose": "HTTP API entrypoint for backlink outreach"},
            {"identifier": "guest_post", "module_path": "frontend/src/api/backlinkOutreachApi.ts", "purpose": "Frontend API integration for guest-post workflows"},
        ]

    def generate_guest_post_queries(self, keyword: str) -> List[str]:
        normalized = (keyword or "").strip()
        if not normalized:
            return []
        return [
            f"{normalized} + 'Guest Contributor'",
            f"{normalized} + 'Add Guest Post'",
            f"{normalized} + 'Guest Bloggers Wanted'",
            f"{normalized} + 'Write for Us'",
            f"{normalized} + 'Submit Guest Post'",
            f"{normalized} + 'Become a Guest Blogger'",
            f"{normalized} + 'guest post opportunities'",
            f"{normalized} + 'Submit article'",
        ]

    async def search_for_urls(
        self,
        query: str,
        timeout_seconds: int = 12,
        retries: int = 2,
        client: Optional[httpx.AsyncClient] = None,
    ) -> List[SearchResult]:
        """Search DuckDuckGo HTML using a non-blocking HTTP client."""
        encoded_query = quote(query)
        url = f"https://duckduckgo.com/html/?q={encoded_query}"
        headers = {"User-Agent": "Mozilla/5.0 ALwrityBacklinkBot/1.0"}

        async def _request(active_client: httpx.AsyncClient) -> List[SearchResult]:
            for attempt in range(retries + 1):
                try:
                    response = await active_client.get(url, headers=headers)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, "html.parser")
                    rows: List[SearchResult] = []
                    for result in soup.select("div.result")[:10]:
                        anchor = result.select_one("a.result__a")
                        snippet = result.select_one("a.result__snippet") or result.select_one("div.result__snippet")
                        if not anchor or not anchor.get("href"):
                            continue
                        rows.append(
                            SearchResult(
                                url=anchor.get("href"),
                                title=anchor.get_text(strip=True),
                                snippet=snippet.get_text(" ", strip=True) if snippet else "",
                            )
                        )
                    return rows
                except (httpx.HTTPError, httpx.TimeoutException):
                    if attempt == retries:
                        return []
                    await asyncio.sleep(0.6 * (attempt + 1))
            return []

        if client is not None:
            return await _request(client)

        timeout = httpx.Timeout(timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as owned_client:
            return await _request(owned_client)

    async def discover_opportunities_async(self, keyword: str, max_results: int = 10) -> Dict[str, Any]:
        queries = self.generate_guest_post_queries(keyword)[:4]
        dedup: Dict[str, SearchResult] = {}

        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0), follow_redirects=True) as client:
            for query in queries:
                for result in await self.search_for_urls(query, client=client):
                    normalized_url = self._normalize_url(result.url)
                    if not normalized_url or normalized_url in dedup:
                        continue
                    dedup[normalized_url] = result
                    if len(dedup) >= max_results:
                        break
                if len(dedup) >= max_results:
                    break
                await asyncio.sleep(0.4)

        opportunities: List[OpportunityRecord] = []
        for normalized_url, row in dedup.items():
            contact = self._extract_contact_info(row.snippet)
            score = self._score_confidence(row.title, row.snippet)
            opportunities.append(
                OpportunityRecord(
                    url=normalized_url,
                    title=row.title or "Untitled",
                    snippet=row.snippet,
                    metadata={"source": "duckduckgo_html", "query_keyword": keyword},
                    contact_info=contact,
                    confidence_score=score,
                )
            )

        return {"keyword": keyword, "queries": queries, "opportunities": opportunities}

    def discover_opportunities(self, keyword: str, max_results: int = 10) -> Dict[str, Any]:
        """Synchronous compatibility wrapper for non-async callers."""
        return asyncio.run(self.discover_opportunities_async(keyword, max_results))

    def _normalize_url(self, url: str) -> str:
        u = (url or "").strip()
        if not u:
            return ""
        if u.startswith("//"):
            u = f"https:{u}"
        if not re.match(r"^https?://", u):
            return ""
        return u.split("#")[0].rstrip("/")

    def _extract_contact_info(self, text: str) -> OpportunityContactInfo:
        if not text:
            return OpportunityContactInfo()
        email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
        return OpportunityContactInfo(email=email_match.group(0) if email_match else None)

    def _score_confidence(self, title: str, snippet: str) -> float:
        hay = f"{title} {snippet}".lower()
        cues = ["write for us", "guest post", "submit", "contributor", "guest blogger"]
        hits = sum(1 for cue in cues if cue in hay)
        return min(1.0, 0.35 + (0.13 * hits))


    def _get_storage(self) -> BacklinkOutreachStorageService:
        return BacklinkOutreachStorageService()

    CONSENT_REQUIRED_REGIONS = {"eu", "eea", "uk", "ca"}
    MANUAL_REVIEW_REGIONS = {"unknown", "br", "cn", "jp", "kr"}
    LOW_CONFIDENCE_REGION_SOURCES = {"tld_inference", "domain_tld", "inferred", "unknown"}
    VALID_LEGAL_BASES = {"legitimate_interest", "consent", "contract"}
    VALID_CONSENT_STATUSES = {"explicit", "implied", "not_required", "unknown"}

    @staticmethod
    def _has_one_click_unsubscribe(payload: PolicyValidationRequest) -> bool:
        one_click = payload.one_click_unsubscribe
        if not one_click or not one_click.enabled:
            return False
        return bool(one_click.mailto or (one_click.header_value or "").strip())

    def validate_send_policy(self, payload: PolicyValidationRequest) -> PolicyValidationResponse:
        reasons: List[str] = []
        storage = self._get_storage()

        legal_basis = payload.legal_basis.strip().lower()
        recipient_region = payload.recipient_region.strip().lower()
        region_source = payload.recipient_region_source.strip().lower()
        consent_status = payload.consent_status.strip().lower()
        discovery_source = payload.contact_discovery_source.strip()
        sender = payload.sender_identity

        if payload.workspace_id.startswith("new-") and not payload.approved_by_human:
            reasons.append("human_review_required_for_new_workspace")
        if not legal_basis:
            reasons.append("legal_basis_required")
        elif legal_basis not in self.VALID_LEGAL_BASES:
            reasons.append("invalid_legal_basis_recorded")
        if not discovery_source:
            reasons.append("contact_discovery_source_required")
        if consent_status not in self.VALID_CONSENT_STATUSES:
            reasons.append("invalid_consent_status")

        has_unsubscribe = bool(payload.unsubscribe_url) or self._has_one_click_unsubscribe(payload)
        if not has_unsubscribe:
            reasons.append("unsubscribe_url_or_one_click_unsubscribe_required")

        if not sender:
            reasons.append("complete_sender_identity_required")
        else:
            sender_email = str(sender.email).strip()
            if not sender.name.strip():
                reasons.append("sender_name_required")
            if not sender_email:
                reasons.append("sender_email_required")
            elif not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", sender_email):
                reasons.append("sender_email_invalid")
            if not sender.organization.strip():
                reasons.append("sender_organization_required")
            if not sender.physical_mailing_address.strip():
                reasons.append("sender_physical_mailing_address_required")
            if payload.sender_email and sender_email.lower() != str(payload.sender_email).lower():
                reasons.append("sender_identity_email_mismatch")

        if recipient_region in self.CONSENT_REQUIRED_REGIONS:
            if legal_basis != "consent" or consent_status != "explicit":
                reasons.append("region_requires_recorded_explicit_consent")
        elif recipient_region in self.MANUAL_REVIEW_REGIONS and not payload.approved_by_human:
            reasons.append("manual_review_required_for_recipient_region")

        if region_source in self.LOW_CONFIDENCE_REGION_SOURCES and not payload.approved_by_human:
            reasons.append("manual_review_required_for_tld_or_unknown_region_source")

        if storage.is_suppressed(str(payload.recipient_email), payload.recipient_domain, user_id=payload.user_id):
            reasons.append("recipient_suppressed")
        if storage.check_idempotency(payload.idempotency_key, user_id=payload.user_id):
            reasons.append("duplicate_idempotency_key")

        allowed = len(reasons) == 0
        final_status = "approved" if allowed else "blocked"

        storage.add_audit_log(
            event="policy_check",
            user_id=payload.user_id,
            campaign_id=payload.campaign_id,
            recipient=str(payload.recipient_email),
            allowed=allowed,
            reasons=reasons,
            override=payload.approved_by_human,
        )

        return PolicyValidationResponse(allowed=allowed, reasons=reasons, final_status=final_status)

    EU_DOMAIN_SUFFIXES = (".de", ".fr", ".it", ".es", ".nl", ".be", ".at", ".se", ".dk", ".fi", ".pt", ".ie", ".gr", ".pl", ".cz", ".ro", ".hu", ".bg", ".hr", ".sk", ".si", ".ee", ".lv", ".lt", ".lu", ".mt", ".cy")

    def _infer_region(self, domain: str) -> str:
        d = domain.lower()
        if any(d.endswith(s) or d.endswith(s + "/") for s in self.EU_DOMAIN_SUFFIXES):
            return "eu"
        if d.endswith(".uk"):
            return "uk"
        if d.endswith(".ca"):
            return "ca"
        if d.endswith(".au"):
            return "au"
        return "unknown"


    SMTP_RETRY_POLICY = "manual_retry_with_new_idempotency_key"

    @staticmethod
    def _decision_parts(attempt: Optional[dict]) -> List[str]:
        if not attempt:
            return []
        reason = attempt.get("decision_reason") or ""
        return [part.strip() for part in reason.split(";") if part.strip()]

    def response_from_attempt(self, attempt: Optional[dict], duplicate: bool = False) -> SendOutreachResponse:
        if not attempt:
            return SendOutreachResponse(
                attempt_id="",
                status="duplicate",
                policy_allowed=False,
                policy_reasons=["duplicate_idempotency_key"],
                duplicate=True,
            )

        status = attempt.get("status", "failed")
        parts = self._decision_parts(attempt)
        retry_policy = next((part.split("=", 1)[1] for part in parts if part.startswith("retry_policy=")), None)
        reasons = [part for part in parts if not part.startswith("retry_policy=")]
        if not retry_policy and ("smtp_send_failed" in reasons or "lead_has_no_email" in reasons):
            retry_policy = self.SMTP_RETRY_POLICY
        policy_allowed = status in {"queued", "approved", "sent", "failed"} and not any(
            reason.startswith("human_review_required")
            or reason in {
                "invalid_legal_basis",
                "region_requires_explicit_consent",
                "sender_identity_required",
                "recipient_suppressed",
                "user_daily_cap_exceeded",
                "domain_daily_cap_exceeded",
            }
            for reason in reasons
        )
        if status == "blocked":
            policy_allowed = False
        return SendOutreachResponse(
            attempt_id=attempt.get("attempt_id", ""),
            status=status,
            policy_allowed=policy_allowed,
            policy_reasons=reasons,
            duplicate=duplicate,
            retry_policy=retry_policy,
        )

    def send_outreach(self, request: SendOutreachRequest) -> SendOutreachResponse:
        storage = self._get_storage()
        lead = storage.get_lead(request.lead_id, user_id=request.user_id)
        if not lead:
            return SendOutreachResponse(attempt_id="", status="failed", policy_allowed=False, policy_reasons=["lead_not_found"])

        reservation = storage.reserve_attempt_idempotency(
            lead_id=request.lead_id,
            campaign_id=request.campaign_id,
            idempotency_key=request.idempotency_key,
            sender_email=request.sender_email,
            subject=request.subject,
            body=request.body,
            user_id=request.user_id,
        )
        if not reservation.get("reserved"):
            return self.response_from_attempt(reservation.get("attempt"), duplicate=True)

        attempt = reservation.get("attempt") or {}
        attempt_id = attempt.get("attempt_id", "")
        domain = lead.get("domain", request.sender_email.split("@")[-1] if "@" in request.sender_email else "unknown")
        recipient_region = (request.recipient_region or "unknown").strip().lower()
        if recipient_region == "unknown":
            recipient_region = self._infer_region(domain)
            region_source = "tld_inference" if recipient_region != "unknown" else request.recipient_region_source
        else:
            region_source = request.recipient_region_source

        policy_req = PolicyValidationRequest(
            user_id=request.user_id,
            workspace_id=request.workspace_id,
            campaign_id=request.campaign_id,
            recipient_email=lead.get("email", ""),
            recipient_domain=domain,
            recipient_region=recipient_region,
            recipient_region_source=region_source,
            legal_basis=request.legal_basis,
            contact_discovery_source=request.contact_discovery_source,
            consent_status=request.consent_status,
            approved_by_human=request.approved_by_human,
            unsubscribe_url=request.unsubscribe_url,
            one_click_unsubscribe=request.one_click_unsubscribe,
            sender_identity=request.sender_identity,
            sender_email=request.sender_email,
            idempotency_key=request.idempotency_key,
        )
        policy = self.validate_send_policy(policy_req)

        updated_attempt = storage.update_attempt_status(
            attempt_id,
            "approved" if policy.allowed else "blocked",
            decision_reason="; ".join(policy.reasons) if policy.reasons else None,
            user_id=request.user_id,
        ) or attempt

        return SendOutreachResponse(
            attempt_id=updated_attempt.get("attempt_id", attempt_id),
            status=updated_attempt.get("status", "failed"),
            policy_allowed=policy.allowed,
            policy_reasons=policy.reasons,
            effective_sender_email=request.sender_email,
        )

    def get_reporting_snapshot(self, user_id: str = "default") -> Dict[str, Any]:
        storage = self._get_storage()
        campaigns = storage.list_campaigns(user_id, user_id, limit=100)
        total_sent = 0
        total_replied = 0
        total_placed = 0
        total_leads = 0
        for c in campaigns:
            cid = c["campaign_id"]
            attempts = storage.list_attempts(cid, limit=10000, user_id=user_id)
            leads = storage.list_leads_all(cid, user_id=user_id)
            total_sent += sum(1 for a in attempts if a.get("status") == "sent")
            total_replied += storage.count_replies(cid, user_id=user_id)
            total_placed += sum(1 for l in leads if l.get("status") == "placed")
            total_leads += len(leads)
        logs = storage.list_audit_logs("", limit=1000, user_id=user_id)
        return {
            "send_volume": total_sent,
            "decision_events": len(logs),
            "response_rate": round(total_replied / total_sent, 4) if total_sent > 0 else 0.0,
            "placement_conversion": round(total_placed / total_leads, 4) if total_leads > 0 else 0.0,
        }

    def get_campaign_volume(self, campaign_id: str, days: int = 30, user_id: str = "default") -> CampaignVolumeResponse:
        storage = self._get_storage()
        points = storage.get_send_volume_by_day(campaign_id, days, user_id=user_id)
        return CampaignVolumeResponse(
            campaign_id=campaign_id, days=days,
            volume=[CampaignVolumePoint(**p) for p in points],
        )

    def get_campaign_funnel(self, campaign_id: str, user_id: str = "default") -> ConversionFunnelResponse:
        storage = self._get_storage()
        stages = storage.get_lead_status_counts(campaign_id, user_id=user_id)
        return ConversionFunnelResponse(
            campaign_id=campaign_id,
            stages=[FunnelStage(**s) for s in stages],
        )

    CSV_LEAD_FIELDS = ["lead_id", "campaign_id", "domain", "page_title", "email", "status", "discovery_source", "created_at"]
    CSV_ATTEMPT_FIELDS = ["attempt_id", "lead_id", "campaign_id", "sender_email", "subject", "status", "sent_at", "created_at"]
    CSV_REPLY_FIELDS = ["reply_id", "attempt_id", "from_email", "subject", "classification", "received_at"]

    @staticmethod
    def _sanitize_csv_value(value: Any) -> str:
        s = str(value) if value is not None else ""
        if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
            s = "'" + s
        return s

    def export_leads_csv(self, campaign_id: str, user_id: str = "default") -> str:
        storage = self._get_storage()
        leads = storage.list_leads_all(campaign_id, user_id=user_id)
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=self.CSV_LEAD_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in leads:
            writer.writerows([{k: self._sanitize_csv_value(v) for k, v in row.items()}])
        return output.getvalue()

    def export_attempts_csv(self, campaign_id: str, user_id: str = "default") -> str:
        storage = self._get_storage()
        attempts = storage.list_attempts_all(campaign_id, user_id=user_id)
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=self.CSV_ATTEMPT_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in attempts:
            writer.writerows([{k: self._sanitize_csv_value(v) for k, v in row.items()}])
        return output.getvalue()

    def export_replies_csv(self, campaign_id: str, user_id: str = "default") -> str:
        storage = self._get_storage()
        replies = storage.list_replies_all(campaign_id, user_id=user_id)
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=self.CSV_REPLY_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in replies:
            writer.writerows([{k: self._sanitize_csv_value(v) for k, v in row.items()}])
        return output.getvalue()

    async def deep_discover(
        self,
        keyword: str,
        max_results: int = 15,
        user_id: Optional[str] = None,
        scrape_timeout_seconds: float = 15.0,
        scrape_max_concurrency: int = 5,
    ) -> Dict[str, Any]:
        """Enhanced discovery using Exa neural search + DuckDuckGo with full-page scraping."""
        from services.backlink_outreach_scraper import BacklinkOutreachScraper
        scraper = BacklinkOutreachScraper(user_id=user_id)
        return await scraper.deep_discover(
            keyword,
            max_results,
            scrape_timeout_seconds=scrape_timeout_seconds,
            scrape_max_concurrency=scrape_max_concurrency,
        )

    def get_migration_coverage(self) -> Dict[str, Any]:
        implemented = [
            "discoverable backend router + service",
            "frontend API/store/UI integration point",
            "legacy guest-post search query generation templates",
            "provider-backed URL discovery + normalization + deduplication",
            "typed opportunity records and confidence score",
            "deep webpage scraping + contact-page extraction via Exa",
            "quality scoring and guest-post signal detection",
            "DB-backed policy validation with suppression & idempotency",
            "outreach attempt recording + status lifecycle",
            "SMTP email sending via backlink_outreach_sender",
            "IMAP reply polling with auto-classification",
            "follow-up scheduling with sent tracking",
            "email template CRUD + AI generation (llm_text_gen)",
            "personalized send via template variables",
        ]
        planned = [
            "follow-up orchestration and campaign analytics",
        ]
        return {
            "legacy_reference": "ToBeMigrated/ai_marketing_tools/ai_backlinker/ai_backlinking.py",
            "implemented_count": len(implemented),
            "planned_count": len(planned),
            "implemented": implemented,
            "planned": planned,
        }

    async def ai_prospect(
        self,
        keyword: str,
        opportunities: List[Dict[str, Any]],
        user_id: str,
    ) -> List[Dict[str, Any]]:
        """Run AI-powered analysis on discovered opportunities to extract deeper insights."""
        from services.backlink_outreach_scraper import BacklinkOutreachScraper
        scraper = BacklinkOutreachScraper(user_id=user_id)
        return await scraper.ai_prospect_opportunities(opportunities, keyword, user_id)


backlink_outreach_service = BacklinkOutreachService()

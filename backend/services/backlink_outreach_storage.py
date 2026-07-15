"""Backlink outreach persistence service (campaign-creator style)."""

from __future__ import annotations

from datetime import datetime, date
from uuid import uuid4
from typing import List, Optional
from sqlalchemy import text as sql_text, func as sa_func
from sqlalchemy.exc import IntegrityError
from loguru import logger

LEAD_VALID_STATUSES = frozenset({"discovered", "contacted", "replied", "placed", "bounced", "unsubscribed"})

from services.database import get_session_for_user
from models.backlink_outreach_models import (
    Base, BacklinkCampaign, BacklinkLead,
    OutreachAttempt, OutreachReply, FollowUpSchedule, EmailTemplate,
    SuppressedRecipient, SentIdempotencyKey, AuditLogEntry,
    SendCounterUser, SendCounterDomain, UserSmtpConfig,
)


class BacklinkCampaignNotFoundError(RuntimeError):
    """Raised when a backlink campaign is missing or not owned by the user."""


import os

DEFAULT_USER_DAILY_CAP = int(os.getenv("BACKLINK_USER_DAILY_CAP", "100"))
DEFAULT_DOMAIN_DAILY_CAP = int(os.getenv("BACKLINK_DOMAIN_DAILY_CAP", "20"))


class BacklinkOutreachStorageService:
    def _ensure_tables(self, user_id: str) -> None:
        db = get_session_for_user(user_id)
        if not db:
            return
        try:
            Base.metadata.create_all(bind=db.get_bind(), checkfirst=True)
            self._migrate_lead_columns(db)
        finally:
            db.close()

    def _migrate_lead_columns(self, db) -> None:
        """Add new columns to backlink_leads if missing.

        Uses PRAGMA table_info (compatible with all SQLite versions) instead of
        the newer ADD COLUMN IF NOT EXISTS syntax which requires SQLite ≥ 3.37.
        """
        LEAD_BACKFILL_COLUMNS: list[tuple[str, str, str]] = [
            # (column_name, column_type, default_expr)
            ("exa_author", "TEXT", ""),
            ("exa_published_date", "TEXT", ""),
            ("exa_summary", "TEXT", ""),
            ("ai_editor_name", "TEXT", ""),
            ("ai_pitch_angle", "TEXT", ""),
            ("ai_guidelines_summary", "TEXT", ""),
            ("ai_risk_flags", "TEXT", ""),
            ("ai_relevance_score", "FLOAT", ""),
        ]
        try:
            table_check = db.execute(sql_text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='backlink_leads'"
            )).fetchone()
            if not table_check:
                return

            existing = {
                row[1]
                for row in db.execute(sql_text("PRAGMA table_info(backlink_leads)")).fetchall()
            }

            for col_name, col_type, col_default in LEAD_BACKFILL_COLUMNS:
                if col_name in existing:
                    continue
                default_clause = f" DEFAULT {col_default}" if col_default else ""
                safe_name = col_name.replace('"', "").replace(";", "")
                db.execute(sql_text(
                    f'ALTER TABLE backlink_leads ADD COLUMN "{safe_name}" {col_type}{default_clause}'
                ))
                logger.warning(f"Auto-migrated backlink_leads column '{col_name}' ({col_type})")

            db.commit()
        except Exception as exc:
            logger.error(f"Failed to backfill backlink_leads columns: {exc}")
            db.rollback()

    def create_campaign(self, user_id: str, workspace_id: str, name: str) -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            campaign = BacklinkCampaign(
                id=f"bl_{uuid4().hex[:16]}",
                user_id=user_id,
                workspace_id=workspace_id,
                name=name,
                status="drafted",
                created_at=datetime.utcnow(),
            )
            db.add(campaign)
            db.commit()
            return {"campaign_id": campaign.id, "name": campaign.name, "status": campaign.status}
        finally:
            db.close()

    def list_campaigns(self, user_id: str, workspace_id: str, limit: int = 50) -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(BacklinkCampaign)
                .filter(BacklinkCampaign.user_id == user_id, BacklinkCampaign.workspace_id == workspace_id)
                .order_by(BacklinkCampaign.created_at.desc())
                .limit(limit)
                .all()
            )
            return [{"campaign_id": r.id, "name": r.name, "status": r.status, "created_at": r.created_at.isoformat()} for r in rows]
        finally:
            db.close()

    def get_campaign(self, campaign_id: str, user_id: str) -> Optional[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            campaign = (
                db.query(BacklinkCampaign)
                .filter(BacklinkCampaign.id == campaign_id, BacklinkCampaign.user_id == user_id)
                .first()
            )
            if not campaign:
                return None
            lead_count = 0
            leads: list = []
            try:
                lead_count = db.query(BacklinkLead).filter(BacklinkLead.campaign_id == campaign_id).count()
                leads = (
                    db.query(BacklinkLead)
                    .filter(BacklinkLead.campaign_id == campaign_id)
                    .order_by(BacklinkLead.created_at.desc())
                    .limit(50)
                    .all()
                )
            except Exception as query_err:
                logger.error(f"Failed to query leads for campaign {campaign_id}: {query_err}")
            return {
                "campaign_id": campaign.id,
                "name": campaign.name,
                "status": campaign.status,
                "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
                "lead_count": lead_count,
                "leads": [self._lead_to_dict(l) for l in leads],
            }
        finally:
            db.close()

    # -- Lead CRUD --

    def _campaign_belongs_to_user(self, db, campaign_id: str, user_id: str) -> bool:
        return (
            db.query(BacklinkCampaign)
            .filter(BacklinkCampaign.id == campaign_id, BacklinkCampaign.user_id == user_id)
            .first()
            is not None
        )

    def add_lead(
        self,
        campaign_id: str,
        user_id: str,
        url: str,
        domain: str,
        page_title: str = "",
        snippet: str = "",
        email: Optional[str] = None,
        confidence_score: float = 0.0,
        discovery_source: str = "duckduckgo",
        notes: Optional[str] = None,
        exa_author: Optional[str] = None,
        exa_published_date: Optional[str] = None,
        exa_summary: Optional[str] = None,
        ai_editor_name: Optional[str] = None,
        ai_pitch_angle: Optional[str] = None,
        ai_guidelines_summary: Optional[str] = None,
        ai_relevance_score: Optional[float] = None,
        ai_risk_flags: Optional[str] = None,
    ) -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            if not self._campaign_belongs_to_user(db, campaign_id, user_id):
                raise BacklinkCampaignNotFoundError("Campaign not found")

            existing = (
                db.query(BacklinkLead)
                .filter(BacklinkLead.campaign_id == campaign_id, BacklinkLead.url == url)
                .first()
            )
            if existing:
                return self._lead_to_dict(existing)

            lead = BacklinkLead(
                id=f"bl_{uuid4().hex[:16]}",
                campaign_id=campaign_id,
                url=url,
                domain=domain,
                page_title=page_title,
                snippet=snippet,
                email=email,
                confidence_score=confidence_score,
                discovery_source=discovery_source,
                status="discovered",
                notes=notes,
                created_at=datetime.utcnow(),
                exa_author=exa_author,
                exa_published_date=exa_published_date,
                exa_summary=exa_summary,
                ai_editor_name=ai_editor_name,
                ai_pitch_angle=ai_pitch_angle,
                ai_guidelines_summary=ai_guidelines_summary,
                ai_relevance_score=ai_relevance_score,
                ai_risk_flags=ai_risk_flags,
            )
            db.add(lead)
            db.commit()
            return self._lead_to_dict(lead)
        finally:
            db.close()

    def bulk_add_leads(self, campaign_id: str, user_id: str, leads_data: List[dict]) -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            if not self._campaign_belongs_to_user(db, campaign_id, user_id):
                raise BacklinkCampaignNotFoundError("Campaign not found")

            existing_urls = {
                row[0]
                for row in db.query(BacklinkLead.url)
                .filter(BacklinkLead.campaign_id == campaign_id)
                .all()
            }

            added = []
            for data in leads_data:
                url = data.get("url", "")
                if url in existing_urls:
                    continue
                lead = BacklinkLead(
                    id=f"bl_{uuid4().hex[:16]}",
                    campaign_id=campaign_id,
                    url=url,
                    domain=data.get("domain", ""),
                    page_title=data.get("page_title", ""),
                    snippet=data.get("snippet", ""),
                    email=data.get("email"),
                    confidence_score=data.get("confidence_score", 0.0),
                    discovery_source=data.get("discovery_source", "duckduckgo"),
                    status="discovered",
                    notes=data.get("notes"),
                    created_at=datetime.utcnow(),
                    exa_author=data.get("exa_author"),
                    exa_published_date=data.get("exa_published_date"),
                    exa_summary=data.get("exa_summary"),
                    ai_editor_name=data.get("ai_editor_name"),
                    ai_pitch_angle=data.get("ai_pitch_angle"),
                    ai_guidelines_summary=data.get("ai_guidelines_summary"),
                    ai_relevance_score=data.get("ai_relevance_score"),
                    ai_risk_flags=data.get("ai_risk_flags"),
                )
                db.add(lead)
                added.append(lead)
                existing_urls.add(url)
            db.commit()
            return [self._lead_to_dict(l) for l in added]
        finally:
            db.close()

    def list_leads(
        self, campaign_id: str, user_id: str, status: Optional[str] = None, limit: int = 50
    ) -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            q = db.query(BacklinkLead).filter(BacklinkLead.campaign_id == campaign_id)
            if status:
                q = q.filter(BacklinkLead.status == status)
            rows = q.order_by(BacklinkLead.created_at.desc()).limit(limit).all()
            return [self._lead_to_dict(r) for r in rows]
        finally:
            db.close()

    def update_lead_status(
        self,
        lead_id: str,
        user_id: str,
        status: str,
        notes: Optional[str] = None,
        campaign_id: Optional[str] = None,
    ) -> Optional[dict]:
        if status not in LEAD_VALID_STATUSES:
            raise ValueError(f"Invalid status '{status}'. Valid values: {sorted(LEAD_VALID_STATUSES)}")

        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            lead = db.query(BacklinkLead).filter(BacklinkLead.id == lead_id).first()
            if not lead:
                return None

            campaign = (
                db.query(BacklinkCampaign)
                .filter(BacklinkCampaign.id == lead.campaign_id, BacklinkCampaign.user_id == user_id)
                .first()
            )
            if not campaign:
                raise PermissionError("Lead does not belong to the current user")

            if campaign_id and lead.campaign_id != campaign_id:
                return None

            lead.status = status
            if notes is not None:
                lead.notes = notes
            db.commit()
            return self._lead_to_dict(lead)
        finally:
            db.close()

    def get_lead_access_issues(
        self, lead_ids: List[str], user_id: str, campaign_id: Optional[str] = None
    ) -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return {"missing": list(dict.fromkeys(lead_ids)), "unauthorized": []}
        try:
            unique_lead_ids = list(dict.fromkeys(lead_ids))
            access_rows = self._get_lead_access_rows(db, unique_lead_ids)
            missing: List[str] = []
            unauthorized: List[str] = []
            for lid in unique_lead_ids:
                access = access_rows.get(lid)
                if not access:
                    missing.append(lid)
                elif access["user_id"] != user_id:
                    unauthorized.append(lid)
                elif campaign_id and access["campaign_id"] != campaign_id:
                    missing.append(lid)
            return {"missing": missing, "unauthorized": unauthorized}
        finally:
            db.close()

    def _get_lead_access_rows(self, db, lead_ids: List[str]) -> dict:
        if not lead_ids:
            return {}
        rows = (
            db.query(BacklinkLead.id, BacklinkLead.campaign_id, BacklinkCampaign.user_id)
            .outerjoin(BacklinkCampaign, BacklinkLead.campaign_id == BacklinkCampaign.id)
            .filter(BacklinkLead.id.in_(lead_ids))
            .all()
        )
        return {
            row.id: {"campaign_id": row.campaign_id, "user_id": row.user_id}
            for row in rows
        }

    @staticmethod
    def _lead_to_dict(lead) -> dict:
        base = {
            "lead_id": lead.id,
            "campaign_id": lead.campaign_id,
            "url": lead.url,
            "domain": lead.domain,
            "page_title": lead.page_title or "",
            "snippet": lead.snippet or "",
            "email": lead.email,
            "confidence_score": lead.confidence_score or 0.0,
            "discovery_source": lead.discovery_source or "duckduckgo",
            "status": lead.status,
            "notes": lead.notes,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
        }
        for attr in ("exa_author", "exa_published_date", "exa_summary",
                     "ai_editor_name", "ai_pitch_angle", "ai_guidelines_summary",
                     "ai_relevance_score", "ai_risk_flags"):
            try:
                base[attr] = getattr(lead, attr)
            except Exception:
                base[attr] = None
        return base

    # -- Outreach Attempt CRUD --


    def get_attempt_by_idempotency_key(self, idempotency_key: str, user_id: str = "default") -> Optional[dict]:
        """Return the existing attempt for an idempotency key visible to the user."""
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            attempt = (
                db.query(OutreachAttempt)
                .join(BacklinkCampaign, OutreachAttempt.campaign_id == BacklinkCampaign.id)
                .filter(
                    OutreachAttempt.idempotency_key == idempotency_key,
                    BacklinkCampaign.user_id == user_id,
                )
                .first()
            )
            return self._attempt_to_dict(attempt) if attempt else None
        finally:
            db.close()

    def reserve_attempt_idempotency(
        self,
        lead_id: str,
        campaign_id: str,
        idempotency_key: str,
        sender_email: str = "",
        subject: str = "",
        body: str = "",
        user_id: str = "default",
    ) -> dict:
        """Atomically reserve an outreach idempotency key by creating the attempt row.

        Returns {"reserved": True, "attempt": attempt_dict} for the caller that won
        the reservation, or {"reserved": False, "attempt": existing_attempt_or_none}
        when the unique key already exists. Duplicate rows are detected by the
        database unique constraint so concurrent requests do not both proceed to
        policy approval or SMTP delivery.
        """
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            attempt = OutreachAttempt(
                id=f"att_{uuid4().hex[:16]}",
                lead_id=lead_id,
                campaign_id=campaign_id,
                idempotency_key=idempotency_key,
                sender_email=sender_email,
                subject=subject,
                body=body,
                status="queued",
                created_at=datetime.utcnow(),
            )
            db.add(attempt)
            db.commit()
            return {"reserved": True, "attempt": self._attempt_to_dict(attempt)}
        except IntegrityError:
            db.rollback()
            existing = (
                db.query(OutreachAttempt)
                .join(BacklinkCampaign, OutreachAttempt.campaign_id == BacklinkCampaign.id)
                .filter(
                    OutreachAttempt.idempotency_key == idempotency_key,
                    BacklinkCampaign.user_id == user_id,
                )
                .first()
            )
            return {"reserved": False, "attempt": self._attempt_to_dict(existing) if existing else None}
        finally:
            db.close()

    def add_attempt(
        self,
        lead_id: str,
        campaign_id: str,
        idempotency_key: str,
        sender_email: str = "",
        subject: str = "",
        body: str = "",
        status: str = "queued",
        decision_reason: Optional[str] = None,
        user_id: str = "default",
    ) -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            attempt = OutreachAttempt(
                id=f"att_{uuid4().hex[:16]}",
                lead_id=lead_id,
                campaign_id=campaign_id,
                idempotency_key=idempotency_key,
                sender_email=sender_email,
                subject=subject,
                body=body,
                status=status,
                decision_reason=decision_reason,
                created_at=datetime.utcnow(),
            )
            db.add(attempt)
            db.commit()
            return self._attempt_to_dict(attempt)
        except IntegrityError:
            db.rollback()
            existing = (
                db.query(OutreachAttempt)
                .join(BacklinkCampaign, OutreachAttempt.campaign_id == BacklinkCampaign.id)
                .filter(
                    OutreachAttempt.idempotency_key == idempotency_key,
                    BacklinkCampaign.user_id == user_id,
                )
                .first()
            )
            if existing:
                return self._attempt_to_dict(existing)
            raise
        finally:
            db.close()

    def list_attempts(self, campaign_id: str, limit: int = 50, user_id: str = "default") -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(OutreachAttempt)
                .filter(OutreachAttempt.campaign_id == campaign_id)
                .order_by(OutreachAttempt.created_at.desc())
                .limit(limit)
                .all()
            )
            return [self._attempt_to_dict(r) for r in rows]
        finally:
            db.close()

    def update_attempt_status(self, attempt_id: str, status: str, decision_reason: Optional[str] = None, user_id: str = "default") -> Optional[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            attempt = db.query(OutreachAttempt).filter(OutreachAttempt.id == attempt_id).first()
            if not attempt:
                return None
            attempt.status = status
            if decision_reason is not None:
                attempt.decision_reason = decision_reason
            if status == "sent":
                attempt.sent_at = datetime.utcnow()
            db.commit()
            return self._attempt_to_dict(attempt)
        finally:
            db.close()

    @staticmethod
    def _attempt_to_dict(attempt) -> dict:
        return {
            "attempt_id": attempt.id,
            "lead_id": attempt.lead_id,
            "campaign_id": attempt.campaign_id,
            "idempotency_key": attempt.idempotency_key,
            "sender_email": attempt.sender_email or "",
            "subject": attempt.subject or "",
            "status": attempt.status,
            "decision_reason": attempt.decision_reason,
            "sent_at": attempt.sent_at.isoformat() if attempt.sent_at else None,
            "created_at": attempt.created_at.isoformat() if attempt.created_at else None,
            "message_id": attempt.message_id or "",
        }

    def find_attempt_by_from_email(self, from_email: str, user_id: str = "default") -> Optional[str]:
        """Find the most recent attempt_id for a given sender email (lead)."""
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            from sqlalchemy import desc
            attempt = (
                db.query(OutreachAttempt)
                .join(BacklinkLead, OutreachAttempt.lead_id == BacklinkLead.id)
                .filter(BacklinkLead.email == from_email)
                .order_by(desc(OutreachAttempt.created_at))
                .first()
            )
            return attempt.id if attempt else None
        finally:
            db.close()

    def update_attempt_message_id(self, attempt_id: str, message_id: str, user_id: str = "default") -> Optional[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            attempt = db.query(OutreachAttempt).filter(OutreachAttempt.id == attempt_id).first()
            if not attempt:
                return None
            attempt.message_id = message_id
            db.commit()
            return self._attempt_to_dict(attempt)
        finally:
            db.close()

    def find_attempt_by_message_id(self, message_id: str, user_id: str = "default") -> Optional[str]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            clean = message_id.strip()
            attempt = (
                db.query(OutreachAttempt)
                .filter(OutreachAttempt.message_id == clean)
                .first()
            )
            return attempt.id if attempt else None
        finally:
            db.close()

    # -- Outreach Reply CRUD --

    def reply_exists(self, from_email: str, subject: str, user_id: str = "default") -> bool:
        """Check if a reply with this from_email+subject already exists."""
        db = get_session_for_user(user_id)
        if not db:
            return False
        try:
            exists = (
                db.query(OutreachReply.id)
                .filter(OutreachReply.from_email == from_email, OutreachReply.subject == subject)
                .first()
            )
            return exists is not None
        finally:
            db.close()

    def add_reply(
        self,
        attempt_id: str,
        from_email: str = "",
        subject: str = "",
        body: str = "",
        classification: str = "replied",
        user_id: str = "default",
    ) -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            reply = OutreachReply(
                id=f"rep_{uuid4().hex[:16]}",
                attempt_id=attempt_id,
                from_email=from_email,
                subject=subject,
                body=body,
                classification=classification,
                received_at=datetime.utcnow(),
            )
            db.add(reply)
            db.commit()
            return self._reply_to_dict(reply)
        finally:
            db.close()

    def list_replies(self, campaign_id: str, limit: int = 50, user_id: str = "default") -> List[dict]:
        """List replies by joining through attempts to filter by campaign."""
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(OutreachReply)
                .join(OutreachAttempt, OutreachReply.attempt_id == OutreachAttempt.id)
                .filter(OutreachAttempt.campaign_id == campaign_id)
                .order_by(OutreachReply.received_at.desc())
                .limit(limit)
                .all()
            )
            return [self._reply_to_dict(r) for r in rows]
        finally:
            db.close()

    @staticmethod
    def _reply_to_dict(reply) -> dict:
        return {
            "reply_id": reply.id,
            "attempt_id": reply.attempt_id,
            "from_email": reply.from_email or "",
            "subject": reply.subject or "",
            "received_at": reply.received_at.isoformat() if reply.received_at else None,
            "classification": reply.classification,
            "body": reply.body or "",
        }

    # -- Follow-Up Schedule CRUD --

    def schedule_followup(
        self,
        attempt_id: str,
        scheduled_for: str,
        subject: str = "",
        body: str = "",
        user_id: str = "default",
    ) -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            sched = FollowUpSchedule(
                id=f"fu_{uuid4().hex[:16]}",
                attempt_id=attempt_id,
                subject=subject or None,
                body=body or None,
                scheduled_for=datetime.fromisoformat(scheduled_for) if isinstance(scheduled_for, str) else scheduled_for,
                sent=False,
            )
            db.add(sched)
            db.commit()
            return self._followup_to_dict(sched)
        finally:
            db.close()

    def list_followups(self, campaign_id: str, limit: int = 50, user_id: str = "default") -> List[dict]:
        """List follow-ups by joining through attempts to filter by campaign."""
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(FollowUpSchedule)
                .join(OutreachAttempt, FollowUpSchedule.attempt_id == OutreachAttempt.id)
                .filter(OutreachAttempt.campaign_id == campaign_id)
                .order_by(FollowUpSchedule.scheduled_for.asc())
                .limit(limit)
                .all()
            )
            return [self._followup_to_dict(r) for r in rows]
        finally:
            db.close()

    def mark_followup_sent(self, schedule_id: str, user_id: str = "default") -> Optional[dict]:
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            sched = db.query(FollowUpSchedule).filter(FollowUpSchedule.id == schedule_id).first()
            if not sched:
                return None
            sched.sent = True
            db.commit()
            return self._followup_to_dict(sched)
        finally:
            db.close()

    @staticmethod
    def _followup_to_dict(sched) -> dict:
        return {
            "schedule_id": sched.id,
            "attempt_id": sched.attempt_id,
            "subject": sched.subject or "",
            "scheduled_for": sched.scheduled_for.isoformat() if sched.scheduled_for else None,
            "sent": sched.sent,
        }

    # -- Email Template CRUD --

    def create_template(
        self,
        user_id: str,
        name: str,
        subject_template: str,
        body_template: str,
        variables: Optional[List[str]] = None,
    ) -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            tmpl = EmailTemplate(
                id=f"tpl_{uuid4().hex[:16]}",
                user_id=user_id,
                name=name,
                subject_template=subject_template,
                body_template=body_template,
                variables=",".join(variables) if variables else None,
                created_at=datetime.utcnow(),
            )
            db.add(tmpl)
            db.commit()
            return self._template_to_dict(tmpl)
        finally:
            db.close()

    def list_templates(self, user_id: str, limit: int = 50) -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(EmailTemplate)
                .filter(EmailTemplate.user_id == user_id)
                .order_by(EmailTemplate.created_at.desc())
                .limit(limit)
                .all()
            )
            return [self._template_to_dict(r) for r in rows]
        finally:
            db.close()

    def get_template(self, template_id: str, user_id: str) -> Optional[dict]:
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            tmpl = (
                db.query(EmailTemplate)
                .filter(EmailTemplate.id == template_id, EmailTemplate.user_id == user_id)
                .first()
            )
            if not tmpl:
                return None
            return self._template_to_dict(tmpl)
        finally:
            db.close()

    def delete_template(self, template_id: str, user_id: str) -> bool:
        db = get_session_for_user(user_id)
        if not db:
            return False
        try:
            tmpl = (
                db.query(EmailTemplate)
                .filter(EmailTemplate.id == template_id, EmailTemplate.user_id == user_id)
                .first()
            )
            if not tmpl:
                return False
            db.delete(tmpl)
            db.commit()
            return True
        finally:
            db.close()

    @staticmethod
    def _template_to_dict(tmpl) -> dict:
        return {
            "template_id": tmpl.id,
            "user_id": tmpl.user_id,
            "name": tmpl.name,
            "subject_template": tmpl.subject_template,
            "body_template": tmpl.body_template,
            "variables": tmpl.variables.split(",") if tmpl.variables else [],
            "created_at": tmpl.created_at.isoformat() if tmpl.created_at else None,
        }

    # -- Suppression List --

    def add_suppressed(self, email: str, user_id: str = "default", domain: str = "", reason: str = "") -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            entry = SuppressedRecipient(
                id=f"sup_{uuid4().hex[:16]}",
                email=email.lower(),
                domain=domain.lower() if domain else email.split("@")[-1].lower(),
                reason=reason,
                user_id=user_id,
                created_at=datetime.utcnow(),
            )
            db.add(entry)
            db.commit()
            return {"id": entry.id, "email": entry.email, "reason": entry.reason}
        finally:
            db.close()

    def is_suppressed(self, email: str, domain: str = "", user_id: str = "default") -> bool:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return False
        try:
            email_lower = email.lower()
            domain_lower = domain.lower() if domain else email.split("@")[-1].lower()
            exists = (
                db.query(SuppressedRecipient.id)
                .filter(
                    (SuppressedRecipient.email == email_lower) |
                    (SuppressedRecipient.domain == domain_lower)
                )
                .first()
            )
            return exists is not None
        finally:
            db.close()

    def delete_suppressed(self, id: str, user_id: str = "default") -> bool:
        db = get_session_for_user(user_id)
        if not db:
            return False
        try:
            entry = db.query(SuppressedRecipient).filter(
                SuppressedRecipient.id == id,
                SuppressedRecipient.user_id == user_id,
            ).first()
            if not entry:
                return False
            db.delete(entry)
            db.commit()
            return True
        finally:
            db.close()

    def list_suppressed(self, user_id: str = "default", limit: int = 100) -> List[dict]:
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(SuppressedRecipient)
                .order_by(SuppressedRecipient.created_at.desc())
                .limit(limit)
                .all()
            )
            return [{"id": r.id, "email": r.email, "domain": r.domain, "reason": r.reason, "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]
        finally:
            db.close()

    # -- User SMTP Config --

    def get_smtp_config(self, user_id: str = "default") -> Optional[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            cfg = db.query(UserSmtpConfig).filter(UserSmtpConfig.user_id == user_id).first()
            if not cfg:
                return None
            return {
                "id": cfg.id,
                "host": cfg.host,
                "port": cfg.port,
                "username": cfg.username,
                "from_email": cfg.from_email,
                "use_tls": cfg.use_tls,
                "verify_tls": cfg.verify_tls,
                "timeout": cfg.timeout,
            }
        finally:
            db.close()

    def set_smtp_config(self, user_id: str = "default", **kwargs) -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            cfg = db.query(UserSmtpConfig).filter(UserSmtpConfig.user_id == user_id).first()
            if not cfg:
                cfg = UserSmtpConfig(
                    id=f"smtp_{uuid4().hex[:16]}",
                    user_id=user_id,
                )
                db.add(cfg)
            if "host" in kwargs:
                cfg.host = kwargs["host"]
            if "port" in kwargs:
                cfg.port = int(kwargs["port"])
            if "username" in kwargs:
                cfg.username = kwargs["username"]
            if "password" in kwargs:
                cfg.password = kwargs["password"]
            if "from_email" in kwargs:
                cfg.from_email = kwargs["from_email"]
            if "use_tls" in kwargs:
                cfg.use_tls = bool(kwargs["use_tls"])
            if "verify_tls" in kwargs:
                cfg.verify_tls = bool(kwargs["verify_tls"])
            if "timeout" in kwargs:
                cfg.timeout = int(kwargs["timeout"])
            db.commit()
            return {"id": cfg.id, "host": cfg.host, "username": cfg.username, "from_email": cfg.from_email}
        finally:
            db.close()

    def delete_smtp_config(self, user_id: str = "default") -> bool:
        db = get_session_for_user(user_id)
        if not db:
            return False
        try:
            cfg = db.query(UserSmtpConfig).filter(UserSmtpConfig.user_id == user_id).first()
            if not cfg:
                return False
            db.delete(cfg)
            db.commit()
            return True
        finally:
            db.close()

    # -- Idempotency --

    def check_idempotency(self, idempotency_key: str, user_id: str = "default") -> bool:
        """Returns True if key already exists (duplicate)."""
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return False
        try:
            exists = (
                db.query(SentIdempotencyKey.id)
                .filter(SentIdempotencyKey.idempotency_key == idempotency_key)
                .first()
            )
            return exists is not None
        finally:
            db.close()

    def mark_idempotency(self, idempotency_key: str, user_id: str = "default") -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            entry = SentIdempotencyKey(
                id=f"idm_{uuid4().hex[:16]}",
                idempotency_key=idempotency_key,
                user_id=user_id,
                created_at=datetime.utcnow(),
            )
            db.add(entry)
            db.commit()
            return {"idempotency_key": idempotency_key}
        except IntegrityError:
            db.rollback()
            return {"idempotency_key": idempotency_key}
        finally:
            db.close()

    # -- Send Counters --

    def _today(self) -> date:
        return date.today()

    def get_user_send_count(self, user_id: str) -> int:
        db = get_session_for_user(user_id)
        if not db:
            return 0
        try:
            today = self._today()
            row = (
                db.query(SendCounterUser.count)
                .filter(SendCounterUser.user_id == user_id, SendCounterUser.date == today)
                .first()
            )
            return row[0] if row else 0
        finally:
            db.close()

    def get_domain_send_count(self, domain: str, user_id: str = "default") -> int:
        db = get_session_for_user(user_id)
        if not db:
            return 0
        try:
            today = self._today()
            row = (
                db.query(SendCounterDomain.count)
                .filter(SendCounterDomain.domain == domain.lower(), SendCounterDomain.date == today)
                .first()
            )
            return row[0] if row else 0
        finally:
            db.close()

    def try_increment_user_send_counter(self, user_id: str) -> tuple:
        """Atomically check cap and increment. Returns (within_cap, new_count)."""
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return True, 0
        try:
            today = self._today()
            current = (
                db.query(SendCounterUser.count)
                .filter(SendCounterUser.user_id == user_id, SendCounterUser.date == today)
                .scalar()
            ) or 0
            if current >= DEFAULT_USER_DAILY_CAP:
                db.close()
                return False, current
            row_id = f"scu_{uuid4().hex[:16]}"
            db.execute(sql_text(
                "INSERT INTO backlink_send_counters_user (id, user_id, date, count) "
                "VALUES (:id, :uid, :dt, 1) "
                "ON CONFLICT (user_id, date) DO UPDATE SET count = count + 1"
            ), {"id": row_id, "uid": user_id, "dt": today})
            db.commit()
            result = db.query(SendCounterUser.count).filter(
                SendCounterUser.user_id == user_id, SendCounterUser.date == today
            ).first()
            return True, result[0] if result else 0
        except Exception:
            db.rollback()
            return True, 0
        finally:
            db.close()

    def try_increment_domain_send_counter(self, domain: str, user_id: str = "default") -> tuple:
        """Atomically check cap and increment. Returns (within_cap, new_count)."""
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return True, 0
        try:
            today = self._today()
            domain_lower = domain.lower()
            current = (
                db.query(SendCounterDomain.count)
                .filter(SendCounterDomain.domain == domain_lower, SendCounterDomain.date == today)
                .scalar()
            ) or 0
            if current >= DEFAULT_DOMAIN_DAILY_CAP:
                db.close()
                return False, current
            row_id = f"scd_{uuid4().hex[:16]}"
            db.execute(sql_text(
                "INSERT INTO backlink_send_counters_domain (id, domain, date, count) "
                "VALUES (:id, :dom, :dt, 1) "
                "ON CONFLICT (domain, date) DO UPDATE SET count = count + 1"
            ), {"id": row_id, "dom": domain_lower, "dt": today})
            db.commit()
            result = db.query(SendCounterDomain.count).filter(
                SendCounterDomain.domain == domain_lower, SendCounterDomain.date == today
            ).first()
            return True, result[0] if result else 0
        except Exception:
            db.rollback()
            return True, 0
        finally:
            db.close()

    # -- Audit Log --

    def add_audit_log(
        self,
        event: str,
        user_id: str,
        campaign_id: str = "",
        recipient: str = "",
        allowed: bool = False,
        reasons: Optional[List[str]] = None,
        override: bool = False,
    ) -> dict:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            raise RuntimeError("Database session unavailable")
        try:
            entry = AuditLogEntry(
                id=f"aud_{uuid4().hex[:16]}",
                user_id=user_id,
                campaign_id=campaign_id or None,
                event=event,
                recipient=recipient or None,
                allowed=allowed,
                reasons=";".join(reasons) if reasons else None,
                override=override,
                created_at=datetime.utcnow(),
            )
            db.add(entry)
            db.commit()
            return {"id": entry.id, "event": entry.event, "allowed": entry.allowed}
        finally:
            db.close()

    def list_audit_logs(self, campaign_id: Optional[str] = None, limit: int = 100, user_id: str = "default") -> List[dict]:
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            q = db.query(AuditLogEntry)
            if campaign_id:
                q = q.filter(AuditLogEntry.campaign_id == campaign_id)
            rows = q.order_by(AuditLogEntry.created_at.desc()).limit(limit).all()
            return [
                {
                    "id": r.id,
                    "event": r.event,
                    "recipient": r.recipient,
                    "allowed": r.allowed,
                    "reasons": r.reasons.split(";") if r.reasons else [],
                    "override": r.override,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]
        finally:
            db.close()

    # -- Analytics --

    def get_send_volume_by_day(self, campaign_id: str, days: int = 30, user_id: str = "default") -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            from datetime import timedelta
            cutoff = datetime.utcnow() - timedelta(days=days)
            rows = (
                db.query(sa_func.date(OutreachAttempt.sent_at).label("date"), sa_func.count(OutreachAttempt.id).label("count"))
                .filter(OutreachAttempt.campaign_id == campaign_id, OutreachAttempt.status == "sent", OutreachAttempt.sent_at >= cutoff)
                .group_by(sa_func.date(OutreachAttempt.sent_at))
                .order_by(sa_func.date(OutreachAttempt.sent_at).asc())
                .all()
            )
            return [{"date": str(r.date), "count": r.count} for r in rows]
        finally:
            db.close()

    def get_lead_status_counts(self, campaign_id: str, user_id: str = "default") -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(BacklinkLead.status, sa_func.count(BacklinkLead.id).label("count"))
                .filter(BacklinkLead.campaign_id == campaign_id)
                .group_by(BacklinkLead.status)
                .order_by(BacklinkLead.status.asc())
                .all()
            )
            return [{"status": r.status, "count": r.count} for r in rows]
        finally:
            db.close()

    def list_attempts_all(self, campaign_id: str, user_id: str = "default") -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(OutreachAttempt)
                .filter(OutreachAttempt.campaign_id == campaign_id)
                .order_by(OutreachAttempt.created_at.desc())
                .all()
            )
            return [self._attempt_to_dict(r) for r in rows]
        finally:
            db.close()

    def list_replies_all(self, campaign_id: str, user_id: str = "default") -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(OutreachReply)
                .join(OutreachAttempt, OutreachReply.attempt_id == OutreachAttempt.id)
                .filter(OutreachAttempt.campaign_id == campaign_id)
                .order_by(OutreachReply.received_at.desc())
                .all()
            )
            return [self._reply_to_dict(r) for r in rows]
        finally:
            db.close()

    def count_replies(self, campaign_id: str, user_id: str = "default") -> int:
        db = get_session_for_user(user_id)
        if not db:
            return 0
        try:
            return (
                db.query(OutreachReply.id)
                .join(OutreachAttempt, OutreachReply.attempt_id == OutreachAttempt.id)
                .filter(OutreachAttempt.campaign_id == campaign_id)
                .count()
            )
        finally:
            db.close()

    def list_leads_all(self, campaign_id: str, user_id: str = "default") -> List[dict]:
        self._ensure_tables(user_id)
        db = get_session_for_user(user_id)
        if not db:
            return []
        try:
            rows = (
                db.query(BacklinkLead)
                .filter(BacklinkLead.campaign_id == campaign_id)
                .order_by(BacklinkLead.created_at.desc())
                .all()
            )
            return [self._lead_to_dict(r) for r in rows]
        finally:
            db.close()

    # -- Policy Helpers (composite checks) --

    def get_lead(self, lead_id: str, user_id: str = "default") -> Optional[dict]:
        db = get_session_for_user(user_id)
        if not db:
            return None
        try:
            lead = db.query(BacklinkLead).filter(BacklinkLead.id == lead_id).first()
            if not lead:
                return None
            return self._lead_to_dict(lead)
        finally:
            db.close()

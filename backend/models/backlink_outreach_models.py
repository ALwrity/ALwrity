"""DB models for production backlink outreach tracking."""

from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, Index, Boolean, Date
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class BacklinkCampaign(Base):
    __tablename__ = "backlink_campaigns"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    workspace_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="drafted", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class BacklinkLead(Base):
    __tablename__ = "backlink_leads"
    id = Column(String(64), primary_key=True)
    campaign_id = Column(String(64), ForeignKey("backlink_campaigns.id"), nullable=False, index=True)
    url = Column(String(1024), nullable=True)
    domain = Column(String(255), nullable=False, index=True)
    page_title = Column(String(512), nullable=True)
    snippet = Column(Text, nullable=True)
    email = Column(String(255), nullable=True, index=True)
    confidence_score = Column(Float, nullable=True, default=0.0)
    discovery_source = Column(String(32), nullable=True, default="duckduckgo")
    status = Column(String(32), nullable=False, default="discovered", index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    exa_author = Column(Text, nullable=True)
    exa_published_date = Column(Text, nullable=True)
    exa_summary = Column(Text, nullable=True)
    ai_editor_name = Column(Text, nullable=True)
    ai_pitch_angle = Column(Text, nullable=True)
    ai_guidelines_summary = Column(Text, nullable=True)
    ai_relevance_score = Column(Float, nullable=True)
    ai_risk_flags = Column(Text, nullable=True)


class OutreachAttempt(Base):
    __tablename__ = "backlink_outreach_attempts"
    id = Column(String(64), primary_key=True)
    lead_id = Column(String(64), ForeignKey("backlink_leads.id"), nullable=False, index=True)
    campaign_id = Column(String(64), ForeignKey("backlink_campaigns.id"), nullable=False, index=True)
    idempotency_key = Column(String(128), nullable=False, unique=True, index=True)
    sender_email = Column(String(255), nullable=True)
    subject = Column(String(512), nullable=True)
    body = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="queued", index=True)
    decision_reason = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    message_id = Column(String(255), nullable=True, index=True)


class OutreachReply(Base):
    __tablename__ = "backlink_replies"
    id = Column(String(64), primary_key=True)
    attempt_id = Column(String(64), ForeignKey("backlink_outreach_attempts.id"), nullable=False, index=True)
    from_email = Column(String(255), nullable=True)
    subject = Column(String(512), nullable=True)
    received_at = Column(DateTime, default=datetime.utcnow, index=True)
    classification = Column(String(32), nullable=False, default="replied")
    body = Column(Text, nullable=True)


class FollowUpSchedule(Base):
    __tablename__ = "backlink_followup_schedules"
    id = Column(String(64), primary_key=True)
    attempt_id = Column(String(64), ForeignKey("backlink_outreach_attempts.id"), nullable=False, index=True)
    subject = Column(String(512), nullable=True)
    body = Column(Text, nullable=True)
    scheduled_for = Column(DateTime, nullable=False, index=True)
    sent = Column(Boolean, default=False, index=True)


class EmailTemplate(Base):
    __tablename__ = "backlink_email_templates"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    subject_template = Column(String(512), nullable=False)
    body_template = Column(Text, nullable=False)
    variables = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SuppressedRecipient(Base):
    __tablename__ = "backlink_suppressed_recipients"
    id = Column(String(64), primary_key=True)
    email = Column(String(255), nullable=False, index=True)
    domain = Column(String(255), nullable=True)
    reason = Column(String(128), nullable=True)
    user_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SentIdempotencyKey(Base):
    __tablename__ = "backlink_sent_idempotency_keys"
    id = Column(String(64), primary_key=True)
    idempotency_key = Column(String(128), nullable=False, unique=True, index=True)
    user_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLogEntry(Base):
    __tablename__ = "backlink_audit_logs"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    campaign_id = Column(String(64), nullable=True)
    event = Column(String(64), nullable=False, index=True)
    recipient = Column(String(255), nullable=True)
    allowed = Column(Boolean, nullable=True)
    reasons = Column(Text, nullable=True)
    override = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class SendCounterUser(Base):
    __tablename__ = "backlink_send_counters_user"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    count = Column(Integer, default=0)


class SendCounterDomain(Base):
    __tablename__ = "backlink_send_counters_domain"
    id = Column(String(64), primary_key=True)
    domain = Column(String(255), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    count = Column(Integer, default=0)


class UserSmtpConfig(Base):
    __tablename__ = "backlink_user_smtp_config"
    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, unique=True, index=True)
    host = Column(String(255), nullable=False, default="smtp.gmail.com")
    port = Column(Integer, nullable=False, default=587)
    username = Column(String(255), nullable=False, default="")
    password = Column(String(512), nullable=False, default="")
    from_email = Column(String(255), nullable=True)
    use_tls = Column(Boolean, default=True)
    verify_tls = Column(Boolean, default=True)
    timeout = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


Index("idx_backlink_campaign_user_date", BacklinkCampaign.user_id, BacklinkCampaign.created_at)
Index("idx_backlink_attempt_campaign_date", OutreachAttempt.campaign_id, OutreachAttempt.created_at)
Index("idx_backlink_suppressed_email", SuppressedRecipient.email, SuppressedRecipient.user_id)
Index("idx_backlink_counter_user_date", SendCounterUser.user_id, SendCounterUser.date, unique=True)
Index("idx_backlink_counter_domain_date", SendCounterDomain.domain, SendCounterDomain.date, unique=True)

"""Durable lifecycle record for a daily agent-team meeting."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text, Index

from models.base import Base


class DailyMeeting(Base):
    __tablename__ = "daily_meetings"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String(64), nullable=False, unique=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    meeting_date = Column(String(10), nullable=False, index=True)
    source = Column(String(30), nullable=False, default="scheduled")
    status = Column(String(30), nullable=False, default="running", index=True)
    tenant_timezone = Column(String(100), nullable=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    preflight_json = Column(JSON, nullable=True)
    schedule_json = Column(JSON, nullable=True)
    evidence_json = Column(JSON, nullable=True)
    proposal_review_json = Column(JSON, nullable=True)
    guardian_review_json = Column(JSON, nullable=True)
    prioritization_json = Column(JSON, nullable=True)
    limitations_json = Column(JSON, nullable=True)
    final_task_ids = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)


Index("ix_daily_meetings_user_date", DailyMeeting.user_id, DailyMeeting.meeting_date)

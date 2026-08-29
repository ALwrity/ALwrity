"""Models for first-party conversion event attribution."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, JSON, String

from models.base import Base


class ConversionEvent(Base):
    __tablename__ = "conversion_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    event_name = Column(String(100), nullable=False)
    value = Column(Float, nullable=True)
    currency = Column(String(10), nullable=True)
    source = Column(String(50), nullable=False, default="first_party")
    external_event_id = Column(String(255), nullable=True)
    agent_type = Column(String(100), nullable=True, index=True)
    recommendation_id = Column(String(255), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("daily_workflow_tasks.id"), nullable=True, index=True)
    artifact_id = Column(Integer, nullable=True, index=True)
    published_asset_id = Column(Integer, nullable=True, index=True)
    campaign_id = Column(String(255), nullable=True, index=True)
    platform = Column(String(50), nullable=True, index=True)
    occurred_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index(
            "ix_conversion_events_user_external",
            "user_id",
            "external_event_id",
            unique=True,
        ),
    )

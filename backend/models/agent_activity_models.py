from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey, Index, Float
from sqlalchemy.orm import relationship

from models.base import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    agent_type = Column(String(100), nullable=False, index=True)
    prompt = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="running", index=True)
    success = Column(Boolean, nullable=True)
    error_message = Column(Text, nullable=True)
    result_summary = Column(Text, nullable=True)
    mlflow_run_id = Column(String(255), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    finished_at = Column(DateTime, nullable=True, index=True)

    events = relationship("AgentEvent", back_populates="run", cascade="all, delete-orphan")


class AgentEvent(Base):
    __tablename__ = "agent_events"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("agent_runs.id"), nullable=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    agent_type = Column(String(100), nullable=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, default="info", index=True)
    message = Column(Text, nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    run = relationship("AgentRun", back_populates="events")


class AgentAlert(Base):
    __tablename__ = "agent_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    source = Column(String(30), nullable=False, default="agents", index=True)
    alert_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, default="info", index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    cta_path = Column(String(255), nullable=True)
    payload = Column(JSON, nullable=True)
    dedupe_key = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    read_at = Column(DateTime, nullable=True, index=True)


Index("ix_agent_alerts_user_unread", AgentAlert.user_id, AgentAlert.read_at)


class AgentApprovalRequest(Base):
    __tablename__ = "agent_approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    run_id = Column(Integer, ForeignKey("agent_runs.id"), nullable=True, index=True)
    agent_type = Column(String(100), nullable=True, index=True)
    action_id = Column(String(255), nullable=False, index=True)
    action_type = Column(String(255), nullable=False, index=True)
    target_resource = Column(String(255), nullable=True)
    risk_level = Column(Float, nullable=False, default=0.5)
    payload = Column(JSON, nullable=True)
    status = Column(String(30), nullable=False, default="pending", index=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    decided_at = Column(DateTime, nullable=True, index=True)
    decision = Column(String(30), nullable=True)
    user_comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


Index("ix_agent_approval_user_status", AgentApprovalRequest.user_id, AgentApprovalRequest.status)


class AgentProfile(Base):
    __tablename__ = "agent_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    agent_key = Column(String(100), nullable=False, index=True)
    agent_type = Column(String(100), nullable=True, index=True)

    display_name = Column(String(255), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True, index=True)

    schedule = Column(JSON, nullable=True)
    notification_prefs = Column(JSON, nullable=True)

    tone = Column(JSON, nullable=True)
    system_prompt = Column(Text, nullable=True)
    task_prompt_template = Column(Text, nullable=True)
    reporting_prefs = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, index=True)


Index("ix_agent_profiles_user_key", AgentProfile.user_id, AgentProfile.agent_key, unique=True)

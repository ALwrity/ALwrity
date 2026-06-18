from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship

from models.enhanced_strategy_models import Base


class DailyWorkflowPlan(Base):
    __tablename__ = "daily_workflow_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)
    source = Column(String(30), nullable=False, default="agent")
    generation_mode = Column(String(30), nullable=False, default="llm_generation", index=True)
    committee_agent_count = Column(Integer, nullable=False, default=0)
    fallback_used = Column(Boolean, nullable=False, default=False)
    plan_json = Column(JSON, nullable=True)
    generation_run_id = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)

    tasks = relationship("DailyWorkflowTask", back_populates="plan", cascade="all, delete-orphan")


class DailyWorkflowTask(Base):
    __tablename__ = "daily_workflow_tasks"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("daily_workflow_plans.id"), nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    pillar_id = Column(String(30), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="pending", index=True)
    priority = Column(String(10), nullable=False, default="medium", index=True)
    estimated_time = Column(Integer, nullable=False, default=15)
    action_type = Column(String(20), nullable=False, default="navigate")
    action_url = Column(String(255), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    dependencies = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)
    decided_at = Column(DateTime, nullable=True, index=True)
    completion_notes = Column(Text, nullable=True)

    plan = relationship("DailyWorkflowPlan", back_populates="tasks")


class TaskHistory(Base):
    """
    Tracks historical tasks for self-learning.
    Used by TaskMemoryService to prevent redundant suggestions and learn from rejections.
    """
    __tablename__ = "task_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    task_hash = Column(String(64), nullable=False, index=True)  # Hash of title + description
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    pillar_id = Column(String(30), nullable=False)
    status = Column(String(30), nullable=False)  # completed, dismissed, rejected
    source_agent = Column(String(50), nullable=True)
    feedback_score = Column(Integer, nullable=True)  # -1 (bad), 0 (neutral), 1 (good)
    feedback_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Metadata for vector index linking
    vector_id = Column(String(36), nullable=True) 

Index("ix_daily_workflow_plans_user_date", DailyWorkflowPlan.user_id, DailyWorkflowPlan.date, unique=True)
Index("ix_task_history_user_hash", TaskHistory.user_id, TaskHistory.task_hash, unique=True)

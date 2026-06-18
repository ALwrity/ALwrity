"""
Advertools Monitoring Models
Database models for tracking Advertools-based SEO intelligence tasks.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, Index, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

# Import the same Base from enhanced_strategy_models
from models.enhanced_strategy_models import Base


class AdvertoolsTask(Base):
    """
    Model for storing Advertools intelligence tasks.
    Tracks weekly content audits and site health monitoring.
    """
    __tablename__ = "advertools_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User and URL Identification
    user_id = Column(String(255), nullable=False, index=True)
    website_url = Column(String(500), nullable=False, index=True)
    
    # Task Status
    status = Column(String(50), default='active', index=True)  # 'active', 'failed', 'paused'
    
    # Execution Tracking
    started_at = Column(DateTime, nullable=True)     # When current execution started (for stale detection)
    last_heartbeat = Column(DateTime, nullable=True)  # Updated during long-running executions
    last_executed = Column(DateTime, nullable=True)
    last_success = Column(DateTime, nullable=True)
    last_failure = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)
    
    # Failure Pattern Tracking
    consecutive_failures = Column(Integer, default=0)
    failure_pattern = Column(JSON, nullable=True)
    
    # Scheduling
    next_execution = Column(DateTime, nullable=True, index=True)
    frequency_days = Column(Integer, default=7)  # Weekly by default
    
    # Task Type & Data
    payload = Column(JSON, nullable=True) # {"type": "content_audit", "website_url": "..."}
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Execution Logs Relationship
    execution_logs = relationship(
        "AdvertoolsExecutionLog",
        back_populates="task",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index('idx_advertools_tasks_user_site', 'user_id', 'website_url'),
        Index('idx_advertools_tasks_next_execution', 'next_execution'),
        Index('idx_advertools_tasks_status', 'status'),
    )
    
    def __repr__(self):
        return f"<AdvertoolsTask(id={self.id}, user_id={self.user_id}, url={self.website_url}, status={self.status})>"


class AdvertoolsExecutionLog(Base):
    """
    Model for storing Advertools execution logs.
    """
    __tablename__ = "advertools_execution_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Task Reference
    task_id = Column(Integer, ForeignKey("advertools_tasks.id"), nullable=False, index=True)
    
    # Execution Details
    execution_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), nullable=False)  # 'success', 'failed', 'skipped', 'running'
    
    # Results
    result_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to task
    task = relationship("AdvertoolsTask", back_populates="execution_logs")
    
    __table_args__ = (
        Index('idx_advertools_execution_logs_task_date', 'task_id', 'execution_date'),
        Index('idx_advertools_execution_logs_status', 'status'),
    )
    
    def __repr__(self):
        return f"<AdvertoolsExecutionLog(id={self.id}, task_id={self.task_id}, status={self.status}, execution_date={self.execution_date})>"

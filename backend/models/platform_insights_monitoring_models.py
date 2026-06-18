"""
Platform Insights Monitoring Models
Database models for tracking platform insights (GSC/Bing) fetch tasks.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Index, ForeignKey
from sqlalchemy.orm import relationship, synonym
from datetime import datetime

# Import the same Base from enhanced_strategy_models
from models.enhanced_strategy_models import Base


class PlatformInsightsTask(Base):
    """
    Model for storing platform insights fetch tasks.
    
    Tracks per-user, per-platform insights fetching with weekly updates.
    """
    __tablename__ = "platform_insights_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User and Platform Identification
    user_id = Column(String(255), nullable=False, index=True)  # Clerk user ID (string)
    platform = Column(String(50), nullable=False)  # 'gsc' or 'bing'
    site_url = Column(String(500), nullable=True)  # Optional: specific site URL
    
    # Task Status
    status = Column(String(50), default='active')  # 'active', 'failed', 'paused', 'needs_intervention'
    
    # Execution Tracking
    last_check = Column(DateTime, nullable=True)
    last_success = Column(DateTime, nullable=True)
    last_failure = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)
    
    # Failure Pattern Tracking
    consecutive_failures = Column(Integer, default=0)  # Count of consecutive failures
    failure_pattern = Column(JSON, nullable=True)  # JSON storing failure analysis
    
    # Scheduling
    next_check = Column(DateTime, nullable=True, index=True)  # Next scheduled check time
    next_execution = synonym('next_check')
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Execution Logs Relationship
    execution_logs = relationship(
        "PlatformInsightsExecutionLog",
        back_populates="task",
        cascade="all, delete-orphan"
    )
    
    # Indexes for efficient queries
    __table_args__ = (
        Index('idx_platform_insights_user_platform', 'user_id', 'platform'),
        Index('idx_platform_insights_next_check', 'next_check'),
        Index('idx_platform_insights_status', 'status'),
    )
    
    def __repr__(self):
        return f"<PlatformInsightsTask(id={self.id}, user_id={self.user_id}, platform={self.platform}, status={self.status})>"


class PlatformInsightsExecutionLog(Base):
    """
    Model for storing platform insights fetch execution logs.
    
    Tracks individual execution attempts with results and error details.
    """
    __tablename__ = "platform_insights_execution_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Task Reference
    task_id = Column(Integer, ForeignKey("platform_insights_tasks.id"), nullable=False, index=True)
    
    # Execution Details
    execution_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), nullable=False)  # 'success', 'failed', 'skipped'
    
    # Results
    result_data = Column(JSON, nullable=True)  # Insights data, metrics, etc.
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    data_source = Column(String(50), nullable=True)  # 'cached', 'api', 'onboarding'
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to task
    task = relationship("PlatformInsightsTask", back_populates="execution_logs")
    
    # Indexes for efficient queries
    __table_args__ = (
        Index('idx_platform_insights_log_task_execution_date', 'task_id', 'execution_date'),
        Index('idx_platform_insights_log_status', 'status'),
    )
    
    def __repr__(self):
        return f"<PlatformInsightsExecutionLog(id={self.id}, task_id={self.task_id}, status={self.status}, execution_date={self.execution_date})>"


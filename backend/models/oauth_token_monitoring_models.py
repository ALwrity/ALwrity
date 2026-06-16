"""
OAuth Token Monitoring Models
Database models for tracking OAuth token status and monitoring tasks.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, Index, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

# Import the same Base from enhanced_strategy_models
from models.enhanced_strategy_models import Base


class OAuthTokenMonitoringTask(Base):
    """
    Model for storing OAuth token monitoring tasks.
    
    Tracks per-user, per-platform token monitoring with weekly checks.
    """
    __tablename__ = "oauth_token_monitoring_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User and Platform Identification
    user_id = Column(String(255), nullable=False, index=True)  # Clerk user ID (string)
    platform = Column(String(50), nullable=False)  # 'gsc', 'bing', 'wordpress', 'wix'
    
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
    next_retry_at = Column(DateTime, nullable=True, index=True)  # Backoff retry schedule for refresh failures
    refresh_attempts = Column(Integer, default=0)  # Current retry attempt count for refresh workflow
    terminal_failure_reason = Column(Text, nullable=True)  # Permanent failure reason requiring user action
    channel_status = Column(String(32), default='connected')  # connected, degraded, disconnected
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Execution Logs Relationship
    execution_logs = relationship(
        "OAuthTokenExecutionLog",
        back_populates="task",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index('idx_oauth_token_tasks_user_platform', 'user_id', 'platform'),
        Index('idx_oauth_token_tasks_next_check', 'next_check'),
        Index('idx_oauth_token_tasks_status', 'status'),
    )
    
    def __repr__(self):
        return f"<OAuthTokenMonitoringTask(id={self.id}, user_id={self.user_id}, platform={self.platform}, status={self.status})>"


class OAuthTokenExecutionLog(Base):
    """
    Model for storing OAuth token monitoring execution logs.
    
    Tracks individual execution attempts with results and error details.
    """
    __tablename__ = "oauth_token_execution_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Task Reference
    task_id = Column(Integer, ForeignKey("oauth_token_monitoring_tasks.id"), nullable=False, index=True)
    
    # Execution Details
    execution_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), nullable=False)  # 'success', 'failed', 'skipped'
    
    # Results
    result_data = Column(JSON, nullable=True)  # Token status, expiration info, etc.
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to task
    task = relationship("OAuthTokenMonitoringTask", back_populates="execution_logs")
    
    __table_args__ = (
        Index('idx_oauth_token_logs_task_execution_date', 'task_id', 'execution_date'),
        Index('idx_oauth_token_logs_status', 'status'),
    )
    
    def __repr__(self):
        return f"<OAuthTokenExecutionLog(id={self.id}, task_id={self.task_id}, status={self.status}, execution_date={self.execution_date})>"

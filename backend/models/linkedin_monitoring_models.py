"""
LinkedIn Monitoring Models
Database models for tracking LinkedIn background sync/reanalysis tasks
and their execution logs.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, Index, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from models.enhanced_strategy_models import Base


class LinkedInProfileSyncTask(Base):
    """
    Recurring task that re-runs the LinkedIn profile pipeline
    (Phases 1-5) to catch external profile changes.
    """
    __tablename__ = "linkedin_profile_sync_tasks"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(String(255), nullable=False, index=True)

    status = Column(String(50), default="active", index=True)

    started_at = Column(DateTime, nullable=True)
    last_heartbeat = Column(DateTime, nullable=True)
    last_executed = Column(DateTime, nullable=True)
    last_success = Column(DateTime, nullable=True)
    last_failure = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)

    consecutive_failures = Column(Integer, default=0)
    failure_pattern = Column(JSON, nullable=True)

    next_execution = Column(DateTime, nullable=True, index=True)
    frequency_days = Column(Integer, default=7)

    payload = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    execution_logs = relationship(
        "LinkedInProfileSyncExecutionLog",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_linkedin_profile_sync_tasks_user_id", "user_id"),
        Index("idx_linkedin_profile_sync_tasks_next_execution", "next_execution"),
        Index("idx_linkedin_profile_sync_tasks_status", "status"),
    )

    def __repr__(self):
        return f"<LinkedInProfileSyncTask(id={self.id}, user_id={self.user_id}, status={self.status})>"


class LinkedInProfileSyncExecutionLog(Base):
    """Execution log for LinkedIn profile sync tasks."""
    __tablename__ = "linkedin_profile_sync_execution_logs"

    id = Column(Integer, primary_key=True, index=True)

    task_id = Column(Integer, ForeignKey("linkedin_profile_sync_tasks.id"), nullable=False, index=True)

    execution_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), nullable=False)

    result_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("LinkedInProfileSyncTask", back_populates="execution_logs")

    __table_args__ = (
        Index("idx_linkedin_profile_sync_execution_logs_task_date", "task_id", "execution_date"),
        Index("idx_linkedin_profile_sync_execution_logs_status", "status"),
    )

    def __repr__(self):
        return f"<LinkedInProfileSyncExecutionLog(id={self.id}, task_id={self.task_id}, status={self.status}, execution_date={self.execution_date})>"


class LinkedInPostAnalyticsSyncTask(Base):
    """
    Recurring task that syncs the user's last LinkedIn posts and
    engagement metrics from Unipile.
    """
    __tablename__ = "linkedin_post_analytics_sync_tasks"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(String(255), nullable=False, index=True)

    status = Column(String(50), default="active", index=True)

    started_at = Column(DateTime, nullable=True)
    last_heartbeat = Column(DateTime, nullable=True)
    last_executed = Column(DateTime, nullable=True)
    last_success = Column(DateTime, nullable=True)
    last_failure = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)

    consecutive_failures = Column(Integer, default=0)
    failure_pattern = Column(JSON, nullable=True)

    next_execution = Column(DateTime, nullable=True, index=True)
    frequency_hours = Column(Integer, default=24)

    payload = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    execution_logs = relationship(
        "LinkedInPostAnalyticsSyncExecutionLog",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_linkedin_post_analytics_sync_tasks_user_id", "user_id"),
        Index("idx_linkedin_post_analytics_sync_tasks_next_execution", "next_execution"),
        Index("idx_linkedin_post_analytics_sync_tasks_status", "status"),
    )

    def __repr__(self):
        return f"<LinkedInPostAnalyticsSyncTask(id={self.id}, user_id={self.user_id}, status={self.status})>"


class LinkedInPostAnalyticsSyncExecutionLog(Base):
    """Execution log for LinkedIn post analytics sync tasks."""
    __tablename__ = "linkedin_post_analytics_sync_execution_logs"

    id = Column(Integer, primary_key=True, index=True)

    task_id = Column(Integer, ForeignKey("linkedin_post_analytics_sync_tasks.id"), nullable=False, index=True)

    execution_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), nullable=False)

    result_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("LinkedInPostAnalyticsSyncTask", back_populates="execution_logs")

    __table_args__ = (
        Index("idx_linkedin_post_analytics_sync_execution_logs_task_date", "task_id", "execution_date"),
        Index("idx_linkedin_post_analytics_sync_execution_logs_status", "status"),
    )

    def __repr__(self):
        return f"<LinkedInPostAnalyticsSyncExecutionLog(id={self.id}, task_id={self.task_id}, status={self.status}, execution_date={self.execution_date})>"


class LinkedInGrowthReanalysisTask(Base):
    """
    Recurring task that re-runs ConsolidatedGrowthService.analyze_all()
    to capture trending topic / strategy drift.
    """
    __tablename__ = "linkedin_growth_reanalysis_tasks"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(String(255), nullable=False, index=True)

    status = Column(String(50), default="active", index=True)

    started_at = Column(DateTime, nullable=True)
    last_heartbeat = Column(DateTime, nullable=True)
    last_executed = Column(DateTime, nullable=True)
    last_success = Column(DateTime, nullable=True)
    last_failure = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)

    consecutive_failures = Column(Integer, default=0)
    failure_pattern = Column(JSON, nullable=True)

    next_execution = Column(DateTime, nullable=True, index=True)
    frequency_hours = Column(Integer, default=72)

    payload = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    execution_logs = relationship(
        "LinkedInGrowthReanalysisExecutionLog",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_linkedin_growth_reanalysis_tasks_user_id", "user_id"),
        Index("idx_linkedin_growth_reanalysis_tasks_next_execution", "next_execution"),
        Index("idx_linkedin_growth_reanalysis_tasks_status", "status"),
    )

    def __repr__(self):
        return f"<LinkedInGrowthReanalysisTask(id={self.id}, user_id={self.user_id}, status={self.status})>"


class LinkedInGrowthReanalysisExecutionLog(Base):
    """Execution log for LinkedIn growth reanalysis tasks."""
    __tablename__ = "linkedin_growth_reanalysis_execution_logs"

    id = Column(Integer, primary_key=True, index=True)

    task_id = Column(Integer, ForeignKey("linkedin_growth_reanalysis_tasks.id"), nullable=False, index=True)

    execution_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), nullable=False)

    result_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("LinkedInGrowthReanalysisTask", back_populates="execution_logs")

    __table_args__ = (
        Index("idx_linkedin_growth_reanalysis_execution_logs_task_date", "task_id", "execution_date"),
        Index("idx_linkedin_growth_reanalysis_execution_logs_status", "status"),
    )

    def __repr__(self):
        return f"<LinkedInGrowthReanalysisExecutionLog(id={self.id}, task_id={self.task_id}, status={self.status}, execution_date={self.execution_date})>"

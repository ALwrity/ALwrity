"""
Scheduler Event Models
Models for tracking scheduler-level events and history.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Float
from datetime import datetime

# Import the same Base from enhanced_strategy_models
from models.base import Base


class SchedulerEventLog(Base):
    """Model for storing scheduler-level events (check cycles, interval adjustments, etc.)"""
    __tablename__ = "scheduler_event_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False)  # 'check_cycle', 'interval_adjustment', 'start', 'stop', 'job_scheduled', 'job_cancelled'
    event_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Event details
    check_cycle_number = Column(Integer, nullable=True)  # For check_cycle events
    check_interval_minutes = Column(Integer, nullable=True)  # Interval at time of event
    previous_interval_minutes = Column(Integer, nullable=True)  # For interval_adjustment events
    new_interval_minutes = Column(Integer, nullable=True)  # For interval_adjustment events
    
    # Task execution summary for check cycles
    tasks_found = Column(Integer, nullable=True)
    tasks_executed = Column(Integer, nullable=True)
    tasks_failed = Column(Integer, nullable=True)
    tasks_by_type = Column(JSON, nullable=True)  # {'monitoring_task': 5, ...}
    
    # Job information
    job_id = Column(String(200), nullable=True)  # For job_scheduled/cancelled events
    job_type = Column(String(50), nullable=True)  # 'recurring', 'one_time'
    user_id = Column(String(200), nullable=True, index=True)  # For user isolation
    
    # Performance metrics
    check_duration_seconds = Column(Float, nullable=True)  # How long the check cycle took
    active_strategies_count = Column(Integer, nullable=True)
    active_executions = Column(Integer, nullable=True)
    
    # Additional context
    event_data = Column(JSON, nullable=True)  # Additional event-specific data
    error_message = Column(Text, nullable=True)  # For error events
    
    created_at = Column(DateTime, default=datetime.utcnow)


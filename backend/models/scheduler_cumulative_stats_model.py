"""
Scheduler Cumulative Stats Model
Model for storing persistent cumulative scheduler metrics that survive restarts.
"""

from sqlalchemy import Column, Integer, DateTime, Index
from datetime import datetime
from models.base import Base


class SchedulerCumulativeStats(Base):
    """Model for storing cumulative scheduler metrics that persist across restarts"""
    __tablename__ = "scheduler_cumulative_stats"
    
    id = Column(Integer, primary_key=True, index=True, default=1)  # Always use id=1
    total_check_cycles = Column(Integer, default=0, nullable=False)
    cumulative_tasks_found = Column(Integer, default=0, nullable=False)
    cumulative_tasks_executed = Column(Integer, default=0, nullable=False)
    cumulative_tasks_failed = Column(Integer, default=0, nullable=False)
    cumulative_tasks_skipped = Column(Integer, default=0, nullable=False)
    cumulative_job_completed = Column(Integer, default=0, nullable=False)
    cumulative_job_failed = Column(Integer, default=0, nullable=False)
    
    last_updated = Column(DateTime, default=datetime.utcnow, nullable=False, onupdate=datetime.utcnow)
    last_check_cycle_id = Column(Integer, nullable=True)  # Reference to last check_cycle event log ID
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_scheduler_cumulative_stats_single_row', 'id', unique=True),
    )
    
    @classmethod
    def get_or_create(cls, db_session):
        """
        Get the cumulative stats row (id=1) or create it if it doesn't exist.
        
        Returns:
            SchedulerCumulativeStats instance
        """
        stats = db_session.query(cls).filter(cls.id == 1).first()
        if not stats:
            stats = cls(id=1)
            db_session.add(stats)
            db_session.commit()
        return stats


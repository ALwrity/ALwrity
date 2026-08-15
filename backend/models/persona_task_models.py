"""
Persona Generation Task Model

Durable, per-user task state for the async persona generation flow. Replaces
the transient in-memory ``persona_tasks`` dict so a completed/failed task's
result survives a process restart and the polling endpoint never 404s purely
because the server restarted mid-generation.

The table lives in each user's own SQLite database (same engine used by the
onboarding ``OnboardingSession`` / ``PersonaData`` models). It is created
lazily via ``Base.metadata.create_all`` when the persona routes first touch it.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Index
from datetime import datetime

from models.base import Base


class PersonaGenerationTask(Base):
    __tablename__ = "persona_generation_tasks"

    id = Column(Integer, primary_key=True, index=True)

    task_id = Column(String(64), nullable=False, unique=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)

    status = Column(String(50), nullable=False, default="pending")  # pending | running | completed | failed
    progress = Column(Integer, default=0)
    current_step = Column(String(500), nullable=True)
    progress_messages = Column(JSON, default=list)

    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_persona_generation_tasks_user_status", "user_id", "status"),
    )

    def __repr__(self):
        return f"<PersonaGenerationTask(task_id={self.task_id}, user_id={self.user_id}, status={self.status})>"

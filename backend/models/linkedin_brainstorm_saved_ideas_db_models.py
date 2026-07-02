"""SQLAlchemy model for persisted Brainstorm saved ideas.

A saved idea is a per-user record of a Brainstorm prompt + rationale the
user wants to keep for later. Distinct from the existing in-flight
sessionStorage cache (1-hour TTL) that BrainstormFlow uses for fast
re-rendering.

Uses the shared ``WatchdogBase`` from ``linkedin_watchdog_db_models`` so
that ``database.init_user_database`` creates this table via the existing
``WatchdogBase.metadata.create_all`` call — no separate registration
needed in services/database.py.
"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Index
from models.linkedin_watchdog_db_models import Base as WatchdogBase


class BrainstormSavedIdeaDB(WatchdogBase):
    __tablename__ = "brainstorm_saved_ideas"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    prompt = Column(Text, nullable=False)
    rationale = Column(Text, nullable=True)
    # Free-form tags. Comma-separated string to avoid JSON parsing overhead
    # and keep the model portable. The frontend treats this as a
    # free-text label.
    tags = Column(String(512), nullable=True, default="")
    # Origin: the Brainstorm seed that produced this idea. Optional.
    source_seed = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        Index("ix_brainstorm_saved_ideas_user_created", "user_id", "created_at"),
    )

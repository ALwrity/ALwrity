"""Phase C: durable per-source SIF indexing lifecycle for the
content calendar.

The watermark (``calendar_sif_indexing_watermarks``) only proves a
*successful* embedding. The UI needs to distinguish "pending" (just
generated, embed scheduled) from "running" (currently embedding),
"success", "skipped", and "failed" while indexing is in flight —
so this row tracks the *lifecycle* of one generation's indexing job.

Contract:

- One row per ``(user_id, source_id)`` where ``source_id`` is
  ``user:{uid}:calendar_latest``.
- Status values: ``pending`` → ``running`` → ``success`` | ``skipped`` |
  ``failed``. A ``failed`` row keeps ``error_message`` for debugging and
  can be retried by re-dispatching (a new dispatch resets it to
  ``pending``).
- Writes are best-effort and never raise: a DB error returns ``None``
  and the caller proceeds (indexing must never fail generation).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column, DateTime, Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.exc import SQLAlchemyError

from loguru import logger

from models.base import Base

STATUS_PENDING = "pending"
STATUS_RUNNING = "running"
STATUS_SUCCESS = "success"
STATUS_FAILED = "failed"
STATUS_SKIPPED = "skipped"

CALENDAR_SIF_STATUSES = (
    STATUS_PENDING,
    STATUS_RUNNING,
    STATUS_SUCCESS,
    STATUS_FAILED,
    STATUS_SKIPPED,
)

_TERMINAL_STATUSES = {STATUS_SUCCESS, STATUS_FAILED, STATUS_SKIPPED}


class CalendarSifIndexStatus(Base):
    __tablename__ = "calendar_sif_index_status"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    source_id = Column(String(512), nullable=False)
    status = Column(String(20), nullable=False, default=STATUS_PENDING)
    embedding_count = Column(Integer, nullable=False, default=0)
    attempt = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "source_id", name="uq_calendar_sif_status_user_source"
        ),
        Index("ix_calendar_sif_status_user_status", "user_id", "status"),
    )

    @classmethod
    def get(cls, session, user_id: str, source_id: str):
        try:
            return (
                session.query(cls)
                .filter(cls.user_id == user_id, cls.source_id == source_id)
                .one_or_none()
            )
        except SQLAlchemyError as exc:
            logger.warning(
                f"CalendarSifIndexStatus.get DB error for user={user_id} "
                f"source={source_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return None

    @classmethod
    def set_status(
        cls,
        session,
        user_id: str,
        source_id: str,
        status: str,
        *,
        embedding_count: int = 0,
        error_message=None,
    ):
        try:
            now = datetime.utcnow()
            row = (
                session.query(cls)
                .filter(cls.user_id == user_id, cls.source_id == source_id)
                .one_or_none()
            )
            if row is None:
                row = cls(
                    user_id=user_id,
                    source_id=source_id,
                    attempt=0,
                    embedding_count=0,
                )
                session.add(row)

            prev = row.status
            row.status = status
            row.updated_at = now
            if embedding_count:
                row.embedding_count = int(embedding_count)
            if error_message is not None:
                row.error_message = str(error_message)

            if status in (STATUS_PENDING, STATUS_RUNNING):
                if prev in _TERMINAL_STATUSES or row.started_at is None:
                    row.started_at = now
                    row.finished_at = None
                if status == STATUS_RUNNING:
                    row.attempt = (row.attempt or 0) + 1
            elif status in _TERMINAL_STATUSES:
                row.finished_at = now

            return row
        except SQLAlchemyError as exc:
            logger.warning(
                f"CalendarSifIndexStatus.set_status DB error for user={user_id} "
                f"source={source_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return None

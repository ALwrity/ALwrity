"""Phase 1 (lifecycle): durable per-source SIF indexing status for the
active content strategy.

The watermark (``sif_indexing_watermarks``) only proves a *successful*
embedding. The UI needs to distinguish "pending" (just activated, embed
scheduled) from "running" (currently embedding), "success", "skipped",
and "failed" while indexing is in flight — so this row tracks the
*lifecycle* of one activation's indexing job.

Contract:

- One row per ``(user_id, source_id)`` where ``source_id`` is the
  strategy source id ``user:{uid}:strategy_active:current``.
- Status values: ``pending`` → ``running`` → ``success`` | ``skipped`` |
  ``failed``. A ``failed`` row keeps ``error_message`` for debugging and
  can be retried by re-dispatching (a new dispatch resets it to
  ``pending``).
- Writes are best-effort and never raise: a DB error returns ``None``
  and the caller proceeds (indexing must never fail activation).
- The table is created via ``alembic upgrade head`` (see
  ``f102a3b4c5d6_add_strategy_sif_index_status`` migration); tests that
  build standalone engines create it via ``__table__.create(engine)``.
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

STRATEGY_SIF_STATUSES = (
    STATUS_PENDING,
    STATUS_RUNNING,
    STATUS_SUCCESS,
    STATUS_FAILED,
    STATUS_SKIPPED,
)

# Terminal states: once reached for an activation run, a later dispatch
# resets the row to ``pending`` again. Only ``pending``/``running`` are
# in-flight.
_TERMINAL_STATUSES = {STATUS_SUCCESS, STATUS_FAILED, STATUS_SKIPPED}


class StrategySifIndexStatus(Base):
    __tablename__ = "strategy_sif_index_status"

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
            "user_id", "source_id", name="uq_strategy_sif_status_user_source"
        ),
        Index("ix_strategy_sif_status_user_status", "user_id", "status"),
    )

    @classmethod
    def get(cls, session, user_id: str, source_id: str):
        """Return the status row for ``(user_id, source_id)`` or ``None``.

        ``None`` on a missing row AND on any DB error (caller treats both
        as "no lifecycle yet" — never raises).
        """
        try:
            return (
                session.query(cls)
                .filter(cls.user_id == user_id, cls.source_id == source_id)
                .one_or_none()
            )
        except SQLAlchemyError as exc:
            logger.warning(
                f"StrategySifIndexStatus.get DB error for user={user_id} "
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
        """Create/update the lifecycle row for one activation.

        Best-effort upsert: transitions are recorded but a DB failure
        never raises (the caller still awaits the pipeline). Returns the
        row, or ``None`` on a DB error. The caller owns ``commit()``.

        - Creating the row or (re)entering ``pending``/``running``
          stamps ``started_at``.
        - Entering a terminal state stamps ``finished_at``.
        - ``attempt`` increments on every entry into ``running``.
        """
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
                f"StrategySifIndexStatus.set_status DB error for user={user_id} "
                f"source={source_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return None
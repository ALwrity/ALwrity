"""Phase C: per-user calendar SIF indexing watermark.

Tracks the last successful embedding of a particular calendar source
(``source_id`` is ``user:{uid}:calendar_latest``). The indexer can ask
``CalendarSifWatermark.is_fresh(user_id, source_id, source_hash)``
before re-embedding to skip work that is already up to date in the
txtai index.

The table is intentionally small and append-mostly: it never blocks
on the txtai side. ``source_hash`` is a content hash (sha256 hex
digest) computed from the full calendar snapshot. If the caller doesn't
have a hash, pass ``""`` and the watermark will be treated as never
matching, forcing a re-embed (safe default).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Index, UniqueConstraint,
)
from sqlalchemy.exc import SQLAlchemyError

from loguru import logger

from models.base import Base


class CalendarSifWatermark(Base):
    __tablename__ = "calendar_sif_indexing_watermarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    source_id = Column(String(512), nullable=False)
    source_hash = Column(String(128), nullable=False, default="")
    embedding_count = Column(Integer, nullable=False, default=0)
    indexed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    # R4.2: generation token (ISO generated_at of the SUCCESSFULLY indexed
    # generation) — fences concurrent lifecycle jobs so an older, slower
    # job cannot overwrite a newer one's watermark.
    generation_token = Column(String(64), nullable=False, default="")
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "source_id", name="uq_calendar_sif_watermark_user_source"),
        Index("ix_calendar_sif_watermark_user_indexed", "user_id", "indexed_at"),
    )

    @classmethod
    def is_fresh(cls, session, user_id: str, source_id: str, source_hash: str) -> bool:
        if not source_hash:
            return False
        try:
            row = (
                session.query(cls)
                .filter(cls.user_id == user_id, cls.source_id == source_id)
                .one_or_none()
            )
            if row is None:
                return False
            return row.source_hash == source_hash
        except SQLAlchemyError as exc:
            logger.warning(
                f"CalendarSifWatermark.is_fresh DB error for user={user_id} "
                f"source={source_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return False

    @classmethod
    def get_indexed_source_ids(cls, session, user_id: str, source_ids) -> set:
        ids = list(source_ids or [])
        if not ids:
            return set()
        try:
            rows = (
                session.query(cls.source_id)
                .filter(cls.user_id == user_id, cls.source_id.in_(ids))
                .all()
            )
            return {r[0] for r in rows}
        except SQLAlchemyError as exc:
            logger.warning(
                f"CalendarSifWatermark.get_indexed_source_ids DB error for "
                f"user={user_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return set()

    @classmethod
    def upsert(
        cls,
        session,
        user_id: str,
        source_id: str,
        source_hash: str,
        embedding_count: int = 0,
        generation_token: Optional[str] = None,
        notes=None,
    ):
        try:
            row = (
                session.query(cls)
                .filter(cls.user_id == user_id, cls.source_id == source_id)
                .one_or_none()
            )
            if row is None:
                row = cls(
                    user_id=user_id,
                    source_id=source_id,
                    source_hash=source_hash,
                    embedding_count=embedding_count,
                    generation_token=generation_token or "",
                    notes=notes,
                )
                session.add(row)
            else:
                row.source_hash = source_hash
                row.embedding_count = embedding_count
                row.indexed_at = datetime.utcnow()
                if generation_token is not None:
                    row.generation_token = generation_token
                if notes is not None:
                    row.notes = notes
            return row
        except SQLAlchemyError as exc:
            logger.warning(
                f"CalendarSifWatermark.upsert DB error for user={user_id} "
                f"source={source_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return None

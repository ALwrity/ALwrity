"""Phase 3.4: per-user SIF indexing watermark.

Tracks the last successful embedding of a particular source
(``source_id`` is a stable opaque key produced by the harvester or
other indexers, e.g. ``"market_trends:2024-06-18"`` or
``"onboarding:user-123:strategy"``). The indexer can ask
``SIFIndexingWatermark.is_fresh(user_id, source_id, source_hash)``
before re-embedding to skip work that is already up to date in the
txtai index.

The table is intentionally small and append-mostly: it never blocks
on the txtai side. ``source_hash`` is a content hash (sha256 hex
digest preferred) computed by the caller. If the caller doesn't have
a hash, pass ``""`` and the watermark will be treated as never
matching, forcing a re-embed (safe default).

The model uses a *standalone* declarative base rather than
``EnhancedStrategyBase`` because the enhanced strategy module has
many cross-references between models that make isolated testing
fragile (SQLAlchemy's mapper initialization fails on a partial
import). The schema is created via the explicit
``_ensure_sif_indexing_watermark_table`` migration in
``services/database.py``, not via ``Base.metadata.create_all``.
"""
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Index, UniqueConstraint,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base

from loguru import logger

# Phase 3.4: standalone base. The model is a leaf table (no
# relationships), so the cost of a separate metadata registry is
# negligible. The auto-migration in services/database.py issues a
# matching CREATE TABLE IF NOT EXISTS.
Base = declarative_base()


class SIFIndexingWatermark(Base):
    __tablename__ = "sif_indexing_watermarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    source_id = Column(String(512), nullable=False)
    source_hash = Column(String(128), nullable=False, default="")
    embedding_count = Column(Integer, nullable=False, default=0)
    indexed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "source_id", name="uq_sif_watermark_user_source"),
        Index("ix_sif_watermark_user_indexed", "user_id", "indexed_at"),
    )

    @classmethod
    def is_fresh(cls, session, user_id: str, source_id: str, source_hash: str) -> bool:
        """Return True if the watermark for ``(user_id, source_id)`` matches
        ``source_hash`` and was updated recently enough to be considered fresh.

        The "recent" check is intentionally absent in this Phase 3.4 MVP:
        freshness is purely a hash match. A future Phase 3.4b can add a
        max-age policy (e.g. always re-embed if older than 7 days) once we
        have telemetry on how often content actually changes.

        Returns False on any database error so the caller falls back to
        re-embedding (safe behavior).
        """
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
                f"SIFIndexingWatermark.is_fresh DB error for user={user_id} "
                f"source={source_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return False

    @classmethod
    def upsert(
        cls,
        session,
        user_id: str,
        source_id: str,
        source_hash: str,
        embedding_count: int = 0,
        notes=None,
    ):
        """Insert or update a watermark row.

        Returns the persisted row. The caller is responsible for
        ``session.commit()``. On error, the session is rolled back and
        ``None`` is returned; the caller should treat this as a non-fatal
        watermark failure (re-embedding can still proceed, but next call
        won't see the optimization).
        """
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
                    notes=notes,
                )
                session.add(row)
            else:
                row.source_hash = source_hash
                row.embedding_count = embedding_count
                row.indexed_at = datetime.utcnow()
                if notes is not None:
                    row.notes = notes
            return row
        except SQLAlchemyError as exc:
            logger.warning(
                f"SIFIndexingWatermark.upsert DB error for user={user_id} "
                f"source={source_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return None


"""Per-user semantic monitoring snapshot history.

Stores each monitoring-cycle snapshot so the dashboard can show
trend data across process restarts. The in-memory
``RealTimeSemanticMonitor.monitoring_history`` list is bounded to
the last 24 hours within a single process; this table is the
durable counterpart that survives restarts and is shared across
multi-instance deployments.

Each row is one monitoring cycle's snapshot for one user. The
``snapshot_json`` column contains the full payload dict
(``timestamp``, ``health_metrics``, ``competitor_updates``,
``content_insights``) so consumers can deserialise it back into
the same shape the in-memory list produces.

Rows older than 24 hours are pruned periodically by
``prune_old_snapshots`` (called from the scheduler check cycle
handler). The table is intentionally append-mostly: writes
dominate, reads are time-range queries.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Index,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base

from loguru import logger

Base = declarative_base()


class SemanticMonitoringSnapshot(Base):
    __tablename__ = "semantic_monitoring_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    # The cycle timestamp as recorded by the monitor. Indexed for
    # time-range queries via ``get_recent_snapshots``.
    captured_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    # Full snapshot dict as JSON.
    snapshot_json = Column(Text, nullable=False)

    __table_args__ = (
        Index("ix_semantic_snapshot_user_captured", "user_id", "captured_at"),
    )

    @classmethod
    def append_snapshot(
        cls,
        session,
        user_id: str,
        snapshot: Dict[str, Any],
    ) -> Optional["SemanticMonitoringSnapshot"]:
        """Append a snapshot row. Returns the persisted row, or
        ``None`` on a database error. The caller is responsible
        for ``session.commit()``.
        """
        import json
        try:
            row = cls(
                user_id=user_id,
                captured_at=datetime.utcnow(),
                snapshot_json=json.dumps(snapshot),
            )
            session.add(row)
            return row
        except SQLAlchemyError as exc:
            logger.warning(
                f"SemanticMonitoringSnapshot.append_snapshot DB error for user={user_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return None

    @classmethod
    def get_recent_snapshots(
        cls,
        session,
        user_id: str,
        hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """Return snapshots for the user newer than ``hours`` ago.
        Returns an empty list on a database error so the caller
        can fall back to the in-memory list (or render an empty
        chart) without crashing.
        """
        import json
        try:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            rows = (
                session.query(cls)
                .filter(cls.user_id == user_id, cls.captured_at >= cutoff)
                .order_by(cls.captured_at.asc())
                .all()
            )
            out: List[Dict[str, Any]] = []
            for row in rows:
                try:
                    out.append(json.loads(row.snapshot_json))
                except (ValueError, TypeError):
                    # Corrupt snapshot JSON — skip and continue. Don't
                    # let a single bad row poison the whole response.
                    logger.warning(
                        f"SemanticMonitoringSnapshot: corrupt JSON for row id={row.id} user={user_id}"
                    )
                    continue
            return out
        except SQLAlchemyError as exc:
            logger.warning(
                f"SemanticMonitoringSnapshot.get_recent_snapshots DB error for user={user_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return []

    @classmethod
    def prune_old_snapshots(cls, session, max_age_hours: int = 24) -> int:
        """Delete snapshot rows older than ``max_age_hours``. Returns
        the number of rows deleted. Best-effort: errors are logged
        and result in 0 deletions.
        """
        try:
            cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
            deleted = (
                session.query(cls)
                .filter(cls.captured_at < cutoff)
                .delete(synchronize_session=False)
            )
            try:
                session.commit()
            except Exception:
                session.rollback()
            return int(deleted or 0)
        except SQLAlchemyError as exc:
            logger.warning(
                f"SemanticMonitoringSnapshot.prune_old_snapshots DB error: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return 0

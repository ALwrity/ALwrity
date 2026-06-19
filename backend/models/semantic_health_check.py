"""Per-user semantic health check ledger.

Replaces the JSON-file state previously stored at
``~/.alwrity/scheduler_state/semantic_last_checks.json`` so the
24-hour cadence and the latest health snapshot survive across
process restarts and stay consistent across multi-instance
deployments.

Two distinct roles share one table:

- **Cadence tracking**: ``last_check_at`` records when the scheduler
  last ran the 24-hour health check for a user. The scheduler reads
  this column (instead of a JSON file) to decide whether the next
  cycle should re-check.
- **Snapshot history**: ``status``, ``value``, ``description``,
  ``recommendations_json``, and ``snapshot_json`` capture the latest
  health result. This gives the dashboard and operators a queryable
  history across restarts that the in-memory
  ``RealTimeSemanticMonitor.monitoring_history`` cannot provide.

The model uses a *standalone* declarative base rather than
``EnhancedStrategyBase`` for the same reason as
``SIFIndexingWatermark``: the enhanced strategy module has many
cross-references between models that make isolated testing fragile.
The schema is created via the explicit
``_ensure_semantic_health_checks_table`` migration in
``services/database.py``, not via ``Base.metadata.create_all``.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Index, UniqueConstraint,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base

from loguru import logger

Base = declarative_base()


class SemanticHealthCheck(Base):
    __tablename__ = "semantic_health_checks"

    id = Column(Integer, primary_key=True, index=True)
    # One row per user. The user_id is the natural key for the
    # cadence check ("when did we last check this user?"), and the
    # 24-hour cadence means we don't need a separate per-cycle table
    # to track history within a single cycle. Future phases that
    # want full per-cycle history can add a sibling table keyed on
    # (user_id, check_at) without breaking this one.
    user_id = Column(String(255), nullable=False)
    # When the scheduler last ran the health check. Read by the
    # scheduler to enforce the 24-hour cadence.
    last_check_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    # Status string from ``SemanticHealthMetric.status``:
    # "healthy" | "warning" | "critical" | "not_available".
    status = Column(String(32), nullable=False, default="unknown")
    # Aggregate value (0.0-1.0). Mirrors ``SemanticHealthMetric.value``.
    value = Column(Integer, nullable=False, default=0)  # SQLite-friendly
    # Optional description; full payload stored in snapshot_json.
    description = Column(Text, nullable=True)
    # Recommendations as a JSON-serialised list. Stored as TEXT to
    # avoid Postgres/SQLite type divergence in tenant DBs.
    recommendations_json = Column(Text, nullable=True)
    # Full snapshot dict (health_metrics, competitor_updates, content_insights)
    # as JSON. Optional: only populated when the caller has the data.
    snapshot_json = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_semantic_health_check_user"),
        Index("ix_semantic_health_check_user", "user_id"),
    )

    @classmethod
    def record_check(
        cls,
        session,
        user_id: str,
        status: str,
        value: Optional[float] = None,
        description: Optional[str] = None,
        recommendations: Optional[List[str]] = None,
        snapshot: Optional[Dict[str, Any]] = None,
    ) -> Optional["SemanticHealthCheck"]:
        """Upsert the per-user row.

        Returns the persisted row, or ``None`` on a database error.
        The caller is responsible for ``session.commit()`` (or
        ``session.rollback()`` if they get ``None`` back).
        """
        import json
        try:
            row = (
                session.query(cls)
                .filter(cls.user_id == user_id)
                .one_or_none()
            )
            now = datetime.utcnow()
            recommendations_str = (
                json.dumps(recommendations)
                if recommendations is not None
                else None
            )
            snapshot_str = json.dumps(snapshot) if snapshot is not None else None
            # value is stored as Integer for cross-DB compatibility
            # (SQLite REAL would also work, but tenants may have a
            # legacy column type). We multiply by 10000 to keep 4
            # decimal places of precision without using float.
            value_int = (
                int(round(value * 10000)) if value is not None else 0
            )
            if row is None:
                row = cls(
                    user_id=user_id,
                    last_check_at=now,
                    status=status,
                    value=value_int,
                    description=description,
                    recommendations_json=recommendations_str,
                    snapshot_json=snapshot_str,
                )
                session.add(row)
            else:
                row.last_check_at = now
                row.status = status
                row.value = value_int
                if description is not None:
                    row.description = description
                if recommendations_str is not None:
                    row.recommendations_json = recommendations_str
                if snapshot_str is not None:
                    row.snapshot_json = snapshot_str
            return row
        except SQLAlchemyError as exc:
            logger.warning(
                f"SemanticHealthCheck.record_check DB error for user={user_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return None

    @classmethod
    def get_last_check_at(cls, session, user_id: str) -> Optional[datetime]:
        """Return the last_check_at for the user, or None if no
        check has been recorded yet (or the DB is unavailable).
        """
        try:
            row = (
                session.query(cls)
                .filter(cls.user_id == user_id)
                .one_or_none()
            )
            return row.last_check_at if row else None
        except SQLAlchemyError as exc:
            logger.warning(
                f"SemanticHealthCheck.get_last_check_at DB error for user={user_id}: {exc}"
            )
            try:
                session.rollback()
            except Exception:
                pass
            return None

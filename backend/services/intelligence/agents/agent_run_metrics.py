"""
Durable agent performance metrics aggregated from the AgentRun table.

The in-memory performance monitor is a hot cache: it loses everything on
restart and only reflects data points explicitly recorded at runtime. This
module derives action counts, success rates, and response durations from
`agent_runs`, which `AgentActivityService.start_run/finish_run` persists for
every real agent execution. Aggregations are failure-safe: when the database
is unavailable they return honest empties instead of zeros that would look
like measured values.
"""

from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from models.agent_activity_models import AgentRun
from services.database import get_session_for_user
from utils.logger_utils import get_service_logger

logger = get_service_logger(__name__)


@dataclass
class AgentRunStats:
    """Aggregated run statistics for one agent over a time window."""

    agent_id: str
    window_hours: int
    total_runs: int
    successful_runs: int
    failed_runs: int
    success_rate: Optional[float]
    avg_duration_seconds: Optional[float]
    last_run_at: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _empty_stats(agent_id: str, window_hours: int) -> AgentRunStats:
    return AgentRunStats(
        agent_id=agent_id,
        window_hours=window_hours,
        total_runs=0,
        successful_runs=0,
        failed_runs=0,
        success_rate=None,
        avg_duration_seconds=None,
        last_run_at=None,
    )


def _window_start(window_hours: int) -> datetime:
    return datetime.utcnow() - timedelta(hours=max(1, int(window_hours)))


def _fetch_agent_stats_sync(
    session,
    user_id: str,
    agent_id: str,
    since: datetime,
) -> AgentRunStats:
    rows = (
        session.query(
            AgentRun.success,
            AgentRun.started_at,
            AgentRun.finished_at,
        )
        .filter(
            AgentRun.user_id == user_id,
            AgentRun.agent_type == agent_id,
            AgentRun.started_at >= since,
        )
        .all()
    )

    stats = _empty_stats(agent_id, window_hours=int((datetime.utcnow() - since).total_seconds() // 3600) or 1)
    stats.total_runs = len(rows)
    durations: List[float] = []
    last_finished: Optional[datetime] = None
    last_started: Optional[datetime] = None
    for success, started_at, finished_at in rows:
        if success is True:
            stats.successful_runs += 1
        elif success is False:
            stats.failed_runs += 1
        if finished_at is not None and started_at is not None:
            durations.append(max(0.0, (finished_at - started_at).total_seconds()))
        if finished_at is not None and (last_finished is None or finished_at > last_finished):
            last_finished = finished_at
        if started_at is not None and (last_started is None or started_at > last_started):
            last_started = started_at
    finished_runs = stats.successful_runs + stats.failed_runs
    stats.success_rate = (
        stats.successful_runs / finished_runs if finished_runs > 0 else None
    )
    stats.avg_duration_seconds = (
        sum(durations) / len(durations) if durations else None
    )
    latest = max(
        (ts for ts in (last_finished, last_started) if ts is not None),
        default=None,
    )
    stats.last_run_at = latest.isoformat() if latest else None
    return stats


async def get_agent_run_stats(
    user_id: str,
    agent_id: str,
    window_hours: int = 720,
) -> AgentRunStats:
    """Durable stats for one agent; honest empty stats on any failure."""
    from starlette.concurrency import run_in_threadpool

    try:
        since = _window_start(window_hours)

        def _query():
            session = get_session_for_user(user_id)
            try:
                return _fetch_agent_stats_sync(session, user_id, agent_id, since)
            finally:
                session.close()

        return await run_in_threadpool(_query)
    except Exception as exc:
        logger.error(f"Failed to aggregate AgentRun stats for {agent_id}: {exc}")
        return _empty_stats(agent_id, window_hours)


async def get_all_agent_run_stats(
    user_id: str,
    window_hours: int = 720,
) -> Dict[str, AgentRunStats]:
    """Durable stats keyed by agent_type; empty dict on failure."""
    from starlette.concurrency import run_in_threadpool

    try:
        since = _window_start(window_hours)

        def _query():
            session = get_session_for_user(user_id)
            try:
                agent_ids = [
                    row[0]
                    for row in session.query(AgentRun.agent_type)
                    .filter(
                        AgentRun.user_id == user_id,
                        AgentRun.started_at >= since,
                    )
                    .distinct()
                    .all()
                    if row[0]
                ]
                return {
                    agent_id: _fetch_agent_stats_sync(session, user_id, agent_id, since)
                    for agent_id in agent_ids
                }
            finally:
                session.close()

        return await run_in_threadpool(_query)
    except Exception as exc:
        logger.error(f"Failed to aggregate AgentRun stats for user {user_id}: {exc}")
        return {}

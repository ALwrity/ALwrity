from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.agent_activity_models import Base, AgentRun
from services.intelligence.agents.agent_run_metrics import (
    AgentRunStats,
    _empty_stats,
    _fetch_agent_stats_sync,
)
from services.intelligence.agents.performance_monitor import (
    AgentPerformanceMonitor,
    AgentStatus,
    PerformanceMetric,
)


@pytest.fixture()
def session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    yield db
    db.close()


def _add_run(db, user_id, agent_type, success, started_at, finished_at=None):
    run = AgentRun(
        user_id=user_id,
        agent_type=agent_type,
        status="running" if finished_at is None else ("completed" if success else "failed"),
        success=success,
        started_at=started_at,
        finished_at=finished_at,
    )
    db.add(run)
    db.commit()
    return run


class TestSyncAggregation:
    def test_counts_and_success_rate_from_finished_runs(self, session):
        now = datetime.utcnow()
        _add_run(session, "u1", "seo_specialist", True, now - timedelta(hours=2), now - timedelta(hours=2) + timedelta(seconds=10))
        _add_run(session, "u1", "seo_specialist", False, now - timedelta(hours=1), now - timedelta(hours=1) + timedelta(seconds=30))

        stats = _fetch_agent_stats_sync(session, "u1", "seo_specialist", now - timedelta(days=7))

        assert stats.total_runs == 2
        assert stats.successful_runs == 1
        assert stats.failed_runs == 1
        assert stats.success_rate == pytest.approx(0.5)

    def test_avg_duration_uses_started_and_finished_pairs(self, session):
        now = datetime.utcnow()
        _add_run(session, "u1", "agent_a", True, now - timedelta(minutes=20), now - timedelta(minutes=20) + timedelta(seconds=10))
        _add_run(session, "u1", "agent_a", True, now - timedelta(minutes=10), now - timedelta(minutes=10) + timedelta(seconds=30))
        # Running run without finish must not contribute a duration.
        _add_run(session, "u1", "agent_a", None, now - timedelta(minutes=5), None)

        stats = _fetch_agent_stats_sync(session, "u1", "agent_a", now - timedelta(days=7))

        assert stats.avg_duration_seconds == pytest.approx(20.0)
        # Only the two finished runs count toward success rate.
        assert stats.success_rate == pytest.approx(1.0)

    def test_success_rate_none_when_nothing_finished(self, session):
        now = datetime.utcnow()
        _add_run(session, "u1", "agent_b", None, now - timedelta(minutes=5), None)

        stats = _fetch_agent_stats_sync(session, "u1", "agent_b", now - timedelta(days=7))

        assert stats.total_runs == 1
        assert stats.successful_runs == 0
        assert stats.failed_runs == 0
        assert stats.success_rate is None

    def test_window_filters_old_runs(self, session):
        now = datetime.utcnow()
        _add_run(session, "u1", "agent_c", True, now - timedelta(days=30), now - timedelta(days=29))
        _add_run(session, "u1", "agent_c", True, now - timedelta(hours=1), now - timedelta(minutes=50))

        stats = _fetch_agent_stats_sync(session, "u1", "agent_c", now - timedelta(days=7))

        assert stats.total_runs == 1
        assert stats.last_run_at is not None


class TestMonitorMerge:
    @pytest.fixture()
    def monitor(self):
        return AgentPerformanceMonitor("u1")

    @staticmethod
    def _durable(agent_id="content_strategist", total=10, ok=8, failed=2, rate=0.8, dur=12.5, last="2026-08-24T10:00:00"):
        return AgentRunStats(
            agent_id=agent_id,
            window_hours=720,
            total_runs=total,
            successful_runs=ok,
            failed_runs=failed,
            success_rate=rate,
            avg_duration_seconds=dur,
            last_run_at=last,
        )

    @pytest.mark.asyncio
    async def test_durable_stats_are_authoritative_for_counts(self, monitor):
        async def durable(agent_id):
            return TestMonitorMerge._durable()

        monitor._durable_stats = durable
        snapshot = await monitor.update_agent_snapshot("content_strategist", AgentStatus.ACTIVE)

        assert snapshot.total_actions == 10
        assert snapshot.successful_actions == 8
        assert snapshot.failed_actions == 2
        assert snapshot.success_rate == pytest.approx(0.8)
        assert snapshot.average_response_time == pytest.approx(12.5)

    @pytest.mark.asyncio
    async def test_hot_cache_supplements_non_derivable_metrics(self, monitor):
        async def durable(agent_id):
            return TestMonitorMerge._durable()

        monitor._durable_stats = durable
        await monitor.record_performance_data("content_strategist", PerformanceMetric.EFFICIENCY_SCORE, 0.9)
        snapshot = await monitor.update_agent_snapshot("content_strategist", AgentStatus.ACTIVE)

        # Efficiency only exists in the hot cache; runs cannot derive it.
        assert snapshot.efficiency_score == pytest.approx(0.9)

    @pytest.mark.asyncio
    async def test_falls_back_to_in_memory_when_no_persisted_runs(self, monitor):
        async def empty_durable(agent_id):
            return _empty_stats("content_strategist", 720)

        monitor._durable_stats = empty_durable
        await monitor.record_performance_data("content_strategist", PerformanceMetric.SUCCESS_RATE, 1.0)
        await monitor.record_performance_data("content_strategist", PerformanceMetric.SUCCESS_RATE, 0.0)
        await monitor.record_performance_data("content_strategist", PerformanceMetric.RESPONSE_TIME, 5.0)

        snapshot = await monitor.update_agent_snapshot("content_strategist", AgentStatus.ACTIVE)

        assert snapshot.total_actions == 2
        assert snapshot.successful_actions == 1
        assert snapshot.success_rate == pytest.approx(0.5)
        assert snapshot.average_response_time == pytest.approx(5.0)

    @pytest.mark.asyncio
    async def test_summary_survives_restart_from_durable_only(self, monitor):
        async def durable(agent_id):
            return TestMonitorMerge._durable(rate=0.6, dur=40.0)

        monitor._durable_stats = durable
        summary = await monitor.get_performance_summary("content_strategist")

        assert summary != {}
        current = summary["current_performance"]
        assert current["total_actions"] == 10
        assert current["success_rate"] == pytest.approx(0.6)
        assert current["average_response_time"] == pytest.approx(40.0)

    @pytest.mark.asyncio
    async def test_summary_returns_empty_when_no_data_anywhere(self, monitor):
        async def empty_durable(agent_id):
            return _empty_stats("ghost_agent", 720)

        monitor._durable_stats = empty_durable
        assert await monitor.get_performance_summary("ghost_agent") == {}

    @pytest.mark.asyncio
    async def test_all_agents_includes_durable_only_agents(self, monitor, monkeypatch):
        import services.intelligence.agents.agent_run_metrics as arm

        async def fake_all(user_id, window_hours=720):
            return {"seo_specialist": TestMonitorMerge._durable(agent_id="seo_specialist")}

        monkeypatch.setattr(arm, "get_all_agent_run_stats", fake_all)

        summaries = await monitor.get_all_agents_performance()

        by_agent = {entry["agent_id"]: entry for entry in summaries}
        assert "seo_specialist" in by_agent
        entry = by_agent["seo_specialist"]
        assert entry["total_actions"] == 10
        # Non-derivable metrics stay honest zeros for durable-only agents.
        assert entry["efficiency_score"] == 0.0
        assert entry["market_impact"] == 0.0

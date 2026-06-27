"""Tests for TaskScheduler lifecycle: start/stop lock, is_running, health_check."""

import asyncio
from unittest import mock

import pytest

from services.scheduler.core.scheduler import TaskScheduler
from services.scheduler.core.settings import SchedulerSettings


@pytest.fixture
def settings():
    """Minimal settings for fast test startup (no DB)."""
    return SchedulerSettings(
        check_interval_minutes=60,
        min_check_interval_minutes=60,
        max_check_interval_minutes=60,
        max_concurrent_executions=2,
        max_retries=1,
        misfire_grace_time_seconds=3600,
        shutdown_timeout_seconds=5,
        missed_job_grace_seconds=3600,
        task_lease_ttl_seconds=900,
    )


@pytest.fixture
def scheduler(settings):
    return TaskScheduler(settings=settings)


class TestSchedulerLifecycle:
    """start/stop state transitions."""

    @pytest.mark.asyncio
    async def test_initial_state_not_running(self, scheduler):
        assert scheduler._running is False
        assert scheduler.is_running is False

    @pytest.mark.asyncio
    async def test_start_sets_running(self, scheduler):
        assert scheduler._running is False
        with mock.patch.object(scheduler, "_leadership_tick", return_value=None):
            with mock.patch.object(scheduler, "_execute_missed_jobs", return_value=None):
                with mock.patch.object(scheduler, "_validate_and_rebuild_cumulative_stats", return_value=None):
                    await scheduler.start()
        assert scheduler._running is True
        assert scheduler.is_running is True

    @pytest.mark.asyncio
    async def test_double_start_noop(self, scheduler):
        with mock.patch.object(scheduler, "_leadership_tick", return_value=None):
            with mock.patch.object(scheduler, "_execute_missed_jobs", return_value=None):
                with mock.patch.object(scheduler, "_validate_and_rebuild_cumulative_stats", return_value=None):
                    await scheduler.start()
                    assert scheduler._running is True
                    await scheduler.start()
        assert scheduler._running is True

    @pytest.mark.asyncio
    async def test_stop_sets_not_running(self, scheduler):
        with mock.patch.object(scheduler, "_leadership_tick", return_value=None):
            with mock.patch.object(scheduler, "_execute_missed_jobs", return_value=None):
                with mock.patch.object(scheduler, "_validate_and_rebuild_cumulative_stats", return_value=None):
                    await scheduler.start()
        assert scheduler._running is True
        await scheduler.stop()
        assert scheduler._running is False
        assert scheduler.is_running is False

    @pytest.mark.asyncio
    async def test_double_stop_noop(self, scheduler):
        await scheduler.stop()
        assert scheduler._running is False
        await scheduler.stop()
        assert scheduler._running is False

    @pytest.mark.asyncio
    async def test_health_check_not_running(self, scheduler):
        health = await scheduler.health_check()
        assert health["healthy"] is False
        assert health["running"] is False
        assert "scheduler_running" in health
        assert health["active_executions"] == 0

    @pytest.mark.asyncio
    async def test_health_check_running(self, scheduler):
        with mock.patch.object(scheduler, "_leadership_tick", return_value=None):
            with mock.patch.object(scheduler, "_execute_missed_jobs", return_value=None):
                with mock.patch.object(scheduler, "_validate_and_rebuild_cumulative_stats", return_value=None):
                    await scheduler.start()
        health = await scheduler.health_check()
        assert health["running"] is True
        assert health["active_executions"] == 0

    @pytest.mark.asyncio
    async def test_concurrent_start_lock(self, settings):
        s1 = TaskScheduler(settings=settings)
        async def noop():
            return None
        module = "services.scheduler.core.scheduler"
        with mock.patch.object(s1, "_leadership_tick", new=noop):
            with mock.patch.object(s1, "_execute_missed_jobs", new=noop):
                with mock.patch.object(s1, "_validate_and_rebuild_cumulative_stats", new=noop):
                    with mock.patch(f"{module}.restore_persona_jobs", return_value=None):
                        with mock.patch(f"{module}.restore_oauth_monitoring_tasks", return_value=0):
                            with mock.patch(f"{module}.restore_website_analysis_tasks", return_value=0):
                                with mock.patch(f"{module}.restore_platform_insights_tasks", return_value=0):
                                    with mock.patch(f"{module}.restore_advertools_tasks", return_value=0):
                                        t1 = asyncio.create_task(s1.start())
                                        t2 = asyncio.create_task(s1.start())
                                        await asyncio.gather(t1, t2)
        assert s1._running is True

    @pytest.mark.asyncio
    async def test_start_sets_running_after_restore(self, scheduler):
        module = "services.scheduler.core.scheduler"
        with mock.patch.object(scheduler, "_leadership_tick", new=mock.AsyncMock()):
            with mock.patch.object(scheduler, "_execute_missed_jobs", new=mock.AsyncMock()):
                with mock.patch.object(scheduler, "_validate_and_rebuild_cumulative_stats", new=mock.AsyncMock()):
                    with mock.patch(f"{module}.restore_persona_jobs", return_value=None):
                        with mock.patch(f"{module}.restore_oauth_monitoring_tasks", return_value=0):
                            with mock.patch(f"{module}.restore_website_analysis_tasks", return_value=0):
                                with mock.patch(f"{module}.restore_platform_insights_tasks", return_value=0):
                                    with mock.patch(f"{module}.restore_advertools_tasks", return_value=0):
                                        await scheduler.start()
        assert scheduler._running is True

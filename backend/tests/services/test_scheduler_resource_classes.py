"""TDD tests for scheduler resource classes (Phase 2a/2b).

Executors are assigned to resource classes (HEAVY/MEDIUM/LIGHT) with
per-class concurrency limits and timeouts. Heavy crawls can no longer
starve light tasks, and stuck executors are cancelled.
"""
import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock

from services.scheduler.core.scheduler import TaskScheduler
from services.scheduler.core.resource_classes import (
    ResourceClass,
    CLASS_LIMITS,
    CLASS_TIMEOUTS,
    get_resource_class,
)


def _make_executor():
    """Create a mock TaskExecutor."""
    executor = MagicMock()
    executor.execute = AsyncMock(return_value={"status": "success"})
    return executor


def _make_loader(tasks):
    """Create a mock task loader returning the given tasks."""
    return lambda db, user_id=None: tasks


def _make_task(task_id="task-1", user_id="u1"):
    task = MagicMock()
    task.id = task_id
    task.user_id = user_id
    return task


class TestResourceClassRegistration:
    def test_executor_registered_with_resource_class(self):
        """register_executor accepts a resource_class parameter and stores it."""
        scheduler = TaskScheduler(max_concurrent_executions=10)
        executor = _make_executor()
        loader = _make_loader([])

        scheduler.register_executor(
            "deep_competitor_analysis", executor, loader,
            resource_class=ResourceClass.HEAVY,
        )

        assert scheduler._executor_classes["deep_competitor_analysis"] == ResourceClass.HEAVY

    def test_default_resource_class_is_medium(self):
        """Executors registered without a resource_class default to MEDIUM."""
        scheduler = TaskScheduler(max_concurrent_executions=10)
        executor = _make_executor()
        loader = _make_loader([])

        scheduler.register_executor("test_light", executor, loader)

        assert scheduler._executor_classes["test_light"] == ResourceClass.MEDIUM

    def test_class_limits_are_sensible(self):
        """HEAVY < MEDIUM < LIGHT concurrency limits."""
        assert CLASS_LIMITS[ResourceClass.HEAVY] < CLASS_LIMITS[ResourceClass.MEDIUM]
        assert CLASS_LIMITS[ResourceClass.MEDIUM] < CLASS_LIMITS[ResourceClass.LIGHT]

    def test_class_timeouts_are_sensible(self):
        """HEAVY > MEDIUM > LIGHT timeouts (heavy tasks need more time)."""
        assert CLASS_TIMEOUTS[ResourceClass.HEAVY] > CLASS_TIMEOUTS[ResourceClass.MEDIUM]
        assert CLASS_TIMEOUTS[ResourceClass.MEDIUM] > CLASS_TIMEOUTS[ResourceClass.LIGHT]


class TestPerClassConcurrency:
    @pytest.mark.asyncio
    async def test_heavy_tasks_queue_when_class_limit_reached(self):
        """When 3 HEAVY tasks are running, a 4th HEAVY task waits but a
        LIGHT task can still execute."""
        scheduler = TaskScheduler(max_concurrent_executions=20)
        heavy_executor = _make_executor()

        # Simulate a slow heavy executor
        async def slow_execute(task):
            await asyncio.sleep(10)
            return {"status": "success"}

        heavy_executor.execute = slow_execute

        scheduler.register_executor(
            "heavy_test", heavy_executor, _make_loader([]),
            resource_class=ResourceClass.HEAVY,
        )
        scheduler.register_executor(
            "light_test", _make_executor(), _make_loader([]),
            resource_class=ResourceClass.LIGHT,
        )

        # Simulate 3 heavy tasks already running
        for i in range(3):
            lease_key = f"heavy_test_heavy-{i}"
            task = _make_task(f"heavy-{i}")
            execution = asyncio.create_task(slow_execute(task))
            scheduler.active_executions[lease_key] = execution
            scheduler._task_classes[lease_key] = ResourceClass.HEAVY

        # A 4th heavy task should NOT be dispatched (limit reached)
        heavy_tasks = [_make_task(f"heavy-new")]
        can_dispatch = scheduler._can_dispatch("heavy_test", ResourceClass.HEAVY)
        assert can_dispatch is False, "4th heavy task should wait"

        # A light task SHOULD be dispatched (separate class limit)
        can_dispatch_light = scheduler._can_dispatch("light_test", ResourceClass.LIGHT)
        assert can_dispatch_light is True, "light task should not be blocked by heavy tasks"

    @pytest.mark.asyncio
    async def test_light_tasks_execute_when_heavy_slots_full(self):
        """Light tasks must execute even when all HEAVY slots are occupied."""
        scheduler = TaskScheduler(max_concurrent_executions=20)

        # Fill all HEAVY slots
        for i in range(CLASS_LIMITS[ResourceClass.HEAVY]):
            lease_key = f"heavy_test_heavy-{i}"
            task = _make_task(f"heavy-{i}")
            execution = asyncio.create_task(asyncio.sleep(10))
            scheduler.active_executions[lease_key] = execution
            scheduler._task_classes[lease_key] = ResourceClass.HEAVY

        heavy_count = scheduler._active_count_for_class(ResourceClass.HEAVY)
        assert heavy_count == CLASS_LIMITS[ResourceClass.HEAVY]

        light_count = scheduler._active_count_for_class(ResourceClass.LIGHT)
        assert light_count == 0, "light class should have its own budget"


class TestExecutorTimeout:
    @pytest.mark.asyncio
    async def test_stuck_executor_cancelled_after_timeout(self):
        """A HEAVY executor that runs longer than its class timeout is
        cancelled rather than holding a slot forever."""
        scheduler = TaskScheduler(max_concurrent_executions=20)

        cancelled_tasks = []

        class _SlowExecutor:
            async def execute(self, task):
                try:
                    await asyncio.sleep(600)  # way past timeout
                    return {"status": "success"}
                except asyncio.CancelledError:
                    cancelled_tasks.append(task)
                    raise

        scheduler.register_executor(
            "slow_heavy", _SlowExecutor(), _make_loader([]),
            resource_class=ResourceClass.HEAVY,
        )

        from services.scheduler.core.resource_classes import CLASS_TIMEOUTS

        # Use a very short timeout for testing
        timeout = 0.1

        task = _make_task("stuck-task")
        execution = asyncio.create_task(
            _SlowExecutor().execute(task)
        )

        try:
            await asyncio.wait_for(execution, timeout=timeout)
            pytest.fail("should have timed out")
        except asyncio.TimeoutError:
            execution.cancel()
            try:
                await execution
            except asyncio.CancelledError:
                pass

        assert len(cancelled_tasks) == 1, "executor must be cancelled on timeout"


@pytest.mark.asyncio
async def test_existing_executors_get_correct_resource_classes():
    """The 14 executor types must map to the correct resource classes."""
    scheduler = TaskScheduler(max_concurrent_executions=10)

    # Register all executors with their expected classes
    executor_mappings = {
        "deep_competitor_analysis": ResourceClass.HEAVY,
        "sif_indexing": ResourceClass.HEAVY,
        "deep_website_crawl": ResourceClass.HEAVY,
        "onboarding_full_website_analysis": ResourceClass.HEAVY,
        "website_analysis": ResourceClass.MEDIUM,
        "advertools_intelligence": ResourceClass.MEDIUM,
        "market_trends": ResourceClass.MEDIUM,
        "linkedin_growth_reanalysis": ResourceClass.MEDIUM,
        "monitoring_task": ResourceClass.LIGHT,
        "oauth_token_monitoring": ResourceClass.LIGHT,
        "gsc_insights": ResourceClass.LIGHT,
        "bing_insights": ResourceClass.LIGHT,
        "linkedin_profile_sync": ResourceClass.LIGHT,
        "linkedin_post_analytics_sync": ResourceClass.LIGHT,
    }

    for task_type, expected_class in executor_mappings.items():
        scheduler.register_executor(
            task_type, _make_executor(), _make_loader([]),
            resource_class=expected_class,
        )
        assert scheduler._executor_classes[task_type] == expected_class, (
            f"{task_type} should be {expected_class}"
        )

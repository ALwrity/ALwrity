"""TDD tests for Phase 1a: connection pool sizing.

The scheduler's background executors and the dashboard's read requests share
one SQLAlchemy connection pool per user. With pool_size=1 and
max_overflow=0, a 5-minute crawl write transaction blocks all dashboard
reads for up to 30 seconds (pool_timeout). WAL mode already enables
concurrent readers — the pool just needs more than one connection.
"""
import os

import pytest


class TestConnectionPoolSizing:
    def test_pool_size_allows_concurrent_reads(self):
        """pool_size must be >= 3 so dashboard reads don't queue behind
        a single scheduler executor's write connection."""
        from services.database.engine import get_engine_for_user

        engine = get_engine_for_user("pytest_pool_user")
        pool = engine.pool
        # SQLAlchemy QueuePool exposes .size() for the base pool size
        assert pool.size() >= 3, f"pool_size is {pool.size()}, expected >= 3"

    def test_max_overflow_allows_burst_capacity(self):
        """max_overflow must be > 0 so burst requests don't wait 30s for
        the base pool when all connections are checked out."""
        from services.database.engine import get_engine_for_user

        engine = get_engine_for_user("pytest_pool_burst_user")
        pool = engine.pool
        assert pool._max_overflow > 0, (
            f"max_overflow is {pool._max_overflow}, expected > 0"
        )

    def test_wal_mode_is_enabled(self):
        """WAL mode must be enabled so concurrent reads don't block on writes."""
        import sqlite3
        from services.database.engine import get_engine_for_user
        from services.database.paths import get_user_db_path

        engine = get_engine_for_user("pytest_pool_wal_user")
        db_path = get_user_db_path("pytest_pool_wal_user")
        conn = sqlite3.connect(db_path)
        try:
            mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
            assert mode.lower() == "wal", f"journal_mode is {mode}, expected wal"
        finally:
            conn.close()

    def test_concurrent_reads_dont_block(self):
        """Two concurrent sessions must be able to read simultaneously
        without waiting for the pool (the core fix for dashboard-vs-scheduler
        contention)."""
        import threading
        import time

        from sqlalchemy import text

        from services.database.engine import get_engine_for_user

        engine = get_engine_for_user("pytest_pool_concurrent_user")

        results = {}
        barrier = threading.Barrier(2)

        def _read(label):
            barrier.wait()  # synchronize start
            start = time.monotonic()
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            results[label] = time.monotonic() - start

        t1 = threading.Thread(target=_read, args=("read1",))
        t2 = threading.Thread(target=_read, args=("read2",))
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)

        # Both reads must complete without waiting for pool_timeout (30s).
        # With pool_size=1, the second read would wait for the first to
        # release the connection. With pool_size>=3, both run concurrently.
        assert len(results) == 2
        max_wait = max(results.values())
        assert max_wait < 5.0, (
            f"Concurrent read took {max_wait:.1f}s — pool is still blocking"
        )


class TestTaskDelayRebalancing:
    """Phase 1b: heavy onboarding tasks must not fire immediately after
    onboarding completes — the user needs time to see the dashboard."""

    def test_heavy_tasks_have_nonzero_delays(self):
        """sif_indexing must NOT be 0 (fires immediately); deep_competitor
        must be >= 15 (it crawls 5-10 competitor sites)."""
        from api.onboarding_utils.step2_task_preferences import DEFAULT_TASK_PREFERENCES

        prefs = DEFAULT_TASK_PREFERENCES
        assert prefs["sif_indexing"]["delay_mins"] >= 3, (
            f"sif_indexing delay is {prefs['sif_indexing']['delay_mins']}, "
            "expected >= 3 (crawling should not start immediately)"
        )
        assert prefs["deep_competitor_analysis"]["delay_mins"] >= 10, (
            f"deep_competitor_analysis delay is "
            f"{prefs['deep_competitor_analysis']['delay_mins']}, expected >= 10 "
            "(heaviest crawl, defer longest)"
        )

    def test_moderate_tasks_have_staggered_delays(self):
        """seo_audit and market_trends should be >= 10 so they don't compete
        with the immediate dashboard load."""
        from api.onboarding_utils.step2_task_preferences import DEFAULT_TASK_PREFERENCES

        prefs = DEFAULT_TASK_PREFERENCES
        assert prefs["seo_audit"]["delay_mins"] >= 10, (
            f"seo_audit delay is {prefs['seo_audit']['delay_mins']}, expected >= 10"
        )
        assert prefs["market_trends"]["delay_mins"] >= 10, (
            f"market_trends delay is {prefs['market_trends']['delay_mins']}, expected >= 10"
        )

    def test_all_tasks_are_enabled_by_default(self):
        """Every task must still be enabled (we're delaying, not disabling)."""
        from api.onboarding_utils.step2_task_preferences import DEFAULT_TASK_PREFERENCES

        for task_id, config in DEFAULT_TASK_PREFERENCES.items():
            assert config.get("enabled") is True, f"{task_id} was disabled"

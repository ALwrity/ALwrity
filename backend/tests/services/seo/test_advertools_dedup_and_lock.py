"""Tests for advertools Phase 2: task dedup + cross-path execution mutex.

Covers the RCA finding where duplicate ``content_audit`` rows (created by the
old raw ``db.add()`` in ``schedule_step2_tasks``) each got their own scheduler
lease and ran the full pipeline concurrently, amplifying HTTP 429s.

Multi-tenancy is pinned: the mutex is keyed by (user, site, type) and the DB
check only ever touches the caller's per-user session.
"""

import importlib
import shutil
import time
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

db_engine_mod = importlib.import_module("services.database.engine")
import services.workspace_paths as workspace_paths
import utils.storage_paths as storage_paths
from services.database import get_session_for_user
from services.seo import advertools_run_lock as run_lock
from services.seo.advertools_run_lock import is_running, release, try_acquire

WEBSITE_URL = "https://acme-corp.example.com"


@pytest.fixture
def workspace_redirect(tmp_path, monkeypatch):
    root = tmp_path / "workspace"
    root.mkdir()
    monkeypatch.setattr(workspace_paths, "get_workspace_root", lambda: root)
    monkeypatch.setattr(storage_paths, "get_workspace_root", lambda: root)
    return root


@pytest.fixture
def user_db(workspace_redirect):
    user_id = f"dedup_{uuid4().hex[:10]}"
    db = get_session_for_user(user_id)
    ctx = {"user_id": user_id, "db": db, "workspace": workspace_redirect}
    try:
        yield ctx
    finally:
        try:
            db.close()
        finally:
            engine = db_engine_mod._user_engines.pop(user_id, None)
            if engine is not None:
                engine.dispose()
            shutil.rmtree(str(workspace_redirect), ignore_errors=True)


@pytest.fixture(autouse=True)
def clean_run_locks():
    """Keep the process-wide mutex registry clean between tests."""
    run_lock._RUN_LOCKS.clear()
    yield
    run_lock._RUN_LOCKS.clear()


def _make_advertools_task(db, user_id, task_type="content_audit", status="active", started_at=None, updated_at=None):
    from models.advertools_monitoring_models import AdvertoolsTask

    # updated_at must be passed at construction: the column has
    # onupdate=datetime.utcnow, which overwrites any later manual assignment.
    row = AdvertoolsTask(
        user_id=user_id,
        website_url=WEBSITE_URL,
        status=status,
        started_at=started_at or (datetime.utcnow() if status == "running" else None),
        updated_at=updated_at,
        payload={"type": task_type, "website_url": WEBSITE_URL},
    )
    db.add(row)
    db.commit()
    return row


# ---------------------------------------------------------------------------
# 1. In-process mutex primitives
# ---------------------------------------------------------------------------


class TestRunLockPrimitives:
    def test_acquire_then_busy_then_release(self, user_db):
        user_id = user_db["user_id"]
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is True
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is False
        release(user_id, WEBSITE_URL, "content_audit")
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is True

    def test_different_task_type_does_not_conflict(self, user_db):
        """content_audit and site_health are independent pipelines."""
        user_id = user_db["user_id"]
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is True
        assert try_acquire(user_id, WEBSITE_URL, "site_health") is True

    def test_per_user_isolation(self, user_db):
        """Same site, different users must not block each other (multi-tenant)."""
        user_a = user_db["user_id"]
        assert try_acquire(user_a, WEBSITE_URL, "content_audit") is True

        user_b = f"other_{uuid4().hex[:8]}"
        assert try_acquire(user_b, WEBSITE_URL, "content_audit") is True
        release(user_b, WEBSITE_URL, "content_audit")
        release(user_a, WEBSITE_URL, "content_audit")

    def test_url_normalization_trailing_slash(self, user_db):
        user_id = user_db["user_id"]
        assert try_acquire(user_id, WEBSITE_URL + "/", "content_audit") is True
        # Same URL with trailing slash must be recognized as the same key.
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is False
        release(user_id, WEBSITE_URL, "content_audit")

    def test_incomplete_key_never_locks(self):
        assert try_acquire(None, WEBSITE_URL, "content_audit") is True
        assert try_acquire("user", None, "content_audit") is True
        assert try_acquire("user", WEBSITE_URL, None) is True

    def test_stale_lock_is_overridden(self, user_db):
        user_id = user_db["user_id"]
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is True
        # Simulate a leaked lock older than the stale window.
        key = run_lock._lock_key(user_id, WEBSITE_URL, "content_audit")
        run_lock._RUN_LOCKS[key] = time.monotonic() - (run_lock.RUN_LOCK_STALE_SECS + 60)
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is True

    def test_is_running_reflects_lock(self, user_db):
        user_id = user_db["user_id"]
        assert is_running(user_id, WEBSITE_URL, "content_audit") is False
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is True
        assert is_running(user_id, WEBSITE_URL, "content_audit") is True
        release(user_id, WEBSITE_URL, "content_audit")
        assert is_running(user_id, WEBSITE_URL, "content_audit") is False


# ---------------------------------------------------------------------------
# 2. DB-level busy detection (cross-process / cross-path)
# ---------------------------------------------------------------------------


class TestDbRunningCheck:
    def test_fresh_running_row_blocks(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        row = _make_advertools_task(db, user_id, status="running")
        assert try_acquire(user_id, WEBSITE_URL, "content_audit", db=db) is False

    def test_stale_running_row_does_not_block(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        stale_started = datetime.utcnow() - timedelta(minutes=125)  # > 2h stale TTL
        _make_advertools_task(db, user_id, status="running", started_at=stale_started)
        assert try_acquire(user_id, WEBSITE_URL, "content_audit", db=db) is True

    def test_own_row_excluded(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        row = _make_advertools_task(db, user_id, status="running")
        assert try_acquire(
            user_id, WEBSITE_URL, "content_audit", db=db, exclude_task_id=row.id
        ) is True

    def test_different_type_running_row_does_not_block(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        _make_advertools_task(db, user_id, task_type="site_health", status="running")
        assert try_acquire(user_id, WEBSITE_URL, "content_audit", db=db) is True


# ---------------------------------------------------------------------------
# 3. Task creation dedup (schedule_step2_tasks)
# ---------------------------------------------------------------------------


ALL_DISABLED_PREFS = {
    task_id: {"enabled": False}
    for task_id in (
        "seo_audit",
        "sif_indexing",
        "market_trends",
        "website_analysis_tasks",
        "advertools_content",
        "advertools_health",
    )
}


def _advertools_rows(db, user_id):
    from models.advertools_monitoring_models import AdvertoolsTask

    return (
        db.query(AdvertoolsTask)
        .filter(AdvertoolsTask.user_id == user_id, AdvertoolsTask.website_url == WEBSITE_URL)
        .all()
    )


class TestScheduleStep2Dedup:
    def test_second_schedule_does_not_duplicate(self, user_db):
        """The RCA bug: calling schedule_step2_tasks twice used to append two
        content_audit rows; both became due and ran concurrently."""
        from api.onboarding_utils.onboarding_task_scheduler import schedule_step2_tasks

        user_id, db = user_db["user_id"], user_db["db"]
        schedule_step2_tasks(user_id, db, WEBSITE_URL, preferences=ALL_DISABLED_PREFS)
        schedule_step2_tasks(user_id, db, WEBSITE_URL, preferences=ALL_DISABLED_PREFS)

        rows = _advertools_rows(db, user_id)
        by_type = {}
        for r in rows:
            by_type.setdefault((r.payload or {}).get("type"), []).append(r)
        assert len(by_type.get("content_audit", [])) == 1
        assert len(by_type.get("site_health", [])) == 1

    def test_re_enabling_prefs_reactivates_existing_row(self, user_db):
        from api.onboarding_utils.onboarding_task_scheduler import schedule_step2_tasks

        user_id, db = user_db["user_id"], user_db["db"]
        schedule_step2_tasks(user_id, db, WEBSITE_URL, preferences=ALL_DISABLED_PREFS)
        row = [r for r in _advertools_rows(db, user_id) if (r.payload or {}).get("type") == "content_audit"][0]
        assert row.status == "paused"

        schedule_step2_tasks(user_id, db, WEBSITE_URL, preferences=None)
        row = [r for r in _advertools_rows(db, user_id) if (r.payload or {}).get("type") == "content_audit"][0]
        assert row.status == "active"
        assert row.next_execution is not None


class TestPauseDuplicates:
    def test_db_unique_constraint_rejects_hard_duplicate(self, user_db):
        """After the unique (user, site, type) constraint, two rows for the
        same type cannot coexist. A second raw insert must raise IntegrityError
        instead of silently appending a duplicate that would each run the
        pipeline. (This replaces the old test where duplicates were allowed in
        the DB and later paused — the DB now prevents them at the source.)"""
        from sqlalchemy.exc import IntegrityError

        user_id, db = user_db["user_id"], user_db["db"]
        first = _make_advertools_task(db, user_id, status="active")

        from models.advertools_monitoring_models import AdvertoolsTask
        dup = AdvertoolsTask(
            user_id=user_id,
            website_url=WEBSITE_URL,
            status="active",
            payload={"type": "content_audit", "website_url": WEBSITE_URL},
        )
        db.add(dup)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

        # Only the original row survived.
        rows = _advertools_rows(db, user_id)
        assert len(rows) == 1
        assert rows[0].id == first.id
        # Different type is still allowed (independent pipeline).
        health = _make_advertools_task(db, user_id, task_type="site_health", status="active")
        assert health.task_type == "site_health"
        assert len(_advertools_rows(db, user_id)) == 2

    def test_upsert_collapses_to_single_row(self, user_db):
        """The canonical atomic upsert returns the SAME row on repeated calls
        for (user, site, type) — no duplicate is ever created, so runtime
        self-heal is no longer needed as the primary mechanism."""
        from services.seo.advertools_task_upsert import upsert_advertools_task

        user_id, db = user_db["user_id"], user_db["db"]
        first = upsert_advertools_task(
            db, user_id, WEBSITE_URL, "content_audit",
            defaults={"status": "active", "payload": {"website_url": WEBSITE_URL}},
        )
        second = upsert_advertools_task(
            db, user_id, WEBSITE_URL, "content_audit",
            defaults={"status": "active", "payload": {"website_url": WEBSITE_URL}},
        )
        db.commit()
        assert second.id == first.id
        # And the on-disk count is exactly one content_audit row.
        rows = _advertools_rows(db, user_id)
        by_type = {}
        for r in rows:
            by_type.setdefault((r.payload or {}).get("type"), []).append(r)
        assert len(by_type.get("content_audit", [])) == 1
        # task_type stays normalized in step.
        assert first.task_type == "content_audit"
        assert second.task_type == "content_audit"

    def test_no_duplicates_is_noop(self, user_db):
        from api.onboarding_utils.onboarding_task_scheduler import (
            _pause_duplicate_advertools_tasks,
        )

        user_id, db = user_db["user_id"], user_db["db"]
        _make_advertools_task(db, user_id)
        assert _pause_duplicate_advertools_tasks(db, user_id, WEBSITE_URL) == 0


# ---------------------------------------------------------------------------
# 4. Executor: self-heal + skip path
# ---------------------------------------------------------------------------


class TestExecutorSelfHealAndSkip:
    def test_pause_self_heal_is_noop_with_single_row(self, user_db):
        """With the DB unique constraint there is exactly one row per type, so
        the self-heal backstop pauses nothing and stays harmless (defensive
        only — it can no longer be the primary dedup mechanism)."""
        from services.scheduler.executors.advertools_executor import AdvertoolsExecutor

        user_id, db = user_db["user_id"], user_db["db"]
        keep = _make_advertools_task(db, user_id, status="active")
        other_type = _make_advertools_task(db, user_id, task_type="site_health", status="active")
        db.commit()

        executor = AdvertoolsExecutor()
        paused = executor._pause_other_active_duplicates(
            db, user_id, WEBSITE_URL, "content_audit", keep_task_id=keep.id
        )
        assert paused == 0  # DB guarantees no duplicates to pause
        other_type.status = "active"  # unchanged

    @pytest.mark.asyncio
    async def test_execute_task_skips_when_mutex_held(self, user_db):
        """The exact logged failure mode: two due duplicate rows. With the
        mutex held, the second execute_task must skip (no pipeline call) and
        re-check in ~15 minutes instead of failing/backing off."""
        from services.scheduler.executors.advertools_executor import AdvertoolsExecutor

        user_id, db = user_db["user_id"], user_db["db"]
        row = _make_advertools_task(db, user_id, status="active")

        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is True

        executor = AdvertoolsExecutor()
        result = await executor.execute_task(row, db)

        assert result.success is True
        assert (result.result_data or {}).get("skipped") is True

        db.refresh(row)
        assert row.status == "active"  # not 'running', not 'failed'
        assert row.next_execution is not None
        delta_min = (row.next_execution - datetime.utcnow()).total_seconds() / 60
        assert 10 <= delta_min <= 20  # re-check window (~15 min)
        assert row.consecutive_failures in (None, 0)  # no failure bookkeeping

        release(user_id, WEBSITE_URL, "content_audit")

    @pytest.mark.asyncio
    async def test_execute_task_releases_lock_after_run(self, user_db):
        """Lock must be released when execute_task completes (success path)."""
        from services.scheduler.executors.advertools_executor import AdvertoolsExecutor

        user_id, db = user_db["user_id"], user_db["db"]
        row = _make_advertools_task(db, user_id, status="active")

        executor = AdvertoolsExecutor()

        # Force an early failure (missing website_url in payload) so no
        # network is touched, then confirm the lock was released.
        row.payload = {"type": "content_audit"}  # no website_url
        db.commit()
        result = await executor.execute_task(row, db)
        assert result.success is False

        # Lock released: a fresh acquire must succeed.
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is True
        release(user_id, WEBSITE_URL, "content_audit")

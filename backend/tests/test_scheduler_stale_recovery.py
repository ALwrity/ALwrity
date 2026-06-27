"""Tests for stale_task_recovery module — TTL from SchedulerSettings."""

import os
from datetime import datetime, timedelta
from unittest import mock

import pytest

from services.scheduler.core.settings import SchedulerSettings
from services.scheduler.core.stale_task_recovery import _get_stale_ttl, STALE_TASK_TTL_MINUTES


class TestStaleTtlFromSettings:
    """STALE_TASK_TTL_MINUTES reads from SchedulerSettings."""

    def test_default_ttl(self):
        assert STALE_TASK_TTL_MINUTES == 120

    def test_get_stale_ttl_returns_default(self):
        assert _get_stale_ttl() == 120

    def test_get_stale_ttl_respects_env_var(self):
        old_value = os.environ.get("STALE_TASK_TTL_MINUTES")
        try:
            os.environ["STALE_TASK_TTL_MINUTES"] = "45"
            import importlib
            import services.scheduler.core.stale_task_recovery as mod
            importlib.reload(mod)
            assert mod.STALE_TASK_TTL_MINUTES == 45
            assert mod._get_stale_ttl() == 45
        finally:
            if old_value is not None:
                os.environ["STALE_TASK_TTL_MINUTES"] = old_value
            else:
                del os.environ["STALE_TASK_TTL_MINUTES"]

    def test_recover_stale_tasks_resets_running_tasks(self):
        class FakeTask:
            status = "running"
            started_at = datetime(2020, 1, 1, 0, 0, 0)
            failure_reason = ""
            last_failure = None
            consecutive_failures = 0
        fake_model_class = FakeTask
        task = FakeTask()
        task.id = 42
        task.user_id = "u1"
        db = mock.MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [task]
        from services.scheduler.core.stale_task_recovery import _recover_stale_tasks_for_model
        cutoff = datetime.utcnow() - timedelta(minutes=120)
        count = _recover_stale_tasks_for_model(db, fake_model_class, "test_table", cutoff)
        assert count == 1
        assert task.status == "failed"
        assert "Stale task" in task.failure_reason

    def test_recover_stale_tasks_no_stale(self):
        db = mock.MagicMock()
        model_class = mock.Mock()
        model_class.status = "running"
        db.query.return_value.filter.return_value.all.return_value = []
        from services.scheduler.core.stale_task_recovery import _recover_stale_tasks_for_model
        cutoff = datetime.utcnow() - timedelta(minutes=120)
        count = _recover_stale_tasks_for_model(db, model_class, "test_table", cutoff)
        assert count == 0
        db.commit.assert_not_called()

    def test_recover_stale_tasks_rollback_on_error(self):
        db = mock.MagicMock()
        model_class = mock.Mock()
        model_class.status = "running"
        db.query.return_value.filter.return_value.all.side_effect = Exception("DB error")
        from services.scheduler.core.stale_task_recovery import _recover_stale_tasks_for_model
        cutoff = datetime.utcnow() - timedelta(minutes=120)
        count = _recover_stale_tasks_for_model(db, model_class, "test_table", cutoff)
        assert count == 0
        db.rollback.assert_called_once()

    def test_recover_stale_tasks_main(self):
        """recover_stale_tasks calls _recover_stale_tasks_for_model for each table."""
        db = mock.MagicMock()
        from services.scheduler.core.stale_task_recovery import recover_stale_tasks
        with mock.patch(
            "services.scheduler.core.stale_task_recovery._recover_stale_tasks_for_model",
            return_value=0,
        ) as mock_recover:
            total = recover_stale_tasks(db)
        assert total == 0
        assert mock_recover.call_count == 7

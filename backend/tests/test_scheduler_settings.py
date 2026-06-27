"""Tests for SchedulerSettings dataclass — env-var-backed config."""

import os
from unittest import mock

import pytest

from services.scheduler.core.settings import SchedulerSettings


class TestSchedulerSettingsDefaults:
    """All settings carry sensible hardcoded defaults."""

    def test_default_check_interval(self):
        s = SchedulerSettings()
        assert s.check_interval_minutes == 15
        assert s.min_check_interval_minutes == 15
        assert s.max_check_interval_minutes == 60

    def test_default_concurrency_and_retries(self):
        s = SchedulerSettings()
        assert s.max_concurrent_executions == 10
        assert s.enable_retries is True
        assert s.max_retries == 3
        assert s.max_instances_per_job == 1

    def test_default_lifecycle(self):
        s = SchedulerSettings()
        assert s.shutdown_timeout_seconds == 30
        assert s.missed_job_grace_seconds == 3600
        assert s.task_lease_ttl_seconds == 900
        assert s.leadership_check_interval_seconds == 15
        assert s.leader_lock_key == 84321017

    def test_default_failure_detection(self):
        s = SchedulerSettings()
        assert s.failure_consecutive_threshold == 3
        assert s.failure_recent_threshold == 5
        assert s.failure_lookback_days == 7
        assert s.failure_cool_off_days == 7
        assert s.failure_analysis_max_logs == 5
        assert s.failure_pattern_max_logs == 5
        assert s.failure_pattern_truncate_length == 100
        assert s.failure_pattern_max_count == 3

    def test_default_stale_and_semantic(self):
        s = SchedulerSettings()
        assert s.stale_task_ttl_minutes == 120
        assert s.semantic_check_interval_seconds == 86400

    def test_default_misfire(self):
        s = SchedulerSettings()
        assert s.misfire_grace_time_seconds == 3600
        assert s.one_time_misfire_grace_seconds == 3600

    def test_get_misfire_grace_time(self):
        s = SchedulerSettings(misfire_grace_time_seconds=7200)
        assert s.get_misfire_grace_time() == 7200

    def test_get_task_lease_ttl(self):
        s = SchedulerSettings(task_lease_ttl_seconds=1800)
        assert s.get_task_lease_ttl() == 1800


class TestSchedulerSettingsFromEnv:
    """from_env() reads environment variables with fallback to defaults."""

    def test_from_env_defaults(self):
        s = SchedulerSettings.from_env()
        assert s.check_interval_minutes == 15
        assert s.failure_cool_off_days == 7

    def test_from_env_overrides(self):
        env = {
            "SCHEDULER_CHECK_INTERVAL_MINUTES": "5",
            "SCHEDULER_MAX_CONCURRENT_EXECUTIONS": "20",
            "SCHEDULER_MAX_RETRIES": "5",
            "FAILURE_CONSECUTIVE_THRESHOLD": "10",
            "FAILURE_COOL_OFF_DAYS": "14",
            "STALE_TASK_TTL_MINUTES": "60",
            "SCHEDULER_SHUTDOWN_TIMEOUT_SECONDS": "60",
        }
        with mock.patch.dict(os.environ, env, clear=False):
            s = SchedulerSettings.from_env()
        assert s.check_interval_minutes == 5
        assert s.max_concurrent_executions == 20
        assert s.max_retries == 5
        assert s.failure_consecutive_threshold == 10
        assert s.failure_cool_off_days == 14
        assert s.stale_task_ttl_minutes == 60
        assert s.shutdown_timeout_seconds == 60

    def test_from_env_partial_override(self):
        env = {"SCHEDULER_CHECK_INTERVAL_MINUTES": "10"}
        with mock.patch.dict(os.environ, env, clear=False):
            s = SchedulerSettings.from_env()
        assert s.check_interval_minutes == 10
        assert s.max_concurrent_executions == 10

    def test_frozen_dataclass(self):
        s = SchedulerSettings()
        with pytest.raises(AttributeError):
            s.check_interval_minutes = 99

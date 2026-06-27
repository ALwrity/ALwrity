"""
Scheduler Settings
Centralized configuration for the scheduler subsystem, backed by environment variables.
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class SchedulerSettings:
    # ── Check cycle ──
    check_interval_minutes: int = 15
    min_check_interval_minutes: int = 15
    max_check_interval_minutes: int = 60
    max_concurrent_executions: int = 10
    enable_retries: bool = True
    max_retries: int = 3

    # ── APScheduler ──
    misfire_grace_time_seconds: int = 3600
    one_time_misfire_grace_seconds: int = 3600
    max_instances_per_job: int = 1

    # ── Lifecycle ──
    shutdown_timeout_seconds: int = 30
    missed_job_grace_seconds: int = 3600
    task_lease_ttl_seconds: int = 900
    leadership_check_interval_seconds: int = 15
    leader_lock_key: int = 84321017

    # ── Failure detection ──
    failure_consecutive_threshold: int = 3
    failure_recent_threshold: int = 5
    failure_lookback_days: int = 7
    failure_cool_off_days: int = 7
    failure_analysis_max_logs: int = 5
    failure_pattern_max_logs: int = 5
    failure_pattern_truncate_length: int = 100
    failure_pattern_max_count: int = 3

    # ── Stale task recovery ──
    stale_task_ttl_minutes: int = 120

    # ── Semantic health ──
    semantic_check_interval_seconds: int = 86400

    def get_misfire_grace_time(self) -> int:
        return self.misfire_grace_time_seconds

    def get_task_lease_ttl(self) -> int:
        return self.task_lease_ttl_seconds

    @classmethod
    def from_env(cls) -> "SchedulerSettings":
        def _int(key: str, default: str) -> int:
            return int(os.getenv(key, default))

        def _bool(key: str, default: str) -> bool:
            val = os.getenv(key, default)
            return val.lower() in ("1", "true", "yes")

        return cls(
            check_interval_minutes=_int("SCHEDULER_CHECK_INTERVAL_MINUTES", "15"),
            min_check_interval_minutes=_int("SCHEDULER_MIN_CHECK_INTERVAL_MINUTES", "15"),
            max_check_interval_minutes=_int("SCHEDULER_MAX_CHECK_INTERVAL_MINUTES", "60"),
            max_concurrent_executions=_int("SCHEDULER_MAX_CONCURRENT_EXECUTIONS", "10"),
            enable_retries=_bool("SCHEDULER_ENABLE_RETRIES", "true"),
            max_retries=_int("SCHEDULER_MAX_RETRIES", "3"),
            misfire_grace_time_seconds=_int("SCHEDULER_MISFIRE_GRACE_SECONDS", "3600"),
            one_time_misfire_grace_seconds=_int("SCHEDULER_ONE_TIME_MISFIRE_GRACE_SECONDS", "3600"),
            max_instances_per_job=_int("SCHEDULER_MAX_INSTANCES_PER_JOB", "1"),
            shutdown_timeout_seconds=_int("SCHEDULER_SHUTDOWN_TIMEOUT_SECONDS", "30"),
            missed_job_grace_seconds=_int("SCHEDULER_MISSED_JOB_GRACE_SECONDS", "3600"),
            task_lease_ttl_seconds=_int("SCHEDULER_TASK_LEASE_TTL_SECONDS", "900"),
            leadership_check_interval_seconds=_int("SCHEDULER_LEADERSHIP_CHECK_INTERVAL_SECONDS", "15"),
            leader_lock_key=_int("SCHEDULER_LEADER_LOCK_KEY", "84321017"),
            failure_consecutive_threshold=_int("FAILURE_CONSECUTIVE_THRESHOLD", "3"),
            failure_recent_threshold=_int("FAILURE_RECENT_THRESHOLD", "5"),
            failure_lookback_days=_int("FAILURE_LOOKBACK_DAYS", "7"),
            failure_cool_off_days=_int("FAILURE_COOL_OFF_DAYS", "7"),
            failure_analysis_max_logs=_int("FAILURE_ANALYSIS_MAX_LOGS", "5"),
            failure_pattern_max_logs=_int("FAILURE_PATTERN_MAX_LOGS", "5"),
            failure_pattern_truncate_length=_int("FAILURE_PATTERN_TRUNCATE_LENGTH", "100"),
            failure_pattern_max_count=_int("FAILURE_PATTERN_MAX_COUNT", "3"),
            stale_task_ttl_minutes=_int("STALE_TASK_TTL_MINUTES", "120"),
            semantic_check_interval_seconds=_int("SEMANTIC_CHECK_INTERVAL_SECONDS", "86400"),
        )

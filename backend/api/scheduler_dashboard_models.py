"""
Scheduler Dashboard — Pydantic Response Models (M1)
====================================================

M1: the original `scheduler_dashboard.py` constructed response dicts
inline in 13 endpoints, with the main `/dashboard` endpoint being a
~635-line inline dict assembly. This module centralises the response
shapes in Pydantic models. Each model mirrors the existing dict
shape so applying `response_model=...` to a handler does not change
the JSON output for the existing fields.

Adoption is incremental — handlers are migrated to declare a
`response_model=` in stages (one or two endpoints per session). Until
a handler is migrated, it returns the same untyped dict it always
did, so the migration is non-breaking for clients.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ──────────────────────────────────────────────────────────────────
# Common shapes
# ──────────────────────────────────────────────────────────────────


class _BaseModel(BaseModel):
    """Base model that tolerates extra fields from older handlers.

    Until every handler is migrated to use these models, the same
    payload can be assembled as a plain dict and validated by a model
    that ignores extra keys. This lets us adopt the models
    incrementally without breaking clients that depend on a field we
    haven't modelled yet.
    """
    model_config = ConfigDict(extra="ignore")


# ──────────────────────────────────────────────────────────────────
# /jobs endpoint
# ──────────────────────────────────────────────────────────────────


class SchedulerJobInfo(_BaseModel):
    """One APScheduler job. Mirrors the inline dict at
    `scheduler_dashboard.py` lines 987-1018."""

    id: Optional[str] = None
    trigger_type: Optional[str] = None
    next_run_time: Optional[str] = None
    jobstore: Optional[str] = "default"
    user_id: Optional[str] = None
    user_job_store: Optional[str] = "default"
    function_name: Optional[str] = None


class SchedulerJobsResponse(_BaseModel):
    """Response from GET /api/scheduler/jobs."""

    jobs: List[SchedulerJobInfo] = Field(default_factory=list)
    total_jobs: int = 0
    recurring_jobs: int = 0
    one_time_jobs: int = 0


# ──────────────────────────────────────────────────────────────────
# /event-history and /recent-scheduler-logs endpoints
# ──────────────────────────────────────────────────────────────────


# The valid event_type enum from the regex on the endpoint.
SchedulerEventType = str  # 'check_cycle' | 'interval_adjustment' | 'start' | 'stop' | 'job_scheduled' | 'job_cancelled' | 'job_completed' | 'job_failed'


class SchedulerEvent(_BaseModel):
    """One scheduler event row.

    Mirrors the formatted event dict returned by both
    `/event-history` (synthesised from TaskExecutionLog) and
    `/recent-scheduler-logs` (formatted as execution-log-like).
    """

    id: Optional[int] = None
    event_type: Optional[SchedulerEventType] = None
    event_date: Optional[str] = None
    check_cycle_number: Optional[int] = None
    check_interval_minutes: Optional[int] = None
    previous_interval_minutes: Optional[int] = None
    new_interval_minutes: Optional[int] = None
    tasks_found: Optional[int] = None
    tasks_executed: Optional[int] = None
    tasks_failed: Optional[int] = None
    tasks_by_type: Optional[Dict[str, int]] = None
    check_duration_seconds: Optional[float] = None
    active_strategies_count: Optional[int] = None
    active_executions: Optional[int] = None
    job_id: Optional[str] = None
    job_type: Optional[str] = None
    user_id: Optional[str] = None
    event_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None


class SchedulerEventDateFilter(_BaseModel):
    days: int
    cutoff_date: str
    showing_events_since: str


class SchedulerEventHistoryResponse(_BaseModel):
    """Response from GET /api/scheduler/event-history."""

    events: List[SchedulerEvent] = Field(default_factory=list)
    total_count: int = 0
    limit: int = 0
    offset: int = 0
    has_more: bool = False
    date_filter: Optional[SchedulerEventDateFilter] = None
    # C3: data-source hint. Lets the frontend know the table it
    # used to read from (scheduler_event_logs) is no longer the
    # source of truth.
    data_source: Optional[str] = None


# /recent-scheduler-logs returns SchedulerEvents reformatted as
# execution-log-like entries. We use a separate model because the
# shape is intentionally a superset of ExecutionLog fields.
class RecentSchedulerLog(_BaseModel):
    id: Optional[str] = None
    task_id: Optional[int] = None
    user_id: Optional[str] = None
    execution_date: Optional[str] = None
    status: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    result_data: Optional[Any] = None
    created_at: Optional[str] = None
    task: Optional[Dict[str, Any]] = None
    is_scheduler_log: Optional[bool] = None
    event_type: Optional[str] = None
    job_id: Optional[str] = None


class RecentSchedulerLogsResponse(_BaseModel):
    """Response from GET /api/scheduler/recent-scheduler-logs."""

    logs: List[RecentSchedulerLog] = Field(default_factory=list)
    total_count: int = 0
    limit: int = 0
    offset: int = 0
    has_more: bool = False
    is_scheduler_logs: bool = True
    data_source: Optional[str] = None


# ──────────────────────────────────────────────────────────────────
# /execution-logs endpoint
# ──────────────────────────────────────────────────────────────────


class TaskInfo(_BaseModel):
    """Nested task block on a log entry. Mirrors the inline dict
    at lines 893-898 of `scheduler_dashboard.py`."""

    id: Optional[int] = None
    task_title: Optional[str] = None
    component_name: Optional[str] = None
    metric: Optional[str] = None
    frequency: Optional[str] = None


class ExecutionLog(_BaseModel):
    """One execution log entry. Mirrors the inline dict at lines
    871-892 of `scheduler_dashboard.py` (path 1) and lines 749-821
    (path 2, with the older log format). Both paths set the same
    field set; path 2 used a tuple unpack but writes the same dict.
    """

    id: Optional[int] = None
    task_id: Optional[int] = None
    # M4: the response reports the caller's user_id (the one we used
    # to filter by), not the unreliable log column.
    user_id: Optional[str] = None
    execution_date: Optional[str] = None
    status: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    result_data: Optional[Any] = None
    created_at: Optional[str] = None
    task: Optional[TaskInfo] = None


class ExecutionLogsResponse(_BaseModel):
    """Response from GET /api/scheduler/execution-logs."""

    logs: List[ExecutionLog] = Field(default_factory=list)
    total_count: int = 0
    limit: int = 0
    offset: int = 0
    has_more: bool = False
    is_scheduler_logs: bool = False
    # H2: optional flag indicating the response was generated by the
    # schema-missing fallback path. Useful for ops dashboards.
    user_id_column_missing: Optional[bool] = None


# ──────────────────────────────────────────────────────────────────
# /platform-insights/logs/{user_id} endpoint
# ──────────────────────────────────────────────────────────────────


class PlatformInsightsLog(_BaseModel):
    """One PlatformInsights execution log row.

    Distinct from `ExecutionLog` (which describes the generic
    `task_execution_logs` table) because
    `PlatformInsightsExecutionLog` has a `data_source` string
    column and a different field set (no user_id, no task block).
    """

    id: Optional[int] = None
    task_id: Optional[int] = None
    execution_date: Optional[str] = None
    status: Optional[str] = None
    result_data: Optional[Any] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    data_source: Optional[str] = None
    created_at: Optional[str] = None


class PlatformInsightsLogsResponse(_BaseModel):
    """Response from GET /api/scheduler/platform-insights/logs/{user_id}."""

    success: bool = True
    logs: List[PlatformInsightsLog] = Field(default_factory=list)
    total_count: int = 0


# ──────────────────────────────────────────────────────────────────
# /website-analysis endpoints
# ──────────────────────────────────────────────────────────────────


class WebsiteAnalysisTaskEntry(_BaseModel):
    """One WebsiteAnalysisTask row, formatted for the dashboard."""

    id: Optional[int] = None
    website_url: Optional[str] = None
    task_type: Optional[str] = None
    competitor_id: Optional[int] = None
    status: Optional[str] = None
    last_check: Optional[str] = None
    last_success: Optional[str] = None
    last_failure: Optional[str] = None
    failure_reason: Optional[str] = None
    next_check: Optional[str] = None
    frequency_days: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class WebsiteAnalysisStatusData(_BaseModel):
    """Inner `data` envelope of the website-analysis status response."""

    user_id: Optional[str] = None
    user_website_tasks: List[WebsiteAnalysisTaskEntry] = Field(default_factory=list)
    competitor_tasks: List[WebsiteAnalysisTaskEntry] = Field(default_factory=list)
    total_tasks: int = 0
    active_tasks: int = 0
    failed_tasks: int = 0


class WebsiteAnalysisStatusResponse(_BaseModel):
    """Response from GET /api/scheduler/website-analysis/status/{user_id}."""

    success: bool = True
    data: WebsiteAnalysisStatusData = Field(default_factory=WebsiteAnalysisStatusData)


class WebsiteAnalysisLog(_BaseModel):
    """One WebsiteAnalysis execution log row (with task embedded
    per the H5 N+1 fix)."""

    id: Optional[int] = None
    task_id: Optional[int] = None
    website_url: Optional[str] = None
    task_type: Optional[str] = None
    execution_date: Optional[str] = None
    status: Optional[str] = None
    result_data: Optional[Any] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    created_at: Optional[str] = None


class WebsiteAnalysisLogsResponse(_BaseModel):
    """Response from GET /api/scheduler/website-analysis/logs/{user_id}."""

    logs: List[WebsiteAnalysisLog] = Field(default_factory=list)
    total_count: int = 0
    limit: int = 0
    offset: int = 0
    has_more: bool = False


# ──────────────────────────────────────────────────────────────────
# /platform-insights endpoints
# ──────────────────────────────────────────────────────────────────


# Used by /platform-insights/status/{user_id}
class PlatformInsightsTask(_BaseModel):
    id: Optional[int] = None
    platform: Optional[str] = None
    site_url: Optional[str] = None
    status: Optional[str] = None
    last_check: Optional[str] = None
    last_success: Optional[str] = None
    last_failure: Optional[str] = None
    failure_reason: Optional[str] = None
    next_check: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PlatformInsightsStatusResponse(_BaseModel):
    """Response from GET /api/scheduler/platform-insights/status/{user_id}."""

    success: bool = True
    user_id: Optional[str] = None
    gsc_tasks: List[PlatformInsightsTask] = Field(default_factory=list)
    bing_tasks: List[PlatformInsightsTask] = Field(default_factory=list)
    total_tasks: int = 0
    # C2: present when the GET handler computed missing platforms
    # without auto-creating them. Empty list means the user has
    # tasks for every connected platform.
    missing_platforms: List[str] = Field(default_factory=list)
    # C2: present on the POST response, listing what was created
    # vs failed.
    created_platforms: List[str] = Field(default_factory=list)
    failed_platforms: List[Dict[str, Any]] = Field(default_factory=list)


# ──────────────────────────────────────────────────────────────────
# /dashboard endpoint
# ──────────────────────────────────────────────────────────────────


class DashboardSchedulerStats(_BaseModel):
    """The 'stats' sub-dict of the /dashboard response. Mirrors
    the inline dict at lines 698-720 of `scheduler_dashboard.py`."""

    total_checks: int = 0
    tasks_found: int = 0
    tasks_executed: int = 0
    tasks_failed: int = 0
    tasks_skipped: int = 0
    last_check: Optional[str] = None
    last_update: Optional[str] = None
    active_executions: int = 0
    running: bool = False
    check_interval_minutes: int = 60
    min_check_interval_minutes: int = 15
    max_check_interval_minutes: int = 60
    intelligent_scheduling: bool = True
    active_strategies_count: int = 0
    last_interval_adjustment: Optional[str] = None
    registered_types: List[str] = Field(default_factory=list)
    cumulative_total_check_cycles: int = 0
    cumulative_tasks_found: int = 0
    cumulative_tasks_executed: int = 0
    cumulative_tasks_failed: int = 0


class UserIsolationInfo(_BaseModel):
    enabled: bool = True
    current_user_id: Optional[str] = None


class PerUserStatsEntry(_BaseModel):
    """Per-user scheduler stats surfaced in the dashboard response (M6)."""

    tasks_executed: int = 0
    tasks_failed: int = 0
    last_update: Optional[str] = None


class DashboardJob(_BaseModel):
    """A single job entry in the dashboard response (works for
    both APScheduler and database-backed jobs). All fields are
    optional because the two source types populate slightly
    different fields."""

    id: Optional[str] = None
    trigger_type: Optional[str] = None
    next_run_time: Optional[str] = None
    user_id: Optional[str] = None
    job_store: Optional[str] = "default"
    user_job_store: Optional[str] = "default"
    # M5: source marker. Either "apscheduler" or "database_task".
    source: Optional[str] = None
    # Database-backed only:
    function_name: Optional[str] = None
    platform: Optional[str] = None
    task_id: Optional[int] = None
    is_database_task: Optional[bool] = None
    frequency: Optional[str] = None
    task_type: Optional[str] = None
    website_url: Optional[str] = None
    competitor_id: Optional[int] = None
    task_category: Optional[str] = None
    status: Optional[str] = None
    last_success: Optional[str] = None
    last_failure: Optional[str] = None
    failure_reason: Optional[str] = None
    consecutive_failures: Optional[int] = None


class SchedulerDashboardResponse(_BaseModel):
    """Response from GET /api/scheduler/dashboard.

    Mirrors the inline dict at lines 681-741 of
    `scheduler_dashboard.py` after the M5 split into separate
    APScheduler and database lists.
    """

    stats: DashboardSchedulerStats = Field(default_factory=DashboardSchedulerStats)
    # M5: separate lists. `jobs` is the backward-compat union.
    apscheduler_jobs: List[DashboardJob] = Field(default_factory=list)
    database_tasks: List[DashboardJob] = Field(default_factory=list)
    apscheduler_job_count: int = 0
    database_task_count: int = 0
    jobs: List[DashboardJob] = Field(default_factory=list)
    job_count: int = 0
    recurring_jobs: int = 0
    one_time_jobs: int = 0
    registered_task_types: List[str] = Field(default_factory=list)
    # M6: per-user scheduler stats.
    per_user_stats: Dict[str, PerUserStatsEntry] = Field(default_factory=dict)
    user_isolation: UserIsolationInfo = Field(default_factory=UserIsolationInfo)
    last_updated: Optional[str] = None


# ──────────────────────────────────────────────────────────────────
# /onboarding-tasks/{user_id} endpoint
# ──────────────────────────────────────────────────────────────────


class OnboardingTask(_BaseModel):
    """A single onboarding task entry."""

    task_type: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[str] = None
    task_id: Optional[int] = None
    website_url: Optional[str] = None
    status: Optional[str] = None
    status_label: Optional[str] = None
    last_success: Optional[str] = None
    last_failure: Optional[str] = None
    next_execution: Optional[str] = None
    failure_reason: Optional[str] = None
    consecutive_failures: Optional[int] = None


class OnboardingTasksResponse(_BaseModel):
    """Response from GET /api/scheduler/onboarding-tasks/{user_id}."""

    success: bool = True
    tasks: List[OnboardingTask] = Field(default_factory=list)
    count: int = 0
    total: int = 0
    limit: int = 0
    offset: int = 0
    has_more: bool = False


# ──────────────────────────────────────────────────────────────────
# /website-analysis/retry/{task_id} and /tasks/{...}/manual-trigger
# ──────────────────────────────────────────────────────────────────


class RetryTaskEntry(_BaseModel):
    """The `task` sub-dict in the retry endpoint response."""

    id: Optional[int] = None
    website_url: Optional[str] = None
    status: Optional[str] = None
    next_check: Optional[str] = None


class WebsiteAnalysisRetryResponse(_BaseModel):
    """Response from POST /api/scheduler/website-analysis/retry/{task_id}."""

    success: bool = True
    message: Optional[str] = None
    task: RetryTaskEntry = Field(default_factory=RetryTaskEntry)


class ManualTriggerTaskEntry(_BaseModel):
    """The `task` sub-dict in the manual-trigger response."""

    id: Optional[int] = None
    status: Optional[str] = None
    last_check: Optional[str] = None


class ManualTriggerResponse(_BaseModel):
    """Response from POST /api/scheduler/tasks/{task_type}/{task_id}/manual-trigger."""

    success: bool = True
    message: Optional[str] = None
    task: ManualTriggerTaskEntry = Field(default_factory=ManualTriggerTaskEntry)


# ──────────────────────────────────────────────────────────────────
# /tasks-needing-intervention/{user_id}
# ──────────────────────────────────────────────────────────────────


class TasksNeedingInterventionResponse(_BaseModel):
    """Response from GET /api/scheduler/tasks-needing-intervention/{user_id}.

    The `tasks` list structure is determined by FailureDetectionService
    and may evolve; we model it as a list of arbitrary dicts so the
    shape is preserved without coupling this schema to the service.
    """

    success: bool = True
    tasks: List[Dict[str, Any]] = Field(default_factory=list)
    count: int = 0

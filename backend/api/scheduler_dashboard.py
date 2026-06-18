"""
Scheduler Dashboard API
=======================

The 14 scheduler-dashboard endpoints are split across focused
sub-modules so this file stays small and readable. This file is a
thin re-exporter: it owns the FastAPI router with the
`/api/scheduler` prefix and mounts the four sub-routers that hold
the actual endpoint code.

  - api/scheduler_dashboard_core.py      (5 core endpoints)
        GET  /api/scheduler/dashboard
        GET  /api/scheduler/execution-logs
        GET  /api/scheduler/jobs
        GET  /api/scheduler/event-history
        GET  /api/scheduler/recent-scheduler-logs

  - api/scheduler_dashboard_platform.py  (3 platform-insights endpoints)
        GET  /api/scheduler/platform-insights/status/{user_id}
        POST /api/scheduler/platform-insights/{user_id}/ensure-tasks
        GET  /api/scheduler/platform-insights/logs/{user_id}

  - api/scheduler_dashboard_website.py   (3 website-analysis endpoints)
        GET  /api/scheduler/website-analysis/status/{user_id}
        GET  /api/scheduler/website-analysis/logs/{user_id}
        POST /api/scheduler/website-analysis/retry/{task_id}

  - api/scheduler_dashboard_tasks.py     (3 task-management endpoints)
        GET  /api/scheduler/tasks-needing-intervention/{user_id}
        POST /api/scheduler/tasks/{task_type}/{task_id}/manual-trigger
        GET  /api/scheduler/onboarding-tasks/{user_id}

Helpers, constants, and Pydantic models live alongside the endpoints
they support:

  - api/scheduler_dashboard_constants.py  (TASK_DISPLAY_INFO + helpers)
  - api/scheduler_dashboard_models.py     (22 Pydantic response models)
"""

from fastapi import APIRouter

from api.scheduler_dashboard_core import router as core_router
from api.scheduler_dashboard_platform import router as platform_router
from api.scheduler_dashboard_tasks import router as tasks_router
from api.scheduler_dashboard_website import router as website_router

# The main router carries the `/api/scheduler` prefix. The sub-routers
# have no prefix; their routes are written relative to the prefix.
router = APIRouter(prefix="/api/scheduler", tags=["scheduler-dashboard"])

# Mount all four sub-routers. Each sub-router file owns a focused group
# of endpoints and its own imports; this file is a thin re-exporter.
# - core_router     (5)   /dashboard, /execution-logs, /jobs, /event-history, /recent-scheduler-logs
# - platform_router (3)   /platform-insights/*
# - website_router  (3)   /website-analysis/*
# - tasks_router    (3)   /tasks-needing-intervention/*, /tasks/*/manual-trigger, /onboarding-tasks/*
router.include_router(core_router)
router.include_router(platform_router)
router.include_router(website_router)
router.include_router(tasks_router)

__all__ = ["router"]

"""
LinkedIn Today's Workflow — Orchestration Service
==================================================

Public API:
    - LinkedInTodayWorkflowService.get_or_create_plan()

Delegates pillar generation to ``linkedin_today_workflow_pillars``
and data fetching / LLM infra to ``linkedin_today_workflow_data``.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask
from services.database import get_session_for_user

from services.linkedin_today_workflow_data import (
    LINKEDIN_PILLAR_IDS,
    LINKEDIN_PILLAR_ACTION_URLS,
    WORKFLOW_TYPE,
    today_date_str,
)
from services.linkedin_today_workflow_pillars import (
    generate_all_tasks_batched,
)


# ── Service ───────────────────────────────────────────────────────────────────

class LinkedInTodayWorkflowService:
    """Generates daily LinkedIn workflow plans for a single user."""

    def __init__(self, user_id: str):
        self.user_id = user_id

    # ── Public API ──────────────────────────────────────────────────────────

    async def get_or_create_plan(
        self,
        date: Optional[str] = None,
        source: str = "scheduled",
    ) -> Tuple[DailyWorkflowPlan, bool]:
        """Get or create today's LinkedIn workflow plan.

        Returns:
            Tuple of (plan, created) where created is True if a new plan
            was generated.
        """
        date_str = date or today_date_str()

        existing = await self._get_existing_plan(date_str)
        if existing:
            logger.info(
                "LinkedIn workflow plan already exists for user {} date {}",
                self.user_id, date_str,
            )
            return existing, False

        plan = await self._create_plan_row(date_str, source)

        all_tasks: List[Dict[str, Any]] = []
        try:
            all_tasks = await generate_all_tasks_batched(self.user_id, date_str)
        except Exception:
            logger.exception(
                "Batched workflow generation failed for user {}",
                self.user_id,
            )

        if all_tasks:
            await self._persist_tasks(plan, all_tasks, date_str)
            logger.info(
                "Persisted {} LinkedIn workflow tasks for user {} date {}",
                len(all_tasks), self.user_id, date_str,
            )
        else:
            logger.warning(
                "No LinkedIn workflow tasks generated for user {} date {}",
                self.user_id, date_str,
            )

        return plan, bool(all_tasks)

    # ── DB operations (threadpool wrappers) ─────────────────────────────────

    async def _get_existing_plan(self, date: str) -> Optional[DailyWorkflowPlan]:
        from starlette.concurrency import run_in_threadpool

        def _query():
            db = get_session_for_user(self.user_id)
            if db is None:
                return None
            try:
                return (
                    db.query(DailyWorkflowPlan)
                    .filter(
                        DailyWorkflowPlan.user_id == self.user_id,
                        DailyWorkflowPlan.date == date,
                        DailyWorkflowPlan.workflow_type == WORKFLOW_TYPE,
                    )
                    .first()
                )
            finally:
                db.close()

        return await run_in_threadpool(_query)

    async def _create_plan_row(self, date: str, source: str) -> DailyWorkflowPlan:
        from starlette.concurrency import run_in_threadpool

        def _create():
            db = get_session_for_user(self.user_id)
            if db is None:
                raise RuntimeError(f"Cannot open DB session for user {self.user_id}")
            try:
                plan = DailyWorkflowPlan(
                    user_id=self.user_id,
                    date=date,
                    workflow_type=WORKFLOW_TYPE,
                    source=source,
                    generation_mode="linkedin_wedge_data",
                    committee_agent_count=0,
                    fallback_used=False,
                    plan_json={"pillars": list(LINKEDIN_PILLAR_IDS)},
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(plan)
                db.commit()
                db.refresh(plan)
                return plan
            finally:
                db.close()

        return await run_in_threadpool(_create)

    async def _persist_tasks(
        self, plan: DailyWorkflowPlan, tasks: List[Dict[str, Any]], date: str
    ):
        from starlette.concurrency import run_in_threadpool

        def _persist():
            db = get_session_for_user(self.user_id)
            if db is None:
                raise RuntimeError(f"Cannot open DB session for user {self.user_id}")
            try:
                for t in tasks:
                    pillar_id = str(t.get("pillarId", "plan")).strip()
                    task = DailyWorkflowTask(
                        plan_id=plan.id,
                        user_id=self.user_id,
                        workflow_type=WORKFLOW_TYPE,
                        pillar_id=pillar_id,
                        title=str(t.get("title", "")).strip()[:255],
                        description=str(t.get("description", "")).strip(),
                        status="pending",
                        priority=str(t.get("priority", "medium")).strip(),
                        estimated_time=max(5, min(120, int(t.get("estimatedTime", 15) or 15))),
                        action_type="navigate",
                        action_url=t.get("actionUrl")
                        or LINKEDIN_PILLAR_ACTION_URLS.get(pillar_id, "/linkedin-writer"),
                        enabled=True,
                        dependencies=[],
                        metadata_json={
                            "source": "linkedin_workflow",
                            "pillar": pillar_id,
                            **(t.get("metadata") or {}),
                        },
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                    )
                    db.add(task)
                db.commit()
            finally:
                db.close()

        await run_in_threadpool(_persist)

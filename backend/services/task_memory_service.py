"""
Self-Learning Task Memory Service (Phase 3)
Uses txtai and TaskHistory DB model to filter and improve daily task suggestions.
"""
import asyncio
import hashlib
import os
import time
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from loguru import logger
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.daily_workflow_models import TaskHistory, DailyWorkflowTask
from models.task_memory_models import TaskMemorySettings
from services.intelligence.txtai_service import TxtaiIntelligenceService

DEFAULT_SUPPRESSION_WINDOWS = {
    "exact_duplicate_window_days": 7,
    "completed_repeat_window_days": 7,
    "rejected_repeat_window_days": 30,
    "failed_retry_window_days": 1,
}
SEMANTIC_SUPPRESSION_SCORE_THRESHOLD = 0.85
SUPPRESSED_STATUSES = {"dismissed", "rejected", "skipped"}

# M4: txtai save debounce. Previously the index was saved synchronously on
# every task outcome, which is O(N) disk I/O for N outcomes. Now we coalesce
# upserts and save at most once per (batch_size upserts) or once per
# (debounce_sec elapsed), whichever comes first. The DB TaskHistory is the
# source of truth; the txtai index is a derived cache that can be rebuilt
# from the DB if the in-memory copy is lost.
TASK_MEMORY_SAVE_BATCH_SIZE = int(os.getenv("TASK_MEMORY_SAVE_BATCH_SIZE", "10"))
TASK_MEMORY_SAVE_DEBOUNCE_SEC = float(os.getenv("TASK_MEMORY_SAVE_DEBOUNCE_SEC", "5.0"))


class TaskMemoryService:
    """
    Manages the long-term memory of user tasks.
    Responsibilities:
    1. Record completed/rejected tasks to DB and txtai index.
    2. Check if a proposed task is redundant or previously rejected.
    3. Retrieve relevant past tasks for context.
    """

    def __init__(self, user_id: str, db: Session, suppression_windows: Optional[Dict[str, int]] = None):
        self.user_id = user_id
        self.db = db
        self.intelligence = TxtaiIntelligenceService(user_id)
        self.suppression_windows = {
            **DEFAULT_SUPPRESSION_WINDOWS,
            **{key: max(0, int(value)) for key, value in (suppression_windows or {}).items()
               if key in DEFAULT_SUPPRESSION_WINDOWS},
        }
        self.last_filter_decisions: List[Dict[str, Any]] = []
        self._metrics_counters: Dict[str, int] = {}
        # M4: debounced-save state. _pending_save_count tracks upserts not
        # yet flushed; _flush_handle is the active asyncio.TimerHandle (or
        # None). All access is serialised via _save_lock.
        self._pending_save_count: int = 0
        self._save_lock: Optional[asyncio.Lock] = None  # lazy in flush()
        self._flush_handle: Optional[asyncio.TimerHandle] = None

    def _increment_metric(self, metric_name: str, increment: int = 1) -> None:
        """Increment lightweight in-memory counters for observability hooks."""
        self._metrics_counters[metric_name] = self._metrics_counters.get(metric_name, 0) + increment
        logger.debug(
            "TaskMemory metric updated user_id={} metric={} value={}",
            self.user_id,
            metric_name,
            self._metrics_counters[metric_name],
        )

    def _compute_hash(self, title: str, description: str) -> str:
        """Compute a consistent hash for task deduplication."""
        text = f"{title.strip().lower()}|{description.strip().lower()}"
        return hashlib.sha256(text.encode()).hexdigest()

    def _save_index_sync(self) -> int:
        """Synchronously save the txtai index. Returns the number of pending
        upserts that were flushed, or 0 if nothing was pending.

        Caller must hold `_save_lock` (or be the only writer, e.g. in
        tests) to avoid concurrent saves.
        """
        if self._pending_save_count == 0:
            return 0
        flushed = self._pending_save_count
        index_path = getattr(self.intelligence, "index_path", None)
        if not index_path:
            logger.warning("Could not save embeddings: index_path not found on service")
            # Reset the counter anyway to avoid unbounded growth
            self._pending_save_count = 0
            return flushed
        try:
            self.intelligence.embeddings.save(index_path)
            logger.info(
                f"Saved txtai index for user {self.user_id}: flushed {flushed} pending upsert(s)"
            )
        except Exception as save_err:
            logger.error(
                f"Failed to save txtai index for user {self.user_id}: {save_err}"
            )
            # Don't reset counter on failure so the next flush retries
            return 0
        self._pending_save_count = 0
        return flushed

    def _ensure_lock(self) -> asyncio.Lock:
        """Lazily create the asyncio.Lock. Must be called from inside a loop."""
        if self._save_lock is None:
            self._save_lock = asyncio.Lock()
        return self._save_lock

    def _schedule_debounced_flush(self) -> None:
        """Schedule (or reschedule) a debounced flush.

        Called after every upsert. Replaces any pending timer so a burst
        of upserts results in a single save once the burst ends.
        """
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            # No running loop (e.g., called from a sync context in tests).
            # Fall back to immediate save so we don't lose data.
            self._save_index_sync()
            return

        if self._flush_handle is not None:
            self._flush_handle.cancel()
            self._flush_handle = None
        if TASK_MEMORY_SAVE_DEBOUNCE_SEC <= 0:
            # Debounce disabled — fire immediately.
            loop.create_task(self._flush())
        else:
            self._flush_handle = loop.call_later(
                TASK_MEMORY_SAVE_DEBOUNCE_SEC,
                lambda: loop.create_task(self._flush()),
            )

    async def _flush(self) -> int:
        """Coalesced save: write the txtai index if anything is pending.

        Idempotent: safe to call multiple times concurrently. The lock
        ensures only one save runs at a time; subsequent calls see
        `_pending_save_count == 0` and return 0.
        """
        lock = self._ensure_lock()
        async with lock:
            return self._save_index_sync()

    async def flush(self) -> int:
        """Public flush entry point. Force a save of any pending upserts.

        Useful for tests, graceful shutdown, or any time the caller wants
        to ensure the index is on disk before continuing.
        """
        if self._flush_handle is not None:
            self._flush_handle.cancel()
            self._flush_handle = None
        return await self._flush()

    async def record_task_outcome(self, task: DailyWorkflowTask, feedback_score: int = 0, feedback_text: str = None):
        """
        Upsert a task's latest outcome while retaining its feedback timeline.
        """
        try:
            task_hash = self._compute_hash(task.title, task.description)
            now = datetime.utcnow()
            status = str(task.status or "unknown").lower()
            metadata = task.metadata_json if isinstance(task.metadata_json, dict) else {}
            proposed_at = task.created_at or now
            execution_result = metadata.get("execution_result", metadata.get("outcome_metrics"))
            history = (self.db.query(TaskHistory)
                       .filter(TaskHistory.user_id == self.user_id, TaskHistory.task_hash == task_hash)
                       .first())
            if history is None:
                history = TaskHistory(
                    user_id=self.user_id,
                    task_hash=task_hash,
                    created_at=proposed_at,
                    first_proposed_at=proposed_at,
                    vector_id=str(uuid.uuid4()),
                    feedback_history=[],
                    completion_count=0,
                    rejection_count=0,
                    failure_count=0,
                )
                self.db.add(history)

            history.title = task.title
            history.description = task.description
            history.pillar_id = task.pillar_id
            history.workflow_type = getattr(task, "workflow_type", "main") or "main"
            history.status = status
            history.source_agent = metadata.get("source_agent")
            has_feedback = feedback_text is not None or feedback_score != 0
            if has_feedback:
                history.feedback_score = feedback_score
                history.feedback_text = feedback_text
            history.first_proposed_at = history.first_proposed_at or proposed_at
            history.last_proposed_at = now
            if status == "completed":
                history.last_completed_at = now
                history.completion_count = (history.completion_count or 0) + 1
            elif status in SUPPRESSED_STATUSES:
                history.last_rejected_at = now
                history.rejection_count = (history.rejection_count or 0) + 1
            elif status in {"failed", "error"}:
                history.last_failed_at = now
                history.failure_count = (history.failure_count or 0) + 1

            feedback_entry = {
                "recorded_at": now.isoformat(),
                "score": feedback_score,
                "text": feedback_text,
                "status": status,
            }
            feedback_history = list(history.feedback_history or [])
            if has_feedback:
                feedback_history.append(feedback_entry)
                history.last_feedback = feedback_entry
            history.feedback_history = feedback_history[-100:]
            history.execution_result = execution_result
            try:
                self.db.commit()
            except IntegrityError:
                # A concurrent worker may have inserted the unique row. Retry
                # as an update so repeated outcomes remain idempotent.
                self.db.rollback()
                history = (self.db.query(TaskHistory)
                           .filter(TaskHistory.user_id == self.user_id, TaskHistory.task_hash == task_hash)
                           .first())
                if history is None:
                    raise
                history.status = status
                history.last_proposed_at = now
                history.last_feedback = feedback_entry
                history.feedback_history = (list(history.feedback_history or []) + [feedback_entry])[-100:]
                history.execution_result = execution_result
                self.db.commit()

            # 2. Index into txtai (if status is meaningful).
            # M4: we always upsert immediately (it's in-memory and fast),
            # but defer the disk save. The save is coalesced: at most one
            # save per (TASK_MEMORY_SAVE_BATCH_SIZE upserts) or one per
            # (TASK_MEMORY_SAVE_DEBOUNCE_SEC elapsed), whichever fires first.
            #
            # We now route through the canonical
            # ``TxtaiIntelligenceService.index_content()`` method (rather
            # than touching ``self.intelligence.embeddings.upsert()``
            # directly). This gives us the same Windows file-lock
            # handling, semantic-cache integration, and initialization
            # guard that every other SIF caller gets. The previous
            # direct-embeddings path could crash on Windows and skipped
            # the semantic cache.
            if task.status in ["completed", "dismissed", "rejected", "skipped"]:
                doc_text = f"{task.title}. {task.description}"
                item_id = history.vector_id
                # ``index_content`` accepts (id, text, metadata) tuples.
                item = (
                    item_id,
                    doc_text,
                    {
                        "tags": f"task_memory {task.status} {task.pillar_id}",
                        "status": task.status,
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                )
                try:
                    await self.intelligence.index_content([item])
                    self._pending_save_count += 1

                    if self._pending_save_count >= TASK_MEMORY_SAVE_BATCH_SIZE:
                        await self._flush()
                    else:
                        self._schedule_debounced_flush()
                except Exception as index_exc:
                    # Fall back to the legacy direct-embeddings path
                    # only if index_content is unavailable (e.g. txtai
                    # not installed in this environment). The fallback
                    # is best-effort: failures are logged, not raised.
                    if hasattr(self.intelligence, "embeddings") and hasattr(
                        self.intelligence.embeddings, "upsert"
                    ):
                        try:
                            self.intelligence.embeddings.upsert(
                                [
                                    {
                                        "id": item_id,
                                        "text": doc_text,
                                        "tags": item[2]["tags"],
                                        "status": task.status,
                                        "timestamp": item[2]["timestamp"],
                                    }
                                ]
                            )
                            self._pending_save_count += 1
                            if self._pending_save_count >= TASK_MEMORY_SAVE_BATCH_SIZE:
                                await self._flush()
                            else:
                                self._schedule_debounced_flush()
                        except Exception as direct_exc:
                            logger.debug(
                                f"Both index_content and direct embeddings failed "
                                f"for user {self.user_id}: index_exc={index_exc!r} "
                                f"direct_exc={direct_exc!r}"
                            )
                    else:
                        logger.debug(
                            f"index_content failed and direct embeddings not available "
                            f"for user {self.user_id}: {index_exc!r}"
                        )
            else:
                # Status is not semantically meaningful (e.g. "pending").
                # No upsert, no save.
                pass

            return {"status": "recorded", "task_hash": task_hash, "status_value": status}
        except Exception as e:
            logger.error(f"Failed to record task outcome for user {self.user_id}: {e}")
            return {"status": "error", "error": str(e)}

    async def record_task_proposal(self, proposal: Any) -> Dict[str, Any]:
        """Record proposal timing without replacing a known outcome.
        
        Accepts both TaskProposal objects and dicts with equivalent keys.
        """
        try:
            now = datetime.utcnow()
            # Handle both object attributes and dict keys
            if isinstance(proposal, dict):
                title = proposal.get("title", "")
                description = proposal.get("description", "")
                pillar_id = proposal.get("pillar_id") or proposal.get("pillar", "")
                source_agent = proposal.get("source_agent") or proposal.get("agent", None)
            else:
                title = proposal.title
                description = proposal.description
                pillar_id = proposal.pillar_id
                source_agent = getattr(proposal, "source_agent", None)
            
            task_hash = self._compute_hash(title, description)
            history = (self.db.query(TaskHistory)
                       .filter(TaskHistory.user_id == self.user_id, TaskHistory.task_hash == task_hash)
                       .first())
            if history is None:
                history = TaskHistory(
                    user_id=self.user_id,
                    task_hash=task_hash,
                    title=title,
                    description=description,
                    pillar_id=pillar_id,
                    workflow_type="main",
                    status="proposed",
                    source_agent=source_agent,
                    created_at=now,
                    first_proposed_at=now,
                    last_proposed_at=now,
                    vector_id=str(uuid.uuid4()),
                    feedback_history=[],
                )
                self.db.add(history)
            else:
                history.last_proposed_at = now
            self.db.commit()
            return {"status": "recorded", "task_hash": task_hash}
        except IntegrityError:
            self.db.rollback()
            history = (self.db.query(TaskHistory)
                       .filter(TaskHistory.user_id == self.user_id, TaskHistory.task_hash == task_hash)
                       .first())
            if history is None:
                raise
            history.last_proposed_at = datetime.utcnow()
            self.db.commit()
            return {"status": "recorded", "task_hash": task_hash}
        except Exception as exc:
            self.db.rollback()
            logger.error("Failed to record task proposal for user {}: {}", self.user_id, exc)
            return {"status": "error", "error": str(exc)}

    def _get_suppression_windows(self) -> Dict[str, int]:
        """Load tenant-specific windows, falling back to service defaults."""
        windows = dict(self.suppression_windows)
        try:
            settings = (self.db.query(TaskMemorySettings)
                        .filter(TaskMemorySettings.user_id == self.user_id)
                        .first())
            if settings:
                for key in DEFAULT_SUPPRESSION_WINDOWS:
                    value = getattr(settings, key, None)
                    if value is not None:
                        windows[key] = max(0, int(value))
        except Exception as exc:
            logger.warning("Task memory settings unavailable for user_id={} error={}", self.user_id, exc)
        return windows

    def configure_suppression_windows(self, **windows: int) -> Dict[str, int]:
        """Persist validated repetition windows for this tenant."""
        values = {
            key: max(0, int(value))
            for key, value in windows.items()
            if key in DEFAULT_SUPPRESSION_WINDOWS
        }
        if not values:
            return self._get_suppression_windows()
        settings = (self.db.query(TaskMemorySettings)
                    .filter(TaskMemorySettings.user_id == self.user_id)
                    .first())
        if settings is None:
            settings = TaskMemorySettings(user_id=self.user_id)
            self.db.add(settings)
        for key, value in values.items():
            setattr(settings, key, value)
            self.suppression_windows[key] = value
        self.db.commit()
        return self._get_suppression_windows()

    def _proposal_explicit_retry(self, proposal: Any) -> bool:
        context = getattr(proposal, "context_data", None) or {}
        params = getattr(proposal, "action_parameters", None) or {}
        return bool(context.get("explicit_request") or context.get("retry_requested") or
                    params.get("explicit_request") or params.get("retry_requested"))

    def get_proposal_suppression_reason(self, proposal: Any) -> Optional[str]:
        """Return the current outcome-based suppression reason without mutating state."""
        task_hash = self._compute_hash(proposal.title, proposal.description)
        history = (self.db.query(TaskHistory)
                   .filter(TaskHistory.user_id == self.user_id, TaskHistory.task_hash == task_hash)
                   .first())
        if history is None:
            return None
        return self._history_suppression(
            history,
            datetime.utcnow(),
            self._get_suppression_windows(),
            self._proposal_explicit_retry(proposal),
        )

    def _history_suppression(self, history: TaskHistory, now: datetime, windows: Dict[str, int], explicit_retry: bool) -> Optional[str]:
        status = str(history.status or "").lower()
        if status in {"failed", "error"}:
            if explicit_retry:
                return None
            if history.last_failed_at and now - history.last_failed_at <= timedelta(days=windows["failed_retry_window_days"]):
                return "failed execution is inside the retry window; change parameters or explicitly request retry"
            return None
        if status in SUPPRESSED_STATUSES:
            repeated = (history.rejection_count or 0) >= 2
            recent = history.last_rejected_at and now - history.last_rejected_at <= timedelta(days=windows["rejected_repeat_window_days"])
            if repeated or recent:
                return "task was rejected recently or repeatedly"
        if status == "completed" and history.last_completed_at:
            if now - history.last_completed_at <= timedelta(days=windows["completed_repeat_window_days"]):
                poor = (history.feedback_score or 0) < 0 or any(
                    str((history.execution_result or {}).get(key, "")).lower() in {"poor", "failed", "failure"}
                    for key in ("status", "outcome")
                )
                return ("recent completion had poor outcome; changed parameters are required for an improved variant"
                        if poor else "task completed successfully within the repeat window")
        proposed = history.last_proposed_at or history.created_at
        if proposed and now - proposed <= timedelta(days=windows["exact_duplicate_window_days"]):
            return "exact task was proposed recently"
        return None

    async def filter_redundant_proposals(self, proposals: List[Any]) -> List[Any]:
        """
        Filter out proposals that are:
        1. Exact duplicates of recently completed/rejected tasks (Hash check).
        2. Semantically too similar to recently rejected tasks (Vector check).
        """
        filtered = []
        
        now = datetime.utcnow()
        windows = self._get_suppression_windows()
        self.last_filter_decisions = []
        histories = {
            row.task_hash: row for row in self.db.query(TaskHistory).filter(TaskHistory.user_id == self.user_id).all()
        }
        
        for p in proposals:
            p_hash = self._compute_hash(p.title, p.description)
            
            # 1. Exact match check uses outcome-aware windows.
            if p_hash in histories:
                reason = self._history_suppression(
                    histories[p_hash], now, windows, self._proposal_explicit_retry(p)
                )
                self.last_filter_decisions.append({
                    "pillar_id": getattr(p, "pillar_id", None),
                    "title": p.title,
                    "suppressed": bool(reason),
                    "reason": reason,
                })
            else:
                reason = None
            if reason:
                logger.info("Filtering redundant task title={} reason={}", p.title, reason)
                continue
                
            # 2. Semantic Similarity Check (only for potential rejections)
            # If we have the vector index ready
            is_semantic_duplicate = False
            try:
                # Check if similar tasks were REJECTED recently
                results = await self.intelligence.search(
                    f"{p.title} {p.description}", 
                    limit=1
                )
                
                if results:
                    top = results[0]
                    top_score = float(top.get("score", 0))
                    if top_score >= SEMANTIC_SUPPRESSION_SCORE_THRESHOLD:
                        indexed_status = self._extract_indexed_status(top)
                        vector_id = top.get("id") or top.get("vector_id")
                        history_row = None
                        if vector_id:
                            history_row = (
                                self.db.query(TaskHistory)
                                .filter(
                                    TaskHistory.user_id == self.user_id,
                                    TaskHistory.vector_id == str(vector_id),
                                )
                                .first()
                            )
                        if history_row and self._history_suppression(history_row, now, windows, False):
                            logger.info(
                                f"Filtering redundant task (semantic {top_score:.2f}, indexed status={indexed_status}): {p.title}"
                            )
                            is_semantic_duplicate = True
                            self.last_filter_decisions.append({
                                "pillar_id": getattr(p, "pillar_id", None),
                                "title": p.title,
                                "suppressed": True,
                                "reason": "semantically matches a rejected task",
                            })
            except Exception as semantic_err:
                self._increment_metric("semantic_filter_failures")
                self._increment_metric("semantic_filter_degraded_path_taken")
                logger.warning(
                    "Semantic filter degraded for user_id={} proposal_title={} error_class={} error_message={}",
                    self.user_id,
                    getattr(p, "title", ""),
                    type(semantic_err).__name__,
                    str(semantic_err),
                )
                
            if not is_semantic_duplicate:
                filtered.append(p)
                
        return filtered

    def _extract_indexed_status(self, search_result: Dict[str, Any]) -> Optional[str]:
        """Extract indexed status from txtai result metadata if available."""
        status = search_result.get("status")
        if status:
            return str(status).lower()

        obj = search_result.get("object")
        if isinstance(obj, dict):
            obj_status = obj.get("status")
            return str(obj_status).lower() if obj_status else None

        return None

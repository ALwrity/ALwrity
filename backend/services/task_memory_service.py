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
from sqlalchemy.orm import Session

from models.daily_workflow_models import TaskHistory, DailyWorkflowTask
from services.intelligence.txtai_service import TxtaiIntelligenceService

EXACT_DUPLICATE_LOOKBACK_DAYS = 7
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

    def __init__(self, user_id: str, db: Session):
        self.user_id = user_id
        self.db = db
        self.intelligence = TxtaiIntelligenceService(user_id)
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
        Record a task's final status (completed, dismissed, rejected) into memory.
        """
        try:
            task_hash = self._compute_hash(task.title, task.description)

            # 1. Update/Create DB Record
            history = TaskHistory(
                user_id=self.user_id,
                task_hash=task_hash,
                title=task.title,
                description=task.description,
                pillar_id=task.pillar_id,
                status=task.status,
                source_agent=task.metadata_json.get("source_agent") if task.metadata_json else None,
                feedback_score=feedback_score,
                feedback_text=feedback_text,
                created_at=datetime.utcnow(),
                vector_id=str(uuid.uuid4())
            )
            self.db.add(history)
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

        except Exception as e:
            logger.error(f"Failed to record task outcome for user {self.user_id}: {e}")

    async def filter_redundant_proposals(self, proposals: List[Any]) -> List[Any]:
        """
        Filter out proposals that are:
        1. Exact duplicates of recently completed/rejected tasks (Hash check).
        2. Semantically too similar to recently rejected tasks (Vector check).
        """
        filtered = []
        
        # Get recent history hashes (last 7 days)
        cutoff = datetime.utcnow() - timedelta(days=EXACT_DUPLICATE_LOOKBACK_DAYS)
        recent_hashes = {
            row.task_hash for row in 
            self.db.query(TaskHistory.task_hash)
            .filter(TaskHistory.user_id == self.user_id, TaskHistory.created_at >= cutoff)
            .all()
        }
        
        for p in proposals:
            p_hash = self._compute_hash(p.title, p.description)
            
            # 1. Exact Match Check
            if p_hash in recent_hashes:
                logger.info(f"Filtering redundant task (exact match): {p.title}")
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
                        if indexed_status in SUPPRESSED_STATUSES:
                            logger.info(
                                f"Filtering redundant task (semantic {top_score:.2f}, indexed status={indexed_status}): {p.title}"
                            )
                            is_semantic_duplicate = True
                        else:
                            vector_id = top.get("id") or top.get("vector_id")
                            if vector_id:
                                history = (
                                    self.db.query(TaskHistory.status)
                                    .filter(
                                        TaskHistory.user_id == self.user_id,
                                        TaskHistory.vector_id == str(vector_id),
                                    )
                                    .order_by(TaskHistory.created_at.desc())
                                    .first()
                                )
                                history_status = getattr(history, "status", None)
                                if history_status in SUPPRESSED_STATUSES:
                                    logger.info(
                                        f"Filtering redundant task (semantic {top_score:.2f}, history status={history_status}): {p.title}"
                                    )
                                    is_semantic_duplicate = True
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

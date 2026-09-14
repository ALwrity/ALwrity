"""Calendar session registry mixin — extracted from calendar_generation_service.

Owns the durable orchestrator-session machinery (R2.3-consolidated):
the in-process session registry, DB row persistence/lookup, restart
reconciliation, and the progress read path (memory with durable-row
fallback). No behavior change vs. the pre-split service.

``CalendarGenerationService`` inherits this mixin so every method keeps its
exact ``self.orchestrator_sessions`` / ``self.db_session`` access pattern.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from loguru import logger
from sqlalchemy import func

# Import models for persistence
from models.enhanced_calendar_models import CalendarGenerationSession
from models.content_planning import CalendarEvent

# Global session store to persist across requests
_global_orchestrator_sessions: dict = {}

# R2.4: detached generation tasks per session, so a user cancel can actually
# stop the work (not just flip a status). Registered by run_generation_task.
_active_generation_tasks: dict = {}

# Phase 2: canonical session statuses. "error" and "processing" are legacy
# aliases accepted on read; new writes use initializing/running/completed/failed/cancelled.
ACTIVE_STATUSES = ("initializing", "running")
ACTIVE_STATUSES_WITH_LEGACY = ("initializing", "running", "processing")
TERMINAL_STATUSES = ("completed", "failed", "cancelled")
TERMINAL_STATUSES_WITH_LEGACY = ("completed", "failed", "error", "cancelled")

# Throttle DB persists from high-frequency progress callbacks.
_PERSIST_THROTTLE_SECONDS = 30


class CalendarSessionRegistryMixin:
    """Mixin: orchestrator session registry, persistence and progress reads."""

    # R2.4: task registry accessors (module-level store, shared across the
    # process's service instances like _global_orchestrator_sessions).
    def register_generation_task(self, session_id: str, task) -> None:
        """Retain the running generation task for `session_id` (R2.4)."""
        _active_generation_tasks[session_id] = task

    def unregister_generation_task(self, session_id: str) -> None:
        _active_generation_tasks.pop(session_id, None)

    def get_generation_task(self, session_id: str):
        return _active_generation_tasks.get(session_id)

    def initialize_orchestrator_session(self, session_id: str, request_data: Dict[str, Any]) -> bool:
        """Initialize a new orchestrator session with duplicate prevention."""
        try:
            if not self.orchestrator:
                logger.error("❌ Orchestrator not initialized")
                return False
            
            # Clean up old sessions for the same user
            user_id = request_data.get("user_id")
            if not user_id:
                logger.error("❌ user_id is required in request_data")
                return False
            self._cleanup_old_sessions(user_id)
            
            # Check for existing active sessions for this user
            existing_session = self._get_active_session_for_user(user_id)
            if existing_session:
                logger.warning(f"⚠️ User {user_id} already has an active session: {existing_session}")
                return False
            
            # Store session data
            self.orchestrator_sessions[session_id] = {
                "request_data": request_data,
                "user_id": user_id,
                "status": "initializing",
                "start_time": datetime.now(),
                "progress": {
                    "current_step": 0,
                    "overall_progress": 0,
                    "step_results": {},
                    "quality_scores": {},
                    "errors": [],
                    "warnings": []
                }
            }
            
            logger.info(f"✅ Orchestrator session {session_id} initialized for user {user_id}")
            self._persist_session_to_db(session_id)
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize orchestrator session: {e}")
            return False

    def _cleanup_old_sessions(self, user_id: str) -> None:
        """Clean up old sessions across ALL users.

        Phase 2 fix: previously only cleaned sessions for the requesting
        user, so sessions from other users accumulated forever.
        """
        try:
            current_time = datetime.now()
            sessions_to_remove = []
            
            # Collect sessions to remove first, then remove them
            for session_id, session_data in self.orchestrator_sessions.items():
                start_time = session_data.get("start_time")
                if not start_time:
                    continue

                age_seconds = (current_time - start_time).total_seconds()

                # Remove sessions older than 1 hour regardless of user
                if age_seconds > 3600:
                    sessions_to_remove.append(session_id)
                    continue

                # Also remove terminal sessions older than 10 minutes
                if session_data.get("status") in TERMINAL_STATUSES_WITH_LEGACY:
                    if age_seconds > 600:  # 10 minutes
                        sessions_to_remove.append(session_id)
            
            # Remove the sessions
            for session_id in sessions_to_remove:
                if session_id in self.orchestrator_sessions:
                    del self.orchestrator_sessions[session_id]
                    logger.info(f"🧹 Cleaned up old session: {session_id}")

            # Also clean up from DB (Phase 2: age-windowed, mirrors memory rules).
            if self.db_session:
                try:
                    now = datetime.utcnow()
                    terminal_cutoff = now - timedelta(minutes=10)
                    old_cutoff = now - timedelta(hours=1)
                    (self.db_session.query(CalendarGenerationSession)
                        .filter(
                            (
                                CalendarGenerationSession.generation_status.in_(
                                    list(TERMINAL_STATUSES_WITH_LEGACY)
                                )
                                & (CalendarGenerationSession.created_at < terminal_cutoff)
                            )
                            | (CalendarGenerationSession.created_at < old_cutoff)
                        )
                        .delete(synchronize_session=False))
                    self.db_session.commit()
                except Exception as db_e:
                    self.db_session.rollback()
                    logger.error(f"❌ Error cleaning up sessions from DB: {db_e}")
                
        except Exception as e:
            logger.error(f"❌ Error cleaning up old sessions: {e}")
    
    def _get_active_session_for_user(self, user_id: str) -> Optional[str]:
        """Get active session for a user."""
        try:
            for session_id, session_data in self.orchestrator_sessions.items():
                if (session_data.get("user_id") == user_id and
                    session_data.get("status") in ACTIVE_STATUSES_WITH_LEGACY):
                    return session_id
            return None
        except Exception as e:
            logger.error(f"❌ Error getting active session for user: {e}")
            return None
    
    def _find_session_row(self, session_id: str) -> Optional[CalendarGenerationSession]:
        """Find a session row by session_key, falling back to JSON lookup."""
        if not self.db_session:
            return None
        try:
            existing = (
                self.db_session.query(CalendarGenerationSession)
                .filter(CalendarGenerationSession.session_key == session_id)
                .first()
            )
            if existing is not None:
                return existing
        except Exception:
            self.db_session.rollback()
        # Legacy fallback for rows written before session_key backfill.
        try:
            return (
                self.db_session.query(CalendarGenerationSession)
                .filter(
                    func.json_extract(
                        CalendarGenerationSession.generation_params, "$.session_id"
                    )
                    == session_id
                )
                .first()
            )
        except Exception:
            self.db_session.rollback()
            return None

    def _persist_session_to_db(
        self, session_id: str, include_request_data: bool = True
    ) -> None:
        """Persist session state to database so it survives restarts."""
        try:
            session = self.orchestrator_sessions.get(session_id)
            if not session or not self.db_session:
                return

            user_id = session.get("user_id", "")
            request_data = session.get("request_data", {})

            existing = self._find_session_row(session_id)

            if not existing:
                create_kwargs: Dict[str, Any] = {
                    "user_id": user_id,
                    "strategy_id": request_data.get("strategy_id"),
                    "session_type": request_data.get("calendar_type", "monthly"),
                    "generation_params": {"session_id": session_id},
                    "generation_status": session.get("status", "initializing"),
                }
                if hasattr(CalendarGenerationSession, "session_key"):
                    create_kwargs["session_key"] = session_id
                existing = CalendarGenerationSession(**create_kwargs)
                self.db_session.add(existing)
                self.db_session.flush()

            # Update with current state
            status = session.get("status", "initializing")
            if status == "error":
                status = "failed"
            existing.generation_status = status
            if hasattr(CalendarGenerationSession, "session_key") and not getattr(
                existing, "session_key", None
            ):
                existing.session_key = session_id
            if include_request_data:
                stored_request = request_data
            else:
                stored_request = (existing.generation_params or {}).get(
                    "request_data", request_data
                )
            existing.generation_params = {
                "session_id": session_id,
                "progress": session.get("progress", {}),
                "request_data": stored_request,
                "status": session.get("status"),
                "error": session.get("error"),
            }
            
            # If completed, populate result fields
            if session.get("status") == "completed":
                result = session.get("result", {})
                existing.generated_calendar = result
                existing.ai_insights = result.get("ai_insights") if isinstance(result, dict) else None
                existing.performance_predictions = result.get("performance_predictions") if isinstance(result, dict) else None
                existing.content_themes = result.get("weekly_themes") if isinstance(result, dict) else None
                existing.generation_status = "completed"
                existing.processing_time = session.get("processing_time")
            
            self.db_session.commit()
            
        except Exception as e:
            if self.db_session:
                self.db_session.rollback()
            logger.error(f"❌ Error persisting session {session_id} to DB: {e}")

    # R2.3: an active row older than this at (re)start belongs to a process
    # that no longer holds its task — reconcile it to `failed` instead of
    # leaving a stuck `running` row that blocks the user from regenerating.
    _ORPHAN_CUTOFF_SECONDS = 900

    def _is_orphaned_session_row(self, row: CalendarGenerationSession) -> bool:
        started_at = row.created_at
        if not started_at:
            return False  # no timestamp basis — don't guess
        return (datetime.utcnow() - started_at).total_seconds() > self._ORPHAN_CUTOFF_SECONDS

    def _reconcile_orphaned_row(self, row: CalendarGenerationSession) -> None:
        """Mark a dead `running` row failed so it cannot block regeneration."""
        params = dict(row.generation_params or {})
        progress = dict(params.get("progress") or {})
        errors = list(progress.get("errors") or [])
        errors.append({
            "message": "Generation interrupted by process restart.",
            "step": None,
            "timestamp": datetime.utcnow().isoformat(),
            "severity": "error",
            "recoverable": False,
        })
        progress["errors"] = errors
        params["status"] = "failed"
        params["error"] = "Generation interrupted by process restart."
        params["progress"] = progress
        row.generation_params = params
        row.generation_status = "failed"
        self.db_session.commit()
        logger.info(
            f"🧟 Reconciled orphaned session row {row.id} → failed "
            "(interrupted by restart)"
        )

    def _load_sessions_from_db(self) -> None:
        """Load active sessions from database into the in-memory store."""
        try:
            if not self.db_session:
                return
            
            active_sessions = self.db_session.query(CalendarGenerationSession).filter(
                CalendarGenerationSession.generation_status.in_(
                    list(ACTIVE_STATUSES_WITH_LEGACY)
                )
            ).all()

            reconciled = 0
            for db_session_record in active_sessions:
                params = db_session_record.generation_params or {}
                session_id = (
                    getattr(db_session_record, "session_key", None)
                    or params.get("session_id")
                    or f"db-session-{db_session_record.id}"
                )
                
                if session_id in self.orchestrator_sessions:
                    continue

                # R2.3: a cold process cannot be running this task — old
                # active rows are interrupted for restart reconciliation.
                if self._is_orphaned_session_row(db_session_record):
                    self._reconcile_orphaned_row(db_session_record)
                    reconciled += 1
                    continue
                
                self.orchestrator_sessions[session_id] = {
                    "request_data": params.get("request_data", {}),
                    "user_id": db_session_record.user_id,
                    "status": db_session_record.generation_status,
                    "start_time": db_session_record.created_at or datetime.now(),
                    "progress": params.get("progress", {
                        "current_step": 0,
                        "overall_progress": 0,
                        "step_results": {},
                        "quality_scores": {},
                        "errors": [],
                        "warnings": []
                    }),
                    "error": params.get("error"),
                }
                logger.info(f"🔄 Restored session {session_id} for user {db_session_record.user_id}")
            
            if active_sessions:
                logger.info(
                    f"✅ Restored {len(active_sessions) - reconciled} active sessions "
                    f"from database, reconciled {reconciled} orphans"
                )
                
        except Exception as e:
            logger.error(f"❌ Error loading sessions from DB: {e}")

    def cancel_orchestrator_session(
        self, session_id: str, requester_user_id: Optional[str] = None
    ) -> bool:
        """Cancel an ongoing orchestrator session and persist to DB.

        Phase 1: when requester_user_id is provided, deny cross-user cancels.
        None preserves legacy behavior for internal callers/tests.
        """
        try:
            session = self.orchestrator_sessions.get(session_id)
            if not session:
                logger.warning(f"❌ Session {session_id} not found for cancellation")
                return False
            if (
                requester_user_id is not None
                and str(session.get("user_id", "")) != str(requester_user_id)
            ):
                logger.warning(
                    f"⛔ Cancel denied for session {session_id}: "
                    f"owner={session.get('user_id')} requester={requester_user_id}"
                )
                return False
            # R2.4: actually cancel the running generation task — status
            # flips alone only stop the UI, not the AI spend.
            task = _active_generation_tasks.get(session_id)
            if task is not None and not task.done():
                task.cancel()
                logger.info(f"🛑 Cancelled generation task for session {session_id}")
            _active_generation_tasks.pop(session_id, None)
            session["status"] = "cancelled"
            self._persist_session_to_db(session_id)
            logger.info(f"✅ Session {session_id} cancelled")
            return True
        except Exception as e:
            logger.error(f"❌ Error cancelling session {session_id}: {e}")
            return False

    def get_session_owner(self, session_id: str) -> Optional[str]:
        """Return the owner user_id for a session, or None if missing."""
        session = self.orchestrator_sessions.get(session_id)
        if not session:
            return None
        owner = session.get("user_id", "")
        return str(owner) if owner else None

    def _progress_from_db_row(self, row: CalendarGenerationSession) -> Dict[str, Any]:
        """Serve the durable session row's progress payload (R2.3).

        Same shape as the in-memory payload so ``GET /progress`` responses are
        byte-compatible whichever worker serves them: status from the row,
        throttled progress from ``generation_params.progress``, and the
        assembled calendar as ``result`` only once completed.
        """
        params = row.generation_params or {}
        progress = params.get("progress") or {}
        status = row.generation_status
        updated_at = getattr(row, "updated_at", None)
        errors = progress.get("errors") or []
        error_value = params.get("error")
        if error_value and not errors:
            errors = [{"message": str(error_value), "severity": "error", "recoverable": False}]
        return {
            "status": status,
            "current_step": progress.get("current_step", 0),
            "step_progress": progress.get("step_progress", 0),
            "overall_progress": progress.get("overall_progress", 0),
            "step_results": progress.get("step_results", {}),
            "quality_scores": progress.get("quality_scores", {}),
            "errors": errors,
            "warnings": progress.get("warnings", []),
            "transparency_messages": params.get("transparency_messages", []),
            "educational_content": params.get("educational_content", []),
            "estimated_completion": params.get("estimated_completion"),
            "last_updated": updated_at.isoformat() if updated_at else None,
            # B4: deliver the assembled calendar only once the session
            # actually completed with a real result.
            "result": row.generated_calendar if status == "completed" else None,
            # R6.2: durable fallback can't carry a live flag; the save itself
            # couldn't commit. Surfaced as None here (memory-first read wins).
            "persistence_error": None,
        }

    def get_orchestrator_progress(
        self, session_id: str, requester_user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get progress for an orchestrator session.

        Phase 1: when requester_user_id is provided, cross-user reads return
        a forbidden sentinel instead of session data. None preserves legacy.
        """
        try:
            logger.info(f"🔍 Looking for session {session_id}")
            logger.info(f"📊 Available sessions: {list(self.orchestrator_sessions.keys())}")

            session = self.orchestrator_sessions.get(session_id)
            if not session:
                # R2.3: another worker (or a restarted process) holds this
                # session only as a durable row — serve the same payload from
                # the DB so progress is not worker-bound.
                db_row = self._find_session_row(session_id)
                if db_row is None:
                    logger.warning(f"❌ Session {session_id} not found")
                    return None
                if (
                    requester_user_id is not None
                    and str(db_row.user_id or "") != str(requester_user_id)
                ):
                    logger.warning(
                        f"⛔ Progress denied for session {session_id}: "
                        f"owner={db_row.user_id} requester={requester_user_id}"
                    )
                    return {"forbidden": True, "status": "forbidden"}
                logger.info(
                    f"✅ Session {session_id} served from durable row "
                    f"(status: {db_row.generation_status})"
                )
                return self._progress_from_db_row(db_row)
            if (
                requester_user_id is not None
                and str(session.get("user_id", "")) != str(requester_user_id)
            ):
                logger.warning(
                    f"⛔ Progress denied for session {session_id}: "
                    f"owner={session.get('user_id')} requester={requester_user_id}"
                )
                return {"forbidden": True, "status": "forbidden"}
            
            logger.info(f"✅ Found session {session_id} with status: {session['status']}")
            
            # Ensure all required fields are present with default values
            progress_data = session.get("progress", {})
            
            return {
                "status": session["status"],
                "current_step": progress_data.get("current_step", 0),
                "step_progress": progress_data.get("step_progress", 0),  # Ensure this field is present
                "overall_progress": progress_data.get("overall_progress", 0),
                "step_results": progress_data.get("step_results", {}),
                "quality_scores": progress_data.get("quality_scores", {}),
                "errors": progress_data.get("errors", []),
                "warnings": progress_data.get("warnings", []),
                "transparency_messages": session.get("transparency_messages", []),
                "educational_content": session.get("educational_content", []),
                "estimated_completion": session.get("estimated_completion"),
                "last_updated": session.get("last_updated", datetime.now().isoformat()),
                # B4: deliver the assembled calendar only once the session
                # actually completed with a real result.
                "result": session.get("result") if session["status"] == "completed" else None,
                # R6.2: persistence failure surfaced for /progress banner
                "persistence_error": session.get("persistence_error"),
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting orchestrator progress: {e}")
            return None
    
    def _update_session_progress(self, session_id: str, progress: Dict[str, Any]) -> None:
        """Update session progress from orchestrator callback."""
        try:
            session = self.orchestrator_sessions.get(session_id)
            if session:
                # Convert progress tracker format to service format
                current_step = progress.get("current_step", 0)
                total_steps = progress.get("total_steps", 12)
                step_progress = progress.get("step_progress", 0)  # Get step-specific progress

                session["progress"] = {
                    "current_step": current_step,
                    "step_progress": step_progress,  # Add step_progress field
                    "overall_progress": progress.get("progress_percentage", 0),
                    "step_results": progress.get("step_details", {}),
                    "quality_scores": {step: data.get("quality_score", 0.0) for step, data in progress.get("step_details", {}).items()},
                    "errors": [],
                    "warnings": []
                }
                session["last_updated"] = datetime.now().isoformat()

                logger.info(f"📊 Updated progress for session {session_id}: step {current_step}/{total_steps} (step progress: {step_progress}%)")
                # Phase 2: throttle DB writes — persist on step change or
                # after _PERSIST_THROTTLE_SECONDS; keep request_data stored.
                last_step = session.get("_last_persist_step")
                last_time = session.get("_last_persist_time", 0.0)
                now_ts = time.time()
                if (
                    last_step != current_step
                    or (now_ts - float(last_time or 0.0)) >= _PERSIST_THROTTLE_SECONDS
                ):
                    session["_last_persist_step"] = current_step
                    session["_last_persist_time"] = now_ts
                    self._persist_session_to_db(session_id, include_request_data=False)
                
        except Exception as e:
            logger.error(f"❌ Error updating session progress: {e}")

    @staticmethod
    def _parse_scheduled_date(date_str: Optional[str]) -> datetime:
        """Parse an ISO date string; fall back to now with a warning."""
        if not date_str:
            return datetime.utcnow()
        try:
            return datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
        except Exception:
            logger.warning(f"⚠️ Unparseable scheduled date {date_str!r}; using now")
            return datetime.utcnow()

    async def _save_calendar_to_db(self, user_id: str, strategy_id: Optional[int], calendar_data: Dict[str, Any], session_id: str) -> None:
        """Save generated calendar to database (Phase 2: loud on failure)."""
        try:
            if not self.db_session:
                raise RuntimeError("No database session available for persistence")

            # F4/F5: never persist an error dict (or an empty result) as a
            # completed calendar. The failure is already recorded on the
            # session by start_orchestrator_generation / _persist_session_to_db.
            if (
                calendar_data.get("status") in ("error", "failed")
                or not (calendar_data.get("daily_schedule") or calendar_data.get("final_calendar"))
            ):
                logger.error(f"❌ Skipping DB persistence for failed calendar generation (session {session_id})")
                return

            # Dedupe on session_key: _persist already wrote a row for this session.
            session_record = self._find_session_row(session_id)
            if session_record is None:
                create_kwargs: Dict[str, Any] = {
                    "user_id": user_id,
                    "strategy_id": strategy_id,
                    "session_type": calendar_data.get("calendar_type", "monthly"),
                    "generation_params": {"session_id": session_id},
                    "generation_status": "completed",
                }
                if hasattr(CalendarGenerationSession, "session_key"):
                    create_kwargs["session_key"] = session_id
                session_record = CalendarGenerationSession(**create_kwargs)
                self.db_session.add(session_record)
                self.db_session.flush()  # Get ID

            session_record.user_id = user_id
            session_record.strategy_id = strategy_id
            session_record.session_type = calendar_data.get("calendar_type", "monthly")
            if hasattr(CalendarGenerationSession, "session_key") and not getattr(
                session_record, "session_key", None
            ):
                session_record.session_key = session_id

            # Save calendar events
            # Extract daily schedule from calendar data
            daily_schedule = calendar_data.get("daily_schedule", [])
            
            # If daily_schedule is not directly available, try to extract from step results
            if not daily_schedule and "step_results" in calendar_data:
                 daily_schedule = calendar_data.get("step_results", {}).get("step_08", {}).get("daily_schedule", [])

            # Skip calendar event creation when no valid strategy_id (FK constraint)
            # R4.1: inserts are pre-filtered by the natural key
            # (strategy_id, user_id, title, scheduled_date) so a retry/partial
            # re-save of the same session cannot duplicate rows; user edits
            # persisted by hand are left untouched (we only skip items whose
            # natural-key match already exists).
            if not strategy_id:
                logger.warning(f"⚠️ No strategy_id provided — skipping CalendarEvent creation for session {session_id}")
            else:
                for day in daily_schedule:
                    content_items = day.get("content_items", [])
                    scheduled_date = self._parse_scheduled_date(day.get("date"))
                    for item in content_items:
                        title = item.get("title", "Untitled Event")
                        exists = (
                            self.db_session.query(CalendarEvent)
                            .filter(
                                CalendarEvent.user_id == user_id,
                                CalendarEvent.strategy_id == strategy_id,
                                CalendarEvent.title == title,
                                CalendarEvent.scheduled_date == scheduled_date,
                            )
                            .first()
                            is not None
                        )
                        if exists:
                            continue

                        event = CalendarEvent(
                            user_id=user_id,
                            strategy_id=strategy_id,
                            title=item.get("title", "Untitled Event"),
                            description=item.get("description"),
                            content_type=item.get("type") or item.get("content_type") or "social_post",
                            platform=item.get("platform") or item.get("target_platform") or "generic",
                            scheduled_date=scheduled_date,
                            status="draft",
                            ai_recommendations=item
                        )
                        self.db_session.add(event)

            session_record.generated_calendar = calendar_data
            session_record.ai_insights = calendar_data.get("ai_insights")
            session_record.performance_predictions = calendar_data.get("performance_predictions")
            session_record.content_themes = calendar_data.get("weekly_themes")
            session_record.generation_status = "completed"
            session_record.ai_confidence = calendar_data.get("ai_confidence")
            session_record.processing_time = calendar_data.get("processing_time")
            session_record.generation_params = {
                "session_id": session_id,
                "request_data": (session_record.generation_params or {}).get("request_data", {}),
                "status": "completed",
            }
            self.db_session.commit()
            logger.info(f"✅ Calendar saved to database for user {user_id}")

            # Phase A: trigger calendar SIF indexing (fire-and-forget).
            # R2.1: no session is passed — the indexing task opens and closes
            # its own per-user session, so the request-scoped session never
            # crosses the task boundary.
            try:
                from services.calendar_sif_indexer import (
                    calendar_sif_indexing_enabled,
                    index_calendar_async,
                )
                if calendar_sif_indexing_enabled():
                    generated_at = calendar_data.get("generated_at")
                    index_calendar_async(
                        user_id,
                        calendar_data,
                        generated_at or datetime.utcnow().isoformat(),
                    )
            except Exception as exc:
                logger.warning(
                    f"⚠️ Calendar SIF trigger dispatch failed (non-fatal): {exc}"
                )

        except Exception as e:
            try:
                if self.db_session:
                    self.db_session.rollback()
            finally:
                # R6.2: best-effort surface the save failure on the in-memory
                # session so /progress can show it (never silently swallowed).
                try:
                    in_memory = self.orchestrator_sessions.get(session_id)
                    if in_memory is not None:
                        in_memory["persistence_error"] = repr(e)[:400]
                except Exception:
                    pass
                logger.error(f"❌ Error saving calendar to database: {str(e)}")
                raise

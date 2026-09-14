"""
Calendar Generation Service for Content Planning API.

Core 12-step generation lifecycle. Split for size (R2 consolidation, no
behavior change):

- ``calendar_session_registry`` — session registry, durable rows, progress
  reads and calendar persistence (``CalendarSessionRegistryMixin``);
- ``calendar_generation_operations`` — strategy-grounded operations
  (``CalendarGroundingOperationsMixin``).

``CalendarGenerationService`` composes both mixins; every public name stays
importable from this module.
"""

from typing import Dict, Any, Optional
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session
import asyncio
import random
import time

# Import orchestrator for 12-step calendar generation
from services.calendar_generation_datasource_framework.prompt_chaining.orchestrator import PromptChainOrchestrator

# Import validation service
from services.validation import check_all_api_keys

# Import utilities
from ..utils.error_handlers import ContentPlanningErrorHandler

from .calendar_session_registry import (
    ACTIVE_STATUSES,  # noqa: F401 — re-exported for callers
    ACTIVE_STATUSES_WITH_LEGACY,  # noqa: F401
    TERMINAL_STATUSES,  # noqa: F401
    TERMINAL_STATUSES_WITH_LEGACY,  # noqa: F401
    _PERSIST_THROTTLE_SECONDS,  # noqa: F401
    _global_orchestrator_sessions,
    CalendarSessionRegistryMixin,
)
from .calendar_generation_operations import CalendarGroundingOperationsMixin


class CalendarGenerationService(CalendarSessionRegistryMixin, CalendarGroundingOperationsMixin):
    """Service class for calendar generation operations."""
    
    def __init__(self, db_session: Optional[Session] = None):
        self.db_session = db_session
        
        # Initialize orchestrator for 12-step calendar generation
        try:
            self.orchestrator = PromptChainOrchestrator(db_session=db_session)
            # Use global session store to persist across requests
            self.orchestrator_sessions = _global_orchestrator_sessions
            # Load any active sessions from database into memory
            self._load_sessions_from_db()
            logger.info("✅ 12-step orchestrator initialized successfully with database session")
        except Exception as e:
            logger.error(f"❌ Failed to initialize orchestrator: {e}")
            self.orchestrator = None
    
    async def generate_comprehensive_calendar(self, user_id: str, strategy_id: Optional[int] = None, 
                                           calendar_type: str = "monthly", industry: Optional[str] = None, 
                                           business_size: str = "sme",
                                           strategy_digest: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate a comprehensive AI-powered content calendar using the 12-step orchestrator."""
        try:
            logger.info(f"🎯 Generating comprehensive calendar for user {user_id} using 12-step orchestrator")
            start_time = time.time()
            
            # Generate unique session ID
            session_id = f"calendar-session-{int(time.time())}-{random.randint(1000, 9999)}"
            
            # Initialize orchestrator session
            request_data = {
                "user_id": user_id,
                "strategy_id": strategy_id,
                "calendar_type": calendar_type,
                "industry": industry,
                "business_size": business_size,
                "strategy_digest": strategy_digest or {}
            }
            
            success = self.initialize_orchestrator_session(session_id, request_data)
            if not success:
                raise Exception("Failed to initialize orchestrator session")
            
            # Start the 12-step generation process. The sync path persists the
            # calendar itself below (with processing_time injected), so the
            # /start completion hook must not persist a second time.
            await self.start_orchestrator_generation(
                session_id, request_data, persist_completed=False
            )
            
            # Wait for completion and get final result
            max_wait_time = 300  # 5 minutes
            wait_interval = 2  # 2 seconds
            elapsed_time = 0
            
            while elapsed_time < max_wait_time:
                progress = self.get_orchestrator_progress(session_id)
                if progress and progress.get("status") == "completed":
                    # The orchestrator stores the final assembled calendar on
                    # the session; the progress tracker only keeps per-step
                    # metadata (so the old ``step_12.result`` read was empty).
                    session = self.orchestrator_sessions.get(session_id, {})
                    calendar_data = session.get("result", {}) or {}
                    processing_time = time.time() - start_time
                    calendar_data["processing_time"] = processing_time
                    if "generated_at" not in calendar_data:
                        calendar_data["generated_at"] = datetime.now().isoformat()
                    
                    # Save to database
                    await self._save_calendar_to_db(user_id, strategy_id, calendar_data, session_id)
                    
                    logger.info(f"✅ Calendar generated successfully in {processing_time:.2f}s")
                    return calendar_data
                elif progress and progress.get("status") in ("failed", "error"):
                    raise Exception(f"Calendar generation failed: {progress.get('errors', ['Unknown error'])}")
                elif progress and progress.get("status") == "cancelled":
                    raise Exception("Calendar generation was cancelled")
                
                await asyncio.sleep(wait_interval)
                elapsed_time += wait_interval
            
            raise Exception("Calendar generation timed out")
            
        except Exception as e:
            logger.error(f"❌ Error generating comprehensive calendar: {str(e)}")
            logger.error(f"Exception type: {type(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "generate_comprehensive_calendar")

    async def run_generation_task(self, session_id: str, request_data: Dict[str, Any]) -> None:
        """Task-owned entry point for the ``/start`` background job (R2.1).

        Opens a dedicated session via ``get_session_for_user`` (or the
        injected ``background_session_factory``), runs the whole generation
        through it — orchestrator progress persists, the R1.1 calendar save
        and the SIF dispatch — and closes it in ``finally``. The
        request-scoped session never crosses the task boundary. Never
        raises: bounded failures mark the in-memory session ``failed``.
        """
        user_id = str(request_data.get("user_id") or "")
        session_info = self.orchestrator_sessions.get(session_id)
        if not user_id:
            logger.error(f"❌ Generation task {session_id}: user_id missing")
            if session_info is not None:
                session_info["status"] = "failed"
                session_info["error"] = "user_id missing from request_data"
            return

        # R2.4: retain the running task so user cancel can actually stop it.
        current_task = asyncio.current_task()
        if current_task is not None:
            self.register_generation_task(session_id, current_task)

        factory = getattr(self, "background_session_factory", None)
        if factory is None:
            from services.database.sessions import get_session_for_user as factory

        task_session = None
        swapped = False
        request_session = self.db_session
        try:
            task_session = factory(user_id)
            self.db_session = task_session
            swapped = True
            await self.start_orchestrator_generation(session_id, request_data)
        except Exception as exc:
            logger.error(f"❌ Generation task failed for session {session_id}: {exc}")
            if session_info is not None:
                session_info["status"] = "failed"
                session_info["error"] = str(exc)
        finally:
            if swapped:
                self.db_session = request_session
            if task_session is not None:
                try:
                    task_session.close()
                except Exception:
                    pass
            # R2.4: the task no longer runs — drop its registry entry (even
            # after a user-initiated cancel popped it, this is idempotent).
            self.unregister_generation_task(session_id)

    async def start_orchestrator_generation(
        self,
        session_id: str,
        request_data: Dict[str, Any],
        *,
        persist_completed: bool = True,
    ) -> None:
        """Start the 12-step calendar generation process.

        ``persist_completed`` (R1.1): when True — the user-facing ``/start``
        flow — a completed generation is persisted through
        ``_save_calendar_to_db`` (CalendarEvent rows + the post-commit SIF
        dispatch), so the async flow is not a persistence dead-end. The
        legacy sync path passes False: it persists the calendar itself after
        injecting ``processing_time``, and must not save twice.
        """
        try:
            if not self.orchestrator:
                logger.error("❌ Orchestrator not initialized")
                return
            
            session = self.orchestrator_sessions.get(session_id)
            if not session:
                logger.error(f"❌ Session {session_id} not found")
                return

            # R2.4: never run work on a terminal session — a cancelled session
            # must not be (re)started into `running` by a re-entry call.
            if session.get("status") in TERMINAL_STATUSES:
                logger.warning(
                    f"🚫 Session {session_id} is terminal "
                    f"({session.get('status')}) — refusing to start generation"
                )
                return
            
            # Update session status
            session["status"] = "running"
            self._persist_session_to_db(session_id)
            
            # Start the 12-step process
            user_id = request_data.get("user_id")
            if not user_id:
                raise ValueError("user_id is required in request_data")
                
            result = await self.orchestrator.generate_calendar(
                user_id=user_id,
                strategy_id=request_data.get("strategy_id"),
                calendar_type=request_data.get("calendar_type", "monthly"),
                industry=request_data.get("industry"),
                business_size=request_data.get("business_size", "sme"),
                strategy_digest=request_data.get("strategy_digest") or {},
                progress_callback=lambda progress: self._update_session_progress(session_id, progress)
            )
            
            # Update session with final result. Only a real calendar counts as
            # completed: the orchestrator's error_handler returns an error dict
            # (status == "error") or a completed status without any calendar.
            is_real_calendar = (
                isinstance(result, dict)
                and result.get("status") == "completed"
                and (result.get("daily_schedule") or result.get("final_calendar"))
            )

            # R2.4: the user may have cancelled while the orchestrator ran.
            # Terminal `cancelled` wins over ANY late orchestrator result —
            # no completed status/result, no events, no SIF, no persist.
            if session.get("status") == "cancelled":
                logger.warning(
                    f"🚫 Session {session_id} was cancelled — ignoring late "
                    "orchestrator result"
                )
                return

            if is_real_calendar:
                session["status"] = "completed"
                session["result"] = result
                session["end_time"] = datetime.now()
                logger.info(f"✅ Orchestrator generation completed for session {session_id}")

                # R1.1 (C1): persist the completed calendar through the same
                # pipeline as the legacy sync path — CalendarEvent rows +
                # post-commit SIF dispatch. Non-fatal: a persistence failure
                # must not flip the user-visible generation to failed (the
                # in-memory result already exists); R6.2 will surface these
                # errors on /progress.
                if persist_completed:
                    try:
                        await self._save_calendar_to_db(
                            user_id,
                            request_data.get("strategy_id"),
                            result,
                            session_id,
                        )
                    except Exception as save_exc:
                        logger.error(
                            f"❌ Calendar persistence failed for session {session_id} "
                            f"(non-fatal): {save_exc}"
                        )
            else:
                error_message = (
                    result.get("error_message")
                    if isinstance(result, dict)
                    else None
                ) or "Calendar generation did not produce a valid calendar"
                logger.error(f"❌ Orchestrator generation failed for session {session_id}: {error_message}")
                session["status"] = "failed"
                session["error"] = error_message
                session["end_time"] = datetime.now()
                session.setdefault("progress", {}).setdefault("errors", []).append({
                    "message": error_message,
                    "step": None,
                    "timestamp": datetime.now().isoformat(),
                    "severity": "error",
                    "recoverable": False,
                })

            self._persist_session_to_db(session_id)
            
        except Exception as e:
            logger.error(f"❌ Orchestrator generation failed for session {session_id}: {e}")
            if session_id in self.orchestrator_sessions:
                self.orchestrator_sessions[session_id]["status"] = "failed"
                self.orchestrator_sessions[session_id]["error"] = str(e)
                self._persist_session_to_db(session_id)
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for calendar generation services."""
        try:
            logger.info("🏥 Performing calendar generation health check")
            
            # Check AI services
            from services.onboarding.api_key_manager import APIKeyManager
            api_manager = APIKeyManager()
            api_key_status = check_all_api_keys(api_manager)
            
            # Check orchestrator status
            orchestrator_status = "healthy" if self.orchestrator else "unhealthy"
            
            # Check database connectivity
            db_status = "healthy"
            try:
                # Test database connection - just check if db_session is available
                if self.db_session:
                    # Simple connectivity test without hardcoded user_id
                    from services.content_planning_db import ContentPlanningDBService
                    db_service = ContentPlanningDBService(self.db_session)
                    # Don't test with a specific user_id - just verify service initializes
                    db_status = "healthy"
                else:
                    db_status = "no session"
            except Exception as e:
                db_status = f"error: {str(e)}"
            
            health_status = {
                "service": "calendar_generation",
                "status": "healthy" if api_key_status.get("all_valid", False) and db_status == "healthy" and orchestrator_status == "healthy" else "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "components": {
                    "ai_services": "healthy" if api_key_status.get("all_valid", False) else "unhealthy",
                    "database": db_status,
                    "orchestrator": orchestrator_status
                },
                "api_keys": api_key_status
            }
            
            logger.info("✅ Calendar generation health check completed")
            return health_status
            
        except Exception as e:
            logger.error(f"❌ Calendar generation health check failed: {str(e)}")
            return {
                "service": "calendar_generation",
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }

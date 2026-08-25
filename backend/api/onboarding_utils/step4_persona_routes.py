"""
Step 4 Persona Generation Routes
Handles AI writing persona generation using the sophisticated persona system.
"""

import asyncio
from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from loguru import logger
import os

# Rate limiting configuration
RATE_LIMIT_DELAY_SECONDS = 2.0  # Delay between API calls to prevent quota exhaustion

# Task management for long-running persona generation
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from services.persona.core_persona.core_persona_service import CorePersonaService
from services.persona.enhanced_linguistic_analyzer import get_linguistic_analyzer
from services.persona.persona_quality_improver import PersonaQualityImprover
from services.persona.platform_registry import get_enabled_platforms, get_platforms_payload
from services.persona_data_service import PersonaDataService
from middleware.auth_middleware import get_current_user
from services.user_api_key_context import user_api_keys
from services.database import get_session_for_user
from services.intelligence.agent_flat_context import AgentFlatContextStore
from models.onboarding import OnboardingSession, PersonaData
from models.persona_task_models import PersonaGenerationTask


def _get_session_or_404(db: Session, user_id: str) -> OnboardingSession:
    """Get the onboarding session for a user, or raise 404."""
    session = db.query(OnboardingSession).filter(
        OnboardingSession.user_id == user_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")
    return session


def _load_persona_data(db: Session, user_id: str) -> Optional[Dict[str, Any]]:
    """Load the user's persisted persona from the DB.

    This is the durable SSOT store (``PersonaData``), NOT a TTL cache. Once a
    persona is generated it stays until the user explicitly regenerates or edits
    it — cache / localStorage / TTL are client-side optimizations layered on top,
    never a reason to drop the persisted persona.
    """
    session = db.query(OnboardingSession).filter(
        OnboardingSession.user_id == user_id
    ).first()
    if not session or not session.persona_data:
        return None
    pd = session.persona_data
    return {
        "success": True,
        "core_persona": pd.core_persona,
        "platform_personas": pd.platform_personas,
        "quality_metrics": pd.quality_metrics,
        "selected_platforms": pd.selected_platforms,
        "timestamp": pd.updated_at.isoformat() if pd.updated_at else None,
    }


def _save_persona_data(db: Session, user_id: str, data: Dict[str, Any]) -> None:
    """Upsert persona data for a user."""
    session = _get_session_or_404(db, user_id)
    if session.persona_data:
        pd = session.persona_data
    else:
        pd = PersonaData(session_id=session.id)
        db.add(pd)
    pd.core_persona = data.get("core_persona")
    pd.platform_personas = data.get("platform_personas", {})
    pd.quality_metrics = data.get("quality_metrics", {})
    pd.selected_platforms = data.get("selected_platforms", [])
    db.commit()

    # Rebuild the Brand Brain (canonical_profile) so it picks up the freshly
    # saved persona. This is the single choke point covering persona-save,
    # generate-personas, and async generation (none of which run through
    # complete_step). Best-effort: a refresh failure never fails the save.
    try:
        from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
        OnboardingDataIntegrationService().refresh_integrated_data_sync(user_id, db)
    except Exception as refresh_err:
        logger.warning(f"Could not refresh Brand Brain after persona save for {user_id}: {refresh_err}")


# ---------------------------------------------------------------------------
# Durable task store (DB-backed, replaces the transient in-memory dict)
# ---------------------------------------------------------------------------
# The async persona generation flow keeps its task state in the user's DB so
# a completed/failed result survives a process restart. Each write opens a
# short-lived session scoped to the owning user's database.
PERSONA_TASK_STALE_MINUTES = 10


def _task_row_to_dict(task: PersonaGenerationTask) -> Dict[str, Any]:
    return {
        "task_id": task.task_id,
        "status": task.status,
        "progress": task.progress or 0,
        "current_step": task.current_step or "",
        "progress_messages": task.progress_messages or [],
        "result": task.result,
        "error": task.error,
        "created_at": task.created_at.isoformat() if task.created_at else "",
        "updated_at": task.updated_at.isoformat() if task.updated_at else "",
    }


def _create_persona_task(
    user_id: str,
    task_id: str,
    status: str,
    progress: int,
    current_step: str,
    progress_messages: List[Dict[str, Any]],
    result: Optional[Dict[str, Any]],
    error: Optional[str],
) -> None:
    db = get_session_for_user(user_id)
    if not db:
        return
    try:

        db.add(PersonaGenerationTask(
            task_id=task_id,
            user_id=user_id,
            status=status,
            progress=progress,
            current_step=current_step,
            progress_messages=progress_messages,
            result=result,
            error=error,
        ))
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create persona task {task_id}: {e}")
        db.rollback()
    finally:
        db.close()


def _update_persona_task(
    user_id: str,
    task_id: str,
    status: str,
    progress: int,
    current_step: str,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
) -> None:
    db = get_session_for_user(user_id)
    if not db:
        return
    try:

        task = db.query(PersonaGenerationTask).filter(
            PersonaGenerationTask.task_id == task_id,
            PersonaGenerationTask.user_id == user_id,
        ).first()
        if not task:
            return
        task.status = status
        task.progress = progress
        task.current_step = current_step
        task.updated_at = datetime.utcnow()
        if result is not None:
            task.result = result
        if error is not None:
            task.error = error
        messages = list(task.progress_messages or [])
        messages.append({
            "timestamp": datetime.utcnow().isoformat(),
            "message": current_step,
            "progress": progress,
        })
        task.progress_messages = messages
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to update persona task {task_id}: {e}")
        db.rollback()
    finally:
        db.close()


def _get_persona_task(user_id: str, task_id: str) -> Optional[Dict[str, Any]]:
    db = get_session_for_user(user_id)
    if not db:
        return None
    try:

        task = db.query(PersonaGenerationTask).filter(
            PersonaGenerationTask.task_id == task_id,
            PersonaGenerationTask.user_id == user_id,
        ).first()
        if not task:
            return None
        return _task_row_to_dict(task)
    finally:
        db.close()


router = APIRouter()

# Initialize services
core_persona_service = CorePersonaService()
linguistic_analyzer = get_linguistic_analyzer()
quality_improver = PersonaQualityImprover(linguistic_analyzer)


def _extract_user_id(user: Dict[str, Any]) -> str:
    """Extract a stable user ID from Clerk-authenticated user payloads.
    Prefers 'clerk_user_id' or 'id', falls back to 'user_id', else 'unknown'.
    """
    if not isinstance(user, dict):
        return 'unknown'
    return (
        user.get('clerk_user_id')
        or user.get('id')
        or user.get('user_id')
        or 'unknown'
    )

class PersonaGenerationRequest(BaseModel):
    """Request model for persona generation."""
    onboarding_data: Dict[str, Any]
    selected_platforms: List[str] = ["linkedin", "blog"]
    user_preferences: Optional[Dict[str, Any]] = None
    force: bool = False

class PersonaGenerationResponse(BaseModel):
    """Response model for persona generation."""
    success: bool
    core_persona: Optional[Dict[str, Any]] = None
    platform_personas: Optional[Dict[str, Any]] = None
    quality_metrics: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class PersonaQualityRequest(BaseModel):
    """Request model for persona quality assessment."""
    core_persona: Dict[str, Any]
    platform_personas: Dict[str, Any]
    user_feedback: Optional[Dict[str, Any]] = None

class PersonaQualityResponse(BaseModel):
    """Response model for persona quality assessment."""
    success: bool
    quality_metrics: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[str]] = None
    error: Optional[str] = None

class PersonaTaskStatus(BaseModel):
    """Response model for persona generation task status."""
    task_id: str
    status: str  # 'pending', 'running', 'completed', 'failed'
    progress: int  # 0-100
    current_step: str
    progress_messages: List[Dict[str, Any]] = []
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str

@router.post("/step4/generate-personas-async", response_model=Dict[str, str])
async def generate_writing_personas_async(
    request: Union[PersonaGenerationRequest, Dict[str, Any]],
    current_user: Dict[str, Any] = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Start persona generation as an async task and return task ID for polling.
    """
    user_id = _extract_user_id(current_user)
    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=503, detail="Could not connect to database")
    try:
        # Handle both PersonaGenerationRequest and dict inputs
        if isinstance(request, dict):
            persona_request = PersonaGenerationRequest(**request)
        else:
            persona_request = request
            
        # If fresh cache exists for this user, short-circuit and return a completed task
        # (unless the caller explicitly requested a forced regeneration).
        cached = _load_persona_data(db, user_id)
        if cached and not persona_request.force:
            task_id = str(uuid.uuid4())
            _create_persona_task(
                user_id=user_id,
                task_id=task_id,
                status="completed",
                progress=100,
                current_step="Persona loaded from cache",
                progress_messages=[
                    {"timestamp": datetime.now().isoformat(), "message": "Loaded cached persona", "progress": 100}
                ],
                result={
                    "success": True,
                    "core_persona": cached.get("core_persona"),
                    "platform_personas": cached.get("platform_personas", {}),
                    "quality_metrics": cached.get("quality_metrics", {}),
                },
                error=None,
            )
            logger.info(f"Cache hit for user {user_id} - returning completed task without regeneration: {task_id}")
            return {
                "task_id": task_id,
                "status": "completed",
                "message": "Persona loaded from cache"
            }

        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        _create_persona_task(
            user_id=user_id,
            task_id=task_id,
            status="pending",
            progress=0,
            current_step="Initializing persona generation...",
            progress_messages=[],
            result=None,
            error=None,
        )
        
        # Start background task
        background_tasks.add_task(
            execute_persona_generation_task, 
            task_id, 
            persona_request, 
            current_user
        )
        
        logger.info(f"Started async persona generation task: {task_id}")
        logger.info(f"Background task added successfully for task: {task_id}")
        
        # Test: Add a simple background task to verify background task execution
        def test_simple_task():
            logger.info(f"TEST: Simple background task executed for {task_id}")
        
        background_tasks.add_task(test_simple_task)
        logger.info(f"TEST: Simple background task added for {task_id}")
        
        return {
            "task_id": task_id,
            "status": "pending",
            "message": "Persona generation started. Use task_id to poll for progress."
        }
        
    except Exception as e:
        logger.error(f"Failed to start persona generation task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start task: {str(e)}")
    finally:
        db.close()

@router.get("/step4/persona-latest", response_model=Dict[str, Any])
async def get_latest_persona(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return latest cached persona for the current user if available and fresh."""
    user_id = _extract_user_id(current_user)
    db = get_session_for_user(user_id)
    if not db:
        return {"success": False, "persona": None, "message": "Could not connect to database", "status_code": 503}
    try:
        cached = _load_persona_data(db, user_id)
        if not cached:
            return {"success": False, "persona": None, "message": "No cached persona found", "status_code": 404}
        return {"success": True, "persona": cached}
    except Exception as e:
        logger.error(f"Error getting latest persona: {e}", exc_info=True)
        return {"success": False, "persona": None, "message": f"Internal error retrieving persona: {str(e)}", "status_code": 500}
    finally:
        db.close()

@router.post("/step4/persona-save", response_model=Dict[str, Any])
async def save_persona_update(
    request: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Save/overwrite latest persona data for current user (from edited UI)."""
    user_id = _extract_user_id(current_user)
    db = get_session_for_user(user_id)
    if not db:
        return {"success": False, "message": "Could not connect to database", "status_code": 503}
    try:
        payload = {
            "core_persona": request.get("core_persona"),
            "platform_personas": request.get("platform_personas", {}),
            "quality_metrics": request.get("quality_metrics", {}),
            "selected_platforms": request.get("selected_platforms", []),
        }
        _save_persona_data(db, user_id, payload)
        
        # Persist to flat-file context for agent access
        try:
            flat_store = AgentFlatContextStore(user_id)
            canonical_payload = {
                "core_persona": payload.get("core_persona") or {},
                "platform_personas": payload.get("platform_personas") or {},
                "quality_metrics": payload.get("quality_metrics") or {},
                "selected_platforms": payload.get("selected_platforms", []),
                "saved_at": datetime.now().isoformat(),
                "source_payload": request,
            }
            flat_store.save_step4_persona_data(canonical_payload, source="onboarding_step4")
        except Exception as flat_err:
            logger.warning(f"Failed to persist step 4 flat context for user {user_id}: {flat_err}")
        
        logger.info(f"Saved latest persona data for user {user_id}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error saving persona: {e}", exc_info=True)
        return {"success": False, "message": f"Failed to save persona: {str(e)}", "status_code": 500}
    finally:
        db.close()

@router.get("/step4/persona-task/{task_id}", response_model=PersonaTaskStatus)
async def get_persona_task_status(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get the status of a persona generation task.
    """
    user_id = _extract_user_id(current_user)
    task = _get_persona_task(user_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Recover from orphaned in-flight tasks (e.g. the server restarted
    # mid-generation). Mark them failed so the frontend can offer a retry.
    if task["status"] in ("pending", "running") and task["updated_at"]:
        try:
            updated = datetime.fromisoformat(task["updated_at"])
            if datetime.utcnow() - updated > timedelta(minutes=PERSONA_TASK_STALE_MINUTES):
                _update_persona_task(
                    user_id, task_id, "failed", task["progress"],
                    "Generation interrupted (server restarted or timed out). Please regenerate.",
                    error="interrupted",
                )
                task = _get_persona_task(user_id, task_id) or task
        except Exception as e:
            logger.warning(f"Could not reconcile stale persona task {task_id}: {e}")

    return PersonaTaskStatus(**task)

@router.post("/step4/generate-personas", response_model=PersonaGenerationResponse)
async def generate_writing_personas(
    request: Union[PersonaGenerationRequest, Dict[str, Any]],
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Generate AI writing personas using the sophisticated persona system with optimized parallel execution.
    """
    user_id = _extract_user_id(current_user)
    db = get_session_for_user(user_id)
    if not db:
        return PersonaGenerationResponse(success=False, error="Could not connect to database")
    try:
        logger.info(f"Starting OPTIMIZED persona generation for user: {current_user.get('user_id', 'unknown')}")
        
        if isinstance(request, dict):
            persona_request = PersonaGenerationRequest(**request)
        else:
            persona_request = request
        
        # Ensure session_info.user_id is set so the LLM gateway can do subscription/usage checks
        if user_id:
            persona_request.onboarding_data.setdefault("session_info", {})
            if not persona_request.onboarding_data["session_info"].get("user_id"):
                persona_request.onboarding_data["session_info"]["user_id"] = user_id
            
        logger.info(f"Selected platforms: {persona_request.selected_platforms}")
        
        # Step 1: Generate core persona (1 API call)
        logger.info("Step 1: Generating core persona...")
        core_persona = await asyncio.get_event_loop().run_in_executor(
            None, core_persona_service.generate_core_persona, persona_request.onboarding_data
        )
        
        await asyncio.sleep(1.0)
        
        if "error" in core_persona:
            logger.error(f"Core persona generation failed: {core_persona['error']}")
            return PersonaGenerationResponse(success=False, error=f"Core persona generation failed: {core_persona['error']}")
        
        # Step 2: Generate platform adaptations with rate limiting
        logger.info(f"Step 2: Generating platform adaptations with rate limiting for: {persona_request.selected_platforms}")
        platform_personas = {}
        
        for i, platform in enumerate(persona_request.selected_platforms):
            try:
                logger.info(f"Generating {platform} persona ({i+1}/{len(persona_request.selected_platforms)})")
                
                if i > 0:
                    logger.info(f"Rate limiting: Waiting {RATE_LIMIT_DELAY_SECONDS}s before next API call...")
                    await asyncio.sleep(RATE_LIMIT_DELAY_SECONDS)
                
                result = await generate_single_platform_persona_async(
                    core_persona, platform, persona_request.onboarding_data
                )
                
                if isinstance(result, Exception):
                    error_msg = str(result)
                    logger.error(f"Platform {platform} generation failed: {error_msg}")
                    platform_personas[platform] = {"error": error_msg}
                elif "error" in result:
                    error_msg = result['error']
                    logger.error(f"Platform {platform} generation failed: {error_msg}")
                    platform_personas[platform] = result
                    
                    if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                        logger.warning(f"Rate limit detected for {platform}. Consider increasing RATE_LIMIT_DELAY_SECONDS")
                else:
                    platform_personas[platform] = result
                    logger.info(f"Platform {platform} persona generated successfully")
                    
            except Exception as e:
                logger.error(f"Platform {platform} generation error: {str(e)}")
                platform_personas[platform] = {"error": str(e)}
        
        # Step 3: Assess quality
        logger.info("Step 3: Assessing persona quality...")
        quality_metrics = await assess_persona_quality_internal(
            core_persona, platform_personas, persona_request.user_preferences
        )
        
        total_platforms = len(persona_request.selected_platforms)
        successful_platforms = len([p for p in platform_personas.values() if "error" not in p])
        logger.info(f"Persona generation completed: {successful_platforms}/{total_platforms} platforms successful")
        logger.info(f"API calls made: 1 (core) + {total_platforms} (platforms) = {1 + total_platforms} total")
        
        # Persist generated persona data to DB
        try:
            _save_persona_data(db, user_id, {
                "core_persona": core_persona,
                "platform_personas": platform_personas,
                "quality_metrics": quality_metrics,
                "selected_platforms": persona_request.selected_platforms,
            })
            logger.info(f"Persisted sync-generated persona data for user {user_id}")
        except Exception as persist_err:
            logger.warning(f"Could not persist sync-generated persona: {persist_err}")

        return PersonaGenerationResponse(
            success=True,
            core_persona=core_persona,
            platform_personas=platform_personas,
            quality_metrics=quality_metrics
        )
        
    except Exception as e:
        logger.error(f"Persona generation error: {str(e)}")
        return PersonaGenerationResponse(success=False, error=f"Persona generation failed: {str(e)}")
    finally:
        db.close()

@router.post("/step4/assess-quality", response_model=PersonaQualityResponse)
async def assess_persona_quality(
    request: Union[PersonaQualityRequest, Dict[str, Any]],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Assess the quality of generated personas and provide improvement recommendations.
    """
    try:
        logger.info(f"Assessing persona quality for user: {current_user.get('user_id', 'unknown')}")
        
        # Handle both PersonaQualityRequest and dict inputs
        if isinstance(request, dict):
            # Convert dict to PersonaQualityRequest
            quality_request = PersonaQualityRequest(**request)
        else:
            quality_request = request
        
        quality_metrics = await assess_persona_quality_internal(
            quality_request.core_persona,
            quality_request.platform_personas,
            quality_request.user_feedback
        )
        
        return PersonaQualityResponse(
            success=True,
            quality_metrics=quality_metrics,
            recommendations=quality_metrics.get('recommendations', [])
        )
        
    except Exception as e:
        logger.error(f"Quality assessment error: {str(e)}")
        return PersonaQualityResponse(
            success=False,
            error=f"Quality assessment failed: {str(e)}"
        )

@router.post("/step4/regenerate-persona")
async def regenerate_persona(
    request: Union[PersonaGenerationRequest, Dict[str, Any]],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Regenerate persona with different parameters or improved analysis.
    """
    try:
        logger.info(f"Regenerating persona for user: {current_user.get('user_id', 'unknown')}")
        
        # Use the same generation logic but with potentially different parameters
        return await generate_writing_personas(request, current_user)
        
    except Exception as e:
        logger.error(f"Persona regeneration error: {str(e)}")
        return PersonaGenerationResponse(
            success=False,
            error=f"Persona regeneration failed: {str(e)}"
        )

@router.post("/step4/test-background-task")
async def test_background_task(
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Test endpoint to verify background task execution."""
    def simple_background_task():
        logger.info("BACKGROUND TASK EXECUTED SUCCESSFULLY!")
        return "Task completed"
    
    background_tasks.add_task(simple_background_task)
    logger.info("Background task added to queue")
    
    return {"message": "Background task added", "status": "success"}

@router.get("/step4/persona-options")
async def get_persona_generation_options(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get available options for persona generation (platforms, preferences, etc.).
    """
    try:
        return {
            "success": True,
            "available_platforms": [
                {"id": p["id"], "name": p["name"], "description": p["description"]}
                for p in get_enabled_platforms()
            ],
            "persona_types": [
                "Thought Leader",
                "Industry Expert", 
                "Content Creator",
                "Brand Ambassador",
                "Community Builder"
            ],
            "quality_metrics": [
                "Style Consistency",
                "Brand Alignment", 
                "Platform Optimization",
                "Engagement Potential",
                "Content Quality"
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting persona options: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get persona options: {str(e)}")

@router.get("/step4/persona-platforms", response_model=Dict[str, Any])
async def get_persona_platforms(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return the canonical persona platform list (single source of truth)."""
    return {"success": True, "platforms": get_platforms_payload()}

class PlatformPersonaRequest(BaseModel):
    """Request body for /step4/generate-platform-persona."""
    platform: str


@router.post("/step4/generate-platform-persona", response_model=Dict[str, Any])
async def generate_platform_persona(
    request: PlatformPersonaRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Generate a single platform persona on demand (blocking, synchronous).

    Used by the "Generate Now" button on platform tabs that haven't been
    generated yet. Reuses the same generation path as the async flow, then
    persists via PersonaDataService (the same path the Facebook scheduler uses).
    """
    user_id = _extract_user_id(current_user)
    platform = (request.platform or "").strip().lower()

    # Validate against the registry (enabled platforms only).
    enabled_ids = {p["id"] for p in get_enabled_platforms()}
    if platform not in enabled_ids:
        return {
            "success": False,
            "message": f"Unsupported or disabled platform: {platform}",
            "error": "invalid_platform",
        }

    # Core-first gate: a platform persona depends on the core persona.
    persona_data_service = PersonaDataService()
    core = persona_data_service.get_core_persona(user_id)
    if not core or not core.get("core_persona"):
        return {
            "success": False,
            "message": "Generate your core persona first, then generate platform personas.",
            "error": "missing_core_persona",
        }
    core_persona = core["core_persona"]

    # Build onboarding context from SSOT (mirrors the Facebook scheduler).
    db = get_session_for_user(user_id)
    if not db:
        return {"success": False, "message": "Could not connect to database.", "error": "db_unavailable"}
    try:
        from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
        integration_service = OnboardingDataIntegrationService()
        integrated_data = integration_service.get_integrated_data_sync(user_id, db)
        website_analysis = integrated_data.get("website_analysis", {}) if isinstance(integrated_data, dict) else {}
        research_prefs = integrated_data.get("research_preferences", {}) if isinstance(integrated_data, dict) else {}
    except Exception as e:
        logger.warning(f"Could not load integrated onboarding data for {user_id}: {e}")
        website_analysis, research_prefs = {}, {}
    finally:
        db.close()

    onboarding_data = {
        "session_info": {"user_id": user_id},
        "website_url": website_analysis.get("website_url", "") if website_analysis else "",
        "writing_style": website_analysis.get("writing_style", {}) if website_analysis else {},
        "content_characteristics": website_analysis.get("content_characteristics", {}) if website_analysis else {},
        "target_audience": website_analysis.get("target_audience", "") if website_analysis else "",
        "research_preferences": research_prefs or {},
    }

    # Generate the platform persona (blocking; runs the sync service in an executor).
    try:
        generated = await generate_single_platform_persona_async(core_persona, platform, onboarding_data)
    except Exception as e:
        logger.error(f"Failed to generate {platform} persona for {user_id}: {e}")
        return {"success": False, "message": f"Failed to generate {platform} persona: {e}", "error": "generation_failed"}

    if not generated or (isinstance(generated, dict) and generated.get("error")):
        err = generated.get("error") if isinstance(generated, dict) else "Unknown error"
        logger.error(f"{platform} persona generation returned error for {user_id}: {err}")
        return {"success": False, "message": f"Failed to generate {platform} persona: {err}", "error": "generation_failed"}

    # Persist via the same path the Facebook scheduler uses.
    saved = persona_data_service.save_platform_persona(user_id, platform, generated)
    if not saved:
        logger.warning(f"Could not persist {platform} persona for {user_id}")
    else:
        # Rebuild the Brand Brain so canonical_profile picks up the new persona.
        # Best-effort: a failed refresh never fails the persona generation.
        try:
            refresh_db = get_session_for_user(user_id)
            if refresh_db:
                try:
                    from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
                    OnboardingDataIntegrationService().refresh_integrated_data_sync(user_id, refresh_db)
                finally:
                    refresh_db.close()
        except Exception as refresh_err:
            logger.warning(f"Could not refresh Brand Brain after {platform} persona generation: {refresh_err}")

    logger.info(f"Generated + saved {platform} persona for {user_id}")
    return {"success": True, "platform": platform, "persona": generated}

async def execute_persona_generation_task(task_id: str, persona_request: PersonaGenerationRequest, current_user: Dict[str, Any]):
    """
    Execute persona generation task in background with progress updates.
    """
    user_id = _extract_user_id(current_user)
    try:
        logger.info(f"BACKGROUND TASK STARTED: {task_id}")
        logger.info(f"Task {task_id}: Background task execution initiated")
        
        # Log onboarding data summary for debugging
        onboarding_data_summary = {
            "has_websiteAnalysis": bool(persona_request.onboarding_data.get("websiteAnalysis")),
            "has_competitorResearch": bool(persona_request.onboarding_data.get("competitorResearch")),
            "has_sitemapAnalysis": bool(persona_request.onboarding_data.get("sitemapAnalysis")),
            "has_businessData": bool(persona_request.onboarding_data.get("businessData")),
            "data_keys": list(persona_request.onboarding_data.keys()) if persona_request.onboarding_data else []
        }
        logger.info(f"Task {task_id}: Onboarding data summary: {onboarding_data_summary}")
        
        # Update task status to running
        update_task_status(user_id, task_id, "running", 5, "Preparing persona workspace...")
        logger.info(f"Task {task_id}: Status updated to running")
        
        # Inject user-specific API keys into environment for the duration of this background task

        # Ensure session_info.user_id is set on onboarding_data so the LLM gateway
        # (llm_text_gen) can do subscription/usage checks for this user.
        if user_id:
            persona_request.onboarding_data.setdefault("session_info", {})
            if not persona_request.onboarding_data["session_info"].get("user_id"):
                persona_request.onboarding_data["session_info"]["user_id"] = user_id
        env_mapping = {
            'gemini': 'GEMINI_API_KEY',
            'exa': 'EXA_API_KEY',
            'openai': 'OPENAI_API_KEY',
            'anthropic': 'ANTHROPIC_API_KEY',
            'mistral': 'MISTRAL_API_KEY',
            'copilotkit': 'COPILOTKIT_API_KEY',
            'tavily': 'TAVILY_API_KEY',
            'serper': 'SERPER_API_KEY',
            'firecrawl': 'FIRECRAWL_API_KEY',
        }
        original_env: Dict[str, Optional[str]] = {}
        with user_api_keys(user_id) as keys:
            try:
                for provider, env_var in env_mapping.items():
                    value = keys.get(provider)
                    if value:
                        original_env[env_var] = os.environ.get(env_var)
                        os.environ[env_var] = value
                        logger.debug(f"[BG TASK] Injected {env_var} for user {user_id}")

                update_task_status(user_id, task_id, "running", 10, "Loading your brand context...")
                await asyncio.sleep(0.3)

                update_task_status(user_id, task_id, "running", 15, "Building AI prompt for your brand voice...")
                await asyncio.sleep(0.3)

                # Step 1: Generate core persona (1 API call)
                update_task_status(user_id, task_id, "running", 20, "Calling AI to analyze your brand voice (this may take a couple of minutes)...")
                logger.info(f"Task {task_id}: Step 1 - Generating core persona...")
                
                core_persona = await asyncio.get_event_loop().run_in_executor(
                    None, 
                    core_persona_service.generate_core_persona, 
                    persona_request.onboarding_data
                )
                
                if "error" in core_persona:
                    error_msg = core_persona['error']
                    # Check if this is a quota/rate limit error
                    if "RESOURCE_EXHAUSTED" in str(error_msg) or "429" in str(error_msg) or "quota" in str(error_msg).lower():
                        update_task_status(user_id, task_id, "failed", 0, f"Quota exhausted: {error_msg}", error=str(error_msg))
                        logger.error(f"Task {task_id}: Quota exhausted, marking as failed immediately")
                    else:
                        update_task_status(user_id, task_id, "failed", 0, f"Core persona generation failed: {error_msg}", error=str(error_msg))
                    return
                
                update_task_status(user_id, task_id, "running", 40, "✅ Core brand voice generated")
                logger.info(f"Task {task_id}: Core persona generated successfully")
                
                # Add small delay after core persona generation
                await asyncio.sleep(0.5)
                
                # Step 2: Generate platform adaptations with rate limiting (N API calls with delays)
                platform_personas = {}
                total_platforms = len(persona_request.selected_platforms)
                
                update_task_status(user_id, task_id, "running", 45, f"Adapting brand voice to {total_platforms} platform(s)...")
                
                # Process platforms sequentially with small delays to avoid rate limits
                for i, platform in enumerate(persona_request.selected_platforms):
                    try:
                        progress = 50 + (i * 40 // total_platforms)
                        update_task_status(user_id, task_id, "running", progress, f"✨ Tailoring voice for {platform} ({i+1}/{total_platforms})...")
                        
                        # Add delay between API calls to prevent rate limiting
                        if i > 0:  # Skip delay for first platform
                            update_task_status(user_id, task_id, "running", progress, f"⏳ Rate-limit pause before {platform}...")
                            await asyncio.sleep(RATE_LIMIT_DELAY_SECONDS)
                            update_task_status(user_id, task_id, "running", progress, f"✨ Tailoring voice for {platform} ({i+1}/{total_platforms})...")
                        
                        # Generate platform persona
                        result = await generate_single_platform_persona_async(
                            core_persona, 
                            platform, 
                            persona_request.onboarding_data
                        )
                        
                        if isinstance(result, Exception):
                            error_msg = str(result)
                            logger.error(f"Platform {platform} generation failed: {error_msg}")
                            platform_personas[platform] = {"error": error_msg}
                        elif "error" in result:
                            error_msg = result['error']
                            logger.error(f"Platform {platform} generation failed: {error_msg}")
                            platform_personas[platform] = result
                            
                            # Check for rate limit errors and suggest retry
                            if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                                logger.warning(f"⚠️ Rate limit detected for {platform}. Consider increasing RATE_LIMIT_DELAY_SECONDS")
                        else:
                            platform_personas[platform] = result
                            logger.info(f"✅ {platform} persona generated successfully")
                            update_task_status(user_id, task_id, "running", min(progress + 1, 90), f"✅ {platform} voice ready")
                            
                    except Exception as e:
                        logger.error(f"Platform {platform} generation error: {str(e)}")
                        platform_personas[platform] = {"error": str(e)}
                
                # Step 3: Assess quality (no additional API calls - uses existing data)
                update_task_status(user_id, task_id, "running", 92, "🧪 Assessing quality and consistency...")
                quality_metrics = await assess_persona_quality_internal(
                    core_persona,
                    platform_personas,
                    persona_request.user_preferences,
                    persona_request.onboarding_data,
                )
                
                update_task_status(user_id, task_id, "running", 97, "💾 Saving your brand voice...")
                await asyncio.sleep(0.2)
            finally:
                # Restore environment
                for env_var, original_value in original_env.items():
                    if original_value is None:
                        os.environ.pop(env_var, None)
                    else:
                        os.environ[env_var] = original_value
                logger.debug(f"[BG TASK] Restored environment for user {user_id}")
        
        # Log performance metrics
        successful_platforms = len([p for p in platform_personas.values() if "error" not in p])
        logger.info(f"✅ Persona generation completed: {successful_platforms}/{total_platforms} platforms successful")
        logger.info(f"📊 API calls made: 1 (core) + {total_platforms} (platforms) = {1 + total_platforms} total")
        logger.info(f"⏱️ Rate limiting: Sequential processing with 2s delays to prevent quota exhaustion")
        
        # Create final result
        # Phase 2: also surface the deterministic completeness score and
        # the data-sufficiency score. The frontend's EvidenceAccordion
        # blends these with the LLM's self-rated `confidence` to show the
        # user a calibrated "X% confident · Y gaps" badge.
        try:
            from services.persona.core_persona.prompt_builder import PersonaPromptBuilder
            from services.persona.core_persona.data_collector import OnboardingDataCollector

            completeness = PersonaPromptBuilder().compute_completeness(core_persona)
            data_sufficiency = OnboardingDataCollector().calculate_data_sufficiency(
                persona_request.onboarding_data or {}
            )
        except Exception as e:
            logger.warning(f"Could not compute completeness/data_sufficiency: {e}")
            completeness = {"score": None, "structural_score": None, "missing": []}
            data_sufficiency = None

        final_result = {
            "success": True,
            "core_persona": core_persona,
            "platform_personas": platform_personas,
            "quality_metrics": quality_metrics,
            "completeness": completeness,
            "data_sufficiency": data_sufficiency,
        }
        
        # Update task status to completed
        update_task_status(user_id, task_id, "completed", 100, "🎉 Your brand voice is ready!", final_result)

        # Persist persona data to DB for quick reloads
        try:
            bg_db = get_session_for_user(user_id)
            if bg_db:
                try:
                    _save_persona_data(bg_db, user_id, {
                        **final_result,
                        "selected_platforms": persona_request.selected_platforms,
                    })
                    logger.info(f"Persona data persisted for user {user_id}")
                finally:
                    bg_db.close()
        except Exception as e:
            logger.warning(f"Could not persist persona data: {e}")
        
    except Exception as e:
        logger.error(f"Persona generation task {task_id} failed: {str(e)}")
        logger.error(f"Task {task_id}: Exception details: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Task {task_id}: Full traceback: {traceback.format_exc()}")
        update_task_status(user_id, task_id, "failed", 0, f"Persona generation failed: {str(e)}")

def update_task_status(user_id: str, task_id: str, status: str, progress: int, current_step: str, result: Optional[Dict[str, Any]] = None, error: Optional[str] = None):
    """Update task status in the durable DB store."""
    _update_persona_task(user_id, task_id, status, progress, current_step, result=result, error=error)

async def generate_single_platform_persona_async(
    core_persona: Dict[str, Any],
    platform: str,
    onboarding_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Async wrapper for single platform persona generation.
    """
    try:
        return await asyncio.get_event_loop().run_in_executor(
            None,
            core_persona_service._generate_single_platform_persona,
            core_persona,
            platform,
            onboarding_data
        )
    except Exception as e:
        logger.error(f"Error generating {platform} persona: {str(e)}")
        return {"error": f"Failed to generate {platform} persona: {str(e)}"}

async def assess_persona_quality_internal(
    core_persona: Dict[str, Any],
    platform_personas: Dict[str, Any],
    user_preferences: Optional[Dict[str, Any]] = None,
    onboarding_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Internal function to assess persona quality using comprehensive metrics.

    Phase 2: if ``onboarding_data`` is provided, run the deterministic
    linguistic analyzer over the brand's own content and feed real
    numbers to ``assess_persona_quality_comprehensive``. If
    ``onboarding_data`` is None (e.g. the re-evaluate endpoint), fall
    back to the soft-mock so behavior is unchanged for callers that
    don't have crawl data.
    """
    try:
        from services.persona.persona_quality_improver import PersonaQualityImprover
        from services.persona.enhanced_linguistic_analyzer import get_linguistic_analyzer
        from services.persona.core_persona.data_collector import OnboardingDataCollector

        # Initialize quality improver
        quality_improver = PersonaQualityImprover(get_linguistic_analyzer())

        # Phase 2: prefer real analyzer output when we have onboarding data.
        # Soft-mock preserved as the fallback path so the two endpoints
        # that call this without onboarding_data (re-evaluate, status
        # refresh) keep their existing behavior byte-for-byte.
        linguistic_analysis: Any = None
        if isinstance(onboarding_data, dict) and onboarding_data:
            try:
                samples = OnboardingDataCollector().extract_text_samples_from_onboarding_data(onboarding_data)
                if samples:
                    linguistic_analysis = get_linguistic_analyzer().analyze_writing_style(samples)
                    if isinstance(linguistic_analysis, dict) and "error" in linguistic_analysis:
                        linguistic_analysis = None
            except Exception as e:
                logger.warning(
                    f"assess_persona_quality_internal: deterministic analyzer failed: {e}. "
                    f"Falling back to soft-mock."
                )
                linguistic_analysis = None

        if linguistic_analysis is None:
            # Use mock linguistic analysis if not available
            linguistic_analysis = {
                "analysis_completeness": 0.85,
                "style_consistency": 0.88,
                "vocabulary_sophistication": 0.82,
                "content_coherence": 0.87
            }
        
        # Get comprehensive quality metrics
        quality_metrics = quality_improver.assess_persona_quality_comprehensive(
            core_persona,
            platform_personas,
            linguistic_analysis,
            user_preferences
        )
        
        return quality_metrics
        
    except Exception as e:
        logger.error(f"Quality assessment internal error: {str(e)}")
        # Return fallback quality metrics compatible with PersonaQualityImprover schema
        return {
            "overall_score": 75,
            "core_completeness": 75,
            "platform_consistency": 75,
            "platform_optimization": 75,
            "linguistic_quality": 75,
            "recommendations": ["Quality assessment completed with default metrics"],
            "weights": {
                "core_completeness": 0.30,
                "platform_consistency": 0.25,
                "platform_optimization": 0.25,
                "linguistic_quality": 0.20
            },
            "error": str(e)
        }

async def _log_persona_generation_result(
    user_id: str,
    core_persona: Dict[str, Any],
    platform_personas: Dict[str, Any],
    quality_metrics: Dict[str, Any]
):
    """Background task to log persona generation results."""
    try:
        logger.info(f"Logging persona generation result for user {user_id}")
        logger.info(f"Core persona generated with {len(core_persona)} characteristics")
        logger.info(f"Platform personas generated for {len(platform_personas)} platforms")
        logger.info(f"Quality metrics: {quality_metrics.get('overall_score', 'N/A')}% overall score")
    except Exception as e:
        logger.error(f"Error logging persona generation result: {str(e)}")


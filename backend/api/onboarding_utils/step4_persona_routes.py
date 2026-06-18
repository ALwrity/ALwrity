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
from middleware.auth_middleware import get_current_user
from services.user_api_key_context import user_api_keys
from services.database import get_session_for_user
from services.intelligence.agent_flat_context import AgentFlatContextStore
from models.onboarding import OnboardingSession, PersonaData
from models.content_asset_models import ContentAsset, AssetType, AssetSource
from sqlalchemy import desc
from services.llm_providers.main_audio_generation import generate_audio

# In-memory task storage (transient — running tasks can't survive restart)
persona_tasks: Dict[str, Dict[str, Any]] = {}

PERSONA_CACHE_TTL_HOURS = 24


def _get_session_or_404(db: Session, user_id: str) -> OnboardingSession:
    """Get the onboarding session for a user, or raise 404."""
    session = db.query(OnboardingSession).filter(
        OnboardingSession.user_id == user_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")
    return session


def _load_persona_data(db: Session, user_id: str) -> Optional[Dict[str, Any]]:
    """Load cached persona from DB. Returns None if missing or stale."""
    session = db.query(OnboardingSession).filter(
        OnboardingSession.user_id == user_id
    ).first()
    if not session or not session.persona_data:
        return None
    pd = session.persona_data
    if pd.updated_at and (datetime.now() - pd.updated_at) > timedelta(hours=PERSONA_CACHE_TTL_HOURS):
        db.delete(pd)
        db.commit()
        return None
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
        cached = _load_persona_data(db, user_id)
        if cached:
            task_id = str(uuid.uuid4())
            persona_tasks[task_id] = {
                "task_id": task_id,
                "status": "completed",
                "progress": 100,
                "current_step": "Persona loaded from cache",
                "progress_messages": [
                    {"timestamp": datetime.now().isoformat(), "message": "Loaded cached persona", "progress": 100}
                ],
                "result": {
                    "success": True,
                    "core_persona": cached.get("core_persona"),
                    "platform_personas": cached.get("platform_personas", {}),
                    "quality_metrics": cached.get("quality_metrics", {}),
                },
                "error": None,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "user_id": user_id,
                "request_data": (PersonaGenerationRequest(**(request if isinstance(request, dict) else request.dict())).dict()) if request else {}
            }
            logger.info(f"Cache hit for user {user_id} - returning completed task without regeneration: {task_id}")
            return {
                "task_id": task_id,
                "status": "completed",
                "message": "Persona loaded from cache"
            }

        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        persona_tasks[task_id] = {
            "task_id": task_id,
            "status": "pending",
            "progress": 0,
            "current_step": "Initializing persona generation...",
            "progress_messages": [],
            "result": None,
            "error": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "user_id": user_id,
            "request_data": persona_request.dict()
        }
        
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
async def get_persona_task_status(task_id: str):
    """
    Get the status of a persona generation task.
    """
    if task_id not in persona_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = persona_tasks[task_id]
    
    # Clean up old tasks (older than 1 hour)
    if datetime.now() - datetime.fromisoformat(task["created_at"]) > timedelta(hours=1):
        del persona_tasks[task_id]
        raise HTTPException(status_code=404, detail="Task expired")
    
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
                {"id": "linkedin", "name": "LinkedIn", "description": "Professional networking and thought leadership"},
                {"id": "facebook", "name": "Facebook", "description": "Social media and community building"},
                {"id": "twitter", "name": "Twitter", "description": "Micro-blogging and real-time updates"},
                {"id": "blog", "name": "Blog", "description": "Long-form content and SEO optimization"},
                {"id": "instagram", "name": "Instagram", "description": "Visual storytelling and engagement"},
                {"id": "medium", "name": "Medium", "description": "Publishing platform and audience building"},
                {"id": "substack", "name": "Substack", "description": "Newsletter and subscription content"}
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

async def execute_persona_generation_task(task_id: str, persona_request: PersonaGenerationRequest, current_user: Dict[str, Any]):
    """
    Execute persona generation task in background with progress updates.
    """
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
        update_task_status(task_id, "running", 5, "Preparing persona workspace...")
        logger.info(f"Task {task_id}: Status updated to running")
        
        # Inject user-specific API keys into environment for the duration of this background task
        user_id = _extract_user_id(current_user)
        
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

                update_task_status(task_id, "running", 10, "Loading your brand context...")
                await asyncio.sleep(0.3)

                update_task_status(task_id, "running", 15, "Building AI prompt for your brand voice...")
                await asyncio.sleep(0.3)

                # Step 1: Generate core persona (1 API call)
                update_task_status(task_id, "running", 20, "Calling AI to analyze your brand voice (this may take up to 30s)...")
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
                        update_task_status(task_id, "failed", 0, f"Quota exhausted: {error_msg}", error=str(error_msg))
                        logger.error(f"Task {task_id}: Quota exhausted, marking as failed immediately")
                    else:
                        update_task_status(task_id, "failed", 0, f"Core persona generation failed: {error_msg}", error=str(error_msg))
                    return
                
                update_task_status(task_id, "running", 40, "✅ Core brand voice generated")
                logger.info(f"Task {task_id}: Core persona generated successfully")
                
                # Add small delay after core persona generation
                await asyncio.sleep(0.5)
                
                # Step 2: Generate platform adaptations with rate limiting (N API calls with delays)
                platform_personas = {}
                total_platforms = len(persona_request.selected_platforms)
                
                update_task_status(task_id, "running", 45, f"Adapting brand voice to {total_platforms} platform(s)...")
                
                # Process platforms sequentially with small delays to avoid rate limits
                for i, platform in enumerate(persona_request.selected_platforms):
                    try:
                        progress = 50 + (i * 40 // total_platforms)
                        update_task_status(task_id, "running", progress, f"✨ Tailoring voice for {platform} ({i+1}/{total_platforms})...")
                        
                        # Add delay between API calls to prevent rate limiting
                        if i > 0:  # Skip delay for first platform
                            update_task_status(task_id, "running", progress, f"⏳ Rate-limit pause before {platform}...")
                            await asyncio.sleep(RATE_LIMIT_DELAY_SECONDS)
                            update_task_status(task_id, "running", progress, f"✨ Tailoring voice for {platform} ({i+1}/{total_platforms})...")
                        
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
                            update_task_status(task_id, "running", min(progress + 1, 90), f"✅ {platform} voice ready")
                            
                    except Exception as e:
                        logger.error(f"Platform {platform} generation error: {str(e)}")
                        platform_personas[platform] = {"error": str(e)}
                
                # Step 3: Assess quality (no additional API calls - uses existing data)
                update_task_status(task_id, "running", 92, "🧪 Assessing quality and consistency...")
                quality_metrics = await assess_persona_quality_internal(
                    core_persona, 
                    platform_personas,
                    persona_request.user_preferences
                )
                
                update_task_status(task_id, "running", 97, "💾 Saving your brand voice...")
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
        final_result = {
            "success": True,
            "core_persona": core_persona,
            "platform_personas": platform_personas,
            "quality_metrics": quality_metrics
        }
        
        # Update task status to completed
        update_task_status(task_id, "completed", 100, "🎉 Your brand voice is ready!", final_result)

        # Persist persona data to DB for quick reloads
        try:
            user_id = _extract_user_id(current_user)
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
        update_task_status(task_id, "failed", 0, f"Persona generation failed: {str(e)}")

def update_task_status(task_id: str, status: str, progress: int, current_step: str, result: Optional[Dict[str, Any]] = None, error: Optional[str] = None):
    """Update task status in memory storage."""
    if task_id in persona_tasks:
        persona_tasks[task_id].update({
            "status": status,
            "progress": progress,
            "current_step": current_step,
            "updated_at": datetime.now().isoformat(),
            "result": result,
            "error": error
        })
        
        # Add progress message
        persona_tasks[task_id]["progress_messages"].append({
            "timestamp": datetime.now().isoformat(),
            "message": current_step,
            "progress": progress
        })

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
    user_preferences: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Internal function to assess persona quality using comprehensive metrics.
    """
    try:
        from services.persona.persona_quality_improver import PersonaQualityImprover
        from services.persona.enhanced_linguistic_analyzer import get_linguistic_analyzer
        
        # Initialize quality improver
        quality_improver = PersonaQualityImprover(get_linguistic_analyzer())
        
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


# ---------------------------------------------------------------------------
# Test Drive endpoints (Phase 4.1)
# Allows users to test their brand voice/avatar/voice-clone with new prompts
# in the "Test with your data" modal. Reuses existing providers.
# ---------------------------------------------------------------------------

class TestTextRequest(BaseModel):
    """Request body for /step4/test-text — side-by-side text generation."""
    prompt: str
    persona: Dict[str, Any] = {}
    platform: Optional[str] = "blog"


class TestVoiceRequest(BaseModel):
    """Request body for /step4/test-voice — synthesize new text with stored voice clone."""
    text: str


class TestImageRequest(BaseModel):
    """Request body for /step4/test-image — platform-tuned avatar variation."""
    platform: str
    prompt_override: Optional[str] = None


@router.post("/step4/test-voice", response_model=Dict[str, Any])
async def test_voice_with_clone(
    request: TestVoiceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Synthesize user-provided text using their stored voice clone.

    Looks up the user's most recent voice_clone asset and reuses its
    `custom_voice_id` + `engine` to call the existing `generate_audio`
    provider. Returns the synthesized audio as a URL the browser can
    play (or as base64 if the provider returned inline data).
    """
    try:
        user_id = _extract_user_id(current_user)
        text = (request.text or "").strip()

        if not text:
            return {"success": False, "message": "Please type some text to read.", "error": "empty_text"}
        if len(text) > 500:
            return {
                "success": False,
                "message": "Text is too long. Please keep it under 500 characters for the test drive.",
                "error": "text_too_long",
            }

        # Look up the user's latest voice clone asset
        db = get_session_for_user(user_id)
        if not db:
            return {"success": False, "message": "Could not connect to database.", "error": "db_unavailable"}

        try:
            asset = (
                db.query(ContentAsset)
                .filter(
                    ContentAsset.user_id == user_id,
                    ContentAsset.asset_type == AssetType.AUDIO,
                    ContentAsset.source_module == AssetSource.VOICE_CLONER,
                )
                .order_by(desc(ContentAsset.created_at))
                .first()
            )

            if not asset:
                return {
                    "success": False,
                    "message": "No voice clone found. Generate a voice clone first.",
                    "error": "no_voice_clone",
                }

            meta = asset.asset_metadata or {}
            custom_voice_id = meta.get("custom_voice_id")
            engine = meta.get("engine") or "qwen3"

            if not custom_voice_id:
                return {
                    "success": False,
                    "message": "Your voice clone is missing a reusable voice ID. Please re-create the voice clone.",
                    "error": "missing_voice_id",
                }
        finally:
            db.close()

        # Synthesize new audio with the stored voice id + new text.
        # generate_audio handles subscription/usage checks internally.
        logger.info(
            f"[test-voice] Synthesizing with voice_id={custom_voice_id} engine={engine} text_len={len(text)} user={user_id}"
        )
        result = generate_audio(
            text=text,
            custom_voice_id=custom_voice_id,
            model="speech-02-hd" if engine == "minimax" else "alwrity-ai/qwen3-tts",
            user_id=user_id,
        )

        # The provider returns either a URL or raw bytes depending on the engine.
        audio_url: Optional[str] = None
        audio_base64: Optional[str] = None
        audio_format: Optional[str] = None

        if isinstance(result, dict):
            audio_url = (
                result.get("audio_url")
                or result.get("url")
                or result.get("preview_audio_url")
            )
            audio_base64 = result.get("audio_base64")
            audio_format = result.get("format")
        elif isinstance(result, (bytes, bytearray)):
            import base64
            audio_base64 = base64.b64encode(bytes(result)).decode("ascii")
            audio_format = "audio/mpeg"

        if not audio_url and not audio_base64:
            return {
                "success": False,
                "message": "Voice synthesis completed but no audio was returned. Please try again.",
                "error": "empty_audio",
            }

        return {
            "success": True,
            "audio_url": audio_url,
            "audio_base64": audio_base64,
            "format": audio_format,
            "engine": engine,
            "voice_id": custom_voice_id,
        }

    except HTTPException:
        raise
    except RuntimeError as re:
        # Subscription limit or similar surfaced as 429 by the provider
        msg = str(re)
        logger.warning(f"[test-voice] runtime error: {msg}")
        return {"success": False, "message": msg, "error": "runtime_error"}
    except Exception as e:
        logger.error(f"[test-voice] Error: {e}", exc_info=True)
        return {
            "success": False,
            "message": "We hit a snag while synthesizing the audio. Please try again.",
            "error": "internal_error",
        }

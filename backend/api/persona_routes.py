"""
FastAPI routes for persona management.
Integrates persona generation and management into the main API.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from middleware.auth_middleware import get_current_user
from services.database import get_db

from api.persona import (
    get_user_personas,
    get_persona_details,
    get_platform_persona,
    get_persona_summary,
    update_persona,
    delete_persona,
    get_supported_platforms,
    validate_linkedin_persona,
    optimize_linkedin_persona,
    validate_facebook_persona,
    optimize_facebook_persona,
    LinkedInPersonaValidationRequest,
    LinkedInPersonaValidationResponse,
    LinkedInOptimizationRequest,
    LinkedInOptimizationResponse,
    FacebookPersonaValidationRequest,
    FacebookPersonaValidationResponse,
    FacebookOptimizationRequest,
    FacebookOptimizationResponse
)

from services.persona_replication_engine import PersonaReplicationEngine
from api.persona import update_platform_persona, generate_platform_persona, check_facebook_persona

# Create router
router = APIRouter(prefix="/api/personas", tags=["personas"])

@router.get("/user")
async def get_user_personas_endpoint(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get all personas for the current user."""
    user_id = str(current_user.get('id'))
    return await get_user_personas(user_id)

@router.get("/summary")
async def get_persona_summary_endpoint(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get persona summary for the current user."""
    user_id = str(current_user.get('id'))
    return await get_persona_summary(user_id)

@router.get("/{persona_id}")
async def get_persona_details_endpoint(
    persona_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get detailed information about a specific persona."""
    user_id = str(current_user.get('id'))
    return await get_persona_details(user_id, persona_id)

@router.get("/platform/{platform}")
async def get_platform_persona_endpoint(
    platform: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get persona adaptation for a specific platform."""
    user_id = str(current_user.get('id'))
    return await get_platform_persona(user_id, platform)

@router.post("/generate-platform/{platform}")
async def generate_platform_persona_endpoint(
    platform: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a platform-specific persona from core persona."""
    user_id = str(current_user.get('id'))
    return await generate_platform_persona(user_id, platform, db)

@router.put("/{persona_id}")
async def update_persona_endpoint(
    persona_id: int,
    update_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update an existing persona."""
    user_id = int(current_user.get("id"))
    return await update_persona(user_id, persona_id, update_data)

@router.delete("/{persona_id}")
async def delete_persona_endpoint(
    persona_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete a persona."""
    user_id = int(current_user.get("id"))
    return await delete_persona(user_id, persona_id)

@router.get("/platforms/supported")
async def get_supported_platforms_endpoint():
    """Get list of supported platforms for persona generation."""
    return await get_supported_platforms()

@router.post("/linkedin/validate", response_model=LinkedInPersonaValidationResponse)
async def validate_linkedin_persona_endpoint(
    request: LinkedInPersonaValidationRequest
):
    """Validate LinkedIn persona data for completeness and quality."""
    return await validate_linkedin_persona(request)

@router.post("/linkedin/optimize", response_model=LinkedInOptimizationResponse)
async def optimize_linkedin_persona_endpoint(
    request: LinkedInOptimizationRequest
):
    """Optimize LinkedIn persona data for maximum algorithm performance."""
    return await optimize_linkedin_persona(request)

@router.post("/facebook/validate", response_model=FacebookPersonaValidationResponse)
async def validate_facebook_persona_endpoint(
    request: FacebookPersonaValidationRequest
):
    """Validate Facebook persona data for completeness and quality."""
    return await validate_facebook_persona(request)

@router.post("/facebook/optimize", response_model=FacebookOptimizationResponse)
async def optimize_facebook_persona_endpoint(
    request: FacebookOptimizationRequest
):
    """Optimize Facebook persona data for maximum algorithm performance."""
    return await optimize_facebook_persona(request)

@router.post("/generate-content")
async def generate_content_with_persona_endpoint(
    request: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate content using persona replication engine."""
    try:
        user_id = int(current_user.get("id"))
        platform = request.get("platform")
        content_request = request.get("content_request")
        content_type = request.get("content_type", "post")
        
        if not platform or not content_request:
            raise HTTPException(status_code=400, detail="Platform and content_request are required")
        
        engine = PersonaReplicationEngine()
        result = engine.generate_content_with_persona(
            user_id=user_id,
            platform=platform,
            content_request=content_request,
            content_type=content_type
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content generation failed: {str(e)}")

@router.get("/export/{platform}")
async def export_persona_prompt_endpoint(
    platform: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Export hardened persona prompt for external use."""
    try:
        engine = PersonaReplicationEngine()
        user_id = int(current_user.get("id"))
        export_package = engine.export_persona_for_external_use(user_id, platform)
        
        if "error" in export_package:
            raise HTTPException(status_code=400, detail=export_package["error"])
        
        return export_package
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@router.post("/validate-content")
async def validate_content_endpoint(
    request: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Validate content against persona constraints."""
    try:
        user_id = int(current_user.get("id"))
        platform = request.get("platform")
        content = request.get("content")
        
        if not platform or not content:
            raise HTTPException(status_code=400, detail="Platform and content are required")
        
        engine = PersonaReplicationEngine()
        persona_data = engine.persona_service.get_platform_persona(user_id, platform)
        
        if not persona_data:
            raise HTTPException(status_code=404, detail="No persona found for platform")
        
        validation_result = engine._validate_content_fidelity(content, persona_data, platform)
        
        return {
            "validation_result": validation_result,
            "persona_id": user_id,
            "platform": platform
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@router.put("/platform/{platform}")
async def update_platform_persona_endpoint(
    platform: str,
    update_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update platform-specific persona fields for a user.

    Allows editing persona fields in the UI and saving them to the database.
    """
    user_id = int(current_user.get("id"))
    return await update_platform_persona(user_id, platform, update_data)

@router.get("/facebook-persona/check/{user_id}")
async def check_facebook_persona_endpoint(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Check if Facebook persona exists for user."""
    return await check_facebook_persona(user_id, db)

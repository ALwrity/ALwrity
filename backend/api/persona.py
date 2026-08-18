"""
Persona API endpoints for ALwrity.
Handles writing persona generation, management, and platform-specific adaptations.
"""

from fastapi import HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session

from services.persona.platform_registry import get_enabled_platforms

class LinkedInPersonaValidationRequest(BaseModel):
    """Request model for LinkedIn persona validation."""
    persona_data: Dict[str, Any]

class LinkedInPersonaValidationResponse(BaseModel):
    """Response model for LinkedIn persona validation."""
    is_valid: bool
    quality_score: float
    completeness_score: float
    professional_context_score: float
    linkedin_optimization_score: float
    missing_fields: List[str]
    incomplete_fields: List[str]
    recommendations: List[str]
    quality_issues: List[str]
    strengths: List[str]
    validation_details: Dict[str, Any]

async def get_user_personas(user_id: str):
    """Get all personas for a user using PersonaData."""
    try:
        from services.persona_data_service import PersonaDataService
        
        persona_service = PersonaDataService()
        all_personas = persona_service.get_all_platform_personas(user_id)
        
        return {
            "personas": all_personas,
            "total_count": len(all_personas),
            "platforms": list(all_personas.keys())
        }
        
    except Exception as e:
        logger.error(f"Error getting user personas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get personas: {str(e)}")

async def get_persona_details(user_id: str, persona_id: int):
    """Get detailed information about a specific persona using PersonaData."""
    try:
        from services.persona_data_service import PersonaDataService
        
        persona_service = PersonaDataService()
        persona_data = persona_service.get_user_persona_data(user_id)
        
        if not persona_data:
            raise HTTPException(status_code=404, detail="Persona not found")
        
        # Return the complete persona data with all platforms
        return {
            "persona_id": persona_data.get('id'),
            "core_persona": persona_data.get('core_persona', {}),
            "platform_personas": persona_data.get('platform_personas', {}),
            "quality_metrics": persona_data.get('quality_metrics', {}),
            "selected_platforms": persona_data.get('selected_platforms', []),
            "created_at": persona_data.get('created_at'),
            "updated_at": persona_data.get('updated_at')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting persona details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get persona details: {str(e)}")

async def get_platform_persona(user_id: str, platform: str):
    """Get persona adaptation for a specific platform using PersonaData."""
    try:
        from services.persona_data_service import PersonaDataService
        
        persona_service = PersonaDataService()
        platform_persona = persona_service.get_platform_persona(user_id, platform)
        
        if not platform_persona:
            raise HTTPException(status_code=404, detail=f"No persona found for platform {platform}")
        
        return platform_persona
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting platform persona: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get platform persona: {str(e)}")

async def get_persona_summary(user_id: str):
    """Get persona summary for a user using PersonaData."""
    try:
        from services.persona_data_service import PersonaDataService
        
        persona_service = PersonaDataService()
        summary = persona_service.get_persona_summary(user_id)
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting persona summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get persona summary: {str(e)}")

async def update_persona(user_id: str, persona_id: int, update_data: Dict[str, Any]):
    """Update an existing persona using PersonaData."""
    try:
        from services.persona_data_service import PersonaDataService
        from models.onboarding import PersonaData
        
        persona_service = PersonaDataService()
        
        # For PersonaData, we update the core_persona field
        if 'core_persona' in update_data:
            # Get current persona data
            persona_data = persona_service.get_user_persona_data(user_id)
            if not persona_data:
                raise HTTPException(status_code=404, detail="Persona not found")
            
            # Update core persona with new data
            persona_service.db.query(PersonaData).filter(
                PersonaData.id == persona_data.get('id')
            ).update({
                'core_persona': update_data['core_persona'],
                'updated_at': datetime.utcnow()
            })
            persona_service.db.commit()
            persona_service.db.close()
            
            return {
                "message": "Persona updated successfully",
                "persona_id": persona_data.get('id'),
                "updated_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail="core_persona field is required for updates")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating persona: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update persona: {str(e)}")

async def delete_persona(user_id: str, persona_id: int):
    """Delete a persona using PersonaData (not recommended, personas are generated during onboarding)."""
    try:
        from services.persona_data_service import PersonaDataService
        from models.onboarding import PersonaData
        
        persona_service = PersonaDataService()
        
        # Get persona data
        persona_data = persona_service.get_user_persona_data(user_id)
        if not persona_data:
            raise HTTPException(status_code=404, detail="Persona not found")
        
        # For PersonaData, we mark it as deleted by setting a flag
        # Note: In production, you might want to add a deleted_at field or similar
        # For now, we'll just return a warning that deletion is not recommended
        logger.warning(f"Delete persona requested for user {user_id}. PersonaData deletion is not recommended.")
        
        return {
            "message": "Persona deletion requested. Note: Personas are generated during onboarding and deletion is not recommended.",
            "persona_id": persona_data.get('id'),
            "alternative": "Consider re-running onboarding to regenerate persona if needed."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting persona: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete persona: {str(e)}")

async def update_platform_persona(user_id: str, platform: str, update_data: Dict[str, Any]):
    """Update platform-specific persona fields using PersonaData."""
    try:
        from services.persona_data_service import PersonaDataService

        persona_service = PersonaDataService()
        
        # Update platform-specific persona data
        success = persona_service.update_platform_persona(user_id, platform, update_data)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"No platform persona found for platform {platform}")

        return {
            "message": "Platform persona updated successfully",
            "platform": platform,
            "user_id": user_id,
            "updated_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating platform persona: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update platform persona: {str(e)}")

async def generate_platform_persona(user_id: str, platform: str, db_session):
    """
    Generate a platform-specific persona from core persona and save it.
    
    Args:
        user_id: User ID from auth
        platform: Platform name (facebook, linkedin, etc.)
        db_session: Database session from FastAPI dependency injection
    
    Returns:
        Generated platform persona with validation results
    """
    try:
        logger.info(f"Generating {platform} persona for user {user_id}")
        
        # Import services
        from services.persona_data_service import PersonaDataService
        from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
        
        persona_data_service = PersonaDataService(db_session=db_session)
        integration_service = OnboardingDataIntegrationService()
        
        # Get core persona data
        persona_data = persona_data_service.get_user_persona_data(user_id)
        if not persona_data:
            raise HTTPException(status_code=404, detail="Core persona not found")
        
        core_persona = persona_data.get('core_persona', {})
        if not core_persona:
            raise HTTPException(status_code=404, detail="Core persona data is empty")
        
        # Get onboarding data for context using SSOT
        integrated_data = integration_service.get_integrated_data_sync(user_id, db_session)
        onboarding_session = integrated_data.get('onboarding_session')
        
        if not onboarding_session:
            raise HTTPException(status_code=404, detail="Onboarding session not found")
        
        # Get website analysis for context
        website_analysis = integrated_data.get('website_analysis', {})
        research_prefs = integrated_data.get('research_preferences', {})
        
        onboarding_data = {
            "website_url": website_analysis.get('website_url', '') if website_analysis else '',
            "writing_style": website_analysis.get('writing_style', {}) if website_analysis else {},
            "content_characteristics": website_analysis.get('content_characteristics', {}) if website_analysis else {},
            "target_audience": website_analysis.get('target_audience', '') if website_analysis else '',
            "research_preferences": research_prefs or {}
        }
        
        # Generate platform persona based on platform
        generated_persona = None
        platform_service = None
        
        if platform.lower() == 'facebook':
            from services.persona.facebook.facebook_persona_service import FacebookPersonaService
            platform_service = FacebookPersonaService()
            generated_persona = platform_service.generate_facebook_persona(
                core_persona, 
                onboarding_data
            )
        elif platform.lower() == 'linkedin':
            from services.persona.linkedin.linkedin_persona_service import LinkedInPersonaService
            platform_service = LinkedInPersonaService()
            generated_persona = platform_service.generate_linkedin_persona(
                core_persona,
                onboarding_data
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")
        
        # Check for errors in generation
        if "error" in generated_persona:
            raise HTTPException(status_code=500, detail=generated_persona["error"])
        
        # Save the generated platform persona to database
        success = persona_data_service.save_platform_persona(user_id, platform, generated_persona)
        
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to save {platform} persona")
        
        logger.info(f"✅ Successfully generated and saved {platform} persona for user {user_id}")
        
        return {
            "success": True,
            "platform": platform,
            "persona": generated_persona,
            "validation_results": generated_persona.get("validation_results", {}),
            "quality_score": generated_persona.get("validation_results", {}).get("quality_score", 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating {platform} persona: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate {platform} persona: {str(e)}")

async def check_facebook_persona(user_id: str, db: Session):
    """Check if Facebook persona exists for user."""
    try:
        from services.persona_data_service import PersonaDataService
        
        persona_data_service = PersonaDataService(db_session=db)
        persona_data = persona_data_service.get_user_persona_data(user_id)
        
        if not persona_data:
            return {
                "has_persona": False,
                "has_core_persona": False,
                "message": "No persona data found",
                "onboarding_completed": False
            }
        
        platform_personas = persona_data.get('platform_personas', {})
        facebook_persona = platform_personas.get('facebook') if platform_personas else None
        
        # Check if core persona exists
        has_core_persona = bool(persona_data.get('core_persona'))
        
        # Assume onboarding is completed if persona data exists
        onboarding_completed = True
        
        return {
            "has_persona": bool(facebook_persona),
            "has_core_persona": has_core_persona,
            "persona": facebook_persona,
            "onboarding_completed": onboarding_completed
        }
    except Exception as e:
        logger.error(f"Error checking Facebook persona for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_supported_platforms():
    """Get list of supported platforms for persona generation (from the registry)."""
    return {
        "platforms": [
            {"id": p["id"], "name": p["name"], "description": p["description"]}
            for p in get_enabled_platforms()
        ]
    }

class LinkedInOptimizationRequest(BaseModel):
    """Request model for LinkedIn algorithm optimization."""
    persona_data: Dict[str, Any]


class LinkedInOptimizationResponse(BaseModel):
    """Response model for LinkedIn algorithm optimization."""
    optimized_persona: Dict[str, Any]
    optimization_applied: bool
    optimization_details: Dict[str, Any]


async def validate_linkedin_persona(
    request: LinkedInPersonaValidationRequest,
):
    """
    Validate LinkedIn persona data for completeness and quality.

    This endpoint provides comprehensive validation of LinkedIn persona data,
    including core fields, LinkedIn-specific optimizations, professional context,
    and content quality assessments.
    """
    try:
        logger.info("Validating LinkedIn persona data")

        # Get LinkedIn persona service
        from services.persona.linkedin.linkedin_persona_service import LinkedInPersonaService
        linkedin_service = LinkedInPersonaService()

        # Validate the persona data
        validation_results = linkedin_service.validate_linkedin_persona(request.persona_data)

        logger.info(f"LinkedIn persona validation completed: Quality Score: {validation_results['quality_score']:.1f}%")

        return LinkedInPersonaValidationResponse(**validation_results)

    except Exception as e:
        logger.error(f"Error validating LinkedIn persona: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to validate LinkedIn persona: {str(e)}"
        )


async def optimize_linkedin_persona(
    request: LinkedInOptimizationRequest,
):
    """
    Optimize LinkedIn persona data for maximum algorithm performance.

    This endpoint applies comprehensive LinkedIn algorithm optimization to persona data,
    including content quality optimization, multimedia strategy, engagement optimization,
    timing optimization, and professional context optimization.
    """
    try:
        logger.info("Optimizing LinkedIn persona for algorithm performance")

        # Get LinkedIn persona service
        from services.persona.linkedin.linkedin_persona_service import LinkedInPersonaService
        linkedin_service = LinkedInPersonaService()

        # Apply algorithm optimization
        optimized_persona = linkedin_service.optimize_for_linkedin_algorithm(request.persona_data)

        # Extract optimization details
        optimization_details = optimized_persona.get("algorithm_optimization", {})
        
        logger.info("✅ LinkedIn persona algorithm optimization completed successfully")

        return LinkedInOptimizationResponse(
            optimized_persona=optimized_persona,
            optimization_applied=True,
            optimization_details={
                "optimization_categories": list(optimization_details.keys()),
                "total_optimization_strategies": sum(len(strategies) if isinstance(strategies, list) else 1 
                                                   for category in optimization_details.values() 
                                                   for strategies in category.values() if isinstance(category, dict)),
                "optimization_timestamp": datetime.utcnow().isoformat()
            }
        )

    except Exception as e:
        logger.error(f"Error optimizing LinkedIn persona: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to optimize LinkedIn persona: {str(e)}"
        )


class FacebookPersonaValidationRequest(BaseModel):
    """Request model for Facebook persona validation."""
    persona_data: Dict[str, Any]


class FacebookPersonaValidationResponse(BaseModel):
    """Response model for Facebook persona validation."""
    is_valid: bool
    quality_score: float
    completeness_score: float
    facebook_optimization_score: float
    engagement_strategy_score: float
    content_format_score: float
    audience_targeting_score: float
    community_building_score: float
    missing_fields: List[str]
    incomplete_fields: List[str]
    recommendations: List[str]
    quality_issues: List[str]
    strengths: List[str]
    validation_details: Dict[str, Any]


class FacebookOptimizationRequest(BaseModel):
    """Request model for Facebook algorithm optimization."""
    persona_data: Dict[str, Any]


class FacebookOptimizationResponse(BaseModel):
    """Response model for Facebook algorithm optimization."""
    optimized_persona: Dict[str, Any]
    optimization_applied: bool
    optimization_details: Dict[str, Any]


async def validate_facebook_persona(
    request: FacebookPersonaValidationRequest,
):
    """
    Validate Facebook persona data for completeness and quality.

    This endpoint provides comprehensive validation of Facebook persona data,
    including core fields, Facebook-specific optimizations, engagement strategies,
    content formats, audience targeting, and community building assessments.
    """
    try:
        logger.info("Validating Facebook persona data")

        # Get Facebook persona service
        from services.persona.facebook.facebook_persona_service import FacebookPersonaService
        facebook_service = FacebookPersonaService()

        # Validate the persona data
        validation_results = facebook_service.validate_facebook_persona(request.persona_data)

        logger.info(f"Facebook persona validation completed: Quality Score: {validation_results['quality_score']:.1f}%")

        return FacebookPersonaValidationResponse(**validation_results)

    except Exception as e:
        logger.error(f"Error validating Facebook persona: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to validate Facebook persona: {str(e)}"
        )


async def optimize_facebook_persona(
    request: FacebookOptimizationRequest,
):
    """
    Optimize Facebook persona data for maximum algorithm performance.

    This endpoint applies comprehensive Facebook algorithm optimization to persona data,
    including engagement optimization, content quality optimization, timing optimization,
    audience targeting optimization, and community building strategies.
    """
    try:
        logger.info("Optimizing Facebook persona for algorithm performance")

        # Get Facebook persona service
        from services.persona.facebook.facebook_persona_service import FacebookPersonaService
        facebook_service = FacebookPersonaService()

        # Apply algorithm optimization
        optimized_persona = facebook_service.optimize_for_facebook_algorithm(request.persona_data)

        # Extract optimization details
        optimization_details = optimized_persona.get("algorithm_optimization", {})
        
        logger.info("✅ Facebook persona algorithm optimization completed successfully")

        # Use the optimization metadata from the service
        optimization_metadata = optimized_persona.get("optimization_metadata", {})
        
        return FacebookOptimizationResponse(
            optimized_persona=optimized_persona,
            optimization_applied=True,
            optimization_details={
                "optimization_categories": optimization_metadata.get("optimization_categories", []),
                "total_optimization_strategies": optimization_metadata.get("total_optimization_strategies", 0),
                "optimization_timestamp": optimization_metadata.get("optimization_timestamp", datetime.utcnow().isoformat())
            }
        )

    except Exception as e:
        logger.error(f"Error optimizing Facebook persona: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to optimize Facebook persona: {str(e)}"
        )

from typing import Dict, Any, Optional
from loguru import logger
from fastapi import HTTPException, Depends, Query
from middleware.auth_middleware import get_current_user


async def complete_step(step_number: int, request_data: Dict[str, Any], current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.step_management_service import StepManagementService
        step_service = StepManagementService()
        return await step_service.complete_step(step_number, request_data, current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing step: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def skip_step(step_number: int, current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.step_management_service import StepManagementService
        step_service = StepManagementService()
        return await step_service.skip_step(step_number, current_user)
    except Exception as e:
        logger.error(f"Error skipping step: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def validate_step_access(step_number: int, current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.step_management_service import StepManagementService
        step_service = StepManagementService()
        return await step_service.validate_step_access(step_number, current_user)
    except Exception as e:
        logger.error(f"Error validating step access: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def start_onboarding(current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.onboarding_control_service import OnboardingControlService
        control_service = OnboardingControlService()
        return await control_service.start_onboarding(current_user)
    except Exception as e:
        logger.error(f"Error starting onboarding: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def complete_onboarding(current_user: Dict[str, Any]):
    try:
        from api.onboarding_utils.onboarding_completion_service import OnboardingCompletionService
        completion_service = OnboardingCompletionService()
        return await completion_service.complete_onboarding(current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing onboarding: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def reset_onboarding(current_user: dict = Depends(get_current_user),
                            hard: Optional[bool] = Query(False, description="If true, delete all records for a clean slate")):
    try:
        from api.onboarding_utils.onboarding_control_service import OnboardingControlService
        control_service = OnboardingControlService()
        return await control_service.reset_onboarding(current_user, hard=hard)
    except Exception as e:
        logger.error(f"Error resetting onboarding: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def get_resume_info():
    try:
        from api.onboarding_utils.onboarding_control_service import OnboardingControlService
        control_service = OnboardingControlService()
        return await control_service.get_resume_info()
    except Exception as e:
        logger.error(f"Error getting resume info: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


__all__ = [name for name in globals().keys() if not name.startswith('_')]



from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from services.onboarding.api_key_manager import APIKeyManager


class StepDataModel(BaseModel):
    step_number: int
    title: str
    description: str
    status: str
    completed_at: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    validation_errors: List[str] = []


class OnboardingProgressModel(BaseModel):
    steps: List[StepDataModel]
    current_step: int
    started_at: str
    last_updated: str
    is_completed: bool
    completed_at: Optional[str] = None


class StepCompletionRequest(BaseModel):
    data: Optional[Dict[str, Any]] = None
    validation_errors: List[str] = []


class APIKeyRequest(BaseModel):
    provider: str = Field(..., description="API provider name (e.g., 'openai', 'gemini')")
    api_key: str = Field(..., description="API key value")
    description: Optional[str] = Field(None, description="Optional description")


class OnboardingStatusResponse(BaseModel):
    is_completed: bool
    current_step: int
    completion_percentage: float
    next_step: Optional[int]
    started_at: str
    completed_at: Optional[str] = None
    can_proceed_to_final: bool


class StepValidationResponse(BaseModel):
    can_proceed: bool
    validation_errors: List[str]
    step_status: str


def get_api_key_manager() -> APIKeyManager:
    return APIKeyManager()



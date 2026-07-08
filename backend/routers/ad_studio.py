from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List

from models.ad_studio_models import AdCampaignRequest, AdCampaignResponse, AdCreativeRequest, AdCreativeResponse
from services.ad_studio_service import AdStudioService

# Use a mock dependency for getting current user since Clerk auth implementation is complex
async def get_mock_user_id() -> str:
    return "test_user_123"

router = APIRouter(
    prefix="/api/ads",
    tags=["Ad Studio"]
)

ad_service = AdStudioService()

@router.post("/generate-campaign", response_model=AdCampaignResponse)
async def generate_campaign(
    request: AdCampaignRequest,
    user_id: str = Depends(get_mock_user_id)
):
    try:
        response = await ad_service.generate_campaign(request, user_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-creative", response_model=AdCreativeResponse)
async def generate_creative(
    request: AdCreativeRequest,
    user_id: str = Depends(get_mock_user_id)
):
    try:
        image_url = await ad_service.generate_creative(request.campaign_id, request.prompt, request.aspect_ratio)
        return AdCreativeResponse(image_url=image_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

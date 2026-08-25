"""
Pre-flight check endpoints for operation validation and cost estimation.
"""

import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from loguru import logger

from services.database import get_db
from services.subscription import PricingService
from middleware.auth_middleware import get_current_user
from models.subscription_models import APIProvider, UsageSummary
from ..dependencies import get_user_id_from_token
from ..models import PreflightCheckRequest

router = APIRouter()


@router.post("/preflight-check")
async def preflight_check(
    request: PreflightCheckRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Pre-flight check for operations with cost estimation.
    
    Lightweight endpoint that:
    - Validates if operations are allowed based on subscription limits
    - Estimates cost for operations
    - Returns usage information and remaining quota
    
    Uses caching to minimize DB load (< 100ms with cache hit).
    """
    start_time = time.time()
    try:
        user_id = get_user_id_from_token(current_user)
        
        pricing_service = PricingService(db)
        
        # Convert request operations to internal format
        operations_to_validate = []
        for op in request.operations:
            try:
                # Map provider string to APIProvider enum
                provider_str = op.provider.lower()
                if provider_str == "huggingface":
                    provider_enum = APIProvider.MISTRAL  # Maps to HuggingFace
                elif provider_str == "video":
                    provider_enum = APIProvider.VIDEO
                elif provider_str == "fal-ai" or provider_str == "fal":
                    provider_enum = APIProvider.VIDEO # Map fal-ai to VIDEO as it's primarily used for media gen
                elif provider_str == "image_edit":
                    provider_enum = APIProvider.IMAGE_EDIT
                elif provider_str == "stability":
                    provider_enum = APIProvider.STABILITY
                elif provider_str == "audio":
                    provider_enum = APIProvider.AUDIO
                else:
                    try:
                        provider_enum = APIProvider(provider_str)
                    except ValueError:
                        logger.warning(f"Unknown provider: {provider_str}, skipping")
                        continue
                
                operations_to_validate.append({
                    'provider': provider_enum,
                    'tokens_requested': op.tokens_requested or 0,
                    'actual_provider_name': op.actual_provider_name or op.provider,
                    'operation_type': op.operation_type,
                    'model': op.model
                })
            except Exception as e:
                logger.warning(f"Error processing operation {op.operation_type}: {e}")
                continue
        
        if not operations_to_validate:
            raise HTTPException(status_code=400, detail="No valid operations provided")
        
        # Perform pre-flight validation
        can_proceed, message, error_details = pricing_service.check_comprehensive_limits(
            user_id=user_id,
            operations=operations_to_validate
        )
        
        # Get pricing and cost estimation for each operation
        operation_results = []
        total_cost = 0.0
        
        for op in operations_to_validate:
            op_result = {
                'provider': op['actual_provider_name'],
                'operation_type': op['operation_type'],
                'cost': 0.0,
                'allowed': can_proceed,
                'limit_info': None,
                'message': None
            }
            
            # Get pricing for this operation
            model_name = op.get('model')
            pricing_info = None
            if model_name:
                pricing_info = pricing_service.get_pricing_for_provider_model(
                    op['provider'],
                    model_name
                )
            
            if pricing_info:
                # Determine cost based on operation type
                if op['provider'] in [APIProvider.VIDEO, APIProvider.IMAGE_EDIT, APIProvider.STABILITY]:
                    cost = pricing_info.get('cost_per_request', 0.0) or pricing_info.get('cost_per_image', 0.0) or 0.0
                elif op['provider'] == APIProvider.AUDIO:
                    model_lower = (model_name or "").lower()
                    if model_lower == "minimax/voice-clone":
                        cost = pricing_info.get('cost_per_request', 0.5) or 0.5
                    elif model_lower == "wavespeed-ai/qwen3-tts/voice-clone":
                        chars = max(0, int(op.get('tokens_requested') or 0))
                        cost = max(0.005, 0.005 * (chars / 100.0))
                    else:
                        cost = (pricing_info.get('cost_per_input_token', 0.0) or 0.0) * op['tokens_requested']
                elif op['tokens_requested'] > 0:
                    cost = (pricing_info.get('cost_per_input_token', 0.0) or 0.0) * op['tokens_requested']
                else:
                    cost = pricing_info.get('cost_per_request', 0.0) or 0.0
                
                op_result['cost'] = round(cost, 4)
                total_cost += cost
            else:
                # Use default cost if pricing not found or no model specified
                if op['provider'] == APIProvider.VIDEO:
                    op_result['cost'] = 0.10  # Default video cost
                    total_cost += 0.10
                elif op['provider'] == APIProvider.IMAGE_EDIT:
                    op_result['cost'] = 0.05  # Default image edit cost
                    total_cost += 0.05
                elif op['provider'] == APIProvider.STABILITY:
                    op_result['cost'] = 0.04  # Default image generation cost
                    total_cost += 0.04
                elif op['provider'] == APIProvider.AUDIO:
                    # Default audio cost: $0.05 per 1,000 characters
                    cost = (op['tokens_requested'] / 1000.0) * 0.05
                    op_result['cost'] = round(cost, 4)
                    total_cost += cost
            
            # Get limit information
            limit_info = None
            if error_details and not can_proceed:
                usage_info = error_details.get('usage_info', {})
                if usage_info:
                    op_result['message'] = message
                    limit_info = {
                        'current_usage': usage_info.get('current_usage', 0),
                        'limit': usage_info.get('limit', 0),
                        'remaining': max(0, usage_info.get('limit', 0) - usage_info.get('current_usage', 0))
                    }
                    op_result['limit_info'] = limit_info
            else:
                # Get current usage for this provider
                limits = pricing_service.get_user_limits(user_id)
                if limits:
                    usage_summary = db.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == pricing_service.get_current_billing_period(user_id)
                    ).first()
                    
                    if usage_summary:
                        if op['provider'] == APIProvider.VIDEO:
                            current = getattr(usage_summary, 'video_calls', 0) or 0
                            limit = limits['limits'].get('video_calls', 0)
                        elif op['provider'] == APIProvider.IMAGE_EDIT:
                            current = getattr(usage_summary, 'image_edit_calls', 0) or 0
                            limit = limits['limits'].get('image_edit_calls', 0)
                        elif op['provider'] == APIProvider.STABILITY:
                            current = getattr(usage_summary, 'stability_calls', 0) or 0
                            limit = limits['limits'].get('stability_calls', 0)
                        elif op['provider'] == APIProvider.AUDIO:
                            current = getattr(usage_summary, 'audio_calls', 0) or 0
                            limit = limits['limits'].get('audio_calls', 0)
                        else:
                            # For LLM providers, use token limits
                            provider_key = op['provider'].value
                            current_tokens = getattr(usage_summary, f"{provider_key}_tokens", 0) or 0
                            limit = limits['limits'].get(f"{provider_key}_tokens", 0)
                            current = current_tokens
                        
                        limit_info = {
                            'current_usage': current,
                            'limit': limit,
                            'remaining': max(0, limit - current) if limit > 0 else float('inf')
                        }
                        op_result['limit_info'] = limit_info
            
            operation_results.append(op_result)
        
        # Get overall usage summary
        limits = pricing_service.get_user_limits(user_id)
        usage_summary = None
        if limits:
            usage_summary = db.query(UsageSummary).filter(
                UsageSummary.user_id == user_id,
                UsageSummary.billing_period == pricing_service.get_current_billing_period(user_id)
            ).first()
        
        response_data = {
            'can_proceed': can_proceed,
            'estimated_cost': round(total_cost, 4),
            'operations': operation_results,
            'total_cost': round(total_cost, 4),
            'usage_summary': None,
            'cached': False  # TODO: Track if result was cached
        }
        
        if usage_summary and limits:
            # For video generation, show video limits
            video_current = getattr(usage_summary, 'video_calls', 0) or 0
            video_limit = limits['limits'].get('video_calls', 0)
            
            response_data['usage_summary'] = {
                'current_calls': video_current,
                'limit': video_limit,
                'remaining': max(0, video_limit - video_current) if video_limit > 0 else float('inf')
            }
        
        elapsed_ms = (time.time() - start_time) * 1000
        logger.warning(f"[PreflightCheck] Completed in {elapsed_ms:.0f}ms for user {user_id}")
        
        return {
            "success": True,
            "data": response_data
        }
    
    except HTTPException:
        elapsed_ms = (time.time() - start_time) * 1000
        logger.warning(f"[PreflightCheck] HTTP error after {elapsed_ms:.0f}ms")
        raise
    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        logger.error(f"[PreflightCheck] Error after {elapsed_ms:.0f}ms: {e}")
        raise HTTPException(status_code=500, detail=f"Pre-flight check failed: {str(e)}")

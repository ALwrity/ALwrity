"""
Subscription plans endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from loguru import logger
import sqlite3

from services.database import get_db
from services.subscription.plans_db import get_plans_db
from models.subscription_models import SubscriptionPlan
from services.subscription.schema_utils import ensure_subscription_plan_columns
from ..utils import enum_value, format_plan_limits, handle_schema_error
from fastapi import Query
from typing import Optional

router = APIRouter()


@router.get("/plans")
async def get_subscription_plans(
    db: Session = Depends(get_plans_db),
) -> Dict[str, Any]:
    """Get all available subscription plans (public — no auth required)."""
    
    try:
        ensure_subscription_plan_columns(db)
    except Exception as schema_err:
        logger.warning(f"Schema check failed, will retry on query: {schema_err}")
    
    try:
        plans = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.is_active == True
        ).order_by(SubscriptionPlan.price_monthly).all()
        
        plans_data = []
        for plan in plans:
            plans_data.append({
                "id": plan.id,
                "name": plan.name,
                "tier": enum_value(plan.tier),
                "price_monthly": plan.price_monthly,
                "price_yearly": plan.price_yearly,
                "description": plan.description,
                "features": plan.features or [],
                "limits": format_plan_limits(plan)
            })
        
        return {
            "success": True,
            "data": {
                "plans": plans_data,
                "total": len(plans_data)
            }
        }
    
    except (sqlite3.OperationalError, Exception) as e:
        error_str = str(e).lower()
        if 'no such column' in error_str and ('exa_calls_limit' in error_str or 'video_calls_limit' in error_str or 'image_edit_calls_limit' in error_str or 'audio_calls_limit' in error_str):
            return handle_schema_error(
                e,
                db,
                error_str,
                lambda: get_subscription_plans(db)
            )
        
        logger.error(f"Error getting subscription plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pricing")
async def get_api_pricing(
    provider: Optional[str] = Query(None, description="API provider"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get API pricing information."""
    
    try:
        from models.subscription_models import APIProvider, APIProviderPricing
        
        query = db.query(APIProviderPricing).filter(
            APIProviderPricing.is_active == True
        )
        
        if provider:
            try:
                api_provider = APIProvider(provider.lower())
                query = query.filter(APIProviderPricing.provider == api_provider)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
        
        pricing_data = query.all()
        
        pricing_list = []
        for pricing in pricing_data:
            pricing_list.append({
                "provider": pricing.provider.value,
                "model_name": pricing.model_name,
                "cost_per_input_token": pricing.cost_per_input_token,
                "cost_per_output_token": pricing.cost_per_output_token,
                "cost_per_request": pricing.cost_per_request,
                "cost_per_search": pricing.cost_per_search,
                "cost_per_image": pricing.cost_per_image,
                "cost_per_page": pricing.cost_per_page,
                "description": pricing.description,
                "effective_date": pricing.effective_date.isoformat()
            })
        
        return {
            "success": True,
            "data": {
                "pricing": pricing_list,
                "total": len(pricing_list)
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting API pricing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

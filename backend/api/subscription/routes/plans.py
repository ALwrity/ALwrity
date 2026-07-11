"""
Subscription plans endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from loguru import logger
import sqlite3

from services.database import get_db, get_session_for_user
from models.subscription_models import SubscriptionPlan, APIProviderPricing, APIProvider
from services.subscription.schema_utils import ensure_subscription_plan_columns
from ..utils import format_plan_limits, handle_schema_error
from fastapi import Query

router = APIRouter()

@router.get("/plans")
async def get_subscription_plans(
    request: Request
) -> Dict[str, Any]:
    """Get all available subscription plans."""
    
    # Try to extract user from the request using middleware
    user_id = None
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from middleware.auth_middleware import clerk_auth
            token = auth_header.replace("Bearer ", "")
            user = await clerk_auth.verify_token(token)
            if user:
                user_id = user.get("user_id") or user.get("clerk_user_id") or user.get("id")
        except Exception as e:
            logger.error(f"Error extracting user for plans: {e}")

    # Fallback to default plans if unauthenticated or database lookup fails
    plans_data = []

    if user_id:
        db = get_session_for_user(user_id)
        if db:
            try:
                try:
                    ensure_subscription_plan_columns(db)
                except Exception as schema_err:
                    logger.warning(f"Schema check failed, will retry on query: {schema_err}")
                
                try:
                    plans = db.query(SubscriptionPlan).filter(
                        SubscriptionPlan.is_active == True
                    ).order_by(SubscriptionPlan.price_monthly).all()
                    
                    for plan in plans:
                        plans_data.append({
                            "id": plan.id,
                            "name": plan.name,
                            "tier": plan.tier.value,
                            "price_monthly": plan.price_monthly,
                            "price_yearly": plan.price_yearly,
                            "description": plan.description,
                            "features": plan.features or [],
                            "limits": format_plan_limits(plan)
                        })
                except (sqlite3.OperationalError, Exception) as e:
                    error_str = str(e).lower()
                    if 'no such column' in error_str and ('exa_calls_limit' in error_str or 'video_calls_limit' in error_str or 'image_edit_calls_limit' in error_str or 'audio_calls_limit' in error_str):
                        logger.warning(f"Schema issue detected on query, attempting recovery: {e}")
                        try:
                            handle_schema_error(db, e)
                            plans = db.query(SubscriptionPlan).filter(
                                SubscriptionPlan.is_active == True
                            ).order_by(SubscriptionPlan.price_monthly).all()
                            
                            for plan in plans:
                                plans_data.append({
                                    "id": plan.id,
                                    "name": plan.name,
                                    "tier": plan.tier.value,
                                    "price_monthly": plan.price_monthly,
                                    "price_yearly": plan.price_yearly,
                                    "description": plan.description,
                                    "features": plan.features or [],
                                    "limits": format_plan_limits(plan)
                                })
                        except Exception as recovery_err:
                            logger.error(f"Failed to recover from schema error: {recovery_err}")
                    else:
                        logger.error(f"Error fetching custom plans: {e}")
            finally:
                db.close()

    if not plans_data:
        # Fallback to default plans if no user_id or DB fetch returned empty/failed
        from services.subscription.pricing_service import DEFAULT_SUBSCRIPTION_PLANS
        for plan_dict in DEFAULT_SUBSCRIPTION_PLANS:
            plan = SubscriptionPlan(**plan_dict)
            plan.id = f"default-{plan.tier.value}"
            plans_data.append({
                "id": plan.id,
                "name": plan.name,
                "tier": plan.tier.value,
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


@router.get("/pricing")
async def get_api_pricing(
    request: Request,
    provider: Optional[str] = Query(None, description="API provider")
) -> Dict[str, Any]:
    """Get API pricing information."""
    
    # Try to extract user from the request using middleware
    user_id = None
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from middleware.auth_middleware import clerk_auth
            token = auth_header.replace("Bearer ", "")
            user = await clerk_auth.verify_token(token)
            if user:
                user_id = user.get("user_id") or user.get("clerk_user_id") or user.get("id")
        except Exception as e:
            logger.error(f"Error extracting user for pricing: {e}")

    pricing_list = []
    
    if user_id:
        db = get_session_for_user(user_id)
        if db:
            try:
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
            except Exception as e:
                logger.error(f"Error fetching pricing from db: {e}")
            finally:
                db.close()
                
    if not pricing_list:
        # We can implement a fallback for pricing, but for now just return empty or error
        # A more robust fallback would use the static pricing maps but that is outside scope
        logger.warning("Unauthenticated pricing request, returning empty list")

    return {
        "success": True,
        "data": {
            "pricing": pricing_list,
            "total": len(pricing_list)
        }
    }

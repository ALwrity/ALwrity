"""
Dashboard endpoints for comprehensive usage monitoring.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import datetime
from loguru import logger

from services.database import get_db
from services.subscription import UsageTrackingService, PricingService
from models.subscription_models import UsageAlert, UserSubscription
from middleware.auth_middleware import get_current_user
from ..dependencies import verify_user_access
from ..cache import get_cached_dashboard, set_cached_dashboard

router = APIRouter()


@router.get("/dashboard/{user_id}")
async def get_dashboard_data(
    user_id: str,
    billing_period: str = None,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get comprehensive dashboard data for usage monitoring.
    Returns all-time total + current period usage by default.
    When billing_period is specified, returns that period's data only."""

    verify_user_access(user_id, current_user)
    
    try:
        # Check cache first (only for default view, skip when a specific period is requested)
        cached_data = get_cached_dashboard(user_id)
        if cached_data and not billing_period:
            return cached_data

        usage_service = UsageTrackingService(db)
        pricing_service = PricingService(db)
        
        # When a specific billing_period is requested, show only that period's data
        # Otherwise show all-time total + current period usage
        if billing_period:
            period_usage = usage_service.get_usage_for_period(user_id, billing_period)
            total_usage = period_usage
            current_period_usage = period_usage
        else:
            total_usage = usage_service.get_user_usage_stats(user_id, None)
            current_period_usage = usage_service.get_current_period_usage(user_id)
        
        # Get usage trends (last 6 months)
        trends = usage_service.get_usage_trends(user_id, 6)
        
        # Get user limits
        limits = pricing_service.get_user_limits(user_id)
        
        # Get unread alerts
        alerts_query = db.query(UsageAlert).filter(
            UsageAlert.user_id == user_id,
            UsageAlert.is_read == False
        )
        if billing_period:
            alerts_query = alerts_query.filter(UsageAlert.billing_period == billing_period)
            
        alerts = alerts_query.order_by(UsageAlert.created_at.desc()).limit(5).all()
        
        alerts_data = [
            {
                "id": alert.id,
                "type": alert.alert_type,
                "title": alert.title,
                "message": alert.message,
                "severity": alert.severity,
                "created_at": alert.created_at.isoformat()
            }
            for alert in alerts
        ]
        
        # Calculate cost projections (only relevant for current month)
        current_cost = total_usage.get('total_cost', 0)
        days_in_period = 30
        current_day = datetime.now().day
        
        # Determine if viewing current period based on subscription, not calendar
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.is_active == True
        ).first()
        
        # Use subscription's billing period or fallback to calendar
        if subscription and subscription.current_period_start:
            sub_period = subscription.current_period_start.strftime("%Y-%m")
            calendar_period = datetime.now().strftime("%Y-%m")
            
            # Check if we have data for subscription period or calendar period
            from models.subscription_models import UsageSummary
            sub_data_exists = db.query(UsageSummary).filter(
                UsageSummary.user_id == user_id,
                UsageSummary.billing_period == sub_period
            ).first()
            
            # Determine which period to use for "current"
            if sub_data_exists:
                effective_period = sub_period
            else:
                # Check calendar period for backward compatibility
                cal_data_exists = db.query(UsageSummary).filter(
                    UsageSummary.user_id == user_id,
                    UsageSummary.billing_period == calendar_period
                ).first()
                effective_period = calendar_period if cal_data_exists else sub_period
            
            is_current_period = not billing_period or billing_period == effective_period
        else:
            is_current_period = not billing_period or billing_period == datetime.now().strftime("%Y-%m")
        
        if is_current_period:
            projected_cost = (current_cost / current_day) * days_in_period if current_day > 0 else 0
        else:
            projected_cost = current_cost # For past months, projected is actual
        
        response_payload = {
            "success": True,
            "data": {
                "total_usage": total_usage,
                "current_period_usage": current_period_usage,
                "trends": trends,
                "limits": limits,
                "alerts": alerts_data,
                "projections": {
                    "projected_monthly_cost": round(projected_cost, 2),
                    "cost_limit": limits.get('limits', {}).get('monthly_cost', 0) if limits else 0,
                    "projected_usage_percentage": (projected_cost / max(limits.get('limits', {}).get('monthly_cost', 1), 1)) * 100 if limits else 0
                },
                "summary": {
                    "total_api_calls_this_month": total_usage.get('total_calls', 0),
                    "total_cost_this_month": total_usage.get('total_cost', 0),
                    "usage_status": total_usage.get('usage_status', 'active'),
                    "unread_alerts": len(alerts_data)
                }
            }
        }
        
        # Cache the response only for default view
        if not billing_period:
            set_cached_dashboard(user_id, response_payload)
            
        return response_payload
    
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": {
                "total_usage": {"total_calls": 0, "total_cost": 0, "usage_status": "error", "provider_breakdown": {}},
                "current_period_usage": {"total_calls": 0, "total_cost": 0, "usage_status": "error", "provider_breakdown": {}, "usage_percentages": {}},
                "trends": [],
                "limits": {"limits": {"monthly_cost": 0}},
                "alerts": [],
                "projections": {"projected_monthly_cost": 0, "cost_limit": 0, "projected_usage_percentage": 0},
                "summary": {"total_api_calls_this_month": 0, "total_cost_this_month": 0, "usage_status": "error", "unread_alerts": 0}
            }
        }

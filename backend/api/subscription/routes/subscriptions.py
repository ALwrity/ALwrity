"""
User subscription management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import datetime, timedelta
from loguru import logger

from services.database import get_db
from services.subscription import UsageTrackingService, PricingService
from services.user_workspace_manager import UserWorkspaceManager
from middleware.auth_middleware import get_current_user
from models.subscription_models import (
    SubscriptionPlan, UserSubscription, UsageSummary,
    SubscriptionTier, BillingCycle, UsageStatus, SubscriptionRenewalHistory
)
from ..dependencies import verify_user_access
from ..utils import enum_value, format_plan_limits

router = APIRouter()


@router.get("/user/{user_id}/subscription")
async def get_user_subscription(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get user's current subscription information."""
    
    verify_user_access(user_id, current_user)
    
    try:
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.is_active == True
        ).first()
        
        if not subscription:
            # Return free tier information
            free_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.tier == SubscriptionTier.FREE
            ).first()
            
            if free_plan:
                return {
                    "success": True,
                    "data": {
                        "subscription": None,
                        "plan": {
                            "id": free_plan.id,
                            "name": free_plan.name,
                            "tier": free_plan.tier.value,
                            "price_monthly": free_plan.price_monthly,
                            "description": free_plan.description,
                            "is_free": True
                        },
                        "status": "free",
                        "limits": format_plan_limits(free_plan)
                    }
                }
            else:
                raise HTTPException(status_code=404, detail="No subscription plan found")
        
        return {
            "success": True,
            "data": {
                "subscription": {
                    "id": subscription.id,
                    "billing_cycle": subscription.billing_cycle.value,
                    "current_period_start": subscription.current_period_start.isoformat(),
                    "current_period_end": subscription.current_period_end.isoformat(),
                    "status": subscription.status.value,
                    "auto_renew": subscription.auto_renew,
                    "created_at": subscription.created_at.isoformat()
                },
                "plan": {
                    "id": subscription.plan.id,
                    "name": subscription.plan.name,
                    "tier": subscription.plan.tier.value,
                    "price_monthly": subscription.plan.price_monthly,
                    "price_yearly": subscription.plan.price_yearly,
                    "description": subscription.plan.description,
                    "is_free": False
                },
                "limits": format_plan_limits(subscription.plan)
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting user subscription: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": {
                "subscription": None,
                "plan": {
                    "id": "error_fallback",
                    "name": "Error Fallback",
                    "tier": "free",
                    "price_monthly": 0,
                    "description": "Unable to load subscription details",
                    "is_free": True
                },
                "status": "error",
                "limits": {}
            }
        }


@router.get("/status/{user_id}")
async def get_subscription_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get simple subscription status for enforcement checks."""

    verify_user_access(user_id, current_user)

    try:
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.is_active == True
        ).first()

        if not subscription:
            # Check if free tier exists
            free_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.tier == SubscriptionTier.FREE,
                SubscriptionPlan.is_active == True
            ).first()

            if free_plan:
                return {
                    "success": True,
                    "data": {
                        "active": True,
                        "plan": "free",
                        "tier": "free",
                        "can_use_api": True,
                        "limits": format_plan_limits(free_plan)
                    }
                }
            else:
                return {
                    "success": True,
                    "data": {
                        "active": False,
                        "plan": "none",
                        "tier": "none",
                        "can_use_api": False,
                        "reason": "No active subscription or free tier found"
                    }
                }

        # Check if subscription is within valid period; auto-advance if expired and auto_renew
        now = datetime.utcnow()
        if subscription.current_period_end < now:
            if getattr(subscription, 'auto_renew', False):
                # advance period
                try:
                    from services.subscription.pricing_service import PricingService
                    pricing = PricingService(db)
                    # reuse helper to ensure current
                    pricing._ensure_subscription_current(subscription)
                except Exception as e:
                    logger.error(f"Failed to auto-advance subscription: {e}")
            else:
                return {
                    "success": True,
                    "data": {
                        "active": False,
                        "plan": subscription.plan.tier.value,
                        "tier": subscription.plan.tier.value,
                        "can_use_api": False,
                        "reason": "Subscription expired"
                    }
                }

        return {
            "success": True,
            "data": {
                "active": True,
                "plan": subscription.plan.tier.value,
                "tier": subscription.plan.tier.value,
                "can_use_api": True,
                "limits": format_plan_limits(subscription.plan)
            }
        }

    except Exception as e:
        logger.error(f"Error getting subscription status: {e}", exc_info=True)
        return {
            "success": True,
            "data": {
                "active": False,
                "plan": "none",
                "tier": "none",
                "can_use_api": False,
                "reason": f"Failed to check subscription status: {str(e)}"
            }
        }


@router.post("/subscribe/{user_id}")
async def subscribe_to_plan(
    user_id: str,
    subscription_data: dict,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create or update a user's subscription (renewal)."""
    
    verify_user_access(user_id, current_user)

    try:
        from services.database.init_db import init_user_database

        init_user_database(user_id)
        plan_id = subscription_data.get("plan_id")
        tier_hint = subscription_data.get("tier")
        billing_cycle = subscription_data.get("billing_cycle", "monthly")

        if not plan_id and not tier_hint:
            raise HTTPException(status_code=400, detail="plan_id or tier is required")

        plan = None
        if plan_id:
            plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.id == plan_id,
                SubscriptionPlan.is_active == True,
            ).first()

        if not plan and tier_hint:
            try:
                tier_enum = SubscriptionTier(str(tier_hint).strip().lower())
                plan = db.query(SubscriptionPlan).filter(
                    SubscriptionPlan.tier == tier_enum,
                    SubscriptionPlan.is_active == True,
                ).first()
                if plan:
                    plan_id = plan.id
                    logger.info(
                        f"[SUBSCRIPTION] Resolved plan by tier={tier_hint} "
                        f"plan_id={plan_id} user_id={user_id}"
                    )
            except ValueError:
                logger.warning(
                    f"[SUBSCRIPTION] Invalid tier hint tier={tier_hint} user_id={user_id}"
                )

        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")

        # Check if user already has an active subscription
        existing_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.is_active == True
        ).first()

        now = datetime.utcnow()
        
        # Track renewal history - capture BEFORE updating subscription
        previous_period_start = None
        previous_period_end = None
        previous_plan_name = None
        previous_plan_tier = None
        renewal_type = "new"
        renewal_count = 0
        
        # Get usage snapshot BEFORE renewal (capture current state)
        usage_before_snapshot = None
        current_period = datetime.utcnow().strftime("%Y-%m")
        usage_before = db.query(UsageSummary).filter(
            UsageSummary.user_id == user_id,
            UsageSummary.billing_period == current_period
        ).first()
        
        if usage_before:
            usage_before_snapshot = {
                "total_calls": usage_before.total_calls or 0,
                "total_tokens": usage_before.total_tokens or 0,
                "total_cost": float(usage_before.total_cost) if usage_before.total_cost else 0.0,
                "gemini_calls": usage_before.gemini_calls or 0,
                "mistral_calls": usage_before.mistral_calls or 0,
                "usage_status": enum_value(usage_before.usage_status, "active"),
            }
        
        if existing_subscription:
            # This is a renewal/update - capture previous subscription state BEFORE updating
            previous_period_start = existing_subscription.current_period_start
            previous_period_end = existing_subscription.current_period_end
            previous_plan = existing_subscription.plan
            previous_plan_name = previous_plan.name if previous_plan else None
            previous_plan_tier = enum_value(previous_plan.tier) if previous_plan else None
            
            # Determine renewal type
            if previous_plan and previous_plan.id == plan_id:
                # Same plan - this is a renewal
                renewal_type = "renewal"
            elif previous_plan:
                # Different plan - check if upgrade or downgrade
                tier_order = {"free": 0, "basic": 1, "pro": 2, "enterprise": 3}
                previous_tier_order = tier_order.get(previous_plan_tier or "free", 0)
                new_tier_order = tier_order.get(enum_value(plan.tier, "free"), 0)
                if new_tier_order > previous_tier_order:
                    renewal_type = "upgrade"
                elif new_tier_order < previous_tier_order:
                    renewal_type = "downgrade"
                else:
                    renewal_type = "renewal"  # Same tier, different plan name
            
            # Get renewal count (how many times this user has renewed)
            last_renewal = db.query(SubscriptionRenewalHistory).filter(
                SubscriptionRenewalHistory.user_id == user_id
            ).order_by(SubscriptionRenewalHistory.created_at.desc()).first()
            
            if last_renewal:
                renewal_count = last_renewal.renewal_count + 1
            else:
                renewal_count = 1  # First renewal
            
            # Update existing subscription
            existing_subscription.plan_id = plan_id
            existing_subscription.billing_cycle = BillingCycle(billing_cycle)
            existing_subscription.current_period_start = now
            existing_subscription.current_period_end = now + timedelta(
                days=365 if billing_cycle == 'yearly' else 30
            )
            existing_subscription.status = UsageStatus.ACTIVE
            existing_subscription.is_active = True
            existing_subscription.updated_at = now

            subscription = existing_subscription
        else:
            # Create new subscription
            subscription = UserSubscription(
                user_id=user_id,
                plan_id=plan_id,
                billing_cycle=BillingCycle(billing_cycle),
                current_period_start=now,
                current_period_end=now + timedelta(
                    days=365 if billing_cycle == 'yearly' else 30
                ),
                status=UsageStatus.ACTIVE,
                is_active=True,
                auto_renew=True
            )
            db.add(subscription)
            
            # Ensure user workspace exists for new subscribers
            # MOVED: Workspace creation is now handled exclusively in the onboarding flow 
            # to prevent premature creation before plan selection/onboarding.
            # See onboarding_control_service.py
            # try:
            #     logger.info(f"Creating workspace for new subscriber {user_id}")
            #     workspace_manager = UserWorkspaceManager(db)
            #     workspace_manager.create_user_workspace(user_id)
            # except Exception as ws_error:
            #     logger.error(f"Failed to create workspace for new subscriber {user_id}: {ws_error}")
            #     # Don't fail the subscription if workspace creation fails, but log it
        
        db.commit()
        
        # Create renewal history record AFTER subscription update (so we have the new period_end)
        renewal_history = SubscriptionRenewalHistory(
            user_id=user_id,
            plan_id=plan_id,
            plan_name=plan.name,
            plan_tier=enum_value(plan.tier),
            previous_period_start=previous_period_start,
            previous_period_end=previous_period_end,
            new_period_start=now,
            new_period_end=subscription.current_period_end,
            billing_cycle=BillingCycle(billing_cycle),
            renewal_type=renewal_type,
            renewal_count=renewal_count,
            previous_plan_name=previous_plan_name,
            previous_plan_tier=previous_plan_tier,
            usage_before_renewal=usage_before_snapshot,  # Usage snapshot captured BEFORE renewal
            payment_amount=plan.price_yearly if billing_cycle == 'yearly' else plan.price_monthly,
            payment_status="paid",  # Assume paid for now (can be updated if payment processing is added)
            payment_date=now
        )
        db.add(renewal_history)
        db.commit()

        # Best-effort, non-blocking plan-change email. Only for actual plan
        # changes (upgrade/downgrade), never plain renewals or new signups.
        if renewal_type in ("upgrade", "downgrade"):
            try:
                from services.subscription.billing_email import send_billing_email
                first_name = str(current_user.get("first_name") or current_user.get("username") or "")
                send_billing_email(
                    user_id,
                    db=db,
                    first_name=first_name,
                    kind="plan_change",
                    event_ref=f"subscribe-{now.strftime('%Y%m%d%H%M%S')}",
                    payload_extra={
                        "previous_plan_name": previous_plan_name or "",
                        "previous_plan_tier": previous_plan_tier or "",
                        "renewal_type": renewal_type,
                        "price": str(plan.price_yearly if billing_cycle == 'yearly' else plan.price_monthly),
                    },
                )
                logger.info(f"Plan-change email ({renewal_type}) sent for user {user_id}")
            except Exception as email_err:
                logger.warning(f"Plan-change email skipped for {user_id}: {email_err}")

        # Best-effort, non-blocking renewal-receipt email for same-plan renewals.
        if renewal_type == "renewal":
            try:
                from services.subscription.billing_email import send_billing_email
                first_name = str(current_user.get("first_name") or current_user.get("username") or "")
                period_start_ts = str(int(now.timestamp()))
                period_end_ts = str(int(subscription.current_period_end.timestamp())) if subscription.current_period_end else ""
                send_billing_email(
                    user_id,
                    db=db,
                    first_name=first_name,
                    kind="renewal_receipt",
                    event_ref=f"subscribe-renewal-{now.strftime('%Y%m%d%H%M%S')}",
                    payload_extra={
                        "price": str(plan.price_yearly if billing_cycle == 'yearly' else plan.price_monthly),
                        "period_start": period_start_ts,
                        "period_end": period_end_ts,
                    },
                )
                logger.info(f"Renewal-receipt email sent for user {user_id}")
            except Exception as email_err:
                logger.warning(f"Renewal-receipt email skipped for {user_id}: {email_err}")

        # Get current usage BEFORE reset for logging
        current_period = datetime.utcnow().strftime("%Y-%m")
        usage_before = db.query(UsageSummary).filter(
            UsageSummary.user_id == user_id,
            UsageSummary.billing_period == current_period
        ).first()
        
        # Log renewal request details
        logger.info("=" * 80)
        logger.info(f"[SUBSCRIPTION RENEWAL] 🔄 Processing renewal request")
        logger.info(f"   ├─ User: {user_id}")
        logger.info(f"   ├─ Plan: {plan.name} (ID: {plan_id}, Tier: {enum_value(plan.tier)})")
        logger.info(f"   ├─ Billing Cycle: {billing_cycle}")
        logger.info(f"   ├─ Period Start: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"   └─ Period End: {subscription.current_period_end.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if usage_before:
            logger.info(f"   📊 Current Usage BEFORE Reset (Period: {current_period}):")
            logger.info(f"      ├─ Gemini: {usage_before.gemini_tokens or 0} tokens / {usage_before.gemini_calls or 0} calls")
            logger.info(f"      ├─ Mistral/HF: {usage_before.mistral_tokens or 0} tokens / {usage_before.mistral_calls or 0} calls")
            logger.info(f"      ├─ OpenAI: {usage_before.openai_tokens or 0} tokens / {usage_before.openai_calls or 0} calls")
            logger.info(f"      ├─ Stability (Images): {usage_before.stability_calls or 0} calls")
            logger.info(f"      ├─ Total Tokens: {usage_before.total_tokens or 0}")
            logger.info(f"      ├─ Total Calls: {usage_before.total_calls or 0}")
            logger.info(f"      └─ Usage Status: {enum_value(usage_before.usage_status, 'active')}")
        else:
            logger.info(f"   📊 No usage summary found for period {current_period} (will be created on reset)")

        # Clear subscription limits cache to force refresh on next check
        # IMPORTANT: Do this BEFORE resetting usage to ensure cache is cleared first
        try:
            from services.subscription import PricingService
            # Clear cache for this specific user (class-level cache shared across all instances)
            cleared_count = PricingService.clear_user_cache(user_id)
            logger.info(f"   🗑️  Cleared {cleared_count} subscription cache entries for user {user_id}")
            
            # Also expire all SQLAlchemy objects to force fresh reads
            db.expire_all()
            logger.info(f"   🔄 Expired all SQLAlchemy objects to force fresh reads")
        except Exception as cache_err:
            logger.error(f"   ❌ Failed to clear cache after subscribe: {cache_err}")

        # Reset usage status for current billing period so new plan takes effect immediately
        reset_result = None
        try:
            usage_service = UsageTrackingService(db)
            reset_result = await usage_service.reset_current_billing_period(user_id)
            
            # Force commit to ensure reset is persisted
            db.commit()
            
            # Expire all SQLAlchemy objects to force fresh reads
            db.expire_all()
            
            # Re-query usage summary from DB after reset to get fresh data (fresh query)
            usage_after = db.query(UsageSummary).filter(
                UsageSummary.user_id == user_id,
                UsageSummary.billing_period == current_period
            ).first()
            
            # Refresh the usage object if found to ensure we have latest data
            if usage_after:
                db.refresh(usage_after)
            
            if reset_result.get('reset'):
                logger.info(f"   ✅ Usage counters RESET successfully")
                if usage_after:
                    logger.info(f"   📊 New Usage AFTER Reset:")
                    logger.info(f"      ├─ Gemini: {usage_after.gemini_tokens or 0} tokens / {usage_after.gemini_calls or 0} calls")
                    logger.info(f"      ├─ Mistral/HF: {usage_after.mistral_tokens or 0} tokens / {usage_after.mistral_calls or 0} calls")
                    logger.info(f"      ├─ OpenAI: {usage_after.openai_tokens or 0} tokens / {usage_after.openai_calls or 0} calls")
                    logger.info(f"      ├─ Stability (Images): {usage_after.stability_calls or 0} calls")
                    logger.info(f"      ├─ Total Tokens: {usage_after.total_tokens or 0}")
                    logger.info(f"      ├─ Total Calls: {usage_after.total_calls or 0}")
                    logger.info(f"      └─ Usage Status: {enum_value(usage_after.usage_status, 'active')}")
                else:
                    logger.warning(f"   ⚠️  Usage summary not found after reset - may need to be created on next API call")
            else:
                logger.warning(f"   ⚠️  Reset returned: {reset_result.get('reason', 'unknown')}")
        except Exception as reset_err:
            logger.error(f"   ❌ Failed to reset usage after subscribe: {reset_err}", exc_info=True)
        
        # Ensure user workspace is created/verified upon subscription
        try:
            workspace_manager = UserWorkspaceManager(db)
            workspace_manager.create_user_workspace(user_id)
            logger.info(f"   ✅ User workspace verified/created for user {user_id}")
        except Exception as ws_err:
            # Log but don't fail the subscription response, as workspace can be created later
            logger.error(f"   ⚠️ Failed to create user workspace during subscription: {ws_err}")

        logger.info(f"   ✅ Renewal completed: User {user_id} → {plan.name} ({billing_cycle})")
        logger.info("=" * 80)

        return {
            "success": True,
            "message": f"Successfully subscribed to {plan.name}",
            "data": {
                "subscription_id": subscription.id,
                "plan_name": plan.name,
                "billing_cycle": billing_cycle,
                "current_period_start": subscription.current_period_start.isoformat(),
                "current_period_end": subscription.current_period_end.isoformat(),
                "status": enum_value(subscription.status, "active"),
                "limits": format_plan_limits(plan)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error subscribing to plan: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/renewal-history/{user_id}")
async def get_renewal_history(
    user_id: str,
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get subscription renewal history for a user.
    
    Automatically applies retention policies:
    - Compresses usage snapshots for records 12-24 months old
    - Removes usage snapshots for records 24-84 months old
    - Preserves payment data indefinitely
    
    Returns:
        - List of renewal history records
        - Total count for pagination
    """
    try:
        verify_user_access(user_id, current_user)
        
        # Apply retention policies before fetching
        from services.subscription.renewal_history_retention import RenewalHistoryRetentionService
        retention_service = RenewalHistoryRetentionService(db)
        retention_result = retention_service.check_and_apply_retention(user_id)
        if retention_result.get('retention_applied'):
            logger.info(f"[RenewalHistory] Retention applied for user {user_id}: {retention_result.get('message')}")
        
        # Get total count
        total_count = db.query(SubscriptionRenewalHistory).filter(
            SubscriptionRenewalHistory.user_id == user_id
        ).count()
        
        # Get paginated results, ordered by created_at descending (most recent first)
        renewals = db.query(SubscriptionRenewalHistory).filter(
            SubscriptionRenewalHistory.user_id == user_id
        ).order_by(SubscriptionRenewalHistory.created_at.desc()).offset(offset).limit(limit).all()
        
        # Format renewal history for response
        renewal_history = []
        for renewal in renewals:
            renewal_history.append({
                'id': renewal.id,
                'plan_name': renewal.plan_name,
                'plan_tier': renewal.plan_tier,
                'previous_period_start': renewal.previous_period_start.isoformat() if renewal.previous_period_start else None,
                'previous_period_end': renewal.previous_period_end.isoformat() if renewal.previous_period_end else None,
                'new_period_start': renewal.new_period_start.isoformat() if renewal.new_period_start else None,
                'new_period_end': renewal.new_period_end.isoformat() if renewal.new_period_end else None,
                'billing_cycle': renewal.billing_cycle.value if renewal.billing_cycle else None,
                'renewal_type': renewal.renewal_type,
                'renewal_count': renewal.renewal_count,
                'previous_plan_name': renewal.previous_plan_name,
                'previous_plan_tier': renewal.previous_plan_tier,
                'usage_before_renewal': renewal.usage_before_renewal,
                'payment_amount': float(renewal.payment_amount) if renewal.payment_amount else 0.0,
                'payment_status': renewal.payment_status,
                'payment_date': renewal.payment_date.isoformat() if renewal.payment_date else None,
                'created_at': renewal.created_at.isoformat() if renewal.created_at else None
            })
        
        return {
            "success": True,
            "data": {
                "renewals": renewal_history,
                "total_count": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": (offset + limit) < total_count
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting renewal history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/renewal-history/{user_id}/retention-stats")
async def get_renewal_retention_stats(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get retention statistics for a user's renewal history.
    
    Returns breakdown by retention tier:
    - Recent records (0-12 months): Full records with usage snapshots
    - To compress (12-24 months): Records that need snapshot compression
    - To summarize (24-84 months): Records that need snapshot removal
    - To archive (84+ months): Records ready for archive
    """
    try:
        verify_user_access(user_id, current_user)
        
        from services.subscription.renewal_history_retention import RenewalHistoryRetentionService
        retention_service = RenewalHistoryRetentionService(db)
        stats = retention_service.get_retention_stats(user_id)
        
        return {
            "success": True,
            "data": stats
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting renewal retention stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

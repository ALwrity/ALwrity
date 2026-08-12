from fastapi import APIRouter, Depends, HTTPException, Request, Header, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel
from services.database import get_db

from middleware.auth_middleware import get_current_user
from loguru import logger
from models.subscription_models import SubscriptionTier, BillingCycle
import time
from collections import defaultdict

router = APIRouter()

class CreateCheckoutSessionRequest(BaseModel):
    tier: SubscriptionTier
    billing_cycle: BillingCycle
    success_url: str
    cancel_url: str

class CreatePortalSessionRequest(BaseModel):
    return_url: str


_checkout_rate_limit_window_seconds = 60
_checkout_rate_limit_max_requests = 10
_checkout_attempts_by_user: Dict[str, Any] = defaultdict(list)

@router.post("/create-checkout-session")
async def create_checkout_session(
    payload: CreateCheckoutSessionRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request: Request = None
):
    """
    Create a Stripe Checkout Session for subscription.
    """
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    now = time.time()
    attempts = _checkout_attempts_by_user[user_id]
    window_start = now - _checkout_rate_limit_window_seconds
    attempts[:] = [ts for ts in attempts if ts >= window_start]
    attempts.append(now)
    _checkout_attempts_by_user[user_id] = attempts
    if len(attempts) > _checkout_rate_limit_max_requests:
        client_ip = request.client.host if request and request.client else "unknown"
        logger.warning(f"Checkout rate limit exceeded for user_id={user_id}, ip={client_ip}, attempts={len(attempts)} in { _checkout_rate_limit_window_seconds }s")
        raise HTTPException(status_code=429, detail="Too many checkout attempts. Please try again shortly.")

    user_email = current_user.get("email")

    from services.subscription.stripe_service import StripeService
    stripe_service = StripeService(db)
    
    try:
        url = stripe_service.create_checkout_session(
            user_id=user_id,
            tier=payload.tier,
            billing_cycle=payload.billing_cycle,
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
            user_email=user_email
        )
        return {"url": url}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate checkout")

@router.post("/create-portal-session")
async def create_portal_session(
    payload: CreatePortalSessionRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a Stripe Customer Portal session for managing billing.
    """
    user_id = current_user.get("sub") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    from services.subscription.stripe_service import StripeService
    stripe_service = StripeService(db)
    
    try:
        url = stripe_service.create_portal_session(
            user_id=user_id,
            return_url=payload.return_url
        )
        return {"url": url}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error creating portal session: {e}")
        raise HTTPException(status_code=500, detail="Failed to access billing portal")

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Handle Stripe webhooks.
    """
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    payload = await request.body()

    from services.subscription.stripe_service import StripeService
    stripe_service = StripeService(db)
    
    try:
        # We need to run this potentially in background or await it
        # Since it's async, we can await it directly.
        await stripe_service.handle_webhook(payload, stripe_signature)
        return {"status": "success"}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

@router.get("/verify-checkout/{user_id}")
async def verify_checkout_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request: Request = None
) -> Dict[str, Any]:
    """
    Directly query Stripe for user's current subscription status.
    Used during post-checkout polling to get fresh data without waiting for webhooks.
    
    Rate limited: 5 requests per minute per user to prevent abuse.
    """
    from ..dependencies import verify_user_access
    from models.subscription_models import UserSubscription, SubscriptionPlan, SubscriptionTier
    from services.subscription import PricingService
    from api.subscription.utils import format_plan_limits
    from datetime import datetime
    
    verify_user_access(user_id, current_user)
    
    # Rate limiting: 5 requests per minute per user
    now = time.time()
    window_start = now - 60  # 1 minute window
    if user_id not in _checkout_attempts_by_user:
        _checkout_attempts_by_user[user_id] = []
    attempts = _checkout_attempts_by_user[user_id]
    attempts[:] = [ts for ts in attempts if ts >= window_start]
    attempts.append(now)
    _checkout_attempts_by_user[user_id] = attempts
    
    if len(attempts) > 5:
        client_ip = request.client.host if request and request.client else "unknown"
        logger.warning(f"Verify-checkout rate limit exceeded for user_id={user_id}, ip={client_ip}")
        raise HTTPException(status_code=429, detail="Too many verification requests. Please wait before trying again.")

    from services.subscription.stripe_service import StripeService
    stripe_service = StripeService(db)
    
    try:
        # First, try to find user in local DB
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()
        
        stripe_customer_id = subscription.stripe_customer_id if subscription else None
        
        # If no stripe_customer_id in DB, try to find it by email or metadata
        if not stripe_customer_id:
            try:
                import stripe
                # Get user email from auth context
                user_email = current_user.get("email")
                if user_email:
                    customers = stripe.Customer.list(email=user_email, limit=1)
                    if customers and customers.data:
                        stripe_customer_id = customers.data[0].id
                        logger.info(f"Verify-checkout: Found Stripe customer by email for user {user_id}")
                        
                        # Update DB with found customer ID
                        if subscription:
                            subscription.stripe_customer_id = stripe_customer_id
                            db.commit()
                        else:
                            logger.info(f"Verify-checkout: No local subscription record for user {user_id}, will query Stripe directly")
                
                # Fallback: search by metadata user_id (handles email mismatches)
                if not stripe_customer_id:
                    customers = stripe.Customer.search(
                        query=f"metadata['user_id']:'{user_id}'",
                        limit=1
                    )
                    if customers and customers.data:
                        stripe_customer_id = customers.data[0].id
                        logger.info(f"Verify-checkout: Found Stripe customer by metadata user_id for user {user_id}")
                        
                        if subscription:
                            subscription.stripe_customer_id = stripe_customer_id
                            db.commit()
            except Exception as lookup_err:
                logger.warning(f"Failed to find Stripe customer by email or metadata: {lookup_err}")
        
        # If user has a Stripe customer ID, query Stripe directly
        if stripe_customer_id:
            try:
                import stripe
                stripe_subscriptions = stripe.Subscription.list(
                    customer=stripe_customer_id,
                    status="active",
                    limit=1
                )
                
                if stripe_subscriptions and stripe_subscriptions.data:
                    stripe_sub = stripe_subscriptions.data[0]
                    price_id = stripe_sub['items']['data'][0]['price']['id']
                    
                    logger.info(f"Verify-checkout: Found active Stripe subscription for user {user_id}, plan from price {price_id}")
                    
                    # Update local DB with fresh Stripe data
                    stripe_service._update_user_subscription(
                        user_id,
                        stripe_customer_id=stripe_customer_id,
                        stripe_subscription_id=stripe_sub.id,
                        status="active",
                        price_id=price_id
                    )
                    
                    # Clear caches
                    try:
                        PricingService.clear_user_cache(user_id)
                    except Exception:
                        pass
                    try:
                        from api.subscription.cache import clear_dashboard_cache
                        clear_dashboard_cache(user_id)
                    except Exception:
                        pass
                    
                    db.expire_all()
                    
                    # Re-query with fresh data
                    subscription = db.query(UserSubscription).filter(
                        UserSubscription.user_id == user_id,
                        UserSubscription.is_active == True
                    ).first()
                    
                    if subscription:
                        return {
                            "success": True,
                            "data": {
                                "active": True,
                                "plan": subscription.plan.tier.value,
                                "tier": subscription.plan.tier.value,
                                "can_use_api": True,
                                "limits": format_plan_limits(subscription.plan),
                                "source": "stripe_direct"
                            }
                        }
            except Exception as stripe_err:
                logger.warning(f"Failed to query Stripe directly for user {user_id}: {stripe_err}")
        
        # Fallback: search Stripe subscriptions by metadata user_id (handles cases where
        # customer was created without metadata or email doesn't match)
        if not stripe_customer_id or not subscription:
            try:
                import stripe
                meta_subs = stripe.Subscription.search(
                    query=f"status:'active' AND metadata['user_id']:'{user_id}'",
                    limit=1
                )
                if meta_subs and meta_subs.data:
                    stripe_sub = meta_subs.data[0]
                    stripe_customer_id = stripe_sub.customer
                    price_id = stripe_sub['items']['data'][0]['price']['id']
                    
                    logger.info(f"Verify-checkout: Found subscription by metadata user_id for user {user_id}")
                    
                    stripe_service._update_user_subscription(
                        user_id,
                        stripe_customer_id=stripe_customer_id,
                        stripe_subscription_id=stripe_sub.id,
                        status="active",
                        price_id=price_id
                    )
                    
                    try:
                        PricingService.clear_user_cache(user_id)
                    except Exception:
                        pass
                    
                    db.expire_all()
                    
                    subscription = db.query(UserSubscription).filter(
                        UserSubscription.user_id == user_id,
                        UserSubscription.is_active == True
                    ).first()
                    
                    if subscription:
                        return {
                            "success": True,
                            "data": {
                                "active": True,
                                "plan": subscription.plan.tier.value,
                                "tier": subscription.plan.tier.value,
                                "can_use_api": True,
                                "limits": format_plan_limits(subscription.plan),
                                "source": "stripe_direct_metadata"
                            }
                        }
            except Exception as meta_err:
                logger.warning(f"Failed to find subscription by metadata for user {user_id}: {meta_err}")
        
        # Fallback to local DB status
        if subscription and subscription.is_active:
            from services.subscription.pricing_service import PricingService
            pricing = PricingService(db)
            try:
                pricing._ensure_subscription_current(subscription)
            except Exception:
                pass
            
            return {
                "success": True,
                "data": {
                    "active": True,
                    "plan": subscription.plan.tier.value,
                    "tier": subscription.plan.tier.value,
                    "can_use_api": True,
                    "limits": format_plan_limits(subscription.plan),
                    "source": "local_db"
                }
            }
        
        # No active subscription - return free tier
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
                    "limits": format_plan_limits(free_plan),
                    "source": "free_tier"
                }
            }
        
        return {
            "success": True,
            "data": {
                "active": False,
                "plan": "none",
                "tier": "none",
                "can_use_api": False,
                "reason": "No active subscription found",
                "source": "none"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying checkout status for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to verify subscription: {str(e)}")

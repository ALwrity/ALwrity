"""
Usage Tracking Service - Refactored into modular components.

This file now serves as a facade that delegates to specialized modules
in the usage_tracking_modules package.

Modules:
- historical_usage: Functions for aggregating historical usage data
- usage_stats: Functions for getting user usage statistics  
- usage_trends: Functions for usage trend analysis
- limit_enforcement: Functions for enforcing usage limits
- alerts: Functions for usage alerts
"""

from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from loguru import logger
from datetime import datetime, timedelta
import time

from models.subscription_models import (
    APIProvider, UsageStatus, UserSubscription, 
    UsageSummary, APIUsageLog, UsageAlert
)
from services.subscription.pricing_service import PricingService
from services.subscription.provider_detection import detect_actual_provider
from services.subscription.usage_tracking_helpers import (
    build_provider_breakdown,
    build_default_usage_percentages,
    calculate_final_total_cost,
    maybe_persist_reconciled_costs,
    build_usage_trends_response,
    build_billing_periods,
    query_usage_summaries,
    self_heal_summaries_from_logs,
    reset_usage_summary_counters,
)
# Import clear_dashboard_cache lazily to avoid circular import
def _clear_dashboard_cache_for_user(user_id: str):
    from services.subscription.cache import clear_dashboard_cache as _clear
    return _clear(user_id)

from .usage_tracking_modules import (
    get_all_historical_usage,
    get_current_period_usage,
    get_usage_for_period,
    get_user_usage_stats,
    get_usage_trends,
    enforce_usage_limits,
    check_usage_alerts,
    create_usage_alert,
)


class UsageTrackingService:
    """Service for tracking API usage and managing billing information."""
    
    def __init__(self, db: Session):
        self.db = db
        self.pricing_service = PricingService(db)
        # TTL cache (30s) for enforcement results to cut DB chatter
        # key: f"{user_id}:{provider}", value: { 'result': (bool,str,dict), 'expires_at': datetime }
        self._enforce_cache: Dict[str, Dict[str, Any]] = {}
    
    def _get_authoritative_billing_period_keys(self, user_id: str, billing_period: Optional[str] = None) -> Dict[str, Any]:
        """Return authoritative billing period lookup keys. Always uses subscription period for consistency.
        Maintains backward compatibility with existing calendar-month data."""
        subscription = self.db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()
        
        # If caller explicitly requested a billing period, use it
        if billing_period:
            return {
                "billing_period": billing_period,
                "lookup_periods": [billing_period],
                "period_start": subscription.current_period_start if subscription else None,
                "period_end": subscription.current_period_end if subscription else None,
            }
        
        # Get subscription period if available
        subscription_period = None
        if subscription and subscription.current_period_start:
            subscription_period = subscription.current_period_start.strftime("%Y-%m")
        
        # Get calendar period
        calendar_period = datetime.now().strftime("%Y-%m")
        
        # Check which period has usage data
        from models.subscription_models import UsageSummary
        
        if subscription_period:
            # Check if data exists for subscription period
            sub_data = self.db.query(UsageSummary).filter(
                UsageSummary.user_id == user_id,
                UsageSummary.billing_period == subscription_period
            ).first()
            
            if sub_data:
                # Use subscription period (has data)
                return {
                    "billing_period": subscription_period,
                    "lookup_periods": [subscription_period],
                    "period_start": subscription.current_period_start,
                    "period_end": subscription.current_period_end,
                }
            
            # No data for subscription period, check calendar period (backward compatibility)
            if calendar_period != subscription_period:
                cal_data = self.db.query(UsageSummary).filter(
                    UsageSummary.user_id == user_id,
                    UsageSummary.billing_period == calendar_period
                ).first()
                
                if cal_data:
                    logger.info(f"Using calendar period {calendar_period} for backward compatibility (subscription period {subscription_period} has no data)")
                    return {
                        "billing_period": calendar_period,
                        "lookup_periods": [calendar_period],
                        "period_start": None,
                        "period_end": None,
                    }
            
            # No data in either period, use subscription period
            return {
                "billing_period": subscription_period,
                "lookup_periods": [subscription_period],
                "period_start": subscription.current_period_start,
                "period_end": subscription.current_period_end,
            }
        
        # No subscription, check for any existing data
        latest_summary = self.db.query(UsageSummary).filter(
            UsageSummary.user_id == user_id
        ).order_by(UsageSummary.billing_period.desc()).first()
        
        if latest_summary:
            logger.info(f"Using latest billing period from UsageSummary: {latest_summary.billing_period} for user {user_id}")
            return {
                "billing_period": latest_summary.billing_period,
                "lookup_periods": [latest_summary.billing_period],
                "period_start": None,
                "period_end": None,
            }
        
        # Last fallback to calendar month for free tier / no subscription
        return {
            "billing_period": calendar_period,
            "lookup_periods": [calendar_period],
            "period_start": None,
            "period_end": None,
        }
    
    # Delegate to modular functions
    def get_user_usage_stats(self, user_id: str, billing_period: str = None) -> Dict[str, Any]:
        """Get comprehensive usage statistics for a user."""
        return get_user_usage_stats(user_id, billing_period, self.db, self.pricing_service)
    
    def _get_all_historical_usage(self, user_id: str) -> Dict[str, Any]:
        """Get ALL historical usage data aggregated across all billing periods."""
        return get_all_historical_usage(user_id, self.db, self.pricing_service)

    def get_current_period_usage(self, user_id: str) -> Dict[str, Any]:
        """Get current billing period usage with correct per-period limit percentages."""
        return get_current_period_usage(user_id, self.db, self.pricing_service)

    def get_usage_for_period(self, user_id: str, billing_period: str) -> Dict[str, Any]:
        """Get usage for a specific billing period."""
        return get_usage_for_period(user_id, billing_period, self.db, self.pricing_service)
    
    def get_usage_trends(self, user_id: str, months: int = 6) -> Dict[str, Any]:
        """Get usage trends over time with self-healing from logs."""
        return get_usage_trends(user_id, months, self.db)

    async def reset_current_billing_period(self, user_id: str) -> Dict[str, Any]:
        """Reset usage counters for the user's current authoritative billing period.

        This method is called by subscription upgrade/downgrade flows so that new
        plan limits take effect immediately in the active billing period.
        """
        start_time = time.time()

        if not user_id:
            logger.error("[UsageTracking] reset_current_billing_period called without user_id")
            return {
                "reset": False,
                "reason": "missing_user_id",
            }

        try:
            period_keys = self._get_authoritative_billing_period_keys(user_id)
            billing_period = period_keys.get("billing_period")

            if not billing_period:
                logger.error(
                    f"[UsageTracking] Could not resolve billing period for user {user_id}"
                )
                return {
                    "reset": False,
                    "reason": "billing_period_unresolved",
                }

            summary = self.db.query(UsageSummary).filter(
                UsageSummary.user_id == user_id,
                UsageSummary.billing_period == billing_period,
            ).first()

            created = False
            if not summary:
                summary = UsageSummary(
                    user_id=user_id,
                    billing_period=billing_period,
                    usage_status=UsageStatus.ACTIVE,
                    total_calls=0,
                    total_tokens=0,
                    total_cost=0.0,
                )
                self.db.add(summary)
                created = True
                logger.info(
                    f"[UsageTracking] Created usage summary for reset user={user_id} period={billing_period}"
                )
            else:
                logger.info(
                    f"[UsageTracking] Resetting usage summary user={user_id} period={billing_period}"
                )

            # Reuse centralized helper so field-level reset behavior stays consistent.
            reset_usage_summary_counters(summary)

            # Flush so caller sees DB-persistable state before its own commit.
            self.db.flush()

            # Keep UI cache coherent after plan change/reset.
            try:
                _clear_dashboard_cache_for_user(user_id)
            except Exception as cache_err:
                logger.warning(
                    f"[UsageTracking] Cache clear failed after usage reset user={user_id}: {cache_err}"
                )

            duration_ms = int((time.time() - start_time) * 1000)
            logger.info(
                f"[UsageTracking] Usage reset complete user={user_id} period={billing_period} "
                f"created={created} duration_ms={duration_ms}"
            )

            return {
                "reset": True,
                "billing_period": billing_period,
                "created": created,
            }
        except Exception as exc:
            logger.error(
                f"[UsageTracking] Failed to reset current billing period for user {user_id}: {exc}",
                exc_info=True,
            )
            return {
                "reset": False,
                "reason": str(exc),
            }
    
    async def enforce_usage_limits(self, user_id: str, provider: APIProvider,
                                  tokens_requested: int = 0) -> Tuple[bool, str, Dict[str, Any]]:
        """Enforce usage limits before making an API call."""
        return enforce_usage_limits(user_id, provider, tokens_requested, self.db, self.pricing_service)
    
    async def _check_usage_alerts(self, user_id: str, provider: APIProvider, billing_period: str):
        """Check if usage alerts should be sent."""
        check_usage_alerts(user_id, provider, billing_period, self.db, self.pricing_service)
    
    async def _create_usage_alert(self, user_id: str, provider: APIProvider,
                                 threshold: int, current_usage: int, limit: int,
                                 billing_period: str):
        """Create a usage alert."""
        create_usage_alert(user_id, provider, threshold, current_usage, limit, billing_period, self.db)
    
    # Keep the track_api_usage method here as it's the core functionality
    async def track_api_usage(self, user_id: str, provider: APIProvider, 
                             endpoint: str, method: str, model_used: str = None,
                             tokens_input: int = 0, tokens_output: int = 0,
                             response_time: float = 0.0, status_code: int = 200,
                             request_size: int = None, response_size: int = None,
                             user_agent: str = None, ip_address: str = None,
                             error_message: str = None, retry_count: int = 0,
                             **kwargs) -> Dict[str, Any]:
        """Track an API usage event and update billing information."""
        
        try:
            # Calculate costs
            # Use specific model names instead of generic defaults
            default_models = {
                APIProvider.GEMINI: "gemini-2.5-flash",  # Use Flash as default (cost-effective)
                APIProvider.OPENAI: "gpt-4o-mini",       # Use Mini as default (cost-effective)
                APIProvider.ANTHROPIC: "claude-3.5-sonnet",  # Use Sonnet as default
                APIProvider.MISTRAL: "openai/gpt-oss-120b:groq",  # HuggingFace default model
                APIProvider.WAVESPEED: "openai/gpt-oss-120b"  # WaveSpeed default model
            }
            
            # For HuggingFace (stored as MISTRAL), use the actual model name or default
            if provider == APIProvider.MISTRAL:
                # HuggingFace models - try to match the actual model name from model_used
                if model_used:
                    model_name = model_used
                else:
                    model_name = default_models.get(APIProvider.MISTRAL, "openai/gpt-oss-120b:groq")
            else:
                model_name = model_used or default_models.get(provider, f"{provider.value}-default")
            
            cost_data = self.pricing_service.calculate_api_cost(
                provider=provider,
                model_name=model_name,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                request_count=1,
                **kwargs
            )
            
            # Create usage log entry
            period_keys = self._get_authoritative_billing_period_keys(user_id)
            billing_period = period_keys["billing_period"]
            
            # Detect actual provider name (WaveSpeed, Google, HuggingFace, etc.)
            actual_provider_name = detect_actual_provider(
                provider_enum=provider,
                model_name=model_used,
                endpoint=endpoint
            )
            
            usage_log = APIUsageLog(
                user_id=user_id,
                provider=provider,
                endpoint=endpoint,
                method=method,
                model_used=model_used,
                actual_provider_name=actual_provider_name,  # Track actual provider
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                tokens_total=(tokens_input or 0) + (tokens_output or 0),
                cost_input=cost_data['cost_input'],
                cost_output=cost_data['cost_output'],
                cost_total=cost_data['cost_total'],
                response_time=response_time,
                status_code=status_code,
                request_size=request_size,
                response_size=response_size,
                user_agent=user_agent,
                ip_address=ip_address,
                error_message=error_message,
                retry_count=retry_count,
                billing_period=billing_period
            )
            
            self.db.add(usage_log)
            
            # Update usage summary
            await self._update_usage_summary(
                user_id=user_id,
                provider=provider,
                tokens_used=(tokens_input or 0) + (tokens_output or 0),
                cost=cost_data['cost_total'],
                billing_period=billing_period,
                response_time=response_time,
                is_error=status_code >= 400
            )
            
            # Check for usage alerts
            await self._check_usage_alerts(user_id, provider, billing_period)
            
            self.db.commit()
            
            # Invalidate dashboard cache so header stats update immediately
            try:
                _clear_dashboard_cache_for_user(user_id)
            except Exception as cache_err:
                logger.warning(f"Failed to clear dashboard cache: {cache_err}")
            
            return {
                "success": True,
                "cost": cost_data['cost_total'],
                "tokens": (tokens_input or 0) + (tokens_output or 0),
                "billing_period": billing_period
            }
            
        except Exception as e:
            logger.error(f"Failed to track API usage: {e}")
            self.db.rollback()
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _update_usage_summary(self, user_id: str, provider: APIProvider,
                                   tokens_used: int, cost: float,
                                   billing_period: str,
                                   response_time: float = 0.0,
                                   is_error: bool = False):
        """Update or create usage summary for the billing period."""
        
        # Get or create summary
        summary = self.db.query(UsageSummary).filter(
            UsageSummary.user_id == user_id,
            UsageSummary.billing_period == billing_period
        ).first()
        
        if not summary:
            summary = UsageSummary(
                user_id=user_id,
                billing_period=billing_period,
                usage_status=UsageStatus.ACTIVE,
                total_calls=0,
                total_tokens=0,
                total_cost=0.0
            )
            self.db.add(summary)
        
        # Update counts
        summary.total_calls = (summary.total_calls or 0) + 1
        summary.total_tokens = (summary.total_tokens or 0) + tokens_used
        summary.total_cost = (summary.total_cost or 0.0) + cost
        
        # Update provider-specific counts
        provider_name = provider.value
        current_calls = getattr(summary, f"{provider_name}_calls", 0) or 0
        setattr(summary, f"{provider_name}_calls", current_calls + 1)
        
        # Update provider-specific tokens
        tokens_attr = f"{provider_name}_tokens"
        if hasattr(summary, tokens_attr):
            current_tokens = getattr(summary, tokens_attr, 0) or 0
            setattr(summary, tokens_attr, current_tokens + tokens_used)
        
        # Update provider-specific cost
        cost_attr = f"{provider_name}_cost"
        if hasattr(summary, cost_attr):
            current_cost = getattr(summary, cost_attr, 0.0) or 0.0
            setattr(summary, cost_attr, current_cost + cost)
        
        # Update response time (rolling average)
        if response_time > 0:
            current_avg = summary.avg_response_time or 0.0
            current_calls = summary.total_calls or 1
            summary.avg_response_time = ((current_avg * (current_calls - 1)) + response_time) / current_calls
        
        # Update error rate
        if is_error:
            summary.error_count = (summary.error_count or 0) + 1
            total_calls = summary.total_calls or 1
            summary.error_rate = (summary.error_count / total_calls) * 100
        
        summary.updated_at = datetime.utcnow()

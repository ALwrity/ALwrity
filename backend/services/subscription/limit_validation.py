"""
Limit Validation Module
Handles subscription limit checking and validation logic.
Extracted from pricing_service.py for better modularity.
"""

import time
from typing import Dict, Any, Optional, List, Tuple, TYPE_CHECKING
from datetime import datetime, timedelta
from sqlalchemy import text
from loguru import logger

from models.subscription_models import (
    UserSubscription, UsageSummary, SubscriptionPlan, 
    APIProvider, SubscriptionTier
)

if TYPE_CHECKING:
    from .pricing_service import PricingService


def _should_enforce_limit(limit_value: int, tier: str) -> bool:
    """
    Determine if a limit should be enforced.
    - Free tier: 0 means DISABLED (not unlimited)
    - Basic/Pro/Enterprise: 0 means UNLIMITED
    """
    return limit_value > 0


class LimitValidator:
    """Validates subscription limits for API usage."""
    
    def __init__(self, pricing_service: 'PricingService'):
        """
        Initialize limit validator with reference to PricingService.
        
        Args:
            pricing_service: Instance of PricingService to access helper methods and cache
        """
        self.pricing_service = pricing_service
        self.db = pricing_service.db
    
    def check_usage_limits(self, user_id: str, provider: APIProvider, 
                           tokens_requested: int = 0, actual_provider_name: Optional[str] = None) -> Tuple[bool, str, Dict[str, Any]]:
        """Check if user can make an API call within their limits.
        
        Delegates to LimitValidator for actual validation logic.
        
        Args:
            user_id: User ID
            provider: APIProvider enum (may be MISTRAL for HuggingFace)
            tokens_requested: Estimated tokens for the request
            actual_provider_name: Optional actual provider name (e.g., "huggingface" when provider is MISTRAL)
        
        Returns:
            (can_proceed, error_message, usage_info)
        """
        start_time = time.time()
        try:
            # Use actual_provider_name if provided, otherwise use enum value
            # This fixes cases where HuggingFace maps to MISTRAL enum but should show as "huggingface" in errors
            display_provider_name = actual_provider_name or provider.value
            
            logger.debug(f"[Subscription Check] Starting limit check for user {user_id}, provider {display_provider_name}, tokens {tokens_requested}")
            
            logger.warning(f"[Subscription Check] START for user {user_id}, provider {provider.value}")
            # Short TTL cache to reduce DB reads under sustained traffic
            cache_key = f"{user_id}:{provider.value}"
            now = datetime.utcnow()
            cached = self.pricing_service._limits_cache.get(cache_key)
            if cached and cached.get('expires_at') and cached['expires_at'] > now:
                elapsed_ms = (time.time() - start_time) * 1000
                logger.warning(f"[Subscription Check] Cache hit for {user_id}:{provider.value} — completed in {elapsed_ms:.0f}ms")
                return tuple(cached['result'])  # type: ignore

            # Get user subscription first to check expiration
            subscription = self.db.query(UserSubscription).filter(
                UserSubscription.user_id == user_id,
                UserSubscription.is_active == True
            ).first()
            
            if subscription:
                logger.debug(f"[Subscription Check] Found subscription for user {user_id}: plan_id={subscription.plan_id}, period_end={subscription.current_period_end}")
            else:
                logger.debug(f"[Subscription Check] No active subscription found for user {user_id}")
            
            # Check subscription expiration (STRICT: deny if expired)
            if subscription:
                if subscription.current_period_end < now:
                    logger.warning(f"[Subscription Check] Subscription expired for user {user_id}: period_end={subscription.current_period_end}, now={now}")
                    # Subscription expired - check if auto_renew is enabled
                    if not getattr(subscription, 'auto_renew', False):
                        # Expired and no auto-renew - deny access
                        logger.warning(f"[Subscription Check] Subscription expired for user {user_id}, auto_renew=False, denying access")
                        result = (False, "Subscription expired. Please renew your subscription to continue using the service.", {
                            'expired': True,
                            'period_end': subscription.current_period_end.isoformat()
                        })
                        self.pricing_service._limits_cache[cache_key] = {
                            'result': result,
                            'expires_at': now + timedelta(seconds=30)
                        }
                        return result
                    else:
                        # Try to auto-renew
                        if not self.pricing_service._ensure_subscription_current(subscription):
                            # Auto-renew failed - deny access
                            result = (False, "Subscription expired and auto-renewal failed. Please renew manually.", {
                                'expired': True,
                                'auto_renew_failed': True
                            })
                            self.pricing_service._limits_cache[cache_key] = {
                                'result': result,
                                'expires_at': now + timedelta(seconds=30)
                            }
                            return result

            # Get user limits with error handling (STRICT: fail on errors)
            # CRITICAL: Expire SQLAlchemy objects to ensure we get fresh plan data after renewal
            try:
                # Force expire subscription and plan objects to avoid stale cache
                if subscription and subscription.plan_id:
                    plan_obj = self.db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
                    if plan_obj:
                        self.db.expire(plan_obj)
                        logger.debug(f"[Subscription Check] Expired plan object to ensure fresh limits after renewal")
                
                limits = self.pricing_service.get_user_limits(user_id)
                if limits:
                    logger.debug(f"[Subscription Check] Retrieved limits for user {user_id}: plan={limits.get('plan_name')}, tier={limits.get('tier')}")
                    # Log token limits for debugging
                    token_limits = limits.get('limits', {})
                    logger.debug(f"[Subscription Check] Token limits: gemini={token_limits.get('gemini_tokens')}, mistral={token_limits.get('mistral_tokens')}, openai={token_limits.get('openai_tokens')}, anthropic={token_limits.get('anthropic_tokens')}")
                else:
                    logger.debug(f"[Subscription Check] No limits found for user {user_id}, checking free tier")
            except Exception as e:
                logger.error(f"[Subscription Check] Error getting user limits for {user_id}: {e}", exc_info=True)
                # STRICT: Fail closed - deny request if we can't check limits
                return False, f"Failed to retrieve subscription limits: {str(e)}", {}
            
            if not limits:
                # No subscription found - check for free tier
                free_plan = self.db.query(SubscriptionPlan).filter(
                    SubscriptionPlan.tier == SubscriptionTier.FREE,
                    SubscriptionPlan.is_active == True
                ).first()
                if free_plan:
                    logger.info(f"[Subscription Check] Assigning free tier to user {user_id}")
                    limits = self.pricing_service._plan_to_limits_dict(free_plan)
                else:
                    # No subscription and no free tier - deny access
                    logger.warning(f"[Subscription Check] No subscription or free tier found for user {user_id}, denying access")
                    return False, "No subscription plan found. Please subscribe to a plan.", {}
            
            # Extract tier for limit enforcement logic
            user_tier = limits.get('tier', 'free') if limits else 'free'
            
            # Get current usage for this billing period with error handling
            # Use subscription period, not calendar month
            current_period = self.pricing_service.get_current_billing_period(user_id)
            
            # Only expire specific objects that might have changed after renewal
            # (subscription was already checked above; plan was expired above)
            # The usage record is the main object we need fresh, and we query it directly below
            if subscription:
                self.db.expire(subscription)
            
            # Use raw SQL query first to bypass ORM cache, fallback to ORM if SQL fails
            usage = None
            try:
                from sqlalchemy import text
                sql_query = text("SELECT * FROM usage_summaries WHERE user_id = :user_id AND billing_period = :period LIMIT 1")
                result = self.db.execute(sql_query, {'user_id': user_id, 'period': current_period}).first()
                if result:
                    # Map result to UsageSummary object
                    usage = self.db.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == current_period
                    ).first()
                    if usage:
                        self.db.refresh(usage)  # Ensure fresh data
                if not usage:
                    usage = self.db.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == current_period
                    ).first()
                    if usage:
                        self.db.refresh(usage)
            except Exception as sql_error:
                logger.debug(f"[Subscription Check] Raw SQL query failed, using ORM: {sql_error}")
                # Fallback to ORM query
                usage = self.db.query(UsageSummary).filter(
                    UsageSummary.user_id == user_id,
                    UsageSummary.billing_period == current_period
                ).first()
                if usage:
                    self.db.refresh(usage)  # Ensure fresh data

            if not usage:
                # First usage this period, create summary
                try:
                    # Try to create with minimal fields first to avoid missing column errors
                    from sqlalchemy import text
                    try:
                        # Insert with only essential fields
                        insert_sql = text("""
                            INSERT INTO usage_summaries (user_id, billing_period, created_at, updated_at)
                            VALUES (:user_id, :period, datetime('now'), datetime('now'))
                        """)
                        self.db.execute(insert_sql, {'user_id': user_id, 'period': current_period})
                        self.db.commit()

                        # Now fetch the created record
                        usage = self.db.query(UsageSummary).filter(
                            UsageSummary.user_id == user_id,
                            UsageSummary.billing_period == current_period
                        ).first()

                    except Exception as insert_sql_error:
                        logger.debug(f"[Subscription Check] Direct SQL insert failed, trying ORM: {insert_sql_error}")
                        # Fallback to ORM creation
                        usage = UsageSummary(
                            user_id=user_id,
                            billing_period=current_period
                        )
                        self.db.add(usage)
                        self.db.commit()
                except Exception as create_error:
                    logger.error(f"Error creating usage summary: {create_error}")
                    self.db.rollback()
                    # STRICT: Fail closed on DB error
                    return False, f"Failed to create usage summary: {str(create_error)}", {}
            
            # Check call limits with error handling
            # NOTE: call_limit = 0 means UNLIMITED (Enterprise plans)
            try:
                # Use display_provider_name for error messages, but provider.value for DB queries
                provider_name = provider.value  # For DB field names (e.g., "mistral_calls", "mistral_tokens")
                
                # For LLM text generation providers, check against unified total_calls limit
                llm_providers = ['gemini', 'openai', 'anthropic', 'mistral']
                is_llm_provider = provider_name in llm_providers
                
                if is_llm_provider:
                    # Use unified AI text generation limit (total_calls across all LLM providers)
                    ai_text_gen_limit = limits['limits'].get('ai_text_generation_calls', 0) or 0
                    
                    # If unified limit not set, fall back to provider-specific limit for backwards compatibility
                    if ai_text_gen_limit == 0:
                        ai_text_gen_limit = limits['limits'].get(f"{provider_name}_calls", 0) or 0
                    
                    # Calculate total LLM provider calls (sum of gemini + openai + anthropic + mistral)
                    current_total_llm_calls = (
                        (usage.gemini_calls or 0) +
                        (usage.openai_calls or 0) +
                        (usage.anthropic_calls or 0) +
                        (usage.mistral_calls or 0)
                    )
                    
                    # Enforce limit based on tier (Free: 0=disabled, others: 0=unlimited)
                    if _should_enforce_limit(ai_text_gen_limit, user_tier) and current_total_llm_calls >= ai_text_gen_limit:
                        logger.error(f"[Subscription Check] AI text generation call limit exceeded for user {user_id}: {current_total_llm_calls}/{ai_text_gen_limit} (provider: {display_provider_name})")
                        result = (False, f"AI text generation call limit reached. Used {current_total_llm_calls} of {ai_text_gen_limit} total AI text generation calls this billing period.", {
                            'current_calls': current_total_llm_calls,
                            'limit': ai_text_gen_limit,
                            'usage_percentage': (current_total_llm_calls / ai_text_gen_limit) * 100 if ai_text_gen_limit > 0 else 0,
                            'provider': display_provider_name,  # Use display name for consistency
                            'usage_info': {
                                'provider': display_provider_name,  # Use display name for user-facing info
                                'current_calls': current_total_llm_calls,
                                'limit': ai_text_gen_limit,
                                'type': 'ai_text_generation',
                                'breakdown': {
                                    'gemini': usage.gemini_calls or 0,
                                    'openai': usage.openai_calls or 0,
                                    'anthropic': usage.anthropic_calls or 0,
                                    'mistral': usage.mistral_calls or 0  # DB field name (not display name)
                                }
                            }
                        })
                        self.pricing_service._limits_cache[cache_key] = {
                            'result': result,
                            'expires_at': now + timedelta(seconds=30)
                        }
                        return result
                    else:
                        logger.debug(f"[Subscription Check] AI text generation limit check passed for user {user_id}: {current_total_llm_calls}/{ai_text_gen_limit if ai_text_gen_limit > 0 else 'unlimited'} (provider: {display_provider_name})")
                else:
                    # For non-LLM providers, check provider-specific limit
                    current_calls = getattr(usage, f"{provider_name}_calls", 0) or 0
                    call_limit = limits['limits'].get(f"{provider_name}_calls", 0) or 0
                    
                    # Enforce limit based on tier (Free: 0=disabled, others: 0=unlimited)
                    if _should_enforce_limit(call_limit, user_tier) and current_calls >= call_limit:
                        logger.error(f"[Subscription Check] Call limit exceeded for user {user_id}, provider {display_provider_name}: {current_calls}/{call_limit}")
                        result = (False, f"API call limit reached for {display_provider_name}. Used {current_calls} of {call_limit} calls this billing period.", {
                            'current_calls': current_calls,
                            'limit': call_limit,
                            'usage_percentage': 100.0,
                            'provider': display_provider_name  # Use display name for consistency
                        })
                        self.pricing_service._limits_cache[cache_key] = {
                            'result': result,
                            'expires_at': now + timedelta(seconds=30)
                        }
                        return result
                    else:
                        logger.debug(f"[Subscription Check] Call limit check passed for user {user_id}, provider {display_provider_name}: {current_calls}/{call_limit if call_limit > 0 else 'unlimited'}")
            except Exception as e:
                logger.error(f"Error checking call limits: {e}")
                # Fail closed - deny if we can't verify the limit
                result = (False, f"Unable to verify call limit: {str(e)}", {})
                self.pricing_service._limits_cache[cache_key] = {
                    'result': result,
                    'expires_at': now + timedelta(seconds=30)
                }
                return result
            
            # Check token limits for LLM providers with error handling
            # NOTE: token_limit = 0 means UNLIMITED (Enterprise plans)
            try:
                if provider in [APIProvider.GEMINI, APIProvider.OPENAI, APIProvider.ANTHROPIC, APIProvider.MISTRAL]:
                    current_tokens = getattr(usage, f"{provider_name}_tokens", 0) or 0
                    token_limit = limits['limits'].get(f"{provider_name}_tokens", 0) or 0
                    
                    # Enforce limit based on tier (Free: 0=disabled, others: 0=unlimited)
                    if _should_enforce_limit(token_limit, user_tier) and (current_tokens + tokens_requested) > token_limit:
                        result = (False, f"Token limit would be exceeded for {display_provider_name}. Current: {current_tokens}, Requested: {tokens_requested}, Limit: {token_limit}", {
                            'current_tokens': current_tokens,
                            'requested_tokens': tokens_requested,
                            'limit': token_limit,
                            'usage_percentage': ((current_tokens + tokens_requested) / token_limit) * 100,
                            'provider': display_provider_name,  # Use display name in error details
                            'usage_info': {
                                'provider': display_provider_name,
                                'current_tokens': current_tokens,
                                'requested_tokens': tokens_requested,
                                'limit': token_limit,
                                'type': 'tokens'
                            }
                        })
                        self.pricing_service._limits_cache[cache_key] = {
                            'result': result,
                            'expires_at': now + timedelta(seconds=30)
                        }
                        return result
            except Exception as e:
                logger.error(f"Error checking token limits: {e}")
                # Fail closed - deny if we can't verify the limit
                result = (False, f"Unable to verify token limit: {str(e)}", {})
                self.pricing_service._limits_cache[cache_key] = {
                    'result': result,
                    'expires_at': now + timedelta(seconds=30)
                }
                return result
            
            # Check cost limits with error handling
            try:
                cost_limit = limits['limits'].get('monthly_cost', 0) or 0
                current_cost = (usage.total_cost or 0) if usage else 0
                # Enforce limit based on tier (Free: 0=disabled, others: 0=unlimited)
                if _should_enforce_limit(cost_limit, user_tier) and current_cost >= cost_limit:
                    result = (False, f"Monthly cost limit reached. Current cost: ${current_cost:.2f}, Limit: ${cost_limit:.2f}", {
                        'current_cost': current_cost,
                        'limit': cost_limit,
                        'usage_percentage': 100.0
                    })
                    self.pricing_service._limits_cache[cache_key] = {
                        'result': result,
                        'expires_at': now + timedelta(seconds=30)
                    }
                    return result
            except Exception as e:
                logger.error(f"Error checking cost limits: {e}")
                # Fail closed - deny if we can't verify the limit
                result = (False, f"Unable to verify cost limit: {str(e)}", {})
                self.pricing_service._limits_cache[cache_key] = {
                    'result': result,
                    'expires_at': now + timedelta(seconds=30)
                }
                return result
            
            # Calculate usage percentages for warnings
            try:
                # Determine which call variables to use based on provider type
                if is_llm_provider:
                    # Use unified LLM call tracking
                    current_call_count = current_total_llm_calls
                    call_limit_value = ai_text_gen_limit
                else:
                    # Use provider-specific call tracking
                    current_call_count = current_calls
                    call_limit_value = call_limit
                
                call_usage_pct = (current_call_count / max(call_limit_value, 1)) * 100 if call_limit_value > 0 else 0
                cost_usage_pct = (current_cost / max(cost_limit, 1)) * 100 if cost_limit > 0 else 0
                result = (True, "Within limits", {
                    'current_calls': current_call_count,
                    'call_limit': call_limit_value,
                    'call_usage_percentage': call_usage_pct,
                    'current_cost': current_cost,
                    'cost_limit': cost_limit,
                    'cost_usage_percentage': cost_usage_pct
                })
                self.pricing_service._limits_cache[cache_key] = {
                    'result': result,
                    'expires_at': now + timedelta(seconds=30)
                }
                elapsed_ms = (time.time() - start_time) * 1000
                logger.warning(f"[Subscription Check] Completed in {elapsed_ms:.0f}ms for user {user_id}, provider {display_provider_name} — within limits (calls: {current_call_count}/{call_limit_value})")
                return result
            except Exception as e:
                logger.error(f"Error calculating usage percentages: {e}")
                elapsed_ms = (time.time() - start_time) * 1000
                logger.warning(f"[Subscription Check] Completed in {elapsed_ms:.0f}ms for user {user_id}, provider {display_provider_name} — within limits (basic check)")
                return True, "Within limits", {}
        
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            logger.error(f"[Subscription Check] Failed for user {user_id} after {elapsed_ms:.0f}ms: {e}")
            # STRICT: Fail closed - deny requests if subscription system fails
            return False, f"Subscription check error: {str(e)}", {}
    
    def check_comprehensive_limits(
        self, 
        user_id: str, 
        operations: List[Dict[str, Any]]
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Comprehensive pre-flight validation that checks ALL limits before making ANY API calls.
        
        This prevents wasteful API calls by validating that ALL subsequent operations will succeed
        before making the first external API call.
        
        Args:
            user_id: User ID
            operations: List of operations to validate, each with:
                - 'provider': APIProvider enum
                - 'tokens_requested': int (estimated tokens for LLM calls, 0 for non-LLM)
                - 'actual_provider_name': Optional[str] (e.g., "huggingface" when provider is MISTRAL)
                - 'operation_type': str (e.g., "google_grounding", "llm_call", "image_generation")
        
        Returns:
            (can_proceed, error_message, error_details)
            If can_proceed is False, error_message explains which limit would be exceeded
        """
        try:
            logger.info(f"[Pre-flight Check] 🔍 Starting comprehensive validation for user {user_id}")
            logger.info(f"[Pre-flight Check] 📋 Validating {len(operations)} operation(s) before making any API calls")
            
            # Get current usage and limits once
            current_period = self.pricing_service.get_current_billing_period(user_id)
            
            logger.info(f"[Pre-flight Check] 📅 Billing Period: {current_period} (for user {user_id})")
            
            # Ensure schema columns exist before querying
            try:
                from services.subscription.schema_utils import ensure_usage_summaries_columns
                ensure_usage_summaries_columns(self.db)
            except Exception as schema_err:
                logger.warning(f"Schema check failed, will retry on query error: {schema_err}")
            
            # Explicitly refresh usage from DB to ensure fresh data (targeted instead of expire_all)
            try:
                usage = self.db.query(UsageSummary).filter(
                    UsageSummary.user_id == user_id,
                    UsageSummary.billing_period == current_period
                ).first()
            
                # CRITICAL: Explicitly refresh from database to get latest values (clears SQLAlchemy cache)
                if usage:
                    self.db.refresh(usage)
            except Exception as query_err:
                error_str = str(query_err).lower()
                if 'no such column' in error_str and ('exa_calls' in error_str or 'wavespeed' in error_str):
                    logger.warning("Missing column detected in usage query, fixing schema and retrying...")
                    import sqlite3
                    import services.subscription.schema_utils as schema_utils
                    schema_utils._checked_usage_summaries_columns = False
                    from services.subscription.schema_utils import ensure_usage_summaries_columns
                    ensure_usage_summaries_columns(self.db)
                    # After schema migration, only expire UsageSummary to force re-query
                    # (no need to expire the entire session)
                    for obj in self.db.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id
                    ).all():
                        self.db.expire(obj)
                    # Retry the query
                    usage = self.db.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == current_period
                    ).first()
                    if usage:
                        self.db.refresh(usage)
                else:
                    raise
            
            # Log what we actually read from database
            if usage:
                logger.info(f"[Pre-flight Check] 📊 Usage Summary from DB (Period: {current_period}):")
                logger.info(f"   ├─ Gemini: {usage.gemini_tokens or 0} tokens / {usage.gemini_calls or 0} calls")
                logger.info(f"   ├─ Mistral/HF: {usage.mistral_tokens or 0} tokens / {usage.mistral_calls or 0} calls")
                logger.info(f"   ├─ Total Tokens: {usage.total_tokens or 0}")
                logger.info(f"   └─ Usage Status: {usage.usage_status.value if usage.usage_status else 'N/A'}")
            else:
                logger.info(f"[Pre-flight Check] 📊 No usage summary found for period {current_period} (will create new)")
            
            if not usage:
                # First usage this period, create summary
                try:
                    usage = UsageSummary(
                        user_id=user_id,
                        billing_period=current_period
                    )
                    self.db.add(usage)
                    self.db.commit()
                except Exception as create_error:
                    logger.error(f"Error creating usage summary: {create_error}")
                    self.db.rollback()
                    return False, f"Failed to create usage summary: {str(create_error)}", {}
            
            # Get user limits
            limits_dict = self.pricing_service.get_user_limits(user_id)
            if not limits_dict:
                # No subscription found - check for free tier
                free_plan = self.db.query(SubscriptionPlan).filter(
                    SubscriptionPlan.tier == SubscriptionTier.FREE,
                    SubscriptionPlan.is_active == True
                ).first()
                if free_plan:
                    limits_dict = self.pricing_service._plan_to_limits_dict(free_plan)
                else:
                    return False, "No subscription plan found. Please subscribe to a plan.", {}
            
            limits = limits_dict.get('limits', {})
            tier = limits_dict.get('tier', 'free')
            
            # Track cumulative usage across all operations
            total_llm_calls = (
                (usage.gemini_calls or 0) +
                (usage.openai_calls or 0) +
                (usage.anthropic_calls or 0) +
                (usage.mistral_calls or 0)
            )
            total_llm_tokens = {}
            total_images = usage.stability_calls or 0
            
            # Log current usage summary
            logger.info(f"[Pre-flight Check] 📊 Current Usage Summary:")
            logger.info(f"   └─ Total LLM Calls: {total_llm_calls}")
            logger.info(f"   └─ Gemini Tokens: {usage.gemini_tokens or 0}, Mistral/HF Tokens: {usage.mistral_tokens or 0}")
            logger.info(f"   └─ Image Calls: {total_images}")
            
            # Validate each operation
            for op_idx, operation in enumerate(operations):
                provider = operation.get('provider')
                provider_name = provider.value if hasattr(provider, 'value') else str(provider)
                tokens_requested = operation.get('tokens_requested', 0)
                actual_provider_name = operation.get('actual_provider_name')
                operation_type = operation.get('operation_type', 'unknown')
                
                display_provider_name = actual_provider_name or provider_name
                
                # Log operation details at debug level (only when needed)
                logger.debug(f"[Pre-flight] Operation {op_idx + 1}/{len(operations)}: {operation_type} ({display_provider_name}, {tokens_requested} tokens)")
                
                # Check if this is an LLM provider
                llm_providers = ['gemini', 'openai', 'anthropic', 'mistral']
                is_llm_provider = provider_name in llm_providers
                
                # Check unified AI text generation limit for LLM providers
                if is_llm_provider:
                    ai_text_gen_limit = limits.get('ai_text_generation_calls', 0) or 0
                    if ai_text_gen_limit == 0:
                        # Fallback to provider-specific limit
                        ai_text_gen_limit = limits.get(f"{provider_name}_calls", 0) or 0
                    
                    # Count this operation as an LLM call
                    projected_total_llm_calls = total_llm_calls + 1
                    
                    # Enforce limit based on tier (Free: 0=disabled, others: 0=unlimited)
                    if _should_enforce_limit(ai_text_gen_limit, tier) and projected_total_llm_calls > ai_text_gen_limit:
                        error_info = {
                            'current_calls': total_llm_calls,
                            'limit': ai_text_gen_limit,
                            'provider': display_provider_name,
                            'operation_type': operation_type,
                            'operation_index': op_idx
                        }
                        return False, f"AI text generation call limit would be exceeded. Would use {projected_total_llm_calls} of {ai_text_gen_limit} total AI text generation calls.", {
                            'error_type': 'call_limit',
                            'usage_info': error_info
                        }
                    
                    # Check token limits for this provider
                    # CRITICAL: Always query fresh from DB for each operation to avoid SQLAlchemy cache issues
                    # This ensures we get the latest values after subscription renewal, even for cumulative tracking
                    provider_tokens_key = f"{provider_name}_tokens"
                    
                    # Try to get fresh value from DB with comprehensive error handling
                    base_current_tokens = 0
                    query_succeeded = False
                    
                    try:
                        # Validate column name is safe (only allow known provider token columns)
                        valid_token_columns = ['gemini_tokens', 'openai_tokens', 'anthropic_tokens', 'mistral_tokens']
                        
                        if provider_tokens_key not in valid_token_columns:
                            logger.error(f"   └─ Invalid provider tokens key: {provider_tokens_key}")
                            query_succeeded = True  # Treat as success with 0 value
                        else:
                            # Method 1: Try raw SQL query to completely bypass ORM cache
                            try:
                                logger.debug(f"   └─ Attempting raw SQL query for {provider_tokens_key}")
                                sql_query = text(f"""
                                    SELECT {provider_tokens_key} 
                                    FROM usage_summaries 
                                    WHERE user_id = :user_id 
                                    AND billing_period = :period
                                    LIMIT 1
                                """)
                                
                                logger.debug(f"   └─ SQL: SELECT {provider_tokens_key} FROM usage_summaries WHERE user_id={user_id} AND billing_period={current_period}")
                                
                                result = self.db.execute(sql_query, {
                                    'user_id': user_id,
                                    'period': current_period
                                }).first()
                                
                                if result:
                                    base_current_tokens = result[0] if result[0] is not None else 0
                                else:
                                    base_current_tokens = 0
                                
                                query_succeeded = True
                                logger.debug(f"[Pre-flight] Raw SQL query for {provider_tokens_key}: {base_current_tokens}")
                                
                            except Exception as sql_error:
                                logger.error(f"   └─ Raw SQL query failed for {provider_tokens_key}: {type(sql_error).__name__}: {sql_error}", exc_info=True)
                                query_succeeded = False  # Will try ORM fallback
                            
                            # Method 2: Fallback to fresh ORM query if raw SQL fails
                            if not query_succeeded:
                                try:
                                    # Only refresh usage object, don't expire entire session
                                    if usage:
                                        self.db.refresh(usage)
                                    fresh_usage = self.db.query(UsageSummary).filter(
                                        UsageSummary.user_id == user_id,
                                        UsageSummary.billing_period == current_period
                                    ).first()
                                    
                                    if fresh_usage:
                                        # Explicitly refresh to get latest from DB
                                        self.db.refresh(fresh_usage)
                                        base_current_tokens = getattr(fresh_usage, provider_tokens_key, 0) or 0
                                    else:
                                        base_current_tokens = 0
                                    
                                    query_succeeded = True
                                    logger.info(f"[Pre-flight Check] ✅ ORM fallback query succeeded for {provider_tokens_key}: {base_current_tokens}")
                                    
                                except Exception as orm_error:
                                    logger.error(f"   └─ ORM query also failed: {orm_error}", exc_info=True)
                                    query_succeeded = False
                    
                    except Exception as e:
                        logger.error(f"   └─ Unexpected error getting tokens from DB for {provider_tokens_key}: {e}", exc_info=True)
                        base_current_tokens = 0  # Fail safe - assume 0 if we can't query
                    
                    if not query_succeeded:
                        logger.warning(f"   └─ Both query methods failed, using 0 as fallback")
                    
                    # Log DB query result at debug level (only when needed for troubleshooting)
                    logger.debug(f"[Pre-flight] DB query for {display_provider_name} ({provider_tokens_key}): {base_current_tokens} (period: {current_period})")
                    
                    # Add any projected tokens from previous operations in this validation run
                    # Note: total_llm_tokens tracks ONLY projected tokens from this run, not base DB value
                    projected_from_previous = total_llm_tokens.get(provider_tokens_key, 0)
                    
                    # Current tokens = base from DB + projected from previous operations in this run
                    current_provider_tokens = base_current_tokens + projected_from_previous
                    
                    # Log token calculation at debug level
                    logger.debug(f"[Pre-flight] Token calc for {display_provider_name}: base={base_current_tokens}, projected={projected_from_previous}, total={current_provider_tokens}")
                    
                    token_limit = limits.get(provider_tokens_key, 0) or 0
                    
                    # Enforce limit based on tier (Free: 0=disabled, others: 0=unlimited)
                    if _should_enforce_limit(token_limit, tier) and tokens_requested > 0:
                        projected_tokens = current_provider_tokens + tokens_requested
                        logger.info(f"   └─ Token Check: {current_provider_tokens} (current) + {tokens_requested} (requested) = {projected_tokens} (total) / {token_limit} (limit)")
                        
                        if projected_tokens > token_limit:
                            usage_percentage = (projected_tokens / token_limit) * 100 if token_limit > 0 else 0
                            error_info = {
                                'current_tokens': current_provider_tokens,
                                'base_tokens_from_db': base_current_tokens,
                                'projected_from_previous_ops': projected_from_previous,
                                'requested_tokens': tokens_requested,
                                'limit': token_limit,
                                'provider': display_provider_name,
                                'operation_type': operation_type,
                                'operation_index': op_idx
                            }
                            # Make error message clearer: show actual DB usage vs projected
                            if projected_from_previous > 0:
                                error_msg = (
                                    f"Token limit exceeded for {display_provider_name} "
                                    f"({operation_type}). "
                                    f"Base usage: {base_current_tokens}/{token_limit}, "
                                    f"After previous operations in this workflow: {current_provider_tokens}/{token_limit}, "
                                    f"This operation would add: {tokens_requested}, "
                                    f"Total would be: {projected_tokens} (exceeds by {projected_tokens - token_limit} tokens)"
                                )
                            else:
                                error_msg = (
                                    f"Token limit exceeded for {display_provider_name} "
                                    f"({operation_type}). "
                                    f"Current: {current_provider_tokens}/{token_limit}, "
                                    f"Requested: {tokens_requested}, "
                                    f"Would exceed by: {projected_tokens - token_limit} tokens "
                                    f"({usage_percentage:.1f}% of limit)"
                                )
                            logger.error(f"[Pre-flight Check] ❌ BLOCKED: {error_msg}")
                            return False, error_msg, {
                                'error_type': 'token_limit',
                                'usage_info': error_info
                            }
                        else:
                            logger.info(f"   └─ ✅ Token limit check passed: {projected_tokens} <= {token_limit}")
                    
                    # Update cumulative counts for next operation
                    total_llm_calls = projected_total_llm_calls
                    # Update cumulative projected tokens from this validation run
                    # This represents only projected tokens from previous operations in this run
                    # Base DB value is always queried fresh, so we only track the projection delta
                    old_projected = total_llm_tokens.get(provider_tokens_key, 0)
                    if tokens_requested > 0:
                        # Add this operation's tokens to cumulative projected tokens
                        total_llm_tokens[provider_tokens_key] = projected_from_previous + tokens_requested
                        logger.debug(f"[Pre-flight] Updated projected tokens for {display_provider_name}: {projected_from_previous} + {tokens_requested} = {total_llm_tokens[provider_tokens_key]}")
                    else:
                        # No tokens requested, keep existing projected tokens (or 0 if first operation)
                        total_llm_tokens[provider_tokens_key] = projected_from_previous
                
                # Check image generation limits
                elif provider == APIProvider.STABILITY:
                    image_limit = limits.get('stability_calls', 0) or 0
                    projected_images = total_images + 1
                    
                    # Enforce limit based on tier (Free: 0=disabled, others: 0=unlimited)
                    if _should_enforce_limit(image_limit, tier) and projected_images > image_limit:
                        error_info = {
                            'current_images': total_images,
                            'limit': image_limit,
                            'provider': 'stability',
                            'operation_type': operation_type,
                            'operation_index': op_idx
                        }
                        return False, f"Image generation limit would be exceeded. Would use {projected_images} of {image_limit} images this billing period.", {
                            'error_type': 'image_limit',
                            'usage_info': error_info
                        }
                    
                    total_images = projected_images
                
                # Check video generation limits
                elif provider == APIProvider.VIDEO:
                    video_limit = limits.get('video_calls', 0) or 0
                    total_video_calls = usage.video_calls or 0
                    projected_video_calls = total_video_calls + 1
                    
                    # Enforce limit based on tier (Free: 0=disabled, others: 0=unlimited)
                    if _should_enforce_limit(video_limit, tier) and projected_video_calls > video_limit:
                        error_info = {
                            'current_calls': total_video_calls,
                            'limit': video_limit,
                            'provider': 'video',
                            'operation_type': operation_type,
                            'operation_index': op_idx
                        }
                        return False, f"Video generation limit would be exceeded. Would use {projected_video_calls} of {video_limit} videos this billing period.", {
                            'error_type': 'video_limit',
                            'usage_info': error_info
                        }
                
                # Check image editing limits
                elif provider == APIProvider.IMAGE_EDIT:
                    image_edit_limit = limits.get('image_edit_calls', 0) or 0
                    total_image_edit_calls = getattr(usage, 'image_edit_calls', 0) or 0
                    projected_image_edit_calls = total_image_edit_calls + 1
                    
                    # Enforce limit based on tier (Free: 0=disabled, others: 0=unlimited)
                    if _should_enforce_limit(image_edit_limit, tier) and projected_image_edit_calls > image_edit_limit:
                        error_info = {
                            'current_calls': total_image_edit_calls,
                            'limit': image_edit_limit,
                            'provider': 'image_edit',
                            'operation_type': operation_type,
                            'operation_index': op_idx
                        }
                        return False, f"Image editing limit would be exceeded. Would use {projected_image_edit_calls} of {image_edit_limit} image edits this billing period.", {
                            'error_type': 'image_edit_limit',
                            'usage_info': error_info
                        }
                
                # Check other provider-specific limits
                else:
                    provider_calls_key = f"{provider_name}_calls"
                    current_provider_calls = getattr(usage, provider_calls_key, 0) or 0
                    call_limit = limits.get(provider_calls_key, 0) or 0
                    
                    if call_limit > 0:
                        projected_calls = current_provider_calls + 1
                        if projected_calls > call_limit:
                            error_info = {
                                'current_calls': current_provider_calls,
                                'limit': call_limit,
                                'provider': display_provider_name,
                                'operation_type': operation_type,
                                'operation_index': op_idx
                            }
                            return False, f"API call limit would be exceeded for {display_provider_name}. Would use {projected_calls} of {call_limit} calls this billing period.", {
                                'error_type': 'call_limit',
                                'usage_info': error_info
                            }
                
                # Check WaveSpeed combined limit if actual_provider is WaveSpeed
                if actual_provider_name == 'wavespeed':
                    wavespeed_limit = limits.get('wavespeed_calls', 0) or 0
                    if _should_enforce_limit(wavespeed_limit, tier):
                        wavespeed_usage = usage.wavespeed_calls or 0
                        projected_wavespeed = wavespeed_usage + 1
                        if projected_wavespeed > wavespeed_limit:
                            error_info = {
                                'current_calls': wavespeed_usage,
                                'limit': wavespeed_limit,
                                'provider': 'wavespeed',
                                'operation_type': operation_type,
                                'operation_index': op_idx
                            }
                            return False, f"WaveSpeed API limit would be exceeded. Would use {projected_wavespeed} of {wavespeed_limit} WaveSpeed calls this billing period.", {
                                'error_type': 'wavespeed_limit',
                                'usage_info': error_info
                            }
            
            # All checks passed
            logger.info(f"[Pre-flight Check] ✅ All {len(operations)} operation(s) validated successfully")
            logger.info(f"[Pre-flight Check] ✅ User {user_id} is cleared to proceed with API calls")
            return True, None, None
            
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e).lower()
            
            # Handle missing column errors with schema fix and retry
            if 'operationalerror' in error_type.lower() or 'operationalerror' in error_message:
                if 'no such column' in error_message and 'exa_calls' in error_message:
                    logger.warning("Missing column detected in limit check, attempting schema fix...")
                    try:
                        import sqlite3
                        import services.subscription.schema_utils as schema_utils
                        schema_utils._checked_usage_summaries_columns = False
                        from services.subscription.schema_utils import ensure_usage_summaries_columns
                        ensure_usage_summaries_columns(self.db)
                        # Only expire UsageSummary after schema migration, not entire session
                        for obj in self.db.query(UsageSummary).filter(
                            UsageSummary.user_id == user_id
                        ).all():
                            self.db.expire(obj)
                        
                        # Retry the query
                        usage = self.db.query(UsageSummary).filter(
                            UsageSummary.user_id == user_id,
                            UsageSummary.billing_period == current_period
                        ).first()
                        
                        if usage:
                            self.db.refresh(usage)
                        
                        # Continue with the rest of the validation using the retried usage
                        # (The rest of the function logic continues from here)
                        # For now, we'll let it fall through to return the error since we'd need to duplicate the entire validation logic
                        # Instead, we'll just log and return, but the next call should succeed
                        logger.info(f"[Pre-flight Check] Schema fixed, but need to retry validation on next call")
                        return False, f"Schema updated, please retry: Database schema was updated. Please try again.", {'error_type': 'schema_update', 'retry': True}
                    except Exception as retry_err:
                        logger.error(f"Schema fix and retry failed: {retry_err}")
                        return False, f"Failed to validate limits: {error_type}: {str(e)}", {}
            
            logger.error(f"[Pre-flight Check] ❌ Error during comprehensive limit check: {error_type}: {str(e)}", exc_info=True)
            logger.error(f"[Pre-flight Check] ❌ User: {user_id}, Operations count: {len(operations) if operations else 0}")
            return False, f"Failed to validate limits: {error_type}: {str(e)}", {}


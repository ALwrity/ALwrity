"""
Pricing Service for API Usage Tracking
Manages API pricing, cost calculation, and subscription limits.
"""

# Ensure Optional is available in global scope for dynamic imports
from typing import Optional

from typing import Dict, Any, List, Tuple, Union
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text
from loguru import logger
import os

from models.subscription_models import (
    APIProviderPricing, SubscriptionPlan, UserSubscription, 
    UsageSummary, APIUsageLog, APIProvider, SubscriptionTier, UsageStatus
)
from services.subscription.pricing_config import PricingConfigLoader

class PricingService:
    """Service for managing API pricing and cost calculations."""
    
    # Class-level cache shared across all instances (critical for cache invalidation on subscription renewal)
    # key: f"{user_id}:{provider}", value: { 'result': (bool, str, dict), 'expires_at': datetime }
    _limits_cache: Dict[str, Dict[str, Any]] = {}
    
    def __init__(self, db: Session):
        self.db = db
        self._pricing_cache = {}
        self._plans_cache = {}
        # Cache for schema feature detection (ai_text_generation_calls_limit column)
        self._ai_text_gen_col_checked: bool = False
        self._ai_text_gen_col_available: bool = False

    # ------------------- Billing period helpers -------------------
    def _compute_next_period_end(self, start: datetime, cycle: str) -> datetime:
        """Compute the next period end given a start and billing cycle."""
        try:
            cycle_value = cycle.value if hasattr(cycle, 'value') else str(cycle)
        except Exception:
            cycle_value = str(cycle)
        if cycle_value == 'yearly':
            return start + timedelta(days=365)
        return start + timedelta(days=30)

    def _ensure_subscription_current(self, subscription) -> bool:
        """Auto-advance subscription period if expired and auto_renew is enabled."""
        if not subscription:
            return False
        now = datetime.utcnow()
        try:
            if subscription.current_period_end and subscription.current_period_end < now:
                if getattr(subscription, 'auto_renew', False):
                    subscription.current_period_start = now
                    subscription.current_period_end = self._compute_next_period_end(now, subscription.billing_cycle)
                    # Keep status active if model enum else string
                    try:
                        subscription.status = UsageStatus.ACTIVE
                    except Exception:
                        setattr(subscription, 'status', 'active')
                    self.db.commit()
                else:
                    return False
        except Exception:
            self.db.rollback()
        return True

    def get_current_billing_period(self, user_id: str) -> str:
        """Return current billing period key (YYYY-MM) based on subscription, not calendar.
        Maintains backward compatibility with existing calendar-month data."""
        subscription = self.db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.is_active == True
        ).first()
        
        # Ensure subscription is current (advance if auto_renew)
        self._ensure_subscription_current(subscription)
        
        # Use subscription's billing period, NOT calendar month
        if subscription and subscription.current_period_start:
            sub_period = subscription.current_period_start.strftime("%Y-%m")
            
            # Check if usage data exists for this subscription period
            from models.subscription_models import UsageSummary
            usage_exists = self.db.query(UsageSummary).filter(
                UsageSummary.user_id == user_id,
                UsageSummary.billing_period == sub_period
            ).first()
            
            if usage_exists:
                return sub_period
            
            # If no data for subscription period, check for calendar month data
            # This handles backward compatibility for existing users
            calendar_period = datetime.now().strftime("%Y-%m")
            if calendar_period != sub_period:
                calendar_usage = self.db.query(UsageSummary).filter(
                    UsageSummary.user_id == user_id,
                    UsageSummary.billing_period == calendar_period
                ).first()
                if calendar_usage:
                    logger.info(f"Using calendar period {calendar_period} for backward compatibility (subscription period {sub_period} has no data)")
                    return calendar_period
            
            return sub_period
        
        # Fallback: Check if user has any usage summary and use that period
        from models.subscription_models import UsageSummary
        latest_summary = self.db.query(UsageSummary).filter(
            UsageSummary.user_id == user_id
        ).order_by(UsageSummary.billing_period.desc()).first()
        
        if latest_summary:
            logger.info(f"Using latest billing period from UsageSummary: {latest_summary.billing_period}")
            return latest_summary.billing_period
        
        # Last fallback to calendar month for free tier / no data
        return datetime.now().strftime("%Y-%m")
    
    @classmethod
    def clear_user_cache(cls, user_id: str) -> int:
        """Clear all cached limit checks for a specific user. Returns number of entries cleared."""
        keys_to_remove = [key for key in cls._limits_cache.keys() if key.startswith(f"{user_id}:")]
        for key in keys_to_remove:
            del cls._limits_cache[key]
        logger.info(f"Cleared {len(keys_to_remove)} cache entries for user {user_id}")
        return len(keys_to_remove)
        
    def initialize_default_pricing(self):
        """Initialize default pricing for all API providers from pricing.yaml SSOT."""
        # Skip if this DB already has pricing data — called per-user by
        # init_user_database during scheduler scans.  First run seeds the
        # table; subsequent runs are no-ops (upsert).
        existing = self.db.query(APIProviderPricing).first()
        if existing is not None:
            logger.debug("[PRICING_INIT] Pricing already initialized — skipping")
            return

        loader = PricingConfigLoader()
        config = loader.load()

        all_pricing = config.model_pricing

        for mp_entry in all_pricing:
            pricing_dict = {
                "provider": mp_entry.provider,
                "model_name": mp_entry.model_name,
                "cost_per_input_token": mp_entry.cost_per_input_token,
                "cost_per_output_token": mp_entry.cost_per_output_token,
                "cost_per_request": mp_entry.cost_per_request,
                "cost_per_image": mp_entry.cost_per_image,
                "cost_per_page": mp_entry.cost_per_page,
                "cost_per_search": mp_entry.cost_per_search,
                "description": mp_entry.description,
            }

            existing = self.db.query(APIProviderPricing).filter(
                APIProviderPricing.provider == pricing_dict["provider"],
                APIProviderPricing.model_name == pricing_dict["model_name"]
            ).first()

            if existing:
                existing.cost_per_input_token = pricing_dict["cost_per_input_token"]
                existing.cost_per_output_token = pricing_dict["cost_per_output_token"]
                existing.description = pricing_dict["description"]
                existing.updated_at = datetime.utcnow()
                if pricing_dict["provider"] in [APIProvider.MISTRAL, APIProvider.HUGGINGFACE, APIProvider.AUDIO]:
                    existing.cost_per_request = pricing_dict.get("cost_per_request", 0.0)
                logger.debug(f"Updated pricing for {pricing_dict['provider'].value}:{pricing_dict['model_name']}")
            else:
                pricing = APIProviderPricing(**pricing_dict)
                self.db.add(pricing)
                logger.debug(f"Added new pricing for {pricing_dict['provider'].value}:{pricing_dict['model_name']}")

        self.db.commit()

        total_rows = self.db.query(APIProviderPricing).count()
        providers = self.db.query(APIProviderPricing.provider).distinct().all()
        provider_list = sorted([p[0].value for p in providers]) if providers else []
        logger.info(f"[PRICING_INIT] Default API pricing initialized: {len(all_pricing)} rows configured, {total_rows} rows in DB, providers: {provider_list}")
        logger.debug(f"[PRICING_INIT] Pricing ready: {total_rows} rows for {len(provider_list)} providers")

    def initialize_default_plans(self):
        """Initialize default subscription plans from pricing.yaml SSOT."""
        loader = PricingConfigLoader()
        config = loader.load()

        for plan_entry in config.plans:
            plan_data = {
                "name": plan_entry.name,
                "tier": plan_entry.tier,
                "price_monthly": plan_entry.price_monthly,
                "price_yearly": plan_entry.price_yearly,
                "monthly_cost_limit": plan_entry.monthly_cost_limit,
                "features": plan_entry.features,
                "description": plan_entry.description,
            }

            for limit_key, limit_val in plan_entry.limits.items():
                plan_data[limit_key] = limit_val

            existing = self.db.query(SubscriptionPlan).filter(
                SubscriptionPlan.name == plan_data["name"]
            ).first()

            if not existing:
                plan = SubscriptionPlan(**plan_data)
                self.db.add(plan)
            else:
                for key, value in plan_data.items():
                    if key not in ["name", "tier"]:
                        try:
                            setattr(existing, key, value)
                        except (AttributeError, Exception) as e:
                            logger.debug(f"Could not set {key} on plan {existing.name}: {e}")
                existing.updated_at = datetime.utcnow()
                logger.debug(f"Updated existing plan: {existing.name}")

        self.db.commit()
        logger.info("[PLANS_INIT] Default subscription plans initialized from pricing.yaml")

    def calculate_api_cost(self, provider: APIProvider, model_name: str, 
                          tokens_input: int = 0, tokens_output: int = 0, 
                          request_count: int = 1, **kwargs) -> Dict[str, float]:
        """Calculate cost for an API call.
        
        Args:
            provider: APIProvider enum (e.g., APIProvider.MISTRAL for HuggingFace)
            model_name: Model name (e.g., "openai/gpt-oss-120b:groq")
            tokens_input: Number of input tokens
            tokens_output: Number of output tokens
            request_count: Number of requests (default: 1)
            **kwargs: Additional parameters (search_count, image_count, page_count, etc.)
        
        Returns:
            Dict with cost_input, cost_output, and cost_total
        """
        
        # Get pricing for the provider and model
        # Try exact match first
        pricing = self.db.query(APIProviderPricing).filter(
            APIProviderPricing.provider == provider,
            APIProviderPricing.model_name == model_name,
            APIProviderPricing.is_active == True
        ).first()
        
        # If not found, try "default" model name for the provider
        if not pricing:
            pricing = self.db.query(APIProviderPricing).filter(
                APIProviderPricing.provider == provider,
                APIProviderPricing.model_name == "default",
                APIProviderPricing.is_active == True
            ).first()
        
        # If still not found, check for HuggingFace models (provider is MISTRAL or HUGGINGFACE)
        # Try alternative model name variations
        if not pricing and provider in (APIProvider.MISTRAL, APIProvider.HUGGINGFACE):
            # Try with "gpt-oss-120b" (without full path) if model contains it
            if "gpt-oss-120b" in model_name.lower():
                pricing = self.db.query(APIProviderPricing).filter(
                    APIProviderPricing.provider == provider,
                    APIProviderPricing.model_name == "gpt-oss-120b",
                    APIProviderPricing.is_active == True
                ).first()
            
            # Also try with full model path
            if not pricing:
                pricing = self.db.query(APIProviderPricing).filter(
                    APIProviderPricing.provider == provider,
                    APIProviderPricing.model_name == "openai/gpt-oss-120b:groq",
                    APIProviderPricing.is_active == True
                ).first()
        
        if not pricing:
            # Check if we should use env vars for HuggingFace/Mistral
            if provider in (APIProvider.MISTRAL, APIProvider.HUGGINGFACE):
                # Use environment variables for HuggingFace pricing if available
                hf_input_cost = float(os.getenv('HUGGINGFACE_INPUT_TOKEN_COST', '0.000001'))
                hf_output_cost = float(os.getenv('HUGGINGFACE_OUTPUT_TOKEN_COST', '0.000003'))
                logger.info(f"Using HuggingFace pricing from env vars: input={hf_input_cost}, output={hf_output_cost} for model {model_name}")
                cost_input = tokens_input * hf_input_cost
                cost_output = tokens_output * hf_output_cost
                cost_total = cost_input + cost_output
            else:
                logger.warning(f"No pricing found for {provider.value}:{model_name}, using default estimates")
                # Use default estimates
                cost_input = tokens_input * 0.000001  # $1 per 1M tokens default
                cost_output = tokens_output * 0.000001
                cost_total = cost_input + cost_output
        else:
            # Calculate based on actual pricing from database
            logger.debug(f"Using pricing from DB for {provider.value}:{model_name} - input: {pricing.cost_per_input_token}, output: {pricing.cost_per_output_token}")
            cost_input = tokens_input * (pricing.cost_per_input_token or 0.0)
            cost_output = tokens_output * (pricing.cost_per_output_token or 0.0)
            cost_request = request_count * (pricing.cost_per_request or 0.0)
            
            # Handle special cases for non-LLM APIs
            cost_search = kwargs.get('search_count', 0) * (pricing.cost_per_search or 0.0)
            cost_image = kwargs.get('image_count', 0) * (pricing.cost_per_image or 0.0)
            cost_page = kwargs.get('page_count', 0) * (pricing.cost_per_page or 0.0)
            
            cost_total = cost_input + cost_output + cost_request + cost_search + cost_image + cost_page
        
        # Round to 6 decimal places for precision
        return {
            'cost_input': round(cost_input, 6),
            'cost_output': round(cost_output, 6),
            'cost_total': round(cost_total, 6)
        }
    
    def get_user_limits(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get usage limits for a user based on their subscription."""
        
        # CRITICAL: Expire all objects first to ensure fresh data after renewal
        self.db.expire_all()
        
        subscription = self.db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.is_active == True
        ).first()

        if not subscription:
            # Return free tier limits
            free_plan = self.db.query(SubscriptionPlan).filter(
                SubscriptionPlan.tier == SubscriptionTier.FREE
            ).first()
            if free_plan:
                return self._plan_to_limits_dict(free_plan)
            return None

        # Ensure current period before returning limits
        self._ensure_subscription_current(subscription)
        
        # CRITICAL: Refresh subscription to get latest plan_id, then refresh plan relationship
        self.db.refresh(subscription)
        
        # Re-query plan directly to ensure fresh data (bypass relationship cache)
        plan = self.db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == subscription.plan_id
        ).first()
        
        if not plan:
            logger.error(f"Plan not found for subscription plan_id={subscription.plan_id}")
            return None
        
        # Refresh plan to ensure fresh limits
        self.db.refresh(plan)
        
        return self._plan_to_limits_dict(plan)
    
    def _ensure_ai_text_gen_column_detection(self) -> None:
        """Detect at runtime whether ai_text_generation_calls_limit column exists and cache the result."""
        if self._ai_text_gen_col_checked:
            return
        try:
            # Try to query the column - if it exists, this will work
            self.db.execute(text('SELECT ai_text_generation_calls_limit FROM subscription_plans LIMIT 0'))
            self._ai_text_gen_col_available = True
        except Exception:
            self._ai_text_gen_col_available = False
        finally:
            self._ai_text_gen_col_checked = True
    
    def _plan_to_limits_dict(self, plan: SubscriptionPlan) -> Dict[str, Any]:
        """Convert subscription plan to limits dictionary."""
        # Detect if unified AI text generation limit column exists
        self._ensure_ai_text_gen_column_detection()
        
        # Use unified AI text generation limit if column exists and is set
        ai_text_gen_limit = None
        if self._ai_text_gen_col_available:
            try:
                ai_text_gen_limit = getattr(plan, 'ai_text_generation_calls_limit', None)
                # If 0, treat as not set (unlimited for Enterprise or use fallback)
                if ai_text_gen_limit == 0:
                    ai_text_gen_limit = None
            except (AttributeError, Exception):
                # Column exists but access failed - use fallback
                ai_text_gen_limit = None
        
        return {
            'plan_name': plan.name,
            'tier': plan.tier.value,
            'limits': {
                # Unified AI text generation limit (applies to all LLM providers)
                # If not set, fall back to first non-zero legacy limit for backwards compatibility
                'ai_text_generation_calls': ai_text_gen_limit if ai_text_gen_limit is not None else (
                    plan.gemini_calls_limit if plan.gemini_calls_limit > 0 else
                    plan.openai_calls_limit if plan.openai_calls_limit > 0 else
                    plan.anthropic_calls_limit if plan.anthropic_calls_limit > 0 else
                    plan.mistral_calls_limit if plan.mistral_calls_limit > 0 else 0
                ),
                # Legacy per-provider limits (for backwards compatibility and analytics)
                'gemini_calls': plan.gemini_calls_limit,
                'openai_calls': plan.openai_calls_limit,
                'anthropic_calls': plan.anthropic_calls_limit,
                'mistral_calls': plan.mistral_calls_limit,
                # Other API limits
                'tavily_calls': plan.tavily_calls_limit,
                'serper_calls': plan.serper_calls_limit,
                'metaphor_calls': plan.metaphor_calls_limit,
                'firecrawl_calls': plan.firecrawl_calls_limit,
                'exa_calls': getattr(plan, 'exa_calls_limit', 0),  # Exa research API
                'stability_calls': plan.stability_calls_limit,
                'video_calls': getattr(plan, 'video_calls_limit', 0),  # Support missing column
                'image_edit_calls': getattr(plan, 'image_edit_calls_limit', 0),  # Support missing column
                'audio_calls': getattr(plan, 'audio_calls_limit', 0),  # Support missing column
                'wavespeed_calls': getattr(plan, 'wavespeed_calls_limit', 0),  # WaveSpeed API calls
                # Token limits
                'gemini_tokens': plan.gemini_tokens_limit,
                'openai_tokens': plan.openai_tokens_limit,
                'anthropic_tokens': plan.anthropic_tokens_limit,
                'mistral_tokens': plan.mistral_tokens_limit,
                'monthly_cost': plan.monthly_cost_limit
            },
            'features': plan.features or []
        }
    
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
        from .limit_validation import LimitValidator
        validator = LimitValidator(self)
        return validator.check_usage_limits(user_id, provider, tokens_requested, actual_provider_name)
    
    def estimate_tokens(self, text: str, provider: APIProvider) -> int:
        """Estimate token count for text based on provider."""
        
        # Get pricing info for token estimation
        pricing = self.db.query(APIProviderPricing).filter(
            APIProviderPricing.provider == provider,
            APIProviderPricing.is_active == True
        ).first()
        
        if pricing and pricing.tokens_per_word:
            # Use provider-specific conversion
            word_count = len(text.split())
            return int(word_count * pricing.tokens_per_word)
        else:
            # Use default estimation (roughly 1.3 tokens per word for most models)
            word_count = len(text.split())
            return int(word_count * 1.3)
    
    def get_pricing_info(self, provider: APIProvider, model_name: str = None) -> Optional[Dict[str, Any]]:
        """Get pricing information for a provider/model."""
        
        query = self.db.query(APIProviderPricing).filter(
            APIProviderPricing.provider == provider,
            APIProviderPricing.is_active == True
        )
        
        if model_name:
            query = query.filter(APIProviderPricing.model_name == model_name)
        
        pricing = query.first()
        
        if not pricing:
            return None
        
        # Return pricing info as dict
        return {
            'provider': pricing.provider.value,
            'model_name': pricing.model_name,
            'cost_per_input_token': pricing.cost_per_input_token,
            'cost_per_output_token': pricing.cost_per_output_token,
            'cost_per_request': pricing.cost_per_request,
            'description': pricing.description
        }
    
    def check_comprehensive_limits(
        self, 
        user_id: str, 
        operations: List[Dict[str, Any]]
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Comprehensive pre-flight validation that checks ALL limits before making ANY API calls.
        
        Delegates to LimitValidator for actual validation logic.
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
        from .limit_validation import LimitValidator
        validator = LimitValidator(self)
        return validator.check_comprehensive_limits(user_id, operations)
    
    def get_pricing_for_provider_model(self, provider: APIProvider, model_name: str) -> Optional[Dict[str, Any]]:
        """Get pricing configuration for a specific provider and model."""
        pricing = self.db.query(APIProviderPricing).filter(
            APIProviderPricing.provider == provider,
            APIProviderPricing.model_name == model_name
        ).first()
        
        if not pricing:
            return None
        
        return {
            'provider': pricing.provider.value,
            'model_name': pricing.model_name,
            'cost_per_input_token': pricing.cost_per_input_token,
            'cost_per_output_token': pricing.cost_per_output_token,
            'cost_per_request': pricing.cost_per_request,
            'cost_per_search': pricing.cost_per_search,
            'cost_per_image': pricing.cost_per_image,
            'cost_per_page': pricing.cost_per_page,
            'description': pricing.description
        }

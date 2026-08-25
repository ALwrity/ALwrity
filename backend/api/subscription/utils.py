"""
Shared utility functions for subscription API routes.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from loguru import logger

from models.subscription_models import SubscriptionPlan


def enum_value(value: Any, default: str = "") -> str:
    """Safely read an enum or nullable DB column as a string."""
    if value is None:
        return default
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def format_plan_limits(plan: SubscriptionPlan) -> Dict[str, Any]:
    """
    Format subscription plan limits for API response.
    
    Includes _zero_means metadata per field to disambiguate:
      - 'disabled': 0 means the feature is not available (Free tier)
      - 'unlimited': 0 means unlimited usage (Enterprise tier)
      - 'limited': >0 means numerical limit applies
    
    Args:
        plan: SubscriptionPlan model instance
        
    Returns:
        Dictionary with formatted limits and _zero_means metadata
    """
    tier = plan.tier.value if hasattr(plan.tier, 'value') else str(plan.tier)
    is_enterprise = tier == 'enterprise'
    
    limit_fields = {
        "ai_text_generation_calls": getattr(plan, 'ai_text_generation_calls_limit', None) or 0,
        "gemini_calls": plan.gemini_calls_limit,
        "openai_calls": plan.openai_calls_limit,
        "anthropic_calls": plan.anthropic_calls_limit,
        "mistral_calls": plan.mistral_calls_limit,
        "tavily_calls": plan.tavily_calls_limit,
        "serper_calls": plan.serper_calls_limit,
        "metaphor_calls": plan.metaphor_calls_limit,
        "firecrawl_calls": plan.firecrawl_calls_limit,
        "stability_calls": plan.stability_calls_limit,
        "video_calls": getattr(plan, 'video_calls_limit', 0) or 0,
        "image_edit_calls": getattr(plan, 'image_edit_calls_limit', 0) or 0,
        "audio_calls": getattr(plan, 'audio_calls_limit', 0) or 0,
        "exa_calls": getattr(plan, 'exa_calls_limit', 0) or 0,
        "wavespeed_calls": getattr(plan, 'wavespeed_calls_limit', 0) or 0,
        "gemini_tokens": plan.gemini_tokens_limit,
        "openai_tokens": plan.openai_tokens_limit,
        "anthropic_tokens": plan.anthropic_tokens_limit,
        "mistral_tokens": plan.mistral_tokens_limit,
        "monthly_cost": plan.monthly_cost_limit,
    }
    
    # Build _zero_means metadata: indicates whether 0 means 'disabled' or 'unlimited'
    zero_means = {}
    for field, value in limit_fields.items():
        if field == "monthly_cost":
            zero_means[field] = "disabled"
        elif is_enterprise:
            # Enterprise: 0 means unlimited for all call/token fields
            zero_means[field] = "unlimited"
        else:
            # Free/Basic/Pro: determine per-field
            # Fields that are 0=disabled on Free tier but 0=unlimited on Basic/Pro
            call_and_token_fields = {
                "gemini_calls", "openai_calls", "anthropic_calls", "mistral_calls",
                "tavily_calls", "serper_calls", "metaphor_calls", "firecrawl_calls",
                "stability_calls", "video_calls", "image_edit_calls", "audio_calls",
                "exa_calls", "wavespeed_calls", "ai_text_generation_calls",
                "gemini_tokens", "openai_tokens", "anthropic_tokens", "mistral_tokens",
            }
            if field in call_and_token_fields:
                if value == 0:
                    zero_means[field] = "disabled" if tier == "free" else "unlimited"
                else:
                    zero_means[field] = "limited"
            else:
                zero_means[field] = "limited" if value > 0 else "disabled"
    
    return {
        **limit_fields,
        "_zero_means": zero_means,
    }

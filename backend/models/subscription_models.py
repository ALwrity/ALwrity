"""
Subscription and Usage Tracking Models
Comprehensive models for usage-based subscription system with API cost tracking.
"""

# Ensure Optional is available in global scope for dynamic imports
from typing import Optional

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, JSON, Text, ForeignKey, Enum, Index, UniqueConstraint
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import enum
from typing import Dict, Any

Base = declarative_base()

class SubscriptionTier(enum.Enum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"

class UsageStatus(enum.Enum):
    ACTIVE = "active"
    WARNING = "warning"  # 80% usage
    LIMIT_REACHED = "limit_reached"  # 100% usage
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"
    PAST_DUE = "past_due"

class APIProvider(enum.Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    MISTRAL = "mistral"
    WAVESPEED = "wavespeed"
    TAVILY = "tavily"
    SERPER = "serper"
    METAPHOR = "metaphor"
    FIRECRAWL = "firecrawl"
    STABILITY = "stability"
    EXA = "exa"
    VIDEO = "video"
    IMAGE_EDIT = "image_edit"
    AUDIO = "audio"

class BillingCycle(enum.Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"

class SubscriptionPlan(Base):
    """Defines subscription tiers and their limits."""
    
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)
    tier = Column(Enum(SubscriptionTier), nullable=False)
    price_monthly = Column(Float, nullable=False, default=0.0)
    price_yearly = Column(Float, nullable=False, default=0.0)
    
    # Unified AI Text Generation Call Limit (applies to all LLM providers: gemini, openai, anthropic, mistral)
    # Note: This column may not exist in older databases - use getattr() when accessing
    ai_text_generation_calls_limit = Column(Integer, default=0, nullable=True)  # 0 = unlimited, None if column doesn't exist
    
    # Legacy per-provider limits (kept for backwards compatibility and analytics)
    gemini_calls_limit = Column(Integer, default=0)  # 0 = unlimited (deprecated, use ai_text_generation_calls_limit)
    openai_calls_limit = Column(Integer, default=0)  # (deprecated, use ai_text_generation_calls_limit)
    anthropic_calls_limit = Column(Integer, default=0)  # (deprecated, use ai_text_generation_calls_limit)
    mistral_calls_limit = Column(Integer, default=0)  # (deprecated, use ai_text_generation_calls_limit)
    
    # Other API Call Limits (non-LLM)
    tavily_calls_limit = Column(Integer, default=0)
    serper_calls_limit = Column(Integer, default=0)
    metaphor_calls_limit = Column(Integer, default=0)
    firecrawl_calls_limit = Column(Integer, default=0)
    stability_calls_limit = Column(Integer, default=0)  # Image generation
    exa_calls_limit = Column(Integer, default=0)  # Exa neural search
    video_calls_limit = Column(Integer, default=0)  # AI video generation
    image_edit_calls_limit = Column(Integer, default=0)  # AI image editing
    audio_calls_limit = Column(Integer, default=0)  # AI audio generation (text-to-speech)
    wavespeed_calls_limit = Column(Integer, default=0)  # WaveSpeed API calls (LLM + TTS + video + image)
    
    # Token Limits (for LLM providers)
    gemini_tokens_limit = Column(Integer, default=0)
    openai_tokens_limit = Column(Integer, default=0)
    anthropic_tokens_limit = Column(Integer, default=0)
    mistral_tokens_limit = Column(Integer, default=0)
    
    # Cost Limits (in USD)
    monthly_cost_limit = Column(Float, default=0.0)  # 0 = unlimited
    
    # Features
    features = Column(JSON, nullable=True)  # JSON list of enabled features
    
    # Metadata
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserSubscription(Base):
    """User's current subscription and billing information."""
    
    __tablename__ = "user_subscriptions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), nullable=False, unique=True)
    plan_id = Column(Integer, ForeignKey('subscription_plans.id'), nullable=False)
    
    # Billing
    billing_cycle = Column(Enum(BillingCycle), default=BillingCycle.MONTHLY)
    current_period_start = Column(DateTime, nullable=False)
    current_period_end = Column(DateTime, nullable=False)
    
    # Status
    status = Column(Enum(UsageStatus), default=UsageStatus.ACTIVE)
    is_active = Column(Boolean, default=True)
    auto_renew = Column(Boolean, default=True)
    
    # Payment
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    payment_method = Column(String(50), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    plan = relationship("SubscriptionPlan")


class ProcessedStripeEvent(Base):
    """Tracks Stripe webhook processing to enforce idempotency and aid observability."""

    __tablename__ = "processed_stripe_events"

    event_id = Column(String(255), primary_key=True)
    event_type = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="processing")
    attempt_count = Column(Integer, nullable=False, default=1)
    received_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processing_started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class APIUsageLog(Base):
    """Detailed log of every API call for billing and monitoring."""
    
    __tablename__ = "api_usage_logs"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), nullable=False)
    
    # API Details
    provider = Column(Enum(APIProvider, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    endpoint = Column(String(200), nullable=False)
    method = Column(String(10), nullable=False)
    model_used = Column(String(100), nullable=True)  # e.g., "gemini-2.5-flash"
    actual_provider_name = Column(String(50), nullable=True)  # e.g., "wavespeed", "google", "huggingface" - tracks real provider behind generic enum
    
    # Usage Metrics
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    tokens_total = Column(Integer, default=0)
    
    # Cost Calculation
    cost_input = Column(Float, default=0.0)  # Cost for input tokens
    cost_output = Column(Float, default=0.0)  # Cost for output tokens
    cost_total = Column(Float, default=0.0)  # Total cost for this call
    
    # Performance
    response_time = Column(Float, nullable=False)  # Response time in seconds
    status_code = Column(Integer, nullable=False)
    
    # Request Details
    request_size = Column(Integer, nullable=True)  # Request size in bytes
    response_size = Column(Integer, nullable=True)  # Response size in bytes
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    # Error Handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    
    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    billing_period = Column(String(20), nullable=False)  # e.g., "2025-01"
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_api_usage_logs_user_id', 'user_id'),
        Index('idx_api_usage_logs_billing_period', 'billing_period'),
        Index('idx_api_usage_logs_timestamp', 'timestamp'),
        Index('idx_api_usage_logs_provider', 'provider'),
        Index('idx_api_usage_logs_user_period', 'user_id', 'billing_period'),
        Index('idx_api_usage_logs_user_provider_period', 'user_id', 'provider', 'billing_period'),
        {'mysql_engine': 'InnoDB'},
    )

class UsageSummary(Base):
    """Aggregated usage statistics per user per billing period."""
    
    __tablename__ = "usage_summaries"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), nullable=False)
    billing_period = Column(String(20), nullable=False)  # e.g., "2025-01"
    
    # API Call Counts
    gemini_calls = Column(Integer, default=0)
    openai_calls = Column(Integer, default=0)
    anthropic_calls = Column(Integer, default=0)
    mistral_calls = Column(Integer, default=0)
    wavespeed_calls = Column(Integer, default=0)
    tavily_calls = Column(Integer, default=0)
    serper_calls = Column(Integer, default=0)
    metaphor_calls = Column(Integer, default=0)
    firecrawl_calls = Column(Integer, default=0)
    stability_calls = Column(Integer, default=0)
    exa_calls = Column(Integer, default=0)
    video_calls = Column(Integer, default=0)  # AI video generation
    image_edit_calls = Column(Integer, default=0)  # AI image editing
    audio_calls = Column(Integer, default=0)  # AI audio generation (text-to-speech)
    
    # Token Usage
    gemini_tokens = Column(Integer, default=0)
    openai_tokens = Column(Integer, default=0)
    anthropic_tokens = Column(Integer, default=0)
    mistral_tokens = Column(Integer, default=0)
    wavespeed_tokens = Column(Integer, default=0)
    
    # Cost Tracking
    gemini_cost = Column(Float, default=0.0)
    openai_cost = Column(Float, default=0.0)
    anthropic_cost = Column(Float, default=0.0)
    mistral_cost = Column(Float, default=0.0)
    wavespeed_cost = Column(Float, default=0.0)
    tavily_cost = Column(Float, default=0.0)
    serper_cost = Column(Float, default=0.0)
    metaphor_cost = Column(Float, default=0.0)
    firecrawl_cost = Column(Float, default=0.0)
    stability_cost = Column(Float, default=0.0)
    exa_cost = Column(Float, default=0.0)
    video_cost = Column(Float, default=0.0)  # AI video generation
    image_edit_cost = Column(Float, default=0.0)  # AI image editing
    audio_cost = Column(Float, default=0.0)  # AI audio generation (text-to-speech)
    
    # Totals
    total_calls = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    total_cost = Column(Float, default=0.0)
    
    # Performance Metrics
    avg_response_time = Column(Float, default=0.0)
    error_rate = Column(Float, default=0.0)  # Percentage
    
    # Status
    usage_status = Column(Enum(UsageStatus), default=UsageStatus.ACTIVE)
    warnings_sent = Column(Integer, default=0)  # Number of warning emails sent
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint on user_id and billing_period
    __table_args__ = (
        UniqueConstraint('user_id', 'billing_period', name='uq_usage_summaries_user_period'),
        Index('idx_usage_summaries_user_period', 'user_id', 'billing_period'),
        {'mysql_engine': 'InnoDB'},
    )

class APIProviderPricing(Base):
    """Pricing configuration for different API providers."""
    
    __tablename__ = "api_provider_pricing"
    
    id = Column(Integer, primary_key=True)
    provider = Column(Enum(APIProvider), nullable=False)
    model_name = Column(String(100), nullable=False)
    
    # Pricing per token (in USD)
    cost_per_input_token = Column(Float, default=0.0)
    cost_per_output_token = Column(Float, default=0.0)
    cost_per_request = Column(Float, default=0.0)  # Fixed cost per API call
    
    # Pricing per unit for non-LLM APIs
    cost_per_search = Column(Float, default=0.0)  # For search APIs
    cost_per_image = Column(Float, default=0.0)  # For image generation
    cost_per_page = Column(Float, default=0.0)  # For web crawling
    
    # Token conversion (tokens per unit)
    tokens_per_word = Column(Float, default=1.3)  # Approximate tokens per word
    tokens_per_character = Column(Float, default=0.25)  # Approximate tokens per character
    
    # Metadata
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    effective_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint on provider and model
    __table_args__ = (
        UniqueConstraint('provider', 'model_name', name='uq_api_provider_pricing_provider_model'),
        {'mysql_engine': 'InnoDB'},
    )

class UsageAlert(Base):
    """Usage alerts and notifications."""
    
    __tablename__ = "usage_alerts"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), nullable=False)
    
    # Alert Details
    alert_type = Column(String(50), nullable=False)  # "usage_warning", "limit_reached", "cost_warning"
    threshold_percentage = Column(Integer, nullable=False)  # 80, 90, 100
    provider = Column(Enum(APIProvider), nullable=True)  # Specific provider or None for overall
    
    # Alert Content
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), default="info")  # "info", "warning", "error"
    
    # Status
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime, nullable=True)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    # Metadata
    billing_period = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
class BillingHistory(Base):
    """Historical billing records."""
    
    __tablename__ = "billing_history"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), nullable=False)
    
    # Billing Period
    billing_period = Column(String(20), nullable=False)  # e.g., "2025-01"
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    # Subscription
    plan_name = Column(String(50), nullable=False)
    base_cost = Column(Float, default=0.0)
    
    # Usage Costs
    usage_cost = Column(Float, default=0.0)
    overage_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    
    # Payment
    payment_status = Column(String(20), default="pending")  # "pending", "paid", "failed"
    payment_date = Column(DateTime, nullable=True)
    stripe_invoice_id = Column(String(100), nullable=True)
    
    # Usage Summary (snapshot)
    total_api_calls = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    usage_details = Column(JSON, nullable=True)  # Detailed breakdown
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SubscriptionRenewalHistory(Base):
    """Historical record of subscription renewals and expiration events."""
    
    __tablename__ = "subscription_renewal_history"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), nullable=False)
    
    # Subscription Details
    plan_id = Column(Integer, ForeignKey('subscription_plans.id'), nullable=False)
    plan_name = Column(String(50), nullable=False)
    plan_tier = Column(String(20), nullable=False)  # e.g., "free", "basic", "pro", "enterprise"
    
    # Period Information
    previous_period_start = Column(DateTime, nullable=True)  # Start of the previous period (if renewal)
    previous_period_end = Column(DateTime, nullable=True)  # End of the previous period (when it expired)
    new_period_start = Column(DateTime, nullable=False)  # Start of the new period (when renewed)
    new_period_end = Column(DateTime, nullable=False)  # End of the new period
    
    # Billing Cycle
    billing_cycle = Column(Enum(BillingCycle), nullable=False)  # "monthly" or "yearly"
    
    # Renewal Information
    renewal_type = Column(String(20), nullable=False)  # "new", "renewal", "upgrade", "downgrade"
    renewal_count = Column(Integer, default=0)  # Sequential renewal number (1st renewal, 2nd renewal, etc.)
    
    # Previous Subscription Snapshot (before renewal)
    previous_plan_name = Column(String(50), nullable=True)
    previous_plan_tier = Column(String(20), nullable=True)
    
    # Usage Summary Before Renewal (snapshot)
    usage_before_renewal = Column(JSON, nullable=True)  # Snapshot of usage before renewal
    
    # Payment Information
    payment_amount = Column(Float, default=0.0)
    payment_status = Column(String(20), default="pending")  # "pending", "paid", "failed"
    payment_date = Column(DateTime, nullable=True)
    stripe_invoice_id = Column(String(100), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    plan = relationship("SubscriptionPlan")
    
    # Indexes for performance
    __table_args__ = (
        UniqueConstraint('user_id', 'new_period_start', 'new_period_end', 'renewal_type', name='uq_subscription_renewal_event'),
        Index('idx_subscription_renewal_history_user_id', 'user_id'),
        Index('idx_subscription_renewal_history_created_at', 'created_at'),
        Index('idx_subscription_renewal_history_user_created', 'user_id', 'created_at'),
        Index('idx_subscription_renewal_history_user_period', 'user_id', 'new_period_start', 'new_period_end'),
        {'mysql_engine': 'InnoDB'},
    )

class FraudWarning(Base):
    __tablename__ = "fraud_warnings"
    
    id = Column(String(100), primary_key=True)
    charge_id = Column(String(100), nullable=False)
    payment_intent_id = Column(String(100), nullable=True)
    user_id = Column(String(100), nullable=True)
    amount = Column(Integer, nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="")
    status = Column(String(20), nullable=False, default="open")
    action = Column(String(20), nullable=False, default="none")
    action_at = Column(DateTime, nullable=True)
    reason_notes = Column(Text, nullable=True)
    meta_info = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


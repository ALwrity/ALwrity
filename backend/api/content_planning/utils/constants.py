"""
Constants for Content Planning API
Centralized constants and business rules extracted from the main content_planning.py file.
"""

from fastapi import status

# API Endpoints
API_PREFIX = "/api/content-planning"
API_TAGS = ["content-planning"]

# Calendar SIF (R6.1): semantic-search query length cap
CALENDAR_SIF_QUERY_MAX: int = 512

# HTTP Status Codes
HTTP_STATUS_CODES = {
    "OK": status.HTTP_200_OK,
    "CREATED": status.HTTP_201_CREATED,
    "NO_CONTENT": status.HTTP_204_NO_CONTENT,
    "BAD_REQUEST": status.HTTP_400_BAD_REQUEST,
    "UNAUTHORIZED": status.HTTP_401_UNAUTHORIZED,
    "FORBIDDEN": status.HTTP_403_FORBIDDEN,
    "NOT_FOUND": status.HTTP_404_NOT_FOUND,
    "CONFLICT": status.HTTP_409_CONFLICT,
    "UNPROCESSABLE_ENTITY": status.HTTP_422_UNPROCESSABLE_ENTITY,
    "INTERNAL_SERVER_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
    "SERVICE_UNAVAILABLE": status.HTTP_503_SERVICE_UNAVAILABLE
}

# Error Messages
ERROR_MESSAGES = {
    "strategy_not_found": "Content strategy not found",
    "calendar_event_not_found": "Calendar event not found",
    "gap_analysis_not_found": "Content gap analysis not found",
    "user_not_found": "User not found",
    "invalid_request": "Invalid request data",
    "database_connection": "Database connection failed",
    "ai_service_unavailable": "AI service is currently unavailable",
    "validation_failed": "Request validation failed",
    "permission_denied": "Permission denied",
    "rate_limit_exceeded": "Rate limit exceeded",
    "internal_server_error": "Internal server error",
    "service_unavailable": "Service temporarily unavailable"
}

# Success Messages
SUCCESS_MESSAGES = {
    "strategy_created": "Content strategy created successfully",
    "strategies_retrieved": "Content strategies retrieved successfully",
    "strategy_updated": "Content strategy updated successfully",
    "strategy_deleted": "Content strategy deleted successfully",
    "calendar_event_created": "Calendar event created successfully",
    "calendar_event_updated": "Calendar event updated successfully",
    "calendar_event_deleted": "Calendar event deleted successfully",
    "gap_analysis_created": "Content gap analysis created successfully",
    "gap_analysis_completed": "Content gap analysis completed successfully",
    "ai_analytics_generated": "AI analytics generated successfully",
    "calendar_generated": "Calendar generated successfully",
    "content_optimized": "Content optimized successfully",
    "performance_predicted": "Performance prediction completed successfully"
}

# Business Rules
BUSINESS_RULES = {
    "max_strategies_per_user": 10,
    "max_calendar_events_per_strategy": 100,
    "max_gap_analyses_per_user": 5,
    "max_ai_analytics_per_user": 20,
    "default_page_size": 10,
    "max_page_size": 100,
    "cache_duration_hours": 24,
    "max_processing_time_seconds": 30,
    "min_confidence_score": 0.7,
    "max_competitor_urls": 10,
    "max_target_keywords": 50
}

# Content Types
CONTENT_TYPES = [
    "blog_post",
    "social_media_post",
    "video",
    "infographic",
    "case_study",
    "whitepaper",
    "newsletter",
    "webinar",
    "podcast",
    "live_stream"
]

# Platforms
PLATFORMS = [
    "linkedin",
    "twitter",
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
    "website",
    "email",
    "medium",
    "quora"
]

# Industries
INDUSTRIES = [
    "technology",
    "healthcare",
    "finance",
    "education",
    "retail",
    "manufacturing",
    "consulting",
    "real_estate",
    "legal",
    "non_profit"
]

# Business Sizes
BUSINESS_SIZES = [
    "startup",
    "sme",
    "enterprise"
]

# Calendar Types
CALENDAR_TYPES = [
    "monthly",
    "weekly",
    "custom"
]

# Time Periods
TIME_PERIODS = [
    "7d",
    "30d",
    "90d",
    "1y"
]

# AI Service Status
AI_SERVICE_STATUS = {
    "operational": "operational",
    "degraded": "degraded",
    "unavailable": "unavailable",
    "fallback": "fallback"
}

# Data Sources
DATA_SOURCES = {
    "ai_analysis": "ai_analysis",
    "database_cache": "database_cache",
    "fallback": "fallback"
}

# Priority Levels
PRIORITY_LEVELS = [
    "high",
    "medium",
    "low"
]

# Content Pillars
DEFAULT_CONTENT_PILLARS = [
    "Educational Content",
    "Thought Leadership",
    "Product Updates",
    "Industry Insights",
    "Customer Stories",
    "Behind the Scenes"
]

# Performance Metrics
PERFORMANCE_METRICS = [
    "engagement_rate",
    "reach",
    "conversion_rate",
    "click_through_rate",
    "time_on_page",
    "bounce_rate",
    "social_shares",
    "comments",
    "likes"
]

# Validation Rules
VALIDATION_RULES = {
    "min_title_length": 3,
    "max_title_length": 100,
    "min_description_length": 10,
    "max_description_length": 1000,
    "min_url_length": 10,
    "max_url_length": 500,
    "min_keyword_length": 2,
    "max_keyword_length": 50
}

# Logging Levels
LOGGING_LEVELS = {
    "debug": "DEBUG",
    "info": "INFO",
    "warning": "WARNING",
    "error": "ERROR",
    "critical": "CRITICAL"
}

# Cache Keys
CACHE_KEYS = {
    "strategies": "content_planning:strategies",
    "calendar_events": "content_planning:calendar_events",
    "gap_analyses": "content_planning:gap_analyses",
    "ai_analytics": "content_planning:ai_analytics",
    "calendar_generation": "content_planning:calendar_generation"
}

# API Rate Limits
RATE_LIMITS = {
    "strategies_per_minute": 10,
    "calendar_events_per_minute": 20,
    "gap_analyses_per_hour": 5,
    "ai_analytics_per_hour": 10,
    "calendar_generation_per_hour": 3
} 
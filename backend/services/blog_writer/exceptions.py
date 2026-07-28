"""
Blog Writer Exception Hierarchy

Defines custom exception classes for different failure modes in the AI Blog Writer.
Each exception includes error_code, user_message, retry_suggested, and actionable_steps.
"""

from typing import List, Optional, Dict, Any
from enum import Enum


class ErrorCategory(Enum):
    """Categories for error classification."""
    TRANSIENT = "transient"  # Temporary issues, retry recommended
    PERMANENT = "permanent"  # Permanent issues, no retry
    USER_ERROR = "user_error"  # User input issues, fix input
    API_ERROR = "api_error"  # External API issues
    VALIDATION_ERROR = "validation_error"  # Data validation issues
    SYSTEM_ERROR = "system_error"  # Internal system issues


class BlogWriterException(Exception):
    """Base exception for all Blog Writer errors."""
    
    def __init__(
        self,
        message: str,
        error_code: str,
        user_message: str,
        retry_suggested: bool = False,
        actionable_steps: Optional[List[str]] = None,
        error_category: ErrorCategory = ErrorCategory.SYSTEM_ERROR,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.error_code = error_code
        self.user_message = user_message
        self.retry_suggested = retry_suggested
        self.actionable_steps = actionable_steps or []
        self.error_category = error_category
        self.context = context or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses."""
        return {
            "error_code": self.error_code,
            "user_message": self.user_message,
            "retry_suggested": self.retry_suggested,
            "actionable_steps": self.actionable_steps,
            "error_category": self.error_category.value,
            "context": self.context
        }


class ResearchFailedException(BlogWriterException):
    """Raised when research operation fails."""
    
    def __init__(
        self,
        message: str,
        user_message: str = "Research failed. Please try again with different keywords or check your internet connection.",
        retry_suggested: bool = True,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="RESEARCH_FAILED",
            user_message=user_message,
            retry_suggested=retry_suggested,
            actionable_steps=[
                "Try with different keywords",
                "Check your internet connection",
                "Wait a few minutes and try again",
                "Contact support if the issue persists"
            ],
            error_category=ErrorCategory.API_ERROR,
            context=context
        )


class OutlineGenerationException(BlogWriterException):
    """Raised when outline generation fails."""
    
    def __init__(
        self,
        message: str,
        user_message: str = "Outline generation failed. Please try again or adjust your research data.",
        retry_suggested: bool = True,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="OUTLINE_GENERATION_FAILED",
            user_message=user_message,
            retry_suggested=retry_suggested,
            actionable_steps=[
                "Try generating outline again",
                "Check if research data is complete",
                "Try with different research keywords",
                "Contact support if the issue persists"
            ],
            error_category=ErrorCategory.API_ERROR,
            context=context
        )


class ContentGenerationException(BlogWriterException):
    """Raised when content generation fails."""
    
    def __init__(
        self,
        message: str,
        user_message: str = "Content generation failed. Please try again or adjust your outline.",
        retry_suggested: bool = True,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="CONTENT_GENERATION_FAILED",
            user_message=user_message,
            retry_suggested=retry_suggested,
            actionable_steps=[
                "Try generating content again",
                "Check if outline is complete",
                "Try with a shorter outline",
                "Contact support if the issue persists"
            ],
            error_category=ErrorCategory.API_ERROR,
            context=context
        )


class SEOAnalysisException(BlogWriterException):
    """Raised when SEO analysis fails."""
    
    def __init__(
        self,
        message: str,
        user_message: str = "SEO analysis failed. Content was generated but SEO optimization is unavailable.",
        retry_suggested: bool = True,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="SEO_ANALYSIS_FAILED",
            user_message=user_message,
            retry_suggested=retry_suggested,
            actionable_steps=[
                "Try SEO analysis again",
                "Continue without SEO optimization",
                "Contact support if the issue persists"
            ],
            error_category=ErrorCategory.API_ERROR,
            context=context
        )


class APIRateLimitException(BlogWriterException):
    """Raised when API rate limit is exceeded."""
    
    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        retry_message = f"Rate limit exceeded. Please wait {retry_after} seconds before trying again." if retry_after else "Rate limit exceeded. Please wait a few minutes before trying again."
        
        super().__init__(
            message=message,
            error_code="API_RATE_LIMIT",
            user_message=retry_message,
            retry_suggested=True,
            actionable_steps=[
                f"Wait {retry_after or 60} seconds before trying again",
                "Reduce the frequency of requests",
                "Try again during off-peak hours",
                "Contact support if you need higher limits"
            ],
            error_category=ErrorCategory.API_ERROR,
            context=context
        )


class APITimeoutException(BlogWriterException):
    """Raised when API request times out."""
    
    def __init__(
        self,
        message: str,
        timeout_seconds: int = 60,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="API_TIMEOUT",
            user_message=f"Request timed out after {timeout_seconds} seconds. Please try again.",
            retry_suggested=True,
            actionable_steps=[
                "Try again with a shorter request",
                "Check your internet connection",
                "Try again during off-peak hours",
                "Contact support if the issue persists"
            ],
            error_category=ErrorCategory.TRANSIENT,
            context=context
        )


class ValidationException(BlogWriterException):
    """Raised when input validation fails."""
    
    def __init__(
        self,
        message: str,
        field: str,
        user_message: str = "Invalid input provided. Please check your data and try again.",
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            user_message=user_message,
            retry_suggested=False,
            actionable_steps=[
                f"Check the {field} field",
                "Ensure all required fields are filled",
                "Verify data format is correct",
                "Contact support if you need help"
            ],
            error_category=ErrorCategory.USER_ERROR,
            context=context
        )


class CircuitBreakerOpenException(BlogWriterException):
    """Raised when circuit breaker is open."""
    
    def __init__(
        self,
        message: str,
        retry_after: int,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="CIRCUIT_BREAKER_OPEN",
            user_message=f"Service temporarily unavailable. Please wait {retry_after} seconds before trying again.",
            retry_suggested=True,
            actionable_steps=[
                f"Wait {retry_after} seconds before trying again",
                "Try again during off-peak hours",
                "Contact support if the issue persists"
            ],
            error_category=ErrorCategory.TRANSIENT,
            context=context
        )


class PartialSuccessException(BlogWriterException):
    """Raised when operation partially succeeds."""
    
    def __init__(
        self,
        message: str,
        partial_results: Dict[str, Any],
        failed_operations: List[str],
        user_message: str = "Operation partially completed. Some sections were generated successfully.",
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code="PARTIAL_SUCCESS",
            user_message=user_message,
            retry_suggested=True,
            actionable_steps=[
                "Review the generated content",
                "Retry failed sections individually",
                "Contact support if you need help with failed sections"
            ],
            error_category=ErrorCategory.TRANSIENT,
            context=context
        )
        self.partial_results = partial_results
        self.failed_operations = failed_operations

    def to_dict(self) -> Dict[str, Any]:
        """Include partial results and failed operations in serialization."""
        base = super().to_dict()
        base["partial_results"] = self.partial_results
        base["failed_operations"] = self.failed_operations
        return base

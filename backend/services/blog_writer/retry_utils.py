"""
Enhanced Retry Utilities for Blog Writer

Provides advanced retry logic with exponential backoff, jitter, retry budgets,
and specific error code handling for different types of API failures.
"""

import asyncio
import random
import time
from typing import Callable, Any, Optional, Dict, List, Awaitable
from dataclasses import dataclass
from loguru import logger

from .exceptions import APIRateLimitException, APITimeoutException


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True
    max_total_time: float = 300.0  # 5 minutes max total time
    retryable_errors: List[str] = None
    
    def __post_init__(self):
        if self.retryable_errors is None:
            self.retryable_errors = [
                "503", "502", "504",  # Server errors
                "429",  # Rate limit
                "timeout", "timed out",
                "connection", "network",
                "overloaded", "busy"
            ]


class RetryBudget:
    """Tracks retry budget to prevent excessive retries."""
    
    def __init__(self, max_total_time: float):
        self.max_total_time = max_total_time
        self.start_time = time.time()
        self.used_time = 0.0
    
    def can_retry(self) -> bool:
        """Check if we can still retry within budget."""
        self.used_time = time.time() - self.start_time
        return self.used_time < self.max_total_time
    
    def remaining_time(self) -> float:
        """Get remaining time in budget."""
        return max(0, self.max_total_time - self.used_time)


def is_retryable_error(error: Exception, retryable_errors: List[str]) -> bool:
    """Check if an error is retryable based on error message patterns."""
    error_str = str(error).lower()
    return any(pattern.lower() in error_str for pattern in retryable_errors)


def calculate_delay(attempt: int, config: RetryConfig) -> float:
    """Calculate delay for retry attempt with exponential backoff and jitter."""
    # Exponential backoff
    delay = config.base_delay * (config.exponential_base ** attempt)
    
    # Cap at max delay
    delay = min(delay, config.max_delay)
    
    # Add jitter to prevent thundering herd
    if config.jitter:
        jitter_range = delay * 0.1  # 10% jitter
        delay += random.uniform(-jitter_range, jitter_range)
    
    return max(0, delay)


async def retry_with_backoff(
    func: Callable[..., Awaitable[Any]],
    config: Optional[RetryConfig] = None,
    operation_name: str = "operation",
    context: Optional[Dict[str, Any]] = None
) -> Any:
    """
    Retry a function with enhanced backoff and budget management.
    
    Args:
        func: Async function to retry
        config: Retry configuration
        operation_name: Name of operation for logging
        context: Additional context for logging
        
    Returns:
        Function result
        
    Raises:
        Last exception if all retries fail
    """
    config = config or RetryConfig()
    budget = RetryBudget(config.max_total_time)
    last_exception = None
    
    for attempt in range(config.max_attempts):
        try:
            # Check if we're still within budget
            if not budget.can_retry():
                logger.warning(f"Retry budget exceeded for {operation_name} after {budget.used_time:.2f}s")
                break
            
            # Execute the function
            result = await func()
            logger.info(f"{operation_name} succeeded on attempt {attempt + 1}")
            return result
            
        except Exception as e:
            last_exception = e
            
            # Check if this is the last attempt
            if attempt == config.max_attempts - 1:
                logger.error(f"{operation_name} failed after {config.max_attempts} attempts: {str(e)}")
                break
            
            # Check if error is retryable
            if not is_retryable_error(e, config.retryable_errors):
                logger.warning(f"{operation_name} failed with non-retryable error: {str(e)}")
                break
            
            # Calculate delay and wait
            delay = calculate_delay(attempt, config)
            remaining_time = budget.remaining_time()
            
            # Don't wait longer than remaining budget
            if delay > remaining_time:
                logger.warning(f"Delay {delay:.2f}s exceeds remaining budget {remaining_time:.2f}s for {operation_name}")
                break
            
            logger.warning(
                f"{operation_name} attempt {attempt + 1} failed: {str(e)}. "
                f"Retrying in {delay:.2f}s (attempt {attempt + 2}/{config.max_attempts})"
            )
            
            await asyncio.sleep(delay)
    
    # If we get here, all retries failed
    if last_exception:
        # Enhance exception with retry context
        if isinstance(last_exception, Exception):
            error_str = str(last_exception)
            if "429" in error_str or "rate limit" in error_str.lower():
                raise APIRateLimitException(
                    f"Rate limit exceeded after {config.max_attempts} attempts",
                    retry_after=int(delay * 2),  # Suggest waiting longer
                    context=context
                )
            elif "timeout" in error_str.lower():
                raise APITimeoutException(
                    f"Request timed out after {config.max_attempts} attempts",
                    timeout_seconds=int(config.max_total_time),
                    context=context
                )
        
        raise last_exception
    
    raise Exception(f"{operation_name} failed after {config.max_attempts} attempts")


def retry_decorator(
    config: Optional[RetryConfig] = None,
    operation_name: Optional[str] = None
):
    """
    Decorator to add retry logic to async functions.
    
    Args:
        config: Retry configuration
        operation_name: Name of operation for logging
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            op_name = operation_name or func.__name__
            return await retry_with_backoff(
                lambda: func(*args, **kwargs),
                config=config,
                operation_name=op_name
            )
        return wrapper
    return decorator


# Predefined retry configurations for different operation types
RESEARCH_RETRY_CONFIG = RetryConfig(
    max_attempts=3,
    base_delay=2.0,
    max_delay=30.0,
    max_total_time=180.0,  # 3 minutes for research
    retryable_errors=["503", "429", "timeout", "overloaded", "connection"]
)

OUTLINE_RETRY_CONFIG = RetryConfig(
    max_attempts=2,
    base_delay=1.5,
    max_delay=20.0,
    max_total_time=120.0,  # 2 minutes for outline
    retryable_errors=["503", "429", "timeout", "overloaded"]
)

CONTENT_RETRY_CONFIG = RetryConfig(
    max_attempts=3,
    base_delay=1.0,
    max_delay=15.0,
    max_total_time=90.0,  # 1.5 minutes for content
    retryable_errors=["503", "429", "timeout", "overloaded"]
)

SEO_RETRY_CONFIG = RetryConfig(
    max_attempts=2,
    base_delay=1.0,
    max_delay=10.0,
    max_total_time=60.0,  # 1 minute for SEO
    retryable_errors=["503", "429", "timeout"]
)

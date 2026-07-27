"""
Circuit Breaker Pattern for Blog Writer API Calls

Implements circuit breaker pattern to prevent cascading failures when external APIs
are experiencing issues. Tracks failure rates and automatically disables calls when
threshold is exceeded, with auto-recovery after cooldown period.
"""

import time
import asyncio
import functools
from typing import Callable, Any, Optional, Dict
from enum import Enum
from dataclasses import dataclass
from loguru import logger

from .exceptions import CircuitBreakerOpenException


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Circuit is open, calls are blocked
    HALF_OPEN = "half_open"  # Testing if service is back


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5  # Number of failures before opening
    recovery_timeout: int = 60  # Seconds to wait before trying again
    success_threshold: int = 3  # Successes needed to close from half-open
    timeout: int = 30  # Timeout for individual calls
    max_failures_per_minute: int = 10  # Max failures per minute before opening


class CircuitBreaker:
    """Circuit breaker implementation for API calls."""
    
    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0
        self.last_success_time = 0
        self.failure_times = []  # Track failure times for rate limiting
        self._lock = asyncio.Lock()
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection.
        
        Args:
            func: Function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments
            
        Returns:
            Function result
            
        Raises:
            CircuitBreakerOpenException: If circuit is open
        """
        async with self._lock:
            # Check if circuit should be opened due to rate limiting
            await self._check_rate_limit()
            
            # Check circuit state
            if self.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                    logger.info(f"Circuit breaker {self.name} transitioning to HALF_OPEN")
                else:
                    retry_after = int(self.config.recovery_timeout - (time.time() - self.last_failure_time))
                    raise CircuitBreakerOpenException(
                        f"Circuit breaker {self.name} is OPEN",
                        retry_after=max(0, retry_after),
                        context={"circuit_name": self.name, "state": self.state.value}
                    )
        
        try:
            # Execute the function with timeout
            result = await asyncio.wait_for(
                func(*args, **kwargs),
                timeout=self.config.timeout
            )
            
            # Record success
            await self._record_success()
            return result
            
        except asyncio.TimeoutError:
            await self._record_failure("timeout")
            raise
        except Exception as e:
            await self._record_failure(str(e))
            raise
    
    async def _check_rate_limit(self):
        """Check if failure rate exceeds threshold."""
        current_time = time.time()
        
        # Remove failures older than 1 minute
        self.failure_times = [
            failure_time for failure_time in self.failure_times
            if current_time - failure_time < 60
        ]
        
        # Check if we've exceeded the rate limit
        if len(self.failure_times) >= self.config.max_failures_per_minute:
            self.state = CircuitState.OPEN
            self.last_failure_time = current_time
            logger.warning(f"Circuit breaker {self.name} opened due to rate limit: {len(self.failure_times)} failures in last minute")
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset."""
        return time.time() - self.last_failure_time >= self.config.recovery_timeout
    
    async def _record_success(self):
        """Record a successful call."""
        async with self._lock:
            self.last_success_time = time.time()
            
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.config.success_threshold:
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    logger.info(f"Circuit breaker {self.name} closed after {self.success_count} successes")
            elif self.state == CircuitState.CLOSED:
                # Reset failure count on success
                self.failure_count = 0
    
    async def _record_failure(self, error: str):
        """Record a failed call."""
        async with self._lock:
            current_time = time.time()
            self.failure_count += 1
            self.last_failure_time = current_time
            self.failure_times.append(current_time)
            
            logger.warning(f"Circuit breaker {self.name} recorded failure #{self.failure_count}: {error}")
            
            # Open circuit if threshold exceeded
            if self.failure_count >= self.config.failure_threshold:
                self.state = CircuitState.OPEN
                logger.error(f"Circuit breaker {self.name} opened after {self.failure_count} failures")
    
    def get_state(self) -> Dict[str, Any]:
        """Get current circuit breaker state."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure_time": self.last_failure_time,
            "last_success_time": self.last_success_time,
            "failures_in_last_minute": len([
                t for t in self.failure_times 
                if time.time() - t < 60
            ])
        }


class CircuitBreakerManager:
    """Manages multiple circuit breakers."""
    
    def __init__(self):
        self._breakers: Dict[str, CircuitBreaker] = {}
    
    def get_breaker(self, name: str, config: Optional[CircuitBreakerConfig] = None) -> CircuitBreaker:
        """Get or create a circuit breaker."""
        if name not in self._breakers:
            self._breakers[name] = CircuitBreaker(name, config)
        return self._breakers[name]
    
    def get_all_states(self) -> Dict[str, Dict[str, Any]]:
        """Get states of all circuit breakers."""
        return {name: breaker.get_state() for name, breaker in self._breakers.items()}
    
    def reset_breaker(self, name: str):
        """Reset a circuit breaker to closed state."""
        if name in self._breakers:
            self._breakers[name].state = CircuitState.CLOSED
            self._breakers[name].failure_count = 0
            self._breakers[name].success_count = 0
            logger.info(f"Circuit breaker {name} manually reset")


# Global circuit breaker manager
circuit_breaker_manager = CircuitBreakerManager()


def circuit_breaker(name: str, config: Optional[CircuitBreakerConfig] = None):
    """
    Decorator to add circuit breaker protection to async functions.
    
    Args:
        name: Circuit breaker name
        config: Circuit breaker configuration
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            breaker = circuit_breaker_manager.get_breaker(name, config)
            return await breaker.call(func, *args, **kwargs)
        return wrapper
    return decorator

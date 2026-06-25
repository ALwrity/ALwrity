"""Circuit breaker for growth engine LLM calls.

Reuses the production-grade ``CircuitBreakerManager`` from the blog writer
module with growth-specific thresholds.  Protects all growth-service LLM
calls so that a failing LLM doesn't cascade into repeated timeouts.
"""

from typing import Any, Callable

import asyncio
from loguru import logger
from services.blog_writer.circuit_breaker import (
    CircuitBreakerConfig,
    circuit_breaker_manager,
)
from services.blog_writer.exceptions import CircuitBreakerOpenException

GROWTH_LLM_CB_CONFIG = CircuitBreakerConfig(
    failure_threshold=3,
    recovery_timeout=30,
    success_threshold=2,
    timeout=90,
    max_failures_per_minute=5,
)


async def protected_llm_call(llm_func: Callable, **kwargs: Any) -> Any:
    """Execute an LLM function under the growth circuit breaker.

    Args:
        llm_func: The LLM provider function (e.g. ``llm_text_gen``).
        **kwargs: Forwarded directly to ``llm_func``.

    Returns:
        The raw LLM result.

    Raises:
        CircuitBreakerOpenException: If the circuit is open.
        asyncio.TimeoutError: If the call exceeds the breaker timeout.
        Any exception from the LLM function itself.
    """
    breaker = circuit_breaker_manager.get_breaker("growth_llm", GROWTH_LLM_CB_CONFIG)
    return await breaker.call(asyncio.to_thread, llm_func, **kwargs)

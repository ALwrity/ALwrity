import functools
import time
from typing import Any, Callable, Optional

from loguru import logger


SERVICE_TAG = "[Growth]"


def get_growth_logger(service_name: str):
    """Return a bound logger with a consistent service tag."""
    return logger.bind(growth_service=service_name)


def timed(level: str = "INFO"):
    """Decorator that logs method execution time with structured tags.

    Usage:
        @timed("INFO")
        async def my_method(self, ...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(self, *args, **kwargs):
            start = time.time()
            try:
                result = await func(self, *args, **kwargs)
                elapsed = time.time() - start
                logger.bind(growth_service=self.__class__.__name__).log(
                    level,
                    "{} {}.{} completed in {:.0f}ms",
                    SERVICE_TAG,
                    self.__class__.__name__,
                    func.__name__,
                    elapsed * 1000,
                )
                return result
            except Exception as e:
                elapsed = time.time() - start
                logger.bind(growth_service=self.__class__.__name__).error(
                    "{} {}.{} failed after {:.0f}ms: {}",
                    SERVICE_TAG,
                    self.__class__.__name__,
                    func.__name__,
                    elapsed * 1000,
                    e,
                )
                raise

        @functools.wraps(func)
        def sync_wrapper(self, *args, **kwargs):
            start = time.time()
            try:
                result = func(self, *args, **kwargs)
                elapsed = time.time() - start
                logger.bind(growth_service=self.__class__.__name__).log(
                    level,
                    "{} {}.{} completed in {:.0f}ms",
                    SERVICE_TAG,
                    self.__class__.__name__,
                    func.__name__,
                    elapsed * 1000,
                )
                return result
            except Exception as e:
                elapsed = time.time() - start
                logger.bind(growth_service=self.__class__.__name__).error(
                    "{} {}.{} failed after {:.0f}ms: {}",
                    SERVICE_TAG,
                    self.__class__.__name__,
                    func.__name__,
                    elapsed * 1000,
                    e,
                )
                raise

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


import asyncio

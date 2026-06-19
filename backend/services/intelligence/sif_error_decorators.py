"""Phase 1.2: SIFError boundary decorators.

Pre-1.2, every public method on ``TxtaiIntelligenceService`` and
``SIFIntegrationService`` had this pattern::

    try:
        ...
        return result
    except Exception as e:
        logger.error(...)
        if self.fail_fast:
            raise RuntimeError(...)
        return []

This file centralizes that pattern in a single decorator so the
methods themselves stay clean. The decorator:
  * Maps the underlying exception to the appropriate SIFError subclass
    (``SIFNotInitialized``, ``SIFSearchUnavailable``, ``SIFIndexCorrupted``,
    ``SIFEmbeddingFailed``).
  * Emits the structured ``log_sif_event`` line.
  * Bumps the ``sif_search_total{outcome=error}`` counter.
  * Respects the ``fail_fast`` flag: when True, raise the SIFError;
    when False, return the documented empty value (``[]`` / ``0`` / ``0.0``).
"""
from __future__ import annotations

import functools
import logging
from typing import Any, Callable, Optional

from .sif_errors import (
    SIFEmbeddingFailed,
    SIFError,
    SIFIndexCorrupted,
    SIFNotInitialized,
    SIFSearchUnavailable,
)
from .sif_metrics import inc_counter as _sif_metrics_inc
from .sif_metrics import log_sif_event as _sif_log

logger = logging.getLogger(__name__)


# Map underlying-exception class -> SIFError subclass. The order
# matters: more specific first.
_EXC_MAP = (
    (SIFNotInitialized, ()),
    (SIFIndexCorrupted, ()),
    (SIFEmbeddingFailed, (Exception,)),
    (SIFSearchUnavailable, (Exception,)),
)


def _wrap(operation: str, user_id: str, fail_fast: bool, default: Any):
    """Build a decorator that wraps a method in the SIFError contract.

    Args:
        operation: the SIFError.operation value, e.g. "search" or
            "index_content". Also used as the structured log field.
        user_id: passed to the SIFError for diagnostics. Captured
            at decoration time (so it must be ``self.user_id``); we
            look it up at call time via ``self``.
        fail_fast: if True, raise the SIFError. If False, return
            ``default`` so the API still works for callers that
            prefer silent empty results.
        default: the value to return on failure when not fail_fast.
            Usually ``[]``, ``0``, or ``0.0``.

    Returns:
        A decorator.
    """
    def decorator(method: Callable) -> Callable:
        @functools.wraps(method)
        async def async_wrapper(self, *args, **kwargs):
            uid = getattr(self, "user_id", user_id)
            try:
                result = await method(self, *args, **kwargs)
                return result
            except SIFError:
                # Re-raise SIFError subclass unchanged (already a fault)
                _sif_metrics_inc(f"sif_{operation}_total", "error")
                _sif_log(operation, user_id=uid, outcome="error", level="error")
                raise
            except Exception as exc:
                _sif_metrics_inc(f"sif_{operation}_total", "error")
                _sif_log(operation, user_id=uid, outcome="error", level="error")
                if fail_fast:
                    raise _map_exception(operation, uid, exc) from exc
                logger.error(
                    "SIF operation %s failed for user %s: %s",
                    operation, uid, exc, exc_info=True,
                )
                return default

        @functools.wraps(method)
        def sync_wrapper(self, *args, **kwargs):
            uid = getattr(self, "user_id", user_id)
            try:
                return method(self, *args, **kwargs)
            except SIFError:
                _sif_metrics_inc(f"sif_{operation}_total", "error")
                _sif_log(operation, user_id=uid, outcome="error", level="error")
                raise
            except Exception as exc:
                _sif_metrics_inc(f"sif_{operation}_total", "error")
                _sif_log(operation, user_id=uid, outcome="error", level="error")
                if fail_fast:
                    raise _map_exception(operation, uid, exc) from exc
                logger.error(
                    "SIF operation %s failed for user %s: %s",
                    operation, uid, exc, exc_info=True,
                )
                return default

        import asyncio as _asyncio
        if _asyncio.iscoroutinefunction(method):
            return async_wrapper
        return sync_wrapper

    return decorator


def _map_exception(operation: str, user_id: str, exc: Exception) -> SIFError:
    """Translate a raw exception into the most specific SIFError.

    The mapping is intentionally simple: any exception that mentions
    IndexIDMap/nprobe becomes SIFIndexCorrupted; any that mentions
    embedding/transformer becomes SIFEmbeddingFailed; everything
    else is SIFSearchUnavailable for read ops and SIFEmbeddingFailed
    for write ops. Callers can refine the mapping per-operation by
    passing a custom class via ``exception_map`` (future work).
    """
    msg = str(exc).lower()
    if "indexidmap" in msg or "nprobe" in msg or "not initialized" in msg or "notinitialised" in msg:
        return SIFNotInitialized(
            f"{operation} failed: {exc}", user_id=user_id, operation=operation, cause=exc
        )
    if "embedding" in msg or "transformer" in msg or "upsert" in msg or "delete" in msg or "index" in msg:
        return SIFEmbeddingFailed(
            f"{operation} failed: {exc}", user_id=user_id, operation=operation, cause=exc
        )
    if "search" in operation.lower() or "similarity" in operation.lower():
        return SIFSearchUnavailable(
            f"{operation} failed: {exc}", user_id=user_id, operation=operation, cause=exc
        )
    return SIFIndexCorrupted(
        f"{operation} failed: {exc}", user_id=user_id, operation=operation, cause=exc
    )


def sif_error_boundary(
    operation: str,
    user_id_attr: str = "user_id",
    fail_fast_attr: str = "fail_fast",
    default: Any = None,
):
    """Decorator that wraps a method in the SIFError contract.

    Usage::

        @sif_error_boundary(operation="search", default=[])
        async def search(self, query, limit=5):
            ...

        @sif_error_boundary(operation="index_content", default=0)
        async def index_content(self, items):
            ...

    The decorator reads ``self.user_id`` and ``self.fail_fast`` at
    call time so the wrapped method stays agnostic of these.
    """
    def decorator(method: Callable) -> Callable:
        @functools.wraps(method)
        async def async_wrapper(self, *args, **kwargs):
            uid = getattr(self, user_id_attr, "unknown")
            fail_fast = bool(getattr(self, fail_fast_attr, False))
            try:
                return await method(self, *args, **kwargs)
            except SIFError:
                _sif_metrics_inc(f"sif_{operation}_total", "error")
                _sif_log(operation, user_id=uid, outcome="error", level="error")
                raise
            except Exception as exc:
                _sif_metrics_inc(f"sif_{operation}_total", "error")
                _sif_log(operation, user_id=uid, outcome="error", level="error")
                if fail_fast:
                    raise _map_exception(operation, uid, exc) from exc
                logger.error(
                    "SIF operation %s failed for user %s: %s",
                    operation, uid, exc, exc_info=True,
                )
                return default

        @functools.wraps(method)
        def sync_wrapper(self, *args, **kwargs):
            uid = getattr(self, user_id_attr, "unknown")
            fail_fast = bool(getattr(self, fail_fast_attr, False))
            try:
                return method(self, *args, **kwargs)
            except SIFError:
                _sif_metrics_inc(f"sif_{operation}_total", "error")
                _sif_log(operation, user_id=uid, outcome="error", level="error")
                raise
            except Exception as exc:
                _sif_metrics_inc(f"sif_{operation}_total", "error")
                _sif_log(operation, user_id=uid, outcome="error", level="error")
                if fail_fast:
                    raise _map_exception(operation, uid, exc) from exc
                logger.error(
                    "SIF operation %s failed for user %s: %s",
                    operation, uid, exc, exc_info=True,
                )
                return default

        import asyncio as _asyncio
        if _asyncio.iscoroutinefunction(method):
            return async_wrapper
        return sync_wrapper

    return decorator

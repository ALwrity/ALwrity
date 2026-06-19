"""Phase 2.1: async helpers for off-loop execution.

The TxtaiIntelligenceService uses synchronous txtai / FAISS calls
(``upsert``, ``delete``, ``save``, ``search``, ``similarity``) that
are CPU-bound. Calling them directly from an async method would
block the event loop for the duration of the call, preventing other
in-flight requests from making progress.

This module provides a single helper, ``run_blocking``, that wraps
``asyncio.to_thread`` (the modern equivalent of
``loop.run_in_executor(None, ...)``) and is the *only* place in the
SIF stack that needs to know about thread-pool dispatch.

Usage from ``txtai_service.py``::

    from .sif_async_helpers import run_blocking

    async def search(self, query, limit=5):
        ...
        results = await run_blocking(self.embeddings.search, query, limit=limit)
        ...
"""
from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, TypeVar

T = TypeVar("T")


async def run_blocking(func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """Run a blocking call in the default asyncio thread pool.

    Args:
        func: a synchronous callable.
        *args: positional args forwarded to ``func``.
        **kwargs: keyword args forwarded to ``func``.

    Returns:
        Whatever ``func`` returns.

    Notes:
        This is intentionally a tiny wrapper around
        ``asyncio.to_thread`` so that the call site reads as
        ``await run_blocking(...)`` rather than the more obscure
        ``await asyncio.to_thread(...)``. It also gives us a
        single point to add tracing / metrics later without
        touching every call site.
    """
    return await asyncio.to_thread(func, *args, **kwargs)

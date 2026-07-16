"""Async wrapper to run synchronous Pillow work off the event loop."""

import asyncio
from functools import partial
from typing import Callable, TypeVar

T = TypeVar("T")


async def run_in_executor(fn: Callable[..., T], *args, **kwargs) -> T:
    """Run a synchronous function in a thread pool to avoid blocking
    the FastAPI async event loop during CPU-bound Pillow operations.

    Usage:
        result = await run_in_executor(GifService.stitch, frames, duration=1500)
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))

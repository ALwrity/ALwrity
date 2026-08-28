"""
Per-user asyncio lock for seo_audit JSON writes.

Prevents lost updates when multiple concurrent requests (e.g., sitemap analysis
and sitemap benchmark) try to modify WebsiteAnalysis.seo_audit simultaneously.

Note: This is an in-memory lock per worker process. In multi-worker deployments,
consider using Redis for distributed locking. For now, this provides protection
within a single worker.
"""

import asyncio
from typing import Dict


_seo_audit_locks: Dict[str, asyncio.Lock] = {}
_lock_creation_lock = asyncio.Lock()


async def get_seo_audit_lock(user_id: str) -> asyncio.Lock:
    """Get or create a lock for the given user_id."""
    if user_id not in _seo_audit_locks:
        async with _lock_creation_lock:
            if user_id not in _seo_audit_locks:
                _seo_audit_locks[user_id] = asyncio.Lock()
    return _seo_audit_locks[user_id]


async def with_seo_audit_lock(user_id: str, coro):
    """Execute a coroutine with the seo_audit lock held for the user."""
    lock = await get_seo_audit_lock(user_id)
    async with lock:
        return await coro

import hashlib
from typing import Any, Dict, Optional, Set

from loguru import logger
from services.analytics_cache_service import analytics_cache


class GrowthCache:
    """Growth engine cache that delegates to the shared ``AnalyticsCacheService``.

    Keeps convenient key helpers (``exa_key``, ``llm_key``) and per-service
    stats, while reusing the app-wide in-memory TTL cache backend.
    Exa results default to 300s TTL, LLM responses to 3600s TTL.
    """

    def __init__(self, default_ttl_seconds: int = 300):
        self._default_ttl = default_ttl_seconds
        self._keys: Set[str] = set()
        self._hits = 0
        self._misses = 0

    # ------------------------------------------------------------------
    # public
    # ------------------------------------------------------------------
    def get(self, key: str) -> Optional[Any]:
        """Return cached value if present and not expired."""
        value = analytics_cache.raw_get(key)
        if value is None:
            self._misses += 1
            return None
        self._hits += 1
        return value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None):
        """Store a value with TTL (defaults to instance default_ttl_seconds)."""
        analytics_cache.raw_set(key, value, ttl_seconds or self._default_ttl)
        self._keys.add(key)

    def clear(self):
        """Clear all growth-cached entries."""
        removed = 0
        removed += analytics_cache.raw_invalidate_prefix("exa:")
        removed += analytics_cache.raw_invalidate_prefix("llm:")
        self._keys.clear()
        self._hits = 0
        self._misses = 0
        logger.info("[GrowthCache] Cleared {} entries", removed)

    def clear_prefix(self, prefix: str):
        """Clear entries whose key starts with a given prefix (e.g. 'exa:' or 'llm:')."""
        count = analytics_cache.raw_invalidate_prefix(prefix)
        self._keys = {k for k in self._keys if not k.startswith(prefix)}
        if count:
            logger.info("[GrowthCache] Cleared {} entries with prefix '{}'", count, prefix)

    def stats(self) -> Dict[str, Any]:
        """Return cache statistics for monitoring."""
        return {
            "entries": len(self._keys),
            "max_entries": 0,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / (self._hits + self._misses) * 100, 1)
            if (self._hits + self._misses) > 0
            else 0.0,
            "default_ttl_seconds": self._default_ttl,
        }

    # ------------------------------------------------------------------
    # key helpers (convenience for services)
    # ------------------------------------------------------------------
    @staticmethod
    def exa_key(query: str, num_results: int, user_id: str) -> str:
        raw = f"{query}|{num_results}|{user_id}"
        return f"exa:{hashlib.md5(raw.encode()).hexdigest()}"

    @staticmethod
    def llm_key(prompt: str, user_id: str) -> str:
        raw = f"{prompt[:300]}|{user_id}"
        return f"llm:{hashlib.md5(raw.encode()).hexdigest()}"


# Global singleton — shared across all growth services
growth_cache = GrowthCache()

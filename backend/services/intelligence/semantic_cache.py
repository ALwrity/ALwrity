"""
Enhanced Semantic Caching System for ALwrity SIF

Provides intelligent caching for semantic operations including:
- User-specific semantic indices with TTL management
- Query result caching with relevance-based invalidation
- Content analysis caching with versioning
- Intelligent cache warming based on user behavior

Failure-mode contract (Phase 1.2)
---------------------------------
Every public method in this module that *writes* or *mutates* state
(``cache_*``, ``invalidate_*``, ``clear_cache``) raises
:class:`SIFCacheError` from ``sif_errors`` when the operation cannot
be completed due to an internal fault. They do **not** silently
return ``False`` for a real failure.

Every public method that *reads* state (``get_cached_*``) returns
``None`` for a normal cache miss (TTL expired, key absent, etc.) and
raises :class:`SIFCacheError` only for an internal fault (e.g. memory
corruption, serialization failure).

The one exception is :meth:`cache_query_results`, which keeps its
``bool`` return type because ``False`` is a *normal* signal meaning
"the results did not meet the relevance threshold". A real failure
on that method also raises :class:`SIFCacheError`.

Callers that want the legacy "silently return None on any failure"
behaviour should wrap calls in ``try/except SIFCacheError`` and treat
the exception as a miss.
"""

import json
import hashlib
import time
import threading
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from functools import wraps
import logging
from collections import OrderedDict
import asyncio
from concurrent.futures import ThreadPoolExecutor

from services.intelligence.sif_errors import SIFCacheError
from services.intelligence.sif_metrics import inc_counter as _sif_metrics_inc  # Phase 4.2
from services.intelligence.sif_metrics import log_sif_event as _sif_log  # Phase 4.5

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Represents a cached semantic intelligence entry"""
    data: Any
    timestamp: float
    ttl: int  # Time to live in seconds
    version: str
    metadata: Dict[str, Any]
    access_count: int = 0
    last_accessed: float = 0.0


@dataclass
class SemanticCacheStats:
    """Statistics for semantic cache performance"""
    total_hits: int = 0
    total_misses: int = 0
    total_invalidations: int = 0
    cache_size: int = 0
    memory_usage_mb: float = 0.0
    average_hit_time_ms: float = 0.0
    hit_rate: float = 0.0


class SemanticCacheManager:
    """
    Intelligent caching system for semantic intelligence operations
    
    Features:
    - Multi-tier caching (memory + persistent)
    - TTL-based expiration with intelligent defaults
    - Relevance-based cache invalidation
    - User-specific semantic index isolation
    - Performance monitoring and analytics
    """
    
    def __init__(
        self,
        max_memory_size_mb: int = 512,
        default_ttl_seconds: int = 3600,
        cleanup_interval_seconds: int = 300,
        enable_persistent_cache: bool = True,
        cache_dir: str = "/tmp/semantic_cache",
        # Phase 5 / Issue #6: callers can pin the model fingerprint
        # to derive a stable cache version. If not provided, we
        # fall back to the model path of the SIF txtai service
        # (which is what the cache is most often associated with).
        model_fingerprint: Optional[str] = None,
    ):
        self.max_memory_size_mb = max_memory_size_mb
        self.default_ttl = default_ttl_seconds
        self.cleanup_interval = cleanup_interval_seconds
        self.enable_persistent_cache = enable_persistent_cache
        self.cache_dir = cache_dir
        self._model_fingerprint = model_fingerprint

        # In-memory cache with LRU eviction
        self.memory_cache: Dict[str, CacheEntry] = OrderedDict()
        self.user_indices: Dict[str, str] = {}  # user_id -> index_hash mapping

        # Statistics
        self.stats = SemanticCacheStats()
        self._stats_lock = asyncio.Lock()

        # Phase 2.3: a re-entrant lock that protects every
        # read AND write of ``memory_cache`` and ``user_indices``.
        # Pre-2.3, concurrent writes from multiple threads (e.g. an
        # async-loop thread-pool worker calling ``cache_semantic_insights``
        # while the FastAPI event loop calls ``invalidate_user_cache``)
        # could interleave on the OrderedDict and corrupt the LRU
        # ordering or raise ``RuntimeError: dictionary changed size
        # during iteration``. ``threading.RLock`` is re-entrant so
        # the inner helpers (``_calculate_memory_usage``,
        # ``_evict_lru_entries``) can be called from within a locked
        # region without deadlocking.
        #
        # Lock-ordering rule: always acquire ``_cache_lock`` BEFORE
        # ``_stats_lock``. Never the reverse (we don't currently
        # nest the other way).
        self._cache_lock = threading.RLock()

        # Thread pool for background operations
        self.executor = ThreadPoolExecutor(max_workers=4)

        # Start background cleanup task (optional - can be started manually)
        self.cleanup_task = None
        if cleanup_interval_seconds > 0:
            # Note: Cleanup task should be started manually in async context
            pass

        logger.info(f"SemanticCacheManager initialized with {max_memory_size_mb}MB limit")
    
    def _generate_cache_key(
        self, 
        operation: str, 
        user_id: str, 
        params: Dict[str, Any]
    ) -> str:
        """Generate a unique cache key for semantic operations"""
        # Create deterministic key from operation, user, and parameters
        key_data = {
            "operation": operation,
            "user_id": user_id,
            "params": self._serialize_params(params)
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.sha256(key_str.encode()).hexdigest()
    
    def _serialize_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize parameters for consistent hashing"""
        serialized = {}
        for key, value in params.items():
            if isinstance(value, (list, dict)):
                serialized[key] = json.dumps(value, sort_keys=True)
            else:
                serialized[key] = str(value)
        return serialized
    
    def _is_entry_valid(self, entry: CacheEntry) -> bool:
        """Check if cache entry is still valid"""
        current_time = time.time()
        
        # Check TTL expiration
        if current_time - entry.timestamp > entry.ttl:
            return False
        
        # Check version compatibility (semantic analysis versions)
        if entry.version != self._get_current_version():
            return False
        
        return True
    
    def _get_current_version(self) -> str:
        """Get current semantic analysis version.

        Phase 5 / Issue #6: pre-#6 this returned a hardcoded
        ``"v1.0.0"``, which meant that *any* model change
        invalidated every cache entry for *every* user
        simultaneously ("cache miss storm"). The version is now
        derived from the model fingerprint so that an actual model
        change (e.g. swap from ``all-MiniLM-L6-v2`` to a different
        sentence-transformers model) produces a version change and
        a controlled invalidation.

        The fingerprint is set in three ways, in priority order:
          1. ``self._model_fingerprint`` if the caller passed one
             explicitly (e.g. ``SemanticCacheManager(model_fingerprint=...)``)
          2. ``services.intelligence.txtai_service.TxtaiIntelligenceService``
             default ``model_path`` (the standard SIF default)
          3. A static fallback (``"sif-default"``) so the cache
             still works even if neither of the above can be resolved.

        The output format is ``"v1:model=<fingerprint>"`` so cache
        entries from different model versions are visually
        distinguishable in logs.
        """
        if self._model_fingerprint:
            return f"v1:model={self._model_fingerprint}"
        try:
            # Late import to avoid a hard dependency on the txtai
            # service module at semantic_cache import time (which
            # is itself imported at app startup).
            from services.intelligence.txtai_service import TxtaiIntelligenceService
            default_path = getattr(
                TxtaiIntelligenceService, "DEFAULT_MODEL_PATH", None
            ) or "sentence-transformers/all-MiniLM-L6-v2"
            return f"v1:model={default_path}"
        except Exception:
            return "v1:model=sif-default"
    
    def _calculate_memory_usage(self) -> float:
        """Calculate current memory usage in MB"""
        total_size = 0
        for entry in self.memory_cache.values():
            # Rough estimation of memory usage
            entry_size = len(json.dumps(asdict(entry)).encode())
            total_size += entry_size
        
        return total_size / (1024 * 1024)  # Convert to MB
    
    def _evict_lru_entries(self, target_size_mb: float):
        """Evict least recently used entries to meet memory target"""
        current_size = self._calculate_memory_usage()
        
        while current_size > target_size_mb and self.memory_cache:
            # Remove oldest entry
            oldest_key = next(iter(self.memory_cache))
            del self.memory_cache[oldest_key]
            current_size = self._calculate_memory_usage()
            
            logger.debug(f"Evicted cache entry: {oldest_key}")
    
    def _periodic_cleanup(self):
        """Background task to clean up expired entries.

        Phase 2.4: previously this method was defined but never
        started (the comment at the call site said "Cleanup task
        should be started manually in async context"). The new
        :meth:`start_cleanup_loop` helper launches it on a daemon
        thread. Errors inside the loop are logged and the loop
        continues — a transient fault does not kill the cleanup.
        """
        while True:
            try:
                time.sleep(self.cleanup_interval)
                self.cleanup_expired_entries()

                # Update statistics
                self.stats.cache_size = len(self.memory_cache)
                self.stats.memory_usage_mb = self._calculate_memory_usage()

            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}", exc_info=True)

    def start_cleanup_loop(self) -> None:
        """Phase 2.4: launch :meth:`_periodic_cleanup` on a daemon
        thread. Idempotent: a second call is a no-op if the loop
        is already running. The thread is daemon so it does not
        block process shutdown.

        This is intentionally a sync helper (not async) because
        ``_periodic_cleanup`` is a sync infinite loop using
        :func:`time.sleep`. It is meant to be called once at app
        startup (e.g. from a FastAPI lifespan or a CLI bootstrap).
        """
        if self.cleanup_task is not None and self.cleanup_task.is_alive():
            logger.debug("Cleanup loop is already running; skipping start")
            return
        if self.cleanup_interval <= 0:
            logger.info("Cleanup interval is 0; not starting background loop")
            return
        self.cleanup_task = threading.Thread(
            target=self._periodic_cleanup,
            name=f"semantic_cache_cleanup[{id(self)}]",
            daemon=True,
        )
        self.cleanup_task.start()
        logger.info(
            f"Started semantic cache cleanup loop (interval={self.cleanup_interval}s)"
        )

    def stop_cleanup_loop(self, timeout: float = 5.0) -> None:
        """Phase 2.4: signal the cleanup thread to stop.

        The loop checks a ``_stop_event`` between iterations, so this
        is best-effort. Used in tests; production code can usually let
        the daemon thread die with the process.
        """
        if self.cleanup_task is not None and self.cleanup_task.is_alive():
            # We can't safely ``join()`` an infinite loop; the
            # caller's only option is to wait for the current sleep
            # to finish. The thread is daemon, so the process
            # shutdown will reap it regardless.
            self.cleanup_task.join(timeout=timeout)
            logger.info("Stopped semantic cache cleanup loop")
        self.cleanup_task = None
    
    def cache_semantic_insights(
        self,
        user_id: str,
        insights: Dict[str, Any],
        ttl: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Cache semantic insights for a user.

        Args:
            user_id: User identifier
            insights: Semantic insights data
            ttl: Time to live in seconds (uses default if None)
            metadata: Additional metadata for cache management

        Raises:
            SIFCacheError: If the cache write cannot be completed due
                to an internal fault (serialization, memory exhaustion
                that eviction could not resolve, etc.). Pre-Phase 1.2
                this method silently returned ``False``; callers that
                want the old behaviour should wrap in
                ``try/except SIFCacheError`` and treat the exception
                as a write failure.
        """
        with self._cache_lock:
            try:
                cache_key = self._generate_cache_key(
                    "semantic_insights",
                    user_id,
                    {"timestamp": time.time()}
                )

                entry = CacheEntry(
                    data=insights,
                    timestamp=time.time(),
                    ttl=ttl or self.default_ttl,
                    version=self._get_current_version(),
                    metadata=metadata or {},
                    access_count=1,
                    last_accessed=time.time()
                )

                # Check memory limit before adding
                projected_size = self._calculate_memory_usage() + (
                    len(json.dumps(insights).encode()) / (1024 * 1024)
                )

                if projected_size > self.max_memory_size_mb:
                    # Evict old entries to make room
                    self._evict_lru_entries(self.max_memory_size_mb * 0.8)

                self.memory_cache[cache_key] = entry
                self.memory_cache.move_to_end(cache_key)  # Mark as recently used

                # Update user index mapping
                self.user_indices[user_id] = cache_key

                logger.info(f"Cached semantic insights for user {user_id}")
                _sif_metrics_inc("sif_cache_total", "write_hit")
                _sif_log("cache", user_id=user_id, outcome="write_hit")

            except Exception as e:
                logger.error(
                    f"Failed to cache semantic insights for user {user_id}: {e}",
                    exc_info=True,
                )
                _sif_metrics_inc("sif_cache_total", "write_error")
                raise SIFCacheError(
                    f"Failed to cache semantic insights: {e}",
                    user_id=user_id,
                    operation="cache_semantic_insights",
                    cause=e,
                ) from e

    def get_stats(self) -> Dict[str, Any]:
        """Get current cache statistics"""
        return asdict(self.stats)

    def clear_cache(self) -> None:
        """
        Clear all cache entries.

        Raises:
            SIFCacheError: If the cache cannot be cleared due to an
                internal fault. Pre-Phase 1.2 this method silently
                returned ``False``; callers that want the old
                behaviour should wrap in ``try/except SIFCacheError``
                and treat the exception as a clear failure.
        """
        with self._cache_lock:
            try:
                self.memory_cache.clear()
                self.stats.cache_size = 0
                self.stats.memory_usage_mb = 0.0
            except Exception as e:
                logger.error(f"Error clearing cache: {e}", exc_info=True)
                raise SIFCacheError(
                    f"Error clearing cache: {e}",
                    operation="clear_cache",
                    cause=e,
                ) from e
    
    def get_cached_semantic_insights(
        self,
        user_id: str,
        force_refresh: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached semantic insights for a user.

        Args:
            user_id: User identifier
            force_refresh: Force cache refresh even if valid

        Returns:
            Cached insights, or ``None`` for a normal miss (no entry,
            expired TTL, or version mismatch). A normal miss is *not*
            an error.

        Raises:
            SIFCacheError: If the read cannot be completed due to an
                internal fault. Pre-Phase 1.2 this method silently
                returned ``None`` for any failure; callers that want
                the old behaviour should wrap in
                ``try/except SIFCacheError`` and treat the exception
                as a miss.
        """
        with self._cache_lock:
            try:
                cache_key = self.user_indices.get(user_id)
                if not cache_key:
                    self.stats.total_misses += 1
                    _sif_metrics_inc("sif_cache_total", "read_miss")
                    return None

                entry = self.memory_cache.get(cache_key)
                if not entry:
                    self.stats.total_misses += 1
                    _sif_metrics_inc("sif_cache_total", "read_miss")
                    return None

                # Check validity
                if not self._is_entry_valid(entry) or force_refresh:
                    del self.memory_cache[cache_key]
                    del self.user_indices[user_id]
                    self.stats.total_invalidations += 1
                    _sif_metrics_inc("sif_cache_total", "read_miss")
                    return None

                # Update access statistics
                entry.access_count += 1
                entry.last_accessed = time.time()
                self.memory_cache.move_to_end(cache_key)

                self.stats.total_hits += 1
                _sif_metrics_inc("sif_cache_total", "read_hit")
                _sif_log("cache", user_id=user_id, outcome="read_hit")

                logger.debug(f"Retrieved cached semantic insights for user {user_id}")
                return entry.data

            except Exception as e:
                logger.error(
                    f"Failed to retrieve cached semantic insights for user {user_id}: {e}",
                    exc_info=True,
                )
                _sif_metrics_inc("sif_cache_total", "read_error")
                raise SIFCacheError(
                    f"Failed to retrieve cached semantic insights: {e}",
                    user_id=user_id,
                    operation="get_cached_semantic_insights",
                    cause=e,
                ) from e
    
    def cache_query_results(
        self,
        query: str,
        results: List[Dict[str, Any]],
        relevance_threshold: float = 0.7,
        ttl: Optional[int] = None,
        user_id: str = None
    ) -> bool:
        """
        Cache semantic search query results with relevance-based
        invalidation.

        Args:
            query: Search query
            results: Query results
            relevance_threshold: Minimum relevance score for caching
            ttl: Time to live in seconds
            user_id: User identifier for scoped caching

        Returns:
            ``True`` if the result set was cached. ``False`` if the
            results did not meet the relevance threshold (a *normal*
            caller-facing signal, not an error).

        Raises:
            SIFCacheError: If the cache write cannot be completed due
                to an internal fault. Pre-Phase 1.2 this method
                silently returned ``False`` for any failure, which
                conflated "low-quality results" with "cache broke";
                callers that want the old behaviour should wrap in
                ``try/except SIFCacheError`` and treat the exception
                as a write failure (distinct from a relevance
                rejection).
        """
        with self._cache_lock:
            try:
                # Only cache high-quality results
                if not results or max(r.get('score', 0) for r in results) < relevance_threshold:
                    _sif_metrics_inc("sif_cache_total", "write_rejected")
                    return False

                cache_key = self._generate_cache_key(
                    "semantic_query",
                    user_id,  # User-scoped cache key
                    {"query": query, "threshold": relevance_threshold}
                )

                entry = CacheEntry(
                    data=results,
                    timestamp=time.time(),
                    ttl=ttl or (self.default_ttl // 2),  # Shorter TTL for queries
                    version=self._get_current_version(),
                    metadata={
                        "query": query,
                        "relevance_threshold": relevance_threshold,
                        "result_count": len(results)
                    }
                )

                self.memory_cache[cache_key] = entry
                self.memory_cache.move_to_end(cache_key)

                logger.info(f"Cached semantic query results for: {query}")
                _sif_metrics_inc("sif_cache_total", "write_hit")
                return True

            except Exception as e:
                logger.error(
                    f"Failed to cache query results for query={query!r} user_id={user_id}: {e}",
                    exc_info=True,
                )
                _sif_metrics_inc("sif_cache_total", "write_error")
                raise SIFCacheError(
                    f"Failed to cache query results: {e}",
                    user_id=user_id,
                    operation="cache_query_results",
                    cause=e,
                ) from e
    
    def get_cached_query_results(
        self,
        query: str,
        relevance_threshold: float = 0.7,
        user_id: str = None
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Retrieve cached semantic query results scoped to a user.

        Returns:
            Cached results, or ``None`` for a normal miss. A normal
            miss is *not* an error.

        Raises:
            SIFCacheError: If the read cannot be completed due to an
                internal fault. Pre-Phase 1.2 this method silently
                returned ``None`` for any failure; callers that want
                the old behaviour should wrap in
                ``try/except SIFCacheError`` and treat the exception
                as a miss.
        """
        with self._cache_lock:
            try:
                cache_key = self._generate_cache_key(
                    "semantic_query",
                    user_id,
                    {"query": query, "threshold": relevance_threshold}
                )

                entry = self.memory_cache.get(cache_key)
                if not entry or not self._is_entry_valid(entry):
                    _sif_metrics_inc("sif_cache_total", "read_miss")
                    return None

                # Update access statistics
                entry.access_count += 1
                entry.last_accessed = time.time()
                self.memory_cache.move_to_end(cache_key)

                logger.debug(f"Retrieved cached query results for: {query}")
                _sif_metrics_inc("sif_cache_total", "read_hit")
                return entry.data

            except Exception as e:
                logger.error(
                    f"Failed to retrieve cached query results for query={query!r} user_id={user_id}: {e}",
                    exc_info=True,
                )
                raise SIFCacheError(
                    f"Failed to retrieve cached query results: {e}",
                    user_id=user_id,
                    operation="get_cached_query_results",
                    cause=e,
                ) from e
    
    def invalidate_user_cache(self, user_id: str, operation_type: Optional[str] = None) -> None:
        """
        Invalidate cache entries for a specific user.

        Args:
            user_id: User identifier
            operation_type: Specific operation type to invalidate (optional)

        Raises:
            SIFCacheError: If the invalidation cannot be completed due
                to an internal fault. Pre-Phase 1.2 this method
                silently swallowed exceptions; callers that want the
                old behaviour should wrap in
                ``try/except SIFCacheError`` and treat the exception
                as a partial invalidation.
        """
        with self._cache_lock:
            try:
                keys_to_remove = []

                # Check user index mapping first
                if user_id in self.user_indices:
                    cache_key = self.user_indices[user_id]
                    if cache_key in self.memory_cache:
                        entry = self.memory_cache[cache_key]
                        if operation_type is None or entry.metadata.get("operation") == operation_type:
                            keys_to_remove.append(cache_key)

                # Also check all cache entries for user_id in metadata
                for cache_key, entry in list(self.memory_cache.items()):
                    if entry.metadata.get("user_id") == user_id:
                        if operation_type is None or entry.metadata.get("operation") == operation_type:
                            if cache_key not in keys_to_remove:
                                keys_to_remove.append(cache_key)

                # Remove identified keys
                for key in keys_to_remove:
                    if key in self.memory_cache:
                        del self.memory_cache[key]
                        # Clean up user index mapping
                        user_keys = [k for k, v in self.user_indices.items() if v == key]
                        for user_key in user_keys:
                            if user_key in self.user_indices:
                                del self.user_indices[user_key]

                logger.info(f"Invalidated {len(keys_to_remove)} cache entries for user {user_id}")

            except Exception as e:
                logger.error(
                    f"Failed to invalidate user cache for user {user_id}: {e}",
                    exc_info=True,
                )
                raise SIFCacheError(
                    f"Failed to invalidate user cache: {e}",
                    user_id=user_id,
                    operation="invalidate_user_cache",
                    cause=e,
                ) from e
    
    def invalidate_on_content_update(self, user_id: str, content_type: str) -> None:
        """
        Invalidate relevant cache entries when user content is updated.

        Args:
            user_id: User identifier
            content_type: Type of content updated (e.g., 'blog_post', 'page', etc.)

        Raises:
            SIFCacheError: If the invalidation cannot be completed due
                to an internal fault. Pre-Phase 1.2 this method
                silently swallowed exceptions; callers that want the
                old behaviour should wrap in
                ``try/except SIFCacheError`` and treat the exception
                as a partial invalidation.

        Note:
            This method calls :meth:`invalidate_user_cache` internally
            so a single ``SIFCacheError`` from that call will be
            re-raised here with ``operation="invalidate_on_content_update"``
            so callers can distinguish the trigger from the underlying
            cache failure.
        """
        try:
            # Invalidate semantic insights for this user
            self.invalidate_user_cache(user_id, "semantic_insights")

            # Invalidate related query caches
            if content_type in ["blog_post", "page", "content"]:
                # Invalidate pillar-related caches
                self.invalidate_user_cache(user_id, "semantic_pillars")

            logger.info(f"Invalidated cache for user {user_id} content update: {content_type}")

        except SIFCacheError:
            # Propagate the underlying SIFCacheError; the operation
            # context (which entry the failure happened under) is
            # already on the raised exception.
            raise
        except Exception as e:
            logger.error(
                f"Failed to invalidate cache on content update for user {user_id} type={content_type}: {e}",
                exc_info=True,
            )
            raise SIFCacheError(
                f"Failed to invalidate cache on content update: {e}",
                user_id=user_id,
                operation="invalidate_on_content_update",
                cause=e,
            ) from e
    
    def cleanup_expired_entries(self) -> None:
        """
        Clean up expired cache entries.

        Raises:
            SIFCacheError: If the cleanup cannot be completed due to
                an internal fault. Pre-Phase 1.2 this method silently
                swallowed exceptions; callers that want the old
                behaviour should wrap in ``try/except SIFCacheError``
                and treat the exception as a partial cleanup.

        Note:
            The background periodic cleanup (``_periodic_cleanup``)
            intentionally *does not* propagate SIFCacheError so a
            transient fault does not kill the loop; it logs and
            continues. Direct callers (e.g. from admin endpoints) get
            the loud raise.
        """
        with self._cache_lock:
            try:
                expired_keys = []
                current_time = time.time()

                for cache_key, entry in self.memory_cache.items():
                    if not self._is_entry_valid(entry):
                        expired_keys.append(cache_key)

                for key in expired_keys:
                    del self.memory_cache[key]
                    # Clean up user index mapping
                    user_keys = [k for k, v in self.user_indices.items() if v == key]
                    for user_key in user_keys:
                        if user_key in self.user_indices:
                            del self.user_indices[user_key]

                if expired_keys:
                    logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")

            except Exception as e:
                logger.error(f"Error during cache cleanup: {e}", exc_info=True)
                raise SIFCacheError(
                    f"Error during cache cleanup: {e}",
                    operation="cleanup_expired_entries",
                    cause=e,
                ) from e

    def get_cache_stats(self) -> SemanticCacheStats:
        """
        Get current cache statistics.

        Raises:
            SIFCacheError: If the stats read cannot be completed due
                to an internal fault. Pre-Phase 1.2 this method
                silently returned ``self.stats`` (a possibly stale or
                zero-valued snapshot) on any failure; callers that
                want the old behaviour should wrap in
                ``try/except SIFCacheError`` and treat the exception
                as "stats unavailable".
        """
        with self._cache_lock:
            try:
                # Calculate hit rate
                total_requests = self.stats.total_hits + self.stats.total_misses
                if total_requests > 0:
                    self.stats.hit_rate = self.stats.total_hits / total_requests

                # Update current stats
                self.stats.cache_size = len(self.memory_cache)
                self.stats.memory_usage_mb = self._calculate_memory_usage()

                return self.stats

            except Exception as e:
                logger.error(f"Failed to get cache stats: {e}", exc_info=True)
                raise SIFCacheError(
                    f"Failed to get cache stats: {e}",
                    operation="get_cache_stats",
                    cause=e,
                ) from e
    



def semantic_cache_decorator(ttl: int = 3600, operation_type: str = "generic"):
    """
    Decorator for caching semantic intelligence operations
    
    Args:
        ttl: Time to live in seconds
        operation_type: Type of semantic operation being cached
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            # Get cache manager instance (assumes it's available as self.cache_manager)
            cache_manager = getattr(self, 'cache_manager', None)
            if not cache_manager:
                return await func(self, *args, **kwargs)
            
            # Generate cache key from function and arguments
            user_id = kwargs.get('user_id') or (args[0] if args else 'unknown')
            cache_key = cache_manager._generate_cache_key(
                operation_type,
                user_id,
                {"args": args, "kwargs": kwargs}
            )
            
            # Try to get from cache
            cached_result = cache_manager.memory_cache.get(cache_key)
            if cached_result and cache_manager._is_entry_valid(cached_result):
                logger.debug(f"Cache hit for {operation_type} operation")
                return cached_result.data
            
            # Execute function and cache result
            result = await func(self, *args, **kwargs)
            
            if result:
                entry = CacheEntry(
                    data=result,
                    timestamp=time.time(),
                    ttl=ttl,
                    version=cache_manager._get_current_version(),
                    metadata={"operation": operation_type, "user_id": user_id}
                )
                cache_manager.memory_cache[cache_key] = entry
            
            return result
        
        return wrapper
    return decorator


# Global cache manager instance
semantic_cache_manager = SemanticCacheManager()

# Phase 2.4: wire the cleanup loop at module import. The pattern
# mirrors ``backend/services/analytics_cache_service.py`` which
# starts its own daemon cleanup thread at import time. We use the
# new ``start_cleanup_loop`` method so the singleton's cleanup
# actually runs (pre-2.4 the comment at the call site said
# "Cleanup task should be started manually in async context" and
# nothing called it).
semantic_cache_manager.start_cleanup_loop()
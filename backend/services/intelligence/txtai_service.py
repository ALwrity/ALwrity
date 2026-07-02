"""
Txtai Intelligence Service
Core service for semantic indexing, search, and clustering using txtai.
Designed to run on modest hardware using lightweight models.
Enhanced with intelligent caching for performance optimization.
"""

import os
import traceback
import asyncio
import threading
from typing import List, Dict, Any, Optional, Tuple
from loguru import logger
from datetime import datetime
from .semantic_cache import semantic_cache_manager, semantic_cache_decorator

# txtai imports (will be available after pip install)
try:
    from txtai import Embeddings
    from txtai.pipeline import Labels, Extractor
    TXTAI_AVAILABLE = True
except ImportError:
    logger.warning("txtai not installed. Some features will be disabled.")
    Embeddings = None
    Labels = None
    Extractor = None
    TXTAI_AVAILABLE = False

class TxtaiIntelligenceService:
    _instances = {}
    # Phase 2.2: per-class lock that protects the singleton fast path
    # in ``__new__``. Created lazily as a ``threading.Lock`` (not
    # RLock - ``__new__`` never re-enters for the same class) so it
    # is safe under contention from multiple asyncio / thread-pool
    # workers constructing the same user_id.
    import threading as _threading
    _singleton_lock = _threading.Lock()
    _init_locks = {}  # Locks for thread-safe initialization
    _init_tasks = {}  # Track ongoing initialization tasks
    # Phase 5 / Issue #6: stable class attribute so that
    # ``SemanticCacheManager._get_current_version`` (and any other
    # caller) can derive a stable cache version from the model
    # path without needing to instantiate the service. When the
    # model changes, bump this constant and all SIF cache entries
    # are invalidated automatically.
    DEFAULT_MODEL_PATH = "sentence-transformers/all-MiniLM-L6-v2"

    def __new__(cls, user_id: str, *args, **kwargs):
        # Phase 2.2: thread-safe singleton via double-checked locking.
        # The actual pattern lives in ``sif_singleton.get_singleton``;
        # we only set up the per-user init lock after the singleton
        # is created.
        from .sif_singleton import get_singleton
        instance = get_singleton(
            cls=cls,
            user_id=user_id,
            instances=cls._instances,
            lock=cls._singleton_lock,
        )
        if user_id not in cls._init_locks:
            cls._init_locks[user_id] = asyncio.Lock()
        return instance

    def __init__(self, user_id: str, model_path: Optional[str] = None, enable_caching: bool = True):
        # Singleton: prevent re-initialization if already initialized
        if getattr(self, "_singleton_initialized", False):
            return
            
        self.user_id = user_id
        self.model_path = model_path or "sentence-transformers/all-MiniLM-L6-v2"
        self.index_path = f"workspace/workspace_{user_id}/indices/txtai"
        self.embeddings = None
        self._initialized = False
        self._initialization_in_progress = False
        self.enable_caching = enable_caching
        self.cache_manager = semantic_cache_manager if enable_caching else None
        self._backend = "faiss"  # Default backend
        self._disable_ann_queries = False  # Set when FAISS nprobe incompatibility is detected
        self.fail_fast = str(os.getenv("SIF_FAIL_FAST", "true")).lower() in {"1", "true", "yes", "on"}
        
        # Mark as initialized for singleton pattern
        self._singleton_initialized = True
        
        # Lazy initialization - do not initialize embeddings on startup
        # self._initialize_embeddings()

    def _ensure_initialized(self):
        """Lazy initialization helper - non-blocking version for API calls."""
        if self._initialized:
            # Already initialized, no-op
            return
        
        if self._initialization_in_progress:
            # Initialization already triggered, skip to avoid blocking
            logger.debug(f"Initialization already in progress for user {self.user_id}, skipping redundant call")
            return
        
        # Mark as in progress and initialize in background thread
        self._initialization_in_progress = True
        thread = threading.Thread(target=self._initialize_embeddings, daemon=True)
        thread.start()
        logger.debug(f"Background initialization started for user {self.user_id}")
    
    async def _ensure_initialized_async(self):
        """Async initialization helper - waits for initialization to complete."""
        if self._initialized:
            return
        
        # Ensure we have a lock for this user
        if self.user_id not in self.__class__._init_locks:
            self.__class__._init_locks[self.user_id] = asyncio.Lock()
        
        # Use a lock to prevent concurrent initialization attempts
        async with self.__class__._init_locks[self.user_id]:
            # Double-check after acquiring lock
            if self._initialized:
                return
            
            # Run initialization in thread pool to avoid blocking event loop
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._initialize_embeddings)

    # Phase 2.1: thin wrapper to keep the service file small. The
    # actual implementation lives in ``sif_async_helpers.py``.
    @staticmethod
    async def _run_blocking(func, *args, **kwargs):
        from .sif_async_helpers import run_blocking
        return await run_blocking(func, *args, **kwargs)

    # Phase 4.2 / 4.5: thin observability helpers. The actual
    # counter / structured-log implementation lives in
    # ``sif_metrics``. We add these as static methods so every
    # public method on the service emits a consistent ``[sif_event]``
    # log line and a counter bump, without each call site having
    # to import the metrics module directly.
    @staticmethod
    def _record_sif_event(operation: str, user_id: str, outcome: str, **extra):
        from .sif_metrics import inc_counter, log_sif_event
        inc_counter(f"sif_{operation}_total", outcome, value=extra.pop("value", 1))
        log_sif_event(operation, user_id=user_id, outcome=outcome, extra=extra or None)
        # Phase 5 / Issue #617 #10: stamp the instance as recently
        # used so the singleton cleanup doesn't evict it. The
        # cleanup itself runs only every Nth call to keep the
        # critical path cheap.
        # (lookup of ``self`` happens via the caller; the counter
        # is bumped below in the per-method path.)

    # Phase 5 / Issue #617 #10: rate-limited stale-instance cleanup.
    # Every CLEANUP_EVERY_N public calls, we scan the singleton
    # dict for user_ids whose last activity is older than
    # ``_instance_max_age_seconds`` and evict them. The cleanup
    # is best-effort: failures are logged but never raised.
    _cleanup_call_counter = 0
    _CLEANUP_EVERY_N = 100
    _INSTANCE_MAX_AGE_SECONDS = 3600.0  # 1 hour

    @classmethod
    def _maybe_cleanup_singleton(cls, self_instance):
        """Run ``sif_singleton_cleanup.cleanup_stale_instances`` if
        enough calls have passed since the last run.

        Args:
            self_instance: the instance whose ``_last_used`` we
                stamp before counting. We use a class-level
                counter so the rate-limit is global, not per-user.
        """
        from .sif_singleton_cleanup import record_use, cleanup_stale_instances
        record_use(self_instance)
        cls._cleanup_call_counter += 1
        if cls._cleanup_call_counter < cls._CLEANUP_EVERY_N:
            return
        cls._cleanup_call_counter = 0
        try:
            evicted = cleanup_stale_instances(
                instances=cls._instances,
                lock=cls._singleton_lock,
                max_age_seconds=cls._INSTANCE_MAX_AGE_SECONDS,
            )
            if evicted:
                from loguru import logger as _logger
                _logger.info(
                    f"[sif_singleton_cleanup] evicted {len(evicted)} stale "
                    f"instances (user_ids={evicted[:5]}{'...' if len(evicted) > 5 else ''})"
                )
        except Exception as e:
            from loguru import logger as _logger
            _logger.warning(f"[sif_singleton_cleanup] cleanup pass failed: {e}")

    def _initialize_embeddings(self, load_existing_index: bool = True):
        """Initialize txtai embeddings with local storage support and comprehensive error handling.

        Phase 3.1: if a previous run left a ``.corrupt`` marker
        (written by ``_mark_ann_incompatible`` on nprobe), the
        on-disk index is structurally broken. The actual cleanup
        is delegated to ``sif_index_remediation.remediate_corrupt_index``
        so this file stays small. See that module for the
        best-effort cleanup contract.
        """
        if load_existing_index:
            from .sif_index_remediation import remediate_corrupt_index
            remediate_corrupt_index(self.index_path, user_id=self.user_id)
        if not TXTAI_AVAILABLE:
            logger.error("txtai is not available. Please install with: pip install txtai[pipeline,similarity]")
            return

        try:
            logger.info(f"Initializing txtai embeddings for user {self.user_id}")
            logger.debug(f"Model path: {self.model_path}")
            logger.debug(f"Index path: {self.index_path}")
            
            # Close existing embeddings if any to release file locks
            if self.embeddings:
                try:
                    if hasattr(self.embeddings, 'close'):
                        self.embeddings.close()
                    self.embeddings = None
                except Exception as close_err:
                    logger.warning(f"Error closing existing embeddings: {close_err}")

            # Ensure directory exists
            os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
            logger.debug(f"Created index directory: {os.path.dirname(self.index_path)}")
            
            # Initialize embeddings with optimal configuration for ALwrity use case
            # Hardening: Disabling quantization by default as it causes 'IndexIDMap' attribute errors with small indices on Windows
            self.embeddings = Embeddings({
                "path": self.model_path,
                "content": True,  # Enable content storage for retrieval
                "objects": True,  # Enable object storage for metadata
                "backend": self._backend,  # Use Faiss for efficient similarity search
                "batch": 32,  # Batch size for processing
                "gpu": False,  # Force CPU usage for compatibility
                "limit": 1000  # Maximum number of results for queries
            })
            
            logger.info("Embeddings instance created successfully")
            
            # Check if existing index exists and load it
            if load_existing_index and os.path.exists(self.index_path):
                logger.info(f"Loading existing txtai index from {self.index_path}")
                try:
                    self.embeddings.load(self.index_path)
                    logger.info(f"Successfully loaded existing txtai index for user {self.user_id}")
                    # Try to log count, handle if not supported
                    try:
                        count = self.embeddings.count() if hasattr(self.embeddings, 'count') else "unknown"
                        logger.debug(f"Index contains {count} items")
                    except:
                        logger.debug("Index loaded (count unavailable)")
                except Exception as load_error:
                    logger.warning(f"Failed to load existing index: {load_error}. Creating new index.")
                    # Reset embeddings to create new index
                    self.embeddings = Embeddings({
                        "path": self.model_path,
                        "content": True,
                        "objects": True,
                        "backend": self._backend,
                        "batch": 32,
                        "gpu": False,
                        "limit": 1000
                    })
            elif load_existing_index:
                logger.info(f"No existing index found. Creating new txtai index for user {self.user_id}")
            else:
                logger.info(
                    f"Skipping existing txtai index load for user {self.user_id} "
                    f"(backend={self._backend}, load_existing_index={load_existing_index})"
                )
            
            self._disable_ann_queries = False
            self._initialized = True
            logger.info(f"Txtai Intelligence Service initialized successfully for user {self.user_id}")
            
        except Exception as e:
            logger.error(f"Critical failure initializing txtai embeddings: {e}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            logger.error("This may be due to:")
            logger.error("1. Missing model files - try: pip install sentence-transformers")
            logger.error("2. Insufficient memory - try using a smaller model")
            logger.error("3. Missing dependencies - try: pip install txtai[pipeline,similarity]")
            self._initialized = False

    @staticmethod
    def _is_nprobe_incompatibility(error: Exception) -> bool:
        """Detect known FAISS IndexIDMap/nprobe incompatibility."""
        message = str(error)
        return "nprobe" in message and "IndexIDMap" in message

    # Phase 5 / Issue #8: explicit guard for missing txtai. The
    # previous inline check on ``TXTAI_AVAILABLE`` was buried in
    # ``_initialize_embeddings`` and a misconfigured deployment
    # would silently fall back to no-op rather than fail fast, which
    # is what the user explicitly asked for in the content-strategy
    # P0 work. Promote the check to a method so every public
    # operation (``index_content`` / ``delete_content`` /
    # ``reindex_all``) starts with the same explicit guard and the
    # call site doesn't have to import ``TXTAI_AVAILABLE`` directly.
    def _require_txtai_available(self) -> None:
        if not TXTAI_AVAILABLE:
            message = (
                "txtai is not available. Please install with: "
                "pip install txtai[pipeline,similarity]"
            )
            logger.error(message)
            if self.fail_fast:
                raise RuntimeError(message)
            # The historical fail-soft path: return None (no exception)
            # and let the caller fall through to the "not initialized"
            # branch. The fail-fast branch above is the new default.
            return
        return

    def _mark_ann_incompatible(self):
        """Disable ANN-dependent code paths after FAISS nprobe incompatibility is observed."""
        if not self._disable_ann_queries:
            logger.warning(
                f"Disabling ANN-dependent txtai queries for user {self.user_id} due to IndexIDMap/nprobe incompatibility"
            )
        self._disable_ann_queries = True

    def _search_with_ann_fallback(self, query: str, limit: int, graph: bool = False):
        """Run search with ANN when available, then fall back to scan search when needed."""
        try:
            if self._disable_ann_queries:
                return self.embeddings.search(query, limit=limit, graph=graph, index=False)
            return self.embeddings.search(query, limit=limit, graph=graph)
        except AttributeError as ae:
            if not self._is_nprobe_incompatibility(ae):
                raise ae

            self._mark_ann_incompatible()
            try:
                return self.embeddings.search(query, limit=limit, graph=graph, index=False)
            except AttributeError as ae2:
                # Some FAISS/txtai combinations still raise nprobe errors even with
                # `index=False` (the underlying index is the same IndexIDMap). In that
                # case return an empty result rather than letting the exception
                # bubble up — the caller treats [] as "no matches" and continues.
                if self._is_nprobe_incompatibility(ae2):
                    logger.warning(
                        f"txtai scan search also raised nprobe incompatibility for user {self.user_id}; returning empty results"
                    )
                    return []
                raise

    @staticmethod
    def _cosine_similarity_from_vectors(v1, v2) -> float:
        """Compute cosine similarity for two embedding vectors."""
        import math

        dot_product = sum(a * b for a, b in zip(v1, v2))
        norm_v1 = math.sqrt(sum(a * a for a in v1))
        norm_v2 = math.sqrt(sum(b * b for b in v2))
        if norm_v1 == 0 or norm_v2 == 0:
            return 0.0
        return dot_product / (norm_v1 * norm_v2)

    async def index_content(self, items: List[Tuple[str, str, Dict[str, Any]]]) -> int:
        """
        Index content using incremental upsert — only processes new/changed documents.

        Args:
            items: List of (id, text, metadata) tuples.

        Returns:
            Number of items actually upserted.
        """
        # Phase 5 / Issue #8: explicit guard for missing txtai.
        self._require_txtai_available()
        self._ensure_initialized()
        if not self._initialized:
            await self._ensure_initialized_async()
        if not self._initialized or not self.embeddings:
            message = f"Cannot index content - service not initialized for user {self.user_id}"
            logger.warning(message)
            if self.fail_fast:
                raise RuntimeError(message)
            return 0
        # Phase 5 / Issue #617 #10: stamp + maybe cleanup
        self._maybe_cleanup_singleton(self)

        try:
            if not items:
                logger.warning("No items provided for indexing")
                return 0

            import json
            processed_items = []
            for item in items:
                id_val, text, metadata = item
                metadata_json = json.dumps(metadata) if metadata else "{}"
                processed_items.append((id_val, text, metadata_json))

            # Phase 2.1: off-loop to keep the event loop free.
            await self._run_blocking(self.embeddings.upsert, processed_items)
            await self._run_blocking(self.embeddings.save, self.index_path)
            count = len(processed_items)
            logger.info(f"Upserted {count} items for user {self.user_id}")
            # Phase 4.2 / 4.5: record success.
            self._record_sif_event(
                "index", user_id=self.user_id, outcome="success",
                upserted=count, value=count,
            )
            return count

        except Exception as e:
            logger.error(f"Error indexing content for user {self.user_id}: {e}")
            # Phase 4.2: record error.
            self._record_sif_event(
                "index", user_id=self.user_id, outcome="error",
            )
            message = str(e)
            is_windows_lock_error = isinstance(e, PermissionError) or "WinError 32" in message
            if is_windows_lock_error:
                logger.warning(
                    f"Txtai index save skipped for user {self.user_id} due to file lock. "
                    f"The index will be retried on a future run."
                )
                return 0
            raise

    async def delete_content(self, doc_ids: List[str]) -> int:
        """
        Delete specific documents from the index by ID.

        Args:
            doc_ids: List of document IDs to remove.

        Returns:
            Number of documents deleted.
        """
        # Phase 5 / Issue #8: explicit guard for missing txtai.
        self._require_txtai_available()
        await self._ensure_initialized_async()
        if not self._initialized or not self.embeddings:
            return 0
        # Phase 5 / Issue #617 #10: stamp + maybe cleanup
        self._maybe_cleanup_singleton(self)

        try:
            # Phase 2.1: off-loop to keep the event loop free.
            await self._run_blocking(self.embeddings.delete, doc_ids)
            await self._run_blocking(self.embeddings.save, self.index_path)
            logger.info(f"Deleted {len(doc_ids)} documents for user {self.user_id}")
            # Phase 4.2 / 4.5: record success.
            self._record_sif_event(
                "delete", user_id=self.user_id, outcome="success",
                deleted=len(doc_ids), value=len(doc_ids),
            )
            return len(doc_ids)
        except Exception as e:
            logger.error(f"Error deleting documents for user {self.user_id}: {e}")
            # Phase 4.2: record error.
            self._record_sif_event(
                "delete", user_id=self.user_id, outcome="error",
            )
            return 0

    async def reindex_all(self, items: List[Tuple[str, str, Dict[str, Any]]]) -> int:
        """
        Full reindex — replaces all content. Use sparingly (e.g. schema migration).

        Args:
            items: List of (id, text, metadata) tuples.

        Returns:
            Number of items indexed.
        """
        # Phase 5 / Issue #8: explicit guard for missing txtai.
        self._require_txtai_available()
        await self._ensure_initialized_async()
        if not self._initialized or not self.embeddings:
            return 0
        # Phase 5 / Issue #617 #10: stamp + maybe cleanup
        self._maybe_cleanup_singleton(self)

        try:
            import json
            processed_items = []
            for item in items:
                id_val, text, metadata = item
                metadata_json = json.dumps(metadata) if metadata else "{}"
                processed_items.append((id_val, text, metadata_json))

            # Phase 2.1: off-loop to keep the event loop free.
            await self._run_blocking(self.embeddings.index, processed_items, reindex=True)
            await self._run_blocking(self.embeddings.save, self.index_path)
            count = len(processed_items)
            logger.info(f"Reindexed all {count} items for user {self.user_id}")
            # Phase 4.2 / 4.5: record success.
            self._record_sif_event(
                "reindex", user_id=self.user_id, outcome="success",
                count=count, value=count,
            )
            return count

        except Exception as e:
            logger.error(f"Error reindexing all for user {self.user_id}: {e}")
            # Phase 4.2: record error.
            self._record_sif_event(
                "reindex", user_id=self.user_id, outcome="error",
            )
            raise

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Perform semantic search with intelligent caching."""
        await self._ensure_initialized_async()
        if not self._initialized or not self.embeddings:
            message = f"Cannot perform search - service not initialized for user {self.user_id}"
            logger.error(message)
            if self.fail_fast:
                raise RuntimeError(message)
            return []
        # Phase 5 / Issue #617 #10: stamp + maybe cleanup
        self._maybe_cleanup_singleton(self)

        try:
            # Check cache first if enabled
            if self.enable_caching and self.cache_manager:
                cached_results = self.cache_manager.get_cached_query_results(
                    query=query,
                    relevance_threshold=0.5,  # Lower threshold for search results
                    user_id=self.user_id
                )
                if cached_results:
                    logger.info(f"Cache hit for search query: '{query}'")
                    # Phase 4.2 / 4.5: record cache hit.
                    self._record_sif_event(
                        "search", user_id=self.user_id,
                        outcome="cache_hit", result_count=len(cached_results),
                    )
                    # Return cached results up to the requested limit
                    return cached_results[:limit]
                else:
                    logger.debug(f"Cache miss for search query: '{query}'")
                    # Phase 4.2: record cache miss.
                    self._record_sif_event(
                        "search", user_id=self.user_id, outcome="miss",
                    )

            logger.debug(f"Searching for query: '{query}' with limit: {limit}")
            # Phase 2.1: off-loop to keep the event loop free.
            results = await self._search_with_ann_fallback(query, limit=limit)
            
            # Cache the results if caching is enabled
            if self.enable_caching and self.cache_manager and results:
                self.cache_manager.cache_query_results(
                    query=query,
                    results=results,
                    relevance_threshold=0.5,
                    user_id=self.user_id
                )
                logger.debug(f"Cached search results for query: '{query}'")
            
            logger.info(f"Search completed successfully for user {self.user_id}. Found {len(results)} results")
            logger.debug(f"Top result score: {results[0]['score'] if results else 'N/A'}")
            # Phase 4.2 / 4.5: record success.
            self._record_sif_event(
                "search", user_id=self.user_id, outcome="success",
                result_count=len(results),
            )
            return results
        except Exception as e:
            logger.error(f"Search failed for user {self.user_id}: {e}")
            # Phase 4.2: record error.
            self._record_sif_event(
                "search", user_id=self.user_id, outcome="error",
            )
            if self.fail_fast:
                raise
            logger.error(f"Query: '{query}'")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return []

    async def get_similarity(self, text1: str, text2: str) -> float:
        """Get semantic similarity between two texts with caching."""
        await self._ensure_initialized_async()
        if not self._initialized or not self.embeddings:
            logger.error(f"Cannot calculate similarity - service not initialized for user {self.user_id}")
            return 0.0
        # Phase 5 / Issue #617 #10: stamp + maybe cleanup
        self._maybe_cleanup_singleton(self)

        try:
            # Create cache key for similarity calculation
            cache_key = f"similarity_{self.user_id}_{hash(text1)}_{hash(text2)}"
            
            # Check cache first if enabled
            if self.enable_caching and self.cache_manager:
                cached_similarity = self.cache_manager.get_cached_semantic_insights(
                    user_id=cache_key,
                    force_refresh=False
                )
                if cached_similarity and "similarity" in cached_similarity:
                    logger.info(f"Cache hit for similarity calculation")
                    return cached_similarity["similarity"]
                else:
                    logger.debug(f"Cache miss for similarity calculation")

            logger.debug(f"Calculating similarity between texts: '{text1[:50]}...' and '{text2[:50]}...'")
            if self._disable_ann_queries:
                vectors = self.embeddings.transform([text1, text2])
                if vectors is None or len(vectors) < 2:
                    return 0.0
                similarity = self._cosine_similarity_from_vectors(vectors[0], vectors[1])
            else:
                try:
                    similarity = self.embeddings.similarity(text1, text2)
                except AttributeError as ae:
                    if self._is_nprobe_incompatibility(ae):
                        logger.error(
                            f"Detected IndexIDMap nprobe error in similarity for user {self.user_id}. "
                            f"Using vector cosine fallback."
                        )
                        self._mark_ann_incompatible()
                        vectors = self.embeddings.transform([text1, text2])
                        if vectors is None or len(vectors) < 2:
                            return 0.0
                        similarity = self._cosine_similarity_from_vectors(vectors[0], vectors[1])
                    else:
                        raise ae
            
            # Cache the similarity result
            if self.enable_caching and self.cache_manager:
                similarity_data = {
                    "similarity": similarity,
                    "text1_hash": hash(text1),
                    "text2_hash": hash(text2),
                    "timestamp": datetime.now().isoformat()
                }
                self.cache_manager.cache_semantic_insights(
                    user_id=cache_key,
                    insights=similarity_data,
                    ttl=3600  # 1 hour TTL for similarity results
                )
                logger.debug(f"Cached similarity result")
            
            logger.info(f"Similarity calculated successfully for user {self.user_id}: {similarity:.4f}")
            return similarity
        except Exception as e:
            logger.error(f"Similarity calculation failed for user {self.user_id}: {e}")
            logger.error(f"Text1 length: {len(text1)}, Text2 length: {len(text2)}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return 0.0

    async def cluster(
        self,
        min_score: float = 0.5,
        seed_terms: Optional[List[str]] = None,
    ) -> List[List[int]]:
        """Cluster indexed content to find semantic pillars using graph-based clustering with caching.

        Phase 3.5: ``seed_terms`` lets callers (e.g.
        ``sif_integration._get_step_clusters_context``) pass
        per-user keywords derived from ``EnhancedContentStrategy``.
        Falls back to the historical default list when None/empty.
        """
        await self._ensure_initialized_async()
        if not self._initialized or not self.embeddings:
            logger.error(f"Cannot cluster content - service not initialized for user {self.user_id}")
            return []
        # Phase 5 / Issue #617 #10: stamp + maybe cleanup
        self._maybe_cleanup_singleton(self)

        try:
            # Check cache first if enabled
            if self.enable_caching and self.cache_manager:
                cache_key = f"cluster_{self.user_id}_{min_score}"
                cached_clusters = self.cache_manager.get_cached_semantic_insights(
                    user_id=cache_key,
                    force_refresh=False
                )
                if cached_clusters and "clusters" in cached_clusters:
                    logger.info(f"Cache hit for clustering with min_score: {min_score}")
                    return cached_clusters["clusters"]
                else:
                    logger.debug(f"Cache miss for clustering with min_score: {min_score}")

            logger.info(f"Starting content clustering for user {self.user_id} with min_score: {min_score}")
            
            # Check if we have graph functionality available
            if not hasattr(self.embeddings, 'graph') or not self.embeddings.graph:
                logger.warning(f"Graph clustering not available for user {self.user_id}. Using fallback clustering.")
                # Phase 4.2: count fallback as a distinct outcome so
                # operators can see graph-availability issues.
                self._record_sif_event(
                    "cluster", user_id=self.user_id, outcome="fallback",
                )
                return await self._fallback_clustering(min_score, seed_terms)

            # Use graph-based clustering if available
            # Perform a search to get graph structure
            sample_query = "content marketing digital strategy"
            # Phase 2.1: graph_results is a blocking call; off-loop.
            graph_results = await self._search_with_ann_fallback(sample_query, limit=10, graph=True)

            if not graph_results:
                logger.warning(f"No graph results for clustering user {self.user_id}")
                self._record_sif_event(
                    "cluster", user_id=self.user_id, outcome="fallback",
                )
                return await self._fallback_clustering(min_score, seed_terms)
            
            # Extract clusters from graph results
            clusters = self._extract_clusters_from_graph(graph_results, min_score)
            
            # Cache the clustering results
            if self.enable_caching and self.cache_manager:
                cluster_data = {
                    "clusters": clusters,
                    "cluster_count": len(clusters),
                    "min_score": min_score,
                    "timestamp": datetime.now().isoformat()
                }
                self.cache_manager.cache_semantic_insights(
                    user_id=f"cluster_{self.user_id}_{min_score}",
                    insights=cluster_data,
                    ttl=1800  # 30 minutes TTL for clustering results
                )
                logger.debug(f"Cached clustering results for user {self.user_id}")
            
            logger.info(f"Clustering completed successfully. Found {len(clusters)} clusters for user {self.user_id}")
            logger.debug(f"Cluster sizes: {[len(c) for c in clusters]}")
            # Phase 4.2 / 4.5: record success.
            self._record_sif_event(
                "cluster", user_id=self.user_id, outcome="success",
                cluster_count=len(clusters),
            )
            return clusters

        except Exception as e:
            logger.error(f"Clustering failed for user {self.user_id}: {e}")
            logger.error(f"Min score: {min_score}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            # Phase 4.2: record error and fall back.
            self._record_sif_event(
                "cluster", user_id=self.user_id, outcome="error",
            )
            return await self._fallback_clustering(min_score, seed_terms)
    
    async def _fallback_clustering(
        self,
        min_score: float,
        seed_terms: Optional[List[str]] = None,
    ) -> List[List[int]]:
        """Fallback clustering method when graph clustering is not available.

        Phase 3.5: ``seed_terms`` lets callers pass per-user keywords
        derived from ``EnhancedContentStrategy``. The list is
        resolved by ``sif_seed_terms.resolve_seed_terms`` (with the
        historical marketing defaults as a tail fallback) so this
        file stays small.
        """
        logger.info(f"Using fallback clustering for user {self.user_id}")

        from .sif_seed_terms import resolve_seed_terms
        sample_queries = resolve_seed_terms(seed_terms)

        # Simple clustering based on semantic similarity against sample queries
        try:
            all_clusters = []
            
            for query in sample_queries:
                # Use our search wrapper for hardening
                results = await self.search(query, limit=5)
                if results and results[0].get("score", 0) >= min_score:
                    # Create a cluster from similar results
                    cluster = [i for i, result in enumerate(results) if result.get("score", 0) >= min_score]
                    if cluster:
                        all_clusters.append(cluster)
            
            # Remove duplicate clusters
            unique_clusters = []
            for cluster in all_clusters:
                if cluster not in unique_clusters:
                    unique_clusters.append(cluster)
            
            return unique_clusters
            
        except Exception as e:
            logger.error(f"Fallback clustering failed for user {self.user_id}: {e}")
            return []
    
    def _extract_clusters_from_graph(self, graph_results: List[Dict], min_score: float) -> List[List[int]]:
        """Extract clusters from graph search results."""
        logger.debug(f"Extracting clusters from graph results for user {self.user_id}")
        
        clusters = []
        
        try:
            # Group results by similarity score threshold
            current_cluster = []
            
            for i, result in enumerate(graph_results):
                score = result.get("score", 0)
                if score >= min_score:
                    current_cluster.append(i)
                else:
                    if current_cluster:
                        clusters.append(current_cluster)
                        current_cluster = []
            
            # Add final cluster if exists
            if current_cluster:
                clusters.append(current_cluster)
            
            return clusters
            
        except Exception as e:
            logger.error(f"Graph cluster extraction failed for user {self.user_id}: {e}")
            return []

    async def classify(self, text: str, labels: List[str]) -> List[Tuple[str, float]]:
        """Classify text using zero-shot classification."""
        await self._ensure_initialized_async()
        if not self._initialized or not Labels:
            logger.error(f"Cannot classify text - service not initialized or Labels not available for user {self.user_id}")
            return []

        try:
            logger.debug(f"Classifying text: '{text[:100]}...' with labels: {labels}")
            classifier = Labels()
            results = classifier(text, labels)
            logger.info(f"Classification completed successfully for user {self.user_id}. Found {len(results)} results")
            logger.debug(f"Classification results: {results}")
            return results
        except Exception as e:
            logger.error(f"Classification failed for user {self.user_id}: {e}")
            logger.error(f"Text length: {len(text)}")
            logger.error(f"Labels count: {len(labels)}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return []

    def get_index_stats(self) -> Dict[str, Any]:
        """Get statistics about the current index."""
        if not self._initialized or not self.embeddings:
            return {"status": "not_initialized", "user_id": self.user_id}
        
        try:
            # Get count of indexed items
            index_size = "unknown"
            if hasattr(self.embeddings, 'count'):
                try:
                    index_size = self.embeddings.count()
                except:
                    pass
            
            return {
                "status": "active",
                "user_id": self.user_id,
                "index_size": index_size,
                "model_path": self.model_path,
                "index_path": self.index_path,
                "initialized": self._initialized
            }
        except Exception as e:
            logger.error(f"Error getting index stats for user {self.user_id}: {e}")
            return {"status": "error", "user_id": self.user_id, "error": str(e)}

    def is_initialized(self) -> bool:
        """Check if the service is properly initialized, triggering lazy init if needed."""
        if not self._initialized:
            self._ensure_initialized()
        return self._initialized and self.embeddings is not None

"""
Caching Service
Cache management and optimization.
"""

import logging
import json
import hashlib
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Try to import Redis, fallback to in-memory if not available
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.info("Redis not available, using in-memory caching")

class CachingService:
    """Service for intelligent caching of content strategy data."""

    def __init__(self):
        # Cache configuration
        self.cache_config = {
            'ai_analysis': {
                'ttl': 3600,  # 1 hour
                'max_size': 1000,
                'priority': 'high'
            },
            'onboarding_data': {
                'ttl': 1800,  # 30 minutes
                'max_size': 500,
                'priority': 'medium'
            },
            'strategy_cache': {
                'ttl': 7200,  # 2 hours
                'max_size': 200,
                'priority': 'high'
            },
            'field_transformations': {
                'ttl': 900,  # 15 minutes
                'max_size': 1000,
                'priority': 'low'
            },
            'streaming_intelligence': {
                'ttl': 300,  # 5 minutes
                'max_size': 500,
                'priority': 'medium'
            }
        }

        # Initialize Redis connection if available
        self.redis_available = False
        if REDIS_AVAILABLE:
            try:
                self.redis_client = redis.Redis(
                    host='localhost',
                    port=6379,
                    db=0,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
                # Test connection
                self.redis_client.ping()
                self.redis_available = True
                logger.info("Redis connection established successfully")
            except Exception as e:
                logger.info(f"Redis connection failed: {str(e)}. Using in-memory cache.")
                self.redis_available = False
                self.memory_cache = {}
        else:
            logger.info("Using in-memory cache (Redis not available)")
            self.memory_cache = {}

    def get_cache_key(self, cache_type: str, identifier: str, **kwargs) -> str:
        """Generate a unique cache key."""
        try:
            # Create a hash of the identifier and additional parameters
            key_data = f"{cache_type}:{identifier}"
            if kwargs:
                key_data += ":" + json.dumps(kwargs, sort_keys=True)
            
            # Create hash for consistent key length using a strong hash algorithm
            key_hash = hashlib.sha256(key_data.encode("utf-8")).hexdigest()
            return f"content_strategy:{cache_type}:{key_hash}"
            
        except Exception as e:
            logger.error(f"Error generating cache key: {str(e)}")
            return f"content_strategy:{cache_type}:{identifier}"

    async def get_cached_data(self, cache_type: str, identifier: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Retrieve cached data."""
        try:
            if not self.redis_available:
                return self._get_from_memory_cache(cache_type, identifier, **kwargs)

            cache_key = self.get_cache_key(cache_type, identifier, **kwargs)
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                data = json.loads(cached_data)
                logger.info(f"Cache hit for {cache_type}:{identifier}")
                return data
            else:
                logger.info(f"Cache miss for {cache_type}:{identifier}")
                return None

        except Exception as e:
            logger.error(f"Error retrieving cached data: {str(e)}")
            return None

    async def set_cached_data(self, cache_type: str, identifier: str, data: Dict[str, Any], **kwargs) -> bool:
        """Store data in cache."""
        try:
            if not self.redis_available:
                return self._set_in_memory_cache(cache_type, identifier, data, **kwargs)

            cache_key = self.get_cache_key(cache_type, identifier, **kwargs)
            ttl = self.cache_config.get(cache_type, {}).get('ttl', 3600)
            
            # Add metadata to cached data
            cached_data = {
                'data': data,
                'metadata': {
                    'cached_at': datetime.utcnow().isoformat(),
                    'cache_type': cache_type,
                    'identifier': identifier,
                    'ttl': ttl
                }
            }
            
            # Store in Redis with TTL
            result = self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(cached_data, default=str)
            )
            
            if result:
                logger.info(f"Data cached successfully for {cache_type}:{identifier}")
                await self._update_cache_stats(cache_type, 'set')
                return True
            else:
                logger.warning(f"Failed to cache data for {cache_type}:{identifier}")
                return False

        except Exception as e:
            logger.error(f"Error setting cached data: {str(e)}")
            return False

    async def invalidate_cache(self, cache_type: str, identifier: str, **kwargs) -> bool:
        """Invalidate specific cached data."""
        try:
            if not self.redis_available:
                return self._invalidate_memory_cache(cache_type, identifier, **kwargs)

            cache_key = self.get_cache_key(cache_type, identifier, **kwargs)
            result = self.redis_client.delete(cache_key)
            
            if result:
                logger.info(f"Cache invalidated for {cache_type}:{identifier}")
                await self._update_cache_stats(cache_type, 'invalidate')
                return True
            else:
                logger.warning(f"No cache entry found to invalidate for {cache_type}:{identifier}")
                return False

        except Exception as e:
            logger.error(f"Error invalidating cache: {str(e)}")
            return False

    async def clear_cache_type(self, cache_type: str) -> bool:
        """Clear all cached data of a specific type."""
        try:
            if not self.redis_available:
                return self._clear_memory_cache_type(cache_type)

            pattern = f"content_strategy:{cache_type}:*"
            keys = self.redis_client.keys(pattern)
            
            if keys:
                result = self.redis_client.delete(*keys)
                logger.info(f"Cleared {result} cache entries for {cache_type}")
                await self._update_cache_stats(cache_type, 'clear')
                return True
            else:
                logger.info(f"No cache entries found for {cache_type}")
                return True

        except Exception as e:
            logger.error(f"Error clearing cache type {cache_type}: {str(e)}")
            return False

    async def get_cache_stats(self, cache_type: Optional[str] = None) -> Dict[str, Any]:
        """Get cache statistics."""
        try:
            if not self.redis_available:
                return self._get_memory_cache_stats(cache_type)

            stats = {}
            
            if cache_type:
                pattern = f"content_strategy:{cache_type}:*"
                keys = self.redis_client.keys(pattern)
                stats[cache_type] = {
                    'entries': len(keys),
                    'size_bytes': sum(len(self.redis_client.get(key) or '') for key in keys),
                    'config': self.cache_config.get(cache_type, {})
                }
            else:
                for cache_type_name in self.cache_config.keys():
                    pattern = f"content_strategy:{cache_type_name}:*"
                    keys = self.redis_client.keys(pattern)
                    stats[cache_type_name] = {
                        'entries': len(keys),
                        'size_bytes': sum(len(self.redis_client.get(key) or '') for key in keys),
                        'config': self.cache_config.get(cache_type_name, {})
                    }

            return stats

        except Exception as e:
            logger.error(f"Error getting cache stats: {str(e)}")
            return {}

    async def optimize_cache(self) -> Dict[str, Any]:
        """Optimize cache by removing expired entries and managing memory."""
        try:
            if not self.redis_available:
                return self._optimize_memory_cache()

            optimization_results = {}
            
            for cache_type, config in self.cache_config.items():
                pattern = f"content_strategy:{cache_type}:*"
                keys = self.redis_client.keys(pattern)
                
                if len(keys) > config.get('max_size', 1000):
                    # Remove oldest entries to maintain max size
                    keys_with_times = []
                    for key in keys:
                        ttl = self.redis_client.ttl(key)
                        if ttl > 0:  # Key still has TTL
                            keys_with_times.append((key, ttl))
                    
                    # Sort by TTL (oldest first)
                    keys_with_times.sort(key=lambda x: x[1])
                    
                    # Remove excess entries
                    excess_count = len(keys) - config.get('max_size', 1000)
                    keys_to_remove = [key for key, _ in keys_with_times[:excess_count]]
                    
                    if keys_to_remove:
                        removed_count = self.redis_client.delete(*keys_to_remove)
                        optimization_results[cache_type] = {
                            'entries_removed': removed_count,
                            'reason': 'max_size_exceeded'
                        }
                        logger.info(f"Optimized {cache_type} cache: removed {removed_count} entries")

            return optimization_results

        except Exception as e:
            logger.error(f"Error optimizing cache: {str(e)}")
            return {}

    async def _update_cache_stats(self, cache_type: str, operation: str) -> None:
        """Update cache statistics."""
        try:
            if not self.redis_available:
                return
                
            stats_key = f"cache_stats:{cache_type}"
            current_stats = self.redis_client.hgetall(stats_key)
            
            # Update operation counts
            current_stats[f"{operation}_count"] = str(int(current_stats.get(f"{operation}_count", 0)) + 1)
            current_stats['last_updated'] = datetime.utcnow().isoformat()
            
            # Store updated stats
            self.redis_client.hset(stats_key, mapping=current_stats)
            
        except Exception as e:
            logger.error(f"Error updating cache stats: {str(e)}")

    # Memory cache fallback methods
    def _get_from_memory_cache(self, cache_type: str, identifier: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Get data from memory cache."""
        try:
            cache_key = self.get_cache_key(cache_type, identifier, **kwargs)
            cached_data = self.memory_cache.get(cache_key)
            
            if cached_data:
                # Check if data is still valid
                cached_at = datetime.fromisoformat(cached_data['metadata']['cached_at'])
                ttl = cached_data['metadata']['ttl']
                
                if datetime.utcnow() - cached_at < timedelta(seconds=ttl):
                    logger.info(f"Memory cache hit for {cache_type}:{identifier}")
                    return cached_data['data']
                else:
                    # Remove expired entry
                    del self.memory_cache[cache_key]
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting from memory cache: {str(e)}")
            return None

    def _set_in_memory_cache(self, cache_type: str, identifier: str, data: Dict[str, Any], **kwargs) -> bool:
        """Set data in memory cache."""
        try:
            cache_key = self.get_cache_key(cache_type, identifier, **kwargs)
            ttl = self.cache_config.get(cache_type, {}).get('ttl', 3600)
            
            cached_data = {
                'data': data,
                'metadata': {
                    'cached_at': datetime.utcnow().isoformat(),
                    'cache_type': cache_type,
                    'identifier': identifier,
                    'ttl': ttl
                }
            }
            
            # Check max size and remove oldest if needed
            max_size = self.cache_config.get(cache_type, {}).get('max_size', 1000)
            if len(self.memory_cache) >= max_size:
                # Remove oldest entry
                oldest_key = min(self.memory_cache.keys(), 
                               key=lambda k: self.memory_cache[k]['metadata']['cached_at'])
                del self.memory_cache[oldest_key]
            
            self.memory_cache[cache_key] = cached_data
            logger.info(f"Data cached in memory for {cache_type}:{identifier}")
            return True
            
        except Exception as e:
            logger.error(f"Error setting in memory cache: {str(e)}")
            return False

    def _invalidate_memory_cache(self, cache_type: str, identifier: str, **kwargs) -> bool:
        """Invalidate memory cache entry."""
        try:
            cache_key = self.get_cache_key(cache_type, identifier, **kwargs)
            if cache_key in self.memory_cache:
                del self.memory_cache[cache_key]
                logger.info(f"Memory cache invalidated for {cache_type}:{identifier}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Error invalidating memory cache: {str(e)}")
            return False

    def _clear_memory_cache_type(self, cache_type: str) -> bool:
        """Clear memory cache by type."""
        try:
            keys_to_remove = [key for key in self.memory_cache.keys() 
                             if key.startswith(f"content_strategy:{cache_type}:")]
            
            for key in keys_to_remove:
                del self.memory_cache[key]
            
            logger.info(f"Cleared {len(keys_to_remove)} memory cache entries for {cache_type}")
            return True
            
        except Exception as e:
            logger.error(f"Error clearing memory cache type: {str(e)}")
            return False

    def _get_memory_cache_stats(self, cache_type: Optional[str] = None) -> Dict[str, Any]:
        """Get memory cache statistics."""
        try:
            stats = {}
            
            if cache_type:
                keys = [key for key in self.memory_cache.keys() 
                       if key.startswith(f"content_strategy:{cache_type}:")]
                stats[cache_type] = {
                    'entries': len(keys),
                    'size_bytes': sum(len(str(value)) for value in [self.memory_cache[key] for key in keys]),
                    'config': self.cache_config.get(cache_type, {})
                }
            else:
                for cache_type_name in self.cache_config.keys():
                    keys = [key for key in self.memory_cache.keys() 
                           if key.startswith(f"content_strategy:{cache_type_name}:")]
                    stats[cache_type_name] = {
                        'entries': len(keys),
                        'size_bytes': sum(len(str(value)) for value in [self.memory_cache[key] for key in keys]),
                        'config': self.cache_config.get(cache_type_name, {})
                    }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting memory cache stats: {str(e)}")
            return {}

    def _optimize_memory_cache(self) -> Dict[str, Any]:
        """Optimize memory cache."""
        try:
            optimization_results = {}
            
            for cache_type, config in self.cache_config.items():
                keys = [key for key in self.memory_cache.keys() 
                       if key.startswith(f"content_strategy:{cache_type}:")]
                
                if len(keys) > config.get('max_size', 1000):
                    # Remove oldest entries
                    keys_with_times = []
                    for key in keys:
                        cached_at = datetime.fromisoformat(self.memory_cache[key]['metadata']['cached_at'])
                        keys_with_times.append((key, cached_at))
                    
                    # Sort by cached time (oldest first)
                    keys_with_times.sort(key=lambda x: x[1])
                    
                    # Remove excess entries
                    excess_count = len(keys) - config.get('max_size', 1000)
                    keys_to_remove = [key for key, _ in keys_with_times[:excess_count]]
                    
                    for key in keys_to_remove:
                        del self.memory_cache[key]
                    
                    optimization_results[cache_type] = {
                        'entries_removed': len(keys_to_remove),
                        'reason': 'max_size_exceeded'
                    }
            
            return optimization_results
            
        except Exception as e:
            logger.error(f"Error optimizing memory cache: {str(e)}")
            return {}

    # Cache-specific methods for different data types
    async def cache_ai_analysis(self, user_id: int, analysis_type: str, analysis_data: Dict[str, Any]) -> bool:
        """Cache AI analysis results."""
        return await self.set_cached_data('ai_analysis', f"{user_id}:{analysis_type}", analysis_data)

    async def get_cached_ai_analysis(self, user_id: int, analysis_type: str) -> Optional[Dict[str, Any]]:
        """Get cached AI analysis results."""
        return await self.get_cached_data('ai_analysis', f"{user_id}:{analysis_type}")

    async def cache_onboarding_data(self, user_id: int, onboarding_data: Dict[str, Any]) -> bool:
        """Cache onboarding data."""
        return await self.set_cached_data('onboarding_data', str(user_id), onboarding_data)

    async def get_cached_onboarding_data(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get cached onboarding data."""
        return await self.get_cached_data('onboarding_data', str(user_id))

    async def cache_strategy(self, strategy_id: int, strategy_data: Dict[str, Any]) -> bool:
        """Cache strategy data."""
        return await self.set_cached_data('strategy_cache', str(strategy_id), strategy_data)

    async def get_cached_strategy(self, strategy_id: int) -> Optional[Dict[str, Any]]:
        """Get cached strategy data."""
        return await self.get_cached_data('strategy_cache', str(strategy_id))

    async def cache_field_transformations(self, user_id: int, transformations: Dict[str, Any]) -> bool:
        """Cache field transformations."""
        return await self.set_cached_data('field_transformations', str(user_id), transformations)

    async def get_cached_field_transformations(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get cached field transformations."""
        return await self.get_cached_data('field_transformations', str(user_id)) 
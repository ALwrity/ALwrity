"""
Analytics Cache Service for Backend
Provides intelligent caching for expensive analytics API calls
"""

import time
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from loguru import logger
import hashlib


class AnalyticsCacheService:
    def __init__(self):
        # In-memory cache (in production, consider Redis)
        self.cache: Dict[str, Dict[str, Any]] = {}
        
        # Cache TTL configurations (in seconds)
        self.TTL_CONFIG = {
            'platform_status': 30 * 60,      # 30 minutes
            'analytics_data': 60 * 60,       # 60 minutes  
            'user_sites': 120 * 60,          # 2 hours
            'bing_analytics': 60 * 60,       # 1 hour for expensive Bing calls
            'gsc_analytics': 60 * 60,        # 1 hour for GSC calls
            'bing_sites': 120 * 60,         # 2 hours for Bing sites (rarely change)
        }
        
        # Cache statistics
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'invalidations': 0
        }
        
        logger.info("AnalyticsCacheService initialized with TTL config: {ttl}", ttl=self.TTL_CONFIG)

    def _generate_cache_key(self, prefix: str, user_id: str, **kwargs) -> str:
        """Generate a unique cache key from parameters"""
        # Create a deterministic key from parameters
        params_str = json.dumps(kwargs, sort_keys=True) if kwargs else ""
        key_data = f"{prefix}:{user_id}:{params_str}"
        
        # Use hash to keep keys manageable
        return hashlib.md5(key_data.encode()).hexdigest()

    def _is_expired(self, entry: Dict[str, Any]) -> bool:
        """Check if cache entry is expired"""
        if 'timestamp' not in entry:
            return True
        
        ttl = entry.get('ttl', 0)
        age = time.time() - entry['timestamp']
        return age > ttl

    def get(self, prefix: str, user_id: str, **kwargs) -> Optional[Any]:
        """Get cached data if valid"""
        cache_key = self._generate_cache_key(prefix, user_id, **kwargs)
        
        if cache_key not in self.cache:
            logger.debug("Cache MISS: {key}", key=cache_key)
            self.stats['misses'] += 1
            return None
        
        entry = self.cache[cache_key]
        
        if self._is_expired(entry):
            logger.debug("Cache EXPIRED: {key}", key=cache_key)
            del self.cache[cache_key]
            self.stats['misses'] += 1
            return None
        
        logger.debug("Cache HIT: {key} (age: {age}s)", 
                    key=cache_key, 
                    age=int(time.time() - entry['timestamp']))
        self.stats['hits'] += 1
        return entry['data']

    def set(self, prefix: str, user_id: str, data: Any, ttl_override: Optional[int] = None, **kwargs) -> None:
        """Set cached data with TTL"""
        cache_key = self._generate_cache_key(prefix, user_id, **kwargs)
        ttl = ttl_override or self.TTL_CONFIG.get(prefix, 300)  # Default 5 minutes
        
        self.cache[cache_key] = {
            'data': data,
            'timestamp': time.time(),
            'ttl': ttl,
            'created_at': datetime.now().isoformat()
        }
        
        logger.info("Cache SET: {prefix} for user {user_id} (TTL: {ttl}s)", 
                   prefix=prefix, user_id=user_id, ttl=ttl)
        self.stats['sets'] += 1

    def invalidate(self, prefix: str, user_id: Optional[str] = None, **kwargs) -> int:
        """Invalidate cache entries matching pattern"""
        pattern_key = self._generate_cache_key(prefix, user_id or "*", **kwargs)
        pattern_prefix = pattern_key.split(':')[0] + ':'
        
        keys_to_delete = []
        for key in self.cache.keys():
            if key.startswith(pattern_prefix):
                if user_id is None or user_id in key:
                    keys_to_delete.append(key)
        
        for key in keys_to_delete:
            del self.cache[key]
        
        logger.info("Cache INVALIDATED: {count} entries matching {pattern}", 
                   count=len(keys_to_delete), pattern=pattern_prefix)
        self.stats['invalidations'] += len(keys_to_delete)
        return len(keys_to_delete)

    def invalidate_user(self, user_id: str) -> int:
        """Invalidate all cache entries for a specific user"""
        keys_to_delete = [key for key in self.cache.keys() if user_id in key]
        
        for key in keys_to_delete:
            del self.cache[key]
        
        logger.info("Cache INVALIDATED: {count} entries for user {user_id}", 
                   count=len(keys_to_delete), user_id=user_id)
        self.stats['invalidations'] += len(keys_to_delete)
        return len(keys_to_delete)

    # ------------------------------------------------------------------
    # raw-key methods (for services that manage their own keys)
    # ------------------------------------------------------------------
    def raw_get(self, key: str) -> Optional[Any]:
        """Get a cached value by raw key (no prefix/user_id/kwargs)."""
        entry = self.cache.get(key)
        if entry is None:
            self.stats['misses'] += 1
            return None
        if self._is_expired(entry):
            del self.cache[key]
            self.stats['misses'] += 1
            return None
        self.stats['hits'] += 1
        return entry['data']

    def raw_set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        """Store a value by raw key with the given TTL."""
        self.cache[key] = {
            'data': value,
            'timestamp': time.time(),
            'ttl': ttl_seconds,
            'created_at': datetime.now().isoformat(),
        }
        self.stats['sets'] += 1

    def raw_delete(self, key: str) -> bool:
        """Delete a single entry by raw key. Returns True if deleted."""
        if key in self.cache:
            del self.cache[key]
            return True
        return False

    def raw_invalidate_prefix(self, prefix: str) -> int:
        """Delete all entries whose key starts with *prefix*. Returns count."""
        keys = [k for k in self.cache if k.startswith(prefix)]
        for k in keys:
            del self.cache[k]
        if keys:
            self.stats['invalidations'] += len(keys)
        return len(keys)

    def cleanup_expired(self) -> int:
        """Remove expired entries from cache"""
        keys_to_delete = []
        
        for key, entry in self.cache.items():
            if self._is_expired(entry):
                keys_to_delete.append(key)
        
        for key in keys_to_delete:
            del self.cache[key]
        
        if keys_to_delete:
            logger.info("Cache CLEANUP: Removed {count} expired entries", count=len(keys_to_delete))
        
        return len(keys_to_delete)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.stats['hits'] + self.stats['misses']
        hit_rate = (self.stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'cache_size': len(self.cache),
            'hit_rate': round(hit_rate, 2),
            'total_requests': total_requests,
            'hits': self.stats['hits'],
            'misses': self.stats['misses'],
            'sets': self.stats['sets'],
            'invalidations': self.stats['invalidations'],
            'ttl_config': self.TTL_CONFIG
        }

    def clear_all(self) -> None:
        """Clear all cache entries"""
        self.cache.clear()
        logger.info("Cache CLEARED: All entries removed")

    def get_cache_info(self) -> Dict[str, Any]:
        """Get detailed cache information for debugging"""
        cache_info = {}
        
        for key, entry in self.cache.items():
            age = int(time.time() - entry['timestamp'])
            remaining_ttl = max(0, entry['ttl'] - age)
            
            cache_info[key] = {
                'age_seconds': age,
                'remaining_ttl_seconds': remaining_ttl,
                'created_at': entry.get('created_at', 'unknown'),
                'data_size': len(str(entry['data'])) if entry['data'] else 0
            }
        
        return cache_info


# Global cache instance
analytics_cache = AnalyticsCacheService()

# Cleanup expired entries every 5 minutes
import threading
import time

def cleanup_worker():
    """Background worker to clean up expired cache entries"""
    while True:
        try:
            time.sleep(300)  # 5 minutes
            analytics_cache.cleanup_expired()
        except Exception as e:
            logger.error("Cache cleanup error: {error}", error=e)

# Start cleanup thread
cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
cleanup_thread.start()
logger.info("Analytics cache cleanup thread started")

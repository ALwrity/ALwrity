"""
Research Cache Service

Provides intelligent caching for Google grounded research results to reduce API costs.
Only returns cached results for exact keyword matches to ensure accuracy.
"""

import hashlib
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from loguru import logger


class ResearchCache:
    """Cache for research results with exact keyword matching."""
    
    # Increment when cache schema changes to invalidate old entries
    CACHE_VERSION = "v2"
    
    def __init__(self, max_cache_size: int = 100, cache_ttl_hours: int = 24):
        """
        Initialize the research cache.
        
        Args:
            max_cache_size: Maximum number of cached entries
            cache_ttl_hours: Time-to-live for cache entries in hours
        """
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.max_cache_size = max_cache_size
        self.cache_ttl = timedelta(hours=cache_ttl_hours)
    
    def _generate_cache_key(self, keywords: List[str], industry: str, target_audience: str) -> str:
        """
        Generate a cache key based on exact keyword match.
        
        Args:
            keywords: List of research keywords
            industry: Industry context
            target_audience: Target audience context
            
        Returns:
            MD5 hash of the normalized parameters
        """
        # Normalize and sort keywords for consistent hashing
        normalized_keywords = sorted([kw.lower().strip() for kw in keywords])
        normalized_industry = industry.lower().strip() if industry else "general"
        normalized_audience = target_audience.lower().strip() if target_audience else "general"
        
        # Create a consistent string representation with cache version
        cache_string = f"{self.CACHE_VERSION}|{normalized_keywords}|{normalized_industry}|{normalized_audience}"
        
        # Generate MD5 hash
        return hashlib.md5(cache_string.encode('utf-8')).hexdigest()
    
    def _is_cache_entry_valid(self, entry: Dict[str, Any]) -> bool:
        """Check if a cache entry is still valid (not expired)."""
        if 'created_at' not in entry:
            return False
        
        created_at = datetime.fromisoformat(entry['created_at'])
        return datetime.now() - created_at < self.cache_ttl
    
    def _cleanup_expired_entries(self):
        """Remove expired cache entries."""
        expired_keys = []
        for key, entry in self.cache.items():
            if not self._is_cache_entry_valid(entry):
                expired_keys.append(key)
        
        for key in expired_keys:
            del self.cache[key]
            logger.debug(f"Removed expired cache entry: {key}")
    
    def _evict_oldest_entries(self, num_to_evict: int):
        """Evict the oldest cache entries when cache is full."""
        # Sort by creation time and remove oldest entries
        sorted_entries = sorted(
            self.cache.items(),
            key=lambda x: x[1].get('created_at', ''),
            reverse=False
        )
        
        for i in range(min(num_to_evict, len(sorted_entries))):
            key = sorted_entries[i][0]
            del self.cache[key]
            logger.debug(f"Evicted oldest cache entry: {key}")
    
    def get_cached_result(self, keywords: List[str], industry: str, target_audience: str) -> Optional[Dict[str, Any]]:
        """
        Get cached research result for exact keyword match.
        
        Args:
            keywords: List of research keywords
            industry: Industry context
            target_audience: Target audience context
            
        Returns:
            Cached research result if found and valid, None otherwise
        """
        cache_key = self._generate_cache_key(keywords, industry, target_audience)
        
        if cache_key not in self.cache:
            logger.debug(f"Cache miss for keywords: {keywords}")
            return None
        
        entry = self.cache[cache_key]
        
        # Check if entry is still valid
        if not self._is_cache_entry_valid(entry):
            del self.cache[cache_key]
            logger.debug(f"Cache entry expired for keywords: {keywords}")
            return None
        
        logger.info(f"Cache hit for keywords: {keywords} (saved API call)")
        return entry.get('result')
    
    def cache_result(self, keywords: List[str], industry: str, target_audience: str, result: Dict[str, Any]):
        """
        Cache a research result.
        
        Args:
            keywords: List of research keywords
            industry: Industry context
            target_audience: Target audience context
            result: Research result to cache
        """
        cache_key = self._generate_cache_key(keywords, industry, target_audience)
        
        # Cleanup expired entries first
        self._cleanup_expired_entries()
        
        # Check if cache is full and evict if necessary
        if len(self.cache) >= self.max_cache_size:
            num_to_evict = len(self.cache) - self.max_cache_size + 1
            self._evict_oldest_entries(num_to_evict)
        
        # Store the result
        self.cache[cache_key] = {
            'result': result,
            'created_at': datetime.now().isoformat(),
            'keywords': keywords,
            'industry': industry,
            'target_audience': target_audience
        }
        
        logger.info(f"Cached research result for keywords: {keywords}")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        self._cleanup_expired_entries()
        
        return {
            'total_entries': len(self.cache),
            'max_size': self.max_cache_size,
            'ttl_hours': self.cache_ttl.total_seconds() / 3600,
            'entries': [
                {
                    'keywords': entry['keywords'],
                    'industry': entry['industry'],
                    'target_audience': entry['target_audience'],
                    'created_at': entry['created_at']
                }
                for entry in self.cache.values()
            ]
        }
    
    def clear_cache(self):
        """Clear all cached entries."""
        self.cache.clear()
        logger.info("Research cache cleared")


# Global cache instance
research_cache = ResearchCache()

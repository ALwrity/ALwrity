"""
Comprehensive User Data Cache Service
Manages caching of expensive comprehensive user data operations.
"""

from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from sqlalchemy import and_
from loguru import logger
import json

from models.comprehensive_user_data_cache import ComprehensiveUserDataCache
from services.calendar_generation_datasource_framework.data_processing.comprehensive_user_data import ComprehensiveUserDataProcessor

class ComprehensiveUserDataCacheService:
    """Service for caching comprehensive user data to improve performance."""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.data_processor = ComprehensiveUserDataProcessor()
        
    async def get_cached_data(
        self, 
        user_id: int, 
        strategy_id: Optional[int] = None,
        force_refresh: bool = False,
        **kwargs
    ) -> Tuple[Optional[Dict[str, Any]], bool]:
        """
        Get comprehensive user data from cache or generate if not cached.
        
        Args:
            user_id: User ID
            strategy_id: Optional strategy ID
            force_refresh: Force refresh even if cached
            **kwargs: Additional parameters for cache key generation
            
        Returns:
            Tuple of (data, is_cached)
        """
        try:
            # Generate cache key
            data_hash = ComprehensiveUserDataCache.generate_data_hash(
                user_id, strategy_id, **kwargs
            )
            
            if not force_refresh:
                # Try to get from cache
                cached_data = self._get_from_cache(user_id, strategy_id, data_hash)
                if cached_data:
                    logger.info(f"✅ Cache HIT for user {user_id}, strategy {strategy_id}")
                    return cached_data, True
            
            # Cache miss or force refresh - generate fresh data
            logger.info(f"🔄 CACHE MISS - Tier: Database | User: {user_id} | Strategy: {strategy_id} | "
                      f"Force Refresh: {force_refresh} | Hash: {data_hash[:8]}... | Generating fresh data...")
            fresh_data = await self.data_processor.get_comprehensive_user_data(user_id, strategy_id)
            
            # Store in cache
            self._store_in_cache(user_id, strategy_id, data_hash, fresh_data)
            
            return fresh_data, False
            
        except Exception as e:
            logger.error(f"❌ Error in cache service: {str(e)}")
            # Fallback to direct generation
            try:
                fallback_data = await self.data_processor.get_comprehensive_user_data(user_id, strategy_id)
                return fallback_data, False
            except Exception as fallback_error:
                logger.error(f"❌ Fallback also failed: {str(fallback_error)}")
                return None, False
    
    async def get_comprehensive_user_data_backward_compatible(
        self, 
        user_id: int, 
        strategy_id: Optional[int] = None,
        force_refresh: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Backward-compatible method that returns data in the original format.
        This prevents breaking changes for existing code.
        
        Args:
            user_id: User ID
            strategy_id: Optional strategy ID
            force_refresh: Force refresh even if cached
            **kwargs: Additional parameters for cache key generation
            
        Returns:
            Dict containing comprehensive user data (original format)
        """
        try:
            data, is_cached = await self.get_cached_data(
                user_id, strategy_id, force_refresh=force_refresh, **kwargs
            )
            
            if data:
                # Return data in original format (without cache metadata)
                return data
            else:
                # Fallback to direct processing if cache fails
                logger.warning(f"Cache failed, using direct processing for user {user_id}")
                return await self.data_processor.get_comprehensive_user_data(user_id, strategy_id)
                
        except Exception as e:
            logger.error(f"❌ Error in backward-compatible method: {str(e)}")
            # Final fallback to direct processing
            return await self.data_processor.get_comprehensive_user_data(user_id, strategy_id)
    
    def _get_from_cache(
        self, 
        user_id: int, 
        strategy_id: Optional[int], 
        data_hash: str
    ) -> Optional[Dict[str, Any]]:
        """Get data from cache if valid."""
        try:
            # Query cache with conditions
            cache_entry = self.db.query(ComprehensiveUserDataCache).filter(
                and_(
                    ComprehensiveUserDataCache.user_id == user_id,
                    ComprehensiveUserDataCache.strategy_id == strategy_id,
                    ComprehensiveUserDataCache.data_hash == data_hash,
                    ComprehensiveUserDataCache.expires_at > datetime.utcnow()
                )
            ).first()
            
            if cache_entry:
                # Calculate cache age and time to expiry
                cache_age = datetime.utcnow() - cache_entry.created_at
                time_to_expiry = cache_entry.expires_at - datetime.utcnow()
                
                # Update access statistics
                cache_entry.touch()
                self.db.commit()
                
                # Enhanced logging with metadata
                logger.info(f"📊 CACHE HIT - Tier: Database | User: {user_id} | Strategy: {strategy_id} | "
                          f"Age: {cache_age.total_seconds():.1f}s | TTL: {time_to_expiry.total_seconds():.1f}s | "
                          f"Access Count: {cache_entry.access_count} | Hash: {data_hash[:8]}...")
                
                return cache_entry.comprehensive_data
            
            return None
            
        except OperationalError as e:
            # Table might not exist yet; treat as cache miss
            logger.warning(f"❕ Cache table not found (get): {str(e)}")
            return None
        except Exception as e:
            logger.error(f"❌ Error getting from cache: {str(e)}")
            return None
    
    def _store_in_cache(
        self, 
        user_id: int, 
        strategy_id: Optional[int], 
        data_hash: str, 
        data: Dict[str, Any]
    ) -> bool:
        """Store data in cache."""
        try:
            # Remove existing cache entry if exists
            self.db.query(ComprehensiveUserDataCache).filter(
                and_(
                    ComprehensiveUserDataCache.user_id == user_id,
                    ComprehensiveUserDataCache.strategy_id == strategy_id,
                    ComprehensiveUserDataCache.data_hash == data_hash
                )
            ).delete()
            
            # Create new cache entry
            cache_entry = ComprehensiveUserDataCache(
                user_id=user_id,
                strategy_id=strategy_id,
                data_hash=data_hash,
                comprehensive_data=data,
                expires_at=ComprehensiveUserDataCache.get_default_expiry()
            )
            
            self.db.add(cache_entry)
            self.db.commit()
            
            logger.info(f"💾 CACHE STORED - Tier: Database | User: {user_id} | Strategy: {strategy_id} | "
                      f"Expires: {cache_entry.expires_at.strftime('%H:%M:%S')} | Hash: {data_hash[:8]}... | "
                      f"Data Size: {len(str(data))} chars")
            return True
            
        except OperationalError as e:
            # Table might not exist yet; skip storing
            logger.warning(f"❕ Cache table not found (store): {str(e)}")
            self.db.rollback()
            return False
        except Exception as e:
            logger.error(f"❌ Error storing in cache: {str(e)}")
            self.db.rollback()
            return False
    
    def invalidate_cache(self, user_id: int, strategy_id: Optional[int] = None) -> bool:
        """Invalidate cache for a user/strategy combination."""
        try:
            query = self.db.query(ComprehensiveUserDataCache).filter(
                ComprehensiveUserDataCache.user_id == user_id
            )
            
            if strategy_id is not None:
                query = query.filter(ComprehensiveUserDataCache.strategy_id == strategy_id)
            
            deleted_count = query.delete()
            self.db.commit()
            
            logger.info(f"🗑️ Invalidated {deleted_count} cache entries for user {user_id}, strategy {strategy_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error invalidating cache: {str(e)}")
            self.db.rollback()
            return False
    
    def cleanup_expired_cache(self) -> int:
        """Clean up expired cache entries."""
        try:
            deleted_count = self.db.query(ComprehensiveUserDataCache).filter(
                ComprehensiveUserDataCache.expires_at <= datetime.utcnow()
            ).delete()
            
            self.db.commit()
            
            if deleted_count > 0:
                logger.info(f"🧹 Cleaned up {deleted_count} expired cache entries")
            
            return deleted_count
            
        except OperationalError as e:
            # Table might not exist yet; nothing to cleanup
            logger.warning(f"❕ Cache table not found (cleanup): {str(e)}")
            self.db.rollback()
            return 0
        except Exception as e:
            logger.error(f"❌ Error cleaning up cache: {str(e)}")
            self.db.rollback()
            return 0
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        try:
            total_entries = self.db.query(ComprehensiveUserDataCache).count()
            expired_entries = self.db.query(ComprehensiveUserDataCache).filter(
                ComprehensiveUserDataCache.expires_at <= datetime.utcnow()
            ).count()
            
            # Get most accessed entries
            most_accessed = self.db.query(ComprehensiveUserDataCache).order_by(
                ComprehensiveUserDataCache.access_count.desc()
            ).limit(5).all()
            
            return {
                "total_entries": total_entries,
                "expired_entries": expired_entries,
                "valid_entries": total_entries - expired_entries,
                "most_accessed": [
                    {
                        "user_id": entry.user_id,
                        "strategy_id": entry.strategy_id,
                        "access_count": entry.access_count,
                        "last_accessed": entry.last_accessed.isoformat()
                    }
                    for entry in most_accessed
                ]
            }
            
        except OperationalError as e:
            # Table might not exist yet; return empty stats to avoid noisy errors
            logger.warning(f"❕ Cache table not found (stats): {str(e)}")
            return {
                "total_entries": 0,
                "expired_entries": 0,
                "valid_entries": 0,
                "most_accessed": []
            }
        except Exception as e:
            logger.error(f"❌ Error getting cache stats: {str(e)}")
            return {"error": str(e)}

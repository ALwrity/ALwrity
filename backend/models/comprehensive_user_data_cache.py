"""
Comprehensive User Data Cache Model
Caches expensive comprehensive user data operations to improve performance.
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, Index, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import hashlib
import json

Base = declarative_base()

class ComprehensiveUserDataCache(Base):
    """Cache for comprehensive user data to avoid redundant expensive operations."""
    
    __tablename__ = "comprehensive_user_data_cache"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    strategy_id = Column(Integer, nullable=True)
    data_hash = Column(String(64), nullable=False)  # For cache invalidation
    comprehensive_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    access_count = Column(Integer, default=0)
    
    # Indexes for fast lookups
    __table_args__ = (
        Index('idx_user_strategy', 'user_id', 'strategy_id'),
        Index('idx_expires_at', 'expires_at'),
        Index('idx_data_hash', 'data_hash'),
    )
    
    def __repr__(self):
        return f"<ComprehensiveUserDataCache(user_id={self.user_id}, strategy_id={self.strategy_id}, expires_at={self.expires_at})>"
    
    @staticmethod
    def generate_data_hash(user_id: int, strategy_id: int = None, **kwargs) -> str:
        """Generate a hash for cache invalidation based on input parameters."""
        data_string = f"{user_id}_{strategy_id}_{json.dumps(kwargs, sort_keys=True)}"
        return hashlib.sha256(data_string.encode()).hexdigest()
    
    @staticmethod
    def get_default_expiry() -> datetime:
        """Get default expiry time (1 hour from now)."""
        return datetime.utcnow() + timedelta(hours=1)
    
    def is_expired(self) -> bool:
        """Check if the cache entry has expired."""
        return datetime.utcnow() > self.expires_at
    
    def touch(self):
        """Update last accessed time and increment access count."""
        self.last_accessed = datetime.utcnow()
        self.access_count += 1
    
    def to_dict(self) -> dict:
        """Convert cache entry to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "strategy_id": self.strategy_id,
            "data_hash": self.data_hash,
            "comprehensive_data": self.comprehensive_data,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat(),
            "access_count": self.access_count
        }

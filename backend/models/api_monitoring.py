"""
API Monitoring Database Models
Persistent storage for API monitoring statistics.
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, JSON, Index, Text
from sqlalchemy.orm import declarative_base
from datetime import datetime
import json

Base = declarative_base()

class APIRequest(Base):
    """Store individual API requests for monitoring."""
    
    __tablename__ = "api_requests"
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    path = Column(String(500), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=False)
    duration = Column(Float, nullable=False)  # Response time in seconds
    user_id = Column(String(50), nullable=True)
    cache_hit = Column(Boolean, nullable=True)
    request_size = Column(Integer, nullable=True)
    response_size = Column(Integer, nullable=True)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    # Indexes for fast queries
    __table_args__ = (
        Index('idx_api_req_timestamp', 'timestamp'),
        Index('idx_api_req_path_method', 'path', 'method'),
        Index('idx_api_req_status_code', 'status_code'),
        Index('idx_api_req_user_id', 'user_id'),
    )

class APIEndpointStats(Base):
    """Aggregated statistics per endpoint."""
    
    __tablename__ = "api_endpoint_stats"
    
    id = Column(Integer, primary_key=True)
    endpoint = Column(String(500), nullable=False, unique=True)  # "GET /api/endpoint"
    total_requests = Column(Integer, default=0)
    total_errors = Column(Integer, default=0)
    total_duration = Column(Float, default=0.0)
    avg_duration = Column(Float, default=0.0)
    min_duration = Column(Float, nullable=True)
    max_duration = Column(Float, nullable=True)
    last_called = Column(DateTime, nullable=True)
    cache_hits = Column(Integer, default=0)
    cache_misses = Column(Integer, default=0)
    cache_hit_rate = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_api_stats_endpoint', 'endpoint'),
        Index('idx_api_stats_total_requests', 'total_requests'),
        Index('idx_api_stats_avg_duration', 'avg_duration'),
    )

class SystemHealth(Base):
    """System health snapshots."""
    
    __tablename__ = "system_health"
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(20), nullable=False)  # healthy, warning, critical
    total_requests = Column(Integer, default=0)
    total_errors = Column(Integer, default=0)
    error_rate = Column(Float, default=0.0)
    avg_response_time = Column(Float, default=0.0)
    cache_hit_rate = Column(Float, default=0.0)
    active_endpoints = Column(Integer, default=0)
    metrics = Column(JSON, nullable=True)  # Additional metrics
    
    __table_args__ = (
        Index('idx_sys_health_timestamp', 'timestamp'),
        Index('idx_sys_health_status', 'status'),
    )

class CachePerformance(Base):
    """Cache performance metrics."""
    
    __tablename__ = "cache_performance"
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    cache_type = Column(String(50), nullable=False)  # "comprehensive_user_data", "redis", etc.
    hits = Column(Integer, default=0)
    misses = Column(Integer, default=0)
    hit_rate = Column(Float, default=0.0)
    avg_response_time = Column(Float, default=0.0)
    total_requests = Column(Integer, default=0)
    
    __table_args__ = (
        Index('idx_cache_perf_timestamp', 'timestamp'),
        Index('idx_cache_type', 'cache_type'),
    )

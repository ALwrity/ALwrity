"""
Bing Analytics Database Models

Models for storing and analyzing Bing Webmaster Tools analytics data
including raw query data, aggregated metrics, and trend analysis.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, Index
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
from datetime import datetime
from typing import Dict, Any, List, Optional

Base = declarative_base()


class BingQueryStats(Base):
    """Raw query statistics from Bing Webmaster Tools API"""
    __tablename__ = 'bing_query_stats'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    site_url = Column(String(500), nullable=False, index=True)
    
    # Query data
    query = Column(Text, nullable=False, index=True)
    clicks = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    avg_click_position = Column(Float, default=-1)
    avg_impression_position = Column(Float, default=-1)
    ctr = Column(Float, default=0)  # Calculated: clicks/impressions * 100
    
    # Date information
    query_date = Column(DateTime, nullable=False, index=True)
    collected_at = Column(DateTime, default=func.now(), index=True)
    
    # Additional metadata
    query_length = Column(Integer, default=0)  # For analysis
    is_brand_query = Column(Boolean, default=False)  # Contains brand name
    category = Column(String(100), default='general')  # ai_writing, business, etc.
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_user_site_date', 'user_id', 'site_url', 'query_date'),
        Index('idx_query_performance', 'query', 'clicks', 'impressions'),
        Index('idx_collected_at', 'collected_at'),
    )


class BingDailyMetrics(Base):
    """Daily aggregated metrics for Bing analytics"""
    __tablename__ = 'bing_daily_metrics'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    site_url = Column(String(500), nullable=False, index=True)
    
    # Date
    metric_date = Column(DateTime, nullable=False, index=True)
    collected_at = Column(DateTime, default=func.now())
    
    # Aggregated metrics
    total_clicks = Column(Integer, default=0)
    total_impressions = Column(Integer, default=0)
    total_queries = Column(Integer, default=0)
    avg_ctr = Column(Float, default=0)
    avg_position = Column(Float, default=0)
    
    # Top performing queries (JSON)
    top_queries = Column(Text)  # JSON string of top 10 queries
    top_clicks = Column(Text)   # JSON string of queries with most clicks
    top_impressions = Column(Text)  # JSON string of queries with most impressions
    
    # Trend indicators (compared to previous day)
    clicks_change = Column(Float, default=0)  # Percentage change
    impressions_change = Column(Float, default=0)
    ctr_change = Column(Float, default=0)
    
    # Indexes
    __table_args__ = (
        Index('idx_user_site_metric_date', 'user_id', 'site_url', 'metric_date'),
    )


class BingTrendAnalysis(Base):
    """Weekly/Monthly trend analysis data"""
    __tablename__ = 'bing_trend_analysis'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    site_url = Column(String(500), nullable=False, index=True)
    
    # Period information
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False, index=True)
    period_type = Column(String(20), nullable=False)  # 'weekly', 'monthly'
    
    # Trend metrics
    total_clicks = Column(Integer, default=0)
    total_impressions = Column(Integer, default=0)
    total_queries = Column(Integer, default=0)
    avg_ctr = Column(Float, default=0)
    avg_position = Column(Float, default=0)
    
    # Growth indicators
    clicks_growth = Column(Float, default=0)  # vs previous period
    impressions_growth = Column(Float, default=0)
    ctr_growth = Column(Float, default=0)
    
    # Top categories and queries
    top_categories = Column(Text)  # JSON of category performance
    trending_queries = Column(Text)  # JSON of trending queries
    declining_queries = Column(Text)  # JSON of declining queries
    
    created_at = Column(DateTime, default=func.now(), index=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_user_site_period', 'user_id', 'site_url', 'period_type', 'period_start'),
    )


class BingAlertRules(Base):
    """Alert rules for Bing analytics monitoring"""
    __tablename__ = 'bing_alert_rules'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    site_url = Column(String(500), nullable=False, index=True)
    
    # Alert configuration
    rule_name = Column(String(255), nullable=False)
    alert_type = Column(String(50), nullable=False)  # 'ctr_drop', 'query_spike', 'position_drop'
    
    # Thresholds
    threshold_value = Column(Float, nullable=False)
    comparison_operator = Column(String(10), nullable=False)  # '>', '<', '>=', '<=', '=='
    
    # Alert settings
    is_active = Column(Boolean, default=True)
    last_triggered = Column(DateTime)
    trigger_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class BingAlertHistory(Base):
    """History of triggered alerts"""
    __tablename__ = 'bing_alert_history'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    site_url = Column(String(500), nullable=False, index=True)
    alert_rule_id = Column(Integer, nullable=False, index=True)
    
    # Alert details
    alert_type = Column(String(50), nullable=False)
    trigger_value = Column(Float, nullable=False)
    threshold_value = Column(Float, nullable=False)
    message = Column(Text, nullable=False)
    
    # Context data
    context_data = Column(Text)  # JSON with additional context
    
    triggered_at = Column(DateTime, default=func.now(), index=True)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    
    # Indexes
    __table_args__ = (
        Index('idx_user_alert_triggered', 'user_id', 'triggered_at'),
        Index('idx_alert_rule_triggered', 'alert_rule_id', 'triggered_at'),
    )


class BingSitePerformance(Base):
    """Overall site performance summary"""
    __tablename__ = 'bing_site_performance'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    site_url = Column(String(500), nullable=False, index=True)
    
    # Performance summary
    total_clicks_all_time = Column(Integer, default=0)
    total_impressions_all_time = Column(Integer, default=0)
    total_queries_all_time = Column(Integer, default=0)
    best_avg_ctr = Column(Float, default=0)
    best_avg_position = Column(Float, default=0)
    
    # Top performers
    best_performing_query = Column(Text)
    best_performing_date = Column(DateTime)
    most_impressions_query = Column(Text)
    most_clicks_query = Column(Text)
    
    # Rankings and insights
    query_diversity_score = Column(Float, default=0)  # Unique queries / total queries
    brand_query_percentage = Column(Float, default=0)
    
    # Last updated
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now())
    data_collection_start = Column(DateTime)
    
    # Indexes
    __table_args__ = (
        Index('idx_user_site_performance', 'user_id', 'site_url'),
    )

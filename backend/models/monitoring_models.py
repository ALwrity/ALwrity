from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship, backref
from datetime import datetime

# Import the same Base from enhanced_strategy_models
from models.enhanced_strategy_models import Base

class StrategyMonitoringPlan(Base):
    """Model for storing strategy monitoring plans"""
    __tablename__ = "strategy_monitoring_plans"

    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(Integer, ForeignKey("enhanced_content_strategies.id"), nullable=False)
    plan_data = Column(JSON, nullable=False)  # Store the complete monitoring plan
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to strategy.
    # This module imports Base from enhanced_strategy_models, so a
    # top-level import of EnhancedContentStrategy here would create a
    # circular import -- the class would be only partially defined.
    # The original code used ``back_populates="monitoring_plans"``,
    # which requires a matching ``back_populates="strategy"`` on the
    # strategy class, and the resulting forward-reference string
    # resolution triggered ``InvalidRequestError: expression
    # '...' failed to locate a name`` on first DB read.
    #
    # Fix: use ``backref`` here. The forward ``strategy`` attribute
    # on this class is the explicit relationship; the reverse
    # ``monitoring_plans`` attribute is auto-created on
    # EnhancedContentStrategy with the cascade configured via the
    # backref kwargs. Cascade goes on the strategy side (the parent
    # in the delete chain) so deleting a strategy deletes its
    # monitoring plans.
    strategy = relationship(
        "EnhancedContentStrategy",
        backref=backref("monitoring_plans", cascade="all, delete-orphan"),
    )

class MonitoringTask(Base):
    """Model for storing individual monitoring tasks"""
    __tablename__ = "monitoring_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(Integer, ForeignKey("enhanced_content_strategies.id"), nullable=False)
    component_name = Column(String(100), nullable=False)
    task_title = Column(String(200), nullable=False)
    task_description = Column(Text, nullable=False)
    assignee = Column(String(50), nullable=False)  # 'ALwrity' or 'Human'
    frequency = Column(String(50), nullable=False)  # 'Daily', 'Weekly', 'Monthly', 'Quarterly'
    metric = Column(String(100), nullable=False)
    measurement_method = Column(Text, nullable=False)
    success_criteria = Column(Text, nullable=False)
    alert_threshold = Column(Text, nullable=False)
    status = Column(String(50), default='pending')  # 'pending', 'active', 'completed', 'failed'
    last_executed = Column(DateTime, nullable=True)
    next_execution = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    # See StrategyMonitoringPlan above for the rationale behind
    # using backref (not back_populates) on the strategy relationship.
    # Cascade goes on the backref (strategy) side, so deleting a
    # strategy deletes its monitoring tasks.
    strategy = relationship(
        "EnhancedContentStrategy",
        backref=backref("monitoring_tasks", cascade="all, delete-orphan"),
    )
    execution_logs = relationship("TaskExecutionLog", back_populates="task", cascade="all, delete-orphan")

class TaskExecutionLog(Base):
    """Model for storing task execution logs"""
    __tablename__ = "task_execution_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("monitoring_tasks.id"), nullable=False)
    user_id = Column(Integer, nullable=True)  # User ID for user isolation (nullable for backward compatibility)
    execution_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), nullable=False)  # 'success', 'failed', 'skipped', 'running'
    result_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to monitoring task
    task = relationship("MonitoringTask", back_populates="execution_logs")

class StrategyPerformanceMetrics(Base):
    """Model for storing strategy performance metrics"""
    __tablename__ = "strategy_performance_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(Integer, ForeignKey("enhanced_content_strategies.id"), nullable=False)
    user_id = Column(String(255), nullable=False)
    metric_date = Column(DateTime, default=datetime.utcnow)
    traffic_growth_percentage = Column(Integer, nullable=True)
    engagement_rate_percentage = Column(Integer, nullable=True)
    conversion_rate_percentage = Column(Integer, nullable=True)
    roi_ratio = Column(Integer, nullable=True)
    strategy_adoption_rate = Column(Integer, nullable=True)
    content_quality_score = Column(Integer, nullable=True)
    competitive_position_rank = Column(Integer, nullable=True)
    audience_growth_percentage = Column(Integer, nullable=True)
    data_source = Column(String(100), nullable=True)
    confidence_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # The ``strategy`` relationship uses backref (not back_populates)
    # to break the circular import. See StrategyMonitoringPlan above
    # for the full rationale. Cascade goes on the backref (strategy)
    # side, so deleting a strategy deletes its performance metric
    # records.
    strategy = relationship(
        "EnhancedContentStrategy",
        backref=backref("performance_metrics", cascade="all, delete-orphan"),
    )

class StrategyActivationStatus(Base):
    """Model for storing strategy activation status"""
    __tablename__ = "strategy_activation_status"
    
    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(Integer, ForeignKey("enhanced_content_strategies.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    activation_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default='active')  # 'active', 'inactive', 'paused'
    performance_score = Column(Integer, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # The ``strategy`` relationship uses backref (not back_populates)
    # to break the circular import. See StrategyMonitoringPlan above
    # for the full rationale. Cascade goes on the backref (strategy)
    # side, so deleting a strategy deletes its activation status.
    strategy = relationship(
        "EnhancedContentStrategy",
        backref=backref("activation_status", cascade="all, delete-orphan"),
    )

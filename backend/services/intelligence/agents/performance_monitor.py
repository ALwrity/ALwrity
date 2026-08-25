"""
Agent Performance Monitoring Framework for ALwrity Autonomous Marketing Agents
Tracks agent performance, efficiency, and provides optimization recommendations
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from collections import defaultdict, deque

from utils.logger_utils import get_service_logger
from services.database import get_session_for_user

logger = get_service_logger(__name__)

class PerformanceMetric(Enum):
    """Types of performance metrics tracked"""
    RESPONSE_TIME = "response_time"
    SUCCESS_RATE = "success_rate"
    EFFICIENCY_SCORE = "efficiency_score"
    RESOURCE_USAGE = "resource_usage"
    USER_SATISFACTION = "user_satisfaction"
    MARKET_IMPACT = "market_impact"

class AgentStatus(Enum):
    """Status of agent operations"""
    ACTIVE = "active"
    IDLE = "idle"
    PROCESSING = "processing"
    ERROR = "error"
    MAINTENANCE = "maintenance"

@dataclass
class PerformanceDataPoint:
    """Single performance data point"""
    timestamp: str
    metric_type: PerformanceMetric
    value: float
    context: Dict[str, Any]
    agent_id: str
    user_id: str

@dataclass
class AgentPerformanceSnapshot:
    """Complete performance snapshot for an agent"""
    agent_id: str
    user_id: str
    timestamp: str
    status: AgentStatus
    total_actions: int
    successful_actions: int
    failed_actions: int
    average_response_time: float
    success_rate: float
    efficiency_score: float
    resource_usage: Dict[str, float]
    market_impact_score: float
    last_action_at: str
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

@dataclass
class PerformanceTrend:
    """Performance trend analysis"""
    metric_type: PerformanceMetric
    trend_direction: str  # "improving", "declining", "stable"
    trend_strength: float  # 0.0 to 1.0
    change_rate: float  # Percentage change per time unit
    confidence: float  # 0.0 to 1.0
    period_start: str
    period_end: str

@dataclass
class OptimizationRecommendation:
    """Performance optimization recommendation"""
    recommendation_id: str
    agent_id: str
    user_id: str
    recommendation_type: str
    priority: str  # "high", "medium", "low"
    description: str
    expected_impact: Optional[float]  # Expected improvement in performance; None when not derivable
    implementation_steps: List[str]
    estimated_effort: str  # "low", "medium", "high"
    created_at: Optional[str] = None
    expires_at: Optional[str] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()
        if self.expires_at is None:
            # Default expiration: 7 days
            expires = datetime.utcnow().timestamp() + (7 * 24 * 60 * 60)
            self.expires_at = datetime.fromtimestamp(expires).isoformat()

class AgentPerformanceMonitor:
    """Main performance monitoring system for agents"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.performance_data: Dict[str, List[PerformanceDataPoint]] = defaultdict(list)
        self.agent_snapshots: Dict[str, AgentPerformanceSnapshot] = {}
        self.recommendations: List[OptimizationRecommendation] = []
        self.performance_history: deque = deque(maxlen=1000)  # Keep last 1000 data points
        
        # Performance thresholds and targets
        self.performance_targets = {
            "success_rate": 0.85,        # 85% success rate target
            "response_time": 30.0,       # 30 seconds average response time target
            "efficiency_score": 0.75,    # 75% efficiency score target
            "market_impact": 0.60        # 60% market impact score target
        }
        
        # Alert thresholds
        self.alert_thresholds = {
            "success_rate": 0.70,        # Alert if below 70%
            "response_time": 60.0,       # Alert if above 60 seconds
            "efficiency_score": 0.50,    # Alert if below 50%
            "market_impact": 0.30        # Alert if below 30%
        }
        
        logger.info(f"Initialized AgentPerformanceMonitor for user: {user_id}")
    
    async def record_performance_data(self, agent_id: str, metric_type: PerformanceMetric, value: float, context: Dict[str, Any] = None) -> bool:
        """Record a performance data point"""
        try:
            if context is None:
                context = {}
            
            data_point = PerformanceDataPoint(
                timestamp=datetime.utcnow().isoformat(),
                metric_type=metric_type,
                value=value,
                context=context,
                agent_id=agent_id,
                user_id=self.user_id
            )
            
            # Store in performance data
            self.performance_data[agent_id].append(data_point)
            self.performance_history.append(data_point)
            
            # Keep only recent data (last 24 hours for real-time analysis)
            cutoff_time = datetime.utcnow().timestamp() - (24 * 60 * 60)
            self.performance_data[agent_id] = [
                dp for dp in self.performance_data[agent_id]
                if datetime.fromisoformat(dp.timestamp).timestamp() > cutoff_time
            ]
            
            logger.debug(f"Recorded performance data for agent {agent_id}: {metric_type.value} = {value}")
            return True
            
        except Exception as e:
            logger.error(f"Error recording performance data for agent {agent_id}: {e}")
            return False
    
    async def _durable_stats(self, agent_id: str):
        """Durable per-agent stats from the AgentRun table (hot-cache backstop)."""
        from services.intelligence.agents.agent_run_metrics import get_agent_run_stats
        return await get_agent_run_stats(self.user_id, agent_id, window_hours=720)

    def _snapshot_from_durable(
        self,
        agent_id: str,
        status: AgentStatus,
        durable,
    ) -> AgentPerformanceSnapshot:
        """Build a snapshot purely from durable run stats (post-restart safe).

        Metrics that cannot be derived from runs (efficiency, market impact,
        resource usage) stay honestly at zero instead of being invented.
        """
        return AgentPerformanceSnapshot(
            agent_id=agent_id,
            user_id=self.user_id,
            timestamp=datetime.utcnow().isoformat(),
            status=status,
            total_actions=durable.total_runs,
            successful_actions=durable.successful_runs,
            failed_actions=durable.failed_runs,
            average_response_time=durable.avg_duration_seconds or 0.0,
            success_rate=durable.success_rate if durable.success_rate is not None else 0.0,
            efficiency_score=0.0,
            resource_usage={},
            market_impact_score=0.0,
            last_action_at=durable.last_run_at or datetime.utcnow().isoformat(),
        )

    async def update_agent_snapshot(self, agent_id: str, status: AgentStatus, action_result: Dict[str, Any] = None) -> AgentPerformanceSnapshot:
        """Update performance snapshot for an agent.

        Durable ``agent_runs`` aggregates are the source of truth for action
        counts, success rate, and response duration; the in-memory data points
        act as a hot cache that supplements metrics not derivable from runs
        (efficiency, market impact, resource usage).
        """
        try:
            durable = await self._durable_stats(agent_id)
            recent_data = self.performance_data[agent_id]

            if durable.total_runs > 0:
                # Durable layer authoritative for counts and response time.
                total_actions = durable.total_runs
                successful_actions = durable.successful_runs
                failed_actions = durable.failed_runs
                success_rate = durable.success_rate if durable.success_rate is not None else 0.0

                response_time_data = [dp.value for dp in recent_data if dp.metric_type == PerformanceMetric.RESPONSE_TIME]
                if durable.avg_duration_seconds is not None:
                    avg_response_time = durable.avg_duration_seconds
                elif response_time_data:
                    avg_response_time = sum(response_time_data) / len(response_time_data)
                else:
                    avg_response_time = 0.0

                last_durable = (
                    datetime.fromisoformat(durable.last_run_at)
                    if durable.last_run_at
                    else None
                )
                last_inmemory = max(
                    (datetime.fromisoformat(dp.timestamp) for dp in recent_data),
                    default=None,
                )
                if last_durable and (not last_inmemory or last_durable >= last_inmemory):
                    last_action_at = durable.last_run_at
                elif last_inmemory:
                    last_action_at = last_inmemory.isoformat()
                else:
                    last_action_at = datetime.utcnow().isoformat()
            else:
                # No persisted runs: fall back to hot-cache derivation.
                total_actions = len([dp for dp in recent_data if dp.metric_type == PerformanceMetric.SUCCESS_RATE])
                successful_actions = len([dp for dp in recent_data if dp.metric_type == PerformanceMetric.SUCCESS_RATE and dp.value > 0.5])
                failed_actions = total_actions - successful_actions
                success_rate = successful_actions / total_actions if total_actions > 0 else 0.0
                response_time_data = [dp.value for dp in recent_data if dp.metric_type == PerformanceMetric.RESPONSE_TIME]
                avg_response_time = sum(response_time_data) / len(response_time_data) if response_time_data else 0.0
                last_action_at = max([dp.timestamp for dp in recent_data], default=datetime.utcnow().isoformat()) if recent_data else datetime.utcnow().isoformat()

            # Hot-cache-only metric families.
            efficiency_data = [dp.value for dp in recent_data if dp.metric_type == PerformanceMetric.EFFICIENCY_SCORE]
            avg_efficiency = sum(efficiency_data) / len(efficiency_data) if efficiency_data else 0.0

            market_impact_data = [dp.value for dp in recent_data if dp.metric_type == PerformanceMetric.MARKET_IMPACT]
            avg_market_impact = sum(market_impact_data) / len(market_impact_data) if market_impact_data else 0.0

            # Get resource usage
            resource_usage = self._calculate_resource_usage(agent_id, recent_data)

            # Create snapshot
            snapshot = AgentPerformanceSnapshot(
                agent_id=agent_id,
                user_id=self.user_id,
                timestamp=datetime.utcnow().isoformat(),
                status=status,
                total_actions=total_actions,
                successful_actions=successful_actions,
                failed_actions=failed_actions,
                average_response_time=avg_response_time,
                success_rate=success_rate,
                efficiency_score=avg_efficiency,
                resource_usage=resource_usage,
                market_impact_score=avg_market_impact,
                last_action_at=last_action_at
            )
            
            self.agent_snapshots[agent_id] = snapshot
            
            logger.info(f"Updated performance snapshot for agent {agent_id}: success_rate={success_rate:.2f}, efficiency={avg_efficiency:.2f}")
            return snapshot
            
        except Exception as e:
            logger.error(f"Error updating performance snapshot for agent {agent_id}: {e}")
            # Return a default snapshot
            return AgentPerformanceSnapshot(
                agent_id=agent_id,
                user_id=self.user_id,
                timestamp=datetime.utcnow().isoformat(),
                status=AgentStatus.ERROR,
                total_actions=0,
                successful_actions=0,
                failed_actions=0,
                average_response_time=0.0,
                success_rate=0.0,
                efficiency_score=0.0,
                resource_usage={},
                market_impact_score=0.0,
                last_action_at=datetime.utcnow().isoformat()
            )
    
    def _calculate_resource_usage(self, agent_id: str, recent_data: List[PerformanceDataPoint]) -> Dict[str, float]:
        """Calculate resource usage metrics"""
        resource_usage = {
            "cpu_usage": 0.0,
            "memory_usage": 0.0,
            "api_calls": 0,
            "processing_time": 0.0
        }
        
        try:
            # Extract resource usage from context
            for dp in recent_data:
                if dp.metric_type == PerformanceMetric.RESOURCE_USAGE and dp.context:
                    resource_usage["cpu_usage"] = max(resource_usage["cpu_usage"], dp.context.get("cpu_usage", 0.0))
                    resource_usage["memory_usage"] = max(resource_usage["memory_usage"], dp.context.get("memory_usage", 0.0))
                    resource_usage["api_calls"] += dp.context.get("api_calls", 0)
                    resource_usage["processing_time"] += dp.context.get("processing_time", 0.0)
            
            # Calculate averages if multiple data points
            if len(recent_data) > 0:
                resource_usage["processing_time"] = resource_usage["processing_time"] / len(recent_data)
            
        except Exception as e:
            logger.error(f"Error calculating resource usage for agent {agent_id}: {e}")
        
        return resource_usage
    
    async def analyze_performance_trends(self, agent_id: str, period_hours: int = 24) -> List[PerformanceTrend]:
        """Analyze performance trends for an agent.

        Trends are computed from the in-memory hot cache, which carries
        fine-grained metric types (efficiency, market impact) that runs do
        not. Sparse data honestly yields an empty list.
        """
        try:
            cutoff_time = datetime.utcnow().timestamp() - (period_hours * 60 * 60)
            agent_data = [
                dp for dp in self.performance_data[agent_id]
                if datetime.fromisoformat(dp.timestamp).timestamp() > cutoff_time
            ]
            
            if len(agent_data) < 5:  # Need at least 5 data points for trend analysis
                return []
            
            trends = []
            
            # Analyze trends for each metric type
            for metric_type in PerformanceMetric:
                metric_data = [dp for dp in agent_data if dp.metric_type == metric_type]
                
                if len(metric_data) < 3:  # Need at least 3 points for trend
                    continue
                
                # Sort by timestamp
                metric_data.sort(key=lambda x: x.timestamp)
                
                # Calculate trend
                trend_result = self._calculate_trend(metric_data)
                
                if trend_result:
                    trend = PerformanceTrend(
                        metric_type=metric_type,
                        trend_direction=trend_result["direction"],
                        trend_strength=trend_result["strength"],
                        change_rate=trend_result["change_rate"],
                        confidence=trend_result["confidence"],
                        period_start=metric_data[0].timestamp,
                        period_end=metric_data[-1].timestamp
                    )
                    trends.append(trend)
            
            logger.info(f"Analyzed performance trends for agent {agent_id}: found {len(trends)} trends")
            return trends
            
        except Exception as e:
            logger.error(f"Error analyzing performance trends for agent {agent_id}: {e}")
            return []
    
    def _calculate_trend(self, data_points: List[PerformanceDataPoint]) -> Optional[Dict[str, Any]]:
        """Calculate trend from performance data points"""
        try:
            if len(data_points) < 3:
                return None
            
            # Extract values and timestamps
            values = [dp.value for dp in data_points]
            timestamps = [datetime.fromisoformat(dp.timestamp).timestamp() for dp in data_points]
            
            # Simple linear trend calculation
            n = len(values)
            sum_x = sum(timestamps)
            sum_y = sum(values)
            sum_xy = sum(x * y for x, y in zip(timestamps, values))
            sum_x2 = sum(x * x for x in timestamps)
            
            # Calculate slope and intercept
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
            intercept = (sum_y - slope * sum_x) / n
            
            # Calculate correlation coefficient (confidence)
            mean_y = sum_y / n
            ss_tot = sum((y - mean_y) ** 2 for y in values)
            ss_res = sum((y - (slope * x + intercept)) ** 2 for x, y in zip(timestamps, values))
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
            
            # Determine trend direction
            if abs(slope) < 0.001:  # Nearly flat
                direction = "stable"
                strength = 0.0
            elif slope > 0:
                direction = "improving"
                strength = min(1.0, abs(slope) * 100)  # Scale slope to 0-1
            else:
                direction = "declining"
                strength = min(1.0, abs(slope) * 100)
            
            # Calculate change rate (percentage change per hour)
            time_span = timestamps[-1] - timestamps[0]
            if time_span > 0:
                change_rate = (slope * 3600) / (values[0] if values[0] != 0 else 1) * 100  # Per hour
            else:
                change_rate = 0.0
            
            return {
                "direction": direction,
                "strength": strength,
                "change_rate": change_rate,
                "confidence": r_squared
            }
            
        except Exception as e:
            logger.error(f"Error calculating trend: {e}")
            return None
    
    async def generate_optimization_recommendations(self, agent_id: str) -> List[OptimizationRecommendation]:
        """Generate optimization recommendations for an agent"""
        try:
            recommendations = []
            
            # Get current snapshot
            snapshot = self.agent_snapshots.get(agent_id)
            if not snapshot:
                return []
            
            # Get performance trends
            trends = await self.analyze_performance_trends(agent_id)
            
            # Generate recommendations based on performance analysis
            
            # 1. Success rate recommendations
            if snapshot.success_rate < self.performance_targets["success_rate"]:
                recommendation = OptimizationRecommendation(
                    recommendation_id=f"success_rate_{agent_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                    agent_id=agent_id,
                    user_id=self.user_id,
                    recommendation_type="success_rate_improvement",
                    priority="high" if snapshot.success_rate < self.alert_thresholds["success_rate"] else "medium",
                    description=f"Agent success rate is {snapshot.success_rate:.1%}, target is {self.performance_targets['success_rate']:.1%}",
                    expected_impact=self.performance_targets["success_rate"] - snapshot.success_rate,
                    implementation_steps=[
                        "Analyze recent failed actions to identify patterns",
                        "Review error logs for common failure causes",
                        "Update agent parameters or logic to address identified issues",
                        "Test improvements with small batch of actions",
                        "Monitor success rate improvement over time"
                    ],
                    estimated_effort="medium"
                )
                recommendations.append(recommendation)
            
            # 2. Response time recommendations
            if snapshot.average_response_time > self.performance_targets["response_time"]:
                recommendation = OptimizationRecommendation(
                    recommendation_id=f"response_time_{agent_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                    agent_id=agent_id,
                    user_id=self.user_id,
                    recommendation_type="response_time_optimization",
                    priority="high" if snapshot.average_response_time > self.alert_thresholds["response_time"] else "medium",
                    description=f"Agent average response time is {snapshot.average_response_time:.1f}s, target is {self.performance_targets['response_time']:.1f}s",
                    expected_impact=(self.performance_targets["response_time"] - snapshot.average_response_time) / snapshot.average_response_time,
                    implementation_steps=[
                        "Profile agent execution to identify bottlenecks",
                        "Optimize API calls and external service interactions",
                        "Implement caching for frequently accessed data",
                        "Review and optimize agent logic and decision-making",
                        "Monitor response time improvement"
                    ],
                    estimated_effort="high"
                )
                recommendations.append(recommendation)
            
            # 3. Efficiency score recommendations
            if snapshot.efficiency_score < self.performance_targets["efficiency_score"]:
                recommendation = OptimizationRecommendation(
                    recommendation_id=f"efficiency_{agent_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                    agent_id=agent_id,
                    user_id=self.user_id,
                    recommendation_type="efficiency_improvement",
                    priority="high" if snapshot.efficiency_score < self.alert_thresholds["efficiency_score"] else "medium",
                    description=f"Agent efficiency score is {snapshot.efficiency_score:.2f}, target is {self.performance_targets['efficiency_score']:.2f}",
                    expected_impact=self.performance_targets["efficiency_score"] - snapshot.efficiency_score,
                    implementation_steps=[
                        "Analyze agent decision-making patterns",
                        "Identify redundant or unnecessary operations",
                        "Optimize agent parameters and thresholds",
                        "Implement better error handling and recovery",
                        "Monitor efficiency score improvement"
                    ],
                    estimated_effort="medium"
                )
                recommendations.append(recommendation)
            
            # 4. Market impact recommendations
            if snapshot.market_impact_score < self.performance_targets["market_impact"]:
                recommendation = OptimizationRecommendation(
                    recommendation_id=f"market_impact_{agent_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                    agent_id=agent_id,
                    user_id=self.user_id,
                    recommendation_type="market_impact_enhancement",
                    priority="medium",
                    description=f"Agent market impact score is {snapshot.market_impact_score:.2f}, target is {self.performance_targets['market_impact']:.2f}",
                    expected_impact=self.performance_targets["market_impact"] - snapshot.market_impact_score,
                    implementation_steps=[
                        "Analyze market signal detection accuracy",
                        "Improve market trend analysis and prediction",
                        "Enhance competitive intelligence gathering",
                        "Optimize timing and execution of market actions",
                        "Monitor market impact score improvement"
                    ],
                    estimated_effort="high"
                )
                recommendations.append(recommendation)
            
            # 5. Trend-based recommendations
            for trend in trends:
                if trend.trend_strength > 0.7 and trend.confidence > 0.8:  # Strong trend with high confidence
                    if trend.trend_direction == "declining":
                        change_display = (
                            f"{trend.change_rate:.1f}% change per hour"
                            if trend.change_rate is not None
                            else "change rate unavailable from sparse data"
                        )
                        recommendation = OptimizationRecommendation(
                            recommendation_id=f"trend_{trend.metric_type.value}_{agent_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                            agent_id=agent_id,
                            user_id=self.user_id,
                            recommendation_type="trend_reversal",
                            priority="high" if trend.trend_strength > 0.8 else "medium",
                            description=f"Strong declining trend detected in {trend.metric_type.value}: {change_display}",
                            # Derive expected impact from the measured decline
                            # magnitude instead of an invented constant; omit
                            # entirely when change_rate carries no usable value.
                            expected_impact=min(1.0, abs(trend.change_rate) / 100.0) if trend.change_rate is not None else None,
                            implementation_steps=[
                                f"Investigate causes of declining {trend.metric_type.value}",
                                "Identify specific factors contributing to the trend",
                                "Implement corrective measures based on findings",
                                "Monitor trend reversal over time",
                                "Adjust approach if trend continues"
                            ],
                            estimated_effort="medium"
                        )
                        recommendations.append(recommendation)
            
            # Sort by priority and expected impact (None sorts last)
            recommendations.sort(
                key=lambda x: (self._priority_weight(x.priority), x.expected_impact is not None, x.expected_impact or 0.0),
                reverse=True
            )
            
            # Keep only top 10 recommendations
            recommendations = recommendations[:10]
            
            # Store recommendations
            self.recommendations.extend(recommendations)
            
            # Keep only recent recommendations (last 50)
            if len(self.recommendations) > 50:
                self.recommendations = self.recommendations[-50:]
            
            logger.info(f"Generated {len(recommendations)} optimization recommendations for agent {agent_id}")
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating optimization recommendations for agent {agent_id}: {e}")
            return []
    
    def _priority_weight(self, priority: str) -> int:
        """Convert priority to numeric weight for sorting"""
        priority_weights = {
            "high": 3,
            "medium": 2,
            "low": 1
        }
        return priority_weights.get(priority, 0)
    
    async def get_performance_alerts(self, agent_id: str) -> List[Dict[str, Any]]:
        """Get performance alerts for an agent"""
        alerts = []
        
        try:
            snapshot = self.agent_snapshots.get(agent_id)
            if not snapshot:
                return []
            
            # Check success rate alert
            if snapshot.success_rate < self.alert_thresholds["success_rate"]:
                alerts.append({
                    "type": "performance_alert",
                    "metric": "success_rate",
                    "current_value": snapshot.success_rate,
                    "threshold": self.alert_thresholds["success_rate"],
                    "target": self.performance_targets["success_rate"],
                    "severity": "high" if snapshot.success_rate < 0.5 else "medium",
                    "message": f"Agent success rate ({snapshot.success_rate:.1%}) is below alert threshold ({self.alert_thresholds['success_rate']:.1%})",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Check response time alert
            if snapshot.average_response_time > self.alert_thresholds["response_time"]:
                alerts.append({
                    "type": "performance_alert",
                    "metric": "response_time",
                    "current_value": snapshot.average_response_time,
                    "threshold": self.alert_thresholds["response_time"],
                    "target": self.performance_targets["response_time"],
                    "severity": "high" if snapshot.average_response_time > 120 else "medium",
                    "message": f"Agent response time ({snapshot.average_response_time:.1f}s) exceeds alert threshold ({self.alert_thresholds['response_time']:.1f}s)",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Check efficiency score alert
            if snapshot.efficiency_score < self.alert_thresholds["efficiency_score"]:
                alerts.append({
                    "type": "performance_alert",
                    "metric": "efficiency_score",
                    "current_value": snapshot.efficiency_score,
                    "threshold": self.alert_thresholds["efficiency_score"],
                    "target": self.performance_targets["efficiency_score"],
                    "severity": "high" if snapshot.efficiency_score < 0.3 else "medium",
                    "message": f"Agent efficiency score ({snapshot.efficiency_score:.2f}) is below alert threshold ({self.alert_thresholds['efficiency_score']:.2f})",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Check market impact alert
            if snapshot.market_impact_score < self.alert_thresholds["market_impact"]:
                alerts.append({
                    "type": "performance_alert",
                    "metric": "market_impact",
                    "current_value": snapshot.market_impact_score,
                    "threshold": self.alert_thresholds["market_impact"],
                    "target": self.performance_targets["market_impact"],
                    "severity": "medium",
                    "message": f"Agent market impact score ({snapshot.market_impact_score:.2f}) is below alert threshold ({self.alert_thresholds['market_impact']:.2f})",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            return alerts
            
        except Exception as e:
            logger.error(f"Error getting performance alerts for agent {agent_id}: {e}")
            return []
    
    async def get_performance_summary(self, agent_id: str) -> Dict[str, Any]:
        """Get comprehensive performance summary for an agent.

        Survives restarts: when no in-memory snapshot exists yet, one is
        rebuilt from durable ``agent_runs`` aggregates rather than reporting
        an empty history for a known-active agent.
        """
        try:
            snapshot = self.agent_snapshots.get(agent_id)
            if not snapshot:
                durable = await self._durable_stats(agent_id)
                if durable.total_runs > 0:
                    snapshot = self._snapshot_from_durable(agent_id, AgentStatus.IDLE, durable)
                    self.agent_snapshots[agent_id] = snapshot
                else:
                    return {}
            
            # Get trends
            trends = await self.analyze_performance_trends(agent_id)
            
            # Get recommendations
            recommendations = await self.generate_optimization_recommendations(agent_id)
            
            # Get alerts
            alerts = await self.get_performance_alerts(agent_id)
            
            # Calculate overall health score
            health_score = self._calculate_health_score(snapshot)
            
            return {
                "agent_id": agent_id,
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat(),
                "overall_health": health_score,
                "current_performance": asdict(snapshot),
                "performance_trends": [asdict(trend) for trend in trends],
                "optimization_recommendations": [asdict(rec) for rec in recommendations],
                "performance_alerts": alerts,
                "performance_targets": self.performance_targets,
                "alert_thresholds": self.alert_thresholds
            }
            
        except Exception as e:
            logger.error(f"Error getting performance summary for agent {agent_id}: {e}")
            return {}
    
    def _calculate_health_score(self, snapshot: AgentPerformanceSnapshot) -> float:
        """Calculate overall health score based on key metrics"""
        try:
            # Weighted scoring based on key metrics
            weights = {
                "success_rate": 0.3,
                "response_time": 0.25,
                "efficiency_score": 0.25,
                "market_impact": 0.2
            }
            
            scores = {
                "success_rate": min(1.0, snapshot.success_rate / self.performance_targets["success_rate"]),
                "response_time": max(0.0, 1.0 - (snapshot.average_response_time / self.performance_targets["response_time"])),
                "efficiency_score": min(1.0, snapshot.efficiency_score / self.performance_targets["efficiency_score"]),
                "market_impact": min(1.0, snapshot.market_impact_score / self.performance_targets["market_impact"])
            }
            
            # Calculate weighted health score
            health_score = sum(scores[metric] * weights[metric] for metric in weights.keys())
            
            return round(health_score, 2)
            
        except Exception as e:
            logger.error(f"Error calculating health score: {e}")
            return 0.0
    
    async def get_all_agents_performance(self) -> List[Dict[str, Any]]:
        """Get performance summary for all agents.

        Merges in-memory snapshots with durable ``agent_runs`` aggregates so
        agents with persisted history still appear after a restart. Metrics
        that runs cannot derive stay at honest zeros for durable-only agents.
        """
        from services.intelligence.agents.agent_run_metrics import get_all_agent_run_stats

        all_performance = []

        try:
            durable_by_agent = await get_all_agent_run_stats(self.user_id, window_hours=720)
        except Exception as exc:
            logger.error(f"Durable stats unavailable for user {self.user_id}: {exc}")
            durable_by_agent = {}

        seen_agents = set(self.agent_snapshots.keys()) | set(durable_by_agent.keys())

        for agent_id in sorted(seen_agents):
            snapshot = self.agent_snapshots.get(agent_id)
            if snapshot is None:
                durable = durable_by_agent[agent_id]
                if durable.total_runs <= 0:
                    continue
                snapshot = self._snapshot_from_durable(agent_id, AgentStatus.IDLE, durable)
            performance_summary = {
                "agent_id": agent_id,
                "user_id": self.user_id,
                "status": snapshot.status.value,
                "success_rate": snapshot.success_rate,
                "efficiency_score": snapshot.efficiency_score,
                "response_time": snapshot.average_response_time,
                "market_impact": snapshot.market_impact_score,
                "total_actions": snapshot.total_actions,
                "last_action": snapshot.last_action_at,
                "health_score": self._calculate_health_score(snapshot)
            }
            all_performance.append(performance_summary)

        return all_performance

# Service class for performance monitoring
class AgentPerformanceService:
    """Service class for agent performance monitoring operations"""
    
    def __init__(self):
        self.monitors: Dict[str, AgentPerformanceMonitor] = {}
        self.global_performance_history: deque = deque(maxlen=5000)  # Global history
    
    async def get_monitor(self, user_id: str) -> AgentPerformanceMonitor:
        """Get or create a performance monitor for a user"""
        if user_id not in self.monitors:
            self.monitors[user_id] = AgentPerformanceMonitor(user_id)
        return self.monitors[user_id]
    
    async def record_agent_performance(self, user_id: str, agent_id: str, metric_type: PerformanceMetric, value: float, context: Dict[str, Any] = None) -> bool:
        """Record performance data for an agent"""
        monitor = await self.get_monitor(user_id)
        success = await monitor.record_performance_data(agent_id, metric_type, value, context)
        
        if success:
            # Also record in global history
            data_point = PerformanceDataPoint(
                timestamp=datetime.utcnow().isoformat(),
                metric_type=metric_type,
                value=value,
                context=context or {},
                agent_id=agent_id,
                user_id=user_id
            )
            self.global_performance_history.append(data_point)
        
        return success
    
    async def update_agent_performance_snapshot(self, user_id: str, agent_id: str, status: AgentStatus, action_result: Dict[str, Any] = None) -> AgentPerformanceSnapshot:
        """Update performance snapshot for an agent"""
        monitor = await self.get_monitor(user_id)
        return await monitor.update_agent_snapshot(agent_id, status, action_result)
    
    async def get_agent_performance_summary(self, user_id: str, agent_id: str) -> Dict[str, Any]:
        """Get comprehensive performance summary for an agent"""
        monitor = await self.get_monitor(user_id)
        return await monitor.get_performance_summary(agent_id)
    
    async def get_all_agents_performance_summary(self, user_id: str) -> List[Dict[str, Any]]:
        """Get performance summary for all agents for a user"""
        monitor = await self.get_monitor(user_id)
        return await monitor.get_all_agents_performance()
    
    async def get_global_performance_stats(self) -> Dict[str, Any]:
        """Get global performance statistics across all users and agents"""
        if not self.global_performance_history:
            return {}
        
        # Calculate global statistics
        total_actions = len([dp for dp in self.global_performance_history if dp.metric_type == PerformanceMetric.SUCCESS_RATE])
        successful_actions = len([dp for dp in self.global_performance_history if dp.metric_type == PerformanceMetric.SUCCESS_RATE and dp.value > 0.5])
        
        response_times = [dp.value for dp in self.global_performance_history if dp.metric_type == PerformanceMetric.RESPONSE_TIME]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0.0
        
        efficiency_scores = [dp.value for dp in self.global_performance_history if dp.metric_type == PerformanceMetric.EFFICIENCY_SCORE]
        avg_efficiency = sum(efficiency_scores) / len(efficiency_scores) if efficiency_scores else 0.0
        
        unique_users = len(set(dp.user_id for dp in self.global_performance_history))
        unique_agents = len(set(dp.agent_id for dp in self.global_performance_history))
        
        return {
            "total_actions": total_actions,
            "successful_actions": successful_actions,
            "overall_success_rate": successful_actions / total_actions if total_actions > 0 else 0.0,
            "average_response_time": avg_response_time,
            "average_efficiency_score": avg_efficiency,
            "unique_users": unique_users,
            "unique_agents": unique_agents,
            "total_data_points": len(self.global_performance_history),
            "timestamp": datetime.utcnow().isoformat()
        }

# Global service instance
performance_service = AgentPerformanceService()

# Convenience functions for external use
async def record_agent_performance(user_id: str, agent_id: str, metric_type: PerformanceMetric, value: float, context: Dict[str, Any] = None) -> bool:
    """Record performance data for an agent"""
    return await performance_service.record_agent_performance(user_id, agent_id, metric_type, value, context)

async def update_agent_performance_snapshot(user_id: str, agent_id: str, status: AgentStatus, action_result: Dict[str, Any] = None) -> AgentPerformanceSnapshot:
    """Update performance snapshot for an agent"""
    return await performance_service.update_agent_performance_snapshot(user_id, agent_id, status, action_result)

async def get_agent_performance_summary(user_id: str, agent_id: str) -> Dict[str, Any]:
    """Get comprehensive performance summary for an agent"""
    return await performance_service.get_agent_performance_summary(user_id, agent_id)

async def get_all_agents_performance_summary(user_id: str) -> List[Dict[str, Any]]:       
    """Get performance summary for all agents for a user"""
    return await performance_service.get_all_agents_performance_summary(user_id)

# Alias for backward compatibility
PerformanceMonitor = AgentPerformanceMonitor
performance_monitor = performance_service
AgentPerformanceMetrics = AgentPerformanceSnapshot
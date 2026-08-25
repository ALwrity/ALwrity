"""
Market Signal Detection System for ALwrity Autonomous Agents
Built on txtai's semantic intelligence and existing monitoring infrastructure
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, asdict
from enum import Enum

import math

# Integration with existing ALwrity services
from services.intelligence.monitoring.semantic_dashboard import RealTimeSemanticMonitor
from services.intelligence.semantic_cache import SemanticCacheManager
from services.seo_analyzer import ComprehensiveSEOAnalyzer
from utils.logger_utils import get_service_logger

logger = get_service_logger(__name__)

# Confidence model constants: every emitted signal must carry a confidence
# derived from measurable inputs (sample size, evidence strength relative to
# its detection threshold, and source-data freshness). When a factor cannot
# be measured, the confidence is labeled as an estimate instead of pretending
# it was observed.
_FRESHNESS_FULLY_FRESH_HOURS = 24.0
_FRESHNESS_STALE_HOURS = 168.0  # older than this -> do not emit a signal
_FRESHNESS_DECAY_HALF_LIFE_HOURS = 48.0
_SAMPLE_SUFFICIENCY_BASE = 0.4
_SAMPLE_SUFFICIENCY_STEP = 0.2  # reaches 1.0 at sample_count >= 4
_MAGNITUDE_SATURATION_RATIO = 2.0  # change >= 2x threshold -> full strength
_ESTIMATE_NEUTRAL_FACTOR = 0.5


def compute_signal_confidence(
    *,
    sample_count: int,
    change_ratio: float,
    data_age_hours: Optional[float] = None,
) -> tuple:
    """Derive a signal confidence score from measurable factors.

    Factors:
      * freshness   -- age of the source data the signal was computed from.
      * sufficiency -- how many underlying observations back the metric.
      * magnitude   -- how far the observed change exceeds its threshold.

    Returns ``(confidence, basis, is_estimate)``. ``is_estimate`` is True when
    any factor could not be measured (e.g. missing timestamp) and a neutral
    value was substituted. Callers must not emit a signal when inputs are so
    weak that this helper signals insufficiency via ``None`` confidence.
    """
    try:
        samples = max(int(sample_count or 0), 0)
    except (TypeError, ValueError):
        samples = 0
    if samples <= 0:
        return None, "insufficient:no-underlying-samples", True

    is_estimate = False

    # Freshness: exponential decay past the fresh window; unknown age is an
    # estimate, not a free pass to full confidence.
    if data_age_hours is None:
        freshness = _ESTIMATE_NEUTRAL_FACTOR
        is_estimate = True
    else:
        age = max(float(data_age_hours), 0.0)
        if age >= _FRESHNESS_STALE_HOURS:
            return None, f"stale:source-data-age-hours={age:.0f}", True
        if age <= _FRESHNESS_FULLY_FRESH_HOURS:
            freshness = 1.0
        else:
            excess = age - _FRESHNESS_FULLY_FRESH_HOURS
            freshness = max(
                0.2,
                math.pow(0.5, excess / _FRESHNESS_DECAY_HALF_LIFE_HOURS),
            )

    # Sample sufficiency: ramps 0.4 -> 1.0 across first four observations.
    sufficiency = min(
        1.0,
        _SAMPLE_SUFFICIENCY_BASE + _SAMPLE_SUFFICIENCY_STEP * (samples - 1),
    )

    # Magnitude: linear ramp that saturates once the change is twice the
    # detection threshold.
    try:
        ratio = max(float(change_ratio or 0.0), 0.0)
    except (TypeError, ValueError):
        ratio = 0.0
    magnitude = min(1.0, ratio / _MAGNITUDE_SATURATION_RATIO)

    confidence = round(
        0.35 * freshness + 0.25 * sufficiency + 0.40 * magnitude, 3
    )
    basis = (
        f"derived:freshness={freshness:.2f};"
        f"samples={samples};magnitude={ratio:.2f}x-threshold"
    )
    if is_estimate:
        basis += ";estimate:source-age-unknown"
    return confidence, basis, is_estimate

class SignalType(Enum):
    """Types of market signals that agents can detect"""
    COMPETITOR_CHANGE = "competitor"
    SERP_FLUCTUATION = "serp"
    SOCIAL_TREND = "social"
    INDUSTRY_NEWS = "industry"
    PERFORMANCE_CHANGE = "performance"
    CONTENT_GAP = "content_gap"
    SEO_OPPORTUNITY = "seo_opportunity"

class UrgencyLevel(Enum):
    """Urgency levels for market signals"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class MarketSignal:
    """Represents a detected market signal"""
    signal_id: str
    signal_type: SignalType
    source: str
    description: str
    impact_score: float  # 0.0 to 1.0
    urgency_level: UrgencyLevel
    confidence_score: float  # 0.0 to 1.0
    related_topics: List[str]
    suggested_actions: List[str]
    metadata: Dict[str, Any]
    detected_at: str = None
    expires_at: str = None
    
    def __post_init__(self):
        if self.detected_at is None:
            self.detected_at = datetime.utcnow().isoformat()
        if self.expires_at is None:
            # Default expiration based on urgency
            if self.urgency_level == UrgencyLevel.CRITICAL:
                expires_hours = 1
            elif self.urgency_level == UrgencyLevel.HIGH:
                expires_hours = 6
            elif self.urgency_level == UrgencyLevel.MEDIUM:
                expires_hours = 24
            else:
                expires_hours = 72
            
            expires = datetime.utcnow().timestamp() + (expires_hours * 60 * 60)
            self.expires_at = datetime.fromtimestamp(expires).isoformat()

@dataclass
class SignalContext:
    """Context for signal detection"""
    user_id: str
    competitor_data: Dict[str, Any]
    semantic_health: Dict[str, Any]
    seo_performance: Dict[str, Any]
    content_analysis: Dict[str, Any]
    historical_data: Dict[str, Any]
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

class MarketSignalDetector:
    """Main market signal detection system"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.semantic_monitor = RealTimeSemanticMonitor(user_id)
        self.cache_manager = SemanticCacheManager()
        self.seo_analyzer = ComprehensiveSEOAnalyzer()
        
        # Signal detection thresholds
        self.thresholds = {
            "competitor_change_threshold": 0.3,  # 30% change in competitor metrics
            "serp_fluctuation_threshold": 0.2,    # 20% change in SERP positions
            "social_trend_threshold": 0.15,       # 15% change in social metrics
            "performance_change_threshold": 0.25, # 25% change in performance metrics
            "content_gap_threshold": 0.4,         # 40% semantic gap
            "seo_opportunity_threshold": 0.3    # 30% SEO improvement opportunity
        }
        
        # Historical data for trend analysis
        self.signal_history: List[MarketSignal] = []
        self.baseline_metrics: Dict[str, float] = {}
        
        logger.info(f"Initialized MarketSignalDetector for user: {user_id}")
    
    async def detect_market_signals(self) -> List[MarketSignal]:
        """Detect all current market signals"""
        try:
            logger.info(f"Starting market signal detection for user: {self.user_id}")
            
            # Get current context
            context = await self._get_signal_context()
            
            # Check cache first
            cache_key = f"market_signals_{self.user_id}"
            cached_signals = self.cache_manager.get(cache_key)
            
            if cached_signals and self._is_cache_valid(cached_signals):
                logger.info(f"Using cached market signals for user: {self.user_id}")
                return cached_signals
            
            # Detect signals from multiple sources
            signals = []
            
            # Competitor signals
            competitor_signals = await self._detect_competitor_signals(context)
            signals.extend(competitor_signals)
            
            # SERP signals
            serp_signals = await self._detect_serp_signals(context)
            signals.extend(serp_signals)
            
            # Social signals
            social_signals = await self._detect_social_signals(context)
            signals.extend(social_signals)
            
            # Industry signals
            industry_signals = await self._detect_industry_signals(context)
            signals.extend(industry_signals)
            
            # Performance signals
            performance_signals = await self._detect_performance_signals(context)
            signals.extend(performance_signals)
            
            # Content gap signals
            content_signals = await self._detect_content_gap_signals(context)
            signals.extend(content_signals)
            
            # SEO opportunity signals
            seo_signals = await self._detect_seo_opportunity_signals(context)
            signals.extend(seo_signals)
            
            # Filter and prioritize signals
            filtered_signals = self._filter_signals(signals)
            prioritized_signals = self._prioritize_signals(filtered_signals)
            
            # Update history
            self.signal_history.extend(prioritized_signals)
            self._trim_signal_history()
            
            # Cache results
            self.cache_manager.set(cache_key, prioritized_signals, ttl=300)  # 5 minute cache
            
            logger.info(f"Detected {len(prioritized_signals)} market signals for user: {self.user_id}")
            
            return prioritized_signals
            
        except Exception as e:
            logger.error(f"Error detecting market signals for user {self.user_id}: {e}")
            return []
    
    async def _get_signal_context(self) -> SignalContext:
        """Get comprehensive context for signal detection"""
        try:
            # Get semantic health
            semantic_health = await self.semantic_monitor.check_semantic_health(self.user_id)
            
            # Get competitor data
            competitor_data = await self._get_competitor_data()
            
            # Get SEO performance
            seo_performance = await self._get_seo_performance()
            
            # Get content analysis
            content_analysis = await self._get_content_analysis()
            
            # Get historical data
            historical_data = await self._get_historical_data()
            
            return SignalContext(
                user_id=self.user_id,
                competitor_data=competitor_data,
                semantic_health=semantic_health,
                seo_performance=seo_performance,
                content_analysis=content_analysis,
                historical_data=historical_data
            )
            
        except Exception as e:
            logger.error(f"Error getting signal context for user {self.user_id}: {e}")
            # Return minimal context
            return SignalContext(
                user_id=self.user_id,
                competitor_data={},
                semantic_health={},
                seo_performance={},
                content_analysis={},
                historical_data={}
            )
    
    async def _detect_competitor_signals(self, context: SignalContext) -> List[MarketSignal]:
        """Detect competitor-related market signals"""
        signals = []
        
        try:
            competitor_data = context.competitor_data.get('competitors', [])
            
            for competitor in competitor_data:
                competitor_id = competitor.get('id')
                competitor_name = competitor.get('name', 'Unknown Competitor')
                
                # Check for significant changes in competitor metrics
                current_metrics = {
                    'content_volume': competitor.get('content_volume', 0),
                    'semantic_overlap': competitor.get('semantic_overlap', 0),
                    'authority_score': competitor.get('authority_score', 0),
                    'trending_topics': len(competitor.get('trending_topics', []))
                }
                
                # Compare with baseline metrics
                baseline_key = f"competitor_{competitor_id}"
                baseline = self.baseline_metrics.get(baseline_key, current_metrics)
                
                # Detect significant changes
                for metric, current_value in current_metrics.items():
                    baseline_value = baseline.get(metric, current_value)
                    try:
                        baseline_numeric = float(baseline_value)
                        current_numeric = float(current_value)
                    except (TypeError, ValueError):
                        continue
                    if baseline_numeric <= 0:
                        continue
                    change_percentage = abs(current_numeric - baseline_numeric) / max(baseline_numeric, 1)

                    if change_percentage > self.thresholds['competitor_change_threshold']:
                        content_volume = int(competitor.get('content_volume') or 0)
                        data_age_hours = self._age_hours(competitor.get('last_updated'))
                        confidence_score, confidence_basis, is_estimate = compute_signal_confidence(
                            sample_count=max(1, min(content_volume, 50)) if content_volume > 0 else 0,
                            change_ratio=change_percentage / self.thresholds['competitor_change_threshold'],
                            data_age_hours=data_age_hours,
                        )
                        if confidence_score is None:
                            logger.info(
                                f"Skipping competitor signal for {competitor_name}/{metric}: {confidence_basis}"
                            )
                            continue
                        signal = MarketSignal(
                            signal_id=f"competitor_{competitor_id}_{metric}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                            signal_type=SignalType.COMPETITOR_CHANGE,
                            source=competitor_name,
                            description=f"Competitor {competitor_name} shows significant change in {metric}: {change_percentage:.1%}",
                            impact_score=min(0.9, change_percentage * 2),  # Cap at 0.9
                            urgency_level=self._determine_urgency(change_percentage),
                            confidence_score=confidence_score,
                            related_topics=competitor.get('trending_topics', [])[:3],
                            suggested_actions=self._get_competitor_response_actions(metric, change_percentage),
                            metadata={
                                'competitor_id': competitor_id,
                                'metric': metric,
                                'old_value': baseline_value,
                                'new_value': current_value,
                                'change_percentage': change_percentage,
                                'confidence_basis': confidence_basis,
                                'confidence_is_estimate': is_estimate,
                            }
                        )
                        signals.append(signal)
                
                # Update baseline
                self.baseline_metrics[baseline_key] = current_metrics
            
        except Exception as e:
            logger.error(f"Error detecting competitor signals: {e}")
        
        return signals
    
    async def _detect_serp_signals(self, context: SignalContext) -> List[MarketSignal]:
        """Detect SERP-related market signals"""
        signals = []
        
        try:
            seo_performance = context.seo_performance
            
            # Check for significant SERP position changes
            serp_changes = seo_performance.get('serp_changes', [])
            
            for change in serp_changes:
                keyword = change.get('keyword')
                old_position = change.get('old_position', 100)
                new_position = change.get('new_position', 100)
                
                # Calculate position change
                position_change = old_position - new_position  # Positive = improvement
                change_percentage = abs(position_change) / max(old_position, 1)
                
                if change_percentage > self.thresholds['serp_fluctuation_threshold']:
                    comparable = int(context.seo_performance.get('comparable_queries') or 0)
                    confidence_score, confidence_basis, is_estimate = compute_signal_confidence(
                        sample_count=comparable,
                        change_ratio=change_percentage / self.thresholds['serp_fluctuation_threshold'],
                        data_age_hours=0.0,  # computed live from the current GSC window
                    )
                    if confidence_score is None:
                        logger.info(f"Skipping SERP signal for '{keyword}': {confidence_basis}")
                        continue
                    if position_change > 0:  # Improvement
                        description = f"Significant SERP improvement for '{keyword}': moved from {old_position} to {new_position}"
                        impact_score = min(0.8, change_percentage * 1.5)
                        urgency_level = UrgencyLevel.LOW
                        suggested_actions = ["Monitor trend", "Capitalize on improvement"]
                    else:  # Decline
                        description = f"Significant SERP decline for '{keyword}': dropped from {old_position} to {new_position}"
                        impact_score = min(0.9, change_percentage * 2)
                        urgency_level = UrgencyLevel.HIGH
                        suggested_actions = ["Investigate cause", "Optimize content", "Check technical SEO"]

                    signal = MarketSignal(
                        signal_id=f"serp_{keyword.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                        signal_type=SignalType.SERP_FLUCTUATION,
                        source="SERP Analysis",
                        description=description,
                        impact_score=impact_score,
                        urgency_level=urgency_level,
                        confidence_score=confidence_score,
                        related_topics=[keyword],
                        suggested_actions=suggested_actions,
                        metadata={
                            'keyword': keyword,
                            'old_position': old_position,
                            'new_position': new_position,
                            'position_change': position_change,
                            'change_percentage': change_percentage,
                            'confidence_basis': confidence_basis,
                            'confidence_is_estimate': is_estimate,
                            'comparable_queries': comparable,
                        }
                    )
                    signals.append(signal)
            
        except Exception as e:
            logger.error(f"Error detecting SERP signals: {e}")
        
        return signals
    
    async def _detect_social_signals(self, context: SignalContext) -> List[MarketSignal]:
        """Detect social media trend signals"""
        signals = []
        
        try:
            # Get social media data
            social_data = context.historical_data.get('social_metrics', {})
            
            # Check for trending topics
            trending_topics = social_data.get('trending_topics', [])
            
            for topic in trending_topics:
                topic_name = topic.get('topic')
                engagement_rate = topic.get('engagement_rate')
                trend_score = topic.get('trend_score', 0)
                sample_points = int(topic.get('sample_points') or 0)

                if trend_score > self.thresholds['social_trend_threshold']:
                    interest_level = topic.get('interest_level')
                    confidence_score, confidence_basis, is_estimate = compute_signal_confidence(
                        sample_count=sample_points,
                        change_ratio=trend_score / self.thresholds['social_trend_threshold'],
                        data_age_hours=0.0,  # trends pulled live for this detection run
                    )
                    if confidence_score is None:
                        logger.info(f"Skipping social trend signal for '{topic_name}': {confidence_basis}")
                        continue
                    if engagement_rate is not None:
                        trend_detail = f"engagement rate {engagement_rate:.2%}"
                    elif interest_level is not None:
                        trend_detail = f"interest level {interest_level:.0%} of peak search volume"
                    else:
                        trend_detail = f"momentum score {trend_score:.2f}"
                    signal = MarketSignal(
                        signal_id=f"social_{str(topic_name).replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                        signal_type=SignalType.SOCIAL_TREND,
                        source="Social Media Analysis",
                        description=f"Social trend detected: '{topic_name}' with {trend_detail}",
                        impact_score=min(0.8, trend_score * 1.5),
                        urgency_level=self._determine_urgency(trend_score),
                        confidence_score=confidence_score,
                        related_topics=[topic_name],
                        suggested_actions=["Create content on trending topic", "Monitor trend development", "Engage with trend"],
                        metadata={
                            'topic': topic_name,
                            'engagement_rate': engagement_rate,
                            'trend_score': trend_score,
                            'platforms': topic.get('platforms', []),
                            'sample_points': sample_points,
                            'confidence_basis': confidence_basis,
                            'confidence_is_estimate': is_estimate,
                        }
                    )
                    signals.append(signal)
            
        except Exception as e:
            logger.error(f"Error detecting social signals: {e}")
        
        return signals
    
    async def _detect_industry_signals(self, context: SignalContext) -> List[MarketSignal]:
        """Detect industry news and trend signals"""
        signals = []
        
        try:
            # Get industry data
            industry_data = context.historical_data.get('industry_news', {})
            
            # Check for significant industry developments
            news_items = industry_data.get('recent_news', [])
            
            for news in news_items:
                news_title = news.get('title', 'Industry News')
                relevance_score = news.get('relevance_score', 0)
                impact_assessment = news.get('impact_assessment', 'medium')
                
                if relevance_score > 0.6:  # High relevance to user's industry
                    confidence_score, confidence_basis, is_estimate = compute_signal_confidence(
                        sample_count=1,  # a single published news item
                        change_ratio=relevance_score / 0.6,
                        data_age_hours=self._age_hours(news.get('date')),
                    )
                    if confidence_score is None:
                        logger.info(f"Skipping industry signal for '{news_title}': {confidence_basis}")
                        continue
                    signal = MarketSignal(
                        signal_id=f"industry_{hash(news_title) % 10000}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                        signal_type=SignalType.INDUSTRY_NEWS,
                        source="Industry News Analysis",
                        description=f"Industry development: {news_title}",
                        impact_score=min(0.9, relevance_score * 1.2),
                        urgency_level=self._map_impact_to_urgency(impact_assessment),
                        confidence_score=confidence_score,
                        related_topics=news.get('related_topics', []),
                        suggested_actions=["Analyze industry impact", "Adjust strategy if needed", "Monitor competitor response"],
                        metadata={
                            'news_title': news_title,
                            'relevance_score': relevance_score,
                            'impact_assessment': impact_assessment,
                            'news_date': news.get('date'),
                            'source': news.get('source'),
                            'confidence_basis': confidence_basis,
                            'confidence_is_estimate': is_estimate,
                        }
                    )
                    signals.append(signal)
            
        except Exception as e:
            logger.error(f"Error detecting industry signals: {e}")
        
        return signals
    
    async def _detect_performance_signals(self, context: SignalContext) -> List[MarketSignal]:
        """Detect performance change signals"""
        signals = []
        
        try:
            # Get performance data
            performance_data = context.historical_data.get('performance_metrics', {})
            
            # Check for significant changes in key metrics
            current_metrics = {
                'traffic': performance_data.get('current_clicks', 0),
                'engagement': performance_data.get('current_impressions', 0),
                'ctr': performance_data.get('current_ctr', 0)
            }

            # Compare with historical baseline (real GSC period totals)
            baseline_metrics = {
                'traffic': performance_data.get('baseline_clicks'),
                'engagement': performance_data.get('baseline_impressions'),
                'ctr': performance_data.get('baseline_ctr'),
            }
            daily_samples = int(performance_data.get('window_days') or 0)
            window_end_date = context.historical_data.get('window_end_date')

            for metric, current_value in current_metrics.items():
                baseline_value = baseline_metrics.get(metric)
                try:
                    current_numeric = float(current_value)
                    baseline_numeric = float(baseline_value) if baseline_value is not None else 0.0
                except (TypeError, ValueError):
                    continue

                if baseline_numeric > 0:  # Avoid division by zero
                    change_percentage = abs(current_numeric - baseline_numeric) / baseline_numeric

                    if change_percentage > self.thresholds['performance_change_threshold']:
                        window_age_hours = self._age_hours(f"{window_end_date}T23:59:59") if window_end_date else None
                        confidence_score, confidence_basis, is_estimate = compute_signal_confidence(
                            sample_count=daily_samples,
                            change_ratio=change_percentage / self.thresholds['performance_change_threshold'],
                            data_age_hours=window_age_hours,
                        )
                        if confidence_score is None:
                            logger.info(f"Skipping performance signal for {metric}: {confidence_basis}")
                            continue
                        if current_numeric > baseline_numeric:  # Improvement
                            description = f"Performance improvement detected: {metric} increased by {change_percentage:.1%}"
                            impact_score = min(0.7, change_percentage * 1.5)
                            urgency_level = UrgencyLevel.LOW
                            suggested_actions = ["Monitor trend", "Analyze success factors", "Scale successful strategies"]
                        else:  # Decline
                            description = f"Performance decline detected: {metric} decreased by {change_percentage:.1%}"
                            impact_score = min(0.9, change_percentage * 2)
                            urgency_level = UrgencyLevel.HIGH
                            suggested_actions = ["Investigate cause", "Implement corrective measures", "Monitor recovery"]
                        
                        signal = MarketSignal(
                            signal_id=f"performance_{metric}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                            signal_type=SignalType.PERFORMANCE_CHANGE,
                            source="Performance Analytics",
                            description=description,
                            impact_score=impact_score,
                            urgency_level=urgency_level,
                            confidence_score=confidence_score,
                            related_topics=[metric],
                            suggested_actions=suggested_actions,
                            metadata={
                                'metric': metric,
                                'old_value': baseline_value,
                                'new_value': current_value,
                                'change_percentage': change_percentage,
                                'trend_direction': 'up' if current_numeric > baseline_numeric else 'down',
                                'window_days': daily_samples,
                                'confidence_basis': confidence_basis,
                                'confidence_is_estimate': is_estimate,
                            }
                        )
                        signals.append(signal)
            
        except Exception as e:
            logger.error(f"Error detecting performance signals: {e}")
        
        return signals
    
    async def _detect_content_gap_signals(self, context: SignalContext) -> List[MarketSignal]:
        """Detect content gap signals"""
        signals = []
        
        try:
            semantic_health = context.semantic_health

            # check_semantic_health returns a dataclass (or dict); normalize so
            # gap extraction never crashes on the wrong container type.
            if hasattr(semantic_health, 'get'):
                health_data = semantic_health
            else:
                try:
                    health_data = vars(semantic_health)
                except TypeError:
                    health_data = {}

            # No pipeline currently populates semantic gaps into this context,
            # so in practice health_data carries no 'semantic_gaps' key and
            # this detector stays honestly empty until that integration lands.
            semantic_gaps = health_data.get('semantic_gaps') or []
            
            for gap in semantic_gaps:
                if not isinstance(gap, dict):
                    continue
                gap_topic = gap.get('topic')
                gap_score = gap.get('gap_score', 0) or gap.get('severity_score', 0)
                competitor_coverage = gap.get('competitor_coverage', 0)
                evidence = gap.get('evidence') or []
                
                if gap_score > self.thresholds['content_gap_threshold']:
                    confidence_score, confidence_basis, is_estimate = compute_signal_confidence(
                        sample_count=len(evidence),
                        change_ratio=gap_score / self.thresholds['content_gap_threshold'],
                        data_age_hours=None,  # gap snapshots carry no timestamp yet
                    )
                    if confidence_score is None:
                        logger.info(f"Skipping content-gap signal for '{gap_topic}': {confidence_basis}")
                        continue
                    signal = MarketSignal(
                        signal_id=f"content_gap_{str(gap_topic).replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                        signal_type=SignalType.CONTENT_GAP,
                        source="Semantic Analysis",
                        description=f"Content gap identified: '{gap_topic}' with gap score {gap_score:.2f}",
                        impact_score=min(0.8, gap_score * 1.5),
                        urgency_level=self._determine_urgency(gap_score),
                        confidence_score=confidence_score,
                        related_topics=[gap_topic],
                        suggested_actions=["Create content on gap topic", "Analyze competitor approach", "Optimize existing content"],
                        metadata={
                            'gap_topic': gap_topic,
                            'gap_score': gap_score,
                            'competitor_coverage': competitor_coverage,
                            'semantic_similarity': gap.get('semantic_similarity', 0),
                            'confidence_basis': confidence_basis,
                            'confidence_is_estimate': is_estimate,
                        }
                    )
                    signals.append(signal)
            
        except Exception as e:
            logger.error(f"Error detecting content gap signals: {e}")
        
        return signals
    
    async def _detect_seo_opportunity_signals(self, context: SignalContext) -> List[MarketSignal]:
        """Detect SEO opportunity signals"""
        signals = []
        
        try:
            seo_performance = context.seo_performance
            
            # Check for SEO opportunities
            seo_opportunities = seo_performance.get('opportunities', [])
            
            for opportunity in seo_opportunities:
                if not isinstance(opportunity, dict):
                    continue
                opportunity_type = opportunity.get('type')
                opportunity_score = opportunity.get('opportunity_score', 0)
                estimated_impact = opportunity.get('estimated_impact', 'medium')
                related_keywords = opportunity.get('related_keywords', []) or []
                
                if opportunity_score > self.thresholds['seo_opportunity_threshold']:
                    confidence_score, confidence_basis, is_estimate = compute_signal_confidence(
                        sample_count=len(related_keywords),
                        change_ratio=opportunity_score / self.thresholds['seo_opportunity_threshold'],
                        data_age_hours=None,  # opportunity entries carry no timestamp yet
                    )
                    if confidence_score is None:
                        logger.info(f"Skipping SEO opportunity signal for {opportunity_type}: {confidence_basis}")
                        continue
                    signal = MarketSignal(
                        signal_id=f"seo_opportunity_{opportunity_type}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                        signal_type=SignalType.SEO_OPPORTUNITY,
                        source="SEO Analysis",
                        description=f"SEO opportunity identified: {opportunity_type} with score {opportunity_score:.2f}",
                        impact_score=min(0.8, opportunity_score * 1.5),
                        urgency_level=self._map_impact_to_urgency(estimated_impact),
                        confidence_score=confidence_score,
                        related_topics=related_keywords,
                        suggested_actions=["Implement SEO recommendation", "Monitor impact", "Scale successful optimizations"],
                        metadata={
                            'opportunity_type': opportunity_type,
                            'opportunity_score': opportunity_score,
                            'estimated_impact': estimated_impact,
                            'implementation_effort': opportunity.get('implementation_effort', 'medium'),
                            'priority_score': opportunity.get('priority_score', 0),
                            'confidence_basis': confidence_basis,
                            'confidence_is_estimate': is_estimate,
                        }
                    )
                    signals.append(signal)
            
        except Exception as e:
            logger.error(f"Error detecting SEO opportunity signals: {e}")
        
        return signals
    
    # Helper methods
    
    def _determine_urgency(self, score: float) -> UrgencyLevel:
        """Determine urgency level based on score"""
        if score >= 0.8:
            return UrgencyLevel.CRITICAL
        elif score >= 0.6:
            return UrgencyLevel.HIGH
        elif score >= 0.3:
            return UrgencyLevel.MEDIUM
        else:
            return UrgencyLevel.LOW
    
    def _map_impact_to_urgency(self, impact: str) -> UrgencyLevel:
        """Map impact assessment to urgency level"""
        impact_map = {
            'critical': UrgencyLevel.CRITICAL,
            'high': UrgencyLevel.HIGH,
            'medium': UrgencyLevel.MEDIUM,
            'low': UrgencyLevel.LOW
        }
        return impact_map.get(impact.lower(), UrgencyLevel.MEDIUM)
    
    def _get_competitor_response_actions(self, metric: str, change_percentage: float) -> List[str]:
        """Get suggested actions for competitor changes"""
        actions = []
        
        if metric == 'content_volume':
            if change_percentage > 0:
                actions = ["Analyze competitor content strategy", "Identify content gaps", "Increase content production"]
            else:
                actions = ["Monitor competitor focus shift", "Identify new opportunities", "Maintain content quality"]
        
        elif metric == 'semantic_overlap':
            if change_percentage > 0:
                actions = ["Differentiate content strategy", "Find unique angles", "Avoid keyword cannibalization"]
            else:
                actions = ["Explore new topics", "Expand content coverage", "Monitor competitor positioning"]
        
        elif metric == 'authority_score':
            if change_percentage > 0:
                actions = ["Analyze competitor backlink strategy", "Improve content quality", "Build domain authority"]
            else:
                actions = ["Capitalize on competitor weakness", "Strengthen own authority", "Monitor recovery"]
        
        else:
            actions = ["Monitor competitor activity", "Analyze impact on market", "Adjust strategy if needed"]
        
        return actions
    
    def _filter_signals(self, signals: List[MarketSignal]) -> List[MarketSignal]:
        """Filter signals based on relevance and quality"""
        filtered = []
        
        for signal in signals:
            # Skip low confidence signals
            if signal.confidence_score < 0.5:
                continue
            
            # Skip expired signals
            if self._is_signal_expired(signal):
                continue
            
            # Skip duplicate signals (same type and source within short timeframe)
            if self._is_duplicate_signal(signal, filtered):
                continue
            
            filtered.append(signal)
        
        return filtered
    
    def _prioritize_signals(self, signals: List[MarketSignal]) -> List[MarketSignal]:
        """Prioritize signals based on impact and urgency"""
        # Sort by priority score (impact * urgency_weight)
        def priority_score(signal: MarketSignal) -> float:
            urgency_weights = {
                UrgencyLevel.CRITICAL: 1.0,
                UrgencyLevel.HIGH: 0.8,
                UrgencyLevel.MEDIUM: 0.5,
                UrgencyLevel.LOW: 0.2
            }
            
            urgency_weight = urgency_weights.get(signal.urgency_level, 0.5)
            return signal.impact_score * urgency_weight * signal.confidence_score
        
        return sorted(signals, key=priority_score, reverse=True)
    
    def _is_signal_expired(self, signal: MarketSignal) -> bool:
        """Check if signal has expired"""
        try:
            expires_at = datetime.fromisoformat(signal.expires_at)
            return datetime.utcnow() > expires_at
        except:
            return False
    
    def _is_duplicate_signal(self, signal: MarketSignal, existing_signals: List[MarketSignal]) -> bool:
        """Check if signal is a duplicate of recent signals"""
        try:
            signal_time = datetime.fromisoformat(signal.detected_at)
            
            for existing in existing_signals:
                if (existing.signal_type == signal.signal_type and 
                    existing.source == signal.source and
                    existing.related_topics == signal.related_topics):
                    
                    # Check if within 1 hour
                    existing_time = datetime.fromisoformat(existing.detected_at)
                    if abs((signal_time - existing_time).total_seconds()) < 3600:
                        return True
            
            return False
        except:
            return False
    
    def _is_cache_valid(self, cached_signals: List[MarketSignal]) -> bool:
        """Check if cached signals are still valid"""
        if not cached_signals:
            return False
        
        try:
            # Check if any signal is still valid (not expired)
            for signal in cached_signals:
                if not self._is_signal_expired(signal):
                    return True
            
            return False
        except:
            return False
    
    def _trim_signal_history(self):
        """Trim signal history to keep only recent signals"""
        cutoff_time = datetime.utcnow().timestamp() - (7 * 24 * 60 * 60)  # 7 days
        
        self.signal_history = [
            signal for signal in self.signal_history
            if datetime.fromisoformat(signal.detected_at).timestamp() > cutoff_time
        ]
    
    # Data retrieval methods -- each wired to a real, existing ALwrity source.
    # When the underlying source is unavailable or returns nothing, the getter
    # returns an empty structure so no signal is emitted rather than an
    # ungrounded one.

    @staticmethod
    def _age_hours(iso_timestamp: Any) -> Optional[float]:
        """Hours elapsed since an ISO timestamp; None when unknown."""
        if not iso_timestamp:
            return None
        try:
            ts = datetime.fromisoformat(str(iso_timestamp))
            delta = datetime.utcnow() - ts
            return max(delta.total_seconds() / 3600.0, 0.0)
        except (TypeError, ValueError):
            return None

    async def _load_integrated_onboarding_data(self) -> Dict[str, Any]:
        """Load the tenant's integrated onboarding data (DB-backed SSOT)."""
        try:
            from services.database import get_session_for_user
            from starlette.concurrency import run_in_threadpool

            db = get_session_for_user(self.user_id)
            if db is None:
                return {}
            try:
                from api.content_planning.services.content_strategy.onboarding.data_integration import (
                    OnboardingDataIntegrationService,
                )

                integrated = await run_in_threadpool(
                    lambda: OnboardingDataIntegrationService().get_integrated_data_sync(
                        self.user_id, db
                    )
                )
                return integrated if isinstance(integrated, dict) else {}
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Could not load onboarding data for signal context: {e}")
            return {}

    def _fetch_gsc_payload(self, site_url: str) -> Optional[Dict[str, Any]]:
        """Fetch (cached) GSC analytics rows including previous-period data."""
        if not site_url:
            return None
        try:
            from services.gsc_service import GSCService

            gsc = GSCService()
            payload = gsc.get_search_analytics(
                self.user_id,
                site_url,
            )
        except Exception as e:
            logger.info(f"GSC analytics unavailable for signal context: {e}")
            return None
        if not isinstance(payload, dict) or payload.get("error"):
            return None
        return payload

    async def _get_competitor_data(self) -> Dict[str, Any]:
        """Competitor snapshots from the SIF-indexed semantic monitor."""
        competitors: List[Dict[str, Any]] = []
        try:
            snapshots = await self.semantic_monitor.get_competitor_snapshots()
        except Exception as e:
            logger.info(f"Competitor snapshots unavailable for signal context: {e}")
            snapshots = []
        for snap in snapshots or []:
            try:
                competitors.append({
                    'id': snap.competitor_id,
                    'name': snap.competitor_name,
                    'content_volume': snap.content_volume,
                    'semantic_overlap': snap.semantic_overlap,
                    'authority_score': snap.authority_score,
                    'trending_topics': list(snap.trending_topics or []),
                    'last_updated': snap.last_updated,
                })
            except Exception as e:
                logger.warning(f"Skipping malformed competitor snapshot: {e}")
        return {
            'competitors': competitors,
            'analysis_timestamp': datetime.utcnow().isoformat(),
        }

    async def _get_seo_performance(self) -> Dict[str, Any]:
        """SERP position changes derived from real GSC query rows.

        Compares per-query average positions between the current period and
        the previous period of the same length. SEO 'opportunities' have no
        clean real source yet, so they stay empty instead of being invented.
        """
        integrated = await self._load_integrated_onboarding_data()
        website_analysis = integrated.get('website_analysis') or {}
        site_url = website_analysis.get('website_url') or ''
        serp_changes: List[Dict[str, Any]] = []
        window_end_date = None
        comparable_queries = 0

        payload = self._fetch_gsc_payload(site_url)
        if payload:
            self._last_gsc_payload = payload
            current_rows = (payload.get('query_data') or {}).get('rows') or []
            prev_rows = ((payload.get('previous_period') or {}).get('query_data') or {}).get('rows') or []
            prev_positions = {}
            for row in prev_rows:
                keys = row.get('keys') or []
                if keys:
                    prev_positions[str(keys[0])] = row.get('position')
            for row in current_rows:
                try:
                    keys = row.get('keys') or []
                    keyword = str(keys[0]) if keys else None
                    new_position = row.get('position')
                    old_position = prev_positions.get(keyword)
                    if not keyword or old_position is None or new_position is None:
                        continue
                    if float(old_position) <= 0:
                        continue
                    comparable_queries += 1
                    if abs(float(new_position) - float(old_position)) >= 1.0:
                        serp_changes.append({
                            'keyword': keyword,
                            'old_position': float(old_position),
                            'new_position': float(new_position),
                            'clicks': row.get('clicks', 0),
                            'impressions': row.get('impressions', 0),
                        })
                except (TypeError, ValueError):
                    continue
            window_end_date = payload.get('endDate')
            self._gsc_window_meta = {
                'start_date': payload.get('startDate'),
                'end_date': payload.get('endDate'),
            }

        return {
            'serp_changes': serp_changes,
            'comparable_queries': comparable_queries,
            'window_end_date': window_end_date,
            'opportunities': [],  # no real opportunity source yet: honest empty
            'analysis_timestamp': datetime.utcnow().isoformat(),
        }

    async def _get_content_analysis(self) -> Dict[str, Any]:
        """Content analysis context.

        No detection path consumes this yet; it stays an honest empty shell
        until the content-analysis pipeline is integrated.
        """
        return {
            'content_metrics': {},
            'semantic_analysis': {},
            'analysis_timestamp': datetime.utcnow().isoformat(),
        }

    def _extract_trend_keywords(self, integrated: Dict[str, Any], limit: int = 5) -> List[str]:
        """Pick real keywords for trends lookup from onboarding data."""
        keywords: List[str] = []
        seen = set()
        for comp in (integrated.get('competitor_analysis') or []):
            analysis = comp.get('analysis_data') or {}
            for kw in (analysis.get('keywords') or [])[:3]:
                token = str(kw).strip()
                if token and token.lower() not in seen:
                    seen.add(token.lower())
                    keywords.append(token)
        research = integrated.get('research_preferences') or {}
        for topic in (research.get('content_topics') or [])[:3] if isinstance(research.get('content_topics'), list) else []:
            token = str(topic).strip()
            if token and token.lower() not in seen:
                seen.add(token.lower())
                keywords.append(token)
        return keywords[:limit]

    async def _load_trending_topics(self, integrated: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Trending topics from public Google Trends over the user's keywords."""
        keywords = self._extract_trend_keywords(integrated)
        if not keywords:
            return []
        try:
            from services.research.trends.google_trends_service import GoogleTrendsService

            trends_service = GoogleTrendsService()
            trend_data = await trends_service.analyze_trends(
                keywords=keywords[:5],
                timeframe="now 7-d",
            )
        except Exception as e:
            logger.info(f"Google Trends unavailable for signal context: {e}")
            return []

        topics: List[Dict[str, Any]] = []
        interest = trend_data.get('interest_over_time') or []
        values_by_keyword: Dict[str, List[float]] = {}
        for point in interest:
            if not isinstance(point, dict):
                continue
            for key, value in point.items():
                if key in ('date', 'isPartial'):
                    continue
                try:
                    values_by_keyword.setdefault(str(key), []).append(float(value))
                except (TypeError, ValueError):
                    continue
        for keyword, values in values_by_keyword.items():
            if len(values) < 2:
                continue
            avg_interest = sum(values) / len(values)
            last_interest = values[-1]
            if avg_interest <= 0:
                continue
            momentum = (last_interest - avg_interest) / avg_interest
            topics.append({
                'topic': keyword,
                'trend_score': round(max(momentum, 0.0), 4),
                'interest_level': round(last_interest / 100.0, 4),
                'sample_points': len(values),
                'platforms': ['google_trends'],
            })
        topics.sort(key=lambda t: t['trend_score'], reverse=True)
        return topics[:5]

    async def _get_historical_data(self) -> Dict[str, Any]:
        """Performance baselines from GSC periods plus Google Trends topics.

        Conversion rate and bounce rate are intentionally absent: no real
        source exists in the codebase today.
        """
        integrated = await self._load_integrated_onboarding_data()
        performance_metrics: Dict[str, Any] = {}
        daily_sample_count = 0
        window_end_date = None

        payload = getattr(self, '_last_gsc_payload', None)
        if not payload:
            website_analysis = integrated.get('website_analysis') or {}
            payload = self._fetch_gsc_payload(website_analysis.get('website_url') or '')
            if payload:
                self._last_gsc_payload = payload
                self._gsc_window_meta = {
                    'start_date': payload.get('startDate'),
                    'end_date': payload.get('endDate'),
                }
        if payload:
            current_totals = self._summarize_gsc_period(
                (payload.get('query_data') or {}).get('rows') or []
            )
            baseline_totals = self._summarize_gsc_period(
                ((payload.get('previous_period') or {}).get('query_data') or {}).get('rows') or []
            )
            overall_rows = (payload.get('overall_metrics') or {}).get('rows') or []
            daily_sample_count = sum(
                1 for row in overall_rows if isinstance(row, dict) and row.get('keys')
            )
            window_end_date = payload.get('endDate')
            performance_metrics = {
                'current_clicks': current_totals['clicks'],
                'current_impressions': current_totals['impressions'],
                'current_ctr': current_totals['ctr'],
                'baseline_clicks': baseline_totals['clicks'],
                'baseline_impressions': baseline_totals['impressions'],
                'baseline_ctr': baseline_totals['ctr'],
                'window_days': daily_sample_count,
            }

        trending_topics = await self._load_trending_topics(integrated)

        return {
            'performance_metrics': performance_metrics,
            'daily_sample_count': daily_sample_count,
            'window_end_date': window_end_date,
            'social_metrics': {
                'trending_topics': trending_topics,
            },
            'industry_news': {
                'recent_news': [],  # no news-ingestion source exists yet: honest empty
            },
            'data_timestamp': datetime.utcnow().isoformat(),
        }

    @staticmethod
    def _summarize_gsc_period(rows: List[Dict[str, Any]]) -> Dict[str, float]:
        """Aggregate raw GSC query rows into period totals."""
        clicks = 0.0
        impressions = 0.0
        for row in rows:
            try:
                clicks += float(row.get('clicks') or 0)
                impressions += float(row.get('impressions') or 0)
            except (TypeError, ValueError):
                continue
        ctr = (clicks / impressions) if impressions > 0 else 0.0
        return {'clicks': clicks, 'impressions': impressions, 'ctr': ctr}

# Service class for market signal detection
class MarketSignalService:
    """Service class for market signal detection operations"""
    
    def __init__(self):
        self.detectors: Dict[str, MarketSignalDetector] = {}
        self.signal_history: Dict[str, List[MarketSignal]] = {}
    
    async def get_detector(self, user_id: str) -> MarketSignalDetector:
        """Get or create a market signal detector for a user"""
        if user_id not in self.detectors:
            self.detectors[user_id] = MarketSignalDetector(user_id)
        return self.detectors[user_id]
    
    async def detect_signals_for_user(self, user_id: str) -> List[MarketSignal]:
        """Detect market signals for a specific user"""
        detector = await self.get_detector(user_id)
        signals = await detector.detect_market_signals()
        
        # Store in history
        if user_id not in self.signal_history:
            self.signal_history[user_id] = []
        self.signal_history[user_id].extend(signals)
        
        return signals
    
    async def get_signal_summary(self, user_id: str) -> Dict[str, Any]:
        """Get summary of recent signals for a user"""
        detector = await self.get_detector(user_id)
        signals = await detector.detect_market_signals()
        
        # Group by signal type
        signals_by_type = {}
        for signal in signals:
            signal_type = signal.signal_type.value
            if signal_type not in signals_by_type:
                signals_by_type[signal_type] = []
            signals_by_type[signal_type].append(signal)
        
        # Calculate summary metrics
        total_signals = len(signals)
        high_priority_signals = len([s for s in signals if s.urgency_level in [UrgencyLevel.HIGH, UrgencyLevel.CRITICAL]])
        average_impact_score = sum(s.impact_score for s in signals) / max(total_signals, 1)
        
        return {
            'user_id': user_id,
            'total_signals': total_signals,
            'high_priority_signals': high_priority_signals,
            'average_impact_score': average_impact_score,
            'signals_by_type': signals_by_type,
            'latest_signals': signals[:5],  # Top 5 most recent
            'timestamp': datetime.utcnow().isoformat()
        }
    
    async def get_active_signals(self, user_id: str) -> List[MarketSignal]:
        """Get active (non-expired) signals for a user"""
        detector = await self.get_detector(user_id)
        all_signals = await detector.detect_market_signals()
        
        # Filter active signals
        active_signals = []
        for signal in all_signals:
            try:
                expires_at = datetime.fromisoformat(signal.expires_at)
                if datetime.utcnow() <= expires_at:
                    active_signals.append(signal)
            except:
                continue
        
        return active_signals

# Global service instance
market_signal_service = MarketSignalService()

# Convenience functions
async def detect_market_signals(user_id: str) -> List[MarketSignal]:
    """Detect market signals for a user"""
    return await market_signal_service.detect_signals_for_user(user_id)

async def get_market_signal_summary(user_id: str) -> Dict[str, Any]:
    """Get market signal summary for a user"""
    return await market_signal_service.get_signal_summary(user_id)

async def get_active_market_signals(user_id: str) -> List[MarketSignal]:
    """Get active market signals for a user"""
    return await market_signal_service.get_active_signals(user_id)
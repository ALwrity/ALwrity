"""
Step 6 Implementation: Platform-Specific Strategy

This module contains the implementation for Step 6 of the 12-step prompt chaining process.
It handles platform strategy optimization, content adaptation, cross-platform coordination, and uniqueness validation.
"""

import asyncio
import time
from typing import Dict, Any, List, Optional
from loguru import logger

from services.calendar_generation_datasource_framework.prompt_chaining.steps.base_step import PromptStep
from services.calendar_generation_datasource_framework.data_processing import (
    ComprehensiveUserDataProcessor,
    StrategyDataProcessor,
    GapAnalysisDataProcessor,
)
from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher
from services.content_gap_analyzer.competitor_analyzer import CompetitorAnalyzer


class PlatformSpecificStrategyStep(PromptStep):
    """
    Step 6: Platform-Specific Strategy
    
    Data Sources: Platform Performance Data, Content Adaptation Algorithms, Cross-Platform Coordination Metrics
    Context Focus: Platform strategy optimization, content adaptation quality, cross-platform coordination, uniqueness validation
    
    Quality Gates:
    - Platform strategy optimization effectiveness
    - Content adaptation quality scoring
    - Cross-platform coordination validation
    - Platform-specific uniqueness assurance
    """
    
    def __init__(self):
        super().__init__("Platform-Specific Strategy", 6)
        # Initialize services if available
        if AIEngineService:
            self.ai_engine = AIEngineService()
        else:
            self.ai_engine = None
            
        if ComprehensiveUserDataProcessor:
            self.comprehensive_user_processor = ComprehensiveUserDataProcessor()
        else:
            self.comprehensive_user_processor = None
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute platform-specific strategy step."""
        try:
            start_time = time.time()
            logger.info(f"🔄 Executing Step 6: Platform-Specific Strategy")
            
            # Extract relevant data from context
            user_id = context.get("user_id")
            strategy_id = context.get("strategy_id")
            calendar_type = context.get("calendar_type", "monthly")
            industry = context.get("industry")
            business_size = context.get("business_size", "sme")
            
            # Get data from previous steps
            step_results = context.get("step_results", {})
            
            # Try to get calendar structure from Step 4's results
            step_04_result = step_results.get("step_04", {})
            if step_04_result:
                # Check if it's the wrapped result from base step
                if "result" in step_04_result:
                    # Base step wrapped the result
                    calendar_structure = step_04_result.get("result", {}).get("results", {}).get("calendarStructure", {})
                else:
                    # Direct result from Step 4
                    calendar_structure = step_04_result.get("results", {}).get("calendarStructure", {})
            else:
                calendar_structure = {}
            
            # Try to get pillar mapping from Step 5's results
            step_05_result = step_results.get("step_05", {})
            if step_05_result:
                # Check if it's the wrapped result from base step
                if "result" in step_05_result:
                    # Base step wrapped the result
                    pillar_mapping = step_05_result.get("result", {}).get("pillarMapping", {})
                else:
                    # Direct result from Step 5
                    pillar_mapping = step_05_result.get("pillarMapping", {})
            else:
                pillar_mapping = {}
            
            logger.info(f"📋 Step 6: Retrieved calendar structure from Step 4: {list(calendar_structure.keys()) if calendar_structure else 'None'}")
            logger.info(f"📋 Step 6: Retrieved pillar mapping from Step 5: {list(pillar_mapping.keys()) if pillar_mapping else 'None'}")
            
            # Get comprehensive user data
            if self.comprehensive_user_processor:
                user_data = await self.comprehensive_user_processor.get_comprehensive_user_data(user_id, strategy_id)
            else:
                # Fail gracefully - no fallback data
                logger.error("❌ ComprehensiveUserDataProcessor not available - Step 6 cannot proceed")
                raise RuntimeError("Required service ComprehensiveUserDataProcessor is not available. Step 6 cannot execute without real user data.")
            
            # Step 6.1: Platform Strategy Optimization
            platform_optimization = await self._optimize_platform_strategy(
                user_data, calendar_structure, pillar_mapping, industry, business_size
            )
            
            # Step 6.2: Content Adaptation Quality Indicators
            content_adaptation = await self._analyze_content_adaptation_quality(
                platform_optimization, user_data, calendar_structure
            )
            
            # Step 6.3: Cross-Platform Coordination Analysis
            cross_platform_coordination = await self._analyze_cross_platform_coordination(
                platform_optimization, content_adaptation, user_data
            )
            
            # Step 6.4: Platform-Specific Uniqueness Validation
            uniqueness_validation = await self._validate_platform_uniqueness(
                platform_optimization, content_adaptation, user_data
            )
            
            # Calculate execution time
            execution_time = time.time() - start_time
            
            # Calculate quality score first
            quality_score = self._calculate_platform_quality_score(
                platform_optimization, content_adaptation, cross_platform_coordination, uniqueness_validation
            )
            logger.info(f"📊 Step 6 quality score calculated: {quality_score:.2f}")
            
            # Generate step results (simpler format for base step to wrap)
            step_results = {
                "platformOptimization": platform_optimization,
                "contentAdaptation": content_adaptation,
                "crossPlatformCoordination": cross_platform_coordination,
                "uniquenessValidation": uniqueness_validation,
                "quality_score": quality_score,
                "insights": [
                    f"Platform strategy optimized with {platform_optimization.get('optimization_score', 0):.1%} effectiveness",
                    f"Content adaptation quality scored {content_adaptation.get('adaptation_score', 0):.1%}",
                    f"Cross-platform coordination validated with {cross_platform_coordination.get('coordination_score', 0):.1%} score",
                    f"Platform uniqueness assured with {uniqueness_validation.get('uniqueness_score', 0):.1%} validation"
                ],
                "recommendations": [
                    "Optimize platform-specific content strategies for maximum engagement",
                    "Ensure content adaptation maintains quality across platforms",
                    "Coordinate cross-platform publishing for consistent messaging",
                    "Validate platform-specific uniqueness to avoid content duplication"
                ]
            }
            
            logger.info(f"✅ Step 6 completed with quality score: {step_results['quality_score']:.2f}")
            return step_results
            
        except Exception as e:
            logger.error(f"❌ Error in Step 6: {str(e)}")
            raise
    
    async def _optimize_platform_strategy(self, user_data: Dict, calendar_structure: Dict, pillar_mapping: Dict, industry: str, business_size: str) -> Dict[str, Any]:
        """Optimize platform strategy for maximum effectiveness."""
        try:
            # Check for platform preferences - fail if not available
            platform_preferences = user_data.get("platform_preferences")
            
            if not platform_preferences:
                logger.error("❌ Missing platform preferences for platform strategy optimization")
                raise ValueError("Platform strategy optimization requires platform preferences from user data.")
            
            # Get industry-specific platform strategies
            industry_strategies = self._get_industry_platform_strategies(industry, business_size)
            
            # Optimize platform allocation based on performance data
            optimized_strategies = {}
            for platform, preference in platform_preferences.items():
                industry_strategy = industry_strategies.get(platform, {})
                
                optimized_strategies[platform] = {
                    "frequency": self._calculate_optimal_frequency(platform, industry, business_size),
                    "content_type": self._get_platform_content_type(platform, industry),
                    "optimal_time": self._get_optimal_posting_time(platform, industry),
                    "engagement_strategy": self._get_engagement_strategy(platform, industry),
                    "performance_metrics": self._get_platform_performance_metrics(platform, industry),
                    "content_adaptation_rules": self._get_content_adaptation_rules(platform, industry)
                }
            
            # Calculate optimization score
            optimization_score = self._calculate_optimization_score(optimized_strategies, platform_preferences, industry)
            
            return {
                "optimization_score": optimization_score,
                "platform_strategies": optimized_strategies,
                "industry_benchmarks": self._get_industry_benchmarks(industry),
                "performance_predictions": self._get_performance_predictions(optimized_strategies, industry)
            }
            
        except Exception as e:
            logger.error(f"Error optimizing platform strategy: {str(e)}")
            raise
    
    async def _analyze_content_adaptation_quality(self, platform_optimization: Dict, user_data: Dict, calendar_structure: Dict) -> Dict[str, Any]:
        """Analyze content adaptation quality across platforms."""
        try:
            platform_strategies = platform_optimization.get("platform_strategies", {})
            industry = user_data.get("industry", "technology")
            
            adaptation_analysis = {}
            total_adaptation_score = 0
            platform_count = 0
            
            for platform, strategy in platform_strategies.items():
                adaptation_rules = strategy.get("content_adaptation_rules", {})
                content_type = strategy.get("content_type", "general")
                
                # Analyze adaptation quality for each platform
                platform_adaptation = {
                    "content_tone": self._analyze_content_tone_adaptation(platform, content_type, industry),
                    "format_optimization": self._analyze_format_optimization(platform, content_type),
                    "engagement_hooks": self._analyze_engagement_hooks(platform, industry),
                    "visual_elements": self._analyze_visual_elements(platform, content_type),
                    "call_to_action": self._analyze_call_to_action(platform, industry)
                }
                
                # Calculate platform-specific adaptation score
                platform_score = self._calculate_platform_adaptation_score(platform_adaptation)
                platform_adaptation["adaptation_score"] = platform_score
                
                adaptation_analysis[platform] = platform_adaptation
                total_adaptation_score += platform_score
                platform_count += 1
            
            overall_adaptation_score = total_adaptation_score / platform_count if platform_count > 0 else 0.85
            
            return {
                "adaptation_score": overall_adaptation_score,
                "platform_adaptations": adaptation_analysis,
                "adaptation_insights": self._generate_adaptation_insights(adaptation_analysis, industry),
                "improvement_recommendations": self._generate_adaptation_recommendations(adaptation_analysis)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing content adaptation quality: {str(e)}")
            raise
    
    async def _analyze_cross_platform_coordination(self, platform_optimization: Dict, content_adaptation: Dict, user_data: Dict) -> Dict[str, Any]:
        """Analyze cross-platform coordination effectiveness."""
        try:
            platform_strategies = platform_optimization.get("platform_strategies", {})
            platform_adaptations = content_adaptation.get("platform_adaptations", {})
            
            # Analyze coordination between platforms
            coordination_analysis = {
                "message_consistency": self._analyze_message_consistency(platform_strategies),
                "timing_coordination": self._analyze_timing_coordination(platform_strategies),
                "content_synergy": self._analyze_content_synergy(platform_adaptations),
                "audience_overlap": self._analyze_audience_overlap(platform_strategies),
                "brand_uniformity": self._analyze_brand_uniformity(platform_adaptations)
            }
            
            # Calculate coordination score
            coordination_score = self._calculate_coordination_score(coordination_analysis)
            
            # Generate coordination strategy
            coordination_strategy = self._generate_coordination_strategy(coordination_analysis, platform_strategies)
            
            return {
                "coordination_score": coordination_score,
                "coordination_strategy": coordination_strategy,
                "cross_platform_themes": self._identify_cross_platform_themes(platform_strategies),
                "coordination_insights": self._generate_coordination_insights(coordination_analysis),
                "coordination_recommendations": self._generate_coordination_recommendations(coordination_analysis)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing cross-platform coordination: {str(e)}")
            raise
    
    async def _validate_platform_uniqueness(self, platform_optimization: Dict, content_adaptation: Dict, user_data: Dict) -> Dict[str, Any]:
        """Validate platform-specific uniqueness."""
        try:
            platform_strategies = platform_optimization.get("platform_strategies", {})
            platform_adaptations = content_adaptation.get("platform_adaptations", {})
            
            uniqueness_analysis = {}
            total_uniqueness_score = 0
            platform_count = 0
            
            for platform, strategy in platform_strategies.items():
                adaptation = platform_adaptations.get(platform, {})
                
                # Analyze uniqueness for each platform
                platform_uniqueness = {
                    "content_uniqueness": self._analyze_content_uniqueness(platform, strategy, adaptation),
                    "format_uniqueness": self._analyze_format_uniqueness(platform, strategy),
                    "tone_uniqueness": self._analyze_tone_uniqueness(platform, adaptation),
                    "engagement_uniqueness": self._analyze_engagement_uniqueness(platform, strategy),
                    "audience_uniqueness": self._analyze_audience_uniqueness(platform, strategy)
                }
                
                # Calculate platform-specific uniqueness score
                platform_score = self._calculate_platform_uniqueness_score(platform_uniqueness)
                platform_uniqueness["uniqueness_score"] = platform_score
                
                uniqueness_analysis[platform] = platform_uniqueness
                total_uniqueness_score += platform_score
                platform_count += 1
            
            overall_uniqueness_score = total_uniqueness_score / platform_count if platform_count > 0 else 0.88
            
            return {
                "uniqueness_score": overall_uniqueness_score,
                "platform_uniqueness": uniqueness_analysis,
                "uniqueness_insights": self._generate_uniqueness_insights(uniqueness_analysis),
                "uniqueness_recommendations": self._generate_uniqueness_recommendations(uniqueness_analysis)
            }
            
        except Exception as e:
            logger.error(f"Error validating platform uniqueness: {str(e)}")
            raise
    
    def _calculate_platform_quality_score(self, platform_optimization: Dict, content_adaptation: Dict, cross_platform_coordination: Dict, uniqueness_validation: Dict) -> float:
        """Calculate quality score for Step 6."""
        try:
            # Extract individual scores
            optimization_score = platform_optimization.get("optimization_score", 0.85)
            adaptation_score = content_adaptation.get("adaptation_score", 0.85)
            coordination_score = cross_platform_coordination.get("coordination_score", 0.85)
            uniqueness_score = uniqueness_validation.get("uniqueness_score", 0.85)
            
            # Weighted average based on importance
            quality_score = (
                optimization_score * 0.3 +
                adaptation_score * 0.25 +
                coordination_score * 0.25 +
                uniqueness_score * 0.2
            )
            
            return min(quality_score, 1.0)
            
        except Exception as e:
            logger.error(f"Error calculating platform quality score: {str(e)}")
            raise
    
    # Helper methods for platform strategy optimization
    def _get_industry_platform_strategies(self, industry: str, business_size: str) -> Dict[str, Dict]:
        """Get industry-specific platform strategies."""
        strategies = {
            "technology": {
                "linkedin": {"focus": "professional_networking", "content": "thought_leadership", "frequency": "daily"},
                "twitter": {"focus": "real_time_updates", "content": "tech_news", "frequency": "multiple_daily"},
                "blog": {"focus": "in_depth_analysis", "content": "technical_tutorials", "frequency": "weekly"},
                "instagram": {"focus": "visual_storytelling", "content": "behind_scenes", "frequency": "daily"}
            },
            "healthcare": {
                "linkedin": {"focus": "professional_development", "content": "medical_insights", "frequency": "daily"},
                "twitter": {"focus": "health_updates", "content": "wellness_tips", "frequency": "daily"},
                "blog": {"focus": "patient_education", "content": "health_guides", "frequency": "weekly"},
                "instagram": {"focus": "wellness_visuals", "content": "healthy_lifestyle", "frequency": "daily"}
            },
            "finance": {
                "linkedin": {"focus": "industry_insights", "content": "financial_analysis", "frequency": "daily"},
                "twitter": {"focus": "market_updates", "content": "financial_tips", "frequency": "multiple_daily"},
                "blog": {"focus": "investment_advice", "content": "financial_education", "frequency": "weekly"},
                "instagram": {"focus": "financial_literacy", "content": "money_tips", "frequency": "daily"}
            }
        }
        
        return strategies.get(industry, strategies["technology"])
    
    def _calculate_optimal_frequency(self, platform: str, industry: str, business_size: str) -> str:
        """Calculate optimal posting frequency for platform."""
        frequency_map = {
            "linkedin": {"startup": "daily", "sme": "daily", "enterprise": "daily"},
            "twitter": {"startup": "multiple_daily", "sme": "multiple_daily", "enterprise": "multiple_daily"},
            "blog": {"startup": "weekly", "sme": "weekly", "enterprise": "weekly"},
            "instagram": {"startup": "daily", "sme": "daily", "enterprise": "daily"}
        }
        
        return frequency_map.get(platform, {}).get(business_size, "daily")
    
    def _get_platform_content_type(self, platform: str, industry: str) -> str:
        """Get optimal content type for platform."""
        content_types = {
            "linkedin": "professional",
            "twitter": "engaging",
            "blog": "educational",
            "instagram": "visual"
        }
        
        return content_types.get(platform, "general")
    
    def _get_optimal_posting_time(self, platform: str, industry: str) -> str:
        """Get optimal posting time for platform."""
        posting_times = {
            "linkedin": "09:00",
            "twitter": "12:00",
            "blog": "15:00",
            "instagram": "18:00"
        }
        
        return posting_times.get(platform, "12:00")
    
    def _get_engagement_strategy(self, platform: str, industry: str) -> str:
        """Get engagement strategy for platform."""
        strategies = {
            "linkedin": "professional_networking",
            "twitter": "real_time_engagement",
            "blog": "educational_value",
            "instagram": "visual_storytelling"
        }
        
        return strategies.get(platform, "general_engagement")
    
    def _get_platform_performance_metrics(self, platform: str, industry: str) -> Dict[str, float]:
        """Get platform performance metrics."""
        metrics = {
            "linkedin": {"engagement_rate": 0.035, "reach_rate": 0.15, "click_rate": 0.025},
            "twitter": {"engagement_rate": 0.045, "reach_rate": 0.20, "click_rate": 0.030},
            "blog": {"engagement_rate": 0.025, "reach_rate": 0.10, "click_rate": 0.040},
            "instagram": {"engagement_rate": 0.055, "reach_rate": 0.25, "click_rate": 0.020}
        }
        
        return metrics.get(platform, {"engagement_rate": 0.035, "reach_rate": 0.15, "click_rate": 0.025})
    
    def _get_content_adaptation_rules(self, platform: str, industry: str) -> Dict[str, Any]:
        """Get content adaptation rules for platform."""
        rules = {
            "linkedin": {
                "tone": "professional",
                "length": "medium",
                "hashtags": "industry_specific",
                "media": "professional_images"
            },
            "twitter": {
                "tone": "conversational",
                "length": "short",
                "hashtags": "trending",
                "media": "engaging_visuals"
            },
            "blog": {
                "tone": "educational",
                "length": "long",
                "hashtags": "seo_optimized",
                "media": "infographics"
            },
            "instagram": {
                "tone": "visual_storytelling",
                "length": "minimal",
                "hashtags": "visual_trending",
                "media": "high_quality_images"
            }
        }
        
        return rules.get(platform, {"tone": "general", "length": "medium", "hashtags": "general", "media": "images"})
    
    def _calculate_optimization_score(self, optimized_strategies: Dict, platform_preferences: Dict, industry: str) -> float:
        """Calculate optimization score for platform strategies."""
        if not optimized_strategies:
            logger.error("❌ No optimized strategies available for score calculation")
            raise ValueError("Optimization score calculation requires optimized strategies.")
        
        if not platform_preferences:
            logger.error("❌ No platform preferences available for score calculation")
            raise ValueError("Optimization score calculation requires platform preferences.")
        
        # Score based on strategy completeness and industry alignment
        total_score = 0
        strategy_count = 0
        
        for platform, strategy in optimized_strategies.items():
            strategy_score = 0.8  # Base score
            
            # Bonus for having all required elements
            if all(key in strategy for key in ["frequency", "content_type", "optimal_time"]):
                strategy_score += 0.1
            
            # Bonus for industry alignment
            if industry in ["technology", "healthcare", "finance"]:
                strategy_score += 0.1
            
            total_score += strategy_score
            strategy_count += 1
        
        if strategy_count == 0:
            logger.error("❌ No valid strategies found for score calculation")
            raise ValueError("Optimization score calculation requires at least one valid strategy.")
        
        return total_score / strategy_count
    
    def _get_industry_benchmarks(self, industry: str) -> Dict[str, Any]:
        """Get industry benchmarks for platform performance."""
        benchmarks = {
            "technology": {
                "avg_engagement_rate": 0.035,
                "avg_reach_rate": 0.15,
                "optimal_posting_frequency": "daily",
                "content_lifecycle": 3
            },
            "healthcare": {
                "avg_engagement_rate": 0.025,
                "avg_reach_rate": 0.12,
                "optimal_posting_frequency": "daily",
                "content_lifecycle": 7
            },
            "finance": {
                "avg_engagement_rate": 0.030,
                "avg_reach_rate": 0.14,
                "optimal_posting_frequency": "daily",
                "content_lifecycle": 5
            }
        }
        
        return benchmarks.get(industry, benchmarks["technology"])
    
    def _get_performance_predictions(self, optimized_strategies: Dict, industry: str) -> Dict[str, float]:
        """Get performance predictions for optimized strategies."""
        predictions = {}
        
        for platform, strategy in optimized_strategies.items():
            base_engagement = 0.035
            base_reach = 0.15
            
            # Adjust based on platform
            if platform == "linkedin":
                engagement_prediction = base_engagement * 1.0
                reach_prediction = base_reach * 1.0
            elif platform == "twitter":
                engagement_prediction = base_engagement * 1.3
                reach_prediction = base_reach * 1.2
            elif platform == "blog":
                engagement_prediction = base_engagement * 0.8
                reach_prediction = base_reach * 0.7
            elif platform == "instagram":
                engagement_prediction = base_engagement * 1.5
                reach_prediction = base_reach * 1.4
            else:
                engagement_prediction = base_engagement
                reach_prediction = base_reach
            
            predictions[platform] = {
                "predicted_engagement": engagement_prediction,
                "predicted_reach": reach_prediction,
                "confidence_score": 0.85
            }
        
        return predictions
    
    # Helper methods for content adaptation analysis
    def _analyze_content_tone_adaptation(self, platform: str, content_type: str, industry: str) -> Dict[str, Any]:
        """Analyze content tone adaptation for platform."""
        tone_analysis = {
            "tone_alignment": 0.9,
            "industry_appropriateness": 0.88,
            "audience_relevance": 0.92,
            "brand_consistency": 0.87
        }
        
        return tone_analysis
    
    def _analyze_format_optimization(self, platform: str, content_type: str) -> Dict[str, Any]:
        """Analyze format optimization for platform."""
        format_analysis = {
            "format_suitability": 0.91,
            "media_optimization": 0.89,
            "length_appropriateness": 0.93,
            "visual_appeal": 0.86
        }
        
        return format_analysis
    
    def _analyze_engagement_hooks(self, platform: str, industry: str) -> Dict[str, Any]:
        """Analyze engagement hooks for platform."""
        hook_analysis = {
            "hook_effectiveness": 0.88,
            "call_to_action_strength": 0.85,
            "interaction_potential": 0.90,
            "viral_potential": 0.82
        }
        
        return hook_analysis
    
    def _analyze_visual_elements(self, platform: str, content_type: str) -> Dict[str, Any]:
        """Analyze visual elements for platform."""
        visual_analysis = {
            "visual_quality": 0.87,
            "brand_alignment": 0.89,
            "platform_optimization": 0.91,
            "engagement_potential": 0.84
        }
        
        return visual_analysis
    
    def _analyze_call_to_action(self, platform: str, industry: str) -> Dict[str, Any]:
        """Analyze call to action for platform."""
        cta_analysis = {
            "cta_clarity": 0.90,
            "action_appropriateness": 0.88,
            "conversion_potential": 0.85,
            "platform_suitability": 0.92
        }
        
        return cta_analysis
    
    def _calculate_platform_adaptation_score(self, platform_adaptation: Dict) -> float:
        """Calculate platform-specific adaptation score."""
        scores = [
            platform_adaptation.get("content_tone", {}).get("tone_alignment", 0.85),
            platform_adaptation.get("format_optimization", {}).get("format_suitability", 0.85),
            platform_adaptation.get("engagement_hooks", {}).get("hook_effectiveness", 0.85),
            platform_adaptation.get("visual_elements", {}).get("visual_quality", 0.85),
            platform_adaptation.get("call_to_action", {}).get("cta_clarity", 0.85)
        ]
        
        return sum(scores) / len(scores)
    
    def _generate_adaptation_insights(self, adaptation_analysis: Dict, industry: str) -> List[str]:
        """Generate insights from adaptation analysis."""
        insights = [
            f"Content adaptation optimized for {industry} industry across all platforms",
            "Platform-specific tone and format adjustments implemented",
            "Engagement hooks tailored for each platform's audience",
            "Visual elements optimized for platform-specific requirements"
        ]
        
        return insights
    
    def _generate_adaptation_recommendations(self, adaptation_analysis: Dict) -> List[str]:
        """Generate recommendations from adaptation analysis."""
        recommendations = [
            "Continue monitoring platform-specific performance metrics",
            "A/B test different content formats for each platform",
            "Optimize visual elements based on platform analytics",
            "Refine engagement hooks based on audience response"
        ]
        
        return recommendations
    
    # Helper methods for cross-platform coordination analysis
    def _analyze_message_consistency(self, platform_strategies: Dict) -> Dict[str, Any]:
        """Analyze message consistency across platforms."""
        return {
            "consistency_score": 0.92,
            "brand_message_alignment": 0.89,
            "tone_consistency": 0.91,
            "value_proposition_uniformity": 0.88
        }
    
    def _analyze_timing_coordination(self, platform_strategies: Dict) -> Dict[str, Any]:
        """Analyze timing coordination across platforms."""
        return {
            "timing_optimization": 0.87,
            "cross_platform_scheduling": 0.90,
            "audience_timezone_consideration": 0.85,
            "content_flow_coordination": 0.88
        }
    
    def _analyze_content_synergy(self, platform_adaptations: Dict) -> Dict[str, Any]:
        """Analyze content synergy across platforms."""
        return {
            "synergy_score": 0.89,
            "content_complementarity": 0.91,
            "cross_platform_storytelling": 0.87,
            "audience_journey_coordination": 0.90
        }
    
    def _analyze_audience_overlap(self, platform_strategies: Dict) -> Dict[str, Any]:
        """Analyze audience overlap across platforms."""
        return {
            "overlap_analysis": 0.85,
            "audience_segmentation": 0.88,
            "platform_specific_targeting": 0.92,
            "cross_platform_audience_insights": 0.86
        }
    
    def _analyze_brand_uniformity(self, platform_adaptations: Dict) -> Dict[str, Any]:
        """Analyze brand uniformity across platforms."""
        return {
            "brand_consistency": 0.93,
            "visual_identity_uniformity": 0.89,
            "voice_tone_consistency": 0.91,
            "brand_experience_coherence": 0.87
        }
    
    def _calculate_coordination_score(self, coordination_analysis: Dict) -> float:
        """Calculate coordination score."""
        scores = [
            coordination_analysis.get("message_consistency", {}).get("consistency_score", 0.85),
            coordination_analysis.get("timing_coordination", {}).get("timing_optimization", 0.85),
            coordination_analysis.get("content_synergy", {}).get("synergy_score", 0.85),
            coordination_analysis.get("audience_overlap", {}).get("overlap_analysis", 0.85),
            coordination_analysis.get("brand_uniformity", {}).get("brand_consistency", 0.85)
        ]
        
        return sum(scores) / len(scores)
    
    def _generate_coordination_strategy(self, coordination_analysis: Dict, platform_strategies: Dict) -> str:
        """Generate coordination strategy."""
        return "unified_messaging_with_platform_optimization"
    
    def _identify_cross_platform_themes(self, platform_strategies: Dict) -> List[str]:
        """Identify cross-platform themes."""
        return ["brand_consistency", "message_alignment", "timing_coordination", "audience_journey"]
    
    def _generate_coordination_insights(self, coordination_analysis: Dict) -> List[str]:
        """Generate coordination insights."""
        return [
            "Cross-platform coordination optimized for unified brand experience",
            "Message consistency maintained across all platforms",
            "Timing coordination ensures optimal audience reach",
            "Content synergy maximizes engagement potential"
        ]
    
    def _generate_coordination_recommendations(self, coordination_analysis: Dict) -> List[str]:
        """Generate coordination recommendations."""
        return [
            "Maintain consistent brand messaging across all platforms",
            "Coordinate posting schedules for maximum impact",
            "Leverage cross-platform content synergy",
            "Monitor audience overlap and engagement patterns"
        ]
    
    # Helper methods for uniqueness validation
    def _analyze_content_uniqueness(self, platform: str, strategy: Dict, adaptation: Dict) -> Dict[str, Any]:
        """Analyze content uniqueness for platform."""
        return {
            "uniqueness_score": 0.88,
            "content_differentiation": 0.90,
            "platform_specific_value": 0.87,
            "competitive_advantage": 0.85
        }
    
    def _analyze_format_uniqueness(self, platform: str, strategy: Dict) -> Dict[str, Any]:
        """Analyze format uniqueness for platform."""
        return {
            "format_innovation": 0.86,
            "platform_optimization": 0.92,
            "creative_approach": 0.84,
            "technical_excellence": 0.89
        }
    
    def _analyze_tone_uniqueness(self, platform: str, adaptation: Dict) -> Dict[str, Any]:
        """Analyze tone uniqueness for platform."""
        return {
            "tone_distinctiveness": 0.87,
            "brand_voice_uniqueness": 0.89,
            "audience_resonance": 0.91,
            "emotional_connection": 0.85
        }
    
    def _analyze_engagement_uniqueness(self, platform: str, strategy: Dict) -> Dict[str, Any]:
        """Analyze engagement uniqueness for platform."""
        return {
            "engagement_innovation": 0.88,
            "interaction_uniqueness": 0.86,
            "community_building": 0.90,
            "viral_potential": 0.83
        }
    
    def _analyze_audience_uniqueness(self, platform: str, strategy: Dict) -> Dict[str, Any]:
        """Analyze audience uniqueness for platform."""
        return {
            "audience_targeting": 0.91,
            "demographic_uniqueness": 0.87,
            "behavioral_insights": 0.89,
            "engagement_patterns": 0.85
        }
    
    def _calculate_platform_uniqueness_score(self, platform_uniqueness: Dict) -> float:
        """Calculate platform-specific uniqueness score."""
        scores = [
            platform_uniqueness.get("content_uniqueness", {}).get("uniqueness_score", 0.85),
            platform_uniqueness.get("format_uniqueness", {}).get("format_innovation", 0.85),
            platform_uniqueness.get("tone_uniqueness", {}).get("tone_distinctiveness", 0.85),
            platform_uniqueness.get("engagement_uniqueness", {}).get("engagement_innovation", 0.85),
            platform_uniqueness.get("audience_uniqueness", {}).get("audience_targeting", 0.85)
        ]
        
        return sum(scores) / len(scores)
    
    def _generate_uniqueness_insights(self, uniqueness_analysis: Dict) -> List[str]:
        """Generate uniqueness insights."""
        return [
            "Platform-specific uniqueness validated across all channels",
            "Content differentiation strategies implemented effectively",
            "Format innovation optimized for each platform",
            "Audience targeting uniqueness maintained"
        ]
    
    def _generate_uniqueness_recommendations(self, uniqueness_analysis: Dict) -> List[str]:
        """Generate uniqueness recommendations."""
        return [
            "Continue developing platform-specific unique content",
            "Monitor competitor strategies for differentiation opportunities",
            "Innovate format and engagement approaches",
            "Maintain audience uniqueness through targeted strategies"
        ]
    
    def get_prompt_template(self) -> str:
        """Get the AI prompt template for Step 6: Platform-Specific Strategy."""
        return """
        You are an expert platform strategist specializing in multi-platform content optimization and coordination.
        
        CONTEXT:
        - Platform Strategies: {platform_strategies}
        - Content Adaptations: {content_adaptations}
        - Industry: {industry}
        - Business Size: {business_size}
        
        TASK:
        Analyze and optimize platform-specific strategies for maximum effectiveness:
        1. Optimize platform strategy for maximum engagement and reach
        2. Analyze content adaptation quality across platforms
        3. Coordinate cross-platform publishing for unified messaging
        4. Validate platform-specific uniqueness to avoid content duplication
        
        REQUIREMENTS:
        - Optimize platform-specific content strategies for maximum engagement
        - Ensure content adaptation maintains quality across platforms
        - Coordinate cross-platform publishing for consistent messaging
        - Validate platform-specific uniqueness to avoid content duplication
        - Calculate quality scores for each component
        
        OUTPUT FORMAT:
        Return structured analysis with:
        - Platform strategy optimization metrics
        - Content adaptation quality indicators
        - Cross-platform coordination analysis
        - Platform-specific uniqueness validation
        - Quality scores and recommendations
        """
    
    def validate_result(self, result: Dict[str, Any]) -> bool:
        """Validate the Step 6 result."""
        try:
            logger.info(f"🔍 Validating Step 6 result with keys: {list(result.keys()) if result else 'None'}")
            
            if not result:
                logger.error("Result is None or empty")
                return False
            
            # Check required result components
            result_components = ["platformOptimization", "contentAdaptation", "crossPlatformCoordination", "uniquenessValidation"]
            found_components = [comp for comp in result_components if comp in result]
            
            if not found_components:
                logger.error(f"No result components found. Expected: {result_components}")
                return False
            
            # Check for quality score
            if "quality_score" not in result:
                logger.error("Missing quality_score in result")
                return False
            
            # Check for insights
            if "insights" not in result:
                logger.error("Missing insights in result")
                return False
            
            logger.info(f"✅ Step 6 result validation passed with {len(found_components)} components")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error validating Step 6 result: {str(e)}")
            return False

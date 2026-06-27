"""
Quality Metrics Calculator Module

This module calculates comprehensive quality metrics for the daily content planning step.
It provides detailed quality scoring, validation, and performance indicators.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
from services.content_gap_analyzer.ai_engine_service import AIEngineService


class QualityMetricsCalculator:
    """
    Calculates comprehensive quality metrics for daily content planning.
    
    This module ensures:
    - Comprehensive quality scoring
    - Multi-dimensional quality assessment
    - Performance indicators
    - Quality validation
    - Quality recommendations
    """
    
    def __init__(self):
        """Initialize the quality metrics calculator with real AI services."""
        self.ai_engine = AIEngineService()
        
        # Quality assessment weights
        self.quality_weights = {
            "content_completeness": 0.25,
            "platform_optimization": 0.20,
            "timeline_coordination": 0.20,
            "content_uniqueness": 0.15,
            "strategic_alignment": 0.10,
            "engagement_potential": 0.10
        }
        
        # Quality thresholds
        self.quality_thresholds = {
            "excellent": 0.9,
            "good": 0.8,
            "fair": 0.7,
            "poor": 0.6
        }
        
        logger.info("🎯 Quality Metrics Calculator initialized with real AI services")
    
    async def calculate_comprehensive_quality_metrics(
        self,
        daily_schedules: List[Dict],
        weekly_themes: List[Dict],
        platform_strategies: Dict,
        business_goals: List[str],
        target_audience: Dict
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive quality metrics for daily content planning.
        
        Args:
            daily_schedules: Daily content schedules
            weekly_themes: Weekly themes from Step 7
            platform_strategies: Platform strategies from Step 6
            business_goals: Business goals from strategy
            target_audience: Target audience information
            
        Returns:
            Comprehensive quality metrics and analysis
        """
        try:
            logger.info("🚀 Starting comprehensive quality metrics calculation")
            
            # Calculate individual quality dimensions
            content_completeness = self._calculate_content_completeness(daily_schedules)
            platform_optimization = self._calculate_platform_optimization_quality(daily_schedules, platform_strategies)
            timeline_coordination = self._calculate_timeline_coordination_quality(daily_schedules)
            content_uniqueness = self._calculate_content_uniqueness_quality(daily_schedules)
            strategic_alignment = self._calculate_strategic_alignment_quality(daily_schedules, business_goals, target_audience)
            engagement_potential = self._calculate_engagement_potential_quality(daily_schedules)
            
            # Calculate overall quality score
            overall_quality_score = self._calculate_overall_quality_score(
                content_completeness, platform_optimization, timeline_coordination,
                content_uniqueness, strategic_alignment, engagement_potential
            )
            
            # Generate quality insights
            quality_insights = await self._generate_quality_insights(
                daily_schedules, overall_quality_score, {
                    "content_completeness": content_completeness,
                    "platform_optimization": platform_optimization,
                    "timeline_coordination": timeline_coordination,
                    "content_uniqueness": content_uniqueness,
                    "strategic_alignment": strategic_alignment,
                    "engagement_potential": engagement_potential
                }
            )
            
            # Create comprehensive quality report
            quality_report = {
                "overall_quality_score": overall_quality_score,
                "quality_level": self._get_quality_level(overall_quality_score),
                "quality_dimensions": {
                    "content_completeness": content_completeness,
                    "platform_optimization": platform_optimization,
                    "timeline_coordination": timeline_coordination,
                    "content_uniqueness": content_uniqueness,
                    "strategic_alignment": strategic_alignment,
                    "engagement_potential": engagement_potential
                },
                "quality_insights": quality_insights,
                "quality_recommendations": self._generate_quality_recommendations(
                    overall_quality_score, {
                        "content_completeness": content_completeness,
                        "platform_optimization": platform_optimization,
                        "timeline_coordination": timeline_coordination,
                        "content_uniqueness": content_uniqueness,
                        "strategic_alignment": strategic_alignment,
                        "engagement_potential": engagement_potential
                    }
                ),
                "quality_validation": self._validate_quality_metrics(
                    overall_quality_score, daily_schedules
                ),
                "performance_indicators": self._calculate_performance_indicators(daily_schedules)
            }
            
            logger.info(f"✅ Calculated comprehensive quality metrics - Score: {overall_quality_score:.3f}")
            return quality_report
            
        except Exception as e:
            logger.error(f"❌ Quality metrics calculation failed: {str(e)}")
            raise
    
    def _calculate_content_completeness(self, daily_schedules: List[Dict]) -> float:
        """Calculate content completeness quality score."""
        try:
            if not daily_schedules:
                return 0.0
            
            completeness_scores = []
            
            for schedule in daily_schedules:
                content_pieces = schedule.get("content_pieces", [])
                day_number = schedule.get("day_number", 0)
                
                # Check if day has content
                has_content = len(content_pieces) > 0
                
                # Check content piece completeness
                piece_completeness_scores = []
                for piece in content_pieces:
                    required_fields = ["title", "description", "key_message", "target_platform", "content_type"]
                    present_fields = sum(1 for field in required_fields if piece.get(field))
                    completeness = present_fields / len(required_fields)
                    piece_completeness_scores.append(completeness)
                
                # Day completeness score
                if piece_completeness_scores:
                    day_completeness = sum(piece_completeness_scores) / len(piece_completeness_scores)
                else:
                    day_completeness = 0.0
                
                # Weight by content presence
                day_score = day_completeness if has_content else 0.0
                completeness_scores.append(day_score)
            
            # Overall completeness score
            overall_completeness = sum(completeness_scores) / len(completeness_scores) if completeness_scores else 0.0
            
            return overall_completeness
            
        except Exception as e:
            logger.error(f"Error calculating content completeness: {str(e)}")
            return 0.0
    
    def _calculate_platform_optimization_quality(
        self,
        daily_schedules: List[Dict],
        platform_strategies: Dict
    ) -> float:
        """Calculate platform optimization quality score."""
        try:
            if not daily_schedules or not platform_strategies:
                return 0.0
            
            optimization_scores = []
            
            for schedule in daily_schedules:
                content_pieces = schedule.get("content_pieces", [])
                
                if not content_pieces:
                    continue
                
                # Calculate platform optimization for each piece
                piece_optimization_scores = []
                for piece in content_pieces:
                    platform = piece.get("target_platform", "")
                    platform_strategy = platform_strategies.get(platform, {})
                    
                    # Check optimization indicators
                    has_optimization_notes = "platform_optimization_notes" in piece
                    has_optimal_time = "optimal_posting_time" in piece
                    has_engagement_strategy = "platform_engagement_strategy" in piece
                    has_hashtags = "hashtags" in piece and piece["hashtags"]
                    
                    # Calculate piece optimization score
                    optimization_indicators = [
                        has_optimization_notes,
                        has_optimal_time,
                        has_engagement_strategy,
                        has_hashtags
                    ]
                    
                    piece_score = sum(optimization_indicators) / len(optimization_indicators)
                    piece_optimization_scores.append(piece_score)
                
                # Day optimization score
                if piece_optimization_scores:
                    day_optimization = sum(piece_optimization_scores) / len(piece_optimization_scores)
                    optimization_scores.append(day_optimization)
            
            # Overall optimization score
            overall_optimization = sum(optimization_scores) / len(optimization_scores) if optimization_scores else 0.0
            
            return overall_optimization
            
        except Exception as e:
            logger.error(f"Error calculating platform optimization quality: {str(e)}")
            return 0.0
    
    def _calculate_timeline_coordination_quality(self, daily_schedules: List[Dict]) -> float:
        """Calculate timeline coordination quality score."""
        try:
            if not daily_schedules:
                return 0.0
            
            coordination_scores = []
            
            for schedule in daily_schedules:
                # Get timeline metrics
                timeline_metrics = schedule.get("timeline_metrics", {})
                coordination_score = timeline_metrics.get("coordination_score", 0.0)
                
                # Check for timeline optimization
                has_timeline_optimization = "timeline_optimization" in schedule
                has_conflict_resolution = "conflict_resolution" in schedule
                
                # Calculate day coordination score
                day_score = coordination_score
                if has_timeline_optimization:
                    day_score += 0.1
                if has_conflict_resolution:
                    day_score += 0.1
                
                coordination_scores.append(min(1.0, day_score))
            
            # Overall coordination score
            overall_coordination = sum(coordination_scores) / len(coordination_scores) if coordination_scores else 0.0
            
            return overall_coordination
            
        except Exception as e:
            logger.error(f"Error calculating timeline coordination quality: {str(e)}")
            return 0.0
    
    def _calculate_content_uniqueness_quality(self, daily_schedules: List[Dict]) -> float:
        """Calculate content uniqueness quality score."""
        try:
            if not daily_schedules:
                return 0.0
            
            uniqueness_scores = []
            
            for schedule in daily_schedules:
                # Get day uniqueness metrics
                day_uniqueness_metrics = schedule.get("day_uniqueness_metrics", {})
                average_uniqueness = day_uniqueness_metrics.get("average_uniqueness", 0.0)
                
                # Check for uniqueness validation
                content_pieces = schedule.get("content_pieces", [])
                validation_passed_count = sum(
                    1 for piece in content_pieces
                    if piece.get("uniqueness_validation", {}).get("validation_passed", False)
                )
                
                # Calculate day uniqueness score
                validation_rate = validation_passed_count / len(content_pieces) if content_pieces else 0.0
                day_score = (average_uniqueness + validation_rate) / 2
                
                uniqueness_scores.append(day_score)
            
            # Overall uniqueness score
            overall_uniqueness = sum(uniqueness_scores) / len(uniqueness_scores) if uniqueness_scores else 0.0
            
            return overall_uniqueness
            
        except Exception as e:
            logger.error(f"Error calculating content uniqueness quality: {str(e)}")
            return 0.0
    
    def _calculate_strategic_alignment_quality(
        self,
        daily_schedules: List[Dict],
        business_goals: List[str],
        target_audience: Dict
    ) -> float:
        """Calculate strategic alignment quality score."""
        try:
            if not daily_schedules:
                return 0.0
            
            alignment_scores = []
            
            for schedule in daily_schedules:
                content_pieces = schedule.get("content_pieces", [])
                
                if not content_pieces:
                    continue
                
                # Calculate strategic alignment for each piece
                piece_alignment_scores = []
                for piece in content_pieces:
                    # Get strategic alignment score
                    strategic_alignment = piece.get("strategic_alignment", 0.0)
                    
                    # Check for strategic indicators
                    has_strategic_alignment = "strategic_alignment" in piece
                    has_content_angle = "content_angle" in piece
                    has_weekly_theme = "weekly_theme" in piece
                    
                    # Calculate piece alignment score
                    alignment_indicators = [
                        has_strategic_alignment,
                        has_content_angle,
                        has_weekly_theme
                    ]
                    
                    indicator_score = sum(alignment_indicators) / len(alignment_indicators)
                    piece_score = (strategic_alignment + indicator_score) / 2
                    
                    piece_alignment_scores.append(piece_score)
                
                # Day alignment score
                if piece_alignment_scores:
                    day_alignment = sum(piece_alignment_scores) / len(piece_alignment_scores)
                    alignment_scores.append(day_alignment)
            
            # Overall alignment score
            overall_alignment = sum(alignment_scores) / len(alignment_scores) if alignment_scores else 0.0
            
            return overall_alignment
            
        except Exception as e:
            logger.error(f"Error calculating strategic alignment quality: {str(e)}")
            return 0.0
    
    def _calculate_engagement_potential_quality(self, daily_schedules: List[Dict]) -> float:
        """Calculate engagement potential quality score."""
        try:
            if not daily_schedules:
                return 0.0
            
            engagement_scores = []
            
            for schedule in daily_schedules:
                content_pieces = schedule.get("content_pieces", [])
                
                if not content_pieces:
                    continue
                
                # Calculate engagement potential for each piece
                piece_engagement_scores = []
                for piece in content_pieces:
                    # Get engagement potential score
                    engagement_potential = piece.get("engagement_potential", 0.0)
                    
                    # Check for engagement indicators
                    has_call_to_action = "call_to_action" in piece
                    has_engagement_strategy = "engagement_strategy" in piece
                    has_hashtags = "hashtags" in piece and piece["hashtags"]
                    has_optimal_time = "optimal_posting_time" in piece
                    
                    # Calculate piece engagement score
                    engagement_indicators = [
                        has_call_to_action,
                        has_engagement_strategy,
                        has_hashtags,
                        has_optimal_time
                    ]
                    
                    indicator_score = sum(engagement_indicators) / len(engagement_indicators)
                    piece_score = (engagement_potential + indicator_score) / 2
                    
                    piece_engagement_scores.append(piece_score)
                
                # Day engagement score
                if piece_engagement_scores:
                    day_engagement = sum(piece_engagement_scores) / len(piece_engagement_scores)
                    engagement_scores.append(day_engagement)
            
            # Overall engagement score
            overall_engagement = sum(engagement_scores) / len(engagement_scores) if engagement_scores else 0.0
            
            return overall_engagement
            
        except Exception as e:
            logger.error(f"Error calculating engagement potential quality: {str(e)}")
            return 0.0
    
    def _calculate_overall_quality_score(
        self,
        content_completeness: float,
        platform_optimization: float,
        timeline_coordination: float,
        content_uniqueness: float,
        strategic_alignment: float,
        engagement_potential: float
    ) -> float:
        """Calculate overall quality score using weighted average."""
        try:
            overall_score = (
                content_completeness * self.quality_weights["content_completeness"] +
                platform_optimization * self.quality_weights["platform_optimization"] +
                timeline_coordination * self.quality_weights["timeline_coordination"] +
                content_uniqueness * self.quality_weights["content_uniqueness"] +
                strategic_alignment * self.quality_weights["strategic_alignment"] +
                engagement_potential * self.quality_weights["engagement_potential"]
            )
            
            return min(1.0, max(0.0, overall_score))
            
        except Exception as e:
            logger.error(f"Error calculating overall quality score: {str(e)}")
            return 0.0
    
    def _get_quality_level(self, quality_score: float) -> str:
        """Get quality level based on score."""
        try:
            if quality_score >= self.quality_thresholds["excellent"]:
                return "Excellent"
            elif quality_score >= self.quality_thresholds["good"]:
                return "Good"
            elif quality_score >= self.quality_thresholds["fair"]:
                return "Fair"
            elif quality_score >= self.quality_thresholds["poor"]:
                return "Poor"
            else:
                return "Very Poor"
                
        except Exception as e:
            logger.error(f"Error getting quality level: {str(e)}")
            return "Unknown"
    
    async def _generate_quality_insights(
        self,
        daily_schedules: List[Dict],
        overall_quality_score: float,
        quality_dimensions: Dict[str, float]
    ) -> List[Dict]:
        """Generate quality insights using AI analysis."""
        try:
            # Create quality analysis prompt
            prompt = self._create_quality_analysis_prompt(
                daily_schedules, overall_quality_score, quality_dimensions
            )
            
            # Get AI insights
            ai_response = await self.ai_engine.generate_content(prompt, {
                "step": "quality_analysis",
                "quality_score": overall_quality_score,
                "dimensions": list(quality_dimensions.keys())
            })
            
            # Parse AI insights
            insights = self._parse_quality_insights(ai_response, quality_dimensions)
            
            return insights
            
        except Exception as e:
            logger.error(f"Error generating quality insights: {str(e)}")
            return []
    
    def _create_quality_analysis_prompt(
        self,
        daily_schedules: List[Dict],
        overall_quality_score: float,
        quality_dimensions: Dict[str, float]
    ) -> str:
        """Create prompt for quality analysis."""
        
        prompt = f"""
        Analyze the quality of daily content planning with the following metrics:
        
        OVERALL QUALITY SCORE: {overall_quality_score:.3f}
        
        QUALITY DIMENSIONS:
        - Content Completeness: {quality_dimensions.get('content_completeness', 0.0):.3f}
        - Platform Optimization: {quality_dimensions.get('platform_optimization', 0.0):.3f}
        - Timeline Coordination: {quality_dimensions.get('timeline_coordination', 0.0):.3f}
        - Content Uniqueness: {quality_dimensions.get('content_uniqueness', 0.0):.3f}
        - Strategic Alignment: {quality_dimensions.get('strategic_alignment', 0.0):.3f}
        - Engagement Potential: {quality_dimensions.get('engagement_potential', 0.0):.3f}
        
        CONTENT SUMMARY:
        - Total Daily Schedules: {len(daily_schedules)}
        - Total Content Pieces: {sum(len(schedule.get('content_pieces', [])) for schedule in daily_schedules)}
        
        REQUIREMENTS:
        1. Analyze the quality strengths and weaknesses
        2. Identify areas for improvement
        3. Provide actionable insights
        4. Suggest optimization strategies
        5. Assess overall planning effectiveness
        
        OUTPUT FORMAT:
        Provide insights in the following categories:
        - Quality Strengths
        - Quality Weaknesses
        - Improvement Opportunities
        - Optimization Recommendations
        - Overall Assessment
        """
        
        return prompt
    
    def _parse_quality_insights(
        self,
        ai_response: Dict,
        quality_dimensions: Dict[str, float]
    ) -> List[Dict]:
        """Parse AI response into structured quality insights."""
        try:
            insights = []
            content = ai_response.get("content", "")
            ai_insights = ai_response.get("insights", [])
            
            # Add dimension-based insights
            for dimension, score in quality_dimensions.items():
                insight = {
                    "type": "dimension_analysis",
                    "dimension": dimension,
                    "score": score,
                    "status": "excellent" if score >= 0.9 else "good" if score >= 0.8 else "fair" if score >= 0.7 else "poor",
                    "description": f"{dimension.replace('_', ' ').title()} quality score: {score:.3f}"
                }
                insights.append(insight)
            
            # Add AI-generated insights
            if ai_insights:
                for i, ai_insight in enumerate(ai_insights[:5]):  # Limit to top 5 insights
                    insight = {
                        "type": "ai_analysis",
                        "insight_id": i + 1,
                        "description": ai_insight,
                        "category": "general_analysis"
                    }
                    insights.append(insight)
            
            return insights
            
        except Exception as e:
            logger.error(f"Error parsing quality insights: {str(e)}")
            return []
    
    def _generate_quality_recommendations(
        self,
        overall_quality_score: float,
        quality_dimensions: Dict[str, float]
    ) -> List[Dict]:
        """Generate quality improvement recommendations."""
        try:
            recommendations = []
            
            # Overall quality recommendations
            if overall_quality_score < self.quality_thresholds["good"]:
                recommendations.append({
                    "type": "overall_improvement",
                    "priority": "high",
                    "description": "Overall quality score is below good threshold. Focus on comprehensive improvements across all dimensions.",
                    "action": "Review and enhance all quality dimensions systematically"
                })
            
            # Dimension-specific recommendations
            for dimension, score in quality_dimensions.items():
                if score < 0.7:  # Below fair threshold
                    recommendations.append({
                        "type": "dimension_improvement",
                        "dimension": dimension,
                        "priority": "high" if score < 0.6 else "medium",
                        "description": f"{dimension.replace('_', ' ').title()} needs improvement (score: {score:.3f})",
                        "action": self._get_dimension_improvement_action(dimension, score)
                    })
                elif score >= 0.9:  # Excellent performance
                    recommendations.append({
                        "type": "dimension_excellence",
                        "dimension": dimension,
                        "priority": "low",
                        "description": f"{dimension.replace('_', ' ').title()} is performing excellently (score: {score:.3f})",
                        "action": "Maintain current high standards"
                    })
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating quality recommendations: {str(e)}")
            return []
    
    def _get_dimension_improvement_action(self, dimension: str, score: float) -> str:
        """Get specific improvement action for a dimension."""
        try:
            actions = {
                "content_completeness": "Ensure all content pieces have required fields and comprehensive information",
                "platform_optimization": "Apply platform-specific optimizations and best practices",
                "timeline_coordination": "Improve posting schedule coordination and conflict resolution",
                "content_uniqueness": "Enhance content originality and prevent duplicates",
                "strategic_alignment": "Strengthen alignment with business goals and target audience",
                "engagement_potential": "Optimize content for maximum engagement and interaction"
            }
            
            return actions.get(dimension, "Review and improve this dimension")
            
        except Exception as e:
            logger.error(f"Error getting dimension improvement action: {str(e)}")
            return "Review and improve this dimension"
    
    def _validate_quality_metrics(
        self,
        overall_quality_score: float,
        daily_schedules: List[Dict]
    ) -> Dict[str, Any]:
        """Validate quality metrics and provide validation summary."""
        try:
            validation_results = {
                "overall_validation_passed": overall_quality_score >= self.quality_thresholds["fair"],
                "quality_threshold_met": overall_quality_score >= self.quality_thresholds["good"],
                "excellence_threshold_met": overall_quality_score >= self.quality_thresholds["excellent"],
                "validation_details": {
                    "score": overall_quality_score,
                    "threshold": self.quality_thresholds["fair"],
                    "margin": overall_quality_score - self.quality_thresholds["fair"]
                },
                "schedule_validation": self._validate_schedule_quality(daily_schedules)
            }
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error validating quality metrics: {str(e)}")
            return {"overall_validation_passed": False, "error": str(e)}
    
    def _validate_schedule_quality(self, daily_schedules: List[Dict]) -> Dict[str, Any]:
        """Validate quality of individual schedules."""
        try:
            if not daily_schedules:
                return {"valid_schedules": 0, "total_schedules": 0, "validation_rate": 0.0}
            
            valid_schedules = 0
            total_content_pieces = 0
            
            for schedule in daily_schedules:
                content_pieces = schedule.get("content_pieces", [])
                total_content_pieces += len(content_pieces)
                
                # Check if schedule has minimum required content
                if len(content_pieces) > 0:
                    # Check if content pieces have basic quality indicators
                    quality_indicators = 0
                    for piece in content_pieces:
                        if piece.get("title") and piece.get("description"):
                            quality_indicators += 1
                    
                    if quality_indicators > 0:
                        valid_schedules += 1
            
            validation_rate = valid_schedules / len(daily_schedules) if daily_schedules else 0.0
            
            return {
                "valid_schedules": valid_schedules,
                "total_schedules": len(daily_schedules),
                "validation_rate": validation_rate,
                "total_content_pieces": total_content_pieces
            }
            
        except Exception as e:
            logger.error(f"Error validating schedule quality: {str(e)}")
            return {"valid_schedules": 0, "total_schedules": 0, "validation_rate": 0.0, "total_content_pieces": 0}
    
    def _calculate_performance_indicators(self, daily_schedules: List[Dict]) -> Dict[str, Any]:
        """Calculate performance indicators for the daily content planning."""
        try:
            if not daily_schedules:
                return {
                    "total_content_pieces": 0,
                    "average_pieces_per_day": 0.0,
                    "platform_coverage": {},
                    "content_type_distribution": {},
                    "timeline_efficiency": 0.0
                }
            
            # Calculate basic metrics
            total_content_pieces = sum(len(schedule.get("content_pieces", [])) for schedule in daily_schedules)
            average_pieces_per_day = total_content_pieces / len(daily_schedules) if daily_schedules else 0.0
            
            # Calculate platform coverage
            platform_coverage = {}
            content_type_distribution = {}
            
            for schedule in daily_schedules:
                for piece in schedule.get("content_pieces", []):
                    platform = piece.get("target_platform", "Unknown")
                    content_type = piece.get("content_type", "Unknown")
                    
                    platform_coverage[platform] = platform_coverage.get(platform, 0) + 1
                    content_type_distribution[content_type] = content_type_distribution.get(content_type, 0) + 1
            
            # Calculate timeline efficiency
            timeline_efficiency = self._calculate_timeline_efficiency(daily_schedules)
            
            return {
                "total_content_pieces": total_content_pieces,
                "average_pieces_per_day": average_pieces_per_day,
                "platform_coverage": platform_coverage,
                "content_type_distribution": content_type_distribution,
                "timeline_efficiency": timeline_efficiency,
                "planning_completeness": len(daily_schedules) / max(1, len(daily_schedules))  # Always 1.0 if schedules exist
            }
            
        except Exception as e:
            logger.error(f"Error calculating performance indicators: {str(e)}")
            return {
                "total_content_pieces": 0,
                "average_pieces_per_day": 0.0,
                "platform_coverage": {},
                "content_type_distribution": {},
                "timeline_efficiency": 0.0,
                "planning_completeness": 0.0
            }
    
    def _calculate_timeline_efficiency(self, daily_schedules: List[Dict]) -> float:
        """Calculate timeline efficiency score."""
        try:
            if not daily_schedules:
                return 0.0
            
            efficiency_scores = []
            
            for schedule in daily_schedules:
                # Get timeline metrics
                timeline_metrics = schedule.get("timeline_metrics", {})
                coordination_score = timeline_metrics.get("coordination_score", 0.0)
                
                # Check for timeline optimization
                has_optimization = "timeline_optimization" in schedule
                has_conflict_resolution = "conflict_resolution" in schedule
                
                # Calculate efficiency score
                efficiency_score = coordination_score
                if has_optimization:
                    efficiency_score += 0.1
                if has_conflict_resolution:
                    efficiency_score += 0.1
                
                efficiency_scores.append(min(1.0, efficiency_score))
            
            # Overall efficiency score
            overall_efficiency = sum(efficiency_scores) / len(efficiency_scores) if efficiency_scores else 0.0
            
            return overall_efficiency
            
        except Exception as e:
            logger.error(f"Error calculating timeline efficiency: {str(e)}")
            return 0.0

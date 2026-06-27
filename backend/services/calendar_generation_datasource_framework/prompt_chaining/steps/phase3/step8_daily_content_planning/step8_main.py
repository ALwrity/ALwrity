"""
Step 8: Daily Content Planning - Main Implementation

This module orchestrates all the modular components for daily content planning.
It integrates daily schedule generation, platform optimization, timeline coordination,
content uniqueness validation, and quality metrics calculation.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger

from services.content_gap_analyzer.ai_engine_service import AIEngineService

# Import modular components
from .daily_schedule_generator import DailyScheduleGenerator
from .platform_optimizer import PlatformOptimizer
from .timeline_coordinator import TimelineCoordinator
from .content_uniqueness_validator import ContentUniquenessValidator
from .quality_metrics_calculator import QualityMetricsCalculator


class DailyContentPlanningStep:
    """
    Step 8: Daily Content Planning - Main Implementation
    
    This step creates detailed daily content schedule based on weekly themes.
    It ensures platform optimization, content uniqueness, and timeline coordination.
    
    Expected Output:
    - Daily content schedule with specific content pieces
    - Platform-specific optimizations
    - Timeline coordination and conflict resolution
    - Content uniqueness validation
    - Comprehensive quality metrics
    """
    
    def __init__(self):
        """Initialize Step 8 with all modular components."""
        self.ai_engine = AIEngineService()
        
        # Initialize modular components
        self.daily_schedule_generator = DailyScheduleGenerator()
        self.platform_optimizer = PlatformOptimizer()
        self.timeline_coordinator = TimelineCoordinator()
        self.content_uniqueness_validator = ContentUniquenessValidator()
        self.quality_metrics_calculator = QualityMetricsCalculator()
        
        logger.info("🎯 Step 8: Daily Content Planning initialized with all modular components")
    
    async def execute(
        self,
        context: Dict[str, Any],
        step_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute Step 8: Daily Content Planning.
        
        Args:
            context: Context from previous steps
            step_data: Step-specific data
            
        Returns:
            Step 8 results with daily content planning
        """
        try:
            logger.info("🚀 Starting Step 8: Daily Content Planning")
            
            # Extract required data from context using correct structure
            step_results = context.get("step_results", {})
            
            # Get weekly themes from Step 7
            step7_result = step_results.get("step_07", {})
            weekly_themes = step7_result.get("result", {}).get("weekly_themes", [])
            
            # Get platform strategies from Step 6  
            step6_result = step_results.get("step_06", {})
            platform_strategies = step6_result.get("result", {}).get("platformOptimization", {})
            
            # Get content pillars from Step 5
            step5_result = step_results.get("step_05", {})
            content_pillars = step5_result.get("result", {}).get("pillarMapping", {}).get("content_pillars", [])
            
            # Get calendar framework from Step 4
            step4_result = step_results.get("step_04", {})
            calendar_framework = step4_result.get("result", {}).get("results", {}).get("calendarStructure", {})
            
            # Get business goals and target audience from Step 1
            step1_result = step_results.get("step_01", {})
            business_goals = step1_result.get("result", {}).get("business_goals", [])
            target_audience = step1_result.get("result", {}).get("target_audience", {})
            
            # Get keywords from Step 2
            step2_result = step_results.get("step_02", {})
            keywords = step2_result.get("result", {}).get("keywords", [])
            
            # Validate required inputs
            self._validate_inputs(weekly_themes, platform_strategies, content_pillars, calendar_framework)
            
            # Get posting preferences and calendar duration
            posting_preferences = step_data.get("posting_preferences", {
                "preferred_times": ["09:00", "12:00", "15:00"],
                "posting_frequency": "daily"
            })
            calendar_duration = calendar_framework.get("duration_weeks", 4) * 7  # Convert weeks to days
            
            # Step 1: Generate daily schedules
            logger.info("📅 Step 8.1: Generating daily content schedules")
            daily_schedules = await self.daily_schedule_generator.generate_daily_schedules(
                weekly_themes, platform_strategies, content_pillars, calendar_framework,
                posting_preferences, calendar_duration
            )
            
            # Step 2: Optimize for platforms
            logger.info("🎯 Step 8.2: Optimizing content for platforms")
            platform_optimized_schedules = await self.platform_optimizer.optimize_content_for_platforms(
                daily_schedules, platform_strategies, target_audience
            )
            
            # Step 3: Coordinate timeline
            logger.info("⏰ Step 8.3: Coordinating content timeline")
            
            timeline_coordinated_schedules = await self.timeline_coordinator.coordinate_timeline(
                platform_optimized_schedules, posting_preferences, platform_strategies, calendar_duration
            )
            
            # Step 4: Validate content uniqueness
            logger.info("🔍 Step 8.4: Validating content uniqueness")
            uniqueness_validated_schedules = await self.content_uniqueness_validator.validate_content_uniqueness(
                timeline_coordinated_schedules, weekly_themes, keywords
            )
            
            # Step 5: Calculate quality metrics
            logger.info("📊 Step 8.5: Calculating comprehensive quality metrics")
            quality_metrics = await self.quality_metrics_calculator.calculate_comprehensive_quality_metrics(
                uniqueness_validated_schedules, weekly_themes, platform_strategies, business_goals, target_audience
            )
            
            # Create comprehensive results
            step_results = {
                "daily_content_schedules": uniqueness_validated_schedules,
                "quality_metrics": quality_metrics,
                "step_summary": self._create_step_summary(
                    uniqueness_validated_schedules, quality_metrics
                ),
                "step_metadata": {
                    "step_number": 8,
                    "step_name": "Daily Content Planning",
                    "execution_status": "completed",
                    "total_daily_schedules": len(uniqueness_validated_schedules),
                    "total_content_pieces": sum(
                        len(schedule.get("content_pieces", [])) for schedule in uniqueness_validated_schedules
                    ),
                    "overall_quality_score": quality_metrics.get("overall_quality_score", 0.0),
                    "quality_level": quality_metrics.get("quality_level", "Unknown")
                }
            }
            
            logger.info(f"✅ Step 8 completed successfully - {len(uniqueness_validated_schedules)} daily schedules created")
            return step_results
            
        except Exception as e:
            logger.error(f"❌ Step 8 execution failed: {str(e)}")
            raise
    
    def _validate_inputs(
        self,
        weekly_themes: List[Dict],
        platform_strategies: Dict,
        content_pillars: List[Dict],
        calendar_framework: Dict
    ) -> None:
        """Validate required inputs for Step 8."""
        try:
            if not weekly_themes:
                raise ValueError("Weekly themes from Step 7 are required for daily content planning")
            
            if not platform_strategies:
                raise ValueError("Platform strategies from Step 6 are required for daily content planning")
            
            if not content_pillars:
                raise ValueError("Content pillars from Step 5 are required for daily content planning")
            
            if not calendar_framework:
                raise ValueError("Calendar framework from Step 4 is required for daily content planning")
            
            logger.info("✅ Input validation passed for Step 8")
            
        except Exception as e:
            logger.error(f"❌ Input validation failed for Step 8: {str(e)}")
            raise
    
    def _create_step_summary(
        self,
        daily_schedules: List[Dict],
        quality_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create comprehensive step summary."""
        try:
            # Calculate summary statistics
            total_content_pieces = sum(
                len(schedule.get("content_pieces", [])) for schedule in daily_schedules
            )
            
            platform_distribution = {}
            content_type_distribution = {}
            
            for schedule in daily_schedules:
                for piece in schedule.get("content_pieces", []):
                    platform = piece.get("target_platform", "Unknown")
                    content_type = piece.get("content_type", "Unknown")
                    
                    platform_distribution[platform] = platform_distribution.get(platform, 0) + 1
                    content_type_distribution[content_type] = content_type_distribution.get(content_type, 0) + 1
            
            # Get quality summary
            overall_quality_score = quality_metrics.get("overall_quality_score", 0.0)
            quality_level = quality_metrics.get("quality_level", "Unknown")
            
            # Create summary
            summary = {
                "execution_overview": {
                    "total_daily_schedules": len(daily_schedules),
                    "total_content_pieces": total_content_pieces,
                    "average_pieces_per_day": total_content_pieces / len(daily_schedules) if daily_schedules else 0.0,
                    "calendar_duration_days": len(daily_schedules)
                },
                "content_distribution": {
                    "platform_distribution": platform_distribution,
                    "content_type_distribution": content_type_distribution
                },
                "quality_summary": {
                    "overall_quality_score": overall_quality_score,
                    "quality_level": quality_level,
                    "quality_dimensions": quality_metrics.get("quality_dimensions", {}),
                    "validation_passed": quality_metrics.get("quality_validation", {}).get("overall_validation_passed", False)
                },
                "key_achievements": [
                    f"Generated {len(daily_schedules)} comprehensive daily content schedules",
                    f"Created {total_content_pieces} optimized content pieces",
                    f"Achieved {overall_quality_score:.1%} overall quality score ({quality_level})",
                    "Applied platform-specific optimizations across all content",
                    "Implemented timeline coordination and conflict resolution",
                    "Validated content uniqueness and prevented duplicates",
                    "Calculated comprehensive quality metrics and insights"
                ],
                "next_steps": [
                    "Proceed to Step 9: Content Recommendations for additional content ideas",
                    "Review quality metrics and implement recommendations",
                    "Validate content alignment with business goals",
                    "Prepare for Phase 4 optimization steps"
                ]
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error creating step summary: {str(e)}")
            return {
                "execution_overview": {"error": "Failed to create summary"},
                "key_achievements": ["Step 8 completed with errors"],
                "next_steps": ["Review and fix implementation issues"]
            }
    
    async def get_step_description(self) -> str:
        """Get step description."""
        return """
        Step 8: Daily Content Planning
        
        This step creates detailed daily content schedules based on weekly themes and strategic inputs.
        It ensures comprehensive content planning with platform optimization, timeline coordination,
        content uniqueness validation, and quality metrics calculation.
        
        Key Features:
        - Modular architecture with specialized components
        - Platform-specific content optimization
        - Timeline coordination and conflict resolution
        - Content uniqueness validation and duplicate prevention
        - Comprehensive quality metrics and insights
        - Real AI service integration without fallbacks
        
        Output: Complete daily content schedules ready for implementation
        """
    
    async def get_step_requirements(self) -> List[str]:
        """Get step requirements."""
        return [
            "Weekly themes from Step 7",
            "Platform strategies from Step 6", 
            "Content pillars from Step 5",
            "Calendar framework from Step 4",
            "Business goals and target audience from Step 1",
            "Keywords from Step 2",
            "Posting preferences and preferences"
        ]
    
    async def get_step_outputs(self) -> List[str]:
        """Get step outputs."""
        return [
            "Daily content schedules with specific content pieces",
            "Platform-optimized content with engagement strategies",
            "Timeline-coordinated posting schedules",
            "Uniqueness-validated content with duplicate prevention",
            "Comprehensive quality metrics and insights",
            "Quality recommendations and improvement suggestions",
            "Performance indicators and validation results"
        ]

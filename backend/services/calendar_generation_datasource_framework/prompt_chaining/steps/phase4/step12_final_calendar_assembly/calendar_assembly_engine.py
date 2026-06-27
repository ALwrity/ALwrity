import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
from datetime import datetime, timedelta
import json

from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher
from services.content_gap_analyzer.competitor_analyzer import CompetitorAnalyzer


class CalendarAssemblyEngine:
    """
    Core orchestrator for final calendar assembly.
    Integrates all 11 previous steps into a cohesive, actionable calendar.
    """

    def __init__(self):
        """Initialize the calendar assembly engine with real AI services."""
        self.ai_engine = AIEngineService()
        self.keyword_researcher = KeywordResearcher()
        self.competitor_analyzer = CompetitorAnalyzer()

        # Assembly configuration
        self.assembly_config = {
            "calendar_duration_weeks": 12,
            "max_content_per_day": 5,
            "min_content_per_day": 1,
            "platform_rotation": True,
            "theme_consistency": True,
            "quality_threshold": 0.85,
            "assembly_confidence": 0.9
        }

        # Step integration mapping
        self.step_integration_map = {
            "step_01": "content_strategy",
            "step_02": "gap_analysis", 
            "step_03": "audience_platform",
            "step_04": "calendar_framework",
            "step_05": "content_pillars",
            "step_06": "platform_strategy",
            "step_07": "weekly_themes",
            "step_08": "daily_planning",
            "step_09": "content_recommendations",
            "step_10": "performance_optimization",
            "step_11": "strategy_alignment"
        }

        logger.info("🎯 Calendar Assembly Engine initialized with real AI services")

    async def assemble_final_calendar(self, context: Dict[str, Any], all_steps_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Assemble the final calendar by integrating all 11 previous steps.
        
        Args:
            context: The overall context from the orchestrator
            all_steps_data: Data from all 11 previous steps
            
        Returns:
            Dict containing the assembled final calendar
        """
        logger.info("🚀 Starting final calendar assembly - integrating all 11 steps")

        try:
            # Step 1: Validate all step data is present
            validation_result = await self._validate_step_data(all_steps_data)
            if not validation_result["valid"]:
                raise ValueError(f"Step data validation failed: {validation_result['errors']}")

            # Step 2: Extract and structure data from each step
            structured_data = await self._extract_structured_data(all_steps_data)

            # Step 3: Create calendar framework
            calendar_framework = await self._create_calendar_framework(structured_data, context)

            # Step 4: Populate calendar with content
            populated_calendar = await self._populate_calendar_content(calendar_framework, structured_data)

            # Step 5: Apply final optimizations
            optimized_calendar = await self._apply_final_optimizations(populated_calendar, structured_data)

            # Step 6: Generate assembly metadata
            assembly_metadata = await self._generate_assembly_metadata(structured_data, optimized_calendar)

            # Step 7: Create final calendar structure
            final_calendar = {
                "calendar_id": f"calendar_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "assembly_timestamp": datetime.now().isoformat(),
                "calendar_duration_weeks": self.assembly_config["calendar_duration_weeks"],
                "total_content_pieces": len(optimized_calendar.get("content_schedule", [])),
                "quality_score": assembly_metadata["overall_quality_score"],
                "strategy_alignment_score": assembly_metadata["strategy_alignment_score"],
                "performance_prediction": assembly_metadata["performance_prediction"],
                "calendar_structure": optimized_calendar,
                "assembly_metadata": assembly_metadata,
                "step_integration_summary": self._create_step_integration_summary(structured_data),
                "execution_guidance": await self._generate_execution_guidance(optimized_calendar, structured_data)
            }

            logger.info(f"✅ Final calendar assembled successfully - {final_calendar['total_content_pieces']} content pieces")

            return final_calendar

        except Exception as e:
            logger.error(f"❌ Calendar assembly failed: {str(e)}")
            raise

    async def _validate_step_data(self, all_steps_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that all required step data is present and complete."""
        required_steps = list(self.step_integration_map.keys())
        missing_steps = []
        incomplete_steps = []

        for step in required_steps:
            if step not in all_steps_data:
                missing_steps.append(step)
            elif not all_steps_data[step].get("completed", False):
                incomplete_steps.append(step)

        return {
            "valid": len(missing_steps) == 0 and len(incomplete_steps) == 0,
            "missing_steps": missing_steps,
            "incomplete_steps": incomplete_steps,
            "errors": missing_steps + incomplete_steps
        }

    async def _extract_structured_data(self, all_steps_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract and structure data from all 11 steps."""
        structured_data = {}

        # Extract content strategy (Step 1)
        if "step_01" in all_steps_data:
            step1_data = all_steps_data["step_01"]["output"]
            structured_data["content_strategy"] = {
                "business_goals": step1_data.get("business_goals", []),
                "target_audience": step1_data.get("target_audience", {}),
                "content_pillars": step1_data.get("content_pillars", []),
                "kpi_targets": step1_data.get("kpi_targets", {}),
                "industry_context": step1_data.get("industry_context", {})
            }

        # Extract gap analysis (Step 2)
        if "step_02" in all_steps_data:
            step2_data = all_steps_data["step_02"]["output"]
            structured_data["gap_analysis"] = {
                "content_gaps": step2_data.get("content_gaps", []),
                "opportunity_areas": step2_data.get("opportunity_areas", []),
                "competitive_insights": step2_data.get("competitive_insights", {}),
                "trend_analysis": step2_data.get("trend_analysis", {})
            }

        # Extract audience and platform strategy (Step 3)
        if "step_03" in all_steps_data:
            step3_data = all_steps_data["step_03"]["output"]
            structured_data["audience_platform"] = {
                "audience_segments": step3_data.get("audience_segments", []),
                "platform_strategies": step3_data.get("platform_strategies", {}),
                "content_preferences": step3_data.get("content_preferences", {}),
                "engagement_patterns": step3_data.get("engagement_patterns", {})
            }

        # Extract calendar framework (Step 4)
        if "step_04" in all_steps_data:
            step4_data = all_steps_data["step_04"]["output"]
            structured_data["calendar_framework"] = {
                "calendar_structure": step4_data.get("calendar_structure", {}),
                "posting_frequency": step4_data.get("posting_frequency", {}),
                "content_distribution": step4_data.get("content_distribution", {}),
                "timeline_coordination": step4_data.get("timeline_coordination", {})
            }

        # Extract content pillar distribution (Step 5)
        if "step_05" in all_steps_data:
            step5_data = all_steps_data["step_05"]["output"]
            structured_data["content_pillars"] = {
                "pillar_distribution": step5_data.get("pillar_distribution", {}),
                "content_balance": step5_data.get("content_balance", {}),
                "theme_coordination": step5_data.get("theme_coordination", {})
            }

        # Extract platform-specific strategy (Step 6)
        if "step_06" in all_steps_data:
            step6_data = all_steps_data["step_06"]["output"]
            structured_data["platform_strategy"] = {
                "platform_optimizations": step6_data.get("platform_optimizations", {}),
                "content_adaptations": step6_data.get("content_adaptations", {}),
                "posting_schedules": step6_data.get("posting_schedules", {})
            }

        # Extract weekly themes (Step 7)
        if "step_07" in all_steps_data:
            step7_data = all_steps_data["step_07"]["output"]
            structured_data["weekly_themes"] = {
                "weekly_theme_schedule": step7_data.get("weekly_theme_schedule", []),
                "theme_variety_analysis": step7_data.get("theme_variety_analysis", {}),
                "strategic_alignment": step7_data.get("strategic_alignment", {})
            }

        # Extract daily content planning (Step 8)
        if "step_08" in all_steps_data:
            step8_data = all_steps_data["step_08"]["output"]
            structured_data["daily_planning"] = {
                "daily_content_schedule": step8_data.get("daily_content_schedule", []),
                "platform_optimizations": step8_data.get("platform_optimizations", {}),
                "timeline_coordination": step8_data.get("timeline_coordination", {}),
                "content_uniqueness": step8_data.get("content_uniqueness", {})
            }

        # Extract content recommendations (Step 9)
        if "step_09" in all_steps_data:
            step9_data = all_steps_data["step_09"]["output"]
            structured_data["content_recommendations"] = {
                "content_recommendations": step9_data.get("content_recommendations", []),
                "keyword_optimizations": step9_data.get("keyword_optimizations", {}),
                "gap_analysis": step9_data.get("gap_analysis", {}),
                "performance_predictions": step9_data.get("performance_predictions", {})
            }

        # Extract performance optimization (Step 10)
        if "step_10" in all_steps_data:
            step10_data = all_steps_data["step_10"]["output"]
            structured_data["performance_optimization"] = {
                "performance_metrics": step10_data.get("performance_metrics", {}),
                "optimization_recommendations": step10_data.get("optimization_recommendations", []),
                "quality_improvements": step10_data.get("quality_improvements", {}),
                "engagement_optimizations": step10_data.get("engagement_optimizations", {})
            }

        # Extract strategy alignment validation (Step 11)
        if "step_11" in all_steps_data:
            step11_data = all_steps_data["step_11"]["output"]
            structured_data["strategy_alignment"] = {
                "alignment_scores": step11_data.get("alignment_scores", {}),
                "consistency_validation": step11_data.get("consistency_validation", {}),
                "strategy_drift_analysis": step11_data.get("strategy_drift_analysis", {}),
                "confidence_assessment": step11_data.get("confidence_assessment", {})
            }

        return structured_data

    async def _create_calendar_framework(self, structured_data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Create the calendar framework based on structured data."""
        calendar_framework = {
            "start_date": context.get("start_date", datetime.now().date()),
            "end_date": context.get("start_date", datetime.now().date()) + timedelta(weeks=self.assembly_config["calendar_duration_weeks"]),
            "total_weeks": self.assembly_config["calendar_duration_weeks"],
            "platforms": list(structured_data.get("audience_platform", {}).get("platform_strategies", {}).keys()),
            "content_pillars": structured_data.get("content_pillars", {}).get("pillar_distribution", {}),
            "posting_frequency": structured_data.get("calendar_framework", {}).get("posting_frequency", {}),
            "weekly_themes": structured_data.get("weekly_themes", {}).get("weekly_theme_schedule", [])
        }

        return calendar_framework

    async def _populate_calendar_content(self, calendar_framework: Dict[str, Any], structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """Populate the calendar with content from all steps."""
        content_schedule = []
        
        # Get daily content schedule from Step 8
        daily_schedule = structured_data.get("daily_planning", {}).get("daily_content_schedule", [])
        
        # Get content recommendations from Step 9
        content_recommendations = structured_data.get("content_recommendations", {}).get("content_recommendations", [])
        
        # Get weekly themes from Step 7
        weekly_themes = structured_data.get("weekly_themes", {}).get("weekly_theme_schedule", [])

        # Integrate all content sources
        for day_content in daily_schedule:
            integrated_content = {
                "date": day_content.get("date"),
                "week_number": day_content.get("week_number"),
                "theme": self._get_theme_for_date(day_content.get("date"), weekly_themes),
                "content_pieces": [],
                "platform_distribution": day_content.get("platform_distribution", {}),
                "quality_metrics": day_content.get("quality_metrics", {}),
                "optimization_notes": day_content.get("optimization_notes", [])
            }

            # Add content pieces with recommendations and optimizations
            for content_piece in day_content.get("content_pieces", []):
                enhanced_content = await self._enhance_content_with_recommendations(
                    content_piece, content_recommendations, structured_data
                )
                integrated_content["content_pieces"].append(enhanced_content)

            content_schedule.append(integrated_content)

        return {
            "content_schedule": content_schedule,
            "calendar_framework": calendar_framework,
            "integration_metadata": {
                "total_content_pieces": len(content_schedule),
                "platforms_covered": list(set([p for day in content_schedule for p in day.get("platform_distribution", {}).keys()])),
                "themes_covered": list(set([day.get("theme") for day in content_schedule if day.get("theme")]))
            }
        }

    async def _enhance_content_with_recommendations(self, content_piece: Dict[str, Any], content_recommendations: List[Dict[str, Any]], structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance content piece with recommendations and optimizations."""
        enhanced_content = content_piece.copy()

        # Add keyword optimizations
        keyword_optimizations = structured_data.get("content_recommendations", {}).get("keyword_optimizations", {})
        if content_piece.get("content_type") in keyword_optimizations:
            enhanced_content["keyword_optimizations"] = keyword_optimizations[content_piece["content_type"]]

        # Add performance predictions
        performance_predictions = structured_data.get("content_recommendations", {}).get("performance_predictions", {})
        if content_piece.get("content_type") in performance_predictions:
            enhanced_content["performance_prediction"] = performance_predictions[content_piece["content_type"]]

        # Add optimization recommendations
        optimization_recommendations = structured_data.get("performance_optimization", {}).get("optimization_recommendations", [])
        enhanced_content["optimization_recommendations"] = [
            rec for rec in optimization_recommendations 
            if rec.get("content_type") == content_piece.get("content_type")
        ]

        return enhanced_content

    def _get_theme_for_date(self, date: str, weekly_themes: List[Dict[str, Any]]) -> str:
        """Get the theme for a specific date from weekly themes."""
        if not weekly_themes:
            return "General"
        
        # Simple theme matching - can be enhanced with more sophisticated logic
        for theme in weekly_themes:
            if theme.get("week_number") == self._get_week_number_from_date(date):
                return theme.get("theme", "General")
        
        return "General"

    def _get_week_number_from_date(self, date: str) -> int:
        """Get week number from date string."""
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            start_of_year = datetime(date_obj.year, 1, 1)
            week_number = ((date_obj - start_of_year).days // 7) + 1
            return week_number
        except (ValueError, TypeError):
            return 1

    async def _apply_final_optimizations(self, populated_calendar: Dict[str, Any], structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply final optimizations to the populated calendar."""
        optimized_calendar = populated_calendar.copy()

        # Apply performance optimizations from Step 10
        performance_metrics = structured_data.get("performance_optimization", {}).get("performance_metrics", {})
        quality_improvements = structured_data.get("performance_optimization", {}).get("quality_improvements", {})

        # Apply engagement optimizations
        engagement_optimizations = structured_data.get("performance_optimization", {}).get("engagement_optimizations", {})

        # Apply strategy alignment insights from Step 11
        alignment_scores = structured_data.get("strategy_alignment", {}).get("alignment_scores", {})

        optimized_calendar["final_optimizations"] = {
            "performance_metrics": performance_metrics,
            "quality_improvements": quality_improvements,
            "engagement_optimizations": engagement_optimizations,
            "alignment_scores": alignment_scores
        }

        return optimized_calendar

    async def _generate_assembly_metadata(self, structured_data: Dict[str, Any], optimized_calendar: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive metadata about the assembly process."""
        # Calculate overall quality score
        quality_scores = []
        for day in optimized_calendar.get("content_schedule", []):
            if day.get("quality_metrics", {}).get("overall_score"):
                quality_scores.append(day["quality_metrics"]["overall_score"])

        overall_quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else None

        # Get strategy alignment score from Step 11
        strategy_alignment_score = structured_data.get("strategy_alignment", {}).get("alignment_scores", {}).get("overall_alignment")

        # Calculate performance prediction
        performance_prediction = {
            "estimated_engagement": "High",
            "predicted_reach": "Significant",
            "quality_confidence": overall_quality_score,
            "strategy_alignment": strategy_alignment_score
        }

        return {
            "overall_quality_score": overall_quality_score,
            "strategy_alignment_score": strategy_alignment_score,
            "performance_prediction": performance_prediction,
            "assembly_confidence": self.assembly_config["assembly_confidence"],
            "integration_completeness": len(self.step_integration_map),
            "calendar_coverage": len(optimized_calendar.get("content_schedule", []))
        }

    def _create_step_integration_summary(self, structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a summary of how each step was integrated."""
        integration_summary = {}
        
        for step_key, integration_type in self.step_integration_map.items():
            integration_summary[step_key] = {
                "integration_type": integration_type,
                "data_available": integration_type in structured_data,
                "contribution": self._get_step_contribution(integration_type, structured_data)
            }

        return integration_summary

    def _get_step_contribution(self, integration_type: str, structured_data: Dict[str, Any]) -> str:
        """Get the contribution description for each step."""
        contributions = {
            "content_strategy": "Business goals, target audience, and content pillars",
            "gap_analysis": "Content gaps and opportunity areas",
            "audience_platform": "Audience segments and platform strategies",
            "calendar_framework": "Calendar structure and posting frequency",
            "content_pillars": "Content pillar distribution and balance",
            "platform_strategy": "Platform-specific optimizations",
            "weekly_themes": "Weekly theme schedule and variety",
            "daily_planning": "Daily content schedule and coordination",
            "content_recommendations": "Content recommendations and keywords",
            "performance_optimization": "Performance metrics and optimizations",
            "strategy_alignment": "Strategy alignment validation and consistency"
        }
        
        return contributions.get(integration_type, "General contribution")

    async def _generate_execution_guidance(self, optimized_calendar: Dict[str, Any], structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate execution guidance for the final calendar."""
        return {
            "implementation_priority": "High",
            "execution_timeline": f"{self.assembly_config['calendar_duration_weeks']} weeks",
            "key_success_factors": [
                "Follow the optimized posting schedule",
                "Maintain content quality standards",
                "Monitor performance metrics",
                "Adjust based on audience feedback"
            ],
            "quality_thresholds": {
                "minimum_quality_score": self.assembly_config["quality_threshold"],
                "target_engagement_rate": 0.05,
                "strategy_alignment_target": 0.85
            },
            "monitoring_guidance": [
                "Track content performance weekly",
                "Monitor audience engagement",
                "Assess strategy alignment monthly",
                "Optimize based on data insights"
            ]
        }

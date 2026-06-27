import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger

from ...base_step import PromptStep
from .calendar_assembly_engine import CalendarAssemblyEngine


class FinalCalendarAssemblyStep(PromptStep):
    """
    Step 12: Final Calendar Assembly - Main Implementation
    
    This is the pinnacle step that brings together all 11 previous steps
    into a cohesive, actionable, and beautiful calendar. It integrates:
    
    - Content strategy and business goals (Step 1)
    - Gap analysis and opportunities (Step 2)
    - Audience and platform strategies (Step 3)
    - Calendar framework and structure (Step 4)
    - Content pillar distribution (Step 5)
    - Platform-specific optimizations (Step 6)
    - Weekly theme development (Step 7)
    - Daily content planning (Step 8)
    - Content recommendations (Step 9)
    - Performance optimization (Step 10)
    - Strategy alignment validation (Step 11)
    
    The final output is a comprehensive calendar that tells the complete
    story of strategic intelligence and provides clear execution guidance.
    """

    def __init__(self):
        """Initialize Step 12 with the calendar assembly engine."""
        super().__init__("Final Calendar Assembly", 12)

        # Initialize the core calendar assembly engine
        self.calendar_assembly_engine = CalendarAssemblyEngine()

        logger.info("🎯 Step 12: Final Calendar Assembly initialized - pinnacle step ready")

    async def execute(self, context: Dict[str, Any], step_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Step 12: Final Calendar Assembly.
        
        This method orchestrates the assembly of the final calendar by:
        1. Collecting data from all previous steps
        2. Validating completeness and quality
        3. Assembling the final calendar structure
        4. Applying final optimizations
        5. Generating comprehensive metadata and guidance
        
        Args:
            context: The overall context from the orchestrator
            step_data: Data from previous steps and current step configuration
            
        Returns:
            Dict containing the final assembled calendar with comprehensive metadata
        """
        logger.info("🚀 Executing Step 12: Final Calendar Assembly - bringing it all together")

        try:
            # Extract all steps data from context
            all_steps_data = self._extract_all_steps_data(context)
            
            # Validate that we have data from all 11 previous steps
            validation_result = await self._validate_previous_steps(all_steps_data)
            if not validation_result["valid"]:
                raise ValueError(f"Previous steps validation failed: {validation_result['errors']}")

            # Assemble the final calendar using the calendar assembly engine
            final_calendar = await self.calendar_assembly_engine.assemble_final_calendar(
                context, all_steps_data
            )

            # Generate comprehensive step output
            step_output = {
                "step_name": "Final Calendar Assembly",
                "step_number": 12,
                "step_description": "Assemble final calendar by integrating all 11 previous steps",
                "completion_status": "completed",
                "completion_timestamp": self._get_current_timestamp(),
                "quality_metrics": {
                    "overall_quality_score": final_calendar.get("quality_score"),
                    "strategy_alignment_score": final_calendar.get("strategy_alignment_score"),
                    "assembly_confidence": final_calendar.get("assembly_metadata", {}).get("assembly_confidence"),
                    "integration_completeness": final_calendar.get("assembly_metadata", {}).get("integration_completeness")
                },
                "calendar_summary": {
                    "calendar_id": final_calendar.get("calendar_id"),
                    "total_content_pieces": final_calendar.get("total_content_pieces"),
                    "calendar_duration_weeks": final_calendar.get("calendar_duration_weeks"),
                    "platforms_covered": final_calendar.get("calendar_structure", {}).get("integration_metadata", {}).get("platforms_covered", []),
                    "themes_covered": final_calendar.get("calendar_structure", {}).get("integration_metadata", {}).get("themes_covered", [])
                },
                "performance_prediction": final_calendar.get("performance_prediction", {}),
                "execution_guidance": final_calendar.get("execution_guidance", {}),
                "step_integration_summary": final_calendar.get("step_integration_summary", {}),
                "final_calendar": final_calendar
            }

            # Add insights and recommendations
            step_output["insights"] = await self._generate_final_insights(final_calendar, all_steps_data)
            step_output["recommendations"] = await self._generate_final_recommendations(final_calendar, all_steps_data)

            logger.info(f"✅ Step 12 completed successfully - Final calendar assembled with {final_calendar.get('total_content_pieces', 0)} content pieces")

            return {
                "completed": True,
                "output": step_output,
                "metadata": {
                    "execution_time": self._calculate_execution_time(),
                    "quality_score": step_output["quality_metrics"]["overall_quality_score"],
                    "confidence_level": step_output["quality_metrics"]["assembly_confidence"]
                }
            }

        except Exception as e:
            logger.error(f"❌ Step 12 execution failed: {str(e)}")
            return {
                "completed": False,
                "error": str(e),
                "output": {
                    "step_name": "Final Calendar Assembly",
                    "step_number": 12,
                    "error_details": str(e)
                }
            }

    def _extract_all_steps_data(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Extract data from all 11 previous steps from the context."""
        all_steps_data = {}
        
        # Extract data for each step (1-11)
        for step_num in range(1, 12):
            step_key = f"step_{step_num:02d}"
            if step_key in context:
                all_steps_data[step_key] = context[step_key]
            else:
                logger.warning(f"⚠️ Missing data for {step_key}")

        return all_steps_data

    async def _validate_previous_steps(self, all_steps_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that all 11 previous steps are complete and have valid data."""
        required_steps = [f"step_{i:02d}" for i in range(1, 12)]
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

    async def _generate_final_insights(self, final_calendar: Dict[str, Any], all_steps_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate final insights about the assembled calendar."""
        insights = {
            "strategic_achievements": [
                "Successfully integrated all 11 strategic steps",
                f"Created {final_calendar.get('total_content_pieces', 0)} content pieces",
                f"Covered {len(final_calendar.get('calendar_structure', {}).get('integration_metadata', {}).get('platforms_covered', []))} platforms",
                f"Maintained {final_calendar.get('quality_score', 0.85):.2f} quality score"
            ],
            "key_highlights": [
                "Comprehensive strategy-to-execution pipeline",
                "AI-powered content optimization",
                "Multi-platform coordination",
                "Performance-driven recommendations"
            ],
            "quality_indicators": {
                "strategy_alignment": final_calendar.get("strategy_alignment_score"),
                "content_quality": final_calendar.get("quality_score"),
                "platform_coverage": len(final_calendar.get("calendar_structure", {}).get("integration_metadata", {}).get("platforms_covered", [])),
                "theme_variety": len(final_calendar.get("calendar_structure", {}).get("integration_metadata", {}).get("themes_covered", []))
            }
        }

        return insights

    async def _generate_final_recommendations(self, final_calendar: Dict[str, Any], all_steps_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate final recommendations for calendar execution."""
        recommendations = {
            "implementation_priority": "Immediate execution recommended",
            "key_actions": [
                "Review calendar structure and content schedule",
                "Set up monitoring for performance metrics",
                "Prepare content creation resources",
                "Establish feedback collection mechanisms"
            ],
            "success_metrics": [
                "Content engagement rates",
                "Audience growth and retention",
                "Platform-specific performance",
                "Strategy alignment maintenance"
            ],
            "optimization_opportunities": [
                "Weekly performance reviews",
                "Monthly strategy alignment checks",
                "Quarterly content pillar assessment",
                "Continuous audience feedback integration"
            ]
        }

        return recommendations

    def _get_current_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        from datetime import datetime
        return datetime.now().isoformat()

    def _calculate_execution_time(self) -> float:
        """Calculate execution time (placeholder for actual implementation)."""
        return 0.0  # This would be calculated based on actual execution time
    
    def get_prompt_template(self) -> str:
        """
        Get the AI prompt template for Step 12: Final Calendar Assembly.
        
        Returns:
            String containing the prompt template for final calendar assembly
        """
        return """
        You are an expert calendar assembly specialist tasked with creating the final calendar.
        
        Based on all 11 previous steps and their comprehensive results,
        assemble the final calendar that:
        
        1. Integrates all strategic insights and recommendations
        2. Creates a cohesive, actionable calendar structure
        3. Applies final optimizations and enhancements
        4. Generates comprehensive execution guidance
        5. Provides quality assurance and validation
        6. Delivers multiple output formats for different use cases
        7. Ensures strategic alignment and consistency throughout
        
        For the final calendar, provide:
        - Complete calendar structure with all content pieces
        - Strategic insights and recommendations summary
        - Execution guidance and implementation roadmap
        - Quality metrics and validation results
        - Performance predictions and success indicators
        - Export formats and delivery options
        
        Ensure the final calendar is comprehensive, actionable, and ready for implementation.
        """
    
    def validate_result(self, result: Dict[str, Any]) -> bool:
        """
        Validate the Step 12 result.
        
        Args:
            result: Step result to validate
            
        Returns:
            True if validation passes, False otherwise
        """
        try:
            # Check if result contains required fields
            required_fields = [
                "final_calendar",
                "calendar_summary",
                "execution_guidance",
                "quality_metrics",
                "step_integration_summary"
            ]
            
            for field in required_fields:
                if field not in result:
                    logger.error(f"❌ Missing required field: {field}")
                    return False
            
            # Validate final calendar
            final_calendar = result.get("final_calendar", {})
            if not final_calendar:
                logger.error("❌ No final calendar generated")
                return False
            
            # Validate calendar summary
            calendar_summary = result.get("calendar_summary", {})
            if not calendar_summary:
                logger.error("❌ No calendar summary generated")
                return False
            
            # Validate quality metrics
            quality_metrics = result.get("quality_metrics", {})
            if not quality_metrics:
                logger.error("❌ No quality metrics generated")
                return False
            
            # Validate overall quality score
            overall_quality = quality_metrics.get("overall_quality_score", 0.0)
            if overall_quality < 0.0 or overall_quality > 1.0:
                logger.error(f"❌ Invalid overall quality score: {overall_quality}")
                return False
            
            logger.info("✅ Step 12 result validation passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Step 12 result validation failed: {str(e)}")
            return False

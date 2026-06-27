"""
Step 8: Daily Content Planning Implementation

This step creates detailed daily content schedule based on weekly themes.
It ensures platform optimization, content uniqueness, and timeline coordination.
"""

import time
from typing import Dict, Any, List, Optional
from loguru import logger
from ..base_step import PromptStep

from .step8_daily_content_planning.step8_main import DailyContentPlanningStep as MainDailyContentPlanningStep


class DailyContentPlanningStep(PromptStep):
    
    def __init__(self):
        super().__init__("Daily Content Planning", 8)
        self.main_implementation = MainDailyContentPlanningStep()
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        try:
            logger.info("Executing Step 8: Daily Content Planning")
            start_time = time.time()
            
            result = await self.main_implementation.execute(context, {})
            
            execution_time = time.time() - start_time
            quality_score = result.get("step_metadata", {}).get("overall_quality_score", 0.0)
            
            return {
                "stepNumber": 8,
                "stepName": "Daily Content Planning",
                "status": "completed",
                "results": result,
                "qualityScore": quality_score,
                "executionTime": f"{execution_time:.1f}s"
            }
            
        except Exception as e:
            logger.error(f"Step 8 execution failed: {str(e)}")
            return {
                "stepNumber": 8,
                "stepName": "Daily Content Planning",
                "status": "error",
                "error_message": str(e),
                "qualityScore": 0.0,
                "executionTime": "0.0s"
            }
    
    def get_prompt_template(self) -> str:
        """Get the AI prompt template for Step 8."""
        return """
        You are an expert content strategist specializing in daily content planning.
        
        CONTEXT:
        - Weekly themes: {weekly_themes}
        - Platform strategies: {platform_strategies}
        - Content pillars: {content_pillars}
        - Calendar framework: {calendar_framework}
        
        TASK:
        Create detailed daily content schedules based on weekly themes.
        Ensure platform optimization, timeline coordination, and content uniqueness.
        
        OUTPUT:
        Return structured daily content schedules with specific content pieces,
        platform optimizations, and quality metrics.
        """
    
    def validate_result(self, result: Dict[str, Any]) -> bool:
        """Validate Step 8 result."""
        try:
            if not result or "error" in result:
                return False
            
            # Check for required fields
            required_fields = ["stepNumber", "stepName", "results"]
            for field in required_fields:
                if field not in result:
                    logger.error(f"❌ Step 8 validation failed: Missing {field}")
                    return False
            
            logger.info("✅ Step 8 result validation passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Step 8 validation error: {str(e)}")
            return False

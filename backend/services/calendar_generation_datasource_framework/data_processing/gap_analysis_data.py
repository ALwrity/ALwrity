"""
Gap Analysis Data Processor

Extracted from calendar_generator_service.py to improve maintainability
and align with 12-step implementation plan.

NO MOCK DATA - Only real data sources allowed.
"""

from typing import Dict, Any, List
from loguru import logger

import sys
import os

# Add the services directory to the path for proper imports
services_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if services_dir not in sys.path:
    sys.path.insert(0, services_dir)

# Import real services - NO FALLBACKS
from services.content_planning_db import ContentPlanningDBService

logger.info("✅ Successfully imported real data processing services")


class GapAnalysisDataProcessor:
    """Process gap analysis data for 12-step prompt chaining."""
    
    def __init__(self):
        self.content_planning_db_service = None  # Will be injected
    
    async def get_gap_analysis_data(self, user_id: int) -> Dict[str, Any]:
        """Get gap analysis data from database for 12-step prompt chaining."""
        try:
            logger.info(f"🔍 Retrieving gap analysis data for user {user_id}")
            
            # Check if database service is available
            if self.content_planning_db_service is None:
                raise ValueError("ContentPlanningDBService not available - cannot retrieve gap analysis data")
            
            # Get gap analysis data from database
            gap_analyses = await self.content_planning_db_service.get_user_content_gap_analyses(user_id)
            
            if not gap_analyses:
                raise ValueError(f"No gap analysis data found for user_id: {user_id}")
            
            # Get the latest gap analysis (highest ID) — safe against empty sequence
            latest_analysis = max(gap_analyses, key=lambda x: x.id, default=None)
            
            if not latest_analysis:
                raise ValueError(f"No gap analysis results found for user_id: {user_id}")
            
            # Convert to dictionary for processing
            analysis_dict = latest_analysis.to_dict() if hasattr(latest_analysis, 'to_dict') else {
                'id': latest_analysis.id,
                'user_id': latest_analysis.user_id,
                'analysis_results': latest_analysis.analysis_results,
                'recommendations': latest_analysis.recommendations,
                'created_at': latest_analysis.created_at.isoformat() if latest_analysis.created_at else None
            }
            
            # Extract and structure gap analysis data
            gap_analysis_data = {
                "content_gaps": analysis_dict.get("analysis_results", {}).get("content_gaps", []),
                "keyword_opportunities": analysis_dict.get("analysis_results", {}).get("keyword_opportunities", []),
                "competitor_insights": analysis_dict.get("analysis_results", {}).get("competitor_insights", []),
                "recommendations": analysis_dict.get("recommendations", []),
                "opportunities": analysis_dict.get("analysis_results", {}).get("opportunities", [])
            }
            
            # Validate that we have meaningful data
            if not gap_analysis_data["content_gaps"] and not gap_analysis_data["keyword_opportunities"]:
                raise ValueError(f"Gap analysis data is empty for user_id: {user_id}")
            
            logger.info(f"✅ Successfully retrieved gap analysis data for user {user_id}")
            return gap_analysis_data
            
        except Exception as e:
            logger.error(f"❌ Error getting gap analysis data: {str(e)}")
            raise Exception(f"Failed to get gap analysis data: {str(e)}")

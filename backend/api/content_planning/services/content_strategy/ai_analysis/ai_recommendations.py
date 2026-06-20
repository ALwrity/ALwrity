"""
AI Recommendations Service
AI recommendation generation and analysis.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

# Import database models
from models.enhanced_strategy_models import EnhancedContentStrategy, EnhancedAIAnalysisResult

# Import modular components
from .prompt_engineering import PromptEngineeringService
from .quality_validation import QualityValidationService

logger = logging.getLogger(__name__)

class AIRecommendationsService:
    """Service for AI recommendation generation."""

    def __init__(self):
        self.prompt_engineering_service = PromptEngineeringService()
        self.quality_validation_service = QualityValidationService()
        
        # Analysis types for comprehensive recommendations
        self.analysis_types = [
            'comprehensive_strategy',
            'audience_intelligence', 
            'competitive_intelligence',
            'performance_optimization',
            'content_calendar_optimization'
        ]
    
    async def _call_ai_service(self, prompt: str, analysis_type: str) -> Dict[str, Any]:
        """Call AI service to generate recommendations."""
        try:
            # Import AI service manager
            from services.ai_service_manager import AIServiceManager
            
            # Initialize AI service
            ai_service = AIServiceManager()
            
            # Generate AI response based on analysis type
            if analysis_type == "strategic_intelligence":
                response = await ai_service.generate_strategic_intelligence({
                    "prompt": prompt,
                    "analysis_type": analysis_type
                })
            elif analysis_type == "content_recommendations":
                response = await ai_service.generate_content_recommendations({
                    "prompt": prompt,
                    "analysis_type": analysis_type
                })
            elif analysis_type == "market_analysis":
                response = await ai_service.generate_market_position_analysis({
                    "prompt": prompt,
                    "analysis_type": analysis_type
                })
            else:
                # Default to strategic intelligence
                response = await ai_service.generate_strategic_intelligence({
                    "prompt": prompt,
                    "analysis_type": analysis_type
                })
            
            return response
            
        except Exception as e:
            logger.error(f"Error calling AI service: {str(e)}")
            raise Exception(f"Failed to generate AI recommendations: {str(e)}")
    
    def _parse_ai_response(self, ai_response: Dict[str, Any], analysis_type: str) -> Dict[str, Any]:
        return ai_response  # parsing now handled downstream

    def get_output_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "required": ["strategy_brief", "channels", "pillars", "plan_30_60_90", "kpis"],
            "properties": {
                "strategy_brief": {"type": "object"},
                "channels": {"type": "array", "items": {"type": "object"}},
                "pillars": {"type": "array", "items": {"type": "object"}},
                "plan_30_60_90": {"type": "object"},
                "kpis": {"type": "object"},
                "citations": {"type": "array", "items": {"type": "object"}}
            }
        }

    async def generate_comprehensive_ai_recommendations(self, strategy: EnhancedContentStrategy, db: Session) -> None:
        try:
            # Build centralized prompts per analysis type
            prompt = self.prompt_engineering_service.create_specialized_prompt(strategy, "comprehensive_strategy")
            raw = await self._call_ai_service(prompt, "strategic_intelligence")
            # Validate against schema
            schema = self.get_output_schema()
            self.quality_validation_service.validate_against_schema(raw, schema)
            # Persist
            result = EnhancedAIAnalysisResult(
                strategy_id=strategy.id,
                analysis_type="comprehensive_strategy",
                result_json=raw,
                created_at=datetime.utcnow()
            )
            db.add(result)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Comprehensive recommendation generation failed: {str(e)}")
            raise
    
    async def _generate_specialized_recommendations(self, strategy: EnhancedContentStrategy, analysis_type: str, db: Session) -> Dict[str, Any]:
        """Generate specialized recommendations using specific AI prompts."""
        try:
            # Prepare strategy data for AI analysis
            strategy_data = strategy.to_dict()
            
            # Create prompt based on analysis type
            prompt = self.prompt_engineering_service.create_specialized_prompt(strategy, analysis_type)
            
            # Generate AI response
            ai_response = await self._call_ai_service(prompt, analysis_type)
            
            # Parse and structure the response
            structured_response = self._parse_ai_response(ai_response, analysis_type)
            
            return structured_response
            
        except Exception as e:
            logger.error(f"Error generating {analysis_type} recommendations: {str(e)}")
            # Raise exception instead of returning fallback data
            raise Exception(f"Failed to generate {analysis_type} recommendations: {str(e)}")
    
    async def get_latest_ai_analysis(self, strategy_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """Get latest AI analysis for a strategy."""
        try:
            analysis = db.query(EnhancedAIAnalysisResult).filter(
                EnhancedAIAnalysisResult.strategy_id == strategy_id
            ).order_by(EnhancedAIAnalysisResult.created_at.desc()).first()
            
            return analysis.to_dict() if analysis else None
            
        except Exception as e:
            logger.error(f"Error getting latest AI analysis: {str(e)}")
            return None 
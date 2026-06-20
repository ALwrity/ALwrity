"""
Enhanced Strategy Service - Facade Module
Thin facade that orchestrates modular content strategy components.
This service delegates to specialized modules for better maintainability.
"""

import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from sqlalchemy.orm import Session

# Import core strategy service
from .content_strategy.core.strategy_service import EnhancedStrategyService as CoreStrategyService

# Import utilities
from ..utils.error_handlers import ContentPlanningErrorHandler
from ..utils.response_builders import ResponseBuilder
from ..utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

logger = logging.getLogger(__name__)


class EnhancedStrategyService:
    """
    Enhanced Strategy Service - Facade Implementation
    
    This is a thin facade that orchestrates the modular content strategy components.
    All core functionality has been moved to specialized modules:
    - Core logic: content_strategy.core.strategy_service
    - Data processing: content_strategy.utils.data_processors
    - AI analysis: content_strategy.ai_analysis.strategy_analyzer
    - Strategy utilities: content_strategy.utils.strategy_utils
    """

    def __init__(self, db_service: Optional[Any] = None):
        """Initialize the enhanced strategy service facade."""
        self.core_service = CoreStrategyService(db_service)
        self.db_service = db_service
        
        # Performance optimization settings
        self.quality_thresholds = {
            'min_confidence': 0.7,
            'min_completeness': 0.8,
            'max_response_time': 30.0  # seconds
        }
        
        # Performance optimization settings
        self.cache_settings = {
            'ai_analysis_cache_ttl': 3600,  # 1 hour
            'onboarding_data_cache_ttl': 1800,  # 30 minutes
            'strategy_cache_ttl': 7200,  # 2 hours
            'max_cache_size': 1000  # Maximum cached items
        }
        
        # Performance monitoring
        self.performance_metrics = {
            'response_times': [],
            'cache_hit_rates': {},
            'error_rates': {},
            'throughput_metrics': {}
        }

    async def create_enhanced_strategy(self, strategy_data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Create a new enhanced content strategy - delegates to core service."""
        return await self.core_service.create_enhanced_strategy(strategy_data, db)
    
    async def get_enhanced_strategies(self, user_id: Optional[str] = None, strategy_id: Optional[int] = None, db: Session = None) -> Dict[str, Any]:
        """Get enhanced content strategies - delegates to core service."""
        return await self.core_service.get_enhanced_strategies(user_id, strategy_id, db)

    async def _enhance_strategy_with_onboarding_data(self, strategy: Any, user_id: str, db: Session) -> None:
        """Enhance strategy with onboarding data - delegates to core service."""
        return await self.core_service._enhance_strategy_with_onboarding_data(strategy, user_id, db)

    async def _generate_comprehensive_ai_recommendations(self, strategy: Any, db: Session, user_id: Optional[str] = None) -> None:
        """Generate comprehensive AI recommendations - delegates to core service."""
        # Extract user_id from strategy if not provided
        if not user_id and hasattr(strategy, 'user_id'):
            user_id = str(strategy.user_id)
        return await self.core_service.strategy_analyzer.generate_comprehensive_ai_recommendations(strategy, db, user_id=user_id)

    async def _generate_specialized_recommendations(self, strategy: Any, analysis_type: str, db: Session) -> Dict[str, Any]:
        """Generate specialized recommendations - delegates to core service."""
        return await self.core_service.strategy_analyzer.generate_specialized_recommendations(strategy, analysis_type, db)

    def _create_specialized_prompt(self, strategy: Any, analysis_type: str) -> str:
        """Create specialized AI prompts - delegates to core service."""
        return self.core_service.strategy_analyzer.create_specialized_prompt(strategy, analysis_type)
    
    async def _call_ai_service(self, prompt: str, analysis_type: str) -> Dict[str, Any]:
        """Call AI service - delegates to core service."""
        return await self.core_service.strategy_analyzer.call_ai_service(prompt, analysis_type)
    
    def _parse_ai_response(self, ai_response: Dict[str, Any], analysis_type: str) -> Dict[str, Any]:
        """Parse AI response - delegates to core service."""
        return self.core_service.strategy_analyzer.parse_ai_response(ai_response, analysis_type)

    def _extract_content_preferences_from_style(self, writing_style: Dict[str, Any]) -> Dict[str, Any]:
        """Extract content preferences from writing style - delegates to core service."""
        from .content_strategy.utils.strategy_utils import extract_content_preferences_from_style
        return extract_content_preferences_from_style(writing_style)
    
    def _extract_brand_voice_from_guidelines(self, style_guidelines: Dict[str, Any]) -> Dict[str, Any]:
        """Extract brand voice from style guidelines - delegates to core service."""
        from .content_strategy.utils.strategy_utils import extract_brand_voice_from_guidelines
        return extract_brand_voice_from_guidelines(style_guidelines)
    
    def _extract_editorial_guidelines_from_style(self, writing_style: Dict[str, Any]) -> Dict[str, Any]:
        """Extract editorial guidelines from writing style - delegates to core service."""
        from .content_strategy.utils.strategy_utils import extract_editorial_guidelines_from_style
        return extract_editorial_guidelines_from_style(writing_style)
    
    def _create_field_mappings(self) -> Dict[str, str]:
        """Create field mappings - delegates to core service."""
        from .content_strategy.utils.strategy_utils import create_field_mappings
        return create_field_mappings()
    
    def _calculate_data_quality_scores(self, data_sources: Dict[str, Any]) -> Dict[str, float]:
        """Calculate data quality scores - delegates to core service."""
        from .content_strategy.utils.strategy_utils import calculate_data_quality_scores
        return calculate_data_quality_scores(data_sources)
    
    def _calculate_confidence_levels(self, auto_populated_fields: Dict[str, str]) -> Dict[str, float]:
        """Calculate confidence levels - deprecated, delegates to core service."""
        # deprecated; not used
        raise RuntimeError("Deprecated: use AutoFillService.quality")

    def _calculate_confidence_levels_from_data(self, data_sources: Dict[str, Any]) -> Dict[str, float]:
        """Calculate confidence levels from data - deprecated, delegates to core service."""
        # deprecated; not used
        raise RuntimeError("Deprecated: use AutoFillService.quality")

    def _calculate_data_freshness(self, onboarding_data: Union[Any, Dict[str, Any]]) -> Dict[str, str]:
        """Calculate data freshness - deprecated, delegates to core service."""
        # deprecated; not used
        raise RuntimeError("Deprecated: use AutoFillService.quality")
    
    def _calculate_strategic_scores(self, ai_recommendations: Dict[str, Any]) -> Dict[str, float]:
        """Calculate strategic performance scores - delegates to core service."""
        from .content_strategy.utils.strategy_utils import calculate_strategic_scores
        return calculate_strategic_scores(ai_recommendations)
    
    def _extract_market_positioning(self, ai_recommendations: Dict[str, Any]) -> Dict[str, Any]:
        """Extract market positioning - delegates to core service."""
        from .content_strategy.utils.strategy_utils import extract_market_positioning
        return extract_market_positioning(ai_recommendations)
    
    def _extract_competitive_advantages(self, ai_recommendations: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract competitive advantages - delegates to core service."""
        from .content_strategy.utils.strategy_utils import extract_competitive_advantages
        return extract_competitive_advantages(ai_recommendations)
    
    def _extract_strategic_risks(self, ai_recommendations: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract strategic risks - delegates to core service."""
        from .content_strategy.utils.strategy_utils import extract_strategic_risks
        return extract_strategic_risks(ai_recommendations)
    
    def _extract_opportunity_analysis(self, ai_recommendations: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract opportunity analysis - delegates to core service."""
        from .content_strategy.utils.strategy_utils import extract_opportunity_analysis
        return extract_opportunity_analysis(ai_recommendations)
    
    async def _get_latest_ai_analysis(self, strategy_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """Get latest AI analysis - delegates to core service."""
        return await self.core_service.strategy_analyzer.get_latest_ai_analysis(strategy_id, db)
    
    async def _get_onboarding_integration(self, strategy_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """Get onboarding integration - delegates to core service."""
        return await self.core_service.strategy_analyzer.get_onboarding_integration(strategy_id, db)

    async def _get_onboarding_data(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive onboarding data - delegates to core service.
        
        Args:
            user_id: Clerk user ID (string format, e.g., 'user_xxx')
        """
        return await self.core_service.data_processor_service.get_onboarding_data(user_id)

    def _transform_onboarding_data_to_fields(self, processed_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform onboarding data to fields - delegates to core service."""
        return self.core_service.data_processor_service.transform_onboarding_data_to_fields(processed_data)

    def _get_data_sources(self, processed_data: Dict[str, Any]) -> Dict[str, str]:
        """Get data sources - delegates to core service."""
        return self.core_service.data_processor_service.get_data_sources(processed_data)

    def _get_detailed_input_data_points(self, processed_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get detailed input data points - delegates to core service."""
        return self.core_service.data_processor_service.get_detailed_input_data_points(processed_data)

    async def _get_website_analysis_data(self, user_id: int) -> Dict[str, Any]:
        """Get website analysis data - delegates to core service."""
        return await self.core_service.data_processor_service.get_website_analysis_data(user_id)

    async def _get_research_preferences_data(self, user_id: int) -> Dict[str, Any]:
        """Get research preferences data - delegates to core service."""
        return await self.core_service.data_processor_service.get_research_preferences_data(user_id)

    async def _get_api_keys_data(self, user_id: int) -> Dict[str, Any]:
        """Get API keys data - delegates to core service."""
        return await self.core_service.data_processor_service.get_api_keys_data(user_id)

    async def _process_website_analysis(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process website analysis - delegates to core service."""
        return await self.core_service.data_processor_service.process_website_analysis(website_data)

    async def _process_research_preferences(self, research_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process research preferences - delegates to core service."""
        return await self.core_service.data_processor_service.process_research_preferences(research_data)

    async def _process_api_keys_data(self, api_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process API keys data - delegates to core service."""
        return await self.core_service.data_processor_service.process_api_keys_data(api_data)

    def _initialize_caches(self) -> None:
        """Initialize caches - delegates to core service."""
        # This is now handled by the core service
        pass

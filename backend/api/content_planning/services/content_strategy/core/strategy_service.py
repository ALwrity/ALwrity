"""
Enhanced Strategy Service - Core Module
Main orchestration service for content strategy operations.
"""

import logging
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from sqlalchemy.orm import Session

# Import database models
from models.enhanced_strategy_models import EnhancedContentStrategy, EnhancedAIAnalysisResult, OnboardingDataIntegration

# Import modular services
from ..ai_analysis.ai_recommendations import AIRecommendationsService
from ..ai_analysis.prompt_engineering import PromptEngineeringService
from ..ai_analysis.quality_validation import QualityValidationService
from ..ai_analysis.strategy_analyzer import StrategyAnalyzer

# Import onboarding services
from ..onboarding.data_integration import OnboardingDataIntegrationService
from ..onboarding.field_transformation import FieldTransformationService
from ..onboarding.data_quality import DataQualityService

# Import performance services
from ..performance.caching import CachingService
from ..performance.optimization import PerformanceOptimizationService
from ..performance.health_monitoring import HealthMonitoringService

# Import utils services
from ..utils.data_processors import DataProcessorService
from ..utils.validators import ValidationService
from ..utils.strategy_utils import (
    extract_content_preferences_from_style,
    extract_brand_voice_from_guidelines,
    extract_editorial_guidelines_from_style,
    create_field_mappings,
    calculate_data_quality_scores
)

# Import core components
from .field_mappings import STRATEGIC_INPUT_FIELDS
from .constants import SERVICE_CONSTANTS

logger = logging.getLogger(__name__)

class EnhancedStrategyService:
    """Enhanced content strategy service with modular architecture."""

    def __init__(self, db_service: Optional[Any] = None):
        # Store db_service for compatibility
        self.db_service = db_service
        
        # Initialize AI analysis services
        self.ai_recommendations_service = AIRecommendationsService()
        self.prompt_engineering_service = PromptEngineeringService()
        self.quality_validation_service = QualityValidationService()
        self.strategy_analyzer = StrategyAnalyzer()

        # Initialize onboarding services
        self.onboarding_data_service = OnboardingDataIntegrationService()
        self.field_transformation_service = FieldTransformationService()
        self.data_quality_service = DataQualityService()

        # Initialize performance services
        self.caching_service = CachingService()
        self.performance_optimization_service = PerformanceOptimizationService()
        self.health_monitoring_service = HealthMonitoringService()

        # Initialize utils services
        self.data_processor_service = DataProcessorService()
        self.validation_service = ValidationService()

    async def create_enhanced_strategy(self, strategy_data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Create a new enhanced content strategy with 30+ strategic inputs."""
        try:
            logger.info(f"Creating enhanced content strategy: {strategy_data.get('name', 'Unknown')}")
            
            # Extract user_id from strategy_data
            user_id = strategy_data.get('user_id')
            if not user_id:
                raise ValueError("user_id is required for creating enhanced strategy")
            
            # Create the enhanced strategy
            enhanced_strategy = EnhancedContentStrategy(
                user_id=user_id,
                name=strategy_data.get('name', 'Enhanced Content Strategy'),
                industry=strategy_data.get('industry'),
                
                # Business Context
                business_objectives=strategy_data.get('business_objectives'),
                target_metrics=strategy_data.get('target_metrics'),
                content_budget=strategy_data.get('content_budget'),
                team_size=strategy_data.get('team_size'),
                implementation_timeline=strategy_data.get('implementation_timeline'),
                market_share=strategy_data.get('market_share'),
                competitive_position=strategy_data.get('competitive_position'),
                performance_metrics_data=strategy_data.get('performance_metrics'),
                
                # Audience Intelligence
                content_preferences=strategy_data.get('content_preferences'),
                consumption_patterns=strategy_data.get('consumption_patterns'),
                audience_pain_points=strategy_data.get('audience_pain_points'),
                buying_journey=strategy_data.get('buying_journey'),
                seasonal_trends=strategy_data.get('seasonal_trends'),
                engagement_metrics=strategy_data.get('engagement_metrics'),
                
                # Competitive Intelligence
                top_competitors=strategy_data.get('top_competitors'),
                competitor_content_strategies=strategy_data.get('competitor_content_strategies'),
                market_gaps=strategy_data.get('market_gaps'),
                industry_trends=strategy_data.get('industry_trends'),
                emerging_trends=strategy_data.get('emerging_trends'),
                
                # Content Strategy
                preferred_formats=strategy_data.get('preferred_formats'),
                content_mix=strategy_data.get('content_mix'),
                content_frequency=strategy_data.get('content_frequency'),
                optimal_timing=strategy_data.get('optimal_timing'),
                quality_metrics=strategy_data.get('quality_metrics'),
                editorial_guidelines=strategy_data.get('editorial_guidelines'),
                brand_voice=strategy_data.get('brand_voice'),
                
                # Performance & Analytics
                traffic_sources=strategy_data.get('traffic_sources'),
                conversion_rates=strategy_data.get('conversion_rates'),
                content_roi_targets=strategy_data.get('content_roi_targets'),
                ab_testing_capabilities=strategy_data.get('ab_testing_capabilities', False),
                
                # Legacy fields
                target_audience=strategy_data.get('target_audience'),
                content_pillars=strategy_data.get('content_pillars'),
                ai_recommendations=strategy_data.get('ai_recommendations')
            )
            
            # Calculate completion percentage
            enhanced_strategy.calculate_completion_percentage()
            
            # Add to database
            db.add(enhanced_strategy)
            db.commit()
            db.refresh(enhanced_strategy)
            
            # Integrate onboarding data if available
            await self._enhance_strategy_with_onboarding_data(enhanced_strategy, user_id, db)
            
            # Generate comprehensive AI recommendations
            try:
                # Generate AI recommendations without timeout (allow natural processing time)
                # Pass user_id for subscription checks
                await self.strategy_analyzer.generate_comprehensive_ai_recommendations(
                    enhanced_strategy, 
                    db, 
                    user_id=str(user_id)  # ✅ Pass user_id for subscription checks
                )
                logger.info(f"✅ AI recommendations generated successfully for strategy: {enhanced_strategy.id}")
            except Exception as e:
                logger.warning(f"⚠️ AI recommendations generation failed for strategy: {enhanced_strategy.id}: {str(e)} - continuing without AI recommendations")
                # Continue without AI recommendations
            
            # Cache the strategy
            await self.caching_service.cache_strategy(enhanced_strategy.id, enhanced_strategy.to_dict())
            
            logger.info(f"✅ Enhanced strategy created successfully: {enhanced_strategy.id}")
            
            return {
                "status": "success",
                "message": "Enhanced content strategy created successfully",
                "strategy": enhanced_strategy.to_dict(),
                "strategy_id": enhanced_strategy.id,
                "completion_percentage": enhanced_strategy.completion_percentage
            }
            
        except Exception as e:
            logger.error(f"❌ Error creating enhanced strategy: {str(e)}")
            db.rollback()
            raise

    async def get_enhanced_strategies(self, user_id: Optional[str] = None, strategy_id: Optional[int] = None, db: Session = None) -> Dict[str, Any]:
        """Get enhanced content strategies with comprehensive data and AI recommendations."""
        try:
            logger.info(f"🚀 Starting enhanced strategy analysis for user: {user_id}, strategy: {strategy_id}")
            
            # Use db_service if available, otherwise use direct db
            if self.db_service and hasattr(self.db_service, 'db'):
                # Use db_service methods
                if strategy_id:
                    strategy = await self.db_service.get_enhanced_strategy(strategy_id)
                    strategies = [strategy] if strategy else []
                else:
                    strategies = await self.db_service.get_enhanced_strategies(user_id)
            else:
                # Fallback to direct db access
                if not db:
                    raise ValueError("Database session is required when db_service is not available")
                
                # Build query
                query = db.query(EnhancedContentStrategy)
                
                if user_id:
                    query = query.filter(EnhancedContentStrategy.user_id == user_id)
                
                if strategy_id:
                    query = query.filter(EnhancedContentStrategy.id == strategy_id)
                
                # Get strategies
                strategies = query.all()
            
            if not strategies:
                logger.warning("⚠️ No enhanced strategies found")
                return {
                    "status": "not_found",
                    "message": "No enhanced content strategies found",
                    "strategies": [],
                    "total_count": 0,
                    "user_id": user_id
                }
            
            # Process each strategy
            enhanced_strategies = []
            for strategy in strategies:
                # Calculate completion percentage
                if hasattr(strategy, 'calculate_completion_percentage'):
                    strategy.calculate_completion_percentage()
                
                # Get AI analysis results
                ai_analysis = await self.strategy_analyzer.get_latest_ai_analysis(strategy.id, db) if db else None
                
                # Get onboarding data integration
                onboarding_integration = await self.strategy_analyzer.get_onboarding_integration(strategy.id, db) if db else None
                
                strategy_dict = strategy.to_dict() if hasattr(strategy, 'to_dict') else {
                    'id': strategy.id,
                    'name': strategy.name,
                    'industry': strategy.industry,
                    'user_id': strategy.user_id,
                    'created_at': strategy.created_at.isoformat() if strategy.created_at else None,
                    'updated_at': strategy.updated_at.isoformat() if strategy.updated_at else None
                }
                
                strategy_dict.update({
                    'ai_analysis': ai_analysis,
                    'onboarding_integration': onboarding_integration,
                    'completion_percentage': getattr(strategy, 'completion_percentage', 0)
                })
                
                enhanced_strategies.append(strategy_dict)
            
            logger.info(f"✅ Retrieved {len(enhanced_strategies)} enhanced strategies")
            
            return {
                "status": "success",
                "message": "Enhanced content strategies retrieved successfully",
                "strategies": enhanced_strategies,
                "total_count": len(enhanced_strategies),
                "user_id": user_id
            }
            
        except Exception as e:
            logger.error(f"❌ Error retrieving enhanced strategies: {str(e)}")
            raise

    async def _enhance_strategy_with_onboarding_data(self, strategy: EnhancedContentStrategy, user_id: str, db: Session) -> None:
        """Enhance strategy with intelligent auto-population from canonical onboarding data."""
        try:
            logger.info(f"Enhancing strategy with onboarding data for user: {user_id}")

            integrated_data = await self.onboarding_data_service.process_onboarding_data(user_id, db)
            canonical_profile = integrated_data.get('canonical_profile') or {}

            website_analysis = integrated_data.get('website_analysis') or {}
            research_preferences = integrated_data.get('research_preferences') or {}
            competitor_analysis = integrated_data.get('competitor_analysis') or []
            api_keys_data = integrated_data.get('api_keys_data') or {}

            auto_populated_fields = {}
            data_sources = {}

            # Prioritize Canonical Profile for merged insights
            if canonical_profile:
                if canonical_profile.get('target_audience'):
                    strategy.target_audience = canonical_profile.get('target_audience')
                    auto_populated_fields['target_audience'] = 'canonical_profile'
                
                if canonical_profile.get('industry'):
                    strategy.industry = canonical_profile.get('industry')
                    auto_populated_fields['industry'] = 'canonical_profile'

                if canonical_profile.get('content_types'):
                    strategy.preferred_formats = canonical_profile.get('content_types')
                    auto_populated_fields['preferred_formats'] = 'canonical_profile'

            if isinstance(website_analysis, dict) and website_analysis:
                writing_style = website_analysis.get('writing_style') or {}
                if isinstance(writing_style, dict) and writing_style:
                    strategy.content_preferences = extract_content_preferences_from_style(writing_style)
                    auto_populated_fields['content_preferences'] = 'website_analysis'

                # Fallback to website_analysis if not in canonical_profile
                if 'target_audience' not in auto_populated_fields:
                    target_audience = website_analysis.get('target_audience')
                    if target_audience:
                        strategy.target_audience = target_audience
                        auto_populated_fields['target_audience'] = 'website_analysis'

                style_guidelines = website_analysis.get('style_guidelines') or {}
                if isinstance(style_guidelines, dict) and style_guidelines:
                    strategy.brand_voice = extract_brand_voice_from_guidelines(style_guidelines)
                    auto_populated_fields['brand_voice'] = 'website_analysis'

                data_sources['website_analysis'] = website_analysis

            if isinstance(research_preferences, dict) and research_preferences:
                # Fallback to research_preferences if not in canonical_profile
                if 'preferred_formats' not in auto_populated_fields:
                    content_types = research_preferences.get('content_types')
                    if content_types:
                        strategy.preferred_formats = content_types
                        auto_populated_fields['preferred_formats'] = 'research_preferences'

                prefs_writing_style = research_preferences.get('writing_style') or {}
                if isinstance(prefs_writing_style, dict) and prefs_writing_style:
                    strategy.editorial_guidelines = extract_editorial_guidelines_from_style(prefs_writing_style)
                    auto_populated_fields['editorial_guidelines'] = 'research_preferences'

                data_sources['research_preferences'] = research_preferences

            # Integrate Competitor Analysis (Step 3)
            if competitor_analysis:
                competitors = []
                for comp in competitor_analysis:
                    # Prefer domain, then title, then url
                    # Handle both dict and object (though integrated_data usually returns dicts via to_dict)
                    if isinstance(comp, dict):
                        name = comp.get('competitor_domain') or comp.get('title') or comp.get('competitor_url')
                    else:
                        name = getattr(comp, 'competitor_domain', None) or getattr(comp, 'competitor_url', None)
                    
                    if name:
                        competitors.append(name)
                
                if competitors:
                    # Limit to top 10 to avoid overwhelming the strategy
                    strategy.top_competitors = competitors[:10]
                    auto_populated_fields['top_competitors'] = 'competitor_analysis'
                    data_sources['competitor_analysis'] = competitor_analysis

            integration = OnboardingDataIntegration(
                user_id=user_id,
                strategy_id=strategy.id,
                website_analysis_data=data_sources.get('website_analysis'),
                research_preferences_data=data_sources.get('research_preferences'),
                api_keys_data=api_keys_data,
                auto_populated_fields=auto_populated_fields,
                field_mappings=create_field_mappings(),
                data_quality_scores=calculate_data_quality_scores(data_sources),
                confidence_levels={},
                data_freshness={}
            )

            db.add(integration)
            db.commit()

            strategy.onboarding_data_used = {
                'auto_populated_fields': auto_populated_fields,
                'data_sources': list(data_sources.keys()),
                'integration_id': integration.id
            }

            logger.info(f"Strategy enhanced with onboarding data: {len(auto_populated_fields)} fields auto-populated")

        except Exception as e:
            logger.error(f"Error enhancing strategy with onboarding data: {str(e)}")
            # Don't raise error, just log it as this is enhancement, not core functionality

    async def create_enhanced_strategy_legacy(self, strategy_data: Dict[str, Any], user_id: int, db: Session) -> EnhancedContentStrategy:
        """Create enhanced content strategy with all integrations (legacy method for compatibility)."""
        try:
            logger.info(f"Creating enhanced strategy for user: {user_id}")

            # Validate strategy data
            validation_result = self.validation_service.validate_strategy_data(strategy_data)
            if not validation_result['is_valid']:
                logger.error(f"Strategy validation failed: {validation_result['errors']}")
                raise ValueError(f"Invalid strategy data: {'; '.join(validation_result['errors'])}")

            # Process onboarding data
            onboarding_data = await self._process_onboarding_data(user_id, db)
            
            # Transform onboarding data to fields
            field_transformations = self.field_transformation_service.transform_onboarding_data_to_fields(onboarding_data)
            
            # Merge strategy data with onboarding data
            enhanced_strategy_data = self._merge_strategy_with_onboarding(strategy_data, field_transformations)

            # Create strategy object
            # Pop the public-API key 'performance_metrics' (a JSON blob)
            # from the merged dict and pass it to the renamed column
            # 'performance_metrics_data'. The relationship slot on the
            # model is *also* named 'performance_metrics' but expects
            # a list of StrategyPerformanceMetrics records, not a dict,
            # so we must not pass the value through ``**enhanced_strategy_data``.
            performance_metrics_value = enhanced_strategy_data.pop(
                'performance_metrics', None
            )
            strategy = EnhancedContentStrategy(
                user_id=user_id,
                **enhanced_strategy_data,
                performance_metrics_data=performance_metrics_value,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )

            # Save to database
            db.add(strategy)
            db.commit()
            db.refresh(strategy)

            # Generate AI recommendations
            await self.ai_recommendations_service.generate_comprehensive_recommendations(strategy, db)

            # Cache strategy data
            await self.caching_service.cache_strategy(strategy.id, strategy.to_dict())

            return strategy

        except Exception as e:
            logger.error(f"Error creating enhanced strategy: {str(e)}")
            db.rollback()
            raise

    async def get_enhanced_strategy(self, strategy_id: int, db: Session) -> Optional[EnhancedContentStrategy]:
        """Get a single enhanced strategy by ID."""
        try:
            # Try cache first
            cached_strategy = await self.caching_service.get_cached_strategy(strategy_id)
            if cached_strategy:
                return cached_strategy

            # Get from database
            strategy = db.query(EnhancedContentStrategy).filter(
                EnhancedContentStrategy.id == strategy_id
            ).first()

            if strategy:
                # Cache the strategy
                await self.caching_service.cache_strategy(strategy_id, strategy.to_dict())

            return strategy

        except Exception as e:
            logger.error(f"Error getting enhanced strategy: {str(e)}")
            raise

    async def update_enhanced_strategy(self, strategy_id: int, update_data: Dict[str, Any], db: Session) -> Optional[EnhancedContentStrategy]:
        """Update an enhanced strategy."""
        try:
            # Get existing strategy
            strategy = await self.get_enhanced_strategy(strategy_id, db)
            if not strategy:
                return None

            # Validate update data
            validation_result = self.validation_service.validate_strategy_data(update_data)
            if not validation_result['is_valid']:
                logger.error(f"Update validation failed: {validation_result['errors']}")
                raise ValueError(f"Invalid update data: {'; '.join(validation_result['errors'])}")

            # Update strategy fields
            for field, value in update_data.items():
                if hasattr(strategy, field):
                    setattr(strategy, field, value)

            strategy.updated_at = datetime.utcnow()

            # Check if AI recommendations should be regenerated
            if self._should_regenerate_ai_recommendations(update_data):
                # Pass user_id for subscription checks
                await self.strategy_analyzer.generate_comprehensive_ai_recommendations(
                    strategy, 
                    db, 
                    user_id=str(strategy.user_id)  # ✅ Pass user_id for subscription checks
                )

            # Save to database
            db.commit()
            db.refresh(strategy)

            # Update cache
            await self.caching_service.cache_strategy(strategy_id, strategy.to_dict())

            return strategy

        except Exception as e:
            logger.error(f"Error updating enhanced strategy: {str(e)}")
            db.rollback()
            raise

    async def get_onboarding_data(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Get onboarding data for a user.
        
        Args:
            user_id: Clerk user ID (string format, e.g., 'user_xxx')
            db: Database session
        """
        try:
            return await self.data_processor_service.get_onboarding_data(user_id)
        except Exception as e:
            logger.error(f"Error getting onboarding data: {str(e)}")
            raise

    async def get_ai_analysis(self, strategy_id: int, analysis_type: str, db: Session) -> Optional[Dict[str, Any]]:
        """Get AI analysis for a strategy."""
        try:
            return await self.strategy_analyzer.get_latest_ai_analysis(strategy_id, db)
        except Exception as e:
            logger.error(f"Error getting AI analysis: {str(e)}")
            raise

    async def get_system_health(self, db: Session) -> Dict[str, Any]:
        """Get system health status."""
        try:
            return await self.health_monitoring_service.check_system_health(db)
        except Exception as e:
            logger.error(f"Error getting system health: {str(e)}")
            raise

    async def get_performance_report(self) -> Dict[str, Any]:
        """Get performance report."""
        try:
            return await self.performance_optimization_service.get_performance_report()
        except Exception as e:
            logger.error(f"Error getting performance report: {str(e)}")
            raise

    async def _process_onboarding_data(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Process onboarding data for strategy creation."""
        try:
            return await self.data_processor_service.get_onboarding_data(user_id)
        except Exception as e:
            logger.error(f"Error processing onboarding data: {str(e)}")
            raise

    def _merge_strategy_with_onboarding(self, strategy_data: Dict[str, Any], field_transformations: Dict[str, Any]) -> Dict[str, Any]:
        """Merge strategy data with onboarding data."""
        merged_data = strategy_data.copy()

        for field, transformation in field_transformations.items():
            if field not in merged_data or merged_data[field] is None:
                merged_data[field] = transformation.get('value')

        return merged_data

    def _should_regenerate_ai_recommendations(self, update_data: Dict[str, Any]) -> bool:
        """Determine if AI recommendations should be regenerated based on updates."""
        critical_fields = [
            'business_objectives', 'target_metrics', 'industry', 
            'content_preferences', 'target_audience', 'competitive_position'
            ]
            
        return any(field in update_data for field in critical_fields)

    def get_strategic_input_fields(self) -> List[Dict[str, Any]]:
        """Get strategic input fields configuration."""
        return STRATEGIC_INPUT_FIELDS

    def get_service_constants(self) -> Dict[str, Any]:
        """Get service constants."""
        return SERVICE_CONSTANTS

    async def validate_strategy_data(self, strategy_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate strategy data."""
        try:
            return self.validation_service.validate_strategy_data(strategy_data)
        except Exception as e:
            logger.error(f"Error validating strategy data: {str(e)}")
            raise

    async def process_data_for_output(self, data: Dict[str, Any], output_format: str = 'json') -> Union[str, Dict[str, Any]]:
        """Process data for specific output format."""
        try:
            if output_format == 'json':
                return data
            elif output_format == 'xml':
                # Convert to XML format
                return self._convert_to_xml(data)
            else:
                raise ValueError(f"Unsupported output format: {output_format}")
        except Exception as e:
            logger.error(f"Error processing data for output: {str(e)}")
            raise

    async def optimize_strategy_operation(self, operation_name: str, operation_func, *args, **kwargs) -> Dict[str, Any]:
        """Optimize strategy operation with performance monitoring."""
        try:
            return await self.performance_optimization_service.optimize_response_time(
                operation_name, operation_func, *args, **kwargs
            )
        except Exception as e:
            logger.error(f"Error optimizing strategy operation: {str(e)}")
            raise

    def _convert_to_xml(self, data: Dict[str, Any]) -> str:
        """Convert data to XML format (placeholder implementation)."""
        # This would be implemented with proper XML conversion
        return f"<strategy>{str(data)}</strategy>" 

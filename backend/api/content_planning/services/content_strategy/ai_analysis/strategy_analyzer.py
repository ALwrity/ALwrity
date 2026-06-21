"""
Strategy analyzer for AI-powered content strategy recommendations.
Provides comprehensive AI analysis functions for content strategy generation,
including specialized prompts, response parsing, and recommendation processing.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from models.enhanced_strategy_models import EnhancedContentStrategy, EnhancedAIAnalysisResult

logger = logging.getLogger(__name__)


class StrategyAnalyzer:
    """AI-powered strategy analyzer for content strategy recommendations."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Performance optimization settings
        self.prompt_versions = {
            'comprehensive_strategy': 'v2.1',
            'audience_intelligence': 'v2.0',
            'competitive_intelligence': 'v2.0',
            'performance_optimization': 'v2.1',
            'content_calendar_optimization': 'v2.0'
        }
        
        self.quality_thresholds = {
            'min_confidence': 0.7,
            'min_completeness': 0.8,
            'max_response_time': 30.0  # seconds
        }
    
    async def generate_comprehensive_ai_recommendations(self, strategy: EnhancedContentStrategy, db: Session, user_id: str) -> None:
        """
        Generate comprehensive AI recommendations using 5 specialized prompts.
        
        Args:
            strategy: The enhanced content strategy object
            db: Database session
            user_id: Clerk user ID for subscription checking (REQUIRED - no fallback)
            
        Raises:
            RuntimeError: If user_id is not provided
        """
        try:
            if not user_id:
                raise RuntimeError("user_id is required for subscription checking. All AI calls must be authenticated.")
            
            self.logger.info(f"Generating comprehensive AI recommendations for strategy: {strategy.id}, user_id: {user_id}")
            
            start_time = datetime.utcnow()
            
            # Generate recommendations for each analysis type
            analysis_types = [
                'comprehensive_strategy',
                'audience_intelligence', 
                'competitive_intelligence',
                'performance_optimization',
                'content_calendar_optimization'
            ]
            
            ai_recommendations = {}
            successful_analyses = 0
            failed_analyses = 0
            
            for analysis_type in analysis_types:
                try:
                    # Generate recommendations without timeout (allow natural processing time)
                    recommendations = await self.generate_specialized_recommendations(strategy, analysis_type, db, user_id=user_id)
                    
                    # Validate recommendations before storing
                    if recommendations and (recommendations.get('recommendations') or recommendations.get('insights')):
                        ai_recommendations[analysis_type] = recommendations
                        successful_analyses += 1
                        
                        # Store individual analysis result
                        analysis_result = EnhancedAIAnalysisResult(
                            user_id=strategy.user_id,
                            strategy_id=strategy.id,
                            analysis_type=analysis_type,
                            comprehensive_insights=recommendations.get('comprehensive_insights'),
                            audience_intelligence=recommendations.get('audience_intelligence'),
                            competitive_intelligence=recommendations.get('competitive_intelligence'),
                            performance_optimization=recommendations.get('performance_optimization'),
                            content_calendar_optimization=recommendations.get('content_calendar_optimization'),
                            onboarding_data_used=strategy.onboarding_data_used,
                            processing_time=(datetime.utcnow() - start_time).total_seconds(),
                            ai_service_status="operational"
                        )
                        
                        db.add(analysis_result)
                    else:
                        self.logger.warning(f"Empty or invalid recommendations for {analysis_type}")
                        failed_analyses += 1
                        
                except Exception as e:
                    self.logger.error(f"Error generating {analysis_type} recommendations: {str(e)}")
                    failed_analyses += 1
                    continue
            
            # Only commit if we have at least one successful analysis
            if successful_analyses > 0:
                db.commit()
                
                # Update strategy with comprehensive AI analysis
                strategy.comprehensive_ai_analysis = ai_recommendations
                
                # Import strategy utilities for scoring and analysis
                from ..utils.strategy_utils import (
                    calculate_strategic_scores,
                    extract_market_positioning,
                    extract_competitive_advantages,
                    extract_strategic_risks,
                    extract_opportunity_analysis
                )
                
                strategy.strategic_scores = calculate_strategic_scores(ai_recommendations)
                strategy.market_positioning = extract_market_positioning(ai_recommendations)
                strategy.competitive_advantages = extract_competitive_advantages(ai_recommendations)
                strategy.strategic_risks = extract_strategic_risks(ai_recommendations)
                strategy.opportunity_analysis = extract_opportunity_analysis(ai_recommendations)
                
                db.commit()
                
                processing_time = (datetime.utcnow() - start_time).total_seconds()
                self.logger.info(f"Comprehensive AI recommendations generated in {processing_time:.2f} seconds - {successful_analyses} successful, {failed_analyses} failed")
            else:
                self.logger.error("No successful AI analyses generated - strategy creation will continue without AI recommendations")
                # Don't raise error, allow strategy creation to continue without AI recommendations
                
        except Exception as e:
            self.logger.error(f"Error generating comprehensive AI recommendations: {str(e)}")
            # Don't raise error, just log it as this is enhancement, not core functionality
    
    async def generate_specialized_recommendations(self, strategy: EnhancedContentStrategy, analysis_type: str, db: Session, user_id: str) -> Dict[str, Any]:
        """
        Generate specialized recommendations using specific AI prompts.
        
        Args:
            strategy: The enhanced content strategy object
            analysis_type: Type of analysis to perform
            db: Database session
            user_id: Clerk user ID for subscription checking (REQUIRED - no fallback)
            
        Returns:
            Dictionary with structured AI recommendations
            
        Raises:
            RuntimeError: If user_id is not provided
        """
        try:
            if not user_id:
                raise RuntimeError("user_id is required for subscription checking. All AI calls must be authenticated.")
            
            # Prepare strategy data for AI analysis
            strategy_data = strategy.to_dict()
            
            # Get onboarding data for context
            onboarding_integration = await self.get_onboarding_integration(strategy.id, db)
            
            # Create prompt based on analysis type
            prompt = self.create_specialized_prompt(strategy, analysis_type)
            
            # Generate AI response with user_id for subscription checks
            ai_response = await self.call_ai_service(prompt, analysis_type, user_id=user_id)
            
            # Parse and structure the response
            structured_response = self.parse_ai_response(ai_response, analysis_type)
            
            return structured_response
            
        except Exception as e:
            self.logger.error(f"Error generating {analysis_type} recommendations: {str(e)}")
            raise
    
    def create_specialized_prompt(self, strategy: EnhancedContentStrategy, analysis_type: str) -> str:
        """
        Create specialized AI prompts for each analysis type.
        
        Args:
            strategy: The enhanced content strategy object
            analysis_type: Type of analysis to perform
            
        Returns:
            Specialized prompt string for AI analysis
        """
        
        base_context = f"""
        Business Context:
        - Industry: {strategy.industry}
        - Business Objectives: {strategy.business_objectives}
        - Target Metrics: {strategy.target_metrics}
        - Content Budget: {strategy.content_budget}
        - Team Size: {strategy.team_size}
        - Implementation Timeline: {strategy.implementation_timeline}
        - Market Share: {strategy.market_share}
        - Competitive Position: {strategy.competitive_position}
        - Performance Metrics: {strategy.performance_metrics_data}
        
        Audience Intelligence:
        - Content Preferences: {strategy.content_preferences}
        - Consumption Patterns: {strategy.consumption_patterns}
        - Audience Pain Points: {strategy.audience_pain_points}
        - Buying Journey: {strategy.buying_journey}
        - Seasonal Trends: {strategy.seasonal_trends}
        - Engagement Metrics: {strategy.engagement_metrics}
        
        Competitive Intelligence:
        - Top Competitors: {strategy.top_competitors}
        - Competitor Content Strategies: {strategy.competitor_content_strategies}
        - Market Gaps: {strategy.market_gaps}
        - Industry Trends: {strategy.industry_trends}
        - Emerging Trends: {strategy.emerging_trends}
        
        Content Strategy:
        - Preferred Formats: {strategy.preferred_formats}
        - Content Mix: {strategy.content_mix}
        - Content Frequency: {strategy.content_frequency}
        - Optimal Timing: {strategy.optimal_timing}
        - Quality Metrics: {strategy.quality_metrics}
        - Editorial Guidelines: {strategy.editorial_guidelines}
        - Brand Voice: {strategy.brand_voice}
        
        Performance & Analytics:
        - Traffic Sources: {strategy.traffic_sources}
        - Conversion Rates: {strategy.conversion_rates}
        - Content ROI Targets: {strategy.content_roi_targets}
        - A/B Testing Capabilities: {strategy.ab_testing_capabilities}
        """
        
        specialized_prompts = {
            'comprehensive_strategy': f"""
            {base_context}
            
            TASK: Generate a comprehensive content strategy analysis that provides:
            1. Strategic positioning and market analysis
            2. Audience targeting and persona development
            3. Content pillar recommendations with rationale
            4. Competitive advantage identification
            5. Performance optimization strategies
            6. Risk assessment and mitigation plans
            7. Implementation roadmap with milestones
            8. Success metrics and KPIs
            
            REQUIREMENTS:
            - Provide actionable, specific recommendations
            - Include data-driven insights
            - Consider industry best practices
            - Address both short-term and long-term goals
            - Provide confidence levels for each recommendation
            """,
            
            'audience_intelligence': f"""
            {base_context}
            
            TASK: Generate detailed audience intelligence analysis including:
            1. Comprehensive audience persona development
            2. Content preference analysis and recommendations
            3. Consumption pattern insights and optimization
            4. Pain point identification and content solutions
            5. Buying journey mapping and content alignment
            6. Seasonal trend analysis and content planning
            7. Engagement pattern analysis and optimization
            8. Audience segmentation strategies
            
            REQUIREMENTS:
            - Use data-driven insights from provided metrics
            - Provide specific content recommendations for each audience segment
            - Include engagement optimization strategies
            - Consider cultural and behavioral factors
            """,
            
            'competitive_intelligence': f"""
            {base_context}
            
            TASK: Generate comprehensive competitive intelligence analysis including:
            1. Competitor content strategy analysis
            2. Market gap identification and opportunities
            3. Competitive advantage development strategies
            4. Industry trend analysis and implications
            5. Emerging trend identification and early adoption strategies
            6. Competitive positioning recommendations
            7. Market opportunity assessment
            8. Competitive response strategies
            
            REQUIREMENTS:
            - Analyze provided competitor data thoroughly
            - Identify unique market opportunities
            - Provide actionable competitive strategies
            - Consider both direct and indirect competitors
            """,
            
            'performance_optimization': f"""
            {base_context}
            
            TASK: Generate performance optimization analysis including:
            1. Current performance analysis and benchmarking
            2. Traffic source optimization strategies
            3. Conversion rate improvement recommendations
            4. Content ROI optimization strategies
            5. A/B testing framework and recommendations
            6. Performance monitoring and analytics setup
            7. Optimization roadmap and priorities
            8. Success metrics and tracking implementation
            
            REQUIREMENTS:
            - Provide specific, measurable optimization strategies
            - Include data-driven recommendations
            - Consider both technical and content optimizations
            - Provide implementation timelines and priorities
            """,
            
            'content_calendar_optimization': f"""
            {base_context}
            
            TASK: Generate content calendar optimization analysis including:
            1. Optimal content frequency and timing analysis
            2. Content mix optimization and balance
            3. Seasonal content planning and scheduling
            4. Content pillar integration and scheduling
            5. Platform-specific content adaptation
            6. Content repurposing and amplification strategies
            7. Editorial calendar optimization
            8. Content performance tracking and adjustment
            
            REQUIREMENTS:
            - Provide specific scheduling recommendations
            - Include content mix optimization strategies
            - Consider platform-specific requirements
            - Provide seasonal and trend-based planning
            """
        }
        
        return specialized_prompts.get(analysis_type, base_context)
    
    async def call_ai_service(self, prompt: str, analysis_type: str, user_id: str) -> Dict[str, Any]:
        """
        Call AI service to generate recommendations.
        
        Args:
            prompt: The AI prompt to send
            analysis_type: Type of analysis being performed
            user_id: Clerk user ID for subscription checking (REQUIRED - no fallback)
            
        Returns:
            Dictionary with AI response
            
        Raises:
            RuntimeError: If AI service is not available or fails, or if user_id is missing
        """
        try:
            if not user_id:
                raise RuntimeError("user_id is required for subscription checking. All AI calls must be authenticated.")
            
            # Import AI service manager
            from services.ai_service_manager import AIServiceManager, AIServiceType
            
            # Initialize AI service
            ai_service = AIServiceManager()
            
            # Map analysis types to AI service types
            service_type_mapping = {
                'comprehensive_strategy': AIServiceType.STRATEGIC_INTELLIGENCE,
                'audience_intelligence': AIServiceType.STRATEGIC_INTELLIGENCE,
                'competitive_intelligence': AIServiceType.MARKET_POSITION_ANALYSIS,
                'performance_optimization': AIServiceType.PERFORMANCE_PREDICTION,
                'content_calendar_optimization': AIServiceType.CONTENT_SCHEDULE_GENERATION
            }
            
            # Get the appropriate service type, default to strategic intelligence
            service_type = service_type_mapping.get(analysis_type, AIServiceType.STRATEGIC_INTELLIGENCE)
            
            # Define schema for AI response
            schema = {
                "type": "object",
                "properties": {
                    "recommendations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "priority": {"type": "string"},
                                "impact": {"type": "string"},
                                "implementation_difficulty": {"type": "string"}
                            }
                        }
                    },
                    "insights": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "insight": {"type": "string"},
                                "confidence": {"type": "string"},
                                "data_support": {"type": "string"}
                            }
                        }
                    },
                    "metrics": {
                        "type": "object",
                        "properties": {
                            "confidence": {"type": "number"},
                            "completeness": {"type": "number"},
                            "actionability": {"type": "number"}
                        }
                    }
                }
            }
            
            # Generate AI response using the service manager WITH user_id for subscription checks
            response = await ai_service.execute_structured_json_call(
                service_type,
                prompt,
                schema,
                user_id=user_id  # ✅ Pass user_id for subscription checks
            )
            
            # Validate that we got actual AI response
            if not response:
                raise RuntimeError(f"AI service returned null response for {analysis_type}")
            
            # Check for error in response
            if response.get("error"):
                error_msg = response.get("error", "Unknown error")
                if "Failed to parse JSON" in error_msg:
                    # Try to extract partial data from raw response
                    raw_response = response.get("raw_response", "")
                    if raw_response:
                        self.logger.warning(f"JSON parsing failed for {analysis_type}, attempting to extract partial data")
                        partial_data = self._extract_partial_data_from_raw(raw_response)
                        if partial_data:
                            self.logger.info(f"Successfully extracted partial data for {analysis_type}")
                            return partial_data
                
                raise RuntimeError(f"AI service error for {analysis_type}: {error_msg}")
            
            # Check if response has data
            if not response.get("data"):
                # Check if response itself contains the expected structure
                if response.get("recommendations") or response.get("insights"):
                    self.logger.info(f"Using direct response structure for {analysis_type}")
                    return response
                else:
                    raise RuntimeError(f"AI service returned empty data for {analysis_type}")
            
            # Return the structured response
            return response.get("data", {})
            
        except Exception as e:
            self.logger.error(f"AI service failed for {analysis_type}: {str(e)}")
            raise RuntimeError(f"AI service integration failed for {analysis_type}: {str(e)}")
    
    def _extract_partial_data_from_raw(self, raw_response: str) -> Optional[Dict[str, Any]]:
        """
        Extract partial data from raw AI response when JSON parsing fails.
        """
        try:
            # Look for common patterns in the raw response
            import re
            
            # Extract recommendations
            recommendations = []
            rec_pattern = r'"title"\s*:\s*"([^"]+)"[^}]*"description"\s*:\s*"([^"]*)"'
            rec_matches = re.findall(rec_pattern, raw_response)
            for title, description in rec_matches:
                recommendations.append({
                    "title": title,
                    "description": description,
                    "priority": "medium",
                    "impact": "moderate",
                    "implementation_difficulty": "medium"
                })
            
            # Extract insights
            insights = []
            insight_pattern = r'"insight"\s*:\s*"([^"]+)"'
            insight_matches = re.findall(insight_pattern, raw_response)
            for insight in insight_matches:
                insights.append({
                    "insight": insight,
                    "confidence": "medium",
                    "data_support": "industry_analysis"
                })
            
            if recommendations or insights:
                return {
                    "recommendations": recommendations,
                    "insights": insights,
                    "metrics": {
                        "confidence": 0.6,
                        "completeness": 0.5,
                        "actionability": 0.7
                    }
                }
            
            return None
            
        except Exception as e:
            self.logger.debug(f"Error extracting partial data: {e}")
            return None
    
    def parse_ai_response(self, ai_response: Dict[str, Any], analysis_type: str) -> Dict[str, Any]:
        """
        Parse and structure AI response.
        
        Args:
            ai_response: Raw AI response
            analysis_type: Type of analysis performed
            
        Returns:
            Structured response dictionary
            
        Raises:
            RuntimeError: If AI response is invalid or empty
        """
        if not ai_response:
            raise RuntimeError(f"Empty AI response received for {analysis_type}")
        
        # Validate that we have actual recommendations
        recommendations = ai_response.get('recommendations', [])
        insights = ai_response.get('insights', [])
        
        if not recommendations and not insights:
            raise RuntimeError(f"No recommendations or insights found in AI response for {analysis_type}")
        
        return {
            'analysis_type': analysis_type,
            'recommendations': recommendations,
            'insights': insights,
            'metrics': ai_response.get('metrics', {}),
            'confidence_score': ai_response.get('metrics', {}).get('confidence', 0.8)
        }

    async def get_latest_ai_analysis(self, strategy_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """
        Get the latest AI analysis for a strategy.
        
        Args:
            strategy_id: The strategy ID
            db: Database session
            
        Returns:
            Latest AI analysis result or None
        """
        try:
            analysis = db.query(EnhancedAIAnalysisResult).filter(
                EnhancedAIAnalysisResult.strategy_id == strategy_id
            ).order_by(EnhancedAIAnalysisResult.created_at.desc()).first()
            
            return analysis.to_dict() if analysis else None
            
        except Exception as e:
            self.logger.error(f"Error getting latest AI analysis: {str(e)}")
            return None
    
    async def get_onboarding_integration(self, strategy_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """
        Get onboarding data integration for a strategy.
        
        Args:
            strategy_id: The strategy ID
            db: Database session
            
        Returns:
            Onboarding integration data or None
        """
        try:
            from models.enhanced_strategy_models import OnboardingDataIntegration
            integration = db.query(OnboardingDataIntegration).filter(
                OnboardingDataIntegration.strategy_id == strategy_id
            ).first()
            
            return integration.to_dict() if integration else None
            
        except Exception as e:
            self.logger.error(f"Error getting onboarding integration: {str(e)}")
            return None


# Standalone functions for backward compatibility
async def generate_comprehensive_ai_recommendations(strategy: EnhancedContentStrategy, db: Session, user_id: Optional[str] = None) -> None:
    """Generate comprehensive AI recommendations using 5 specialized prompts."""
    analyzer = StrategyAnalyzer()
    return await analyzer.generate_comprehensive_ai_recommendations(strategy, db, user_id=user_id)


async def generate_specialized_recommendations(strategy: EnhancedContentStrategy, analysis_type: str, db: Session, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Generate specialized recommendations using specific AI prompts."""
    analyzer = StrategyAnalyzer()
    return await analyzer.generate_specialized_recommendations(strategy, analysis_type, db, user_id=user_id)


def create_specialized_prompt(strategy: EnhancedContentStrategy, analysis_type: str) -> str:
    """Create specialized AI prompts for each analysis type."""
    analyzer = StrategyAnalyzer()
    return analyzer.create_specialized_prompt(strategy, analysis_type)


async def call_ai_service(prompt: str, analysis_type: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Call AI service to generate recommendations."""
    analyzer = StrategyAnalyzer()
    return await analyzer.call_ai_service(prompt, analysis_type, user_id=user_id)


def parse_ai_response(ai_response: Dict[str, Any], analysis_type: str) -> Dict[str, Any]:
    """Parse and structure AI response."""
    analyzer = StrategyAnalyzer()
    return analyzer.parse_ai_response(ai_response, analysis_type)


async def get_latest_ai_analysis(strategy_id: int, db: Session) -> Optional[Dict[str, Any]]:
    """Get the latest AI analysis for a strategy."""
    analyzer = StrategyAnalyzer()
    return await analyzer.get_latest_ai_analysis(strategy_id, db)


async def get_onboarding_integration(strategy_id: int, db: Session) -> Optional[Dict[str, Any]]:
    """Get onboarding data integration for a strategy."""
    analyzer = StrategyAnalyzer()
    return await analyzer.get_onboarding_integration(strategy_id, db) 
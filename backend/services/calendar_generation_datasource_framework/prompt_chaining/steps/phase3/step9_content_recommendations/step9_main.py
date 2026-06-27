"""
Step 9: Content Recommendations - Main Orchestrator

This module orchestrates all Step 9 components to generate comprehensive content recommendations.
It integrates content recommendation generation, keyword optimization, gap analysis, performance prediction, and quality metrics.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger

from ...base_step import PromptStep
from .content_recommendation_generator import ContentRecommendationGenerator
from .keyword_optimizer import KeywordOptimizer
from .gap_analyzer import GapAnalyzer
from .performance_predictor import PerformancePredictor
from .quality_metrics_calculator import QualityMetricsCalculator


class ContentRecommendationsStep(PromptStep):
    """
    Step 9: Content Recommendations - Main Implementation
    
    This step generates comprehensive content recommendations based on:
    - Weekly themes from Step 7
    - Daily schedules from Step 8
    - Strategic insights from previous steps
    - Gap analysis and opportunities
    - Performance predictions
    - Quality metrics and validation
    
    Features:
    - Modular architecture with specialized components
    - AI-powered content recommendation generation
    - Keyword optimization and analysis
    - Gap analysis and opportunity identification
    - Performance prediction and ROI forecasting
    - Comprehensive quality metrics and validation
    - Real AI service integration without fallbacks
    """
    
    def __init__(self):
        """Initialize Step 9 with all modular components."""
        super().__init__("Content Recommendations", 9)
        
        # Initialize all modular components
        self.content_recommendation_generator = ContentRecommendationGenerator()
        self.keyword_optimizer = KeywordOptimizer()
        self.gap_analyzer = GapAnalyzer()
        self.performance_predictor = PerformancePredictor()
        self.quality_metrics_calculator = QualityMetricsCalculator()
        
        logger.info("🎯 Step 9: Content Recommendations initialized with modular architecture")
    
    async def execute(self, context: Dict[str, Any], step_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Step 9: Content Recommendations with comprehensive analysis.
        
        Args:
            context: Full context from previous steps
            step_data: Data specific to Step 9
            
        Returns:
            Comprehensive content recommendations with analysis
        """
        try:
            logger.info("🚀 Starting Step 9: Content Recommendations execution")
            
            # Extract required data from context using correct structure
            step_results = context.get("step_results", {})
            
            # Get weekly themes from Step 7
            step7_result = step_results.get("step_07", {})
            weekly_themes = step7_result.get("result", {}).get("weekly_themes", [])
            
            # Get daily schedules from Step 8
            step8_result = step_results.get("step_08", {})
            daily_schedules = step8_result.get("result", {}).get("daily_schedules", [])
            
            # Get business goals and target audience from Step 1
            step1_result = step_results.get("step_01", {})
            business_goals = step1_result.get("result", {}).get("business_goals", [])
            target_audience = step1_result.get("result", {}).get("target_audience", {})
            
            # Get platform strategies from Step 6
            step6_result = step_results.get("step_06", {})
            platform_strategies = step6_result.get("result", {}).get("platformOptimization", {})
            
            # Get keywords from Step 2
            step2_result = step_results.get("step_02", {})
            keywords = step2_result.get("result", {}).get("keywords", [])
            competitor_data = step2_result.get("result", {}).get("competitor_data", {})
            
            # Historical data from user data
            historical_data = context.get("user_data", {}).get("historical_data", {})
            
            # Validate required data
            self._validate_input_data(
                weekly_themes, daily_schedules, business_goals, target_audience,
                platform_strategies, keywords, competitor_data
            )
            
            # Step 1: Generate content recommendations
            logger.info("📝 Step 9.1: Generating content recommendations")
            content_recommendations = await self.content_recommendation_generator.generate_content_recommendations(
                weekly_themes, daily_schedules, keywords, business_goals, target_audience, platform_strategies
            )
            
            # Step 2: Optimize keywords for content
            logger.info("🔍 Step 9.2: Optimizing keywords for content")
            keyword_optimization = await self.keyword_optimizer.optimize_keywords_for_content(
                keywords, business_goals, target_audience, content_recommendations
            )
            
            # Step 3: Analyze content gaps and opportunities
            logger.info("🎯 Step 9.3: Analyzing content gaps and opportunities")
            gap_analysis = await self.gap_analyzer.analyze_content_gaps(
                weekly_themes, daily_schedules, business_goals, target_audience, competitor_data
            )
            
            # Step 4: Predict content performance
            logger.info("📊 Step 9.4: Predicting content performance")
            performance_predictions = await self.performance_predictor.predict_content_performance(
                content_recommendations, target_audience, platform_strategies, historical_data
            )
            
            # Step 5: Calculate quality metrics
            logger.info("⭐ Step 9.5: Calculating quality metrics")
            quality_metrics = await self.quality_metrics_calculator.calculate_content_quality_metrics(
                content_recommendations, business_goals, target_audience, platform_strategies
            )
            
            # Step 6: Integrate and optimize recommendations
            logger.info("🔗 Step 9.6: Integrating and optimizing recommendations")
            integrated_recommendations = self._integrate_recommendations(
                content_recommendations, keyword_optimization, gap_analysis,
                performance_predictions, quality_metrics
            )
            
            # Step 7: Calculate comprehensive quality score
            logger.info("📈 Step 9.7: Calculating comprehensive quality score")
            comprehensive_quality_score = self._calculate_comprehensive_quality_score(
                keyword_optimization, gap_analysis, performance_predictions, quality_metrics
            )
            
            # Step 8: Generate final recommendations
            logger.info("🎯 Step 9.8: Generating final recommendations")
            final_recommendations = self._generate_final_recommendations(
                integrated_recommendations, comprehensive_quality_score
            )
            
            # Create comprehensive Step 9 results
            step9_results = {
                "content_recommendations": content_recommendations,
                "keyword_optimization": keyword_optimization,
                "gap_analysis": gap_analysis,
                "performance_predictions": performance_predictions,
                "quality_metrics": quality_metrics,
                "integrated_recommendations": integrated_recommendations,
                "comprehensive_quality_score": comprehensive_quality_score,
                "final_recommendations": final_recommendations,
                "step_metadata": {
                    "step_number": 9,
                    "step_name": "Content Recommendations",
                    "total_recommendations": len(final_recommendations),
                    "quality_score": comprehensive_quality_score,
                    "execution_status": "completed",
                    "modules_used": [
                        "ContentRecommendationGenerator",
                        "KeywordOptimizer",
                        "GapAnalyzer",
                        "PerformancePredictor",
                        "QualityMetricsCalculator"
                    ]
                }
            }
            
            logger.info(f"✅ Step 9 completed successfully with {len(final_recommendations)} final recommendations")
            logger.info(f"📊 Comprehensive quality score: {comprehensive_quality_score:.3f}")
            
            return step9_results
            
        except Exception as e:
            logger.error(f"❌ Step 9 execution failed: {str(e)}")
            raise
    
    def get_prompt_template(self) -> str:
        """
        Get the AI prompt template for Step 9: Content Recommendations.
        
        Returns:
            String containing the prompt template for content recommendations
        """
        return """
        You are an expert content strategist tasked with generating comprehensive content recommendations.
        
        Based on the provided weekly themes, daily schedules, business goals, and target audience,
        generate detailed content recommendations that:
        
        1. Align with the weekly themes and daily schedules
        2. Target the specific audience demographics and interests
        3. Support the business goals and objectives
        4. Optimize for platform-specific best practices
        5. Include keyword optimization and SEO considerations
        6. Provide performance predictions and ROI estimates
        7. Include quality metrics and validation criteria
        
        For each recommendation, provide:
        - Content title and description
        - Target platform and content type
        - Keyword optimization suggestions
        - Expected performance metrics
        - Implementation guidance
        - Success criteria and measurement methods
        
        Ensure all recommendations are actionable, measurable, and aligned with the overall content strategy.
        """
    
    def validate_result(self, result: Dict[str, Any]) -> bool:
        """
        Validate the Step 9 result.
        
        Args:
            result: Step result to validate
            
        Returns:
            True if validation passes, False otherwise
        """
        try:
            # Check if result contains required fields
            required_fields = [
                "content_recommendations",
                "keyword_optimization", 
                "gap_analysis",
                "performance_predictions",
                "quality_metrics",
                "final_recommendations"
            ]
            
            for field in required_fields:
                if field not in result:
                    logger.error(f"❌ Missing required field: {field}")
                    return False
            
            # Validate content recommendations
            content_recommendations = result.get("content_recommendations", [])
            if not content_recommendations or len(content_recommendations) < 5:
                logger.error("❌ Insufficient content recommendations generated")
                return False
            
            # Validate final recommendations
            final_recommendations = result.get("final_recommendations", [])
            if not final_recommendations or len(final_recommendations) < 3:
                logger.error("❌ Insufficient final recommendations generated")
                return False
            
            # Validate quality score
            quality_score = result.get("comprehensive_quality_score", 0.0)
            if quality_score < 0.5:
                logger.warning(f"⚠️ Low quality score: {quality_score}")
            
            logger.info("✅ Step 9 result validation passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Step 9 result validation failed: {str(e)}")
            return False
    
    def _validate_input_data(
        self,
        weekly_themes: List[Dict],
        daily_schedules: List[Dict],
        business_goals: List[str],
        target_audience: Dict,
        platform_strategies: Dict,
        keywords: List[str],
        competitor_data: Dict
    ) -> None:
        """Validate input data for Step 9 execution."""
        try:
            # Validate weekly themes
            if not weekly_themes:
                raise ValueError("Weekly themes from Step 7 are required for content recommendations")
            
            # Validate daily schedules
            if not daily_schedules:
                raise ValueError("Daily schedules from Step 8 are required for content recommendations")
            
            # Validate business goals
            if not business_goals:
                raise ValueError("Business goals from strategy are required for content recommendations")
            
            # Validate target audience
            if not target_audience:
                raise ValueError("Target audience from strategy is required for content recommendations")
            
            # Validate platform strategies
            if not platform_strategies:
                raise ValueError("Platform strategies from Step 6 are required for content recommendations")
            
            # Validate keywords
            if not keywords:
                raise ValueError("Keywords from strategy are required for content recommendations")
            
            # Validate competitor data
            if not competitor_data:
                logger.warning("Competitor data from Step 2 is missing, using default values")
            
            logger.info("✅ Input data validation passed")
            
        except Exception as e:
            logger.error(f"❌ Input data validation failed: {str(e)}")
            raise
    
    def _integrate_recommendations(
        self,
        content_recommendations: List[Dict],
        keyword_optimization: Dict[str, Any],
        gap_analysis: Dict[str, Any],
        performance_predictions: Dict[str, Any],
        quality_metrics: Dict[str, Any]
    ) -> List[Dict]:
        """
        Integrate recommendations from all modules into a unified list.
        
        Args:
            content_recommendations: Content recommendations from generator
            keyword_optimization: Keyword optimization results
            gap_analysis: Gap analysis results
            performance_predictions: Performance prediction results
            quality_metrics: Quality metrics results
            
        Returns:
            Integrated recommendations with comprehensive analysis
        """
        try:
            integrated_recommendations = []
            
            # Combine all recommendation sources
            all_recommendations = []
            
            # Add content recommendations
            all_recommendations.extend(content_recommendations)
            
            # Add keyword-based recommendations
            keyword_recommendations = keyword_optimization.get("keyword_content_ideas", [])
            all_recommendations.extend(keyword_recommendations)
            
            # Add gap-based recommendations
            gap_recommendations = gap_analysis.get("gap_content_ideas", [])
            all_recommendations.extend(gap_recommendations)
            
            # Add performance-based recommendations
            performance_recommendations = performance_predictions.get("performance_recommendations", [])
            all_recommendations.extend(performance_recommendations)
            
            # Add quality-based recommendations
            quality_recommendations = quality_metrics.get("quality_recommendations", [])
            all_recommendations.extend(quality_recommendations)
            
            # Remove duplicates and integrate analysis
            seen_titles = set()
            for recommendation in all_recommendations:
                title = recommendation.get("title", "")
                if title not in seen_titles:
                    seen_titles.add(title)
                    
                    # Integrate analysis from all modules
                    integrated_recommendation = self._integrate_single_recommendation(
                        recommendation, keyword_optimization, gap_analysis,
                        performance_predictions, quality_metrics
                    )
                    
                    integrated_recommendations.append(integrated_recommendation)
            
            return integrated_recommendations
            
        except Exception as e:
            logger.error(f"Error integrating recommendations: {str(e)}")
            return []
    
    def _integrate_single_recommendation(
        self,
        recommendation: Dict,
        keyword_optimization: Dict[str, Any],
        gap_analysis: Dict[str, Any],
        performance_predictions: Dict[str, Any],
        quality_metrics: Dict[str, Any]
    ) -> Dict:
        """Integrate analysis for a single recommendation."""
        try:
            title = recommendation.get("title", "")
            
            # Get keyword analysis
            keyword_analysis = keyword_optimization.get("keyword_analysis", {})
            keyword_score = 0.0
            for keyword_data in keyword_analysis.values():
                if keyword_data.get("keyword", "") in title:
                    keyword_score = keyword_data.get("relevance_score", 0.0)
                    break
            
            # Get performance prediction
            performance_data = performance_predictions.get("roi_predictions", {}).get(title, {})
            predicted_roi = performance_data.get("predicted_roi", 0.0)
            
            # Get quality metrics
            quality_data = quality_metrics.get("overall_quality_scores", {}).get(title, {})
            quality_score = quality_data.get("overall_score", 0.0)
            
            # Create integrated recommendation
            integrated_recommendation = {
                **recommendation,
                "keyword_score": keyword_score,
                "predicted_roi": predicted_roi,
                "quality_score": quality_score,
                "integrated_score": (keyword_score + predicted_roi + quality_score) / 3.0,
                "analysis_sources": [
                    "content_recommendation_generator",
                    "keyword_optimizer",
                    "gap_analyzer",
                    "performance_predictor",
                    "quality_metrics_calculator"
                ]
            }
            
            return integrated_recommendation
            
        except Exception as e:
            logger.error(f"Error integrating single recommendation: {str(e)}")
            return recommendation
    
    def _calculate_comprehensive_quality_score(
        self,
        keyword_optimization: Dict[str, Any],
        gap_analysis: Dict[str, Any],
        performance_predictions: Dict[str, Any],
        quality_metrics: Dict[str, Any]
    ) -> float:
        """
        Calculate comprehensive quality score for Step 9.
        
        Args:
            keyword_optimization: Keyword optimization results
            gap_analysis: Gap analysis results
            performance_predictions: Performance prediction results
            quality_metrics: Quality metrics results
            
        Returns:
            Comprehensive quality score (0-1)
        """
        try:
            # Extract quality scores from each module
            keyword_score = keyword_optimization.get("optimization_metrics", {}).get("optimization_score", 0.0)
            gap_score = gap_analysis.get("gap_analysis_metrics", {}).get("gap_analysis_score", 0.0)
            performance_score = performance_predictions.get("performance_metrics", {}).get("performance_score", 0.0)
            quality_score = quality_metrics.get("quality_metrics", {}).get("avg_quality_score", 0.0)
            
            # Calculate weighted comprehensive score
            comprehensive_score = (
                keyword_score * 0.2 +
                gap_score * 0.2 +
                performance_score * 0.3 +
                quality_score * 0.3
            )
            
            return min(1.0, max(0.0, comprehensive_score))
            
        except Exception as e:
            logger.error(f"Error calculating comprehensive quality score: {str(e)}")
            return 0.5
    
    def _generate_final_recommendations(
        self,
        integrated_recommendations: List[Dict],
        comprehensive_quality_score: float
    ) -> List[Dict]:
        """
        Generate final recommendations with comprehensive analysis.
        
        Args:
            integrated_recommendations: Integrated recommendations from all modules
            comprehensive_quality_score: Overall quality score for Step 9
            
        Returns:
            Final recommendations with comprehensive analysis
        """
        try:
            # Sort by integrated score
            sorted_recommendations = sorted(
                integrated_recommendations,
                key=lambda x: x.get("integrated_score", 0.0),
                reverse=True
            )
            
            # Generate final recommendations with comprehensive analysis
            final_recommendations = []
            
            for i, recommendation in enumerate(sorted_recommendations[:20]):  # Top 20 recommendations
                final_recommendation = {
                    **recommendation,
                    "final_rank": i + 1,
                    "recommendation_priority": "high" if i < 5 else "medium" if i < 10 else "low",
                    "comprehensive_quality_score": comprehensive_quality_score,
                    "step_9_analysis": {
                        "keyword_optimization": recommendation.get("keyword_score", 0.0),
                        "performance_prediction": recommendation.get("predicted_roi", 0.0),
                        "quality_assessment": recommendation.get("quality_score", 0.0),
                        "integrated_score": recommendation.get("integrated_score", 0.0)
                    },
                    "implementation_guidance": self._generate_implementation_guidance(recommendation),
                    "success_metrics": self._generate_success_metrics(recommendation)
                }
                
                final_recommendations.append(final_recommendation)
            
            return final_recommendations
            
        except Exception as e:
            logger.error(f"Error generating final recommendations: {str(e)}")
            return []
    
    def _generate_implementation_guidance(self, recommendation: Dict) -> Dict[str, Any]:
        """Generate implementation guidance for a recommendation."""
        try:
            content_type = recommendation.get("content_type", "")
            target_platform = recommendation.get("target_platform", "")
            
            guidance = {
                "implementation_difficulty": "medium",
                "estimated_time": "2-4 hours",
                "required_resources": ["Content creator", "Designer", "Platform access"],
                "implementation_steps": [
                    "Research and gather content materials",
                    "Create content according to platform specifications",
                    "Review and optimize for target audience",
                    "Schedule and publish content",
                    "Monitor performance and engagement"
                ],
                "platform_specific_guidance": self._get_platform_guidance(target_platform),
                "content_type_guidance": self._get_content_type_guidance(content_type)
            }
            
            return guidance
            
        except Exception as e:
            logger.error(f"Error generating implementation guidance: {str(e)}")
            return {"implementation_difficulty": "medium", "estimated_time": "2-4 hours"}
    
    def _get_platform_guidance(self, platform: str) -> Dict[str, str]:
        """Get platform-specific implementation guidance."""
        platform_guidance = {
            "LinkedIn": {
                "optimal_length": "1000-2000 words for articles, 1300 characters for posts",
                "best_times": "Tuesday-Thursday, 8-10 AM or 5-6 PM",
                "content_focus": "Professional insights, industry trends, thought leadership"
            },
            "Twitter": {
                "optimal_length": "280 characters or thread format",
                "best_times": "Monday-Friday, 9 AM-3 PM",
                "content_focus": "Quick insights, trending topics, engagement questions"
            },
            "Instagram": {
                "optimal_length": "125 characters for captions",
                "best_times": "Monday-Friday, 2-3 PM or 7-9 PM",
                "content_focus": "Visual content, behind-the-scenes, user-generated content"
            },
            "Facebook": {
                "optimal_length": "40-80 characters for optimal engagement",
                "best_times": "Thursday-Sunday, 1-4 PM",
                "content_focus": "Community engagement, brand personality, value-driven content"
            },
            "Blog": {
                "optimal_length": "1500-2500 words for comprehensive articles",
                "best_times": "Tuesday-Thursday, 9-11 AM",
                "content_focus": "In-depth analysis, how-to guides, industry expertise"
            }
        }
        
        return platform_guidance.get(platform, {
            "optimal_length": "Varies by platform",
            "best_times": "Platform-specific optimal times",
            "content_focus": "Platform-appropriate content"
        })
    
    def _get_content_type_guidance(self, content_type: str) -> Dict[str, str]:
        """Get content type-specific implementation guidance."""
        content_guidance = {
            "Article": {
                "structure": "Introduction, main points, conclusion",
                "visual_elements": "Include relevant images, charts, or infographics",
                "engagement_tips": "Use compelling headlines, include call-to-action"
            },
            "Post": {
                "structure": "Hook, value proposition, call-to-action",
                "visual_elements": "High-quality image or video",
                "engagement_tips": "Ask questions, encourage comments"
            },
            "Video": {
                "structure": "Hook, content, call-to-action",
                "visual_elements": "Professional video with captions",
                "engagement_tips": "Keep it concise, include captions"
            },
            "Story": {
                "structure": "Narrative arc with beginning, middle, end",
                "visual_elements": "Authentic, behind-the-scenes content",
                "engagement_tips": "Be authentic, show personality"
            },
            "Poll": {
                "structure": "Question, options, context",
                "visual_elements": "Clear, easy-to-read poll format",
                "engagement_tips": "Ask relevant questions, respond to results"
            }
        }
        
        return content_guidance.get(content_type, {
            "structure": "Platform-appropriate structure",
            "visual_elements": "Relevant visual content",
            "engagement_tips": "Encourage audience interaction"
        })
    
    def _generate_success_metrics(self, recommendation: Dict) -> Dict[str, Any]:
        """Generate success metrics for a recommendation."""
        try:
            predicted_roi = recommendation.get("predicted_roi", 0.0)
            quality_score = recommendation.get("quality_score", 0.0)
            
            success_metrics = {
                "target_engagement_rate": 0.05,  # 5% target
                "target_reach": 1000,  # 1000 reach target
                "target_conversion_rate": 0.02,  # 2% conversion target
                "target_roi": max(2.0, predicted_roi),  # Minimum 2.0 ROI
                "quality_threshold": 0.8,  # 80% quality threshold
                "success_indicators": [
                    "Engagement rate above 5%",
                    "Reach above 1000 impressions",
                    "Conversion rate above 2%",
                    f"ROI above {max(2.0, predicted_roi):.1f}",
                    f"Quality score above {quality_score:.1%}"
                ],
                "measurement_timeline": "30 days post-publication",
                "optimization_opportunities": [
                    "A/B test headlines and visuals",
                    "Optimize posting times",
                    "Enhance call-to-action",
                    "Monitor and respond to comments"
                ]
            }
            
            return success_metrics
            
        except Exception as e:
            logger.error(f"Error generating success metrics: {str(e)}")
            return {
                "target_engagement_rate": 0.05,
                "target_reach": 1000,
                "target_conversion_rate": 0.02,
                "target_roi": 2.0,
                "quality_threshold": 0.8
            }

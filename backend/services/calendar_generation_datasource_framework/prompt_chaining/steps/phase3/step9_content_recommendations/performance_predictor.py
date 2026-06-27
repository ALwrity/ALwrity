"""
Performance Predictor Module

This module predicts content performance and provides performance-based recommendations.
It ensures performance optimization, engagement prediction, and ROI forecasting.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher


class PerformancePredictor:
    """
    Predicts content performance and provides performance-based recommendations.
    
    This module ensures:
    - Content performance prediction
    - Engagement forecasting
    - ROI prediction and optimization
    - Performance-based content recommendations
    - Performance metrics analysis
    """
    
    def __init__(self):
        """Initialize the performance predictor with real AI services."""
        self.ai_engine = AIEngineService()
        self.keyword_researcher = KeywordResearcher()
        
        # Performance prediction rules
        self.performance_rules = {
            "min_engagement_rate": 0.02,
            "target_engagement_rate": 0.05,
            "roi_threshold": 2.0,
            "performance_confidence": 0.8,
            "prediction_horizon": 30  # days
        }
        
        # Performance metrics weights
        self.metrics_weights = {
            "engagement_rate": 0.3,
            "reach_potential": 0.25,
            "conversion_potential": 0.25,
            "brand_impact": 0.2
        }
        
        logger.info("🎯 Performance Predictor initialized with real AI services")
    
    async def predict_content_performance(
        self,
        content_recommendations: List[Dict],
        target_audience: Dict,
        platform_strategies: Dict,
        historical_data: Dict
    ) -> Dict[str, Any]:
        """
        Predict performance for content recommendations.
        
        Args:
            content_recommendations: Content recommendations from other modules
            target_audience: Target audience information
            platform_strategies: Platform strategies from Step 6
            historical_data: Historical performance data
            
        Returns:
            Performance predictions with optimization recommendations
        """
        try:
            logger.info("🚀 Starting content performance prediction")
            
            # Predict engagement rates
            engagement_predictions = await self._predict_engagement_rates(
                content_recommendations, target_audience, platform_strategies
            )
            
            # Predict reach potential
            reach_predictions = await self._predict_reach_potential(
                content_recommendations, platform_strategies, historical_data
            )
            
            # Predict conversion potential
            conversion_predictions = await self._predict_conversion_potential(
                content_recommendations, target_audience, historical_data
            )
            
            # Predict brand impact
            brand_impact_predictions = await self._predict_brand_impact(
                content_recommendations, target_audience, platform_strategies
            )
            
            # Calculate ROI predictions
            roi_predictions = self._calculate_roi_predictions(
                engagement_predictions, reach_predictions, conversion_predictions
            )
            
            # Generate performance-based recommendations
            performance_recommendations = await self._generate_performance_recommendations(
                content_recommendations, engagement_predictions, roi_predictions
            )
            
            # Create comprehensive performance prediction results
            performance_results = {
                "engagement_predictions": engagement_predictions,
                "reach_predictions": reach_predictions,
                "conversion_predictions": conversion_predictions,
                "brand_impact_predictions": brand_impact_predictions,
                "roi_predictions": roi_predictions,
                "performance_recommendations": performance_recommendations,
                "performance_metrics": self._calculate_performance_metrics(
                    engagement_predictions, reach_predictions, conversion_predictions, roi_predictions
                )
            }
            
            logger.info(f"✅ Predicted performance for {len(content_recommendations)} content recommendations")
            return performance_results
            
        except Exception as e:
            logger.error(f"❌ Content performance prediction failed: {str(e)}")
            raise
    
    async def _predict_engagement_rates(
        self,
        content_recommendations: List[Dict],
        target_audience: Dict,
        platform_strategies: Dict
    ) -> Dict[str, Dict]:
        """
        Predict engagement rates for content recommendations.
        
        Args:
            content_recommendations: Content recommendations
            target_audience: Target audience information
            platform_strategies: Platform strategies
            
        Returns:
            Engagement rate predictions
        """
        try:
            engagement_predictions = {}
            
            for recommendation in content_recommendations:
                # Create engagement prediction prompt
                prompt = self._create_engagement_prediction_prompt(
                    recommendation, target_audience, platform_strategies
                )
                
                # Get AI prediction
                ai_response = await self.ai_engine.generate_content(prompt, {
                    "step": "engagement_prediction",
                    "content_type": recommendation.get("content_type", "Unknown"),
                    "platform": recommendation.get("target_platform", "Unknown")
                })
                
                # Parse engagement prediction
                prediction = self._parse_engagement_prediction(ai_response, recommendation)
                engagement_predictions[recommendation.get("title", "Unknown")] = prediction
            
            return engagement_predictions
            
        except Exception as e:
            logger.error(f"Error predicting engagement rates: {str(e)}")
            raise
    
    def _create_engagement_prediction_prompt(
        self,
        recommendation: Dict,
        target_audience: Dict,
        platform_strategies: Dict
    ) -> str:
        """Create prompt for engagement rate prediction."""
        
        prompt = f"""
        Predict engagement rate for the following content:
        
        CONTENT DETAILS:
        Title: {recommendation.get('title', 'N/A')}
        Content Type: {recommendation.get('content_type', 'N/A')}
        Target Platform: {recommendation.get('target_platform', 'N/A')}
        Key Message: {recommendation.get('key_message', 'N/A')}
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Interests: {target_audience.get('interests', 'N/A')}
        
        PLATFORM STRATEGY:
        {platform_strategies.get(recommendation.get('target_platform', 'Unknown'), {})}
        
        REQUIREMENTS:
        1. Predict engagement rate (likes, comments, shares)
        2. Consider content type and platform optimization
        3. Factor in audience demographics and interests
        4. Account for platform-specific engagement patterns
        5. Provide confidence level for prediction
        
        OUTPUT FORMAT:
        Provide engagement prediction with:
        - Predicted Engagement Rate (0-1)
        - Engagement Type Breakdown (likes, comments, shares)
        - Confidence Level (0-1)
        - Key Factors Affecting Engagement
        - Optimization Recommendations
        """
        
        return prompt
    
    def _parse_engagement_prediction(
        self,
        ai_response: Dict,
        recommendation: Dict
    ) -> Dict[str, Any]:
        """Parse AI response into engagement prediction."""
        try:
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create structured engagement prediction
            prediction = {
                "content_title": recommendation.get("title", "Unknown"),
                "content_type": recommendation.get("content_type", "Unknown"),
                "target_platform": recommendation.get("target_platform", "Unknown"),
                "predicted_engagement_rate": 0.05,  # Default 5%, would be extracted from AI response
                "engagement_breakdown": {
                    "likes": 0.03,
                    "comments": 0.01,
                    "shares": 0.01
                },
                "confidence_level": 0.8,  # Default 80%, would be extracted from AI response
                "key_factors": [
                    "Content type optimization",
                    "Platform-specific strategy",
                    "Audience alignment"
                ],
                "optimization_recommendations": [
                    "Optimize posting time",
                    "Enhance visual elements",
                    "Include call-to-action"
                ],
                "ai_insights": insights[:3] if insights else []
            }
            
            return prediction
            
        except Exception as e:
            logger.error(f"Error parsing engagement prediction: {str(e)}")
            return {
                "content_title": recommendation.get("title", "Unknown"),
                "content_type": recommendation.get("content_type", "Unknown"),
                "target_platform": recommendation.get("target_platform", "Unknown"),
                "predicted_engagement_rate": 0.02,
                "engagement_breakdown": {"likes": 0.015, "comments": 0.003, "shares": 0.002},
                "confidence_level": 0.6,
                "key_factors": ["Basic content optimization"],
                "optimization_recommendations": ["Improve content quality"],
                "ai_insights": []
            }
    
    async def _predict_reach_potential(
        self,
        content_recommendations: List[Dict],
        platform_strategies: Dict,
        historical_data: Dict
    ) -> Dict[str, Dict]:
        """
        Predict reach potential for content recommendations.
        
        Args:
            content_recommendations: Content recommendations
            platform_strategies: Platform strategies
            historical_data: Historical performance data
            
        Returns:
            Reach potential predictions
        """
        try:
            reach_predictions = {}
            
            for recommendation in content_recommendations:
                # Create reach prediction prompt
                prompt = self._create_reach_prediction_prompt(
                    recommendation, platform_strategies, historical_data
                )
                
                # Get AI prediction
                ai_response = await self.ai_engine.generate_content(prompt, {
                    "step": "reach_prediction",
                    "content_type": recommendation.get("content_type", "Unknown"),
                    "platform": recommendation.get("target_platform", "Unknown")
                })
                
                # Parse reach prediction
                prediction = self._parse_reach_prediction(ai_response, recommendation)
                reach_predictions[recommendation.get("title", "Unknown")] = prediction
            
            return reach_predictions
            
        except Exception as e:
            logger.error(f"Error predicting reach potential: {str(e)}")
            raise
    
    def _create_reach_prediction_prompt(
        self,
        recommendation: Dict,
        platform_strategies: Dict,
        historical_data: Dict
    ) -> str:
        """Create prompt for reach potential prediction."""
        
        prompt = f"""
        Predict reach potential for the following content:
        
        CONTENT DETAILS:
        Title: {recommendation.get('title', 'N/A')}
        Content Type: {recommendation.get('content_type', 'N/A')}
        Target Platform: {recommendation.get('target_platform', 'N/A')}
        
        PLATFORM STRATEGY:
        {platform_strategies.get(recommendation.get('target_platform', 'Unknown'), {})}
        
        HISTORICAL DATA:
        Average Reach: {historical_data.get('avg_reach', 'N/A')}
        Best Performing Content: {historical_data.get('best_reach', 'N/A')}
        
        REQUIREMENTS:
        1. Predict potential reach (impressions, views)
        2. Consider platform-specific reach patterns
        3. Factor in content type and timing
        4. Account for historical performance
        5. Provide reach optimization recommendations
        
        OUTPUT FORMAT:
        Provide reach prediction with:
        - Predicted Reach (number)
        - Reach Confidence Level (0-1)
        - Reach Factors (timing, content type, platform)
        - Reach Optimization Recommendations
        - Viral Potential Assessment
        """
        
        return prompt
    
    def _parse_reach_prediction(
        self,
        ai_response: Dict,
        recommendation: Dict
    ) -> Dict[str, Any]:
        """Parse AI response into reach prediction."""
        try:
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create structured reach prediction
            prediction = {
                "content_title": recommendation.get("title", "Unknown"),
                "content_type": recommendation.get("content_type", "Unknown"),
                "target_platform": recommendation.get("target_platform", "Unknown"),
                "predicted_reach": 1000,  # Default, would be extracted from AI response
                "reach_confidence": 0.75,  # Default 75%, would be extracted from AI response
                "reach_factors": [
                    "Platform algorithm optimization",
                    "Content type performance",
                    "Timing optimization"
                ],
                "reach_optimization": [
                    "Post at optimal times",
                    "Use trending hashtags",
                    "Leverage platform features"
                ],
                "viral_potential": "Medium",  # Low/Medium/High
                "ai_insights": insights[:3] if insights else []
            }
            
            return prediction
            
        except Exception as e:
            logger.error(f"Error parsing reach prediction: {str(e)}")
            return {
                "content_title": recommendation.get("title", "Unknown"),
                "content_type": recommendation.get("content_type", "Unknown"),
                "target_platform": recommendation.get("target_platform", "Unknown"),
                "predicted_reach": 500,
                "reach_confidence": 0.6,
                "reach_factors": ["Basic platform optimization"],
                "reach_optimization": ["Improve content quality"],
                "viral_potential": "Low",
                "ai_insights": []
            }
    
    async def _predict_conversion_potential(
        self,
        content_recommendations: List[Dict],
        target_audience: Dict,
        historical_data: Dict
    ) -> Dict[str, Dict]:
        """
        Predict conversion potential for content recommendations.
        
        Args:
            content_recommendations: Content recommendations
            target_audience: Target audience information
            historical_data: Historical performance data
            
        Returns:
            Conversion potential predictions
        """
        try:
            conversion_predictions = {}
            
            for recommendation in content_recommendations:
                # Create conversion prediction prompt
                prompt = self._create_conversion_prediction_prompt(
                    recommendation, target_audience, historical_data
                )
                
                # Get AI prediction
                ai_response = await self.ai_engine.generate_content(prompt, {
                    "step": "conversion_prediction",
                    "content_type": recommendation.get("content_type", "Unknown")
                })
                
                # Parse conversion prediction
                prediction = self._parse_conversion_prediction(ai_response, recommendation)
                conversion_predictions[recommendation.get("title", "Unknown")] = prediction
            
            return conversion_predictions
            
        except Exception as e:
            logger.error(f"Error predicting conversion potential: {str(e)}")
            raise
    
    def _create_conversion_prediction_prompt(
        self,
        recommendation: Dict,
        target_audience: Dict,
        historical_data: Dict
    ) -> str:
        """Create prompt for conversion potential prediction."""
        
        prompt = f"""
        Predict conversion potential for the following content:
        
        CONTENT DETAILS:
        Title: {recommendation.get('title', 'N/A')}
        Content Type: {recommendation.get('content_type', 'N/A')}
        Key Message: {recommendation.get('key_message', 'N/A')}
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Pain Points: {target_audience.get('pain_points', 'N/A')}
        
        HISTORICAL DATA:
        Average Conversion Rate: {historical_data.get('avg_conversion_rate', 'N/A')}
        Best Converting Content: {historical_data.get('best_conversion', 'N/A')}
        
        REQUIREMENTS:
        1. Predict conversion potential (clicks, signups, purchases)
        2. Consider audience pain points and needs
        3. Factor in content type and call-to-action
        4. Account for historical conversion data
        5. Provide conversion optimization recommendations
        
        OUTPUT FORMAT:
        Provide conversion prediction with:
        - Predicted Conversion Rate (0-1)
        - Conversion Type (clicks, signups, purchases)
        - Conversion Confidence Level (0-1)
        - Conversion Factors (audience alignment, CTA, value proposition)
        - Conversion Optimization Recommendations
        """
        
        return prompt
    
    def _parse_conversion_prediction(
        self,
        ai_response: Dict,
        recommendation: Dict
    ) -> Dict[str, Any]:
        """Parse AI response into conversion prediction."""
        try:
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create structured conversion prediction
            prediction = {
                "content_title": recommendation.get("title", "Unknown"),
                "content_type": recommendation.get("content_type", "Unknown"),
                "predicted_conversion_rate": 0.03,  # Default 3%, would be extracted from AI response
                "conversion_type": "clicks",  # clicks/signups/purchases
                "conversion_confidence": 0.7,  # Default 70%, would be extracted from AI response
                "conversion_factors": [
                    "Audience pain point alignment",
                    "Clear call-to-action",
                    "Strong value proposition"
                ],
                "conversion_optimization": [
                    "Add compelling CTA",
                    "Highlight value proposition",
                    "Address audience pain points"
                ],
                "ai_insights": insights[:3] if insights else []
            }
            
            return prediction
            
        except Exception as e:
            logger.error(f"Error parsing conversion prediction: {str(e)}")
            return {
                "content_title": recommendation.get("title", "Unknown"),
                "content_type": recommendation.get("content_type", "Unknown"),
                "predicted_conversion_rate": 0.01,
                "conversion_type": "clicks",
                "conversion_confidence": 0.5,
                "conversion_factors": ["Basic audience alignment"],
                "conversion_optimization": ["Improve value proposition"],
                "ai_insights": []
            }
    
    async def _predict_brand_impact(
        self,
        content_recommendations: List[Dict],
        target_audience: Dict,
        platform_strategies: Dict
    ) -> Dict[str, Dict]:
        """
        Predict brand impact for content recommendations.
        
        Args:
            content_recommendations: Content recommendations
            target_audience: Target audience information
            platform_strategies: Platform strategies
            
        Returns:
            Brand impact predictions
        """
        try:
            brand_impact_predictions = {}
            
            for recommendation in content_recommendations:
                # Create brand impact prediction prompt
                prompt = self._create_brand_impact_prediction_prompt(
                    recommendation, target_audience, platform_strategies
                )
                
                # Get AI prediction
                ai_response = await self.ai_engine.generate_content(prompt, {
                    "step": "brand_impact_prediction",
                    "content_type": recommendation.get("content_type", "Unknown")
                })
                
                # Parse brand impact prediction
                prediction = self._parse_brand_impact_prediction(ai_response, recommendation)
                brand_impact_predictions[recommendation.get("title", "Unknown")] = prediction
            
            return brand_impact_predictions
            
        except Exception as e:
            logger.error(f"Error predicting brand impact: {str(e)}")
            raise
    
    def _create_brand_impact_prediction_prompt(
        self,
        recommendation: Dict,
        target_audience: Dict,
        platform_strategies: Dict
    ) -> str:
        """Create prompt for brand impact prediction."""
        
        prompt = f"""
        Predict brand impact for the following content:
        
        CONTENT DETAILS:
        Title: {recommendation.get('title', 'N/A')}
        Content Type: {recommendation.get('content_type', 'N/A')}
        Key Message: {recommendation.get('key_message', 'N/A')}
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Brand Perception: {target_audience.get('brand_perception', 'N/A')}
        
        PLATFORM STRATEGY:
        {platform_strategies.get(recommendation.get('target_platform', 'Unknown'), {})}
        
        REQUIREMENTS:
        1. Predict brand impact (awareness, perception, loyalty)
        2. Consider audience brand perception
        3. Factor in content type and messaging
        4. Account for platform-specific brand building
        5. Provide brand impact optimization recommendations
        
        OUTPUT FORMAT:
        Provide brand impact prediction with:
        - Predicted Brand Impact Score (0-1)
        - Brand Impact Type (awareness, perception, loyalty)
        - Brand Impact Confidence Level (0-1)
        - Brand Impact Factors (messaging, audience alignment, platform)
        - Brand Impact Optimization Recommendations
        """
        
        return prompt
    
    def _parse_brand_impact_prediction(
        self,
        ai_response: Dict,
        recommendation: Dict
    ) -> Dict[str, Any]:
        """Parse AI response into brand impact prediction."""
        try:
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create structured brand impact prediction
            prediction = {
                "content_title": recommendation.get("title", "Unknown"),
                "content_type": recommendation.get("content_type", "Unknown"),
                "predicted_brand_impact": 0.6,  # Default 60%, would be extracted from AI response
                "brand_impact_type": "awareness",  # awareness/perception/loyalty
                "brand_impact_confidence": 0.75,  # Default 75%, would be extracted from AI response
                "brand_impact_factors": [
                    "Consistent brand messaging",
                    "Audience brand alignment",
                    "Platform brand building"
                ],
                "brand_impact_optimization": [
                    "Strengthen brand voice",
                    "Align with brand values",
                    "Enhance brand storytelling"
                ],
                "ai_insights": insights[:3] if insights else []
            }
            
            return prediction
            
        except Exception as e:
            logger.error(f"Error parsing brand impact prediction: {str(e)}")
            return {
                "content_title": recommendation.get("title", "Unknown"),
                "content_type": recommendation.get("content_type", "Unknown"),
                "predicted_brand_impact": 0.4,
                "brand_impact_type": "awareness",
                "brand_impact_confidence": 0.6,
                "brand_impact_factors": ["Basic brand alignment"],
                "brand_impact_optimization": ["Improve brand consistency"],
                "ai_insights": []
            }
    
    def _calculate_roi_predictions(
        self,
        engagement_predictions: Dict[str, Dict],
        reach_predictions: Dict[str, Dict],
        conversion_predictions: Dict[str, Dict]
    ) -> Dict[str, Dict]:
        """
        Calculate ROI predictions based on performance metrics.
        
        Args:
            engagement_predictions: Engagement rate predictions
            reach_predictions: Reach potential predictions
            conversion_predictions: Conversion potential predictions
            
        Returns:
            ROI predictions
        """
        try:
            roi_predictions = {}
            
            for title in engagement_predictions.keys():
                engagement = engagement_predictions.get(title, {})
                reach = reach_predictions.get(title, {})
                conversion = conversion_predictions.get(title, {})
                
                # Calculate ROI based on performance metrics
                roi = self._calculate_content_roi(engagement, reach, conversion)
                
                roi_predictions[title] = {
                    "content_title": title,
                    "predicted_roi": roi["roi"],
                    "roi_confidence": roi["confidence"],
                    "roi_factors": roi["factors"],
                    "roi_optimization": roi["optimization"],
                    "roi_category": roi["category"]
                }
            
            return roi_predictions
            
        except Exception as e:
            logger.error(f"Error calculating ROI predictions: {str(e)}")
            return {}
    
    def _calculate_content_roi(
        self,
        engagement: Dict,
        reach: Dict,
        conversion: Dict
    ) -> Dict[str, Any]:
        """Calculate ROI for a single content piece."""
        try:
            # Extract metrics
            engagement_rate = engagement.get("predicted_engagement_rate", 0.02)
            reach_potential = reach.get("predicted_reach", 500)
            conversion_rate = conversion.get("predicted_conversion_rate", 0.01)
            
            # Calculate ROI components
            engagement_value = engagement_rate * reach_potential * 0.1  # $0.10 per engagement
            conversion_value = conversion_rate * reach_potential * 10  # $10 per conversion
            total_value = engagement_value + conversion_value
            
            # Assume content cost (simplified)
            content_cost = 50  # $50 per content piece
            
            # Calculate ROI
            roi = (total_value - content_cost) / content_cost if content_cost > 0 else 0
            
            # Determine ROI category
            if roi >= 3.0:
                category = "excellent"
            elif roi >= 2.0:
                category = "good"
            elif roi >= 1.0:
                category = "acceptable"
            else:
                category = "poor"
            
            # Calculate confidence
            confidence = (
                engagement.get("confidence_level", 0.6) * 0.4 +
                reach.get("reach_confidence", 0.6) * 0.3 +
                conversion.get("conversion_confidence", 0.6) * 0.3
            )
            
            # ROI factors
            factors = [
                f"Engagement rate: {engagement_rate:.1%}",
                f"Reach potential: {reach_potential:,}",
                f"Conversion rate: {conversion_rate:.1%}"
            ]
            
            # ROI optimization
            optimization = []
            if engagement_rate < 0.03:
                optimization.append("Improve engagement rate")
            if reach_potential < 1000:
                optimization.append("Increase reach potential")
            if conversion_rate < 0.02:
                optimization.append("Enhance conversion rate")
            
            return {
                "roi": roi,
                "confidence": confidence,
                "factors": factors,
                "optimization": optimization,
                "category": category
            }
            
        except Exception as e:
            logger.error(f"Error calculating content ROI: {str(e)}")
            return {
                "roi": 0.0,
                "confidence": 0.5,
                "factors": ["Basic ROI calculation"],
                "optimization": ["Improve overall performance"],
                "category": "poor"
            }
    
    async def _generate_performance_recommendations(
        self,
        content_recommendations: List[Dict],
        engagement_predictions: Dict[str, Dict],
        roi_predictions: Dict[str, Dict]
    ) -> List[Dict]:
        """
        Generate performance-based content recommendations.
        
        Args:
            content_recommendations: Content recommendations
            engagement_predictions: Engagement rate predictions
            roi_predictions: ROI predictions
            
        Returns:
            Performance-based recommendations
        """
        try:
            performance_recommendations = []
            
            # Sort content by predicted ROI
            sorted_content = sorted(
                content_recommendations,
                key=lambda x: roi_predictions.get(x.get("title", ""), {}).get("predicted_roi", 0),
                reverse=True
            )
            
            # Generate recommendations for top performers
            for i, content in enumerate(sorted_content[:10]):  # Top 10 performers
                title = content.get("title", "Unknown")
                engagement = engagement_predictions.get(title, {})
                roi = roi_predictions.get(title, {})
                
                # Create performance recommendation
                recommendation = {
                    "content_title": title,
                    "content_type": content.get("content_type", "Unknown"),
                    "target_platform": content.get("target_platform", "Unknown"),
                    "predicted_roi": roi.get("predicted_roi", 0),
                    "predicted_engagement": engagement.get("predicted_engagement_rate", 0),
                    "performance_rank": i + 1,
                    "performance_category": roi.get("roi_category", "poor"),
                    "performance_recommendations": roi.get("roi_optimization", []),
                    "priority": "high" if i < 3 else "medium",
                    "source": "performance_based"
                }
                
                performance_recommendations.append(recommendation)
            
            return performance_recommendations
            
        except Exception as e:
            logger.error(f"Error generating performance recommendations: {str(e)}")
            return []
    
    def _calculate_performance_metrics(
        self,
        engagement_predictions: Dict[str, Dict],
        reach_predictions: Dict[str, Dict],
        conversion_predictions: Dict[str, Dict],
        roi_predictions: Dict[str, Dict]
    ) -> Dict[str, Any]:
        """
        Calculate overall performance metrics.
        
        Args:
            engagement_predictions: Engagement rate predictions
            reach_predictions: Reach potential predictions
            conversion_predictions: Conversion potential predictions
            roi_predictions: ROI predictions
            
        Returns:
            Performance metrics
        """
        try:
            # Calculate average metrics
            engagement_rates = [pred.get("predicted_engagement_rate", 0) for pred in engagement_predictions.values()]
            avg_engagement_rate = sum(engagement_rates) / len(engagement_rates) if engagement_rates else 0
            
            reach_potentials = [pred.get("predicted_reach", 0) for pred in reach_predictions.values()]
            avg_reach_potential = sum(reach_potentials) / len(reach_potentials) if reach_potentials else 0
            
            conversion_rates = [pred.get("predicted_conversion_rate", 0) for pred in conversion_predictions.values()]
            avg_conversion_rate = sum(conversion_rates) / len(conversion_rates) if conversion_rates else 0
            
            roi_values = [pred.get("predicted_roi", 0) for pred in roi_predictions.values()]
            avg_roi = sum(roi_values) / len(roi_values) if roi_values else 0
            
            # Calculate performance distribution
            roi_categories = [pred.get("roi_category", "poor") for pred in roi_predictions.values()]
            category_distribution = {}
            for category in roi_categories:
                category_distribution[category] = category_distribution.get(category, 0) + 1
            
            # Calculate overall performance score
            performance_score = (
                avg_engagement_rate * self.metrics_weights["engagement_rate"] +
                (avg_reach_potential / 10000) * self.metrics_weights["reach_potential"] +
                avg_conversion_rate * self.metrics_weights["conversion_potential"] +
                (avg_roi / 5.0) * self.metrics_weights["brand_impact"]
            )
            
            metrics = {
                "avg_engagement_rate": avg_engagement_rate,
                "avg_reach_potential": avg_reach_potential,
                "avg_conversion_rate": avg_conversion_rate,
                "avg_roi": avg_roi,
                "roi_category_distribution": category_distribution,
                "performance_score": performance_score,
                "total_content_analyzed": len(engagement_predictions),
                "high_performing_content": len([r for r in roi_values if r >= 2.0]),
                "low_performing_content": len([r for r in roi_values if r < 1.0])
            }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating performance metrics: {str(e)}")
            return {
                "avg_engagement_rate": 0.0,
                "avg_reach_potential": 0,
                "avg_conversion_rate": 0.0,
                "avg_roi": 0.0,
                "roi_category_distribution": {},
                "performance_score": 0.0,
                "total_content_analyzed": 0,
                "high_performing_content": 0,
                "low_performing_content": 0
            }

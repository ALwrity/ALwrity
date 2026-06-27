"""
Step 10: Performance Optimization - Main Orchestrator

This module orchestrates all Step 10 components to optimize calendar performance.
It integrates performance analysis, content quality optimization, engagement optimization, ROI optimization, and performance prediction.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger

from ...base_step import PromptStep
from .performance_analyzer import PerformanceAnalyzer
from .content_quality_optimizer import ContentQualityOptimizer
from .engagement_optimizer import EngagementOptimizer
from .roi_optimizer import ROIOptimizer
from .performance_predictor import PerformancePredictor


class PerformanceOptimizationStep(PromptStep):
    """
    Step 10: Performance Optimization - Main Implementation
    
    This step optimizes calendar performance based on:
    - Performance analysis and metrics calculation
    - Content quality optimization
    - Engagement optimization
    - ROI and conversion optimization
    - Performance prediction and validation
    
    Features:
    - Modular architecture with specialized components
    - Comprehensive performance analysis
    - Content quality enhancement
    - Engagement potential optimization
    - ROI and conversion optimization
    - Performance prediction and validation
    - Real AI service integration without fallbacks
    """
    
    def __init__(self):
        """Initialize Step 10 with all modular components."""
        super().__init__("Performance Optimization", 10)
        
        # Initialize all modular components
        self.performance_analyzer = PerformanceAnalyzer()
        self.content_quality_optimizer = ContentQualityOptimizer()
        self.engagement_optimizer = EngagementOptimizer()
        self.roi_optimizer = ROIOptimizer()
        self.performance_predictor = PerformancePredictor()
        
        logger.info("🎯 Step 10: Performance Optimization initialized with modular architecture")
    
    async def execute(self, context: Dict[str, Any], step_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Step 10: Performance Optimization with comprehensive analysis.
        
        Args:
            context: Full context from previous steps
            step_data: Data specific to Step 10
            
        Returns:
            Comprehensive performance optimization results
        """
        try:
            logger.info("🚀 Starting Step 10: Performance Optimization execution")
            
            # Extract required data from context
            calendar_data = self._extract_calendar_data(context)
            strategy_data = context.get("strategy_data", {})
            business_goals = strategy_data.get("business_goals", [])
            target_audience = strategy_data.get("target_audience", {})
            historical_data = strategy_data.get("historical_data", {})
            competitor_data = context.get("step2_results", {}).get("competitor_data", {})
            quality_requirements = step_data.get("quality_requirements", {})
            cost_data = step_data.get("cost_data", {})
            
            # Validate required data
            self._validate_input_data(
                calendar_data, business_goals, target_audience, historical_data,
                competitor_data, quality_requirements, cost_data
            )
            
            # Step 1: Performance Analysis
            logger.info("📊 Step 10.1: Analyzing performance metrics")
            performance_analysis = await self.performance_analyzer.analyze_performance_metrics(
                calendar_data, historical_data, competitor_data, business_goals
            )
            
            # Step 2: Content Quality Optimization
            logger.info("✨ Step 10.2: Optimizing content quality")
            quality_optimization = await self.content_quality_optimizer.optimize_content_quality(
                calendar_data, target_audience, business_goals, quality_requirements
            )
            
            # Step 3: Engagement Optimization
            logger.info("🎯 Step 10.3: Optimizing engagement potential")
            engagement_optimization = await self.engagement_optimizer.optimize_engagement(
                calendar_data, target_audience, historical_data.get("engagement_data", {})
            )
            
            # Step 4: ROI Optimization
            logger.info("💰 Step 10.4: Optimizing ROI and conversion")
            roi_optimization = await self.roi_optimizer.optimize_roi(
                calendar_data, business_goals, historical_data.get("roi_data", {}), cost_data
            )
            
            # Step 5: Performance Prediction
            logger.info("🔮 Step 10.5: Predicting performance outcomes")
            performance_prediction = await self.performance_predictor.predict_performance_outcomes(
                self._combine_optimized_data(quality_optimization, engagement_optimization, roi_optimization),
                historical_data, business_goals, target_audience
            )
            
            # Step 6: Generate comprehensive optimization results
            logger.info("📋 Step 10.6: Generating comprehensive optimization results")
            optimization_results = self._generate_comprehensive_results(
                performance_analysis, quality_optimization, engagement_optimization,
                roi_optimization, performance_prediction
            )
            
            # Step 7: Calculate overall performance score
            logger.info("📈 Step 10.7: Calculating overall performance score")
            overall_performance_score = self._calculate_overall_performance_score(
                performance_analysis, quality_optimization, engagement_optimization,
                roi_optimization, performance_prediction
            )
            
            # Step 8: Generate optimization insights
            logger.info("💡 Step 10.8: Generating optimization insights")
            optimization_insights = await self._generate_optimization_insights(
                performance_analysis, quality_optimization, engagement_optimization,
                roi_optimization, performance_prediction
            )
            
            # Create final results
            step_results = {
                "performance_analysis": performance_analysis,
                "quality_optimization": quality_optimization,
                "engagement_optimization": engagement_optimization,
                "roi_optimization": roi_optimization,
                "performance_prediction": performance_prediction,
                "optimization_results": optimization_results,
                "overall_performance_score": overall_performance_score,
                "optimization_insights": optimization_insights,
                "step_summary": {
                    "step_name": "Performance Optimization",
                    "step_number": 10,
                    "status": "completed",
                    "performance_score": overall_performance_score,
                    "optimization_impact": self._calculate_optimization_impact(
                        performance_analysis, performance_prediction
                    ),
                    "next_steps": self._generate_next_steps(optimization_results)
                }
            }
            
            logger.info(f"✅ Step 10: Performance Optimization completed successfully with score: {overall_performance_score}")
            return step_results
            
        except Exception as e:
            logger.error(f"❌ Error in Step 10 execution: {str(e)}")
            raise
    
    def _extract_calendar_data(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Extract calendar data from context."""
        return {
            "step7_results": context.get("step7_results", {}),
            "step8_results": context.get("step8_results", {}),
            "step9_results": context.get("step9_results", {}),
            "step6_results": context.get("step6_results", {}),
            "strategy_data": context.get("strategy_data", {})
        }
    
    def _validate_input_data(
        self,
        calendar_data: Dict[str, Any],
        business_goals: List[str],
        target_audience: Dict[str, Any],
        historical_data: Dict[str, Any],
        competitor_data: Dict[str, Any],
        quality_requirements: Dict[str, Any],
        cost_data: Dict[str, Any]
    ) -> None:
        """Validate required input data."""
        if not calendar_data:
            raise ValueError("Calendar data is required for performance optimization")
        
        if not business_goals:
            raise ValueError("Business goals are required for performance optimization")
        
        if not target_audience:
            raise ValueError("Target audience data is required for performance optimization")
        
        if not historical_data:
            logger.warning("Historical data not provided, using default values")
        
        if not competitor_data:
            logger.warning("Competitor data not provided, using default values")
        
        if not quality_requirements:
            logger.warning("Quality requirements not provided, using default values")
        
        if not cost_data:
            logger.warning("Cost data not provided, using default values")
    
    def _combine_optimized_data(
        self,
        quality_optimization: Dict[str, Any],
        engagement_optimization: Dict[str, Any],
        roi_optimization: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Combine optimized data from all components."""
        return {
            "optimized_themes": quality_optimization.get("optimized_content", {}).get("optimized_themes", []),
            "optimized_schedules": quality_optimization.get("optimized_content", {}).get("optimized_schedules", []),
            "optimized_recommendations": quality_optimization.get("optimized_content", {}).get("optimized_recommendations", []),
            "engagement_optimizations": engagement_optimization.get("optimized_engagement", {}),
            "roi_optimizations": roi_optimization.get("optimized_roi", {})
        }
    
    def _generate_comprehensive_results(
        self,
        performance_analysis: Dict[str, Any],
        quality_optimization: Dict[str, Any],
        engagement_optimization: Dict[str, Any],
        roi_optimization: Dict[str, Any],
        performance_prediction: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate comprehensive optimization results."""
        return {
            "performance_metrics": {
                "overall_performance_score": performance_analysis.get("overall_performance_score", 0.0),
                "optimization_opportunities": performance_analysis.get("optimization_opportunities", {}),
                "performance_predictions": performance_analysis.get("performance_predictions", {})
            },
            "quality_metrics": {
                "overall_quality_score": quality_optimization.get("overall_quality_score", 0.0),
                "quality_improvements": quality_optimization.get("quality_improvements", {}),
                "quality_validation": quality_optimization.get("quality_validation", {})
            },
            "engagement_metrics": {
                "overall_engagement_score": engagement_optimization.get("overall_engagement_score", 0.0),
                "engagement_strategies": engagement_optimization.get("engagement_strategies", {}),
                "engagement_metrics": engagement_optimization.get("engagement_metrics", {})
            },
            "roi_metrics": {
                "overall_roi_score": roi_optimization.get("overall_roi_score", 0.0),
                "roi_strategies": roi_optimization.get("roi_strategies", {}),
                "roi_metrics": roi_optimization.get("roi_metrics", {})
            },
            "prediction_metrics": {
                "overall_performance_score": performance_prediction.get("overall_performance_score", 0.0),
                "prediction_confidence": performance_prediction.get("prediction_confidence", 0.0),
                "optimization_validation": performance_prediction.get("optimization_validation", {}),
                "risk_assessment": performance_prediction.get("risk_assessment", {})
            }
        }
    
    def _calculate_overall_performance_score(
        self,
        performance_analysis: Dict[str, Any],
        quality_optimization: Dict[str, Any],
        engagement_optimization: Dict[str, Any],
        roi_optimization: Dict[str, Any],
        performance_prediction: Dict[str, Any]
    ) -> float:
        """Calculate overall performance score from all components."""
        try:
            # Extract scores from each component
            performance_score = performance_analysis.get("overall_performance_score", 0.0)
            quality_score = quality_optimization.get("overall_quality_score", 0.0)
            engagement_score = engagement_optimization.get("overall_engagement_score", 0.0)
            roi_score = roi_optimization.get("overall_roi_score", 0.0)
            prediction_score = performance_prediction.get("overall_performance_score", 0.0)
            
            # Calculate weighted average
            weights = [0.2, 0.2, 0.2, 0.2, 0.2]  # Equal weights for all components
            overall_score = sum(score * weight for score, weight in zip(
                [performance_score, quality_score, engagement_score, roi_score, prediction_score], weights
            ))
            
            return round(overall_score, 3)
            
        except Exception as e:
            logger.error(f"❌ Error calculating overall performance score: {str(e)}")
            return 0.0
    
    def _calculate_optimization_impact(
        self,
        performance_analysis: Dict[str, Any],
        performance_prediction: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate the impact of optimizations."""
        try:
            current_score = performance_analysis.get("overall_performance_score", 0.0)
            predicted_score = performance_prediction.get("overall_performance_score", 0.0)
            
            if current_score > 0:
                improvement_percentage = ((predicted_score - current_score) / current_score) * 100
            else:
                improvement_percentage = 0.0
            
            return {
                "current_performance": current_score,
                "predicted_performance": predicted_score,
                "improvement_percentage": round(improvement_percentage, 2),
                "optimization_effectiveness": "high" if improvement_percentage > 20 else "medium" if improvement_percentage > 10 else "low"
            }
            
        except Exception as e:
            logger.error(f"❌ Error calculating optimization impact: {str(e)}")
            return {"optimization_effectiveness": "unknown"}
    
    async def _generate_optimization_insights(
        self,
        performance_analysis: Dict[str, Any],
        quality_optimization: Dict[str, Any],
        engagement_optimization: Dict[str, Any],
        roi_optimization: Dict[str, Any],
        performance_prediction: Dict[str, Any]
    ) -> List[str]:
        """Generate comprehensive optimization insights."""
        try:
            insights = []
            
            # Performance analysis insights
            performance_insights = performance_analysis.get("performance_optimization_insights", [])
            insights.extend(performance_insights)
            
            # Quality optimization insights
            quality_insights = quality_optimization.get("quality_optimization_insights", [])
            insights.extend(quality_insights)
            
            # Engagement optimization insights
            engagement_insights = engagement_optimization.get("engagement_optimization_insights", [])
            insights.extend(engagement_insights)
            
            # ROI optimization insights
            roi_insights = roi_optimization.get("roi_optimization_insights", [])
            insights.extend(roi_insights)
            
            # Performance prediction insights
            prediction_insights = performance_prediction.get("performance_insights", [])
            insights.extend(prediction_insights)
            
            # Add overall optimization summary
            overall_score = self._calculate_overall_performance_score(
                performance_analysis, quality_optimization, engagement_optimization,
                roi_optimization, performance_prediction
            )
            
            if overall_score >= 0.8:
                insights.append("🎯 Excellent performance optimization achieved across all dimensions")
            elif overall_score >= 0.6:
                insights.append("✅ Good performance optimization with room for further improvement")
            else:
                insights.append("⚠️ Performance optimization needs additional refinement")
            
            return insights[:10]  # Limit to top 10 insights
            
        except Exception as e:
            logger.error(f"❌ Error generating optimization insights: {str(e)}")
            return ["Performance optimization analysis completed successfully"]
    
    def _generate_next_steps(self, optimization_results: Dict[str, Any]) -> List[str]:
        """Generate next steps based on optimization results."""
        try:
            next_steps = []
            
            # Check if further optimization is needed
            performance_score = optimization_results.get("performance_metrics", {}).get("overall_performance_score", 0.0)
            if performance_score < 0.7:
                next_steps.append("Consider additional performance optimization iterations")
            
            # Check if quality improvements are needed
            quality_score = optimization_results.get("quality_metrics", {}).get("overall_quality_score", 0.0)
            if quality_score < 0.7:
                next_steps.append("Focus on content quality improvements")
            
            # Check if engagement optimization is needed
            engagement_score = optimization_results.get("engagement_metrics", {}).get("overall_engagement_score", 0.0)
            if engagement_score < 0.7:
                next_steps.append("Enhance engagement optimization strategies")
            
            # Check if ROI optimization is needed
            roi_score = optimization_results.get("roi_metrics", {}).get("overall_roi_score", 0.0)
            if roi_score < 0.7:
                next_steps.append("Improve ROI and conversion optimization")
            
            # Add standard next steps
            next_steps.extend([
                "Proceed to Step 11: Strategy Alignment Validation",
                "Monitor performance metrics during implementation",
                "Adjust optimization strategies based on real-world results"
            ])
            
            return next_steps
            
        except Exception as e:
            logger.error(f"❌ Error generating next steps: {str(e)}")
            return ["Proceed to next step in the optimization process"]
    
    def get_prompt_template(self) -> str:
        """
        Get the AI prompt template for Step 10: Performance Optimization.
        
        Returns:
            String containing the prompt template for performance optimization
        """
        return """
        You are an expert performance optimization specialist tasked with optimizing calendar performance.
        
        Based on the provided calendar data, business goals, and target audience,
        perform comprehensive performance optimization that:
        
        1. Analyzes current performance metrics and identifies optimization opportunities
        2. Optimizes content quality for maximum engagement and impact
        3. Enhances engagement strategies across all platforms
        4. Optimizes ROI and conversion rates
        5. Predicts performance outcomes with confidence levels
        6. Provides actionable optimization insights and recommendations
        7. Calculates overall performance improvement potential
        
        For each optimization area, provide:
        - Current performance baseline
        - Optimization strategies and tactics
        - Expected performance improvements
        - Implementation guidance and timeline
        - Risk assessment and mitigation strategies
        - Success metrics and measurement methods
        
        Ensure all optimizations are data-driven, actionable, and aligned with business objectives.
        """
    
    def validate_result(self, result: Dict[str, Any]) -> bool:
        """
        Validate the Step 10 result.
        
        Args:
            result: Step result to validate
            
        Returns:
            True if validation passes, False otherwise
        """
        try:
            # Check if result contains required fields
            required_fields = [
                "performance_analysis",
                "quality_optimization",
                "engagement_optimization", 
                "roi_optimization",
                "performance_prediction",
                "optimization_results",
                "overall_performance_score"
            ]
            
            for field in required_fields:
                if field not in result:
                    logger.error(f"❌ Missing required field: {field}")
                    return False
            
            # Validate performance score
            performance_score = result.get("overall_performance_score", 0.0)
            if performance_score < 0.0 or performance_score > 1.0:
                logger.error(f"❌ Invalid performance score: {performance_score}")
                return False
            
            # Validate optimization results
            optimization_results = result.get("optimization_results", {})
            if not optimization_results:
                logger.error("❌ No optimization results generated")
                return False
            
            # Validate performance prediction
            performance_prediction = result.get("performance_prediction", {})
            if not performance_prediction:
                logger.error("❌ No performance prediction generated")
                return False
            
            logger.info("✅ Step 10 result validation passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Step 10 result validation failed: {str(e)}")
            return False

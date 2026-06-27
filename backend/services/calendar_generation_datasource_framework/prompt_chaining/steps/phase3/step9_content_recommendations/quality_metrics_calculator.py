"""
Quality Metrics Calculator Module

This module calculates comprehensive quality metrics for content recommendations.
It ensures quality validation, scoring, and optimization recommendations.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
from services.content_gap_analyzer.ai_engine_service import AIEngineService


class QualityMetricsCalculator:
    """
    Calculates comprehensive quality metrics for content recommendations.
    
    This module ensures:
    - Content quality scoring
    - Strategic alignment validation
    - Platform optimization assessment
    - Engagement potential evaluation
    - Quality-based recommendations
    """
    
    def __init__(self):
        """Initialize the quality metrics calculator with real AI services."""
        self.ai_engine = AIEngineService()
        
        # Quality metrics weights
        self.quality_weights = {
            "content_relevance": 0.25,
            "strategic_alignment": 0.25,
            "platform_optimization": 0.20,
            "engagement_potential": 0.20,
            "uniqueness": 0.10
        }
        
        # Quality thresholds
        self.quality_thresholds = {
            "excellent": 0.9,
            "good": 0.8,
            "acceptable": 0.7,
            "needs_improvement": 0.6
        }
        
        logger.info("🎯 Quality Metrics Calculator initialized with real AI services")
    
    async def calculate_content_quality_metrics(
        self,
        content_recommendations: List[Dict],
        business_goals: List[str],
        target_audience: Dict,
        platform_strategies: Dict
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive quality metrics for content recommendations.
        
        Args:
            content_recommendations: Content recommendations from other modules
            business_goals: Business goals from strategy
            target_audience: Target audience information
            platform_strategies: Platform strategies from Step 6
            
        Returns:
            Comprehensive quality metrics with recommendations
        """
        try:
            logger.info("🚀 Starting content quality metrics calculation")
            
            # Calculate content relevance scores
            relevance_scores = await self._calculate_content_relevance_scores(
                content_recommendations, target_audience
            )
            
            # Calculate strategic alignment scores
            alignment_scores = self._calculate_strategic_alignment_scores(
                content_recommendations, business_goals
            )
            
            # Calculate platform optimization scores
            platform_scores = self._calculate_platform_optimization_scores(
                content_recommendations, platform_strategies
            )
            
            # Calculate engagement potential scores
            engagement_scores = await self._calculate_engagement_potential_scores(
                content_recommendations, target_audience
            )
            
            # Calculate uniqueness scores
            uniqueness_scores = self._calculate_uniqueness_scores(content_recommendations)
            
            # Calculate overall quality scores
            overall_quality_scores = self._calculate_overall_quality_scores(
                relevance_scores, alignment_scores, platform_scores, engagement_scores, uniqueness_scores
            )
            
            # Generate quality-based recommendations
            quality_recommendations = self._generate_quality_recommendations(
                content_recommendations, overall_quality_scores
            )
            
            # Create comprehensive quality metrics results
            quality_results = {
                "relevance_scores": relevance_scores,
                "alignment_scores": alignment_scores,
                "platform_scores": platform_scores,
                "engagement_scores": engagement_scores,
                "uniqueness_scores": uniqueness_scores,
                "overall_quality_scores": overall_quality_scores,
                "quality_recommendations": quality_recommendations,
                "quality_metrics": self._calculate_quality_metrics_summary(
                    overall_quality_scores, quality_recommendations
                )
            }
            
            logger.info(f"✅ Calculated quality metrics for {len(content_recommendations)} content recommendations")
            return quality_results
            
        except Exception as e:
            logger.error(f"❌ Content quality metrics calculation failed: {str(e)}")
            raise
    
    async def _calculate_content_relevance_scores(
        self,
        content_recommendations: List[Dict],
        target_audience: Dict
    ) -> Dict[str, float]:
        """Calculate content relevance scores based on target audience."""
        try:
            relevance_scores = {}
            
            for recommendation in content_recommendations:
                # Create relevance assessment prompt
                prompt = self._create_relevance_assessment_prompt(recommendation, target_audience)
                
                # Get AI assessment
                ai_response = await self.ai_engine.generate_content(prompt, {
                    "step": "relevance_assessment",
                    "content_type": recommendation.get("content_type", "Unknown")
                })
                
                # Parse relevance score
                score = self._parse_relevance_score(ai_response, recommendation, target_audience)
                relevance_scores[recommendation.get("title", "Unknown")] = score
            
            return relevance_scores
            
        except Exception as e:
            logger.error(f"Error calculating content relevance scores: {str(e)}")
            raise
    
    def _create_relevance_assessment_prompt(self, recommendation: Dict, target_audience: Dict) -> str:
        """Create prompt for content relevance assessment."""
        
        prompt = f"""
        Assess content relevance for target audience:
        
        CONTENT:
        Title: {recommendation.get('title', 'N/A')}
        Content Type: {recommendation.get('content_type', 'N/A')}
        Key Message: {recommendation.get('key_message', 'N/A')}
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Interests: {target_audience.get('interests', 'N/A')}
        Pain Points: {target_audience.get('pain_points', 'N/A')}
        
        REQUIREMENTS:
        1. Assess how well the content aligns with target audience
        2. Consider demographics, interests, and pain points
        3. Provide relevance score (0-1)
        4. Identify relevance factors and improvements
        
        OUTPUT FORMAT:
        Provide relevance assessment with:
        - Relevance Score (0-1)
        - Relevance Factors
        - Improvement Recommendations
        """
        
        return prompt
    
    def _parse_relevance_score(self, ai_response: Dict, recommendation: Dict, target_audience: Dict) -> float:
        """Parse AI response into relevance score."""
        try:
            # Simple relevance calculation based on keyword matching
            content_text = f"{recommendation.get('title', '')} {recommendation.get('key_message', '')}".lower()
            audience_interests = target_audience.get('interests', '').lower()
            audience_pain_points = target_audience.get('pain_points', '').lower()
            
            # Calculate relevance based on keyword overlap
            interest_matches = sum(1 for interest in audience_interests.split() if interest in content_text)
            pain_point_matches = sum(1 for pain in audience_pain_points.split() if pain in content_text)
            
            total_keywords = len(audience_interests.split()) + len(audience_pain_points.split())
            relevance_score = (interest_matches + pain_point_matches) / max(1, total_keywords)
            
            return min(1.0, max(0.0, relevance_score))
            
        except Exception as e:
            logger.error(f"Error parsing relevance score: {str(e)}")
            return 0.5
    
    def _calculate_strategic_alignment_scores(
        self,
        content_recommendations: List[Dict],
        business_goals: List[str]
    ) -> Dict[str, float]:
        """Calculate strategic alignment scores based on business goals."""
        try:
            alignment_scores = {}
            
            for recommendation in content_recommendations:
                # Calculate alignment based on goal keyword matching
                content_text = f"{recommendation.get('title', '')} {recommendation.get('key_message', '')}".lower()
                
                goal_matches = 0
                for goal in business_goals:
                    goal_keywords = goal.lower().split()
                    matches = sum(1 for keyword in goal_keywords if keyword in content_text)
                    if matches > 0:
                        goal_matches += 1
                
                alignment_score = goal_matches / max(1, len(business_goals))
                alignment_scores[recommendation.get("title", "Unknown")] = alignment_score
            
            return alignment_scores
            
        except Exception as e:
            logger.error(f"Error calculating strategic alignment scores: {str(e)}")
            return {}
    
    def _calculate_platform_optimization_scores(
        self,
        content_recommendations: List[Dict],
        platform_strategies: Dict
    ) -> Dict[str, float]:
        """Calculate platform optimization scores."""
        try:
            platform_scores = {}
            
            for recommendation in content_recommendations:
                platform = recommendation.get("target_platform", "Unknown")
                platform_strategy = platform_strategies.get(platform, {})
                
                # Calculate platform optimization score
                optimization_score = 0.7  # Default score
                
                # Adjust based on content type and platform match
                content_type = recommendation.get("content_type", "")
                if platform == "LinkedIn" and content_type in ["Article", "Post"]:
                    optimization_score = 0.9
                elif platform == "Twitter" and content_type in ["Tweet", "Thread"]:
                    optimization_score = 0.8
                elif platform == "Instagram" and content_type in ["Post", "Story", "Reel"]:
                    optimization_score = 0.8
                
                platform_scores[recommendation.get("title", "Unknown")] = optimization_score
            
            return platform_scores
            
        except Exception as e:
            logger.error(f"Error calculating platform optimization scores: {str(e)}")
            return {}
    
    async def _calculate_engagement_potential_scores(
        self,
        content_recommendations: List[Dict],
        target_audience: Dict
    ) -> Dict[str, float]:
        """Calculate engagement potential scores."""
        try:
            engagement_scores = {}
            
            for recommendation in content_recommendations:
                # Create engagement potential assessment prompt
                prompt = self._create_engagement_potential_prompt(recommendation, target_audience)
                
                # Get AI assessment
                ai_response = await self.ai_engine.generate_content(prompt, {
                    "step": "engagement_potential_assessment",
                    "content_type": recommendation.get("content_type", "Unknown")
                })
                
                # Parse engagement potential score
                score = self._parse_engagement_potential_score(ai_response, recommendation)
                engagement_scores[recommendation.get("title", "Unknown")] = score
            
            return engagement_scores
            
        except Exception as e:
            logger.error(f"Error calculating engagement potential scores: {str(e)}")
            raise
    
    def _create_engagement_potential_prompt(self, recommendation: Dict, target_audience: Dict) -> str:
        """Create prompt for engagement potential assessment."""
        
        prompt = f"""
        Assess engagement potential for content:
        
        CONTENT:
        Title: {recommendation.get('title', 'N/A')}
        Content Type: {recommendation.get('content_type', 'N/A')}
        Key Message: {recommendation.get('key_message', 'N/A')}
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Interests: {target_audience.get('interests', 'N/A')}
        
        REQUIREMENTS:
        1. Assess potential for likes, comments, shares
        2. Consider audience interests and engagement patterns
        3. Provide engagement potential score (0-1)
        4. Identify engagement factors and improvements
        
        OUTPUT FORMAT:
        Provide engagement potential assessment with:
        - Engagement Potential Score (0-1)
        - Engagement Factors
        - Improvement Recommendations
        """
        
        return prompt
    
    def _parse_engagement_potential_score(self, ai_response: Dict, recommendation: Dict) -> float:
        """Parse AI response into engagement potential score."""
        try:
            # Simple engagement potential calculation
            content_type = recommendation.get("content_type", "")
            key_message = recommendation.get("key_message", "")
            
            # Base score based on content type
            base_score = 0.6
            if content_type in ["Video", "Story", "Reel"]:
                base_score = 0.8
            elif content_type in ["Article", "Post"]:
                base_score = 0.7
            elif content_type in ["Poll", "Question"]:
                base_score = 0.9
            
            # Adjust based on message characteristics
            if "?" in key_message:  # Questions tend to engage more
                base_score += 0.1
            if len(key_message.split()) > 10:  # Longer messages may engage more
                base_score += 0.05
            
            return min(1.0, max(0.0, base_score))
            
        except Exception as e:
            logger.error(f"Error parsing engagement potential score: {str(e)}")
            return 0.6
    
    def _calculate_uniqueness_scores(self, content_recommendations: List[Dict]) -> Dict[str, float]:
        """Calculate uniqueness scores for content recommendations."""
        try:
            uniqueness_scores = {}
            
            # Extract all titles and messages for comparison
            all_content = []
            for recommendation in content_recommendations:
                content_text = f"{recommendation.get('title', '')} {recommendation.get('key_message', '')}"
                all_content.append(content_text.lower())
            
            for i, recommendation in enumerate(content_recommendations):
                current_content = all_content[i]
                
                # Calculate uniqueness based on similarity to other content
                similarities = []
                for j, other_content in enumerate(all_content):
                    if i != j:
                        # Simple similarity calculation
                        common_words = set(current_content.split()) & set(other_content.split())
                        total_words = set(current_content.split()) | set(other_content.split())
                        similarity = len(common_words) / max(1, len(total_words))
                        similarities.append(similarity)
                
                # Uniqueness score is inverse of average similarity
                avg_similarity = sum(similarities) / max(1, len(similarities))
                uniqueness_score = 1.0 - avg_similarity
                
                uniqueness_scores[recommendation.get("title", "Unknown")] = uniqueness_score
            
            return uniqueness_scores
            
        except Exception as e:
            logger.error(f"Error calculating uniqueness scores: {str(e)}")
            return {}
    
    def _calculate_overall_quality_scores(
        self,
        relevance_scores: Dict[str, float],
        alignment_scores: Dict[str, float],
        platform_scores: Dict[str, float],
        engagement_scores: Dict[str, float],
        uniqueness_scores: Dict[str, float]
    ) -> Dict[str, Dict]:
        """Calculate overall quality scores for all content."""
        try:
            overall_scores = {}
            
            for title in relevance_scores.keys():
                relevance = relevance_scores.get(title, 0.5)
                alignment = alignment_scores.get(title, 0.5)
                platform = platform_scores.get(title, 0.5)
                engagement = engagement_scores.get(title, 0.5)
                uniqueness = uniqueness_scores.get(title, 0.5)
                
                # Calculate weighted overall score
                overall_score = (
                    relevance * self.quality_weights["content_relevance"] +
                    alignment * self.quality_weights["strategic_alignment"] +
                    platform * self.quality_weights["platform_optimization"] +
                    engagement * self.quality_weights["engagement_potential"] +
                    uniqueness * self.quality_weights["uniqueness"]
                )
                
                # Determine quality category
                quality_category = self._determine_quality_category(overall_score)
                
                overall_scores[title] = {
                    "overall_score": overall_score,
                    "quality_category": quality_category,
                    "component_scores": {
                        "relevance": relevance,
                        "alignment": alignment,
                        "platform": platform,
                        "engagement": engagement,
                        "uniqueness": uniqueness
                    }
                }
            
            return overall_scores
            
        except Exception as e:
            logger.error(f"Error calculating overall quality scores: {str(e)}")
            return {}
    
    def _determine_quality_category(self, score: float) -> str:
        """Determine quality category based on score."""
        if score >= self.quality_thresholds["excellent"]:
            return "excellent"
        elif score >= self.quality_thresholds["good"]:
            return "good"
        elif score >= self.quality_thresholds["acceptable"]:
            return "acceptable"
        else:
            return "needs_improvement"
    
    def _generate_quality_recommendations(
        self,
        content_recommendations: List[Dict],
        overall_quality_scores: Dict[str, Dict]
    ) -> List[Dict]:
        """Generate quality-based recommendations."""
        try:
            quality_recommendations = []
            
            # Sort content by quality score
            sorted_content = sorted(
                content_recommendations,
                key=lambda x: overall_quality_scores.get(x.get("title", ""), {}).get("overall_score", 0),
                reverse=True
            )
            
            # Generate recommendations for top quality content
            for i, content in enumerate(sorted_content[:10]):  # Top 10 quality content
                title = content.get("title", "Unknown")
                quality_data = overall_quality_scores.get(title, {})
                
                recommendation = {
                    "content_title": title,
                    "content_type": content.get("content_type", "Unknown"),
                    "target_platform": content.get("target_platform", "Unknown"),
                    "quality_score": quality_data.get("overall_score", 0),
                    "quality_category": quality_data.get("quality_category", "needs_improvement"),
                    "quality_rank": i + 1,
                    "component_scores": quality_data.get("component_scores", {}),
                    "quality_recommendations": self._generate_quality_improvements(quality_data),
                    "priority": "high" if i < 3 else "medium",
                    "source": "quality_based"
                }
                
                quality_recommendations.append(recommendation)
            
            return quality_recommendations
            
        except Exception as e:
            logger.error(f"Error generating quality recommendations: {str(e)}")
            return []
    
    def _generate_quality_improvements(self, quality_data: Dict) -> List[str]:
        """Generate quality improvement recommendations."""
        try:
            improvements = []
            component_scores = quality_data.get("component_scores", {})
            
            # Generate improvements based on low component scores
            if component_scores.get("relevance", 1.0) < 0.7:
                improvements.append("Improve content relevance to target audience")
            
            if component_scores.get("alignment", 1.0) < 0.7:
                improvements.append("Better align with business goals")
            
            if component_scores.get("platform", 1.0) < 0.7:
                improvements.append("Optimize for target platform")
            
            if component_scores.get("engagement", 1.0) < 0.7:
                improvements.append("Enhance engagement potential")
            
            if component_scores.get("uniqueness", 1.0) < 0.7:
                improvements.append("Increase content uniqueness")
            
            return improvements
            
        except Exception as e:
            logger.error(f"Error generating quality improvements: {str(e)}")
            return ["Improve overall content quality"]
    
    def _calculate_quality_metrics_summary(
        self,
        overall_quality_scores: Dict[str, Dict],
        quality_recommendations: List[Dict]
    ) -> Dict[str, Any]:
        """Calculate quality metrics summary."""
        try:
            # Calculate average quality score
            quality_scores = [data.get("overall_score", 0) for data in overall_quality_scores.values()]
            avg_quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else 0
            
            # Calculate quality distribution
            quality_categories = [data.get("quality_category", "needs_improvement") for data in overall_quality_scores.values()]
            category_distribution = {}
            for category in quality_categories:
                category_distribution[category] = category_distribution.get(category, 0) + 1
            
            # Calculate component averages
            component_averages = {}
            if overall_quality_scores:
                components = ["relevance", "alignment", "platform", "engagement", "uniqueness"]
                for component in components:
                    scores = [data.get("component_scores", {}).get(component, 0) for data in overall_quality_scores.values()]
                    component_averages[component] = sum(scores) / len(scores) if scores else 0
            
            metrics = {
                "avg_quality_score": avg_quality_score,
                "quality_category_distribution": category_distribution,
                "component_averages": component_averages,
                "total_content_analyzed": len(overall_quality_scores),
                "high_quality_content": len([s for s in quality_scores if s >= 0.8]),
                "low_quality_content": len([s for s in quality_scores if s < 0.7]),
                "quality_recommendations_count": len(quality_recommendations)
            }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating quality metrics summary: {str(e)}")
            return {
                "avg_quality_score": 0.0,
                "quality_category_distribution": {},
                "component_averages": {},
                "total_content_analyzed": 0,
                "high_quality_content": 0,
                "low_quality_content": 0,
                "quality_recommendations_count": 0
            }

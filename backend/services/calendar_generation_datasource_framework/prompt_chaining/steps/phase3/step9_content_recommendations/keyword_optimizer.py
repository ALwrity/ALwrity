"""
Keyword Optimizer Module

This module optimizes keywords for content recommendations and provides keyword-based content ideas.
It ensures keyword relevance, search volume optimization, and content keyword integration.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher


class KeywordOptimizer:
    """
    Optimizes keywords for content recommendations and provides keyword-based content ideas.
    
    This module ensures:
    - Keyword relevance and search volume optimization
    - Keyword clustering and grouping
    - Content keyword integration
    - Long-tail keyword identification
    - Keyword performance prediction
    """
    
    def __init__(self):
        """Initialize the keyword optimizer with real AI services."""
        self.ai_engine = AIEngineService()
        self.keyword_researcher = KeywordResearcher()
        
        # Keyword optimization rules
        self.keyword_rules = {
            "min_search_volume": 100,
            "max_competition": 0.7,
            "keyword_cluster_size": 5,
            "long_tail_threshold": 3,
            "keyword_relevance_threshold": 0.8
        }
        
        logger.info("🎯 Keyword Optimizer initialized with real AI services")
    
    async def optimize_keywords_for_content(
        self,
        keywords: List[str],
        business_goals: List[str],
        target_audience: Dict,
        content_analysis: Dict
    ) -> Dict[str, Any]:
        """
        Optimize keywords for content recommendations.
        
        Args:
            keywords: Keywords from strategy
            business_goals: Business goals from strategy
            target_audience: Target audience information
            content_analysis: Content analysis from recommendation generator
            
        Returns:
            Optimized keywords with content recommendations
        """
        try:
            logger.info("🚀 Starting keyword optimization for content")
            
            # Analyze keyword performance and relevance
            keyword_analysis = await self._analyze_keyword_performance(keywords)
            
            # Generate keyword clusters
            keyword_clusters = self._generate_keyword_clusters(keywords, keyword_analysis)
            
            # Identify long-tail keywords
            long_tail_keywords = self._identify_long_tail_keywords(keywords, keyword_analysis)
            
            # Generate keyword-based content ideas
            keyword_content_ideas = await self._generate_keyword_content_ideas(
                keywords, keyword_analysis, business_goals, target_audience
            )
            
            # Optimize keyword distribution
            optimized_keyword_distribution = self._optimize_keyword_distribution(
                keywords, keyword_analysis, content_analysis
            )
            
            # Create comprehensive keyword optimization results
            optimization_results = {
                "keyword_analysis": keyword_analysis,
                "keyword_clusters": keyword_clusters,
                "long_tail_keywords": long_tail_keywords,
                "keyword_content_ideas": keyword_content_ideas,
                "optimized_keyword_distribution": optimized_keyword_distribution,
                "optimization_metrics": self._calculate_optimization_metrics(
                    keyword_analysis, keyword_clusters, long_tail_keywords
                )
            }
            
            logger.info(f"✅ Optimized {len(keywords)} keywords for content recommendations")
            return optimization_results
            
        except Exception as e:
            logger.error(f"❌ Keyword optimization failed: {str(e)}")
            raise
    
    async def _analyze_keyword_performance(self, keywords: List[str]) -> Dict[str, Any]:
        """
        Analyze keyword performance and relevance.
        
        Args:
            keywords: Keywords to analyze
            
        Returns:
            Keyword performance analysis
        """
        try:
            keyword_analysis = {}
            
            for keyword in keywords:
                # Create keyword analysis prompt
                prompt = self._create_keyword_analysis_prompt(keyword)
                
                # Get AI analysis
                ai_response = await self.ai_engine.generate_content(prompt, {
                    "step": "keyword_analysis",
                    "keyword": keyword
                })
                
                # Parse keyword analysis
                analysis = self._parse_keyword_analysis(ai_response, keyword)
                keyword_analysis[keyword] = analysis
            
            return keyword_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing keyword performance: {str(e)}")
            raise
    
    def _create_keyword_analysis_prompt(self, keyword: str) -> str:
        """Create prompt for keyword analysis."""
        
        prompt = f"""
        Analyze the keyword "{keyword}" for content marketing:
        
        REQUIREMENTS:
        1. Assess keyword relevance and search intent
        2. Estimate search volume and competition
        3. Identify content opportunities
        4. Suggest content types and formats
        5. Analyze keyword difficulty and ranking potential
        
        OUTPUT FORMAT:
        Provide analysis in the following structure:
        - Keyword Relevance Score (0-1)
        - Search Volume Estimate (Low/Medium/High)
        - Competition Level (Low/Medium/High)
        - Content Opportunities
        - Recommended Content Types
        - Keyword Difficulty
        - Ranking Potential
        """
        
        return prompt
    
    def _parse_keyword_analysis(self, ai_response: Dict, keyword: str) -> Dict[str, Any]:
        """Parse AI response into keyword analysis."""
        try:
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create structured analysis
            analysis = {
                "keyword": keyword,
                "relevance_score": 0.8,  # Default score, would be extracted from AI response
                "search_volume": "Medium",  # Default, would be extracted from AI response
                "competition_level": "Medium",  # Default, would be extracted from AI response
                "content_opportunities": [
                    f"Create content around {keyword}",
                    f"Develop {keyword} focused articles",
                    f"Create {keyword} related videos"
                ],
                "recommended_content_types": ["Article", "Post", "Video"],
                "keyword_difficulty": "Medium",
                "ranking_potential": "High",
                "ai_insights": insights[:3] if insights else []
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error parsing keyword analysis: {str(e)}")
            return {
                "keyword": keyword,
                "relevance_score": 0.5,
                "search_volume": "Low",
                "competition_level": "High",
                "content_opportunities": [],
                "recommended_content_types": ["Post"],
                "keyword_difficulty": "High",
                "ranking_potential": "Low",
                "ai_insights": []
            }
    
    def _generate_keyword_clusters(self, keywords: List[str], keyword_analysis: Dict) -> List[Dict]:
        """
        Generate keyword clusters based on similarity and relevance.
        
        Args:
            keywords: Keywords to cluster
            keyword_analysis: Keyword analysis results
            
        Returns:
            Keyword clusters
        """
        try:
            clusters = []
            
            # Simple clustering based on keyword length and relevance
            high_relevance_keywords = []
            medium_relevance_keywords = []
            low_relevance_keywords = []
            
            for keyword in keywords:
                analysis = keyword_analysis.get(keyword, {})
                relevance_score = analysis.get("relevance_score", 0.5)
                
                if relevance_score >= 0.8:
                    high_relevance_keywords.append(keyword)
                elif relevance_score >= 0.6:
                    medium_relevance_keywords.append(keyword)
                else:
                    low_relevance_keywords.append(keyword)
            
            # Create clusters
            if high_relevance_keywords:
                clusters.append({
                    "cluster_name": "High Relevance Keywords",
                    "keywords": high_relevance_keywords,
                    "priority": "high",
                    "content_focus": "Primary content themes",
                    "cluster_score": 0.9
                })
            
            if medium_relevance_keywords:
                clusters.append({
                    "cluster_name": "Medium Relevance Keywords",
                    "keywords": medium_relevance_keywords,
                    "priority": "medium",
                    "content_focus": "Secondary content themes",
                    "cluster_score": 0.7
                })
            
            if low_relevance_keywords:
                clusters.append({
                    "cluster_name": "Low Relevance Keywords",
                    "keywords": low_relevance_keywords,
                    "priority": "low",
                    "content_focus": "Niche content opportunities",
                    "cluster_score": 0.5
                })
            
            return clusters
            
        except Exception as e:
            logger.error(f"Error generating keyword clusters: {str(e)}")
            return []
    
    def _identify_long_tail_keywords(self, keywords: List[str], keyword_analysis: Dict) -> List[Dict]:
        """
        Identify long-tail keywords from the keyword list.
        
        Args:
            keywords: Keywords to analyze
            keyword_analysis: Keyword analysis results
            
        Returns:
            Long-tail keywords with analysis
        """
        try:
            long_tail_keywords = []
            
            for keyword in keywords:
                # Check if keyword is long-tail (3+ words)
                word_count = len(keyword.split())
                
                if word_count >= self.keyword_rules["long_tail_threshold"]:
                    analysis = keyword_analysis.get(keyword, {})
                    
                    long_tail_keyword = {
                        "keyword": keyword,
                        "word_count": word_count,
                        "search_volume": analysis.get("search_volume", "Low"),
                        "competition_level": analysis.get("competition_level", "Low"),
                        "content_opportunities": analysis.get("content_opportunities", []),
                        "ranking_potential": analysis.get("ranking_potential", "High"),
                        "long_tail_score": self._calculate_long_tail_score(keyword, analysis)
                    }
                    
                    long_tail_keywords.append(long_tail_keyword)
            
            return long_tail_keywords
            
        except Exception as e:
            logger.error(f"Error identifying long-tail keywords: {str(e)}")
            return []
    
    def _calculate_long_tail_score(self, keyword: str, analysis: Dict) -> float:
        """Calculate long-tail keyword score."""
        try:
            score = 0.0
            
            # Word count score
            word_count = len(keyword.split())
            score += min(1.0, word_count / 5.0) * 0.3
            
            # Competition score (lower competition = higher score)
            competition = analysis.get("competition_level", "Medium")
            if competition == "Low":
                score += 0.4
            elif competition == "Medium":
                score += 0.2
            
            # Ranking potential score
            ranking_potential = analysis.get("ranking_potential", "Medium")
            if ranking_potential == "High":
                score += 0.3
            elif ranking_potential == "Medium":
                score += 0.2
            
            return min(1.0, score)
            
        except Exception as e:
            logger.error(f"Error calculating long-tail score: {str(e)}")
            return 0.5
    
    async def _generate_keyword_content_ideas(
        self,
        keywords: List[str],
        keyword_analysis: Dict,
        business_goals: List[str],
        target_audience: Dict
    ) -> List[Dict]:
        """
        Generate keyword-based content ideas.
        
        Args:
            keywords: Keywords to generate ideas for
            keyword_analysis: Keyword analysis results
            business_goals: Business goals from strategy
            target_audience: Target audience information
            
        Returns:
            Keyword-based content ideas
        """
        try:
            keyword_content_ideas = []
            
            for keyword in keywords:
                # Create keyword content generation prompt
                prompt = self._create_keyword_content_prompt(
                    keyword, keyword_analysis.get(keyword, {}), business_goals, target_audience
                )
                
                # Get AI-generated content ideas
                ai_response = await self.ai_engine.generate_content(prompt, {
                    "step": "keyword_content_ideas",
                    "keyword": keyword
                })
                
                # Parse keyword content ideas
                ideas = self._parse_keyword_content_ideas(ai_response, keyword, keyword_analysis.get(keyword, {}))
                keyword_content_ideas.extend(ideas)
            
            return keyword_content_ideas
            
        except Exception as e:
            logger.error(f"Error generating keyword content ideas: {str(e)}")
            raise
    
    def _create_keyword_content_prompt(
        self,
        keyword: str,
        keyword_analysis: Dict,
        business_goals: List[str],
        target_audience: Dict
    ) -> str:
        """Create prompt for keyword-based content generation."""
        
        prompt = f"""
        Generate content ideas for the keyword "{keyword}":
        
        KEYWORD ANALYSIS:
        Relevance Score: {keyword_analysis.get('relevance_score', 0.5)}
        Search Volume: {keyword_analysis.get('search_volume', 'Medium')}
        Competition Level: {keyword_analysis.get('competition_level', 'Medium')}
        
        BUSINESS GOALS:
        {', '.join(business_goals)}
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Interests: {target_audience.get('interests', 'N/A')}
        
        REQUIREMENTS:
        1. Create content ideas that naturally incorporate the keyword
        2. Focus on user intent and search purpose
        3. Consider different content types and formats
        4. Align with business goals and target audience
        5. Optimize for search visibility and engagement
        
        OUTPUT FORMAT:
        Provide content ideas with:
        - Content Title
        - Content Type
        - Target Platform
        - Key Message
        - Keyword Integration Strategy
        - Expected Impact
        """
        
        return prompt
    
    def _parse_keyword_content_ideas(
        self,
        ai_response: Dict,
        keyword: str,
        keyword_analysis: Dict
    ) -> List[Dict]:
        """Parse AI response into keyword-based content ideas."""
        try:
            content_ideas = []
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create keyword-based content ideas
            content_types = keyword_analysis.get("recommended_content_types", ["Article", "Post"])
            
            for i, content_type in enumerate(content_types):
                idea = {
                    "title": f"{keyword} - {content_type} {i+1}",
                    "content_type": content_type,
                    "target_platform": "LinkedIn" if content_type == "Article" else "Twitter",
                    "key_message": f"Content focused on {keyword}",
                    "keyword_integration_strategy": f"Naturally incorporate {keyword} throughout content",
                    "expected_impact": "High search visibility and engagement",
                    "keyword": keyword,
                    "relevance_score": keyword_analysis.get("relevance_score", 0.5),
                    "priority": "high" if keyword_analysis.get("relevance_score", 0.5) >= 0.8 else "medium",
                    "source": "keyword_based"
                }
                content_ideas.append(idea)
            
            # Add AI insights if available
            if insights:
                for i, insight in enumerate(insights[:2]):
                    idea = {
                        "title": f"{keyword} AI Insight {i+1}: {insight[:40]}...",
                        "content_type": "Post",
                        "target_platform": "LinkedIn",
                        "key_message": insight,
                        "keyword_integration_strategy": f"Use {keyword} in AI-generated content",
                        "expected_impact": "AI-optimized content performance",
                        "keyword": keyword,
                        "relevance_score": keyword_analysis.get("relevance_score", 0.5),
                        "priority": "medium",
                        "source": "ai_keyword_insights"
                    }
                    content_ideas.append(idea)
            
            return content_ideas
            
        except Exception as e:
            logger.error(f"Error parsing keyword content ideas: {str(e)}")
            return []
    
    def _optimize_keyword_distribution(
        self,
        keywords: List[str],
        keyword_analysis: Dict,
        content_analysis: Dict
    ) -> Dict[str, Any]:
        """
        Optimize keyword distribution across content.
        
        Args:
            keywords: Keywords to distribute
            keyword_analysis: Keyword analysis results
            content_analysis: Content analysis results
            
        Returns:
            Optimized keyword distribution
        """
        try:
            # Calculate keyword distribution metrics
            total_content_pieces = content_analysis.get("content_coverage", {}).get("schedules", {}).get("total_content_pieces", 0)
            
            # Distribute keywords based on relevance and content volume
            high_priority_keywords = []
            medium_priority_keywords = []
            low_priority_keywords = []
            
            for keyword in keywords:
                analysis = keyword_analysis.get(keyword, {})
                relevance_score = analysis.get("relevance_score", 0.5)
                
                if relevance_score >= 0.8:
                    high_priority_keywords.append(keyword)
                elif relevance_score >= 0.6:
                    medium_priority_keywords.append(keyword)
                else:
                    low_priority_keywords.append(keyword)
            
            # Calculate distribution ratios
            distribution = {
                "high_priority_keywords": {
                    "keywords": high_priority_keywords,
                    "target_frequency": min(len(high_priority_keywords) * 2, total_content_pieces // 2),
                    "distribution_ratio": 0.5
                },
                "medium_priority_keywords": {
                    "keywords": medium_priority_keywords,
                    "target_frequency": min(len(medium_priority_keywords), total_content_pieces // 3),
                    "distribution_ratio": 0.3
                },
                "low_priority_keywords": {
                    "keywords": low_priority_keywords,
                    "target_frequency": min(len(low_priority_keywords), total_content_pieces // 6),
                    "distribution_ratio": 0.2
                }
            }
            
            return distribution
            
        except Exception as e:
            logger.error(f"Error optimizing keyword distribution: {str(e)}")
            return {
                "high_priority_keywords": {"keywords": [], "target_frequency": 0, "distribution_ratio": 0.5},
                "medium_priority_keywords": {"keywords": [], "target_frequency": 0, "distribution_ratio": 0.3},
                "low_priority_keywords": {"keywords": [], "target_frequency": 0, "distribution_ratio": 0.2}
            }
    
    def _calculate_optimization_metrics(
        self,
        keyword_analysis: Dict,
        keyword_clusters: List[Dict],
        long_tail_keywords: List[Dict]
    ) -> Dict[str, Any]:
        """
        Calculate keyword optimization metrics.
        
        Args:
            keyword_analysis: Keyword analysis results
            keyword_clusters: Keyword clusters
            long_tail_keywords: Long-tail keywords
            
        Returns:
            Optimization metrics
        """
        try:
            # Calculate average relevance score
            relevance_scores = [analysis.get("relevance_score", 0.5) for analysis in keyword_analysis.values()]
            avg_relevance_score = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0.0
            
            # Calculate cluster effectiveness
            cluster_effectiveness = len(keyword_clusters) / max(1, len(keyword_analysis))
            
            # Calculate long-tail keyword ratio
            long_tail_ratio = len(long_tail_keywords) / max(1, len(keyword_analysis))
            
            # Calculate overall optimization score
            optimization_score = (
                avg_relevance_score * 0.4 +
                cluster_effectiveness * 0.3 +
                long_tail_ratio * 0.3
            )
            
            metrics = {
                "avg_relevance_score": avg_relevance_score,
                "cluster_effectiveness": cluster_effectiveness,
                "long_tail_ratio": long_tail_ratio,
                "optimization_score": optimization_score,
                "total_keywords": len(keyword_analysis),
                "total_clusters": len(keyword_clusters),
                "total_long_tail": len(long_tail_keywords)
            }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating optimization metrics: {str(e)}")
            return {
                "avg_relevance_score": 0.0,
                "cluster_effectiveness": 0.0,
                "long_tail_ratio": 0.0,
                "optimization_score": 0.0,
                "total_keywords": 0,
                "total_clusters": 0,
                "total_long_tail": 0
            }

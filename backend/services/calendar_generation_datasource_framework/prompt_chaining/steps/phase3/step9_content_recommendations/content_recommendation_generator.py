"""
Content Recommendation Generator Module

This module generates AI-powered content recommendations and ideas based on strategic insights.
It ensures content variety, strategic alignment, and engagement optimization.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher


class ContentRecommendationGenerator:
    """
    Generates AI-powered content recommendations and ideas.
    
    This module ensures:
    - Strategic content idea generation
    - Content variety and diversity
    - Engagement optimization
    - Platform-specific recommendations
    - Content type optimization
    """
    
    def __init__(self):
        """Initialize the content recommendation generator with real AI services."""
        self.ai_engine = AIEngineService()
        self.keyword_researcher = KeywordResearcher()
        
        # Content recommendation rules
        self.recommendation_rules = {
            "min_recommendations": 10,
            "max_recommendations": 25,
            "content_variety_threshold": 0.8,
            "engagement_optimization": True,
            "platform_specific": True,
            "keyword_integration": True
        }
        
        # Content types for recommendations
        self.content_types = {
            "LinkedIn": ["Article", "Post", "Video", "Carousel", "Poll"],
            "Twitter": ["Tweet", "Thread", "Video", "Poll", "Space"],
            "Instagram": ["Post", "Story", "Reel", "Carousel", "Live"],
            "Facebook": ["Post", "Video", "Live", "Event", "Poll"],
            "Blog": ["Article", "How-to", "Case Study", "Interview", "List"]
        }
        
        logger.info("🎯 Content Recommendation Generator initialized with real AI services")
    
    async def generate_content_recommendations(
        self,
        weekly_themes: List[Dict],
        daily_schedules: List[Dict],
        keywords: List[str],
        business_goals: List[str],
        target_audience: Dict,
        platform_strategies: Dict
    ) -> List[Dict]:
        """
        Generate comprehensive content recommendations.
        
        Args:
            weekly_themes: Weekly themes from Step 7
            daily_schedules: Daily schedules from Step 8
            keywords: Keywords from strategy
            business_goals: Business goals from strategy
            target_audience: Target audience information
            platform_strategies: Platform strategies from Step 6
            
        Returns:
            Comprehensive content recommendations
        """
        try:
            logger.info("🚀 Starting content recommendation generation")
            
            # Analyze existing content for gap identification
            content_analysis = self._analyze_existing_content(weekly_themes, daily_schedules)
            
            # Generate strategic content ideas
            strategic_ideas = await self._generate_strategic_content_ideas(
                business_goals, target_audience, keywords
            )
            
            # Generate platform-specific recommendations
            platform_recommendations = await self._generate_platform_recommendations(
                platform_strategies, content_analysis, keywords
            )
            
            # Generate content type recommendations
            content_type_recommendations = await self._generate_content_type_recommendations(
                content_analysis, platform_strategies
            )
            
            # Generate engagement-focused recommendations
            engagement_recommendations = await self._generate_engagement_recommendations(
                target_audience, content_analysis
            )
            
            # Combine and optimize recommendations
            combined_recommendations = self._combine_recommendations(
                strategic_ideas, platform_recommendations, content_type_recommendations, engagement_recommendations
            )
            
            # Apply quality filters and optimization
            optimized_recommendations = self._optimize_recommendations(combined_recommendations)
            
            # Add recommendation metadata
            final_recommendations = self._add_recommendation_metadata(
                optimized_recommendations, content_analysis
            )
            
            logger.info(f"✅ Generated {len(final_recommendations)} content recommendations")
            return final_recommendations
            
        except Exception as e:
            logger.error(f"❌ Content recommendation generation failed: {str(e)}")
            raise
    
    def _analyze_existing_content(
        self,
        weekly_themes: List[Dict],
        daily_schedules: List[Dict]
    ) -> Dict[str, Any]:
        """
        Analyze existing content to identify gaps and opportunities.
        
        Args:
            weekly_themes: Weekly themes from Step 7
            daily_schedules: Daily schedules from Step 8
            
        Returns:
            Content analysis with gaps and opportunities
        """
        try:
            analysis = {
                "content_coverage": {},
                "content_gaps": [],
                "content_opportunities": [],
                "content_variety_score": 0.0,
                "platform_distribution": {},
                "content_type_distribution": {}
            }
            
            # Analyze weekly themes
            theme_analysis = self._analyze_weekly_themes(weekly_themes)
            analysis["content_coverage"]["themes"] = theme_analysis
            
            # Analyze daily schedules
            schedule_analysis = self._analyze_daily_schedules(daily_schedules)
            analysis["content_coverage"]["schedules"] = schedule_analysis
            
            # Identify content gaps
            analysis["content_gaps"] = self._identify_content_gaps(theme_analysis, schedule_analysis)
            
            # Identify content opportunities
            analysis["content_opportunities"] = self._identify_content_opportunities(
                theme_analysis, schedule_analysis
            )
            
            # Calculate content variety score
            analysis["content_variety_score"] = self._calculate_content_variety_score(
                theme_analysis, schedule_analysis
            )
            
            # Analyze platform distribution
            analysis["platform_distribution"] = self._analyze_platform_distribution(daily_schedules)
            
            # Analyze content type distribution
            analysis["content_type_distribution"] = self._analyze_content_type_distribution(daily_schedules)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing existing content: {str(e)}")
            raise
    
    def _analyze_weekly_themes(self, weekly_themes: List[Dict]) -> Dict[str, Any]:
        """Analyze weekly themes for content coverage."""
        try:
            theme_analysis = {
                "total_themes": len(weekly_themes),
                "theme_topics": [],
                "theme_angles": [],
                "theme_coverage": {}
            }
            
            for theme in weekly_themes:
                theme_analysis["theme_topics"].append(theme.get("theme", ""))
                theme_analysis["theme_angles"].extend(theme.get("content_angles", []))
                
                # Analyze theme coverage
                week_number = theme.get("week_number", 0)
                theme_analysis["theme_coverage"][week_number] = {
                    "theme": theme.get("theme", ""),
                    "angles": theme.get("content_angles", []),
                    "pillars": theme.get("content_pillars", [])
                }
            
            return theme_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing weekly themes: {str(e)}")
            return {"total_themes": 0, "theme_topics": [], "theme_angles": [], "theme_coverage": {}}
    
    def _analyze_daily_schedules(self, daily_schedules: List[Dict]) -> Dict[str, Any]:
        """Analyze daily schedules for content coverage."""
        try:
            schedule_analysis = {
                "total_schedules": len(daily_schedules),
                "total_content_pieces": 0,
                "platform_distribution": {},
                "content_type_distribution": {},
                "content_topics": []
            }
            
            for schedule in daily_schedules:
                content_pieces = schedule.get("content_pieces", [])
                schedule_analysis["total_content_pieces"] += len(content_pieces)
                
                for piece in content_pieces:
                    # Platform distribution
                    platform = piece.get("target_platform", "Unknown")
                    schedule_analysis["platform_distribution"][platform] = \
                        schedule_analysis["platform_distribution"].get(platform, 0) + 1
                    
                    # Content type distribution
                    content_type = piece.get("content_type", "Unknown")
                    schedule_analysis["content_type_distribution"][content_type] = \
                        schedule_analysis["content_type_distribution"].get(content_type, 0) + 1
                    
                    # Content topics
                    title = piece.get("title", "")
                    if title:
                        schedule_analysis["content_topics"].append(title)
            
            return schedule_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing daily schedules: {str(e)}")
            return {
                "total_schedules": 0,
                "total_content_pieces": 0,
                "platform_distribution": {},
                "content_type_distribution": {},
                "content_topics": []
            }
    
    def _identify_content_gaps(
        self,
        theme_analysis: Dict,
        schedule_analysis: Dict
    ) -> List[Dict]:
        """Identify content gaps based on analysis."""
        try:
            gaps = []
            
            # Identify missing content types
            content_types = schedule_analysis.get("content_type_distribution", {})
            if not content_types.get("Video", 0):
                gaps.append({
                    "type": "content_type",
                    "gap": "Video content",
                    "priority": "high",
                    "reason": "No video content in current schedule"
                })
            
            if not content_types.get("Article", 0):
                gaps.append({
                    "type": "content_type",
                    "gap": "Long-form articles",
                    "priority": "medium",
                    "reason": "No long-form content for thought leadership"
                })
            
            # Identify platform gaps
            platform_dist = schedule_analysis.get("platform_distribution", {})
            if not platform_dist.get("LinkedIn", 0):
                gaps.append({
                    "type": "platform",
                    "gap": "LinkedIn content",
                    "priority": "high",
                    "reason": "No LinkedIn content for professional audience"
                })
            
            # Identify theme gaps
            theme_topics = theme_analysis.get("theme_topics", [])
            if len(theme_topics) < 4:
                gaps.append({
                    "type": "theme",
                    "gap": "Theme variety",
                    "priority": "medium",
                    "reason": "Limited theme variety in weekly themes"
                })
            
            return gaps
            
        except Exception as e:
            logger.error(f"Error identifying content gaps: {str(e)}")
            return []
    
    def _identify_content_opportunities(
        self,
        theme_analysis: Dict,
        schedule_analysis: Dict
    ) -> List[Dict]:
        """Identify content opportunities based on analysis."""
        try:
            opportunities = []
            
            # Identify trending topics
            content_topics = schedule_analysis.get("content_topics", [])
            if content_topics:
                opportunities.append({
                    "type": "trending",
                    "opportunity": "Expand on popular topics",
                    "priority": "high",
                    "reason": "Build on existing successful content themes"
                })
            
            # Identify platform opportunities
            platform_dist = schedule_analysis.get("platform_distribution", {})
            if platform_dist.get("LinkedIn", 0) > 0:
                opportunities.append({
                    "type": "platform",
                    "opportunity": "LinkedIn thought leadership",
                    "priority": "medium",
                    "reason": "Expand LinkedIn presence with professional content"
                })
            
            # Identify content type opportunities
            content_types = schedule_analysis.get("content_type_distribution", {})
            if content_types.get("Post", 0) > 0:
                opportunities.append({
                    "type": "content_type",
                    "opportunity": "Engagement posts",
                    "priority": "medium",
                    "reason": "Build on successful post formats"
                })
            
            return opportunities
            
        except Exception as e:
            logger.error(f"Error identifying content opportunities: {str(e)}")
            return []
    
    def _calculate_content_variety_score(
        self,
        theme_analysis: Dict,
        schedule_analysis: Dict
    ) -> float:
        """Calculate content variety score."""
        try:
            # Calculate variety based on different factors
            theme_variety = len(set(theme_analysis.get("theme_topics", []))) / max(1, len(theme_analysis.get("theme_topics", [])))
            platform_variety = len(schedule_analysis.get("platform_distribution", {})) / 5.0  # Assuming 5 platforms
            content_type_variety = len(schedule_analysis.get("content_type_distribution", {})) / 8.0  # Assuming 8 content types
            
            # Weighted average
            variety_score = (theme_variety * 0.4 + platform_variety * 0.3 + content_type_variety * 0.3)
            
            return min(1.0, max(0.0, variety_score))
            
        except Exception as e:
            logger.error(f"Error calculating content variety score: {str(e)}")
            return 0.0
    
    def _analyze_platform_distribution(self, daily_schedules: List[Dict]) -> Dict[str, int]:
        """Analyze platform distribution across daily schedules."""
        try:
            platform_distribution = {}
            
            for schedule in daily_schedules:
                for piece in schedule.get("content_pieces", []):
                    platform = piece.get("target_platform", "Unknown")
                    platform_distribution[platform] = platform_distribution.get(platform, 0) + 1
            
            return platform_distribution
            
        except Exception as e:
            logger.error(f"Error analyzing platform distribution: {str(e)}")
            return {}
    
    def _analyze_content_type_distribution(self, daily_schedules: List[Dict]) -> Dict[str, int]:
        """Analyze content type distribution across daily schedules."""
        try:
            content_type_distribution = {}
            
            for schedule in daily_schedules:
                for piece in schedule.get("content_pieces", []):
                    content_type = piece.get("content_type", "Unknown")
                    content_type_distribution[content_type] = content_type_distribution.get(content_type, 0) + 1
            
            return content_type_distribution
            
        except Exception as e:
            logger.error(f"Error analyzing content type distribution: {str(e)}")
            return {}
    
    async def _generate_strategic_content_ideas(
        self,
        business_goals: List[str],
        target_audience: Dict,
        keywords: List[str]
    ) -> List[Dict]:
        """Generate strategic content ideas based on business goals and audience."""
        try:
            # Create strategic content generation prompt
            prompt = self._create_strategic_content_prompt(business_goals, target_audience, keywords)
            
            # Get AI-generated strategic ideas
            ai_response = await self.ai_engine.generate_content(prompt, {
                "step": "strategic_content_ideas",
                "business_goals": business_goals,
                "audience": target_audience.get("demographics", "N/A")
            })
            
            # Parse and structure strategic ideas
            strategic_ideas = self._parse_strategic_ideas(ai_response, business_goals, keywords)
            
            return strategic_ideas
            
        except Exception as e:
            logger.error(f"Error generating strategic content ideas: {str(e)}")
            raise
    
    def _create_strategic_content_prompt(
        self,
        business_goals: List[str],
        target_audience: Dict,
        keywords: List[str]
    ) -> str:
        """Create prompt for strategic content idea generation."""
        
        prompt = f"""
        Generate strategic content ideas based on the following business context:
        
        BUSINESS GOALS:
        {', '.join(business_goals)}
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Interests: {target_audience.get('interests', 'N/A')}
        Pain Points: {target_audience.get('pain_points', 'N/A')}
        
        KEYWORDS:
        {', '.join(keywords)}
        
        REQUIREMENTS:
        1. Generate content ideas that align with business goals
        2. Create content that resonates with target audience
        3. Incorporate relevant keywords naturally
        4. Focus on high-value, engaging content
        5. Consider different content types and formats
        6. Ensure strategic alignment and business impact
        
        OUTPUT FORMAT:
        Provide content ideas in the following structure:
        - Content Title
        - Content Type
        - Target Platform
        - Key Message
        - Strategic Alignment
        - Expected Impact
        - Keywords to Include
        """
        
        return prompt
    
    def _parse_strategic_ideas(
        self,
        ai_response: Dict,
        business_goals: List[str],
        keywords: List[str]
    ) -> List[Dict]:
        """Parse AI response into structured strategic content ideas."""
        try:
            strategic_ideas = []
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create strategic ideas based on business goals and keywords
            for i, goal in enumerate(business_goals[:5]):  # Limit to 5 goals
                for j, keyword in enumerate(keywords[:3]):  # Limit to 3 keywords per goal
                    idea = {
                        "title": f"Strategic Content {i+1}.{j+1}: {goal} - {keyword}",
                        "content_type": "Article" if i % 2 == 0 else "Post",
                        "target_platform": "LinkedIn" if i % 2 == 0 else "Twitter",
                        "key_message": f"Strategic content focusing on {goal} using {keyword}",
                        "strategic_alignment": goal,
                        "expected_impact": "High engagement and thought leadership",
                        "keywords": [keyword],
                        "priority": "high" if i < 2 else "medium",
                        "source": "strategic_analysis"
                    }
                    strategic_ideas.append(idea)
            
            # Add AI-generated insights if available
            if insights:
                for i, insight in enumerate(insights[:3]):
                    idea = {
                        "title": f"AI Insight {i+1}: {insight[:50]}...",
                        "content_type": "Post",
                        "target_platform": "LinkedIn",
                        "key_message": insight,
                        "strategic_alignment": "AI-driven insights",
                        "expected_impact": "Innovation and thought leadership",
                        "keywords": keywords[:2],
                        "priority": "medium",
                        "source": "ai_insights"
                    }
                    strategic_ideas.append(idea)
            
            return strategic_ideas
            
        except Exception as e:
            logger.error(f"Error parsing strategic ideas: {str(e)}")
            return []
    
    async def _generate_platform_recommendations(
        self,
        platform_strategies: Dict,
        content_analysis: Dict,
        keywords: List[str]
    ) -> List[Dict]:
        """Generate platform-specific content recommendations."""
        try:
            platform_recommendations = []
            
            for platform, strategy in platform_strategies.items():
                # Create platform-specific recommendations
                platform_ideas = await self._generate_platform_specific_ideas(
                    platform, strategy, content_analysis, keywords
                )
                platform_recommendations.extend(platform_ideas)
            
            return platform_recommendations
            
        except Exception as e:
            logger.error(f"Error generating platform recommendations: {str(e)}")
            raise
    
    async def _generate_platform_specific_ideas(
        self,
        platform: str,
        strategy: Dict,
        content_analysis: Dict,
        keywords: List[str]
    ) -> List[Dict]:
        """Generate platform-specific content ideas."""
        try:
            # Create platform-specific prompt
            prompt = self._create_platform_specific_prompt(platform, strategy, keywords)
            
            # Get AI-generated platform ideas
            ai_response = await self.ai_engine.generate_content(prompt, {
                "step": "platform_specific_ideas",
                "platform": platform,
                "strategy": strategy.get("approach", "N/A")
            })
            
            # Parse platform-specific ideas
            platform_ideas = self._parse_platform_ideas(ai_response, platform, strategy, keywords)
            
            return platform_ideas
            
        except Exception as e:
            logger.error(f"Error generating platform-specific ideas: {str(e)}")
            return []
    
    def _create_platform_specific_prompt(
        self,
        platform: str,
        strategy: Dict,
        keywords: List[str]
    ) -> str:
        """Create prompt for platform-specific content generation."""
        
        prompt = f"""
        Generate platform-specific content ideas for {platform}:
        
        PLATFORM STRATEGY:
        Approach: {strategy.get('approach', 'N/A')}
        Tone: {strategy.get('tone', 'N/A')}
        Content Types: {', '.join(self.content_types.get(platform, []))}
        
        KEYWORDS:
        {', '.join(keywords)}
        
        REQUIREMENTS:
        1. Create content ideas optimized for {platform}
        2. Follow platform-specific best practices
        3. Incorporate relevant keywords naturally
        4. Consider platform-specific content types
        5. Ensure engagement and reach optimization
        6. Align with platform strategy and tone
        
        OUTPUT FORMAT:
        Provide platform-specific content ideas with:
        - Content Title
        - Content Type
        - Key Message
        - Engagement Strategy
        - Keywords to Include
        - Platform Optimization Notes
        """
        
        return prompt
    
    def _parse_platform_ideas(
        self,
        ai_response: Dict,
        platform: str,
        strategy: Dict,
        keywords: List[str]
    ) -> List[Dict]:
        """Parse AI response into platform-specific content ideas."""
        try:
            platform_ideas = []
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create platform-specific ideas
            content_types = self.content_types.get(platform, ["Post"])
            
            for i, content_type in enumerate(content_types[:3]):  # Limit to 3 content types
                for j, keyword in enumerate(keywords[:2]):  # Limit to 2 keywords per content type
                    idea = {
                        "title": f"{platform} {content_type} {i+1}.{j+1}: {keyword}",
                        "content_type": content_type,
                        "target_platform": platform,
                        "key_message": f"Platform-optimized {content_type.lower()} for {platform} using {keyword}",
                        "engagement_strategy": f"Optimize for {platform} engagement patterns",
                        "keywords": [keyword],
                        "platform_optimization": f"Follow {platform} best practices",
                        "priority": "high" if i == 0 else "medium",
                        "source": "platform_specific"
                    }
                    platform_ideas.append(idea)
            
            # Add AI insights if available
            if insights:
                for i, insight in enumerate(insights[:2]):
                    idea = {
                        "title": f"{platform} AI Insight {i+1}: {insight[:40]}...",
                        "content_type": "Post",
                        "target_platform": platform,
                        "key_message": insight,
                        "engagement_strategy": "Leverage AI insights for engagement",
                        "keywords": keywords[:1],
                        "platform_optimization": f"AI-optimized for {platform}",
                        "priority": "medium",
                        "source": "ai_platform_insights"
                    }
                    platform_ideas.append(idea)
            
            return platform_ideas
            
        except Exception as e:
            logger.error(f"Error parsing platform ideas: {str(e)}")
            return []
    
    async def _generate_content_type_recommendations(
        self,
        content_analysis: Dict,
        platform_strategies: Dict
    ) -> List[Dict]:
        """Generate content type-specific recommendations."""
        try:
            content_type_recommendations = []
            
            # Analyze content type gaps
            content_type_dist = content_analysis.get("content_type_distribution", {})
            
            # Generate recommendations for missing content types
            all_content_types = ["Article", "Video", "Post", "Story", "Carousel", "Poll", "Live"]
            
            for content_type in all_content_types:
                if not content_type_dist.get(content_type, 0):
                    # Generate recommendations for missing content types
                    type_recommendations = await self._generate_content_type_ideas(
                        content_type, platform_strategies
                    )
                    content_type_recommendations.extend(type_recommendations)
            
            return content_type_recommendations
            
        except Exception as e:
            logger.error(f"Error generating content type recommendations: {str(e)}")
            raise
    
    async def _generate_content_type_ideas(
        self,
        content_type: str,
        platform_strategies: Dict
    ) -> List[Dict]:
        """Generate content type-specific ideas."""
        try:
            content_type_ideas = []
            
            # Create content type-specific prompt
            prompt = self._create_content_type_prompt(content_type, platform_strategies)
            
            # Get AI-generated content type ideas
            ai_response = await self.ai_engine.generate_content(prompt, {
                "step": "content_type_ideas",
                "content_type": content_type
            })
            
            # Parse content type ideas
            type_ideas = self._parse_content_type_ideas(ai_response, content_type, platform_strategies)
            
            return type_ideas
            
        except Exception as e:
            logger.error(f"Error generating content type ideas: {str(e)}")
            return []
    
    def _create_content_type_prompt(
        self,
        content_type: str,
        platform_strategies: Dict
    ) -> str:
        """Create prompt for content type-specific generation."""
        
        prompt = f"""
        Generate {content_type} content ideas:
        
        CONTENT TYPE: {content_type}
        
        PLATFORM STRATEGIES:
        {self._format_platform_strategies(platform_strategies)}
        
        REQUIREMENTS:
        1. Create engaging {content_type} content ideas
        2. Optimize for {content_type} format and best practices
        3. Consider platform-specific variations
        4. Focus on engagement and value
        5. Ensure content type optimization
        
        OUTPUT FORMAT:
        Provide {content_type} content ideas with:
        - Content Title
        - Target Platform
        - Key Message
        - Content Type Optimization
        - Engagement Strategy
        """
        
        return prompt
    
    def _format_platform_strategies(self, platform_strategies: Dict) -> str:
        """Format platform strategies for prompt."""
        formatted = []
        for platform, strategy in platform_strategies.items():
            formatted.append(f"{platform}: {strategy.get('approach', 'N/A')}")
        return '\n'.join(formatted)
    
    def _parse_content_type_ideas(
        self,
        ai_response: Dict,
        content_type: str,
        platform_strategies: Dict
    ) -> List[Dict]:
        """Parse AI response into content type-specific ideas."""
        try:
            content_type_ideas = []
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create content type-specific ideas
            platforms = list(platform_strategies.keys())
            
            for i, platform in enumerate(platforms[:3]):  # Limit to 3 platforms
                idea = {
                    "title": f"{content_type} for {platform} {i+1}",
                    "content_type": content_type,
                    "target_platform": platform,
                    "key_message": f"Optimized {content_type.lower()} content for {platform}",
                    "content_type_optimization": f"Follow {content_type} best practices",
                    "engagement_strategy": f"Optimize {content_type} engagement for {platform}",
                    "priority": "high" if i == 0 else "medium",
                    "source": "content_type_specific"
                }
                content_type_ideas.append(idea)
            
            # Add AI insights if available
            if insights:
                for i, insight in enumerate(insights[:2]):
                    idea = {
                        "title": f"{content_type} AI Insight {i+1}: {insight[:40]}...",
                        "content_type": content_type,
                        "target_platform": platforms[0] if platforms else "LinkedIn",
                        "key_message": insight,
                        "content_type_optimization": f"AI-optimized {content_type}",
                        "engagement_strategy": f"Leverage AI insights for {content_type}",
                        "priority": "medium",
                        "source": "ai_content_type_insights"
                    }
                    content_type_ideas.append(idea)
            
            return content_type_ideas
            
        except Exception as e:
            logger.error(f"Error parsing content type ideas: {str(e)}")
            return []
    
    async def _generate_engagement_recommendations(
        self,
        target_audience: Dict,
        content_analysis: Dict
    ) -> List[Dict]:
        """Generate engagement-focused content recommendations."""
        try:
            # Create engagement-focused prompt
            prompt = self._create_engagement_prompt(target_audience, content_analysis)
            
            # Get AI-generated engagement ideas
            ai_response = await self.ai_engine.generate_content(prompt, {
                "step": "engagement_recommendations",
                "audience": target_audience.get("demographics", "N/A")
            })
            
            # Parse engagement recommendations
            engagement_recommendations = self._parse_engagement_recommendations(
                ai_response, target_audience
            )
            
            return engagement_recommendations
            
        except Exception as e:
            logger.error(f"Error generating engagement recommendations: {str(e)}")
            raise
    
    def _create_engagement_prompt(
        self,
        target_audience: Dict,
        content_analysis: Dict
    ) -> str:
        """Create prompt for engagement-focused content generation."""
        
        prompt = f"""
        Generate engagement-focused content recommendations:
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Interests: {target_audience.get('interests', 'N/A')}
        Pain Points: {target_audience.get('pain_points', 'N/A')}
        
        CONTENT ANALYSIS:
        Content Variety Score: {content_analysis.get('content_variety_score', 0.0)}
        Platform Distribution: {content_analysis.get('platform_distribution', {})}
        
        REQUIREMENTS:
        1. Create content ideas that maximize engagement
        2. Focus on audience interests and pain points
        3. Consider interactive and engaging content types
        4. Optimize for social sharing and virality
        5. Ensure audience resonance and relevance
        
        OUTPUT FORMAT:
        Provide engagement-focused content ideas with:
        - Content Title
        - Content Type
        - Target Platform
        - Engagement Strategy
        - Audience Resonance
        - Viral Potential
        """
        
        return prompt
    
    def _parse_engagement_recommendations(
        self,
        ai_response: Dict,
        target_audience: Dict
    ) -> List[Dict]:
        """Parse AI response into engagement-focused recommendations."""
        try:
            engagement_recommendations = []
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create engagement-focused ideas
            engagement_types = ["Poll", "Question", "Story", "Interactive", "Viral"]
            
            for i, engagement_type in enumerate(engagement_types):
                idea = {
                    "title": f"Engagement {engagement_type} {i+1}",
                    "content_type": engagement_type,
                    "target_platform": "LinkedIn" if i % 2 == 0 else "Twitter",
                    "engagement_strategy": f"Maximize {engagement_type.lower()} engagement",
                    "audience_resonance": f"Target {target_audience.get('demographics', 'audience')} interests",
                    "viral_potential": "High" if engagement_type in ["Poll", "Interactive"] else "Medium",
                    "priority": "high" if i < 2 else "medium",
                    "source": "engagement_focused"
                }
                engagement_recommendations.append(idea)
            
            # Add AI insights if available
            if insights:
                for i, insight in enumerate(insights[:2]):
                    idea = {
                        "title": f"AI Engagement Insight {i+1}: {insight[:40]}...",
                        "content_type": "Post",
                        "target_platform": "LinkedIn",
                        "engagement_strategy": "Leverage AI insights for engagement",
                        "audience_resonance": "AI-optimized audience targeting",
                        "viral_potential": "Medium",
                        "priority": "medium",
                        "source": "ai_engagement_insights"
                    }
                    engagement_recommendations.append(idea)
            
            return engagement_recommendations
            
        except Exception as e:
            logger.error(f"Error parsing engagement recommendations: {str(e)}")
            return []
    
    def _combine_recommendations(
        self,
        strategic_ideas: List[Dict],
        platform_recommendations: List[Dict],
        content_type_recommendations: List[Dict],
        engagement_recommendations: List[Dict]
    ) -> List[Dict]:
        """Combine all recommendation types into a unified list."""
        try:
            combined_recommendations = []
            
            # Add strategic ideas
            combined_recommendations.extend(strategic_ideas)
            
            # Add platform recommendations
            combined_recommendations.extend(platform_recommendations)
            
            # Add content type recommendations
            combined_recommendations.extend(content_type_recommendations)
            
            # Add engagement recommendations
            combined_recommendations.extend(engagement_recommendations)
            
            # Remove duplicates based on title
            seen_titles = set()
            unique_recommendations = []
            
            for recommendation in combined_recommendations:
                title = recommendation.get("title", "")
                if title not in seen_titles:
                    seen_titles.add(title)
                    unique_recommendations.append(recommendation)
            
            return unique_recommendations
            
        except Exception as e:
            logger.error(f"Error combining recommendations: {str(e)}")
            return []
    
    def _optimize_recommendations(self, recommendations: List[Dict]) -> List[Dict]:
        """Optimize recommendations based on quality and variety."""
        try:
            if not recommendations:
                return []
            
            # Sort by priority
            priority_order = {"high": 3, "medium": 2, "low": 1}
            sorted_recommendations = sorted(
                recommendations,
                key=lambda x: priority_order.get(x.get("priority", "medium"), 1),
                reverse=True
            )
            
            # Limit to maximum recommendations
            max_recommendations = self.recommendation_rules["max_recommendations"]
            optimized_recommendations = sorted_recommendations[:max_recommendations]
            
            # Ensure minimum recommendations
            min_recommendations = self.recommendation_rules["min_recommendations"]
            if len(optimized_recommendations) < min_recommendations:
                # Add more recommendations if needed
                remaining = min_recommendations - len(optimized_recommendations)
                if len(sorted_recommendations) > len(optimized_recommendations):
                    optimized_recommendations.extend(
                        sorted_recommendations[len(optimized_recommendations):len(optimized_recommendations) + remaining]
                    )
            
            return optimized_recommendations
            
        except Exception as e:
            logger.error(f"Error optimizing recommendations: {str(e)}")
            return recommendations
    
    def _add_recommendation_metadata(
        self,
        recommendations: List[Dict],
        content_analysis: Dict
    ) -> List[Dict]:
        """Add metadata to recommendations."""
        try:
            for recommendation in recommendations:
                # Add recommendation ID
                recommendation["recommendation_id"] = f"rec_{len(recommendations)}"
                
                # Add generation timestamp
                recommendation["generated_at"] = "2025-01-21T10:00:00Z"
                
                # Add content analysis context
                recommendation["content_analysis_context"] = {
                    "content_variety_score": content_analysis.get("content_variety_score", 0.0),
                    "total_content_pieces": content_analysis.get("content_coverage", {}).get("schedules", {}).get("total_content_pieces", 0),
                    "platform_distribution": content_analysis.get("platform_distribution", {}),
                    "content_type_distribution": content_analysis.get("content_type_distribution", {})
                }
                
                # Add recommendation score
                recommendation["recommendation_score"] = self._calculate_recommendation_score(recommendation)
                
                # Add implementation difficulty
                recommendation["implementation_difficulty"] = self._calculate_implementation_difficulty(recommendation)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error adding recommendation metadata: {str(e)}")
            return recommendations
    
    def _calculate_recommendation_score(self, recommendation: Dict) -> float:
        """Calculate recommendation score based on various factors."""
        try:
            score = 0.0
            
            # Priority score
            priority = recommendation.get("priority", "medium")
            if priority == "high":
                score += 0.4
            elif priority == "medium":
                score += 0.2
            
            # Source score
            source = recommendation.get("source", "")
            if "strategic" in source:
                score += 0.3
            elif "ai" in source:
                score += 0.2
            elif "platform" in source:
                score += 0.1
            
            # Content type score
            content_type = recommendation.get("content_type", "")
            if content_type in ["Article", "Video"]:
                score += 0.2
            elif content_type in ["Post", "Story"]:
                score += 0.1
            
            return min(1.0, score)
            
        except Exception as e:
            logger.error(f"Error calculating recommendation score: {str(e)}")
            return 0.5
    
    def _calculate_implementation_difficulty(self, recommendation: Dict) -> str:
        """Calculate implementation difficulty."""
        try:
            content_type = recommendation.get("content_type", "")
            
            if content_type in ["Post", "Story"]:
                return "easy"
            elif content_type in ["Article", "Video"]:
                return "hard"
            else:
                return "medium"
                
        except Exception as e:
            logger.error(f"Error calculating implementation difficulty: {str(e)}")
            return "medium"

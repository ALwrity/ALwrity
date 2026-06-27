"""
Gap Analyzer Module

This module identifies content gaps and opportunities for content recommendations.
It ensures comprehensive gap analysis, opportunity identification, and strategic recommendations.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.competitor_analyzer import CompetitorAnalyzer


class GapAnalyzer:
    """
    Identifies content gaps and opportunities for content recommendations.
    
    This module ensures:
    - Comprehensive content gap analysis
    - Opportunity identification and prioritization
    - Competitive gap analysis
    - Strategic gap recommendations
    - Gap-based content ideas
    """
    
    def __init__(self):
        """Initialize the gap analyzer with real AI services."""
        self.ai_engine = AIEngineService()
        self.competitor_analyzer = CompetitorAnalyzer()
        
        # Gap analysis rules
        self.gap_rules = {
            "min_gap_impact": 0.6,
            "max_gap_count": 15,
            "opportunity_threshold": 0.7,
            "competitive_analysis_depth": 3,
            "gap_priority_levels": ["critical", "high", "medium", "low"]
        }
        
        logger.info("🎯 Gap Analyzer initialized with real AI services")
    
    async def analyze_content_gaps(
        self,
        weekly_themes: List[Dict],
        daily_schedules: List[Dict],
        business_goals: List[str],
        target_audience: Dict,
        competitor_data: Dict
    ) -> Dict[str, Any]:
        """
        Analyze content gaps and identify opportunities.
        
        Args:
            weekly_themes: Weekly themes from Step 7
            daily_schedules: Daily schedules from Step 8
            business_goals: Business goals from strategy
            target_audience: Target audience information
            competitor_data: Competitor analysis data
            
        Returns:
            Comprehensive gap analysis with opportunities
        """
        try:
            logger.info("🚀 Starting content gap analysis")
            
            # Analyze content coverage gaps
            coverage_gaps = self._analyze_content_coverage_gaps(weekly_themes, daily_schedules)
            
            # Analyze audience gap opportunities
            audience_gaps = await self._analyze_audience_gap_opportunities(
                target_audience, daily_schedules
            )
            
            # Analyze competitive gaps
            competitive_gaps = await self._analyze_competitive_gaps(
                competitor_data, daily_schedules, business_goals
            )
            
            # Analyze strategic gaps
            strategic_gaps = self._analyze_strategic_gaps(
                business_goals, weekly_themes, daily_schedules
            )
            
            # Generate gap-based content ideas
            gap_content_ideas = await self._generate_gap_content_ideas(
                coverage_gaps, audience_gaps, competitive_gaps, strategic_gaps
            )
            
            # Prioritize gaps and opportunities
            prioritized_gaps = self._prioritize_gaps_and_opportunities(
                coverage_gaps, audience_gaps, competitive_gaps, strategic_gaps
            )
            
            # Create comprehensive gap analysis results
            gap_analysis_results = {
                "coverage_gaps": coverage_gaps,
                "audience_gaps": audience_gaps,
                "competitive_gaps": competitive_gaps,
                "strategic_gaps": strategic_gaps,
                "gap_content_ideas": gap_content_ideas,
                "prioritized_gaps": prioritized_gaps,
                "gap_analysis_metrics": self._calculate_gap_analysis_metrics(
                    coverage_gaps, audience_gaps, competitive_gaps, strategic_gaps
                )
            }
            
            logger.info(f"✅ Analyzed content gaps and identified {len(prioritized_gaps)} opportunities")
            return gap_analysis_results
            
        except Exception as e:
            logger.error(f"❌ Content gap analysis failed: {str(e)}")
            raise
    
    def _analyze_content_coverage_gaps(
        self,
        weekly_themes: List[Dict],
        daily_schedules: List[Dict]
    ) -> List[Dict]:
        """
        Analyze content coverage gaps in themes and schedules.
        
        Args:
            weekly_themes: Weekly themes from Step 7
            daily_schedules: Daily schedules from Step 8
            
        Returns:
            Content coverage gaps
        """
        try:
            coverage_gaps = []
            
            # Analyze theme coverage gaps
            theme_gaps = self._analyze_theme_coverage_gaps(weekly_themes)
            coverage_gaps.extend(theme_gaps)
            
            # Analyze schedule coverage gaps
            schedule_gaps = self._analyze_schedule_coverage_gaps(daily_schedules)
            coverage_gaps.extend(schedule_gaps)
            
            # Analyze content type gaps
            content_type_gaps = self._analyze_content_type_gaps(daily_schedules)
            coverage_gaps.extend(content_type_gaps)
            
            # Analyze platform coverage gaps
            platform_gaps = self._analyze_platform_coverage_gaps(daily_schedules)
            coverage_gaps.extend(platform_gaps)
            
            return coverage_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing content coverage gaps: {str(e)}")
            return []
    
    def _analyze_theme_coverage_gaps(self, weekly_themes: List[Dict]) -> List[Dict]:
        """Analyze gaps in weekly theme coverage."""
        try:
            theme_gaps = []
            
            # Check for missing theme variety
            if len(weekly_themes) < 4:
                theme_gaps.append({
                    "gap_type": "theme_coverage",
                    "gap_description": "Limited theme variety",
                    "gap_details": f"Only {len(weekly_themes)} themes identified, need more variety",
                    "impact_score": 0.8,
                    "priority": "high",
                    "recommendation": "Develop additional theme categories for content variety"
                })
            
            # Check for theme depth
            for theme in weekly_themes:
                content_angles = theme.get("content_angles", [])
                if len(content_angles) < 3:
                    theme_gaps.append({
                        "gap_type": "theme_depth",
                        "gap_description": f"Insufficient content angles for theme: {theme.get('theme', 'Unknown')}",
                        "gap_details": f"Only {len(content_angles)} content angles, need at least 3",
                        "impact_score": 0.6,
                        "priority": "medium",
                        "recommendation": f"Develop more content angles for theme: {theme.get('theme', 'Unknown')}"
                    })
            
            return theme_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing theme coverage gaps: {str(e)}")
            return []
    
    def _analyze_schedule_coverage_gaps(self, daily_schedules: List[Dict]) -> List[Dict]:
        """Analyze gaps in daily schedule coverage."""
        try:
            schedule_gaps = []
            
            # Check for empty days
            empty_days = []
            for schedule in daily_schedules:
                content_pieces = schedule.get("content_pieces", [])
                if len(content_pieces) == 0:
                    empty_days.append(schedule.get("day_number", 0))
            
            if empty_days:
                schedule_gaps.append({
                    "gap_type": "schedule_coverage",
                    "gap_description": "Empty content days",
                    "gap_details": f"Days {empty_days} have no content scheduled",
                    "impact_score": 0.9,
                    "priority": "critical",
                    "recommendation": "Add content for empty days to maintain consistent posting"
                })
            
            # Check for low content days
            low_content_days = []
            for schedule in daily_schedules:
                content_pieces = schedule.get("content_pieces", [])
                if len(content_pieces) < 2:
                    low_content_days.append(schedule.get("day_number", 0))
            
            if low_content_days:
                schedule_gaps.append({
                    "gap_type": "schedule_coverage",
                    "gap_description": "Low content days",
                    "gap_details": f"Days {low_content_days} have insufficient content",
                    "impact_score": 0.7,
                    "priority": "high",
                    "recommendation": "Increase content volume for low-content days"
                })
            
            return schedule_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing schedule coverage gaps: {str(e)}")
            return []
    
    def _analyze_content_type_gaps(self, daily_schedules: List[Dict]) -> List[Dict]:
        """Analyze gaps in content type coverage."""
        try:
            content_type_gaps = []
            
            # Analyze content type distribution
            content_type_distribution = {}
            for schedule in daily_schedules:
                for piece in schedule.get("content_pieces", []):
                    content_type = piece.get("content_type", "Unknown")
                    content_type_distribution[content_type] = content_type_distribution.get(content_type, 0) + 1
            
            # Check for missing content types
            essential_content_types = ["Article", "Video", "Post"]
            missing_content_types = []
            
            for content_type in essential_content_types:
                if not content_type_distribution.get(content_type, 0):
                    missing_content_types.append(content_type)
            
            if missing_content_types:
                content_type_gaps.append({
                    "gap_type": "content_type",
                    "gap_description": "Missing essential content types",
                    "gap_details": f"Missing content types: {', '.join(missing_content_types)}",
                    "impact_score": 0.8,
                    "priority": "high",
                    "recommendation": f"Add content types: {', '.join(missing_content_types)}"
                })
            
            # Check for content type imbalance
            total_content = sum(content_type_distribution.values())
            if total_content > 0:
                for content_type, count in content_type_distribution.items():
                    percentage = count / total_content
                    if percentage > 0.6:  # More than 60% of one content type
                        content_type_gaps.append({
                            "gap_type": "content_type_balance",
                            "gap_description": f"Content type imbalance: {content_type}",
                            "gap_details": f"{content_type} represents {percentage:.1%} of all content",
                            "impact_score": 0.6,
                            "priority": "medium",
                            "recommendation": f"Diversify content types, reduce {content_type} dominance"
                        })
            
            return content_type_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing content type gaps: {str(e)}")
            return []
    
    def _analyze_platform_coverage_gaps(self, daily_schedules: List[Dict]) -> List[Dict]:
        """Analyze gaps in platform coverage."""
        try:
            platform_gaps = []
            
            # Analyze platform distribution
            platform_distribution = {}
            for schedule in daily_schedules:
                for piece in schedule.get("content_pieces", []):
                    platform = piece.get("target_platform", "Unknown")
                    platform_distribution[platform] = platform_distribution.get(platform, 0) + 1
            
            # Check for missing platforms
            essential_platforms = ["LinkedIn", "Twitter", "Blog"]
            missing_platforms = []
            
            for platform in essential_platforms:
                if not platform_distribution.get(platform, 0):
                    missing_platforms.append(platform)
            
            if missing_platforms:
                platform_gaps.append({
                    "gap_type": "platform_coverage",
                    "gap_description": "Missing essential platforms",
                    "gap_details": f"Missing platforms: {', '.join(missing_platforms)}",
                    "impact_score": 0.8,
                    "priority": "high",
                    "recommendation": f"Add content for platforms: {', '.join(missing_platforms)}"
                })
            
            # Check for platform imbalance
            total_content = sum(platform_distribution.values())
            if total_content > 0:
                for platform, count in platform_distribution.items():
                    percentage = count / total_content
                    if percentage > 0.5:  # More than 50% on one platform
                        platform_gaps.append({
                            "gap_type": "platform_balance",
                            "gap_description": f"Platform imbalance: {platform}",
                            "gap_details": f"{platform} represents {percentage:.1%} of all content",
                            "impact_score": 0.6,
                            "priority": "medium",
                            "recommendation": f"Diversify platform distribution, reduce {platform} dominance"
                        })
            
            return platform_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing platform coverage gaps: {str(e)}")
            return []
    
    async def _analyze_audience_gap_opportunities(
        self,
        target_audience: Dict,
        daily_schedules: List[Dict]
    ) -> List[Dict]:
        """
        Analyze audience gap opportunities.
        
        Args:
            target_audience: Target audience information
            daily_schedules: Daily schedules from Step 8
            
        Returns:
            Audience gap opportunities
        """
        try:
            audience_gaps = []
            
            # Create audience analysis prompt
            prompt = self._create_audience_gap_prompt(target_audience, daily_schedules)
            
            # Get AI analysis
            ai_response = await self.ai_engine.generate_content(prompt, {
                "step": "audience_gap_analysis",
                "audience": target_audience.get("demographics", "N/A")
            })
            
            # Parse audience gaps
            audience_gaps = self._parse_audience_gaps(ai_response, target_audience)
            
            return audience_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing audience gap opportunities: {str(e)}")
            raise
    
    def _create_audience_gap_prompt(
        self,
        target_audience: Dict,
        daily_schedules: List[Dict]
    ) -> str:
        """Create prompt for audience gap analysis."""
        
        prompt = f"""
        Analyze audience gap opportunities for content recommendations:
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Interests: {target_audience.get('interests', 'N/A')}
        Pain Points: {target_audience.get('pain_points', 'N/A')}
        Behavior Patterns: {target_audience.get('behavior_patterns', 'N/A')}
        
        CURRENT CONTENT:
        Total Content Pieces: {sum(len(schedule.get('content_pieces', [])) for schedule in daily_schedules)}
        Platforms: {list(set(piece.get('target_platform', 'Unknown') for schedule in daily_schedules for piece in schedule.get('content_pieces', [])))}
        
        REQUIREMENTS:
        1. Identify content gaps for target audience
        2. Find opportunities to better serve audience needs
        3. Suggest content that addresses audience pain points
        4. Recommend content types that resonate with audience
        5. Identify platform opportunities for audience engagement
        
        OUTPUT FORMAT:
        Provide audience gap opportunities with:
        - Gap Description
        - Target Audience Segment
        - Content Opportunity
        - Recommended Content Type
        - Expected Impact
        - Priority Level
        """
        
        return prompt
    
    def _parse_audience_gaps(
        self,
        ai_response: Dict,
        target_audience: Dict
    ) -> List[Dict]:
        """Parse AI response into audience gap opportunities."""
        try:
            audience_gaps = []
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create audience gap opportunities based on demographics and interests
            demographics = target_audience.get("demographics", "")
            interests = target_audience.get("interests", "")
            pain_points = target_audience.get("pain_points", "")
            
            # Generate audience-specific gaps
            if demographics:
                audience_gaps.append({
                    "gap_type": "audience_demographics",
                    "gap_description": f"Content for {demographics} audience",
                    "target_audience_segment": demographics,
                    "content_opportunity": f"Create content specifically tailored for {demographics}",
                    "recommended_content_type": "Article",
                    "expected_impact": "High audience resonance",
                    "priority": "high",
                    "impact_score": 0.8
                })
            
            if interests:
                audience_gaps.append({
                    "gap_type": "audience_interests",
                    "gap_description": f"Content addressing {interests} interests",
                    "target_audience_segment": "Interest-based",
                    "content_opportunity": f"Develop content around {interests}",
                    "recommended_content_type": "Post",
                    "expected_impact": "High engagement potential",
                    "priority": "medium",
                    "impact_score": 0.7
                })
            
            if pain_points:
                audience_gaps.append({
                    "gap_type": "audience_pain_points",
                    "gap_description": f"Content addressing {pain_points}",
                    "target_audience_segment": "Pain point focused",
                    "content_opportunity": f"Create content that solves {pain_points}",
                    "recommended_content_type": "How-to",
                    "expected_impact": "High value and engagement",
                    "priority": "high",
                    "impact_score": 0.9
                })
            
            # Add AI insights if available
            if insights:
                for i, insight in enumerate(insights[:3]):
                    audience_gaps.append({
                        "gap_type": "ai_audience_insight",
                        "gap_description": f"AI Insight {i+1}: {insight[:50]}...",
                        "target_audience_segment": "AI-identified",
                        "content_opportunity": insight,
                        "recommended_content_type": "Post",
                        "expected_impact": "AI-optimized audience targeting",
                        "priority": "medium",
                        "impact_score": 0.6
                    })
            
            return audience_gaps
            
        except Exception as e:
            logger.error(f"Error parsing audience gaps: {str(e)}")
            return []
    
    async def _analyze_competitive_gaps(
        self,
        competitor_data: Dict,
        daily_schedules: List[Dict],
        business_goals: List[str]
    ) -> List[Dict]:
        """
        Analyze competitive gaps and opportunities.
        
        Args:
            competitor_data: Competitor analysis data
            daily_schedules: Daily schedules from Step 8
            business_goals: Business goals from strategy
            
        Returns:
            Competitive gap opportunities
        """
        try:
            competitive_gaps = []
            
            # Create competitive analysis prompt
            prompt = self._create_competitive_gap_prompt(competitor_data, daily_schedules, business_goals)
            
            # Get AI analysis
            ai_response = await self.ai_engine.generate_content(prompt, {
                "step": "competitive_gap_analysis",
                "competitors": len(competitor_data.get("competitors", []))
            })
            
            # Parse competitive gaps
            competitive_gaps = self._parse_competitive_gaps(ai_response, competitor_data)
            
            return competitive_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing competitive gaps: {str(e)}")
            raise
    
    def _create_competitive_gap_prompt(
        self,
        competitor_data: Dict,
        daily_schedules: List[Dict],
        business_goals: List[str]
    ) -> str:
        """Create prompt for competitive gap analysis."""
        
        prompt = f"""
        Analyze competitive gaps and opportunities for content recommendations:
        
        COMPETITOR DATA:
        Competitors: {len(competitor_data.get('competitors', []))}
        Competitor Strengths: {competitor_data.get('competitor_strengths', [])}
        Competitor Weaknesses: {competitor_data.get('competitor_weaknesses', [])}
        
        BUSINESS GOALS:
        {', '.join(business_goals)}
        
        CURRENT CONTENT:
        Total Content Pieces: {sum(len(schedule.get('content_pieces', [])) for schedule in daily_schedules)}
        
        REQUIREMENTS:
        1. Identify content gaps compared to competitors
        2. Find opportunities to differentiate from competitors
        3. Suggest content that addresses competitor weaknesses
        4. Recommend content that leverages competitive advantages
        5. Identify untapped content opportunities
        
        OUTPUT FORMAT:
        Provide competitive gap opportunities with:
        - Gap Description
        - Competitive Context
        - Differentiation Opportunity
        - Recommended Content Type
        - Expected Impact
        - Priority Level
        """
        
        return prompt
    
    def _parse_competitive_gaps(
        self,
        ai_response: Dict,
        competitor_data: Dict
    ) -> List[Dict]:
        """Parse AI response into competitive gap opportunities."""
        try:
            competitive_gaps = []
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create competitive gap opportunities
            competitor_strengths = competitor_data.get("competitor_strengths", [])
            competitor_weaknesses = competitor_data.get("competitor_weaknesses", [])
            
            # Address competitor weaknesses
            for weakness in competitor_weaknesses[:3]:
                competitive_gaps.append({
                    "gap_type": "competitor_weakness",
                    "gap_description": f"Address competitor weakness: {weakness}",
                    "competitive_context": f"Competitors struggle with {weakness}",
                    "differentiation_opportunity": f"Create content that excels in {weakness}",
                    "recommended_content_type": "Article",
                    "expected_impact": "Competitive differentiation",
                    "priority": "high",
                    "impact_score": 0.8
                })
            
            # Leverage competitive advantages
            for strength in competitor_strengths[:2]:
                competitive_gaps.append({
                    "gap_type": "competitive_advantage",
                    "gap_description": f"Leverage advantage: {strength}",
                    "competitive_context": f"Competitors excel at {strength}",
                    "differentiation_opportunity": f"Create content that matches or exceeds {strength}",
                    "recommended_content_type": "Video",
                    "expected_impact": "Competitive parity or advantage",
                    "priority": "medium",
                    "impact_score": 0.7
                })
            
            # Add AI insights if available
            if insights:
                for i, insight in enumerate(insights[:2]):
                    competitive_gaps.append({
                        "gap_type": "ai_competitive_insight",
                        "gap_description": f"AI Competitive Insight {i+1}: {insight[:50]}...",
                        "competitive_context": "AI-identified competitive opportunity",
                        "differentiation_opportunity": insight,
                        "recommended_content_type": "Post",
                        "expected_impact": "AI-optimized competitive positioning",
                        "priority": "medium",
                        "impact_score": 0.6
                    })
            
            return competitive_gaps
            
        except Exception as e:
            logger.error(f"Error parsing competitive gaps: {str(e)}")
            return []
    
    def _analyze_strategic_gaps(
        self,
        business_goals: List[str],
        weekly_themes: List[Dict],
        daily_schedules: List[Dict]
    ) -> List[Dict]:
        """
        Analyze strategic gaps in content alignment.
        
        Args:
            business_goals: Business goals from strategy
            weekly_themes: Weekly themes from Step 7
            daily_schedules: Daily schedules from Step 8
            
        Returns:
            Strategic gap opportunities
        """
        try:
            strategic_gaps = []
            
            # Check for business goal alignment gaps
            for goal in business_goals:
                goal_alignment = self._check_goal_alignment(goal, weekly_themes, daily_schedules)
                if goal_alignment < 0.7:  # Less than 70% alignment
                    strategic_gaps.append({
                        "gap_type": "business_goal_alignment",
                        "gap_description": f"Low alignment with business goal: {goal}",
                        "gap_details": f"Only {goal_alignment:.1%} alignment with {goal}",
                        "impact_score": 0.9,
                        "priority": "critical",
                        "recommendation": f"Create content that better supports {goal}"
                    })
            
            # Check for strategic content depth
            strategic_content_count = 0
            total_content = sum(len(schedule.get("content_pieces", [])) for schedule in daily_schedules)
            
            if total_content > 0:
                strategic_content_ratio = strategic_content_count / total_content
                if strategic_content_ratio < 0.3:  # Less than 30% strategic content
                    strategic_gaps.append({
                        "gap_type": "strategic_content_depth",
                        "gap_description": "Insufficient strategic content depth",
                        "gap_details": f"Only {strategic_content_ratio:.1%} of content is strategically focused",
                        "impact_score": 0.8,
                        "priority": "high",
                        "recommendation": "Increase strategic content focus and depth"
                    })
            
            return strategic_gaps
            
        except Exception as e:
            logger.error(f"Error analyzing strategic gaps: {str(e)}")
            return []
    
    def _check_goal_alignment(self, goal: str, weekly_themes: List[Dict], daily_schedules: List[Dict]) -> float:
        """Check alignment between a business goal and content."""
        try:
            # Simple alignment check based on keyword presence
            goal_keywords = goal.lower().split()
            alignment_score = 0.0
            total_content = 0
            
            # Check weekly themes
            for theme in weekly_themes:
                theme_text = f"{theme.get('theme', '')} {' '.join(theme.get('content_angles', []))}".lower()
                matches = sum(1 for keyword in goal_keywords if keyword in theme_text)
                alignment_score += matches / len(goal_keywords) if goal_keywords else 0
                total_content += 1
            
            # Check daily schedules
            for schedule in daily_schedules:
                for piece in schedule.get("content_pieces", []):
                    piece_text = f"{piece.get('title', '')} {piece.get('description', '')}".lower()
                    matches = sum(1 for keyword in goal_keywords if keyword in piece_text)
                    alignment_score += matches / len(goal_keywords) if goal_keywords else 0
                    total_content += 1
            
            return alignment_score / total_content if total_content > 0 else 0.0
            
        except Exception as e:
            logger.error(f"Error checking goal alignment: {str(e)}")
            return 0.0
    
    async def _generate_gap_content_ideas(
        self,
        coverage_gaps: List[Dict],
        audience_gaps: List[Dict],
        competitive_gaps: List[Dict],
        strategic_gaps: List[Dict]
    ) -> List[Dict]:
        """
        Generate content ideas based on identified gaps.
        
        Args:
            coverage_gaps: Content coverage gaps
            audience_gaps: Audience gap opportunities
            competitive_gaps: Competitive gap opportunities
            strategic_gaps: Strategic gap opportunities
            
        Returns:
            Gap-based content ideas
        """
        try:
            gap_content_ideas = []
            
            # Combine all gaps
            all_gaps = coverage_gaps + audience_gaps + competitive_gaps + strategic_gaps
            
            # Generate content ideas for high-priority gaps
            high_priority_gaps = [gap for gap in all_gaps if gap.get("priority") in ["critical", "high"]]
            
            for gap in high_priority_gaps[:5]:  # Limit to top 5 gaps
                # Create gap content generation prompt
                prompt = self._create_gap_content_prompt(gap)
                
                # Get AI-generated content ideas
                ai_response = await self.ai_engine.generate_content(prompt, {
                    "step": "gap_content_ideas",
                    "gap_type": gap.get("gap_type", "unknown")
                })
                
                # Parse gap content ideas
                ideas = self._parse_gap_content_ideas(ai_response, gap)
                gap_content_ideas.extend(ideas)
            
            return gap_content_ideas
            
        except Exception as e:
            logger.error(f"Error generating gap content ideas: {str(e)}")
            raise
    
    def _create_gap_content_prompt(self, gap: Dict) -> str:
        """Create prompt for gap-based content generation."""
        
        prompt = f"""
        Generate content ideas to address the following gap:
        
        GAP TYPE: {gap.get('gap_type', 'Unknown')}
        GAP DESCRIPTION: {gap.get('gap_description', 'N/A')}
        GAP DETAILS: {gap.get('gap_details', 'N/A')}
        PRIORITY: {gap.get('priority', 'medium')}
        IMPACT SCORE: {gap.get('impact_score', 0.5)}
        
        REQUIREMENTS:
        1. Create content ideas that directly address this gap
        2. Focus on high-impact, actionable content
        3. Consider different content types and formats
        4. Ensure strategic alignment and business impact
        5. Optimize for audience engagement and value
        
        OUTPUT FORMAT:
        Provide content ideas with:
        - Content Title
        - Content Type
        - Target Platform
        - Key Message
        - Gap Addressal Strategy
        - Expected Impact
        """
        
        return prompt
    
    def _parse_gap_content_ideas(self, ai_response: Dict, gap: Dict) -> List[Dict]:
        """Parse AI response into gap-based content ideas."""
        try:
            gap_content_ideas = []
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Create gap-based content ideas
            content_types = ["Article", "Post", "Video", "How-to"]
            
            for i, content_type in enumerate(content_types):
                idea = {
                    "title": f"Gap Addressal - {content_type} {i+1}",
                    "content_type": content_type,
                    "target_platform": "LinkedIn" if content_type == "Article" else "Twitter",
                    "key_message": f"Content addressing {gap.get('gap_description', 'identified gap')}",
                    "gap_addressal_strategy": f"Directly address {gap.get('gap_type', 'gap')}",
                    "expected_impact": f"High impact - {gap.get('impact_score', 0.5):.1%} score",
                    "gap_type": gap.get("gap_type", "unknown"),
                    "priority": gap.get("priority", "medium"),
                    "impact_score": gap.get("impact_score", 0.5),
                    "source": "gap_based"
                }
                gap_content_ideas.append(idea)
            
            # Add AI insights if available
            if insights:
                for i, insight in enumerate(insights[:2]):
                    idea = {
                        "title": f"Gap AI Insight {i+1}: {insight[:40]}...",
                        "content_type": "Post",
                        "target_platform": "LinkedIn",
                        "key_message": insight,
                        "gap_addressal_strategy": f"AI-optimized gap addressal",
                        "expected_impact": "AI-optimized content performance",
                        "gap_type": gap.get("gap_type", "unknown"),
                        "priority": gap.get("priority", "medium"),
                        "impact_score": gap.get("impact_score", 0.5),
                        "source": "ai_gap_insights"
                    }
                    gap_content_ideas.append(idea)
            
            return gap_content_ideas
            
        except Exception as e:
            logger.error(f"Error parsing gap content ideas: {str(e)}")
            return []
    
    def _prioritize_gaps_and_opportunities(
        self,
        coverage_gaps: List[Dict],
        audience_gaps: List[Dict],
        competitive_gaps: List[Dict],
        strategic_gaps: List[Dict]
    ) -> List[Dict]:
        """
        Prioritize gaps and opportunities based on impact and priority.
        
        Args:
            coverage_gaps: Content coverage gaps
            audience_gaps: Audience gap opportunities
            competitive_gaps: Competitive gap opportunities
            strategic_gaps: Strategic gap opportunities
            
        Returns:
            Prioritized gaps and opportunities
        """
        try:
            # Combine all gaps
            all_gaps = coverage_gaps + audience_gaps + competitive_gaps + strategic_gaps
            
            # Sort by priority and impact score
            priority_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
            
            prioritized_gaps = sorted(
                all_gaps,
                key=lambda x: (
                    priority_order.get(x.get("priority", "medium"), 1),
                    x.get("impact_score", 0.0)
                ),
                reverse=True
            )
            
            # Limit to maximum gaps
            max_gaps = self.gap_rules["max_gap_count"]
            prioritized_gaps = prioritized_gaps[:max_gaps]
            
            return prioritized_gaps
            
        except Exception as e:
            logger.error(f"Error prioritizing gaps and opportunities: {str(e)}")
            return []
    
    def _calculate_gap_analysis_metrics(
        self,
        coverage_gaps: List[Dict],
        audience_gaps: List[Dict],
        competitive_gaps: List[Dict],
        strategic_gaps: List[Dict]
    ) -> Dict[str, Any]:
        """
        Calculate gap analysis metrics.
        
        Args:
            coverage_gaps: Content coverage gaps
            audience_gaps: Audience gap opportunities
            competitive_gaps: Competitive gap opportunities
            strategic_gaps: Strategic gap opportunities
            
        Returns:
            Gap analysis metrics
        """
        try:
            # Calculate total gaps
            total_gaps = len(coverage_gaps) + len(audience_gaps) + len(competitive_gaps) + len(strategic_gaps)
            
            # Calculate average impact score
            all_gaps = coverage_gaps + audience_gaps + competitive_gaps + strategic_gaps
            impact_scores = [gap.get("impact_score", 0.0) for gap in all_gaps]
            avg_impact_score = sum(impact_scores) / len(impact_scores) if impact_scores else 0.0
            
            # Calculate priority distribution
            priority_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            for gap in all_gaps:
                priority = gap.get("priority", "medium")
                priority_counts[priority] = priority_counts.get(priority, 0) + 1
            
            # Calculate gap type distribution
            gap_type_counts = {}
            for gap in all_gaps:
                gap_type = gap.get("gap_type", "unknown")
                gap_type_counts[gap_type] = gap_type_counts.get(gap_type, 0) + 1
            
            # Calculate overall gap analysis score
            gap_analysis_score = min(1.0, total_gaps / 20.0)  # Normalize to 0-1 scale
            
            metrics = {
                "total_gaps": total_gaps,
                "avg_impact_score": avg_impact_score,
                "priority_distribution": priority_counts,
                "gap_type_distribution": gap_type_counts,
                "gap_analysis_score": gap_analysis_score,
                "coverage_gaps_count": len(coverage_gaps),
                "audience_gaps_count": len(audience_gaps),
                "competitive_gaps_count": len(competitive_gaps),
                "strategic_gaps_count": len(strategic_gaps)
            }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating gap analysis metrics: {str(e)}")
            return {
                "total_gaps": 0,
                "avg_impact_score": 0.0,
                "priority_distribution": {},
                "gap_type_distribution": {},
                "gap_analysis_score": 0.0,
                "coverage_gaps_count": 0,
                "audience_gaps_count": 0,
                "competitive_gaps_count": 0,
                "strategic_gaps_count": 0
            }

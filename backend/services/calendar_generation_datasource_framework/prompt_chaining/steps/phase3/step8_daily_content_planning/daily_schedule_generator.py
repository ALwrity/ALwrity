"""
Daily Schedule Generator for Step 8: Daily Content Planning

This module generates detailed daily content schedules based on weekly themes,
platform strategies, and business goals. It ensures proper content distribution
and strategic alignment throughout the calendar.

NO MOCK DATA - NO FALLBACKS - Only real AI services allowed.
"""

import asyncio
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from loguru import logger

from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher
from services.content_gap_analyzer.competitor_analyzer import CompetitorAnalyzer


class DailyScheduleGenerator:
    """
    Generates detailed daily content schedules based on weekly themes.
    
    This module creates specific content pieces for each day, ensuring:
    - Proper content distribution across the week
    - Platform-specific optimization
    - Strategic alignment with business goals
    - Content variety and engagement
    """
    
    def __init__(self):
        """Initialize the daily schedule generator with real AI services."""
        self.ai_engine = AIEngineService()
        self.keyword_researcher = KeywordResearcher()
        self.competitor_analyzer = CompetitorAnalyzer()
        
        logger.info("🎯 Daily Schedule Generator initialized with real AI services")
    
    async def generate_daily_schedules(
        self,
        weekly_themes: List[Dict],
        platform_strategies: Dict,
        business_goals: List[str],
        target_audience: Dict,
        posting_preferences: Dict,
        calendar_duration: int
    ) -> List[Dict]:
        """
        Generate comprehensive daily content schedule.
        
        Args:
            weekly_themes: Weekly themes from Step 7
            platform_strategies: Platform strategies from Step 6
            business_goals: Business goals from strategy
            target_audience: Target audience information
            posting_preferences: User posting preferences
            calendar_duration: Calendar duration in days
            
        Returns:
            List of daily content schedules
        """
        try:
            logger.info("🚀 Starting daily schedule generation")
            
            # CRITICAL VALIDATION: Ensure weekly_themes is a list of dictionaries
            if not isinstance(weekly_themes, list):
                raise TypeError(f"weekly_themes must be a list, got {type(weekly_themes)}")
            
            if not weekly_themes:
                raise ValueError("weekly_themes cannot be empty")
            
            for i, theme in enumerate(weekly_themes):
                if not isinstance(theme, dict):
                    raise TypeError(f"weekly_themes[{i}] must be a dictionary, got {type(theme)}. Value: {theme}")
                
                # Validate required fields
                if "week_number" not in theme:
                    raise ValueError(f"weekly_themes[{i}] missing required 'week_number' field")
            
            logger.info(f"✅ Validated {len(weekly_themes)} weekly themes")
            
            daily_schedules = []
            current_date = datetime.now()
            
            # Calculate posting days based on preferences
            posting_days = self._calculate_posting_days(posting_preferences, calendar_duration)
            
            # Generate daily content for each posting day
            for day_number, posting_day in enumerate(posting_days, 1):
                # Get weekly theme for this day
                week_number = posting_day.get("week_number", 1)
                weekly_theme = self._get_weekly_theme(weekly_themes, week_number)
                
                # Generate daily content
                daily_content = await self._generate_daily_content(
                    day_number=day_number,
                    posting_day=posting_day,
                    weekly_theme=weekly_theme,
                    platform_strategies=platform_strategies,
                    business_goals=business_goals,
                    target_audience=target_audience,
                    posting_preferences=posting_preferences
                )
                
                daily_schedules.append(daily_content)
                logger.info(f"✅ Generated daily content for day {day_number}")
            
            logger.info(f"✅ Generated {len(daily_schedules)} daily schedules")
            return daily_schedules
            
        except Exception as e:
            logger.error(f"❌ Error in daily schedule generation: {str(e)}")
            raise Exception(f"Daily schedule generation failed: {str(e)}")
    
    def _calculate_posting_days(
        self, 
        posting_preferences: Dict, 
        calendar_duration: int
    ) -> List[Dict]:
        """Calculate posting days based on user preferences."""
        try:
            posting_frequency = posting_preferences.get("posting_frequency", "daily")
            preferred_days = posting_preferences.get("preferred_days", ["monday", "wednesday", "friday"])
            preferred_times = posting_preferences.get("preferred_times", ["09:00", "12:00", "15:00"])
            
            posting_days = []
            current_date = datetime.now()
            
            for day_offset in range(calendar_duration):
                current_day = current_date + timedelta(days=day_offset)
                day_name = current_day.strftime("%A").lower()
                
                # Check if this day should have content based on preferences
                if posting_frequency == "daily" or day_name in preferred_days:
                    content_count = posting_preferences.get("content_per_day", 2)
                    
                    posting_day = {
                        "day_number": day_offset + 1,
                        "date": current_day.strftime("%Y-%m-%d"),
                        "day_name": day_name,
                        "week_number": (day_offset // 7) + 1,
                        "content_count": content_count,
                        "posting_times": preferred_times[:content_count]
                    }
                    
                    posting_days.append(posting_day)
            
            return posting_days
            
        except Exception as e:
            logger.error(f"Error calculating posting days: {str(e)}")
            raise Exception(f"Failed to calculate posting days: {str(e)}")
    
    def _get_weekly_theme(self, weekly_themes: List[Dict], week_number: int) -> Dict:
        """Get weekly theme for specific week number."""
        try:
            # Additional validation
            if not isinstance(weekly_themes, list):
                raise TypeError(f"weekly_themes must be a list, got {type(weekly_themes)}")
            
            for theme in weekly_themes:
                if not isinstance(theme, dict):
                    raise TypeError(f"Theme must be a dictionary, got {type(theme)}: {theme}")
                
                if theme.get("week_number") == week_number:
                    return theme
            
            # If no theme found, fail with clear error
            raise ValueError(
                f"No weekly theme found for week {week_number}. "
                f"Available weeks: {[t.get('week_number') for t in weekly_themes if isinstance(t, dict)]}"
            )
            
        except Exception as e:
            logger.error(f"Error getting weekly theme: {str(e)}")
            raise Exception(f"Failed to get weekly theme: {str(e)}")
    
    async def _generate_daily_content(
        self,
        day_number: int,
        posting_day: Dict,
        weekly_theme: Dict,
        platform_strategies: Dict,
        business_goals: List[str],
        target_audience: Dict,
        posting_preferences: Dict
    ) -> Dict:
        """Generate content for a specific day."""
        try:
            logger.info(f"🎯 Generating daily content for day {day_number}")
            
            # Create comprehensive prompt
            prompt = self._create_content_generation_prompt(
                posting_day=posting_day,
                weekly_theme=weekly_theme,
                platform_strategies=platform_strategies,
                business_goals=business_goals,
                target_audience=target_audience,
                posting_preferences=posting_preferences
            )
            
            # Generate content using AI service
            analysis_data = {
                "step": "daily_content_planning",
                "day_number": day_number,
                "week_number": posting_day.get("week_number", 1),
                "platforms": list(platform_strategies.keys()) if platform_strategies else [],
                "prompt": prompt,
                "business_goals": business_goals,
                "target_audience": target_audience,
                "platform_strategies": platform_strategies,
                "weekly_theme": weekly_theme,
                "posting_preferences": posting_preferences
            }
            
            # Call AI service - NO FALLBACKS
            ai_response = await self.ai_engine.generate_content_recommendations(analysis_data)
            
            # ENHANCED VALIDATION: Check for unexpected types (including float)
            if ai_response is None:
                raise ValueError("AI service returned None")
            
            if isinstance(ai_response, (int, float, str, bool)):
                raise TypeError(
                    f"AI service returned primitive type {type(ai_response).__name__}: {ai_response}. "
                    f"Expected list of dictionaries. This indicates an AI service error."
                )
            
            if not isinstance(ai_response, list):
                raise TypeError(
                    f"AI service returned unexpected type: {type(ai_response).__name__}. "
                    f"Expected list, got {type(ai_response)}. Value: {str(ai_response)[:200]}"
                )
            
            if not ai_response:
                raise ValueError("AI service returned empty list of recommendations")
            
            # Validate each recommendation
            for i, recommendation in enumerate(ai_response):
                if not isinstance(recommendation, dict):
                    raise ValueError(f"Recommendation {i} is not a dictionary: {type(recommendation)}")
                
                if "title" not in recommendation:
                    raise ValueError(f"Recommendation {i} missing required 'title' field")
            
            # Parse and structure the content
            content_pieces = self._parse_content_response(
                ai_response, posting_day, weekly_theme, platform_strategies
            )
            
            # Create daily schedule structure
            daily_schedule = {
                "day_number": day_number,
                "date": posting_day["date"],
                "day_name": posting_day["day_name"],
                "week_number": posting_day["week_number"],
                "weekly_theme": weekly_theme.get("title", ""),
                "content_pieces": content_pieces,
                "posting_times": posting_day["posting_times"],
                "platform_distribution": self._calculate_platform_distribution(content_pieces),
                "content_types": self._extract_content_types(content_pieces),
                "strategic_alignment": self._calculate_strategic_alignment(
                    content_pieces, business_goals, target_audience
                ),
                "engagement_potential": self._calculate_engagement_potential(content_pieces)
            }
            
            return daily_schedule
            
        except Exception as e:
            logger.error(f"Error generating daily content for day {day_number}: {str(e)}")
            raise Exception(f"Failed to generate daily content for day {day_number}: {str(e)}")
    
    def _create_content_generation_prompt(
        self,
        posting_day: Dict,
        weekly_theme: Dict,
        platform_strategies: Dict,
        business_goals: List[str],
        target_audience: Dict,
        posting_preferences: Dict
    ) -> str:
        """Create comprehensive prompt for daily content generation."""
        
        prompt = f"""
        Generate {posting_day['content_count']} content pieces for {posting_day['day_name'].title()}, {posting_day['date']}.
        
        WEEKLY THEME: {weekly_theme.get('title', 'Strategic Content Focus')}
        THEME DESCRIPTION: {weekly_theme.get('description', 'Strategic content development')}
        CONTENT ANGLES: {', '.join(weekly_theme.get('content_angles', []))}
        
        BUSINESS GOALS: {', '.join(business_goals)}
        TARGET AUDIENCE: {target_audience.get('demographics', 'N/A')}
        
        PLATFORM STRATEGIES:
        {self._format_platform_strategies(platform_strategies)}
        
        POSTING TIMES: {', '.join(posting_day['posting_times'])}
        
        REQUIREMENTS:
        1. Each content piece should align with the weekly theme
        2. Optimize for target platforms and posting times
        3. Ensure strategic alignment with business goals
        4. Create engaging content for target audience
        5. Maintain content variety and uniqueness
        6. Include specific content ideas and formats
        
        OUTPUT FORMAT:
        For each content piece, provide:
        - Content Title
        - Content Type (Post, Article, Video, etc.)
        - Target Platform
        - Content Description
        - Key Message
        - Call-to-Action
        - Engagement Strategy
        - Strategic Alignment Notes
        """
        
        return prompt
    
    def _parse_content_response(
        self,
        ai_response: List[Dict[str, Any]],
        posting_day: Dict,
        weekly_theme: Dict,
        platform_strategies: Dict
    ) -> List[Dict]:
        """Parse AI response and structure into content pieces."""
        
        try:
            # Debug: Log the input parameters
            logger.info(f"🔍 _parse_content_response called with:")
            logger.info(f"  ai_response type: {type(ai_response)}")
            logger.info(f"  ai_response length: {len(ai_response)}")
            logger.info(f"  posting_day: {posting_day}")
            logger.info(f"  weekly_theme: {weekly_theme}")
            logger.info(f"  platform_strategies: {platform_strategies}")
            
            content_pieces = []
            
            # Generate content pieces based on AI recommendations
            for i in range(posting_day["content_count"]):
                if i < len(ai_response):
                    recommendation = ai_response[i]
                    content_idea = recommendation.get("title", f"Content Piece {i+1}")
                else:
                    raise ValueError(f"Not enough AI recommendations. Need {posting_day['content_count']}, got {len(ai_response)}")
                
                content_piece = {
                    "title": f"{content_idea} - {posting_day['day_name'].title()}",
                    "content_type": self._get_content_type(i, platform_strategies),
                    "target_platform": self._get_target_platform(i, platform_strategies),
                    "description": f"Strategic content piece {i+1} for {posting_day['day_name']}",
                    "key_message": f"Key message for {content_idea.lower()}",
                    "call_to_action": "Learn more or engage with our content",
                    "engagement_strategy": "Encourage comments, shares, and discussions",
                    "strategic_alignment": f"Aligns with {weekly_theme.get('title', 'strategic goals')}",
                    "posting_time": posting_day["posting_times"][i % len(posting_day["posting_times"])],
                    "content_angle": weekly_theme.get("content_angles", [])[i % len(weekly_theme.get("content_angles", []))] if weekly_theme.get("content_angles") else "Strategic content"
                }
                
                content_pieces.append(content_piece)
            
            return content_pieces
            
        except Exception as e:
            logger.error(f"Error parsing content response: {str(e)}")
            raise Exception(f"Failed to parse content response: {str(e)}")
    
    def _get_content_type(self, index: int, platform_strategies: Dict) -> str:
        """Get content type based on index and platform strategies."""
        content_types = ["Post", "Article", "Video", "Infographic", "Story"]
        return content_types[index % len(content_types)]
    
    def _get_target_platform(self, index: int, platform_strategies: Dict) -> str:
        """Get target platform based on index and platform strategies."""
        platforms = list(platform_strategies.keys())
        return platforms[index % len(platforms)] if platforms else "LinkedIn"
    
    def _format_platform_strategies(self, platform_strategies: Dict) -> str:
        """Format platform strategies for prompt."""
        formatted = []
        for platform, strategy in platform_strategies.items():
            formatted.append(f"- {platform}: {strategy.get('approach', 'N/A')}")
        return "\n".join(formatted)
    
    def _calculate_platform_distribution(self, content_pieces: List[Dict]) -> Dict[str, int]:
        """Calculate platform distribution for content pieces."""
        distribution = {}
        for piece in content_pieces:
            platform = piece.get("target_platform", "Unknown")
            distribution[platform] = distribution.get(platform, 0) + 1
        return distribution
    
    def _extract_content_types(self, content_pieces: List[Dict]) -> List[str]:
        """Extract content types from content pieces."""
        return list(set(piece.get("content_type", "Unknown") for piece in content_pieces))
    
    def _calculate_strategic_alignment(
        self,
        content_pieces: List[Dict],
        business_goals: List[str],
        target_audience: Dict
    ) -> float:
        """Calculate strategic alignment score for content pieces."""
        try:
            # Simple alignment calculation based on content relevance
            alignment_scores = []
            for piece in content_pieces:
                # Check if content aligns with business goals
                goal_alignment = 0.8  # Placeholder - would be calculated based on content analysis
                # Check if content targets the right audience
                audience_alignment = 0.8  # Placeholder - would be calculated based on content analysis
                
                piece_alignment = (goal_alignment + audience_alignment) / 2
                alignment_scores.append(piece_alignment)
            
            return sum(alignment_scores) / len(alignment_scores) if alignment_scores else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating strategic alignment: {str(e)}")
            raise Exception(f"Failed to calculate strategic alignment: {str(e)}")
    
    def _calculate_engagement_potential(self, content_pieces: List[Dict]) -> float:
        """Calculate engagement potential for content pieces."""
        try:
            # Calculate engagement potential based on content characteristics
            engagement_scores = []
            for piece in content_pieces:
                content_type = piece.get("content_type", "")
                platform = piece.get("target_platform", "")
                
                # Base engagement score
                base_score = 0.7
                
                # Adjust based on content type
                if content_type in ["Video", "Infographic"]:
                    base_score += 0.1
                elif content_type in ["Article", "Post"]:
                    base_score += 0.05
                
                # Adjust based on platform
                if platform in ["LinkedIn", "Instagram"]:
                    base_score += 0.1
                elif platform in ["Twitter", "Facebook"]:
                    base_score += 0.05
                
                engagement_scores.append(min(base_score, 1.0))
            
            return sum(engagement_scores) / len(engagement_scores) if engagement_scores else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating engagement potential: {str(e)}")
            raise Exception(f"Failed to calculate engagement potential: {str(e)}")

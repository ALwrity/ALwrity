"""
Platform Optimizer Module

This module optimizes content for specific platforms and ensures platform-specific
strategies are properly applied to maximize engagement and reach.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
from services.content_gap_analyzer.ai_engine_service import AIEngineService


class PlatformOptimizer:
    """
    Optimizes content for specific platforms and ensures platform-specific strategies.
    
    This module ensures:
    - Platform-specific content optimization
    - Optimal posting times for each platform
    - Content format optimization
    - Engagement strategy optimization
    - Cross-platform coordination
    """
    
    def __init__(self):
        """Initialize the platform optimizer with real AI services."""
        self.ai_engine = AIEngineService()
        
        # Platform-specific optimization rules
        self.platform_rules = {
            "LinkedIn": {
                "optimal_times": ["09:00", "12:00", "17:00"],
                "content_types": ["Article", "Post", "Video"],
                "tone": "Professional and authoritative",
                "engagement_strategies": ["Ask questions", "Share insights", "Encourage comments"],
                "character_limit": 1300,
                "hashtag_count": 3
            },
            "Twitter": {
                "optimal_times": ["08:00", "12:00", "15:00", "18:00"],
                "content_types": ["Tweet", "Thread", "Video"],
                "tone": "Conversational and engaging",
                "engagement_strategies": ["Use hashtags", "Tag relevant users", "Retweet engagement"],
                "character_limit": 280,
                "hashtag_count": 2
            },
            "Instagram": {
                "optimal_times": ["11:00", "13:00", "19:00"],
                "content_types": ["Post", "Story", "Reel", "Carousel"],
                "tone": "Visual and creative",
                "engagement_strategies": ["Use relevant hashtags", "Engage with comments", "Cross-promote"],
                "character_limit": 2200,
                "hashtag_count": 15
            },
            "Facebook": {
                "optimal_times": ["09:00", "13:00", "15:00"],
                "content_types": ["Post", "Video", "Live"],
                "tone": "Friendly and community-focused",
                "engagement_strategies": ["Ask questions", "Share stories", "Create polls"],
                "character_limit": 63206,
                "hashtag_count": 5
            },
            "Blog": {
                "optimal_times": ["10:00", "14:00"],
                "content_types": ["Article", "How-to", "Case Study"],
                "tone": "Informative and helpful",
                "engagement_strategies": ["Include CTAs", "Add internal links", "Encourage comments"],
                "character_limit": None,
                "hashtag_count": 0
            }
        }
        
        logger.info("🎯 Platform Optimizer initialized with real AI services")
    
    async def optimize_content_for_platforms(
        self,
        daily_schedules: List[Dict],
        platform_strategies: Dict,
        target_audience: Dict
    ) -> List[Dict]:
        """
        Optimize daily content for specific platforms.
        
        Args:
            daily_schedules: Daily content schedules
            platform_strategies: Platform strategies from Step 6
            target_audience: Target audience information
            
        Returns:
            Optimized daily schedules with platform-specific enhancements
        """
        try:
            logger.info("🚀 Starting platform optimization")
            
            optimized_schedules = []
            
            for daily_schedule in daily_schedules:
                optimized_schedule = await self._optimize_daily_schedule(
                    daily_schedule, platform_strategies, target_audience
                )
                optimized_schedules.append(optimized_schedule)
            
            logger.info(f"✅ Optimized {len(optimized_schedules)} daily schedules for platforms")
            return optimized_schedules
            
        except Exception as e:
            logger.error(f"❌ Platform optimization failed: {str(e)}")
            raise
    
    async def _optimize_daily_schedule(
        self,
        daily_schedule: Dict,
        platform_strategies: Dict,
        target_audience: Dict
    ) -> Dict:
        """
        Optimize a single daily schedule for platforms.
        
        Args:
            daily_schedule: Daily content schedule
            platform_strategies: Platform strategies
            target_audience: Target audience
            
        Returns:
            Optimized daily schedule
        """
        try:
            optimized_content_pieces = []
            
            for content_piece in daily_schedule.get("content_pieces", []):
                optimized_piece = await self._optimize_content_piece(
                    content_piece, platform_strategies, target_audience
                )
                optimized_content_pieces.append(optimized_piece)
            
            # Update daily schedule with optimized content
            optimized_schedule = daily_schedule.copy()
            optimized_schedule["content_pieces"] = optimized_content_pieces
            optimized_schedule["platform_optimization"] = self._calculate_platform_optimization_score(
                optimized_content_pieces, platform_strategies
            )
            optimized_schedule["cross_platform_coordination"] = self._analyze_cross_platform_coordination(
                optimized_content_pieces
            )
            
            return optimized_schedule
            
        except Exception as e:
            logger.error(f"Error optimizing daily schedule: {str(e)}")
            raise
    
    async def _optimize_content_piece(
        self,
        content_piece: Dict,
        platform_strategies: Dict,
        target_audience: Dict
    ) -> Dict:
        """
        Optimize a single content piece for its target platform.
        
        Args:
            content_piece: Content piece to optimize
            platform_strategies: Platform strategies
            target_audience: Target audience
            
        Returns:
            Optimized content piece
        """
        try:
            target_platform = content_piece.get("target_platform", "LinkedIn")
            platform_rules = self.platform_rules.get(target_platform, {})
            platform_strategy = platform_strategies.get(target_platform, {})
            
            # Create optimization prompt
            prompt = self._create_optimization_prompt(
                content_piece, platform_rules, platform_strategy, target_audience
            )
            
            # Get AI optimization suggestions
            ai_response = await self.ai_engine.generate_content(prompt, {
                "step": "platform_optimization",
                "platform": target_platform,
                "content_type": content_piece.get("content_type", "Post")
            })
            
            # Apply optimizations
            optimized_piece = self._apply_platform_optimizations(
                content_piece, platform_rules, platform_strategy, ai_response
            )
            
            return optimized_piece
            
        except Exception as e:
            logger.error(f"Error optimizing content piece: {str(e)}")
            raise
    
    def _create_optimization_prompt(
        self,
        content_piece: Dict,
        platform_rules: Dict,
        platform_strategy: Dict,
        target_audience: Dict
    ) -> str:
        """Create prompt for platform-specific optimization."""
        
        prompt = f"""
        Optimize the following content for {content_piece.get('target_platform', 'LinkedIn')}:
        
        ORIGINAL CONTENT:
        Title: {content_piece.get('title', 'N/A')}
        Description: {content_piece.get('description', 'N/A')}
        Key Message: {content_piece.get('key_message', 'N/A')}
        
        PLATFORM RULES:
        - Optimal Times: {', '.join(platform_rules.get('optimal_times', []))}
        - Content Types: {', '.join(platform_rules.get('content_types', []))}
        - Tone: {platform_rules.get('tone', 'N/A')}
        - Character Limit: {platform_rules.get('character_limit', 'No limit')}
        - Hashtag Count: {platform_rules.get('hashtag_count', 0)}
        
        PLATFORM STRATEGY:
        Approach: {platform_strategy.get('approach', 'N/A')}
        Tone: {platform_strategy.get('tone', 'N/A')}
        
        TARGET AUDIENCE:
        Demographics: {target_audience.get('demographics', 'N/A')}
        Interests: {target_audience.get('interests', 'N/A')}
        
        REQUIREMENTS:
        1. Optimize content for platform-specific best practices
        2. Ensure content fits platform character limits
        3. Apply platform-specific tone and style
        4. Suggest optimal posting times
        5. Recommend engagement strategies
        6. Add platform-specific hashtags if applicable
        7. Optimize call-to-action for platform
        
        OUTPUT FORMAT:
        Provide optimized versions of:
        - Title
        - Description
        - Key Message
        - Call-to-Action
        - Engagement Strategy
        - Optimal Posting Time
        - Platform-Specific Hashtags
        - Optimization Notes
        """
        
        return prompt
    
    def _apply_platform_optimizations(
        self,
        content_piece: Dict,
        platform_rules: Dict,
        platform_strategy: Dict,
        ai_response: Dict
    ) -> Dict:
        """Apply platform-specific optimizations to content piece."""
        
        try:
            optimized_piece = content_piece.copy()
            
            # Extract optimization suggestions from AI response
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Apply platform-specific optimizations
            target_platform = content_piece.get("target_platform", "LinkedIn")
            
            # Optimize posting time
            optimal_times = platform_rules.get("optimal_times", ["09:00"])
            optimized_piece["optimal_posting_time"] = optimal_times[0]
            
            # Apply character limit
            character_limit = platform_rules.get("character_limit")
            if character_limit:
                description = optimized_piece.get("description", "")
                if len(description) > character_limit:
                    optimized_piece["description"] = description[:character_limit-3] + "..."
            
            # Add platform-specific hashtags
            hashtag_count = platform_rules.get("hashtag_count", 0)
            if hashtag_count > 0:
                hashtags = self._generate_platform_hashtags(
                    content_piece, target_platform, hashtag_count
                )
                optimized_piece["hashtags"] = hashtags
            
            # Optimize engagement strategy
            engagement_strategies = platform_rules.get("engagement_strategies", [])
            optimized_piece["platform_engagement_strategy"] = engagement_strategies[0] if engagement_strategies else "Engage with audience"
            
            # Add platform-specific optimization notes
            optimized_piece["platform_optimization_notes"] = f"Optimized for {target_platform} with {platform_rules.get('tone', 'professional')} tone"
            
            # Add AI insights if available
            if insights:
                optimized_piece["ai_optimization_insights"] = insights[:3]  # Top 3 insights
            
            return optimized_piece
            
        except Exception as e:
            logger.error(f"Error applying platform optimizations: {str(e)}")
            return content_piece  # Return original if optimization fails
    
    def _generate_platform_hashtags(
        self,
        content_piece: Dict,
        platform: str,
        hashtag_count: int
    ) -> List[str]:
        """Generate platform-specific hashtags for content."""
        
        try:
            # Platform-specific hashtag strategies
            base_hashtags = {
                "LinkedIn": ["#business", "#leadership", "#innovation"],
                "Twitter": ["#tech", "#startup", "#growth"],
                "Instagram": ["#business", "#entrepreneur", "#success"],
                "Facebook": ["#business", "#community", "#growth"],
                "Blog": []
            }
            
            # Get base hashtags for platform
            hashtags = base_hashtags.get(platform, [])
            
            # Add content-specific hashtags based on title and description
            content_text = f"{content_piece.get('title', '')} {content_piece.get('description', '')}"
            
            # Extract potential hashtags from content
            words = content_text.lower().split()
            potential_hashtags = [f"#{word}" for word in words if len(word) > 3 and word.isalpha()]
            
            # Add content-specific hashtags
            hashtags.extend(potential_hashtags[:hashtag_count - len(hashtags)])
            
            return hashtags[:hashtag_count]
            
        except Exception as e:
            logger.error(f"Error generating hashtags: {str(e)}")
            return []
    
    def _calculate_platform_optimization_score(
        self,
        content_pieces: List[Dict],
        platform_strategies: Dict
    ) -> Dict[str, float]:
        """Calculate platform optimization scores."""
        
        try:
            optimization_scores = {}
            
            for platform in platform_strategies.keys():
                platform_pieces = [
                    piece for piece in content_pieces 
                    if piece.get("target_platform") == platform
                ]
                
                if platform_pieces:
                    # Calculate optimization score based on various factors
                    scores = []
                    
                    for piece in platform_pieces:
                        # Check if piece has platform-specific optimizations
                        has_optimizations = (
                            "platform_optimization_notes" in piece and
                            "optimal_posting_time" in piece and
                            "platform_engagement_strategy" in piece
                        )
                        
                        # Check if piece follows platform rules
                        platform_rules = self.platform_rules.get(platform, {})
                        follows_rules = self._check_platform_rules_compliance(piece, platform_rules)
                        
                        # Calculate piece score
                        piece_score = 0.8 if has_optimizations else 0.5
                        piece_score += 0.2 if follows_rules else 0.0
                        
                        scores.append(min(1.0, piece_score))
                    
                    optimization_scores[platform] = sum(scores) / len(scores) if scores else 0.0
                else:
                    optimization_scores[platform] = 0.0
            
            return optimization_scores
            
        except Exception as e:
            logger.error(f"Error calculating platform optimization scores: {str(e)}")
            return {}
    
    def _check_platform_rules_compliance(
        self,
        content_piece: Dict,
        platform_rules: Dict
    ) -> bool:
        """Check if content piece complies with platform rules."""
        
        try:
            # Check character limit compliance
            character_limit = platform_rules.get("character_limit")
            if character_limit:
                description = content_piece.get("description", "")
                if len(description) > character_limit:
                    return False
            
            # Check content type compliance
            allowed_types = platform_rules.get("content_types", [])
            content_type = content_piece.get("content_type", "")
            if allowed_types and content_type not in allowed_types:
                return False
            
            # Check hashtag compliance
            hashtag_count = platform_rules.get("hashtag_count", 0)
            hashtags = content_piece.get("hashtags", [])
            if hashtag_count > 0 and len(hashtags) < hashtag_count:
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking platform rules compliance: {str(e)}")
            return False
    
    def _analyze_cross_platform_coordination(
        self,
        content_pieces: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze cross-platform coordination and consistency."""
        
        try:
            # Group content by platform
            platform_groups = {}
            for piece in content_pieces:
                platform = piece.get("target_platform", "Unknown")
                if platform not in platform_groups:
                    platform_groups[platform] = []
                platform_groups[platform].append(piece)
            
            # Analyze coordination metrics
            coordination_metrics = {
                "platform_distribution": {platform: len(pieces) for platform, pieces in platform_groups.items()},
                "content_consistency": self._calculate_content_consistency(content_pieces),
                "timing_coordination": self._analyze_timing_coordination(content_pieces),
                "message_alignment": self._calculate_message_alignment(content_pieces)
            }
            
            return coordination_metrics
            
        except Exception as e:
            logger.error(f"Error analyzing cross-platform coordination: {str(e)}")
            return {}
    
    def _calculate_content_consistency(self, content_pieces: List[Dict]) -> float:
        """Calculate consistency across content pieces."""
        try:
            if len(content_pieces) < 2:
                return 1.0
            
            # Compare themes and messages across pieces
            themes = [piece.get("weekly_theme", "") for piece in content_pieces]
            messages = [piece.get("key_message", "") for piece in content_pieces]
            
            # Simple consistency calculation
            theme_consistency = len(set(themes)) / len(themes) if themes else 1.0
            message_consistency = len(set(messages)) / len(messages) if messages else 1.0
            
            return (theme_consistency + message_consistency) / 2
            
        except Exception as e:
            logger.error(f"Error calculating content consistency: {str(e)}")
            return 0.0
    
    def _analyze_timing_coordination(self, content_pieces: List[Dict]) -> Dict[str, Any]:
        """Analyze timing coordination across platforms."""
        try:
            posting_times = [piece.get("optimal_posting_time", "09:00") for piece in content_pieces]
            
            return {
                "time_distribution": posting_times,
                "coordination_score": 0.8,  # Placeholder - would calculate based on timing analysis
                "recommendations": ["Stagger posting times for better reach"]
            }
            
        except Exception as e:
            logger.error(f"Error analyzing timing coordination: {str(e)}")
            return {}
    
    def _calculate_message_alignment(self, content_pieces: List[Dict]) -> float:
        """Calculate message alignment across content pieces."""
        try:
            if len(content_pieces) < 2:
                return 1.0
            
            # Extract key messages and calculate alignment
            messages = [piece.get("key_message", "") for piece in content_pieces]
            
            # Simple alignment calculation
            unique_messages = len(set(messages))
            total_messages = len(messages)
            
            alignment_score = unique_messages / total_messages if total_messages > 0 else 1.0
            
            return alignment_score
            
        except Exception as e:
            logger.error(f"Error calculating message alignment: {str(e)}")
            return 0.0

"""
Timeline Coordinator Module

This module ensures proper content flow and timing coordination across the calendar.
It manages posting schedules, content sequencing, and timeline optimization.
"""

import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from loguru import logger
from services.content_gap_analyzer.ai_engine_service import AIEngineService


class TimelineCoordinator:
    """
    Coordinates content timeline and ensures proper content flow.
    
    This module ensures:
    - Optimal posting schedule coordination
    - Content sequencing and flow
    - Timeline optimization
    - Cross-day content coordination
    - Schedule conflict resolution
    """
    
    def __init__(self):
        """Initialize the timeline coordinator with real AI services."""
        self.ai_engine = AIEngineService()
        
        # Timeline optimization rules
        self.timeline_rules = {
            "min_gap_hours": 2,  # Minimum gap between posts on same platform
            "max_daily_posts": 3,  # Maximum posts per day
            "optimal_spacing": 4,  # Optimal hours between posts
            "weekend_adjustment": True,  # Adjust for weekend engagement
            "timezone_consideration": True  # Consider timezone differences
        }
        
        logger.info("🎯 Timeline Coordinator initialized with real AI services")
    
    async def coordinate_timeline(
        self,
        daily_schedules: List[Dict],
        posting_preferences: Dict,
        platform_strategies: Dict,
        calendar_duration: int
    ) -> List[Dict]:
        """
        Coordinate and optimize content timeline.
        
        Args:
            daily_schedules: Daily content schedules
            posting_preferences: User posting preferences
            platform_strategies: Platform strategies
            calendar_duration: Calendar duration in days
            
        Returns:
            Timeline-coordinated daily schedules
        """
        try:
            logger.info("🚀 Starting timeline coordination")
            
            # Analyze current timeline
            timeline_analysis = self._analyze_current_timeline(daily_schedules)
            
            # Optimize posting times
            optimized_schedules = await self._optimize_posting_times(
                daily_schedules, posting_preferences, platform_strategies
            )
            
            # Resolve scheduling conflicts
            conflict_resolved_schedules = self._resolve_scheduling_conflicts(
                optimized_schedules, platform_strategies
            )
            
            # Add timeline coordination metrics
            coordinated_schedules = self._add_timeline_metrics(
                conflict_resolved_schedules, timeline_analysis
            )
            
            logger.info(f"✅ Coordinated timeline for {len(coordinated_schedules)} daily schedules")
            return coordinated_schedules
            
        except Exception as e:
            logger.error(f"❌ Timeline coordination failed: {str(e)}")
            raise
    
    def _analyze_current_timeline(self, daily_schedules: List[Dict]) -> Dict[str, Any]:
        """
        Analyze current timeline for optimization opportunities.
        
        Args:
            daily_schedules: Daily content schedules
            
        Returns:
            Timeline analysis results
        """
        try:
            timeline_analysis = {
                "total_content_pieces": 0,
                "platform_distribution": {},
                "time_distribution": {},
                "daily_distribution": {},
                "conflicts": [],
                "optimization_opportunities": []
            }
            
            for schedule in daily_schedules:
                day_number = schedule.get("day_number", 0)
                content_pieces = schedule.get("content_pieces", [])
                
                # Count total content pieces
                timeline_analysis["total_content_pieces"] += len(content_pieces)
                
                # Analyze platform distribution
                for piece in content_pieces:
                    platform = piece.get("target_platform", "Unknown")
                    timeline_analysis["platform_distribution"][platform] = \
                        timeline_analysis["platform_distribution"].get(platform, 0) + 1
                    
                    # Analyze time distribution
                    posting_time = piece.get("optimal_posting_time", "09:00")
                    timeline_analysis["time_distribution"][posting_time] = \
                        timeline_analysis["time_distribution"].get(posting_time, 0) + 1
                
                # Analyze daily distribution
                timeline_analysis["daily_distribution"][day_number] = len(content_pieces)
            
            # Identify conflicts and opportunities
            timeline_analysis["conflicts"] = self._identify_timeline_conflicts(daily_schedules)
            timeline_analysis["optimization_opportunities"] = self._identify_optimization_opportunities(
                daily_schedules, timeline_analysis
            )
            
            return timeline_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing current timeline: {str(e)}")
            raise
    
    def _identify_timeline_conflicts(self, daily_schedules: List[Dict]) -> List[Dict]:
        """Identify timeline conflicts in daily schedules."""
        try:
            conflicts = []
            
            # Check for same-day conflicts
            for schedule in daily_schedules:
                day_content = schedule.get("content_pieces", [])
                day_conflicts = []
                
                # Check for multiple posts on same platform on same day
                platform_posts = {}
                for piece in day_content:
                    platform = piece.get("target_platform", "Unknown")
                    posting_time = piece.get("optimal_posting_time", "09:00")
                    
                    if platform not in platform_posts:
                        platform_posts[platform] = []
                    platform_posts[platform].append(posting_time)
                
                # Check for conflicts
                for platform, times in platform_posts.items():
                    if len(times) > 1:
                        # Check if times are too close together
                        for i, time1 in enumerate(times):
                            for j, time2 in enumerate(times[i+1:], i+1):
                                time_diff = self._calculate_time_difference(time1, time2)
                                if time_diff < self.timeline_rules["min_gap_hours"]:
                                    day_conflicts.append({
                                        "type": "time_conflict",
                                        "platform": platform,
                                        "times": [time1, time2],
                                        "gap_hours": time_diff,
                                        "day": schedule.get("day_number", 0)
                                    })
                
                conflicts.extend(day_conflicts)
            
            return conflicts
            
        except Exception as e:
            logger.error(f"Error identifying timeline conflicts: {str(e)}")
            return []
    
    def _identify_optimization_opportunities(
        self,
        daily_schedules: List[Dict],
        timeline_analysis: Dict
    ) -> List[Dict]:
        """Identify timeline optimization opportunities."""
        try:
            opportunities = []
            
            # Check for uneven distribution
            daily_distribution = timeline_analysis.get("daily_distribution", {})
            if daily_distribution:
                avg_posts_per_day = sum(daily_distribution.values()) / len(daily_distribution)
                
                for day, post_count in daily_distribution.items():
                    if post_count > self.timeline_rules["max_daily_posts"]:
                        opportunities.append({
                            "type": "over_posting",
                            "day": day,
                            "current_posts": post_count,
                            "recommended_max": self.timeline_rules["max_daily_posts"],
                            "suggestion": "Reduce posts or redistribute content"
                        })
                    elif post_count == 0:
                        opportunities.append({
                            "type": "under_posting",
                            "day": day,
                            "current_posts": post_count,
                            "suggestion": "Add content to maintain engagement"
                        })
            
            # Check for time optimization opportunities
            time_distribution = timeline_analysis.get("time_distribution", {})
            if time_distribution:
                peak_times = sorted(time_distribution.items(), key=lambda x: x[1], reverse=True)[:3]
                opportunities.append({
                    "type": "time_optimization",
                    "peak_times": peak_times,
                    "suggestion": "Consider spreading posts across optimal times"
                })
            
            return opportunities
            
        except Exception as e:
            logger.error(f"Error identifying optimization opportunities: {str(e)}")
            return []
    
    async def _optimize_posting_times(
        self,
        daily_schedules: List[Dict],
        posting_preferences: Dict,
        platform_strategies: Dict
    ) -> List[Dict]:
        """
        Optimize posting times for better engagement.
        
        Args:
            daily_schedules: Daily content schedules
            posting_preferences: User posting preferences
            platform_strategies: Platform strategies
            
        Returns:
            Optimized daily schedules
        """
        try:
            optimized_schedules = []
            
            for schedule in daily_schedules:
                optimized_schedule = await self._optimize_daily_timeline(
                    schedule, posting_preferences, platform_strategies
                )
                optimized_schedules.append(optimized_schedule)
            
            return optimized_schedules
            
        except Exception as e:
            logger.error(f"Error optimizing posting times: {str(e)}")
            raise
    
    async def _optimize_daily_timeline(
        self,
        daily_schedule: Dict,
        posting_preferences: Dict,
        platform_strategies: Dict
    ) -> Dict:
        """Optimize timeline for a single day."""
        try:
            content_pieces = daily_schedule.get("content_pieces", [])
            optimized_pieces = []
            
            # Sort content pieces by priority (can be based on content type, platform, etc.)
            sorted_pieces = self._sort_content_by_priority(content_pieces, platform_strategies)
            
            # Optimize posting times for each piece
            for i, piece in enumerate(sorted_pieces):
                optimized_piece = await self._optimize_content_timing(
                    piece, i, len(sorted_pieces), posting_preferences, platform_strategies
                )
                optimized_pieces.append(optimized_piece)
            
            # Update daily schedule
            optimized_schedule = daily_schedule.copy()
            optimized_schedule["content_pieces"] = optimized_pieces
            optimized_schedule["timeline_optimization"] = self._calculate_timeline_optimization_score(
                optimized_pieces
            )
            
            return optimized_schedule
            
        except Exception as e:
            logger.error(f"Error optimizing daily timeline: {str(e)}")
            raise
    
    def _sort_content_by_priority(
        self,
        content_pieces: List[Dict],
        platform_strategies: Dict
    ) -> List[Dict]:
        """Sort content pieces by priority for optimal timing."""
        try:
            # Define priority weights
            priority_weights = {
                "LinkedIn": 0.9,  # High priority for professional content
                "Twitter": 0.8,   # Medium-high priority
                "Instagram": 0.7, # Medium priority
                "Facebook": 0.6,  # Medium priority
                "Blog": 0.5       # Lower priority (longer content)
            }
            
            # Calculate priority scores
            for piece in content_pieces:
                platform = piece.get("target_platform", "LinkedIn")
                content_type = piece.get("content_type", "Post")
                
                # Base priority from platform
                base_priority = priority_weights.get(platform, 0.5)
                
                # Adjust based on content type
                if content_type in ["Video", "Article"]:
                    base_priority += 0.1
                elif content_type in ["Story", "Tweet"]:
                    base_priority -= 0.1
                
                piece["priority_score"] = min(1.0, base_priority)
            
            # Sort by priority score (highest first)
            return sorted(content_pieces, key=lambda x: x.get("priority_score", 0.0), reverse=True)
            
        except Exception as e:
            logger.error(f"Error sorting content by priority: {str(e)}")
            return content_pieces
    
    async def _optimize_content_timing(
        self,
        content_piece: Dict,
        index: int,
        total_pieces: int,
        posting_preferences: Dict,
        platform_strategies: Dict
    ) -> Dict:
        """Optimize timing for a single content piece."""
        try:
            target_platform = content_piece.get("target_platform", "LinkedIn")
            platform_strategy = platform_strategies.get(target_platform, {})
            
            # Create timing optimization prompt
            prompt = self._create_timing_optimization_prompt(
                content_piece, index, total_pieces, posting_preferences, platform_strategy
            )
            
            # Get AI timing suggestions
            ai_response = await self.ai_engine.generate_content(prompt, {
                "step": "timeline_optimization",
                "platform": target_platform,
                "piece_index": index,
                "total_pieces": total_pieces
            })
            
            # Apply timing optimizations
            optimized_piece = self._apply_timing_optimizations(
                content_piece, index, total_pieces, posting_preferences, ai_response
            )
            
            return optimized_piece
            
        except Exception as e:
            logger.error(f"Error optimizing content timing: {str(e)}")
            raise
    
    def _create_timing_optimization_prompt(
        self,
        content_piece: Dict,
        index: int,
        total_pieces: int,
        posting_preferences: Dict,
        platform_strategy: Dict
    ) -> str:
        """Create prompt for timing optimization."""
        
        prompt = f"""
        Optimize posting time for content piece {index + 1} of {total_pieces}:
        
        CONTENT DETAILS:
        Title: {content_piece.get('title', 'N/A')}
        Platform: {content_piece.get('target_platform', 'N/A')}
        Content Type: {content_piece.get('content_type', 'N/A')}
        
        POSTING PREFERENCES:
        Preferred Times: {', '.join(posting_preferences.get('preferred_times', []))}
        Posting Frequency: {posting_preferences.get('posting_frequency', 'daily')}
        
        PLATFORM STRATEGY:
        Approach: {platform_strategy.get('approach', 'N/A')}
        Tone: {platform_strategy.get('tone', 'N/A')}
        
        TIMELINE CONTEXT:
        - This is piece {index + 1} of {total_pieces} for the day
        - Need to optimize for maximum engagement
        - Consider platform-specific best practices
        - Account for audience timezone and behavior
        
        REQUIREMENTS:
        1. Suggest optimal posting time for this specific piece
        2. Consider the piece's position in the daily sequence
        3. Account for platform-specific engagement patterns
        4. Ensure proper spacing from other content
        5. Optimize for target audience behavior
        
        OUTPUT FORMAT:
        Provide:
        - Optimal Posting Time
        - Timing Rationale
        - Engagement Strategy
        - Coordination Notes
        """
        
        return prompt
    
    def _apply_timing_optimizations(
        self,
        content_piece: Dict,
        index: int,
        total_pieces: int,
        posting_preferences: Dict,
        ai_response: Dict
    ) -> Dict:
        """Apply timing optimizations to content piece."""
        try:
            optimized_piece = content_piece.copy()
            
            # Extract timing suggestions from AI response
            content = ai_response.get("content", "")
            insights = ai_response.get("insights", [])
            
            # Calculate optimal posting time based on piece index and preferences
            preferred_times = posting_preferences.get("preferred_times", ["09:00", "12:00", "15:00"])
            
            # Distribute pieces across preferred times
            if total_pieces <= len(preferred_times):
                optimal_time = preferred_times[index]
            else:
                # If more pieces than preferred times, distribute evenly
                time_index = index % len(preferred_times)
                optimal_time = preferred_times[time_index]
            
            # Apply timing optimizations
            optimized_piece["optimized_posting_time"] = optimal_time
            optimized_piece["timing_rationale"] = f"Optimized for piece {index + 1} of {total_pieces}"
            optimized_piece["timing_coordination_notes"] = f"Positioned for optimal engagement on {content_piece.get('target_platform', 'platform')}"
            
            # Add AI insights if available
            if insights:
                optimized_piece["timing_optimization_insights"] = insights[:2]  # Top 2 insights
            
            return optimized_piece
            
        except Exception as e:
            logger.error(f"Error applying timing optimizations: {str(e)}")
            return content_piece
    
    def _resolve_scheduling_conflicts(
        self,
        daily_schedules: List[Dict],
        platform_strategies: Dict
    ) -> List[Dict]:
        """Resolve scheduling conflicts in daily schedules."""
        try:
            resolved_schedules = []
            
            for schedule in daily_schedules:
                resolved_schedule = self._resolve_daily_conflicts(schedule, platform_strategies)
                resolved_schedules.append(resolved_schedule)
            
            return resolved_schedules
            
        except Exception as e:
            logger.error(f"Error resolving scheduling conflicts: {str(e)}")
            raise
    
    def _resolve_daily_conflicts(
        self,
        daily_schedule: Dict,
        platform_strategies: Dict
    ) -> Dict:
        """Resolve conflicts for a single day."""
        try:
            content_pieces = daily_schedule.get("content_pieces", [])
            resolved_pieces = []
            
            # Group pieces by platform
            platform_groups = {}
            for piece in content_pieces:
                platform = piece.get("target_platform", "Unknown")
                if platform not in platform_groups:
                    platform_groups[platform] = []
                platform_groups[platform].append(piece)
            
            # Resolve conflicts for each platform
            for platform, pieces in platform_groups.items():
                resolved_platform_pieces = self._resolve_platform_conflicts(pieces, platform)
                resolved_pieces.extend(resolved_platform_pieces)
            
            # Update daily schedule
            resolved_schedule = daily_schedule.copy()
            resolved_schedule["content_pieces"] = resolved_pieces
            resolved_schedule["conflict_resolution"] = self._calculate_conflict_resolution_score(
                content_pieces, resolved_pieces
            )
            
            return resolved_schedule
            
        except Exception as e:
            logger.error(f"Error resolving daily conflicts: {str(e)}")
            raise
    
    def _resolve_platform_conflicts(
        self,
        platform_pieces: List[Dict],
        platform: str
    ) -> List[Dict]:
        """Resolve conflicts for a specific platform."""
        try:
            if len(platform_pieces) <= 1:
                return platform_pieces
            
            resolved_pieces = []
            
            # Sort pieces by posting time
            sorted_pieces = sorted(platform_pieces, key=lambda x: x.get("optimized_posting_time", "09:00"))
            
            for i, piece in enumerate(sorted_pieces):
                # Adjust posting time if too close to previous piece
                if i > 0:
                    prev_time = resolved_pieces[-1].get("optimized_posting_time", "09:00")
                    current_time = piece.get("optimized_posting_time", "09:00")
                    
                    time_diff = self._calculate_time_difference(prev_time, current_time)
                    
                    if time_diff < self.timeline_rules["min_gap_hours"]:
                        # Adjust current piece time
                        adjusted_time = self._calculate_adjusted_time(prev_time, self.timeline_rules["optimal_spacing"])
                        piece["optimized_posting_time"] = adjusted_time
                        piece["timing_adjustment"] = f"Adjusted from {current_time} to {adjusted_time} for conflict resolution"
                
                resolved_pieces.append(piece)
            
            return resolved_pieces
            
        except Exception as e:
            logger.error(f"Error resolving platform conflicts: {str(e)}")
            return platform_pieces
    
    def _add_timeline_metrics(
        self,
        daily_schedules: List[Dict],
        timeline_analysis: Dict
    ) -> List[Dict]:
        """Add timeline coordination metrics to daily schedules."""
        try:
            coordinated_schedules = []
            
            for schedule in daily_schedules:
                coordinated_schedule = schedule.copy()
                
                # Add timeline metrics
                coordinated_schedule["timeline_metrics"] = {
                    "total_pieces": len(schedule.get("content_pieces", [])),
                    "platform_distribution": self._calculate_platform_distribution(
                        schedule.get("content_pieces", [])
                    ),
                    "time_distribution": self._calculate_time_distribution(
                        schedule.get("content_pieces", [])
                    ),
                    "coordination_score": self._calculate_coordination_score(schedule),
                    "optimization_opportunities": self._get_day_optimization_opportunities(
                        schedule, timeline_analysis
                    )
                }
                
                coordinated_schedules.append(coordinated_schedule)
            
            return coordinated_schedules
            
        except Exception as e:
            logger.error(f"Error adding timeline metrics: {str(e)}")
            raise
    
    # Helper methods
    def _calculate_time_difference(self, time1: str, time2: str) -> float:
        """Calculate time difference in hours between two time strings."""
        try:
            t1 = datetime.strptime(time1, "%H:%M")
            t2 = datetime.strptime(time2, "%H:%M")
            diff = abs((t2 - t1).total_seconds() / 3600)
            return diff
        except Exception:
            return 24.0  # Default to 24 hours if parsing fails
    
    def _calculate_adjusted_time(self, base_time: str, hours_to_add: int) -> str:
        """Calculate adjusted time by adding hours."""
        try:
            base_dt = datetime.strptime(base_time, "%H:%M")
            adjusted_dt = base_dt + timedelta(hours=hours_to_add)
            return adjusted_dt.strftime("%H:%M")
        except Exception:
            return "12:00"  # Default time if calculation fails
    
    def _calculate_timeline_optimization_score(self, content_pieces: List[Dict]) -> float:
        """Calculate timeline optimization score."""
        try:
            if not content_pieces:
                return 0.0
            
            scores = []
            for piece in content_pieces:
                # Check if piece has timing optimizations
                has_optimization = "optimized_posting_time" in piece
                has_rationale = "timing_rationale" in piece
                
                piece_score = 0.8 if has_optimization else 0.5
                piece_score += 0.2 if has_rationale else 0.0
                
                scores.append(min(1.0, piece_score))
            
            return sum(scores) / len(scores) if scores else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating timeline optimization score: {str(e)}")
            return 0.0
    
    def _calculate_conflict_resolution_score(
        self,
        original_pieces: List[Dict],
        resolved_pieces: List[Dict]
    ) -> float:
        """Calculate conflict resolution score."""
        try:
            if len(original_pieces) != len(resolved_pieces):
                return 0.0
            
            # Count pieces with timing adjustments
            adjusted_count = sum(
                1 for piece in resolved_pieces if "timing_adjustment" in piece
            )
            
            # Score based on successful conflict resolution
            resolution_score = 1.0 - (adjusted_count / len(resolved_pieces)) if resolved_pieces else 0.0
            
            return resolution_score
            
        except Exception as e:
            logger.error(f"Error calculating conflict resolution score: {str(e)}")
            return 0.0
    
    def _calculate_platform_distribution(self, content_pieces: List[Dict]) -> Dict[str, int]:
        """Calculate platform distribution for content pieces."""
        distribution = {}
        for piece in content_pieces:
            platform = piece.get("target_platform", "Unknown")
            distribution[platform] = distribution.get(platform, 0) + 1
        return distribution
    
    def _calculate_time_distribution(self, content_pieces: List[Dict]) -> Dict[str, int]:
        """Calculate time distribution for content pieces."""
        distribution = {}
        for piece in content_pieces:
            time = piece.get("optimized_posting_time", "09:00")
            distribution[time] = distribution.get(time, 0) + 1
        return distribution
    
    def _calculate_coordination_score(self, schedule: Dict) -> float:
        """Calculate coordination score for a daily schedule."""
        try:
            content_pieces = schedule.get("content_pieces", [])
            if len(content_pieces) <= 1:
                return 1.0
            
            # Check for proper time spacing
            times = [piece.get("optimized_posting_time", "09:00") for piece in content_pieces]
            times.sort()
            
            spacing_scores = []
            for i in range(len(times) - 1):
                time_diff = self._calculate_time_difference(times[i], times[i + 1])
                if time_diff >= self.timeline_rules["min_gap_hours"]:
                    spacing_scores.append(1.0)
                else:
                    spacing_scores.append(0.5)
            
            return sum(spacing_scores) / len(spacing_scores) if spacing_scores else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating coordination score: {str(e)}")
            return 0.0
    
    def _get_day_optimization_opportunities(
        self,
        schedule: Dict,
        timeline_analysis: Dict
    ) -> List[Dict]:
        """Get optimization opportunities for a specific day."""
        try:
            opportunities = []
            day_number = schedule.get("day_number", 0)
            
            # Check day-specific opportunities from timeline analysis
            daily_distribution = timeline_analysis.get("daily_distribution", {})
            if day_number in daily_distribution:
                post_count = daily_distribution[day_number]
                if post_count > self.timeline_rules["max_daily_posts"]:
                    opportunities.append({
                        "type": "reduce_posts",
                        "current": post_count,
                        "recommended": self.timeline_rules["max_daily_posts"]
                    })
            
            return opportunities
            
        except Exception as e:
            logger.error(f"Error getting day optimization opportunities: {str(e)}")
            return []

"""
Content Uniqueness Validator Module

This module ensures content uniqueness across the calendar and prevents duplicates.
It validates content originality, prevents keyword cannibalization, and ensures content variety.
"""

import asyncio
from typing import Dict, Any, List, Optional
from loguru import logger
import hashlib
import re

from services.content_gap_analyzer.ai_engine_service import AIEngineService
from services.content_gap_analyzer.keyword_researcher import KeywordResearcher


class ContentUniquenessValidator:
    """
    Validates content uniqueness and prevents duplicates across the calendar.
    
    This module ensures:
    - Content originality validation
    - Duplicate prevention
    - Keyword cannibalization prevention
    - Content variety assurance
    - Uniqueness scoring
    """
    
    def __init__(self):
        """Initialize the content uniqueness validator with real AI services."""
        self.ai_engine = AIEngineService()
        self.keyword_researcher = KeywordResearcher()
        
        # Uniqueness validation rules
        self.uniqueness_rules = {
            "min_uniqueness_score": 0.8,  # Minimum uniqueness score
            "max_similarity_threshold": 0.3,  # Maximum similarity between pieces
            "keyword_overlap_threshold": 0.4,  # Maximum keyword overlap
            "title_similarity_threshold": 0.5,  # Maximum title similarity
            "content_variety_threshold": 0.7  # Minimum content variety
        }
        
        # Content fingerprints for tracking
        self.content_fingerprints = set()
        
        logger.info("🎯 Content Uniqueness Validator initialized with real AI services")
    
    async def validate_content_uniqueness(
        self,
        daily_schedules: List[Dict],
        weekly_themes: List[Dict],
        keywords: List[str]
    ) -> List[Dict]:
        """
        Validate content uniqueness across all daily schedules.
        
        Args:
            daily_schedules: Daily content schedules
            weekly_themes: Weekly themes from Step 7
            keywords: Keywords from strategy
            
        Returns:
            Validated daily schedules with uniqueness metrics
        """
        try:
            logger.info("🚀 Starting content uniqueness validation")
            
            # Collect all content pieces for analysis
            all_content_pieces = self._collect_all_content_pieces(daily_schedules)
            
            # Generate content fingerprints
            content_fingerprints = self._generate_content_fingerprints(all_content_pieces)
            
            # Validate uniqueness for each piece
            validated_pieces = await self._validate_content_pieces(
                all_content_pieces, content_fingerprints, weekly_themes, keywords
            )
            
            # Update daily schedules with validated content
            validated_schedules = self._update_schedules_with_validated_content(
                daily_schedules, validated_pieces
            )
            
            # Calculate overall uniqueness metrics
            overall_metrics = self._calculate_overall_uniqueness_metrics(validated_pieces)
            
            # Add uniqueness metrics to schedules
            final_schedules = self._add_uniqueness_metrics(validated_schedules, overall_metrics)
            
            logger.info(f"✅ Validated uniqueness for {len(all_content_pieces)} content pieces")
            return final_schedules
            
        except Exception as e:
            logger.error(f"❌ Content uniqueness validation failed: {str(e)}")
            raise
    
    def _collect_all_content_pieces(self, daily_schedules: List[Dict]) -> List[Dict]:
        """Collect all content pieces from daily schedules."""
        try:
            all_pieces = []
            
            for schedule in daily_schedules:
                day_number = schedule.get("day_number", 0)
                content_pieces = schedule.get("content_pieces", [])
                
                for piece in content_pieces:
                    piece["day_number"] = day_number
                    piece["schedule_id"] = f"day_{day_number}"
                    all_pieces.append(piece)
            
            return all_pieces
            
        except Exception as e:
            logger.error(f"Error collecting content pieces: {str(e)}")
            raise
    
    def _generate_content_fingerprints(self, content_pieces: List[Dict]) -> Dict[str, str]:
        """Generate unique fingerprints for content pieces."""
        try:
            fingerprints = {}
            
            for piece in content_pieces:
                # Create fingerprint from title, description, and key message
                content_text = f"{piece.get('title', '')} {piece.get('description', '')} {piece.get('key_message', '')}"
                
                # Normalize text for fingerprinting
                normalized_text = self._normalize_text_for_fingerprinting(content_text)
                
                # Generate hash fingerprint
                fingerprint = hashlib.md5(normalized_text.encode()).hexdigest()
                
                piece_id = f"{piece.get('schedule_id', 'unknown')}_{piece.get('title', 'unknown')}"
                fingerprints[piece_id] = fingerprint
            
            return fingerprints
            
        except Exception as e:
            logger.error(f"Error generating content fingerprints: {str(e)}")
            raise
    
    def _normalize_text_for_fingerprinting(self, text: str) -> str:
        """Normalize text for fingerprinting by removing common words and formatting."""
        try:
            # Convert to lowercase
            normalized = text.lower()
            
            # Remove common words (stop words)
            stop_words = {
                'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
                'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
                'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
            }
            
            # Remove stop words
            words = normalized.split()
            filtered_words = [word for word in words if word not in stop_words and len(word) > 2]
            
            # Remove punctuation and numbers
            filtered_words = [re.sub(r'[^\w\s]', '', word) for word in filtered_words]
            filtered_words = [word for word in filtered_words if not word.isdigit()]
            
            return ' '.join(filtered_words)
            
        except Exception as e:
            logger.error(f"Error normalizing text: {str(e)}")
            return text.lower()
    
    async def _validate_content_pieces(
        self,
        content_pieces: List[Dict],
        content_fingerprints: Dict[str, str],
        weekly_themes: List[Dict],
        keywords: List[str]
    ) -> List[Dict]:
        """Validate uniqueness for each content piece."""
        try:
            validated_pieces = []
            
            for piece in content_pieces:
                validated_piece = await self._validate_single_piece(
                    piece, content_pieces, content_fingerprints, weekly_themes, keywords
                )
                validated_pieces.append(validated_piece)
            
            return validated_pieces
            
        except Exception as e:
            logger.error(f"Error validating content pieces: {str(e)}")
            raise
    
    async def _validate_single_piece(
        self,
        piece: Dict,
        all_pieces: List[Dict],
        content_fingerprints: Dict[str, str],
        weekly_themes: List[Dict],
        keywords: List[str]
    ) -> Dict:
        """Validate uniqueness for a single content piece."""
        try:
            validated_piece = piece.copy()
            
            # Calculate various uniqueness metrics
            title_uniqueness = self._calculate_title_uniqueness(piece, all_pieces)
            content_uniqueness = self._calculate_content_uniqueness(piece, all_pieces)
            keyword_uniqueness = self._calculate_keyword_uniqueness(piece, keywords)
            theme_alignment = self._calculate_theme_alignment(piece, weekly_themes)
            
            # Calculate overall uniqueness score
            overall_uniqueness = self._calculate_overall_uniqueness_score(
                title_uniqueness, content_uniqueness, keyword_uniqueness, theme_alignment
            )
            
            # Check for duplicates
            duplicate_check = self._check_for_duplicates(piece, all_pieces, content_fingerprints)
            
            # Add validation results
            validated_piece["uniqueness_validation"] = {
                "overall_uniqueness_score": overall_uniqueness,
                "title_uniqueness": title_uniqueness,
                "content_uniqueness": content_uniqueness,
                "keyword_uniqueness": keyword_uniqueness,
                "theme_alignment": theme_alignment,
                "duplicate_check": duplicate_check,
                "validation_passed": overall_uniqueness >= self.uniqueness_rules["min_uniqueness_score"],
                "recommendations": self._generate_uniqueness_recommendations(
                    overall_uniqueness, title_uniqueness, content_uniqueness, keyword_uniqueness
                )
            }
            
            return validated_piece
            
        except Exception as e:
            logger.error(f"Error validating single piece: {str(e)}")
            raise
    
    def _calculate_title_uniqueness(self, piece: Dict, all_pieces: List[Dict]) -> float:
        """Calculate title uniqueness score."""
        try:
            piece_title = piece.get("title", "").lower()
            if not piece_title:
                return 0.0
            
            # Compare with other pieces
            similarities = []
            for other_piece in all_pieces:
                if other_piece == piece:
                    continue
                
                other_title = other_piece.get("title", "").lower()
                if not other_title:
                    continue
                
                # Calculate similarity using simple word overlap
                similarity = self._calculate_text_similarity(piece_title, other_title)
                similarities.append(similarity)
            
            if not similarities:
                return 1.0  # No other pieces to compare with
            
            # Uniqueness is inverse of maximum similarity
            max_similarity = max(similarities)
            uniqueness = 1.0 - max_similarity
            
            return max(0.0, uniqueness)
            
        except Exception as e:
            logger.error(f"Error calculating title uniqueness: {str(e)}")
            return 0.0
    
    def _calculate_content_uniqueness(self, piece: Dict, all_pieces: List[Dict]) -> float:
        """Calculate content uniqueness score."""
        try:
            piece_content = f"{piece.get('description', '')} {piece.get('key_message', '')}".lower()
            if not piece_content:
                return 0.0
            
            # Compare with other pieces
            similarities = []
            for other_piece in all_pieces:
                if other_piece == piece:
                    continue
                
                other_content = f"{other_piece.get('description', '')} {other_piece.get('key_message', '')}".lower()
                if not other_content:
                    continue
                
                # Calculate similarity
                similarity = self._calculate_text_similarity(piece_content, other_content)
                similarities.append(similarity)
            
            if not similarities:
                return 1.0
            
            # Uniqueness is inverse of maximum similarity
            max_similarity = max(similarities)
            uniqueness = 1.0 - max_similarity
            
            return max(0.0, uniqueness)
            
        except Exception as e:
            logger.error(f"Error calculating content uniqueness: {str(e)}")
            return 0.0
    
    def _calculate_keyword_uniqueness(self, piece: Dict, keywords: List[str]) -> float:
        """Calculate keyword uniqueness score."""
        try:
            if not keywords:
                return 1.0
            
            piece_text = f"{piece.get('title', '')} {piece.get('description', '')} {piece.get('key_message', '')}".lower()
            
            # Count keyword occurrences
            keyword_counts = {}
            for keyword in keywords:
                keyword_lower = keyword.lower()
                count = piece_text.count(keyword_lower)
                if count > 0:
                    keyword_counts[keyword] = count
            
            # Calculate keyword diversity
            if not keyword_counts:
                return 0.5  # No keywords found, neutral score
            
            # Calculate keyword distribution score
            total_keywords = sum(keyword_counts.values())
            unique_keywords = len(keyword_counts)
            
            # Diversity score based on unique keywords vs total occurrences
            diversity_score = unique_keywords / total_keywords if total_keywords > 0 else 0.0
            
            # Normalize to 0-1 scale
            uniqueness_score = min(1.0, diversity_score * 2)  # Scale up for better scores
            
            return uniqueness_score
            
        except Exception as e:
            logger.error(f"Error calculating keyword uniqueness: {str(e)}")
            return 0.0
    
    def _calculate_theme_alignment(self, piece: Dict, weekly_themes: List[Dict]) -> float:
        """Calculate theme alignment score."""
        try:
            if not weekly_themes:
                return 0.5  # Neutral score if no themes
            
            piece_week = piece.get("week_number", 1)
            
            # Find the theme for this piece's week
            theme = None
            for t in weekly_themes:
                if t.get("week_number") == piece_week:
                    theme = t
                    break
            
            if not theme:
                return 0.5  # Neutral score if no matching theme
            
            # Calculate alignment based on content angles
            theme_angles = theme.get("content_angles", [])
            piece_angle = piece.get("content_angle", "")
            
            if not theme_angles or not piece_angle:
                return 0.5
            
            # Check if piece angle aligns with theme angles
            piece_angle_lower = piece_angle.lower()
            alignment_score = 0.0
            
            for angle in theme_angles:
                angle_lower = angle.lower()
                if piece_angle_lower in angle_lower or angle_lower in piece_angle_lower:
                    alignment_score = 1.0
                    break
                else:
                    # Partial alignment based on word overlap
                    piece_words = set(piece_angle_lower.split())
                    angle_words = set(angle_lower.split())
                    overlap = len(piece_words.intersection(angle_words))
                    if overlap > 0:
                        alignment_score = max(alignment_score, overlap / max(len(piece_words), len(angle_words)))
            
            return alignment_score
            
        except Exception as e:
            logger.error(f"Error calculating theme alignment: {str(e)}")
            return 0.0
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two text strings."""
        try:
            if not text1 or not text2:
                return 0.0
            
            # Simple word-based similarity
            words1 = set(text1.split())
            words2 = set(text2.split())
            
            if not words1 or not words2:
                return 0.0
            
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            
            similarity = len(intersection) / len(union) if union else 0.0
            
            return similarity
            
        except Exception as e:
            logger.error(f"Error calculating text similarity: {str(e)}")
            return 0.0
    
    def _calculate_overall_uniqueness_score(
        self,
        title_uniqueness: float,
        content_uniqueness: float,
        keyword_uniqueness: float,
        theme_alignment: float
    ) -> float:
        """Calculate overall uniqueness score."""
        try:
            # Weighted average of all uniqueness metrics
            weights = {
                "title": 0.3,
                "content": 0.4,
                "keyword": 0.2,
                "theme": 0.1
            }
            
            overall_score = (
                title_uniqueness * weights["title"] +
                content_uniqueness * weights["content"] +
                keyword_uniqueness * weights["keyword"] +
                theme_alignment * weights["theme"]
            )
            
            return min(1.0, max(0.0, overall_score))
            
        except Exception as e:
            logger.error(f"Error calculating overall uniqueness score: {str(e)}")
            return 0.0
    
    def _check_for_duplicates(
        self,
        piece: Dict,
        all_pieces: List[Dict],
        content_fingerprints: Dict[str, str]
    ) -> Dict[str, Any]:
        """Check for duplicate content."""
        try:
            piece_id = f"{piece.get('schedule_id', 'unknown')}_{piece.get('title', 'unknown')}"
            piece_fingerprint = content_fingerprints.get(piece_id, "")
            
            duplicates = []
            for other_piece in all_pieces:
                if other_piece == piece:
                    continue
                
                other_id = f"{other_piece.get('schedule_id', 'unknown')}_{other_piece.get('title', 'unknown')}"
                other_fingerprint = content_fingerprints.get(other_id, "")
                
                if piece_fingerprint == other_fingerprint and piece_fingerprint:
                    duplicates.append({
                        "piece_id": other_id,
                        "title": other_piece.get("title", ""),
                        "day_number": other_piece.get("day_number", 0),
                        "similarity_type": "exact_match"
                    })
            
            return {
                "has_duplicates": len(duplicates) > 0,
                "duplicate_count": len(duplicates),
                "duplicates": duplicates,
                "fingerprint": piece_fingerprint
            }
            
        except Exception as e:
            logger.error(f"Error checking for duplicates: {str(e)}")
            return {"has_duplicates": False, "duplicate_count": 0, "duplicates": [], "fingerprint": ""}
    
    def _generate_uniqueness_recommendations(
        self,
        overall_uniqueness: float,
        title_uniqueness: float,
        content_uniqueness: float,
        keyword_uniqueness: float
    ) -> List[str]:
        """Generate recommendations for improving uniqueness."""
        try:
            recommendations = []
            
            if overall_uniqueness < self.uniqueness_rules["min_uniqueness_score"]:
                recommendations.append("Overall uniqueness score is below threshold. Consider revising content.")
            
            if title_uniqueness < 0.7:
                recommendations.append("Title uniqueness is low. Consider making the title more distinctive.")
            
            if content_uniqueness < 0.7:
                recommendations.append("Content uniqueness is low. Consider adding more unique perspectives or examples.")
            
            if keyword_uniqueness < 0.6:
                recommendations.append("Keyword usage could be more diverse. Consider varying keyword implementation.")
            
            if not recommendations:
                recommendations.append("Content uniqueness is good. Maintain current quality.")
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating uniqueness recommendations: {str(e)}")
            return ["Unable to generate recommendations due to error"]
    
    def _update_schedules_with_validated_content(
        self,
        daily_schedules: List[Dict],
        validated_pieces: List[Dict]
    ) -> List[Dict]:
        """Update daily schedules with validated content pieces."""
        try:
            updated_schedules = []
            
            for schedule in daily_schedules:
                day_number = schedule.get("day_number", 0)
                updated_schedule = schedule.copy()
                
                # Find validated pieces for this day
                day_pieces = [
                    piece for piece in validated_pieces 
                    if piece.get("day_number") == day_number
                ]
                
                # Update content pieces
                updated_schedule["content_pieces"] = day_pieces
                
                # Calculate day-level uniqueness metrics
                day_uniqueness = self._calculate_day_uniqueness_metrics(day_pieces)
                updated_schedule["day_uniqueness_metrics"] = day_uniqueness
                
                updated_schedules.append(updated_schedule)
            
            return updated_schedules
            
        except Exception as e:
            logger.error(f"Error updating schedules with validated content: {str(e)}")
            raise
    
    def _calculate_day_uniqueness_metrics(self, day_pieces: List[Dict]) -> Dict[str, float]:
        """Calculate uniqueness metrics for a single day."""
        try:
            if not day_pieces:
                return {
                    "average_uniqueness": 0.0,
                    "min_uniqueness": 0.0,
                    "max_uniqueness": 0.0,
                    "uniqueness_variance": 0.0
                }
            
            uniqueness_scores = [
                piece.get("uniqueness_validation", {}).get("overall_uniqueness_score", 0.0)
                for piece in day_pieces
            ]
            
            return {
                "average_uniqueness": sum(uniqueness_scores) / len(uniqueness_scores),
                "min_uniqueness": min(uniqueness_scores),
                "max_uniqueness": max(uniqueness_scores),
                "uniqueness_variance": self._calculate_variance(uniqueness_scores)
            }
            
        except Exception as e:
            logger.error(f"Error calculating day uniqueness metrics: {str(e)}")
            return {"average_uniqueness": 0.0, "min_uniqueness": 0.0, "max_uniqueness": 0.0, "uniqueness_variance": 0.0}
    
    def _calculate_overall_uniqueness_metrics(self, validated_pieces: List[Dict]) -> Dict[str, Any]:
        """Calculate overall uniqueness metrics for all content."""
        try:
            if not validated_pieces:
                return {
                    "total_pieces": 0,
                    "average_uniqueness": 0.0,
                    "uniqueness_distribution": {},
                    "duplicate_count": 0,
                    "validation_summary": {}
                }
            
            uniqueness_scores = [
                piece.get("uniqueness_validation", {}).get("overall_uniqueness_score", 0.0)
                for piece in validated_pieces
            ]
            
            duplicate_counts = [
                piece.get("uniqueness_validation", {}).get("duplicate_check", {}).get("duplicate_count", 0)
                for piece in validated_pieces
            ]
            
            # Calculate distribution
            distribution = {
                "excellent": len([s for s in uniqueness_scores if s >= 0.9]),
                "good": len([s for s in uniqueness_scores if 0.8 <= s < 0.9]),
                "fair": len([s for s in uniqueness_scores if 0.7 <= s < 0.8]),
                "poor": len([s for s in uniqueness_scores if s < 0.7])
            }
            
            return {
                "total_pieces": len(validated_pieces),
                "average_uniqueness": sum(uniqueness_scores) / len(uniqueness_scores),
                "min_uniqueness": min(uniqueness_scores),
                "max_uniqueness": max(uniqueness_scores),
                "uniqueness_distribution": distribution,
                "duplicate_count": sum(duplicate_counts),
                "validation_summary": {
                    "passed_validation": len([s for s in uniqueness_scores if s >= self.uniqueness_rules["min_uniqueness_score"]]),
                    "failed_validation": len([s for s in uniqueness_scores if s < self.uniqueness_rules["min_uniqueness_score"]]),
                    "pass_rate": len([s for s in uniqueness_scores if s >= self.uniqueness_rules["min_uniqueness_score"]]) / len(uniqueness_scores) if uniqueness_scores else 0.0
                }
            }
            
        except Exception as e:
            logger.error(f"Error calculating overall uniqueness metrics: {str(e)}")
            return {"total_pieces": 0, "average_uniqueness": 0.0, "uniqueness_distribution": {}, "duplicate_count": 0, "validation_summary": {}}
    
    def _add_uniqueness_metrics(
        self,
        daily_schedules: List[Dict],
        overall_metrics: Dict[str, Any]
    ) -> List[Dict]:
        """Add uniqueness metrics to daily schedules."""
        try:
            final_schedules = []
            
            for schedule in daily_schedules:
                final_schedule = schedule.copy()
                final_schedule["overall_uniqueness_metrics"] = overall_metrics
                final_schedules.append(final_schedule)
            
            return final_schedules
            
        except Exception as e:
            logger.error(f"Error adding uniqueness metrics: {str(e)}")
            raise
    
    def _calculate_variance(self, values: List[float]) -> float:
        """Calculate variance of a list of values."""
        try:
            if not values:
                return 0.0
            
            mean = sum(values) / len(values)
            squared_diff_sum = sum((x - mean) ** 2 for x in values)
            variance = squared_diff_sum / len(values)
            
            return variance
            
        except Exception as e:
            logger.error(f"Error calculating variance: {str(e)}")
            return 0.0

"""
Outline Service - Core outline generation and management functionality.

Handles AI-powered outline generation, refinement, and optimization.
"""

from typing import Dict, Any, List
import asyncio
from loguru import logger

from models.blog_models import (
    BlogOutlineRequest,
    BlogOutlineResponse,
    BlogOutlineRefineRequest,
    BlogOutlineSection,
)

from .outline_generator import OutlineGenerator
from .outline_optimizer import OutlineOptimizer
from .section_enhancer import SectionEnhancer
from services.cache.persistent_outline_cache import persistent_outline_cache


class OutlineService:
    """Service for generating and managing blog outlines using AI."""
    
    def __init__(self):
        self.outline_generator = OutlineGenerator()
        self.outline_optimizer = OutlineOptimizer()
        self.section_enhancer = SectionEnhancer()
    
    async def generate_outline(self, request: BlogOutlineRequest, user_id: str) -> BlogOutlineResponse:
        """
        Stage 2: Content Planning with AI-generated outline using research results.
        Uses Gemini with research data to create comprehensive, SEO-optimized outline.
        
        Args:
            request: Outline generation request with research data
            user_id: User ID (required for subscription checks and usage tracking)
            
        Raises:
            ValueError: If user_id is not provided
        """
        if not user_id:
            raise ValueError("user_id is required for outline generation (subscription checks and usage tracking)")
        
        # Extract cache parameters - use original user keywords for consistent caching
        keywords = request.research.original_keywords or request.research.keyword_analysis.get('primary', [])
        # PHASE C SKIP (persona voice): `industry` / `target_audience` here are used
        # for SEO targeting + outline CACHING, not brand voice. Outlines are
        # structure/SEO-driven, not style — persona voice is intentionally NOT
        # injected here (it lives in medium_blog_generator content generation).
        # Style/topic separation: persona constrains HOW, never WHAT to write.
        industry = getattr(request.persona, 'industry', 'general') if request.persona else 'general'
        target_audience = getattr(request.persona, 'target_audience', 'general') if request.persona else 'general'
        word_count = request.word_count or 1500
        custom_instructions = request.custom_instructions or ""
        persona_data = request.persona.dict() if request.persona else None
        
        # Check cache first
        cached_result = persistent_outline_cache.get_cached_outline(
            keywords=keywords,
            industry=industry,
            target_audience=target_audience,
            word_count=word_count,
            custom_instructions=custom_instructions,
            persona_data=persona_data
        )
        
        if cached_result:
            logger.info(f"Using cached outline for keywords: {keywords}")
            return BlogOutlineResponse(**cached_result)
        
        # Generate new outline if not cached (user_id required)
        logger.info(f"Generating new outline for keywords: {keywords}")
        result = await self.outline_generator.generate(request, user_id)
        
        # Cache the result
        persistent_outline_cache.cache_outline(
            keywords=keywords,
            industry=industry,
            target_audience=target_audience,
            word_count=word_count,
            custom_instructions=custom_instructions,
            persona_data=persona_data,
            result=result.dict()
        )
        
        return result
    
    async def generate_outline_with_progress(self, request: BlogOutlineRequest, task_id: str, user_id: str) -> BlogOutlineResponse:
        """
        Outline generation method with progress updates for real-time feedback.
        """
        # Extract cache parameters - use original user keywords for consistent caching
        keywords = request.research.original_keywords or request.research.keyword_analysis.get('primary', [])
        industry = getattr(request.persona, 'industry', 'general') if request.persona else 'general'
        target_audience = getattr(request.persona, 'target_audience', 'general') if request.persona else 'general'
        word_count = request.word_count or 1500
        custom_instructions = request.custom_instructions or ""
        persona_data = request.persona.dict() if request.persona else None
        
        # Check cache first
        cached_result = persistent_outline_cache.get_cached_outline(
            keywords=keywords,
            industry=industry,
            target_audience=target_audience,
            word_count=word_count,
            custom_instructions=custom_instructions,
            persona_data=persona_data
        )
        
        if cached_result:
            logger.info(f"Using cached outline for keywords: {keywords} (with progress updates)")
            # Update progress to show cache hit
            from api.blog_writer.task_manager import task_manager
            await task_manager.update_progress(task_id, "✅ Using cached outline (saved generation time!)")
            return BlogOutlineResponse(**cached_result)
        
        # Generate new outline if not cached
        logger.info(f"Generating new outline for keywords: {keywords} (with progress updates)")
        result = await self.outline_generator.generate_with_progress(request, task_id, user_id)
        
        # Cache the result
        persistent_outline_cache.cache_outline(
            keywords=keywords,
            industry=industry,
            target_audience=target_audience,
            word_count=word_count,
            custom_instructions=custom_instructions,
            persona_data=persona_data,
            result=result.dict()
        )
        
        return result
    
    async def refine_outline(self, request: BlogOutlineRefineRequest) -> BlogOutlineResponse:
        """
        Refine outline with HITL (Human-in-the-Loop) operations
        Supports add, remove, move, merge, rename operations
        """
        outline = request.outline.copy()
        operation = request.operation.lower()
        section_id = request.section_id
        payload = request.payload or {}
        
        try:
            if operation == 'add':
                # Add new section
                new_section = BlogOutlineSection(
                    id=f"s{len(outline) + 1}",
                    heading=payload.get('heading', 'New Section'),
                    subheadings=payload.get('subheadings', []),
                    key_points=payload.get('key_points', []),
                    references=[],
                    target_words=payload.get('target_words', 300)
                )
                outline.append(new_section)
                logger.info(f"Added new section: {new_section.heading}")
                
            elif operation == 'remove' and section_id:
                # Remove section
                outline = [s for s in outline if s.id != section_id]
                logger.info(f"Removed section: {section_id}")
                
            elif operation == 'rename' and section_id:
                # Rename section
                for section in outline:
                    if section.id == section_id:
                        section.heading = payload.get('heading', section.heading)
                        break
                logger.info(f"Renamed section {section_id} to: {payload.get('heading')}")
                
            elif operation == 'move' and section_id:
                # Move section (reorder)
                direction = payload.get('direction', 'down')  # 'up' or 'down'
                current_index = next((i for i, s in enumerate(outline) if s.id == section_id), -1)
                
                if current_index != -1:
                    if direction == 'up' and current_index > 0:
                        outline[current_index], outline[current_index - 1] = outline[current_index - 1], outline[current_index]
                    elif direction == 'down' and current_index < len(outline) - 1:
                        outline[current_index], outline[current_index + 1] = outline[current_index + 1], outline[current_index]
                logger.info(f"Moved section {section_id} {direction}")
                
            elif operation == 'merge' and section_id:
                # Merge with next section
                current_index = next((i for i, s in enumerate(outline) if s.id == section_id), -1)
                if current_index != -1 and current_index < len(outline) - 1:
                    current_section = outline[current_index]
                    next_section = outline[current_index + 1]
                    
                    # Merge sections
                    current_section.heading = f"{current_section.heading} & {next_section.heading}"
                    current_section.subheadings.extend(next_section.subheadings)
                    current_section.key_points.extend(next_section.key_points)
                    current_section.references.extend(next_section.references)
                    current_section.target_words = (current_section.target_words or 0) + (next_section.target_words or 0)
                    
                    # Remove the next section
                    outline.pop(current_index + 1)
                logger.info(f"Merged section {section_id} with next section")
                
            elif operation == 'update' and section_id:
                # Update section details
                for section in outline:
                    if section.id == section_id:
                        if 'heading' in payload:
                            section.heading = payload['heading']
                        if 'subheadings' in payload:
                            section.subheadings = payload['subheadings']
                        if 'key_points' in payload:
                            section.key_points = payload['key_points']
                        if 'target_words' in payload:
                            section.target_words = payload['target_words']
                        break
                logger.info(f"Updated section {section_id}")
            
            # Reassign IDs to maintain order
            for i, section in enumerate(outline):
                section.id = f"s{i+1}"
            
            return BlogOutlineResponse(
                success=True, 
                title_options=["Refined Outline"], 
                outline=outline
            )
            
        except Exception as e:
            logger.error(f"Outline refinement failed: {e}")
            return BlogOutlineResponse(
                success=False, 
                title_options=["Error"], 
                outline=request.outline
            )
    
    async def enhance_section_with_ai(self, section: BlogOutlineSection, focus: str = "general improvement") -> BlogOutlineSection:
        """Enhance a section using AI with research context."""
        return await self.section_enhancer.enhance(section, focus)
    
    async def optimize_outline_with_ai(self, outline: List[BlogOutlineSection], focus: str = "general optimization", research_context: str = "") -> List[BlogOutlineSection]:
        """Optimize entire outline for better flow, SEO, and engagement."""
        return await self.outline_optimizer.optimize(outline, focus, research_context=research_context)
    
    def rebalance_word_counts(self, outline: List[BlogOutlineSection], target_words: int) -> List[BlogOutlineSection]:
        """Rebalance word count distribution across sections."""
        return self.outline_optimizer.rebalance_word_counts(outline, target_words)
    
    # Cache Management Methods
    
    def get_outline_cache_stats(self) -> Dict[str, Any]:
        """Get outline cache statistics."""
        return persistent_outline_cache.get_cache_stats()
    
    def clear_outline_cache(self):
        """Clear all cached outline entries."""
        persistent_outline_cache.clear_cache()
        logger.info("Outline cache cleared")
    
    def invalidate_outline_cache_for_keywords(self, keywords: List[str]):
        """
        Invalidate outline cache entries for specific keywords.
        Useful when research data is updated.
        
        Args:
            keywords: Keywords to invalidate cache for
        """
        persistent_outline_cache.invalidate_cache_for_keywords(keywords)
        logger.info(f"Invalidated outline cache for keywords: {keywords}")
    
    def get_recent_outline_cache_entries(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent outline cache entries for debugging."""
        return persistent_outline_cache.get_cache_entries(limit)

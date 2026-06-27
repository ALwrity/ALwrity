"""
Research Handler for LinkedIn Content Generation

Handles research operations and timing for content generation.
Uses common Exa/Tavily infrastructure with pre-flight validation.
"""

from typing import List, Optional
from datetime import datetime
from loguru import logger
from models.linkedin_models import ResearchSource


class ResearchHandler:
    """Handles research operations and timing for LinkedIn content."""
    
    def __init__(self, linkedin_service):
        self.linkedin_service = linkedin_service
    
    async def conduct_research(
        self,
        request,
        research_enabled: bool,
        search_engine: str,
        max_results: int = 10,
        user_id: Optional[str] = None
    ) -> tuple[List[ResearchSource], float]:
        """
        Conduct research if enabled and return sources with timing.
        
        Args:
            request: Generation request object
            research_enabled: Whether research is enabled
            search_engine: Search engine to use (exa, tavily)
            max_results: Maximum number of results
            user_id: User ID for pre-flight validation and usage tracking
            
        Returns:
            Tuple of (research_sources, research_time)
        """
        research_sources = []
        research_time = 0
        
        if research_enabled:
            logger.info(f"ResearchHandler: search_engine='{search_engine}' (type: {type(search_engine)})")
            
            research_start = datetime.now()
            sources = await self.linkedin_service._conduct_research(
                topic=request.topic,
                industry=request.industry,
                search_engine=search_engine,
                max_results=max_results,
                user_id=user_id
            )
            research_sources = sources if sources is not None else []
            research_time = (datetime.now() - research_start).total_seconds()
            logger.info(f"Research completed in {research_time:.2f}s, found {len(research_sources)} sources")
        
        return research_sources, research_time
    
    def determine_grounding_enabled(self, request, research_sources: List[ResearchSource]) -> bool:
        """Determine if grounding should be enabled based on request and research results."""
        # Normalize values from possible Enum or string
        try:
            level_raw = getattr(request, 'grounding_level', 'enhanced')
            level = (getattr(level_raw, 'value', level_raw) or '').strip().lower()
        except Exception:
            level = 'enhanced'
        try:
            engine_raw = getattr(request, 'search_engine', 'google')
            engine_val = getattr(engine_raw, 'value', engine_raw)
            engine_str = str(engine_val).split('.')[-1].strip().lower()
        except Exception:
            engine_str = 'google'
        research_enabled = bool(getattr(request, 'research_enabled', True))
        
        if not research_enabled or level == 'none':
            return False
        
        # For other engines, require that research actually returned sources
        return bool(research_sources)

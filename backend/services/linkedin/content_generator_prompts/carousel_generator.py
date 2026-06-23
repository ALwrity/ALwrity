"""
LinkedIn Carousel Generation Module

This module handles the generation of LinkedIn carousels with all processing steps.
"""

from typing import Dict, Any, List
from datetime import datetime
from loguru import logger
from services.linkedin.quality_handler import QualityHandler


class CarouselGenerator:
    """Handles LinkedIn carousel generation with all processing steps."""
    
    def __init__(self, citation_manager=None, quality_analyzer=None):
        self.citation_manager = citation_manager
        self.quality_analyzer = quality_analyzer
    
    async def generate_carousel(
        self,
        request,
        research_sources: List,
        research_time: float,
        content_result: Dict[str, Any],
        grounding_enabled: bool
    ):
        """Generate LinkedIn carousel with all processing steps."""
        try:
            start_time = datetime.now()
            
            # Step 3: Add citations if requested
            citations = []
            source_list = None
            if request.include_citations and research_sources:
                # Prefer structured citations from LLM json_struct output
                if content_result.get('citations'):
                    citations = content_result['citations']
                    logger.info(f"Using {len(citations)} structured citations from LLM output for carousel")
                elif self.citation_manager:
                    # Extract citations from all slides (backward compat for non-structured mode)
                    all_content = " ".join([slide['content'] for slide in content_result['slides']])
                    citations = self.citation_manager.extract_citations(all_content)
                
                if self.citation_manager:
                    source_list = self.citation_manager.generate_source_list(research_sources)
            
            # Step 4: Analyze content quality
            quality_metrics = None
            if grounding_enabled and self.quality_analyzer:
                try:
                    all_content = " ".join([slide['content'] for slide in content_result['slides']])
                    quality_handler = QualityHandler(self.quality_analyzer)
                    quality_metrics = quality_handler.create_quality_metrics(
                        content=all_content,
                        sources=research_sources,
                        industry=request.industry,
                        grounding_enabled=grounding_enabled
                    )
                except Exception as e:
                    logger.warning(f"Quality analysis failed: {e}")
            
            # Step 5: Build response
            slides = []
            for i, slide_data in enumerate(content_result['slides']):
                slide_citations = []
                if request.include_citations and research_sources and self.citation_manager:
                    slide_citations = self.citation_manager.extract_citations(slide_data['content'])
                
                slides.append({
                    'slide_number': i + 1,
                    'title': slide_data['title'],
                    'content': slide_data['content'],
                    'visual_elements': slide_data.get('visual_elements', []),
                    'design_notes': slide_data.get('design_notes'),
                    'citations': slide_citations
                })
            
            carousel_content = {
                'title': content_result['title'],
                'slides': slides,
                'cover_slide': content_result.get('cover_slide'),
                'cta_slide': content_result.get('cta_slide'),
                'design_guidelines': content_result.get('design_guidelines', {}),
                'citations': citations,
                'source_list': source_list,
                'quality_metrics': quality_metrics,
                'grounding_enabled': grounding_enabled
            }
            
            generation_time = (datetime.now() - start_time).total_seconds()
            
            # Build grounding status
            grounding_status = {
                'status': 'success' if grounding_enabled else 'disabled',
                'sources_used': len(research_sources),
                'citation_coverage': len(citations) / max(len(research_sources), 1) if research_sources else 0,
                'quality_score': quality_metrics.overall_score if quality_metrics else 0.0
            } if grounding_enabled else None
            
            return {
                'success': True,
                'data': carousel_content,
                'research_sources': research_sources,
                'generation_metadata': {
                    'model_used': 'llm_text_gen',
                    'generation_time': generation_time,
                    'research_time': research_time,
                    'grounding_enabled': grounding_enabled
                },
                'grounding_status': grounding_status
            }
            
        except Exception as e:
            logger.error(f"Error generating LinkedIn carousel: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to generate LinkedIn carousel: {str(e)}"
            }

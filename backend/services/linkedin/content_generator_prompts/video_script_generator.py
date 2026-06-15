"""
LinkedIn Video Script Generation Module

This module handles the generation of LinkedIn video scripts with all processing steps.
"""

from typing import Dict, Any, List
from datetime import datetime
from loguru import logger
from services.linkedin.quality_handler import QualityHandler


class VideoScriptGenerator:
    """Handles LinkedIn video script generation with all processing steps."""
    
    def __init__(self, citation_manager=None, quality_analyzer=None):
        self.citation_manager = citation_manager
        self.quality_analyzer = quality_analyzer

    def _extract_response_citations(self, content: str, research_sources: List) -> List[Dict[str, Any]]:
        """Extract citations and adapt them to the public LinkedIn Citation schema."""
        if not self.citation_manager:
            return []

        raw_citations = self.citation_manager.extract_citations(content)
        source_count = len(research_sources or [])
        citations: List[Dict[str, Any]] = []
        skipped = 0

        for raw in raw_citations:
            try:
                source_index = int(raw.get("number"))
            except (TypeError, ValueError):
                skipped += 1
                continue

            if source_count and not 1 <= source_index <= source_count:
                skipped += 1
                continue

            citations.append({
                "type": "inline",
                "reference": f"Source {source_index}",
                "position": raw.get("position"),
                "source_index": source_index
            })

        if skipped:
            logger.debug(
                "Skipped {} video citation candidates that did not map to {} research sources",
                skipped,
                source_count
            )

        return citations
    
    async def generate_video_script(
        self,
        request,
        research_sources: List,
        research_time: float,
        content_result: Dict[str, Any],
        grounding_enabled: bool
    ):
        """Generate LinkedIn video script with all processing steps."""
        try:
            start_time = datetime.now()
            
            # Step 3: Add citations if requested
            citations = []
            source_list = None
            if request.include_citations and research_sources and self.citation_manager:
                all_content = f"{content_result['hook']} {' '.join([scene['content'] for scene in content_result['main_content']])} {content_result['conclusion']}"
                citations = self._extract_response_citations(all_content, research_sources)
                source_list = self.citation_manager.generate_source_list(research_sources)
            
            # Step 4: Analyze content quality
            quality_metrics = None
            if grounding_enabled and self.quality_analyzer:
                try:
                    all_content = f"{content_result['hook']} {' '.join([scene['content'] for scene in content_result['main_content']])} {content_result['conclusion']}"
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
            video_script = {
                'hook': content_result['hook'],
                'main_content': content_result['main_content'],
                'conclusion': content_result['conclusion'],
                'captions': content_result.get('captions'),
                'thumbnail_suggestions': content_result.get('thumbnail_suggestions', []),
                'video_description': content_result.get('video_description', ''),
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
                'data': video_script,
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
            logger.error(f"Error generating LinkedIn video script: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to generate LinkedIn video script: {str(e)}"
            }

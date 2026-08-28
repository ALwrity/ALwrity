"""
Research Data Filter - Filters and cleans research data for optimal AI processing.

This module provides intelligent filtering and cleaning of research data to:
1. Remove low-quality sources and irrelevant content
2. Optimize data for AI processing (reduce tokens, improve quality)
3. Ensure only high-value insights are sent to AI prompts
4. Maintain data integrity while improving processing efficiency
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import re
from loguru import logger

from models.blog_models import (
    BlogResearchResponse,
    ResearchSource,
    GroundingMetadata,
    GroundingChunk,
    GroundingSupport,
    Citation,
)


class ResearchDataFilter:
    """Filters and cleans research data for optimal AI processing."""
    
    def __init__(self):
        """Initialize the research data filter with default settings."""
        # Be conservative but avoid over-filtering which can lead to empty UI
        self.min_credibility_score = 0.5
        self.min_excerpt_length = 20
        self.max_sources = 15
        self.max_grounding_chunks = 20
        self.max_content_gaps = 5
        self.max_keywords_per_category = 10
        self.min_grounding_confidence = 0.5
        self.max_source_age_days = 365 * 5  # allow up to 5 years if relevant
        
        # Common stop words for keyword cleaning
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
        }
        
        # Irrelevant source patterns
        self.irrelevant_patterns = [
            r'\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$',  # Document files
            r'\.(jpg|jpeg|png|gif|svg|webp)$',  # Image files
            r'\.(mp4|avi|mov|wmv|flv|webm)$',  # Video files
            r'\.(mp3|wav|flac|aac)$',  # Audio files
            r'\.(zip|rar|7z|tar|gz)$',  # Archive files
            r'^https?://(www\.)?(facebook|twitter|instagram|linkedin|youtube)\.com',  # Social media
            r'^https?://(www\.)?(amazon|ebay|etsy)\.com',  # E-commerce
            r'^https?://(www\.)?(wikipedia)\.org',  # Wikipedia (too generic)
        ]
        
        logger.debug("✅ ResearchDataFilter initialized with quality thresholds")
    
    def filter_research_data(self, research_data: BlogResearchResponse) -> BlogResearchResponse:
        """
        Main filtering method that processes all research data components.
        
        Args:
            research_data: Raw research data from the research service
            
        Returns:
            Filtered and cleaned research data optimized for AI processing
        """
        logger.info(f"Starting research data filtering for {len(research_data.sources)} sources")
        
        # Track original counts for logging
        original_counts = {
            'sources': len(research_data.sources),
            'grounding_chunks': len(research_data.grounding_metadata.grounding_chunks) if research_data.grounding_metadata else 0,
            'grounding_supports': len(research_data.grounding_metadata.grounding_supports) if research_data.grounding_metadata else 0,
            'citations': len(research_data.grounding_metadata.citations) if research_data.grounding_metadata else 0,
        }
        
        # Filter sources
        filtered_sources = self.filter_sources(research_data.sources)
        
        # Filter grounding metadata
        filtered_grounding_metadata = self.filter_grounding_metadata(research_data.grounding_metadata)
        
        # Clean keyword analysis
        cleaned_keyword_analysis = self.clean_keyword_analysis(research_data.keyword_analysis)
        
        # Clean competitor analysis
        cleaned_competitor_analysis = self.clean_competitor_analysis(research_data.competitor_analysis)
        
        # Filter content gaps
        filtered_content_gaps = self.filter_content_gaps(
            research_data.keyword_analysis.get('content_gaps', []),
            research_data
        )
        
        # Update keyword analysis with filtered content gaps
        cleaned_keyword_analysis['content_gaps'] = filtered_content_gaps
        
        # Create filtered research response
        filtered_research = BlogResearchResponse(
            success=research_data.success,
            sources=filtered_sources,
            keyword_analysis=cleaned_keyword_analysis,
            competitor_analysis=cleaned_competitor_analysis,
            suggested_angles=research_data.suggested_angles,  # Keep as-is for now
            search_widget=research_data.search_widget,
            search_queries=research_data.search_queries,
            grounding_metadata=filtered_grounding_metadata,
            error_message=research_data.error_message
        )
        
        # Log filtering results
        self._log_filtering_results(original_counts, filtered_research)
        
        return filtered_research
    
    def filter_sources(self, sources: List[ResearchSource]) -> List[ResearchSource]:
        """
        Filter sources based on quality, relevance, and recency criteria.
        
        Args:
            sources: List of research sources to filter
            
        Returns:
            Filtered list of high-quality sources
        """
        if not sources:
            return []
        
        filtered_sources = []
        
        for source in sources:
            # Quality filters
            if not self._is_source_high_quality(source):
                continue
            
            # Relevance filters
            if not self._is_source_relevant(source):
                continue
            
            # Recency filters
            if not self._is_source_recent(source):
                continue
            
            filtered_sources.append(source)
        
        # Sort by credibility score and limit to max_sources
        filtered_sources.sort(key=lambda s: s.credibility_score or 0.8, reverse=True)
        filtered_sources = filtered_sources[:self.max_sources]

        # Fail-open: if everything was filtered out, return a trimmed set of original sources
        if not filtered_sources and sources:
            logger.warning("All sources filtered out by thresholds. Falling back to top sources without strict filters.")
            fallback = sorted(
                sources,
                key=lambda s: (s.credibility_score or 0.8),
                reverse=True
            )[: self.max_sources]
            return fallback
        
        logger.info(f"Filtered sources: {len(sources)} → {len(filtered_sources)}")
        return filtered_sources
    
    def filter_grounding_metadata(self, grounding_metadata: Optional[GroundingMetadata]) -> Optional[GroundingMetadata]:
        """
        Filter grounding metadata to keep only high-confidence, relevant data.
        
        Args:
            grounding_metadata: Raw grounding metadata to filter
            
        Returns:
            Filtered grounding metadata with high-quality data only
        """
        if not grounding_metadata:
            return None
        
        # Filter grounding chunks by confidence
        filtered_chunks = []
        for chunk in grounding_metadata.grounding_chunks:
            if chunk.confidence_score and chunk.confidence_score >= self.min_grounding_confidence:
                filtered_chunks.append(chunk)
        
        # Limit chunks to max_grounding_chunks
        filtered_chunks = filtered_chunks[:self.max_grounding_chunks]
        
        # Filter grounding supports by confidence
        filtered_supports = []
        for support in grounding_metadata.grounding_supports:
            if support.confidence_scores and max(support.confidence_scores) >= self.min_grounding_confidence:
                filtered_supports.append(support)
        
        # Filter citations by type and relevance
        filtered_citations = []
        for citation in grounding_metadata.citations:
            if self._is_citation_relevant(citation):
                filtered_citations.append(citation)
        
        # Fail-open strategies to avoid empty UI:
        if not filtered_chunks and grounding_metadata.grounding_chunks:
            logger.warning("All grounding chunks filtered out. Falling back to first N chunks without confidence filter.")
            filtered_chunks = grounding_metadata.grounding_chunks[: self.max_grounding_chunks]
        if not filtered_supports and grounding_metadata.grounding_supports:
            logger.warning("All grounding supports filtered out. Falling back to first N supports without confidence filter.")
            filtered_supports = grounding_metadata.grounding_supports[: self.max_grounding_chunks]

        # Create filtered grounding metadata
        filtered_metadata = GroundingMetadata(
            grounding_chunks=filtered_chunks,
            grounding_supports=filtered_supports,
            citations=filtered_citations,
            search_entry_point=grounding_metadata.search_entry_point,
            web_search_queries=grounding_metadata.web_search_queries
        )
        
        logger.info(f"Filtered grounding metadata: {len(grounding_metadata.grounding_chunks)} chunks → {len(filtered_chunks)} chunks")
        return filtered_metadata
    
    def clean_keyword_analysis(self, keyword_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clean and deduplicate keyword analysis data.
        
        Args:
            keyword_analysis: Raw keyword analysis data
            
        Returns:
            Cleaned and deduplicated keyword analysis
        """
        if not keyword_analysis:
            return {}
        
        cleaned_analysis = {}
        
        # Clean and deduplicate keyword lists
        keyword_categories = ['primary', 'secondary', 'long_tail', 'semantic_keywords', 'trending_terms']
        
        for category in keyword_categories:
            if category in keyword_analysis and isinstance(keyword_analysis[category], list):
                cleaned_keywords = self._clean_keyword_list(keyword_analysis[category])
                cleaned_analysis[category] = cleaned_keywords[:self.max_keywords_per_category]
        
        # Clean other fields
        other_fields = ['search_intent', 'difficulty', 'analysis_insights']
        for field in other_fields:
            if field in keyword_analysis:
                cleaned_analysis[field] = keyword_analysis[field]
        
        # Clean content gaps separately (handled by filter_content_gaps)
        # Don't add content_gaps if it's empty to avoid adding empty lists
        if 'content_gaps' in keyword_analysis and keyword_analysis['content_gaps']:
            cleaned_analysis['content_gaps'] = keyword_analysis['content_gaps']  # Will be filtered later
        
        logger.info(f"Cleaned keyword analysis: {len(keyword_analysis)} categories → {len(cleaned_analysis)} categories")
        return cleaned_analysis
    
    def clean_competitor_analysis(self, competitor_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clean and validate competitor analysis data.
        
        Args:
            competitor_analysis: Raw competitor analysis data
            
        Returns:
            Cleaned competitor analysis data
        """
        if not competitor_analysis:
            return {}
        
        cleaned_analysis = {}
        
        # Clean competitor lists
        competitor_lists = ['top_competitors', 'opportunities', 'competitive_advantages']
        for field in competitor_lists:
            if field in competitor_analysis and isinstance(competitor_analysis[field], list):
                cleaned_list = [item.strip() for item in competitor_analysis[field] if item.strip()]
                cleaned_analysis[field] = cleaned_list[:10]  # Limit to top 10
        
        # Clean other fields
        other_fields = ['market_positioning', 'competitive_landscape', 'market_share']
        for field in other_fields:
            if field in competitor_analysis:
                cleaned_analysis[field] = competitor_analysis[field]
        
        logger.info(f"Cleaned competitor analysis: {len(competitor_analysis)} fields → {len(cleaned_analysis)} fields")
        return cleaned_analysis
    
    def filter_content_gaps(self, content_gaps: List[str], research_data: BlogResearchResponse) -> List[str]:
        """
        Filter content gaps to keep only actionable, high-value ones.
        
        Args:
            content_gaps: List of identified content gaps
            research_data: Research data for context
            
        Returns:
            Filtered list of actionable content gaps
        """
        if not content_gaps:
            return []
        
        filtered_gaps = []
        
        for gap in content_gaps:
            # Quality filters
            if not self._is_gap_high_quality(gap):
                continue
            
            # Relevance filters
            if not self._is_gap_relevant_to_topic(gap, research_data):
                continue
            
            # Actionability filters
            if not self._is_gap_actionable(gap):
                continue
            
            filtered_gaps.append(gap)
        
        # Limit to max_content_gaps
        filtered_gaps = filtered_gaps[:self.max_content_gaps]
        
        logger.info(f"Filtered content gaps: {len(content_gaps)} → {len(filtered_gaps)}")
        return filtered_gaps
    
    # Private helper methods
    
    def _is_source_high_quality(self, source: ResearchSource) -> bool:
        """Check if source meets quality criteria."""
        # Credibility score check
        if source.credibility_score and source.credibility_score < self.min_credibility_score:
            return False
        
        # Excerpt length check
        if source.excerpt and len(source.excerpt) < self.min_excerpt_length:
            return False
        
        # Title quality check
        if not source.title or len(source.title.strip()) < 10:
            return False
        
        return True
    
    def _is_source_relevant(self, source: ResearchSource) -> bool:
        """Check if source is relevant (not irrelevant patterns)."""
        if not source.url:
            return True  # Keep sources without URLs
        
        # Check against irrelevant patterns
        for pattern in self.irrelevant_patterns:
            if re.search(pattern, source.url, re.IGNORECASE):
                return False
        
        return True
    
    def _is_source_recent(self, source: ResearchSource) -> bool:
        """Check if source is recent enough."""
        if not source.published_at:
            return True  # Keep sources without dates
        
        try:
            # Parse date (assuming ISO format or common formats)
            published_date = self._parse_date(source.published_at)
            if published_date:
                cutoff_date = datetime.now() - timedelta(days=self.max_source_age_days)
                return published_date >= cutoff_date
        except Exception as e:
            logger.warning(f"Error parsing date '{source.published_at}': {e}")
        
        return True  # Keep sources with unparseable dates
    
    def _is_citation_relevant(self, citation: Citation) -> bool:
        """Check if citation is relevant and high-quality."""
        # Check citation type
        relevant_types = ['expert_opinion', 'statistical_data', 'recent_news', 'research_study']
        if citation.citation_type not in relevant_types:
            return False
        
        # Check text quality
        if not citation.text or len(citation.text.strip()) < 20:
            return False
        
        return True
    
    def _is_gap_high_quality(self, gap: str) -> bool:
        """Check if content gap is high quality."""
        gap = gap.strip()
        
        # Length check
        if len(gap) < 10:
            return False
        
        # Generic gap check
        generic_gaps = ['general', 'overview', 'introduction', 'basics', 'fundamentals']
        if gap.lower() in generic_gaps:
            return False
        
        # Check for meaningful content
        if len(gap.split()) < 3:
            return False
        
        return True
    
    def _is_gap_relevant_to_topic(self, gap: str, research_data: BlogResearchResponse) -> bool:
        """Check if content gap is relevant to the research topic."""
        # Simple relevance check - could be enhanced with more sophisticated matching
        primary_keywords = research_data.keyword_analysis.get('primary', [])
        
        if not primary_keywords:
            return True  # Keep gaps if no keywords available
        
        gap_lower = gap.lower()
        for keyword in primary_keywords:
            if keyword.lower() in gap_lower:
                return True
        
        # If no direct keyword match, check for common AI-related terms
        ai_terms = ['ai', 'artificial intelligence', 'machine learning', 'automation', 'technology', 'digital']
        for term in ai_terms:
            if term in gap_lower:
                return True
        
        return True  # Default to keeping gaps if no clear relevance check
    
    def _is_gap_actionable(self, gap: str) -> bool:
        """Check if content gap is actionable (can be addressed with content)."""
        gap_lower = gap.lower()
        
        # Check for actionable indicators
        actionable_indicators = [
            'how to', 'guide', 'tutorial', 'steps', 'process', 'method',
            'best practices', 'tips', 'strategies', 'techniques', 'approach',
            'comparison', 'vs', 'versus', 'difference', 'pros and cons',
            'trends', 'future', str(datetime.now().year), str(datetime.now().year + 1), 'emerging', 'new'
        ]
        
        for indicator in actionable_indicators:
            if indicator in gap_lower:
                return True
        
        return True  # Default to actionable if no specific indicators
    
    def _clean_keyword_list(self, keywords: List[str]) -> List[str]:
        """Clean and deduplicate a list of keywords."""
        cleaned_keywords = []
        seen_keywords = set()
        
        for keyword in keywords:
            if not keyword or not isinstance(keyword, str):
                continue
            
            # Clean keyword
            cleaned_keyword = keyword.strip().lower()
            
            # Skip empty or too short keywords
            if len(cleaned_keyword) < 2:
                continue
            
            # Skip stop words
            if cleaned_keyword in self.stop_words:
                continue
            
            # Skip duplicates
            if cleaned_keyword in seen_keywords:
                continue
            
            cleaned_keywords.append(cleaned_keyword)
            seen_keywords.add(cleaned_keyword)
        
        return cleaned_keywords
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string into datetime object."""
        if not date_str:
            return None
        
        # Common date formats
        date_formats = [
            '%Y-%m-%d',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%B %d, %Y',
            '%b %d, %Y',
            '%d %B %Y',
            '%d %b %Y',
            '%m/%d/%Y',
            '%d/%m/%Y'
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        return None
    
    def _log_filtering_results(self, original_counts: Dict[str, int], filtered_research: BlogResearchResponse):
        """Log the results of filtering operations."""
        filtered_counts = {
            'sources': len(filtered_research.sources),
            'grounding_chunks': len(filtered_research.grounding_metadata.grounding_chunks) if filtered_research.grounding_metadata else 0,
            'grounding_supports': len(filtered_research.grounding_metadata.grounding_supports) if filtered_research.grounding_metadata else 0,
            'citations': len(filtered_research.grounding_metadata.citations) if filtered_research.grounding_metadata else 0,
        }
        
        logger.info("📊 Research Data Filtering Results:")
        for key, original_count in original_counts.items():
            filtered_count = filtered_counts[key]
            reduction_percent = ((original_count - filtered_count) / original_count * 100) if original_count > 0 else 0
            logger.info(f"  {key}: {original_count} → {filtered_count} ({reduction_percent:.1f}% reduction)")
        
        # Log content gaps filtering
        original_gaps = len(filtered_research.keyword_analysis.get('content_gaps', []))
        logger.info(f"  content_gaps: {original_gaps} → {len(filtered_research.keyword_analysis.get('content_gaps', []))}")
        
        logger.info("✅ Research data filtering completed successfully")

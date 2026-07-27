"""
Grounding Context Engine - Enhanced utilization of grounding metadata.

This module extracts and utilizes rich contextual information from Google Search
grounding metadata to enhance outline generation with authoritative insights,
temporal relevance, and content relationships.
"""

from typing import Dict, Any, List, Tuple, Optional
from collections import Counter, defaultdict
from datetime import datetime, timedelta
import re
from loguru import logger

from models.blog_models import (
    GroundingMetadata,
    GroundingChunk,
    GroundingSupport,
    Citation,
    BlogOutlineSection,
    ResearchSource,
)


class GroundingContextEngine:
    """Extract and utilize rich context from grounding metadata."""
    
    def __init__(self):
        """Initialize the grounding context engine."""
        self.min_confidence_threshold = 0.7
        self.high_confidence_threshold = 0.9
        self.max_contextual_insights = 10
        self.max_authority_sources = 5
        
        # Authority indicators for source scoring
        self.authority_indicators = {
            'high_authority': ['research', 'study', 'analysis', 'report', 'journal', 'academic', 'university', 'institute'],
            'medium_authority': ['guide', 'tutorial', 'best practices', 'expert', 'professional', 'industry'],
            'low_authority': ['blog', 'opinion', 'personal', 'review', 'commentary']
        }
        
        # Temporal relevance patterns
        cy = str(datetime.now().year)
        ny = str(datetime.now().year + 1)
        self.temporal_patterns = {
            'recent': [cy, ny, 'latest', 'new', 'recent', 'current', 'updated'],
            'trending': ['trend', 'emerging', 'growing', 'increasing', 'rising'],
            'evergreen': ['fundamental', 'basic', 'principles', 'foundation', 'core']
        }
        
        logger.info("✅ GroundingContextEngine initialized with contextual analysis capabilities")
    
    def extract_contextual_insights(self, grounding_metadata: Optional[GroundingMetadata]) -> Dict[str, Any]:
        """
        Extract comprehensive contextual insights from grounding metadata.
        
        Args:
            grounding_metadata: Google Search grounding metadata
            
        Returns:
            Dictionary containing contextual insights and analysis
        """
        if not grounding_metadata:
            return self._get_empty_insights()
        
        logger.info("Extracting contextual insights from grounding metadata...")
        
        insights = {
            'confidence_analysis': self._analyze_confidence_patterns(grounding_metadata),
            'authority_analysis': self._analyze_source_authority(grounding_metadata),
            'temporal_analysis': self._analyze_temporal_relevance(grounding_metadata),
            'content_relationships': self._analyze_content_relationships(grounding_metadata),
            'citation_insights': self._analyze_citation_patterns(grounding_metadata),
            'search_intent_insights': self._analyze_search_intent(grounding_metadata),
            'quality_indicators': self._assess_quality_indicators(grounding_metadata)
        }
        
        logger.info(f"✅ Extracted {len(insights)} contextual insight categories")
        return insights
    
    def enhance_sections_with_grounding(
        self, 
        sections: List[BlogOutlineSection], 
        grounding_metadata: Optional[GroundingMetadata],
        insights: Dict[str, Any]
    ) -> List[BlogOutlineSection]:
        """
        Enhance outline sections using grounding metadata insights.
        
        Args:
            sections: List of outline sections to enhance
            grounding_metadata: Google Search grounding metadata
            insights: Extracted contextual insights
            
        Returns:
            Enhanced sections with grounding-driven improvements
        """
        if not grounding_metadata or not insights:
            return sections
        
        logger.info(f"Enhancing {len(sections)} sections with grounding insights...")
        
        enhanced_sections = []
        for section in sections:
            enhanced_section = self._enhance_single_section(section, grounding_metadata, insights)
            enhanced_sections.append(enhanced_section)
        
        logger.info("✅ Section enhancement with grounding insights completed")
        return enhanced_sections
    
    def get_authority_sources(self, grounding_metadata: Optional[GroundingMetadata]) -> List[Tuple[GroundingChunk, float]]:
        """
        Get high-authority sources from grounding metadata.
        
        Args:
            grounding_metadata: Google Search grounding metadata
            
        Returns:
            List of (chunk, authority_score) tuples sorted by authority
        """
        if not grounding_metadata:
            return []
        
        authority_sources = []
        for chunk in grounding_metadata.grounding_chunks:
            authority_score = self._calculate_chunk_authority(chunk)
            if authority_score >= 0.6:  # Only include sources with reasonable authority
                authority_sources.append((chunk, authority_score))
        
        # Sort by authority score (descending)
        authority_sources.sort(key=lambda x: x[1], reverse=True)
        
        return authority_sources[:self.max_authority_sources]
    
    def get_high_confidence_insights(self, grounding_metadata: Optional[GroundingMetadata]) -> List[str]:
        """
        Extract high-confidence insights from grounding supports.
        
        Args:
            grounding_metadata: Google Search grounding metadata
            
        Returns:
            List of high-confidence insights
        """
        if not grounding_metadata:
            return []
        
        high_confidence_insights = []
        for support in grounding_metadata.grounding_supports:
            if support.confidence_scores and max(support.confidence_scores) >= self.high_confidence_threshold:
                # Extract meaningful insights from segment text
                insight = self._extract_insight_from_segment(support.segment_text)
                if insight:
                    high_confidence_insights.append(insight)
        
        return high_confidence_insights[:self.max_contextual_insights]
    
    # Private helper methods
    
    def _get_empty_insights(self) -> Dict[str, Any]:
        """Return empty insights structure when no grounding metadata is available."""
        return {
            'confidence_analysis': {
                'average_confidence': 0.0, 
                'high_confidence_sources_count': 0,
                'confidence_distribution': {'high': 0, 'medium': 0, 'low': 0}
            },
            'authority_analysis': {
                'average_authority_score': 0.0,
                'high_authority_sources': [],
                'authority_distribution': {'high': 0, 'medium': 0, 'low': 0}
            },
            'temporal_analysis': {
                'recent_content': 0, 
                'trending_topics': [], 
                'evergreen_content': 0
            },
            'content_relationships': {
                'related_concepts': [], 
                'content_gaps': [],
                'concept_coverage_score': 0.0
            },
            'citation_insights': {
                'citation_types': {}, 
                'citation_density': 0.0
            },
            'search_intent_insights': {
                'primary_intent': 'informational',
                'intent_signals': [], 
                'user_questions': []
            },
            'quality_indicators': {
                'overall_quality': 0.0, 
                'quality_factors': []
            }
        }
    
    def _analyze_confidence_patterns(self, grounding_metadata: GroundingMetadata) -> Dict[str, Any]:
        """Analyze confidence patterns across grounding data."""
        all_confidences = []
        
        # Collect confidence scores from chunks
        for chunk in grounding_metadata.grounding_chunks:
            if chunk.confidence_score:
                all_confidences.append(chunk.confidence_score)
        
        # Collect confidence scores from supports
        for support in grounding_metadata.grounding_supports:
            all_confidences.extend(support.confidence_scores)
        
        if not all_confidences:
            return {
                'average_confidence': 0.0, 
                'high_confidence_sources_count': 0,
                'confidence_distribution': {'high': 0, 'medium': 0, 'low': 0}
            }
        
        average_confidence = sum(all_confidences) / len(all_confidences)
        high_confidence_count = sum(1 for c in all_confidences if c >= self.high_confidence_threshold)
        
        return {
            'average_confidence': average_confidence,
            'high_confidence_sources_count': high_confidence_count,
            'confidence_distribution': self._get_confidence_distribution(all_confidences)
        }
    
    def _analyze_source_authority(self, grounding_metadata: GroundingMetadata) -> Dict[str, Any]:
        """Analyze source authority patterns."""
        authority_scores = []
        authority_distribution = defaultdict(int)
        
        for chunk in grounding_metadata.grounding_chunks:
            authority_score = self._calculate_chunk_authority(chunk)
            authority_scores.append(authority_score)
            
            # Categorize authority level
            if authority_score >= 0.8:
                authority_distribution['high'] += 1
            elif authority_score >= 0.6:
                authority_distribution['medium'] += 1
            else:
                authority_distribution['low'] += 1
        
        # Extract actual high-authority sources from chunks
        high_authority_sources = []
        for chunk in grounding_metadata.grounding_chunks:
            chunk_authority = self._calculate_chunk_authority(chunk)
            if chunk_authority >= 0.8:
                high_authority_sources.append({
                    'title': chunk.title if chunk.title else 'Unknown Source',
                    'url': chunk.url if chunk.url else '',
                    'score': round(chunk_authority, 3)
                })
        # Sort by authority score descending, keep top 5
        high_authority_sources.sort(key=lambda x: x['score'], reverse=True)
        high_authority_sources = high_authority_sources[:5]

        return {
            'average_authority_score': sum(authority_scores) / len(authority_scores) if authority_scores else 0.0,
            'high_authority_sources': high_authority_sources,
            'authority_distribution': dict(authority_distribution)
        }
    
    def _analyze_temporal_relevance(self, grounding_metadata: GroundingMetadata) -> Dict[str, Any]:
        """Analyze temporal relevance of grounding content."""
        recent_content = 0
        trending_topics = []
        evergreen_content = 0
        
        for chunk in grounding_metadata.grounding_chunks:
            chunk_text = f"{chunk.title} {chunk.url}".lower()
            
            # Check for recent indicators
            if any(pattern in chunk_text for pattern in self.temporal_patterns['recent']):
                recent_content += 1
            
            # Check for trending indicators
            if any(pattern in chunk_text for pattern in self.temporal_patterns['trending']):
                trending_topics.append(chunk.title)
            
            # Check for evergreen indicators
            if any(pattern in chunk_text for pattern in self.temporal_patterns['evergreen']):
                evergreen_content += 1
        
        return {
            'recent_content': recent_content,
            'trending_topics': trending_topics[:5],  # Limit to top 5
            'evergreen_content': evergreen_content,
            'temporal_balance': self._calculate_temporal_balance(recent_content, evergreen_content)
        }
    
    def _analyze_content_relationships(self, grounding_metadata: GroundingMetadata) -> Dict[str, Any]:
        """Analyze content relationships and identify gaps."""
        all_text = []
        
        # Collect text from chunks
        for chunk in grounding_metadata.grounding_chunks:
            all_text.append(chunk.title)
        
        # Collect text from supports
        for support in grounding_metadata.grounding_supports:
            all_text.append(support.segment_text)
        
        # Extract related concepts
        related_concepts = self._extract_related_concepts(all_text)
        
        # Identify potential content gaps
        content_gaps = self._identify_content_gaps(all_text)
        
        # Calculate concept coverage score (0-1 scale)
        concept_coverage_score = min(1.0, len(related_concepts) / 10.0) if related_concepts else 0.0
        
        return {
            'related_concepts': related_concepts,
            'content_gaps': content_gaps,
            'concept_coverage_score': concept_coverage_score,
            'gap_count': len(content_gaps)
        }
    
    def _analyze_citation_patterns(self, grounding_metadata: GroundingMetadata) -> Dict[str, Any]:
        """Analyze citation patterns and types."""
        citation_types = Counter()
        total_citations = len(grounding_metadata.citations)
        
        for citation in grounding_metadata.citations:
            citation_types[citation.citation_type] += 1
        
        # Calculate citation density (citations per 1000 words of content)
        total_content_length = sum(len(support.segment_text) for support in grounding_metadata.grounding_supports)
        citation_density = (total_citations / max(total_content_length, 1)) * 1000 if total_content_length > 0 else 0.0
        
        return {
            'citation_types': dict(citation_types),
            'total_citations': total_citations,
            'citation_density': citation_density,
            'citation_quality': self._assess_citation_quality(grounding_metadata.citations)
        }
    
    def _analyze_search_intent(self, grounding_metadata: GroundingMetadata) -> Dict[str, Any]:
        """Analyze search intent signals from grounding data."""
        intent_signals = []
        user_questions = []
        
        # Analyze search queries
        for query in grounding_metadata.web_search_queries:
            query_lower = query.lower()
            
            # Identify intent signals
            if any(word in query_lower for word in ['how', 'what', 'why', 'when', 'where']):
                intent_signals.append('informational')
            elif any(word in query_lower for word in ['best', 'top', 'compare', 'vs']):
                intent_signals.append('comparison')
            elif any(word in query_lower for word in ['buy', 'price', 'cost', 'deal']):
                intent_signals.append('transactional')
            
            # Extract potential user questions
            if query_lower.startswith(('how to', 'what is', 'why does', 'when should')):
                user_questions.append(query)
        
        return {
            'intent_signals': list(set(intent_signals)),
            'user_questions': user_questions[:5],  # Limit to top 5
            'primary_intent': self._determine_primary_intent(intent_signals)
        }
    
    def _assess_quality_indicators(self, grounding_metadata: GroundingMetadata) -> Dict[str, Any]:
        """Assess overall quality indicators from grounding metadata."""
        quality_factors = []
        quality_score = 0.0
        
        # Factor 1: Confidence levels
        confidences = [chunk.confidence_score for chunk in grounding_metadata.grounding_chunks if chunk.confidence_score]
        if confidences:
            avg_confidence = sum(confidences) / len(confidences)
            quality_score += avg_confidence * 0.3
            quality_factors.append(f"Average confidence: {avg_confidence:.2f}")
        
        # Factor 2: Source diversity
        unique_domains = set()
        for chunk in grounding_metadata.grounding_chunks:
            try:
                domain = chunk.url.split('/')[2] if '://' in chunk.url else chunk.url.split('/')[0]
                unique_domains.add(domain)
            except (ValueError, IndexError):
                continue
        
        diversity_score = min(len(unique_domains) / 5.0, 1.0)  # Normalize to 0-1
        quality_score += diversity_score * 0.2
        quality_factors.append(f"Source diversity: {len(unique_domains)} unique domains")
        
        # Factor 3: Content depth
        total_content_length = sum(len(support.segment_text) for support in grounding_metadata.grounding_supports)
        depth_score = min(total_content_length / 5000.0, 1.0)  # Normalize to 0-1
        quality_score += depth_score * 0.2
        quality_factors.append(f"Content depth: {total_content_length} characters")
        
        # Factor 4: Citation quality
        citation_quality = self._assess_citation_quality(grounding_metadata.citations)
        quality_score += citation_quality * 0.3
        quality_factors.append(f"Citation quality: {citation_quality:.2f}")
        
        return {
            'overall_quality': min(quality_score, 1.0),
            'quality_factors': quality_factors,
            'quality_grade': self._get_quality_grade(quality_score)
        }
    
    def _enhance_single_section(
        self, 
        section: BlogOutlineSection, 
        grounding_metadata: GroundingMetadata,
        insights: Dict[str, Any]
    ) -> BlogOutlineSection:
        """Enhance a single section using grounding insights."""
        # Extract relevant grounding data for this section
        relevant_chunks = self._find_relevant_chunks(section, grounding_metadata)
        relevant_supports = self._find_relevant_supports(section, grounding_metadata)
        
        # Enhance subheadings with high-confidence insights
        enhanced_subheadings = self._enhance_subheadings(section, relevant_supports, insights)
        
        # Enhance key points with authoritative insights
        enhanced_key_points = self._enhance_key_points(section, relevant_chunks, insights)
        
        # Enhance keywords with related concepts
        enhanced_keywords = self._enhance_keywords(section, insights)
        
        return BlogOutlineSection(
            id=section.id,
            heading=section.heading,
            subheadings=enhanced_subheadings,
            key_points=enhanced_key_points,
            references=section.references,
            target_words=section.target_words,
            keywords=enhanced_keywords
        )
    
    def _calculate_chunk_authority(self, chunk: GroundingChunk) -> float:
        """Calculate authority score for a grounding chunk."""
        authority_score = 0.5  # Base score
        
        chunk_text = f"{chunk.title} {chunk.url}".lower()
        
        # Check for authority indicators
        for level, indicators in self.authority_indicators.items():
            for indicator in indicators:
                if indicator in chunk_text:
                    if level == 'high_authority':
                        authority_score += 0.3
                    elif level == 'medium_authority':
                        authority_score += 0.2
                    else:  # low_authority
                        authority_score -= 0.1
        
        # Boost score based on confidence
        if chunk.confidence_score:
            authority_score += chunk.confidence_score * 0.2
        
        return min(max(authority_score, 0.0), 1.0)
    
    def _extract_insight_from_segment(self, segment_text: str) -> Optional[str]:
        """Extract meaningful insight from segment text."""
        if not segment_text or len(segment_text.strip()) < 20:
            return None
        
        # Clean and truncate insight
        insight = segment_text.strip()
        if len(insight) > 200:
            insight = insight[:200] + "..."
        
        return insight
    
    def _get_confidence_distribution(self, confidences: List[float]) -> Dict[str, int]:
        """Get distribution of confidence scores."""
        distribution = {'high': 0, 'medium': 0, 'low': 0}
        
        for confidence in confidences:
            if confidence >= 0.8:
                distribution['high'] += 1
            elif confidence >= 0.6:
                distribution['medium'] += 1
            else:
                distribution['low'] += 1
        
        return distribution
    
    def _calculate_temporal_balance(self, recent: int, evergreen: int) -> str:
        """Calculate temporal balance of content."""
        total = recent + evergreen
        if total == 0:
            return 'unknown'
        
        recent_ratio = recent / total
        if recent_ratio > 0.7:
            return 'recent_heavy'
        elif recent_ratio < 0.3:
            return 'evergreen_heavy'
        else:
            return 'balanced'
    
    def _extract_related_concepts(self, text_list: List[str]) -> List[str]:
        """Extract related concepts from text."""
        # Simple concept extraction - could be enhanced with NLP
        concepts = set()
        
        for text in text_list:
            # Extract capitalized words (potential concepts)
            words = re.findall(r'\b[A-Z][a-z]+\b', text)
            concepts.update(words)
        
        return list(concepts)[:10]  # Limit to top 10
    
    def _identify_content_gaps(self, text_list: List[str]) -> List[str]:
        """Identify potential content gaps."""
        # Simple gap identification - could be enhanced with more sophisticated analysis
        gaps = []
        
        # Look for common gap indicators
        gap_indicators = ['missing', 'lack of', 'not covered', 'gap', 'unclear', 'unexplained']
        
        for text in text_list:
            text_lower = text.lower()
            for indicator in gap_indicators:
                if indicator in text_lower:
                    # Extract potential gap
                    gap = self._extract_gap_from_text(text, indicator)
                    if gap:
                        gaps.append(gap)
        
        return gaps[:5]  # Limit to top 5
    
    def _extract_gap_from_text(self, text: str, indicator: str) -> Optional[str]:
        """Extract content gap from text containing gap indicator."""
        # Simple extraction - could be enhanced
        sentences = text.split('.')
        for sentence in sentences:
            if indicator in sentence.lower():
                return sentence.strip()
        return None
    
    def _assess_citation_quality(self, citations: List[Citation]) -> float:
        """Assess quality of citations."""
        if not citations:
            return 0.0
        
        quality_score = 0.0
        
        for citation in citations:
            # Check citation type
            if citation.citation_type in ['expert_opinion', 'statistical_data', 'research_study']:
                quality_score += 0.3
            elif citation.citation_type in ['recent_news', 'case_study']:
                quality_score += 0.2
            else:
                quality_score += 0.1
            
            # Check text quality
            if len(citation.text) > 20:
                quality_score += 0.1
        
        return min(quality_score / len(citations), 1.0)
    
    def _determine_primary_intent(self, intent_signals: List[str]) -> str:
        """Determine primary search intent from signals."""
        if not intent_signals:
            return 'informational'
        
        intent_counts = Counter(intent_signals)
        return intent_counts.most_common(1)[0][0]
    
    def _get_quality_grade(self, quality_score: float) -> str:
        """Get quality grade from score."""
        if quality_score >= 0.9:
            return 'A'
        elif quality_score >= 0.8:
            return 'B'
        elif quality_score >= 0.7:
            return 'C'
        elif quality_score >= 0.6:
            return 'D'
        else:
            return 'F'
    
    def _find_relevant_chunks(self, section: BlogOutlineSection, grounding_metadata: GroundingMetadata) -> List[GroundingChunk]:
        """Find grounding chunks relevant to the section."""
        relevant_chunks = []
        section_text = f"{section.heading} {' '.join(section.subheadings)} {' '.join(section.key_points)}".lower()
        
        for chunk in grounding_metadata.grounding_chunks:
            chunk_text = chunk.title.lower()
            # Simple relevance check - could be enhanced with semantic similarity
            if any(word in chunk_text for word in section_text.split() if len(word) > 3):
                relevant_chunks.append(chunk)
        
        return relevant_chunks
    
    def _find_relevant_supports(self, section: BlogOutlineSection, grounding_metadata: GroundingMetadata) -> List[GroundingSupport]:
        """Find grounding supports relevant to the section."""
        relevant_supports = []
        section_text = f"{section.heading} {' '.join(section.subheadings)} {' '.join(section.key_points)}".lower()
        
        for support in grounding_metadata.grounding_supports:
            support_text = support.segment_text.lower()
            # Simple relevance check
            if any(word in support_text for word in section_text.split() if len(word) > 3):
                relevant_supports.append(support)
        
        return relevant_supports
    
    def _enhance_subheadings(self, section: BlogOutlineSection, relevant_supports: List[GroundingSupport], insights: Dict[str, Any]) -> List[str]:
        """Enhance subheadings with grounding insights."""
        enhanced_subheadings = list(section.subheadings)
        
        # Add high-confidence insights as subheadings
        high_confidence_insights = self._get_high_confidence_insights_from_supports(relevant_supports)
        for insight in high_confidence_insights[:2]:  # Add up to 2 new subheadings
            if insight not in enhanced_subheadings:
                enhanced_subheadings.append(insight)
        
        return enhanced_subheadings
    
    def _enhance_key_points(self, section: BlogOutlineSection, relevant_chunks: List[GroundingChunk], insights: Dict[str, Any]) -> List[str]:
        """Enhance key points with authoritative insights."""
        enhanced_key_points = list(section.key_points)
        
        # Add insights from high-authority chunks
        for chunk in relevant_chunks:
            if chunk.confidence_score and chunk.confidence_score >= self.high_confidence_threshold:
                insight = f"Based on {chunk.title}: {self._extract_key_insight(chunk)}"
                if insight not in enhanced_key_points:
                    enhanced_key_points.append(insight)
        
        return enhanced_key_points
    
    def _enhance_keywords(self, section: BlogOutlineSection, insights: Dict[str, Any]) -> List[str]:
        """Enhance keywords with related concepts from grounding."""
        enhanced_keywords = list(section.keywords)
        
        # Add related concepts from grounding analysis
        related_concepts = insights.get('content_relationships', {}).get('related_concepts', [])
        for concept in related_concepts[:3]:  # Add up to 3 new keywords
            if concept.lower() not in [kw.lower() for kw in enhanced_keywords]:
                enhanced_keywords.append(concept)
        
        return enhanced_keywords
    
    def _get_high_confidence_insights_from_supports(self, supports: List[GroundingSupport]) -> List[str]:
        """Get high-confidence insights from grounding supports."""
        insights = []
        for support in supports:
            if support.confidence_scores and max(support.confidence_scores) >= self.high_confidence_threshold:
                insight = self._extract_insight_from_segment(support.segment_text)
                if insight:
                    insights.append(insight)
        return insights
    
    def _extract_key_insight(self, chunk: GroundingChunk) -> str:
        """Extract key insight from grounding chunk."""
        # Simple extraction - could be enhanced
        return f"High-confidence source with {chunk.confidence_score:.2f} confidence score"

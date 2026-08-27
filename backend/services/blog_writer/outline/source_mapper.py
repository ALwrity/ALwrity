"""
Source-to-Section Mapper - Intelligent mapping of research sources to outline sections.

This module provides algorithmic mapping of research sources to specific outline sections
based on semantic similarity, keyword relevance, and contextual matching. Uses a hybrid
approach of algorithmic scoring followed by AI validation for optimal results.
"""

from typing import Dict, Any, List, Tuple, Optional
import re
from collections import Counter
from loguru import logger

from models.blog_models import (
    BlogOutlineSection,
    ResearchSource,
    BlogResearchResponse,
)


class SourceToSectionMapper:
    """Maps research sources to outline sections using intelligent algorithms."""
    
    def __init__(self):
        """Initialize the source-to-section mapper."""
        self.min_semantic_score = 0.3
        self.min_keyword_score = 0.2
        self.min_contextual_score = 0.2
        self.max_sources_per_section = 3
        self.min_total_score = 0.4
        
        # Weight factors for different scoring methods
        self.weights = {
            'semantic': 0.4,      # Semantic similarity weight
            'keyword': 0.3,       # Keyword matching weight
            'contextual': 0.3     # Contextual relevance weight
        }
        
        # Common stop words for text processing
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
            'how', 'what', 'when', 'where', 'why', 'who', 'which', 'much', 'many', 'more', 'most',
            'some', 'any', 'all', 'each', 'every', 'other', 'another', 'such', 'no', 'not', 'only', 'own',
            'same', 'so', 'than', 'too', 'very', 'just', 'now', 'here', 'there', 'up', 'down', 'out', 'off',
            'over', 'under', 'again', 'further', 'then', 'once', 'also', 'into', 'about', 'between',
            'through', 'during', 'before', 'after', 'above', 'below', 'from', 'since', 'until', 'while',
            'because', 'however', 'therefore', 'thus', 'hence', 'yet', 'still', 'already', 'even'
        }
        
        # Common abbreviation/synonym pairs for fuzzy matching
        self._synonym_map = {
            'ai': ['artificial intelligence', 'machine intelligence'],
            'ml': ['machine learning'],
            'dl': ['deep learning'],
            'nlp': ['natural language processing'],
            'iot': ['internet of things'],
            'saas': ['software as a service'],
            'b2b': ['business to business'],
            'b2c': ['business to consumer'],
            'cx': ['customer experience'],
            'ux': ['user experience'],
            'roi': ['return on investment'],
            'kpi': ['key performance indicator'],
            'crm': ['customer relationship management'],
            'erp': ['enterprise resource planning'],
            'seo': ['search engine optimization'],
            'cto': ['chief technology officer'],
            'vp': ['vice president'],
        }
        
        logger.debug("✅ SourceToSectionMapper initialized with intelligent mapping algorithms")
    
    def map_sources_to_sections(
        self, 
        sections: List[BlogOutlineSection], 
        research_data: BlogResearchResponse,
        user_id: str,
        competitive_advantage: str = ""
    ) -> List[BlogOutlineSection]:
        """
        Map research sources to outline sections using intelligent algorithms.
        
        Sections that already have LLM-assigned references (from source_indices
        in the outline prompt) are preserved. Algorithmic mapping fills gaps
        for sections without LLM-assigned sources.
        
        Args:
            sections: List of outline sections to map sources to
            research_data: Research data containing sources and metadata
            user_id: User ID (required for subscription checks and usage tracking)
            competitive_advantage: Selected competitive advantage to preferentially match
            
        Returns:
            List of outline sections with intelligently mapped sources
            
        Raises:
            ValueError: If user_id is not provided
        """
        if not user_id:
            raise ValueError("user_id is required for source mapping (subscription checks and usage tracking)")
        
        if not sections or not research_data.sources:
            logger.warning("No sections or sources to map")
            return sections
        
        # Separate sections with LLM-assigned references from those without
        sections_with_refs = [s for s in sections if s.references]
        sections_without_refs = [s for s in sections if not s.references]
        
        logger.info(
            f"Mapping {len(research_data.sources)} sources to {len(sections)} sections "
            f"({len(sections_with_refs)} with LLM-assigned references, "
            f"{len(sections_without_refs)} need algorithmic mapping)"
        )
        
        if sections_without_refs:
            # Step 1: Algorithmic mapping for sections without LLM-assigned references
            mapping_results = self._algorithmic_source_mapping(sections_without_refs, research_data, competitive_advantage)
            
            # Step 2: AI validation and improvement
            validated_mapping = self._ai_validate_mapping(mapping_results, research_data, user_id)
            
            # Step 3: Apply mapping only to sections that need it
            mapped_sections_with = self._apply_mapping_to_sections(sections_without_refs, validated_mapping)
        else:
            mapped_sections_with = []
        
        # Combine: keep LLM-assigned sections as-is, add algorithmically mapped ones
        mapped_sections = list(sections_with_refs) + mapped_sections_with
        
        # Preserve original ordering
        original_ids = [s.id for s in sections]
        mapped_sections.sort(key=lambda s: original_ids.index(s.id) if s.id in original_ids else 999)
        
        # Warn if any section still has zero references
        for s in mapped_sections:
            if not s.references:
                logger.warning(f"Section '{s.heading}' (id={s.id}) has ZERO sources — content generator will use keyword-based fallback")
        
        logger.info("✅ Source-to-section mapping completed successfully")
        return mapped_sections
    
    def _algorithmic_source_mapping(
        self, 
        sections: List[BlogOutlineSection], 
        research_data: BlogResearchResponse,
        competitive_advantage: str = ""
    ) -> Dict[str, List[Tuple[ResearchSource, float]]]:
        """
        Perform algorithmic mapping of sources to sections.
        
        Args:
            sections: List of outline sections
            research_data: Research data with sources
            competitive_advantage: Selected competitive advantage to boost matching
            
        Returns:
            Dictionary mapping section IDs to list of (source, score) tuples
        """
        mapping_results = {}
        
        for section in sections:
            section_scores = []
            
            for source in research_data.sources:
                # Calculate multi-dimensional relevance score
                semantic_score = self._calculate_semantic_similarity(section, source)
                keyword_score = self._calculate_keyword_relevance(section, source, research_data)
                contextual_score = self._calculate_contextual_relevance(section, source, research_data, competitive_advantage)
                
                # Weighted total score
                total_score = (
                    semantic_score * self.weights['semantic'] +
                    keyword_score * self.weights['keyword'] +
                    contextual_score * self.weights['contextual']
                )
                
                # Only include sources that meet minimum threshold
                if total_score >= self.min_total_score:
                    section_scores.append((source, total_score))
            
            # Sort by score and limit to max sources per section
            section_scores.sort(key=lambda x: x[1], reverse=True)
            section_scores = section_scores[:self.max_sources_per_section]
            
            mapping_results[section.id] = section_scores
            
            logger.debug(f"Section '{section.heading}': {len(section_scores)} sources mapped")
        
        return mapping_results
    
    def _calculate_semantic_similarity(self, section: BlogOutlineSection, source: ResearchSource) -> float:
        """
        Calculate semantic similarity between section and source.
        Uses word overlap, stem matching, bigram overlap, title-boost, and synonym expansion.
        """
        section_text = self._extract_section_text(section)
        source_text = self._extract_source_text(source)
        
        section_words = self._extract_meaningful_words(section_text)
        source_words = self._extract_meaningful_words(source_text)
        
        if not section_words or not source_words:
            return 0.0
        
        section_set = set(section_words)
        source_set = set(source_words)
        
        # 1. Jaccard similarity on raw words
        intersection = len(section_set & source_set)
        union = len(section_set | source_set)
        jaccard = intersection / union if union > 0 else 0.0
        
        # 2. Stem matching — catches word variants (e.g., "running" vs "runs")
        section_stems = set(self._stem_word(w) for w in section_words)
        source_stems = set(self._stem_word(w) for w in source_words)
        stem_intersection = len(section_stems & source_stems)
        stem_union = len(section_stems | source_stems)
        stem_similarity = stem_intersection / stem_union if stem_union > 0 else 0.0
        
        # 3. Bigram overlap — catches multi-word concepts (e.g., "machine learning")
        section_bigrams = set(self._extract_bigrams(section_text))
        source_bigrams = set(self._extract_bigrams(source_text))
        bigram_overlap = len(section_bigrams & source_bigrams)
        bigram_score = min(0.3, bigram_overlap * 0.1) if (section_bigrams or source_bigrams) else 0.0
        
        # 4. Title-boost — section heading matching source title is a strong signal
        heading = (section.heading or '').lower()
        source_title = (source.title or '').lower()
        heading_words = set(self._extract_meaningful_words(heading))
        title_words = set(self._extract_meaningful_words(source_title))
        title_overlap = len(heading_words & title_words) / len(heading_words | title_words) if (heading_words or title_words) else 0.0
        title_boost = min(0.3, title_overlap * 0.5)
        
        # 5. Synonym expansion — expand abbreviations and match across synonym pairs
        synonym_score = self._calculate_synonym_overlap(section_words, source_words)
        
        # Combine: Jaccard + stem give base, bigram + title + synonyms boost
        base_similarity = max(jaccard, stem_similarity)
        combined = min(1.0, base_similarity + bigram_score + title_boost + synonym_score + 0.0)
        
        return combined
    
    def _calculate_keyword_relevance(
        self, 
        section: BlogOutlineSection, 
        source: ResearchSource, 
        research_data: BlogResearchResponse
    ) -> float:
        """
        Calculate keyword-based relevance between section and source.
        
        Args:
            section: Outline section
            source: Research source
            research_data: Research data with keyword analysis
            
        Returns:
            Keyword relevance score (0.0 to 1.0)
        """
        # Get section keywords
        section_keywords = set(section.keywords)
        if not section_keywords:
            # Extract keywords from section heading and content
            section_text = self._extract_section_text(section)
            section_keywords = set(self._extract_meaningful_words(section_text))
        
        # Get source keywords from title and excerpt
        source_text = f"{source.title} {source.excerpt or ''}"
        source_keywords = set(self._extract_meaningful_words(source_text))
        
        # Get research keywords for context
        research_keywords = set()
        for category in ['primary', 'secondary', 'long_tail', 'semantic_keywords']:
            research_keywords.update(research_data.keyword_analysis.get(category, []))
        
        # Calculate keyword overlap scores
        section_overlap = len(section_keywords & source_keywords) / len(section_keywords) if section_keywords else 0.0
        research_overlap = len(research_keywords & source_keywords) / len(research_keywords) if research_keywords else 0.0
        
        # Weighted combination
        keyword_score = (section_overlap * 0.7) + (research_overlap * 0.3)
        
        return min(1.0, keyword_score)
    
    def _calculate_contextual_relevance(
        self, 
        section: BlogOutlineSection, 
        source: ResearchSource, 
        research_data: BlogResearchResponse,
        competitive_advantage: str = ""
    ) -> float:
        """
        Calculate contextual relevance based on section content and source context.
        
        Args:
            section: Outline section
            source: Research source
            research_data: Research data with context
            competitive_advantage: Selected competitive advantage to boost matching
            
        Returns:
            Contextual relevance score (0.0 to 1.0)
        """
        contextual_score = 0.0
        
        # 1. Content angle matching
        section_text = self._extract_section_text(section).lower()
        source_text = f"{source.title} {source.excerpt or ''}".lower()
        
        # Check for content angle matches
        content_angles = research_data.suggested_angles
        for angle in content_angles:
            angle_words = self._extract_meaningful_words(angle.lower())
            if angle_words:
                section_angle_match = sum(1 for word in angle_words if word in section_text) / len(angle_words)
                source_angle_match = sum(1 for word in angle_words if word in source_text) / len(angle_words)
                contextual_score += (section_angle_match + source_angle_match) * 0.3
        
        # 2. Search intent alignment
        search_intent = research_data.keyword_analysis.get('search_intent', 'informational')
        intent_keywords = self._get_intent_keywords(search_intent)
        
        intent_score = 0.0
        for keyword in intent_keywords:
            if keyword in section_text or keyword in source_text:
                intent_score += 0.1
        
        contextual_score += min(0.3, intent_score)
        
        # 3. Industry/domain relevance
        if hasattr(research_data, 'industry') and research_data.industry:
            industry_words = self._extract_meaningful_words(research_data.industry.lower())
            industry_score = sum(1 for word in industry_words if word in source_text) / len(industry_words) if industry_words else 0.0
            contextual_score += industry_score * 0.2
        
        # 4. Competitive advantage boost — sources that match the advantage get a score lift
        if competitive_advantage:
            advantage_words = set(self._extract_meaningful_words(competitive_advantage.lower()))
            if advantage_words:
                advantage_in_section = sum(1 for w in advantage_words if w in section_text) / len(advantage_words)
                advantage_in_source = sum(1 for w in advantage_words if w in source_text) / len(advantage_words)
                if advantage_in_section > 0.3 and advantage_in_source > 0.3:
                    contextual_score += 0.25 * (advantage_in_section + advantage_in_source)
        
        return min(1.0, contextual_score)
    
    def _ai_validate_mapping(
        self, 
        mapping_results: Dict[str, List[Tuple[ResearchSource, float]]], 
        research_data: BlogResearchResponse,
        user_id: str
    ) -> Dict[str, List[Tuple[ResearchSource, float]]]:
        """
        Use AI to validate and improve the algorithmic mapping results.
        
        Args:
            mapping_results: Algorithmic mapping results
            research_data: Research data for context
            user_id: User ID (required for subscription checks and usage tracking)
            
        Returns:
            AI-validated and improved mapping results
            
        Raises:
            ValueError: If user_id is not provided
        """
        if not user_id:
            raise ValueError("user_id is required for AI validation (subscription checks and usage tracking)")
        
        try:
            logger.info("Starting AI validation of source-to-section mapping...")
            
            # Build AI validation prompt
            validation_prompt = self._build_validation_prompt(mapping_results, research_data)
            
            # Get AI validation response (user_id required for subscription checks)
            validation_response = self._get_ai_validation_response(validation_prompt, user_id)
            
            # Parse and apply AI validation results
            validated_mapping = self._parse_validation_response(validation_response, mapping_results, research_data)
            
            logger.info("✅ AI validation completed successfully")
            return validated_mapping
            
        except Exception as e:
            logger.warning(f"AI validation failed: {e}. Using algorithmic results as fallback.")
            return mapping_results
    
    def _apply_mapping_to_sections(
        self, 
        sections: List[BlogOutlineSection], 
        mapping_results: Dict[str, List[Tuple[ResearchSource, float]]]
    ) -> List[BlogOutlineSection]:
        """
        Apply the mapping results to the outline sections.
        
        Args:
            sections: Original outline sections
            mapping_results: Mapping results from algorithmic/AI processing
            
        Returns:
            Sections with mapped sources
        """
        mapped_sections = []
        
        for section in sections:
            # Get mapped sources for this section
            mapped_sources = mapping_results.get(section.id, [])
            
            # Extract just the sources (without scores)
            section_sources = [source for source, score in mapped_sources]
            
            # Create new section with mapped sources
            mapped_section = BlogOutlineSection(
                id=section.id,
                heading=section.heading,
                subheadings=section.subheadings,
                key_points=section.key_points,
                references=section_sources,
                target_words=section.target_words,
                keywords=section.keywords
            )
            
            mapped_sections.append(mapped_section)
            
            logger.debug(f"Applied {len(section_sources)} sources to section '{section.heading}'")
        
        return mapped_sections
    
    # Helper methods
    
    def _extract_section_text(self, section: BlogOutlineSection) -> str:
        """Extract all text content from a section."""
        text_parts = [section.heading]
        text_parts.extend(section.subheadings)
        text_parts.extend(section.key_points)
        text_parts.extend(section.keywords)
        return " ".join(text_parts)
    
    def _extract_source_text(self, source: ResearchSource) -> str:
        """Extract all text content from a source, including full text for better matching."""
        text_parts = [source.title]
        if source.summary:
            text_parts.append(source.summary)
        if source.excerpt:
            text_parts.append(source.excerpt)
        content = getattr(source, 'content', '') or ''
        if content:
            text_parts.append(content[:500])
        return " ".join(text_parts)
    
    def _extract_meaningful_words(self, text: str) -> List[str]:
        """Extract meaningful words from text, removing stop words and cleaning."""
        if not text:
            return []
        
        # Clean and tokenize
        words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
        
        # Remove stop words and short words
        meaningful_words = [
            word for word in words 
            if word not in self.stop_words and len(word) > 2
        ]
        
        return meaningful_words
    
    def _stem_word(self, word: str) -> str:
        """Rudimentary suffix-stripping stemmer for English words."""
        if len(word) <= 3:
            return word
        for suffix in ['ization', 'ation', 'tion', 'sion', 'ment', 'ness', 'ity', 'ing', 'able', 'ible', 'ful', 'less', 'ous', 'ive', 'ally', 'ly', 'er', 'ed', 'es', 's']:
            if word.endswith(suffix) and len(word) - len(suffix) >= 3:
                return word[:-len(suffix)]
        return word
    
    def _extract_bigrams(self, text: str) -> List[str]:
        """Extract meaningful two-word phrases from text."""
        words = self._extract_meaningful_words(text)
        if len(words) < 2:
            return []
        return [f"{words[i]} {words[i+1]}" for i in range(len(words) - 1)]
    
    def _calculate_synonym_overlap(self, section_words: List[str], source_words: List[str]) -> float:
        """Score overlap via abbreviation/synonym expansion."""
        section_set = set(section_words)
        source_set = set(source_words)
        extra_matches = 0
        total_terms = len(section_set | source_set) or 1
        
        for abbr, expansions in self._synonym_map.items():
            abbr_in_section = abbr in section_set
            abbr_in_source = abbr in source_set
            for expansion in expansions:
                exp_words = set(expansion.split())
                exp_in_section = exp_words.issubset(section_set)
                exp_in_source = exp_words.issubset(source_set)
                if (abbr_in_section and exp_in_source) or (abbr_in_source and exp_in_section):
                    extra_matches += 1
        
        return min(0.2, extra_matches * 0.05)
    
    def _calculate_phrase_similarity(self, text1: str, text2: str) -> float:
        """Calculate phrase similarity boost score."""
        if not text1 or not text2:
            return 0.0
        
        text1_lower = text1.lower()
        text2_lower = text2.lower()
        
        # Look for 2-3 word phrases
        phrase_boost = 0.0
        
        # Extract 2-word phrases
        words1 = text1_lower.split()
        words2 = text2_lower.split()
        
        for i in range(len(words1) - 1):
            phrase = f"{words1[i]} {words1[i+1]}"
            if phrase in text2_lower:
                phrase_boost += 0.1
        
        # Extract 3-word phrases
        for i in range(len(words1) - 2):
            phrase = f"{words1[i]} {words1[i+1]} {words1[i+2]}"
            if phrase in text2_lower:
                phrase_boost += 0.15
        
        return min(0.3, phrase_boost)  # Cap at 0.3
    
    def _get_intent_keywords(self, search_intent: str) -> List[str]:
        """Get keywords associated with search intent."""
        intent_keywords = {
            'informational': ['what', 'how', 'why', 'guide', 'tutorial', 'explain', 'learn', 'understand'],
            'navigational': ['find', 'locate', 'search', 'where', 'site', 'website', 'page'],
            'transactional': ['buy', 'purchase', 'order', 'price', 'cost', 'deal', 'offer', 'discount'],
            'commercial': ['compare', 'review', 'best', 'top', 'vs', 'versus', 'alternative', 'option']
        }
        
        return intent_keywords.get(search_intent, [])
    
    def get_mapping_statistics(self, mapping_results: Dict[str, List[Tuple[ResearchSource, float]]]) -> Dict[str, Any]:
        """
        Get statistics about the mapping results.
        
        Args:
            mapping_results: Mapping results to analyze
            
        Returns:
            Dictionary with mapping statistics
        """
        total_sections = len(mapping_results)
        total_mappings = sum(len(sources) for sources in mapping_results.values())
        
        # Calculate score distribution
        all_scores = []
        for sources in mapping_results.values():
            all_scores.extend([score for source, score in sources])
        
        avg_score = sum(all_scores) / len(all_scores) if all_scores else 0.0
        max_score = max(all_scores) if all_scores else 0.0
        min_score = min(all_scores) if all_scores else 0.0
        
        # Count sections with/without sources
        sections_with_sources = sum(1 for sources in mapping_results.values() if sources)
        sections_without_sources = total_sections - sections_with_sources
        
        return {
            'total_sections': total_sections,
            'total_mappings': total_mappings,
            'sections_with_sources': sections_with_sources,
            'sections_without_sources': sections_without_sources,
            'average_score': avg_score,
            'max_score': max_score,
            'min_score': min_score,
            'mapping_coverage': sections_with_sources / total_sections if total_sections > 0 else 0.0
        }
    
    def _build_validation_prompt(
        self, 
        mapping_results: Dict[str, List[Tuple[ResearchSource, float]]], 
        research_data: BlogResearchResponse
    ) -> str:
        """
        Build comprehensive AI validation prompt for source-to-section mapping.
        
        Args:
            mapping_results: Algorithmic mapping results
            research_data: Research data for context
            
        Returns:
            Formatted AI validation prompt
        """
        # Extract section information
        sections_info = []
        for section_id, sources in mapping_results.items():
            section_info = {
                'id': section_id,
                'sources': [
                    {
                        'title': source.title,
                        'url': source.url,
                        'excerpt': source.excerpt,
                        'credibility_score': source.credibility_score,
                        'algorithmic_score': score
                    }
                    for source, score in sources
                ]
            }
            sections_info.append(section_info)
        
        # Extract research context
        research_context = {
            'primary_keywords': research_data.keyword_analysis.get('primary', []),
            'secondary_keywords': research_data.keyword_analysis.get('secondary', []),
            'content_angles': research_data.suggested_angles,
            'search_intent': research_data.keyword_analysis.get('search_intent', 'informational'),
            'all_sources': [
                {
                    'title': source.title,
                    'url': source.url,
                    'excerpt': source.excerpt,
                    'credibility_score': source.credibility_score
                }
                for source in research_data.sources
            ]
        }
        
        prompt = f"""
You are an expert content strategist and SEO specialist. Your task is to validate and improve the algorithmic mapping of research sources to blog outline sections.

## CONTEXT
Research Topic: {', '.join(research_context['primary_keywords'])}
Search Intent: {research_context['search_intent']}
Content Angles: {', '.join(research_context['content_angles'])}

## ALGORITHMIC MAPPING RESULTS
The following sections have been algorithmically mapped with research sources:

{self._format_sections_for_prompt(sections_info)}

## AVAILABLE SOURCES
All available research sources:
{self._format_sources_for_prompt(research_context['all_sources'])}

## VALIDATION TASK
Please analyze the algorithmic mapping and provide improvements:

1. **Validate Relevance**: Are the mapped sources truly relevant to each section's content and purpose?
2. **Identify Gaps**: Are there better sources available that weren't mapped?
3. **Suggest Improvements**: Recommend specific source changes for better content alignment
4. **Quality Assessment**: Rate the overall mapping quality (1-10)

## RESPONSE FORMAT
Provide your analysis in the following JSON format:

```json
{{
    "overall_quality_score": 8,
    "section_improvements": [
        {{
            "section_id": "s1",
            "current_sources": ["source_title_1", "source_title_2"],
            "recommended_sources": ["better_source_1", "better_source_2", "better_source_3"],
            "reasoning": "Explanation of why these sources are better suited for this section",
            "confidence": 0.9
        }}
    ],
    "summary": "Overall assessment of the mapping quality and key improvements made"
}}
```

## GUIDELINES
- Prioritize sources that directly support the section's key points and subheadings
- Consider source credibility, recency, and content depth
- Ensure sources provide actionable insights for content creation
- Maintain diversity in source types and perspectives
- Focus on sources that enhance the section's value proposition

Analyze the mapping and provide your recommendations.
"""
        
        return prompt
    
    def _get_ai_validation_response(self, prompt: str, user_id: str) -> str:
        """
        Get AI validation response using LLM provider.
        
        Args:
            prompt: Validation prompt
            user_id: User ID (required for subscription checks and usage tracking)
            
        Returns:
            AI validation response
            
        Raises:
            ValueError: If user_id is not provided
        """
        if not user_id:
            raise ValueError("user_id is required for AI validation response (subscription checks and usage tracking)")
        
        try:
            from services.llm_providers.main_text_generation import llm_text_gen
            
            response = llm_text_gen(
                prompt=prompt,
                json_struct=None,
                system_prompt=None,
                user_id=user_id
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Failed to get AI validation response: {e}")
            raise
    
    def _parse_validation_response(
        self, 
        response: str, 
        original_mapping: Dict[str, List[Tuple[ResearchSource, float]]], 
        research_data: BlogResearchResponse
    ) -> Dict[str, List[Tuple[ResearchSource, float]]]:
        """
        Parse AI validation response and apply improvements.
        
        Args:
            response: AI validation response
            original_mapping: Original algorithmic mapping
            research_data: Research data for context
            
        Returns:
            Improved mapping based on AI validation
        """
        try:
            import json
            import re
            
            # Extract JSON from response
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response, re.DOTALL)
            if not json_match:
                # Try to find JSON without code blocks
                json_match = re.search(r'(\{.*?\})', response, re.DOTALL)
            
            if not json_match:
                logger.warning("Could not extract JSON from AI response")
                return original_mapping
            
            validation_data = json.loads(json_match.group(1))
            
            # Create source lookup for quick access
            source_lookup = {source.title: source for source in research_data.sources}
            
            # Apply AI improvements
            improved_mapping = {}
            
            for improvement in validation_data.get('section_improvements', []):
                section_id = improvement['section_id']
                recommended_titles = improvement['recommended_sources']
                
                # Map recommended titles to actual sources
                recommended_sources = []
                for title in recommended_titles:
                    if title in source_lookup:
                        source = source_lookup[title]
                        # Use high confidence score for AI-recommended sources
                        recommended_sources.append((source, 0.9))
                
                if recommended_sources:
                    improved_mapping[section_id] = recommended_sources
                else:
                    # Fallback to original mapping if no valid sources found
                    improved_mapping[section_id] = original_mapping.get(section_id, [])
            
            # Add sections not mentioned in AI response
            for section_id, sources in original_mapping.items():
                if section_id not in improved_mapping:
                    improved_mapping[section_id] = sources
            
            logger.info(f"AI validation applied: {len(validation_data.get('section_improvements', []))} sections improved")
            return improved_mapping
            
        except Exception as e:
            logger.warning(f"Failed to parse AI validation response: {e}")
            return original_mapping
    
    def _format_sections_for_prompt(self, sections_info: List[Dict]) -> str:
        """Format sections information for AI prompt."""
        formatted = []
        for section in sections_info:
            section_text = f"**Section {section['id']}:**\n"
            section_text += f"Sources mapped: {len(section['sources'])}\n"
            for source in section['sources']:
                section_text += f"- {source['title']} (Score: {source['algorithmic_score']:.2f})\n"
            formatted.append(section_text)
        return "\n".join(formatted)
    
    def _format_sources_for_prompt(self, sources: List[Dict]) -> str:
        """Format sources information for AI prompt."""
        formatted = []
        for i, source in enumerate(sources, 1):
            source_text = f"{i}. **{source['title']}**\n"
            source_text += f"   URL: {source['url']}\n"
            source_text += f"   Credibility: {source['credibility_score']}\n"
            if source['excerpt']:
                source_text += f"   Excerpt: {source['excerpt'][:200]}...\n"
            formatted.append(source_text)
        return "\n".join(formatted)

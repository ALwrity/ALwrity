"""
SEO Title Generator - Specialized service for generating SEO-optimized blog titles.

Generates 5 premium SEO-optimized titles using research data and outline context.
"""

from typing import Dict, Any, List
from datetime import datetime
from loguru import logger

from models.blog_models import BlogResearchResponse, BlogOutlineSection


class SEOTitleGenerator:
    """Generates SEO-optimized blog titles using research and outline data."""
    
    def __init__(self):
        """Initialize the SEO title generator."""
        pass
    
    def build_title_prompt(
        self,
        research: BlogResearchResponse,
        outline: List[BlogOutlineSection],
        primary_keywords: List[str],
        secondary_keywords: List[str],
        content_angles: List[str],
        search_intent: str,
        word_count: int = 1500
    ) -> str:
        """Build a specialized prompt for SEO title generation."""
        
        # Extract key research insights
        keyword_analysis = research.keyword_analysis or {}
        competitor_analysis = research.competitor_analysis or {}
        
        primary_kw_text = ', '.join(primary_keywords) if primary_keywords else "the target topic"
        secondary_kw_text = ', '.join(secondary_keywords) if secondary_keywords else "None provided"
        long_tail_text = ', '.join(keyword_analysis.get('long_tail', [])) if keyword_analysis else "None discovered"
        semantic_text = ', '.join(keyword_analysis.get('semantic_keywords', [])) if keyword_analysis else "None discovered"
        trending_text = ', '.join(keyword_analysis.get('trending_terms', [])) if keyword_analysis else "None discovered"
        content_gap_text = ', '.join(keyword_analysis.get('content_gaps', [])) if keyword_analysis else "None identified"
        content_angle_text = ', '.join(content_angles) if content_angles else "No explicit angles provided"
        
        # Extract outline structure summary
        outline_summary = []
        for i, section in enumerate(outline[:5], 1):  # Limit to first 5 sections for context
            outline_summary.append(f"{i}. {section.heading}")
            if section.subheadings:
                outline_summary.append(f"   Subtopics: {', '.join(section.subheadings[:3])}")
        
        outline_text = '\n'.join(outline_summary) if outline_summary else "No outline available"
        
        return f"""Generate exactly 5 SEO-optimized blog titles for: {primary_kw_text}

RESEARCH CONTEXT:
Primary Keywords: {primary_kw_text}
Secondary Keywords: {secondary_kw_text}
Long-tail Keywords: {long_tail_text}
Semantic Keywords: {semantic_text}
Trending Terms: {trending_text}
Content Gaps: {content_gap_text}
Search Intent: {search_intent}
Content Angles: {content_angle_text}

OUTLINE STRUCTURE:
{outline_text}

COMPETITIVE INTELLIGENCE:
Top Competitors: {', '.join(competitor_analysis.get('top_competitors', [])) if competitor_analysis else 'Not available'}
Market Opportunities: {', '.join(competitor_analysis.get('opportunities', [])) if competitor_analysis else 'Not available'}

SEO REQUIREMENTS:
- Each title must be 50-65 characters (optimal for search engine display)
- Include the primary keyword within the first 55 characters
- Highlight a unique value proposition from the research angles
- Use power words that drive clicks (e.g., "Ultimate", "Complete", "Essential", "Proven")
- Avoid generic phrasing - be specific and benefit-focused
- Target the search intent: {search_intent}
- Ensure titles are compelling and click-worthy
- No year in titles (you are writing in {datetime.now().year}, no need to state it)

Return ONLY a JSON array of exactly 5 titles:
[
  "Title 1 (50-65 chars)",
  "Title 2 (50-65 chars)",
  "Title 3 (50-65 chars)",
  "Title 4 (50-65 chars)",
  "Title 5 (50-65 chars)"
]"""
    
    def get_title_schema(self) -> Dict[str, Any]:
        """Get the JSON schema for title generation."""
        return {
            "type": "array",
            "items": {
                "type": "string",
                "minLength": 50,
                "maxLength": 65
            },
            "minItems": 5,
            "maxItems": 5
        }
    
    async def generate_seo_titles(
        self,
        research: BlogResearchResponse,
        outline: List[BlogOutlineSection],
        primary_keywords: List[str],
        secondary_keywords: List[str],
        content_angles: List[str],
        search_intent: str,
        word_count: int,
        user_id: str
    ) -> List[str]:
        """Generate SEO-optimized titles using research and outline data.
        
        Args:
            research: Research data with keywords and insights
            outline: Blog outline sections
            primary_keywords: Primary keywords for the blog
            secondary_keywords: Secondary keywords
            content_angles: Content angles from research
            search_intent: Search intent (informational, commercial, etc.)
            word_count: Target word count
            user_id: User ID for API calls
            
        Returns:
            List of 5 SEO-optimized titles
        """
        from services.llm_providers.main_text_generation import llm_text_gen
        
        if not user_id:
            raise ValueError("user_id is required for title generation")
        
        # Build specialized prompt
        prompt = self.build_title_prompt(
            research=research,
            outline=outline,
            primary_keywords=primary_keywords,
            secondary_keywords=secondary_keywords,
            content_angles=content_angles,
            search_intent=search_intent,
            word_count=word_count
        )
        
        # Get schema
        schema = self.get_title_schema()
        
        logger.info(f"Generating SEO-optimized titles for user {user_id}")
        
        try:
            # Generate titles using structured JSON response
            result = llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                system_prompt="You are an expert SEO content strategist specializing in creating compelling, search-optimized blog titles.",
                user_id=user_id
            )
            
            # Handle response - could be array directly or wrapped in dict
            if isinstance(result, list):
                titles = result
            elif isinstance(result, dict):
                # Try common keys
                titles = result.get('titles', result.get('title_options', result.get('options', [])))
                if not titles and isinstance(result.get('response'), list):
                    titles = result['response']
            else:
                logger.warning(f"Unexpected title generation result type: {type(result)}")
                titles = []
            
            # Validate and clean titles
            cleaned_titles = []
            for title in titles:
                if isinstance(title, str) and len(title.strip()) >= 30:  # Minimum reasonable length
                    cleaned = title.strip()
                    # Ensure it's within reasonable bounds (allow slight overflow for quality)
                    if len(cleaned) <= 70:  # Allow slight overflow for quality
                        cleaned_titles.append(cleaned)
            
            # Ensure we have exactly 5 titles
            if len(cleaned_titles) < 5:
                logger.warning(f"Generated only {len(cleaned_titles)} titles, expected 5")
                # Pad with placeholder if needed (shouldn't happen with proper schema)
                while len(cleaned_titles) < 5:
                    cleaned_titles.append(f"{primary_keywords[0] if primary_keywords else 'Blog'} - Comprehensive Guide")
            
            # Return exactly 5 titles
            return cleaned_titles[:5]
            
        except Exception as e:
            logger.error(f"Failed to generate SEO titles: {e}")
            # Fallback: generate simple titles from keywords
            fallback_titles = []
            primary = primary_keywords[0] if primary_keywords else "Blog Post"
            for i in range(5):
                fallback_titles.append(f"{primary}: Complete Guide {i+1}")
            return fallback_titles


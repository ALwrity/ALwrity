"""
Introduction Generator - Generates varied blog introductions based on content and research.

Generates 3 different introduction options for the user to choose from.
"""

from typing import Dict, Any, List
from datetime import datetime
from loguru import logger

from models.blog_models import BlogResearchResponse, BlogOutlineSection


class IntroductionGenerator:
    """Generates blog introductions using research and content data."""
    
    def __init__(self):
        """Initialize the introduction generator."""
        pass
    
    def build_introduction_prompt(
        self,
        blog_title: str,
        research: BlogResearchResponse,
        outline: List[BlogOutlineSection],
        sections_content: Dict[str, str],
        primary_keywords: List[str],
        search_intent: str
    ) -> str:
        """Build a prompt for generating blog introductions."""
        
        keyword_analysis = research.keyword_analysis or {}
        content_angles = research.suggested_angles or []
        competitor_analysis = research.competitor_analysis or {}
        search_queries = research.search_queries or []
        
        section_summaries = []
        for i, section in enumerate(outline[:3], 1):
            section_id = section.id
            content = sections_content.get(section_id, '')
            if content:
                summary = content[:300] + '...' if len(content) > 300 else content
                section_summaries.append(f"{i}. {section.heading}: {summary}")
        
        sections_text = '\n'.join(section_summaries) if section_summaries else "Content sections are being generated."
        
        primary_kw_text = ', '.join(primary_keywords) if primary_keywords else "the topic"
        content_angle_text = ', '.join(content_angles[:3]) if content_angles else "General insights"
        
        # Build keyword strategy block from actual keyword_analysis
        keyword_block = ""
        all_keywords = []
        if keyword_analysis:
            primary_kw = keyword_analysis.get('primary', [])
            secondary_kw = keyword_analysis.get('secondary', [])
            if primary_kw:
                all_keywords.extend(primary_kw[:5])
            if secondary_kw:
                all_keywords.extend(secondary_kw[:5])
            si = keyword_analysis.get('search_intent', '')
            if si:
                keyword_block += f"\nSearch intent: {si}"
        if all_keywords:
            keyword_block = f"Target keywords: {', '.join(all_keywords)}" + keyword_block
        
        # Build competitive landscape block
        competitive_block = ""
        if competitor_analysis:
            gaps = competitor_analysis.get('content_gaps', [])
            leaders = competitor_analysis.get('industry_leaders', [])
            opportunities = competitor_analysis.get('opportunities', [])
            advantages = competitor_analysis.get('competitive_advantages', [])
            comp_lines = []
            if advantages:
                comp_lines.append(f"Key differentiators: {', '.join(advantages[:3])}")
            if gaps:
                comp_lines.append(f"Content gaps to address: {', '.join(gaps[:3])}")
            if leaders:
                comp_lines.append(f"Industry leaders: {', '.join(leaders[:3])}")
            if opportunities:
                comp_lines.append(f"Opportunities: {', '.join(opportunities[:3])}")
            if comp_lines:
                competitive_block = "\n".join(comp_lines)
        
        # Build search intent context
        search_block = ""
        if search_queries:
            search_block = f"Original search queries: {', '.join(search_queries[:5])}"
        
        prompt = f"""Generate exactly 3 varied blog introductions for the following blog post.

BLOG TITLE: {blog_title}

PRIMARY KEYWORDS: {primary_kw_text}
SEARCH INTENT: {search_intent}
CONTENT ANGLES: {content_angle_text}
{keyword_block}
{f"COMPETITIVE LANDSCAPE:\n{competitive_block}" if competitive_block else ""}
{f"SEARCH CONTEXT:\n{search_block}" if search_block else ""}

BLOG CONTENT SUMMARY:
{sections_text}

REQUIREMENTS FOR EACH INTRODUCTION:
- 80-120 words in length
- Hook the reader immediately with a compelling opening
- Clearly state the value proposition and what readers will learn
- Include the primary keyword naturally within the first 2 sentences
- Each introduction should have a different angle/approach:
  1. First: Problem-focused (highlight the challenge readers face)
  2. Second: Benefit-focused (emphasize the value and outcomes)
  3. Third: Story/statistic-focused (use a compelling fact or narrative hook)
- Maintain a professional yet engaging tone
- Avoid generic phrases - be specific and benefit-driven
- Where possible, incorporate specific insights from the competitive landscape and search intent above
- Write introductions that feel current (you are writing in {datetime.now().year}), but avoid stating the year unless it's essential to the story

Return ONLY a JSON array of exactly 3 introductions:
[
  "First introduction (80-120 words, problem-focused)",
  "Second introduction (80-120 words, benefit-focused)",
  "Third introduction (80-120 words, story/statistic-focused)"
]"""
        return prompt
    
    def get_introduction_schema(self) -> Dict[str, Any]:
        """Get the JSON schema for introduction generation."""
        return {
            "type": "array",
            "items": {
                "type": "string",
                "minLength": 80,
                "maxLength": 150
            },
            "minItems": 3,
            "maxItems": 3
        }
    
    async def generate_introductions(
        self,
        blog_title: str,
        research: BlogResearchResponse,
        outline: List[BlogOutlineSection],
        sections_content: Dict[str, str],
        primary_keywords: List[str],
        search_intent: str,
        user_id: str
    ) -> List[str]:
        """Generate 3 varied blog introductions.
        
        Args:
            blog_title: The blog post title
            research: Research data with keywords and insights
            outline: Blog outline sections
            sections_content: Dictionary mapping section IDs to their content
            primary_keywords: Primary keywords for the blog
            search_intent: Search intent (informational, commercial, etc.)
            user_id: User ID for API calls
            
        Returns:
            List of 3 introduction options
        """
        from services.llm_providers.main_text_generation import llm_text_gen
        
        if not user_id:
            raise ValueError("user_id is required for introduction generation")
        
        # Build prompt
        prompt = self.build_introduction_prompt(
            blog_title=blog_title,
            research=research,
            outline=outline,
            sections_content=sections_content,
            primary_keywords=primary_keywords,
            search_intent=search_intent
        )
        
        # Get schema
        schema = self.get_introduction_schema()
        
        logger.info(f"Generating blog introductions for user {user_id}")
        
        try:
            # Generate introductions using structured JSON response
            result = llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                system_prompt="You are an expert content writer specializing in creating compelling blog introductions that hook readers and clearly communicate value.",
                user_id=user_id
            )
            
            # Handle response - could be array directly or wrapped in dict
            if isinstance(result, list):
                introductions = result
            elif isinstance(result, dict):
                # Try common keys
                introductions = result.get('introductions', result.get('options', result.get('intros', [])))
                if not introductions and isinstance(result.get('response'), list):
                    introductions = result['response']
            else:
                logger.warning(f"Unexpected introduction generation result type: {type(result)}")
                introductions = []
            
            # Validate and clean introductions
            cleaned_introductions = []
            for intro in introductions:
                if isinstance(intro, str) and len(intro.strip()) >= 50:  # Minimum reasonable length
                    cleaned = intro.strip()
                    # Ensure it's within reasonable bounds
                    if len(cleaned) <= 200:  # Allow slight overflow for quality
                        cleaned_introductions.append(cleaned)
            
            # Ensure we have exactly 3 introductions
            if len(cleaned_introductions) < 3:
                logger.warning(f"Generated only {len(cleaned_introductions)} introductions, expected 3")
                # Pad with placeholder if needed
                while len(cleaned_introductions) < 3:
                    cleaned_introductions.append(f"{blog_title} - A comprehensive guide covering essential insights and practical strategies.")
            
            # Return exactly 3 introductions
            return cleaned_introductions[:3]
            
        except Exception as e:
            logger.error(f"Failed to generate introductions: {e}")
            # Fallback: generate simple introductions
            fallback_introductions = [
                f"In this comprehensive guide, we'll explore {primary_keywords[0] if primary_keywords else 'essential insights'} and provide actionable strategies.",
                f"Discover everything you need to know about {primary_keywords[0] if primary_keywords else 'this topic'} and how it can transform your approach.",
                f"Whether you're new to {primary_keywords[0] if primary_keywords else 'this topic'} or looking to deepen your understanding, this guide has you covered."
            ]
            return fallback_introductions


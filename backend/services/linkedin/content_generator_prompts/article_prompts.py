"""
LinkedIn Article Generation Prompts

This module contains prompt templates and builders for generating LinkedIn articles.
"""

from typing import Any, Optional, Dict, List
from models.linkedin_models import LinkedInOutlineSection


class ArticlePromptBuilder:
    """Builder class for LinkedIn article generation prompts."""
    
    @staticmethod
    def build_article_prompt(request: Any, persona: Optional[Dict[str, Any]] = None) -> str:
        """
        Build prompt for article generation.
        
        Args:
            request: LinkedInArticleRequest object containing generation parameters
            
        Returns:
            Formatted prompt string for article generation
        """
        persona_block = ""
        if persona:
            try:
                core = persona.get('core_persona', persona)
                platform_adaptation = persona.get('platform_adaptation', persona.get('platform_persona', {}))
                linguistic = core.get('linguistic_fingerprint', {})
                sentence_metrics = linguistic.get('sentence_metrics', {})
                lexical_features = linguistic.get('lexical_features', {})
                tonal_range = core.get('tonal_range', {})
                persona_block = f"""
        PERSONA CONTEXT:
        - Persona Name: {core.get('persona_name', 'N/A')}
        - Archetype: {core.get('archetype', 'N/A')}
        - Core Belief: {core.get('core_belief', 'N/A')}
        - Default Tone: {tonal_range.get('default_tone', request.tone)}
        - Avg Sentence Length: {sentence_metrics.get('average_sentence_length_words', 18)} words
        - Go-to Words: {', '.join(lexical_features.get('go_to_words', [])[:5])}
        """.rstrip()
            except Exception:
                persona_block = ""

        prompt = f"""
        You are a senior content strategist and industry expert specializing in {request.industry}. Create a comprehensive, thought-provoking LinkedIn article that establishes authority, drives engagement, and provides genuine value to professionals in this field.

        TOPIC: {request.topic}
        INDUSTRY: {request.industry}
        TONE: {request.tone}
        TARGET AUDIENCE: {request.target_audience or 'Industry professionals, executives, and thought leaders'}
        WORD COUNT: {request.word_count} words

        {persona_block}

        CONTENT STRUCTURE:
        - Compelling headline that promises specific value
        - Engaging introduction with a hook and clear value proposition
        - Data-driven insights with proper citations
        - Practical takeaways and next steps
        - Strong conclusion with a call-to-action

        {self._build_outline_block(request)}

        CONTENT QUALITY REQUIREMENTS:
        - Include statistics and trends from the research sources provided
        - Provide real-world examples and case studies
        - Address common challenges and pain points
        - Offer actionable strategies and frameworks
        - Use industry-specific terminology appropriately
        - Include expert quotes or insights when relevant

        LINKEDIN-SPECIFIC FORMATTING:
        - Write short paragraphs (2-3 sentences max) — LinkedIn readers scan on mobile
        - Place the strongest hook in the first 2 lines (the "see more" cutoff)
        - Use line breaks between sections for visual breathing room
        - Use bold sparingly for key phrases, not entire sentences
        - Avoid hashtags — LinkedIn articles don't use them; rely on headline keywords for discovery

        ENGAGEMENT OPTIMIZATION:
        - Open with a hook that challenges a common assumption or poses a problem the reader recognizes
        - Use subheadings every 200-300 words for scannability
        - Include bullet points and numbered lists for key insights
        - End each major section with a one-sentence takeaway the reader can apply immediately
        - Close with a specific call-to-action that invites comments (question, poll, or "what am I missing?")

        KEY SECTIONS TO COVER: {', '.join(request.key_sections) if request.key_sections else 'Industry overview, current challenges, emerging trends, practical solutions, future outlook'}

        {self._build_outline_override_block(request)}

        CITATION FORMAT:
        - When you reference a specific data point, statistic, or claim from the research sources above, add [Source N] immediately after the claim, where N is the source number from the RESEARCH CONTEXT.
        - Example: "According to Gartner [Source 1], AI adoption has increased by 40% year-over-year."
        - Only cite sources for factual claims, statistics, data points, and specific findings — not for general industry knowledge.
        - If you do not cite any sources, return an empty list for cited_source_indices.

        GROUNDING RULES:
        - When the RESEARCH CONTEXT provides specific numbers (statistics, percentages, dates), use them and cite the source.
        - When the RESEARCH CONTEXT does NOT contain a relevant data point for a claim you want to make, state it as a general observation or industry trend — do not invent a number.
        - It is better to make a strong, specific argument without a statistic than to attach a fabricated number to a weak point.
        - If the research is thin on a subtopic, acknowledge the gap with phrases like "While specific data on X is still emerging, the direction is clear..." rather than inventing data.

        REMEMBER: This article should position the author as a thought leader while providing actionable insights that readers can immediately apply in their professional lives.
        """
        return prompt.strip()

    @staticmethod
    def _build_outline_block(request) -> str:
        """Build the outline-specific block for CONTENT STRUCTURE when outline_override is set."""
        outline = getattr(request, 'outline_override', None)
        if not outline:
            return "- 3-5 main sections with actionable insights and examples"
        
        lines = ["- FOLLOW THIS OUTLINE PRECISELY for the article sections:"]
        for i, sec in enumerate(outline, 1):
            heading = sec.heading if isinstance(sec.heading, str) else sec.get('heading', f'Section {i}')
            key_points = sec.key_points if isinstance(getattr(sec, 'key_points', None), list) else sec.get('key_points', [])
            lines.append(f"  {i}. {heading}")
            for kp in key_points[:3]:
                lines.append(f"     - {kp}")
        return "\n".join(lines)

    @staticmethod
    def _build_outline_override_block(request) -> str:
        """Build the outline override directive for KEY SECTIONS TO COVER."""
        outline = getattr(request, 'outline_override', None)
        if not outline:
            return ""
        
        headings = []
        for sec in outline:
            h = sec.heading if isinstance(sec.heading, str) else sec.get('heading', '')
            headings.append(h)
        
        return f"OVERRIDE — Use ONLY these sections in this order: {', '.join(headings)}. Do not add or remove sections."

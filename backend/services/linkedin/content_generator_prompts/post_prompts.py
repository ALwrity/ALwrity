"""
LinkedIn Post Generation Prompts

This module contains prompt templates and builders for generating LinkedIn posts.
"""

from typing import Any, Optional, Dict


class PostPromptBuilder:
    """Builder class for LinkedIn post generation prompts."""
    
    @staticmethod
    def build_post_prompt(request: Any, persona: Optional[Dict[str, Any]] = None) -> str:
        """
        Build prompt for post generation.
        
        Args:
            request: LinkedInPostRequest object containing generation parameters
            
        Returns:
            Formatted prompt string for post generation
        """
        persona_block = ""
        if persona:
            try:
                # Expecting structure similar to persona_service.get_persona_for_platform output
                core = persona.get('core_persona', persona)
                platform_adaptation = persona.get('platform_adaptation', persona.get('platform_persona', {}))
                linguistic = core.get('linguistic_fingerprint', {})
                sentence_metrics = linguistic.get('sentence_metrics', {})
                lexical_features = linguistic.get('lexical_features', {})
                rhetorical_devices = linguistic.get('rhetorical_devices', {})
                tonal_range = core.get('tonal_range', {})

                persona_block = f"""
        PERSONA CONTEXT:
        - Persona Name: {core.get('persona_name', 'N/A')}
        - Archetype: {core.get('archetype', 'N/A')}
        - Core Belief: {core.get('core_belief', 'N/A')}
        - Tone: {tonal_range.get('default_tone', request.tone)}
        - Sentence Length (avg): {sentence_metrics.get('average_sentence_length_words', 15)} words
        - Preferred Sentence Type: {sentence_metrics.get('preferred_sentence_type', 'simple and compound')}
        - Go-to Words: {', '.join(lexical_features.get('go_to_words', [])[:5])}
        - Avoid Words: {', '.join(lexical_features.get('avoid_words', [])[:5])}
        - Rhetorical Style: {rhetorical_devices.get('summary','balanced rhetorical questions and examples')}
        """.rstrip()
            except Exception:
                persona_block = ""

        has_key_points = bool(request.key_points)
        key_points_section = ""
        if has_key_points:
            points_list = '\n'.join(f'      {i+1}. {kp}' for i, kp in enumerate(request.key_points))
            key_points_section = f"""
        KEY POINTS (use these as the post's structural skeleton — each key point should become a dedicated section or paragraph):

{points_list}

        STRUCTURE REQUIREMENT: The post MUST cover ALL of the key points above in order. Dedicate one paragraph or bullet group to each key point. Do not omit or merge any of them. Open with a hook that leads into the first key point, then walk through each one sequentially, and close with a call-to-action that ties them together.

        RESEARCH MAPPING: For each key point, scan the RESEARCH CONTEXT section below and anchor it with a relevant data point, statistic, example, or expert finding. If a key point lacks a direct research match, use general industry knowledge — but prioritize research-backed claims wherever possible."""
        else:
            key_points_section = """
        KEY POINTS: Current industry trends, challenges, and opportunities — focus on what the target audience cares about most right now. Use the RESEARCH CONTEXT below to find supporting data and statistics."""

        prompt = f"""
        You are an expert LinkedIn content strategist with 10+ years of experience in the {request.industry} industry. Create a highly engaging, professional LinkedIn post that drives meaningful engagement and establishes thought leadership.

        TOPIC: {request.topic}
        INDUSTRY: {request.industry}
        TONE: {request.tone}
        TARGET AUDIENCE: {request.target_audience or 'Industry professionals, decision-makers, and thought leaders'}
        MAX LENGTH: {request.max_length} characters

        {persona_block}
{key_points_section}

        CONTENT REQUIREMENTS:
        - Start with a strong hook in the first 1–2 lines (front-load before LinkedIn's "see more" fold). "Bold hook" means a strong opening line — NOT markdown bold.
        - Use storytelling elements to make it relatable and memorable
        - Include industry-specific examples or case studies when relevant
        - End the body with a clear call-to-action or question as the last text block BEFORE hashtags
        - Use professional yet conversational language that encourages discussion
        - Prefer ≤ 1,300 characters so the full post stays visible in feed, unless MAX LENGTH is higher and a longer post is clearly needed. Never exceed MAX LENGTH ({request.max_length} characters).

        ENGAGEMENT STRATEGY:
        - Include 3–5 highly relevant, industry-specific hashtags (mix of broad and niche)
        - Place ALL hashtags only at the very end of the post — never inline mid-sentence
        - Use line breaks and emojis strategically for readability
        - Encourage comments by asking for opinions or experiences
        - Make it shareable by providing genuine value

        FORMATTING (LINKEDIN IS PLAIN TEXT):
        - Do NOT use markdown: no **bold**, no # headers, no [links](url), no image markdown
        - Use plain-text bullet lines (• or -) or numbered lists for key insights — each bullet MUST be on its own line
        - Include relevant emojis to enhance visual appeal
        - Break text into digestible paragraphs of 1–2 sentences, separated by a blank line (LinkedIn Best Practice)
        - Never return the entire post as one continuous paragraph
        - Structure order: hook + body → CTA/question → blank line → hashtags
        - Leave space for engagement (don't fill the entire character limit)

        CITATION FORMAT:
        - When you reference a specific data point, statistic, or claim from the research sources above, add [Source N] immediately after the claim, where N is the source number from the RESEARCH CONTEXT.
        - Example: "According to Gartner [Source 1], AI adoption has increased by 40% year-over-year."
        - Only cite sources for factual claims, statistics, data points, and specific findings — not for general industry knowledge.
        - If you do not cite any sources, return an empty list for cited_source_indices.

        ANTI-HALLUCINATION: Only make claims, statistics, and data points that are directly supported by the RESEARCH CONTEXT section above. Do not invent or fabricate statistics, dates, percentages, or specific findings. If the research does not contain a relevant data point, make a general observation instead of inventing a number.

        REMEMBER: This post should position the author as a knowledgeable industry expert while being genuinely helpful to the audience.
        """
        return prompt.strip()

"""
LinkedIn Carousel Generation Prompts

This module contains prompt templates and builders for generating LinkedIn carousels.
"""

from typing import Any


class CarouselPromptBuilder:
    """Builder class for LinkedIn carousel generation prompts."""
    
    @staticmethod
    def build_carousel_prompt(request: Any) -> str:
        """
        Build prompt for carousel generation.
        
        Args:
            request: LinkedInCarouselRequest object containing generation parameters
            
        Returns:
            Formatted prompt string for carousel generation
        """
        prompt = f"""
        You are a visual content strategist and {request.industry} industry expert. Create a compelling LinkedIn carousel that tells a cohesive story and drives engagement through visual storytelling and valuable insights.

        TOPIC: {request.topic}
        INDUSTRY: {request.industry}
        TONE: {request.tone}
        TARGET AUDIENCE: {request.target_audience or 'Industry professionals and decision-makers'}
        NUMBER OF SLIDES: {request.number_of_slides}
        INCLUDE COVER SLIDE: {request.include_cover_slide}
        INCLUDE CTA SLIDE: {request.include_cta_slide}

        CAROUSEL STRUCTURE & DESIGN:
        - Cover Slide: Compelling headline with visual hook and clear value proposition
        - Content Slides: Each slide should focus on ONE key insight with supporting data
        - Visual Flow: Create a logical progression that builds understanding
        - CTA Slide: Clear next steps and engagement prompts

        CONTENT REQUIREMENTS PER SLIDE:
        - Maximum 3-4 bullet points per slide for readability
        - Include relevant statistics, percentages, or data points
        - Use action-oriented language and specific examples
        - Each slide should be self-contained but contribute to the overall narrative

        VISUAL DESIGN GUIDELINES:
        - Suggest color schemes that match the industry (professional yet engaging)
        - Recommend icon styles and visual elements for each slide
        - Include layout suggestions (text placement, image positioning)
        - Suggest data visualization opportunities (charts, graphs, infographics)

        ENGAGEMENT STRATEGY:
        - Include thought-provoking questions on key slides
        - Suggest interactive elements (polls, surveys, comment prompts)
        - Use storytelling elements to create emotional connection
        - End with clear call-to-action and hashtag suggestions

        KEY INSIGHTS TO COVER: {', '.join(request.key_points) if request.key_points else 'Industry trends, challenges, solutions, and opportunities'}

        CITATION FORMAT:
        - When you reference a specific data point, statistic, or claim from the research sources above, add [Source N] immediately after the claim, where N is the source number from the RESEARCH CONTEXT.
        - Example: "Enterprise AI adoption grew 40% year-over-year [Source 1]."
        - Only cite sources for factual claims, statistics, data points, and specific findings — not for general industry knowledge.
        - If you do not cite any sources, return an empty list for cited_source_indices.

        ANTI-HALLUCINATION: Only make claims, statistics, and data points that are directly supported by the RESEARCH CONTEXT section above. Do not invent or fabricate statistics, dates, percentages, or specific findings. If the research does not contain a relevant data point, make a general observation instead of inventing a number.

        REMEMBER: Each slide should be visually appealing, informative, and encourage the viewer to continue reading. The carousel should provide immediate value while building anticipation for the next slide.
        """
        return prompt.strip()

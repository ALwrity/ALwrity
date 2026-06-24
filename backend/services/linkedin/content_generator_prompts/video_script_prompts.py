"""
LinkedIn Video Script Generation Prompts

This module contains prompt templates and builders for generating LinkedIn video scripts.
"""

from typing import Any


class VideoScriptPromptBuilder:
    """Builder class for LinkedIn video script generation prompts."""
    
    @staticmethod
    def build_video_script_prompt(request: Any) -> str:
        """
        Build prompt for video script generation.
        
        Args:
            request: LinkedInVideoScriptRequest object containing generation parameters
            
        Returns:
            Formatted prompt string for video script generation
        """
        prompt = f"""
        You are a video content strategist and {request.industry} industry expert. Create a compelling LinkedIn video script that captures attention in the first 3 seconds and maintains engagement throughout the entire duration.

        TOPIC: {request.topic}
        INDUSTRY: {request.industry}
        TONE: {request.tone}
        TARGET AUDIENCE: {request.target_audience or 'Industry professionals and decision-makers'}
        DURATION: {request.video_duration} seconds
        INCLUDE CAPTIONS: {request.include_captions}
        INCLUDE THUMBNAIL SUGGESTIONS: {request.include_thumbnail_suggestions}

        VIDEO STRUCTURE & TIMING:
        - Hook (0-3 seconds): Compelling opening that stops the scroll
        - Introduction (3-8 seconds): Establish credibility and preview value
        - Main Content (8-{request.video_duration-5} seconds): 2-3 key insights with examples
        - Conclusion (Last 5 seconds): Clear call-to-action and engagement prompt

        CONTENT REQUIREMENTS:
        - Start with a compelling statistic from the research sources, a provocative question, or bold statement
        - Include specific examples and case studies from the industry
        - Use conversational, engaging language that feels natural when spoken
        - Include 2-3 actionable takeaways viewers can implement immediately
        - End with a question that encourages comments and discussion

        VISUAL & AUDIO GUIDELINES:
        - Suggest background music style and mood
        - Recommend visual elements (text overlays, graphics, charts)
        - Include specific camera angle and movement suggestions
        - Suggest props or visual aids that enhance the message

        CAPTION OPTIMIZATION:
        - Write captions that are engaging even without audio
        - Include emojis and formatting for visual appeal
        - Ensure captions complement the spoken content
        - Make captions scannable and easy to read

        THUMBNAIL DESIGN:
        - Suggest compelling thumbnail text and imagery
        - Recommend color schemes that match the industry
        - Include specific design elements that increase click-through rates

        ENGAGEMENT STRATEGY:
        - Include moments that encourage viewers to pause and think
        - Suggest interactive elements (polls, questions, challenges)
        - Create emotional connection through storytelling
        - End with clear next steps and hashtag suggestions

        KEY INSIGHTS TO COVER: {', '.join(request.key_points) if request.key_points else 'Industry trends, challenges, solutions, and opportunities'}

        CITATION FORMAT:
        - When you reference a specific data point, statistic, or claim from the research sources above, add [Source N] immediately after the claim, where N is the source number from the RESEARCH CONTEXT.
        - Example: "Did you know enterprise AI adoption grew 40% last year? [Source 1]"
        - Only cite sources for factual claims, statistics, data points, and specific findings — not for general industry knowledge.
        - If you do not cite any sources, return an empty list for cited_source_indices.

        ANTI-HALLUCINATION: Only make claims, statistics, and data points that are directly supported by the RESEARCH CONTEXT section above. Do not invent or fabricate statistics, dates, percentages, or specific findings. If the research does not contain a relevant data point, make a general observation instead of inventing a number.

        REMEMBER: This video should provide immediate value while building the creator's authority. Every second should count toward engagement and viewer retention.
        """
        return prompt.strip()

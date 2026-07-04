"""
Outline Prompt Builder for LinkedIn Article Outline Generation.

Builds a focused prompt that asks the LLM to generate section headings,
key points per section, and title options from research context.
"""

from typing import List, Optional
from datetime import datetime


class OutlinePromptBuilder:
    """Builds prompts for LinkedIn article outline generation."""

    @staticmethod
    def build_outline_prompt(
        topic: str,
        industry: str,
        tone: str,
        target_audience: Optional[str],
        word_count: int,
        research_context: str = "",
    ) -> str:
        """Build the outline generation prompt."""
        today = datetime.now().strftime("%B %d, %Y")
        audience = target_audience or "industry professionals"

        prompt = f"""You are a senior content strategist and industry expert specializing in {industry}.

Create a detailed article outline for a LinkedIn article on the following topic.

TOPIC: {topic}
INDUSTRY: {industry}
TONE: {tone}
TARGET AUDIENCE: {audience}
TARGET WORD COUNT: {word_count} words
TODAY'S DATE: {today}

## REQUIREMENTS

Generate 4-6 sections that form a logical narrative arc:
1. An engaging introduction section that hooks the reader
2. 2-4 body sections with actionable insights and data-driven points
3. A strong conclusion with a call to action

For each section provide:
- **heading**: A clear, benefit-driven section title
- **key_points**: 2-4 bullet points covering what to discuss (specific claims, data points, examples, or frameworks)

Also provide 3 title options for the article.

## RESEARCH CONTEXT

{research_context if research_context else "No research sources available. Base the outline on general industry knowledge."}

## OUTPUT FORMAT

Return a JSON object with this exact structure:
{{
    "title_suggestions": ["Title option 1", "Title option 2", "Title option 3"],
    "sections": [
        {{"heading": "Section Heading", "key_points": ["Point 1", "Point 2"]}}
    ]
}}

Ensure sections form a coherent narrative from introduction to conclusion.
Each key_point should be specific and actionable, not generic."""
        return prompt

    @staticmethod
    def build_refine_prompt(
        outline_text: str,
        operation: str,
        payload: Optional[dict] = None,
    ) -> str:
        """Build prompt for AI-powered outline refinement."""
        prompt = f"""You are a content strategist. Refine the following LinkedIn article outline.

Current outline:
{outline_text}

Operation: {operation}
"""
        if payload:
            prompt += f"Additional context: {payload}\n"

        prompt += """
Return a JSON object:
{
    "sections": [
        {"heading": "Section Heading", "key_points": ["Point 1", "Point 2"]}
    ],
    "title_suggestions": ["Title 1", "Title 2", "Title 3"]
}

Keep the same overall structure and number of sections unless the operation explicitly requests changes."""
        return prompt

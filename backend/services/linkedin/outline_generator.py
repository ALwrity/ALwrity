"""
LinkedIn Article Outline Generator

Generates and refines article outlines for LinkedIn content.
Reuses the shared research infrastructure and llm_text_gen gateway.
"""

import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from loguru import logger
from models.linkedin_models import LinkedInOutlineSection, LinkedInOutlineResponse, LinkedInOutlineRefineRequest
from services.linkedin.content_generator import ContentGenerator
from services.linkedin.content_generator_prompts.outline_prompts import OutlinePromptBuilder
from services.llm_providers.main_text_generation import llm_text_gen


class LinkedInOutlineGenerator:
    """Generates and refines LinkedIn article outlines from research."""

    def __init__(self):
        self.content_generator = ContentGenerator()

    async def generate_outline(
        self,
        topic: str,
        industry: str,
        tone: str,
        target_audience: Optional[str],
        word_count: int,
        research_sources: List,
        user_id: str = None,
    ) -> LinkedInOutlineResponse:
        """Generate an article outline from research sources."""
        try:
            research_context = self.content_generator._build_research_context(research_sources)
            prompt = OutlinePromptBuilder.build_outline_prompt(
                topic=topic,
                industry=industry,
                tone=tone,
                target_audience=target_audience,
                word_count=word_count,
                research_context=research_context,
            )

            raw = llm_text_gen(
                prompt=prompt,
                user_id=user_id,
                flow_type="linkedin_outline",
                temperature=0.3,
            )

            parsed = self._parse_response(raw)
            sections = []
            for i, sec in enumerate(parsed.get("sections", []), 1):
                sections.append(LinkedInOutlineSection(
                    id=f"s{i}",
                    heading=sec.get("heading", f"Section {i}"),
                    key_points=sec.get("key_points", []),
                ))

            return LinkedInOutlineResponse(
                success=True,
                outline=sections,
                title_suggestions=parsed.get("title_suggestions", []),
            )

        except Exception as e:
            logger.error(f"Outline generation failed: {e}")
            return LinkedInOutlineResponse(
                success=False,
                error=str(e),
            )

    def refine_outline(
        self,
        request: LinkedInOutlineRefineRequest,
    ) -> LinkedInOutlineResponse:
        """Apply HITL operations to an existing outline."""
        outline = request.outline
        operation = request.operation
        section_id = request.section_id
        payload = request.payload or {}

        try:
            if operation == "add":
                heading = payload.get("heading", "New Section")
                key_points = payload.get("key_points", [])
                new_id = f"s{len(outline) + 1}"
                outline.append(LinkedInOutlineSection(
                    id=new_id, heading=heading, key_points=key_points
                ))

            elif operation == "remove" and section_id:
                outline = [s for s in outline if s.id != section_id]

            elif operation == "rename" and section_id:
                for s in outline:
                    if s.id == section_id:
                        s.heading = payload.get("heading", s.heading)
                        break

            elif operation == "move" and section_id:
                direction = payload.get("direction", "down")
                idx = next((i for i, s in enumerate(outline) if s.id == section_id), None)
                if idx is not None:
                    swap = idx + 1 if direction == "down" else idx - 1
                    if 0 <= swap < len(outline):
                        outline[idx], outline[swap] = outline[swap], outline[idx]

            # Reassign sequential IDs
            for i, s in enumerate(outline, 1):
                s.id = f"s{i}"

            return LinkedInOutlineResponse(success=True, outline=outline)

        except Exception as e:
            logger.error(f"Outline refine failed: {e}")
            return LinkedInOutlineResponse(success=False, error=str(e))

    def _parse_response(self, raw) -> Dict[str, Any]:
        """Parse LLM response, handling both dict and string formats."""
        if isinstance(raw, dict):
            return raw
        cleaned = str(raw).strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return json.loads(cleaned)

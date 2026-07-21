"""Story outline generation helpers."""

from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import HTTPException
from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen

from .base import StoryServiceBase


class StoryOutlineMixin(StoryServiceBase):
    """Provides outline generation behaviour."""

    def _get_outline_schema(self, include_anime_bible: bool = False) -> Dict[str, Any]:
        """Return JSON schema for structured story outlines."""
        schema: Dict[str, Any] = {
            "type": "object",
            "properties": {
                "scenes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "scene_number": {"type": "integer"},
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "image_prompt": {"type": "string"},
                            "audio_narration": {"type": "string"},
                            "character_descriptions": {"type": "array", "items": {"type": "string"}},
                            "key_events": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["scene_number", "title", "description", "image_prompt", "audio_narration"],
                    },
                }
            },
            "required": ["scenes"],
        }

        if include_anime_bible:
            schema["properties"]["anime_bible"] = {
                "type": "object",
                "properties": {
                    "main_cast": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "name": {"type": "string"},
                                "age_range": {"type": "string"},
                                "role": {"type": "string"},
                                "look": {"type": "string"},
                                "outfit_palette": {"type": "string"},
                                "personality_tags": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": ["id", "name", "age_range", "role", "look", "outfit_palette", "personality_tags"],
                        },
                    },
                    "world": {
                        "type": "object",
                        "properties": {
                            "setting": {"type": "string"},
                            "era": {"type": "string"},
                            "tech_or_magic_level": {"type": "string"},
                            "core_rules": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["setting", "era", "tech_or_magic_level", "core_rules"],
                    },
                    "visual_style": {
                        "type": "object",
                        "properties": {
                            "style_preset": {"type": "string"},
                            "camera_style": {"type": "string"},
                            "color_mood": {"type": "string"},
                            "lighting": {"type": "string"},
                            "line_style": {"type": "string"},
                            "extra_tags": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["style_preset", "camera_style", "color_mood", "lighting", "line_style", "extra_tags"],
                    },
                },
                "required": ["main_cast", "world", "visual_style"],
            }
            schema["required"].append("anime_bible")

        return schema

    def generate_outline(
        self,
        *,
        premise: str,
        persona: str,
        story_setting: str,
        character_input: str,
        plot_elements: str,
        writing_style: str,
        story_tone: str,
        narrative_pov: str,
        audience_age_group: str,
        content_rating: str,
        ending_preference: str,
        user_id: str,
        use_structured_output: bool = True,
        include_anime_bible: bool = False,
    ) -> Any:
        """Generate a story outline with optional structured JSON output."""
        persona_prompt = self.build_persona_prompt(
            persona,
            story_setting,
            character_input,
            plot_elements,
            writing_style,
            story_tone,
            narrative_pov,
            audience_age_group,
            content_rating,
            ending_preference,
        )

        parameter_guidance = self._get_parameter_interaction_guidance(
            writing_style, story_tone, audience_age_group, content_rating
        )

        outline_prompt = f"""\
{persona_prompt}

**PREMISE:**
{premise}

{parameter_guidance}

**YOUR TASK:**
Create a detailed story outline with multiple scenes that brings this premise to life. The outline must perfectly align with ALL of the story setup parameters provided above.

**SCENE PROGRESSION STRUCTURE:**

**Scene 1-2 (Opening):**
- Introduce the setting ({story_setting}) and main characters ({character_input})
- Establish the {story_tone} tone from the beginning
- Set up the main conflict or adventure based on the plot elements ({plot_elements})
- Hook the audience with an engaging opening that matches {writing_style} style
- Use the {narrative_pov} perspective to establish the story world
- Create intrigue and interest appropriate for {audience_age_group}
- Respect the {content_rating} content rating from the start

**Scene 3-7 (Development):**
- Develop the plot elements ({plot_elements}) in detail
- Build character relationships and growth using the specified characters ({character_input})
- Create tension, obstacles, or challenges that advance the story
- Maintain the {writing_style} style consistently throughout
- Progress toward the {ending_preference} ending
- Explore the setting ({story_setting}) more deeply
- Ensure all content is age-appropriate for {audience_age_group}
- Maintain the {story_tone} tone while developing the plot
- Respect the {content_rating} content rating in all scenes
- Use the {narrative_pov} perspective consistently

**Final Scenes (Resolution):**
- Resolve the main conflict established in the plot elements ({plot_elements})
- Deliver the {ending_preference} ending
- Tie together all plot elements and character arcs
- Provide satisfying closure appropriate for {audience_age_group}
- Maintain the {writing_style} style and {story_tone} tone until the end
- Ensure the ending respects the {content_rating} content rating
- Use the {narrative_pov} perspective to conclude the story

**OUTLINE STRUCTURE:**
For each scene, provide:
1. **Scene Number and Title**
2. **Description** (written in {writing_style}, maintaining {story_tone}, and age-appropriate for {audience_age_group})
3. **Image Prompt** (vivid, visually descriptive, includes setting/characters, age-appropriate)
4. **Audio Narration** (2-3 sentences, engaging, maintains style/tone, suitable for narration)
5. **Character Descriptions** (for characters appearing in the scene)
6. **Key Events** (bullet list of important happenings)

**CONTEXT INTEGRATION REQUIREMENTS:**
- Ensure every scene reflects the setting ({story_setting})
- Keep characters consistent with ({character_input})
- Integrate plot elements ({plot_elements}) logically
- Maintain persona voice ({persona})
- Respect audience age group ({audience_age_group}) and content rating ({content_rating})

Before finalizing, verify that every scene adheres to the writing style, tone, age appropriateness, content rating, and narrative POV. Create 5-10 scenes that tell a complete, engaging story with clear progression and satisfying resolution.
"""

        if include_anime_bible:
            outline_prompt += """

**ANIME STORY BIBLE:**
In addition to the scenes, generate a complete anime-style story bible with:
1. **main_cast** — each character in the story with: id (short unique key), name, age_range, role (e.g. protagonist/antagonist/support), look (physical appearance), outfit_palette (dominant colors), personality_tags (array of descriptive tags)
2. **world** — object with: setting, era, tech_or_magic_level, core_rules (array of rules governing this world)
3. **visual_style** — object with: style_preset, camera_style, color_mood, lighting, line_style, extra_tags (array of visual keywords)

The anime bible must be consistent with the characters, setting, and tone defined above.
"""

        try:
            if use_structured_output:
                outline_schema = self._get_outline_schema(include_anime_bible=include_anime_bible)
                try:
                    response = self.load_json_response(
                        llm_text_gen(prompt=outline_prompt, json_struct=outline_schema, user_id=user_id)
                    )
                    scenes = response.get("scenes", [])
                    if scenes:
                        logger.info(f"[StoryWriter] Generated {len(scenes)} structured scenes for user {user_id}")
                        logger.info(
                            "[StoryWriter] Outline generated with parameters: "
                            f"audience={audience_age_group}, style={writing_style}, tone={story_tone}"
                        )
                        return response
                    logger.warning("[StoryWriter] No scenes found in structured output, falling back to text parsing")
                    raise ValueError("No scenes found in structured output")
                except (json.JSONDecodeError, ValueError, KeyError) as exc:
                    logger.warning(
                        f"[StoryWriter] Failed to parse structured JSON outline ({exc}), falling back to text parsing"
                    )
                    return self._parse_text_outline(outline_prompt, user_id)

            outline = self.generate_with_retry(outline_prompt, user_id=user_id)
            return outline.strip()
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Outline Generation Error: {exc}")
            raise RuntimeError(f"Failed to generate outline: {exc}") from exc


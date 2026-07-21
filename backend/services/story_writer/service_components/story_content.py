"""Story content generation helpers."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import json

from fastapi import HTTPException
from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen
from services.story_writer.image_generation_service import StoryImageGenerationService

from .base import StoryServiceBase
from .outline import StoryOutlineMixin


# ------------------------------------------------------------------ #
# Bible formatting helpers
# ------------------------------------------------------------------ #

def _format_bible_for_prompt(anime_bible: Optional[Dict[str, Any]]) -> str:
    """Format the anime bible into readable sections for prompt injection,
    replacing the raw JSON dump. Presents cast profiles, world info, and
    visual style as natural language sections."""
    if not anime_bible:
        return ""

    sections = []

    main_cast = anime_bible.get("main_cast", [])
    if main_cast:
        cast_lines = ["MAIN CAST:"]
        for member in main_cast:
            name = member.get("name", "?")
            role = member.get("role", "")
            look = member.get("look", "")
            outfit = member.get("outfit_palette", "")
            tags = member.get("personality_tags", [])
            age = member.get("age_range", "")

            header = f"  {name}"
            if role:
                header += f" [{role.capitalize()}]"
            if age:
                header += f" ({age})"
            cast_lines.append(header)
            if look:
                cast_lines.append(f"    Look: {look}")
            if outfit:
                cast_lines.append(f"    Outfit palette: {outfit}")
            if tags:
                cast_lines.append(f"    Personality: {', '.join(tags)}")
        sections.append("\n".join(cast_lines))

    world = anime_bible.get("world")
    if world:
        world_lines = ["WORLD:"]
        if world.get("setting"):
            world_lines.append(f"  Setting: {world['setting']}")
        if world.get("era"):
            world_lines.append(f"  Era: {world['era']}")
        if world.get("tech_or_magic_level"):
            world_lines.append(f"  Tech/Magic Level: {world['tech_or_magic_level']}")
        rules = world.get("core_rules", [])
        if rules:
            world_lines.append("  WORLD RULES — Your writing MUST NOT violate these:")
            for i, rule in enumerate(rules, 1):
                world_lines.append(f"    {i}. {rule}")
        sections.append("\n".join(world_lines))

    visual = anime_bible.get("visual_style")
    if visual:
        visual_lines = ["VISUAL STYLE:"]
        if visual.get("style_preset"):
            visual_lines.append(f"  Style Preset: {visual['style_preset']}")
        if visual.get("camera_style"):
            visual_lines.append(f"  Camera Style: {visual['camera_style']}")
        if visual.get("color_mood"):
            visual_lines.append(f"  Color Mood: {visual['color_mood']}")
        if visual.get("lighting"):
            visual_lines.append(f"  Lighting: {visual['lighting']}")
        if visual.get("line_style"):
            visual_lines.append(f"  Line Style: {visual['line_style']}")
        tags = visual.get("extra_tags", [])
        if tags:
            visual_lines.append(f"  Tags: {', '.join(tags)}")
        sections.append("\n".join(visual_lines))

    return "\n\n".join(sections)


def _build_bible_context_for_scene(
    character_descriptions: List[str],
    anime_bible: Optional[Dict[str, Any]],
) -> str:
    """Cross-reference a scene's character descriptions with the bible's
    main_cast. For each scene character that matches a bible entry, shows
    the scene description alongside the bible's structured data. Unmatched
    descriptions are included as-is."""
    if not anime_bible or not character_descriptions:
        return ""

    main_cast = anime_bible.get("main_cast", [])
    if not main_cast:
        return ""

    fragments = []
    for desc in character_descriptions:
        desc_lower = desc.lower()
        matched = None
        for member in main_cast:
            name = member.get("name", "")
            if name and name.lower() in desc_lower:
                matched = member
                break

        if matched:
            parts = [f"• Scene description: {desc}"]
            parts.append(f"  Bible entry for {matched.get('name', '?')}:")
            if matched.get("role"):
                parts.append(f"  - Role: {matched['role']}")
            if matched.get("look"):
                parts.append(f"  - Look: {matched['look']}")
            if matched.get("outfit_palette"):
                parts.append(f"  - Outfit palette: {matched['outfit_palette']}")
            if matched.get("personality_tags"):
                parts.append(f"  - Personality: {', '.join(matched['personality_tags'])}")
            if matched.get("age_range"):
                parts.append(f"  - Age: {matched['age_range']}")
            fragments.append("\n".join(parts))
        else:
            fragments.append(f"• {desc}")

    return "\n\n".join(fragments)


class StoryContentMixin(StoryOutlineMixin):
    """Provides story drafting and continuation behaviour."""

    # ------------------------------------------------------------------ #
    # Story start
    # ------------------------------------------------------------------ #

    def generate_story_start(
        self,
        *,
        premise: str,
        outline: Any,
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
        story_length: str = "Medium",
        anime_bible: Optional[Dict[str, Any]] = None,
        user_id: str,
    ) -> str:
        """Generate the starting section (or full short story)."""
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

        anime_bible_context = ""
        if anime_bible:
            formatted_bible = _format_bible_for_prompt(anime_bible)
            anime_bible_context = f"""

You have a detailed ANIME STORY BIBLE that defines the main cast, world rules, and visual style. Use it as a hard constraint for character consistency, worldbuilding, and visual storytelling throughout the story. Pay special attention to the WORLD RULES — your writing must not contradict any of them:

{formatted_bible}
"""

        outline_text = self._format_outline_for_prompt(outline)
        story_length_lower = story_length.lower()
        is_short_story = "short" in story_length_lower or "1000" in story_length_lower

        if is_short_story:
            logger.info(f"[StoryWriter] Generating complete short story (~1000 words) in single call for user {user_id}")
            short_story_prompt = f"""\
{persona_prompt}

You have a gripping premise in mind:

{premise}

Your imagination has crafted a rich narrative outline:

{outline_text}

{anime_bible_context}

**YOUR TASK:**
Write the COMPLETE story from beginning to end. This is a SHORT story, so you need to write the entire narrative in a single response. Before you finish, verify your story does not violate any rule in the WORLD RULES section above.

**STORY LENGTH TARGET:**
- Target: Approximately 1000 words (900-1100 words acceptable)
- This is a SHORT story, so be concise but complete
- Cover all key scenes from your outline
- Provide a satisfying conclusion that addresses all plot elements
- Ensure the story makes sense as a complete narrative

**STORY STRUCTURE:**
1. **Opening**: Establish setting, characters, and initial situation
2. **Development**: Develop the plot, introduce conflicts, build tension
3. **Climax**: Reach the story's peak moment
4. **Resolution**: Resolve conflicts and provide closure

**IMPORTANT INSTRUCTIONS:**
- Write the COMPLETE story in this single response
- Aim for approximately 1000 words (900-1100 words)
- Ensure the story is complete and makes sense as a standalone narrative
- Include all essential elements from your outline
- Provide a satisfying ending that matches the ending preference: {ending_preference}
- Do NOT leave the story incomplete - this is the only generation call for short stories
- Once you've finished the complete story, conclude naturally - do NOT write IAMDONE

**WRITING STYLE:**
{self.guidelines}

**REMEMBER:**
- This is a SHORT story - be concise but complete
- Write the ENTIRE story in this response
- Aim for ~1000 words
- Ensure the story is complete and satisfying
- Cover all key elements from your outline
"""
            try:
                complete_story = self.generate_with_retry(short_story_prompt, user_id=user_id)
                complete_story = complete_story.replace("IAMDONE", "").strip()
                logger.info(
                    f"[StoryWriter] Generated complete short story ({len(complete_story.split())} words) for user {user_id}"
                )
                return complete_story
            except HTTPException:
                raise
            except Exception as exc:
                logger.error(f"Short Story Generation Error: {exc}")
                raise RuntimeError(f"Failed to generate short story: {exc}") from exc

        initial_word_count, _ = self._get_story_length_guidance(story_length)

        starting_prompt = f"""\
{persona_prompt}

You have a gripping premise in mind:

{premise}

Your imagination has crafted a rich narrative outline:

{outline_text}

{anime_bible_context}

First, silently review the outline and the premise. Consider how to start the story.

Check that your planned opening does not violate any WORLD RULES from the anime bible above.

Start to write the very beginning of the story. You are not expected to finish
the whole story now. Your writing should be detailed enough that you are only
scratching the surface of the first bullet of your outline. Try to write AT
MINIMUM {initial_word_count} WORDS.

**STORY LENGTH TARGET:**
This story is targeted to be {story_length}. Write with appropriate detail and pacing
to reach this target length across the entire story. For this initial section, focus
on establishing the setting, characters, and beginning of the plot in {initial_word_count} words.

{self.guidelines}
"""

        try:
            starting_draft = self.generate_with_retry(starting_prompt, user_id=user_id)
            return starting_draft.strip()
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Story Start Generation Error: {exc}")
            raise RuntimeError(f"Failed to generate story start: {exc}") from exc

    # ------------------------------------------------------------------ #
    # Anime scene refinement
    # ------------------------------------------------------------------ #

    def refine_anime_scene_text(
        self,
        *,
        scene: Dict[str, Any],
        persona: str,
        story_setting: str,
        character_input: str,
        plot_elements: str,
        writing_style: str,
        story_tone: str,
        narrative_pov: str,
        audience_age_group: str,
        content_rating: str,
        anime_bible: Optional[Dict[str, Any]],
        user_id: str,
    ) -> Dict[str, Any]:
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
            "Neutral",
        )

        current_title = scene.get("title", "")
        current_description = scene.get("description", "")
        current_image_prompt = scene.get("image_prompt", "")
        current_audio_narration = scene.get("audio_narration", "")
        current_character_descriptions = scene.get("character_descriptions") or []
        current_key_events = scene.get("key_events") or []

        anime_bible_context = ""
        if anime_bible:
            world_visual = _format_bible_for_prompt(anime_bible)
            character_context = _build_bible_context_for_scene(
                current_character_descriptions, anime_bible
            )
            bible_parts = [world_visual]
            if character_context:
                bible_parts.append(
                    "CHARACTERS IN THIS SCENE (scene description matched against bible entry):\n"
                    + character_context
                )
            formatted = "\n\n".join(bible_parts)
            anime_bible_context = f"""

You have a detailed ANIME STORY BIBLE. Use it as a hard constraint — especially the WORLD RULES which your scene must not violate:

{formatted}
"""

        scene_schema: Dict[str, Any] = {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "image_prompt": {"type": "string"},
                "audio_narration": {"type": "string"},
                "character_descriptions": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "key_events": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
            "required": ["title", "description", "image_prompt", "audio_narration"],
        }

        prompt = f"""
{persona_prompt}

You are refining a single anime story scene.

Current scene:
- Title: {current_title}
- Description: {current_description}
- Image prompt: {current_image_prompt}
- Audio narration: {current_audio_narration}
- Character descriptions: {current_character_descriptions}
- Key events: {current_key_events}

{anime_bible_context}

Refine the scene so that:
- Title is concise and evocative
- Description clearly describes what happens in the scene
- Image prompt is vivid, visual, and aligned with the anime bible style and cast
- Audio narration is natural, spoken-friendly text matching the scene
- Character descriptions highlight key visual and personality traits relevant to this moment
- Key events list the main beats of the scene
- The scene does not violate any WORLD RULES from the anime bible above — verify before finalizing

Respond with JSON matching this schema:
{scene_schema}
"""

        try:
            raw = llm_text_gen(
                prompt=prompt.strip(),
                json_struct=scene_schema,
                user_id=user_id,
            )
            data = self.load_json_response(raw)
        except Exception as exc:
            logger.warning(f"[StoryWriter] Failed to refine anime scene text via LLM: {exc}")
            return {
                "scene_number": scene.get("scene_number"),
                "title": current_title,
                "description": current_description,
                "image_prompt": current_image_prompt,
                "audio_narration": current_audio_narration,
                "character_descriptions": current_character_descriptions,
                "key_events": current_key_events,
            }

        refined = {
            "scene_number": scene.get("scene_number"),
            "title": data.get("title", current_title),
            "description": data.get("description", current_description),
            "image_prompt": data.get("image_prompt", current_image_prompt),
            "audio_narration": data.get("audio_narration", current_audio_narration),
            "character_descriptions": data.get(
                "character_descriptions", current_character_descriptions
            ),
            "key_events": data.get("key_events", current_key_events),
        }
        return refined

    # ------------------------------------------------------------------ #
    # Anime scene generation from bible
    # ------------------------------------------------------------------ #

    def generate_anime_scene_from_bible(
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
        anime_bible: Dict[str, Any],
        previous_scenes: Optional[List[Dict[str, Any]]],
        target_scene_number: Optional[int],
        user_id: str,
    ) -> Dict[str, Any]:
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
            "Neutral",
        )

        formatted_bible = _format_bible_for_prompt(anime_bible)
        anime_bible_context = f"""

You have a detailed ANIME STORY BIBLE. You MUST treat it as a hard constraint for character consistency, worldbuilding, and visual storytelling. The WORLD RULES listed below must not be violated by any scene you create:

{formatted_bible}
"""

        previous_summary_lines: List[str] = []
        if previous_scenes:
            for s in previous_scenes[:6]:
                num = s.get("scene_number")
                title = s.get("title") or ""
                desc = s.get("description") or ""
                summary = desc
                if len(summary) > 200:
                    summary = summary[:197] + "..."
                previous_summary_lines.append(
                    f"- Scene {num}: {title} — {summary}".strip()
                )

        previous_block = ""
        if previous_summary_lines:
            previous_block = (
                "\nPrevious scenes so far (for continuity, do NOT contradict):\n"
                + "\n".join(previous_summary_lines)
            )

        scene_schema: Dict[str, Any] = {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "image_prompt": {"type": "string"},
                "audio_narration": {"type": "string"},
                "character_descriptions": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "key_events": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
            "required": ["title", "description", "image_prompt", "audio_narration"],
        }

        prompt = f"""
{persona_prompt}

You are generating a brand new anime story scene.

Overall premise:
{premise}
{previous_block}

{anime_bible_context}

Your task:
- Create the NEXT SCENE in this story.
- It must be consistent with the anime bible (cast, world rules, visual style).
- It must logically follow from any previous scenes given above.

Design the scene so that:
- Title is concise and evocative.
- Description clearly describes what happens in the scene.
- Image prompt is vivid, visual, and aligned with the anime bible style and cast.
- Audio narration is natural, spoken-friendly text matching the scene.
- Character descriptions highlight key visual and personality traits relevant to this moment.
- Key events list the main beats of the scene.
- Verify the scene does not violate any WORLD RULES from the anime bible before finalizing.

Respond with JSON matching this schema:
{scene_schema}
"""

        try:
            raw = llm_text_gen(
                prompt=prompt.strip(),
                json_struct=scene_schema,
                user_id=user_id,
            )
            data = self.load_json_response(raw)
        except Exception as exc:
            logger.error(f"[StoryWriter] Failed to generate anime scene from bible: {exc}")
            raise RuntimeError(f"Failed to generate anime scene from bible: {exc}") from exc

        next_scene_number = target_scene_number
        if next_scene_number is None:
            if previous_scenes and len(previous_scenes) > 0:
                last = previous_scenes[-1]
                try:
                    last_num = int(last.get("scene_number") or 0)
                except Exception:
                    last_num = len(previous_scenes)
                next_scene_number = last_num + 1
            else:
                next_scene_number = 1

        result = {
            "scene_number": next_scene_number,
            "title": data.get("title", "").strip(),
            "description": data.get("description", "").strip(),
            "image_prompt": data.get("image_prompt", "").strip(),
            "audio_narration": data.get("audio_narration", "").strip(),
            "character_descriptions": data.get("character_descriptions") or [],
            "key_events": data.get("key_events") or [],
        }
        return result

    # ------------------------------------------------------------------ #
    # Continuation
    # ------------------------------------------------------------------ #

    def continue_story(
        self,
        *,
        premise: str,
        outline: Any,
        story_text: str,
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
        anime_bible: Optional[Dict[str, Any]] = None,
        story_length: str = "Medium",
        user_id: str,
    ) -> str:
        """Continue writing the story."""
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

        anime_bible_context = ""
        if anime_bible:
            formatted_bible = _format_bible_for_prompt(anime_bible)
            anime_bible_context = f"""

You have a detailed ANIME STORY BIBLE that defines the main cast, world rules, and visual style. Use it as a hard constraint for character consistency, worldbuilding, and visual storytelling throughout the story. The WORLD RULES section must not be violated by any writing you produce:

{formatted_bible}
"""

        outline_text = self._format_outline_for_prompt(outline)
        _, continuation_word_count = self._get_story_length_guidance(story_length)
        current_word_count = len(story_text.split()) if story_text else 0

        story_length_lower = story_length.lower()
        if "short" in story_length_lower or "1000" in story_length_lower:
            # Safety check: short stories shouldn't reach here
            return "IAMDONE"

        if "long" in story_length_lower or "10000" in story_length_lower:
            target_total_words = 10000
        else:
            target_total_words = 4500

        buffer_target = int(target_total_words * 1.05)

        if current_word_count >= buffer_target:
            logger.info(
                f"[StoryWriter] Word count ({current_word_count}) at or past buffer target ({buffer_target}). Story is complete."
            )
            return "IAMDONE"

        if current_word_count >= target_total_words and (current_word_count - target_total_words) < 50:
            logger.info(
                f"[StoryWriter] Word count ({current_word_count}) is very close to target ({target_total_words}). Story is complete."
            )
            return "IAMDONE"

        remaining_words = max(0, buffer_target - current_word_count)
        if remaining_words < 50:
            logger.info(f"[StoryWriter] Remaining words ({remaining_words}) are minimal. Story is complete.")
            return "IAMDONE"

        continuation_prompt = f"""\
{persona_prompt}

You have a gripping premise in mind:

{premise}

Your imagination has crafted a rich narrative outline:

{outline_text}

You've begun to immerse yourself in this world, and the words are flowing.
Here's what you've written so far:

{story_text}

{anime_bible_context}

=====

First, silently review the outline and story so far. Identify what the single
next part of your outline you should write. Also verify that everything written so far is consistent with the WORLD RULES above.

Your task is to continue where you left off and write the next part of the story. Ensure this continuation does not violate any WORLD RULES.
You are not expected to finish the whole story now. Your writing should be
detailed enough that you are only scratching the surface of the next part of
your outline. Try to write AT MINIMUM {continuation_word_count} WORDS.

**STORY LENGTH TARGET:**
This story is targeted to be {story_length} (target: {target_total_words} words total, with 5% buffer allowed).
You have written approximately {current_word_count} words so far, leaving approximately
{remaining_words} words remaining.

**CRITICAL INSTRUCTIONS - READ CAREFULLY:**
1. Write the next section with appropriate detail, aiming for approximately {min(continuation_word_count, remaining_words)} words.
2. **STOP CONDITION:** If after writing this continuation, the total word count will reach or exceed {target_total_words} words, you MUST conclude the story immediately by writing IAMDONE.
3. The story should reach a natural conclusion that addresses all plot elements and provides satisfying closure.
4. Once you've written IAMDONE, do NOT write any more content - stop immediately.

**WORD COUNT LIMIT:**
- Target: {target_total_words} words total (with 5% buffer: {int(target_total_words * 1.05)} words maximum)
- Current word count: {current_word_count} words
- Remaining words: {remaining_words} words
- **CRITICAL: If your continuation would bring the total to {target_total_words} words or more, conclude the story NOW and write IAMDONE.**
- **Do NOT exceed {int(target_total_words * 1.05)} words. This is a hard limit.**
- **Ensure the story is complete and makes sense when you write IAMDONE.**

{self.guidelines}
"""

        try:
            continuation = self.generate_with_retry(continuation_prompt, user_id=user_id)
            return continuation.strip()
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Story Continuation Error: {exc}")
            raise RuntimeError(f"Failed to continue story: {exc}") from exc

    # ------------------------------------------------------------------ #
    # Full generation orchestration
    # ------------------------------------------------------------------ #

    def generate_full_story(
        self,
        *,
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
        anime_bible: Optional[Dict[str, Any]] = None,
        user_id: str,
        max_iterations: int = 10,
    ) -> Dict[str, Any]:
        """Generate a complete story using prompt chaining."""
        try:
            logger.info(f"[StoryWriter] Generating premise for user {user_id}")
            premise = self.generate_premise(
                persona=persona,
                story_setting=story_setting,
                character_input=character_input,
                plot_elements=plot_elements,
                writing_style=writing_style,
                story_tone=story_tone,
                narrative_pov=narrative_pov,
                audience_age_group=audience_age_group,
                content_rating=content_rating,
                ending_preference=ending_preference,
                user_id=user_id,
            )
            if not premise:
                raise RuntimeError("Failed to generate premise")

            logger.info(f"[StoryWriter] Generating outline for user {user_id}")
            outline = self.generate_outline(
                premise=premise,
                persona=persona,
                story_setting=story_setting,
                character_input=character_input,
                plot_elements=plot_elements,
                writing_style=writing_style,
                story_tone=story_tone,
                narrative_pov=narrative_pov,
                audience_age_group=audience_age_group,
                content_rating=content_rating,
                ending_preference=ending_preference,
                user_id=user_id,
            )
            if not outline:
                raise RuntimeError("Failed to generate outline")

            logger.info(f"[StoryWriter] Generating story start for user {user_id}")
            draft = self.generate_story_start(
                premise=premise,
                outline=outline,
                persona=persona,
                story_setting=story_setting,
                character_input=character_input,
                plot_elements=plot_elements,
                writing_style=writing_style,
                story_tone=story_tone,
                narrative_pov=narrative_pov,
                audience_age_group=audience_age_group,
                content_rating=content_rating,
                ending_preference=ending_preference,
                anime_bible=anime_bible,
                user_id=user_id,
            )
            if not draft:
                raise RuntimeError("Failed to generate story start")

            iteration = 0
            while "IAMDONE" not in draft and iteration < max_iterations:
                iteration += 1
                logger.info(f"[StoryWriter] Continuation iteration {iteration}/{max_iterations}")
                continuation = self.continue_story(
                    premise=premise,
                    outline=outline,
                    story_text=draft,
                    persona=persona,
                    story_setting=story_setting,
                    character_input=character_input,
                    plot_elements=plot_elements,
                    writing_style=writing_style,
                    story_tone=story_tone,
                    narrative_pov=narrative_pov,
                    audience_age_group=audience_age_group,
                    content_rating=content_rating,
                    ending_preference=ending_preference,
                    anime_bible=anime_bible,
                    user_id=user_id,
                )
                if continuation:
                    draft += "\n\n" + continuation
                else:
                    logger.warning(f"[StoryWriter] Empty continuation at iteration {iteration}")
                    break

            final_story = draft.replace("IAMDONE", "").strip()

            outline_response = outline
            if isinstance(outline, list):
                outline_response = "\n".join(
                    [
                        f"Scene {scene.get('scene_number', idx + 1)}: {scene.get('title', 'Untitled')}\n"
                        f"  {scene.get('description', '')}"
                        for idx, scene in enumerate(outline)
                    ]
                )

            return {
                "premise": premise,
                "outline": str(outline_response),
                "story": final_story,
                "iterations": iteration,
                "is_complete": "IAMDONE" in draft or iteration >= max_iterations,
            }
        except Exception as exc:
            logger.error(f"[StoryWriter] Error generating full story: {exc}")
            raise RuntimeError(f"Failed to generate full story: {exc}") from exc

    # ------------------------------------------------------------------ #
    # Multimedia helpers
    # ------------------------------------------------------------------ #

    def generate_scene_images(
        self,
        *,
        scenes: List[Dict[str, Any]],
        user_id: str,
        provider: Optional[str] = None,
        width: int = 1024,
        height: int = 1024,
        model: Optional[str] = None,
        db: Optional[Session] = None,
        anime_bible: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Generate images for story scenes."""
        image_service = StoryImageGenerationService()
        return image_service.generate_scene_images(
            scenes=scenes,
            user_id=user_id,
            provider=provider,
            width=width,
            height=height,
            model=model,
            db=db,
            anime_bible=anime_bible,
        )


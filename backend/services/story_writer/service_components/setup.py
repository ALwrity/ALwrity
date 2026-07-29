"""Story setup generation helpers."""

from __future__ import annotations

import json
from typing import Any, Dict, List

from fastapi import HTTPException
from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen

from .base import StoryServiceBase


class StorySetupMixin(StoryServiceBase):
    """Provides story setup generation behaviour."""

    def generate_premise(
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
        user_id: str,
    ) -> str:
        """Generate a story premise."""
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

        premise_prompt = f"""\
{persona_prompt}

{parameter_guidance}

**TASK: Write a SINGLE, BRIEF premise sentence (1-2 sentences maximum, approximately 20-40 words) for this story.**

The premise MUST:
1. Be written in the specified {writing_style} writing style
   - Interpret and apply this style appropriately for {audience_age_group}
   - Match the language complexity, sentence structure, and narrative approach of this style
2. Match the {story_tone} story tone exactly
   - Express the emotional atmosphere and mood indicated by this tone
   - Ensure the tone is age-appropriate for {audience_age_group}
3. Be appropriate for {audience_age_group} with {content_rating} content rating
   - Use language complexity that matches this audience's reading level
   - Use vocabulary that is understandable to this age group
   - Present concepts that are relatable and explainable to this audience
   - Respect the {content_rating} content rating boundaries
4. Briefly describe the story elements:
   - Setting: {story_setting}
   - Characters: {character_input}
   - Main plot: {plot_elements}
5. Be clear, engaging, and set up the story without telling the whole story
6. Be written from the {narrative_pov} point of view
7. Set up for a {ending_preference} ending

**CRITICAL: This is a PREMISE, not the full story.**
- Keep it to 1-2 sentences maximum (approximately 20-40 words)
- Do NOT write the full story or multiple paragraphs
- Do NOT reveal the resolution or ending
- Focus on the setup: who, where, and what the main challenge/adventure is
- Use ALL story setup parameters to guide your language and content choices
- Tailor every word to the target audience ({audience_age_group}) and writing style ({writing_style})

Write ONLY the premise sentence(s). Do not write anything else.
"""

        try:
            premise = self.generate_with_retry(premise_prompt, user_id=user_id).strip()
            sentences = premise.split(". ")
            if len(sentences) > 2:
                premise = ". ".join(sentences[:2])
                if not premise.endswith("."):
                    premise += "."
            return premise
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Premise Generation Error: {exc}")
            raise RuntimeError(f"Failed to generate premise: {exc}") from exc

    # ------------------------------------------------------------------ #
    # Setup options
    # ------------------------------------------------------------------ #

    def _build_setup_schema(self) -> Dict[str, Any]:
        """Return JSON schema for structured setup options."""
        return {
            "type": "object",
            "properties": {
                "options": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "persona": {"type": "string"},
                            "story_setting": {"type": "string"},
                            "character_input": {"type": "string"},
                            "plot_elements": {"type": "string"},
                            "writing_style": {"type": "string"},
                            "story_tone": {"type": "string"},
                            "narrative_pov": {"type": "string"},
                            "audience_age_group": {"type": "string"},
                            "content_rating": {"type": "string"},
                            "ending_preference": {"type": "string"},
                            "story_length": {"type": "string"},
                            "premise": {"type": "string"},
                            "reasoning": {"type": "string"},
                        },
                        "required": [
                            "persona",
                            "story_setting",
                            "character_input",
                            "plot_elements",
                            "writing_style",
                            "story_tone",
                            "narrative_pov",
                            "audience_age_group",
                            "content_rating",
                            "ending_preference",
                            "story_length",
                            "premise",
                            "reasoning",
                        ],
                    },
                    "minItems": 1,
                    "maxItems": 1,
                }
            },
            "required": ["options"],
        }

    def _build_idea_enhance_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "idea": {"type": "string"},
                            "whats_missing": {"type": "string"},
                            "why_choose": {"type": "string"},
                        },
                        "required": ["idea", "whats_missing", "why_choose"],
                    },
                    "minItems": 3,
                    "maxItems": 3,
                }
            },
            "required": ["suggestions"],
        }

    def generate_story_setup_options(
        self,
        *,
        story_idea: str,
        story_mode: str | None,
        story_template: str | None,
        brand_context: Dict[str, Any] | None,
        user_id: str,
    ) -> List[Dict[str, Any]]:
        """Generate a single story setup option from a user's story idea."""

        suggested_writing_styles = ['Formal', 'Casual', 'Poetic', 'Humorous', 'Academic', 'Journalistic', 'Narrative']
        suggested_story_tones = ['Dark', 'Uplifting', 'Suspenseful', 'Whimsical', 'Melancholic', 'Mysterious', 'Romantic', 'Adventurous']
        suggested_narrative_povs = ['First Person', 'Third Person Limited', 'Third Person Omniscient']
        suggested_audience_age_groups = ['Children (5-12)', 'Young Adults (13-17)', 'Adults (18+)', 'All Ages']
        suggested_content_ratings = ['G', 'PG', 'PG-13', 'R']
        suggested_ending_preferences = ['Happy', 'Tragic', 'Cliffhanger', 'Twist', 'Open-ended', 'Bittersweet']

        mode_label = None
        if story_mode == "marketing":
            mode_label = "Non-fiction marketing story (brand or product campaign)"
        elif story_mode == "pure":
            mode_label = "Fiction story"

        template_label = None
        if story_template == "product_story":
            template_label = "Product Story"
        elif story_template == "brand_manifesto":
            template_label = "Brand Manifesto"
        elif story_template == "founder_story":
            template_label = "Founder Story"
        elif story_template == "customer_story":
            template_label = "Customer Story"
        elif story_template == "short_fiction":
            template_label = "Short Fiction"
        elif story_template == "long_fiction":
            template_label = "Long Fiction"
        elif story_template == "anime_fiction":
            template_label = "Anime Fiction"
        elif story_template == "experimental_fiction":
            template_label = "Experimental Fiction"

        brand_name = None
        writing_tone = None
        audience_description = None
        if isinstance(brand_context, dict):
            brand_name = brand_context.get("brand_name")
            writing_tone = brand_context.get("writing_tone")
            target_audience = brand_context.get("target_audience")
            if isinstance(target_audience, dict):
                audience_description = target_audience.get("description") or target_audience.get("summary")
            elif isinstance(target_audience, str):
                audience_description = target_audience

        setup_prompt = f"""\
You are an expert story writer and creative writing assistant.

{"This is a " + mode_label + "." if mode_label else ""}
{("The user selected the template: " + template_label + ".") if template_label else ""}

The story should stay consistent with the brand and audience context below when relevant:

- Brand name or site: {brand_name or "Not specified"}
- Headline/overall writing tone: {writing_tone or "Not specified"}
- Audience description: {audience_description or "Not specified"}

The user has provided the following story idea or information:

{story_idea}

Based on this story idea, generate exactly 1 well-thought-out story setup option. The setup should be CREATIVE, PERSONALIZED, and perfectly tailored to the user's specific story idea.

**CRITICAL - Pick from pre-defined values for these 6 dropdown fields:**
The six fields below are presented to the user as dropdown menus with fixed options.
The user clicks a dropdown and selects one of the listed values. To ensure the chosen
value actually shows up in that dropdown, you MUST return EXACTLY one of the listed
strings (case-sensitive, including any parentheticals). Do NOT invent synonyms,
hyphenated variants, or multi-word refinements for these six — they will not match
the dropdown and the value will appear lost to the user.

1. writing_style — pick EXACTLY one of: {', '.join(suggested_writing_styles)}
2. story_tone — pick EXACTLY one of: {', '.join(suggested_story_tones)}
3. narrative_pov — pick EXACTLY one of: {', '.join(suggested_narrative_povs)}
4. audience_age_group — pick EXACTLY one of: {', '.join(suggested_audience_age_groups)}
5. content_rating — pick EXACTLY one of: {', '.join(suggested_content_ratings)}
6. ending_preference — pick EXACTLY one of: {', '.join(suggested_ending_preferences)}
7. story_length — pick EXACTLY one of: "Short (>1000 words)", "Medium (>5000 words)", "Long (>10000 words)" (include the parenthetical verbatim)

Choose the value from each list that best serves the story idea. The list entries are
the only acceptable values for these six fields.

The TEXTUAL fields below still allow full creative freedom — make these vivid,
specific, and tailored to the story:
- persona: a unique and creative author persona that fits the story idea perfectly
- story_setting: a compelling world/setting that brings the idea to life
- character_input: interesting and engaging characters
- plot_elements: key plot elements that drive the narrative

The setup should:
1. Have a unique and creative persona that fits the story idea perfectly
2. Define a compelling story setting that brings the idea to life
3. Describe interesting and engaging characters
4. Include key plot elements that drive the narrative
5. Pick canonical values from the six dropdown lists above that best serve the story idea
6. Select an appropriate story length from the three allowed values above
7. Generate a brief story premise (1-2 sentences, approximately 20-40 words) that summarizes the story concept
8. Provide a brief reasoning (2-3 sentences) explaining why this setup works well for the story idea

**IMPORTANT - Premise Requirements:**
- The premise MUST be age-appropriate for the selected audience_age_group
- For Children (5-12): Use simple, everyday words. Avoid complex vocabulary like "nebular", "ionized", "cosmic", "stellar", "melancholic", "bittersweet"
- The premise MUST match the selected writing_style (e.g., if you chose "Poetic", use lyrical imagery)
- The premise MUST match the selected story_tone (e.g., if you chose "Whimsical", create a sense of whimsy)
- Keep the premise to 1-2 sentences maximum
- Focus on who, where, and what the main challenge/adventure is

**Final reminder:** Output ONLY exact dropdown values for the 7 numbered fields above. Mismatched values (different casing, missing parentheticals, paraphrased synonyms) will not display for the user and waste the generation.

Return exactly 1 option as a JSON array with a single object in "options". The object must include a "premise" field with the story premise.
"""

        setup_schema = self._build_setup_schema()

        try:
            logger.info(f"[StoryWriter] Generating story setup option for user {user_id}")
            response = self.load_json_response(
                llm_text_gen(prompt=setup_prompt, json_struct=setup_schema, user_id=user_id)
            )

            options = response.get("options", [])
            if len(options) != 1:
                logger.warning(f"[StoryWriter] Expected 1 option but got {len(options)}, correcting count")
                if len(options) < 1:
                    raise ValueError(f"Expected 1 option but got {len(options)}")
                options = options[:1]

            for idx, option in enumerate(options):
                if not option.get("premise") or not option.get("premise", "").strip():
                    logger.info(f"[StoryWriter] Generating premise for option {idx + 1}")
                    try:
                        option["premise"] = self.generate_premise(
                            persona=option.get("persona", ""),
                            story_setting=option.get("story_setting", ""),
                            character_input=option.get("character_input", ""),
                            plot_elements=option.get("plot_elements", ""),
                            writing_style=option.get("writing_style", "Narrative"),
                            story_tone=option.get("story_tone", "Adventurous"),
                            narrative_pov=option.get("narrative_pov", "Third Person Limited"),
                            audience_age_group=option.get("audience_age_group", "All Ages"),
                            content_rating=option.get("content_rating", "G"),
                            ending_preference=option.get("ending_preference", "Happy"),
                            user_id=user_id,
                        )
                    except Exception as exc:  # pragma: no cover - fallback clause
                        logger.warning(f"[StoryWriter] Failed to generate premise for option {idx + 1}: {exc}")
                        option["premise"] = (
                            f"A {option.get('story_setting', 'story')} story featuring "
                            f"{option.get('character_input', 'characters')}."
                        )
                else:
                    premise = option["premise"].strip()
                    sentences = premise.split(". ")
                    if len(sentences) > 2:
                        premise = ". ".join(sentences[:2])
                        if not premise.endswith("."):
                            premise += "."
                    option["premise"] = premise

            logger.info(f"[StoryWriter] Generated {len(options)} story setup option(s) with premise for user {user_id}")
            return options
        except HTTPException:
            raise
        except json.JSONDecodeError as exc:
            logger.error(f"[StoryWriter] Failed to parse JSON response for story setup: {exc}")
            raise RuntimeError(f"Failed to parse story setup options: {exc}") from exc
        except Exception as exc:
            logger.error(f"[StoryWriter] Error generating story setup options: {exc}")
            raise RuntimeError(f"Failed to generate story setup options: {exc}") from exc

    def enhance_story_idea(
        self,
        *,
        story_idea: str,
        story_mode: str | None,
        story_template: str | None,
        brand_context: Dict[str, Any] | None,
        user_id: str,
        fiction_variant: str | None = None,
        narrative_energy: str | None = None,
        fiction_variant_description: str | None = None,
        narrative_energy_description: str | None = None,
    ) -> List[Dict[str, Any]]:
        mode_label = None
        if story_mode == "marketing":
            mode_label = "Non-fiction marketing story (brand or product campaign)"
        elif story_mode == "pure":
            mode_label = "Fiction story"

        template_label = None
        template_guidance = ""
        if story_template == "product_story":
            template_label = "Product Story"
        elif story_template == "brand_manifesto":
            template_label = "Brand Manifesto"
        elif story_template == "founder_story":
            template_label = "Founder Story"
        elif story_template == "customer_story":
            template_label = "Customer Story"
        elif story_template == "short_fiction":
            template_label = "Short Fiction"
            template_guidance = "Focus on a single, tightly-focused narrative arc that delivers impact within a compressed format. Every word must earn its place."
        elif story_template == "long_fiction":
            template_label = "Long Fiction"
            template_guidance = "Consider broader narrative scope with room for subplots, character arcs that evolve across time, and immersive worldbuilding."
        elif story_template == "anime_fiction":
            template_label = "Anime Fiction"
            template_guidance = "Draw from anime and manga storytelling conventions: expressive character dynamics, stylized action, emotional sincerity, and distinct visual storytelling."
        elif story_template == "experimental_fiction":
            template_label = "Experimental Fiction"
            template_guidance = "Embrace unconventional narrative structures, unusual points of view, and formal playfulness. The form itself is part of the story."

        brand_name = None
        writing_tone = None
        audience_description = None
        if isinstance(brand_context, dict):
            brand_name = brand_context.get("brand_name")
            writing_tone = brand_context.get("writing_tone")
            target_audience = brand_context.get("target_audience")
            if isinstance(target_audience, dict):
                audience_description = target_audience.get("description") or target_audience.get("summary")
            elif isinstance(target_audience, str):
                audience_description = target_audience

        fiction_focus_line = ""
        if fiction_variant:
            variant_parts = [f'Treat the story as "{fiction_variant}".']
            if fiction_variant_description:
                variant_parts.append(f"Creative direction: {fiction_variant_description}")
            fiction_focus_line = " ".join(variant_parts)

        energy_line = ""
        if narrative_energy:
            energy_parts = [f"Target narrative energy: {narrative_energy}."]
            if narrative_energy_description:
                energy_parts.append(f"Pacing and tone: {narrative_energy_description}")
            energy_line = " ".join(energy_parts)

        brand_section = ""
        if story_mode == "marketing" and brand_name:
            brand_section = f"""
The story MUST be aligned with the following brand and audience context:
- Brand name or site: {brand_name or "Not specified"}
- Headline/overall writing tone: {writing_tone or "Not specified"}
- Audience description: {audience_description or "Not specified"}

The enhanced ideas should reinforce the brand voice, resonate with the target audience, and serve the brand's marketing or storytelling goals."""
        elif brand_context:
            brand_section = f"""
When relevant, keep the idea loosely aligned with this brand and audience context:
- Brand name or site: {brand_name or "Not specified"}
- Headline/overall writing tone: {writing_tone or "Not specified"}
- Audience description: {audience_description or "Not specified"}"""

        enhance_prompt = f"""You are a creative writing coach helping a user refine and expand a story idea.

{"This is a " + mode_label + "." if mode_label else ""}
{("The user selected the template: " + template_label + ".") if template_label else ""}
{template_guidance}
{fiction_focus_line}
{energy_line}
{brand_section}

The user has written the following story idea or concept:

{story_idea}

Your task is to propose exactly 3 alternative enhanced story idea options. Each option should take a DISTINCT creative direction — do not offer three variations of the same approach. Make each option meaningfully different in its focus, tone, or narrative strategy.

Each option must:
- Preserve the user's core premise and intent.
- Make the premise clearer and more compelling.
- Surface the central conflict or tension.
- Clarify the main characters and their goals.
- Strengthen the setting and stakes.
- Stay at the "idea" level, not a full outline or beat-by-beat breakdown.

For each option, return three fields:
- "idea": 2-4 sentences describing the improved story idea, suitable for pasting into a story idea input field. Make it vivid and specific.
- "whats_missing": 2-4 sentences identifying specific gaps in the original idea. Cover areas such as: protagonist motivation, antagonist or opposing force, concrete stakes, setting and time period, target audience or age group, subgenre conventions, language or tone preferences, and format constraints. Be precise and actionable.
- "why_choose": 1-3 sentences explaining how this option interprets the original idea differently from the other options and why it might be a strong direction.

Do not write a full story outline.
Do not output numbered lists or markdown formatting.

Return a single JSON object with a "suggestions" array of 3 items, where each item has the keys "idea", "whats_missing", and "why_choose"."""

        schema = self._build_idea_enhance_schema()

        try:
            logger.info(f"[StoryWriter] Enhancing story idea with structured suggestions for user {user_id}")
            response = self.load_json_response(
                llm_text_gen(prompt=enhance_prompt, json_struct=schema, user_id=user_id)
            )
            suggestions = response.get("suggestions", [])
            if len(suggestions) != 3:
                logger.warning(
                    f"[StoryWriter] Expected 3 idea suggestions but got {len(suggestions)}, correcting count"
                )
                if len(suggestions) < 3:
                    raise ValueError(f"Expected 3 suggestions but got {len(suggestions)}")
                suggestions = suggestions[:3]
            return suggestions
        except HTTPException:
            raise
        except json.JSONDecodeError as exc:
            logger.error(f"[StoryWriter] Failed to parse JSON response for story idea enhancement: {exc}")
            raise RuntimeError(f"Failed to parse story idea enhancement suggestions: {exc}") from exc
        except Exception as exc:
            logger.error(f"[StoryWriter] Error enhancing story idea: {exc}")
            raise RuntimeError(f"Failed to enhance story idea: {exc}") from exc


"""
YouTube Video Planner Service

Generates video plans, outlines, and insights using AI with persona integration.
Supports optional Exa research for enhanced, data-driven plans.
"""

from typing import Dict, Any, Optional, List
from loguru import logger
from fastapi import HTTPException
import os

from services.llm_providers.main_text_generation import llm_text_gen
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.planner")

# Video type configurations for optimization
VIDEO_TYPE_CONFIGS = {
    "tutorial": {
        "hook_strategy": "Problem statement or quick preview of solution",
        "structure": "Problem → Steps → Result → Key Takeaways",
        "visual_style": "Clean, instructional, screen-recordings or clear demonstrations",
        "tone": "Clear, patient, instructional",
        "optimal_scenes": "2-6 scenes showing sequential steps",
        "avatar_style": "Approachable instructor, professional yet friendly",
        "cta_focus": "Subscribe for more tutorials, try it yourself"
    },
    "review": {
        "hook_strategy": "Product reveal or strong opinion statement",
        "structure": "Hook → Overview → Pros/Cons → Verdict → CTA",
        "visual_style": "Product-focused, close-ups, comparison shots",
        "tone": "Honest, engaging, opinionated but fair",
        "optimal_scenes": "4-8 scenes covering different aspects",
        "avatar_style": "Trustworthy reviewer, confident, credible",
        "cta_focus": "Check links in description, subscribe for reviews"
    },
    "educational": {
        "hook_strategy": "Intriguing question or surprising fact",
        "structure": "Question → Explanation → Examples → Conclusion",
        "visual_style": "Illustrative, concept visualization, animations",
        "tone": "Authoritative yet accessible, engaging",
        "optimal_scenes": "3-10 scenes breaking down concepts",
        "avatar_style": "Knowledgeable educator, professional, warm",
        "cta_focus": "Learn more, subscribe for educational content"
    },
    "entertainment": {
        "hook_strategy": "Grab attention immediately with energy/humor",
        "structure": "Hook → Setup → Payoff → Share/Subscribe",
        "visual_style": "Dynamic, energetic, varied angles, transitions",
        "tone": "High energy, funny, engaging, personality-driven",
        "optimal_scenes": "3-8 scenes with varied pacing",
        "avatar_style": "Energetic creator, expressive, relatable",
        "cta_focus": "Like, share, subscribe for more fun content"
    },
    "vlog": {
        "hook_strategy": "Preview of day/event or personal moment",
        "structure": "Introduction → Journey/Experience → Reflection → CTA",
        "visual_style": "Natural, personal, authentic moments",
        "tone": "Conversational, authentic, relatable",
        "optimal_scenes": "5-15 scenes following narrative",
        "avatar_style": "Authentic person, approachable, real",
        "cta_focus": "Follow my journey, subscribe for daily updates"
    },
    "product_demo": {
        "hook_strategy": "Product benefit or transformation",
        "structure": "Benefit → Features → Use Cases → CTA",
        "visual_style": "Product-focused, polished, commercial quality",
        "tone": "Enthusiastic, persuasive, benefit-focused",
        "optimal_scenes": "3-7 scenes highlighting features",
        "avatar_style": "Professional presenter, polished, confident",
        "cta_focus": "Get it now, learn more, special offer"
    },
    "reaction": {
        "hook_strategy": "Preview of reaction or content being reacted to",
        "structure": "Setup → Reaction → Commentary → CTA",
        "visual_style": "Split-screen or picture-in-picture, expressive",
        "tone": "Authentic reactions, engaging commentary",
        "optimal_scenes": "4-10 scenes with reactions",
        "avatar_style": "Expressive creator, authentic reactions",
        "cta_focus": "Watch full video, subscribe for reactions"
    },
    "storytelling": {
        "hook_strategy": "Intriguing opening or compelling question",
        "structure": "Hook → Setup → Conflict → Resolution → CTA",
        "visual_style": "Cinematic, narrative-driven, emotional",
        "tone": "Engaging, immersive, story-focused",
        "optimal_scenes": "6-15 scenes following narrative arc",
        "avatar_style": "Storyteller, warm, engaging narrator",
        "cta_focus": "Subscribe for more stories, share your thoughts"
    }
}


class YouTubePlannerService:
    """Service for planning YouTube videos with AI assistance."""
    
    def __init__(self):
        """Initialize the planner service."""
        logger.info("[YouTubePlanner] Service initialized")
    
    async def generate_plan(
        self,
        user_idea: str,
        duration_type: str,  # "shorts", "medium", "long"
        video_type: Optional[str] = None,  # "tutorial", "review", etc.
        target_audience: Optional[str] = None,
        video_goal: Optional[str] = None,
        brand_style: Optional[str] = None,
        persona_data: Optional[Dict[str, Any]] = None,
        reference_image_description: Optional[str] = None,
        source_content_id: Optional[str] = None,  # For blog/story conversion
        source_content_type: Optional[str] = None,  # "blog", "story"
        user_id: str = None,
        avatar_url: Optional[str] = None,
        include_scenes: bool = False,  # For shorts: combine plan + scenes in one call
        enable_research: bool = True,  # Always enable research by default for enhanced plans
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive video plan from user input.
        
        Args:
            user_idea: User's video idea or topic
            duration_type: "shorts" (≤60s), "medium" (1-4min), "long" (4-10min)
            video_type: Optional video format type (tutorial, review, etc.)
            target_audience: Optional target audience description
            video_goal: Optional primary goal of the video
            brand_style: Optional brand aesthetic preferences
            persona_data: Optional persona data for tone/style
            reference_image_description: Optional description of reference image
            source_content_id: Optional ID of source content (blog/story)
            source_content_type: Type of source content
            user_id: Clerk user ID for subscription checking
            
        Returns:
            Dictionary with video plan, outline, insights, and metadata
        """
        try:
            logger.info(
                f"[YouTubePlanner] Generating plan: idea={user_idea[:50]}..., "
                f"duration={duration_type}, video_type={video_type}, user={user_id}"
            )
            
            # Get video type config
            video_type_config = {}
            if video_type and video_type in VIDEO_TYPE_CONFIGS:
                video_type_config = VIDEO_TYPE_CONFIGS[video_type]
            
            # Build persona context
            persona_context = self._build_persona_context(persona_data)
            
            # Build duration context
            duration_context = self._get_duration_context(duration_type)
            
            # Build source content context if provided
            source_context = ""
            if source_content_id and source_content_type:
                source_context = f"""
**Source Content:**
- Type: {source_content_type}
- ID: {source_content_id}
- Note: This video should be based on the existing {source_content_type} content.
"""
            
            # Build reference image context
            image_context = ""
            if reference_image_description:
                image_context = f"""
**Reference Image:**
{reference_image_description}
- Use this as visual inspiration for the video
"""
            
            # Generate smart defaults based on video type if selected
            # When video_type is selected, use its config for defaults; otherwise use user inputs or generic defaults
            if video_type_config:
                default_tone = video_type_config.get('tone', 'Professional and engaging')
                default_visual_style = video_type_config.get('visual_style', 'Professional and engaging')
                default_goal = video_goal or f"Create engaging {video_type} content"
                default_audience = target_audience or f"Viewers interested in {video_type} content"
            else:
                # No video type selected - use user inputs or generic defaults
                default_tone = 'Professional and engaging'
                default_visual_style = 'Professional and engaging'
                default_goal = video_goal or 'Engage and inform viewers'
                default_audience = target_audience or 'General YouTube audience'
            
            # Perform Exa research if enabled (after defaults are set)
            research_context = ""
            research_sources = []
            research_enabled = False
            if enable_research:
                logger.info(f"[YouTubePlanner] 🔍 Starting Exa research for plan generation (idea: {user_idea[:50]}...)")
                research_enabled = True
                try:
                    research_context, research_sources = await self._perform_exa_research(
                        user_idea=user_idea,
                        video_type=video_type,
                        target_audience=default_audience,
                        user_id=user_id
                    )
                    if research_sources:
                        logger.info(
                            f"[YouTubePlanner] ✅ Exa research completed successfully: "
                            f"{len(research_sources)} sources found. Research context length: {len(research_context)} chars"
                        )
                    else:
                        logger.warning(f"[YouTubePlanner] ⚠️ Exa research completed but no sources returned")
                except HTTPException as http_ex:
                    # Subscription limit exceeded or other HTTP errors
                    error_detail = http_ex.detail
                    if isinstance(error_detail, dict):
                        error_msg = error_detail.get("message", error_detail.get("error", str(http_ex)))
                    else:
                        error_msg = str(error_detail)
                    logger.warning(
                        f"[YouTubePlanner] ⚠️ Exa research skipped due to subscription limits or error: {error_msg} "
                        f"(status={http_ex.status_code}). Continuing without research."
                    )
                    # Continue without research - non-critical failure
                except Exception as e:
                    error_msg = str(e)
                    logger.warning(
                        f"[YouTubePlanner] ⚠️ Exa research failed (non-critical): {error_msg}. "
                        f"Continuing without research."
                    )
                    # Continue without research - non-critical failure
            else:
                logger.info(f"[YouTubePlanner] ℹ️ Exa research disabled for this plan generation")
            
            # Generate comprehensive video plan
            video_type_context = ""
            if video_type_config:
                video_type_context = f"""
**Video Type: {video_type}**
Follow these guidelines:
- Structure: {video_type_config.get('structure', '')}
- Hook: {video_type_config.get('hook_strategy', '')}
- Visual: {video_type_config.get('visual_style', '')}
- Tone: {video_type_config.get('tone', '')}
- CTA: {video_type_config.get('cta_focus', '')}
"""
            
            planning_prompt = f"""Create a YouTube video plan for: "{user_idea}"

**Video Format:** {video_type or 'General'} | **Duration:** {duration_type} ({duration_context['target_seconds']}s target)
**Audience:** {default_audience}
**Goal:** {default_goal}
**Style:** {brand_style or default_visual_style}

{video_type_context}

**Constraints:**
- Duration: {duration_context['target_seconds']}s (Hook: {duration_context['hook_seconds']}s, Main: {duration_context['main_seconds']}s, CTA: {duration_context['cta_seconds']}s)
- Max scenes: {duration_context['max_scenes']}

{persona_context if persona_data else ""}
{source_context if source_content_id else ""}
{image_context if reference_image_description else ""}
{research_context if research_context else ""}

**Generate a plan with:**
1. **Video Summary**: 2-3 sentences capturing the essence
2. **Target Audience**: {f"Match: {target_audience}" if target_audience else f"Infer from video idea and {video_type or 'content type'}"}
3. **Video Goal**: {f"Align with: {video_goal}" if video_goal else f"Infer appropriate goal for {video_type or 'this'} content"}
4. **Key Message**: Single memorable takeaway
5. **Hook Strategy**: Engaging opening for first {duration_context['hook_seconds']}s{f" ({video_type_config.get('hook_strategy', '')})" if video_type_config else ""}
6. **Content Outline**: 3-5 sections totaling {duration_context['target_seconds']}s{f" following: {video_type_config.get('structure', '')}" if video_type_config else ""}
7. **Call-to-Action**: Actionable CTA{f" ({video_type_config.get('cta_focus', '')})" if video_type_config else ""}
8. **Visual Style**: Match {brand_style or default_visual_style}
9. **Tone**: {default_tone}
10. **SEO Keywords**: 5-7 relevant terms based on video idea
11. **Avatar Recommendations**: {f"{video_type_config.get('avatar_style', '')} " if video_type_config else ""}matching audience and style

**Response Format (JSON):**
{{
  "video_summary": "...",
  "target_audience": "...",
  "video_goal": "...",
  "key_message": "...",
  "hook_strategy": "...",
  "content_outline": [
    {{"section": "...", "description": "...", "duration_estimate": 30}},
    {{"section": "...", "description": "...", "duration_estimate": 45}}
  ],
  "call_to_action": "...",
  "visual_style": "...",
  "tone": "...",
  "seo_keywords": ["keyword1", "keyword2", ...],
  "avatar_recommendations": {{
    "description": "...",
    "style": "...",
    "energy": "..."
  }}
}}

**Critical:** Content outline durations must sum to {duration_context['target_seconds']}s (±20%).
"""
            
            system_prompt = (
                "You are an expert YouTube content strategist. Create clear, actionable video plans "
                "that are optimized for the specified video type and audience. Focus on accuracy and "
                "specificity - these plans will be used to generate actual video content."
            )
            
            # For shorts, combine plan + scenes in one call to save API calls
            if include_scenes and duration_type == "shorts":
                planning_prompt += f"""

**IMPORTANT: Since this is a SHORTS video, also generate the complete scene breakdown in the same response.**

**Additional Task - Generate Detailed Scenes:**
Create detailed scenes (up to {duration_context['max_scenes']} scenes) that include:
1. Scene number and title
2. Narration text (what will be spoken) - keep it concise for shorts
3. Visual description (what viewers will see)
4. Duration estimate (2-8 seconds each)
5. Emphasis tags (hook, main_content, transition, cta)

**Scene Format:**
Each scene should be detailed enough for video generation. Total duration must fit within {duration_context['target_seconds']} seconds.

**Update JSON structure to include "scenes" array and "avatar_recommendations":**
Add a "scenes" field with the complete scene breakdown, and include "avatar_recommendations" with ideal presenter appearance, style, and energy.
"""
                
                json_struct = {
                    "type": "object",
                    "properties": {
                        "video_summary": {"type": "string"},
                        "target_audience": {"type": "string"},
                        "video_goal": {"type": "string"},
                        "key_message": {"type": "string"},
                        "hook_strategy": {"type": "string"},
                        "content_outline": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "section": {"type": "string"},
                                    "description": {"type": "string"},
                                    "duration_estimate": {"type": "number"}
                                }
                            }
                        },
                        "call_to_action": {"type": "string"},
                        "visual_style": {"type": "string"},
                        "tone": {"type": "string"},
                        "seo_keywords": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "scenes": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "scene_number": {"type": "number"},
                                    "title": {"type": "string"},
                                    "narration": {"type": "string"},
                                    "visual_description": {"type": "string"},
                                    "duration_estimate": {"type": "number"},
                                    "emphasis": {"type": "string"},
                                    "visual_cues": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                },
                                "required": [
                                    "scene_number", "title", "narration", "visual_description",
                                    "duration_estimate", "emphasis"
                                ]
                            }
                        },
                        "avatar_recommendations": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string"},
                                "style": {"type": "string"},
                                "energy": {"type": "string"}
                            }
                        }
                    },
                    "required": [
                        "video_summary", "target_audience", "video_goal", "key_message",
                        "hook_strategy", "content_outline", "call_to_action",
                        "visual_style", "tone", "seo_keywords", "scenes", "avatar_recommendations"
                    ]
                }
            else:
                json_struct = {
                    "type": "object",
                    "properties": {
                        "video_summary": {"type": "string"},
                        "target_audience": {"type": "string"},
                        "video_goal": {"type": "string"},
                        "key_message": {"type": "string"},
                        "hook_strategy": {"type": "string"},
                        "content_outline": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "section": {"type": "string"},
                                    "description": {"type": "string"},
                                    "duration_estimate": {"type": "number"}
                                }
                            }
                        },
                        "call_to_action": {"type": "string"},
                        "visual_style": {"type": "string"},
                        "tone": {"type": "string"},
                        "seo_keywords": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "avatar_recommendations": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string"},
                                "style": {"type": "string"},
                                "energy": {"type": "string"}
                            }
                        }
                    },
                    "required": [
                        "video_summary", "target_audience", "video_goal", "key_message",
                        "hook_strategy", "content_outline", "call_to_action",
                        "visual_style", "tone", "seo_keywords", "avatar_recommendations"
                    ]
                }
            
            # Generate plan using LLM with structured JSON response
            # llm_text_gen handles subscription checks and provider selection automatically
            # json_struct ensures deterministic structured response (returns dict, not string)
            response = llm_text_gen(
                prompt=planning_prompt,
                system_prompt=system_prompt,
                user_id=user_id,
                json_struct=json_struct
            )
            
            # Parse response (structured responses return dict, text responses return string)
            if isinstance(response, dict):
                plan_data = response
            else:
                import json
                try:
                    plan_data = json.loads(response)
                except json.JSONDecodeError as e:
                    logger.error(f"[YouTubePlanner] Failed to parse JSON response: {e}")
                    logger.debug(f"[YouTubePlanner] Raw response: {response[:500]}")
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to parse video plan response. Please try again."
                    )
            
            # Validate and enhance plan quality
            plan_data = self._validate_and_enhance_plan(
                plan_data, duration_context, video_type, video_type_config
            )
            
            # Add metadata
            plan_data["duration_type"] = duration_type
            plan_data["duration_metadata"] = duration_context
            plan_data["user_idea"] = user_idea
            
            # Add research metadata to plan
            plan_data["research_enabled"] = research_enabled
            if research_sources:
                plan_data["research_sources"] = research_sources
                plan_data["research_sources_count"] = len(research_sources)
            else:
                plan_data["research_sources"] = []
                plan_data["research_sources_count"] = 0
            
            # Log research status in plan metadata for debugging
            if research_enabled:
                logger.info(
                    f"[YouTubePlanner] 📊 Plan metadata: research_enabled=True, "
                    f"research_sources_count={plan_data.get('research_sources_count', 0)}, "
                    f"research_context_length={len(research_context)} chars"
                )
            
            # Validate and process scenes if included (for shorts)
            if include_scenes and duration_type == "shorts":
                if "scenes" in plan_data and plan_data["scenes"]:
                    # Validate scenes count and duration
                    scenes = plan_data["scenes"]
                    scene_count = len(scenes)
                    total_scene_duration = sum(
                        scene.get("duration_estimate", 0) for scene in scenes
                    )
                    
                    max_scenes = duration_context["max_scenes"]
                    target_duration = duration_context["target_seconds"]
                    
                    if scene_count > max_scenes:
                        logger.warning(
                            f"[YouTubePlanner] Scene count ({scene_count}) exceeds max ({max_scenes}). "
                            f"Truncating to first {max_scenes} scenes."
                        )
                        plan_data["scenes"] = scenes[:max_scenes]
                    
                    # Warn if total duration is off
                    if abs(total_scene_duration - target_duration) > target_duration * 0.3:
                        logger.warning(
                            f"[YouTubePlanner] Total scene duration ({total_scene_duration}s) "
                            f"differs significantly from target ({target_duration}s)"
                        )
                    
                    plan_data["_scenes_included"] = True
                    logger.info(
                        f"[YouTubePlanner] ✅ Plan + {len(plan_data['scenes'])} scenes "
                        f"generated in 1 AI call (optimized for shorts)"
                    )
                else:
                    # LLM did not return scenes; downstream will regenerate
                    plan_data["_scenes_included"] = False
                    logger.warning(
                        "[YouTubePlanner] Shorts optimization requested but no scenes returned; "
                        "scene builder will generate scenes separately."
                    )
            
            logger.info(f"[YouTubePlanner] ✅ Plan generated successfully")
            
            return plan_data
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[YouTubePlanner] Error generating plan: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate video plan: {str(e)}"
            )
    
    def _build_persona_context(self, persona_data: Optional[Dict[str, Any]]) -> str:
        """Build persona context string for prompts."""
        if not persona_data:
            return """
**Persona Context:**
- Using default professional tone
- No specific persona constraints
"""
        
        core_persona = persona_data.get("core_persona", {})
        tone = core_persona.get("tone", "professional")
        voice = core_persona.get("voice_characteristics", {})
        
        return f"""
**Persona Context:**
- Tone: {tone}
- Voice Style: {voice.get('style', 'professional')}
- Communication Style: {voice.get('communication_style', 'clear and direct')}
- Brand Values: {core_persona.get('core_belief', 'value-driven content')}
- Use this persona to guide the video's tone, style, and messaging approach.
"""
    
    def _get_duration_context(self, duration_type: str) -> Dict[str, Any]:
        """Get duration-specific context and constraints."""
        contexts = {
            "shorts": {
                "description": "YouTube Shorts (15-60 seconds)",
                "target_seconds": 30,
                "hook_seconds": 3,
                "main_seconds": 24,
                "cta_seconds": 3,
                # Keep scenes tight for shorts to control cost and pacing
                "max_scenes": 4,
                "scene_duration_range": (2, 8)
            },
            "medium": {
                "description": "Medium-length video (1-4 minutes)",
                "target_seconds": 150,  # 2.5 minutes
                "hook_seconds": 10,
                "main_seconds": 130,
                "cta_seconds": 10,
                "max_scenes": 12,
                "scene_duration_range": (5, 15)
            },
            "long": {
                "description": "Long-form video (4-10 minutes)",
                "target_seconds": 420,  # 7 minutes
                "hook_seconds": 15,
                "main_seconds": 380,
                "cta_seconds": 25,
                "max_scenes": 20,
                "scene_duration_range": (10, 30)
            }
        }
        
        return contexts.get(duration_type, contexts["medium"])
    
    def _validate_and_enhance_plan(
        self,
        plan_data: Dict[str, Any],
        duration_context: Dict[str, Any],
        video_type: Optional[str],
        video_type_config: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Validate and enhance plan quality before returning.
        
        Performs quality checks:
        - Validates required fields
        - Validates content outline duration matches target
        - Ensures SEO keywords are present
        - Validates avatar recommendations
        - Adds quality metadata
        """
        # Ensure required fields exist
        required_fields = [
            "video_summary", "target_audience", "video_goal", "key_message",
            "hook_strategy", "content_outline", "call_to_action",
            "visual_style", "tone", "seo_keywords"
        ]
        
        missing_fields = [field for field in required_fields if not plan_data.get(field)]
        if missing_fields:
            logger.warning(f"[YouTubePlanner] Missing required fields: {missing_fields}")
            # Fill with defaults to prevent errors
            for field in missing_fields:
                if field == "seo_keywords":
                    plan_data[field] = []
                elif field == "content_outline":
                    plan_data[field] = []
                else:
                    plan_data[field] = f"[{field} not generated]"
        
        # Validate content outline duration
        if plan_data.get("content_outline"):
            total_duration = sum(
                section.get("duration_estimate", 0)
                for section in plan_data["content_outline"]
            )
            target_duration = duration_context.get("target_seconds", 150)
            
            # Allow 20% variance
            tolerance = target_duration * 0.2
            if abs(total_duration - target_duration) > tolerance:
                logger.warning(
                    f"[YouTubePlanner] Content outline duration ({total_duration}s) "
                    f"doesn't match target ({target_duration}s). Adjusting..."
                )
                # Normalize durations proportionally
                if total_duration > 0:
                    scale_factor = target_duration / total_duration
                    for section in plan_data["content_outline"]:
                        if "duration_estimate" in section:
                            section["duration_estimate"] = round(
                                section["duration_estimate"] * scale_factor, 1
                            )
        
        # Validate SEO keywords
        if not plan_data.get("seo_keywords") or len(plan_data["seo_keywords"]) < 3:
            logger.warning(
                f"[YouTubePlanner] Insufficient SEO keywords ({len(plan_data.get('seo_keywords', []))}). "
                f"Plan may need enhancement."
            )
        
        # Validate avatar recommendations
        if not plan_data.get("avatar_recommendations"):
            logger.warning("[YouTubePlanner] Avatar recommendations missing. Generating defaults...")
            plan_data["avatar_recommendations"] = {
                "description": video_type_config.get("avatar_style", "Professional YouTube creator"),
                "style": plan_data.get("visual_style", "Professional"),
                "energy": plan_data.get("tone", "Engaging")
            }
        else:
            # Ensure all avatar recommendation fields exist
            avatar_rec = plan_data["avatar_recommendations"]
            if not avatar_rec.get("description"):
                avatar_rec["description"] = video_type_config.get("avatar_style", "Professional YouTube creator")
            if not avatar_rec.get("style"):
                avatar_rec["style"] = plan_data.get("visual_style", "Professional")
            if not avatar_rec.get("energy"):
                avatar_rec["energy"] = plan_data.get("tone", "Engaging")
        
        # Add quality metadata
        plan_data["_quality_checks"] = {
            "content_outline_validated": bool(plan_data.get("content_outline")),
            "seo_keywords_count": len(plan_data.get("seo_keywords", [])),
            "avatar_recommendations_present": bool(plan_data.get("avatar_recommendations")),
            "all_required_fields_present": len(missing_fields) == 0,
        }
        
        logger.info(
            f"[YouTubePlanner] Plan quality validated: "
            f"outline_sections={len(plan_data.get('content_outline', []))}, "
            f"seo_keywords={len(plan_data.get('seo_keywords', []))}, "
            f"avatar_recs={'yes' if plan_data.get('avatar_recommendations') else 'no'}"
        )
        
        return plan_data
    
    async def _perform_exa_research(
        self,
        user_idea: str,
        video_type: Optional[str],
        target_audience: str,
        user_id: str
    ) -> tuple[str, List[Dict[str, Any]]]:
        """
        Perform Exa research directly using ExaResearchProvider (common module).
        Uses the same pattern as podcast research with proper subscription checks.
        
        Returns:
            Tuple of (research_context_string, research_sources_list)
        """
        try:
            # Pre-flight validation for Exa search only (not full blog writer workflow)
            # We only need to validate Exa API calls, not LLM operations
            from services.database import get_session_for_user
            from services.subscription import PricingService
            from models.subscription_models import APIProvider

            db = get_session_for_user(user_id)
            if not db:
                logger.warning(
                    f"[YouTubePlanner] Unable to open DB session for user {user_id} during Exa preflight"
                )
                raise HTTPException(
                    status_code=503,
                    detail="Database temporarily unavailable for research validation",
                )
            try:
                pricing_service = PricingService(db)
                # Only validate Exa API call, not the full research workflow
                operations_to_validate = [
                    {
                        'provider': APIProvider.EXA,
                        'tokens_requested': 0,
                        'actual_provider_name': 'exa',
                        'operation_type': 'exa_neural_search'
                    }
                ]
                
                can_proceed, message, error_details = pricing_service.check_comprehensive_limits(
                    user_id=user_id,
                    operations=operations_to_validate
                )
                
                if not can_proceed:
                    usage_info = error_details.get('usage_info', {}) if error_details else {}
                    logger.warning(
                        f"[YouTubePlanner] Exa search blocked for user {user_id}: {message}"
                    )
                    raise HTTPException(
                        status_code=429,
                        detail={
                            'error': message,
                            'message': message,
                            'provider': 'exa',
                            'usage_info': usage_info if usage_info else error_details
                        }
                    )
                
                logger.info(f"[YouTubePlanner] Exa search pre-flight validation passed for user {user_id}")
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"[YouTubePlanner] Exa search pre-flight validation failed: {e}")
                raise
            finally:
                db.close()
            
            # Use ExaResearchProvider directly (common module, same as podcast)
            from services.blog_writer.research.exa_provider import ExaResearchProvider
            from types import SimpleNamespace
            
            # Build research query
            query_parts = [user_idea]
            if video_type:
                query_parts.append(f"{video_type} video")
            if target_audience and target_audience != "General YouTube audience":
                query_parts.append(target_audience)
            
            research_query = " ".join(query_parts)
            
            # Configure Exa research (same pattern as podcast)
            cfg = SimpleNamespace(
                exa_search_type="neural",
                exa_category="web",  # Focus on web content for YouTube
                exa_include_domains=[],
                exa_exclude_domains=[],
                max_sources=10,  # Limit sources for cost efficiency
                source_types=[],
            )
            
            # Perform research
            provider = ExaResearchProvider()
            result = await provider.search(
                prompt=research_query,
                topic=user_idea,
                industry="",
                target_audience=target_audience,
                config=cfg,
                user_id=user_id,
            )
            
            # Track usage
            cost_total = 0.0
            if isinstance(result, dict):
                cost_total = result.get("cost", {}).get("total", 0.005) if result.get("cost") else 0.005
            provider.track_exa_usage(user_id, cost_total)
            
            # Extract sources and content
            sources = result.get("sources", []) or []
            research_content = result.get("content", "")
            
            # Build research context for prompt
            research_context = ""
            if research_content and sources:
                # Limit content to 2000 chars to avoid token bloat
                limited_content = research_content[:2000]
                research_context = f"""
**Research & Current Information:**
Based on current web research, here are relevant insights and trends:

{limited_content}

**Key Research Sources ({len(sources)} sources):**
"""
                # Add top 5 sources for context
                for idx, source in enumerate(sources[:5], 1):
                    title = source.get("title", "Untitled") or "Untitled"
                    url = source.get("url", "") or ""
                    excerpt = (source.get("excerpt", "") or "")[:200]
                    if not excerpt:
                        excerpt = (source.get("summary", "") or "")[:200]
                    research_context += f"\n{idx}. {title}\n   {excerpt}\n   Source: {url}\n"
                
                research_context += "\n**Use this research to:**\n"
                research_context += "- Identify current trends and popular angles\n"
                research_context += "- Enhance SEO keywords with real search data\n"
                research_context += "- Ensure content is relevant and up-to-date\n"
                research_context += "- Reference credible sources in the plan\n"
                research_context += "- Identify gaps or unique angles not covered by competitors\n"
            
            # Format sources for response
            formatted_sources = []
            for source in sources:
                formatted_sources.append({
                    "title": source.get("title", "") or "",
                    "url": source.get("url", "") or "",
                    "excerpt": (source.get("excerpt", "") or "")[:300],
                    "published_at": source.get("published_at"),
                    "credibility_score": source.get("credibility_score", 0.85) or 0.85,
                })
            
            logger.info(f"[YouTubePlanner] Exa research completed: {len(formatted_sources)} sources found")
            return research_context, formatted_sources
            
        except HTTPException:
            # Re-raise HTTPException (subscription limits, etc.)
            raise
        except Exception as e:
            logger.error(f"[YouTubePlanner] Research error: {e}", exc_info=True)
            # Non-critical failure - return empty research
            return "", []


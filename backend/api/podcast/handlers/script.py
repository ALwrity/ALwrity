"""
Podcast Script Handlers

Script generation and approval endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
import json
import re
import time

from middleware.auth_middleware import get_current_user
from api.story_writer.utils.auth import require_authenticated_user
from services.llm_providers.main_text_generation import llm_text_gen
from services.podcast_bible_service import PodcastBibleService
from loguru import logger
from ..models import (
    PodcastScriptRequest,
    PodcastScriptResponse,
    PodcastScene,
    PodcastSceneLine,
)

router = APIRouter()
MAX_TTS_CHARS_PER_REQUEST = 10_000
TARGET_TTS_CHARS_PER_SCENE = 8_500


class SceneApprovalRequest(BaseModel):
    project_id: str = Field(..., min_length=1)
    scene_id: str = Field(..., min_length=1)
    approved: bool = True
    notes: Optional[str] = None


@router.post("/script/approve")
async def approve_podcast_scene(
    request: SceneApprovalRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Persist scene approval metadata for auditing (podcast-specific)."""
    user_id = require_authenticated_user(current_user)
    logger.warning(f"[Podcast] Scene approval recorded user={user_id} project={request.project_id} scene={request.scene_id} approved={request.approved}")
    return {
        "success": True,
        "project_id": request.project_id,
        "scene_id": request.scene_id,
        "approved": request.approved,
    }


@router.post("/script", response_model=PodcastScriptResponse)
async def generate_podcast_script(
    request: PodcastScriptRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Generate a podcast script outline (scenes + lines) using podcast-oriented prompting.
    """
    user_id = require_authenticated_user(current_user)
    start_time = time.time()
    logger.warning(f"[ScriptGen] ===== SCRIPT_GEN_START =====")
    logger.warning(f"[ScriptGen] user={user_id}, topic='{request.idea[:50]}...', duration={request.duration_minutes}min, speakers={request.speakers}")
    podcast_mode = (request.podcast_mode or "video_only").strip().lower()
    logger.warning(f"[ScriptGen] research={bool(request.research)}, bible={bool(request.bible)}, analysis={bool(request.analysis)}, mode={podcast_mode}")
    research_fact_cards = request.research.get("factCards", []) if request.research else []

    # Build comprehensive research context for higher-quality scripts
    research_context = ""
    if request.research:
        try:
            key_insights = request.research.get("keyword_analysis", {}).get("key_insights") or []
            fact_cards = research_fact_cards or []
            mapped_angles = request.research.get("mappedAngles", []) or []
            sources = request.research.get("sources", []) or []

            top_facts = [
                f"[{f.get('id') or f'fact_{idx + 1}'}] {f.get('quote', '')}"
                for idx, f in enumerate(fact_cards[:10])
                if f.get("quote")
            ]
            angles_summary = [
                f"{a.get('title', '')}: {a.get('why', '')}" for a in mapped_angles[:3] if a.get("title") or a.get("why")
            ]
            top_sources = [s.get("url") for s in sources[:3] if s.get("url")]
            numeric_signals = []
            for f in fact_cards[:12]:
                quote = (f.get("quote") or "").strip()
                if any(ch.isdigit() for ch in quote):
                    numeric_signals.append(quote[:180])
                if len(numeric_signals) >= 5:
                    break

            research_parts = []
            if key_insights:
                research_parts.append(f"Key Insights: {', '.join(key_insights[:5])}")
            if top_facts:
                research_parts.append(f"Key Facts: {', '.join(top_facts)}")
            if numeric_signals:
                research_parts.append(f"Numeric Signals (prefer for chart scenes): {' | '.join(numeric_signals)}")
            if angles_summary:
                research_parts.append(f"Research Angles: {' | '.join(angles_summary)}")
            if top_sources:
                research_parts.append(f"Top Sources: {', '.join(top_sources)}")

            research_context = "\n".join(research_parts)
        except Exception as exc:
            logger.warning(f"Failed to parse research context: {exc}")
            research_context = ""

    def _normalize_fact_ids(value: Any) -> Optional[list[str]]:
        if not value:
            return None
        if isinstance(value, list):
            cleaned = [str(v).strip() for v in value if str(v).strip()]
            return cleaned or None
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return None

    def _default_chart_data(scene_title: str) -> Dict[str, Any]:
        numeric_pairs: list[tuple[str, float]] = []
        for fact in research_fact_cards[:12]:
            quote = (fact.get("quote") or "").strip()
            if not quote:
                continue
            nums = re.findall(r"\d+(?:\.\d+)?", quote.replace(",", ""))
            if not nums:
                continue
            label = quote[:48] + ("…" if len(quote) > 48 else "")
            try:
                numeric_pairs.append((label, float(nums[0])))
            except ValueError:
                continue
            if len(numeric_pairs) >= 5:
                break

        if numeric_pairs:
            labels = [p[0] for p in numeric_pairs]
            values = [p[1] for p in numeric_pairs]
            sources = [f.get("url", f.get("source", "")) for f in research_fact_cards[:12] if f.get("url") or f.get("source")]
            return {
                "type": "bar_comparison",
                "title": scene_title,
                "labels": labels,
                "values": values,
                "takeaway": "Data points sourced from research facts used in this scene.",
                "source": sources[0] if sources else "",
            }

        return {
            "type": "bullet_points",
            "title": scene_title,
            "bullet_points": ["Key point 1", "Key point 2", "Key point 3"],
            "takeaway": "Narration summary for this scene.",
        }

    # Extract Podcast Bible context for hyper-personalization. Seeded from the
    # user's podcast persona when no explicit bible is provided.
    bible_context = ""
    try:
        bible_service = PodcastBibleService()
        _, bible_context = bible_service.get_or_build_bible(user_id, request.bible, "temp_script")
    except Exception as exc:
        logger.warning(f"Failed to build podcast bible: {exc}")

    # Extract Analysis and Outline context for grounding
    analysis_context = ""
    if request.analysis:
        try:
            audience = request.analysis.get('audience', '') or ''
            content_type = request.analysis.get('contentType', '') or ''
            keywords = request.analysis.get('topKeywords', []) or []
            analysis_context = f"ANALYSIS: Audience={audience} | Type={content_type} | Keywords={', '.join(keywords[:8])}"
        except:
            pass

    outline_context = ""
    if request.outline:
        try:
            title = request.outline.get('title', '') or ''
            segments = request.outline.get('segments', []) or []
            outline_context = f"OUTLINE: {title} - {' | '.join(segments[:5])}"
        except:
            pass

    mode_instructions = ""
    if podcast_mode == "audio_only":
        mode_instructions = f"""
AUDIO-ONLY MODE RULES (CRITICAL):
- This is an audio-only episode. Do NOT include avatar/image/camera instructions.
- Keep each scene's total dialogue under {TARGET_TTS_CHARS_PER_SCENE} chars to stay below TTS max request size ({MAX_TTS_CHARS_PER_REQUEST}).
- For every scene include chart_data so B-roll charts can be generated while narration plays.
- Build script STRICTLY from RESEARCH context and cite fact linkage via usedFactIds.
- If evidence is weak, say uncertainty explicitly rather than inventing facts.
- Add natural TTS pacing in dialogue with markers like [pause:300ms], [pause:700ms], [emote:curious], [emote:serious].
"""
    elif podcast_mode == "audio_video":
        mode_instructions = """
AUDIO+VIDEO MODE:
- Include rich narration that works for both listening and visual storytelling.
- Use a balanced pace suitable for TTS and scene visuals.
"""
    else:
        mode_instructions = """
VIDEO-ONLY MODE:
- Prioritize visual rhythm and concise narration per scene.
"""

    speaker_instructions = ""
    if request.speakers > 1:
        speaker_instructions = f"""DIALOGUE STYLE ({request.speakers} SPEAKERS - NATURAL CONVERSATION):
- Responding speakers MUST react to or build on the prior speaker's line at least once per scene.
- ANTI-REPETITION (CRITICAL): Do NOT repeat the same acknowledgment phrase more than once per episode. Avoid overusing "Exactly", "Spot on", "Right, and", or "Totally agree".
- Vary reactive language across scenes using different conversational techniques:
  * Adding context: "And to put numbers to that...", "What people often miss is...", "Building on that..."
  * Gentle contrast/pivot: "Fair point, though the catch is...", "Here's what surprised me, though..."
  * Validation: "That lines up with what we're seeing...", "That's a huge distinction..."
  * Prompting: "So what does that actually mean for teams on the ground?"
- Vary line length: mix short punchy reactions (1 sentence) with explanatory points (1-2 sentences). Do NOT make every line a uniform, isolated lecture statement.
- Make it sound like two smart colleagues having an engaging, spontaneous studio discussion, not reading alternate paragraphs of a report."""
    else:
        speaker_instructions = """DIALOGUE STYLE (SOLO HOST - CONVERSATIONAL FLOW):
- Use natural, conversational podcast host delivery — avoid stiff formal transitions like "From an operational perspective...", "Moving on to our next section...", or "In conclusion...".
- Use natural contractions ("it's", "we're", "you'll", "let's", "don't", "here's").
- Include occasional rhetorical questions ("So why does this matter right now?", "How did we get here so fast?", "What's the real catch?") to create dynamic pacing.
- Speak directly to the listener in an authentic, engaging, approachable cadence."""

    prompt = f"""Create a podcast script with scenes and dialogue.

{f"BIBLE: {bible_context[:1500]}" if bible_context else ""}
{f"{analysis_context}" if analysis_context else ""}
{f"{outline_context}" if outline_context else ""}
{f"RESEARCH: {research_context[:2500]}" if research_context else ""}
{mode_instructions}

Topic: "{request.idea}"
Duration: {request.duration_minutes} min | Speakers: {request.speakers}
Podcast mode: {podcast_mode}

{speaker_instructions}

Return JSON with scenes array. Each scene:
- id: string
- title: short title (<=50 chars)
- duration: seconds (total/5)
- emotion: neutral|happy|excited|serious|curious|confident
- camera_angle: wide_shot|medium_shot|close_up|over_shoulder (choose the angle that best fits the scene's mood and content)
- visual_atmosphere: short free-text description of lighting, mood, and setting for this scene (e.g. "dim blue-lit studio, contemplative" or "bright sunlit co-working space, energetic"). Leave empty string if no strong atmosphere applies.
- lines: array of {{speaker, text, emphasis, usedFactIds, ttsHints}}
  - Use 2-4 LINES PER SCENE (shorter script = lower TTS costs)
  - Each line: 1-3 sentences, natural speech
  - usedFactIds: include related fact ids when research facts are available (example: ["fact_1", "fact_3"])
  - ttsHints: optional list from [pause_300ms, pause_700ms, smile, serious_tone, emphasize_data]
  - Plain text only, no markdown
- chart_data: object for B-roll mapping (required in audio_only)
  - type: bar_comparison|bar_horizontal|line_trend|pie|stacked_bar|bullet_points
  - title: short chart title
  - labels: list
  - values: list (same length as labels, required for bar/line/pie)
  - before/after: parallel lists of numbers (for bar_comparison only)
  - segments: list of {{name, values}} (for stacked_bar only)
  - bullet_points: list of strings (for bullet_points only)
  - takeaway: one sentence tying chart to narration
  - source: URL or citation for the data (e.g. "Research fact #3" or a URL from the research context)

COST OPTIMIZATION:
- 5-6 scenes max for {request.duration_minutes} min episode
- Concise, information-dense dialogue
- Skip filler words and redundant phrases
- Focus on unique insights from research
- Make every line count toward value delivery
"""

    try:
        logger.warning(f"[ScriptGen] Calling LLM to generate script (prompt length: {len(prompt)})...")
        raw = llm_text_gen(
            prompt=prompt,
            user_id=user_id,
            json_struct=None,
            preferred_provider=None,
            flow_type="premium_tool",
        )
        logger.warning(f"[ScriptGen] LLM response received, length: {len(raw) if raw else 0}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Script generation failed: {exc}")

    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="LLM returned non-JSON output")
    elif isinstance(raw, dict):
        data = raw
    else:
        raise HTTPException(status_code=500, detail="Unexpected LLM response format")

    scenes_data = data.get("scenes") or []
    if not isinstance(scenes_data, list):
        raise HTTPException(status_code=500, detail="LLM response missing scenes array")
    
    if len(scenes_data) == 0:
        logger.warning("[ScriptGen] LLM returned empty scenes array")
        raise HTTPException(status_code=500, detail="LLM returned no scenes - please try again")

    logger.warning(f"[ScriptGen] Processing {len(scenes_data)} scenes from LLM response")

    valid_emotions = {"neutral", "happy", "excited", "serious", "curious", "confident"}

    # Normalize scenes
    scenes: list[PodcastScene] = []
    total_lines_input = 0
    total_lines_output = 0
    dropped_empty_lines = 0
    
    for idx, scene in enumerate(scenes_data):
        if not isinstance(scene, dict):
            logger.warning(f"[ScriptGen] Scene {idx} is not a dict, skipping")
            continue
            
        title = scene.get("title") or f"Scene {idx + 1}"
        duration = int(scene.get("duration") or max(30, (request.duration_minutes * 60) // max(1, len(scenes_data))))
        emotion = scene.get("emotion") or "neutral"
        if emotion not in valid_emotions:
            logger.warning(f"[ScriptGen] Invalid emotion '{emotion}' in scene {idx}, defaulting to 'neutral'")
            emotion = "neutral"

        # camera_angle: validate against known enum values, default to medium_shot
        valid_camera_angles = {"wide_shot", "medium_shot", "close_up", "over_shoulder"}
        camera_angle = scene.get("camera_angle") or "medium_shot"
        if camera_angle not in valid_camera_angles:
            logger.warning(f"[ScriptGen] Invalid camera_angle '{camera_angle}' in scene {idx}, defaulting to 'medium_shot'")
            camera_angle = "medium_shot"

        # visual_atmosphere: free-text, default to empty string
        visual_atmosphere = (scene.get("visual_atmosphere") or "").strip()

        lines_raw = scene.get("lines") or []
        total_lines_input += len(lines_raw)
        lines: list[PodcastSceneLine] = []
        
        for line_idx, line in enumerate(lines_raw):
            if not isinstance(line, dict):
                logger.warning(f"[ScriptGen] Line {line_idx} in scene {idx} is not a dict, skipping")
                continue
                
            speaker = line.get("speaker") or ("Host" if len(lines) % request.speakers == 0 else "Guest")
            text = line.get("text") or ""
            
            # Handle emphasis - convert various values to boolean
            emphasis_raw = line.get("emphasis", False)
            if isinstance(emphasis_raw, bool):
                emphasis = emphasis_raw
            elif isinstance(emphasis_raw, str):
                emphasis = emphasis_raw.lower() in ("true", "yes", "1")
                if emphasis_raw.lower() not in ("true", "false", "yes", "no", "1", "0"):
                    logger.debug(f"[ScriptGen] Unusual emphasis value '{emphasis_raw}' converted to {emphasis}")
            else:
                emphasis = bool(emphasis_raw)
            
            # Generate line ID if not provided
            line_id = line.get("id") or f"line-{idx + 1}-{line_idx + 1}"
            
            # Get used fact IDs if provided
            used_fact_ids = _normalize_fact_ids(line.get("usedFactIds") or line.get("used_fact_ids"))
            tts_hints = line.get("ttsHints") or line.get("tts_hints") or None
            
            if text:
                lines.append(PodcastSceneLine(
                    speaker=speaker, 
                    text=text, 
                    emphasis=emphasis,
                    id=line_id,
                    usedFactIds=used_fact_ids,
                    ttsHints=tts_hints if isinstance(tts_hints, list) else None,
                ))
                total_lines_output += 1
            else:
                dropped_empty_lines += 1
                logger.debug(f"[ScriptGen] Dropped empty line {line_idx} in scene {idx}")
                
        # Log scene status
        if scenes_data and isinstance(scene, dict):
            image_url_raw = scene.get("imageUrl") or scene.get("image_url")
            audio_url_raw = scene.get("audioUrl") or scene.get("audio_url")
            if image_url_raw:
                logger.warning(f"[ScriptGen] Scene {idx} has imageUrl - will be reset to None")
            if audio_url_raw:
                logger.warning(f"[ScriptGen] Scene {idx} has audioUrl - will be reset to None")
                
        # Keep each scene under TTS request size to prevent failures
        scene_char_count = sum(len((l.text or "").strip()) for l in lines)
        if scene_char_count > TARGET_TTS_CHARS_PER_SCENE and lines:
            logger.warning(
                f"[ScriptGen] Scene {idx} text too long ({scene_char_count} chars). "
                f"Trimming to {TARGET_TTS_CHARS_PER_SCENE} target."
            )
            trimmed_lines: list[PodcastSceneLine] = []
            remaining = TARGET_TTS_CHARS_PER_SCENE
            for l in lines:
                if remaining <= 0:
                    break
                line_text = (l.text or "").strip()
                if len(line_text) <= remaining:
                    trimmed_lines.append(l)
                    remaining -= len(line_text)
                    continue
                l.text = f"{line_text[:max(0, remaining - 1)].rstrip()}…"
                trimmed_lines.append(l)
                remaining = 0
            lines = trimmed_lines

        chart_data = scene.get("chart_data") or scene.get("chartData") or None
        if podcast_mode == "audio_only" and not chart_data:
            # Ensure audio-only always has a B-roll mapping fallback
            chart_data = _default_chart_data(title)

        scenes.append(
            PodcastScene(
                id=scene.get("id") or f"scene-{idx + 1}",
                title=title,
                duration=duration,
                lines=lines,
                approved=False,
                emotion=emotion,
                camera_angle=camera_angle,
                visual_atmosphere=visual_atmosphere,
                imageUrl=None,  # Will be generated later
                audioUrl=None,  # Will be generated later
                imagePrompt=None,  # Will be generated during image generation
                chart_data=chart_data if isinstance(chart_data, dict) else None,
            )
        )
    
    # Summary logging
    logger.warning(f"[ScriptGen] Script generated: {len(scenes)} scenes, {total_lines_output}/{total_lines_input} lines")
    if dropped_empty_lines > 0:
        logger.warning(f"[ScriptGen] Dropped {dropped_empty_lines} empty lines")
    
    duration_ms = int((time.time() - start_time) * 1000)
    logger.warning(f"[ScriptGen] ===== SCRIPT_GEN_END (took {duration_ms}ms) =====")

    return PodcastScriptResponse(scenes=scenes)

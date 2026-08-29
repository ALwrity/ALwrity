from __future__ import annotations

import base64
import json
from typing import Any, Dict, Optional

import requests
from fastapi import HTTPException

from services.llm_providers.main_text_generation import llm_text_gen
from services.subscription import get_video_model_cost
from utils.logger_utils import get_service_logger

from .client import WaveSpeedClient

try:
    import imghdr
except ModuleNotFoundError:  # Python 3.13 removed imghdr
    imghdr = None

logger = get_service_logger("wavespeed.kling_animation")

KLING_MODEL_PATH = "kwaivgi/kling-v2.5-turbo-std/image-to-video"
KLING_MODEL_5S = "kling-v2.5-turbo-std-5s"
KLING_MODEL_10S = "kling-v2.5-turbo-std-10s"
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB limit per docs


def _detect_image_mime(image_bytes: bytes) -> str:
    if imghdr:
        detected = imghdr.what(None, h=image_bytes)
        if detected == "jpeg":
            return "image/jpeg"
        if detected == "png":
            return "image/png"
        if detected == "gif":
            return "image/gif"

    header = image_bytes[:8]
    if header.startswith(b"\x89PNG"):
        return "image/png"
    if header[:2] == b"\xff\xd8":
        return "image/jpeg"
    if header[:3] in (b"GIF", b"GIF"):
        return "image/gif"

    return "image/png"


def _build_fallback_prompt(scene_data: Dict[str, Any], story_context: Dict[str, Any]) -> str:
    title = (scene_data.get("title") or "Scene").strip()
    description = (scene_data.get("description") or "").strip()
    image_prompt = (scene_data.get("image_prompt") or "").strip()
    tone = (story_context.get("story_tone") or "story").strip()
    anime_bible = story_context.get("anime_bible") or {}

    bible_desc_parts = []
    if isinstance(anime_bible, dict):
        visual_style = anime_bible.get("visual_style") or {}
        world = anime_bible.get("world") or {}
        main_cast = anime_bible.get("main_cast") or []

        if visual_style.get("style_preset"):
            bible_desc_parts.append(f"{visual_style['style_preset']} anime")
        if visual_style.get("color_mood"):
            bible_desc_parts.append(f"{visual_style['color_mood']} color")
        if visual_style.get("lighting"):
            bible_desc_parts.append(f"{visual_style['lighting']} lighting")
        if visual_style.get("camera_style"):
            bible_desc_parts.append(visual_style["camera_style"])
        if world and world.get("setting"):
            bible_desc_parts.append(f"in {world['setting']}")
        if main_cast:
            names = [c.get("name") for c in main_cast if isinstance(c, dict) and c.get("name")]
            if names:
                bible_desc_parts.append(f"featuring {', '.join(names[:3])}")

    bible_desc = ", ".join(bible_desc_parts) if bible_desc_parts else ""
    scene_desc = (description or image_prompt)[:180].strip()

    prompt = f"Cinematic motion shot of {title}"
    if scene_desc:
        prompt += f": {scene_desc.rstrip('.')}"
    if bible_desc:
        prompt += f", {bible_desc}"
    prompt += f", gentle camera motion, {tone} atmosphere, 5-second loop"

    return prompt


def _load_llm_json_response(response_text: Any) -> Dict[str, Any]:
    """Normalize responses from llm_text_gen (dict or JSON string)."""
    if isinstance(response_text, dict):
        return response_text
    if isinstance(response_text, str):
        return json.loads(response_text)
    raise ValueError(f"Unexpected response type: {type(response_text)}")


def _generate_text_prompt(
    *,
    prompt: str,
    system_prompt: str,
    user_id: str,
    fallback_prompt: str,
) -> str:
    """Fallback text generation when structured JSON parsing fails."""
    try:
        response = llm_text_gen(
            prompt=prompt.strip(),
            system_prompt=system_prompt,
            user_id=user_id,
        )
    except HTTPException as exc:
        if exc.status_code == 429:
            raise
        logger.warning(
            "[AnimateScene] Text-mode prompt generation failed (%s). Using deterministic fallback.",
            exc.detail,
        )
        return fallback_prompt
    except Exception as exc:
        logger.error(
            "[AnimateScene] Unexpected error generating text prompt: %s",
            exc,
            exc_info=True,
        )
        return fallback_prompt

    if isinstance(response, dict):
        candidates = [
            response.get("animation_prompt"),
            response.get("prompt"),
            response.get("text"),
        ]
        for candidate in candidates:
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
        # As a last resort, stringify the dict
        response_text = json.dumps(response, ensure_ascii=False)
    else:
        response_text = str(response)

    cleaned = response_text.strip()
    return cleaned or fallback_prompt


def generate_animation_prompt(
    scene_data: Dict[str, Any],
    story_context: Dict[str, Any],
    user_id: str,
) -> str:
    """
    Generate an animation-focused prompt using llm_text_gen, falling back to a deterministic prompt if LLM fails.
    """
    fallback_prompt = _build_fallback_prompt(scene_data, story_context)
    system_prompt = (
        "You are an expert cinematic animation director. "
        "You transform static illustrated scenes into short cinematic motion clips. "
        "Describe motion, camera behavior, atmosphere, and pacing."
    )

    description = scene_data.get("description", "")
    image_prompt = scene_data.get("image_prompt", "")
    title = scene_data.get("title", "")
    tone = story_context.get("story_tone") or story_context.get("story_tone", "")
    setting = story_context.get("story_setting") or story_context.get("story_setting", "")
    anime_bible = story_context.get("anime_bible") or {}

    anime_bible_block = ""
    if isinstance(anime_bible, dict) and anime_bible:
        try:
            visual_style = anime_bible.get("visual_style") or {}
            world = anime_bible.get("world") or {}
            main_cast = anime_bible.get("main_cast") or []

            style_lines = []
            if visual_style:
                style_preset = visual_style.get("style_preset")
                camera_style = visual_style.get("camera_style")
                color_mood = visual_style.get("color_mood")
                lighting = visual_style.get("lighting")
                line_style = visual_style.get("line_style")
                extra_tags = visual_style.get("extra_tags") or []

                if style_preset:
                    style_lines.append(f"- Visual style preset: {style_preset}")
                if camera_style:
                    style_lines.append(f"- Preferred camera style: {camera_style}")
                if color_mood:
                    style_lines.append(f"- Color mood: {color_mood}")
                if lighting:
                    style_lines.append(f"- Lighting: {lighting}")
                if line_style:
                    style_lines.append(f"- Line art style: {line_style}")
                if extra_tags:
                    style_lines.append(
                        "- Extra style tags: " + ", ".join(str(tag) for tag in extra_tags[:6])
                    )

            cast_line = ""
            if main_cast:
                names = [c.get("name") for c in main_cast if isinstance(c, dict) and c.get("name")]
                if names:
                    cast_line = "- Main cast to keep visually consistent: " + ", ".join(names[:4])

            world_line = ""
            if world:
                setting_desc = world.get("setting")
                if setting_desc:
                    world_line = "- World/setting context: " + str(setting_desc)

            detail_lines = []
            if cast_line:
                detail_lines.append(cast_line)
            if world_line:
                detail_lines.append(world_line)
            detail_lines.extend(style_lines)

            if detail_lines:
                anime_bible_block = (
                    "\nVisual reference from story bible:\n"
                    + "\n".join(detail_lines)
                )
        except Exception:
            anime_bible_block = ""

    prompt = f"""
Describe a 5-second cinematic motion shot (2-3 sentences) for this scene.

Scene Title: {title}
Description: {description}
Existing Image Prompt: {image_prompt}
Story Tone: {tone}
Setting: {setting}
{anime_bible_block}

Describe:
- What moves and how (character/object motion)
- Camera motion (pan, zoom, dolly, orbit)
- Atmosphere, lighting, and emotional tone
- Match the {tone or "story"} mood

Respond with JSON: {{"animation_prompt": "<prompt>"}}
"""

    try:
        response = llm_text_gen(
            prompt=prompt.strip(),
            system_prompt=system_prompt,
            user_id=user_id,
            json_struct={
                "type": "object",
                "properties": {
                    "animation_prompt": {
                        "type": "string",
                        "description": "A cinematic motion prompt for the WaveSpeed image-to-video model.",
                    }
                },
                "required": ["animation_prompt"],
            },
        )
        structured = _load_llm_json_response(response)
        animation_prompt = structured.get("animation_prompt")
        if not animation_prompt or not isinstance(animation_prompt, str):
            raise ValueError("Missing animation_prompt in structured response")
        cleaned_prompt = animation_prompt.strip()
        if not cleaned_prompt:
            raise ValueError("animation_prompt is empty after trimming")
        return cleaned_prompt
    except HTTPException as exc:
        if exc.status_code == 429:
            raise
        logger.warning(
            "[AnimateScene] Structured LLM prompt generation failed (%s). Falling back to text parsing.",
            exc.detail,
        )
        return _generate_text_prompt(
            prompt=prompt,
            system_prompt=system_prompt,
            user_id=user_id,
            fallback_prompt=fallback_prompt,
        )
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        logger.warning(
            "[AnimateScene] Failed to parse structured animation prompt (%s). Falling back to text parsing.",
            exc,
        )
        return _generate_text_prompt(
            prompt=prompt,
            system_prompt=system_prompt,
            user_id=user_id,
            fallback_prompt=fallback_prompt,
        )
    except Exception as exc:
        logger.error(
            "[AnimateScene] Unexpected error generating animation prompt: %s",
            exc,
            exc_info=True,
        )
        return fallback_prompt


def animate_scene_image(
    *,
    image_bytes: bytes,
    scene_data: Dict[str, Any],
    story_context: Dict[str, Any],
    user_id: str,
    duration: int = 5,
    guidance_scale: float = 0.5,
    negative_prompt: Optional[str] = None,
    client: Optional[WaveSpeedClient] = None,
) -> Dict[str, Any]:
    """
    Animate a scene image using WaveSpeed Kling v2.5 Turbo Std.
    Returns dict with video bytes, prompt used, model name, duration, and cost.
    """
    if duration not in (5, 10):
        raise HTTPException(status_code=400, detail="Duration must be 5 or 10 seconds for scene animation.")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Scene image exceeds 10MB limit required by WaveSpeed."
        )

    guidance_scale = max(0.0, min(1.0, guidance_scale))
    animation_prompt = generate_animation_prompt(scene_data, story_context, user_id)
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "duration": duration,
        "guidance_scale": guidance_scale,
        "image": image_b64,
        "prompt": animation_prompt,
    }
    if negative_prompt:
        payload["negative_prompt"] = negative_prompt.strip()

    client = client or WaveSpeedClient()
    prediction_id = client.submit_image_to_video(KLING_MODEL_PATH, payload)
    try:
        result = client.poll_until_complete(prediction_id, timeout_seconds=240, interval_seconds=1.0)
    except HTTPException as exc:
        detail = exc.detail or {}
        if isinstance(detail, dict):
            detail.setdefault("prediction_id", prediction_id)
            detail.setdefault("resume_available", True)
            detail.setdefault("message", "WaveSpeed request is still processing. Use resume endpoint to fetch the video once ready.")
        raise HTTPException(status_code=exc.status_code, detail=detail)

    outputs = result.get("outputs") or []
    if not outputs:
        raise HTTPException(status_code=502, detail="WaveSpeed completed but returned no outputs.")

    video_url = outputs[0]
    video_response = requests.get(video_url, timeout=60)
    if video_response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Failed to download animation video",
                "status_code": video_response.status_code,
                "response": video_response.text[:200],
            },
        )

    model_name = KLING_MODEL_5S if duration == 5 else KLING_MODEL_10S
    cost = get_video_model_cost(model_name, duration_sec=duration, default=0.21 if duration == 5 else 0.42)

    return {
        "video_bytes": video_response.content,
        "prompt": animation_prompt,
        "duration": duration,
        "model_name": model_name,
        "cost": cost,
        "provider": "wavespeed",
        "source_video_url": video_url,
        "prediction_id": prediction_id,
    }


def resume_scene_animation(
    *,
    prediction_id: str,
    duration: int,
    user_id: str,
    client: Optional[WaveSpeedClient] = None,
) -> Dict[str, Any]:
    """
    Resume a previously submitted animation by fetching the completed result.
    """
    if duration not in (5, 10):
        raise HTTPException(status_code=400, detail="Duration must be 5 or 10 seconds for scene animation.")

    client = client or WaveSpeedClient()
    result = client.get_prediction_result(prediction_id, timeout=120)
    status = result.get("status")
    if status != "completed":
        raise HTTPException(
            status_code=409,
            detail={
                "error": "WaveSpeed prediction is not completed yet",
                "prediction_id": prediction_id,
                "status": status,
            },
        )

    outputs = result.get("outputs") or []
    if not outputs:
        raise HTTPException(status_code=502, detail="WaveSpeed completed but returned no outputs.")

    video_url = outputs[0]
    video_response = requests.get(video_url, timeout=120)
    if video_response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Failed to download animation video during resume",
                "status_code": video_response.status_code,
                "response": video_response.text[:200],
                "prediction_id": prediction_id,
            },
        )

    animation_prompt = result.get("prompt") or ""
    model_name = KLING_MODEL_5S if duration == 5 else KLING_MODEL_10S
    cost = get_video_model_cost(model_name, duration_sec=duration, default=0.21 if duration == 5 else 0.42)

    logger.info("[AnimateScene] Resumed download for prediction=%s", prediction_id)

    return {
        "video_bytes": video_response.content,
        "prompt": animation_prompt,
        "duration": duration,
        "model_name": model_name,
        "cost": cost,
        "provider": "wavespeed",
        "source_video_url": video_url,
        "prediction_id": prediction_id,
    }


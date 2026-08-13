"""
YouTube scene video generation helpers.

Selects WAN 2.5 image-to-video when a scene image is available, otherwise
falls back to WAN 2.5 text-to-video via WaveSpeedClient.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

from fastapi import HTTPException

from services.wavespeed.client import WaveSpeedClient
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_video_generate")


async def _generate_image_to_video(
    *,
    image_base64: str,
    prompt: str,
    audio_base64: Optional[str],
    resolution: str,
    duration: int,
    enable_prompt_expansion: bool,
) -> Dict[str, Any]:
    from services.image_studio.wan25_service import WAN25Service

    logger.debug(
        "[YouTubeSceneVideo] Starting WAN 2.5 I2V request "
        f"(resolution={resolution}, duration={duration}s, "
        f"has_audio={bool(audio_base64)}, prompt_length={len(prompt)})"
    )

    service = WAN25Service()
    try:
        result = await service.generate_video(
            image_base64=image_base64,
            prompt=prompt,
            audio_base64=audio_base64,
            resolution=resolution,
            duration=duration,
            enable_prompt_expansion=enable_prompt_expansion,
        )
    except HTTPException as exc:
        prediction_id = exc.detail.get("prediction_id") if isinstance(exc.detail, dict) else None
        logger.warning(
            "[YouTubeSceneVideo] WAN 2.5 I2V request rejected by upstream API "
            f"(prediction_id={prediction_id})",
            exc_info=True,
        )
        raise
    except Exception as exc:
        logger.error(
            f"[YouTubeSceneVideo] Unexpected WAN 2.5 I2V failure: {exc}",
            exc_info=True,
        )
        raise

    video_bytes = result.get("video_bytes") or b""
    logger.info(
        "[YouTubeSceneVideo] WAN 2.5 I2V completed "
        f"(bytes={len(video_bytes)}, model={result.get('model_name')}, "
        f"cost={result.get('cost')})"
    )
    return result


def _run_async_coro(coro):
    """Run an async coroutine from sync code, including when an event loop is active."""
    try:
        asyncio.get_running_loop()
        has_running_loop = True
    except RuntimeError:
        has_running_loop = False

    if not has_running_loop:
        logger.debug("[YouTubeSceneVideo] Running I2V coroutine via asyncio.run")
        try:
            return asyncio.run(coro)
        except Exception as exc:
            logger.error(
                f"[YouTubeSceneVideo] I2V coroutine failed in asyncio.run: {exc}",
                exc_info=True,
            )
            raise

    logger.debug(
        "[YouTubeSceneVideo] Active event loop detected; running I2V in thread executor"
    )
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(asyncio.run, coro).result()
    except Exception as exc:
        logger.error(
            f"[YouTubeSceneVideo] I2V coroutine failed in thread executor: {exc}",
            exc_info=True,
        )
        raise


def generate_youtube_scene_video(
    *,
    visual_prompt: str,
    resolution: str,
    duration: int,
    audio_base64: Optional[str] = None,
    image_base64: Optional[str] = None,
    wavespeed_client: Optional[WaveSpeedClient] = None,
    enable_prompt_expansion: bool = True,
    timeout: int = 600,
) -> Dict[str, Any]:
    """
    Generate a YouTube scene video using I2V when image_base64 is present, else T2V.

    Returns a dict with video_bytes and metadata compatible with the renderer.
    """
    mode = "image-to-video" if image_base64 else "text-to-video"
    logger.info(
        f"[YouTubeSceneVideo] generate_youtube_scene_video entry "
        f"(mode={mode}, resolution={resolution}, duration={duration}s, "
        f"has_audio={bool(audio_base64)}, prompt_length={len(visual_prompt)}, "
        f"timeout={timeout}s)"
    )

    try:
        if image_base64:
            logger.info(
                "[YouTubeSceneVideo] Using WAN 2.5 image-to-video "
                f"(resolution={resolution}, duration={duration}s)"
            )
            result = _run_async_coro(
                _generate_image_to_video(
                    image_base64=image_base64,
                    prompt=visual_prompt,
                    audio_base64=audio_base64,
                    resolution=resolution,
                    duration=duration,
                    enable_prompt_expansion=enable_prompt_expansion,
                )
            )
        else:
            client = wavespeed_client or WaveSpeedClient()
            logger.info(
                "[YouTubeSceneVideo] Using WAN 2.5 text-to-video "
                f"(resolution={resolution}, duration={duration}s)"
            )
            result = client.generate_text_video(
                prompt=visual_prompt,
                resolution=resolution,
                duration=duration,
                audio_base64=audio_base64,
                enable_prompt_expansion=enable_prompt_expansion,
                enable_sync_mode=True,
                timeout=timeout,
            )
    except HTTPException as exc:
        prediction_id = exc.detail.get("prediction_id") if isinstance(exc.detail, dict) else None
        logger.warning(
            f"[YouTubeSceneVideo] Video generation failed via {mode} "
            f"(HTTP error, prediction_id={prediction_id})",
            exc_info=True,
        )
        raise
    except Exception as exc:
        logger.error(
            f"[YouTubeSceneVideo] Video generation failed via {mode}: {exc}",
            exc_info=True,
        )
        raise

    video_bytes = result.get("video_bytes") or b""
    if not video_bytes:
        logger.error(
            f"[YouTubeSceneVideo] {mode} completed but returned empty video bytes "
            f"(model={result.get('model_name')})"
        )
    else:
        logger.info(
            f"[YouTubeSceneVideo] {mode} succeeded "
            f"(bytes={len(video_bytes)}, model={result.get('model_name')}, "
            f"cost={result.get('cost')})"
        )

    return result

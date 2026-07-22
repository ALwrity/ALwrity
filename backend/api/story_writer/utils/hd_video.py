from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException
from loguru import logger
from uuid import uuid4


def generate_hd_video_payload(request: Any, user_id: str) -> Dict[str, Any]:
    """Handles synchronous HD video generation."""
    from services.llm_providers.main_video_generation import ai_video_generate
    from services.story_writer.video_generation_service import StoryVideoGenerationService

    video_service = StoryVideoGenerationService()
    output_dir = video_service.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    kwargs: Dict[str, Any] = {}
    if getattr(request, "model", None):
        kwargs["model"] = request.model
    if getattr(request, "num_frames", None):
        kwargs["num_frames"] = request.num_frames
    if getattr(request, "guidance_scale", None) is not None:
        kwargs["guidance_scale"] = request.guidance_scale
    if getattr(request, "num_inference_steps", None):
        kwargs["num_inference_steps"] = request.num_inference_steps
    if getattr(request, "negative_prompt", None):
        kwargs["negative_prompt"] = request.negative_prompt
    if getattr(request, "seed", None) is not None:
        kwargs["seed"] = request.seed

    logger.info(f"[StoryWriter] Generating HD video via {getattr(request, 'provider', 'huggingface')} for user {user_id}")
    result = ai_video_generate(
        prompt=request.prompt,
        operation_type="text-to-video",
        provider=getattr(request, "provider", None) or "huggingface",
        user_id=user_id,
        **kwargs,
    )

    # Extract video bytes from result dict
    video_bytes = result["video_bytes"]
    
    filename = f"hd_{uuid4().hex}.mp4"
    file_path = output_dir / filename
    with open(file_path, "wb") as fh:
        fh.write(video_bytes)

    logger.info(f"[StoryWriter] HD video saved to {file_path}")
    return {
        "success": True,
        "video_filename": filename,
        "video_url": f"/api/story/videos/{filename}",
        "provider": getattr(request, "provider", None) or "huggingface",
        "model": getattr(request, "model", None) or "tencent/HunyuanVideo",
    }


def generate_hd_video_scene_payload(request: Any, user_id: str) -> Dict[str, Any]:
    """
    Handles per-scene HD video generation including prompt enhancement
    and subscription validation.
    """
    from services.database import get_session_for_user
    from services.onboarding.api_key_manager import APIKeyManager
    from services.subscription import PricingService
    from services.subscription.preflight_validator import validate_video_generation_operations
    from services.story_writer.prompt_enhancer_service import enhance_scene_prompt_for_video
    from services.llm_providers.main_video_generation import ai_video_generate
    from services.story_writer.video_generation_service import StoryVideoGenerationService

    scene_number = request.scene_number
    logger.info(f"[StoryWriter] Generating HD video for scene {scene_number} for user {user_id}")

    hf_token = APIKeyManager().get_api_key("hf_token")
    if not hf_token:
        logger.error("[StoryWriter] Pre-flight: HF token not configured - blocking video generation")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Hugging Face API token is not configured. Please configure your HF token in settings.",
                "message": "Hugging Face API token is not configured. Please configure your HF token in settings.",
            },
        )

    db_validation = get_session_for_user(user_id)
    if db_validation is None:
        logger.error(f"[StoryWriter] Pre-flight: Could not open database session for user {user_id}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    try:
        pricing_service = PricingService(db_validation)
        logger.info(f"[StoryWriter] Pre-flight: Checking video generation limits for user {user_id}...")
        validate_video_generation_operations(pricing_service=pricing_service, user_id=user_id)
        logger.info("[StoryWriter] Pre-flight: ✅ Video generation limits validated - proceeding")
    finally:
        db_validation.close()

    enhanced_prompt = enhance_scene_prompt_for_video(
        current_scene=request.scene_data,
        story_context=request.story_context,
        all_scenes=request.all_scenes,
        user_id=user_id,
    )
    logger.info(f"[StoryWriter] Generated enhanced prompt ({len(enhanced_prompt)} chars) for scene {scene_number}")

    kwargs: Dict[str, Any] = {}
    if getattr(request, "model", None):
        kwargs["model"] = request.model
    if getattr(request, "num_frames", None):
        kwargs["num_frames"] = request.num_frames
    if getattr(request, "guidance_scale", None) is not None:
        kwargs["guidance_scale"] = request.guidance_scale
    if getattr(request, "num_inference_steps", None):
        kwargs["num_inference_steps"] = request.num_inference_steps
    if getattr(request, "negative_prompt", None):
        kwargs["negative_prompt"] = request.negative_prompt
    if getattr(request, "seed", None) is not None:
        kwargs["seed"] = request.seed

    result = ai_video_generate(
        prompt=enhanced_prompt,
        operation_type="text-to-video",
        provider=getattr(request, "provider", None) or "huggingface",
        user_id=user_id,
        **kwargs,
    )

    # Extract video bytes from result dict
    video_bytes = result["video_bytes"]

    video_service = StoryVideoGenerationService()
    save_result = video_service.save_scene_video(
        video_bytes=video_bytes,
        scene_number=scene_number,
        user_id=user_id,
    )

    logger.info(f"[StoryWriter] HD video saved for scene {scene_number}: {save_result.get('video_filename')}")
    return {
        "success": True,
        "scene_number": scene_number,
        "video_filename": save_result.get("video_filename"),
        "video_url": save_result.get("video_url"),
        "prompt_used": enhanced_prompt,
        "provider": getattr(request, "provider", None) or "huggingface",
        "model": getattr(request, "model", None) or "tencent/HunyuanVideo",
    }


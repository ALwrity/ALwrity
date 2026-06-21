"""
Background task for LinkedIn async video generation.
"""

import asyncio
from typing import Any, Dict, Optional

from api.story_writer.task_manager import task_manager
from utils.asset_tracker import save_asset_to_library
from loguru import logger

from .linkedin_video_generator import LinkedInVideoGenerator
from .linkedin_video_storage import LinkedInVideoStorage


def execute_linkedin_video_generation_task(
    task_id: str,
    user_id: str,
    prompt: str,
    content_context: Dict[str, Any],
    aspect_ratio: str = "16:9",
    duration: int = 5,
    resolution: str = "720p",
    motion_preset: str = "medium",
    model: Optional[str] = None,
):
    """Background task: generate, store, save to asset library, update task status."""
    video_generator = LinkedInVideoGenerator()
    video_storage = LinkedInVideoStorage()

    try:
        task_manager.update_task_status(
            task_id,
            "processing",
            progress=5.0,
            message="Initializing LinkedIn video generation...",
        )

        async def _run():
            return await video_generator.generate_video(
                prompt=prompt,
                content_context=content_context,
                aspect_ratio=aspect_ratio,
                duration=duration,
                resolution=resolution,
                motion_preset=motion_preset,
                user_id=user_id,
                model=model,
            )

        task_manager.update_task_status(
            task_id,
            "processing",
            progress=15.0,
            message="Generating video with AI provider...",
        )

        gen_result = asyncio.run(_run())
        if not gen_result.get("success"):
            raise RuntimeError(gen_result.get("error", "Video generation failed"))

        task_manager.update_task_status(
            task_id,
            "processing",
            progress=75.0,
            message="Saving generated video...",
        )

        metadata = gen_result.get("metadata", {})
        store_result = await_store_video(
            video_storage,
            gen_result["video_bytes"],
            {
                **metadata,
                "topic": content_context.get("topic"),
                "industry": content_context.get("industry"),
                "content_type": content_context.get("content_type", "post"),
            },
            content_context.get("content_type", "post"),
            user_id,
        )

        if not store_result.get("success"):
            raise RuntimeError(store_result.get("error", "Failed to store video"))

        video_id = store_result["video_id"]
        video_url = store_result["file_url"]
        asset_id: Optional[int] = None

        try:
            from services.database import get_db

            db = next(get_db())
            try:
                asset_id = save_asset_to_library(
                    db=db,
                    user_id=user_id,
                    asset_type="video",
                    source_module="linkedin_writer",
                    filename=f"linkedin_video_{video_id}.mp4",
                    file_url=video_url,
                    file_path=store_result.get("storage_path"),
                    file_size=len(gen_result["video_bytes"]),
                    mime_type="video/mp4",
                    title="LinkedIn Selection Video",
                    description=f"Generated from selection: {(prompt or '')[:100]}",
                    prompt=metadata.get("prompt_used", prompt),
                    tags=["linkedin", "text-to-video", "selection-generated"],
                    provider=metadata.get("provider"),
                    model=metadata.get("model_used"),
                    cost=metadata.get("cost", 0.0),
                    generation_time=metadata.get("generation_time"),
                    asset_metadata={
                        "video_id": video_id,
                        "aspect_ratio": aspect_ratio,
                        "duration": duration,
                        "resolution": resolution,
                        "motion_preset": motion_preset,
                        "selected_text_snippet": (content_context.get("content") or "")[:200],
                    },
                )
                logger.info(
                    f"[LinkedInVideo] Saved to asset library: asset_id={asset_id}, "
                    f"storage_path={store_result.get('storage_path')}, "
                    f"asset_library_path=/asset-library?source_module=linkedin_writer&asset_type=video"
                )
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[LinkedInVideo] Failed to save to asset library: {e}")

        task_manager.update_task_status(
            task_id,
            "completed",
            progress=100.0,
            message="LinkedIn video generation complete!",
            result={
                "video_id": video_id,
                "video_url": video_url,
                "asset_id": asset_id,
                "storage_path": store_result.get("storage_path"),
                "asset_library_path": "/asset-library?source_module=linkedin_writer&asset_type=video",
                "cost": metadata.get("cost", 0.0),
                "duration": duration,
                "model": metadata.get("model_used"),
                "provider": metadata.get("provider"),
                "resolution": resolution,
            },
        )
    except Exception as exc:
        logger.exception(f"[LinkedInVideo] Generation failed: {exc}")
        task_manager.update_task_status(
            task_id,
            "failed",
            error=str(exc),
            message=f"Video generation failed: {exc}",
        )


def await_store_video(storage, video_data, metadata, content_type, user_id):
    """Run async store_video from sync background task."""
    return asyncio.run(
        storage.store_video(
            video_data=video_data,
            metadata=metadata,
            content_type=content_type,
            user_id=user_id,
        )
    )

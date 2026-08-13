"""
YouTube Video Renderer Service

Handles video rendering using WAN 2.5 text-to-video and audio generation.
"""

from typing import Dict, Any, List, Optional
from pathlib import Path
from fastapi import HTTPException

from services.wavespeed.client import WaveSpeedClient
from services.podcast.video_combination_service import PodcastVideoCombinationService
from services.user_workspace_manager import UserWorkspaceManager
from services.youtube.video_storage import get_youtube_video_dir
from services.youtube.scene_render import execute_scene_video_render
from sqlalchemy.orm import Session
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.renderer")


class YouTubeVideoRendererService:
    """Service for rendering YouTube videos from scenes."""

    def __init__(self):
        """Initialize the renderer service."""
        self.wavespeed_client = WaveSpeedClient()

        # Video output directory (global fallback; per-user dir resolved at save time)
        self.output_dir = get_youtube_video_dir()
        self.output_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"[YouTubeRenderer] Initialized with output directory: {self.output_dir}")

    def _get_user_video_dir(self, user_id: str, db: Optional[Session] = None) -> Path:
        """
        Get the video directory for a specific user.
        Falls back to default output_dir if workspace not found.
        """
        return get_youtube_video_dir(user_id=user_id, db=db)

    def _get_user_audio_dir(self, user_id: str, db: Optional[Session] = None) -> Path:
        """
        Get the audio directory for a specific user.
        """
        base_dir = Path(__file__).resolve().parents[3]
        default_audio_dir = base_dir / "workspace" / "media" / "youtube_audio"

        if db and user_id:
            try:
                workspace_manager = UserWorkspaceManager(db)
                workspace = workspace_manager.get_user_workspace(user_id)
                if workspace:
                    # Use media/youtube_audio inside user workspace
                    user_audio_dir = Path(workspace["workspace_path"]) / "media" / "youtube_audio"
                    user_audio_dir.mkdir(parents=True, exist_ok=True)
                    return user_audio_dir
            except Exception as e:
                logger.warning(
                    f"[YouTubeRenderer] Failed to resolve user workspace path for {user_id}: {e}"
                )

        default_audio_dir.mkdir(parents=True, exist_ok=True)
        return default_audio_dir

    def render_scene_video(
        self,
        scene: Dict[str, Any],
        video_plan: Dict[str, Any],
        user_id: str,
        resolution: str = "720p",
        generate_audio_enabled: bool = True,
        voice_id: str = "Wise_Woman",
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Render a single scene into a video.

        Args:
            scene: Scene data with narration and visual prompts
            video_plan: Original video plan for context
            user_id: Clerk user ID
            resolution: Video resolution (480p, 720p, 1080p)
            generate_audio_enabled: Whether to generate narration audio
            voice_id: Voice ID for audio generation
            db: Database session for workspace-aware video save

        Returns:
            Dictionary with video metadata, bytes, and cost
        """
        scene_number = scene.get("scene_number", 1)
        generation_mode = "t2v"
        try:
            result = execute_scene_video_render(
                scene=scene,
                user_id=user_id,
                resolution=resolution,
                generate_audio_enabled=generate_audio_enabled,
                voice_id=voice_id,
                db=db,
                wavespeed_client=self.wavespeed_client,
            )
            generation_mode = result.pop("generation_mode", generation_mode)
            return result

        except HTTPException as e:
            error_detail = e.detail
            if isinstance(error_detail, dict):
                error_msg = error_detail.get("error", str(error_detail))
                generation_mode = error_detail.get("generation_mode", generation_mode)
            else:
                error_msg = str(error_detail)

            logger.error(
                f"[YouTubeRenderer] Scene {scene_number} failed ({generation_mode}): {error_msg}",
                exc_info=True,
            )

            if isinstance(error_detail, dict):
                preserved_detail = dict(error_detail)
                preserved_detail.setdefault("scene_number", scene_number)
                raise HTTPException(status_code=e.status_code, detail=preserved_detail)

            raise HTTPException(
                status_code=e.status_code,
                detail={
                    "error": f"Failed to render scene {scene_number}",
                    "scene_number": scene_number,
                    "message": error_msg,
                    "user_action": "Please try again. If the issue persists, check your scene content and try a different resolution.",
                },
            )
        except Exception as e:
            logger.error(
                f"[YouTubeRenderer] Scene {scene_number} unexpected error ({generation_mode}): {e}",
                exc_info=True,
            )
            raise HTTPException(
                status_code=500,
                detail={
                    "error": f"Failed to render scene {scene_number}",
                    "scene_number": scene_number,
                    "message": str(e),
                    "user_action": "Please try again. If the issue persists, check your scene content and try a different resolution.",
                },
            )

    def render_full_video(
        self,
        scenes: List[Dict[str, Any]],
        video_plan: Dict[str, Any],
        user_id: str,
        resolution: str = "720p",
        combine_scenes: bool = True,
        voice_id: str = "Wise_Woman",
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Render a complete video from multiple scenes.

        Args:
            scenes: List of scene data
            video_plan: Original video plan
            user_id: Clerk user ID
            resolution: Video resolution
            combine_scenes: Whether to combine scenes into single video
            voice_id: Voice ID for narration
            db: Database session for workspace resolution

        Returns:
            Dictionary with video metadata and scene results
        """
        try:
            logger.info(
                f"[YouTubeRenderer] Rendering full video: {len(scenes)} scenes, "
                f"resolution={resolution}, user={user_id}"
            )

            enabled_scenes = [s for s in scenes if s.get("enabled", True)]
            if not enabled_scenes:
                raise HTTPException(status_code=400, detail="No enabled scenes to render")

            scene_results = []
            total_cost = 0.0

            for idx, scene in enumerate(enabled_scenes):
                logger.info(
                    f"[YouTubeRenderer] Rendering scene {idx + 1}/{len(enabled_scenes)}: "
                    f"Scene {scene.get('scene_number', idx + 1)}"
                )

                scene_result = self.render_scene_video(
                    scene=scene,
                    video_plan=video_plan,
                    user_id=user_id,
                    resolution=resolution,
                    generate_audio_enabled=True,
                    voice_id=voice_id,
                    db=db,
                )

                scene_results.append(scene_result)
                total_cost += scene_result["cost"]

            final_video_path = None
            final_video_url = None
            if combine_scenes and len(scene_results) > 1:
                logger.info("[YouTubeRenderer] Combining scenes into final video...")

                scene_video_paths = [r["video_path"] for r in scene_results]
                user_video_dir = self._get_user_video_dir(user_id, db)

                # Reuse podcast combiner — scene videos already include embedded audio
                video_service = PodcastVideoCombinationService(output_dir=str(user_video_dir))
                combined_result = video_service.combine_videos(
                    video_paths=scene_video_paths,
                    podcast_title=(
                        video_plan.get("video_summary", "YouTube Video") or "YouTube Video"
                    )[:50],
                    fps=24,
                )

                final_video_path = combined_result["video_path"]
                final_filename = Path(
                    combined_result.get("video_filename") or final_video_path
                ).name
                final_video_url = f"/api/youtube/videos/{final_filename}"

            logger.info(
                f"[YouTubeRenderer] ✅ Full video rendered: {len(scene_results)} scenes, "
                f"total_cost=${total_cost:.2f}"
            )

            return {
                "success": True,
                "scene_results": scene_results,
                "total_cost": total_cost,
                "final_video_path": final_video_path,
                "final_video_url": final_video_url,
                "num_scenes": len(scene_results),
                "resolution": resolution,
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[YouTubeRenderer] Error rendering full video: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to render video: {str(e)}",
            )

    def estimate_render_cost(
        self,
        scenes: List[Dict[str, Any]],
        resolution: str = "720p",
        image_model: str = "ideogram-v3-turbo",
    ) -> Dict[str, Any]:
        """
        Estimate the cost of rendering a video before actually rendering it.

        Args:
            scenes: List of scene data with duration estimates
            resolution: Video resolution (480p, 720p, 1080p)
            image_model: Image generation model for cost estimate

        Returns:
            Dictionary with cost breakdown and total estimate
        """
        pricing = {
            "480p": 0.05,
            "720p": 0.10,
            "1080p": 0.15,
        }

        price_per_second = pricing.get(resolution, 0.10)

        image_pricing = {
            "ideogram-v3-turbo": 0.10,
            "qwen-image": 0.05,
        }

        image_cost_per_scene = image_pricing.get(image_model, 0.10)

        enabled_scenes = [s for s in scenes if s.get("enabled", True)]

        scene_costs = []
        total_cost = 0.0
        total_duration = 0.0
        total_image_cost = len(enabled_scenes) * image_cost_per_scene

        for scene in enabled_scenes:
            scene_number = scene.get("scene_number", 0)
            duration_estimate = scene.get("duration_estimate", 5)

            # Clamp duration to valid WAN 2.5 values (5 or 10 seconds)
            duration = 5 if duration_estimate <= 7 else 10

            scene_cost = price_per_second * duration
            scene_costs.append(
                {
                    "scene_number": scene_number,
                    "duration_estimate": duration_estimate,
                    "actual_duration": duration,
                    "cost": round(scene_cost, 2),
                }
            )

            total_cost += scene_cost
            total_duration += duration

        total_cost += total_image_cost

        return {
            "resolution": resolution,
            "price_per_second": price_per_second,
            "num_scenes": len(enabled_scenes),
            "total_duration_seconds": total_duration,
            "scene_costs": scene_costs,
            "total_cost": round(total_cost, 2),
            "estimated_cost_range": {
                "min": round(total_cost * 0.9, 2),
                "max": round(total_cost * 1.1, 2),
            },
            "image_model": image_model,
            "image_cost_per_scene": image_cost_per_scene,
            "total_image_cost": round(total_image_cost, 2),
        }

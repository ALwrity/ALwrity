"""
YouTube Video Renderer Service

Handles video rendering using WAN 2.5 text-to-video and audio generation.
"""

from typing import Dict, Any, List, Optional
from pathlib import Path
import base64
import uuid
import requests
from loguru import logger
from fastapi import HTTPException

from services.wavespeed.client import WaveSpeedClient
from services.llm_providers.main_audio_generation import generate_audio
from services.podcast.video_combination_service import PodcastVideoCombinationService
from services.subscription import PricingService
from services.subscription.preflight_validator import validate_scene_animation_operation
from services.llm_providers.main_video_generation import track_video_usage
from services.user_workspace_manager import UserWorkspaceManager
from services.youtube.video_storage import get_youtube_video_dir, save_youtube_scene_video
from sqlalchemy.orm import Session
from utils.logger_utils import get_service_logger
from utils.asset_tracker import save_asset_to_library

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
                    user_audio_dir = Path(workspace['workspace_path']) / "media" / "youtube_audio"
                    user_audio_dir.mkdir(parents=True, exist_ok=True)
                    return user_audio_dir
            except Exception as e:
                logger.warning(f"[YouTubeRenderer] Failed to resolve user workspace path for {user_id}: {e}")
        
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
            generate_audio: Whether to generate narration audio
            voice_id: Voice ID for audio generation
            
        Returns:
            Dictionary with video metadata, bytes, and cost
        """
        try:
            scene_number = scene.get("scene_number", 1)
            narration = scene.get("narration", "").strip()
            visual_prompt = (scene.get("enhanced_visual_prompt") or scene.get("visual_prompt", "")).strip()
            duration_estimate = scene.get("duration_estimate", 5)
            
            # VALIDATION: Check inputs before making expensive API calls
            if not visual_prompt:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": f"Scene {scene_number} has no visual prompt",
                        "scene_number": scene_number,
                        "message": "Visual prompt is required for video generation",
                        "user_action": "Please add a visual description for this scene before rendering.",
                    }
                )
            
            if len(visual_prompt) < 10:
                logger.warning(
                    f"[YouTubeRenderer] Scene {scene_number} has very short visual prompt "
                    f"({len(visual_prompt)} chars), may result in poor quality"
                )
            
            # Clamp duration to valid WAN 2.5 values (5 or 10 seconds)
            duration = 5 if duration_estimate <= 7 else 10
            
            # Log asset usage status
            has_existing_image = bool(scene.get("imageUrl"))
            has_existing_audio = bool(scene.get("audioUrl"))
            
            logger.info(
                f"[YouTubeRenderer] Rendering scene {scene_number}: "
                f"resolution={resolution}, duration={duration}s, prompt_length={len(visual_prompt)}, "
                f"has_existing_image={has_existing_image}, has_existing_audio={has_existing_audio}"
            )
            
            # Use existing audio if available, otherwise generate if requested
            audio_base64 = None
            scene_audio_url = scene.get("audioUrl")
            
            if scene_audio_url:
                # Load existing audio from URL
                try:
                    from pathlib import Path
                    from urllib.parse import urlparse
                    import requests
                    
                    logger.info(f"[YouTubeRenderer] Attempting to load existing audio for scene {scene_number} from URL: {scene_audio_url}")
                    
                    # Extract filename from URL (e.g., /api/youtube/audio/filename.mp3)
                    parsed_url = urlparse(scene_audio_url)
                    audio_filename = Path(parsed_url.path).name
                    
                    # Try to load from local file system first
                    base_dir = Path(__file__).parent.parent.parent.parent
                    youtube_audio_dir = base_dir / "youtube_audio"
                    audio_path = youtube_audio_dir / audio_filename
                    
                    # Debug: If file not found, try to find it with flexible matching
                    if not audio_path.exists():
                        logger.debug(f"[YouTubeRenderer] Audio file not found at {audio_path}. Searching for alternative matches...")
                        if youtube_audio_dir.exists():
                            all_files = list(youtube_audio_dir.glob("*.mp3"))
                            logger.debug(f"[YouTubeRenderer] Found {len(all_files)} MP3 files in directory")
                            
                            # Try to find a file that matches the scene (by scene number or title pattern)
                            # The filename format is: scene_{scene_number}_{clean_title}_{unique_id}.mp3
                            # Extract components from expected filename
                            expected_parts = audio_filename.replace('.mp3', '').split('_')
                            if len(expected_parts) >= 3:
                                scene_num_str = expected_parts[1] if expected_parts[0] == 'scene' else None
                                title_part = expected_parts[2] if len(expected_parts) > 2 else None
                                
                                # Try to find files matching scene number or title
                                matching_files = []
                                for f in all_files:
                                    file_parts = f.stem.split('_')
                                    if len(file_parts) >= 3 and file_parts[0] == 'scene':
                                        file_scene_num = file_parts[1]
                                        file_title = file_parts[2] if len(file_parts) > 2 else ''
                                        
                                        # Match by scene number (try both 0-indexed and 1-indexed)
                                        if scene_num_str:
                                            scene_num_int = int(scene_num_str)
                                            file_scene_int = int(file_scene_num) if file_scene_num.isdigit() else None
                                            if file_scene_int == scene_num_int or file_scene_int == scene_num_int - 1 or file_scene_int == scene_num_int + 1:
                                                matching_files.append(f.name)
                                        # Or match by title
                                        elif title_part and title_part.lower() in file_title.lower():
                                            matching_files.append(f.name)
                                
                                if matching_files:
                                    logger.info(
                                        f"[YouTubeRenderer] Found potential audio file matches for scene {scene_number}: {matching_files[:3]}. "
                                        f"Expected: {audio_filename}"
                                    )
                                    # Try using the first match
                                    alternative_path = youtube_audio_dir / matching_files[0]
                                    if alternative_path.exists() and alternative_path.is_file():
                                        logger.info(f"[YouTubeRenderer] Using alternative audio file: {matching_files[0]}")
                                        audio_path = alternative_path
                                        audio_filename = matching_files[0]
                                    else:
                                        logger.warning(f"[YouTubeRenderer] Alternative match found but file doesn't exist: {alternative_path}")
                            else:
                                # Show sample files for debugging
                                sample_files = [f.name for f in all_files[:10] if f.name.startswith("scene_")]
                                if sample_files:
                                    logger.debug(f"[YouTubeRenderer] Sample scene audio files in directory: {sample_files}")
                    
                    if audio_path.exists() and audio_path.is_file():
                        with open(audio_path, "rb") as f:
                            audio_bytes = f.read()
                        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                        logger.info(f"[YouTubeRenderer] ✅ Using existing audio for scene {scene_number} from local file: {audio_filename} ({len(audio_bytes)} bytes)")
                    else:
                        # File not found locally - try loading from asset library
                        logger.warning(
                            f"[YouTubeRenderer] Audio file not found locally at {audio_path}. "
                            f"Attempting to load from asset library (filename: {audio_filename})"
                        )
                        
                        try:
                            from services.content_asset_service import ContentAssetService
                            from services.database import get_session_for_user
                            from models.content_asset_models import AssetType, AssetSource

                            db = get_session_for_user(user_id)
                            if not db:
                                raise FileNotFoundError(
                                    f"Database session unavailable for user {user_id}"
                                )
                            try:
                                asset_service = ContentAssetService(db)
                                # Try to find the asset by filename and source
                                assets = asset_service.get_assets(
                                    user_id=user_id,
                                    asset_type=AssetType.AUDIO,
                                    source_module=AssetSource.YOUTUBE_CREATOR,
                                    limit=100,
                                )

                                # Find matching asset by filename
                                matching_asset = None
                                for asset in assets:
                                    if asset.filename == audio_filename:
                                        matching_asset = asset
                                        break

                                if matching_asset and matching_asset.file_path:
                                    asset_path = Path(matching_asset.file_path)
                                    if asset_path.exists() and asset_path.is_file():
                                        with open(asset_path, "rb") as f:
                                            audio_bytes = f.read()
                                        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                                        logger.info(
                                            f"[YouTubeRenderer] ✅ Loaded audio for scene {scene_number} from asset library: "
                                            f"{audio_filename} ({len(audio_bytes)} bytes)"
                                        )
                                    else:
                                        raise FileNotFoundError(f"Asset library file path does not exist: {asset_path}")
                                else:
                                    raise FileNotFoundError(f"Audio asset not found in library for filename: {audio_filename}")
                            finally:
                                db.close()
                        except Exception as asset_error:
                            logger.warning(
                                f"[YouTubeRenderer] Failed to load audio from asset library: {asset_error}. "
                                f"Original path attempted: {audio_path}"
                            )
                            raise FileNotFoundError(
                                f"Audio file not found at {audio_path} and not found in asset library: {asset_error}"
                            )
                                
                except FileNotFoundError as e:
                    logger.warning(f"[YouTubeRenderer] ❌ Audio file not found: {e}. Will generate new audio if enabled.")
                    scene_audio_url = None  # Fall back to generation
                except Exception as e:
                    logger.warning(f"[YouTubeRenderer] ❌ Failed to load existing audio: {e}. Will generate new audio if enabled.", exc_info=True)
                    scene_audio_url = None  # Fall back to generation
            
            # Generate audio if not available and generation is enabled
            if not audio_base64 and generate_audio_enabled and narration and len(narration.strip()) > 0:
                try:
                    audio_result = generate_audio(
                        text=narration,
                        voice_id=voice_id,
                        user_id=user_id,
                    )
                    # generate_audio may return raw bytes or AudioGenerationResult
                    audio_bytes = audio_result.audio_bytes if hasattr(audio_result, "audio_bytes") else audio_result
                    # Convert to base64 (just the base64 string, not data URI)
                    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                    logger.info(f"[YouTubeRenderer] Generated new audio for scene {scene_number}")
                except Exception as e:
                    logger.warning(f"[YouTubeRenderer] Audio generation failed: {e}, continuing without audio")
            
            # VALIDATION: Final check before expensive video API call
            if not visual_prompt or len(visual_prompt.strip()) < 5:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": f"Scene {scene_number} has invalid visual prompt",
                        "scene_number": scene_number,
                        "message": "Visual prompt must be at least 5 characters",
                        "user_action": "Please provide a valid visual description for this scene.",
                    }
                )
            
            # Generate video using WAN 2.5 text-to-video
            # This is the expensive API call - all validation should be done before this
            # Use sync mode to wait for result directly (prevents timeout issues)
            try:
                video_result = self.wavespeed_client.generate_text_video(
                    prompt=visual_prompt,
                    resolution=resolution,
                    duration=duration,
                    audio_base64=audio_base64,  # Optional: enables lip-sync if provided
                    enable_prompt_expansion=True,
                    enable_sync_mode=True,  # Use sync mode to wait for result directly
                    timeout=600,  # Increased timeout for sync mode (10 minutes)
                )
            except requests.exceptions.Timeout as e:
                logger.error(f"[YouTubeRenderer] WaveSpeed API timed out for scene {scene_number}: {e}")
                raise HTTPException(
                    status_code=504,
                    detail={
                        "error": "WaveSpeed request timed out",
                        "scene_number": scene_number,
                        "message": "The video generation request timed out.",
                        "user_action": "Please retry. If it persists, try fewer scenes, lower resolution, or shorter durations.",
                    },
                ) from e
            except requests.exceptions.RequestException as e:
                logger.error(f"[YouTubeRenderer] WaveSpeed API request failed for scene {scene_number}: {e}")
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "WaveSpeed request failed",
                        "scene_number": scene_number,
                        "message": str(e),
                        "user_action": "Please retry. If it persists, check network connectivity or try again later.",
                    },
                ) from e
            
            # Save into canonical YouTube media dir (not Story writer media paths)
            save_result = save_youtube_scene_video(
                video_bytes=video_result["video_bytes"],
                scene_number=scene_number,
                user_id=user_id,
                db=db,
            )
            # Track usage
            usage_info = track_video_usage(
                user_id=user_id,
                provider=video_result["provider"],
                model_name=video_result["model_name"],
                prompt=visual_prompt,
                video_bytes=video_result["video_bytes"],
                cost_override=video_result["cost"],
            )
            
            logger.info(
                f"[YouTubeRenderer] ✅ Scene {scene_number} rendered: "
                f"cost=${video_result['cost']:.2f}, size={len(video_result['video_bytes'])} bytes"
            )
            
            return {
                "scene_number": scene_number,
                "video_filename": save_result["video_filename"],
                "video_url": save_result["video_url"],
                "video_path": save_result["video_path"],
                "duration": video_result["duration"],
                "cost": video_result["cost"],
                "resolution": resolution,
                "width": video_result["width"],
                "height": video_result["height"],
                "file_size": save_result["file_size"],
                "prediction_id": video_result.get("prediction_id"),
                "usage_info": usage_info,
            }
            
        except HTTPException as e:
            # Re-raise with better error message for UI
            error_detail = e.detail
            if isinstance(error_detail, dict):
                error_msg = error_detail.get("error", str(error_detail))
            else:
                error_msg = str(error_detail)
            
            logger.error(
                f"[YouTubeRenderer] Scene {scene_number} failed: {error_msg}",
                exc_info=True
            )
            raise HTTPException(
                status_code=e.status_code,
                detail={
                    "error": f"Failed to render scene {scene_number}",
                    "scene_number": scene_number,
                    "message": error_msg,
                    "user_action": "Please try again. If the issue persists, check your scene content and try a different resolution.",
                }
            )
        except Exception as e:
            logger.error(f"[YouTubeRenderer] Error rendering scene {scene_number}: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={
                    "error": f"Failed to render scene {scene_number}",
                    "scene_number": scene_number,
                    "message": str(e),
                    "user_action": "Please try again. If the issue persists, check your scene content and try a different resolution.",
                }
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
            
            # Filter enabled scenes
            enabled_scenes = [s for s in scenes if s.get("enabled", True)]
            if not enabled_scenes:
                raise HTTPException(status_code=400, detail="No enabled scenes to render")
            
            scene_results = []
            total_cost = 0.0
            
            # Render each scene
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
            
            # Combine scenes if requested
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
                    podcast_title=(video_plan.get("video_summary", "YouTube Video") or "YouTube Video")[:50],
                    fps=24,
                )

                final_video_path = combined_result["video_path"]
                final_filename = Path(combined_result.get("video_filename") or final_video_path).name
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
                detail=f"Failed to render video: {str(e)}"
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
            
        Returns:
            Dictionary with cost breakdown and total estimate
        """
        # Pricing per second (same as in WaveSpeedClient)
        pricing = {
            "480p": 0.05,
            "720p": 0.10,
            "1080p": 0.15,
        }

        price_per_second = pricing.get(resolution, 0.10)

        # Image generation pricing
        image_pricing = {
            "ideogram-v3-turbo": 0.10,
            "qwen-image": 0.05,
        }

        image_cost_per_scene = image_pricing.get(image_model, 0.10)
        
        # Filter enabled scenes
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
            scene_costs.append({
                "scene_number": scene_number,
                "duration_estimate": duration_estimate,
                "actual_duration": duration,
                "cost": round(scene_cost, 2),
            })
            
            total_cost += scene_cost
            total_duration += duration

        # Add image costs to total
        total_cost += total_image_cost

        return {
            "resolution": resolution,
            "price_per_second": price_per_second,
            "num_scenes": len(enabled_scenes),
            "total_duration_seconds": total_duration,
            "scene_costs": scene_costs,
            "total_cost": round(total_cost, 2),
            "estimated_cost_range": {
                "min": round(total_cost * 0.9, 2),  # 10% buffer
                "max": round(total_cost * 1.1, 2),  # 10% buffer
            },
            "image_model": image_model,
            "image_cost_per_scene": image_cost_per_scene,
            "total_image_cost": round(total_image_cost, 2),
        }


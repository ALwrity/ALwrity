"""Background tasks for YouTube scene and full-video rendering."""

from typing import Any, Dict, List

from fastapi import HTTPException

from services.youtube.renderer import YouTubeVideoRendererService
from utils.asset_tracker import save_asset_to_library
from utils.logger_utils import get_service_logger
from .task_manager import task_manager

logger = get_service_logger("api.youtube.render_tasks")


def _execute_video_render_task(
    task_id: str,
    scenes: List[Dict[str, Any]],
    video_plan: Dict[str, Any],
    user_id: str,
    resolution: str,
    combine_scenes: bool,
    voice_id: str,
):
    """Background task to render video with progress updates."""
    logger.info(
        f"[YouTubeRenderer] Background task started for task {task_id}, "
        f"scenes={len(scenes)}, user={user_id}"
    )
    
    # Verify task exists before starting
    task_status = task_manager.get_task_status(task_id)
    if not task_status:
        logger.error(
            f"[YouTubeRenderer] Task {task_id} not found when background task started. "
            f"This should not happen - task may have been cleaned up."
        )
        return
    
    # Create DB session for workspace resolution
    from services.database import get_session_for_user
    db = get_session_for_user(user_id)
    if not db:
        logger.error(f"[YouTubeRenderer] Could not create database session for user {user_id}")
        task_manager.update_task_status(
            task_id, "failed", error="Database session unavailable", message="Failed to initialize render"
        )
        return
    
    try:
        task_manager.update_task_status(
            task_id, "processing", progress=5.0, message="Initializing render..."
        )
        logger.info(f"[YouTubeRenderer] Task {task_id} status updated to processing")
        
        renderer = YouTubeVideoRendererService()
        
        total_scenes = len(scenes)
        scene_results = []
        total_cost = 0.0
        
        # VALIDATION: Pre-validate all scenes before starting expensive API calls
        invalid_scenes = []
        for idx, scene in enumerate(scenes):
            scene_num = scene.get("scene_number", idx + 1)
            visual_prompt = (scene.get("enhanced_visual_prompt") or scene.get("visual_prompt", "")).strip()
            
            if not visual_prompt:
                invalid_scenes.append({
                    "scene_number": scene_num,
                    "reason": "Missing visual prompt",
                    "prompt_length": 0
                })
            elif len(visual_prompt) < 5:
                invalid_scenes.append({
                    "scene_number": scene_num,
                    "reason": f"Visual prompt too short ({len(visual_prompt)} chars, minimum 5)",
                    "prompt_length": len(visual_prompt)
                })
            
            # Validate duration
            duration = scene.get("duration_estimate", 5)
            if duration < 1 or duration > 10:
                invalid_scenes.append({
                    "scene_number": scene_num,
                    "reason": f"Invalid duration ({duration}s, must be 1-10 seconds)",
                    "prompt_length": len(visual_prompt) if visual_prompt else 0
                })
        
        if invalid_scenes:
            error_msg = f"Found {len(invalid_scenes)} invalid scene(s) before rendering: " + \
                       ", ".join([f"Scene {s['scene_number']} ({s['reason']})" for s in invalid_scenes])
            logger.error(f"[YouTubeRenderer] {error_msg}")
            task_manager.update_task_status(
                task_id,
                "failed",
                error=error_msg,
                message=f"Validation failed: {len(invalid_scenes)} scene(s) have invalid data. Please fix them before rendering."
            )
            return
        
        # Render each scene
        for idx, scene in enumerate(scenes):
            scene_num = scene.get("scene_number", idx + 1)
            progress = 5.0 + (idx / total_scenes) * 85.0
            
            task_manager.update_task_status(
                task_id,
                "processing",
                progress=progress,
                message=f"Rendering scene {scene_num}/{total_scenes}..."
            )
            
            try:
                scene_result = renderer.render_scene_video(
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
                
                # Save to asset library
                try:
                    save_asset_to_library(
                        db=db,
                        user_id=user_id,
                        asset_type="video",
                        source_module="youtube_creator",
                        filename=scene_result["video_filename"],
                        file_url=scene_result["video_url"],
                        file_path=scene_result["video_path"],
                        file_size=scene_result["file_size"],
                        mime_type="video/mp4",
                        title=f"YouTube Scene {scene_num}: {scene.get('title', 'Untitled')}",
                        description=f"Scene {scene_num} from YouTube video",
                        prompt=scene.get("visual_prompt", ""),
                        tags=["youtube_creator", "video", "scene", f"scene_{scene_num}", resolution],
                        provider="wavespeed",
                        model="alibaba/wan-2.5/text-to-video",
                        cost=scene_result["cost"],
                        asset_metadata={
                            "scene_number": scene_num,
                            "duration": scene_result["duration"],
                            "resolution": resolution,
                            "status": "completed"
                        }
                    )
                except Exception as e:
                    logger.warning(f"[YouTubeRenderer] Failed to save scene to library: {e}")
                
            except Exception as scene_error:
                error_msg = str(scene_error)
                scene_error_type = "unknown"
                
                if isinstance(scene_error, HTTPException):
                    error_detail = scene_error.detail
                    if isinstance(error_detail, dict):
                        error_msg = error_detail.get("message", error_detail.get("error", str(error_detail)))
                        scene_error_type = error_detail.get("error", "http_error")
                    else:
                        error_msg = str(error_detail)
                    # Check if it's a timeout or critical error that should fail fast
                    if scene_error.status_code == 504:  # Timeout
                        scene_error_type = "timeout"
                    elif scene_error.status_code >= 500:  # Server errors
                        scene_error_type = "server_error"
                else:
                    # Check error type from exception
                    if "timeout" in str(scene_error).lower():
                        scene_error_type = "timeout"
                    elif "connection" in str(scene_error).lower():
                        scene_error_type = "connection_error"
                
                logger.error(
                    f"[YouTubeRenderer] Scene {scene_num} failed: {error_msg} (type: {scene_error_type})",
                    exc_info=True
                )
                
                # Track failed scene for user retry
                failed_scene_result = {
                    "scene_number": scene_num,
                    "status": "failed",
                    "error": error_msg,
                    "error_type": scene_error_type,
                    "scene_data": scene,
                }
                scene_results.append(failed_scene_result)
                
                # Update task status immediately to reflect failure
                successful_count = len([r for r in scene_results if r.get("status") != "failed"])
                failed_count = len([r for r in scene_results if r.get("status") == "failed"])
                
                # Fail fast for critical errors (timeouts, server errors) if it's the first scene
                # or if multiple consecutive failures occur
                should_fail_fast = (
                    scene_error_type in ["timeout", "server_error", "connection_error"] and
                    (failed_count == 1 or failed_count >= 3)  # Fail fast on first timeout or 3+ failures
                )
                
                if should_fail_fast:
                    logger.error(
                        f"[YouTubeRenderer] Failing fast due to {scene_error_type} error. "
                        f"Scene {scene_num} failed, total failures: {failed_count}"
                    )
                    # Mark task as failed immediately
                    task_manager.update_task_status(
                        task_id,
                        "failed",
                        error=f"Render failed fast: Scene {scene_num} failed with {scene_error_type}",
                        message=f"Video rendering stopped early due to {scene_error_type}. "
                               f"{successful_count} scene(s) completed, {failed_count} scene(s) failed. "
                               f"Failed scene: {error_msg}",
                    )
                    # Update result with current state
                    successful_scenes = [r for r in scene_results if r.get("status") != "failed"]
                    failed_scenes = [r for r in scene_results if r.get("status") == "failed"]
                    result = {
                        "scene_results": successful_scenes,
                        "failed_scenes": failed_scenes,
                        "total_cost": total_cost,
                        "final_video_url": successful_scenes[0]["video_url"] if successful_scenes else None,
                        "num_scenes": len(successful_scenes),
                        "num_failed": len(failed_scenes),
                        "resolution": resolution,
                        "partial_success": len(failed_scenes) > 0 and len(successful_scenes) > 0,
                        "fail_fast": True,
                        "fail_reason": f"Scene {scene_num} failed with {scene_error_type}",
                    }
                    task_manager.update_task_status(
                        task_id,
                        "failed",
                        error=f"Render failed fast: {scene_error_type}",
                        message=f"Rendering stopped early. {successful_count} completed, {failed_count} failed.",
                        result=result
                    )
                    return  # Exit immediately
                
                # For non-critical errors, update progress but continue
                task_manager.update_task_status(
                    task_id,
                    "processing",
                    progress=progress,
                    message=f"Scene {scene_num} failed, continuing with remaining scenes... "
                           f"({successful_count} successful, {failed_count} failed)"
                )
                # Continue with other scenes - let user retry failed ones
                continue
        
        # Separate successful and failed scenes
        successful_scenes = [r for r in scene_results if r.get("status") != "failed"]
        failed_scenes = [r for r in scene_results if r.get("status") == "failed"]
        
        if not successful_scenes:
            # All scenes failed - mark as failed immediately
            error_msg = f"All {len(failed_scenes)} scene(s) failed to render"
            logger.error(f"[YouTubeRenderer] {error_msg}")
            task_manager.update_task_status(
                task_id,
                "failed",
                error=error_msg,
                message=f"All scenes failed. First error: {failed_scenes[0].get('error', 'Unknown') if failed_scenes else 'Unknown'}",
                result={
                    "scene_results": [],
                    "failed_scenes": failed_scenes,
                    "total_cost": 0.0,
                    "final_video_url": None,
                    "num_scenes": 0,
                    "num_failed": len(failed_scenes),
                    "resolution": resolution,
                    "partial_success": False,
                }
            )
            return
        
        # Combine scenes if requested (only if we have successful scenes)
        final_video_url = None
        if combine_scenes and len(successful_scenes) > 1:
            task_manager.update_task_status(
                task_id, "processing", progress=90.0, message="Combining scenes..."
            )
            
            # Use renderer to combine
            combined_result = renderer.render_full_video(
                scenes=scenes,
                video_plan=video_plan,
                user_id=user_id,
                resolution=resolution,
                combine_scenes=True,
                voice_id=voice_id,
                db=db,
            )
            
            final_video_url = combined_result.get("final_video_url")
        
        # Final result (successful_scenes and failed_scenes already separated above)
        result = {
            "scene_results": successful_scenes,
            "failed_scenes": failed_scenes,
            "total_cost": total_cost,
            "final_video_url": final_video_url or (successful_scenes[0]["video_url"] if successful_scenes else None),
            "num_successful": len(successful_scenes),
            "num_failed": len(failed_scenes),
            "resolution": resolution,
            "partial_success": len(failed_scenes) > 0 and len(successful_scenes) > 0,
        }
        
        # Determine final status based on results
        if len(failed_scenes) == 0:
            # All scenes succeeded
            final_status = "completed"
            final_message = f"Video rendering complete! {len(successful_scenes)} scene(s) rendered successfully."
        elif len(successful_scenes) > 0:
            # Partial success
            final_status = "completed"  # Still mark as completed but with partial success flag
            final_message = f"Video rendering completed with {len(failed_scenes)} failure(s). " \
                          f"{len(successful_scenes)} scene(s) rendered successfully."
        else:
            # This shouldn't happen due to early return above, but handle it
            final_status = "failed"
            final_message = f"All scenes failed to render."
        
        task_manager.update_task_status(
            task_id,
            final_status,
            progress=100.0,
            message=final_message,
            result=result
        )
        
        logger.info(
            f"[YouTubeRenderer] ✅ Render task {task_id} completed: "
            f"{len(scene_results)} scenes, cost=${total_cost:.2f}"
        )
        
    except HTTPException as exc:
        error_msg = str(exc.detail) if isinstance(exc.detail, str) else exc.detail.get("error", "Render failed") if isinstance(exc.detail, dict) else "Render failed"
        logger.error(f"[YouTubeRenderer] Render task {task_id} failed: {error_msg}")
        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_msg,
            message=f"Video rendering failed: {error_msg}",
        )
    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"[YouTubeRenderer] Render task {task_id} error: {error_msg}", exc_info=True)
        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_msg,
            message=f"Video rendering error: {error_msg}",
        )
    finally:
        if 'db' in locals():
            db.close()


def _execute_scene_video_render_task(
    task_id: str,
    scene: Dict[str, Any],
    video_plan: Dict[str, Any],
    user_id: str,
    resolution: str,
    generate_audio_enabled: bool,
    voice_id: str,
):
    """Background task to render a single scene video (scene-wise generation)."""
    scene_num = scene.get("scene_number", 0)
    logger.info(
        f"[YouTubeRenderer] Background single-scene task started for task {task_id}, scene={scene_num}, user={user_id}"
    )

    task_status = task_manager.get_task_status(task_id)
    if not task_status:
        logger.error(
            f"[YouTubeRenderer] Task {task_id} not found when single-scene task started."
        )
        return

    # Create DB session for workspace resolution
    from services.database import get_session_for_user
    db = get_session_for_user(user_id)
    if not db:
        logger.error(f"[YouTubeRenderer] Could not create database session for user {user_id}")
        task_manager.update_task_status(
            task_id, "failed", error="Database session unavailable", message="Failed to initialize scene render"
        )
        return

    try:
        task_manager.update_task_status(
            task_id, "processing", progress=5.0, message=f"Rendering scene {scene_num}..."
        )

        renderer = YouTubeVideoRendererService()

        scene_result = renderer.render_scene_video(
            scene=scene,
            video_plan=video_plan,
            user_id=user_id,
            resolution=resolution,
            generate_audio_enabled=generate_audio_enabled,
            voice_id=voice_id,
            db=db,
        )

        total_cost = scene_result.get("cost", 0.0) or 0.0
        result = {
            "scene_results": [scene_result],
            "failed_scenes": [],
            "total_cost": total_cost,
            "final_video_url": scene_result.get("video_url"),
            "num_successful": 1,
            "num_failed": 0,
            "resolution": resolution,
            "partial_success": False,
            "scene_number": scene_num,
            "video_url": scene_result.get("video_url"),
            "video_filename": scene_result.get("video_filename"),
        }

        task_manager.update_task_status(
            task_id,
            "completed",
            progress=100.0,
            message=f"Scene {scene_num} rendered successfully",
            result=result,
        )

        # Verify the task status was updated correctly (matches podcast pattern)
        updated_status = task_manager.get_task_status(task_id)
        logger.info(
            f"[YouTubeRenderer] Task status after update: task_id={task_id}, status={updated_status.get('status') if updated_status else 'None'}, has_result={bool(updated_status.get('result') if updated_status else False)}, video_url={updated_status.get('result', {}).get('video_url') if updated_status else 'N/A'}"
        )

        logger.info(
            f"[YouTubeRenderer] ✅ Single-scene render {task_id} completed (scene {scene_num}), cost=${total_cost:.2f}"
        )

    except HTTPException as exc:
        error_msg = (
            str(exc.detail)
            if isinstance(exc.detail, str)
            else exc.detail.get("error", "Render failed")
            if isinstance(exc.detail, dict)
            else "Render failed"
        )
        logger.error(f"[YouTubeRenderer] Single-scene task {task_id} failed: {error_msg}")
        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_msg,
            message=f"Scene {scene_num} rendering failed: {error_msg}",
        )
    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"[YouTubeRenderer] Single-scene task {task_id} error: {error_msg}", exc_info=True)
        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_msg,
            message=f"Scene {scene_num} rendering error: {error_msg}",
        )
    finally:
        if 'db' in locals():
            db.close()

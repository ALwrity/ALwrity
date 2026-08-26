"""
Edit Studio Service - Video editing operations.

Phase 1: Basic FFmpeg operations (Trim/Cut, Speed Control, Stabilization)
Phase 2: Text Overlay & Captions, Audio Enhancement, Noise Reduction
Phase 3: AI Features (Background Replacement, Object Removal, Color Grading)
"""

import asyncio
import logging
import math
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import HTTPException

from backend.services.video_studio.video_processors import (
    trim_video,
    adjust_speed,
)

logger = logging.getLogger(__name__)


class EditService:
    """Service for video editing operations."""
    
    def __init__(self):
        logger.info("[EditService] Service initialized")
    
    def calculate_cost(self, edit_type: str, duration: float = 10.0) -> float:
        """Calculate cost for video editing operation. FFmpeg operations are free."""
        return 0.0
    
    async def trim_video(
        self,
        video_data: bytes,
        start_time: float = 0.0,
        end_time: Optional[float] = None,
        max_duration: Optional[float] = None,
        trim_mode: str = "beginning",
        user_id: str = None,
    ) -> Dict[str, Any]:
        """Trim video to specified duration or time range."""
        try:
            logger.info(f"[EditService] Video trim: user={user_id}, start={start_time}, end={end_time}")
            
            processed_video_bytes = await asyncio.to_thread(
                trim_video,
                video_bytes=video_data,
                start_time=start_time,
                end_time=end_time,
                max_duration=max_duration,
                trim_mode=trim_mode,
            )
            
            from backend.services.content_assets.content_asset_service import ContentAssetService
            from backend.database.database import get_db
            
            db_gen = get_db()
            db = next(db_gen)
            try:
                asset_service = ContentAssetService(db)
                filename = f"edited_trim_{uuid.uuid4().hex[:8]}.mp4"
                
                asset_result = asset_service.save_video_asset(
                    user_id=user_id,
                    video_data=processed_video_bytes,
                    filename=filename,
                    asset_type="video_edit",
                    metadata={"edit_type": "trim", "start_time": start_time, "end_time": end_time},
                )
                
                return {
                    "success": True,
                    "video_url": asset_result.get("url"),
                    "asset_id": asset_result.get("asset_id"),
                    "cost": 0.0,
                    "edit_type": "trim",
                    "metadata": {"start_time": start_time, "end_time": end_time},
                }
            finally:
                db.close()
            
        except Exception as e:
            logger.error(f"[EditService] Video trim failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Video trimming failed: {str(e)}")
    
    async def adjust_speed(
        self,
        video_data: bytes,
        speed_factor: float,
        user_id: str = None,
    ) -> Dict[str, Any]:
        """Adjust video playback speed."""
        try:
            logger.info(f"[EditService] Speed adjustment: user={user_id}, factor={speed_factor}")
            
            if speed_factor <= 0:
                raise HTTPException(status_code=400, detail="Speed factor must be greater than 0")
            if speed_factor > 4.0:
                raise HTTPException(status_code=400, detail="Speed factor cannot exceed 4.0")
            
            processed_video_bytes = await asyncio.to_thread(
                adjust_speed,
                video_bytes=video_data,
                speed_factor=speed_factor,
            )
            
            from backend.services.content_assets.content_asset_service import ContentAssetService
            from backend.database.database import get_db
            
            db_gen = get_db()
            db = next(db_gen)
            try:
                asset_service = ContentAssetService(db)
                filename = f"edited_speed_{uuid.uuid4().hex[:8]}.mp4"
                
                asset_result = asset_service.save_video_asset(
                    user_id=user_id,
                    video_data=processed_video_bytes,
                    filename=filename,
                    asset_type="video_edit",
                    metadata={"edit_type": "speed", "speed_factor": speed_factor},
                )
                
                return {
                    "success": True,
                    "video_url": asset_result.get("url"),
                    "asset_id": asset_result.get("asset_id"),
                    "cost": 0.0,
                    "edit_type": "speed",
                    "metadata": {"speed_factor": speed_factor},
                }
            finally:
                db.close()
            
        except Exception as e:
            logger.error(f"[EditService] Speed adjustment failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Speed adjustment failed: {str(e)}")
    
    async def stabilize_video(
        self,
        video_data: bytes,
        smoothing: int = 10,
        user_id: str = None,
    ) -> Dict[str, Any]:
        """Stabilize video using FFmpeg vidstab."""
        try:
            logger.info(f"[EditService] Stabilization: user={user_id}, smoothing={smoothing}")
            
            smoothing = max(1, min(100, smoothing))
            
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as input_file:
                input_file.write(video_data)
                input_path = input_file.name
            
            transforms_file = tempfile.NamedTemporaryFile(suffix=".trf", delete=False, delete_on_close=False)
            transforms_path = transforms_file.name
            transforms_file.close()
            
            output_path = None
            
            try:
                detect_cmd = [
                    "ffmpeg", "-i", input_path,
                    "-vf", f"vidstabdetect=stepsize=6:shakiness=10:accuracy=15:result={transforms_path}",
                    "-f", "null", "-"
                ]
                subprocess.run(detect_cmd, capture_output=True, text=True, timeout=300)
                
                with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as output_file:
                    output_path = output_file.name
                
                transform_cmd = [
                    "ffmpeg", "-i", input_path,
                    "-vf", f"vidstabtransform=input={transforms_path}:smoothing={smoothing}:zoom=1:optzoom=1",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "23",
                    "-c:a", "copy", "-y", output_path
                ]
                result = subprocess.run(transform_cmd, capture_output=True, text=True, timeout=600)
                
                if result.returncode != 0:
                    raise HTTPException(status_code=500, detail=f"Stabilization failed: {result.stderr}")
                
                with open(output_path, "rb") as f:
                    processed_video_bytes = f.read()
                
                from backend.services.content_assets.content_asset_service import ContentAssetService
                from backend.database.database import get_db
                
                db_gen = get_db()
                db = next(db_gen)
                try:
                    asset_service = ContentAssetService(db)
                    filename = f"edited_stabilized_{uuid.uuid4().hex[:8]}.mp4"
                    
                    asset_result = asset_service.save_video_asset(
                        user_id=user_id,
                        video_data=processed_video_bytes,
                        filename=filename,
                        asset_type="video_edit",
                        metadata={"edit_type": "stabilize", "smoothing": smoothing},
                    )
                    
                    return {
                        "success": True,
                        "video_url": asset_result.get("url"),
                        "asset_id": asset_result.get("asset_id"),
                        "cost": 0.0,
                        "edit_type": "stabilize",
                        "metadata": {"smoothing": smoothing},
                    }
                finally:
                    db.close()
                
            finally:
                Path(input_path).unlink(missing_ok=True)
                Path(transforms_path).unlink(missing_ok=True)
                if output_path:
                    Path(output_path).unlink(missing_ok=True)
                    
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="Stabilization timed out")
        except Exception as e:
            logger.error(f"[EditService] Stabilization failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Stabilization failed: {str(e)}")
    
    # Phase 2: Text and Audio operations
    
    async def add_text_overlay(
        self,
        video_data: bytes,
        text: str,
        position: str = "center",
        font_size: int = 48,
        font_color: str = "white",
        background_color: str = "black@0.5",
        start_time: float = 0.0,
        end_time: Optional[float] = None,
        user_id: str = None,
    ) -> Dict[str, Any]:
        """Add text overlay to video using FFmpeg drawtext filter."""
        try:
            logger.info(f"[EditService] Text overlay: user={user_id}, text='{text[:30]}...'")
            
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as input_file:
                input_file.write(video_data)
                input_path = input_file.name
            
            output_path = None
            
            try:
                position_map = {
                    "top": "(w-text_w)/2:50",
                    "center": "(w-text_w)/2:(h-text_h)/2",
                    "bottom": "(w-text_w)/2:h-text_h-50",
                    "top-left": "50:50",
                    "top-right": "w-text_w-50:50",
                    "bottom-left": "50:h-text_h-50",
                    "bottom-right": "w-text_w-50:h-text_h-50",
                }
                pos_expr = position_map.get(position, position_map["center"])
                
                escaped_text = text.replace("'", "'\\''").replace(":", "\\:")
                
                drawtext_filter = (
                    f"drawtext=text='{escaped_text}':"
                    f"fontsize={font_size}:fontcolor={font_color}:"
                    f"x={pos_expr.split(':')[0]}:y={pos_expr.split(':')[1]}:"
                    f"box=1:boxcolor={background_color}:boxborderw=10"
                )
                
                if start_time > 0 or end_time is not None:
                    enable_expr = f"between(t,{start_time},{end_time if end_time else 9999})"
                    drawtext_filter += f":enable='{enable_expr}'"
                
                with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as output_file:
                    output_path = output_file.name
                
                cmd = [
                    "ffmpeg", "-i", input_path, "-vf", drawtext_filter,
                    "-c:v", "libx264", "-preset", "medium", "-crf", "23",
                    "-c:a", "copy", "-y", output_path
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                
                if result.returncode != 0:
                    raise HTTPException(status_code=500, detail=f"Text overlay failed: {result.stderr}")
                
                with open(output_path, "rb") as f:
                    processed_video_bytes = f.read()
                
                from backend.services.content_assets.content_asset_service import ContentAssetService
                from backend.database.database import get_db
                
                db_gen = get_db()
                db = next(db_gen)
                try:
                    asset_service = ContentAssetService(db)
                    filename = f"edited_text_{uuid.uuid4().hex[:8]}.mp4"
                    
                    asset_result = asset_service.save_video_asset(
                        user_id=user_id,
                        video_data=processed_video_bytes,
                        filename=filename,
                        asset_type="video_edit",
                        metadata={"edit_type": "text_overlay", "text": text[:100], "position": position},
                    )
                    
                    return {
                        "success": True,
                        "video_url": asset_result.get("url"),
                        "asset_id": asset_result.get("asset_id"),
                        "cost": 0.0,
                        "edit_type": "text_overlay",
                        "metadata": {"text": text[:100], "position": position, "font_size": font_size},
                    }
                finally:
                    db.close()
                    
            finally:
                Path(input_path).unlink(missing_ok=True)
                if output_path:
                    Path(output_path).unlink(missing_ok=True)
                    
        except Exception as e:
            logger.error(f"[EditService] Text overlay failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Text overlay failed: {str(e)}")
    
    async def adjust_volume(
        self,
        video_data: bytes,
        volume_factor: float,
        user_id: str = None,
    ) -> Dict[str, Any]:
        """Adjust video audio volume using FFmpeg."""
        try:
            logger.info(f"[EditService] Volume adjustment: user={user_id}, factor={volume_factor}")
            
            try:
                validated_volume_factor = float(volume_factor)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Volume factor must be a valid number")

            if not math.isfinite(validated_volume_factor):
                raise HTTPException(status_code=400, detail="Volume factor must be a finite number")

            if validated_volume_factor < 0:
                raise HTTPException(status_code=400, detail="Volume factor must be non-negative")

            if validated_volume_factor > 5.0:
                raise HTTPException(status_code=400, detail="Volume factor cannot exceed 5.0 to prevent distortion")

            safe_volume_factor = f"{validated_volume_factor:.6f}".rstrip("0").rstrip(".")
            if safe_volume_factor == "":
                safe_volume_factor = "0"
            
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as input_file:
                input_file.write(video_data)
                input_path = input_file.name
            
            output_path = None
            
            try:
                with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as output_file:
                    output_path = output_file.name
                
                cmd = [
                    "ffmpeg", "-i", input_path,
                    "-af", f"volume={safe_volume_factor}",
                    "-c:v", "copy", "-c:a", "aac", "-y", output_path
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                
                if result.returncode != 0:
                    raise HTTPException(status_code=500, detail=f"Volume adjustment failed: {result.stderr}")
                
                with open(output_path, "rb") as f:
                    processed_video_bytes = f.read()
                
                from backend.services.content_assets.content_asset_service import ContentAssetService
                from backend.database.database import get_db
                
                db_gen = get_db()
                db = next(db_gen)
                try:
                    asset_service = ContentAssetService(db)
                    filename = f"edited_volume_{uuid.uuid4().hex[:8]}.mp4"
                    
                    asset_result = asset_service.save_video_asset(
                        user_id=user_id,
                        video_data=processed_video_bytes,
                        filename=filename,
                        asset_type="video_edit",
                        metadata={"edit_type": "volume", "volume_factor": validated_volume_factor},
                    )
                    
                    return {
                        "success": True,
                        "video_url": asset_result.get("url"),
                        "asset_id": asset_result.get("asset_id"),
                        "cost": 0.0,
                        "edit_type": "volume",
                        "metadata": {"volume_factor": validated_volume_factor},
                    }
                finally:
                    db.close()
                    
            finally:
                Path(input_path).unlink(missing_ok=True)
                if output_path:
                    Path(output_path).unlink(missing_ok=True)
                    
        except Exception as e:
            logger.error(f"[EditService] Volume adjustment failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Volume adjustment failed: {str(e)}")
    
    async def normalize_audio(
        self,
        video_data: bytes,
        target_level: float = -14.0,
        user_id: str = None,
    ) -> Dict[str, Any]:
        """Normalize audio levels using FFmpeg loudnorm filter (EBU R128)."""
        try:
            logger.info(f"[EditService] Audio normalization: user={user_id}, level={target_level} LUFS")

            try:
                sanitized_target_level = float(target_level)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Invalid target level")

            if not math.isfinite(sanitized_target_level):
                raise HTTPException(status_code=400, detail="Invalid target level")

            if sanitized_target_level > 0.0 or sanitized_target_level < -50.0:
                raise HTTPException(
                    status_code=400,
                    detail="Target level must be between -50 and 0 LUFS"
                )

            ffmpeg_target_level = f"{sanitized_target_level:.2f}"
            
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as input_file:
                input_file.write(video_data)
                input_path = input_file.name
            
            output_path = None
            
            try:
                with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as output_file:
                    output_path = output_file.name
                
                cmd = [
                    "ffmpeg", "-i", input_path,
                    "-af", f"loudnorm=I={ffmpeg_target_level}:TP=-1.5:LRA=11",
                    "-c:v", "copy", "-c:a", "aac", "-y", output_path
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                
                if result.returncode != 0:
                    raise HTTPException(status_code=500, detail=f"Audio normalization failed: {result.stderr}")
                
                with open(output_path, "rb") as f:
                    processed_video_bytes = f.read()
                
                from backend.services.content_assets.content_asset_service import ContentAssetService
                from backend.database.database import get_db
                
                db_gen = get_db()
                db = next(db_gen)
                try:
                    asset_service = ContentAssetService(db)
                    filename = f"edited_normalized_{uuid.uuid4().hex[:8]}.mp4"
                    
                    asset_result = asset_service.save_video_asset(
                        user_id=user_id,
                        video_data=processed_video_bytes,
                        filename=filename,
                        asset_type="video_edit",
                        metadata={"edit_type": "normalize", "target_level": sanitized_target_level},
                    )
                    
                    return {
                        "success": True,
                        "video_url": asset_result.get("url"),
                        "asset_id": asset_result.get("asset_id"),
                        "cost": 0.0,
                        "edit_type": "normalize",
                        "metadata": {"target_level": sanitized_target_level},
                    }
                finally:
                    db.close()
                    
            finally:
                Path(input_path).unlink(missing_ok=True)
                if output_path:
                    Path(output_path).unlink(missing_ok=True)
                    
        except Exception as e:
            logger.error(f"[EditService] Audio normalization failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Audio normalization failed: {str(e)}")
    
    async def reduce_noise(
        self,
        video_data: bytes,
        noise_reduction_strength: float = 0.5,
        user_id: str = None,
    ) -> Dict[str, Any]:
        """Reduce audio noise using FFmpeg's anlmdn filter."""
        try:
            logger.info(f"[EditService] Noise reduction: user={user_id}, strength={noise_reduction_strength}")
            
            strength = max(0.0, min(1.0, noise_reduction_strength))
            
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as input_file:
                input_file.write(video_data)
                input_path = input_file.name
            
            output_path = None
            
            try:
                with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as output_file:
                    output_path = output_file.name
                
                sigma = 0.0001 + (strength * 0.005)
                
                cmd = [
                    "ffmpeg", "-i", input_path,
                    "-af", f"anlmdn=s={sigma}:p=0.002:r=0.002",
                    "-c:v", "copy", "-c:a", "aac", "-y", output_path
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
                
                if result.returncode != 0:
                    # Fallback to highpass/lowpass
                    cmd = [
                        "ffmpeg", "-i", input_path,
                        "-af", "highpass=f=80,lowpass=f=12000",
                        "-c:v", "copy", "-c:a", "aac", "-y", output_path
                    ]
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                    
                    if result.returncode != 0:
                        raise HTTPException(status_code=500, detail=f"Noise reduction failed: {result.stderr}")
                
                with open(output_path, "rb") as f:
                    processed_video_bytes = f.read()
                
                from backend.services.content_assets.content_asset_service import ContentAssetService
                from backend.database.database import get_db
                
                db_gen = get_db()
                db = next(db_gen)
                try:
                    asset_service = ContentAssetService(db)
                    filename = f"edited_denoised_{uuid.uuid4().hex[:8]}.mp4"
                    
                    asset_result = asset_service.save_video_asset(
                        user_id=user_id,
                        video_data=processed_video_bytes,
                        filename=filename,
                        asset_type="video_edit",
                        metadata={"edit_type": "noise_reduction", "strength": strength},
                    )
                    
                    return {
                        "success": True,
                        "video_url": asset_result.get("url"),
                        "asset_id": asset_result.get("asset_id"),
                        "cost": 0.0,
                        "edit_type": "noise_reduction",
                        "metadata": {"strength": strength},
                    }
                finally:
                    db.close()
                    
            finally:
                Path(input_path).unlink(missing_ok=True)
                if output_path:
                    Path(output_path).unlink(missing_ok=True)
                    
        except Exception as e:
            logger.error(f"[EditService] Noise reduction failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Noise reduction failed: {str(e)}")

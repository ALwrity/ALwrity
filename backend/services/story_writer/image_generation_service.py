"""
Image Generation Service for Story Writer

Generates images for story scenes using the existing image generation service.
"""

import os
import base64
import uuid
from typing import List, Dict, Any, Optional
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy.orm import Session

from services.llm_providers.main_image_generation import generate_image
from services.llm_providers.image_generation import ImageGenerationResult
from utils.logger_utils import get_service_logger

logger = get_service_logger("story_writer.image_generation")


def _get_story_media_write_dir(media_type: str, user_id: Optional[str] = None, db: Optional[Session] = None) -> Path:
    """Lazy import wrapper to avoid circular imports."""
    from api.story_writer.utils.media_utils import get_story_media_write_dir
    return get_story_media_write_dir(media_type, user_id=user_id, db=db)


class StoryImageGenerationService:
    """Service for generating images for story scenes."""
    
    def __init__(self, output_dir: Optional[str] = None):
        """
        Initialize the image generation service.
        
        Parameters:
            output_dir (str, optional): Directory to save generated images.
                                      Defaults to canonical workspace media path if not provided.
        """
        if output_dir:
            self.output_dir = Path(output_dir)
            self.output_dir.mkdir(parents=True, exist_ok=True)
        else:
            self.output_dir = _get_story_media_write_dir("image")
        logger.info(f"[StoryImageGeneration] Initialized with output directory: {self.output_dir}")
    
    def _get_user_image_dir(self, user_id: str, db: Optional[Session] = None) -> Path:
        """
        Get the image directory for a specific user.
        Falls back to default output_dir if workspace not found.
        """
        try:
            return _get_story_media_write_dir("image", user_id=user_id, db=db)
        except Exception as e:
            logger.warning(f"[StoryImageGeneration] Failed to resolve user workspace path for {user_id}: {e}")
            return self.output_dir

    def _generate_image_filename(self, scene_number: int, scene_title: str) -> str:
        """Generate a unique filename for a scene image."""
        # Clean scene title for filename
        clean_title = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in scene_title[:30])
        unique_id = str(uuid.uuid4())[:8]
        return f"scene_{scene_number}_{clean_title}_{unique_id}.png"

    def _refine_image_prompt_with_bible(
        self,
        image_prompt: str,
        scene: Dict[str, Any],
        anime_bible: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Enrich image prompt with 3-4 essential visual anchors from the anime bible.

        Keeps only high-signal items that image models interpret cleanly:
        style preset, world setting, and character consistency. Deterministic — no
        extra LLM calls.
        """
        if not image_prompt or not isinstance(image_prompt, str):
            return image_prompt

        if not anime_bible or not isinstance(anime_bible, dict):
            return image_prompt

        visual_style = anime_bible.get("visual_style") or {}
        world = anime_bible.get("world") or {}
        main_cast = anime_bible.get("main_cast") or []

        parts: List[str] = []

        # 1. Style preset — the single most impactful visual anchor
        style_preset = visual_style.get("style_preset")
        if style_preset:
            parts.append(f"{style_preset} anime illustration style")

        # 2. World setting — contextual backdrop for the scene
        if isinstance(world, dict):
            setting = world.get("setting")
            if setting:
                parts.append(f"world setting: {setting}")

        # 3. Character visibility — which cast members appear, with look details for in-scene characters
        scene_chars = scene.get("character_descriptions") or []
        if isinstance(scene_chars, list) and isinstance(main_cast, list):
            for desc in scene_chars:
                desc_lower = desc.lower()
                for member in main_cast:
                    if not isinstance(member, dict):
                        continue
                    name = member.get("name", "")
                    if name and name.lower() in desc_lower:
                        details = []
                        look = member.get("look")
                        if look:
                            details.append(f"look: {look}")
                        outfit = member.get("outfit_palette")
                        if outfit:
                            details.append(f"outfit: {outfit}")
                        if details:
                            parts.append(f"{name} ({', '.join(details)})")
                        break

        # 4. Character design consistency anchor
        if isinstance(main_cast, list):
            names = [
                c.get("name")
                for c in main_cast
                if isinstance(c, dict) and c.get("name")
            ]
            if names:
                joined = ", ".join(names[:4])
                parts.append(f"keep character designs consistent for: {joined}")

        if not parts:
            return image_prompt

        suffix = ", " + ", ".join(parts)
        return image_prompt.strip() + suffix
    
    def generate_scene_image(
        self,
        scene: Dict[str, Any],
        user_id: str,
        provider: Optional[str] = None,
        width: int = 1024,
        height: int = 1024,
        model: Optional[str] = None,
        anime_bible: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate an image for a single story scene.
        
        Parameters:
            scene (Dict[str, Any]): Scene data with image_prompt.
            user_id (str): Clerk user ID for subscription checking.
            provider (str, optional): Image generation provider (gemini, huggingface, stability).
            width (int): Image width (default: 1024).
            height (int): Image height (default: 1024).
            model (str, optional): Model to use for image generation.
        
        Returns:
            Dict[str, Any]: Image metadata including file path, URL, and scene info.
        """
        scene_number = scene.get("scene_number", 0)
        scene_title = scene.get("title", "Untitled")
        image_prompt = scene.get("image_prompt", "")

        if anime_bible:
            try:
                image_prompt = self._refine_image_prompt_with_bible(
                    image_prompt=image_prompt,
                    scene=scene,
                    anime_bible=anime_bible,
                )
            except Exception as e:
                logger.warning(f"[StoryImageGeneration] Failed to refine image prompt with bible: {e}")
        
        if not image_prompt:
            raise ValueError(f"Scene {scene_number} ({scene_title}) has no image_prompt")
        
        try:
            logger.info(f"[StoryImageGeneration] Generating image for scene {scene_number}: {scene_title}")
            logger.debug(f"[StoryImageGeneration] Image prompt: {image_prompt[:100]}...")
            
            # Generate image using main_image_generation service
            image_options = {
                "provider": provider,
                "width": width,
                "height": height,
                "model": model,
            }
            
            result: ImageGenerationResult = generate_image(
                prompt=image_prompt,
                options=image_options,
                user_id=user_id
            )
            
            # Save image to file
            image_filename = self._generate_image_filename(scene_number, scene_title)
            image_path = self.output_dir / image_filename
            
            with open(image_path, "wb") as f:
                f.write(result.image_bytes)
            
            logger.info(f"[StoryImageGeneration] Saved image to: {image_path}")
            
            # Return image metadata
            # Use relative path for image_url (will be served via API endpoint)
            return {
                "scene_number": scene_number,
                "scene_title": scene_title,
                "image_path": str(image_path),
                "image_filename": image_filename,
                "image_url": f"/api/story/images/{image_filename}",  # API endpoint to serve images
                "width": result.width,
                "height": result.height,
                "provider": result.provider,
                "model": result.model,
                "seed": result.seed,
            }
            
        except HTTPException:
            # Re-raise HTTPExceptions (e.g., 429 subscription limit)
            raise
        except Exception as e:
            logger.error(f"[StoryImageGeneration] Error generating image for scene {scene_number}: {e}")
            raise RuntimeError(f"Failed to generate image for scene {scene_number}: {str(e)}") from e
    
    def generate_scene_images(
        self,
        scenes: List[Dict[str, Any]],
        user_id: str,
        provider: Optional[str] = None,
        width: int = 1024,
        height: int = 1024,
        model: Optional[str] = None,
        progress_callback: Optional[callable] = None,
        db: Optional[Session] = None,
        anime_bible: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate images for multiple story scenes.
        
        Parameters:
            scenes (List[Dict[str, Any]]): List of scene data with image_prompts.
            user_id (str): Clerk user ID for subscription checking.
            provider (str, optional): Image generation provider (gemini, huggingface, stability).
            width (int): Image width (default: 1024).
            height (int): Image height (default: 1024).
            model (str, optional): Model to use for image generation.
            progress_callback (callable, optional): Callback function for progress updates.
            db (Session, optional): Database session.
        
        Returns:
            List[Dict[str, Any]]: List of image metadata for each scene.
        """
        if not scenes:
            raise ValueError("No scenes provided for image generation")
        
        logger.info(f"[StoryImageGeneration] Generating images for {len(scenes)} scenes")
        
        image_results = []
        total_scenes = len(scenes)
        
        for idx, scene in enumerate(scenes):
            try:
                # Generate image for scene
                image_result = self.generate_scene_image(
                    scene=scene,
                    user_id=user_id,
                    provider=provider,
                    width=width,
                    height=height,
                    model=model,
                    anime_bible=anime_bible,
                )
                
                image_results.append(image_result)
                
                # Call progress callback if provided
                if progress_callback:
                    progress = ((idx + 1) / total_scenes) * 100
                    progress_callback(progress, f"Generated image for scene {scene.get('scene_number', idx + 1)}")
                
                logger.info(f"[StoryImageGeneration] Generated image {idx + 1}/{total_scenes}")
                
            except Exception as e:
                logger.error(f"[StoryImageGeneration] Failed to generate image for scene {idx + 1}: {e}")
                # Continue with next scene instead of failing completely
                image_results.append({
                    "scene_number": scene.get("scene_number", idx + 1),
                    "scene_title": scene.get("title", "Untitled"),
                    "error": str(e),
                    "image_path": None,
                    "image_url": None,
                })
        
        logger.info(f"[StoryImageGeneration] Generated {len(image_results)} images out of {total_scenes} scenes")
        return image_results
    
    def regenerate_scene_image(
        self,
        scene_number: int,
        scene_title: str,
        prompt: str,
        user_id: str,
        provider: Optional[str] = None,
        width: int = 1024,
        height: int = 1024,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Regenerate an image for a single scene using a direct prompt (no AI prompt generation).
        
        Parameters:
            scene_number (int): Scene number.
            scene_title (str): Scene title.
            prompt (str): Direct prompt to use for image generation.
            user_id (str): Clerk user ID for subscription checking.
            provider (str, optional): Image generation provider (gemini, huggingface, stability).
            width (int): Image width (default: 1024).
            height (int): Image height (default: 1024).
            model (str, optional): Model to use for image generation.
        
        Returns:
            Dict[str, Any]: Image metadata including file path, URL, and scene info.
        """
        if not prompt or not prompt.strip():
            raise ValueError(f"Scene {scene_number} ({scene_title}) requires a non-empty prompt")
        
        try:
            logger.info(f"[StoryImageGeneration] Regenerating image for scene {scene_number}: {scene_title}")
            logger.debug(f"[StoryImageGeneration] Using direct prompt: {prompt[:100]}...")
            
            # Generate image using main_image_generation service with the direct prompt
            image_options = {
                "provider": provider,
                "width": width,
                "height": height,
                "model": model,
            }
            
            result: ImageGenerationResult = generate_image(
                prompt=prompt.strip(),
                options=image_options,
                user_id=user_id
            )
            
            # Save image to file
            image_filename = self._generate_image_filename(scene_number, scene_title)
            image_path = self.output_dir / image_filename
            
            with open(image_path, "wb") as f:
                f.write(result.image_bytes)
            
            logger.info(f"[StoryImageGeneration] Saved regenerated image to: {image_path}")
            
            # Return image metadata
            return {
                "scene_number": scene_number,
                "scene_title": scene_title,
                "image_path": str(image_path),
                "image_filename": image_filename,
                "image_url": f"/api/story/images/{image_filename}",
                "width": result.width,
                "height": result.height,
                "provider": result.provider,
                "model": result.model,
                "seed": result.seed,
            }
            
        except HTTPException:
            # Re-raise HTTPExceptions (e.g., 429 subscription limit)
            raise
        except Exception as e:
            logger.error(f"[StoryImageGeneration] Error regenerating image for scene {scene_number}: {e}")
            raise RuntimeError(f"Failed to regenerate image for scene {scene_number}: {str(e)}") from e

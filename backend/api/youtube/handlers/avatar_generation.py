"""Generate YouTube creator avatars from plan/context."""

import uuid
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session

from services.llm_providers.main_image_generation import generate_image
from utils.asset_tracker import save_asset_to_library
from utils.logger_utils import get_service_logger

from ..paths import YOUTUBE_AVATARS_DIR

logger = get_service_logger("api.youtube.avatar_generation")


async def _generate_avatar_from_context(
    user_id: str,
    project_id: Optional[str],
    audience: Optional[str] = None,
    content_type: Optional[str] = None,
    video_plan_json: Optional[str] = None,
    brand_style: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Internal function to generate avatar from context.
    Can be called from route handler or directly from router.
    """
    # Parse video plan if provided
    plan_data = {}
    avatar_recommendations = {}
    if video_plan_json:
        try:
            import json
            plan_data = json.loads(video_plan_json)
            avatar_recommendations = plan_data.get("avatar_recommendations", {})
        except Exception as e:
            logger.warning(f"[YouTube] Failed to parse video plan JSON: {e}")

    # Extract context - prioritize user inputs over plan data
    # User inputs are more reliable as they represent explicit choices
    # Priority: user input > plan data > defaults
    plan_target_audience = audience or plan_data.get("target_audience", "")
    plan_video_type = content_type or plan_data.get("video_type", "")
    # Use user's brand_style if provided, otherwise use plan's visual_style
    plan_visual_style = brand_style or plan_data.get("visual_style", "")
    plan_tone = plan_data.get("tone", "")
    
    logger.info(
        f"[YouTube] Avatar generation context: "
        f"video_type={plan_video_type}, audience={plan_target_audience[:50] if plan_target_audience else 'none'}, "
        f"brand_style={plan_visual_style[:50] if plan_visual_style else 'none'}"
    )

    # Build optimized prompt using plan data
    prompt_parts = []
    
    # Base avatar description - use recommendations if available
    if avatar_recommendations and avatar_recommendations.get("description"):
        prompt_parts.append(avatar_recommendations["description"])
    else:
        prompt_parts.append("Half-length portrait of a professional YouTube creator (25-35 years old)")
    
    # Video type optimization
    if plan_video_type:
        video_type_lower = plan_video_type.lower()
        if video_type_lower == "tutorial":
            prompt_parts.append("approachable instructor, professional yet friendly, clear presentation style")
        elif video_type_lower == "review":
            prompt_parts.append("trustworthy reviewer, confident, credible appearance")
        elif video_type_lower == "educational":
            prompt_parts.append("knowledgeable educator, professional, warm and engaging")
        elif video_type_lower == "entertainment":
            prompt_parts.append("energetic creator, expressive, fun and relatable")
        elif video_type_lower == "vlog":
            prompt_parts.append("authentic person, approachable, real and relatable")
        elif video_type_lower == "product_demo":
            prompt_parts.append("professional presenter, polished, confident and enthusiastic")
        elif video_type_lower == "reaction":
            prompt_parts.append("expressive creator, authentic reactions, engaging")
        elif video_type_lower == "storytelling":
            prompt_parts.append("storyteller, warm, engaging narrator")
        elif "tech" in video_type_lower:
            prompt_parts.append("tech-forward style")
        elif "travel" in video_type_lower:
            prompt_parts.append("travel vlogger aesthetic")
        elif "education" in video_type_lower or "learn" in video_type_lower:
            prompt_parts.append("educational creator, clean and clear presentation")
        else:
            prompt_parts.append("modern creator style")
    elif content_type:
        content_lower = content_type.lower()
        if "tech" in content_lower:
            prompt_parts.append("tech-forward style")
        elif "travel" in content_lower:
            prompt_parts.append("travel vlogger aesthetic")
        elif "education" in content_lower or "learn" in content_lower:
            prompt_parts.append("educational creator, clean and clear presentation")
        else:
            prompt_parts.append("modern creator style")

    # Audience optimization
    target_audience = plan_target_audience or audience
    if target_audience:
        audience_lower = target_audience.lower()
        if "young" in audience_lower or "gen z" in audience_lower or "millennial" in audience_lower:
            prompt_parts.append("youthful, vibrant, modern vibe")
        elif "executive" in audience_lower or "professional" in audience_lower or "business" in audience_lower:
            prompt_parts.append("polished, credible, authoritative presence")
        elif "creative" in audience_lower:
            prompt_parts.append("artistic, expressive, creative professional")
        elif "parents" in audience_lower or "family" in audience_lower:
            prompt_parts.append("warm, approachable, trustworthy presence")
    
    # Visual style from plan
    if plan_visual_style:
        visual_lower = plan_visual_style.lower()
        if "minimal" in visual_lower or "minimalist" in visual_lower:
            prompt_parts.append("clean, minimalist aesthetic")
        if "tech" in visual_lower or "modern" in visual_lower:
            prompt_parts.append("tech-forward, modern style")
        if "energetic" in visual_lower or "colorful" in visual_lower or "vibrant" in visual_lower:
            prompt_parts.append("vibrant, energetic appearance")
        if "cinematic" in visual_lower:
            prompt_parts.append("cinematic, polished presentation")
        if "professional" in visual_lower:
            prompt_parts.append("professional, polished aesthetic")
    
    # Tone from plan
    if plan_tone:
        tone_lower = plan_tone.lower()
        if "casual" in tone_lower:
            prompt_parts.append("casual, approachable style")
        if "professional" in tone_lower:
            prompt_parts.append("professional attire and presentation")
        if "energetic" in tone_lower or "fun" in tone_lower:
            prompt_parts.append("energetic, lively expression")
        if "warm" in tone_lower:
            prompt_parts.append("warm, friendly expression")
    
    # Avatar recommendations from plan
    if avatar_recommendations:
        if avatar_recommendations.get("style"):
            prompt_parts.append(avatar_recommendations["style"])
        if avatar_recommendations.get("energy"):
            prompt_parts.append(avatar_recommendations["energy"])

    # Base technical requirements
    prompt_parts.extend([
        "photo-realistic, professional photography",
        "confident, engaging expression",
        "professional studio lighting, clean background",
        "suitable for video generation and thumbnails",
        "ultra realistic, 4k quality, 85mm lens",
        "looking at camera, center-focused composition"
    ])

    prompt = ", ".join(prompt_parts)
    seed = int(uuid.uuid4().int % (2**32))

    image_options = {
        "provider": "wavespeed",
        "model": "ideogram-v3-turbo",
        "width": 1024,
        "height": 1024,
        "seed": seed,
    }

    result = generate_image(
        prompt=prompt,
        options=image_options,
        user_id=user_id,
    )

    unique_id = str(uuid.uuid4())[:8]
    avatar_filename = f"yt_generated_{project_id or 'temp'}_{unique_id}.png"
    avatar_path = YOUTUBE_AVATARS_DIR / avatar_filename

    with open(avatar_path, "wb") as f:
        f.write(result.image_bytes)

    avatar_url = f"/api/youtube/images/avatars/{avatar_filename}"
    logger.info(f"[YouTube] Generated creator avatar: {avatar_path}")

    if project_id and db:
        try:
            save_asset_to_library(
                db=db,
                user_id=user_id,
                asset_type="image",
                source_module="youtube_creator",
                filename=avatar_filename,
                file_url=avatar_url,
                file_path=str(avatar_path),
                file_size=len(result.image_bytes),
                mime_type="image/png",
                title=f"YouTube Creator Avatar (Generated) - {project_id}",
                description="AI-generated YouTube creator avatar",
                prompt=prompt,
                tags=["youtube", "avatar", "generated", project_id],
                provider=result.provider,
                model=result.model,
                asset_metadata={
                    "project_id": project_id,
                    "type": "generated_presenter",
                    "status": "completed",
                },
            )
        except Exception as e:
            logger.warning(f"[YouTube] Failed to save generated avatar asset: {e}")

    return {
        "avatar_url": avatar_url,
        "avatar_filename": avatar_filename,
        "avatar_prompt": prompt,
        "message": "Avatar generated successfully",
    }

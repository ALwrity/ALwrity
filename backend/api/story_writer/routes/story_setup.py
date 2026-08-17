from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy import desc

from middleware.auth_middleware import get_current_user
from models.story_models import (
    StorySetupGenerationRequest,
    StorySetupGenerationResponse,
    StorySetupOption,
    StoryGenerationRequest,
    StoryOutlineResponse,
    StoryScene,
    StoryStartRequest,
    StoryPremiseResponse,
    TaskStatus,
    StoryIdeaEnhanceRequest,
    StoryIdeaEnhanceResponse,
    StoryIdeaEnhanceSuggestion,
)
from services.story_writer.story_service import StoryWriterService
from api.onboarding_utils.onboarding_summary_service import OnboardingSummaryService
from services.database import get_session_for_user
from models.content_asset_models import ContentAsset, AssetType, AssetSource

from ..utils.auth import require_authenticated_user
from ..task_manager import task_manager


router = APIRouter()
story_service = StoryWriterService()


@router.post("/generate-setup", response_model=StorySetupGenerationResponse)
async def generate_story_setup(
    request: StorySetupGenerationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> StorySetupGenerationResponse:
    """Generate 3 story setup options from a user's story idea."""
    try:
        user_id = require_authenticated_user(current_user)

        if not request.story_idea or not request.story_idea.strip():
            raise HTTPException(status_code=400, detail="Story idea is required")

        logger.info(f"[StoryWriter] Generating story setup options for user {user_id}")

        options = story_service.generate_story_setup_options(
            story_idea=request.story_idea,
            story_mode=request.story_mode,
            story_template=request.story_template,
            brand_context=request.brand_context,
            user_id=user_id,
        )

        setup_options = [StorySetupOption(**option) for option in options]
        return StorySetupGenerationResponse(options=setup_options, success=True)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to generate story setup options: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/enhance-idea", response_model=StoryIdeaEnhanceResponse)
async def enhance_story_idea(
    request: StoryIdeaEnhanceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> StoryIdeaEnhanceResponse:
    try:
        user_id = require_authenticated_user(current_user)

        if not request.story_idea or not request.story_idea.strip():
            raise HTTPException(status_code=400, detail="Story idea is required")

        logger.info(f"[StoryWriter] Enhancing story idea for user {user_id}")

        suggestions = story_service.enhance_story_idea(
            story_idea=request.story_idea,
            story_mode=request.story_mode,
            story_template=request.story_template,
            brand_context=request.brand_context,
            user_id=user_id,
            fiction_variant=request.fiction_variant,
            narrative_energy=request.narrative_energy,
            fiction_variant_description=request.fiction_variant_description,
            narrative_energy_description=request.narrative_energy_description,
        )

        return StoryIdeaEnhanceResponse(
            suggestions=[StoryIdeaEnhanceSuggestion(**s) for s in suggestions],
            success=True,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to enhance story idea: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/context")
async def get_story_context(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return onboarding-based story context for the current user."""
    try:
        user_id = require_authenticated_user(current_user)
        summary_service = OnboardingSummaryService(user_id)
        summary = await summary_service.get_onboarding_summary()

        canonical_profile = summary.get("canonical_profile") or {}
        persona_readiness = summary.get("persona_readiness") or {}
        capabilities = summary.get("capabilities") or {}

        website_url = summary.get("website_url")
        style_analysis = summary.get("style_analysis") or {}
        research_preferences = summary.get("research_preferences") or {}

        brand_name = None
        if isinstance(style_analysis, dict):
            brand_name = style_analysis.get("brand_name") or style_analysis.get("site_title")

        # E.3 (deferred): STRUCTURED consumer — read canonical_profile.brand_voice ONLY
        # (unified persona-or-website, §2.2); legacy writing_tone below is the shim, removed at E.4.
        writing_tone = canonical_profile.get("writing_tone")
        target_audience = canonical_profile.get("target_audience")

        brand_context = {
            "brand_name": brand_name,
            "writing_tone": writing_tone,
            "target_audience": target_audience,
        }

        avatar_url = None
        voice_preview_url = None
        custom_voice_id = None

        db: Session | None = get_session_for_user(user_id)
        if db:
            try:
                avatar_asset = (
                    db.query(ContentAsset)
                    .filter(
                        ContentAsset.user_id == user_id,
                        ContentAsset.asset_type == AssetType.IMAGE,
                        ContentAsset.source_module.in_(
                            [AssetSource.BRAND_AVATAR_GENERATOR, AssetSource.STORY_WRITER]
                        ),
                    )
                    .order_by(desc(ContentAsset.created_at))
                    .limit(50)
                    .all()
                )

                selected_avatar = None
                for candidate in avatar_asset:
                    if candidate.source_module == AssetSource.BRAND_AVATAR_GENERATOR:
                        selected_avatar = candidate
                        break
                    meta = candidate.asset_metadata or {}
                    if meta.get("category") == "brand_avatar":
                        selected_avatar = candidate
                        break

                if selected_avatar:
                    avatar_url = selected_avatar.file_url

                voice_asset = (
                    db.query(ContentAsset)
                    .filter(
                        ContentAsset.user_id == user_id,
                        ContentAsset.asset_type == AssetType.AUDIO,
                        ContentAsset.source_module == AssetSource.VOICE_CLONER,
                    )
                    .order_by(desc(ContentAsset.created_at))
                    .first()
                )

                if voice_asset:
                    meta = voice_asset.asset_metadata or {}
                    voice_preview_url = meta.get("preview_url") or voice_asset.file_url
                    custom_voice_id = meta.get("custom_voice_id")
            finally:
                db.close()

        persona_enabled = bool(persona_readiness.get("ready")) and bool(
            capabilities.get("persona_generation")
        )
        has_persona_context = persona_enabled and bool(
            brand_name or writing_tone or target_audience or avatar_url or voice_preview_url
        )

        return {
            "canonical_profile": canonical_profile,
            "website_url": website_url,
            "research_preferences": research_preferences,
            "brand_context": brand_context,
            "brand_assets": {
                "avatar_url": avatar_url,
                "voice_preview_url": voice_preview_url,
                "custom_voice_id": custom_voice_id,
            },
            "persona_enabled": persona_enabled,
            "has_persona_context": has_persona_context,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to get story context: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load story context")


@router.post("/generate-premise", response_model=StoryPremiseResponse)
async def generate_premise(
    request: StoryGenerationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> StoryPremiseResponse:
    """Generate a story premise."""
    try:
        user_id = require_authenticated_user(current_user)
        logger.info(f"[StoryWriter] Generating premise for user {user_id}")

        premise = story_service.generate_premise(
            persona=request.persona,
            story_setting=request.story_setting,
            character_input=request.character_input,
            plot_elements=request.plot_elements,
            writing_style=request.writing_style,
            story_tone=request.story_tone,
            narrative_pov=request.narrative_pov,
            audience_age_group=request.audience_age_group,
            content_rating=request.content_rating,
            ending_preference=request.ending_preference,
            user_id=user_id,
        )

        return StoryPremiseResponse(premise=premise, success=True)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to generate premise: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/generate-outline", response_model=StoryOutlineResponse)
async def generate_outline(
    request: StoryStartRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    use_structured: bool = True,
) -> StoryOutlineResponse:
    """Generate a story outline from a premise."""
    try:
        user_id = require_authenticated_user(current_user)

        if not request.premise or not request.premise.strip():
            raise HTTPException(status_code=400, detail="Premise is required")

        logger.info(
            f"[StoryWriter] Generating outline for user {user_id} (structured={use_structured})"
        )
        logger.info(
            "[StoryWriter] Outline params: audience_age_group=%s, writing_style=%s, story_tone=%s",
            request.audience_age_group,
            request.writing_style,
            request.story_tone,
        )

        # For now, treat all outlines as potentially anime-aware. The downstream
        # generation logic will decide whether to actually create a bible based
        # on how the prompt is interpreted (e.g., anime templates in persona).
        outline = story_service.generate_outline(
            premise=request.premise,
            persona=request.persona,
            story_setting=request.story_setting,
            character_input=request.character_input,
            plot_elements=request.plot_elements,
            writing_style=request.writing_style,
            story_tone=request.story_tone,
            narrative_pov=request.narrative_pov,
            audience_age_group=request.audience_age_group,
            content_rating=request.content_rating,
            ending_preference=request.ending_preference,
            user_id=user_id,
            use_structured_output=use_structured,
            include_anime_bible=True,
        )

        anime_bible: Dict[str, Any] | None = None
        outline_payload: Any = outline

        if isinstance(outline, dict):
            if "anime_bible" in outline:
                anime_bible = outline.get("anime_bible")
            if "scenes" in outline:
                outline_payload = outline.get("scenes")
            elif "outline" in outline:
                outline_payload = outline.get("outline")

        if isinstance(outline_payload, list):
            scenes: List[StoryScene] = [
                StoryScene(**scene) if isinstance(scene, dict) else scene for scene in outline_payload
            ]
            return StoryOutlineResponse(
                outline=scenes,
                success=True,
                is_structured=True,
                anime_bible=anime_bible,
            )

        return StoryOutlineResponse(
            outline=str(outline_payload),
            success=True,
            is_structured=False,
            anime_bible=anime_bible,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to generate outline: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/generate-outline/start")
async def start_outline_generation(
    request: StoryStartRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Start an outline generation operation and return a task ID for polling."""
    try:
        user_id = require_authenticated_user(current_user)

        if not request.premise or not request.premise.strip():
            raise HTTPException(status_code=400, detail="Premise is required")

        logger.info(f"[StoryWriter] Starting async outline generation for user {user_id}")

        task_id = task_manager.start_outline_generation_task(request.dict(), user_id)
        return {"task_id": task_id, "status": "started"}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to start outline generation: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/generate-outline/status/{task_id}", response_model=TaskStatus)
async def get_outline_status(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> TaskStatus:
    """Get the status of an outline generation operation."""
    try:
        require_authenticated_user(current_user)

        task_status = task_manager.get_task_status(task_id)
        if not task_status:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        return TaskStatus(**task_status)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to get outline status: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))



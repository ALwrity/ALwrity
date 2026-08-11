"""
Lightweight onboarding asset query routes.

This module intentionally avoids importing optional heavy generation providers,
so read-only asset queries stay available in feature-specific modes (e.g. youtube).
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import desc
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from models.content_asset_models import AssetSource, AssetType, ContentAsset
from services.database import get_db


def _extract_user_id(user: Dict[str, Any]) -> str:
    """Extract a stable authenticated user identifier."""
    if not isinstance(user, dict):
        return "unknown"
    return (
        user.get("clerk_user_id")
        or user.get("id")
        or user.get("user_id")
        or "unknown"
    )


router = APIRouter(prefix="/api/onboarding/assets", tags=["Onboarding Asset Queries"])


@router.get("/latest-avatar")
async def get_latest_avatar(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the latest brand avatar for the authenticated user."""
    try:
        user_id = _extract_user_id(current_user)
        logger.debug(f"[asset-query.latest-avatar] Looking for avatar for user_id={user_id}")

        candidates = (
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

        logger.debug(
            f"[asset-query.latest-avatar] Found {len(candidates)} candidate(s) for user_id={user_id}"
        )

        asset = None
        for candidate in candidates:
            if candidate.source_module == AssetSource.BRAND_AVATAR_GENERATOR:
                asset = candidate
                break

            if candidate.source_module == AssetSource.STORY_WRITER:
                meta = candidate.asset_metadata or {}
                if meta.get("category") == "brand_avatar":
                    asset = candidate
                    break

        if not asset:
            return {"success": False, "message": "No avatar found"}

        prompt = asset.prompt
        if not prompt and asset.asset_metadata:
            prompt = asset.asset_metadata.get("prompt", "")

        return {
            "success": True,
            "image_url": asset.file_url,
            "prompt": prompt,
            "asset_id": asset.id,
            "provider": asset.provider,
        }
    except Exception as exc:
        logger.exception(
            f"[asset-query.latest-avatar] Failed to fetch latest avatar for user: {exc}"
        )
        raise HTTPException(status_code=500, detail="Failed to fetch latest avatar") from exc


@router.get("/latest-voice-clone")
async def get_latest_voice_clone(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the latest voice clone for the authenticated user."""
    try:
        user_id = _extract_user_id(current_user)
        logger.debug(
            f"[asset-query.latest-voice-clone] Looking for voice clone for user_id={user_id}"
        )

        asset = (
            db.query(ContentAsset)
            .filter(
                ContentAsset.user_id == user_id,
                ContentAsset.asset_type == AssetType.AUDIO,
                ContentAsset.source_module == AssetSource.VOICE_CLONER,
            )
            .order_by(desc(ContentAsset.created_at))
            .first()
        )

        if not asset:
            return {"success": False, "message": "No voice clone found"}

        meta = asset.asset_metadata or {}
        return {
            "success": True,
            "custom_voice_id": meta.get("custom_voice_id"),
            "preview_audio_url": meta.get("preview_url") or asset.file_url,
            "asset_id": asset.id,
            "voice_name": meta.get("voice_name"),
            "engine": meta.get("engine"),
        }
    except Exception as exc:
        logger.exception(
            f"[asset-query.latest-voice-clone] Failed to fetch latest voice clone for user: {exc}"
        )
        raise HTTPException(status_code=500, detail="Failed to fetch latest voice clone") from exc


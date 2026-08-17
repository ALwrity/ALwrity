"""YouTube Channel Bible: per-user profile seed, persistence, and planner prompt."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.youtube_channel_bible_models import YouTubeChannelBibleRow
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.channel_bible")


class YouTubeChannelBible(BaseModel):
    """Flat channel identity used by Plan Step and the planner prompt."""

    channel_name: str = ""
    niche: str = ""
    target_audience: str = ""
    default_video_goal: str = ""
    default_cta: str = ""
    brand_style: str = ""
    visual_style_guide: str = ""
    tone: str = ""
    default_avatar_url: Optional[str] = None
    default_language: Optional[str] = Field(default="")


def empty_bible() -> YouTubeChannelBible:
    """Return an all-empty profile. Does not invent a mock channel."""
    return YouTubeChannelBible()


def _join_list(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if not isinstance(value, list):
        return ""
    parts = [str(item).strip() for item in value if str(item).strip()]
    return ", ".join(parts)


def _audience_from_prefs(target_audience: Any) -> str:
    if isinstance(target_audience, str):
        return target_audience.strip()
    if not isinstance(target_audience, dict):
        return ""
    parts = []
    for key in ("interests", "demographics"):
        joined = _join_list(target_audience.get(key))
        if joined:
            parts.append(joined)
    expertise = target_audience.get("expertise_level")
    if isinstance(expertise, str) and expertise.strip():
        parts.append(expertise.strip())
    return ", ".join(parts)


def seed_from_preferences(prefs: Optional[Dict[str, Any]]) -> YouTubeChannelBible:
    """Map onboarding preferences into a flat YouTube bible. No mock copy."""
    if not prefs or not isinstance(prefs, dict):
        logger.warning("[ChannelBible] No onboarding preferences; seeding empty profile")
        return empty_bible()

    industry = prefs.get("industry")
    niche = industry.strip() if isinstance(industry, str) else ""

    writing_style = prefs.get("writing_style")
    if not isinstance(writing_style, dict):
        writing_style = {}
    tone_raw = writing_style.get("tone")
    tone = tone_raw.strip() if isinstance(tone_raw, str) else ""

    style_prefs = prefs.get("style_preferences")
    if not isinstance(style_prefs, dict):
        style_prefs = {}
    aesthetic = style_prefs.get("aesthetic")
    brand_style = aesthetic.strip() if isinstance(aesthetic, str) else ""

    brand_values = prefs.get("brand_values")
    default_cta = _join_list(brand_values)

    profile = YouTubeChannelBible(
        niche=niche,
        target_audience=_audience_from_prefs(prefs.get("target_audience")),
        tone=tone,
        brand_style=brand_style,
        default_cta=default_cta,
        default_video_goal="",
        visual_style_guide="",
        default_avatar_url=None,
        default_language="",
    )
    logger.info(
        "[ChannelBible] Seeded from preferences: has_niche=%s has_audience=%s has_style=%s",
        bool(profile.niche),
        bool(profile.target_audience),
        bool(profile.brand_style),
    )
    return profile


def _row_to_profile(row: YouTubeChannelBibleRow) -> YouTubeChannelBible:
    data = row.profile if isinstance(row.profile, dict) else {}
    try:
        return YouTubeChannelBible.model_validate(data)
    except Exception as exc:
        logger.warning("[ChannelBible] Invalid stored profile; using empty. err=%s", exc)
        return empty_bible()


def get_or_create(db: Session, user_id: str) -> Tuple[YouTubeChannelBible, str]:
    """Load the user's bible, or seed from onboarding and insert a row."""
    if not user_id:
        raise ValueError("user_id is required")

    logger.info("[ChannelBible] get_or_create start user_id=%s", user_id)
    row = (
        db.query(YouTubeChannelBibleRow)
        .filter(YouTubeChannelBibleRow.user_id == user_id)
        .first()
    )
    if row:
        logger.info("[ChannelBible] Loaded saved profile user_id=%s", user_id)
        return _row_to_profile(row), "saved"

    prefs: Optional[Dict[str, Any]] = None
    try:
        from services.product_marketing.personalization_service import PersonalizationService

        prefs = PersonalizationService().get_user_preferences(user_id)
    except Exception as pref_err:
        logger.warning(
            "[ChannelBible] get_user_preferences failed; seeding empty. err=%s",
            pref_err,
            exc_info=True,
        )

    profile = seed_from_preferences(prefs)
    now = datetime.now(timezone.utc)
    row = YouTubeChannelBibleRow(
        user_id=user_id,
        profile=profile.model_dump(),
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    logger.info("[ChannelBible] Created onboarding-seeded profile user_id=%s", user_id)
    return profile, "onboarding"


def save(db: Session, user_id: str, profile: YouTubeChannelBible) -> YouTubeChannelBible:
    """Validate and upsert the user's channel bible."""
    if not user_id:
        raise ValueError("user_id is required")

    validated = YouTubeChannelBible.model_validate(profile)
    now = datetime.now(timezone.utc)
    row = (
        db.query(YouTubeChannelBibleRow)
        .filter(YouTubeChannelBibleRow.user_id == user_id)
        .first()
    )
    if row:
        row.profile = validated.model_dump()
        row.updated_at = now
        logger.info("[ChannelBible] Updated profile user_id=%s", user_id)
    else:
        row = YouTubeChannelBibleRow(
            user_id=user_id,
            profile=validated.model_dump(),
            created_at=now,
            updated_at=now,
        )
        db.add(row)
        logger.info("[ChannelBible] Inserted profile user_id=%s", user_id)

    db.commit()
    db.refresh(row)
    return _row_to_profile(row)


def serialize_for_prompt(profile: Optional[YouTubeChannelBible]) -> str:
    """Return a planner prompt block, or empty when identity fields are blank."""
    if profile is None:
        return ""

    niche = (profile.niche or "").strip()
    audience = (profile.target_audience or "").strip()
    style = (profile.brand_style or "").strip()
    cta = (profile.default_cta or "").strip()
    if not any((niche, audience, style, cta)):
        logger.info("[ChannelBible] serialize skipped: identity fields empty")
        return ""

    avatar = (profile.default_avatar_url or "").strip()
    avatar_line = ""
    if avatar and (avatar.startswith("/") or avatar.startswith("http")) and "token=" not in avatar.lower():
        avatar_line = f"- Default avatar path: {avatar}\n"

    return (
        "<youtube_channel_bible>\n"
        f"- Channel: {(profile.channel_name or '').strip() or 'N/A'}\n"
        f"- Niche: {niche or 'N/A'}\n"
        f"- Audience: {audience or 'N/A'}\n"
        f"- Tone: {(profile.tone or '').strip() or 'N/A'}\n"
        f"- Brand / visual style: {style or 'N/A'}\n"
        f"- Visual guide: {(profile.visual_style_guide or '').strip() or 'N/A'}\n"
        f"- Default goal: {(profile.default_video_goal or '').strip() or 'N/A'}\n"
        f"- Default CTA: {cta or 'N/A'}\n"
        f"{avatar_line}"
        "Use this as the channel’s standing identity. Do not contradict it unless "
        "the user’s video idea clearly requires it.\n"
        "</youtube_channel_bible>"
    )


def apply_to_plan_inputs(
    profile: YouTubeChannelBible,
    *,
    target_audience: Optional[str] = None,
    video_goal: Optional[str] = None,
    brand_style: Optional[str] = None,
    reference_image_description: Optional[str] = None,
) -> Dict[str, Optional[str]]:
    """Fill empty plan request fields from the bible. Never override nonempty values."""

    def _blank(value: Optional[str]) -> bool:
        return not (value or "").strip()

    applied = {
        "target_audience": (target_audience or "").strip() or None,
        "video_goal": (video_goal or "").strip() or None,
        "brand_style": (brand_style or "").strip() or None,
        "reference_image_description": (reference_image_description or "").strip() or None,
    }
    if _blank(target_audience) and profile.target_audience.strip():
        applied["target_audience"] = profile.target_audience.strip()
    if _blank(video_goal) and profile.default_video_goal.strip():
        applied["video_goal"] = profile.default_video_goal.strip()
    if _blank(brand_style) and profile.brand_style.strip():
        applied["brand_style"] = profile.brand_style.strip()
    if _blank(reference_image_description) and profile.visual_style_guide.strip():
        applied["reference_image_description"] = profile.visual_style_guide.strip()

    logger.info(
        "[ChannelBible] apply_to_plan_inputs filled_audience=%s filled_goal=%s filled_style=%s filled_visual=%s",
        _blank(target_audience) and bool(applied["target_audience"]),
        _blank(video_goal) and bool(applied["video_goal"]),
        _blank(brand_style) and bool(applied["brand_style"]),
        _blank(reference_image_description) and bool(applied["reference_image_description"]),
    )
    return applied

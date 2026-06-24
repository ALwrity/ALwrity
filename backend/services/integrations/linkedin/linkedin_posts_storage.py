"""
Persist fetched LinkedIn posts/articles via save_and_track_text_content().

Mirrors the generated-content pattern in backend/routers/linkedin.py.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.content_asset_models import AssetSource
from services.content_asset_service import ContentAssetService
from services.integrations.linkedin.linkedin_posts_types import NormalizedLinkedInPost
from utils.text_asset_tracker import save_and_track_text_content

CONTENT_ORIGIN = "unipile_fetch"
SOURCE_MODULE = "linkedin_writer"


def _preview_text(text: str, *, max_len: int = 500) -> str:
    cleaned = (text or "").strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3] + "..."


def _build_post_content(post: NormalizedLinkedInPost) -> str:
    if post.content_kind == "article":
        parts = [f"# {post.title}"]
        if post.article_subtitle:
            parts.append(post.article_subtitle)
        if post.text:
            parts.append(post.text)
        if post.share_url:
            parts.append(f"\nSource: {post.share_url}")
        return "\n\n".join(parts)
    return post.text or post.title


def _asset_metadata(post: NormalizedLinkedInPost) -> dict[str, Any]:
    return {
        "content_origin": CONTENT_ORIGIN,
        "content_kind": post.content_kind,
        "social_id": post.social_id,
        "unipile_post_id": post.unipile_post_id,
        "share_url": post.share_url,
        "parsed_datetime": post.parsed_datetime,
        "reaction_counter": post.reaction_counter,
        "comment_counter": post.comment_counter,
        "repost_counter": post.repost_counter,
        "impressions_counter": post.impressions_counter,
        "is_repost": post.is_repost,
        "author_name": post.author_name,
        "author_public_identifier": post.author_public_identifier,
    }


def find_asset_id_by_social_id(
    db: Session, user_id: str, social_id: str
) -> Optional[int]:
    """Return existing asset id when the same LinkedIn post was already saved."""
    if not social_id:
        return None

    service = ContentAssetService(db)
    assets, _ = service.get_user_assets(
        user_id=user_id,
        source_module=AssetSource.LINKEDIN_WRITER,
        limit=500,
    )
    for asset in assets:
        meta = asset.asset_metadata or {}
        if meta.get("content_origin") == CONTENT_ORIGIN and meta.get("social_id") == social_id:
            return asset.id
    return None


def persist_fetched_post(
    db: Session,
    user_id: str,
    post: NormalizedLinkedInPost,
    *,
    save_fn: Callable[..., Optional[int]] = save_and_track_text_content,
) -> Optional[int]:
    """
    Save one fetched post/article to the asset library.

    Uses the same ``save_and_track_text_content()`` path as generated LinkedIn
    posts and articles in ``backend/routers/linkedin.py``.
    """
    existing_id = find_asset_id_by_social_id(db, user_id, post.social_id)
    if existing_id is not None:
        logger.info(
            "[LinkedInPostsStorage] skip duplicate social_id={} asset_id={}",
            post.social_id,
            existing_id,
        )
        return existing_id

    content = _build_post_content(post)
    if not content.strip():
        logger.warning(
            "[LinkedInPostsStorage] skip empty content social_id={}",
            post.social_id,
        )
        return None

    metadata = _asset_metadata(post)
    preview = _preview_text(content)

    if post.content_kind == "article":
        return save_fn(
            db=db,
            user_id=user_id,
            content=content,
            source_module=SOURCE_MODULE,
            title=f"LinkedIn Article: {post.title[:80]}",
            description=preview,
            tags=["linkedin", "article", "fetched"],
            asset_metadata=metadata,
            subdirectory="articles",
            file_extension=".md",
        )

    return save_fn(
        db=db,
        user_id=user_id,
        content=content,
        source_module=SOURCE_MODULE,
        title=f"LinkedIn Post: {post.title[:80]}",
        description=preview,
        tags=["linkedin", "post", "fetched"],
        asset_metadata=metadata,
        subdirectory="posts",
    )


def persist_fetched_posts(
    db: Session,
    user_id: str,
    posts: list[NormalizedLinkedInPost],
    *,
    save_fn: Callable[..., Optional[int]] = save_and_track_text_content,
) -> tuple[list[int], list[str]]:
    """
    Persist multiple posts; returns (new_or_existing asset ids, skipped social ids).

    Skipped social ids are duplicates that already existed before this call.
    """
    asset_ids: list[int] = []
    skipped: list[str] = []

    for post in posts:
        prior_id = find_asset_id_by_social_id(db, user_id, post.social_id)
        asset_id = persist_fetched_post(db, user_id, post, save_fn=save_fn)
        if asset_id is None:
            continue
        asset_ids.append(asset_id)
        if prior_id is not None:
            skipped.append(post.social_id)

    return asset_ids, skipped

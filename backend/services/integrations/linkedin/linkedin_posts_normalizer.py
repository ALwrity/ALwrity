"""
Pure normalization of Unipile Post payloads to ALwrity shapes.
"""

from __future__ import annotations

from typing import Any

from services.integrations.linkedin.field_coercion import (
    clean_str,
    coerce_bool,
    coerce_int,
)
from services.integrations.linkedin.linkedin_posts_types import (
    NormalizedLinkedInPost,
    PostContentKind,
)


def _author_field(raw: dict[str, Any], key: str) -> str:
    author = raw.get("author")
    if isinstance(author, dict):
        return clean_str(author.get(key))
    written_by = raw.get("written_by")
    if isinstance(written_by, dict):
        return clean_str(written_by.get(key))
    return ""


def _detect_content_kind(raw: dict[str, Any]) -> PostContentKind:
    if coerce_bool(raw.get("is_repost")):
        return "repost"
    article = raw.get("article")
    if isinstance(article, dict) and (
        clean_str(article.get("title")) or clean_str(article.get("subtitle"))
    ):
        return "article"
    return "post"


def _title_from_raw(raw: dict[str, Any], content_kind: PostContentKind) -> str:
    if content_kind == "article":
        article = raw.get("article")
        if isinstance(article, dict):
            title = clean_str(article.get("title"))
            if title:
                return title
    title = clean_str(raw.get("title"))
    if title:
        return title
    text = clean_str(raw.get("text"))
    if text:
        first_line = text.splitlines()[0].strip()
        return first_line[:120] if first_line else "LinkedIn Post"
    return "LinkedIn Post"


def normalize_unipile_post(raw: dict[str, Any]) -> NormalizedLinkedInPost:
    """
    Map a single Unipile Post dict to ``NormalizedLinkedInPost``.

    Args:
        raw: Item from ``PostList.items`` or ``GET /posts/{id}``

    Returns:
        Normalized post record
    """
    if not isinstance(raw, dict):
        raise TypeError(f"Expected dict post payload, got {type(raw).__name__}")

    content_kind = _detect_content_kind(raw)
    article = raw.get("article") if isinstance(raw.get("article"), dict) else {}
    unipile_post_id = clean_str(raw.get("id"))
    social_id = clean_str(raw.get("social_id")) or unipile_post_id

    return NormalizedLinkedInPost(
        unipile_post_id=unipile_post_id,
        social_id=social_id,
        content_kind=content_kind,
        title=_title_from_raw(raw, content_kind),
        text=clean_str(raw.get("text")),
        share_url=clean_str(raw.get("share_url")),
        parsed_datetime=clean_str(raw.get("parsed_datetime") or raw.get("date")),
        is_repost=coerce_bool(raw.get("is_repost")),
        reaction_counter=coerce_int(raw.get("reaction_counter")),
        comment_counter=coerce_int(raw.get("comment_counter")),
        repost_counter=coerce_int(raw.get("repost_counter")),
        impressions_counter=coerce_int(raw.get("impressions_counter")),
        author_name=_author_field(raw, "name"),
        author_public_identifier=_author_field(raw, "public_identifier"),
        article_subtitle=clean_str(article.get("subtitle")),
        article_cover_url=clean_str(
            article.get("cover_url") or article.get("thumbnail_url")
        ),
        raw=raw,
    )


def normalize_unipile_posts(items: list[Any]) -> list[NormalizedLinkedInPost]:
    """Normalize a list of Unipile post dicts, skipping invalid entries."""
    normalized: list[NormalizedLinkedInPost] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized.append(normalize_unipile_post(item))
    return normalized

"""Normalize Unipile post attachments for LinkedIn Posts / Post Analytics."""

from __future__ import annotations

from typing import Any

from loguru import logger

from models.linkedin_posts_models import PostAttachment

_IMAGE_TYPES = frozenset({"img", "image", "photo"})
_VIDEO_TYPES = frozenset({"video", "vid"})
_FILE_TYPES = frozenset({"file", "document", "doc", "pdf"})


def _normalize_attachment_type(raw_type: Any) -> str:
    if not isinstance(raw_type, str) or not raw_type.strip():
        return "img"
    return raw_type.strip().lower()


def normalize_post_attachments(unipile_item: dict[str, Any]) -> list[PostAttachment]:
    """
    Map Unipile post ``attachments[]`` to our API model.

    Aligns with LinkedIn Search attachment shape: ``type``, ``url``, ``unavailable``.
    """
    raw_attachments = unipile_item.get("attachments")
    if not isinstance(raw_attachments, list) or not raw_attachments:
        return []

    post_id = unipile_item.get("id") or unipile_item.get("social_id") or "unknown"
    normalized: list[PostAttachment] = []

    for index, raw in enumerate(raw_attachments):
        if not isinstance(raw, dict):
            logger.warning(
                "[PostAttachments] Skipping non-dict attachment post_id={} index={}",
                post_id,
                index,
            )
            continue

        att_type = _normalize_attachment_type(raw.get("type"))
        url = raw.get("url")
        url_str = url.strip() if isinstance(url, str) and url.strip() else None
        unavailable = bool(raw.get("unavailable"))
        title_raw = raw.get("title") or raw.get("name")
        title = title_raw.strip() if isinstance(title_raw, str) and title_raw.strip() else None

        if unavailable and not url_str:
            logger.debug(
                "[PostAttachments] Unavailable attachment post_id={} type={}",
                post_id,
                att_type,
            )
            continue

        if not url_str and att_type not in _FILE_TYPES:
            logger.debug(
                "[PostAttachments] Skipping attachment without url post_id={} type={}",
                post_id,
                att_type,
            )
            continue

        normalized.append(
            PostAttachment(
                type=att_type,
                url=url_str,
                unavailable=unavailable,
                title=title,
            )
        )

    if normalized:
        logger.debug(
            "[PostAttachments] Mapped {} attachment(s) for post_id={}",
            len(normalized),
            post_id,
        )

    return normalized


def attachments_to_json(attachments: list[PostAttachment]) -> list[dict[str, Any]]:
    """Serialize attachments for DB JSON column."""
    return [att.model_dump(exclude_none=True) for att in attachments]


def attachments_from_json(raw: Any) -> list[PostAttachment]:
    """Deserialize attachments from DB JSON column."""
    if not isinstance(raw, list):
        return []

    result: list[PostAttachment] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            result.append(PostAttachment.model_validate(item))
        except Exception as exc:
            logger.warning("[PostAttachments] Invalid cached attachment row: {}", exc)
    return result

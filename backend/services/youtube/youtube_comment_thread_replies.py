"""Map YouTube comment reply resources (thread replies.comments / Comments.list items).

Skip malformed rows. Never invent text. Deduplicate by comment id.
can_edit is true only when authorChannelId.value equals the connected channel.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def _author_channel_id(snippet: Dict[str, Any]) -> str:
    raw = snippet.get("authorChannelId")
    if isinstance(raw, dict):
        return str(raw.get("value") or "").strip()
    if isinstance(raw, str):
        return raw.strip()
    return ""


def map_youtube_comment_reply_items(
    items: Any,
    mine_channel_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Map comment resources to inbox reply rows."""
    if not isinstance(items, list):
        return []
    mine = (mine_channel_id or "").strip()
    mapped: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        comment_id = str(item.get("id") or "").strip()
        snippet = item.get("snippet") if isinstance(item.get("snippet"), dict) else {}
        author = str(snippet.get("authorDisplayName") or "").strip()
        text = str(snippet.get("textDisplay") or snippet.get("textOriginal") or "").strip()
        if not comment_id or not text or comment_id in seen:
            continue
        seen.add(comment_id)
        author_channel_id = _author_channel_id(snippet)
        row: Dict[str, Any] = {
            "comment_id": comment_id,
            "author": author or None,
            "text": text,
            "can_edit": bool(mine and author_channel_id and mine == author_channel_id),
        }
        if author_channel_id:
            row["author_channel_id"] = author_channel_id
        published_at = snippet.get("publishedAt")
        if published_at:
            row["published_at"] = published_at
        mapped.append(row)
    return mapped


def map_youtube_thread_replies(
    thread: Any,
    mine_channel_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Map commentThreads.list replies.comments on a thread resource."""
    if not isinstance(thread, dict):
        return []
    replies = thread.get("replies")
    if not isinstance(replies, dict):
        return []
    return map_youtube_comment_reply_items(
        replies.get("comments"),
        mine_channel_id=mine_channel_id,
    )

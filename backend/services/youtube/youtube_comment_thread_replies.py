"""Map YouTube comment reply resources (thread replies.comments / Comments.list items).

Skip malformed rows. Never invent text. Deduplicate by comment id.
"""

from __future__ import annotations

from typing import Any, Dict, List


def map_youtube_comment_reply_items(items: Any) -> List[Dict[str, Any]]:
    """Map comment resources to inbox reply rows."""
    if not isinstance(items, list):
        return []
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
        published_at = snippet.get("publishedAt")
        row: Dict[str, Any] = {
            "comment_id": comment_id,
            "author": author or None,
            "text": text,
        }
        if published_at:
            row["published_at"] = published_at
        mapped.append(row)
    return mapped


def map_youtube_thread_replies(thread: Any) -> List[Dict[str, Any]]:
    """Map commentThreads.list replies.comments on a thread resource."""
    if not isinstance(thread, dict):
        return []
    replies = thread.get("replies")
    if not isinstance(replies, dict):
        return []
    return map_youtube_comment_reply_items(replies.get("comments"))

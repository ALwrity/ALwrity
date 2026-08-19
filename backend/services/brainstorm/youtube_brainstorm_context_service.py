"""
YouTube brainstorm context helpers — Google Trends (YouTube) and saved ideas.

Reuses Podcast/GoogleTrendsService patterns; no LinkedIn personalization.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List

from loguru import logger

from models.linkedin_brainstorm_saved_ideas_db_models import BrainstormSavedIdeaDB
from services.database import get_session_for_user
from services.research.trends.trends_config import get_trends_total_timeout
from services.research.trends.trends_keyword_utils import normalize_trends_keywords

_trends_service_instance = None


def _get_trends_service():
    global _trends_service_instance
    if _trends_service_instance is None:
        from services.research.trends import GoogleTrendsService

        _trends_service_instance = GoogleTrendsService()
    return _trends_service_instance


def _format_trends_block(result: Dict[str, Any]) -> str:
    """Turn Google Trends payload into a compact prompt block."""
    lines: List[str] = []

    related_queries = result.get("related_queries") or {}
    for label, bucket in (("rising", related_queries.get("rising") or []), ("top", related_queries.get("top") or [])):
        for item in bucket[:5]:
            query = (item.get("query") or item.get("title") or "").strip()
            value = item.get("value")
            if query:
                suffix = f" (interest: {value})" if value is not None else ""
                lines.append(f"- {label.title()} query: {query}{suffix}")

    related_topics = result.get("related_topics") or {}
    for label, bucket in (("rising", related_topics.get("rising") or []), ("top", related_topics.get("top") or [])):
        for item in bucket[:5]:
            topic = (item.get("topic_title") or item.get("title") or item.get("topic") or "").strip()
            if topic:
                lines.append(f"- {label.title()} topic: {topic}")

    if not lines:
        return ""

    return "YOUTUBE TRENDING SIGNALS (Google Trends / YouTube search interest):\n" + "\n".join(lines[:12])


async def fetch_youtube_trends_context(seed: str, user_id: str) -> str:
    """
    Fetch YouTube-search-interest trends for the seed and return a prompt block.

    Returns an empty string when trends are unavailable (generation still proceeds).
    """
    seed_preview = (seed or "").strip()[:50]
    logger.info(
        f"[YouTubeBrainstorm] fetch_youtube_trends_context entry user={user_id} seed_preview={seed_preview!r}"
    )

    keywords = normalize_trends_keywords([seed])
    if not keywords:
        logger.info(
            f"[YouTubeBrainstorm] Skipping trends: empty keywords after normalization seed_preview={seed_preview!r}"
        )
        return ""

    try:
        service = _get_trends_service()
    except Exception as exc:
        logger.warning(
            f"[YouTubeBrainstorm] GoogleTrendsService unavailable seed_preview={seed_preview!r}: {exc}",
            exc_info=True,
        )
        return ""

    total_timeout = get_trends_total_timeout()
    logger.info(
        f"[YouTubeBrainstorm] Fetching YouTube trends user={user_id} keywords={keywords} timeout={int(total_timeout)}s"
    )

    try:
        result = await asyncio.wait_for(
            service.analyze_trends(
                keywords=keywords,
                timeframe="today 12-m",
                geo="US",
                gprop="youtube",
                user_id=user_id,
            ),
            timeout=total_timeout,
        )
    except asyncio.TimeoutError:
        logger.warning(
            f"[YouTubeBrainstorm] YouTube trends fetch timed out after {int(total_timeout)}s keywords={keywords}"
        )
        return ""
    except Exception as exc:
        logger.warning(
            f"[YouTubeBrainstorm] YouTube trends fetch failed keywords={keywords}: {exc}",
            exc_info=True,
        )
        return ""

    if result.get("error"):
        logger.warning(
            f"[YouTubeBrainstorm] YouTube trends returned error keywords={keywords}: "
            f"{str(result.get('error'))[:120]}"
        )

    block = _format_trends_block(result)
    if block:
        logger.info(
            f"[YouTubeBrainstorm] Trends context ready keywords={keywords} lines={block.count(chr(10)) + 1}"
        )
    else:
        logger.info(f"[YouTubeBrainstorm] No usable YouTube trends data keywords={keywords}")
    return block


def _tags_include_youtube(tags: str | None) -> bool:
    if not tags:
        return False
    return "youtube" in {part.strip().lower() for part in tags.split(",") if part.strip()}


def fetch_youtube_saved_ideas_context(user_id: str, limit: int = 8) -> str:
    """Load saved brainstorm ideas tagged for YouTube."""
    logger.info(f"[YouTubeBrainstorm] fetch_youtube_saved_ideas_context entry user={user_id} limit={limit}")

    if not user_id or user_id == "brainstorm_anonymous":
        logger.info("[YouTubeBrainstorm] Skipping repurpose context for anonymous user")
        return ""

    db = get_session_for_user(user_id)
    if db is None:
        logger.warning(f"[YouTubeBrainstorm] Database unavailable for repurpose context user={user_id}")
        return ""

    try:
        rows = (
            db.query(BrainstormSavedIdeaDB)
            .filter(BrainstormSavedIdeaDB.user_id == user_id)
            .order_by(BrainstormSavedIdeaDB.created_at.desc())
            .limit(max(limit * 3, limit))
            .all()
        )
        prompts = [
            row.prompt.strip()
            for row in rows
            if row.prompt and row.prompt.strip() and _tags_include_youtube(row.tags)
        ][:limit]
        if not prompts:
            logger.info(f"[YouTubeBrainstorm] No saved YouTube ideas for repurpose context user={user_id}")
            return ""

        lines = "\n".join(f"- {prompt}" for prompt in prompts)
        logger.info(
            f"[YouTubeBrainstorm] Repurpose context ready user={user_id} saved_ideas={len(prompts)}"
        )
        return f"SAVED YOUTUBE IDEAS TO REPURPOSE OR BUILD ON:\n{lines}"
    except Exception as exc:
        logger.warning(
            f"[YouTubeBrainstorm] Failed to load saved ideas for repurpose user={user_id}: {exc}",
            exc_info=True,
        )
        return ""
    finally:
        db.close()

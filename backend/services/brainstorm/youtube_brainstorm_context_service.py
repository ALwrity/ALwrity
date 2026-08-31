"""
YouTube brainstorm context helpers — saved ideas.

YouTube-search-interest trends were previously fetched via pytrends (Google
Trends with gprop="youtube"). pytrends is an unofficial scraper (ban/429 risk)
and has been removed. Revisit using the YouTube Data API
(videos.list with chart=mostPopular) later.
"""

from __future__ import annotations

from typing import List

from loguru import logger

from models.linkedin_brainstorm_saved_ideas_db_models import BrainstormSavedIdeaDB
from services.database import get_session_for_user


async def fetch_youtube_trends_context(seed: str, user_id: str) -> str:
    """Return YouTube trend context for the seed.

    Deferred: previously used pytrends (Google Trends gprop="youtube"); will be
    reimplemented on the YouTube Data API. Returns an empty string so generation
    proceeds without trend context.
    """
    logger.info(
        f"[YouTubeBrainstorm] YouTube trends context deferred (YouTube Data API TBD) user={user_id}"
    )
    return ""


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

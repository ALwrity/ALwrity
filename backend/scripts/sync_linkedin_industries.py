"""
Manual LinkedIn industry cache sync.

Usage:
    python backend/scripts/sync_linkedin_industries.py
    python backend/scripts/sync_linkedin_industries.py --user-id USER_ID
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

load_dotenv(backend_dir / ".env")

from loguru import logger

from services.integrations.linkedin.linkedin_industry_cache_service import (
    sync_industries_from_unipile,
)
from services.integrations.linkedin.linkedin_industry_sync_job import (
    resolve_sync_user_id,
)


async def _run(user_id: str | None) -> int:
    resolved_user_id = user_id or resolve_sync_user_id()
    if not resolved_user_id:
        logger.error(
            "[LinkedInIndustrySync] No connected Unipile account found. "
            "Connect LinkedIn or set LINKEDIN_INDUSTRY_SYNC_USER_ID."
        )
        return 1

    count = await sync_industries_from_unipile(resolved_user_id)
    if count <= 0:
        logger.error("[LinkedInIndustrySync] Sync completed with zero industries")
        return 1

    logger.info("[LinkedInIndustrySync] Sync complete item_count={}", count)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync LinkedIn industry cache from Unipile")
    parser.add_argument(
        "--user-id",
        dest="user_id",
        default=None,
        help="Optional ALwrity user id with a connected LinkedIn account",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args.user_id)))


if __name__ == "__main__":
    main()

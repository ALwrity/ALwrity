"""
LinkedIn posts acquire CLI — fetch, normalize, optional persist to asset library.

Usage:
    python backend/scripts/linkedin_fetch_posts.py --from-fixture docs/linkedin/fixtures/sample_post_list_raw.json --print-normalized
    python backend/scripts/linkedin_fetch_posts.py --user-id USER_ID --limit 10 --dry-run
    python backend/scripts/linkedin_fetch_posts.py --user-id USER_ID --persist
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

load_dotenv(backend_dir / ".env")

# Avoid importing backend/services/__init__.py (heavy optional deps).
import types

if "services" not in sys.modules:
    _services_pkg = types.ModuleType("services")
    _services_pkg.__path__ = [str(backend_dir / "services")]
    sys.modules["services"] = _services_pkg

_integrations_stub = types.ModuleType("services.integrations")
_integrations_stub.__path__ = [str(backend_dir / "services" / "integrations")]
sys.modules["services.integrations"] = _integrations_stub

from loguru import logger

from services.integrations.linkedin.linkedin_posts_normalizer import (
    normalize_unipile_posts,
)
from services.integrations.linkedin.linkedin_posts_service import fetch_user_posts
from services.integrations.linkedin.linkedin_posts_storage import persist_fetched_posts
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.database import get_session_for_user


def _load_fixture(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        items = data.get("items")
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict)]
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    raise ValueError(f"Fixture at {path} is not a PostList or list of posts")


def _print_normalized(items: list[dict[str, Any]]) -> None:
    normalized = normalize_unipile_posts(items)
    payload = {
        "count": len(normalized),
        "posts": [
            {
                "unipile_post_id": p.unipile_post_id,
                "social_id": p.social_id,
                "content_kind": p.content_kind,
                "title": p.title,
                "text": p.text,
                "share_url": p.share_url,
                "parsed_datetime": p.parsed_datetime,
                "is_repost": p.is_repost,
                "reaction_counter": p.reaction_counter,
            }
            for p in normalized
        ],
    }
    print(json.dumps(payload, indent=2))


async def _run_live(args: argparse.Namespace) -> int:
    db = None
    if args.persist:
        db = get_session_for_user(args.user_id)
        if db is None:
            logger.error("Could not open database session for user {}", args.user_id)
            return 1

    try:
        result = await fetch_user_posts(
            args.user_id,
            limit=args.limit,
            cursor=args.cursor,
            fetch_all=args.fetch_all,
            include_article_body=not args.skip_article_body,
            persist=args.persist and not args.dry_run,
            db=db,
        )
        print(json.dumps(result.to_dict(), indent=2))
        return 0
    except LinkedInNotConnectedError as exc:
        logger.error("Not connected: {}", exc)
        return 2
    except UnipileAPIError as exc:
        logger.error("Unipile error: {}", exc)
        return 3
    except Exception as exc:
        logger.exception("Fetch failed: {}", exc)
        return 1
    finally:
        if db is not None:
            db.close()


async def _run_fixture_persist(args: argparse.Namespace) -> int:
    items = _load_fixture(Path(args.from_fixture))
    normalized = normalize_unipile_posts(items)
    db = get_session_for_user(args.user_id)
    if db is None:
        logger.error("Could not open database session for user {}", args.user_id)
        return 1
    try:
        asset_ids, skipped = persist_fetched_posts(db, args.user_id, normalized)
        db.commit()
        print(
            json.dumps(
                {
                    "persisted_asset_ids": asset_ids,
                    "skipped_social_ids": skipped,
                    "count": len(normalized),
                },
                indent=2,
            )
        )
        return 0
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch LinkedIn posts via Unipile")
    parser.add_argument("--user-id", help="ALwrity Clerk user id")
    parser.add_argument("--from-fixture", help="Path to PostList JSON fixture")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--cursor", default=None)
    parser.add_argument("--fetch-all", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="Fetch without persisting")
    parser.add_argument("--persist", action="store_true", help="Save to asset library")
    parser.add_argument(
        "--skip-article-body",
        action="store_true",
        help="Skip per-article detail fetch",
    )
    parser.add_argument(
        "--print-normalized",
        action="store_true",
        help="Normalize fixture and print (offline mode)",
    )

    args = parser.parse_args()

    if args.from_fixture:
        fixture_path = Path(args.from_fixture)
        if not fixture_path.is_file():
            logger.error("Fixture not found: {}", fixture_path)
            return 1
        items = _load_fixture(fixture_path)
        if args.print_normalized or not args.persist:
            _print_normalized(items)
            return 0
        if not args.user_id:
            logger.error("--user-id is required with --persist")
            return 1
        return asyncio.run(_run_fixture_persist(args))

    if not args.user_id:
        logger.error("--user-id is required for live fetch")
        return 1

    if args.persist and args.dry_run:
        logger.error("Use either --persist or --dry-run, not both")
        return 1

    return asyncio.run(_run_live(args))


if __name__ == "__main__":
    raise SystemExit(main())

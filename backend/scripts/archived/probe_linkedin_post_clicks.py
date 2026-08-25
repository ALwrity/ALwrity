"""
Probe Unipile v1 list-posts + retrieve-post for clicks / CTR (#221).

Usage (PowerShell, from backend/):

  # Summary probe (list + first 3 retrieve-post)
  python scripts/probe_linkedin_post_clicks.py --user-id YOUR_CLERK_USER_ID

  # Dump FULL raw PostList JSON (all pages) to stdout
  python scripts/probe_linkedin_post_clicks.py --user-id YOUR_CLERK_USER_ID --dump-json --all-pages

  # Dump full JSON + merge retrieve-post analytics onto every item
  python scripts/probe_linkedin_post_clicks.py --user-id YOUR_CLERK_USER_ID `
    --dump-json --all-pages --enrich-all -o unipile_posts_full.json

Requires UNIPILE_API_KEY (+ UNIPILE_DSN) in backend/.env.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Optional

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

load_dotenv(backend_dir / ".env")

from loguru import logger

from services.integrations.linkedin.post_analytics_clicks import (
    resolve_clicks,
    resolve_clickthrough_rate,
    resolve_impressions,
)
from services.integrations.linkedin.post_analytics_enrichment import (
    merge_post_analytics,
    resolve_retrieve_post_ids,
)
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import (
    UnipileAPIError,
    UnipileClient,
    personal_profile_provider_id_from_owner,
)
from services.integrations.linkedin.unipile_retrieve_post_client import (
    UnipileRetrievePostClient,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService


def _analytics_snapshot(item: dict[str, Any]) -> dict[str, Any]:
    """Summary view — includes FULL analytics object (no key filtering)."""
    raw = item.get("analytics")
    analytics = dict(raw) if isinstance(raw, dict) else {}
    return {
        "post_id": item.get("id"),
        "social_id": item.get("social_id"),
        "impressions_counter": item.get("impressions_counter"),
        "reaction_counter": item.get("reaction_counter"),
        "comment_counter": item.get("comment_counter"),
        "repost_counter": item.get("repost_counter"),
        "resolved_impressions": resolve_impressions(item),
        "resolved_clicks": resolve_clicks(item),
        "resolved_ctr": resolve_clickthrough_rate(item),
        "analytics_keys": sorted(analytics.keys()),
        "analytics": analytics,
    }


async def _resolve_account_and_identifier(
    user_id: Optional[str],
    account_id: Optional[str],
    identifier: Optional[str],
) -> tuple[str, str]:
    if account_id and identifier:
        return account_id, identifier

    if not user_id:
        raise SystemExit(
            "Provide --user-id, or both --account-id and --identifier."
        )

    oauth = LinkedInOAuthService()
    try:
        creds = oauth.resolve_credentials(user_id)
    except LinkedInNotConnectedError as exc:
        raise SystemExit(f"LinkedIn not connected for user_id={user_id}: {exc}") from exc

    resolved_account = creds.unipile_account_id
    if not resolved_account:
        raise SystemExit(f"No unipile_account_id for user_id={user_id}")

    client = UnipileClient()
    profile = await client.get_own_profile(resolved_account)
    resolved_identifier = personal_profile_provider_id_from_owner(profile)
    if not resolved_identifier:
        raise SystemExit(
            "Could not resolve LinkedIn provider id from GET /users/me. "
            "Pass --identifier explicitly."
        )
    return resolved_account, resolved_identifier


async def _fetch_all_pages(
    client: UnipileRetrievePostClient,
    account_id: str,
    identifier: str,
    *,
    page_limit: int,
    max_pages: int,
) -> dict[str, Any]:
    """Paginate Unipile list-posts into one PostList-shaped dict."""
    all_items: list[Any] = []
    cursor: Optional[str] = None
    last_paging: Any = None
    pages = 0

    while pages < max_pages:
        pages += 1
        listing = await client.get_user_posts(
            account_id=account_id,
            identifier=identifier,
            cursor=cursor,
            limit=page_limit,
            is_company=False,
        )
        if not isinstance(listing, dict):
            raise SystemExit(f"Unexpected list-posts type: {type(listing)}")

        items = listing.get("items")
        if isinstance(items, list):
            all_items.extend(items)
        last_paging = listing.get("paging")
        next_cursor = listing.get("cursor")
        logger.info(
            "[ProbeClicks] page={} items_this_page={} total={} next_cursor={}",
            pages,
            len(items) if isinstance(items, list) else 0,
            len(all_items),
            "set" if next_cursor else "none",
        )
        if not next_cursor:
            break
        cursor = str(next_cursor)

    return {
        "object": "PostList",
        "items": all_items,
        "cursor": cursor,
        "paging": last_paging if last_paging is not None else {"page_count": pages},
    }


async def _retrieve_one(
    client: UnipileRetrievePostClient,
    account_id: str,
    item: dict[str, Any],
) -> Optional[dict[str, Any]]:
    for post_id in resolve_retrieve_post_ids(item):
        try:
            return await client.get_post(account_id, post_id)
        except UnipileAPIError as exc:
            logger.warning(
                "[ProbeClicks] get_post failed post_id={} status={}: {}",
                post_id,
                exc.status_code,
                exc,
            )
            if exc.status_code != 404:
                return None
    return None


async def _enrich_items(
    client: UnipileRetrievePostClient,
    account_id: str,
    items: list[Any],
) -> list[Any]:
    """Merge retrieve-post analytics onto each list item (full raw fields)."""
    enriched: list[Any] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            enriched.append(item)
            continue
        detail = await _retrieve_one(client, account_id, item)
        if detail is None:
            enriched.append(item)
            continue
        # Prefer full retrieve payload as base, keep list fields as fallback
        merged = dict(item)
        for key, value in detail.items():
            if key == "analytics":
                continue
            if value is not None:
                merged[key] = value
        merged = merge_post_analytics(merged, detail)
        # If merge left analytics empty but detail has it, use detail as-is
        detail_analytics = detail.get("analytics")
        if isinstance(detail_analytics, dict) and detail_analytics:
            base = merged.get("analytics")
            if not isinstance(base, dict) or not base:
                merged["analytics"] = dict(detail_analytics)
            else:
                # Union all keys from detail (do not drop Unipile-only fields)
                merged["analytics"] = {**base, **detail_analytics}
        enriched.append(merged)
        logger.info(
            "[ProbeClicks] enriched index={} analytics_keys={}",
            index,
            sorted((merged.get("analytics") or {}).keys())
            if isinstance(merged.get("analytics"), dict)
            else [],
        )
    return enriched


def _write_json(payload: Any, output: Optional[str]) -> None:
    text = json.dumps(payload, indent=2, ensure_ascii=False, default=str)
    if output:
        path = Path(output)
        path.write_text(text, encoding="utf-8")
        print(f"Wrote {path.resolve()} ({len(text)} bytes)", file=sys.stderr)
    else:
        print(text)


async def _run_dump(args: argparse.Namespace) -> int:
    account_id, identifier = await _resolve_account_and_identifier(
        args.user_id, args.account_id, args.identifier
    )
    client = UnipileRetrievePostClient()

    if args.all_pages:
        listing = await _fetch_all_pages(
            client,
            account_id,
            identifier,
            page_limit=args.limit,
            max_pages=args.max_pages,
        )
    else:
        listing = await client.get_user_posts(
            account_id=account_id,
            identifier=identifier,
            limit=args.limit,
            is_company=False,
        )
        if not isinstance(listing, dict):
            raise SystemExit(f"Unexpected list-posts type: {type(listing)}")

    items = listing.get("items")
    if not isinstance(items, list):
        items = []

    if args.enrich_all and items:
        listing = dict(listing)
        listing["items"] = await _enrich_items(client, account_id, items)

    _write_json(listing, args.output)
    return 0


async def _run_summary(args: argparse.Namespace) -> int:
    account_id, identifier = await _resolve_account_and_identifier(
        args.user_id, args.account_id, args.identifier
    )
    client = UnipileRetrievePostClient()

    logger.info(
        "[ProbeClicks] list-posts account_id={} identifier={} limit={}",
        account_id,
        identifier,
        args.limit,
    )
    listing = await client.get_user_posts(
        account_id=account_id,
        identifier=identifier,
        limit=args.limit,
        is_company=False,
    )
    items = listing.get("items") if isinstance(listing, dict) else None
    if not isinstance(items, list) or not items:
        print("No posts returned from Unipile list-posts.")
        return 1

    print("\n" + "=" * 72)
    print("SUMMARY MODE (NOT full Unipile PostList JSON)")
    print("This view only prints a small clicks/CTR snapshot per post.")
    print("Docs example fields (author, attachments, analytics, ...) are NOT")
    print("stripped by our client — use --dump-json to see the raw response.")
    print("=" * 72)
    print(f"account_id:  {account_id}")
    print(f"identifier:  {identifier}")
    print(f"items:       {len(items)}")
    print(
        "For full PostList JSON run:\n"
        "  python scripts/probe_linkedin_post_clicks.py "
        "--user-id ... --dump-json --all-pages --enrich-all -o unipile_posts_full.json"
    )

    list_nonzero = 0
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        snap = _analytics_snapshot(item)
        if snap["resolved_clicks"] > 0:
            list_nonzero += 1
        print(f"\n--- list[{index}] ---")
        print(json.dumps(snap, indent=2, default=str))

    print(
        f"\nList summary: {list_nonzero}/{len(items)} posts with resolved_clicks > 0"
    )

    retrieve_n = max(0, min(args.retrieve, len(items)))
    if retrieve_n == 0:
        print("\n(Skipping retrieve-post; pass --retrieve N or --dump-json.)")
        return 0

    print("\n" + "=" * 72)
    print(f"Unipile v1 RETRIEVE post — first {retrieve_n} item(s)")
    print("=" * 72)

    retrieve_nonzero = 0
    for index in range(retrieve_n):
        item = items[index]
        if not isinstance(item, dict):
            continue
        detail = await _retrieve_one(client, account_id, item)
        used = resolve_retrieve_post_ids(item)
        print(f"\n--- retrieve[{index}] tried={used!r} ---")
        if detail is None:
            print("FAILED — no retrieve-post response")
            continue
        snap = _analytics_snapshot(detail)
        if snap["resolved_clicks"] > 0:
            retrieve_nonzero += 1
        print(json.dumps(snap, indent=2, default=str))

    print(
        f"\nRetrieve summary: {retrieve_nonzero}/{retrieve_n} posts "
        "with resolved_clicks > 0"
    )
    print(
        "\nInterpretation:\n"
        "  - Personal profile posts: LinkedIn does NOT expose clicks/CTR "
        "(company pages only).\n"
        "  - Expect analytics keys without clicks/clickthrough_rate for "
        "personal posts.\n"
        "  - Tip: use --dump-json --all-pages --enrich-all -o out.json for full raw.\n"
    )
    return 0


async def _run(args: argparse.Namespace) -> int:
    if args.dump_json:
        return await _run_dump(args)
    return await _run_summary(args)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Probe Unipile list/retrieve post analytics for clicks/CTR"
    )
    parser.add_argument("--user-id", help="Clerk user id with LinkedIn connected")
    parser.add_argument("--account-id", help="Unipile account id")
    parser.add_argument(
        "--identifier",
        help="LinkedIn provider internal id (ACo... / ADo...)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="List-posts page size (default 10, max 100)",
    )
    parser.add_argument(
        "--retrieve",
        type=int,
        default=3,
        help="How many list items to re-fetch in summary mode (default 3)",
    )
    parser.add_argument(
        "--dump-json",
        action="store_true",
        help="Print full Unipile PostList JSON (raw items)",
    )
    parser.add_argument(
        "--all-pages",
        action="store_true",
        help="Paginate list-posts until cursor is exhausted",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=20,
        help="Safety cap when using --all-pages (default 20)",
    )
    parser.add_argument(
        "--enrich-all",
        action="store_true",
        help="With --dump-json: retrieve-post every item and merge analytics",
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Write JSON to this file instead of stdout",
    )
    args = parser.parse_args()
    args.limit = max(1, min(args.limit, 100))
    args.max_pages = max(1, args.max_pages)
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()

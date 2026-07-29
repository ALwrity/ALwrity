"""
LinkedIn industry cache — hybrid autocomplete backend store.

Persists Unipile-sourced industry titles to disk and serves them via
GET /api/linkedin-social/industries. Sync uses existing search parameters API.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from loguru import logger

from models.linkedin_search_models import LinkedInIndustryItem
from services.analytics_cache_service import analytics_cache

LOG_PREFIX = "[LinkedInIndustryCache]"

CACHE_VERSION = 1
STALE_DAYS = 7
HOT_CACHE_KEY = "linkedin:industries:global"
HOT_CACHE_TTL_SECONDS = STALE_DAYS * 24 * 3600

LinkedInIndustryCacheStatus = Literal["warm", "stale", "empty"]

_DEFAULT_CACHE_PATH = (
    Path(__file__).resolve().parents[3] / "data" / "linkedin_industries_cache.json"
)


def _cache_file_path() -> Path:
    override = (os.getenv("LINKEDIN_INDUSTRY_CACHE_PATH") or "").strip()
    if override:
        return Path(override)
    return _DEFAULT_CACHE_PATH


def cache_file_exists() -> bool:
    """Return True when the persisted cache file is present."""
    return _cache_file_path().is_file()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _parse_synced_at(synced_at: Optional[str]) -> Optional[datetime]:
    if not synced_at:
        return None
    try:
        normalized = synced_at.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError) as exc:
        logger.warning("{} invalid synced_at={!r}: {}", LOG_PREFIX, synced_at, exc)
        return None


def is_cache_stale(synced_at: Optional[str]) -> bool:
    """True when cache is missing synced_at or older than STALE_DAYS."""
    parsed = _parse_synced_at(synced_at)
    if parsed is None:
        return True
    age = datetime.now(timezone.utc) - parsed
    return age > timedelta(days=STALE_DAYS)


def _normalize_items(raw_items: Any) -> list[LinkedInIndustryItem]:
    if not isinstance(raw_items, list):
        return []

    normalized: list[LinkedInIndustryItem] = []
    seen_ids: set[str] = set()
    for entry in raw_items:
        if not isinstance(entry, dict):
            continue
        item_id = entry.get("id")
        title = entry.get("title")
        if not item_id or not title:
            continue
        item_id_str = str(item_id)
        if item_id_str in seen_ids:
            continue
        seen_ids.add(item_id_str)
        normalized.append(
            LinkedInIndustryItem(id=item_id_str, title=str(title).strip())
        )
    normalized.sort(key=lambda item: item.title.lower())
    return normalized


def _read_cache_payload() -> dict[str, Any]:
    path = _cache_file_path()
    if not path.is_file():
        logger.debug("{} cache file missing path={}", LOG_PREFIX, path)
        return {}

    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if not isinstance(payload, dict):
            logger.warning("{} cache file invalid — expected object path={}", LOG_PREFIX, path)
            return {}
        return payload
    except json.JSONDecodeError as exc:
        logger.error("{} cache JSON decode failed path={}: {}", LOG_PREFIX, path, exc)
        return {}
    except OSError as exc:
        logger.error("{} cache read failed path={}: {}", LOG_PREFIX, path, exc)
        return {}


def load_cache() -> dict[str, Any]:
    """Read JSON cache file and populate the in-memory hot cache."""
    payload = _read_cache_payload()
    items = _normalize_items(payload.get("items"))
    synced_at = payload.get("synced_at")

    if items:
        hot_payload = {
            "items": [item.model_dump() for item in items],
            "synced_at": synced_at,
            "item_count": len(items),
        }
        analytics_cache.raw_set(
            HOT_CACHE_KEY,
            hot_payload,
            ttl_seconds=HOT_CACHE_TTL_SECONDS,
        )
        logger.info(
            "{} load_cache complete item_count={} synced_at={}",
            LOG_PREFIX,
            len(items),
            synced_at,
        )
    else:
        analytics_cache.raw_delete(HOT_CACHE_KEY)
        logger.info("{} load_cache complete — no items", LOG_PREFIX)

    return {
        "items": items,
        "synced_at": synced_at,
        "item_count": len(items),
    }


def save_cache(items: list[LinkedInIndustryItem]) -> None:
    """Write cache file and refresh the in-memory hot cache."""
    path = _cache_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    deduped = _normalize_items([item.model_dump() for item in items])
    synced_at = _utc_now_iso()
    payload = {
        "version": CACHE_VERSION,
        "synced_at": synced_at,
        "source": "unipile",
        "item_count": len(deduped),
        "items": [item.model_dump() for item in deduped],
    }

    try:
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
    except OSError as exc:
        logger.error("{} save_cache write failed path={}: {}", LOG_PREFIX, path, exc)
        raise

    analytics_cache.raw_set(
        HOT_CACHE_KEY,
        {
            "items": payload["items"],
            "synced_at": synced_at,
            "item_count": len(deduped),
        },
        ttl_seconds=HOT_CACHE_TTL_SECONDS,
    )
    logger.info(
        "{} save_cache complete item_count={} path={}",
        LOG_PREFIX,
        len(deduped),
        path,
    )


def get_industries() -> dict[str, Any]:
    """Return cached industries and metadata for API responses."""
    hot = analytics_cache.raw_get(HOT_CACHE_KEY)
    if isinstance(hot, dict) and isinstance(hot.get("items"), list):
        items = _normalize_items(hot.get("items"))
        synced_at = hot.get("synced_at")
        logger.debug(
            "{} cache read hit source=memory item_count={}",
            LOG_PREFIX,
            len(items),
        )
    else:
        loaded = load_cache()
        items = loaded.get("items") or []
        synced_at = loaded.get("synced_at")
        if items:
            logger.debug(
                "{} cache read hit source=file item_count={}",
                LOG_PREFIX,
                len(items),
            )

    if not items:
        logger.warning("{} cache miss or empty", LOG_PREFIX)
        return {
            "items": [],
            "synced_at": synced_at,
            "item_count": 0,
            "cache_status": "empty",
        }

    status: LinkedInIndustryCacheStatus = (
        "stale" if is_cache_stale(str(synced_at) if synced_at else None) else "warm"
    )
    logger.debug(
        "{} get_industries cache_status={} item_count={}",
        LOG_PREFIX,
        status,
        len(items),
    )
    return {
        "items": items,
        "synced_at": synced_at,
        "item_count": len(items),
        "cache_status": status,
    }


async def sync_industries_from_unipile(
    user_id: str,
    *,
    account_id: Optional[str] = None,
) -> int:
    """
    Fetch industries from Unipile via search parameters and persist cache.

    Uses alphabet seed keywords to aggregate the broadest practical catalog.
    """
    from services.integrations.linkedin.linkedin_search_service import (
        get_search_parameters,
    )

    logger.info(
        "{} sync start user_id={} account_id={} strategy=alphabet_seeds",
        LOG_PREFIX,
        user_id,
        _mask_account_id(account_id),
    )

    started = time.monotonic()
    merged: dict[str, LinkedInIndustryItem] = {}
    raw_count = 0
    keywords_batches = [None, *list("abcdefghijklmnopqrstuvwxyz"), "tech", "art", "health"]

    for keywords in keywords_batches:
        label = keywords if keywords is not None else "<all>"
        try:
            response = await get_search_parameters(
                user_id,
                "INDUSTRY",
                keywords=keywords,
                limit=100,
                account_id=account_id,
            )
            raw_count += len(response.items)
            for item in response.items:
                merged[item.id] = LinkedInIndustryItem(id=item.id, title=item.title)
            logger.debug(
                "{} sync keyword={!r} fetched={} merged_total={}",
                LOG_PREFIX,
                label,
                len(response.items),
                len(merged),
            )
        except Exception as exc:
            logger.warning(
                "{} sync keyword={!r} failed user_id={} error_type={}: {}",
                LOG_PREFIX,
                label,
                user_id,
                type(exc).__name__,
                exc,
            )

    if not merged:
        duration_ms = int((time.monotonic() - started) * 1000)
        logger.warning(
            "{} sync completed with zero industries user_id={} duration_ms={}",
            LOG_PREFIX,
            user_id,
            duration_ms,
        )
        return 0

    items = sorted(merged.values(), key=lambda item: item.title.lower())
    save_cache(items)
    duration_ms = int((time.monotonic() - started) * 1000)
    synced_at = _utc_now_iso()
    logger.info(
        "{} sync complete user_id={} raw_count={} deduped_count={} duration_ms={} synced_at={}",
        LOG_PREFIX,
        user_id,
        raw_count,
        len(items),
        duration_ms,
        synced_at,
    )
    return len(items)


def _mask_account_id(account_id: Optional[str]) -> str:
    """Mask Unipile account id for logs."""
    if not account_id:
        return "none"
    if len(account_id) <= 4:
        return "****"
    return f"{account_id[:4]}...{account_id[-2:]}"

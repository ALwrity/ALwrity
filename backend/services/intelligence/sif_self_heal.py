"""SIF self-heal hook (Phase B of the SIF query quality work).

When agents search the SIF index and get nothing back (empty index after a
failed crawl, or a user whose onboarding never reached the harvest step),
every committee run degrades to generic proposals. This module repairs the
index from data that is already local — no external fetches required:

1. **Bootstrap-index the flat context documents** (``AgentFlatContextStore``
   step 2-5 docs: website analysis, research preferences, persona,
   integrations). This is the fastest heal and always available
   post-onboarding.
2. **Watermark-guarded website sync** (``sync_user_website_content``) when
   the user has a website URL — re-indexes only new or changed pages.

Guardrails:
- Fires at most **once per user per day** (flat-file day-guard marker in
  the workspace scratchpad), so a persistent miss cannot hammer the index.
- A healthy index (>= ``min_index_items`` docs) is a no-op.
- Never raises: heal failures are reported in the returned summary.
- Emits a structured ``[sif_event] outcome=healed`` for observability.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger

_DEFAULT_MIN_INDEX_ITEMS = 5


def _workspace_root(user_id: str) -> Path:
    return Path("workspace") / f"workspace_{user_id}"


def _scratchpad_dir(user_id: str) -> Path:
    return _workspace_root(user_id) / "scratchpad"


def _day_guard_path(user_id: str) -> Path:
    return _scratchpad_dir(user_id) / f".sif_heal_{datetime.utcnow().strftime('%Y%m%d')}"


def _already_healed_today(user_id: str) -> bool:
    try:
        return _day_guard_path(user_id).exists()
    except Exception:
        return False


def _mark_healed_today(user_id: str) -> None:
    try:
        path = _day_guard_path(user_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({"healed_at": datetime.utcnow().isoformat(), "trigger": "sif_self_heal"}),
            encoding="utf-8",
        )
    except Exception as exc:
        logger.debug(f"[sif_self_heal] Failed to write day-guard marker for {user_id}: {exc}")


def _flatten_values(data: Any, out: List[str]) -> None:
    """Collect scalar leaf values from a nested doc into a flat token list."""
    if isinstance(data, dict):
        for value in data.values():
            _flatten_values(value, out)
    elif isinstance(data, (list, tuple, set)):
        for value in data:
            _flatten_values(value, out)
    elif data is None:
        return
    else:
        text = " ".join(str(data).split()).strip()
        if text:
            out.append(text)


def _count_index_items(sif_service: Any) -> Optional[int]:
    """Best-effort index size probe; ``None`` when it cannot be determined."""
    intelligence = getattr(sif_service, "intelligence_service", None)
    if intelligence is None:
        return None
    probe = getattr(intelligence, "count_index_items", None)
    if callable(probe):
        try:
            return int(probe())
        except Exception:
            return None
    embeddings = getattr(intelligence, "embeddings", None)
    if embeddings is not None and hasattr(embeddings, "count"):
        try:
            return int(embeddings.count())
        except Exception:
            return None
    return None


def _bootstrap_flat_context_items(user_id: str) -> List[Any]:
    """Build index_content items from the user's flat context documents."""
    from services.intelligence.agent_flat_context import AgentFlatContextStore

    store = AgentFlatContextStore(user_id)
    manifest = store.load_context_manifest() or {}
    docs = manifest.get("documents") if isinstance(manifest.get("documents"), list) else []

    items: List[Any] = []
    for entry in docs:
        if not isinstance(entry, dict):
            continue
        path = entry.get("path")
        if not path:
            continue
        try:
            doc = store.load_context_document(str(path)) or {}
        except Exception as exc:
            logger.debug(f"[sif_self_heal] Failed to load flat doc {path}: {exc}")
            continue
        data = doc.get("data") if isinstance(doc.get("data"), dict) else {}
        flat: List[str] = []
        _flatten_values(data, flat)
        if not flat:
            continue
        text = " | ".join(flat)[:4000]
        items.append((
            f"onboarding_context:{path}",
            text,
            {
                "type": "onboarding_context",
                "source": "agent_flat_context",
                "title": doc.get("context_type") or str(path),
                "updated_at": doc.get("updated_at"),
            },
        ))
    return items


async def maybe_self_heal_index(
    sif_service: Any,
    *,
    trigger: str = "agent_search_miss",
    min_index_items: int = _DEFAULT_MIN_INDEX_ITEMS,
    force: bool = False,
) -> Dict[str, Any]:
    """Repair a thin/empty SIF index from local data. Never raises.

    Args:
        sif_service: a ``SIFIntegrationService``-like object exposing
            ``user_id``, ``intelligence_service`` and (optionally)
            ``sync_user_website_content``.
        trigger: short label of what caused the heal attempt.
        min_index_items: an index with at least this many items is healthy
            and needs no heal.
        force: ignore the once-per-day guard (used by tests/admin paths).

    Returns:
        A summary dict with ``healed`` (bool), ``reason``, counts of
        bootstrap-indexed items, website-sync result and any errors.
    """
    user_id = str(getattr(sif_service, "user_id", "") or "")
    summary: Dict[str, Any] = {
        "healed": False,
        "reason": None,
        "trigger": trigger,
        "bootstrap_indexed": 0,
        "website_sync_new": 0,
        "errors": [],
    }
    if not user_id:
        summary["reason"] = "no_user_id"
        return summary

    # 1. A healthy index needs no heal.
    count = _count_index_items(sif_service)
    if count is not None:
        summary["index_items"] = count
        if count >= min_index_items:
            summary["reason"] = "index_healthy"
            return summary

    # 2. Once-per-user-per-day guard.
    if not force and _already_healed_today(user_id):
        summary["reason"] = "already_healed_today"
        return summary

    intelligence = getattr(sif_service, "intelligence_service", None)

    # 3. Bootstrap-index the flat context documents (local data only).
    if intelligence is not None:
        try:
            items = _bootstrap_flat_context_items(user_id)
            if items:
                indexed = await intelligence.index_content(items)
                summary["bootstrap_indexed"] = int(indexed or len(items))
        except Exception as exc:
            summary["errors"].append(f"bootstrap_index_failed: {exc}")
            logger.warning(f"[sif_self_heal] Bootstrap index failed for {user_id}: {exc}")

    # 4. Watermark-guarded website sync (only new/changed pages).
    sync = getattr(sif_service, "sync_user_website_content", None)
    website_url = ""
    try:
        from services.intelligence.agent_flat_context import AgentFlatContextStore

        step2 = AgentFlatContextStore(user_id).load_step2_context_document() or {}
        data = step2.get("data") if isinstance(step2.get("data"), dict) else {}
        website_url = str(data.get("website_url") or "").strip()
    except Exception:
        website_url = ""
    if sync is not None and website_url and not summary["errors"]:
        try:
            sync_result = await sync(website_url) or {}
            summary["website_sync_new"] = int(sync_result.get("new") or 0)
        except Exception as exc:
            summary["errors"].append(f"website_sync_failed: {exc}")
            logger.warning(f"[sif_self_heal] Website sync failed for {user_id}: {exc}")

    if summary["bootstrap_indexed"] or summary["website_sync_new"]:
        summary["healed"] = True
        summary["reason"] = "healed"
        _mark_healed_today(user_id)
        try:
            from services.intelligence.sif_metrics import log_sif_event

            log_sif_event(
                "self_heal",
                user_id=user_id,
                outcome="healed",
                bootstrap=summary["bootstrap_indexed"],
                website_new=summary["website_sync_new"],
                trigger=trigger,
            )
        except Exception:
            pass
    elif not summary["errors"]:
        summary["reason"] = "nothing_to_index"
    return summary

"""
Index version sync via Redis — API reloads embeddings when worker completes ingest.
"""

from __future__ import annotations

from typing import Any, Optional

from doc_rag.index_manager import IndexManager
from doc_rag.logging_utils import FnLogger
from doc_rag.queue.settings import INDEX_VERSION_KEY

log = FnLogger("index_sync")


async def publish_index_version(redis: Any, content_hash: str) -> None:
    """Worker calls after ingest to signal API to reload the index."""
    await redis.set(INDEX_VERSION_KEY, content_hash)
    log.info("publish_index_version", "Published index version hash={}", content_hash[:12])


async def fetch_index_version(redis: Any) -> Optional[str]:
    """Read current index version hash from Redis."""
    value = await redis.get(INDEX_VERSION_KEY)
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode()
    return str(value)


def manifest_content_hash(index_manager: IndexManager) -> Optional[str]:
    """Read content_hash from local manifest.json."""
    manifest = index_manager.load_manifest()
    return manifest.get("content_hash")


async def maybe_reload_index(
    redis: Any,
    index_manager: IndexManager,
    embeddings_holder: dict[str, Any],
    rag_service: Any | None = None,
) -> bool:
    """
    Reload embeddings when Redis index version differs from the in-memory copy.

    Returns True if reload occurred.
    """
    remote_hash = await fetch_index_version(redis)
    if not remote_hash:
        return False

    loaded_hash = embeddings_holder.get("content_hash")
    if loaded_hash == remote_hash:
        return False

    log.info(
        "maybe_reload_index",
        "Index version changed loaded={} remote={}; reloading",
        (loaded_hash or "none")[:12],
        remote_hash[:12],
    )
    index_manager.release()
    loaded = index_manager.load()
    embeddings_holder["embeddings"] = loaded
    embeddings_holder["content_hash"] = remote_hash
    if rag_service is not None:
        rag_service.embeddings = loaded
    return True

"""Phase 3.1: corrupt-index auto-remediation.

When ``_mark_ann_incompatible`` fires (FAISS IndexIDMap nprobe
error), the on-disk txtai index is structurally broken: it was
built with a config that the current FAISS backend cannot
traverse. Rather than leave the user wedged (every search
fails), we write a ``.corrupt`` marker file next to the index.
On the next service start, ``remediate_corrupt_index`` detects
the marker, deletes the broken index files, and returns
control so the normal init path creates a fresh, well-formed
index from the next round of upserts.

This module is intentionally a single function so the caller
(``TxtaiIntelligenceService._initialize_embeddings``) only
needs a one-liner:

    remediate_corrupt_index(self.index_path, user_id=self.user_id)

The function is best-effort: any I/O error during cleanup is
logged but does not raise, so the init path always proceeds.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import sqlite3
import time
from typing import List, Optional

logger = logging.getLogger(__name__)


_CORRUPT_MARKER_SUFFIX = ".corrupt"
_INDEX_FILE_EXTENSIONS = (".index", ".config", ".ids")


def has_corrupt_marker(index_path: str) -> bool:
    """Return True if a ``.corrupt`` marker exists for ``index_path``."""
    return os.path.exists(f"{index_path}{_CORRUPT_MARKER_SUFFIX}")


def remediate_corrupt_index(
    index_path: str,
    user_id: str = "unknown",
    extensions: Optional[List[str]] = None,
) -> bool:
    """Best-effort cleanup of a corrupt on-disk txtai index.

    Args:
        index_path: the on-disk path of the txtai index
            (typically ``workspace/workspace_{user_id}/indices/txtai``).
        user_id: for logging only.
        extensions: override the default list of file suffixes to
            delete. The default covers the four files txtai writes
            (the bare path, plus ``.index`` / ``.config`` / ``.ids``).

    Returns:
        True if a marker was found and cleanup was attempted.
        False if no marker was present (the caller can skip the
        rest of the remediation logic).
    """
    extensions = extensions or list(_INDEX_FILE_EXTENSIONS)
    marker = f"{index_path}{_CORRUPT_MARKER_SUFFIX}"
    if not os.path.exists(marker):
        return False

    logger.warning(
        "Phase 3.1 auto-remediation: .corrupt marker found for user %s; "
        "deleting broken index at %s",
        user_id, index_path,
    )
    try:
        # Delete the directory using rmtree with retry (handles Windows file locking)
        for attempt in range(3):
            try:
                if os.path.isdir(index_path):
                    shutil.rmtree(index_path, ignore_errors=True)
                break
            except PermissionError:
                if attempt < 2:
                    time.sleep(0.5)
        # Delete any remaining loose files
        for ext in extensions:
            p = f"{index_path}{ext}"
            if os.path.exists(p):
                try:
                    if os.path.isdir(p):
                        shutil.rmtree(p, ignore_errors=True)
                    else:
                        os.unlink(p)
                except Exception as unlink_err:
                    logger.warning(
                        "Could not remove %s during remediation: %s",
                        p, unlink_err,
                    )
    except Exception as cleanup_err:
        logger.warning(
            "Phase 3.1 remediation cleanup error for user %s: %s",
            user_id, cleanup_err,
        )
    finally:
        try:
            os.unlink(marker)
        except OSError:
            pass
    return True


def heal_index_consistency(
    index_path: str,
    user_id: str = "unknown",
    db_name: str = "documents",
) -> bool:
    """Best-effort repair of orphaned ``sections`` rows in a txtai index.

    txtai assigns ``sections.indexid`` (its primary key) by advancing
    ``config.offset``. If an earlier indexing stream wrote sections
    rows whose embeddings were never persisted to the ANN index (e.g.
    an interrupted/racing ``upsert``), the ANN size stays behind the
    sections table. The next ``upsert`` then starts assigning indexids
    at ``config.offset`` and collides with the leftover rows, surfacing
    as ``sqlite3.IntegrityError: UNIQUE constraint failed:
    sections.indexid`` forever after (every retry re-fails and the
    strategy watermark never records).

    Orphaned rows have no matching ANN vectors, so they are not
    searchable and can be safely pruned. This function deletes every
    sections row with ``indexid >= offset`` (plus any matching
    ``documents`` / ``objects`` rows) so ``offset == MAX(indexid) + 1``
    and the next upsert proceeds cleanly.

    Best-effort: any failure is logged but never raised, so the init
    path always continues.

    Args:
        index_path: the on-disk path of the txtai index.
        user_id: for logging only.
        db_name: name of the embedded database file (default ``documents``).

    Returns:
        True if orphaned rows were pruned. False when there is no
        detected drift or the check could not run.
    """
    config_path = os.path.join(index_path, "config.json")
    db_path = os.path.join(index_path, db_name)
    if not os.path.exists(config_path) or not os.path.exists(db_path):
        return False

    try:
        with open(config_path, encoding="utf-8") as handle:
            config = json.load(handle)
        offset = config.get("offset")
        if offset is None:
            return False

        connection = sqlite3.connect(db_path)
        try:
            has_sections = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='sections'"
            ).fetchone()
            if not has_sections:
                return False

            max_id = connection.execute("SELECT MAX(indexid) FROM sections").fetchone()[0]
            # In sync (or reverse drift which is benign) — nothing to prune.
            if max_id is None or max_id + 1 <= offset:
                return False

            orphan_ids = [
                row[0]
                for row in connection.execute(
                    "SELECT id FROM sections WHERE indexid >= ?", (offset,)
                )
            ]
            pruned = connection.execute(
                "DELETE FROM sections WHERE indexid >= ?", (offset,)
            ).rowcount
            for oid in orphan_ids:
                connection.execute("DELETE FROM documents WHERE id = ?", (oid,))
                connection.execute("DELETE FROM objects WHERE id = ?", (oid,))
            connection.commit()

            logger.warning(
                "Phase 3.1 auto-remediation: pruned %s orphaned sections rows for "
                "user %s (offset=%s, max_indexid=%s)",
                pruned, user_id, offset, max_id,
            )
            return pruned > 0
        finally:
            connection.close()
    except Exception as cleanup_err:
        logger.warning(
            "Phase 3.1 index consistency check failed for user %s: %s",
            user_id, cleanup_err,
        )
        return False

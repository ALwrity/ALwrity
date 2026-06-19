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

import logging
import os
from typing import List, Optional

logger = logging.getLogger(__name__)


_CORRUPT_MARKER_SUFFIX = ".corrupt"
_INDEX_FILE_EXTENSIONS = ("", ".index", ".config", ".ids")


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
        for ext in extensions:
            p = f"{index_path}{ext}"
            if os.path.exists(p):
                try:
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

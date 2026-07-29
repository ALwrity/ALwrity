"""User workspace database path resolution."""

from __future__ import annotations

import os

from loguru import logger

from services.workspace_paths import get_workspace_root, get_user_workspace_dir

WORKSPACE_DIR = str(get_workspace_root())


def _sanitize_user_id(user_id: str) -> str:
    """Sanitize user_id to be safe for filesystem."""
    return "".join(c for c in user_id if c.isalnum() or c in ("-", "_"))


def ensure_user_workspace_db_directory(user_id: str) -> str:
    """Ensure modern `db/` directory exists, migrating legacy `database/` when safe."""
    safe_user_id = _sanitize_user_id(user_id)
    user_workspace = str(get_user_workspace_dir(user_id))
    db_dir = os.path.join(user_workspace, "db")
    legacy_db_dir = os.path.join(user_workspace, "database")

    if os.path.isdir(legacy_db_dir) and not os.path.exists(db_dir):
        try:
            os.rename(legacy_db_dir, db_dir)
            logger.info(f"Migrated legacy database directory to db/: {user_workspace}")
        except OSError as rename_error:
            logger.warning(
                f"Could not rename legacy database directory for {user_workspace}: {rename_error}"
            )
            os.makedirs(db_dir, exist_ok=True)
            for filename in os.listdir(legacy_db_dir):
                src = os.path.join(legacy_db_dir, filename)
                dst = os.path.join(db_dir, filename)
                if os.path.isfile(src) and not os.path.exists(dst):
                    try:
                        os.link(src, dst)
                    except OSError:
                        import shutil

                        shutil.copy2(src, dst)
    else:
        os.makedirs(db_dir, exist_ok=True)

    return db_dir


def get_user_db_path(user_id: str) -> str:
    """Get the database path for a specific user."""
    safe_user_id = _sanitize_user_id(user_id)
    user_workspace = str(get_user_workspace_dir(user_id))
    db_dir = ensure_user_workspace_db_directory(user_id)

    legacy_db_path = os.path.join(db_dir, "alwrity.db")
    specific_db_path = os.path.join(db_dir, f"alwrity_{safe_user_id}.db")

    legacy_dir_path = os.path.join(user_workspace, "database", f"alwrity_{safe_user_id}.db")
    legacy_dir_default = os.path.join(user_workspace, "database", "alwrity.db")

    if os.path.exists(specific_db_path):
        return specific_db_path

    if os.path.exists(legacy_db_path):
        return legacy_db_path

    if os.path.exists(legacy_dir_path):
        return legacy_dir_path

    if os.path.exists(legacy_dir_default):
        return legacy_dir_default

    return specific_db_path

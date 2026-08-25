"""Migrations utility — stamp existing user databases with Alembic head.

After a baseline migration is generated, each existing per-user SQLite
database must be stamped so Alembic knows it's already at the head
revision.  Without this, the next ``alembic upgrade head`` would try to
re-create all tables.

Usage::

    python -m scripts.migrations.stamp_existing

Run this once per deployment *after* the baseline migration is deployed.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig

from services.database import get_all_user_ids

ALEMBIC_INI_PATH = Path(__file__).resolve().parents[2] / "alembic.ini"


def _get_db_path(user_id: str) -> str:
    """Return the absolute filesystem path to the user's SQLite database."""
    workspace_base = Path("workspace")
    db_file = workspace_base / f"workspace_{user_id}" / "db" / f"alwrity_{user_id}.db"
    return str(db_file.resolve())


def stamp_db(db_path: str, alembic_ini: str | None = None) -> bool:
    """Stamp *db_path* with the current Alembic head revision.

    If the database already contains an ``alembic_version`` row we treat
    it as already stamped and skip the operation.
    """
    ini = alembic_ini or str(ALEMBIC_INI_PATH)
    cfg = AlembicConfig(ini)
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")

    if not Path(db_path).exists():
        print(f"  SKIP (no DB file): {db_path}")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'"
        )
        if cursor.fetchone():
            conn.close()
            print(f"  SKIP (already stamped): {db_path}")
            return False
        conn.close()
    except Exception:
        pass

    command.stamp(cfg, "head")
    print(f"  STAMPED: {db_path}")
    return True


def stamp_all_user_dbs() -> int:
    """Stamp every existing per-user database in the workspace."""
    user_ids = get_all_user_ids()
    if not user_ids:
        print("No user databases found in workspace.")
        return 0

    count = 0
    for uid in sorted(user_ids):
        db_path = _get_db_path(uid)
        if stamp_db(db_path):
            count += 1
    return count


if __name__ == "__main__":
    stamped = stamp_all_user_dbs()
    print(f"\nStamped {stamped} user database(s).")

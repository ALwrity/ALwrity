"""Per-user SQLAlchemy engine cache and lifecycle."""

from __future__ import annotations

import os

from loguru import logger
from sqlalchemy import create_engine, text

from services.database.paths import get_user_db_path

_user_engines: dict = {}


def get_engine_for_user(user_id: str):
    """Get or create a SQLAlchemy engine for a specific user."""
    if user_id in _user_engines:
        return _user_engines[user_id]

    db_path = get_user_db_path(user_id)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    database_url = f"sqlite:///{db_path}"

    engine_kwargs = {
        "echo": False,
        "pool_pre_ping": True,
        "pool_recycle": 300,
        # SQLite WAL mode allows concurrent readers with one writer.
        # pool_size > 1 lets the dashboard's read requests proceed while a
        # scheduler executor holds a write transaction. Write serialization
        # is handled by SQLite's WAL journal, not by pool exhaustion.
        "pool_size": int(os.getenv("DB_POOL_SIZE", "3")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "5")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
        "connect_args": {"check_same_thread": False},
    }

    engine = create_engine(database_url, **engine_kwargs)
    _user_engines[user_id] = engine

    # Enable WAL mode for SQLite — allows concurrent reads with one writer.
    # Increase busy_timeout so writers wait longer for the lock instead of
    # failing immediately under load.
    try:
        with engine.connect() as conn:
            conn.execute(text("PRAGMA journal_mode=WAL"))
            conn.execute(text("PRAGMA busy_timeout=30000"))
            conn.commit()
    except Exception:
        pass

    try:
        from services.database.init_db import init_user_database

        init_user_database(user_id)
    except Exception as e:
        logger.error(f"Failed to auto-initialize database for user {user_id}: {e}")

    return engine


def close_database() -> None:
    """Close all cached database connections."""
    try:
        for engine in _user_engines.values():
            engine.dispose()
        _user_engines.clear()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database connections: {str(e)}")

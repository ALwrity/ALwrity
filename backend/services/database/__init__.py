"""
Database service for ALwrity backend.

Public facade — import from ``services.database`` as before. Implementation
is split across this package for maintainability (each module < 500 lines).
"""

from services.database.engine import _user_engines, close_database, get_engine_for_user
from services.database.init_db import init_database, init_user_database
from services.database.legacy import (
    DATABASE_URL,
    SessionLocal,
    default_db_path,
    default_engine,
    engine,
)
from services.database.paths import WORKSPACE_DIR, ensure_user_workspace_db_directory, get_user_db_path
from services.database.sessions import (
    get_all_user_ids,
    get_db,
    get_db_session,
    get_session_for_user,
    has_onboarding_session,
)

__all__ = [
    "WORKSPACE_DIR",
    "DATABASE_URL",
    "SessionLocal",
    "close_database",
    "default_db_path",
    "default_engine",
    "engine",
    "ensure_user_workspace_db_directory",
    "get_all_user_ids",
    "get_db",
    "get_db_session",
    "get_engine_for_user",
    "get_session_for_user",
    "get_user_db_path",
    "has_onboarding_session",
    "init_database",
    "init_user_database",
]

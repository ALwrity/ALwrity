"""Pytest configuration for backend tests."""

import os
import sys
import sqlite3
import tempfile
import types
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if "dotenv" not in sys.modules:
    _dotenv = types.ModuleType("dotenv")
    _dotenv.load_dotenv = lambda *args, **kwargs: None
    sys.modules["dotenv"] = _dotenv

if "services" not in sys.modules:
    _services = types.ModuleType("services")
    _services.__path__ = [str(BACKEND_ROOT / "services")]
    sys.modules["services"] = _services

if "services.llm_providers.main_image_generation" not in sys.modules:
    _llm_pkg = types.ModuleType("services.llm_providers")
    _llm_pkg.__path__ = [str(BACKEND_ROOT / "services" / "llm_providers")]
    sys.modules["services.llm_providers"] = _llm_pkg

    _llm_img = types.ModuleType("services.llm_providers.main_image_generation")

    async def _enhance_image_prompt(prompt, user_id=None):
        return prompt

# =========================================================================
# Schema helpers (subset of real services' tables — enough for the
# services under test to query what they need).
# =========================================================================

def _init_wordpress_oauth_tokens(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS wordpress_oauth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            token_type TEXT DEFAULT 'bearer',
            expires_at TIMESTAMP,
            scope TEXT,
            blog_id TEXT,
            blog_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE
        )
        """
    )


def _init_wordpress_sites(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS wordpress_sites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            site_url TEXT NOT NULL,
            site_name TEXT,
            username TEXT,
            app_password TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _init_wordpress_posts(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS wordpress_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            site_id INTEGER,
            wp_post_id INTEGER,
            title TEXT,
            status TEXT,
            published_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _init_wix_oauth_tokens(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS wix_oauth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            token_type TEXT DEFAULT 'bearer',
            expires_at TIMESTAMP,
            expires_in INTEGER,
            scope TEXT,
            site_id TEXT,
            member_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE
        )
        """
    )


def _init_bing_oauth_tokens(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bing_oauth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            token_type TEXT DEFAULT 'bearer',
            expires_at TIMESTAMP,
            scope TEXT,
            site_url TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _init_youtube_oauth_tokens(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS youtube_oauth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            channel_id TEXT,
            channel_name TEXT,
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE
        )
        """
    )


def _init_linkedin_oauth_tokens(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS linkedin_oauth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            provider_mode TEXT NOT NULL,
            zernio_api_key TEXT,
            zernio_account_id TEXT,
            zernio_org_account_id TEXT,
            linkedin_access_token TEXT,
            linkedin_refresh_token TEXT,
            expires_at TIMESTAMP,
            account_name TEXT,
            profile_urn TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            zernio_profile_id TEXT,
            unipile_account_id TEXT,
            unipile_org_account_id TEXT
        )
        """
    )


_ALL_SCHEMAS = (
    _init_wordpress_oauth_tokens,
    _init_wordpress_sites,
    _init_wordpress_posts,
    _init_wix_oauth_tokens,
    _init_bing_oauth_tokens,
    _init_youtube_oauth_tokens,
    _init_linkedin_oauth_tokens,
)


# Module-level dict tracking the most recently entered temp DB. The
# ``__exit__`` of ``_PatchedUserDB`` uses this to clear the path only
# when the outer context unwinds (a nested context shouldn't clobber
# the outer one).
_ACTIVE_DB_PATH: dict = {"path": ""}


# =========================================================================
# Shared fixtures
# =========================================================================

@contextmanager
def temp_user_db(user_id: str = "user_test") -> Iterator[str]:
    """Context manager that yields a temp DB path pre-loaded with all
    OAuth schemas. Cleanup is best-effort.

    Used by tests that need a writable per-user SQLite without touching
    the real filesystem.
    """
    tmpdir = tempfile.mkdtemp(prefix=f"oauth_test_{user_id}_")
    db_path = os.path.join(tmpdir, f"alwrity_{user_id}.db")
    with sqlite3.connect(db_path) as conn:
        for init in _ALL_SCHEMAS:
            init(conn)
        conn.commit()
    try:
        yield db_path
    finally:
        try:
            os.remove(db_path)
            os.rmdir(tmpdir)
        except OSError:
            pass


@pytest.fixture
def oauth_db():
    """Pytest fixture returning the ``temp_user_db`` context manager."""
    return temp_user_db


@pytest.fixture
def patch_user_db_path(monkeypatch):
    """Factory fixture that patches ``get_user_db_path`` in every module
    that re-imports it from ``services.database``.

    Returns a function ``patcher(user_id)`` that returns a context
    manager. Entering the context manager:

    1. Creates a temp DB pre-loaded with all OAuth schemas.
    2. Patches ``get_user_db_path`` in every OAuth service module to
       return that temp DB path.

    The patches are auto-undone at test teardown by ``monkeypatch``.

    Example::

        def test_xxx(patch_user_db_path):
            with patch_user_db_path('user_a') as ctx:
                # ctx.db_path is the temp path
                # ctx.user_id is 'user_a'
                # any call to get_user_db_path() returns ctx.db_path
                with sqlite3.connect(ctx.db_path) as conn:
                    conn.execute("INSERT INTO ...")
                result = get_connected_platforms(ctx.user_id)
    """
    patches = []

    def _patcher(user_id: str):
        ctx = temp_user_db(user_id)
        # Pre-allocate the path so the caller can see it inside __enter__.
        return _PatchedUserDB(ctx, monkeypatch, user_id)

    return _patcher


class _PatchedUserDB:
    def __init__(self, ctx, monkeypatch, user_id: str):
        self._ctx = ctx
        self._monkeypatch = monkeypatch
        self._user_id = user_id
        self.db_path: str = ""
        self.user_id: str = user_id

    def __enter__(self):
        # Create the temp DB first
        self.db_path = self._ctx.__enter__()
        _ACTIVE_DB_PATH["path"] = self.db_path

        # Import the modules so monkeypatch has live references to patch
        from services import database as database_module
        from services import oauth_token_monitoring_service as otm_mod
        import services.integrations.wordpress_oauth as wp_mod
        import services.integrations.wordpress_publisher as wp_pub_mod
        import services.integrations.bing_oauth as bing_mod
        import services.integrations.wix_oauth as wix_mod
        import services.youtube.youtube_oauth_service as yt_mod
        import services.gsc_service as gsc_mod
        import services.integrations.wordpress_service as wp_service_mod
        # _get_db_path was moved to the OAuth provider base class in the
        # cs4 refactor; the patch must target the base module too.
        import services.integrations.oauth_provider_base as oauth_base_mod

        modules = [
            database_module,
            otm_mod,  # Important: the dispatch module that calls get_user_db_path at module scope
            wp_mod,
            wp_pub_mod,  # WordPressPublisher uses get_user_db_path at module scope
            bing_mod,
            wix_mod,
            yt_mod,
            gsc_mod,
            wp_service_mod,
            oauth_base_mod,
        ]
        for mod in modules:
            self._monkeypatch.setattr(
                mod,
                "get_user_db_path",
                lambda _uid, p=self.db_path: p,
            )
        return self

    def __exit__(self, exc_type, exc, tb):
        result = self._ctx.__exit__(exc_type, exc, tb)
        # Only clear if the path we set is still current. A nested
        # scenario would otherwise clobber the outer context.
        if _ACTIVE_DB_PATH.get("path") == self.db_path:
            _ACTIVE_DB_PATH["path"] = ""
        return result


_llm_img.enhance_image_prompt = _enhance_image_prompt
sys.modules["services.llm_providers.main_image_generation"] = _llm_img

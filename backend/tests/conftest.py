"""Pytest configuration for backend tests."""

import os
import sys
import sqlite3
import tempfile
import types
import importlib.machinery
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


class _StubLogger:
    """Lightweight loguru drop-in used when loguru isn't installed."""

    def __getattr__(self, name):
        target = _StubLogger()
        return target

    def __call__(self, *args, **kwargs):
        return None

    def bind(self, **kwargs):
        return _StubLogger()

    def opt(self, *args, **kwargs):
        return _StubLogger()

    def add(self, *args, **kwargs):
        return 1

    def remove(self, *args, **kwargs):
        return None

    def configure(self, *args, **kwargs):
        return None

    def info(self, *args, **kwargs):
        return None

    def warning(self, *args, **kwargs):
        return None

    def error(self, *args, **kwargs):
        return None

    def debug(self, *args, **kwargs):
        return None

    def exception(self, *args, **kwargs):
        return None

    def success(self, *args, **kwargs):
        return None

    def critical(self, *args, **kwargs):
        return None

    def trace(self, *args, **kwargs):
        return None

    def log(self, *args, **kwargs):
        return None


if "loguru" not in sys.modules:
    _loguru = types.ModuleType("loguru")
    _loguru.logger = _StubLogger()
    sys.modules["loguru"] = _loguru


if "googleapiclient" not in sys.modules:
    _gap = types.ModuleType("googleapiclient")
    _gap.discovery = types.ModuleType("googleapiclient.discovery")
    _gap.errors = types.ModuleType("googleapiclient.errors")

    def _build(*args, **kwargs):
        return types.SimpleNamespace(
            users=lambda *a, **k: types.SimpleNamespace(
                get=lambda *a, **k: types.SimpleNamespace(execute=lambda: {})
            )
        )

    _gap.errors.HttpError = type("HttpError", (Exception,), {})
    _gap.errors.UnknownApiServiceOrVersion = type("UnknownApiServiceOrVersion", (Exception,), {})
    _gap.discovery.build = _build
    sys.modules["googleapiclient"] = _gap
    sys.modules["googleapiclient.discovery"] = _gap.discovery
    sys.modules["googleapiclient.errors"] = _gap.errors


if "google_auth_oauthlib" not in sys.modules:
    _gaol = types.ModuleType("google_auth_oauthlib")
    _flow = types.ModuleType("google_auth_oauthlib.flow")
    _flow.Flow = type("Flow", (), {})
    _flow.InstalledAppFlow = type("InstalledAppFlow", (), {})

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

    _flow.Flow = _Client
    _gaol.flow = _flow
    sys.modules["google_auth_oauthlib"] = _gaol
    sys.modules["google_auth_oauthlib.flow"] = _flow


def _ensure_nltk_stub():
    if "nltk" in sys.modules:
        return
    stub = types.ModuleType("nltk")
    stub.__path__ = []  # mark as package
    stub.__spec__ = importlib.machinery.ModuleSpec("nltk", None, is_package=True)
    stub.__getattr__ = lambda name: types.SimpleNamespace(
        words=lambda *a, **k: set(),
    ) if name == "stopwords" else (lambda *a, **k: [])

    def _noop(*args, **kwargs):
        return None

    def _noop_list(*args, **kwargs):
        return []

    stub.download = _noop

    sub_tokenize = types.ModuleType("nltk.tokenize")
    sub_tokenize.word_tokenize = _noop_list
    sub_tokenize.sent_tokenize = _noop_list
    sys.modules["nltk.tokenize"] = sub_tokenize
    stub.tokenize = sub_tokenize

    sub_tag = types.ModuleType("nltk.tag")
    sub_tag.pos_tag = _noop_list
    sys.modules["nltk.tag"] = sub_tag
    stub.tag = sub_tag

    sub_corpus = types.ModuleType("nltk.corpus")
    sub_corpus.stopwords = types.SimpleNamespace(words=lambda *a, **k: set())
    sys.modules["nltk.corpus"] = sub_corpus
    stub.corpus = sub_corpus

    sub_data = types.ModuleType("nltk.data")
    sys.modules["nltk.data"] = sub_data
    stub.data = sub_data

    sys.modules["nltk"] = stub


_ensure_nltk_stub()


def _ensure_pkg_stub(name: str):
    """Stub a top-level package as a no-op package if it's missing.

    Provides the minimum surface (``__path__`` + ``__spec__`` + permissive
    ``__getattr__``) so ``from X import Y`` and ``X.submodule.attr`` patterns
    both resolve without crashing. Useful for heavy ML libs that aren't
    installed in the test env.
    """
    if name in sys.modules:
        return
    stub = types.ModuleType(name)
    stub.__path__ = []
    stub.__spec__ = importlib.machinery.ModuleSpec(name, None, is_package=True)

    def _getattr(attr):
        sub = types.ModuleType(f"{name}.{attr}")
        sub.__path__ = []
        sub.__spec__ = importlib.machinery.ModuleSpec(f"{name}.{attr}", None, is_package=True)
        for verb in ("info", "warning", "error", "debug", "load", "download"):
            setattr(sub, verb, lambda *a, **k: None)
        sub.__getattr__ = lambda inner: types.SimpleNamespace(
            load=lambda *a, **k: None,
            words=lambda *a, **k: [],
            get=lambda *a, **k: type("R", (), {"execute": lambda self: {}, "get": lambda self, **kw: {}})(),
        )
        sys.modules[f"{name}.{attr}"] = sub
        return sub

    stub.__getattr__ = _getattr
    sys.modules[name] = stub


for _pkg in ("spacy", "torch", "tensorflow", "transformers", "openai", "exao", "stripe", "exa_py", "exa", "google_auth_httplib2"):
    _ensure_pkg_stub(_pkg)


def _ensure_submodule_stub(parent: str, child: str):
    full = f"{parent}.{child}"
    if full in sys.modules:
        return
    sub = types.ModuleType(full)
    sub.__path__ = []
    sub.__spec__ = importlib.machinery.ModuleSpec(full, None, is_package=True)

    def _ga(inner):
        return types.SimpleNamespace()

    sub.__getattr__ = _ga
    sys.modules[full] = sub
    if parent in sys.modules:
        setattr(sys.modules[parent], child, sub)


_ensure_submodule_stub("google", "genai")
_ensure_submodule_stub("openai", "resources")
_ensure_submodule_stub("openai", "types")


def _ensure_google_genai_types_schema():
    """Provide a stub ``google.genai.types.Schema`` so GeminiProvider imports.

    The real package is heavy and not part of the test environment.
    """
    if "google.genai.types" in sys.modules:
        mod = sys.modules["google.genai.types"]
    else:
        mod = types.ModuleType("google.genai.types")
        sys.modules["google.genai.types"] = mod
        if "google.genai" in sys.modules:
            setattr(sys.modules["google.genai"], "types", mod)

    class _Schema:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    mod.Schema = _Schema
    mod.Type = types.SimpleNamespace(OBJECT="object", STRING="string", NUMBER="number")
    return mod


_ensure_google_genai_types_schema()
# Backstop: ensure google namespace is available without hiding real subpkgs.
try:
    import google  # noqa: F401
except ImportError:
    _ensure_pkg_stub("google")

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

    async def generate_image(*args, **kwargs):
        return {"url": "", "image_url": ""}

    async def generate_image_variation(*args, **kwargs):
        return {"url": "", "variations": []}

    async def edit_image(*args, **kwargs):
        return {"url": ""}

    _llm_img.generate_image = generate_image
    _llm_img.generate_image_edit = edit_image
    _llm_img.generate_image_variation = generate_image_variation
    _llm_img.edit_image = edit_image
    _llm_img._enhance_image_prompt = _enhance_image_prompt
    _llm_img.enhance_image_prompt = _enhance_image_prompt

    async def _stub_any(*args, **kwargs):
        return {"url": ""}

    def _getattr(name):
        return _stub_any

    _llm_img.__getattr__ = _getattr
    sys.modules["services.llm_providers.main_image_generation"] = _llm_img

if "services.llm_providers.main_image_editing" not in sys.modules:
    _llm_edit = types.ModuleType("services.llm_providers.main_image_editing")

    async def edit_image_edit(*args, **kwargs):
        return {"url": ""}

    _llm_edit.edit_image = edit_image_edit
    sys.modules["services.llm_providers.main_image_editing"] = _llm_edit

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
            linkedin_access_token TEXT,
            linkedin_refresh_token TEXT,
            expires_at TIMESTAMP,
            account_name TEXT,
            profile_urn TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

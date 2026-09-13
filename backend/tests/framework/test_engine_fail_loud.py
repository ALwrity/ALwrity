"""R1.3 item 4 — engine creation must fail loudly when migrations fail.

Finding C4 tail: ``get_engine_for_user`` caught *every* init error and
returned the engine anyway, so a database whose ``alembic upgrade head``
failed was handed to callers as if it were usable — per-user DBs then fail
at query time with confusing errors instead of one loud startup error.

Contract:
- a failing ``init_user_database`` → ``get_engine_for_user`` raises
  (after logging), never returns a silent engine;
- a successful init → engine returned and cached per user.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


@pytest.fixture()
def isolated_engine(monkeypatch, tmp_path):
    """Point the engine factory at a temp file, with a fresh cache.

    Patch by module object via importlib: ``services.database`` shadows its
    submodule attributes (``import a.b as c`` binds the shadow), so string
    and package-attr patching would hit None.
    """
    engine_mod = importlib.import_module("services.database.engine")

    db_file = tmp_path / "engine-fail-loud.db"
    monkeypatch.setattr(engine_mod, "get_user_db_path", lambda user_id: str(db_file))
    monkeypatch.setattr(engine_mod, "_user_engines", {})
    return engine_mod


class TestEngineFailLoud:
    def test_migration_failure_raises(self, isolated_engine, monkeypatch):
        init_db_mod = importlib.import_module("services.database.init_db")
        get_engine_for_user = isolated_engine.get_engine_for_user

        def _boom(user_id: str) -> None:
            raise RuntimeError("alembic upgrade exploded")

        monkeypatch.setattr(init_db_mod, "init_user_database", _boom)

        with pytest.raises(RuntimeError, match="alembic upgrade exploded"):
            get_engine_for_user("fail-loud-user")

    def test_success_returns_engine_and_caches(self, isolated_engine, monkeypatch):
        init_db_mod = importlib.import_module("services.database.init_db")
        get_engine_for_user = isolated_engine.get_engine_for_user

        monkeypatch.setattr(init_db_mod, "init_user_database", lambda user_id: None)

        first = get_engine_for_user("happy-user")
        try:
            assert first is not None
            second = get_engine_for_user("happy-user")
            assert second is first, "engines must be cached per user"
        finally:
            first.dispose()

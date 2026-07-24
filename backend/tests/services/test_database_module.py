"""Contract regression tests for database module split (PR #181).

Verifies that the services/database/ package preserves the existing
``from services.database import ...`` public API and that every
pre-existing symbol is still importable.
"""

import pytest

pytestmark = [pytest.mark.critical]

EXPECTED_SYMBOLS = {
    "WORKSPACE_DIR", "DATABASE_URL", "SessionLocal",
    "close_database", "default_db_path", "default_engine", "engine",
    "ensure_user_workspace_db_directory",
    "get_all_user_ids", "get_db", "get_db_session",
    "get_engine_for_user", "get_session_for_user", "get_user_db_path",
    "has_onboarding_session", "init_database", "init_user_database",
}


class TestDatabaseModuleApi:
    def test_all_expected_symbols_importable(self):
        import services.database
        for name in EXPECTED_SYMBOLS:
            assert hasattr(services.database, name), (
                f"services.database.{name} missing after module split"
            )

    def test_no_symbols_removed_from_api(self):
        import services.database
        actual = {n for n in dir(services.database) if not n.startswith("_")}
        missing = EXPECTED_SYMBOLS - actual
        assert not missing, f"Symbols lost in module split: {missing}"

    def test_submodules_importable(self):
        for mod in [
            "services.database.paths", "services.database.engine",
            "services.database.sessions", "services.database.init_db",
            "services.database.legacy",
        ]:
            __import__(mod)

    def test_get_db_yields_session(self):
        from services.database import get_db
        import inspect
        assert inspect.isgeneratorfunction(get_db)

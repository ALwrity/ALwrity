import builtins
import json
import runpy
import sys
import types
from pathlib import Path

import pytest

import start_alwrity_backend as backend_cli


BACKEND_ROOT = Path(__file__).resolve().parents[1]
STARTUP_SCRIPT = BACKEND_ROOT / "start_alwrity_backend.py"


def test_load_startup_environment_uses_backend_env_path(monkeypatch, capsys):
    load_calls = []
    dotenv_module = types.ModuleType("dotenv")
    dotenv_module.load_dotenv = lambda path: load_calls.append(path)
    monkeypatch.setitem(sys.modules, "dotenv", dotenv_module)

    backend_cli.load_startup_environment()

    assert load_calls == [BACKEND_ROOT / ".env"]
    capsys.readouterr()


def test_help_exits_before_startup_imports(monkeypatch, capsys):
    blocked_imports = {
        "alwrity_utils",
        "app",
        "database",
        "dotenv",
        "huggingface_hub",
        "models",
        "nltk",
        "services",
        "sqlalchemy",
        "spacy",
        "uvicorn",
    }
    original_import = builtins.__import__

    def guarded_import(name, *args, **kwargs):
        if name.split(".", 1)[0] in blocked_imports:
            raise AssertionError(f"Unexpected startup import while showing help: {name}")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", guarded_import)
    monkeypatch.setattr(sys, "argv", [str(STARTUP_SCRIPT), "--help"])
    monkeypatch.setenv("ALWRITY_ENABLED_FEATURES", "all")

    with pytest.raises(SystemExit) as exc_info:
        runpy.run_path(str(STARTUP_SCRIPT), run_name="__main__")

    assert exc_info.value.code == 0
    help_output = capsys.readouterr().out
    assert "usage:" in help_output
    assert "[STARTUP]" not in help_output
    assert "Bootstrap Summary" not in help_output
    for option in ("--reload", "--dev", "--production", "--verbose"):
        assert option in help_output


def test_main_preserves_arguments_and_feature_gating(monkeypatch):
    monkeypatch.chdir(BACKEND_ROOT)
    monkeypatch.setenv("ALWRITY_ENABLED_FEATURES", "podcast")
    call_order = []
    start_calls = []
    optional_checks = []
    optimizer_calls = []

    monkeypatch.setattr(
        backend_cli,
        "load_startup_environment",
        lambda: call_order.append("environment"),
    )
    original_get_enabled_features = backend_cli.get_enabled_features

    def get_enabled_features():
        call_order.append("features")
        return original_get_enabled_features()

    monkeypatch.setattr(backend_cli, "get_enabled_features", get_enabled_features)

    def fail_bootstrap():
        pytest.fail("Podcast-only mode must skip model bootstrapping")

    monkeypatch.setattr(backend_cli, "bootstrap_linguistic_models", fail_bootstrap)
    monkeypatch.setattr(backend_cli, "bootstrap_local_llm_models", fail_bootstrap)

    class FakeDependencyManager:
        def check_critical_dependencies(self):
            return True, []

        def check_optional_dependencies(self):
            optional_checks.append(True)

    class FakeEnvironmentSetup:
        def __init__(self, production_mode):
            self.production_mode = production_mode

        def setup_directories(self):
            return True

        def setup_environment_variables(self):
            return True

        def create_env_file(self):
            return None

    class FakeDatabaseSetup:
        def __init__(self, production_mode):
            self.production_mode = production_mode

        def setup_essential_tables(self):
            return True

        def setup_advanced_tables(self):
            return None

        def verify_tables(self):
            return True

    class FakeProductionOptimizer:
        def apply_production_optimizations(self):
            optimizer_calls.append(True)
            return True

    def load_utilities():
        call_order.append("utilities")
        return (
            FakeDependencyManager,
            FakeEnvironmentSetup,
            FakeDatabaseSetup,
            FakeProductionOptimizer,
        )

    monkeypatch.setattr(backend_cli, "load_startup_utilities", load_utilities)
    monkeypatch.setattr(
        backend_cli,
        "start_backend",
        lambda enable_reload, production_mode: (
            start_calls.append((enable_reload, production_mode)) or True
        ),
    )

    assert backend_cli.main(["--reload", "--dev", "--verbose"]) is True
    assert call_order[0] == "environment"
    assert call_order[-1] == "utilities"
    assert all(item == "features" for item in call_order[1:-1])
    assert start_calls == [(True, False)]
    assert optional_checks == [True]
    assert optimizer_calls == []
    assert all(result.skipped for result in backend_cli.BOOTSTRAP_RESULTS)

    call_order.clear()
    assert backend_cli.main(["--dev", "--production"]) is True
    assert start_calls[-1] == (False, True)
    assert optimizer_calls == [True]


def test_bootstrap_runs_for_all_features_with_mocked_models(monkeypatch):
    monkeypatch.setenv("ALWRITY_ENABLED_FEATURES", "all")
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    bootstrap_calls = []

    def mocked_bootstrap(name):
        bootstrap_calls.append(name)
        return backend_cli.BootstrapResult(name, success=True, skipped=False)

    monkeypatch.setattr(
        backend_cli,
        "bootstrap_linguistic_models",
        lambda: mocked_bootstrap("linguistic_models"),
    )
    monkeypatch.setattr(
        backend_cli,
        "bootstrap_local_llm_models",
        lambda: mocked_bootstrap("local_llm_models"),
    )

    backend_cli.bootstrap_startup_models()

    assert bootstrap_calls == ["linguistic_models", "local_llm_models"]
    summary = json.loads(backend_cli.os.environ["ALWRITY_BOOTSTRAP_SUMMARY"])
    assert summary["enabled_features"] == "all"
    assert [item["name"] for item in summary["bootstraps"]] == bootstrap_calls

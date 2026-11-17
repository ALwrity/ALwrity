import importlib.util
import logging
import sys
import types
from io import BytesIO, TextIOWrapper
from pathlib import Path

import start_alwrity_backend as backend_cli
from utils import console_encoding


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _cp1252_stream():
    buffer = BytesIO()
    stream = TextIOWrapper(buffer, encoding="cp1252", errors="strict")
    return buffer, stream


def test_cp1252_stream_escapes_unsupported_unicode(monkeypatch):
    monkeypatch.setattr(console_encoding, "IS_WINDOWS", True)
    buffer, stream = _cp1252_stream()
    try:
        console_encoding.configure_windows_console_encoding((stream,))

        assert stream.encoding.lower() == "cp1252"
        assert stream.errors == "backslashreplace"
        stream.write(chr(0x2705) + " console output\n")
        stream.flush()
        assert b"\\u2705 console output" in buffer.getvalue()
    finally:
        stream.close()


def test_utf8_stream_keeps_unicode_output_unchanged(monkeypatch):
    monkeypatch.setattr(console_encoding, "IS_WINDOWS", True)
    buffer = BytesIO()
    stream = TextIOWrapper(buffer, encoding="utf-8", errors="strict")
    try:
        console_encoding.configure_windows_console_encoding((stream,))
        stream.write(chr(0x2705))
        stream.flush()

        assert stream.encoding.lower() == "utf-8"
        assert buffer.getvalue() == chr(0x2705).encode("utf-8")
    finally:
        stream.close()


def test_stream_without_reconfigure_is_ignored(monkeypatch):
    monkeypatch.setattr(console_encoding, "IS_WINDOWS", True)

    class WriteOnlyStream:
        def write(self, text):
            return len(text)

    console_encoding.configure_windows_console_encoding((WriteOnlyStream(),))


def test_stream_reconfigure_error_is_ignored(monkeypatch):
    monkeypatch.setattr(console_encoding, "IS_WINDOWS", True)

    class UnsupportedStream:
        def reconfigure(self, **kwargs):
            raise OSError("stream cannot be reconfigured")

    console_encoding.configure_windows_console_encoding((UnsupportedStream(),))


def test_non_windows_stream_is_not_reconfigured(monkeypatch):
    monkeypatch.setattr(console_encoding, "IS_WINDOWS", False)
    calls = []

    class ReconfigurableStream:
        def reconfigure(self, **kwargs):
            calls.append(kwargs)

    console_encoding.configure_windows_console_encoding((ReconfigurableStream(),))

    assert calls == []


class _FakeLoguruLogger:
    _levels = {"DEBUG": 10, "INFO": 20, "WARNING": 30, "ERROR": 40, "CRITICAL": 50}

    def __init__(self):
        self.handlers = []

    def remove(self):
        self.handlers.clear()

    def configure(self, **kwargs):
        return None

    def add(self, sink, level, format, filter=None, **kwargs):
        self.handlers.append(
            {"sink": sink, "level": self._levels[level], "filter": filter}
        )

    def warning(self, message):
        self._emit("WARNING", message)

    def error(self, message):
        self._emit("ERROR", message)

    def _emit(self, level, message):
        record = {
            "level": types.SimpleNamespace(name=level),
            "message": message,
            "name": "test",
            "extra": {},
        }
        for handler in self.handlers:
            if self._levels[level] < handler["level"]:
                continue
            if handler["filter"] and not handler["filter"](record):
                continue
            handler["sink"](message + "\n")


def _load_logging_config(monkeypatch, fake_logger):
    loguru_module = types.ModuleType("loguru")
    loguru_module.logger = fake_logger
    monkeypatch.setitem(sys.modules, "loguru", loguru_module)

    module_path = BACKEND_ROOT / "logging_config.py"
    spec = importlib.util.spec_from_file_location(
        "logging_config_console_encoding_test", module_path
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    monkeypatch.setattr(module, "_configure_uvicorn_loggers", lambda level: None)
    monkeypatch.setattr(module, "_register_global_exception_handlers", lambda: None)

    class FakeStdlibLogger:
        def setLevel(self, level):
            return None

    monkeypatch.setattr(
        module,
        "logging",
        types.SimpleNamespace(
            Handler=logging.Handler,
            CRITICAL=logging.CRITICAL,
            WARNING=logging.WARNING,
            INFO=logging.INFO,
            DEBUG=logging.DEBUG,
            getLogger=lambda name=None: FakeStdlibLogger(),
        ),
    )
    return module


def test_loguru_warning_and_error_sinks_write_with_cp1252(monkeypatch):
    monkeypatch.setattr(console_encoding, "IS_WINDOWS", True)
    monkeypatch.setenv("ALWRITY_VERBOSE", "false")
    stdout_buffer, stdout = _cp1252_stream()
    _, stderr = _cp1252_stream()
    monkeypatch.setattr(sys, "stdout", stdout)
    monkeypatch.setattr(sys, "stderr", stderr)

    fake_logger = _FakeLoguruLogger()
    logging_config = _load_logging_config(monkeypatch, fake_logger)
    try:
        logging_config.setup_clean_logging()
        fake_logger.warning(f"{chr(0x26A0)} warning")
        fake_logger.error(f"{chr(0x274C)} error")
        stdout.flush()

        output = stdout_buffer.getvalue().decode("cp1252")
        assert "\\u26a0 warning" in output
        assert "\\u274c error" in output
        assert stdout.encoding.lower() == "cp1252"
        assert stdout.errors == "backslashreplace"
        assert stderr.encoding.lower() == "cp1252"
        assert stderr.errors == "backslashreplace"
    finally:
        stdout.close()
        stderr.close()


def test_cli_prints_write_with_cp1252(monkeypatch):
    monkeypatch.setattr(console_encoding, "IS_WINDOWS", True)
    monkeypatch.chdir(BACKEND_ROOT)
    stdout_buffer, stdout = _cp1252_stream()
    _, stderr = _cp1252_stream()
    monkeypatch.setattr(sys, "stdout", stdout)
    monkeypatch.setattr(sys, "stderr", stderr)

    class FakeDependencyManager:
        def check_critical_dependencies(self):
            return True, []

        def check_optional_dependencies(self):
            return None

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
            return True

    monkeypatch.setattr(backend_cli, "DependencyManager", FakeDependencyManager)
    monkeypatch.setattr(backend_cli, "EnvironmentSetup", FakeEnvironmentSetup)
    monkeypatch.setattr(backend_cli, "DatabaseSetup", FakeDatabaseSetup)
    monkeypatch.setattr(backend_cli, "ProductionOptimizer", FakeProductionOptimizer)
    monkeypatch.setattr(backend_cli, "start_backend", lambda **kwargs: True)
    monkeypatch.setattr(sys, "argv", ["start_alwrity_backend.py", "--reload"])

    try:
        assert backend_cli.main() is True
        stdout.flush()

        output = stdout_buffer.getvalue().decode("cp1252")
        assert "\\U0001f4e6 Checking dependencies" in output
        assert "\\U0001f680 Starting server" in output
        assert stdout.errors == "backslashreplace"
        assert stdout.encoding.lower() == "cp1252"
    finally:
        stdout.close()
        stderr.close()

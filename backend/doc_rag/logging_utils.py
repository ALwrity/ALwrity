"""
Central logging configuration for the doc_rag package.

Provides function-name tags on every log line (e.g. ``[ingest.run_ingest]``) and
supports two optional verbosity levels:

- **verbose** (--verbose / DOC_RAG_VERBOSE): INFO-level execution trace (startup steps,
  ingest progress, search/RAG request summaries).
- **debug** (--debug / DOC_RAG_DEBUG): DEBUG-level detail (per-file discovery, chunk
  counts, SQL parameters, embedding load steps).
"""

from __future__ import annotations

import os
import sys
from typing import Any

from loguru import logger

_CONFIGURED = False
_VERBOSE = False
_DEBUG = False


def is_verbose() -> bool:
    """Return True when execution-trace logging is enabled."""
    return _VERBOSE


def is_debug() -> bool:
    """Return True when debug-level logging is enabled."""
    return _DEBUG


def configure_logging(verbose: bool = False, debug: bool = False) -> None:
    """
    Configure loguru for doc_rag.

    Call once at process startup (``__main__.py``). Debug implies verbose.
    """
    global _CONFIGURED, _VERBOSE, _DEBUG

    _VERBOSE = verbose or debug or _env_flag("DOC_RAG_VERBOSE")
    _DEBUG = debug or _env_flag("DOC_RAG_DEBUG")

    if _CONFIGURED:
        return

    level = "DEBUG" if _DEBUG else "INFO"
    logger.remove()
    logger.add(
        sys.stderr,
        level=level,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level:<8}</level> | "
            "<cyan>{extra[fn_tag]}</cyan> | "
            "{message}"
        ),
        filter=lambda record: record["extra"].setdefault("fn_tag", "doc_rag") or True,
    )
    _CONFIGURED = True

    logger.bind(fn_tag="logging_utils.configure_logging").info(
        "Logging configured (level={}, verbose={}, debug={})", level, _VERBOSE, _DEBUG
    )


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _tag(module: str, func: str) -> str:
    return f"{module}.{func}"


class FnLogger:
    """
    Logger wrapper that prefixes messages with ``module.function``.

    Usage::

        log = FnLogger("ingest")
        log.info("run_ingest", "Discovered {} documents", count)
    """

    def __init__(self, module: str):
        self.module = module

    def _bind(self, func: str):
        return logger.bind(fn_tag=_tag(self.module, func))

    def trace(self, func: str, message: str, *args: Any, **kwargs: Any) -> None:
        """INFO-level execution trace; emitted only when verbose or debug is on."""
        if _VERBOSE or _DEBUG:
            self._bind(func).info(message, *args, **kwargs)

    def debug(self, func: str, message: str, *args: Any, **kwargs: Any) -> None:
        self._bind(func).debug(message, *args, **kwargs)

    def info(self, func: str, message: str, *args: Any, **kwargs: Any) -> None:
        self._bind(func).info(message, *args, **kwargs)

    def warning(self, func: str, message: str, *args: Any, **kwargs: Any) -> None:
        self._bind(func).warning(message, *args, **kwargs)

    def error(self, func: str, message: str, *args: Any, **kwargs: Any) -> None:
        self._bind(func).error(message, *args, **kwargs)

    def exception(self, func: str, message: str, *args: Any, **kwargs: Any) -> None:
        self._bind(func).exception(message, *args, **kwargs)

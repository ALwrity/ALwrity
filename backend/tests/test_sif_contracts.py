"""
SIF contract tests
=================

Parametrized tests that exercise the public-method contracts of the
SIF surface as defined in Phase 1.2. The tests run **without** a real
txtai / FAISS installation by stubbing the heavy module imports.

Each contract test asserts one of:
  - **Success path**: the method returns the documented return type.
  - **Normal miss**: the method returns the documented empty value
    (``None`` / ``[]`` / ``{}`` / ``0`` / ``False``).
  - **Internal fault**: the method raises the documented SIFError
    subclass.

These tests are intentionally small (no full app, no DB). The goal is
to lock the *error contract* in place so future refactors don't
silently re-introduce the old "swallow and return []" pattern.
"""
from __future__ import annotations

import asyncio
import sys
import types
import importlib.util
import pathlib
from typing import Any, Dict, List, Optional

import pytest


# --------------------------------------------------------------------------
# Test infrastructure: load sif_errors, semantic_cache, txtai_service
# with stubbed heavy deps so we can exercise them without a real install.
# --------------------------------------------------------------------------
def _load(name: str, path: str) -> types.ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sys.modules[name] = mod
    return mod


# Project root (parent of the tests/ directory) — all relative paths
# in this file are anchored here. Using __file__ keeps the test
# working regardless of pytest's CWD.
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
SIF_SERVICES_DIR = PROJECT_ROOT / "services" / "intelligence"
sem_cache_path = str(SIF_SERVICES_DIR / "semantic_cache.py")


# Stub loguru (used by both semantic_cache and txtai_service)
class _StubLogger:
    def info(self, *a, **k): pass
    def debug(self, *a, **k): pass
    def warning(self, *a, **k): pass
    def error(self, *a, **k): pass
    def exception(self, *a, **k): pass
    def bind(self, *a, **k):
        return self
    def opt(self, *a, **k):
        return self
    def log(self, *a, **k): pass
    def remove(self, *a, **k): pass
    def add(self, *a, **k): pass


@pytest.fixture(scope="session", autouse=True)
def _stub_heavy_imports():
    loguru_stub = types.ModuleType("loguru")
    loguru_stub.logger = _StubLogger()
    sys.modules.setdefault("loguru", loguru_stub)


@pytest.fixture(scope="session")
def sif_errors():
    """Load sif_errors via importlib. We register it under BOTH a
    standalone name and the dotted ``services.intelligence.sif_errors``
    name so the relative import in semantic_cache resolves to the
    SAME class instance as the one the test sees."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "sif_errors_standalone",
        str(SIF_SERVICES_DIR / "sif_errors.py"),
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["sif_errors_standalone"] = mod
    spec.loader.exec_module(mod)
    # Build the parent package and register sif_errors under it.
    # ``services`` itself is NOT registered (so subsequent
    # ``import services`` would re-execute __init__.py and pull in
    # the full backend stack). Only the deep dotted path is set.
    pkg_services = sys.modules.get("services")
    if pkg_services is None:
        pkg_services = types.ModuleType("services")
        sys.modules["services"] = pkg_services
    pkg_intel = sys.modules.get("services.intelligence")
    if pkg_intel is None:
        pkg_intel = types.ModuleType("services.intelligence")
        pkg_intel.__path__ = [str(SIF_SERVICES_DIR)]
        sys.modules["services.intelligence"] = pkg_intel
    sys.modules["services.intelligence.sif_errors"] = mod
    return mod


@pytest.fixture(scope="session")
def semantic_cache_module(sif_errors):
    """Load semantic_cache. The sif_errors fixture above must run
    first so the parent package and sif_errors are registered in
    sys.modules before the relative import in semantic_cache resolves."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "semantic_cache_standalone",
        str(SIF_SERVICES_DIR / "semantic_cache.py"),
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["semantic_cache_standalone"] = mod
    sys.modules["services.intelligence.semantic_cache"] = mod
    spec.loader.exec_module(mod)
    return mod


# --------------------------------------------------------------------------
# sif_errors taxonomy — sanity tests
# --------------------------------------------------------------------------
class TestSIFErrorTaxonomy:
    def test_all_classes_exist(self, sif_errors):
        """All 9 classes in the taxonomy are importable."""
        expected = {
            "SIFError",
            "SIFNotInitialized",
            "SIFIndexMissing",
            "SIFIndexCorrupted",
            "SIFSearchUnavailable",
            "SIFEmbeddingFailed",
            "SIFCacheError",
            "SIFContextMissing",
            "SIFAgentUnavailable",
        }
        for name in expected:
            assert hasattr(sif_errors, name), f"missing {name}"

    @pytest.mark.parametrize("child_name", [
        "SIFNotInitialized",
        "SIFIndexMissing",
        "SIFIndexCorrupted",
        "SIFSearchUnavailable",
        "SIFEmbeddingFailed",
        "SIFCacheError",
        "SIFContextMissing",
        "SIFAgentUnavailable",
    ])
    def test_subclass_inherits_from_sif_error(self, sif_errors, child_name):
        """Every subclass is a subclass of SIFError."""
        child = getattr(sif_errors, child_name)
        assert issubclass(child, sif_errors.SIFError)

    def test_user_id_and_operation_round_trip(self, sif_errors):
        """user_id and operation are surfaced via __str__."""
        e = sif_errors.SIFNotInitialized(
            "test message", user_id="u1", operation="search"
        )
        assert e.user_id == "u1"
        assert e.operation == "search"
        assert "test message" in str(e)
        assert "user_id='u1'" in str(e)
        assert "operation='search'" in str(e)

    def test_cause_chaining(self, sif_errors):
        """raise X from original preserves the original via __cause__."""
        original = OSError("disk full")
        try:
            try:
                raise original
            except OSError as orig:
                raise sif_errors.SIFCacheError(
                    "could not write", user_id="u", operation="cache",
                ) from orig
        except sif_errors.SIFCacheError as e:
            assert e.__cause__ is original
            assert "OSError" in str(e)


# --------------------------------------------------------------------------
# semantic_cache contracts
# --------------------------------------------------------------------------
class TestSemanticCacheContracts:
    """Verify the Phase 1.2.1 contract: raise SIFCacheError on fault,
    return None / False for normal miss / low-quality."""

    def test_get_cached_semantic_insights_normal_miss_returns_none(
        self, semantic_cache_module
    ):
        cm = semantic_cache_module.SemanticCacheManager()
        assert cm.get_cached_semantic_insights("never_cached") is None

    def test_get_cached_query_results_normal_miss_returns_none(
        self, semantic_cache_module
    ):
        cm = semantic_cache_module.SemanticCacheManager()
        assert cm.get_cached_query_results("never_cached", user_id="u") is None

    def test_cache_query_results_low_quality_returns_false(
        self, semantic_cache_module
    ):
        cm = semantic_cache_module.SemanticCacheManager()
        # Score below 0.7 threshold
        assert cm.cache_query_results(
            query="t", results=[{"score": 0.1}], user_id="u"
        ) is False

    def test_cache_query_results_empty_results_returns_false(
        self, semantic_cache_module
    ):
        cm = semantic_cache_module.SemanticCacheManager()
        assert cm.cache_query_results(query="t", results=[], user_id="u") is False

    def test_cache_query_results_high_quality_returns_true(
        self, semantic_cache_module
    ):
        cm = semantic_cache_module.SemanticCacheManager()
        assert cm.cache_query_results(
            query="t", results=[{"score": 0.9}], user_id="u"
        ) is True

    def test_cache_semantic_insights_raises_on_fault(
        self, semantic_cache_module, sif_errors
    ):
        """Phase 1.2.1 contract: a real write fault raises SIFCacheError."""

        class _FailingDict(dict):
            def __setitem__(self, k, v):
                raise OSError("disk full")

        cm = semantic_cache_module.SemanticCacheManager()
        cm.memory_cache = _FailingDict()
        with pytest.raises(sif_errors.SIFCacheError) as exc:
            cm.cache_semantic_insights("u1", {"x": 1})
        assert exc.value.user_id == "u1"
        assert exc.value.operation == "cache_semantic_insights"
        assert isinstance(exc.value.__cause__, OSError)

    def test_clear_cache_raises_on_fault(
        self, semantic_cache_module, sif_errors
    ):
        class _FailingClear:
            def clear(self):
                raise OSError("simulated")

        cm = semantic_cache_module.SemanticCacheManager()
        cm.memory_cache = _FailingClear()
        with pytest.raises(sif_errors.SIFCacheError) as exc:
            cm.clear_cache()
        assert exc.value.operation == "clear_cache"

    def test_get_cache_stats_raises_on_fault(
        self, semantic_cache_module, sif_errors
    ):
        class _FailingLen:
            def __len__(self):
                raise OSError("simulated")

        cm = semantic_cache_module.SemanticCacheManager()
        cm.memory_cache = _FailingLen()
        with pytest.raises(sif_errors.SIFCacheError) as exc:
            cm.get_cache_stats()
        assert exc.value.operation == "get_cache_stats"

    def test_invalidate_user_cache_raises_on_fault(
        self, semantic_cache_module, sif_errors
    ):
        class _FailingItems:
            def items(self):
                raise OSError("simulated")
            def get(self, k, default=None):
                raise OSError("simulated")
            def __contains__(self, k):
                raise OSError("simulated")
            def __delitem__(self, k):
                raise OSError("simulated")
            def __iter__(self):
                raise OSError("simulated")
            def __len__(self):
                raise OSError("simulated")
            def __getitem__(self, k):
                raise OSError("simulated")
            def values(self):
                raise OSError("simulated")
            def keys(self):
                raise OSError("simulated")

        cm = semantic_cache_module.SemanticCacheManager()
        cm.memory_cache = _FailingItems()
        cm.user_indices = _FailingItems()
        with pytest.raises(sif_errors.SIFCacheError) as exc:
            cm.invalidate_user_cache("u1")
        assert exc.value.user_id == "u1"
        assert exc.value.operation == "invalidate_user_cache"

    def test_cleanup_expired_entries_raises_on_fault(
        self, semantic_cache_module, sif_errors
    ):
        class _FailingItems:
            def items(self):
                raise OSError("simulated")
            def __contains__(self, k):
                return False

        cm = semantic_cache_module.SemanticCacheManager()
        cm.memory_cache = _FailingItems()
        with pytest.raises(sif_errors.SIFCacheError) as exc:
            cm.cleanup_expired_entries()
        assert exc.value.operation == "cleanup_expired_entries"

    @pytest.mark.parametrize("method_name,args", [
        ("cache_semantic_insights", ("u1", {"x": 1})),
        ("clear_cache", ()),
        ("get_cache_stats", ()),
        ("invalidate_user_cache", ("u1",)),
        ("invalidate_on_content_update", ("u1", "blog_post")),
        ("cleanup_expired_entries", ()),
    ])
    def test_writes_raise_sif_cache_error(
        self, semantic_cache_module, sif_errors, method_name, args
    ):
        """Every write/invalidate method must raise SIFCacheError on
        an internal fault (not return False / None silently)."""

        class _BoomDict(dict):
            def __setitem__(self, k, v):
                raise OSError("disk full")
            def __delitem__(self, k):
                raise OSError("disk full")
            def __iter__(self):
                raise OSError("disk full")
            def items(self):
                raise OSError("disk full")
            def values(self):
                raise OSError("disk full")
            def keys(self):
                raise OSError("disk full")
            def clear(self):
                raise OSError("disk full")
            def __len__(self):
                raise OSError("disk full")
            def get(self, k, default=None):
                raise OSError("disk full")
            def __contains__(self, k):
                raise OSError("disk full")

        cm = semantic_cache_module.SemanticCacheManager()
        cm.memory_cache = _BoomDict()
        cm.user_indices = _BoomDict()
        method = getattr(cm, method_name)
        with pytest.raises(sif_errors.SIFCacheError):
            method(*args)


# --------------------------------------------------------------------------
# Phase 5 / Issue #6: cache version is derived from the model path,
# not a hardcoded literal. Toggling the model_fingerprint or the
# DEFAULT_MODEL_PATH must invalidate entries created under the
# previous version.
# --------------------------------------------------------------------------
class TestCacheVersionDerivation:
    """Issue #6: cache version must be model-derived, not a hardcoded
    ``"v1.0.0"``. A model change should produce a version change and
    a controlled invalidation, not a global cache stampede.
    """

    def test_version_includes_model_fingerprint(self):
        """When model_fingerprint is provided, the version string
        contains it."""
        import sys
        spec = importlib.util.spec_from_file_location(
            "_sc_test_version_a", sem_cache_path
        )
        mod = importlib.util.module_from_spec(spec)
        sys.modules["_sc_test_version_a"] = mod
        spec.loader.exec_module(mod)
        cm = mod.SemanticCacheManager(
            model_fingerprint="my-custom-model-v2"
        )
        v = cm._get_current_version()
        assert "my-custom-model-v2" in v, f"model fingerprint missing from version: {v}"
        assert v.startswith("v1:"), f"version should start with v1: prefix: {v}"

    def test_default_version_uses_default_model_path(self):
        """When no model_fingerprint is set, the version uses
        ``TxtaiIntelligenceService.DEFAULT_MODEL_PATH`` so that
        a model change in that class propagates to the cache version.

        Note: the test imports the real ``services.intelligence.txtai_service``
        module (not the importlib-loaded stub) to read the class
        attribute, since the importlib-loaded ``semantic_cache``
        module has its own reference to the *real* TxtaiIntelligenceService
        via the importlib chain.
        """
        import sys
        spec = importlib.util.spec_from_file_location(
            "_sc_test_version_b", sem_cache_path
        )
        mod = importlib.util.module_from_spec(spec)
        sys.modules["_sc_test_version_b"] = mod
        spec.loader.exec_module(mod)
        cm = mod.SemanticCacheManager()
        v = cm._get_current_version()
        # The version string is ``"v1:model=<fingerprint>"``. We
        # assert that the format is correct and that the embedded
        # fingerprint is non-trivial (not the fallback ``"sif-default"``
        # which would only kick in if both ``_model_fingerprint`` and
        # the TxtaiIntelligenceService import failed).
        assert v.startswith("v1:model="), f"version should start with v1:model= prefix: {v}"
        fingerprint = v.split("=", 1)[1]
        assert fingerprint != "sif-default", (
            f"expected a real model fingerprint, got the fallback: {v}"
        )

    def test_version_change_invalidates_existing_entry(self):
        """An entry cached under version v1:model=A must be treated
        as invalid once the model switches to v1:model=B. This is
        the original bug: a hardcoded ``"v1.0.0"`` meant the version
        never changed."""
        import sys
        spec = importlib.util.spec_from_file_location(
            "_sc_test_version_c", sem_cache_path
        )
        mod = importlib.util.module_from_spec(spec)
        sys.modules["_sc_test_version_c"] = mod
        spec.loader.exec_module(mod)
        # Cache with fingerprint A
        cm_a = mod.SemanticCacheManager(model_fingerprint="model-A")
        entry_v1 = mod.CacheEntry(
            data={"x": 1},
            timestamp=mod.time.time(),
            ttl=3600,
            version=cm_a._get_current_version(),
            metadata={},
            access_count=1,
            last_accessed=mod.time.time(),
        )
        assert cm_a._is_entry_valid(entry_v1) is True
        # Simulate a model switch by validating the same entry
        # against a cache manager with fingerprint B
        cm_b = mod.SemanticCacheManager(model_fingerprint="model-B")
        assert cm_b._is_entry_valid(entry_v1) is False, (
            "entry created under model-A should be invalid when the "
            "active model is B"
        )


# --------------------------------------------------------------------------
# sif_errors docstring quality — every subclass is documented
# --------------------------------------------------------------------------
class TestSIFErrorDocstrings:
    """Every SIFError subclass should have a non-trivial docstring
    that describes when it is raised. This is a soft quality bar
    that catches future contributors who add a class without docs."""

    @pytest.mark.parametrize("class_name", [
        "SIFNotInitialized",
        "SIFIndexMissing",
        "SIFIndexCorrupted",
        "SIFSearchUnavailable",
        "SIFEmbeddingFailed",
        "SIFCacheError",
        "SIFContextMissing",
        "SIFAgentUnavailable",
    ])
    def test_subclass_docstring_present(self, sif_errors, class_name):
        cls = getattr(sif_errors, class_name)
        assert cls.__doc__, f"{class_name} has no docstring"
        assert len(cls.__doc__) > 50, (
            f"{class_name} docstring is too short: {cls.__doc__[:60]!r}"
        )

    def test_sif_error_base_docstring_present(self, sif_errors):
        assert sif_errors.SIFError.__doc__
        assert "SIFError" in sif_errors.SIFError.__doc__

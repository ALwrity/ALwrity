"""Phase 3.5: cluster() seed_terms parameter behavior tests.

Covers the new optional ``seed_terms`` argument on
``TxtaiIntelligenceService.cluster`` / ``_fallback_clustering``.

We avoid loading the real txtai library by mocking embeddings and
catching the resulting SIFNotInitialized at the cluster() boundary.
The test only validates that:
- The method signature accepts the new parameter without error.
- The internal ``_fallback_clustering`` path is invoked with the
  caller-provided seed_terms (we patch it to record the call).
- The default (None) preserves the historical behavior.
"""
import sys
import types
import importlib.util
from pathlib import Path

import pytest


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def _load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def txtai_module():
    """Load txtai_service as a module with a fake parent package.

    This avoids triggering the real ``services/__init__.py`` chain
    which imports the full SIF service stack (txtai, fastapi, etc.).
    """
    pkg_name = "_phase35_fake_pkg"
    if pkg_name not in sys.modules:
        pkg = types.ModuleType(pkg_name)
        pkg.__path__ = [str(BACKEND_DIR / "services" / "intelligence")]
        sys.modules[pkg_name] = pkg
    mod_name = f"{pkg_name}.txtai_service"
    spec = importlib.util.spec_from_file_location(
        mod_name, BACKEND_DIR / "services" / "intelligence" / "txtai_service.py",
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture()
def service(txtai_module):
    """Create a TxtaiIntelligenceService with init patched out."""
    svc = txtai_module.TxtaiIntelligenceService.__new__(
        txtai_module.TxtaiIntelligenceService,
        user_id="phase35_user",
    )
    svc.user_id = "phase35_user"
    svc._initialized = True
    svc.embeddings = None  # so cluster raises SIFNotInitialized via graph check
    return svc


def test_cluster_signature_accepts_seed_terms(txtai_module):
    """The cluster() method must accept seed_terms as a kwarg."""
    import inspect
    sig = inspect.signature(txtai_module.TxtaiIntelligenceService.cluster)
    assert "seed_terms" in sig.parameters
    # Default value should be None for backwards compat
    assert sig.parameters["seed_terms"].default is None


def test_fallback_clustering_signature_accepts_seed_terms(txtai_module):
    import inspect
    sig = inspect.signature(
        txtai_module.TxtaiIntelligenceService._fallback_clustering
    )
    assert "seed_terms" in sig.parameters
    assert sig.parameters["seed_terms"].default is None


def test_fallback_clustering_with_seed_terms_uses_them(txtai_module):
    """When seed_terms is provided, those terms appear in the queries."""
    import asyncio

    async def fake_search(self, query, limit=10):
        # Return empty results so the cluster loop exits cleanly.
        return []

    svc = txtai_module.TxtaiIntelligenceService.__new__(
        txtai_module.TxtaiIntelligenceService,
        user_id="phase35_user",
    )
    svc.user_id = "phase35_user"
    svc.search = types.MethodType(fake_search, svc)

    captured_queries = []

    async def record_search(self, query, limit=10):
        captured_queries.append(query)
        return []

    svc.search = types.MethodType(record_search, svc)

    async def run():
        result = await svc._fallback_clustering(
            min_score=0.5,
            seed_terms=["saas", "b2b", "developer tools"],
        )
        return result

    asyncio.run(run())
    # The first 3 queries should be the caller-provided seed terms.
    assert captured_queries[:3] == ["saas", "b2b", "developer tools"]
    # Then the historical defaults (capped at 5 total) fill the rest.
    assert len(captured_queries) == 5
    assert captured_queries[3] == "marketing"
    assert captured_queries[4] == "SEO"


def test_fallback_clustering_default_uses_historical_seeds(txtai_module):
    """When seed_terms is None or empty, the historical default list is used."""
    import asyncio

    captured_queries = []

    async def record_search(self, query, limit=10):
        captured_queries.append(query)
        return []

    svc = txtai_module.TxtaiIntelligenceService.__new__(
        txtai_module.TxtaiIntelligenceService,
        user_id="phase35_user",
    )
    svc.user_id = "phase35_user"
    svc.search = types.MethodType(record_search, svc)

    async def run_none():
        await svc._fallback_clustering(min_score=0.5, seed_terms=None)

    async def run_empty():
        await svc._fallback_clustering(min_score=0.5, seed_terms=[])

    asyncio.run(run_none())
    assert captured_queries == [
        "marketing", "SEO", "content", "social media", "email marketing",
    ]
    captured_queries.clear()
    asyncio.run(run_empty())
    assert captured_queries == [
        "marketing", "SEO", "content", "social media", "email marketing",
    ]


def test_fallback_clustering_caps_at_five(txtai_module):
    """seed_terms longer than 5 are truncated to 5."""
    import asyncio

    captured_queries = []

    async def record_search(self, query, limit=10):
        captured_queries.append(query)
        return []

    svc = txtai_module.TxtaiIntelligenceService.__new__(
        txtai_module.TxtaiIntelligenceService,
        user_id="phase35_user",
    )
    svc.user_id = "phase35_user"
    svc.search = types.MethodType(record_search, svc)

    long_seeds = [f"seed{i}" for i in range(10)]

    async def run():
        await svc._fallback_clustering(min_score=0.5, seed_terms=long_seeds)

    asyncio.run(run())
    assert len(captured_queries) == 5
    assert captured_queries == ["seed0", "seed1", "seed2", "seed3", "seed4"]

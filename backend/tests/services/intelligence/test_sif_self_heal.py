"""TDD tests for the SIF self-heal hook (Phase B).

``maybe_self_heal_index`` repairs an empty/thin SIF index from data that is
already local (flat-context documents + watermark-guarded website sync) so
agents stop producing generic proposals after a failed crawl.

Contract:
- Fires at most once per user per day (flat-file day-guard marker).
- Heal action 1: bootstrap-index the AgentFlatContextStore step 2-5
  documents into the SIF index (no external fetches needed).
- Heal action 2: ``sync_user_website_content`` (watermarked, only new or
  changed pages) when the user has a website URL.
- Emits a structured sif_event with outcome=healed and returns a summary.
- Never raises: heal failures degrade to a reported status.
"""
from pathlib import Path
import asyncio
import shutil

import pytest


def _cleanup_workspace(user_id: str, backend_root: Path) -> None:
    ws = backend_root / "workspace" / f"workspace_{user_id}"
    if ws.exists():
        shutil.rmtree(ws, ignore_errors=True)


@pytest.fixture()
def workspace_clean():
    import uuid

    from services.intelligence.agent_flat_context import AgentFlatContextStore

    backend_root = Path(__file__).resolve().parents[3]
    # Unique user per test: a leftover day-guard marker from a previous
    # test (rmtree can silently fail on locked files on Windows) must
    # never leak into the next test's heal decision.
    user_id = "pytest_selfheal_" + uuid.uuid4().hex[:8]
    _cleanup_workspace(user_id, backend_root)
    store = AgentFlatContextStore(user_id)
    try:
        yield backend_root, user_id, store
    finally:
        _cleanup_workspace(user_id, backend_root)


def _seed_flat_context(store):
    assert store.save_step2_website_analysis(
        {
            "website_url": "https://heal.example.com",
            "brand_analysis": {"brand_voice": "Bold"},
            "target_audience": {"industry_focus": "SaaS marketing"},
        }
    )
    assert store.save_step3_research_preferences(
        {
            "research_depth": "deep",
            "content_types": ["blog_post"],
            "competitors": ["jasper.example.com"],
        }
    )


@pytest.mark.asyncio
async def test_heal_bootstraps_flat_context_into_index(workspace_clean):
    backend_root, user_id, store = workspace_clean
    _seed_flat_context(store)

    from services.intelligence.sif_self_heal import maybe_self_heal_index

    indexed_items = []

    class _FakeIntelligence:
        async def index_content(self, items):
            indexed_items.extend(items)
            return len(items)

    class _FakeSIF:
        intelligence_service = _FakeIntelligence()

        async def sync_user_website_content(self, *args, **kwargs):
            return {"count": 0, "new": 0}

    _FakeSIF.user_id = user_id

    result = await maybe_self_heal_index(_FakeSIF(), trigger="test")

    assert result["healed"] is True
    assert result["bootstrap_indexed"] > 0, "flat-context docs must be indexed"
    assert indexed_items, "index_content must receive bootstrap items"
    types = {item[2].get("type") for item in indexed_items}
    assert "onboarding_context" in types, f"bootstrap items must be typed: {types}"


@pytest.mark.asyncio
async def test_heal_day_guard_blocks_second_call_same_day(workspace_clean):
    backend_root, user_id, store = workspace_clean
    _seed_flat_context(store)

    from services.intelligence.sif_self_heal import maybe_self_heal_index

    calls = {"index": 0}

    class _FakeIntelligence:
        async def index_content(self, items):
            calls["index"] += 1
            return len(items)

    class _FakeSIF:
        intelligence_service = _FakeIntelligence()

        async def sync_user_website_content(self, *args, **kwargs):
            return {"count": 0, "new": 0}

    _FakeSIF.user_id = user_id

    first = await maybe_self_heal_index(_FakeSIF(), trigger="test")
    second = await maybe_self_heal_index(_FakeSIF(), trigger="test")

    assert first["healed"] is True
    assert second["healed"] is False
    assert second["reason"] == "already_healed_today"
    assert calls["index"] == 1, "index_content must run only once per day"


@pytest.mark.asyncio
async def test_heal_runs_website_sync_when_url_known(workspace_clean):
    backend_root, user_id, store = workspace_clean
    _seed_flat_context(store)

    from services.intelligence.sif_self_heal import maybe_self_heal_index

    sync_calls = []

    class _FakeIntelligence:
        async def index_content(self, items):
            return len(items)

    class _FakeSIF:
        intelligence_service = _FakeIntelligence()

        async def sync_user_website_content(self, website_url, **kwargs):
            sync_calls.append(website_url)
            return {"count": 3, "new": 3}

    _FakeSIF.user_id = user_id

    result = await maybe_self_heal_index(_FakeSIF(), trigger="test")

    assert result["healed"] is True
    assert sync_calls == ["https://heal.example.com"], f"website sync not called with the right URL: {sync_calls}"
    assert result["website_sync_new"] == 3


@pytest.mark.asyncio
async def test_heal_failure_never_raises(workspace_clean):
    backend_root, user_id, store = workspace_clean
    _seed_flat_context(store)

    from services.intelligence.sif_self_heal import maybe_self_heal_index

    class _BoomIntelligence:
        async def index_content(self, items):
            raise RuntimeError("index down")

    class _FakeSIF:
        intelligence_service = _BoomIntelligence()

        async def sync_user_website_content(self, *args, **kwargs):
            raise RuntimeError("sync down")

    _FakeSIF.user_id = user_id

    result = await maybe_self_heal_index(_FakeSIF(), trigger="test")

    assert result["healed"] is False
    assert result.get("errors"), "heal failures must be reported, not raised"


@pytest.mark.asyncio
async def test_heal_skips_when_index_already_healthy(workspace_clean):
    """An index with content does not need healing — the hook must be a
    no-op so healthy users never pay the heal cost."""
    backend_root, user_id, store = workspace_clean
    _seed_flat_context(store)

    from services.intelligence.sif_self_heal import maybe_self_heal_index

    calls = {"index": 0}

    class _FakeIntelligence:
        count = 42

        def count_index_items(self):
            return self.count

        async def index_content(self, items):
            calls["index"] += 1
            return len(items)

    class _FakeSIF:
        intelligence_service = _FakeIntelligence()

        async def sync_user_website_content(self, *args, **kwargs):
            return {"count": 0, "new": 0}

    _FakeSIF.user_id = user_id

    result = await maybe_self_heal_index(_FakeSIF(), trigger="test", min_index_items=10)

    assert result["healed"] is False
    assert result["reason"] == "index_healthy"
    assert calls["index"] == 0


# ============================================================
# B2: central sif_search hook on BaseALwrityAgent
# ============================================================

def _make_hook_agent(user_id):
    from services.intelligence.agents.core_agent_framework import BaseALwrityAgent

    class _ConcreteAgent(BaseALwrityAgent):
        def _create_txtai_agent(self):
            return None

    agent = _ConcreteAgent.__new__(_ConcreteAgent)
    agent.user_id = user_id
    agent.agent_type = "content_strategist"
    return agent


@pytest.mark.asyncio
async def test_sif_search_returns_results_without_heal(workspace_clean):
    backend_root, user_id, store = workspace_clean
    agent = _make_hook_agent(user_id)

    class _Intel:
        async def search(self, query, limit=5):
            return [{"id": "doc-1", "score": 0.9}]

    agent.intelligence = _Intel()

    results = await agent.sif_search("anything", limit=5)
    assert results and results[0]["id"] == "doc-1"


@pytest.mark.asyncio
async def test_sif_search_heals_on_miss_in_background(workspace_clean, monkeypatch):
    """On a miss, the self-heal fires as a fire-and-forget background task.
    The search returns honest absence; the heal runs for the NEXT run."""
    backend_root, user_id, store = workspace_clean
    agent = _make_hook_agent(user_id)

    search_state = {"count": 0}

    class _Intel:
        async def search(self, query, limit=5):
            search_state["count"] += 1
            return []

    agent.intelligence = _Intel()

    async def _fake_heal(sif_service, **kwargs):
        return {"healed": True, "bootstrap_indexed": 2}

    import services.intelligence.agents.core_agent_framework as caf

    monkeypatch.setattr(caf, "_maybe_self_heal_index_impl", _fake_heal, raising=False)

    results = await agent.sif_search("anything", limit=5)
    assert results == []
    assert search_state["count"] == 1, "search runs exactly once (no retry)"


@pytest.mark.asyncio
async def test_sif_search_does_not_record_heal_when_not_healed(workspace_clean, monkeypatch):
    backend_root, user_id, store = workspace_clean
    agent = _make_hook_agent(user_id)

    class _Intel:
        async def search(self, query, limit=5):
            return []

    agent.intelligence = _Intel()

    async def _no_heal(sif_service, **kwargs):
        return {"healed": False, "reason": "already_healed_today"}

    import services.intelligence.agents.core_agent_framework as caf

    monkeypatch.setattr(caf, "_maybe_self_heal_index_impl", _no_heal, raising=False)

    results = await agent.sif_search("anything", limit=5)
    assert results == []
    assert getattr(agent, "last_sif_heal", None) is None


@pytest.mark.asyncio
async def test_sif_search_records_query_provenance(workspace_clean, monkeypatch):
    """Phase 1 transparency: each sif_search records the composed query,
    limit, result count and outcome on the agent (last_sif_queries) so the
    plan can show what was searched and what came back."""
    backend_root, user_id, store = workspace_clean
    agent = _make_hook_agent(user_id)

    class _Intel:
        async def search(self, query, limit=5):
            return [{"id": "doc-1", "score": 0.9}]

    agent.intelligence = _Intel()

    results = await agent.sif_search("brand voice content pillars", limit=7, trigger="test")
    assert results and results[0]["id"] == "doc-1"

    queries = getattr(agent, "last_sif_queries", None)
    assert isinstance(queries, list) and queries, "query provenance not recorded"
    entry = queries[-1]
    assert entry["query"] == "brand voice content pillars"
    assert entry["limit"] == 7
    assert entry["result_count"] == 1
    assert entry["outcome"] == "success"
    assert entry["trigger"] == "test"
    assert "timestamp" in entry


@pytest.mark.asyncio
async def test_sif_search_provenance_records_miss(workspace_clean, monkeypatch):
    """A miss records outcome='miss' (the heal is fire-and-forget, so the
    provenance captures the honest miss without waiting for the heal)."""
    backend_root, user_id, store = workspace_clean
    agent = _make_hook_agent(user_id)

    class _Intel:
        async def search(self, query, limit=5):
            return []

    agent.intelligence = _Intel()

    async def _fake_heal(sif_service, **kwargs):
        return {"healed": True, "bootstrap_indexed": 4}

    import services.intelligence.agents.core_agent_framework as caf

    monkeypatch.setattr(caf, "_maybe_self_heal_index_impl", _fake_heal, raising=False)

    results = await agent.sif_search("thin query", limit=5, trigger="proposal")
    assert results == []

    queries = agent.last_sif_queries
    assert queries[-1]["outcome"] == "miss"


@pytest.mark.asyncio
async def test_sif_search_provenance_failure_outcome(workspace_clean):
    backend_root, user_id, store = workspace_clean
    agent = _make_hook_agent(user_id)

    class _Boom:
        async def search(self, query, limit=5):
            raise RuntimeError("down")

    agent.intelligence = _Boom()

    results = await agent.sif_search("q", limit=5)
    assert results == []
    assert agent.last_sif_queries[-1]["outcome"] == "error"


@pytest.mark.asyncio
async def test_sif_search_never_raises_on_total_failure(workspace_clean, monkeypatch):
    backend_root, user_id, store = workspace_clean
    agent = _make_hook_agent(user_id)

    class _Boom:
        async def search(self, query, limit=5):
            raise RuntimeError("index down")

    agent.intelligence = _Boom()

    async def _boom_heal(sif_service, **kwargs):
        raise RuntimeError("heal down")

    import services.intelligence.agents.core_agent_framework as caf

    monkeypatch.setattr(caf, "_maybe_self_heal_index_impl", _boom_heal, raising=False)

    results = await agent.sif_search("anything", limit=5)
    assert results == []


# ============================================================
# Phase 3a: non-blocking self-heal
# ============================================================

@pytest.mark.asyncio
async def test_sif_search_does_not_block_on_self_heal(workspace_clean, monkeypatch):
    """Phase 3a: when sif_search triggers a self-heal, it must NOT wait for
    the heal to complete. The agent proceeds with honest absence and the
    heal runs in the background for the NEXT run."""
    import time

    backend_root, user_id, store = workspace_clean
    agent = _make_hook_agent(user_id)

    heal_started = asyncio.Event()

    class _Intel:
        async def search(self, query, limit=5):
            return []

    agent.intelligence = _Intel()

    async def _slow_heal(sif_service, **kwargs):
        heal_started.set()
        await asyncio.sleep(30)  # would block for 30s if awaited
        return {"healed": True, "bootstrap_indexed": 5}

    import services.intelligence.agents.core_agent_framework as caf
    monkeypatch.setattr(caf, "_maybe_self_heal_index_impl", _slow_heal, raising=False)

    start = time.monotonic()
    results = await agent.sif_search("anything", limit=5)
    # yield to the event loop so the background heal task can start
    await asyncio.sleep(0)
    elapsed = time.monotonic() - start

    assert results == [], "no results available (honest absence)"
    assert elapsed < 1.0, (
        f"sif_search took {elapsed:.1f}s — it must not block on the heal"
    )
    assert heal_started.is_set(), "self-heal must have been triggered"


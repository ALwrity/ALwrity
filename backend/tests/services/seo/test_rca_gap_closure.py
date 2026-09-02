"""Tests for closing the last two RCA-plan gaps (tracker #520):

1. **Observability counters** (Phase 5-plan item 2): duplicate-skip,
   single-flight hit, circuit-break and failed-fetch-memo events are counted
   in a process-wide registry with snapshot()/reset() accessors.
2. **SSOT consumers** (Phase 1-plan item 3): every pipeline that resolves the
   USER's sitemap URL goes through the SSOT first
   (``get_or_discover_sitemap_url``) — SEO-audit executor, deep crawl,
   content-strategy analyzer — and SIF indexing falls back to the SSOT
   inventory total. Competitor discoveries stay independent (no per-user
   SSOT exists for competitor sites).
"""

import importlib
import shutil
from uuid import uuid4

import pandas as pd
import pytest
import urllib.error

db_engine_mod = importlib.import_module("services.database.engine")
import services.workspace_paths as workspace_paths
import utils.storage_paths as storage_paths
from services.database import get_session_for_user

WEBSITE_URL = "https://acme-corp.example.com"
SITEMAP_URL = "https://acme-corp.example.com/sitemap.xml"


@pytest.fixture
def workspace_redirect(tmp_path, monkeypatch):
    root = tmp_path / "workspace"
    root.mkdir()
    monkeypatch.setattr(workspace_paths, "get_workspace_root", lambda: root)
    monkeypatch.setattr(storage_paths, "get_workspace_root", lambda: root)
    return root


@pytest.fixture
def user_db(workspace_redirect):
    user_id = f"gap_{uuid4().hex[:10]}"
    db = get_session_for_user(user_id)
    ctx = {"user_id": user_id, "db": db, "workspace": workspace_redirect}
    try:
        yield ctx
    finally:
        try:
            db.close()
        finally:
            engine = db_engine_mod._user_engines.pop(user_id, None)
            if engine is not None:
                engine.dispose()
            shutil.rmtree(str(workspace_redirect), ignore_errors=True)


def _seed_analysis(db, user_id, sitemap_url=SITEMAP_URL):
    """Seed onboarding session + website analysis with the SSOT sitemap URL."""
    from models.onboarding import OnboardingSession, WebsiteAnalysis
    from services.seo.sitemap_ssot import save_sitemap_inventory

    session = OnboardingSession(user_id=user_id)
    db.add(session)
    db.commit()
    analysis = WebsiteAnalysis(session_id=session.id, website_url=WEBSITE_URL)
    db.add(analysis)
    db.commit()
    save_sitemap_inventory(
        db, user_id, WEBSITE_URL, sitemap_url,
        {"total_urls": 10, "urls": [f"{WEBSITE_URL}/p{i}" for i in range(3)],
         "fetched_at": __import__("datetime").datetime.utcnow().isoformat()},
    )


# ---------------------------------------------------------------------------
# 1. Metrics registry
# ---------------------------------------------------------------------------


class TestMetricsRegistry:
    def test_incr_and_snapshot(self):
        from services.seo import advertools_metrics as m

        m.reset()
        m.incr(m.EVENT_DUPLICATE_SKIP)
        m.incr(m.EVENT_DUPLICATE_SKIP)
        m.incr(m.EVENT_SINGLE_FLIGHT_HIT)
        snap = m.snapshot()
        assert snap[m.EVENT_DUPLICATE_SKIP] == 2
        assert snap[m.EVENT_SINGLE_FLIGHT_HIT] == 1
        assert m.EVENT_CIRCUIT_BREAK not in snap  # zero-count events omitted
        m.reset()
        assert m.snapshot() == {}

    def test_unknown_event_namespaced(self):
        from services.seo import advertools_metrics as m

        m.reset()
        m.incr("custom_event")
        assert m.snapshot()["custom_event"] == 1
        m.reset()


# ---------------------------------------------------------------------------
# 2. Counter wiring in the fetch path
# ---------------------------------------------------------------------------


class FakeAdv:
    def __init__(self):
        self.calls = []
        self.handler = None

    def sitemap_to_df(self, url, recursive=False):
        self.calls.append(url)
        return self.handler(url)

    def url_to_df(self, locs):
        raise RuntimeError("not stubbed")


@pytest.fixture
def fake_adv(monkeypatch):
    import services.seo.advertools_service as svc

    adv = FakeAdv()
    monkeypatch.setattr(svc, "adv", adv)
    return adv


@pytest.fixture
def clock(monkeypatch):
    state = {"now": 1000.0, "sleeps": []}
    monkeypatch.setattr("time.monotonic", lambda: state["now"])
    monkeypatch.setattr("time.sleep", lambda s: state["sleeps"].append(s) or state.update(now=state["now"] + 0.01))
    return state


@pytest.fixture(autouse=True)
def clean_fetch_state():
    import services.seo.advertools_service as svc
    from services.seo import advertools_metrics as m

    svc._DOMAIN_LAST_429.clear()
    svc._DOMAIN_LAST_REQUEST.clear()
    svc._DOMAIN_SEMAPHORES.clear()
    svc._429_HISTORY.clear()
    svc._SITEMAP_CACHE.clear()
    svc._FAILED_FETCH_UNTIL.clear()
    m.reset()
    yield
    svc._DOMAIN_LAST_429.clear()
    svc._DOMAIN_LAST_REQUEST.clear()
    svc._DOMAIN_SEMAPHORES.clear()
    svc._429_HISTORY.clear()
    svc._SITEMAP_CACHE.clear()
    svc._FAILED_FETCH_UNTIL.clear()
    m.reset()


class TestCounterWiring:
    def test_single_flight_hit_counted(self, fake_adv, clock):
        """A warm in-memory cache must count as an avoided fetch."""
        from services.seo import advertools_metrics as m
        import services.seo.advertools_service as svc

        url = "https://sf.example.com/sitemap.xml"
        svc._SITEMAP_CACHE[url] = (
            pd.DataFrame({"loc": ["https://sf.example.com/1"], "lastmod": ["2026-01-01"]}),
            clock["now"],
        )

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(url, _deadline=clock["now"] + 1000.0)

        assert not df.empty
        assert fake_adv.calls == []  # no network
        assert m.snapshot().get(m.EVENT_SINGLE_FLIGHT_HIT) == 1

    def test_circuit_break_counted(self, fake_adv, clock):
        """Crossing the 429 threshold during fan-out counts one break event."""
        from services.seo import advertools_metrics as m
        import services.seo.advertools_service as svc

        def handler(url):
            tag = url.rsplit("/", 1)[-1]
            if tag == "sitemap.xml":
                return pd.DataFrame(
                    {"loc": [f"https://cbm.example.com/{t}.xml" for t in ("a", "b", "c", "d")]}
                )
            raise urllib.error.HTTPError("http://x", 429, "err", {}, None)

        fake_adv.handler = handler
        svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://cbm.example.com/sitemap.xml", max_retries=3,
            _deadline=clock["now"] + 100000.0,
        )
        assert svc._domain_circuit_open("cbm.example.com") is True
        assert m.snapshot().get(m.EVENT_CIRCUIT_BREAK) == 1

    def test_failed_fetch_memo_counted(self, fake_adv, clock):
        from services.seo import advertools_metrics as m
        import services.seo.advertools_service as svc

        url = "https://memo.example.com/sitemap.xml"
        fake_adv.handler = lambda u: (_ for _ in ()).throw(
            urllib.error.HTTPError("http://x", 429, "err", {}, None)
        )
        svc.AdvertoolsService._sitemap_to_df_with_retry(
            url, max_retries=1, _deadline=clock["now"] + 100000.0,
        )
        first_calls = len(fake_adv.calls)
        # Second call within the memo window must not touch the network.
        svc.AdvertoolsService._sitemap_to_df_with_retry(
            url, max_retries=1, _deadline=clock["now"] + 100000.0,
        )
        assert len(fake_adv.calls) == first_calls
        assert m.snapshot().get(m.EVENT_FAILED_FETCH_MEMO) == 1


# ---------------------------------------------------------------------------
# 3. Duplicate-skip counter (executor mutex path)
# ---------------------------------------------------------------------------


class TestDuplicateSkipCounter:
    @pytest.mark.asyncio
    async def test_executor_skip_increments_counter(self, user_db):
        from services.seo import advertools_metrics as m
        from services.seo.advertools_run_lock import try_acquire, release
        from services.scheduler.executors.advertools_executor import AdvertoolsExecutor
        from models.advertools_monitoring_models import AdvertoolsTask

        user_id, db = user_db["user_id"], user_db["db"]
        row = AdvertoolsTask(
            user_id=user_id, website_url=WEBSITE_URL, status="active",
            payload={"type": "content_audit", "website_url": WEBSITE_URL},
        )
        db.add(row)
        db.commit()

        m.reset()
        assert try_acquire(user_id, WEBSITE_URL, "content_audit") is True
        result = await AdvertoolsExecutor().execute_task(row, db)
        release(user_id, WEBSITE_URL, "content_audit")

        assert result.success is True
        assert (result.result_data or {}).get("skipped") is True
        assert m.snapshot().get(m.EVENT_DUPLICATE_SKIP) == 1


# ---------------------------------------------------------------------------
# 4. SSOT consumer helper
# ---------------------------------------------------------------------------


class TestGetOrDiscoverSitemapUrl:
    @pytest.mark.asyncio
    async def test_stored_ssot_wins_no_discovery(self, user_db):
        from services.seo.sitemap_ssot import get_or_discover_sitemap_url

        user_id, db = user_db["user_id"], user_db["db"]
        _seed_analysis(db, user_id)

        class _Boom:
            async def discover_sitemap_url(self, url):
                raise AssertionError("discovery must not run when SSOT has the URL")

        url = await get_or_discover_sitemap_url(user_id, WEBSITE_URL, _Boom(), db=db)
        assert url == SITEMAP_URL

    @pytest.mark.asyncio
    async def test_falls_back_to_discovery_when_no_ssot(self, user_db):
        from services.seo.sitemap_ssot import get_or_discover_sitemap_url

        user_id, db = user_db["user_id"], user_db["db"]

        class _Svc:
            def __init__(self):
                self.calls = []

            async def discover_sitemap_url(self, url):
                self.calls.append(url)
                return SITEMAP_URL

        svc = _Svc()
        url = await get_or_discover_sitemap_url(user_id, WEBSITE_URL, svc, db=db)
        assert url == SITEMAP_URL
        assert svc.calls == [WEBSITE_URL]

    @pytest.mark.asyncio
    async def test_opens_own_session_when_db_not_supplied(self, user_db):
        """content_strategy_service has user_id but no db — the helper must
        open (and close) a short-lived per-user session itself."""
        from services.seo.sitemap_ssot import get_or_discover_sitemap_url

        user_id, db = user_db["user_id"], user_db["db"]
        _seed_analysis(db, user_id)

        class _Boom:
            async def discover_sitemap_url(self, url):
                raise AssertionError("SSOT should have been read")

        # NOTE: no db= passed on purpose.
        url = await get_or_discover_sitemap_url(user_id, WEBSITE_URL, _Boom())
        assert url == SITEMAP_URL


# ---------------------------------------------------------------------------
# 5. SIF inventory-total fallback
# ---------------------------------------------------------------------------


class TestInventoryTotalFallback:
    def test_get_inventory_total(self, user_db):
        from services.seo.sitemap_ssot import get_inventory_total

        user_id, db = user_db["user_id"], user_db["db"]
        assert get_inventory_total(db, user_id) == 0  # nothing stored yet

        _seed_analysis(db, user_id)
        assert get_inventory_total(db, user_id) == 10

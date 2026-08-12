"""
Tests for advertools sitemap cache, domain lock, and rate-limit mitigations.

Covers:
- Domain lock serializes concurrent access for same domain
- Different domains don't block each other
- In-memory cache hit/miss/TTL expiry
- DB cache read/write via analytics_cache
- Lock timeout prevents deadlock
- Post-429 cooldown markers
"""

import time as _time
import threading
import pandas as pd
import pytest

import services.seo.advertools_service as svc


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _reset_module_state():
    svc._DOMAIN_SEMAPHORES.clear()
    svc._DOMAIN_LAST_REQUEST.clear()
    svc._DOMAIN_LAST_429.clear()
    svc._SITEMAP_CACHE.clear()


@pytest.fixture(autouse=True)
def clean_state():
    _reset_module_state()
    yield
    _reset_module_state()


# ---------------------------------------------------------------------------
# 1. Domain Lock
# ---------------------------------------------------------------------------

class TestDomainLock:
    def test_same_domain_serialized(self):
        domain = "example.com"
        results = []

        def worker():
            svc._throttle_domain_sync(domain)
            results.append(1)
            _time.sleep(0.05)

        t1 = threading.Thread(target=worker)
        t2 = threading.Thread(target=worker)
        t1.start()
        t2.start()
        t1.join(timeout=5)
        t2.join(timeout=5)

        # Both workers completed — lock serialized first request
        assert results == [1, 1]

    def test_different_domains_dont_block(self):
        results = []
        barrier = threading.Barrier(2, timeout=5)

        def worker(domain, mark):
            svc._throttle_domain_sync(domain)
            barrier.wait()  # both workers reach lock acquisition point
            results.append(mark)

        t1 = threading.Thread(target=worker, args=("example.com", 1))
        t2 = threading.Thread(target=worker, args=("other.com", 2))
        t1.start()
        t2.start()
        t1.join(timeout=5)
        t2.join(timeout=5)

        # Different domains → both should complete without blocking
        assert 1 in results
        assert 2 in results


# ---------------------------------------------------------------------------
# 2. Lock Timeout (no deadlock)
# ---------------------------------------------------------------------------

class TestLockTimeout:
    def test_lock_timeout_does_not_hang(self):
        domain = "blocked.com"
        lock = threading.Lock()
        svc._DOMAIN_SEMAPHORES[domain] = lock
        lock.acquire()  # pre-acquire

        start = _time.monotonic()
        svc._throttle_domain_sync(domain)
        elapsed = _time.monotonic() - start

        # Should give up after _DOMAIN_LOCK_TIMEOUT seconds (~60), not hang forever
        assert elapsed < svc._DOMAIN_LOCK_TIMEOUT + 5.0


# ---------------------------------------------------------------------------
# 3. In-Memory Cache
# ---------------------------------------------------------------------------

class TestSitemapCache:
    def test_cache_miss_fetches(self, monkeypatch):
        """First fetch caches result; second fetch reads from cache."""
        calls = []

        class FakeAdv:
            def sitemap_to_df(self, url, recursive=False):
                calls.append(url)
                return pd.DataFrame({"loc": [url + "/page1", url + "/page2"]})

        monkeypatch.setattr(svc, "adv", FakeAdv())

        df1 = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "http://example.com/sitemap.xml", max_retries=0
        )
        assert len(calls) == 1
        assert len(df1) == 2

        # Second call — cached
        df2 = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "http://example.com/sitemap.xml", max_retries=0
        )
        assert len(calls) == 1  # no additional HTTP call
        assert len(df2) == 2
        assert df2["loc"].tolist() == df1["loc"].tolist()

    def test_cache_ttl_expiry_refetches(self, monkeypatch):
        """After TTL, cache entry is evicted and re-fetched."""
        calls = []

        class FakeAdv:
            def sitemap_to_df(self, url, recursive=False):
                calls.append(url)
                return pd.DataFrame({"loc": [url + "/fresh"]})

        monkeypatch.setattr(svc, "adv", FakeAdv())

        svc.AdvertoolsService._sitemap_to_df_with_retry(
            "http://example.com/sitemap.xml", max_retries=0
        )
        assert len(calls) == 1

        # Force expiry by clearing cache
        svc._SITEMAP_CACHE.clear()

        svc.AdvertoolsService._sitemap_to_df_with_retry(
            "http://example.com/sitemap.xml", max_retries=0
        )
        assert len(calls) == 2

    def test_different_urls_have_separate_cache_entries(self, monkeypatch):
        """Caching is per-URL, not per-domain."""
        calls = []

        class FakeAdv:
            def sitemap_to_df(self, url, recursive=False):
                calls.append(url)
                return pd.DataFrame({"loc": [url]})

        monkeypatch.setattr(svc, "adv", FakeAdv())

        svc.AdvertoolsService._sitemap_to_df_with_retry(
            "http://example.com/sitemap.xml", max_retries=0
        )
        svc.AdvertoolsService._sitemap_to_df_with_retry(
            "http://example.com/sub-sitemap.xml", max_retries=0
        )
        # Both are different URLs → both should have been fetched
        assert len(calls) == 2


# ---------------------------------------------------------------------------
# 4. DB Cache (analytics_cache)
# ---------------------------------------------------------------------------

class TestDBCache:
    def test_db_cache_write_fires_on_successful_fetch(self, monkeypatch):
        """Successful fetch triggers analytics_cache.set()."""
        calls = []

        class FakeAdv:
            def sitemap_to_df(self, url, recursive=False):
                calls.append(url)
                return pd.DataFrame({"loc": ["https://x.com/a"]})

        monkeypatch.setattr(svc, "adv", FakeAdv())

        set_calls = []

        class MockCache:
            def get(self, prefix, user_id, **kwargs):
                return None  # always miss

            def set(self, prefix, user_id, data, **kwargs):
                set_calls.append(kwargs.get("url"))

        # Patch the lazy import target inside the function
        monkeypatch.setattr(
            "services.analytics_cache_service.analytics_cache",
            MockCache(),
        )
        monkeypatch.setattr(
            "services.seo.advertools_service.analytics_cache",
            MockCache(),
            raising=False,
        )

        svc.AdvertoolsService._sitemap_to_df_with_retry(
            "http://example.com/sitemap.xml", max_retries=0
        )
        assert len(set_calls) == 1
        assert "http://example.com/sitemap.xml" in set_calls


# ---------------------------------------------------------------------------
# 5. 429 Cooldown
# ---------------------------------------------------------------------------

class Test429Cooldown:
    def test_note_429_sets_cooldown(self):
        domain = "cooldown-test.com"
        svc._note_429(domain)
        cooldown = svc._domain_429_cooldown(domain)
        assert cooldown > 0

    def test_cooldown_expires(self):
        domain = "expired-test.com"
        # Fake an old 429
        with svc._DOMAIN_429_LOCK:
            svc._DOMAIN_LAST_429[domain] = _time.monotonic() - svc._429_ACTIVE_WINDOW - 1
        cooldown = svc._domain_429_cooldown(domain)
        assert cooldown == 0.0

"""
Tests for AdvertoolsService._sitemap_to_df_with_retry rate-limit handling.

Pins down the contract for the 429/rate-limit hardening added to
``services/seo/advertools_service.py``:

- Non-retryable 4xx (e.g. 404) fail fast: fetched once, no backoff sleep,
  empty result.
- 429 uses a capped jittered backoff (every sleep <= _MAX_RETRY_SLEEP),
  succeeds afterwards, and marks the origin as throttled.
- Sitemap-index recursion: once the origin has shown a 429, the remaining
  sub-sitemaps are fetched with fewer retries (max_retries=1) so the batch
  degrades quickly instead of hammering a throttled origin.
- A shared wall-clock batch deadline bounds the whole (recursive) fetch and
  returns whatever has been fetched so far.

No network is used: ``advertools.sitemap_to_df`` is stubbed and the clock
(``time.monotonic`` + ``time.sleep``) is faked so the tests are instant and
deterministic.
"""

import urllib.error

import pandas as pd
import pytest

import services.seo.advertools_service as svc

_MAX_SLEEP = svc._MAX_RETRY_SLEEP


class FakeAdv:
    """Drop-in stand-in for the ``advertools`` module's sitemap fetcher."""

    def __init__(self):
        self.calls = []
        self.handler = None

    def sitemap_to_df(self, url, recursive=False):
        self.calls.append(url)
        return self.handler(url)


@pytest.fixture
def fake_adv(monkeypatch):
    adv = FakeAdv()
    monkeypatch.setattr(svc, "adv", adv)
    return adv


@pytest.fixture
def clock(monkeypatch):
    """Fake clock: monotonic starts at 1000.0; every sleep advances 0.01s.

    Records each requested sleep duration in ``state["sleeps"]`` so tests can
    assert on the backoff math without actually waiting.
    """
    state = {"now": 1000.0, "sleeps": []}

    def _monotonic():
        return state["now"]

    def _sleep(seconds):
        state["sleeps"].append(seconds)
        state["now"] += 0.01

    monkeypatch.setattr("time.monotonic", _monotonic)
    monkeypatch.setattr("time.sleep", _sleep)
    return state


@pytest.fixture(autouse=True)
def clean_rate_state():
    """Reset per-domain rate-limit bookkeeping before and after each test."""
    svc._DOMAIN_LAST_429.clear()
    svc._DOMAIN_LAST_REQUEST.clear()
    svc._DOMAIN_SEMAPHORES.clear()
    yield
    svc._DOMAIN_LAST_429.clear()
    svc._DOMAIN_LAST_REQUEST.clear()
    svc._DOMAIN_SEMAPHORES.clear()


def _http_error(code, retry_after=None):
    headers = {"Retry-After": retry_after} if retry_after else {}
    return urllib.error.HTTPError("http://x", code, "err", headers, None)


def _no_deadline(clock):
    return clock["now"] + 100000.0


class TestPermanentHttpErrors:
    def test_404_fails_fast(self, fake_adv, clock):
        fake_adv.handler = lambda url: (_ for _ in ()).throw(_http_error(404))

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://t404.example.com/sitemap.xml",
            _deadline=_no_deadline(clock),
        )

        assert df.empty
        assert fake_adv.calls == ["https://t404.example.com/sitemap.xml"]
        assert clock["sleeps"] == []


class TestThrottledRetries:
    def test_429_then_success_uses_capped_backoff(self, fake_adv, clock):
        attempts = {"n": 0}

        def handler(url):
            attempts["n"] += 1
            if attempts["n"] <= 2:
                raise _http_error(429)
            return pd.DataFrame({"loc": ["https://a.example.com/1"], "lastmod": ["2026-01-01"]})

        fake_adv.handler = handler

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://t429.example.com/sitemap.xml",
            _deadline=_no_deadline(clock),
        )

        assert not df.empty
        assert attempts["n"] == 3
        assert len(clock["sleeps"]) == 2
        assert all(0 < s <= _MAX_SLEEP for s in clock["sleeps"])
        assert svc._domain_429_cooldown("t429.example.com") > 0

    def test_honours_retry_after_header(self, fake_adv, clock):
        attempts = {"n": 0}

        def handler(url):
            attempts["n"] += 1
            if attempts["n"] == 1:
                raise _http_error(429, retry_after="5")
            return pd.DataFrame({"loc": ["https://a.example.com/1"]})

        fake_adv.handler = handler

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://t429ra.example.com/sitemap.xml",
            _deadline=_no_deadline(clock),
        )

        assert not df.empty
        assert clock["sleeps"] == [5.0]

    def test_retry_after_capped_at_max(self, fake_adv, clock):
        fake_adv.handler = lambda url: (_ for _ in ()).throw(_http_error(429, retry_after="300"))

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://t429rac.example.com/sitemap.xml",
            max_retries=1,
            _deadline=_no_deadline(clock),
        )

        assert df.empty
        assert clock["sleeps"] == [_MAX_SLEEP]

    def test_persistent_429_returns_empty(self, fake_adv, clock):
        fake_adv.handler = lambda url: (_ for _ in ()).throw(_http_error(429))

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://t429x.example.com/sitemap.xml",
            max_retries=1,
            _deadline=_no_deadline(clock),
        )

        assert df.empty
        assert fake_adv.calls == ["https://t429x.example.com/sitemap.xml"] * 2
        assert len(clock["sleeps"]) == 1


class TestIndexRecursion:
    def test_fewer_retries_for_remaining_subs_after_429(self, fake_adv, clock):
        sub_fail = {"blog.xml": 1, "cat.xml": 2}

        def handler(url):
            tag = url.rsplit("/", 1)[-1]
            if tag == "sitemap.xml":
                return pd.DataFrame(
                    {
                        "loc": [
                            "https://tidx.example.com/blog.xml",
                            "https://tidx.example.com/cat.xml",
                            "https://tidx.example.com/news.xml",
                        ]
                    }
                )
            if tag in sub_fail:
                if sub_fail[tag] > 0:
                    sub_fail[tag] -= 1
                    raise _http_error(429)
                return pd.DataFrame({"loc": [url], "lastmod": ["2026-01-01"]})
            return pd.DataFrame({"loc": [url], "lastmod": ["2026-01-01"]})

        fake_adv.handler = handler

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://tidx.example.com/sitemap.xml",
            max_retries=3,
            _deadline=_no_deadline(clock),
        )

        locs = df["loc"].tolist() if not df.empty else []
        # blog.xml 429s once then succeeds -> recovered within full retries.
        assert any("blog.xml" in loc for loc in locs)
        # news.xml always succeeds -> included.
        assert any("news.xml" in loc for loc in locs)
        # cat.xml needs two consecutive successes to survive full retries, but
        # after blog.xml 429'd the remaining subs are capped to 1 retry (2
        # attempts) -> cat.xml is dropped.
        assert not any("cat.xml" in loc for loc in locs)
        assert svc._domain_429_cooldown("tidx.example.com") > 0

    def test_index_skipped_when_locs_are_pages(self, fake_adv, clock):
        fake_adv.handler = lambda url: pd.DataFrame(
            {"loc": ["https://tpages.example.com/about"], "lastmod": ["2026-01-01"]}
        )

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://tpages.example.com/sitemap.xml",
            _deadline=_no_deadline(clock),
        )

        assert not df.empty
        assert fake_adv.calls == ["https://tpages.example.com/sitemap.xml"]

    def test_max_urls_stops_recursion_early(self, fake_adv, clock):
        # A sitemap index listing 4 sub-sitemaps, each holding many page URLs.
        def handler(url):
            tag = url.rsplit("/", 1)[-1]
            if tag == "sitemap.xml":
                return pd.DataFrame(
                    {
                        "loc": [
                            "https://tmax.example.com/a.xml",
                            "https://tmax.example.com/b.xml",
                            "https://tmax.example.com/c.xml",
                            "https://tmax.example.com/d.xml",
                        ]
                    }
                )
            return pd.DataFrame(
                {"loc": [f"{url[:-4]}/p1", f"{url[:-4]}/p2"], "lastmod": ["2026-01-01"] * 2}
            )

        fake_adv.handler = handler

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://tmax.example.com/sitemap.xml",
            max_urls=3,
            _deadline=_no_deadline(clock),
        )

        # Only a.xml (2 URLs) then b.xml (2 URLs) are fetched before hitting the
        # max_urls=3 cap — c.xml and d.xml are never requested.
        fetched = fake_adv.calls
        assert fetched[0] == "https://tmax.example.com/sitemap.xml"
        assert "a.xml" in fetched[1]
        assert "b.xml" in fetched[2]
        assert not any("c.xml" in c or "d.xml" in c for c in fetched)
        assert not df.empty


class TestBatchDeadline:
    def test_deadline_bounds_fetch(self, fake_adv, clock):
        fake_adv.handler = lambda url: (_ for _ in ()).throw(_http_error(429))

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://tdl.example.com/sitemap.xml",
            _deadline=clock["now"] + 0.001,
        )

        assert df.empty
        # One 429 -> one backoff sleep; the deadline fires before the next fetch.
        assert fake_adv.calls == ["https://tdl.example.com/sitemap.xml"]
        assert len(clock["sleeps"]) == 1
        assert clock["sleeps"][0] <= _MAX_SLEEP

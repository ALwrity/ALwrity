"""Tests for Phase 3 of the advertools RCA plan: 429 circuit breaker +
escalating per-domain cooldown.

RCA context (see parent tracker #520): during onboarding, each sub-sitemap
was retried 2x per pipeline and duplicate pipelines doubled every request —
the origin (a Wix-hosted site) answered with a wall of HTTP 429s.

Phase 3 contract:

- **Escalating cooldown** — the post-429 pause per domain grows with the
  number of 429s observed in the escalation window: 1st → 20s, 2nd → 60s,
  3rd+ → 300s. The history decays, so a domain that behaved for a while
  resets to the base step. ``Retry-After`` still wins for the immediate
  retry sleep (unchanged from the Phase "rate-limit hardening" contract).
- **Circuit breaker** — once ``_429_CIRCUIT_THRESHOLD`` 429s occur within
  ``_429_CIRCUIT_WINDOW``, the sitemap-index fan-out STOPS: remaining
  sub-sitemaps are not requested (partial result instead of hammering the
  origin). A fresh top-level fetch remains allowed as a probe.

No network: ``advertools.sitemap_to_df`` is stubbed and the clock is faked
(same harness as ``test_advertools_sitemap_retry.py``).
"""

import urllib.error

import pandas as pd
import pytest

import services.seo.advertools_service as svc

_MAX_SLEEP = svc._MAX_RETRY_SLEEP


class FakeAdv:
    def __init__(self):
        self.calls = []
        self.handler = None

    def sitemap_to_df(self, url, recursive=False):
        self.calls.append(url)
        return self.handler(url)

    def url_to_df(self, locs):
        # analyze_sitemap's pillar analysis; raising sends it down the
        # hierarchy-extraction fallback path, which needs no network.
        raise RuntimeError("url_to_df not stubbed")


@pytest.fixture
def fake_adv(monkeypatch):
    adv = FakeAdv()
    monkeypatch.setattr(svc, "adv", adv)
    return adv


@pytest.fixture
def clock(monkeypatch):
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
    svc._DOMAIN_LAST_429.clear()
    svc._DOMAIN_LAST_REQUEST.clear()
    svc._DOMAIN_SEMAPHORES.clear()
    svc._429_HISTORY.clear()
    yield
    svc._DOMAIN_LAST_429.clear()
    svc._DOMAIN_LAST_REQUEST.clear()
    svc._DOMAIN_SEMAPHORES.clear()
    svc._429_HISTORY.clear()


def _http_error(code, retry_after=None):
    headers = {"Retry-After": retry_after} if retry_after else {}
    return urllib.error.HTTPError("http://x", code, "err", headers, None)


def _no_deadline(clock):
    return clock["now"] + 100000.0


# ---------------------------------------------------------------------------
# 1. Escalating per-domain cooldown
# ---------------------------------------------------------------------------


class TestEscalatingCooldown:
    def test_first_429_uses_base_step(self, clock):
        svc._note_429("escal.example.com")
        cooldown = svc._domain_429_cooldown("escal.example.com")
        assert 0 < cooldown <= svc._429_ESCALATION_STEPS[0]

    def test_second_429_escalates(self, clock):
        svc._note_429("escal.example.com")
        svc._note_429("escal.example.com")
        assert svc._domain_429_cooldown("escal.example.com") == svc._429_ESCALATION_STEPS[1]

    def test_third_and_beyond_use_max_step(self, clock):
        for _ in range(5):
            svc._note_429("escal.example.com")
        assert svc._domain_429_cooldown("escal.example.com") == svc._429_ESCALATION_STEPS[-1]

    def test_cooldown_counts_only_within_window(self, clock):
        # Two 429s, but one far outside the escalation window -> count 1.
        now = clock["now"]
        svc._429_HISTORY["w.example.com"] = [now - svc._429_CIRCUIT_WINDOW - 10.0]
        svc._DOMAIN_LAST_429["w.example.com"] = now
        svc._note_429("w.example.com")
        assert svc._domain_429_cooldown("w.example.com") == svc._429_ESCALATION_STEPS[0]

    def test_history_decays_so_domain_resets_to_base(self, clock):
        # A domain that 429'd a lot, but all of it outside the window.
        now = clock["now"]
        svc._429_HISTORY["old.example.com"] = [
            now - svc._429_CIRCUIT_WINDOW - i for i in range(5)
        ]
        svc._DOMAIN_LAST_429["old.example.com"] = now - svc._429_CIRCUIT_WINDOW - 10.0
        assert svc._domain_429_count("old.example.com") == 0
        assert svc._domain_429_cooldown("old.example.com") == 0.0
        assert svc._domain_circuit_open("old.example.com") is False

    def test_retry_after_still_wins_for_immediate_retry(self, fake_adv, clock):
        """Escalation governs the domain cooldown, not the immediate retry
        sleep — Retry-After keeps winning there (existing contract)."""
        attempts = {"n": 0}

        def handler(url):
            attempts["n"] += 1
            if attempts["n"] <= 2:
                raise _http_error(429, retry_after="5")
            return pd.DataFrame({"loc": ["https://ra.example.com/1"]})

        fake_adv.handler = handler
        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://ra.example.com/sitemap.xml",
            _deadline=_no_deadline(clock),
        )
        assert not df.empty
        assert clock["sleeps"] == [5.0, 5.0]


# ---------------------------------------------------------------------------
# 2. Circuit breaker state
# ---------------------------------------------------------------------------


class TestCircuitState:
    def test_below_threshold_circuit_closed(self, clock):
        svc._note_429("cb.example.com")
        assert svc._domain_circuit_open("cb.example.com") is False

    def test_opens_at_threshold(self, clock):
        domain = "cb.example.com"
        svc._note_429(domain)
        svc._note_429(domain)
        assert svc._domain_circuit_open(domain) is True

    def test_window_expiry_closes_circuit(self, clock):
        now = clock["now"]
        domain = "cb.example.com"
        svc._429_HISTORY[domain] = [
            now - svc._429_CIRCUIT_WINDOW - 1.0,
            now - svc._429_CIRCUIT_WINDOW - 2.0,
        ]
        assert svc._domain_circuit_open(domain) is False

    def test_domains_are_independent(self, clock):
        svc._note_429("a.example.com")
        svc._note_429("a.example.com")
        assert svc._domain_circuit_open("a.example.com") is True
        assert svc._domain_circuit_open("b.example.com") is False


# ---------------------------------------------------------------------------
# 3. Circuit breaker stops sub-sitemap fan-out
# ---------------------------------------------------------------------------


class TestFanOutCircuit:
    def test_fan_out_stops_after_threshold_429s(self, fake_adv, clock):
        """Index sitemap with 4 subs; blog 429s once then succeeds, cat 429s
        twice -> the circuit opens and news/pricing remain UNREQUESTED."""
        blog_attempts = {"n": 0}

        def handler(url):
            tag = url.rsplit("/", 1)[-1]
            if tag == "sitemap.xml":
                return pd.DataFrame(
                    {
                        "loc": [
                            "https://fan.example.com/blog.xml",
                            "https://fan.example.com/cat.xml",
                            "https://fan.example.com/news.xml",
                            "https://fan.example.com/pricing.xml",
                        ]
                    }
                )
            if tag == "blog.xml":
                blog_attempts["n"] += 1
                if blog_attempts["n"] == 1:
                    raise _http_error(429)  # 429 #1
                return pd.DataFrame({"loc": [url], "lastmod": ["2026-01-01"]})
            if tag == "cat.xml":
                raise _http_error(429)  # 429 #2 and #3
            return pd.DataFrame({"loc": [url], "lastmod": ["2026-01-01"]})

        fake_adv.handler = handler

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://fan.example.com/sitemap.xml",
            max_retries=3,
            _deadline=_no_deadline(clock),
        )

        fetched = [c.rsplit("/", 1)[-1] for c in fake_adv.calls]
        assert "blog.xml" in fetched
        assert "cat.xml" in fetched
        # Circuit opened (3 429s >= threshold 2): no further fan-out.
        assert not any("news.xml" in c for c in fake_adv.calls)
        assert not any("pricing.xml" in c for c in fake_adv.calls)
        assert svc._domain_circuit_open("fan.example.com") is True
        # Partial result: whatever succeeded before the breaker fired.
        locs = df["loc"].tolist() if not df.empty else []
        assert any("blog.xml" in loc for loc in locs) or df.empty

    def test_top_level_probe_still_allowed_when_circuit_open(self, fake_adv, clock):
        """The breaker governs bulk fan-out, not single probes: a new
        top-level fetch on an open-circuit domain is still attempted once."""
        domain = "probe.example.com"
        svc._note_429(domain)
        svc._note_429(domain)
        assert svc._domain_circuit_open(domain) is True

        fake_adv.handler = lambda url: pd.DataFrame(
            {"loc": ["https://probe.example.com/page-1"], "lastmod": ["2026-01-01"]}
        )

        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://probe.example.com/sitemap.xml",
            _deadline=_no_deadline(clock),
        )
        assert not df.empty
        assert fake_adv.calls == ["https://probe.example.com/sitemap.xml"]

    def test_no_429s_means_full_fan_out(self, fake_adv, clock):
        def handler(url):
            tag = url.rsplit("/", 1)[-1]
            if tag == "sitemap.xml":
                return pd.DataFrame(
                    {"loc": [f"https://ok.example.com/{i}.xml" for i in range(4)]}
                )
            return pd.DataFrame({"loc": [url], "lastmod": ["2026-01-01"]})

        fake_adv.handler = handler
        df = svc.AdvertoolsService._sitemap_to_df_with_retry(
            "https://ok.example.com/sitemap.xml",
            _deadline=_no_deadline(clock),
        )
        assert len(fake_adv.calls) == 5  # index + 4 subs
        assert not df.empty


# ---------------------------------------------------------------------------
# 4. analyze_sitemap surfaces degradation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestAnalyzeSitemapDegraded:
    async def test_success_result_marked_degraded_when_circuit_open(
        self, fake_adv, clock, monkeypatch
    ):
        monkeypatch.setattr(svc, "_throttle_domain_sync", lambda domain: None)
        monkeypatch.setattr(
            svc.AdvertoolsService,
            "_sitemap_to_df_with_retry",
            staticmethod(
                lambda url, max_retries=3, _depth=0, _deadline=None, max_urls=None: pd.DataFrame(
                    {
                        "loc": ["https://deg.example.com/1", "https://deg.example.com/2"],
                        "lastmod": ["2026-01-01", "2026-06-01"],
                    }
                )
            ),
        )
        monkeypatch.setattr(svc, "_domain_circuit_open", lambda domain: True)

        service = svc.AdvertoolsService()
        result = await service.analyze_sitemap("https://deg.example.com/sitemap.xml")

        assert result["success"] is True
        assert result.get("degraded") is True
        assert "rate-limiting" in (result.get("degraded_reason") or "").lower()

    async def test_failure_result_marked_rate_limited_after_429s(
        self, fake_adv, clock, monkeypatch
    ):
        monkeypatch.setattr(svc, "_throttle_domain_sync", lambda domain: None)
        fake_adv.handler = lambda url: (_ for _ in ()).throw(_http_error(429))
        # Force retries to exhaust quickly.
        monkeypatch.setattr(svc, "_MAX_RETRY_SLEEP", 0.0)

        service = svc.AdvertoolsService()
        result = await service.analyze_sitemap(
            "https://rl.example.com/sitemap.xml", max_retries=1
        )

        assert result["success"] is False
        assert result.get("rate_limited") is True
        assert result.get("degraded") is True

    async def test_clean_result_not_marked_degraded(self, fake_adv, clock, monkeypatch):
        monkeypatch.setattr(svc, "_throttle_domain_sync", lambda domain: None)
        fake_adv.handler = lambda url: pd.DataFrame(
            {
                "loc": ["https://clean.example.com/1", "https://clean.example.com/2"],
                "lastmod": ["2026-01-01", "2026-06-01"],
            }
        )

        service = svc.AdvertoolsService()
        result = await service.analyze_sitemap("https://clean.example.com/sitemap.xml")

        assert result["success"] is True
        assert result.get("degraded") is None
        assert result.get("rate_limited") is None

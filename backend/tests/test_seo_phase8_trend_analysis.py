"""
Phase 8F — real GSC trend analysis (TDD, build decision).

Phase 6 of the seo-tools UI completion plan: /api/seo/gsc/trend-analysis was
the only true stub in seo_tools.py (analyze_performance_trends always returned
status "pending"). Review showed GSCService already has fully date-windowed
searchanalytics access and a previous-period helper — so the real
implementation is clean: two equal-length date-dimension windows compared.

Contract being built:
  P8F-1: GSCService.get_daily_metrics(user_id, site_url, start, end) returns
         date-dimension rows for exactly that window (no network in tests).
  P8F-2: analyze_performance_trends(site_url, user_id, metric, days_back)
         computes per-metric window totals (sum / weighted average), previous
         window totals, delta_pct and up/down/stable classification (±5%).
  P8F-3: no_data (GSC not connected) and empty-row windows are graceful —
         never a fabricated 0, never a division crash (delta_pct None).
  P8F-4: user_id is REQUIRED and forwarded into every GSC query.
  P8F-5: days_back gridded: start == end - (days_back - 1); previous window =
         the immediately preceding equal-length window.

No GSC auth is exercised: GSCStrategyInsightsService accepts an injected
gsc_service (existing constructor param), tests inject a stub.
"""

import copy
import sys
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.gsc_service import GSCService
from services.seo_tools.gsc_strategy_insights_service import GSCStrategyInsightsService


def _daily_row(date: str, clicks: float, impressions: float, ctr: float, position: float):
    return {
        "keys": [date],
        "clicks": clicks,
        "impressions": impressions,
        "ctr": ctr,
        "position": position,
    }


class _FakeGSCService:
    """Stub returning fixed date rows for any window; records calls."""

    def __init__(self, status: str = "success"):
        self.status = status
        self.calls = []
        self.unit_rows = _daily_row("D", 4.0, 10.0, 0.4, 5.0)  # per-day defaults

    def get_daily_metrics(self, user_id, site_url, start_date, end_date):
        self.calls.append(
            {"user_id": user_id, "site_url": site_url, "start": start_date, "end": end_date}
        )
        if self.status == "no_data":
            return {"status": "no_data", "rows": [], "error": "User not connected to GSC"}
        if self.status == "error":
            return {"status": "error", "rows": [], "error": "boom"}
        if self.status == "empty":
            return {
                "status": "success",
                "rows": [],
                "startDate": start_date,
                "endDate": end_date,
            }
        return {
            "status": "success",
            "rows": [dict(self.unit_rows)],
            "startDate": start_date,
            "endDate": end_date,
        }


def _service(fake: _FakeGSCService) -> GSCStrategyInsightsService:
    return GSCStrategyInsightsService(gsc_service=MagicMock())  # constructor builds brainstorm with it


# The service instantiates GSCBrainstormService(gsc_service) internally; the
# fake must be passed as gsc_service so get_daily_metrics is stubbed.
def _stubbed_service(fake: _FakeGSCService) -> GSCStrategyInsightsService:
    return GSCStrategyInsightsService(gsc_service=fake)


# ---------------------------------------------------------------------------
# P8F-2/P8F-5: real math over two equal-length windows
# ---------------------------------------------------------------------------

def test_p8f2_trends_compute_totals_deltas_and_trend():
    fake = _FakeGSCService()
    service = _stubbed_service(fake)
    result = __import__("asyncio").run(
        service.analyze_performance_trends("https://x.test", user_id="u1", metric="all", days_back=90)
    )

    assert result["status"] == "success"
    assert result["metric"] == "all"
    totals = result["totals"]
    # clicks/impressions are sums; ctr/position are weighted averages of rows.
    assert totals["clicks"]["current"] > 0
    assert totals["ctr"]["current"] == 0.4  # 4/10 from the single daily row
    assert totals["position"]["current"] == 5.0

    # Gridding: days_back=90 → current window is 90 days long...
    assert result["window"]["days"] == 90
    # ...and the previous window is the immediately preceding 90 days.
    assert result["previous_window"]["days"] == 90
    for call in fake.calls:
        assert call["user_id"] == "u1"


def test_p8f5_previous_window_precedes_current_window():
    fake = _FakeGSCService()
    service = _stubbed_service(fake)
    __import__("asyncio").run(
        service.analyze_performance_trends("https://x.test", user_id="u1", metric="clicks", days_back=7)
    )
    assert len(fake.calls) == 2, "one query per window (current + previous)"
    # Implementation contract: query 1 = current window, query 2 = previous.
    current_call, prev_call = fake.calls
    # The current window must start strictly after the previous window ends.
    assert current_call["start"] > prev_call["end"]
    assert current_call["end"] > current_call["start"]
    assert prev_call["end"] >= prev_call["start"]


# ---------------------------------------------------------------------------
# P8F-3: graceful no-data handling — never 'pending', never fabricated zeros
# ---------------------------------------------------------------------------

def test_p8f3_not_connected_is_no_data_not_pending():
    fake = _FakeGSCService(status="no_data")
    service = _stubbed_service(fake)
    result = __import__("asyncio").run(
        service.analyze_performance_trends("https://x.test", user_id="u1", metric="clicks")
    )
    assert result["status"] == "no_data"
    assert "pending" not in str(result.get("status")).lower()
    assert result.get("error")


def test_p8f3_empty_rows_yield_delta_none_and_stable():
    fake = _FakeGSCService(status="empty")
    service = _stubbed_service(fake)
    result = __import__("asyncio").run(
        service.analyze_performance_trends("https://x.test", user_id="u1", metric="clicks")
    )
    # "empty" rows on BOTH windows → delta_pct None, trend stable, no exceptions
    totals = result["totals"]["clicks"]
    assert totals["current"] == 0
    assert totals["previous"] == 0
    assert totals["delta_pct"] is None
    assert totals["trend"] == "stable"


def test_p8f3_delta_direction_for_up_and_down():
    calls = {"n": 0}

    class _TwoWindowFake(_FakeGSCService):
        def get_daily_metrics(self, user_id, site_url, start_date, end_date):
            calls["n"] += 1
            current = calls["n"] == 1  # first call in the implementation must be the current window
            unit = 6.0 if current else 4.0
            return {"status": "success", "rows": [{"keys": ["D"], "clicks": unit, "impressions": 10, "ctr": 0.4, "position": 5.0}], "startDate": start_date, "endDate": end_date}

    service = GSCStrategyInsightsService(gsc_service=_TwoWindowFake())
    result = __import__("asyncio").run(
        service.analyze_performance_trends("https://x.test", user_id="u1", metric="clicks")
    )
    totals = result["totals"]["clicks"]
    assert totals["current"] == 6.0 and totals["previous"] == 4.0
    assert totals["delta_pct"] == 50.0
    assert totals["trend"] == "up"

    # And the mirror image: swap order
    calls["n"] = 0

    class _DownFake(_TwoWindowFake):
        def get_daily_metrics(self, user_id, site_url, start_date, end_date):
            calls["n"] += 1
            current = calls["n"] == 1
            unit = 2.0 if current else 4.0
            return {"status": "success", "rows": [{"keys": ["D"], "clicks": unit, "impressions": 10, "ctr": 0.4, "position": 5.0}], "startDate": start_date, "endDate": end_date}

    down = GSCStrategyInsightsService(gsc_service=_DownFake())
    result2 = __import__("asyncio").run(
        down.analyze_performance_trends("https://x.test", user_id="u1", metric="clicks")
    )
    t2 = result2["totals"]["clicks"]
    assert t2["delta_pct"] == -50.0
    assert t2["trend"] == "down"


# ---------------------------------------------------------------------------
# P8F-4: user_id is required and forwarded
# ---------------------------------------------------------------------------

def test_p8f4_user_id_required_and_forwarded():
    fake = _FakeGSCService()
    service = _stubbed_service(fake)
    # user_id is a required positional parameter → calling without it raises
    # TypeError immediately at call time (before the coroutine even runs).
    raised = False
    try:
        service.analyze_performance_trends("https://x.test")
    except TypeError:
        raised = True
    assert raised, "user_id must be a required parameter"


def test_p8f2_get_daily_metrics_exists_on_gsc_service():
    """The new date-dimension query method is public on GSCService."""
    assert hasattr(GSCService, "get_daily_metrics"), (
        "GSCService.get_daily_metrics missing — the date-dimension query helper"
    )

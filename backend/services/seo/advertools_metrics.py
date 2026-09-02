"""Process-wide counters for the advertools RCA hardening events (tracker #520).

The RCA plan asked for observability on the three event classes that caused
the onboarding failures, so production behaviour can be confirmed fixed:

- ``duplicate_skips``       — a pipeline skipped because the same
                              (user, site, type) was already running.
- ``single_flight_hits``    — a sitemap fetch served from cache / coalesced
                              instead of hitting the origin again.
- ``circuit_breaks``        — the 429 circuit opened and stopped a
                              sub-sitemap fan-out.
- ``failed_fetch_memo_hits``— a URL that just exhausted retries was skipped
                              via the negative memo (no re-request).

Counters are operational metrics keyed by event name — no user data is
stored. Read them with :func:`snapshot` (e.g. for a future dashboard
endpoint); tests use :func:`reset`.
"""

import threading
from typing import Dict

_LOCK = threading.Lock()
_COUNTERS: Dict[str, int] = {}

EVENT_DUPLICATE_SKIP = "duplicate_skips"
EVENT_SINGLE_FLIGHT_HIT = "single_flight_hits"
EVENT_CIRCUIT_BREAK = "circuit_breaks"
EVENT_FAILED_FETCH_MEMO = "failed_fetch_memo_hits"


def incr(event: str, amount: int = 1) -> None:
    """Increment an event counter (thread-safe; zero-count events omitted)."""
    with _LOCK:
        _COUNTERS[event] = _COUNTERS.get(event, 0) + amount


def snapshot() -> Dict[str, int]:
    """Return a copy of the non-zero counters."""
    with _LOCK:
        return dict(_COUNTERS)


def reset() -> None:
    """Clear all counters (tests / operational resets)."""
    with _LOCK:
        _COUNTERS.clear()

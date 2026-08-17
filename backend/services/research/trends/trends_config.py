"""Configuration for Google Trends (pytrends) HTTP timeouts."""

from __future__ import annotations

import os

from loguru import logger

_DEFAULT_CONNECT_SECONDS = 20
_DEFAULT_READ_SECONDS = 60
_DEFAULT_TOTAL_SECONDS = 90
_DEFAULT_RETRY_DELAYS = (5, 10, 15)


def get_pytrends_timeout() -> tuple[int, int]:
    """
    Return (connect_timeout, read_timeout) in seconds for pytrends requests.

    pytrends uses public Google Trends data and does not require an API key.
    """
    try:
        connect = int(os.getenv("GOOGLE_TRENDS_CONNECT_TIMEOUT", str(_DEFAULT_CONNECT_SECONDS)))
        read = int(os.getenv("GOOGLE_TRENDS_READ_TIMEOUT", str(_DEFAULT_READ_SECONDS)))
    except ValueError as exc:
        logger.warning(
            "[TrendsConfig] Invalid GOOGLE_TRENDS_* timeout values; using defaults: {}",
            exc,
        )
        connect, read = _DEFAULT_CONNECT_SECONDS, _DEFAULT_READ_SECONDS

    connect = max(5, min(connect, 60))
    read = max(20, min(read, 120))
    return connect, read


def get_trends_total_timeout() -> float:
    """Hard cap for a full trends API request (seconds)."""
    try:
        total = float(os.getenv("GOOGLE_TRENDS_TOTAL_TIMEOUT", str(_DEFAULT_TOTAL_SECONDS)))
    except ValueError as exc:
        logger.warning("[TrendsConfig] Invalid GOOGLE_TRENDS_TOTAL_TIMEOUT; using default: {}", exc)
        total = float(_DEFAULT_TOTAL_SECONDS)
    return max(30.0, min(total, 180.0))


def get_trends_retry_delays() -> tuple[int, ...]:
    """Seconds to wait between 429 retries (kept short to avoid client timeouts)."""
    raw = os.getenv("GOOGLE_TRENDS_RETRY_DELAYS", ",".join(str(v) for v in _DEFAULT_RETRY_DELAYS))
    try:
        delays = tuple(int(part.strip()) for part in raw.split(",") if part.strip())
        if not delays:
            raise ValueError("empty retry delays")
        return tuple(max(1, min(delay, 30)) for delay in delays)
    except ValueError as exc:
        logger.warning("[TrendsConfig] Invalid GOOGLE_TRENDS_RETRY_DELAYS; using defaults: {}", exc)
        return _DEFAULT_RETRY_DELAYS

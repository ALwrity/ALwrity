"""Detect stale year references in LLM-generated growth insight text."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Iterable

from loguru import logger

from .prompt_context import get_current_date_context

YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")

# Allow dated references when the copy clearly frames them as history.
HISTORICAL_MARKERS: tuple[str, ...] = (
    "historical",
    "history",
    "since ",
    "legacy",
    "previously",
    "past ",
    "was ",
    "were ",
    "anniversary",
    "looking back",
    "retrospective",
    "in hindsight",
    "back in ",
    "years ago",
)


def find_stale_years(
    text: str,
    current_year: int,
    *,
    max_age_years: int = 1,
) -> list[int]:
    """Return years more than *max_age_years* behind *current_year*."""
    if not text or not text.strip():
        return []

    stale: list[int] = []
    for match in YEAR_PATTERN.finditer(text):
        year = int(match.group())
        if current_year - year > max_age_years:
            stale.append(year)
    return stale


def text_has_stale_year_reference(
    text: str,
    now: datetime | None = None,
    *,
    max_age_years: int = 1,
) -> bool:
    """True when *text* cites a year that is too far in the past for current insights."""
    try:
        if not text or not text.strip():
            return False

        ctx = get_current_date_context(now)
        stale_years = find_stale_years(text, ctx["year"], max_age_years=max_age_years)
        if not stale_years:
            return False

        lower = text.lower()
        if any(marker in lower for marker in HISTORICAL_MARKERS):
            logger.debug(
                "[TemporalValidation] Allowing stale years {} — historical context detected",
                stale_years,
            )
            return False

        return True
    except Exception as exc:
        logger.error("[TemporalValidation] Failed to evaluate stale-year text: {}", exc)
        return False


def collect_stale_fields(
    fields: Iterable[tuple[str, str]],
    now: datetime | None = None,
    *,
    max_age_years: int = 1,
) -> list[str]:
    """Return field names whose values contain stale year references."""
    stale_fields: list[str] = []
    for field_name, value in fields:
        try:
            text = "" if value is None else str(value)
            if text_has_stale_year_reference(text, now, max_age_years=max_age_years):
                stale_fields.append(field_name)
        except Exception as exc:
            logger.warning(
                "[TemporalValidation] Could not inspect field '{}': {}",
                field_name,
                exc,
            )
    return stale_fields


def log_stale_reference(
    service: str,
    item_label: str,
    stale_fields: list[str],
    text_by_field: dict[str, str],
    now: datetime | None = None,
) -> None:
    """Structured warning when LLM output includes outdated year references."""
    if not stale_fields:
        return
    ctx = get_current_date_context(now)
    excerpts = {
        field: (text_by_field.get(field) or "")[:120]
        for field in stale_fields
    }
    logger.warning(
        "[{}] Stale year reference in {} (current year {}): fields={} excerpts={}",
        service,
        item_label,
        ctx["year"],
        stale_fields,
        excerpts,
    )


def should_exclude_for_stale_years(
    service: str,
    section: str,
    item_label: str,
    fields: dict[str, str],
    now: datetime | None = None,
    *,
    max_age_years: int = 1,
) -> bool:
    """
    Return True when an insight item should be excluded from user-facing results.

    Fails open (returns False) if validation raises unexpectedly.
    """
    try:
        stale_fields = collect_stale_fields(fields.items(), now, max_age_years=max_age_years)
        if not stale_fields:
            return False
        log_stale_reference(
            service,
            f"{section}/{item_label}",
            stale_fields,
            fields,
            now,
        )
        return True
    except Exception as exc:
        logger.error(
            "[TemporalValidation] Stale-year check failed for {}/{}: {}",
            section,
            item_label,
            exc,
        )
        return False

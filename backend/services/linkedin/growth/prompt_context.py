"""Shared LLM prompt context for LinkedIn growth services."""

from datetime import datetime, timezone
from typing import TypedDict


class DateContext(TypedDict):
    today_iso: str
    today_human: str
    year: int
    month: str


def get_current_date_context(now: datetime | None = None) -> DateContext:
    """Return normalized date fields for LLM prompts."""
    ref = now or datetime.now(timezone.utc)
    return {
        "today_iso": ref.strftime("%Y-%m-%d"),
        "today_human": ref.strftime("%d %B %Y"),
        "year": ref.year,
        "month": ref.strftime("%B"),
    }


def current_search_year(now: datetime | None = None) -> int:
    """Year token for Exa / web search queries."""
    return get_current_date_context(now)["year"]


def format_date_context_block(now: datetime | None = None) -> str:
    """Markdown block injected into growth LLM prompts for temporal awareness."""
    ctx = get_current_date_context(now)
    stale_example_year = ctx["year"] - 2
    return (
        f"## CURRENT DATE\n"
        f"Today is {ctx['today_human']} ({ctx['today_iso']}). "
        f"The current year is {ctx['year']} and the current month is {ctx['month']}.\n\n"
        f"All insights, trends, hooks, and time references MUST reflect {ctx['year']} "
        f"or the most recent period relative to today. Do NOT cite outdated years "
        f"(for example {stale_example_year}) unless explicitly describing a past historical event."
    )


def format_date_system_rules(now: datetime | None = None) -> str:
    """Compact system-prompt rules for temporal grounding."""
    ctx = get_current_date_context(now)
    return (
        f"6. **TEMPORAL AWARENESS:** Today is {ctx['today_human']}. "
        f"The current year is {ctx['year']}. Ground every insight in what is "
        f"relevant NOW — not training-cutoff defaults. Never reference stale years "
        f"unless citing history."
    )


def build_temporal_llm_prompts(
    user_prompt: str,
    system_prompt: str,
    now: datetime | None = None,
) -> tuple[str, str]:
    """Prepend date context to user prompt and append temporal rules to system prompt."""
    ref = now or datetime.now(timezone.utc)
    enriched_user = f"{format_date_context_block(ref)}\n\n{user_prompt}"
    enriched_system = f"{system_prompt}\n\n{format_date_system_rules(ref)}"
    return enriched_user, enriched_system


def format_industry_search_queries(
    templates: list[str],
    *,
    industry: str = "",
    title: str = "",
    now: datetime | None = None,
) -> list[str]:
    """Build Exa search queries with dynamic industry/title/year tokens."""
    year = current_search_year(now)
    try:
        return [template.format(industry=industry, title=title, year=year) for template in templates]
    except KeyError as exc:
        from loguru import logger

        logger.error("[PromptContext] Invalid search query template placeholder: {}", exc)
        raise ValueError(f"Invalid search query template: missing placeholder {exc}") from exc


def sanitize_llm_text(value: object) -> str:
    """Normalize LLM string fields — strip quotes, collapse whitespace."""
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if (text.startswith('"') and text.endswith('"')) or (
        text.startswith("'") and text.endswith("'")
    ):
        text = text[1:-1].strip()
    return " ".join(text.split())

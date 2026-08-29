"""Compact YouTube research selection and prompt block (no URLs in LLM text)."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.planner_research_compact")

PROMPT_SOURCE_LIMIT = 5
SUMMARY_CHAR_CAP = 220
HIGHLIGHT_CHAR_CAP = 180
HIGHLIGHTS_PER_SOURCE = 2

_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
_TOKEN_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)

_NEURAL_WEIGHT = 0.35
_CREDIBILITY_WEIGHT = 0.30
_RECENCY_WEIGHT = 0.20
_OVERLAP_WEIGHT = 0.15


def _clean_prompt_text(value: Any, cap: int) -> str:
    """Strip URLs and collapse whitespace for LLM-facing research text."""
    try:
        raw = str(value or "")
        without_urls = _URL_RE.sub("", raw)
        cleaned = " ".join(without_urls.split())
        if len(cleaned) <= cap:
            return cleaned
        return cleaned[:cap].rstrip()
    except Exception:
        logger.exception("[YouTubePlanner] Failed to clean research text")
        return ""


def _tokenize(text: str) -> set:
    try:
        return set(_TOKEN_RE.findall((text or "").lower()))
    except Exception:
        logger.exception("[YouTubePlanner] Failed to tokenize research text")
        return set()


def _parse_published_at(published_at: Any) -> Optional[datetime]:
    if not published_at:
        return None
    raw = str(published_at).strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        logger.debug("[YouTubePlanner] Unparseable published_at; using mid recency")
        return None


def _recency_score(published_at: Any) -> float:
    parsed = _parse_published_at(published_at)
    if parsed is None:
        return 0.5
    days = max(0, (datetime.now(timezone.utc) - parsed).days)
    if days <= 7:
        return 1.0
    if days <= 30:
        return 0.85
    if days <= 180:
        return 0.6
    if days <= 365:
        return 0.4
    return 0.2


def _overlap_score(source: Dict[str, Any], idea_tokens: set) -> float:
    if not idea_tokens:
        return 0.0
    blob = " ".join(
        [
            str(source.get("title") or ""),
            str(source.get("summary") or ""),
            str(source.get("excerpt") or ""),
        ]
    )
    source_tokens = _tokenize(blob)
    if not source_tokens:
        return 0.0
    return len(idea_tokens & source_tokens) / len(idea_tokens)


def _neural_score(index: int, total: int) -> float:
    if total <= 1:
        return 1.0
    clamped = min(max(index, 0), total - 1)
    return (total - clamped) / total


def score_youtube_research_source(
    source: Dict[str, Any],
    *,
    index: int,
    total: int,
    idea_tokens: set,
) -> float:
    """Combine Exa neural order, credibility, recency, and idea overlap."""
    try:
        credibility = float(source.get("credibility_score") or 0.0)
    except (TypeError, ValueError):
        credibility = 0.0
    credibility = min(max(credibility, 0.0), 1.0)
    score = (
        _NEURAL_WEIGHT * _neural_score(index, total)
        + _CREDIBILITY_WEIGHT * credibility
        + _RECENCY_WEIGHT * _recency_score(source.get("published_at"))
        + _OVERLAP_WEIGHT * _overlap_score(source, idea_tokens)
    )
    return round(score, 6)


def select_top_youtube_research_sources(
    sources: Sequence[Dict[str, Any]],
    user_idea: str,
    *,
    limit: int = PROMPT_SOURCE_LIMIT,
) -> List[Dict[str, Any]]:
    """Pick the best prompt sources. Does not use sources[:5] by Exa order alone."""
    items = [src for src in sources if isinstance(src, dict)]
    if not items:
        return []
    idea_tokens = _tokenize(user_idea)
    total = len(items)
    ranked: List[Tuple[float, int, Dict[str, Any]]] = []
    for i, source in enumerate(items):
        try:
            neural_index = int(source.get("index", i))
        except (TypeError, ValueError):
            neural_index = i
        score = score_youtube_research_source(
            source,
            index=neural_index,
            total=total,
            idea_tokens=idea_tokens,
        )
        ranked.append((score, i, source))
    ranked.sort(key=lambda row: (-row[0], row[1]))
    selected = [row[2] for row in ranked[: max(1, limit)]]
    logger.info(
        "[YouTubePlanner] Selected {} of {} research sources for prompt",
        len(selected),
        total,
    )
    return selected


def _source_highlights(source: Dict[str, Any]) -> List[str]:
    raw = source.get("highlights") or []
    if not isinstance(raw, list):
        return []
    cleaned: List[str] = []
    for item in raw:
        text = _clean_prompt_text(item, HIGHLIGHT_CHAR_CAP)
        if text and "http" not in text.lower():
            cleaned.append(text)
        if len(cleaned) >= HIGHLIGHTS_PER_SOURCE:
            break
    return cleaned


def build_compact_research_prompt_block(sources: Sequence[Dict[str, Any]]) -> str:
    """Title + capped summary + up to 2 highlights. No URLs."""
    if not sources:
        return ""
    lines = [
        "Use only these facts. Do not invent statistics or numbers.",
        "",
    ]
    fact_count = 0
    for source in sources:
        title = _clean_prompt_text(source.get("title") or "Untitled", 120) or "Untitled"
        summary = _clean_prompt_text(
            source.get("summary") or source.get("excerpt") or "",
            SUMMARY_CHAR_CAP,
        )
        highlights = _source_highlights(source)
        if "http" in title.lower():
            title = "Untitled"
        fact_count += 1
        lines.append(f"{fact_count}. {title}")
        if summary and "http" not in summary.lower():
            lines.append(f"   {summary}")
        for highlight in highlights:
            lines.append(f"   - {highlight}")
        lines.append("")
    block = "\n".join(lines).strip()
    if "http" in block.lower():
        logger.warning(
            "[YouTubePlanner] Compact research block still contained http; dropping it"
        )
        return ""
    logger.info(
        "[YouTubePlanner] Compact research prompt block facts={} chars={}",
        fact_count,
        len(block),
    )
    return block


def format_youtube_research_sources_for_ui(
    sources: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Keep all fetched sources (with URLs) for the UI. Not injected into the LLM prompt."""
    formatted: List[Dict[str, Any]] = []
    for source in sources:
        if not isinstance(source, dict):
            continue
        highlights = source.get("highlights") or []
        if not isinstance(highlights, list):
            highlights = []
        formatted.append(
            {
                "title": source.get("title", "") or "",
                "url": source.get("url", "") or "",
                "excerpt": (source.get("excerpt", "") or "")[:300],
                "published_at": source.get("published_at"),
                "credibility_score": source.get("credibility_score", 0.85) or 0.85,
                "highlights": [str(item) for item in highlights[:HIGHLIGHTS_PER_SOURCE] if item],
                "summary": (source.get("summary", "") or "")[:300],
                "index": source.get("index"),
            }
        )
    return formatted

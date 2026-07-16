"""
Lightweight Exa search wrapper for brainstorming.

Uses the canonical ExaResearchProvider (from services/research/) so all
Exa calls across ALwrity share the same retry logic, credential management,
and usage tracking. Brainstorm-specific callers receive (sources, content)
where `content` is an aggregated string ready for LLM prompt injection —
matching the _aggregate_content pattern used by blog writer research.
"""

from typing import Dict, List, Tuple

from loguru import logger


async def search_exa(seed: str, num_results: int = 10) -> Tuple[List[Dict[str, str]], str]:
    """Search Exa for topic context and return (sources, content).

    Parameters
    ----------
    seed : str
        The topic or phrase to search.
    num_results : int
        Max results to return (default 10, passed directly to Exa).

    Returns
    -------
    tuple of (list[dict], str)
        - sources: [{title, url, snippet}, ...]  for frontend SourceInfo
        - content: aggregated text formatted for LLM prompt injection
          (Source N: title, URL, highlights, summary — separated by ---)

    On any error (missing API key, timeout, Exa failure) returns ([], "")
    so callers degrade gracefully.
    """
    try:
        from services.research.exa_research_provider import ExaResearchProvider

        provider = ExaResearchProvider()
    except RuntimeError as e:
        logger.warning(f"[Brainstorm] ExaResearchProvider unavailable: {e}")
        return [], ""
    except Exception as e:
        logger.error(f"[Brainstorm] Failed to init ExaResearchProvider: {e}")
        return [], ""

    try:
        raw_sources = await provider.simple_search(
            query=seed,
            num_results=num_results,
        )
    except Exception as e:
        logger.error(f"[Brainstorm] Exa simple_search failed: {e}")
        return [], ""

    if not raw_sources:
        logger.info("[Brainstorm] Exa returned 0 sources")
        return [], ""

    sources: List[Dict[str, str]] = []
    content_parts: List[str] = []

    for idx, s in enumerate(raw_sources):
        title = s.get("title", "Untitled")
        url = s.get("url", "")
        highlights: list = s.get("highlights", []) or []
        summary = s.get("summary", "") or ""
        text = s.get("text", "") or ""

        snippet = (
            highlights[0]
            if highlights
            else summary or text[:300]
        )
        sources.append({"title": title, "url": url, "snippet": snippet})

        # Build content block matching blog writer's _aggregate_content
        part = [f"Source {idx + 1}: {title}", f"URL: {url}"]
        if highlights:
            part.append("Key Highlights:\n" + "\n".join(f"- {h}" for h in highlights))
        if summary:
            part.append(f"Summary: {summary}")
        elif text:
            part.append(f"Excerpt: {text[:1000]}")
        content_parts.append("\n".join(part))

    content = "\n\n---\n\n".join(content_parts)
    logger.info(f"[Brainstorm] Exa returned {len(sources)} source(s)")
    return sources, content

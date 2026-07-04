import asyncio
import os
from typing import Dict, List

from exa_py import Exa
from loguru import logger


async def search_exa(seed: str, num_results: int = 10) -> List[Dict[str, str]]:
    """Lightweight Exa neural search for brainstorm topic context."""
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        logger.warning("EXA_API_KEY not set; brainstorming without web context")
        return []
    try:
        exa = Exa(api_key)
        loop = asyncio.get_event_loop()
        resp = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: exa.search(
                    query=seed,
                    num_results=num_results,
                    type="neural",
                    text=True,
                    highlights={"numSentences": 2, "highlightsPerUrl": 3},
                ),
            ),
            timeout=30,
        )
        sources = []
        for r in getattr(resp, "results", []):
            highlights = getattr(r, "highlights", []) or []
            sources.append(
                {
                    "title": getattr(r, "title", "") or "",
                    "url": getattr(r, "url", "") or "",
                    "snippet": highlights[0]
                    if highlights
                    else (getattr(r, "text", "") or "")[:300],
                }
            )
        return sources
    except asyncio.TimeoutError:
        logger.warning("Exa search timed out for brainstorm")
        return []
    except Exception as e:
        logger.error(f"Exa search error: {e}")
        return []

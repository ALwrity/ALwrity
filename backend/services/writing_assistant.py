import os
import re
import asyncio
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from loguru import logger
import random

from services.llm_providers.main_text_generation import llm_text_gen


def strip_assistive_citation_markers(text: str) -> str:
    """
    Remove URL citation hints and [Source N] markers from assistive LLM output.
    Keeps editor text LinkedIn-native — sources are shown separately in the UI.
    """
    if not text:
        return ""
    cleaned = re.sub(
        r"\(\(\s*[^)\]]*?\s*\)\[\s*https?://[^\]\s]+\s*\]\)",
        " ",
        text,
    )
    cleaned = re.sub(
        r"\(\s*\[Source\s+\d+\]\s*\)|\[Source\s+\d+\]",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s{2,}", " ", cleaned).strip()


@dataclass
class WritingSuggestion:
    text: str
    confidence: float
    sources: List[Dict[str, Any]]


class WritingAssistantService:
    """
    Writing assistant that combines Exa search with LLM continuation.
    - Searches relevant sources using the content near the cursor position
    - Generates a short continuation grounded in sources
    - Confidence derived from source availability and quality
    """

    def __init__(self) -> None:
        self.daily_api_calls = 0
        self.daily_limit = 50
        self.last_reset_date = None

    def _get_cached_suggestion(self, text: str) -> WritingSuggestion | None:
        return None

    def _check_daily_limit(self) -> bool:
        import datetime
        today = datetime.date.today()
        if self.last_reset_date != today:
            self.daily_api_calls = 0
            self.last_reset_date = today
        if self.daily_api_calls >= self.daily_limit:
            return False
        self.daily_api_calls += 1
        logger.info(f"Writing assistant API call #{self.daily_api_calls}/{self.daily_limit} today")
        return True

    async def suggest(self, text: str, user_id: str | None = None, cursor_position: Optional[int] = None) -> List[WritingSuggestion]:
        if not text or len(text.strip()) < 6:
            return []

        cached_suggestion = self._get_cached_suggestion(text)
        if cached_suggestion:
            return [cached_suggestion]

        if not self._check_daily_limit():
            logger.warning("Daily API limit reached for writing assistant")
            return []

        if len(text.strip()) < 50:
            return []

        # Use text before cursor for context (where the user is actively writing)
        if cursor_position is not None and 0 < cursor_position <= len(text):
            context_text = text[:cursor_position]
        else:
            context_text = text

        # 1) Find relevant sources via Exa (non-fatal)
        sources = []
        try:
            sources = await self._search_sources(context_text, user_id=user_id)
        except Exception as e:
            logger.warning(f"WritingAssistant Exa search failed, proceeding without sources: {e}")

        # 2) Generate continuation suggestion via LLM
        suggestion_text, confidence = await self._generate_continuation(context_text, sources, user_id=user_id)

        if not suggestion_text:
            return []

        return [WritingSuggestion(text=suggestion_text.strip(), confidence=confidence, sources=sources)]

    async def _search_sources(self, context_text: str, user_id: str = None) -> List[Dict[str, Any]]:
        """Search Exa using the last sentence before cursor for a focused query."""
        try:
            from services.blog_writer.research.exa_provider import ExaResearchProvider

            # Extract the last sentence from context to use as a focused search query
            sentences = re.split(r'(?<=[.!?])\s+', context_text.strip())
            last_sentence = sentences[-1].strip().strip('"').strip("'") if sentences else context_text

            # If very short, use last two sentences
            if len(last_sentence) < 20 and len(sentences) >= 2:
                last_sentence = ' '.join(s[-2:]).strip().strip('"').strip("'")

            exa_query = last_sentence[:500] if len(last_sentence) > 500 else last_sentence

            provider = ExaResearchProvider()
            sources = await provider.simple_search(
                query=exa_query,
                num_results=3,
                user_id=user_id,
            )

            normalized = []
            for s in sources:
                normalized.append({
                    "title": s.get("title", "Untitled"),
                    "url": s.get("url", ""),
                    "text": s.get("text", ""),
                    "author": s.get("author", ""),
                    "published_date": s.get("publishedDate", ""),
                    "score": float(s.get("score") if s.get("score") is not None else 0.5),
                })

            if not normalized:
                raise Exception("No relevant sources found from Exa for the current context")
            return normalized
        except Exception as e:
            logger.error(f"WritingAssistant _search_sources error: {e}")
            raise

    async def _generate_continuation(self, text: str, sources: List[Dict[str, Any]], user_id: str | None = None) -> tuple[str, float]:
        source_blocks: List[str] = []
        for i, s in enumerate(sources[:5]):
            excerpt = (s.get("text", "") or "")
            excerpt = excerpt[:500]
            source_blocks.append(
                f"Source {i+1}: {s.get('title','') or 'Source'}\nURL: {s.get('url','')}\nExcerpt: {excerpt}"
            )
        sources_text = "\n\n".join(source_blocks)

        system_prompt = (
            "You are an assistive writing continuation bot. "
            "Only produce 1-2 SHORT sentences that continue the user's text. "
            "Do not repeat or paraphrase the user's stub. "
            "Match tone and topic. Prefer concrete, current facts from the provided sources. "
            "Write natural LinkedIn prose — no citation markers, no URLs, no ((Author)[url]) hints, "
            "no [Source N] tags. Source titles are shown separately in the UI."
        )
        user_prompt = (
            f"User text to continue (do not repeat):\n{text}\n\n"
            f"Relevant sources to inform your continuation:\n{sources_text}\n\n"
            "Return only the continuation text, without quotes. "
            "No citations or URLs in the output."
        )

        try:
            await asyncio.sleep(random.uniform(0.05, 0.15))

            ai_resp = llm_text_gen(
                prompt=user_prompt,
                json_struct=None,
                system_prompt=system_prompt,
                user_id=user_id,
            )
            if isinstance(ai_resp, dict) and ai_resp.get("text"):
                suggestion = (ai_resp.get("text", "") or "").strip()
            else:
                suggestion = (str(ai_resp or "")).strip()
            if not suggestion:
                raise Exception("Assistive writer returned empty suggestion")

            suggestion = strip_assistive_citation_markers(suggestion)

            # Dynamic confidence based on source quality and response signals
            confidence = 0.5
            if sources:
                # More sources and higher scores = more confident
                avg_score = sum(s.get("score", 0.5) for s in sources) / len(sources)
                confidence = 0.5 + (len(sources) / 6.0) * 0.3 + avg_score * 0.2
            if suggestion.endswith(('.', '!', '?')):
                confidence += 0.05
            if "[http" in suggestion or "((" in suggestion or "[Source" in suggestion:
                confidence -= 0.1
            confidence = min(max(confidence, 0.0), 1.0)

            return suggestion, round(confidence, 2)
        except Exception as e:
            logger.error(f"WritingAssistant _generate_continuation error: {e}")
            raise



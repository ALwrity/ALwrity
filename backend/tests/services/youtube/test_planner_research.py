"""Tests for compact YouTube Exa research scoring and prompt blocks."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _source(
    index: int,
    *,
    title: str,
    url: str,
    summary: str = "",
    excerpt: str = "",
    highlights: list | None = None,
    credibility: float = 0.5,
    published_at: str = "2020-01-01",
) -> dict:
    return {
        "index": index,
        "title": title,
        "url": url,
        "summary": summary,
        "excerpt": excerpt,
        "highlights": highlights or [],
        "credibility_score": credibility,
        "published_at": published_at,
    }


def _ten_sources_unrelated_then_relevant() -> list:
    sources = []
    for i in range(5):
        sources.append(
            _source(
                i,
                title=f"Unrelated topic {i}",
                url=f"https://example.com/unrelated-{i}",
                summary="Weather and sports recap.",
                highlights=["Random recap sentence."],
                credibility=0.2,
                published_at="2018-01-01",
            )
        )
    for i in range(5, 10):
        sources.append(
            _source(
                i,
                title=f"Budget travel packing tip {i}",
                url=f"https://example.com/packing-{i}",
                summary="Carry-on packing for budget travel.",
                highlights=["Pack three items.", "Skip the suitcase."],
                credibility=0.95,
                published_at="2026-08-01",
            )
        )
    return sources


def _fact_lines(block: str) -> list:
    return [
        line
        for line in (block or "").splitlines()
        if line[:2].isdigit() or (len(line) > 2 and line[0].isdigit() and line[1] == ".")
    ]


class TestSelectTopYoutubeResearchSources:
    def test_does_not_use_first_five_exa_order_when_later_sources_score_higher(self):
        from services.youtube.planner_research_compact import (
            select_top_youtube_research_sources,
        )

        selected = select_top_youtube_research_sources(
            _ten_sources_unrelated_then_relevant(),
            "Budget travel packing",
            limit=5,
        )
        titles = [str(item.get("title") or "") for item in selected]
        assert len(selected) == 5
        assert all("packing" in title.lower() for title in titles)
        assert not any("Unrelated" in title for title in titles)


class TestCompactResearchPromptBlock:
    def test_prompt_has_five_fact_blocks_and_no_http(self):
        from services.youtube.planner_research_compact import (
            build_compact_research_prompt_block,
            select_top_youtube_research_sources,
        )

        selected = select_top_youtube_research_sources(
            _ten_sources_unrelated_then_relevant(),
            "Budget travel packing",
            limit=5,
        )
        block = build_compact_research_prompt_block(selected)
        assert "http" not in block.lower()
        assert "example.com" not in block.lower()
        assert "Use only these facts" in block
        assert "Do not invent" in block
        assert len(_fact_lines(block)) == 5
        assert "Pack three items." in block
        assert "Source:" not in block


class FakeDb:
    def close(self) -> None:
        return None


class FakePricing:
    def __init__(self, db) -> None:
        self.db = db

    def check_comprehensive_limits(self, **kwargs):
        return True, "ok", {}


class FakeExaProvider:
    last_prompt = ""
    last_config = None

    def __init__(self) -> None:
        return None

    async def search(self, prompt, topic, industry, target_audience, config, user_id):
        FakeExaProvider.last_prompt = prompt
        FakeExaProvider.last_config = config
        dump = "http://should-not-appear.example/dump " * 40
        return {
            "sources": _ten_sources_unrelated_then_relevant(),
            "content": dump,
            "cost": {"total": 0.01},
        }

    def track_exa_usage(self, user_id, cost):
        return None


class TestPerformExaResearchCompact:
    def test_hindi_query_sources_length_and_no_http_in_prompt(self):
        from services.youtube.planner_research import perform_exa_research

        FakeExaProvider.last_prompt = ""
        FakeExaProvider.last_config = None
        with patch("services.database.get_session_for_user", return_value=FakeDb()), patch(
            "services.subscription.PricingService",
            FakePricing,
        ), patch(
            "services.blog_writer.research.exa_provider.ExaResearchProvider",
            FakeExaProvider,
        ):
            context, sources = asyncio.run(
                perform_exa_research(
                    user_idea="Budget travel packing",
                    video_type="tutorial",
                    target_audience="Beginners",
                    user_id="user_research_test",
                    language="hi",
                )
            )

        assert "Hindi" not in FakeExaProvider.last_prompt
        assert "Budget travel packing" in FakeExaProvider.last_prompt
        assert FakeExaProvider.last_config.max_sources == 10
        assert FakeExaProvider.last_config.exa_highlights is True
        assert FakeExaProvider.last_config.exa_highlights_num_sentences == 2
        assert FakeExaProvider.last_config.exa_highlights_per_url == 2
        assert len(sources) == 10
        assert all(item.get("url") for item in sources)
        assert "http" not in context.lower()
        assert len(_fact_lines(context)) == 5
        assert "http://should-not-appear" not in context
        assert "Source:" not in context

"""Unit tests for consolidated growth parsing with temporal filters."""

from __future__ import annotations

from datetime import datetime, timezone

from services.linkedin.growth.consolidated_growth_service import ConsolidatedGrowthService

FIXED_NOW = datetime(2026, 8, 3, tzinfo=timezone.utc)


def _trending_item(
    *,
    topic: str = "AI Content Automation",
    why_now: str = "Posts about AI automation rose in Q2 2026.",
    hook: str = "AI-driven content creation is the fastest-growing LinkedIn topic in 2026.",
) -> dict:
    return {
        "topic": topic,
        "emoji": "🤖",
        "why_now": why_now,
        "suggested_hook": hook,
        "data_source_detail": "Exa search results",
        "confidence": "high",
    }


class TestConsolidatedGrowthTemporalParsing:
    def setup_method(self):
        self.service = ConsolidatedGrowthService()

    def test_parse_trending_excludes_stale_year_items(self):
        raw = {
            "trending_industry": "Technology",
            "trending_topics": [
                _trending_item(
                    why_now="LinkedIn surveys show a 42% rise in Q3 2024.",
                    hook="AI automation saves marketers 10 hours weekly.",
                ),
                _trending_item(topic="Generative SEO Tools"),
            ],
            "trending_data_source_summary": "Exa + AI",
        }

        result = self.service._parse_trending(raw, FIXED_NOW)

        assert len(result.trending_topics) == 1
        assert result.trending_topics[0].topic == "Generative SEO Tools"

    def test_parse_trending_keeps_current_year_items(self):
        raw = {
            "trending_industry": "Technology",
            "trending_topics": [_trending_item()],
            "trending_data_source_summary": "Exa + AI",
        }

        result = self.service._parse_trending(raw, FIXED_NOW)

        assert len(result.trending_topics) == 1
        assert "2026" in result.trending_topics[0].why_now

    def test_parse_engagement_excludes_stale_year_opportunities(self):
        raw = {
            "engagement_opportunities": [
                {
                    "title": "Old SEO debate",
                    "author": "Jane Doe",
                    "author_context": "SEO analyst",
                    "why_engage": "May 2024 Google update still drives comments.",
                    "suggested_comment": "Great point about the 2024 update.",
                    "data_source_detail": "Exa",
                    "confidence": "high",
                },
                {
                    "title": "Current AI workflow post",
                    "author": "John Smith",
                    "author_context": "Creator",
                    "why_engage": "Active thread on 2026 automation stacks.",
                    "suggested_comment": "We saw similar gains after adopting AI ops in 2026.",
                    "data_source_detail": "Exa",
                    "confidence": "medium",
                },
            ],
            "engagement_data_source_summary": "Exa + AI",
        }

        result = self.service._parse_engagement(raw, FIXED_NOW)

        assert len(result.opportunities) == 1
        assert result.opportunities[0].title == "Current AI workflow post"

    def test_parse_content_gaps_excludes_stale_year_gaps(self):
        raw = {
            "content_gaps": [
                {
                    "gap_topic": "Legacy SEO tactics",
                    "why_gap": "Creators still discuss 2023 tactics.",
                    "why_it_matters": "May 2024 update changed rankings.",
                    "suggested_angle": "Write about 2024 recovery steps.",
                    "data_source_detail": "Exa",
                    "confidence": "high",
                },
                {
                    "gap_topic": "Agentic workflows",
                    "why_gap": "Few creators explain implementation.",
                    "why_it_matters": "Demand spiked in 2026.",
                    "suggested_angle": "Share a 2026 agent stack breakdown.",
                    "data_source_detail": "Exa",
                    "confidence": "high",
                },
            ],
            "content_gaps_data_source_summary": "Exa + AI",
        }

        result = self.service._parse_content_gaps(raw, FIXED_NOW)

        assert len(result.gaps) == 1
        assert result.gaps[0].gap_topic == "Agentic workflows"

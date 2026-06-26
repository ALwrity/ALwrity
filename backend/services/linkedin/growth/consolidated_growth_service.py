import asyncio

from datetime import datetime
from typing import Optional

from models.linkedin_growth_models import (
    BrandDimension,
    BrandScorecardResponse,
    ConsolidatedGrowthResponse,
    ContentGapItem,
    ContentGapsResponse,
    DailyPostIdea,
    EngagementOpportunitiesResponse,
    EngagementOpportunityItem,
    NetworkSuggestionsResponse,
    NetworkSuggestionItem,
    TrendingTopicsResponse,
    TrendingTopicItem,
    ViralAnalysisResponse,
    ViralPattern,
    WeeklyStrategyResponse,
)
from loguru import logger
from pydantic import BaseModel, Field
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.llm_providers.main_text_generation import llm_text_gen
from .cache import growth_cache
from .circuit_breaker import protected_llm_call

class ConsolidatedLLMData(BaseModel):
    """Compact data model matching what the single LLM prompt returns."""

    trending_industry: str = Field(..., description="The user's industry")
    trending_topics: list[TrendingTopicItem] = Field(
        default_factory=list, description="Top trending topics (exactly 2)"
    )
    trending_data_source_summary: str = Field(
        ..., description="Transparency note for trending data"
    )

    network_suggestions: list[NetworkSuggestionItem] = Field(
        default_factory=list, description="People to connect with (exactly 2)"
    )
    network_data_source_summary: str = Field(
        ..., description="Transparency note for network suggestions"
    )

    engagement_opportunities: list[EngagementOpportunityItem] = Field(
        default_factory=list, description="Posts to engage with (exactly 2)"
    )
    engagement_data_source_summary: str = Field(
        ..., description="Transparency note for engagement data"
    )

    viral_industry: str = Field(..., description="The industry being analyzed")
    viral_patterns: list[ViralPattern] = Field(
        default_factory=list, description="Viral content patterns (exactly 2)"
    )
    viral_top_recommendation: str = Field(
        ..., description="Most impactful viral pattern to use"
    )
    viral_data_source_summary: str = Field(
        ..., description="Transparency note for viral analysis data"
    )

    strategy_theme: str = Field(
        ..., description="Overarching theme for the week"
    )
    strategy_week_of: str = Field(
        ..., description="Start date of this strategy week (ISO)"
    )
    strategy_daily_posts: list[DailyPostIdea] = Field(
        default_factory=list, description="Post ideas for Mon, Wed, Fri (exactly 3)"
    )
    strategy_key_topics: list[str] = Field(
        default_factory=list, description="Key topics to cover (exactly 3)"
    )
    strategy_focus_area: str = Field(
        ..., description="Primary focus for this week"
    )
    strategy_data_source_summary: str = Field(
        ..., description="Transparency note for strategy data"
    )

    content_gaps: list[ContentGapItem] = Field(
        default_factory=list, description="Content gaps (exactly 2)"
    )
    content_gaps_data_source_summary: str = Field(
        ..., description="Transparency note for content gap data"
    )

    brand_overall_score: int = Field(
        ..., description="Overall brand score 0-100", ge=0, le=100
    )
    brand_dimensions: list[BrandDimension] = Field(
        default_factory=list, description="Brand dimension scores (exactly 5)"
    )
    brand_top_recommendation: str = Field(
        ..., description="Most impactful brand improvement suggestion"
    )
    brand_data_source_summary: str = Field(
        ..., description="Transparency note for brand data"
    )


SYSTEM_PROMPT = """You are a LinkedIn growth strategist. Based on the user's profile, generate concise insights for ALL 7 sections below. Keep responses brief — 2 items per section maximum.

SECTIONS (all required, return the exact schema fields):

1. **Trending Topics** (2 items): topic label, emoji, why_now (1 sentence), suggested_hook (1 sentence).
2. **Network Suggestions** (2 items): name, title, company, why_connect (1 sentence), suggested_note (1-2 sentences).
3. **Engagement Opportunities** (2 items): title, author, author_context, why_engage (1 sentence), suggested_comment (1-2 sentences).
4. **Viral Content Patterns** (2 items): pattern_name, description (1 sentence), engagement_multiplier (e.g. "3x"), example_headline, example_author.
5. **Weekly Content Strategy** (3 items only — Mon, Wed, Fri): day, content_type, headline, hook, why_this_works. Include theme (1 phrase), key_topics (3 items), focus_area (1 phrase).
6. **Content Gaps** (2 items): gap_topic, why_gap (1 sentence), why_it_matters (1 sentence), suggested_angle (1 sentence).
7. **Brand Scorecard** (5 dimensions): Profile Completeness, Content Consistency, Authority Signals, Network Quality, Brand Clarity. Score each 0-100, give 1-sentence feedback each. Include overall_score and top_recommendation.

For ALL items: include data_source_detail (brief source attribution) and confidence ("high"/"medium"/"low").
For ALL data_source_summary fields: generate a 1-sentence transparency note specific to that section.
"""


class ConsolidatedGrowthService:
    """Generates all growth insights in a single LLM call."""

    def __init__(self):
        self._profile_repo: Optional[ProfileRepository] = None

    def _get_profile_repo(self):
        if self._profile_repo is None:
            from services.integrations.linkedin.profile_repository import (
                ProfileRepository,
            )

            self._profile_repo = ProfileRepository()
        return self._profile_repo

    async def analyze_all(self, user_id: str) -> ConsolidatedGrowthResponse:
        logger.info(f"[ConsolidatedGrowth] Starting consolidated analysis for user {user_id}")

        repo = self._get_profile_repo()
        profile_context = await asyncio.to_thread(repo.get_profile_context, user_id)
        context_str = str(profile_context)

        json_schema = ConsolidatedLLMData.model_json_schema()
        prompt = f"USER PROFILE:\n{context_str}\n\nGenerate insights for all 7 sections following the schema."
        llm_cache_key = growth_cache.llm_key(prompt + SYSTEM_PROMPT, user_id)

        cached_raw = growth_cache.get(llm_cache_key)
        if cached_raw is not None:
            logger.info("[ConsolidatedGrowth] LLM cache hit")
            raw = cached_raw
        else:
            try:
                raw = await protected_llm_call(
                    llm_text_gen,
                    prompt=prompt,
                    system_prompt=SYSTEM_PROMPT,
                    json_struct=json_schema,
                    user_id=user_id,
                )
                if raw:
                    growth_cache.set(llm_cache_key, raw, ttl_seconds=3600)
            except Exception as e:
                logger.error(f"[ConsolidatedGrowth] LLM call failed: {e}")
                raise RuntimeError(f"Consolidated LLM call failed: {e}") from e

        if not raw:
            logger.warning("[ConsolidatedGrowth] LLM returned empty data")
            raise RuntimeError("Consolidated LLM call returned empty data")

        if isinstance(raw, str):
            import json as _json
            raw = _json.loads(raw)

        if not isinstance(raw, dict):
            logger.warning("[ConsolidatedGrowth] LLM returned unexpected type: {}", type(raw))
            raise RuntimeError(f"Consolidated LLM returned unexpected type: {type(raw)}")

        now = datetime.now()

        return ConsolidatedGrowthResponse(
            trending=self._parse_trending(raw, now),
            network_suggestions=self._parse_network(raw, now),
            engagement_opportunities=self._parse_engagement(raw, now),
            viral_analysis=self._parse_viral(raw, now),
            weekly_strategy=self._parse_strategy(raw, now),
            content_gaps=self._parse_content_gaps(raw, now),
            brand_scorecard=self._parse_brand(raw, now),
            generated_at=now,
        )

    def _parse_trending(self, raw: dict, now: datetime) -> TrendingTopicsResponse:
        try:
            items = [TrendingTopicItem(**t) for t in raw.get("trending_topics", [])]
            return TrendingTopicsResponse(
                industry=raw.get("trending_industry", ""),
                trending_topics=items,
                data_source_summary=raw.get("trending_data_source_summary", ""),
                generated_at=now,
            )
        except Exception as e:
            logger.warning("[ConsolidatedGrowth] Failed to parse trending: {}", e)
            return TrendingTopicsResponse(generated_at=now)

    def _parse_network(self, raw: dict, now: datetime) -> NetworkSuggestionsResponse:
        try:
            items = [NetworkSuggestionItem(**s) for s in raw.get("network_suggestions", [])]
            return NetworkSuggestionsResponse(
                suggestions=items,
                data_source_summary=raw.get("network_data_source_summary", ""),
                generated_at=now,
            )
        except Exception as e:
            logger.warning("[ConsolidatedGrowth] Failed to parse network: {}", e)
            return NetworkSuggestionsResponse(generated_at=now)

    def _parse_engagement(self, raw: dict, now: datetime) -> EngagementOpportunitiesResponse:
        try:
            items = [EngagementOpportunityItem(**o) for o in raw.get("engagement_opportunities", [])]
            return EngagementOpportunitiesResponse(
                opportunities=items,
                data_source_summary=raw.get("engagement_data_source_summary", ""),
                generated_at=now,
            )
        except Exception as e:
            logger.warning("[ConsolidatedGrowth] Failed to parse engagement: {}", e)
            return EngagementOpportunitiesResponse(generated_at=now)

    def _parse_viral(self, raw: dict, now: datetime) -> ViralAnalysisResponse:
        try:
            patterns = [ViralPattern(**p) for p in raw.get("viral_patterns", [])]
            return ViralAnalysisResponse(
                industry=raw.get("viral_industry", ""),
                patterns=patterns,
                top_recommendation=raw.get("viral_top_recommendation", ""),
                data_source_summary=raw.get("viral_data_source_summary", ""),
                generated_at=now,
            )
        except Exception as e:
            logger.warning("[ConsolidatedGrowth] Failed to parse viral: {}", e)
            return ViralAnalysisResponse(generated_at=now)

    def _parse_strategy(self, raw: dict, now: datetime) -> WeeklyStrategyResponse:
        try:
            posts = [DailyPostIdea(**p) for p in raw.get("strategy_daily_posts", [])]
            return WeeklyStrategyResponse(
                theme=raw.get("strategy_theme", ""),
                week_of=raw.get("strategy_week_of", ""),
                daily_posts=posts,
                key_topics=raw.get("strategy_key_topics", []),
                focus_area=raw.get("strategy_focus_area", ""),
                data_source_summary=raw.get("strategy_data_source_summary", ""),
                generated_at=now,
            )
        except Exception as e:
            logger.warning("[ConsolidatedGrowth] Failed to parse strategy: {}", e)
            return WeeklyStrategyResponse(generated_at=now)

    def _parse_content_gaps(self, raw: dict, now: datetime) -> ContentGapsResponse:
        try:
            items = [ContentGapItem(**g) for g in raw.get("content_gaps", [])]
            return ContentGapsResponse(
                gaps=items,
                data_source_summary=raw.get("content_gaps_data_source_summary", ""),
                generated_at=now,
            )
        except Exception as e:
            logger.warning("[ConsolidatedGrowth] Failed to parse content gaps: {}", e)
            return ContentGapsResponse(generated_at=now)

    def _parse_brand(self, raw: dict, now: datetime) -> BrandScorecardResponse:
        try:
            dims = [BrandDimension(**d) for d in raw.get("brand_dimensions", [])]
            return BrandScorecardResponse(
                overall_score=raw.get("brand_overall_score", 0),
                dimensions=dims,
                top_recommendation=raw.get("brand_top_recommendation", ""),
                data_source_summary=raw.get("brand_data_source_summary", ""),
                generated_at=now,
            )
        except Exception as e:
            logger.warning("[ConsolidatedGrowth] Failed to parse brand: {}", e)
            return BrandScorecardResponse(generated_at=now)

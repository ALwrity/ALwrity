import asyncio
import json as _json

from datetime import datetime
from typing import Any, Dict, List, Optional

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


SYSTEM_PROMPT = """You are a LinkedIn growth strategist. Your task is to generate concise, data-grounded insights for ALL 7 sections listed below.

## CRITICAL RULES — NEVER VIOLATE

1. **YOU MUST GROUND EVERY ITEM IN THE PROVIDED DATA.** Every `data_source_detail` field must reference a specific search result, article, or profile data point. NEVER invent names, titles, companies, articles, or statistics.

2. **ANTI-HALLUCINATION:** If the provided research data does not contain enough information for a section, output an empty array for that section and an appropriate `data_source_summary` like "Insufficient search results to generate insights." Do NOT fabricate.

3. **CONFIDENCE MUST MATCH YOUR CERTAINTY:** Use "high" confidence only if the data directly supports the item. Use "medium" if partially supported. Use "low" if mostly extrapolated. Be honest.

4. You will receive a JSON schema below. Your output MUST be valid JSON matching the schema exactly. Do not add extra fields. Do not omit required fields.

5. Output ONLY valid JSON. No markdown, no code fences, no explanation text outside the JSON object.

## SECTIONS (all required)

1. **Trending Topics** (exactly 2 items): topic label, emoji, why_now (1 sentence), suggested_hook (1 sentence).
2. **Network Suggestions** (exactly 2 items): name, title, company, why_connect (1 sentence), suggested_note (1-2 sentences).
3. **Engagement Opportunities** (exactly 2 items): title, author, author_context, why_engage (1 sentence), suggested_comment (1-2 sentences).
4. **Viral Content Patterns** (exactly 2 items): pattern_name, description (1 sentence), engagement_multiplier (e.g. "3x"), example_headline, example_author.
5. **Weekly Content Strategy** (exactly 3 posts — Mon, Wed, Fri): day, content_type, headline, hook, why_this_works. Also theme (1 phrase), key_topics (3 items), focus_area (1 phrase).
6. **Content Gaps** (exactly 2 items): gap_topic, why_gap (1 sentence), why_it_matters (1 sentence), suggested_angle (1 sentence).
7. **Brand Scorecard** (exactly 5 dimensions — "Profile Completeness", "Content Consistency", "Authority Signals", "Network Quality", "Brand Clarity"): score 0-100 each, 1-sentence feedback each. Include overall_score and top_recommendation.

For ALL items: include `data_source_detail` (specific attribution to the research context provided) and `confidence` ("high"/"medium"/"low").
For ALL `data_source_summary` fields: write a 1-sentence transparency note specific to that section referencing the actual search queries used.

## ONE-SHOT EXAMPLE (Trending Topics section only, for format reference)

```json
{
  "topic": "AI in Healthcare",
  "emoji": "🏥",
  "why_now": "Recent FDA approvals for AI diagnostic tools have sparked industry-wide discussion.",
  "suggested_hook": "AI just got its first FDA nod for radiology. Here's what every healthcare exec needs to know.",
  "data_source_detail": "Cited from article 'AI Diagnostics Breakthrough' in the Exa search results under industry 'Healthcare'.",
  "confidence": "high"
}
```

Apply the same quality bar to ALL 7 sections.
"""


# ── Exa search queries per section ──────────────────────────────────────
SEARCH_QUERIES = {
    "trending": ["{industry} trends insights news {year}"],
    "network": ["leading {industry} {title} professionals thought leadership", "top voices in {industry} LinkedIn"],
    "engagement": ["{industry} thought leadership insights", "{industry} debate discussion analysis"],
    "viral": ["viral LinkedIn post {industry} high engagement", "trending LinkedIn content {industry} strategy", "LinkedIn post that went viral {industry}"],
    "content_gaps": ["hot topics {industry} {title} {year}", "underrated LinkedIn topics {industry} professionals should post about"],
}

SEARCH_RESULTS_PER_QUERY = 5


class ConsolidatedGrowthService:
    """Generates all growth insights in a single LLM call, grounded by Exa research."""

    def __init__(self):
        self._profile_repo: Optional[ProfileRepository] = None
        self._exa_provider = None

    def _get_profile_repo(self):
        if self._profile_repo is None:
            from services.integrations.linkedin.profile_repository import ProfileRepository
            self._profile_repo = ProfileRepository()
        return self._profile_repo

    def _get_exa_provider(self):
        if self._exa_provider is None:
            from services.research import get_exa_content_provider
            self._exa_provider = get_exa_content_provider()
        return self._exa_provider

    # ── Research helpers ────────────────────────────────────────────

    def _resolve_industry(self, user_id: str) -> str:
        repo = self._get_profile_repo()
        context = repo.get_profile_context(user_id)
        if context and isinstance(context, dict):
            industry = context.get("industry", "").strip()
            if industry:
                return industry
        return "Technology"

    def _resolve_title(self, user_id: str) -> str:
        repo = self._get_profile_repo()
        context = repo.get_profile_context(user_id)
        if context and isinstance(context, dict):
            title = context.get("headline", context.get("title", "")).strip()
            if title:
                return title
        return "professional"

    def _build_queries(self, queries_spec: list[str], industry: str, title: str) -> list[str]:
        year = datetime.now().year
        return [q.format(industry=industry, title=title, year=year) for q in queries_spec]

    async def _search_section(self, queries: list[str], user_id: str) -> list[Dict[str, Any]]:
        provider = self._get_exa_provider()
        if not provider:
            return []

        all_results: list[Dict[str, Any]] = []
        seen_urls: set[str] = set()

        for query in queries:
            cache_key = growth_cache.exa_key(query, SEARCH_RESULTS_PER_QUERY, user_id)
            cached = growth_cache.get(cache_key)
            if cached is not None:
                results = cached
            else:
                try:
                    results = await provider.simple_search(
                        query=query,
                        num_results=SEARCH_RESULTS_PER_QUERY,
                        user_id=user_id,
                    )
                    growth_cache.set(cache_key, results, ttl_seconds=300)
                except Exception as exc:
                    logger.warning("[ConsolidatedGrowth] Exa search failed for '{}': {}", query[:60], exc)
                    continue

            for r in results:
                url = r.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_results.append(r)

        return all_results

    def _serialize_articles(self, articles: list[Dict[str, Any]], max_count: int = 8) -> str:
        lines = []
        for i, a in enumerate(articles[:max_count], 1):
            title = a.get("title", "Untitled")
            snippet = (a.get("text") or a.get("snippet") or "")[:300]
            lines.append(f"{i}. {title}\n   {snippet}")
        return "\n\n".join(lines)

    # ── Main entry point ────────────────────────────────────────────

    async def analyze_all(self, user_id: str) -> ConsolidatedGrowthResponse:
        logger.info(f"[ConsolidatedGrowth] Starting consolidated analysis for user {user_id}")

        repo = self._get_profile_repo()
        profile_context = await asyncio.to_thread(repo.get_profile_context, user_id)
        context_str = str(profile_context)
        industry = self._resolve_industry(user_id)
        title = self._resolve_title(user_id)

        # Run all Exa searches in parallel
        logger.info("[ConsolidatedGrowth] Running Exa searches for all sections")
        search_tasks = {
            name: self._search_section(
                self._build_queries(queries, industry, title), user_id
            )
            for name, queries in SEARCH_QUERIES.items()
        }
        search_results = await asyncio.gather(*search_tasks.values(), return_exceptions=True)
        section_articles: Dict[str, list[Dict[str, Any]]] = {}
        for name, result in zip(search_tasks.keys(), search_results):
            if isinstance(result, Exception):
                logger.warning("[ConsolidatedGrowth] Search for {} failed: {}", name, result)
                section_articles[name] = []
            else:
                section_articles[name] = result

        # Build research context block
        research_lines = ["## RESEARCH CONTEXT"]
        for name in ["trending", "network", "engagement", "viral", "content_gaps"]:
            articles = section_articles.get(name, [])
            if articles:
                research_lines.append(f"\n### {name.upper()} SEARCH RESULTS")
                research_lines.append(self._serialize_articles(articles, max_count=8))
            else:
                research_lines.append(f"\n### {name.upper()} SEARCH RESULTS")
                research_lines.append("(No search results available for this section.)")

        research_context = "\n".join(research_lines)

        json_schema = ConsolidatedLLMData.model_json_schema()
        schema_str = _json.dumps(json_schema, indent=2)

        prompt = (
            f"## USER PROFILE\n{context_str}\n\n"
            f"## USER INDUSTRY\n{industry}\n\n"
            f"## USER ROLE/TITLE\n{title}\n\n"
            f"{research_context}\n\n"
            f"## REQUIRED JSON SCHEMA\n```json\n{schema_str}\n```\n\n"
            "Generate insights for all 7 sections above. Output ONLY valid JSON matching the provided schema."
        )

        llm_cache_key = growth_cache.llm_key(prompt + SYSTEM_PROMPT, user_id)
        cached_raw = growth_cache.get(llm_cache_key)
        if cached_raw is not None:
            logger.info("[ConsolidatedGrowth] LLM cache hit")
            raw = cached_raw
        else:
            raw = await self._call_llm_with_retry(prompt, user_id)
            if raw:
                growth_cache.set(llm_cache_key, raw, ttl_seconds=3600)

        if not raw:
            logger.warning("[ConsolidatedGrowth] LLM returned empty after retries")
            return self._empty_response()

        if isinstance(raw, str):
            raw = _json.loads(raw)

        if not isinstance(raw, dict):
            logger.warning("[ConsolidatedGrowth] LLM returned unexpected type: {}", type(raw))
            return self._empty_response()

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

    # ── Retry logic ─────────────────────────────────────────────────

    async def _call_llm_with_retry(self, prompt: str, user_id: str) -> Optional[Any]:
        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            try:
                system = SYSTEM_PROMPT
                if attempt > 1:
                    system += "\n\nIMPORTANT: Your previous response did not match the required JSON schema. Please output ONLY valid JSON matching the schema exactly. No extra text, no markdown."

                json_schema = ConsolidatedLLMData.model_json_schema()
                raw = await protected_llm_call(
                    llm_text_gen,
                    prompt=prompt,
                    system_prompt=system,
                    json_struct=json_schema,
                    user_id=user_id,
                )
                if raw:
                    if isinstance(raw, str):
                        _json.loads(raw)
                    return raw
            except (_json.JSONDecodeError, ValueError, TypeError) as e:
                logger.warning("[ConsolidatedGrowth] Attempt {}/{} parse failed: {}", attempt, max_attempts, e)
            except Exception as e:
                logger.error("[ConsolidatedGrowth] Attempt {}/{} LLM call failed: {}", attempt, max_attempts, e)
                if attempt == max_attempts:
                    raise RuntimeError(f"Consolidated LLM call failed after {max_attempts} attempts") from e
        return None

    # ── Empty fallback ──────────────────────────────────────────────

    def _empty_response(self) -> ConsolidatedGrowthResponse:
        now = datetime.now()
        return ConsolidatedGrowthResponse(
            trending=TrendingTopicsResponse(industry="", data_source_summary="", generated_at=now),
            network_suggestions=NetworkSuggestionsResponse(data_source_summary="", generated_at=now),
            engagement_opportunities=EngagementOpportunitiesResponse(data_source_summary="", generated_at=now),
            viral_analysis=ViralAnalysisResponse(industry="", data_source_summary="", generated_at=now),
            weekly_strategy=WeeklyStrategyResponse(data_source_summary="", generated_at=now),
            content_gaps=ContentGapsResponse(data_source_summary="", generated_at=now),
            brand_scorecard=BrandScorecardResponse(data_source_summary="", generated_at=now),
            generated_at=now,
        )

    # ── Parse helpers ───────────────────────────────────────────────

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

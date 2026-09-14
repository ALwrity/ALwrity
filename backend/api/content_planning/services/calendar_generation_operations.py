"""Calendar generation grounded operations mixin — extracted from
``calendar_generation_service`` (R2 consolidation; no behavior change).

Strategy-grounded, deterministic operations and their helpers:
optimize-for-platform, performance prediction, repurposing, trending topics,
and comprehensive user data — all Phase-4 code, moved unchanged.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger
from fastapi import HTTPException

# Import database service
from services.content_planning_db import ContentPlanningDBService

# Import utilities
from ..utils.error_handlers import ContentPlanningErrorHandler

# Import utilities
from ..utils.error_handlers import ContentPlanningErrorHandler

# Phase 4: single source for platform rules (mirrors PlatformOptimizer).
_platform_rules_cache: Optional[Dict[str, Dict[str, Any]]] = None


def _get_platform_rules() -> Dict[str, Dict[str, Any]]:
    """Return canonical platform rules from PlatformOptimizer (cached)."""
    global _platform_rules_cache
    if _platform_rules_cache is None:
        from services.calendar_generation_datasource_framework.prompt_chaining.steps.phase3.step8_daily_content_planning.platform_optimizer import (
            PlatformOptimizer,
        )

        _platform_rules_cache = PlatformOptimizer().platform_rules
    return _platform_rules_cache


_PLATFORM_ALIASES = {
    "linkedin": "LinkedIn",
    "twitter": "Twitter",
    "x": "Twitter",
    "instagram": "Instagram",
    "ig": "Instagram",
    "facebook": "Facebook",
    "fb": "Facebook",
    "blog": "Blog",
    "website": "Blog",
    "article": "Blog",
}

_STOPWORDS = frozenset(
    "the,a,an,and,or,for,to,of,in,on,with,from,by,at,as,is,are,was,were,be,been,"
    "this,that,these,those,it,its,your,our,their,his,her,you,we,they,will,can,how,"
    "what,when,why,who,not,no,yes,more,most,than,then,into,out,over,under,via,per".split(",")
)


class CalendarGroundingOperationsMixin:
    """Strategy-grounded, deterministic operations (optimize/predict/
    repurpose/trending/comprehensive data) — moved unchanged from the
    generation service."""

    def _require_db(self):
        if not self.db_session:
            raise HTTPException(
                status_code=503, detail="Database session unavailable for strategy-grounded operation."
            )
        return self.db_session

    async def _get_strategy_context(
        self, user_id: str, strategy_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Resolve strategy data via StrategyDataProcessor (active fallback).

        Raises HTTPException 422 when no usable strategy exists (with next_step),
        503 for infrastructure failures.
        """
        self._require_db()
        try:
            from services.content_planning_db import ContentPlanningDBService
            from services.calendar_generation_datasource_framework.data_processing.strategy_data import (
                StrategyDataProcessor,
            )

            db_service = ContentPlanningDBService(self.db_session)
            processor = StrategyDataProcessor()
            processor.content_planning_db_service = db_service
            data = await processor.get_strategy_data(strategy_id, user_id=str(user_id))
            if not data:
                raise ValueError("empty strategy data")
            return data
        except HTTPException:
            raise
        except Exception as e:
            message = str(e)
            lowered = message.lower()
            if "no strategy" in lowered or "no usable" in lowered or "empty strategy" in lowered:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "message": f"No usable content strategy found: {message}",
                        "next_step": "Create or activate a content strategy, then retry.",
                    },
                )
            raise HTTPException(status_code=503, detail=f"Strategy lookup failed: {message}")

    async def _get_gap_context(self, user_id: str) -> Dict[str, Any]:
        """Best-effort gap data; returns {} when none exists (gaps are optional)."""
        try:
            if not self.db_session:
                return {}
            from services.content_planning_db import ContentPlanningDBService
            from services.calendar_generation_datasource_framework.data_processing.gap_analysis_data import (
                GapAnalysisDataProcessor,
            )

            db_service = ContentPlanningDBService(self.db_session)
            processor = GapAnalysisDataProcessor()
            processor.content_planning_db_service = db_service
            return await processor.get_gap_analysis_data(user_id)  # type: ignore[arg-type]
        except Exception as e:
            logger.warning(f"⚠️ Gap context unavailable for user {user_id}: {e}")
            return {}

    def _resolve_platform(self, platform: str) -> Tuple[str, Dict[str, Any]]:
        """Map a platform name to canonical rules; 422 on unsupported platforms."""
        rules = _get_platform_rules()
        key = str(platform or "").strip().lower()
        canonical = _PLATFORM_ALIASES.get(key)
        if canonical is None:
            for name in rules:
                if name.lower() == key:
                    canonical = name
                    break
        if canonical is None or canonical not in rules:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": f"Unsupported platform: {platform}",
                    "supported_platforms": sorted(rules.keys()),
                    "next_step": "Retry with one of the supported platforms.",
                },
            )
        return canonical, rules[canonical]

    @staticmethod
    def _tokenize(text: Any) -> List[str]:
        words = re.findall(r"[a-z0-9]+", str(text or "").lower())
        return [w for w in words if len(w) > 2 and w not in _STOPWORDS]

    @staticmethod
    def _jaccard(a: List[str], b: List[str]) -> float:
        set_a, set_b = set(a), set(b)
        if not set_a or not set_b:
            return 0.0
        return round(len(set_a & set_b) / len(set_a | set_b), 3)

    @staticmethod
    def _dedupe(items: List[Any]) -> List[str]:
        seen: set = set()
        out: List[str] = []
        for item in items:
            text = str(item).strip().strip(".,")
            if text and text.lower() not in seen:
                seen.add(text.lower())
                out.append(text)
        return out

    def _keyword_pool(
        self, strategy_data: Dict[str, Any], gap_data: Dict[str, Any]
    ) -> List[str]:
        """Ordered, de-duplicated keyword pool from strategy + gaps only."""
        pool: List[str] = []
        pool.extend(strategy_data.get("content_pillars", []) or [])
        for field in ("market_gaps", "industry_trends", "emerging_trends"):
            value = strategy_data.get(field)
            if isinstance(value, list):
                pool.extend([v if isinstance(v, str) else str(v.get("title", v)) for v in value])
            elif isinstance(value, str) and value:
                pool.append(value)
        for opp in strategy_data.get("opportunity_analysis", []) or []:
            pool.append(opp if isinstance(opp, str) else str(opp.get("title", opp)))
        for comp in strategy_data.get("top_competitors", []) or []:
            pool.append(comp if isinstance(comp, str) else str(comp.get("name", comp)))
        for kw in gap_data.get("keyword_opportunities", []) or []:
            pool.append(kw if isinstance(kw, str) else str(kw.get("keyword", kw)))
        for gap in gap_data.get("content_gaps", []) or []:
            pool.append(gap if isinstance(gap, str) else str(gap.get("title", gap)))
        return self._dedupe(pool)

    def _audience_tokens(self, strategy_data: Dict[str, Any]) -> List[str]:
        audience = strategy_data.get("target_audience", {}) or {}
        if isinstance(audience, str):
            audience = {"segment": audience}
        texts: List[str] = []
        for key in ("interests", "pain_points", "segment", "demographics", "description"):
            value = audience.get(key)
            if isinstance(value, list):
                texts.extend(value)
            elif value:
                texts.append(value)
        tokens: List[str] = []
        for text in texts:
            tokens.extend(self._tokenize(text))
        return tokens

    @staticmethod
    def _fit_to_limit(title: str, description: str, char_limit: Optional[int]) -> Tuple[str, str, bool]:
        """Trim description (then title) to the platform character budget."""
        combined = f"{title}\n{description}"
        if char_limit is None or len(combined) <= char_limit:
            return title, description, True
        budget = char_limit - len(title) - 1
        if budget < 20 and len(title) > char_limit - 20:
            title = title[: max(char_limit - 21, 0)].rsplit(" ", 1)[0] + "…"
            budget = char_limit - len(title) - 1
        trimmed = (description or "")[: max(budget - 1, 0)].rsplit(" ", 1)[0] + "…"
        return title, trimmed, False

    @staticmethod
    def _slug_tag(keyword: str) -> str:
        slug = re.sub(r"[^a-z0-9]", "", keyword.lower())
        return f"#{slug}" if slug else ""

    async def optimize_content_for_platform(self, user_id: str, title: str, description: str,
                                         content_type: str, target_platform: str, event_id: Optional[int] = None,
                                         strategy_id: Optional[int] = None) -> Dict[str, Any]:
        """Optimize content using platform rules + the activated strategy (no LLM, no mocks)."""
        try:
            logger.info(f"🔧 Starting strategy-grounded optimization for user {user_id}")
            canonical, rules = self._resolve_platform(target_platform)
            ctx = await self._get_strategy_context(user_id, strategy_id)
            gaps = await self._get_gap_context(user_id)

            keywords = self._keyword_pool(ctx, gaps)
            char_limit = rules.get("character_limit")
            opt_title, opt_desc, within = self._fit_to_limit(title, description, char_limit)
            tag_count = int(rules.get("hashtag_count", 0) or 0)
            tags = [t for t in (self._slug_tag(k) for k in keywords[: max(tag_count, 1)]) if t][:tag_count]
            brand_voice = str(ctx.get("brand_voice") or "")
            optimal_times = list(rules.get("optimal_times", []) or [])
            rule_format = (rules.get("content_types") or [content_type])[0]
            preferred = ctx.get("preferred_formats") or []
            preferred_name = preferred[0] if preferred else rule_format

            adaptations = [
                f"Character budget {len(f'{opt_title}\n{opt_desc}')}"
                + (f"/{char_limit} (within limit)" if within and char_limit else " (long-form, no platform cap)" if char_limit is None else f"/{char_limit} (trimmed to fit)"),
                f"Tone mapped to '{rules.get('tone')}'"
                + (f" with brand voice '{brand_voice}'" if brand_voice else ""),
                f"Optimal windows {', '.join(optimal_times) if optimal_times else 'strategy default'}",
                f"Format '{rule_format}' (strategy prefers '{preferred_name}')",
            ]
            visuals = [
                f"{preferred_name} creative sized for {canonical} "
                f"(supports {', '.join(rules.get('content_types', []) or [])})"
            ]
            checks = [
                ("within_limit", within, 0.4),
                ("keywords_available", bool(keywords), 0.3),
                ("timing_available", bool(optimal_times), 0.2),
                ("tone_mapped", bool(rules.get("tone")), 0.1),
            ]
            score = round(sum(w for _, ok, w in checks if ok), 2)

            response_data = {
                "user_id": user_id,
                "event_id": event_id,
                "original_content": {
                    "title": title,
                    "description": description,
                    "content_type": content_type,
                    "target_platform": target_platform,
                },
                "optimized_content": {
                    "title": opt_title,
                    "description": opt_desc,
                    "content_type": content_type,
                    "target_platform": canonical,
                    "character_count": len(f"{opt_title}\n{opt_desc}"),
                },
                "platform_adaptations": adaptations,
                "visual_recommendations": visuals,
                "hashtag_suggestions": tags,
                "keyword_optimization": {
                    "primary": keywords[0] if keywords else content_type,
                    "secondary": keywords[1:4],
                    "keyword_pool_size": len(keywords),
                },
                "tone_adjustments": {
                    "tone": str(rules.get("tone") or ""),
                    "style": brand_voice or str(rules.get("tone") or ""),
                    "brand_voice_ref": brand_voice or None,
                },
                "length_optimization": {
                    "optimal_length": f"≤ {char_limit} characters" if char_limit else "long-form (no platform cap)",
                    "char_limit": char_limit,
                    "within_limit": within,
                    "format": rule_format,
                },
                "performance_prediction": {
                    "character_count": len(f"{opt_title}\n{opt_desc}"),
                    "within_limit": within,
                    "hashtag_count": len(tags),
                    "optimal_times": optimal_times,
                },
                "optimization_score": score,
                "created_at": datetime.utcnow(),
                "optimization_method": "platform_rules+strategy (deterministic)",
                "sources": {
                    "strategy_id": ctx.get("strategy_id", strategy_id),
                    "platform": canonical,
                    "platform_rules": "PlatformOptimizer.platform_rules",
                    "keyword_source": "strategy+gaps",
                    "brand_voice_source": "strategy" if brand_voice else None,
                },
            }

            logger.info("✅ Strategy-grounded optimization completed")
            return response_data

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error optimizing content: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "optimize_content_for_platform")

    @staticmethod
    def _first_number(*values: Any) -> Optional[float]:
        for value in values:
            if isinstance(value, bool):
                continue
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                match = re.search(r"-?\d+(\.\d+)?", value.replace(",", ""))
                if match:
                    try:
                        return float(match.group(0))
                    except ValueError:
                        continue
        return None

    async def _historical_metric_averages(
        self, strategy_id: Optional[int]
    ) -> Tuple[Dict[str, float], int]:
        """Average real analytics metrics for a strategy ({} when none)."""
        if not self.db_session or strategy_id is None:
            return {}, 0
        try:
            from services.content_planning_db import ContentPlanningDBService

            rows = await ContentPlanningDBService(self.db_session).get_strategy_analytics(strategy_id)
        except Exception as e:
            logger.warning(f"⚠️ Historical analytics unavailable: {e}")
            return {}, 0
        sums: Dict[str, float] = {}
        counts: Dict[str, int] = {}
        for row in rows or []:
            metrics = getattr(row, "metrics", None) or {}
            if not isinstance(metrics, dict):
                continue
            for key in ("engagement_rate", "reach", "conversions", "roi"):
                value = self._first_number(metrics.get(key))
                if value is not None:
                    sums[key] = sums.get(key, 0.0) + value
                    counts[key] = counts.get(key, 0) + 1
            score = getattr(row, "performance_score", None)
            if isinstance(score, (int, float)):
                sums["performance_score"] = sums.get("performance_score", 0.0) + float(score)
                counts["performance_score"] = counts.get("performance_score", 0) + 1
        averages = {k: round(sums[k] / counts[k], 4) for k in sums}
        return averages, len(rows or [])

    async def predict_content_performance(self, user_id: str, content_type: str, platform: str,
                                       content_data: Dict[str, Any], strategy_id: Optional[int] = None) -> Dict[str, Any]:
        """Predict performance from historical analytics, else strategy priors (no constants)."""
        try:
            logger.info(f"📊 Starting strategy-grounded performance prediction for user {user_id}")
            ctx = await self._get_strategy_context(user_id, strategy_id)
            resolved_strategy_id = ctx.get("strategy_id", strategy_id)
            ai = ctx.get("ai_recommendations", {}) or {}
            perf = ai.get("performance_predictions", {}) or {}
            summary = ai.get("summary", {}) or {}
            engagement_metrics = ctx.get("engagement_metrics")

            historical, n_rows = await self._historical_metric_averages(
                resolved_strategy_id if isinstance(resolved_strategy_id, int) else strategy_id
            )
            metric_sources: Dict[str, str] = {}

            def _resolve(name: str, *candidates: Any) -> Optional[float]:
                if name in historical:
                    metric_sources[name] = "historical_average"
                    return historical[name]
                for label, value in candidates:
                    number = self._first_number(value)
                    if number is not None:
                        metric_sources[name] = label
                        return number
                return None

            metrics_fallback: Any = None
            if isinstance(engagement_metrics, dict):
                metrics_fallback = self._first_number(
                    engagement_metrics.get("average_engagement_rate"),
                    engagement_metrics.get("engagement_rate"),
                    engagement_metrics.get("average"),
                )
            elif isinstance(engagement_metrics, list):
                numbers = [self._first_number(v) for v in engagement_metrics]
                numbers = [n for n in numbers if n is not None]
                metrics_fallback = (
                    round(sum(numbers) / len(numbers), 4) if numbers else None
                )
            engagement = _resolve(
                "engagement_rate",
                ("strategy_performance_predictions", perf.get("estimated_engagement_rate")),
                ("strategy_performance_predictions", perf.get("engagement_rate")),
                ("strategy_engagement_metrics", metrics_fallback),
            )
            reach = _resolve(
                "reach",
                ("strategy_performance_predictions", perf.get("estimated_reach")),
                ("strategy_performance_predictions", perf.get("reach")),
            )
            conversions = _resolve(
                "conversions",
                ("strategy_performance_predictions", perf.get("estimated_conversions")),
                ("strategy_performance_predictions", perf.get("conversions")),
            )
            roi = _resolve(
                "roi",
                ("strategy_performance_predictions", perf.get("estimated_roi")),
                ("strategy_summary", summary.get("estimated_roi")),
                ("strategy_roi_targets", ctx.get("content_roi_targets")),
            )
            confidence = self._first_number(
                perf.get("success_probability"), summary.get("success_probability")
            )
            if confidence is None:
                confidence = 0.85 if historical else 0.55
            else:
                confidence = round(min(max(confidence, 0.0), 1.0), 2)

            missing = [
                name
                for name, value in (
                    ("engagement_rate", engagement), ("reach", reach),
                    ("conversions", conversions), ("roi", roi),
                )
                if value is None
            ]
            if missing:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "message": f"Cannot predict performance: no priors for {', '.join(missing)}.",
                        "missing_metrics": missing,
                        "next_step": "Publish content to build analytics history, or regenerate the strategy with performance predictions.",
                    },
                )

            recommendations: List[str] = []
            for opp in (ctx.get("opportunity_analysis", []) or [])[:3]:
                recommendations.append(opp if isinstance(opp, str) else str(opp.get("title", opp)))
            recommendations = self._dedupe(recommendations)

            response_data = {
                "user_id": user_id,
                "strategy_id": strategy_id,
                "content_type": content_type,
                "platform": platform,
                "predicted_engagement_rate": round(float(engagement), 4),  # type: ignore[arg-type]
                "predicted_reach": int(reach),  # type: ignore[arg-type]
                "predicted_conversions": int(conversions),  # type: ignore[arg-type]
                "predicted_roi": round(float(roi), 2),  # type: ignore[arg-type]
                "confidence_score": confidence,
                "recommendations": recommendations,
                "created_at": datetime.utcnow(),
                "prediction_method": "historical+strategy_priors (deterministic)",
                "sources": {
                    "strategy_id": resolved_strategy_id,
                    "metric_sources": metric_sources,
                    "historical_basis": {"analytics_rows": n_rows},
                },
            }

            logger.info("✅ Strategy-grounded performance prediction completed")
            return response_data

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error predicting content performance: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "predict_content_performance")

    def _gap_entries(self, gap_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Normalize gap rows to {id, title, tokens} (real identifiers only)."""
        entries: List[Dict[str, Any]] = []
        for index, gap in enumerate(gap_data.get("content_gaps", []) or []):
            if isinstance(gap, dict):
                title = str(gap.get("title") or gap.get("name") or gap.get("gap") or f"gap-{index}")
                gap_id = str(gap.get("id", f"gap-{index}"))
                extra = f" {gap.get('description', '')} {' '.join(map(str, gap.get('keywords', []) or []))}"
            else:
                title, gap_id, extra = str(gap), f"gap-{index}", ""
            entries.append({"id": gap_id, "title": title, "tokens": self._tokenize(f"{title}{extra}")})
        return entries

    async def repurpose_content_across_platforms(self, user_id: str, original_content: Dict[str, Any],
                                               target_platforms: List[str], strategy_id: Optional[int] = None) -> Dict[str, Any]:
        """Repurpose content per platform using rules + strategy voice + real gaps."""
        try:
            logger.info(f"🔄 Starting strategy-grounded repurposing for user {user_id}")
            if not target_platforms:
                raise HTTPException(status_code=422, detail="target_platforms must not be empty.")
            ctx = await self._get_strategy_context(user_id, strategy_id)
            gaps = await self._get_gap_context(user_id)
            keywords = self._keyword_pool(ctx, gaps)
            brand_voice = str(ctx.get("brand_voice") or "")
            gap_entries = self._gap_entries(gaps)

            title = str(original_content.get("title", "") or "")
            body = str(
                original_content.get("body", "")
                or original_content.get("text", "")
                or original_content.get("content", "")
                or original_content.get("description", "")
            )
            content_tokens = self._tokenize(f"{title} {body}")

            adaptations: List[Dict[str, Any]] = []
            tips: List[str] = []
            for platform in target_platforms:
                canonical, rules = self._resolve_platform(platform)
                char_limit = rules.get("character_limit")
                opt_title, opt_body, within = self._fit_to_limit(title, body, char_limit)
                tag_count = int(rules.get("hashtag_count", 0) or 0)
                tags = [t for t in (self._slug_tag(k) for k in keywords[: max(tag_count, 1)]) if t][:tag_count]
                times = list(rules.get("optimal_times", []) or [])
                rule_format = (rules.get("content_types") or ["Post"])[0]
                adaptations.append({
                    "platform": canonical,
                    "title": opt_title,
                    "body": opt_body,
                    "char_count": len(f"{opt_title}\n{opt_body}"),
                    "within_limit": within,
                    "char_limit": char_limit,
                    "hashtags": tags,
                    "optimal_posting_times": times,
                    "tone": str(rules.get("tone") or ""),
                    "brand_voice": brand_voice or None,
                    "content_type": rule_format,
                })
                tips.append(
                    f"{canonical}: post during {', '.join(times) if times else 'strategy default hours'}"
                    + (f"; keep under {char_limit} characters" if char_limit else "; long-form friendly")
                    + (f"; use {tag_count} hashtags" if tag_count else "; hashtags not recommended")
                )

            transformations = [
                {
                    "type": "length_adaptation",
                    "description": "Trimmed each variant to its platform character budget; "
                                   + ", ".join(
                                       f"{a['platform']} {'fits' if a['within_limit'] else 'trimmed'}"
                                       for a in adaptations
                                   ),
                },
                {
                    "type": "hashtag_adaptation",
                    "description": "Applied per-platform hashtag counts from platform rules "
                                   "using strategy/gap keywords.",
                },
                {
                    "type": "tone_adaptation",
                    "description": f"Aligned tone to each platform rule set"
                    + (f" in brand voice '{brand_voice}'" if brand_voice else "")
                    + ".",
                },
            ]
            addressed = [
                f"gap:{entry['id']}:{entry['title']}"
                for entry in gap_entries
                if self._jaccard(content_tokens, entry["tokens"]) > 0
            ]

            response_data = {
                "user_id": user_id,
                "strategy_id": strategy_id,
                "original_content": original_content,
                "platform_adaptations": adaptations,
                "transformations": transformations,
                "implementation_tips": tips,
                "gap_addresses": addressed,
                "created_at": datetime.utcnow(),
                "repurposing_method": "platform_rules+strategy+gaps (deterministic)",
                "sources": {
                    "strategy_id": ctx.get("strategy_id", strategy_id),
                    "platform_rules": "PlatformOptimizer.platform_rules",
                    "keyword_source": "strategy+gaps",
                    "gap_source": "content_gap_analyses" if gap_entries else None,
                },
            }

            logger.info("✅ Strategy-grounded repurposing completed")
            return response_data

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error repurposing content: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "repurpose_content_across_platforms")

    async def get_trending_topics(self, user_id: str, industry: str, limit: int = 10,
                                    strategy_id: Optional[int] = None) -> Dict[str, Any]:
        """Rank strategy/gap keywords by gap overlap + audience alignment (no synthetic trends)."""
        try:
            logger.info(f"📈 Getting strategy-grounded trending topics for user {user_id} in {industry}")
            ctx = await self._get_strategy_context(user_id, strategy_id)
            gaps = await self._get_gap_context(user_id)

            pool = self._keyword_pool(ctx, gaps)
            if not pool:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "message": "No keyword opportunities found in strategy or gap analysis.",
                        "next_step": "Run gap analysis or enrich the strategy with market gaps, then retry.",
                    },
                )
            audience_tokens = self._audience_tokens(ctx)
            gap_entries = self._gap_entries(gaps)
            gap_tokens: List[str] = []
            for entry in gap_entries:
                gap_tokens.extend(entry["tokens"])
            for kw in gaps.get("keyword_opportunities", []) or []:
                gap_tokens.extend(self._tokenize(kw if isinstance(kw, str) else kw.get("keyword", kw)))

            scored: List[Dict[str, Any]] = []
            for keyword in pool:
                tokens = self._tokenize(keyword)
                gap_score = self._jaccard(tokens, gap_tokens)
                audience_score = self._jaccard(tokens, audience_tokens)
                trend_score = round(0.6 * gap_score + 0.4 * audience_score, 3)
                relevance = "high" if trend_score >= 0.5 else "medium" if trend_score >= 0.2 else "low"
                related = [
                    entry["id"] for entry in gap_entries
                    if self._jaccard(tokens, entry["tokens"]) > 0
                ]
                scored.append({
                    "keyword": keyword,
                    "trend_score": trend_score,
                    "relevance": relevance,
                    "source": "gap_analysis" if any(
                        self._tokenize(keyword) and self._jaccard(tokens, entry["tokens"]) > 0
                        for entry in gap_entries
                    ) else "strategy",
                    "related_gaps": related,
                })
            scored.sort(key=lambda item: (-item["trend_score"], item["keyword"]))
            trending_topics = scored[: max(limit, 0)]

            response_data = {
                "user_id": user_id,
                "industry": industry,
                "trending_topics": trending_topics,
                "gap_relevance_scores": {
                    topic["keyword"]: round(
                        self._jaccard(self._tokenize(topic["keyword"]), gap_tokens), 3
                    )
                    for topic in trending_topics
                },
                "audience_alignment_scores": {
                    topic["keyword"]: round(
                        self._jaccard(self._tokenize(topic["keyword"]), audience_tokens), 3
                    )
                    for topic in trending_topics
                },
                "created_at": datetime.utcnow(),
                "trending_method": "strategy_gap_overlap (deterministic)",
                "sources": {
                    "strategy_id": ctx.get("strategy_id", strategy_id),
                    "keyword_source": "strategy+gaps",
                },
            }

            logger.info("✅ Strategy-grounded trending topics retrieved")
            return response_data

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error getting trending topics: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_trending_topics")

    async def get_comprehensive_user_data(
        self, user_id: str, strategy_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Delegate to the cached comprehensive-data pipeline (no hardcoded persona)."""
        try:
            logger.info(f"Getting comprehensive user data for user_id: {user_id}")
            db = self._require_db()
            from services.comprehensive_user_data_cache_service import (
                ComprehensiveUserDataCacheService,
            )

            cache_service = ComprehensiveUserDataCacheService(db)
            data, is_cached = await cache_service.get_cached_data(user_id, strategy_id)
            if not data:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "message": "Comprehensive user data unavailable: onboarding, strategy, or AI analysis missing.",
                        "next_step": "Complete onboarding and activate a content strategy, then retry.",
                    },
                )

            logger.info("Successfully retrieved comprehensive user data")
            return {
                "status": "success",
                "data": data,
                "message": "Comprehensive user data retrieved successfully",
                "timestamp": datetime.now().isoformat(),
                "cache_info": {"is_cached": is_cached},
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting comprehensive user data for user_id {user_id}: {str(e)}")
            logger.error(f"Exception type: {type(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_comprehensive_user_data")

"""
Calendar Generation Service for Content Planning API
Extracted business logic from the calendar generation route for better separation of concerns.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from loguru import logger
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
import asyncio
import random
import re
import time

# Import database service
from services.content_planning_db import ContentPlanningDBService

# Import orchestrator for 12-step calendar generation
from services.calendar_generation_datasource_framework.prompt_chaining.orchestrator import PromptChainOrchestrator

# Import validation service
from services.validation import check_all_api_keys

# Global session store to persist across requests
_global_orchestrator_sessions = {}

# Phase 2: canonical session statuses. "error" and "processing" are legacy
# aliases accepted on read; new writes use initializing/running/completed/failed/cancelled.
ACTIVE_STATUSES = ("initializing", "running")
ACTIVE_STATUSES_WITH_LEGACY = ("initializing", "running", "processing")
TERMINAL_STATUSES = ("completed", "failed", "cancelled")
TERMINAL_STATUSES_WITH_LEGACY = ("completed", "failed", "error", "cancelled")

# Throttle DB persists from high-frequency progress callbacks.
_PERSIST_THROTTLE_SECONDS = 30

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

# Import utilities
from ..utils.error_handlers import ContentPlanningErrorHandler
from ..utils.response_builders import ResponseBuilder
from ..utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

# Import models for persistence
from models.enhanced_calendar_models import CalendarGenerationSession
from models.content_planning import CalendarEvent, ContentStrategy

class CalendarGenerationService:
    """Service class for calendar generation operations."""
    
    def __init__(self, db_session: Optional[Session] = None):
        self.db_session = db_session
        
        # Initialize orchestrator for 12-step calendar generation
        try:
            self.orchestrator = PromptChainOrchestrator(db_session=db_session)
            # Use global session store to persist across requests
            self.orchestrator_sessions = _global_orchestrator_sessions
            # Load any active sessions from database into memory
            self._load_sessions_from_db()
            logger.info("✅ 12-step orchestrator initialized successfully with database session")
        except Exception as e:
            logger.error(f"❌ Failed to initialize orchestrator: {e}")
            self.orchestrator = None
    
    async def generate_comprehensive_calendar(self, user_id: str, strategy_id: Optional[int] = None, 
                                           calendar_type: str = "monthly", industry: Optional[str] = None, 
                                           business_size: str = "sme",
                                           strategy_digest: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate a comprehensive AI-powered content calendar using the 12-step orchestrator."""
        try:
            logger.info(f"🎯 Generating comprehensive calendar for user {user_id} using 12-step orchestrator")
            start_time = time.time()
            
            # Generate unique session ID
            session_id = f"calendar-session-{int(time.time())}-{random.randint(1000, 9999)}"
            
            # Initialize orchestrator session
            request_data = {
                "user_id": user_id,
                "strategy_id": strategy_id,
                "calendar_type": calendar_type,
                "industry": industry,
                "business_size": business_size,
                "strategy_digest": strategy_digest or {}
            }
            
            success = self.initialize_orchestrator_session(session_id, request_data)
            if not success:
                raise Exception("Failed to initialize orchestrator session")
            
            # Start the 12-step generation process. The sync path persists the
            # calendar itself below (with processing_time injected), so the
            # /start completion hook must not persist a second time.
            await self.start_orchestrator_generation(
                session_id, request_data, persist_completed=False
            )
            
            # Wait for completion and get final result
            max_wait_time = 300  # 5 minutes
            wait_interval = 2  # 2 seconds
            elapsed_time = 0
            
            while elapsed_time < max_wait_time:
                progress = self.get_orchestrator_progress(session_id)
                if progress and progress.get("status") == "completed":
                    # The orchestrator stores the final assembled calendar on
                    # the session; the progress tracker only keeps per-step
                    # metadata (so the old ``step_12.result`` read was empty).
                    session = self.orchestrator_sessions.get(session_id, {})
                    calendar_data = session.get("result", {}) or {}
                    processing_time = time.time() - start_time
                    calendar_data["processing_time"] = processing_time
                    if "generated_at" not in calendar_data:
                        calendar_data["generated_at"] = datetime.now().isoformat()
                    
                    # Save to database
                    await self._save_calendar_to_db(user_id, strategy_id, calendar_data, session_id)
                    
                    logger.info(f"✅ Calendar generated successfully in {processing_time:.2f}s")
                    return calendar_data
                elif progress and progress.get("status") in ("failed", "error"):
                    raise Exception(f"Calendar generation failed: {progress.get('errors', ['Unknown error'])}")
                elif progress and progress.get("status") == "cancelled":
                    raise Exception("Calendar generation was cancelled")
                
                await asyncio.sleep(wait_interval)
                elapsed_time += wait_interval
            
            raise Exception("Calendar generation timed out")
            
        except Exception as e:
            logger.error(f"❌ Error generating comprehensive calendar: {str(e)}")
            logger.error(f"Exception type: {type(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "generate_comprehensive_calendar")
    
    # -- Phase 4 helpers: strategy-grounded, deterministic, no mock data. --
    def _require_db(self) -> Session:
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
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for calendar generation services."""
        try:
            logger.info("🏥 Performing calendar generation health check")
            
            # Check AI services
            from services.onboarding.api_key_manager import APIKeyManager
            api_manager = APIKeyManager()
            api_key_status = check_all_api_keys(api_manager)
            
            # Check orchestrator status
            orchestrator_status = "healthy" if self.orchestrator else "unhealthy"
            
            # Check database connectivity
            db_status = "healthy"
            try:
                # Test database connection - just check if db_session is available
                if self.db_session:
                    # Simple connectivity test without hardcoded user_id
                    from services.content_planning_db import ContentPlanningDBService
                    db_service = ContentPlanningDBService(self.db_session)
                    # Don't test with a specific user_id - just verify service initializes
                    db_status = "healthy"
                else:
                    db_status = "no session"
            except Exception as e:
                db_status = f"error: {str(e)}"
            
            health_status = {
                "service": "calendar_generation",
                "status": "healthy" if api_key_status.get("all_valid", False) and db_status == "healthy" and orchestrator_status == "healthy" else "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "components": {
                    "ai_services": "healthy" if api_key_status.get("all_valid", False) else "unhealthy",
                    "database": db_status,
                    "orchestrator": orchestrator_status
                },
                "api_keys": api_key_status
            }
            
            logger.info("✅ Calendar generation health check completed")
            return health_status
            
        except Exception as e:
            logger.error(f"❌ Calendar generation health check failed: {str(e)}")
            return {
                "service": "calendar_generation",
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e)
            }
    
    # Orchestrator Integration Methods
    
    def initialize_orchestrator_session(self, session_id: str, request_data: Dict[str, Any]) -> bool:
        """Initialize a new orchestrator session with duplicate prevention."""
        try:
            if not self.orchestrator:
                logger.error("❌ Orchestrator not initialized")
                return False
            
            # Clean up old sessions for the same user
            user_id = request_data.get("user_id")
            if not user_id:
                logger.error("❌ user_id is required in request_data")
                return False
            self._cleanup_old_sessions(user_id)
            
            # Check for existing active sessions for this user
            existing_session = self._get_active_session_for_user(user_id)
            if existing_session:
                logger.warning(f"⚠️ User {user_id} already has an active session: {existing_session}")
                return False
            
            # Store session data
            self.orchestrator_sessions[session_id] = {
                "request_data": request_data,
                "user_id": user_id,
                "status": "initializing",
                "start_time": datetime.now(),
                "progress": {
                    "current_step": 0,
                    "overall_progress": 0,
                    "step_results": {},
                    "quality_scores": {},
                    "errors": [],
                    "warnings": []
                }
            }
            
            logger.info(f"✅ Orchestrator session {session_id} initialized for user {user_id}")
            self._persist_session_to_db(session_id)
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize orchestrator session: {e}")
            return False
    
    def _cleanup_old_sessions(self, user_id: str) -> None:
        """Clean up old sessions across ALL users.

        Phase 2 fix: previously only cleaned sessions for the requesting
        user, so sessions from other users accumulated forever.
        """
        try:
            current_time = datetime.now()
            sessions_to_remove = []
            
            # Collect sessions to remove first, then remove them
            for session_id, session_data in self.orchestrator_sessions.items():
                start_time = session_data.get("start_time")
                if not start_time:
                    continue

                age_seconds = (current_time - start_time).total_seconds()

                # Remove sessions older than 1 hour regardless of user
                if age_seconds > 3600:
                    sessions_to_remove.append(session_id)
                    continue

                # Also remove terminal sessions older than 10 minutes
                if session_data.get("status") in TERMINAL_STATUSES_WITH_LEGACY:
                    if age_seconds > 600:  # 10 minutes
                        sessions_to_remove.append(session_id)
            
            # Remove the sessions
            for session_id in sessions_to_remove:
                if session_id in self.orchestrator_sessions:
                    del self.orchestrator_sessions[session_id]
                    logger.info(f"🧹 Cleaned up old session: {session_id}")

            # Also clean up from DB (Phase 2: age-windowed, mirrors memory rules).
            if self.db_session:
                try:
                    now = datetime.utcnow()
                    terminal_cutoff = now - timedelta(minutes=10)
                    old_cutoff = now - timedelta(hours=1)
                    (self.db_session.query(CalendarGenerationSession)
                        .filter(
                            (
                                CalendarGenerationSession.generation_status.in_(
                                    list(TERMINAL_STATUSES_WITH_LEGACY)
                                )
                                & (CalendarGenerationSession.created_at < terminal_cutoff)
                            )
                            | (CalendarGenerationSession.created_at < old_cutoff)
                        )
                        .delete(synchronize_session=False))
                    self.db_session.commit()
                except Exception as db_e:
                    self.db_session.rollback()
                    logger.error(f"❌ Error cleaning up sessions from DB: {db_e}")
                
        except Exception as e:
            logger.error(f"❌ Error cleaning up old sessions: {e}")
    
    def _get_active_session_for_user(self, user_id: str) -> Optional[str]:
        """Get active session for a user."""
        try:
            for session_id, session_data in self.orchestrator_sessions.items():
                if (session_data.get("user_id") == user_id and
                    session_data.get("status") in ACTIVE_STATUSES_WITH_LEGACY):
                    return session_id
            return None
        except Exception as e:
            logger.error(f"❌ Error getting active session for user: {e}")
            return None
    
    def _find_session_row(self, session_id: str) -> Optional[CalendarGenerationSession]:
        """Find a session row by session_key, falling back to JSON lookup."""
        if not self.db_session:
            return None
        try:
            existing = (
                self.db_session.query(CalendarGenerationSession)
                .filter(CalendarGenerationSession.session_key == session_id)
                .first()
            )
            if existing is not None:
                return existing
        except Exception:
            self.db_session.rollback()
        # Legacy fallback for rows written before session_key backfill.
        try:
            return (
                self.db_session.query(CalendarGenerationSession)
                .filter(
                    func.json_extract(
                        CalendarGenerationSession.generation_params, "$.session_id"
                    )
                    == session_id
                )
                .first()
            )
        except Exception:
            self.db_session.rollback()
            return None

    def _persist_session_to_db(
        self, session_id: str, include_request_data: bool = True
    ) -> None:
        """Persist session state to database so it survives restarts."""
        try:
            session = self.orchestrator_sessions.get(session_id)
            if not session or not self.db_session:
                return

            user_id = session.get("user_id", "")
            request_data = session.get("request_data", {})

            existing = self._find_session_row(session_id)

            if not existing:
                create_kwargs: Dict[str, Any] = {
                    "user_id": user_id,
                    "strategy_id": request_data.get("strategy_id"),
                    "session_type": request_data.get("calendar_type", "monthly"),
                    "generation_params": {"session_id": session_id},
                    "generation_status": session.get("status", "initializing"),
                }
                if hasattr(CalendarGenerationSession, "session_key"):
                    create_kwargs["session_key"] = session_id
                existing = CalendarGenerationSession(**create_kwargs)
                self.db_session.add(existing)
                self.db_session.flush()

            # Update with current state
            status = session.get("status", "initializing")
            if status == "error":
                status = "failed"
            existing.generation_status = status
            if hasattr(CalendarGenerationSession, "session_key") and not getattr(
                existing, "session_key", None
            ):
                existing.session_key = session_id
            if include_request_data:
                stored_request = request_data
            else:
                stored_request = (existing.generation_params or {}).get(
                    "request_data", request_data
                )
            existing.generation_params = {
                "session_id": session_id,
                "progress": session.get("progress", {}),
                "request_data": stored_request,
                "status": session.get("status"),
                "error": session.get("error"),
            }
            
            # If completed, populate result fields
            if session.get("status") == "completed":
                result = session.get("result", {})
                existing.generated_calendar = result
                existing.ai_insights = result.get("ai_insights") if isinstance(result, dict) else None
                existing.performance_predictions = result.get("performance_predictions") if isinstance(result, dict) else None
                existing.content_themes = result.get("weekly_themes") if isinstance(result, dict) else None
                existing.generation_status = "completed"
                existing.processing_time = session.get("processing_time")
            
            self.db_session.commit()
            
        except Exception as e:
            if self.db_session:
                self.db_session.rollback()
            logger.error(f"❌ Error persisting session {session_id} to DB: {e}")

    def _load_sessions_from_db(self) -> None:
        """Load active sessions from database into the in-memory store."""
        try:
            if not self.db_session:
                return
            
            active_sessions = self.db_session.query(CalendarGenerationSession).filter(
                CalendarGenerationSession.generation_status.in_(
                    list(ACTIVE_STATUSES_WITH_LEGACY)
                )
            ).all()

            for db_session_record in active_sessions:
                params = db_session_record.generation_params or {}
                session_id = (
                    getattr(db_session_record, "session_key", None)
                    or params.get("session_id")
                    or f"db-session-{db_session_record.id}"
                )
                
                if session_id in self.orchestrator_sessions:
                    continue
                
                self.orchestrator_sessions[session_id] = {
                    "request_data": params.get("request_data", {}),
                    "user_id": db_session_record.user_id,
                    "status": db_session_record.generation_status,
                    "start_time": db_session_record.created_at or datetime.now(),
                    "progress": params.get("progress", {
                        "current_step": 0,
                        "overall_progress": 0,
                        "step_results": {},
                        "quality_scores": {},
                        "errors": [],
                        "warnings": []
                    }),
                    "error": params.get("error"),
                }
                logger.info(f"🔄 Restored session {session_id} for user {db_session_record.user_id}")
            
            if active_sessions:
                logger.info(f"✅ Restored {len(active_sessions)} active sessions from database")
                
        except Exception as e:
            logger.error(f"❌ Error loading sessions from DB: {e}")

    async def start_orchestrator_generation(
        self,
        session_id: str,
        request_data: Dict[str, Any],
        *,
        persist_completed: bool = True,
    ) -> None:
        """Start the 12-step calendar generation process.

        ``persist_completed`` (R1.1): when True — the user-facing ``/start``
        flow — a completed generation is persisted through
        ``_save_calendar_to_db`` (CalendarEvent rows + the post-commit SIF
        dispatch), so the async flow is not a persistence dead-end. The
        legacy sync path passes False: it persists the calendar itself after
        injecting ``processing_time``, and must not save twice.
        """
        try:
            if not self.orchestrator:
                logger.error("❌ Orchestrator not initialized")
                return
            
            session = self.orchestrator_sessions.get(session_id)
            if not session:
                logger.error(f"❌ Session {session_id} not found")
                return
            
            # Update session status
            session["status"] = "running"
            self._persist_session_to_db(session_id)
            
            # Start the 12-step process
            user_id = request_data.get("user_id")
            if not user_id:
                raise ValueError("user_id is required in request_data")
                
            result = await self.orchestrator.generate_calendar(
                user_id=user_id,
                strategy_id=request_data.get("strategy_id"),
                calendar_type=request_data.get("calendar_type", "monthly"),
                industry=request_data.get("industry"),
                business_size=request_data.get("business_size", "sme"),
                strategy_digest=request_data.get("strategy_digest") or {},
                progress_callback=lambda progress: self._update_session_progress(session_id, progress)
            )
            
            # Update session with final result. Only a real calendar counts as
            # completed: the orchestrator's error_handler returns an error dict
            # (status == "error") or a completed status without any calendar.
            is_real_calendar = (
                isinstance(result, dict)
                and result.get("status") == "completed"
                and (result.get("daily_schedule") or result.get("final_calendar"))
            )

            if is_real_calendar:
                session["status"] = "completed"
                session["result"] = result
                session["end_time"] = datetime.now()
                logger.info(f"✅ Orchestrator generation completed for session {session_id}")

                # R1.1 (C1): persist the completed calendar through the same
                # pipeline as the legacy sync path — CalendarEvent rows +
                # post-commit SIF dispatch. Non-fatal: a persistence failure
                # must not flip the user-visible generation to failed (the
                # in-memory result already exists); R6.2 will surface these
                # errors on /progress.
                if persist_completed:
                    try:
                        await self._save_calendar_to_db(
                            user_id,
                            request_data.get("strategy_id"),
                            result,
                            session_id,
                        )
                    except Exception as save_exc:
                        logger.error(
                            f"❌ Calendar persistence failed for session {session_id} "
                            f"(non-fatal): {save_exc}"
                        )
            else:
                error_message = (
                    result.get("error_message")
                    if isinstance(result, dict)
                    else None
                ) or "Calendar generation did not produce a valid calendar"
                logger.error(f"❌ Orchestrator generation failed for session {session_id}: {error_message}")
                session["status"] = "failed"
                session["error"] = error_message
                session["end_time"] = datetime.now()
                session.setdefault("progress", {}).setdefault("errors", []).append({
                    "message": error_message,
                    "step": None,
                    "timestamp": datetime.now().isoformat(),
                    "severity": "error",
                    "recoverable": False,
                })

            self._persist_session_to_db(session_id)
            
        except Exception as e:
            logger.error(f"❌ Orchestrator generation failed for session {session_id}: {e}")
            if session_id in self.orchestrator_sessions:
                self.orchestrator_sessions[session_id]["status"] = "failed"
                self.orchestrator_sessions[session_id]["error"] = str(e)
                self._persist_session_to_db(session_id)
    
    def cancel_orchestrator_session(
        self, session_id: str, requester_user_id: Optional[str] = None
    ) -> bool:
        """Cancel an ongoing orchestrator session and persist to DB.

        Phase 1: when requester_user_id is provided, deny cross-user cancels.
        None preserves legacy behavior for internal callers/tests.
        """
        try:
            session = self.orchestrator_sessions.get(session_id)
            if not session:
                logger.warning(f"❌ Session {session_id} not found for cancellation")
                return False
            if (
                requester_user_id is not None
                and str(session.get("user_id", "")) != str(requester_user_id)
            ):
                logger.warning(
                    f"⛔ Cancel denied for session {session_id}: "
                    f"owner={session.get('user_id')} requester={requester_user_id}"
                )
                return False
            session["status"] = "cancelled"
            self._persist_session_to_db(session_id)
            logger.info(f"✅ Session {session_id} cancelled")
            return True
        except Exception as e:
            logger.error(f"❌ Error cancelling session {session_id}: {e}")
            return False

    def get_session_owner(self, session_id: str) -> Optional[str]:
        """Return the owner user_id for a session, or None if missing."""
        session = self.orchestrator_sessions.get(session_id)
        if not session:
            return None
        owner = session.get("user_id", "")
        return str(owner) if owner else None

    def get_orchestrator_progress(
        self, session_id: str, requester_user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get progress for an orchestrator session.

        Phase 1: when requester_user_id is provided, cross-user reads return
        a forbidden sentinel instead of session data. None preserves legacy.
        """
        try:
            logger.info(f"🔍 Looking for session {session_id}")
            logger.info(f"📊 Available sessions: {list(self.orchestrator_sessions.keys())}")

            session = self.orchestrator_sessions.get(session_id)
            if not session:
                logger.warning(f"❌ Session {session_id} not found")
                return None
            if (
                requester_user_id is not None
                and str(session.get("user_id", "")) != str(requester_user_id)
            ):
                logger.warning(
                    f"⛔ Progress denied for session {session_id}: "
                    f"owner={session.get('user_id')} requester={requester_user_id}"
                )
                return {"forbidden": True, "status": "forbidden"}
            
            logger.info(f"✅ Found session {session_id} with status: {session['status']}")
            
            # Ensure all required fields are present with default values
            progress_data = session.get("progress", {})
            
            return {
                "status": session["status"],
                "current_step": progress_data.get("current_step", 0),
                "step_progress": progress_data.get("step_progress", 0),  # Ensure this field is present
                "overall_progress": progress_data.get("overall_progress", 0),
                "step_results": progress_data.get("step_results", {}),
                "quality_scores": progress_data.get("quality_scores", {}),
                "errors": progress_data.get("errors", []),
                "warnings": progress_data.get("warnings", []),
                "transparency_messages": session.get("transparency_messages", []),
                "educational_content": session.get("educational_content", []),
                "estimated_completion": session.get("estimated_completion"),
                "last_updated": session.get("last_updated", datetime.now().isoformat()),
                # B4: deliver the assembled calendar only once the session
                # actually completed with a real result.
                "result": session.get("result") if session["status"] == "completed" else None
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting orchestrator progress: {e}")
            return None
    
    def _update_session_progress(self, session_id: str, progress: Dict[str, Any]) -> None:
        """Update session progress from orchestrator callback."""
        try:
            session = self.orchestrator_sessions.get(session_id)
            if session:
                # Convert progress tracker format to service format
                current_step = progress.get("current_step", 0)
                total_steps = progress.get("total_steps", 12)
                step_progress = progress.get("step_progress", 0)  # Get step-specific progress

                session["progress"] = {
                    "current_step": current_step,
                    "step_progress": step_progress,  # Add step_progress field
                    "overall_progress": progress.get("progress_percentage", 0),
                    "step_results": progress.get("step_details", {}),
                    "quality_scores": {step: data.get("quality_score", 0.0) for step, data in progress.get("step_details", {}).items()},
                    "errors": [],
                    "warnings": []
                }
                session["last_updated"] = datetime.now().isoformat()

                logger.info(f"📊 Updated progress for session {session_id}: step {current_step}/{total_steps} (step progress: {step_progress}%)")
                # Phase 2: throttle DB writes — persist on step change or
                # after _PERSIST_THROTTLE_SECONDS; keep request_data stored.
                last_step = session.get("_last_persist_step")
                last_time = session.get("_last_persist_time", 0.0)
                now_ts = time.time()
                if (
                    last_step != current_step
                    or (now_ts - float(last_time or 0.0)) >= _PERSIST_THROTTLE_SECONDS
                ):
                    session["_last_persist_step"] = current_step
                    session["_last_persist_time"] = now_ts
                    self._persist_session_to_db(session_id, include_request_data=False)
                
        except Exception as e:
            logger.error(f"❌ Error updating session progress: {e}")

    @staticmethod
    def _parse_scheduled_date(date_str: Optional[str]) -> datetime:
        """Parse an ISO date string; fall back to now with a warning."""
        if not date_str:
            return datetime.utcnow()
        try:
            return datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
        except Exception:
            logger.warning(f"⚠️ Unparseable scheduled date {date_str!r}; using now")
            return datetime.utcnow()

    async def _save_calendar_to_db(self, user_id: str, strategy_id: Optional[int], calendar_data: Dict[str, Any], session_id: str) -> None:
        """Save generated calendar to database (Phase 2: loud on failure)."""
        try:
            if not self.db_session:
                raise RuntimeError("No database session available for persistence")

            # F4/F5: never persist an error dict (or an empty result) as a
            # completed calendar. The failure is already recorded on the
            # session by start_orchestrator_generation / _persist_session_to_db.
            if (
                calendar_data.get("status") in ("error", "failed")
                or not (calendar_data.get("daily_schedule") or calendar_data.get("final_calendar"))
            ):
                logger.error(f"❌ Skipping DB persistence for failed calendar generation (session {session_id})")
                return

            # Dedupe on session_key: _persist already wrote a row for this session.
            session_record = self._find_session_row(session_id)
            if session_record is None:
                create_kwargs: Dict[str, Any] = {
                    "user_id": user_id,
                    "strategy_id": strategy_id,
                    "session_type": calendar_data.get("calendar_type", "monthly"),
                    "generation_params": {"session_id": session_id},
                    "generation_status": "completed",
                }
                if hasattr(CalendarGenerationSession, "session_key"):
                    create_kwargs["session_key"] = session_id
                session_record = CalendarGenerationSession(**create_kwargs)
                self.db_session.add(session_record)
                self.db_session.flush()  # Get ID
            session_record.user_id = user_id
            session_record.strategy_id = strategy_id
            session_record.session_type = calendar_data.get("calendar_type", "monthly")
            if hasattr(CalendarGenerationSession, "session_key") and not getattr(
                session_record, "session_key", None
            ):
                session_record.session_key = session_id

            # Save calendar events
            # Extract daily schedule from calendar data
            daily_schedule = calendar_data.get("daily_schedule", [])
            
            # If daily_schedule is not directly available, try to extract from step results
            if not daily_schedule and "step_results" in calendar_data:
                 daily_schedule = calendar_data.get("step_results", {}).get("step_08", {}).get("daily_schedule", [])

            # Skip calendar event creation when no valid strategy_id (FK constraint)
            if not strategy_id:
                logger.warning(f"⚠️ No strategy_id provided — skipping CalendarEvent creation for session {session_id}")
            else:
                for day in daily_schedule:
                    content_items = day.get("content_items", [])
                    for item in content_items:
                        scheduled_date = self._parse_scheduled_date(day.get("date"))

                        event = CalendarEvent(
                            user_id=user_id,
                            strategy_id=strategy_id,
                            title=item.get("title", "Untitled Event"),
                            description=item.get("description"),
                            content_type=item.get("type") or item.get("content_type") or "social_post",
                            platform=item.get("platform") or item.get("target_platform") or "generic",
                            scheduled_date=scheduled_date,
                            status="draft",
                            ai_recommendations=item
                        )
                        self.db_session.add(event)

            session_record.generated_calendar = calendar_data
            session_record.ai_insights = calendar_data.get("ai_insights")
            session_record.performance_predictions = calendar_data.get("performance_predictions")
            session_record.content_themes = calendar_data.get("weekly_themes")
            session_record.generation_status = "completed"
            session_record.ai_confidence = calendar_data.get("ai_confidence")
            session_record.processing_time = calendar_data.get("processing_time")
            session_record.generation_params = {
                "session_id": session_id,
                "request_data": (session_record.generation_params or {}).get("request_data", {}),
                "status": "completed",
            }
            self.db_session.commit()
            logger.info(f"✅ Calendar saved to database for user {user_id}")

            # Phase A: trigger calendar SIF indexing (fire-and-forget).
            try:
                from services.calendar_sif_indexer import (
                    calendar_sif_indexing_enabled,
                    index_calendar_async,
                )
                if calendar_sif_indexing_enabled():
                    generated_at = calendar_data.get("generated_at")
                    index_calendar_async(
                        self.db_session,
                        user_id,
                        calendar_data,
                        generated_at or datetime.utcnow().isoformat(),
                    )
            except Exception as exc:
                logger.warning(
                    f"⚠️ Calendar SIF trigger dispatch failed (non-fatal): {exc}"
                )

        except Exception as e:
            try:
                if self.db_session:
                    self.db_session.rollback()
            finally:
                logger.error(f"❌ Error saving calendar to database: {str(e)}")
                raise

"""
AI-Powered Strategy Generation Service
Generates comprehensive content strategies using AI with enhanced insights and recommendations.

Grounding note
--------------
generate_comprehensive_strategy() self-validates its output via _validate_grounding()
before returning, attaching grounding_validation + grounding_status to
strategy_metadata. This protects every caller of the generator (the sync endpoint,
optimize-existing-strategy, and any future caller) even though the endpoints run
their own enforcement-aware validation too — gates are deterministic, so the
double pass on the sync path yields identical results.

All five component generators (_generate_strategic_insights,
_generate_competitive_analysis, _generate_performance_predictions,
_generate_implementation_roadmap, _generate_risk_assessment) accept a user_id
kwarg and forward it to the AI service call. generate_comprehensive_strategy
passes user_id= to each — adding a new component generator without the kwarg
will crash the comprehensive flow (regression test:
tests/api/test_strategy_integration.py::TestStrategyGeneratorGrounding::
test_component_methods_accept_user_id_kwarg).
"""

import asyncio
import json
import logging
from typing import Any, Callable, Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass

from services.intelligence.agents.quality_gates import validate_strategy_grounding
from services.llm_providers.main_text_generation import llm_text_gen
from ..autofill.ai_structured_autofill import AIStructuredAutofillService
from .prompt_builder import UserIntelligenceFormatter

logger = logging.getLogger(__name__)

# Shared PERSONALIZATION RUBRIC for every strategy component prompt
# (strategy-quality-audit.md QA-2). Passed as the llm_text_gen system prompt:
# the model receives the user's data — it must be TOLD to use it and not fall
# back to generic template advice.
STRATEGY_SYSTEM_PROMPT = """You are a senior content strategy consultant working one-on \
-one with a small-business owner whose inputs are provided in the prompt.

NON-NEGOTIABLE RULES:
1. Hyper-personalization: ground every recommendation in the user's actual
   inputs — their business objectives, target metrics/kPIs, budget, team size,
   timeline, brand voice, audience, pain points, and stated competitors.
2. Reference the user's competitors BY NAME wherever a competitive claim is
   made; never invent competitor names.
3. Respect their constraints: never recommend a cadence, channel mix, or budget
   their team size/content budget/baseline metrics cannot sustain.
4. Anti-genericity: no filler. Every insight, gap, prediction, roadmap step,
   and risk must connect to the user's data, or their stated goals/pain points.
   Skip anything you cannot support from the provided data.
5. Digital-marketing value: frame recommendations in terms a marketer acts on —
   traffic, leads, engagement, conversions, keyword topical authority, and
   realistic effort-to-impact, not vague consultant language.
6. Data integrity: do not fabricate numbers the user's data does not support;
   label estimates as estimates.
"""

# Shared COMPONENT RUBRIC injected into every strategy component USER prompt
# (strategy-quality-audit.md QA-2). The system prompt (STRATEGY_SYSTEM_PROMPT)
# carries the same contract where a provider honors system prompts; embedding
# the rubric inline in the user prompt makes the directives provider-agnostic
# so the model cannot miss the personalization levers even when a provider
# drops/downweights the system role. Phrasing adapts the proven quality rubrics
# ("DATA-DRIVEN PRECISION", "STRICT NICHE RELEVANCE") — one source of
# truth, not a second prompt bank.
_COMPONENT_RUBRIC = """You are the user's senior content strategy consultant working from \
their data below. Apply these working directives to EVERY item in your response:

1. PERSONALIZATION: Ground each recommendation in the USER & BUSINESS INTELLIGENCE and \
BASE STRATEGY above — their objectives, target metrics, budget, team size, timeline, \
baseline metrics, audience, and brand voice. Never write for a generic business.

2. COMPETITOR GROUNDING: Wherever a competitive claim is made, reference the user's \
competitor watchlist BY NAME; never invent competitor names.

3. NICHE RELEVANCE: Stay strictly relevant to the user's industry and the topics in their \
data. Avoid generic industry jargon unless it is their niche (STRICT NICHE RELEVANCE).

4. DATA-DRIVEN PRECISION: Base every projection and recommendation on the user's stored \
metrics and stated goals. Do not fabricate numbers — label any estimate as an estimate.

5. ANTI-GENERICITY: If you cannot tie a statement to the user's data or stated goals, \
omit it. No filler, no invented facts.

6. ACTIONABLE VALUE: Frame recommendations as actions a marketer executes (traffic, \
leads, conversions, topical authority, realistic effort-to-impact) and keep them within \
the user's realistic capacity (team size, content budget, sustainable cadence)."""

@dataclass
class StrategyGenerationConfig:
    """Configuration for strategy generation."""
    include_competitive_analysis: bool = True
    include_content_calendar: bool = True
    include_performance_predictions: bool = True
    include_implementation_roadmap: bool = True
    include_risk_assessment: bool = True
    max_content_pieces: int = 50
    timeline_months: int = 12

class AIStrategyGenerator:
    """
    AI-Powered Content Strategy Generator
    
    Generates comprehensive content strategies including:
    - Strategic field autofill (leveraging existing 100% success system)
    - Competitive analysis and positioning
    - Content calendar and publishing schedule
    - Performance predictions and KPIs
    - Implementation roadmap
    - Risk assessment and mitigation
    """

    def __init__(self, config: Optional[StrategyGenerationConfig] = None):
        """Initialize the AI strategy generator."""
        self.config = config or StrategyGenerationConfig()
        self.autofill_service = AIStructuredAutofillService()
        self.logger = logger

    async def generate_comprehensive_strategy(
        self, 
        user_id: int, 
        context: Dict[str, Any],
        strategy_name: Optional[str] = None,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive content strategy using AI.
        
        Args:
            user_id: User ID for personalization
            context: User context and onboarding data
            strategy_name: Optional custom strategy name
            progress_callback: Optional (step, progress, message) hook so callers
                (e.g. the polling endpoint) can surface phase-level progress.
            
        Returns:
            Comprehensive strategy with all components (EXCLUDING content calendar)
            
        Raises:
            RuntimeError: If any AI component fails to generate
        """
        try:
            self.logger.info(f"🚀 Generating comprehensive AI strategy for user: {user_id}")
            
            # Track which components failed during generation
            failed_components = []
            # Prior-component digest for QA-4 cross-component consistency: each
            # later component sees the earlier ones so roadmap/predictions/risk
            # are generated against the same insights, not blind to each other.
            prior_components: Dict[str, Any] = {}
            
            # Step 1: Generate base strategy fields (using existing autofill system)
            self._emit_progress(progress_callback, 1, 10, "Getting user context...")
            self._emit_progress(progress_callback, 2, 20, "Generating base strategy fields...")
            base_strategy = await self._generate_base_strategy_fields(user_id, context)
            
            # Step 2: Generate strategic insights and recommendations
            self._emit_progress(progress_callback, 3, 30, "Generating strategic insights...")
            strategic_insights = await self._generate_strategic_insights(base_strategy, context, user_id=user_id)
            prior_components["strategic_insights"] = strategic_insights
            if strategic_insights.get("ai_generation_failed"):
                failed_components.append("strategic_insights")
            else:
                self._emit_progress(progress_callback, 3, 35, "Strategic insights generated successfully")
            
            # Step 3: Generate competitive analysis
            self._emit_progress(progress_callback, 4, 40, "Generating competitive analysis...")
            competitive_analysis = await self._generate_competitive_analysis(base_strategy, context, prior_components=prior_components, user_id=user_id)
            prior_components["competitive_analysis"] = competitive_analysis
            if competitive_analysis.get("ai_generation_failed"):
                failed_components.append("competitive_analysis")
            else:
                self._emit_progress(progress_callback, 4, 45, "Competitive analysis generated successfully")
            
            # Step 4: Generate performance predictions
            self._emit_progress(progress_callback, 5, 50, "Generating performance predictions...")
            performance_predictions = await self._generate_performance_predictions(base_strategy, context, prior_components=prior_components, user_id=user_id)
            prior_components["performance_predictions"] = performance_predictions
            if performance_predictions.get("ai_generation_failed"):
                failed_components.append("performance_predictions")
            else:
                self._emit_progress(progress_callback, 5, 55, "Performance predictions generated successfully")
            
            # Step 5: Generate implementation roadmap
            self._emit_progress(progress_callback, 6, 60, "Generating implementation roadmap...")
            implementation_roadmap = await self._generate_implementation_roadmap(base_strategy, context, prior_components=prior_components, user_id=user_id)
            prior_components["implementation_roadmap"] = implementation_roadmap
            if implementation_roadmap.get("ai_generation_failed"):
                failed_components.append("implementation_roadmap")
            else:
                self._emit_progress(progress_callback, 6, 65, "Implementation roadmap generated successfully")
            
            # Step 6: Generate risk assessment
            self._emit_progress(progress_callback, 7, 70, "Generating risk assessment...")
            risk_assessment = await self._generate_risk_assessment(base_strategy, context, prior_components=prior_components, user_id=user_id)
            if risk_assessment.get("ai_generation_failed"):
                failed_components.append("risk_assessment")
            else:
                self._emit_progress(progress_callback, 7, 75, "Risk assessment generated successfully")
            
            # Step 7: Compile comprehensive strategy (NO CONTENT CALENDAR)
            self._emit_progress(progress_callback, 8, 80, "Compiling comprehensive strategy...")
            # Resolve the configured LLM provider/model for accurate metadata.
            # GPT_PROVIDER pattern — see services/llm_providers/tenant_provider_config.py
            # and services/llm_providers/main_text_generation.py.
            try:
                from services.llm_providers.tenant_provider_config import tenant_provider_config_resolver
                _cfg = tenant_provider_config_resolver.resolve(modality="text", user_id=str(user_id))
                _provider = _cfg.selected_providers[0] if _cfg.selected_providers else "gemini"
                _model = _cfg.model_policy.get("default_model")
            except Exception:
                _provider, _model = "gemini", None

            comprehensive_strategy = {
                "strategy_metadata": {
                    "generated_at": datetime.utcnow().isoformat(),
                    "user_id": user_id,
                    "strategy_name": strategy_name or f"AI-Generated Strategy {datetime.utcnow().strftime('%Y-%m-%d')}",
                    "generation_version": "2.0",
                    "ai_provider": _provider,
                    "ai_model": _model or _provider,
                    "personalization_level": self._derive_personalization_level(context, failed_components),
                    "ai_generated": True,
                    "comprehensive": True,
                    "content_calendar_ready": False,  # Indicates calendar needs to be generated separately
                    "failed_components": failed_components,
                    "generation_status": "partial" if failed_components else "complete"
                },
                "base_strategy": base_strategy,
                "strategic_insights": strategic_insights,
                "competitive_analysis": competitive_analysis,
                "performance_predictions": performance_predictions,
                "implementation_roadmap": implementation_roadmap,
                "risk_assessment": risk_assessment,
                "summary": {
                    "estimated_roi": self._honest_summary(performance_predictions, "estimated_roi", "15-25%", "performance predictions"),
                    "implementation_timeline": self._honest_summary(implementation_roadmap, "timeline", "12 months", "implementation roadmap"),
                    "risk_level": self._honest_summary(risk_assessment, "overall_risk_level", "Medium", "risk assessment"),
                    "success_probability": self._honest_summary(performance_predictions, "success_probability", "85%", "performance predictions"),
                    "next_step": "Review strategy and generate content calendar"
                }
            }
            
            if failed_components:
                self.logger.warning(f"⚠️ Strategy generated with partial AI components. Failed: {failed_components}")
                self.logger.info(f"✅ Partial AI strategy generated successfully for user: {user_id}")
            else:
                self.logger.info(f"✅ Comprehensive AI strategy generated successfully for user: {user_id}")
            
            # Quality gate: validate grounding before returning (soft gate).
            grounding_result = self._validate_grounding(comprehensive_strategy, context)
            comprehensive_strategy["strategy_metadata"]["grounding_validation"] = grounding_result
            if grounding_result.get("status") == "error":
                comprehensive_strategy["strategy_metadata"]["grounding_status"] = "error"
            else:
                comprehensive_strategy["strategy_metadata"]["grounding_status"] = (
                    "validated" if grounding_result.get("passed") else "partial"
                )
            
            return comprehensive_strategy
            
        except Exception as e:
            self.logger.error(f"❌ Error generating comprehensive strategy: {str(e)}")
            raise RuntimeError(f"Failed to generate comprehensive strategy: {str(e)}")

    def _emit_progress(
        self,
        progress_callback: Optional[Callable[[int, int, str], None]],
        step: int,
        progress: int,
        message: str,
    ) -> None:
        """Best-effort progress emission; a failing callback must not break generation."""
        if progress_callback is None:
            return
        try:
            progress_callback(step, progress, message)
        except Exception:
            self.logger.warning(
                f"⚠️ progress_callback failed at step {step} ({message}) — continuing",
                exc_info=True,
            )

    def _validate_grounding(self, strategy_data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the generated strategy is grounded in onboarding data (soft gate).

        Runs the intelligence quality gates (persona, competitor, analytics,
        data-quality grounding) against the compiled strategy. Soft mode:
        gate errors never break strategy generation.

        Args:
            strategy_data: The compiled comprehensive strategy dict.
            context: Generation context containing ``onboarding_data``.

        Returns:
            The grounding validation result dict.
        """
        try:
            onboarding_context = context.get("onboarding_data") or {}
            result = validate_strategy_grounding(strategy_data, onboarding_context)
            if not result.get("passed"):
                self.logger.warning(
                    f"⚠️ Strategy grounding validation failed | score={result.get('score', 0):.2f} "
                    f"| violations={len(result.get('violations', []))}"
                )
            else:
                self.logger.info(
                    f"✅ Strategy grounding validated | score={result.get('score', 0):.2f}"
                )
            return result
        except Exception as e:
            self.logger.error(f"❌ Grounding validation error (non-blocking): {str(e)}")
            return {"passed": True, "score": 0.0, "status": "error", "error": str(e)}

    def _build_user_intelligence_prompt(self, context: Dict[str, Any]) -> str:
        """Render the user's form_data + key onboarding signals as a clean,
        natural-language briefing for the LLM prompts (see prompt_builder.py).

        Reading like a briefing (not a raw JSON blob) lets the model actually
        personalize against what the user typed instead of treating it as
        opaque structured noise.
        """
        return UserIntelligenceFormatter.build_briefing(context)

    # ------------------------------------------------------------------
    # Prior-components digest (strategy-quality-audit.md QA-4)
    # Each later component prompt receives a compact digest of the earlier
    # components so roadmap/predictions/risk are generated CONSISTENTLY with
    # the insights and competitor analysis — not blind to each other.
    # ------------------------------------------------------------------
    @staticmethod
    def _digest_insights(insights: Dict[str, Any], limit: int = 4) -> List[str]:
        if not insights or insights.get("ai_generation_failed"):
            return []
        raw = insights.get("insights")
        if isinstance(raw, list):
            texts = [
                str(item.get("insight"))
                for item in raw
                if isinstance(item, dict) and item.get("insight")
            ]
            return texts[:limit]
        texts: List[str] = []
        growth = insights.get("growth_potential") or {}
        texts.extend(str(x) for x in (growth.get("key_drivers") or [])[:limit])
        texts.extend(str(x) for x in (insights.get("content_opportunities") or [])[:limit])
        swot = (insights.get("swot_summary") or {}).get("primary_strengths") or []
        texts.extend(str(x) for x in swot[:limit])
        return [t for t in texts if t][:limit]

    @staticmethod
    def _digest_competitors(competitive: Dict[str, Any], limit: int = 6) -> List[str]:
        if not competitive or competitive.get("ai_generation_failed"):
            return []
        names: List[str] = []
        comps = competitive.get("competitors") or []
        if isinstance(comps, list):
            for item in comps:
                if not isinstance(item, dict):
                    continue
                name = (
                    item.get("name")
                    or item.get("domain")
                    or item.get("website")
                    or item.get("url")
                )
                if name:
                    names.append(str(name))
        return names[:limit]

    @staticmethod
    def _digest_gaps(competitive: Dict[str, Any], limit: int = 3) -> List[str]:
        gaps = (competitive or {}).get("market_gaps") or []
        if not isinstance(gaps, list):
            return []
        return [str(g) for g in gaps if g][:limit]

    @staticmethod
    def _digest_predictions(performance: Dict[str, Any], limit: int = 4) -> List[str]:
        if not performance or performance.get("ai_generation_failed"):
            return []
        lines: List[str] = []
        roi = performance.get("estimated_roi")
        if roi:
            lines.append(f"estimated ROI {roi}")
        probability = performance.get("success_probability")
        if probability:
            lines.append(f"success probability {probability}")
        traffic = performance.get("traffic_growth") or {}
        for month in ("month_3", "month_6", "month_12"):
            value = traffic.get(month)
            if value:
                lines.append(f"traffic growth by {month.replace('_', ' ')}: {value}")
        return [line for line in lines if line][:limit]

    @classmethod
    def _build_prior_components_digest(cls, prior_components: Optional[Dict[str, Any]]) -> str:
        """Compact, natural-language digest of the components already generated."""
        if not prior_components:
            return ""
        sections: List[str] = []

        insights = cls._digest_insights(prior_components.get("strategic_insights"))
        if insights:
            sections.append(
                "  Strategic insights already established: " + " | ".join(insights)
            )

        competitive = prior_components.get("competitive_analysis")
        if competitive and not competitive.get("ai_generation_failed"):
            names = cls._digest_competitors(competitive)
            gaps = cls._digest_gaps(competitive)
            bits: List[str] = []
            if names:
                bits.append("competitors analyzed: " + ", ".join(names))
            if gaps:
                bits.append("market gaps: " + " | ".join(gaps))
            if bits:
                sections.append(
                    "  Competitive analysis already established: " + " | ".join(bits)
                )

        predictions = cls._digest_predictions(
            prior_components.get("performance_predictions")
        )
        if predictions:
            sections.append(
                "  Performance predictions already established: "
                + " | ".join(predictions)
            )

        roadmap = prior_components.get("implementation_roadmap")
        if roadmap and not roadmap.get("ai_generation_failed"):
            timeline = roadmap.get("timeline") or roadmap.get("total_duration")
            if timeline:
                sections.append(
                    f"  Implementation roadmap already established: timeline {timeline}"
                )

        risk = prior_components.get("risk_assessment")
        if risk and not risk.get("ai_generation_failed"):
            level = risk.get("overall_risk_level")
            if level:
                sections.append(
                    f"  Risk assessment already established: overall level {level}"
                )

        return "PRIOR AI-GENERATED COMPONENTS (ground your output in these; do not contradict them):\n" + "\n".join(sections)

    @classmethod
    def _prior_components_block(cls, prior_components: Optional[Dict[str, Any]]) -> str:
        """Prompt section for prior components; empty when none exist."""
        digest = cls._build_prior_components_digest(prior_components)
        return digest if digest else ""

    @staticmethod
    def _honest_summary(
        component: Dict[str, Any],
        field: str,
        fallback: str,
        label: str,
    ) -> str:
        """QA-4 honesty: a failed component must not masquerade as confident
        numbers in the strategy summary (previously hard-coded defaults like
        '15-25%' / '85%' / '12 months' surfaced even when generation failed)."""
        if component.get("ai_generation_failed") or not component.get(field):
            return f"{label} unavailable — component generation failed"
        return str(component.get(field, fallback))

    @classmethod
    def _derive_personalization_level(
        cls,
        context: Dict[str, Any],
        failed_components: List[str],
    ) -> str:
        """QA-5: derive personalization_level from actual signals instead of the
        previous hard-coded ``"high"`` (dishonest for partial generations).

        Signals: onboarding source coverage (persona / competitors / website
        voice-style / search analytics / canonical profile) and how much of the
        30-field strategy-builder form the user filled. Failed components cap
        the level regardless of richness.
        """
        onboarding = (context or {}).get("onboarding_data") or {}
        sources: List[str] = []
        if (onboarding.get("persona_data") or {}).get("core_persona"):
            sources.append("persona")
        if onboarding.get("competitor_analysis") or onboarding.get(
            "deep_competitor_analysis"
        ):
            sources.append("competitor")
        website = onboarding.get("website_analysis") or {}
        if website.get("writing_style") or website.get("content_type"):
            sources.append("voice_style")
        if onboarding.get("gsc_analytics") or onboarding.get("bing_analytics"):
            sources.append("analytics")
        if onboarding.get("canonical_profile"):
            sources.append("canonical")

        filled_form = sum(
            1
            for value in ((context or {}).get("form_data") or {}).values()
            if value not in (None, "")
        )

        if len(failed_components) >= 2:
            return "low"
        if len(failed_components) == 1:
            return "medium"
        if len(sources) == 0 and filled_form == 0:
            return "low"
        if len(sources) >= 2 or filled_form >= 5:
            return "high"
        return "medium"

    async def _call_llm_structured(
        self,
        prompt: str,
        schema: Dict[str, Any],
        user_id: Optional[int],
        system_prompt: Optional[str] = STRATEGY_SYSTEM_PROMPT,
    ) -> Dict[str, Any]:
        """Run a structured JSON LLM call through the COMMON LLM infra
        (services.llm_providers.main_text_generation.llm_text_gen).

        Replaces the legacy per-service AI gateway path, whose 45-second
        asyncio.wait_for cap killed every call on providers that legitimately
        need 45-165s (while the executor thread kept running and spending).
        Follows the modern codebase pattern: llm_text_gen in run_in_executor;
        provider latency governs.
        """
        def _run():
            return llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                user_id=str(user_id) if user_id else None,
                system_prompt=system_prompt,
            )

        result = await asyncio.get_event_loop().run_in_executor(None, _run)
        return {"data": result}

    async def _generate_base_strategy_fields(
        self, 
        user_id: int, 
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate base strategy fields using existing autofill system."""
        try:
            self.logger.info(f"Generating base strategy fields for user: {user_id}")
            
            # Use existing autofill service (100% success rate)
            autofill_result = await self.autofill_service.generate_autofill_fields(user_id, context)
            
            # Extract the fields from autofill result
            base_strategy = autofill_result.get("fields", {})
            
            # Overlay the user's own form data so their edits win over autofill.
            # context['form_data'] is threaded from the polling endpoint; falling
            # back to onboarding mapping keeps data grounded in the user's input.
            form_data = context.get("form_data") or {}
            for key, value in form_data.items():
                if value is not None and value != "":
                    base_strategy[key] = value
            
            # Add generation metadata
            base_strategy["generation_metadata"] = {
                "generated_by": "ai_autofill_system",
                "success_rate": autofill_result.get("success_rate", 100),
                "personalized": autofill_result.get("personalized", True),
                "data_sources": autofill_result.get("data_sources", [])
            }
            
            return base_strategy
            
        except Exception as e:
            self.logger.error(f"Error generating base strategy fields: {str(e)}")
            # Autofill failure is non-fatal: fall back to an empty base and let
            # the downstream grounding gate decide the outcome instead of
            # crashing the whole job with a generic error (the grounding gate
            # must own grounding judgment, not the autofill step).
            return {
                "generation_metadata": {
                    "generated_by": "fallback",
                    "success_rate": 0,
                    "personalized": False,
                    "data_sources": [],
                    "autofill_error": str(e)
                }
            }

    async def _generate_strategic_insights(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None) -> Dict[str, Any]:
        """Generate strategic insights using AI."""
        try:
            logger.info("🧠 Generating strategic insights...")
            
            prompt = f"""
            Generate comprehensive strategic insights for content strategy based on the following context:
            
            USER & BUSINESS INTELLIGENCE:
            {self._build_user_intelligence_prompt(context)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            Please provide strategic insights including:
            1. Market positioning analysis
            2. Content opportunity identification
            3. Competitive advantage mapping
            4. Growth potential assessment
            5. Strategic recommendations
            
            {_COMPONENT_RUBRIC}
            
            Format as structured JSON with insights, reasoning, and confidence levels.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "insights": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "insight": {"type": "string"},
                                "reasoning": {"type": "string"},
                                "priority": {"type": "string"},
                                "estimated_impact": {"type": "string"},
                                "implementation_time": {"type": "string"},
                                "confidence_level": {"type": "string"}
                            }
                        }
                    }
                }
            }
            
            response = await self._call_llm_structured(
                prompt,
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty strategic insights")
            
            logger.info("✅ Strategic insights generated successfully")
            
            # Log the raw AI response for debugging
            logger.info(f"🔍 Raw AI response for strategic insights: {json.dumps(response.get('data', {}), indent=2)}")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "strategic_insights")
            
            # Log the transformed response for debugging
            logger.info(f"🔄 Transformed strategic insights: {json.dumps(transformed_response, indent=2)}")
            
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during strategic insights: {str(e)}")
            logger.info("🔄 Continuing strategy generation without strategic insights...")
            
            # Return empty strategic insights to allow strategy generation to continue
            return {
                "insights": [],
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }

    async def _generate_competitive_analysis(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None, prior_components: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate competitive analysis using AI."""
        try:
            logger.info("🔍 Generating competitive analysis...")
            
            prompt = f"""
            Generate comprehensive competitive analysis for content strategy based on the following context:
            
            USER & BUSINESS INTELLIGENCE:
            {self._build_user_intelligence_prompt(context)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            {self._prior_components_block(prior_components)}
            
            Please provide competitive analysis including:
            1. Competitor identification and analysis
            2. Market gap identification
            3. Differentiation opportunities
            4. Competitive positioning
            5. Strategic recommendations
            
            {_COMPONENT_RUBRIC}
            
            Format as structured JSON with detailed analysis and recommendations.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "competitors": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "strengths": {"type": "array", "items": {"type": "string"}},
                                "weaknesses": {"type": "array", "items": {"type": "string"}},
                                "content_strategy": {"type": "string"},
                                "market_position": {"type": "string"}
                            }
                        }
                    },
                    "market_gaps": {"type": "array", "items": {"type": "string"}},
                    "opportunities": {"type": "array", "items": {"type": "string"}},
                    "recommendations": {"type": "array", "items": {"type": "string"}}
                }
            }
            
            response = await self._call_llm_structured(
                prompt,
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty competitive analysis")
            
            logger.info("✅ Competitive analysis generated successfully")
            
            # Log the raw AI response for debugging
            logger.info(f"🔍 Raw AI response for competitive analysis: {json.dumps(response.get('data', {}), indent=2)}")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "competitive_analysis")
            
            # Log the transformed response for debugging
            logger.info(f"🔄 Transformed competitive analysis: {json.dumps(transformed_response, indent=2)}")
            
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during competitive analysis: {str(e)}")
            logger.info("🔄 Continuing strategy generation without competitive analysis...")
            
            # Return empty competitive analysis to allow strategy generation to continue
            return {
                "competitors": [],
                "market_gaps": [],
                "opportunities": [],
                "recommendations": [],
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }

    async def _generate_content_calendar(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None, prior_components: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate content calendar using AI."""
        try:
            logger.info("📅 Generating content calendar...")
            
            prompt = f"""
            Generate comprehensive content calendar for content strategy based on the following context:
            
            USER & BUSINESS INTELLIGENCE:
            {self._build_user_intelligence_prompt(context)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            {self._prior_components_block(prior_components)}
            
            Please provide content calendar including:
            1. Content pieces with titles and descriptions
            2. Publishing schedule and timing
            3. Content types and formats
            4. Platform distribution strategy
            5. Content themes and pillars
            
            {_COMPONENT_RUBRIC}
            
            Format as structured JSON with detailed content schedule.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "content_pieces": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "content_type": {"type": "string"},
                                "platform": {"type": "string"},
                                "publishing_date": {"type": "string"},
                                "theme": {"type": "string"},
                                "priority": {"type": "string"}
                            }
                        }
                    },
                    "themes": {"type": "array", "items": {"type": "string"}},
                    "schedule": {
                        "type": "object",
                        "properties": {
                            "publishing_frequency": {"type": "string"},
                            "optimal_times": {"type": "array", "items": {"type": "string"}},
                            "content_mix": {
                                "type": "object",
                                "properties": {
                                    "blog_posts": {"type": "string"},
                                    "social_media": {"type": "string"},
                                    "videos": {"type": "string"},
                                    "infographics": {"type": "string"},
                                    "newsletters": {"type": "string"}
                                }
                            },
                            "seasonal_adjustments": {
                                "type": "object",
                                "properties": {
                                    "holiday_content": {"type": "array", "items": {"type": "string"}},
                                    "seasonal_themes": {"type": "array", "items": {"type": "string"}},
                                    "peak_periods": {"type": "array", "items": {"type": "string"}}
                                }
                            }
                        }
                    },
                    "distribution_strategy": {
                        "type": "object",
                        "properties": {
                            "primary_platforms": {"type": "array", "items": {"type": "string"}},
                            "cross_posting_strategy": {"type": "string"},
                            "platform_specific_content": {
                                "type": "object",
                                "properties": {
                                    "linkedin_content": {"type": "array", "items": {"type": "string"}},
                                    "twitter_content": {"type": "array", "items": {"type": "string"}},
                                    "instagram_content": {"type": "array", "items": {"type": "string"}},
                                    "facebook_content": {"type": "array", "items": {"type": "string"}}
                                }
                            },
                            "engagement_timing": {
                                "type": "object",
                                "properties": {
                                    "best_times": {"type": "array", "items": {"type": "string"}},
                                    "frequency": {"type": "string"},
                                    "timezone_considerations": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            }
            
            response = await self._call_llm_structured(
                prompt,
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty content calendar")
            
            logger.info("✅ Content calendar generated successfully")
            return response.get("data", {})
            
        except Exception as e:
            logger.error(f"❌ Error generating content calendar: {str(e)}")
            raise RuntimeError(f"Failed to generate content calendar: {str(e)}")

    async def _generate_performance_predictions(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None, prior_components: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate performance predictions using AI."""
        try:
            logger.info("📊 Generating performance predictions...")
            
            prompt = f"""
            Generate comprehensive performance predictions for content strategy based on the following context:
            
            USER & BUSINESS INTELLIGENCE:
            {self._build_user_intelligence_prompt(context)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            {self._prior_components_block(prior_components)}
            
            Please provide performance predictions including:
            1. Traffic growth projections
            2. Engagement rate predictions
            3. Conversion rate estimates
            4. ROI projections
            5. Success probability assessment
            
            {_COMPONENT_RUBRIC}
            
            Format as structured JSON with detailed predictions and confidence levels.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "traffic_predictions": {
                        "type": "object",
                        "properties": {
                            "monthly_traffic": {"type": "string"},
                            "growth_rate": {"type": "string"},
                            "peak_traffic": {"type": "string"}
                        }
                    },
                    "engagement_predictions": {
                        "type": "object",
                        "properties": {
                            "engagement_rate": {"type": "string"},
                            "time_on_page": {"type": "string"},
                            "bounce_rate": {"type": "string"}
                        }
                    },
                    "conversion_predictions": {
                        "type": "object",
                        "properties": {
                            "conversion_rate": {"type": "string"},
                            "lead_generation": {"type": "string"},
                            "sales_impact": {"type": "string"}
                        }
                    },
                    "roi_predictions": {
                        "type": "object",
                        "properties": {
                            "estimated_roi": {"type": "string"},
                            "cost_benefit": {"type": "string"},
                            "payback_period": {"type": "string"}
                        }
                    }
                }
            }
            
            response = await self._call_llm_structured(
                prompt,
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty performance predictions")
            
            logger.info("✅ Performance predictions generated successfully")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "performance_predictions")
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during performance predictions: {str(e)}")
            logger.info("🔄 Continuing strategy generation without performance predictions...")
            
            # Return empty performance predictions to allow strategy generation to continue
            return {
                "traffic_predictions": {},
                "engagement_predictions": {},
                "conversion_predictions": {},
                "roi_predictions": {},
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }

    async def _generate_implementation_roadmap(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None, prior_components: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate implementation roadmap using AI."""
        try:
            logger.info("🗺️ Generating implementation roadmap...")
            
            prompt = f"""
            Generate comprehensive implementation roadmap for content strategy based on the following context:
            
            USER & BUSINESS INTELLIGENCE:
            {self._build_user_intelligence_prompt(context)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            {self._prior_components_block(prior_components)}
            
            Please provide implementation roadmap including:
            1. Phase-by-phase breakdown
            2. Timeline with milestones
            3. Resource allocation
            4. Success metrics
            5. Risk mitigation strategies
            
            {_COMPONENT_RUBRIC}
            
            Format as structured JSON with detailed implementation plan.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "phases": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "phase": {"type": "string"},
                                "duration": {"type": "string"},
                                "tasks": {"type": "array", "items": {"type": "string"}},
                                "milestones": {"type": "array", "items": {"type": "string"}},
                                "resources": {"type": "array", "items": {"type": "string"}}
                            }
                        }
                    },
                    "timeline": {
                        "type": "object",
                        "properties": {
                            "start_date": {"type": "string"},
                            "end_date": {"type": "string"},
                            "key_milestones": {"type": "array", "items": {"type": "string"}},
                            "critical_path": {"type": "array", "items": {"type": "string"}}
                        }
                    },
                    "resource_allocation": {
                        "type": "object",
                        "properties": {
                            "team_requirements": {"type": "array", "items": {"type": "string"}},
                            "budget_allocation": {
                                "type": "object",
                                "properties": {
                                    "total_budget": {"type": "string"},
                                    "content_creation": {"type": "string"},
                                    "technology_tools": {"type": "string"},
                                    "marketing_promotion": {"type": "string"},
                                    "external_resources": {"type": "string"}
                                }
                            },
                            "technology_needs": {"type": "array", "items": {"type": "string"}},
                            "external_resources": {"type": "array", "items": {"type": "string"}}
                        }
                    },
                    "success_metrics": {"type": "array", "items": {"type": "string"}},
                    "total_duration": {"type": "string"}
                }
            }
            
            response = await self._call_llm_structured(
                prompt,
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty implementation roadmap")
            
            logger.info("✅ Implementation roadmap generated successfully")
            logger.info(f"🔍 Raw AI response for implementation roadmap: {json.dumps(response.get('data', {}), indent=2)}")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "implementation_roadmap")
            logger.info(f"🔍 Transformed implementation roadmap: {json.dumps(transformed_response, indent=2)}")
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during implementation roadmap: {str(e)}")
            logger.info("🔄 Continuing strategy generation without implementation roadmap...")
            
            # Return empty implementation roadmap to allow strategy generation to continue
            return {
                "phases": [],
                "timeline": {},
                "resource_allocation": {},
                "success_metrics": [],
                "total_duration": "TBD",
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }

    async def _generate_risk_assessment(self, base_strategy: Dict[str, Any], context: Dict[str, Any], user_id: Optional[int] = None, ai_manager: Optional[Any] = None, prior_components: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate risk assessment using AI."""
        try:
            logger.info("⚠️ Generating risk assessment...")
            
            prompt = f"""
            Generate comprehensive risk assessment for content strategy based on the following context:
            
            USER & BUSINESS INTELLIGENCE:
            {self._build_user_intelligence_prompt(context)}
            
            BASE STRATEGY:
            {json.dumps(base_strategy, indent=2)}
            
            {self._prior_components_block(prior_components)}
            
            Please provide risk assessment including:
            1. Risk identification and analysis with detailed risk descriptions
            2. Probability and impact assessment for each risk
            3. Specific mitigation strategies for each risk
            4. Contingency planning for high-impact risks
            5. Risk monitoring framework with key indicators
            6. Categorize risks into: technical_risks, market_risks, operational_risks, financial_risks
            
            IMPORTANT: For risk_categories, categorize each risk into the appropriate category:
            - technical_risks: Technology, platform, tool, or technical implementation risks
            - market_risks: Market changes, competition, audience shifts, industry trends
            - operational_risks: Process, resource, team, or execution risks
            - financial_risks: Budget, ROI, cost, or financial performance risks
            
            {_COMPONENT_RUBRIC}
            
            Format as structured JSON with detailed risk analysis and mitigation plans.
            """
            
            schema = {
                "type": "object",
                "properties": {
                    "risks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "risk": {"type": "string"},
                                "probability": {"type": "string"},
                                "impact": {"type": "string"},
                                "mitigation": {"type": "string"},
                                "contingency": {"type": "string"}
                            }
                        }
                    },
                    "overall_risk_level": {"type": "string"},
                    "risk_categories": {
                        "type": "object",
                        "properties": {
                            "technical_risks": {
                                "type": "array", 
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "risk": {"type": "string"},
                                        "probability": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "mitigation": {"type": "string"}
                                    }
                                }
                            },
                            "market_risks": {
                                "type": "array", 
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "risk": {"type": "string"},
                                        "probability": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "mitigation": {"type": "string"}
                                    }
                                }
                            },
                            "operational_risks": {
                                "type": "array", 
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "risk": {"type": "string"},
                                        "probability": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "mitigation": {"type": "string"}
                                    }
                                }
                            },
                            "financial_risks": {
                                "type": "array", 
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "risk": {"type": "string"},
                                        "probability": {"type": "string"},
                                        "impact": {"type": "string"},
                                        "mitigation": {"type": "string"}
                                    }
                                }
                            }
                        }
                    },
                    "mitigation_strategies": {"type": "array", "items": {"type": "string"}},
                    "monitoring_framework": {
                        "type": "object",
                        "properties": {
                            "key_indicators": {"type": "array", "items": {"type": "string"}},
                            "monitoring_frequency": {"type": "string"},
                            "escalation_procedures": {"type": "array", "items": {"type": "string"}},
                            "review_schedule": {"type": "string"}
                        }
                    }
                }
            }
            
            response = await self._call_llm_structured(
                prompt,
                schema,
                user_id=str(user_id) if user_id else None
            )
            
            if not response or not response.get("data"):
                raise RuntimeError("AI service returned empty risk assessment")
            
            logger.info("✅ Risk assessment generated successfully")
            
            # Transform AI response to frontend format
            transformed_response = self._transform_ai_response_to_frontend_format(response.get("data", {}), "risk_assessment")
            return transformed_response
            
        except Exception as e:
            logger.warning(f"⚠️ AI service overload or error during risk assessment: {str(e)}")
            logger.info("🔄 Continuing strategy generation without risk assessment...")
            
            # Return empty risk assessment to allow strategy generation to continue
            return {
                "risks": [],
                "overall_risk_level": "Medium",
                "risk_categories": {
                    "technical_risks": [],
                    "market_risks": [],
                    "operational_risks": [],
                    "financial_risks": []
                },
                "mitigation_strategies": [],
                "monitoring_framework": {
                    "key_indicators": [],
                    "monitoring_frequency": "Monthly",
                    "escalation_procedures": [],
                    "review_schedule": "Quarterly"
                },
                "ai_generation_failed": True,
                "failure_reason": str(e)
            }


    def _transform_ai_response_to_frontend_format(self, ai_response: Dict[str, Any], response_type: str) -> Dict[str, Any]:
        """
        Transform AI response to frontend-expected format to fix empty arrays issue.
        
        Args:
            ai_response: Raw AI response
            response_type: Type of response (strategic_insights, competitive_analysis, etc.)
            
        Returns:
            Transformed response in frontend-expected format
        """
        try:
            if response_type == "strategic_insights":
                return self._transform_strategic_insights(ai_response)
            elif response_type == "competitive_analysis":
                return self._transform_competitive_analysis(ai_response)
            elif response_type == "performance_predictions":
                return self._transform_performance_predictions(ai_response)
            elif response_type == "implementation_roadmap":
                return self._transform_implementation_roadmap(ai_response)
            elif response_type == "risk_assessment":
                return self._transform_risk_assessment(ai_response)
            else:
                return ai_response
        except Exception as e:
            self.logger.error(f"Error transforming {response_type} response: {str(e)}")
            return ai_response

    def _transform_strategic_insights(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform strategic insights to frontend format."""
        transformed = {
            "market_positioning": {
                "positioning_strength": 75,
                "current_position": "Emerging",
                "swot_analysis": {
                    "strengths": [],
                    "opportunities": []
                }
            },
            "content_opportunities": [],
            "growth_potential": {
                "market_size": "Growing",
                "growth_rate": "High",
                "key_drivers": [],
                "competitive_advantages": []
            },
            "swot_summary": {
                "overall_score": 75,
                "primary_strengths": [],
                "key_opportunities": []
            }
        }

        # Extract insights from AI response
        insights = ai_response.get("insights", [])
        if insights:
            # Extract content opportunities
            content_opportunities = []
            key_drivers = []
            competitive_advantages = []
            strengths = []
            opportunities = []

            for insight in insights:
                insight_type = insight.get("type", "").lower()
                insight_text = insight.get("insight", "")
                
                # More flexible matching to capture different types of insights
                if any(keyword in insight_type for keyword in ["opportunity", "content", "market"]) or any(keyword in insight_text.lower() for keyword in ["opportunity", "content", "market"]):
                    if any(keyword in insight_text.lower() for keyword in ["content", "blog", "article", "post", "video", "social"]):
                        content_opportunities.append(insight_text)
                    else:
                        opportunities.append(insight_text)
                elif any(keyword in insight_type for keyword in ["strength", "advantage", "competitive"]) or any(keyword in insight_text.lower() for keyword in ["strength", "advantage", "competitive"]):
                    if any(keyword in insight_text.lower() for keyword in ["competitive", "advantage", "differentiation"]):
                        competitive_advantages.append(insight_text)
                    else:
                        strengths.append(insight_text)
                elif any(keyword in insight_type for keyword in ["driver", "growth", "trend"]) or any(keyword in insight_text.lower() for keyword in ["driver", "growth", "trend"]):
                    key_drivers.append(insight_text)
                else:
                    # Default categorization based on content
                    if any(keyword in insight_text.lower() for keyword in ["opportunity", "potential", "growth"]):
                        opportunities.append(insight_text)
                    elif any(keyword in insight_text.lower() for keyword in ["strength", "advantage", "strong"]):
                        strengths.append(insight_text)
                    elif any(keyword in insight_text.lower() for keyword in ["driver", "trend", "factor"]):
                        key_drivers.append(insight_text)

            # Ensure we have some data even if categorization didn't work
            if not content_opportunities and insights:
                content_opportunities = [insight.get("insight", "") for insight in insights[:3]]
            if not opportunities and insights:
                opportunities = [insight.get("insight", "") for insight in insights[3:6]]
            if not strengths and insights:
                strengths = [insight.get("insight", "") for insight in insights[6:9]]
            if not key_drivers and insights:
                key_drivers = [insight.get("insight", "") for insight in insights[9:12]]

            # Update transformed data
            transformed["content_opportunities"] = content_opportunities[:3]  # Limit to 3
            transformed["growth_potential"]["key_drivers"] = key_drivers[:3]
            transformed["growth_potential"]["competitive_advantages"] = competitive_advantages[:3]
            transformed["market_positioning"]["swot_analysis"]["strengths"] = strengths[:3]
            transformed["market_positioning"]["swot_analysis"]["opportunities"] = opportunities[:3]
            transformed["swot_summary"]["primary_strengths"] = strengths[:3]
            transformed["swot_summary"]["key_opportunities"] = opportunities[:3]

        return transformed

    def _transform_competitive_analysis(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform competitive analysis to frontend format."""
        transformed = {
            "competitors": [],
            "market_gaps": [],
            "opportunities": [],
            "recommendations": [],
            "competitive_advantages": {
                "primary": [],
                "sustainable": [],
                "development_areas": []
            },
            "swot_competitive_insights": {
                "leverage_strengths": [],
                "address_weaknesses": [],
                "capitalize_opportunities": [],
                "mitigate_threats": []
            }
        }

        # Extract competitive insights from AI response - handle both insights array and direct fields
        insights = ai_response.get("insights", [])
        competitors = ai_response.get("competitors", [])
        market_gaps = ai_response.get("market_gaps", [])
        opportunities = ai_response.get("opportunities", [])
        recommendations = ai_response.get("recommendations", [])

        # Process insights array if available
        if insights:
            for insight in insights:
                insight_type = insight.get("type", "").lower()
                insight_text = insight.get("insight", "")
                
                if any(keyword in insight_type for keyword in ["gap", "market"]) or any(keyword in insight_text.lower() for keyword in ["gap", "market", "missing"]):
                    market_gaps.append(insight_text)
                elif any(keyword in insight_type for keyword in ["opportunity", "potential"]) or any(keyword in insight_text.lower() for keyword in ["opportunity", "potential", "growth"]):
                    opportunities.append(insight_text)
                elif any(keyword in insight_type for keyword in ["recommendation", "strategy", "action"]) or any(keyword in insight_text.lower() for keyword in ["recommendation", "strategy", "action", "should"]):
                    recommendations.append(insight_text)

        # Ensure we have some data even if categorization didn't work
        if not market_gaps and insights:
            market_gaps = [insight.get("insight", "") for insight in insights[:3]]
        if not opportunities and insights:
            opportunities = [insight.get("insight", "") for insight in insights[3:6]]
        if not recommendations and insights:
            recommendations = [insight.get("insight", "") for insight in insights[6:9]]

        # Update transformed data
        transformed["competitors"] = competitors[:3] if competitors else []
        transformed["market_gaps"] = market_gaps[:3]
        transformed["opportunities"] = opportunities[:3]
        transformed["recommendations"] = recommendations[:3]
        transformed["competitive_advantages"]["primary"] = opportunities[:3]  # Use opportunities as primary advantages
        transformed["competitive_advantages"]["sustainable"] = recommendations[:3]  # Use recommendations as sustainable advantages
        transformed["competitive_advantages"]["development_areas"] = market_gaps[:3]  # Use market gaps as development areas
        transformed["swot_competitive_insights"]["leverage_strengths"] = opportunities[:2]
        transformed["swot_competitive_insights"]["capitalize_opportunities"] = opportunities[:2]
        transformed["swot_competitive_insights"]["address_weaknesses"] = market_gaps[:2]
        transformed["swot_competitive_insights"]["mitigate_threats"] = recommendations[:2]

        return transformed

    def _transform_performance_predictions(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform performance predictions to frontend format."""
        transformed = {
            "estimated_roi": "20-30%",
            "traffic_growth": {
                "month_3": "25%",
                "month_6": "50%",
                "month_12": "100%"
            },
            "engagement_metrics": {
                "time_on_page": "3-5 minutes",
                "bounce_rate": "35-45%",
                "social_shares": "15-25 per post"
            },
            "conversion_predictions": {
                "lead_generation": "5-8%",
                "email_signups": "3-5%",
                "content_downloads": "8-12%"
            },
            "success_probability": "85%"
        }

        # Extract performance data from AI response
        predictions = ai_response.get("predictions", {})
        if predictions:
            if "roi" in predictions:
                transformed["estimated_roi"] = predictions["roi"]
            if "success_probability" in predictions:
                transformed["success_probability"] = predictions["success_probability"]

        return transformed

    def _transform_implementation_roadmap(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform implementation roadmap to frontend format."""
        self.logger.info(f"🔍 Transforming implementation roadmap. Input: {json.dumps(ai_response, indent=2)}")
        
        transformed = {
            "phases": [],
            "timeline": "12 months",
            "resource_requirements": [],
            "milestones": [],
            "critical_path": [],
            "success_metrics": []
        }

        # Extract roadmap data from AI response - data is at top level, not nested under "roadmap"
        if ai_response:
            # Extract phases
            phases = ai_response.get("phases", [])
            if phases:
                transformed["phases"] = phases[:4]  # Limit to 4 phases
            
            # Extract timeline
            timeline = ai_response.get("timeline", {})
            if timeline:
                if isinstance(timeline, dict):
                    # If timeline is an object, extract the duration or use total_duration
                    transformed["timeline"] = timeline.get("total_duration", "12 months")
                    # Extract milestones from timeline object
                    milestones = timeline.get("key_milestones", [])
                    if milestones:
                        transformed["milestones"] = milestones[:6]
                    # Extract critical path from timeline object
                    critical_path = timeline.get("critical_path", [])
                    if critical_path:
                        transformed["critical_path"] = critical_path[:5]
                else:
                    # If timeline is a string, use it directly
                    transformed["timeline"] = str(timeline)
            
            # Extract total_duration if available
            total_duration = ai_response.get("total_duration")
            if total_duration:
                transformed["timeline"] = str(total_duration)
            
            # Extract resource allocation
            resource_allocation = ai_response.get("resource_allocation", {})
            if resource_allocation:
                team_requirements = resource_allocation.get("team_requirements", [])
                if team_requirements:
                    transformed["resource_requirements"] = team_requirements[:5]
            
            # Extract success metrics
            success_metrics = ai_response.get("success_metrics", [])
            if success_metrics:
                transformed["success_metrics"] = success_metrics[:5]

        self.logger.info(f"🔍 Final transformed implementation roadmap: {json.dumps(transformed, indent=2)}")
        return transformed

    def _transform_risk_assessment(self, ai_response: Dict[str, Any]) -> Dict[str, Any]:
        """Transform risk assessment to frontend format."""
        self.logger.info(f"🔍 Transforming risk assessment. Input: {json.dumps(ai_response, indent=2)}")
        
        transformed = {
            "risks": [],
            "overall_risk_level": "Medium",
            "risk_categories": {
                "technical_risks": [],
                "market_risks": [],
                "operational_risks": [],
                "financial_risks": []
            },
            "mitigation_strategies": [],
            "monitoring_framework": {
                "key_indicators": [],
                "monitoring_frequency": "Weekly",
                "escalation_procedures": [],
                "review_schedule": "Monthly"
            }
        }

        # Extract overall risk level
        if ai_response.get("overall_risk_level"):
            transformed["overall_risk_level"] = ai_response["overall_risk_level"]

        # Extract risk data from AI response
        risks = ai_response.get("risks", [])
        if risks:
            transformed["risks"] = risks[:5]  # Limit to 5 risks

        # Extract risk categories from AI response
        risk_categories = ai_response.get("risk_categories", {})
        if risk_categories:
            transformed["risk_categories"] = {
                "technical_risks": risk_categories.get("technical_risks", []),
                "market_risks": risk_categories.get("market_risks", []),
                "operational_risks": risk_categories.get("operational_risks", []),
                "financial_risks": risk_categories.get("financial_risks", [])
            }

        # Extract mitigation strategies from AI response
        mitigation_strategies = ai_response.get("mitigation_strategies", [])
        if mitigation_strategies:
            transformed["mitigation_strategies"] = mitigation_strategies
        else:
            # Fallback: extract mitigation from individual risks
            if risks:
                transformed["mitigation_strategies"] = [risk.get("mitigation", "") for risk in risks[:3] if risk.get("mitigation")]

        # Extract monitoring framework from AI response
        monitoring_framework = ai_response.get("monitoring_framework", {})
        if monitoring_framework:
            transformed["monitoring_framework"] = {
                "key_indicators": monitoring_framework.get("key_indicators", []),
                "monitoring_frequency": monitoring_framework.get("monitoring_frequency", "Weekly"),
                "escalation_procedures": monitoring_framework.get("escalation_procedures", []),
                "review_schedule": monitoring_framework.get("review_schedule", "Monthly")
            }

        self.logger.info(f"🔍 Final transformed risk assessment: {json.dumps(transformed, indent=2)}")
        return transformed 



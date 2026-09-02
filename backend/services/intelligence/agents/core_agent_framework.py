"""
Core Agent Framework for ALwrity Autonomous Marketing System
Built on txtai's native Agent framework (smolagents)
"""

import asyncio
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

# txtai imports for native agent framework
try:
    from txtai.pipeline import Agent, LLM
    TXTAI_AVAILABLE = True
except ImportError:
    try:
        from txtai import Agent, LLM
        TXTAI_AVAILABLE = True
    except ImportError:
        TXTAI_AVAILABLE = False
        Agent = None
        LLM = None
        logging.warning("txtai not available")

_core_llm_cache = {}

# Thread pool for running async orchestrator tools from sync txtai Agent calls.
# Each worker thread gets its own event loop via asyncio.new_event_loop().
_orchestrator_tool_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="orch_tool")

# Optional MLflow integration
try:
    import mlflow # type: ignore # pylint: disable=import-error
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False

from utils.logger_utils import get_service_logger
from services.database import get_session_for_user
from services.intelligence.monitoring.semantic_dashboard import RealTimeSemanticMonitor
from services.intelligence.agents.safety_framework import get_safety_framework
from services.agent_activity_service import AgentActivityService, build_agent_event_payload
from services.intelligence.agents.agent_usage_tracking import track_agent_usage_sync
from services.llm_providers.main_text_generation import llm_text_gen
from services.intelligence.agents.team_catalog import AGENT_TEAM_CATALOG, get_agent_catalog_entry
from services.intelligence.agents.prompt_context import build_prompt_context, comma_join_context
from services.intelligence.agents.output_contracts import (
    ACTION_TYPES,
    normalize_contract_text,
    resolve_recommendation_action,
    task_output_schema,
    get_role_contract,
)
from services.intelligence.agents.quality_gates import validate_action_content
from services.research.trends import TavilyTrendProvider, TrendPlatform, synthesize_trends
import time

logger = get_service_logger(__name__)


def _build_market_trends_envelope(
    keywords: List[str],
    timeframe: str,
    geo: str,
    items: list,
    report: Dict[str, Any],
    now: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a Tavily market-trends envelope compatible with the SIF market_trends doc."""
    return {
        "keywords": keywords,
        "timeframe": timeframe,
        "geo": geo,
        "timestamp": now or datetime.utcnow().isoformat(),
        "cached": False,
        "source": "tavily",
        "platform": TrendPlatform.WEB.value,
        "items": [item.to_dict() for item in items],
        "synthesis": report,
    }

LOW_COST_REMOTE_MODELS = [
    "Qwen/Qwen2.5-1.5B-Instruct",
    "Qwen/Qwen2.5-0.5B-Instruct",
    "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
]

class TrackingLLMWrapper:
    """
    Wrapper for LLM instances to transparently track usage.
    Intercepts calls to __call__ and generate() to log metrics.
    """
    def __init__(self, llm: Any, user_id: str, model_name: str):
        self.llm = llm
        self.user_id = user_id
        self.model_name = model_name

    def __call__(self, prompt: str, *args, **kwargs) -> Any:
        return self.generate(prompt, *args, **kwargs)

    def generate(self, prompt: str, *args, **kwargs) -> str:
        start_time = time.time()
        try:
            # Delegate to the underlying LLM
            if hasattr(self.llm, "generate"):
                response = self.llm.generate(prompt, *args, **kwargs)
            else:
                response = self.llm(prompt, *args, **kwargs)
            
            # Handle response format (some might return list of dicts)
            response_text = str(response)
            if isinstance(response, list):
                if response and isinstance(response[0], dict) and 'generated_text' in response[0]:
                    response_text = response[0]['generated_text']
                else:
                    response_text = str(response[0])

            # Track usage
            duration = time.time() - start_time
            try:
                track_agent_usage_sync(
                    user_id=self.user_id,
                    model_name=self.model_name,
                    prompt=prompt,
                    response_text=response_text,
                    duration=duration
                )
            except Exception as e:
                logger.warning(f"Failed to track agent usage in wrapper: {e}")

            return response
            
        except Exception as e:
            logger.error(f"LLM generation failed in tracking wrapper: {e}")
            raise e

    def __getattr__(self, name):
        # Delegate other attribute access to the underlying LLM
        return getattr(self.llm, name)

@dataclass
class AgentAction:
    """Represents an action taken by an agent"""
    action_id: str
    agent_type: str
    action_type: str
    target_resource: str
    parameters: Dict[str, Any]
    expected_outcome: str
    risk_level: float  # 0.0 to 1.0
    requires_approval: bool = False
    created_at: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()

class AgentDeclined(Exception):
    """Raised by an agent that honestly has nothing to contribute.

    Distinct from a generic exception: an ``AgentDeclined`` is a *valid*
    outcome (the agent reviewed the context and chose not to fabricate a
    recommendation), not a failure. The daily-meeting committee records it
    as informational and non-retryable.
    """
    pass


# Canonical wording an agent should use when it has nothing to contribute.
AGENT_DECLINE_MESSAGE = "I have nothing to contribute"

# Shared instruction appended to agent proposal prompts so LLM-driven agents
# can honestly decline instead of fabricating a recommendation.
AGENT_DECLINE_INSTRUCTION = (
    "\nIf, after reviewing the context, you genuinely have no actionable "
    "contribution for today (for example the user has no relevant content "
    "pillars, competitor data, or signals in scope), reply with exactly "
    f"'{AGENT_DECLINE_MESSAGE}' and do not fabricate a task."
)


def _is_agent_decline(result: Any) -> bool:
    """Detect an explicit "nothing to contribute" response from the LLM.

    Tolerant of a bare string, a JSON object with a ``declined``/``message``
    marker, or the canonical wording embedded anywhere in the output.
    """
    if result is None:
        return False
    if isinstance(result, str):
        text = result
    elif isinstance(result, dict):
        if result.get("declined") is True:
            return True
        text = " ".join(str(v) for v in result.values())
    else:
        text = str(result)
    needle = AGENT_DECLINE_MESSAGE.lower()
    return needle in text.lower()


@dataclass
class TaskProposal:
    """Represents a daily task proposed by an agent"""
    title: str
    description: str
    pillar_id: str  # plan, generate, publish, analyze, engage, remarket
    priority: str   # high, medium, low
    estimated_time: int  # minutes
    source_agent: str
    reasoning: str
    context_data: Optional[Dict[str, Any]] = None
    action_type: str = "navigate"
    action_url: Optional[str] = None
    evidence: Optional[str] = None
    expected_impact: Optional[str] = None
    effort: Optional[str] = None
    risk_level: str = "low"
    measurement: Optional[str] = None
    recommendation: Optional[str] = None
    next_action: Optional[str] = None
    owner_agent: Optional[str] = None
    kpi: Optional[str] = None
    deadline: Optional[str] = None
    action_parameters: Optional[Dict[str, Any]] = None
    # How this proposal's text was produced:
    #   "llm"              -- personalized LLM generation grounded in context.
    #   "data_derived"     -- deterministic rules over real measured data.
    #   "template_fallback" -- static canned text substituted after LLM
    #                          synthesis failed or returned nothing.
    # Static constructions default to the fallback mode; every non-fallback
    # producer must set its own value explicitly.
    synthesis_mode: str = "template_fallback"

@dataclass
class MarketSignal:
    """Represents a market change or opportunity"""
    signal_id: str
    signal_type: str  # 'competitor', 'serp', 'social', 'industry', 'performance'
    source: str
    description: str
    impact_score: float  # 0.0 to 1.0
    urgency_level: str  # 'low', 'medium', 'high', 'critical'
    confidence_score: float  # 0.0 to 1.0
    related_topics: List[str]
    suggested_actions: List[str]
    detected_at: str = None
    expires_at: str = None
    
    def __post_init__(self):
        if self.detected_at is None:
            self.detected_at = datetime.utcnow().isoformat()
        if self.expires_at is None:
            # Default expiration: 7 days for most signals
            expires = datetime.utcnow().timestamp() + (7 * 24 * 60 * 60)
            self.expires_at = datetime.fromtimestamp(expires).isoformat()

@dataclass
class AgentPerformance:
    """Performance metrics for an agent"""
    agent_id: str
    total_actions: int
    successful_actions: int
    failed_actions: int
    average_response_time: float
    success_rate: float
    last_action_at: str
    efficiency_score: float  # 0.0 to 1.0

def _maybe_self_heal_index_impl(sif_service: Any, **kwargs) -> Any:
    """Indirection so tests can stub the heal without importing SIF deps."""
    from services.intelligence.sif_self_heal import maybe_self_heal_index

    return maybe_self_heal_index(sif_service, **kwargs)


class BaseALwrityAgent(ABC):
    """Base class for all ALwrity marketing agents"""

    # TTL-bounded caches: long-lived orchestrator instances must pick up
    # fresh onboarding data and saved profile edits without a process restart.
    _CONTEXT_CACHE_TTL_SECONDS = 600
    _prompt_context_cache: Dict[str, Any] = {}  # user_id -> (expires_at, context)
    _profile_cache: Dict[str, Any] = {}  # user_id:agent_key -> (expires_at, profile_data)
    def _resolve_sif_intelligence(self) -> Any:
        """Locate the txtai intelligence service for this agent.

        SIFBaseAgent subclasses carry ``self.intelligence`` directly; plain
        BaseALwrityAgent agents (SEO, competitor, content strategy, social)
        carry ``self.sif_service`` whose ``intelligence_service`` is the same
        per-user txtai singleton.
        """
        intel = getattr(self, "intelligence", None)
        if intel is not None:
            return intel
        return getattr(getattr(self, "sif_service", None), "intelligence_service", None)

    async def sif_search(
        self,
        query: str,
        *,
        limit: int = 5,
        trigger: str = "agent_search",
        min_index_items: int = 5,
    ) -> List[Dict[str, Any]]:
        """Search the SIF index with self-healing on empty results.

        Central choke point for every specialized agent's SIF search:
        - runs the query through the intelligence service (initializing it
          lazily when needed),
        - on an EMPTY result, triggers the once-per-day self-heal
          (bootstrap-index the flat context documents + watermark-guarded
          website sync) and retries the search once,
        - never raises: search or heal failures degrade to ``[]``.
        """
        intelligence = self._resolve_sif_intelligence()
        results: List[Dict[str, Any]] = []
        if intelligence is not None:
            try:
                ensure = getattr(intelligence, "_ensure_initialized_async", None)
                if callable(ensure):
                    try:
                        await ensure()
                    except Exception as init_exc:
                        logger.debug(f"[{type(self).__name__}] SIF init failed: {init_exc}")
                results = list(await intelligence.search(query, limit=limit) or [])
            except Exception as exc:
                logger.debug(f"[{type(self).__name__}] SIF search failed: {exc}")
                results = []
        if results:
            return results

        # Miss: heal the index once (day-guarded) and retry the search.
        try:
            from services.intelligence.sif_integration import SIFIntegrationService

            sif = getattr(self, "sif_service", None)
            if sif is None:
                try:
                    sif = SIFIntegrationService(self.user_id)
                except Exception:
                    sif = None
            if sif is not None:
                heal = await _maybe_self_heal_index_impl(
                    sif, trigger=trigger, min_index_items=min_index_items
                )
                if heal.get("healed") and intelligence is not None:
                    # Record the heal on the agent so the committee can
                    # surface it in the plan's limitations (transparency:
                    # the evidence base was repaired from local context).
                    try:
                        self.last_sif_heal = heal
                    except Exception:
                        pass
                    logger.info(
                        f"[{type(self).__name__}] SIF index healed "
                        f"(+{heal.get('bootstrap_indexed')} docs); retrying search"
                    )
                    try:
                        results = list(await intelligence.search(query, limit=limit) or [])
                    except Exception as retry_exc:
                        logger.debug(f"[{type(self).__name__}] SIF retry after heal failed: {retry_exc}")
        except Exception as exc:
            logger.debug(f"[{type(self).__name__}] Self-heal attempt failed: {exc}")
        return results



    def _remember_grounding(self, context: Any) -> None:
        """Cache the latest committee grounding on this agent instance.

        ``propose_daily_tasks`` receives the committee grounding dict; txtai
        tool calls do not. Remembering it here lets every SIF query composed
        later (``_sif_query``) be user-specific instead of a generic keyword
        bag. Failures are non-fatal: a missing grounding just means the
        query builder falls back to the caller's legacy query.
        """
        try:
            if isinstance(context, dict):
                self._latest_grounding = context
        except Exception:
            pass

    def _sif_query(
        self,
        agent_key: Optional[str] = None,
        *,
        hints: Optional[List[str]] = None,
        fallback: str = "",
        max_terms: int = 8,
    ) -> str:
        """Compose a user-specific SIF search query for this agent.

        Uses the remembered committee grounding (see ``_remember_grounding``)
        and, when it is thin, the user's flat-context documents via
        ``AgentContextVFS``. With no context at all the caller's legacy
        ``fallback`` string is returned verbatim.
        """
        try:
            from services.intelligence.sif_query_builder import build_contextual_query

            key = agent_key or getattr(self, "agent_type", "") or ""
            return build_contextual_query(
                key,
                getattr(self, "_latest_grounding", None),
                user_id=self.user_id,
                hints=hints,
                fallback=fallback,
                max_terms=max_terms,
            )
        except Exception as exc:
            logger.debug(f"[{type(self).__name__}] Query build failed, using fallback: {exc}")
            return fallback

    
    def __init__(self, user_id: str, agent_type: str, model_name: str = "Qwen/Qwen2.5-1.5B-Instruct", llm: Any = None, enable_tracing: bool = True, **kwargs):
        self.user_id = user_id
        self.agent_type = agent_type
        self.model_name = model_name
        self.agent_id = f"{agent_type}_{user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        self.enable_tracing = enable_tracing
        self.kwargs = kwargs
        # Optional task hint; do not enforce
        self.llm_task = str(self.kwargs.get("task") or "").strip()
        self.performance = AgentPerformance(
            agent_id=self.agent_id,
            total_actions=0,
            successful_actions=0,
            failed_actions=0,
            average_response_time=0.0,
            success_rate=0.0,
            last_action_at=None,
            efficiency_score=0.0
        )
        
        # Initialize txtai agent if available
        self.txtai_agent = None
        self.llm = llm  # Ensure llm is set if provided, regardless of txtai availability

        # Wrap LLM with tracking if it exists
        if self.llm:
            self.llm = TrackingLLMWrapper(self.llm, self.user_id, self.model_name)

        self.agent_key = self._resolve_agent_key(agent_type)
        self._agent_profile = self._load_agent_profile_overrides()
        self._prompt_context = self._load_prompt_context()
        
        # Note: We cannot await async methods in __init__.
        # If _create_txtai_agent is async, it must be called explicitly after initialization
        # or we must use a factory method.
        # For now, we will handle sync initialization here, and specialized agents 
        # must handle their async initialization separately or via a sync wrapper.
        
        if TXTAI_AVAILABLE:
            try:
                if not self.llm:
                    try:
                        # Use global cache for core agent LLMs too
                        cache_key = f"{model_name}:language-generation"
                        if cache_key in _core_llm_cache:
                            raw_llm = _core_llm_cache[cache_key]
                        else:
                            # Use language-generation for txtai internal mapping
                            raw_llm = LLM(path=model_name, task="language-generation")
                            _core_llm_cache[cache_key] = raw_llm
                    except Exception as e:
                        logger.error(f"Failed to initialize LLM for {agent_type}: {e}")
                        raise
                    self.llm = TrackingLLMWrapper(raw_llm, self.user_id, self.model_name)
                
                try:
                    # _create_txtai_agent might be async or sync.
                    # Async agents cannot be awaited in __init__ when inside
                    # a running event loop.  We defer initialization via a
                    # background task and accept None temporarily — callers
                    # that depend on self.txtai_agent must be None-safe.
                    
                    if asyncio.iscoroutinefunction(self._create_txtai_agent):
                         try:
                             try:
                                 loop = asyncio.get_running_loop()
                             except RuntimeError:
                                 loop = None
                             
                             if loop and loop.is_running():
                                 async def async_init():
                                     try:
                                         self.txtai_agent = await self._create_txtai_agent()
                                         logger.info(f"Async initialized txtai agent for {agent_type} - {self.agent_id}")
                                     except Exception as e:
                                         logger.error(f"Async initialization failed for {agent_type}: {e}")
                                         
                                 loop.create_task(async_init())
                                 self.txtai_agent = None
                             else:
                                 if not loop:
                                     loop = asyncio.new_event_loop()
                                     asyncio.set_event_loop(loop)
                                 self.txtai_agent = loop.run_until_complete(self._create_txtai_agent())
                         except Exception as e:
                             logger.error(f"Failed to handle async initialization for {agent_type}: {e}")
                             self.txtai_agent = None
                    else:
                         self.txtai_agent = self._create_txtai_agent()
                         
                    if self.txtai_agent:
                        logger.info(f"Initialized txtai agent for {agent_type} - {self.agent_id}")
                    else:
                        logger.debug(f"txtai agent for {agent_type} running in fallback mode (no local agent)")
                except Exception as inner_e:
                    logger.error(f"Could not initialize specific txtai agent for {agent_type}: {inner_e}")
                    self.txtai_agent = None
            except Exception as e:
                logger.error(f"Failed to initialize txtai agent for {agent_type}: {e}")
                self.txtai_agent = None
        else:
            logger.debug(f"txtai not available for {agent_type} — agent will run in fallback mode")
            self.txtai_agent = None

        # Initialize safety framework
        self.safety_framework = get_safety_framework(user_id)

    async def _generate_llm_response(self, prompt: str) -> str:
        """
        Helper to generate text using the agent's LLM with usage tracking.
        Centralized method for all agents inheriting from BaseALwrityAgent.
        Injects the effective system prompt so direct LLM calls use onboarding context.
        """
        if not self.llm:
            logger.error("LLM unavailable for agent %s (%s)", self.agent_type, self.agent_id)
            raise RuntimeError(f"LLM unavailable for agent {self.agent_type}")

        system_prompt = self.get_effective_system_prompt()
        if system_prompt and system_prompt.strip() and not prompt.startswith(system_prompt.strip()):
            prompt = f"{system_prompt.strip()}\n\n{prompt}"

        try:
            # Run in executor to avoid blocking if LLM is synchronous
            loop = asyncio.get_event_loop()
            
            # Use the wrapped LLM's generate method (which handles tracking)
            if hasattr(self.llm, "generate"):
                response = await loop.run_in_executor(None, lambda: self.llm.generate(prompt))
            else:
                response = await loop.run_in_executor(None, lambda: self.llm(prompt))
            
            # Handle list output (some models return list of dicts)
            response_text = str(response)
            if isinstance(response, list):
                if response and isinstance(response[0], dict) and 'generated_text' in response[0]:
                    response_text = response[0]['generated_text']
                else:
                    response_text = str(response[0])
            
            return response_text
            
        except Exception as e:
            logger.error(f"LLM generation failed in agent {self.agent_type}: {e}")
            logger.warning(
                "Attempting remote low-cost fallback via llm_text_gen for agent %s (user=%s)",
                self.agent_type,
                self.user_id,
            )
            try:
                loop = asyncio.get_event_loop()
                fallback_response = await loop.run_in_executor(
                    None,
                    lambda: llm_text_gen(
                        prompt=prompt,
                        user_id=self.user_id,
                        preferred_hf_models=LOW_COST_REMOTE_MODELS,
                        flow_type="sif_agent",
                    ),
                )
                logger.warning(
                    "Remote low-cost fallback succeeded for agent %s (user=%s)",
                    self.agent_type,
                    self.user_id,
                )
                return fallback_response
            except Exception as remote_e:
                logger.error(
                    "Remote fallback failed for agent %s (user=%s): %s",
                    self.agent_type,
                    self.user_id,
                    remote_e,
                )
                raise RuntimeError(
                    f"Local and remote LLM generation failed for agent {self.agent_type}: {remote_e}"
                ) from remote_e

    def _resolve_agent_key(self, agent_type: str) -> str:
        value = str(agent_type or "").strip()
        if value.lower() == "strategyorchestrator".lower():
            return "strategy_orchestrator"
        return value

    def _resolve_llm_task(self, requested_task: Optional[str]) -> str:
        # No enforcement; return provided value or empty string
        return str(requested_task or "").strip()

    def _load_agent_profile_overrides(self) -> Dict[str, Any]:
        cache_key = f"{self.user_id}:{self.agent_key}"
        cached = BaseALwrityAgent._profile_cache.get(cache_key)
        if cached is not None:
            expires_at, data = cached
            if time.time() < expires_at:
                return data

        profile_data: Dict[str, Any] = {}
        db = None
        try:
            db = get_session_for_user(self.user_id)
            if not db:
                BaseALwrityAgent._profile_cache[cache_key] = (
                    time.time() + BaseALwrityAgent._CONTEXT_CACHE_TTL_SECONDS,
                    profile_data,
                )
                return profile_data
            from models.agent_activity_models import AgentProfile

            profile = (
                db.query(AgentProfile)
                .filter(AgentProfile.user_id == self.user_id, AgentProfile.agent_key == self.agent_key)
                .first()
            )
            if not profile:
                profile = (
                    db.query(AgentProfile)
                    .filter(AgentProfile.user_id == self.user_id, AgentProfile.agent_type == self.agent_type)
                    .first()
                )
            if profile:
                profile_data = {
                    "display_name": profile.display_name,
                    "enabled": bool(profile.enabled) if profile.enabled is not None else None,
                    "schedule": profile.schedule,
                    "notification_prefs": profile.notification_prefs,
                    "tone": profile.tone,
                    "system_prompt": profile.system_prompt,
                    "task_prompt_template": profile.task_prompt_template,
                    "reporting_prefs": profile.reporting_prefs,
                }
        except Exception:
            profile_data = {}
        finally:
            try:
                if db:
                    db.close()
            except Exception:
                pass

        BaseALwrityAgent._profile_cache[cache_key] = (
            time.time() + BaseALwrityAgent._CONTEXT_CACHE_TTL_SECONDS,
            profile_data,
        )
        return profile_data

    def _load_prompt_context(self) -> Dict[str, Any]:
        cached = BaseALwrityAgent._prompt_context_cache.get(self.user_id)
        if cached is not None:
            expires_at, data = cached
            if time.time() < expires_at:
                return data

        context: Dict[str, Any] = {"website_name": "Your", "website_url": "", "user_id": self.user_id}
        db = None
        try:
            db = get_session_for_user(self.user_id)
            if not db:
                BaseALwrityAgent._prompt_context_cache[self.user_id] = (
                    time.time() + BaseALwrityAgent._CONTEXT_CACHE_TTL_SECONDS,
                    context,
                )
                return context

            from api.content_planning.services.content_strategy.onboarding.data_integration import (
                OnboardingDataIntegrationService,
            )

            integrated = OnboardingDataIntegrationService().get_integrated_data_sync(
                self.user_id, db
            ) or {}
            context = comma_join_context(build_prompt_context(integrated))
            context["user_id"] = self.user_id

            # Preserve the previous runtime prompt size limits.
            for key, max_len in (
                ("brand_voice", 1200),
                ("target_audience", 1200),
                ("core_belief", 400),
                ("style_guidelines", 1200),
                ("seo_summary", 1200),
            ):
                value = str(context.get(key) or "").strip()
                if len(value) > max_len:
                    context[key] = value[: max_len - 20] + " …(truncated)"
        except Exception as context_error:
            logger.warning(
                "Failed to build shared prompt context for user %s: %s",
                self.user_id,
                context_error,
            )
        finally:
            try:
                if db:
                    db.close()
            except Exception:
                pass

        BaseALwrityAgent._prompt_context_cache[self.user_id] = (
            time.time() + BaseALwrityAgent._CONTEXT_CACHE_TTL_SECONDS,
            context,
        )
        return context

    def _render_prompt_template(self, text: str) -> str:
        value = str(text or "")
        # Read through the TTL-bounded loader so long-lived agent instances
        # pick up refreshed onboarding data instead of a stale __init__ snapshot.
        ctx = self._load_prompt_context() or {}
        for k, v in ctx.items():
            placeholder = "{" + str(k) + "}"
            if placeholder in value:
                value = value.replace(placeholder, str(v))
        return value

    def _get_catalog_defaults(self) -> Dict[str, Any]:
        """Load catalog defaults for this agent's agent_key."""
        entry = get_agent_catalog_entry(self.agent_key) or {}
        return entry.get("defaults") or {}

    def get_effective_system_prompt(self, default_prompt: str = "") -> str:
        profile = self._load_agent_profile_overrides() or {}
        override = profile.get("system_prompt")
        catalog_default = self._get_catalog_defaults().get("system_prompt_template")
        selected = override if (override is not None and str(override).strip()) else default_prompt
        if not selected:
            selected = catalog_default
        return self._render_prompt_template(selected)

    def get_effective_task_prompt_template(self, default_template: str = "") -> str:
        profile = self._load_agent_profile_overrides() or {}
        override = profile.get("task_prompt_template")
        catalog_default = self._get_catalog_defaults().get("task_prompt_template")
        selected = override if (override is not None and str(override).strip()) else default_template
        if not selected:
            selected = catalog_default
        return self._render_prompt_template(selected)

    def build_task_prompt(self, instruction: str, task_context: Optional[Dict[str, Any]] = None, default_template: str = "") -> str:
        system_prompt = self.get_effective_system_prompt()
        template = self.get_effective_task_prompt_template(default_template or "")
        context_json = json.dumps(task_context or {}, ensure_ascii=False)
        body = ""
        if template and template.strip():
            body = f"{template}\n\nInstruction: {instruction}\nContext: {context_json}"
        else:
            body = f"Task: {instruction}\nContext: {context_json}\n\nPlease execute this task using your specialized tools and provide a detailed report."
        if system_prompt and system_prompt.strip():
            return f"{system_prompt.strip()}\n\n{body}"
        return body

    def _parse_task_proposals(self, result: Any, max_tasks: int = 5) -> List[TaskProposal]:
        """Parse LLM output into validated TaskProposal objects.

        Tolerant of str/dict/list shapes. Invalid or malformed tasks are
        skipped; an empty result signals the caller to fall back.
        """
        data = result
        if isinstance(result, str):
            try:
                data = json.loads(result)
            except Exception:
                return []
        if not isinstance(data, dict):
            return []

        tasks = data.get("tasks")
        if not isinstance(tasks, list):
            return []

        valid_pillars = {"plan", "generate", "publish", "analyze", "engage", "remarket"}
        valid_priorities = {"high", "medium", "low"}

        proposals: List[TaskProposal] = []
        for t in tasks[:max_tasks]:
            if not isinstance(t, dict):
                continue
            title = str(t.get("title") or "").strip()
            if not title:
                continue
            pillar = str(t.get("pillar_id") or "plan").strip().lower()
            if pillar not in valid_pillars:
                pillar = "plan"
            priority = str(t.get("priority") or "medium").strip().lower()
            if priority not in valid_priorities:
                priority = "medium"
            try:
                estimated_time = int(t.get("estimated_time") or 20)
            except (TypeError, ValueError):
                estimated_time = 20
            risk_level = str(t.get("risk_level") or "low").strip().lower()
            if risk_level not in {"low", "medium", "high"}:
                risk_level = "low"
            action_type = str(t.get("action_type") or "navigate").strip().lower()
            if action_type not in ACTION_TYPES:
                action_type = "navigate"
            proposals.append(
                TaskProposal(
                    title=title,
                    description=str(t.get("description") or ""),
                    pillar_id=pillar,
                    priority=priority,
                    estimated_time=max(1, estimated_time),
                    source_agent=self.__class__.__name__,
                    reasoning=str(t.get("reasoning") or ""),
                    action_type=action_type,
                    action_url=str(t.get("action_url") or ""),
                    evidence=normalize_contract_text(t.get("evidence")),
                    expected_impact=normalize_contract_text(t.get("expected_impact")),
                    effort=normalize_contract_text(t.get("effort")),
                    risk_level=risk_level,
                    measurement=normalize_contract_text(t.get("measurement")),
                    recommendation=normalize_contract_text(t.get("recommendation")),
                    next_action=normalize_contract_text(t.get("next_action")),
                    owner_agent=normalize_contract_text(t.get("owner_agent")),
                    kpi=normalize_contract_text(t.get("kpi")),
                    deadline=normalize_contract_text(t.get("deadline"), 100),
                    action_parameters=t.get("action_parameters") if isinstance(t.get("action_parameters"), dict) else None,
                    synthesis_mode="llm",
                )
            )
        return proposals

    async def _synthesize_task_proposals(
        self,
        context: Dict[str, Any],
        default_proposals: List[TaskProposal],
        instructions: str,
        max_tasks: int = 5,
        allow_decline: bool = True,
    ) -> List[TaskProposal]:
        """Synthesize contextual daily-task proposals via the LLM.

        Uses the agent's effective system prompt + task prompt template (both
        already enriched with onboarding context) to generate personalized
        proposals. Falls back to ``default_proposals`` on any failure so the
        daily workflow never breaks.

        Every returned proposal carries an explicit ``synthesis_mode``:
        successfully parsed LLM output is tagged ``llm``; the fallback bundle
        is tagged ``template_fallback`` so downstream review, persistence,
        and the UI can surface degraded synthesis instead of hiding it.

        When ``allow_decline`` is True, the LLM is instructed that it may
        honestly report "I have nothing to contribute" (raised as
        ``AgentDeclined``) rather than fabricating tasks out of thin air. An
        explicit decline is *not* treated as a synthesis failure and will not
        fall back to ``default_proposals``.
        """
        try:
            role_guidance = get_role_contract(self.agent_key)
            contract_instruction = (
                "\nFor every task, include evidence, expected_impact, effort, "
                "risk_level (low, medium, or high), and measurement.\n"
                + "\n".join(f"- {key}: {value}" for key, value in role_guidance.items())
            )
            decline_instruction = AGENT_DECLINE_INSTRUCTION if allow_decline else ""
            prompt = self.build_task_prompt(
                instruction=instructions + contract_instruction + decline_instruction,
                task_context={"onboarding_data": (context or {}).get("onboarding_data", {})},
            )
            schema = task_output_schema(self.agent_key)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: llm_text_gen(
                    prompt=prompt,
                    json_struct=schema,
                    user_id=self.user_id,
                    flow_type="sif_agent",
                ),
            )
            proposals = self._parse_task_proposals(result, max_tasks)
            if not proposals:
                if allow_decline and _is_agent_decline(result) and not default_proposals:
                    # The agent honestly has nothing to contribute and there
                    # is no deterministic guidance to fall back on — decline
                    # rather than fabricating a task.
                    raise AgentDeclined(AGENT_DECLINE_MESSAGE)
                logger.info(
                    f"[{self.__class__.__name__}] LLM synthesis returned no valid tasks; "
                    "using default proposals."
                )
                for proposal in default_proposals:
                    proposal.synthesis_mode = "template_fallback"
                return default_proposals
            return proposals
        except AgentDeclined:
            raise
        except Exception as e:
            logger.warning(
                f"[{self.__class__.__name__}] LLM task synthesis failed, "
                f"using default proposals: {e}"
            )
            for proposal in default_proposals:
                proposal.synthesis_mode = "template_fallback"
            return default_proposals

    @abstractmethod
    def _create_txtai_agent(self) -> Agent:
        """Create txtai agent with specific tools and configuration"""
        pass
    
    def _create_fallback_agent(self):
        """Fallback agent for development/testing when txtai is not available"""
        class FallbackAgent:
            def __init__(self, agent_type: str):
                self.agent_type = agent_type
                self.available = False
            
            async def run(self, prompt: str, **kwargs) -> str:
                return f"[FALLBACK] {self.agent_type} agent would process: {prompt[:100]}..."
        
        return FallbackAgent(self.agent_type)
    
    async def run(self, prompt: str) -> str:
        """Run the agent with a prompt directly (compatibility method)"""
        db = None
        activity = None
        run_record = None
        try:
            try:
                db = get_session_for_user(self.user_id)
                if db:
                    activity = AgentActivityService(db, self.user_id)
                    run_record = activity.start_run(agent_type=self.agent_type, prompt=prompt)
                    activity.log_event(
                        event_type="plan",
                        severity="info",
                        message=(prompt[:2000] if prompt else None),
                        payload=build_agent_event_payload(phase="planning", step="run_started", tool_name="agent_run", progress_percent=0, input_summary=prompt[:250], output_summary="Agent run initialized", decision_reason="Received run prompt", safe_debug=False, metadata={"kind": "prompt"}),
                        run_id=run_record.id,
                        agent_type=self.agent_type,
                    )
            except Exception:
                activity = None
                run_record = None

            if self.txtai_agent:
                # Check if txtai_agent has run method (e.g. if it's my fallback agent)
                if hasattr(self.txtai_agent, 'run'):
                    if asyncio.iscoroutinefunction(self.txtai_agent.run):
                        result = await self.txtai_agent.run(prompt)
                    else:
                        result = self.txtai_agent.run(prompt)
                else:
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(None, self.txtai_agent, prompt)
            
            if not self.txtai_agent:
                raise RuntimeError(f"Agent {self.agent_id} not initialized (txtai_agent missing)")

            if activity and run_record:
                activity.log_event(
                    event_type="final_summary",
                    severity="info",
                    message=(str(result)[:2000] if result is not None else None),
                    payload=build_agent_event_payload(phase="execution", step="run_completed", tool_name="agent_run", progress_percent=100, output_summary=str(result)[:400] if result is not None else "No output", decision_reason="Run completed", safe_debug=True, metadata={"kind": "result"}),
                    run_id=run_record.id,
                    agent_type=self.agent_type,
                )
                activity.finish_run(run_record.id, success=True, result_summary=(str(result)[:4000] if result is not None else None))
            return result
        except Exception as e:
            logger.error(f"Error running agent {self.agent_id}: {e}")
            if activity and run_record:
                try:
                    activity.log_event(
                        event_type="error",
                        severity="error",
                        message=str(e)[:2000],
                        payload=build_agent_event_payload(phase="execution", step="run_error", tool_name="agent_runtime", output_summary=str(e)[:400], decision_reason="Unhandled exception during run", safe_debug=False, metadata={"kind": "exception"}),
                        run_id=run_record.id,
                        agent_type=self.agent_type,
                    )
                    activity.finish_run(run_record.id, success=False, error_message=str(e)[:4000])
                    activity.create_alert(
                        alert_type="agent_run_failed",
                        title=f"{self.agent_type} failed",
                        message=str(e)[:2000],
                        severity="error",
                        payload={"agent_id": self.agent_id, "agent_type": self.agent_type},
                        dedupe_key=None,
                    )
                except Exception:
                    pass
            return f"Error: {str(e)}"
        finally:
            try:
                if db:
                    db.close()
            except Exception:
                pass

    async def execute_action(self, action: AgentAction) -> Dict[str, Any]:
        """Execute an agent action with performance tracking, safety validation, and rollback support"""
        start_time = datetime.utcnow()
        checkpoint_id = None
        db = None
        activity = None
        run_record = None
        
        try:
            logger.info(f"Agent {self.agent_id} executing action: {action.action_type}")

            try:
                db = get_session_for_user(self.user_id)
                if db:
                    activity = AgentActivityService(db, self.user_id)
                    run_record = activity.start_run(
                        agent_type=self.agent_type,
                        prompt=f"{action.action_type} -> {action.target_resource}",
                    )
                    activity.log_event(
                        event_type="plan",
                        severity="info",
                        message=f"{action.action_type} -> {action.target_resource}",
                        payload=build_agent_event_payload(phase="planning", step="action_received", tool_name=action.action_type, progress_percent=5, input_summary=f"target={action.target_resource}", output_summary="Action accepted for execution", decision_reason="Start run lifecycle", safe_debug=True, metadata={"action": asdict(action)}),
                        run_id=run_record.id,
                        agent_type=self.agent_type,
                    )
            except Exception:
                activity = None
                run_record = None

            quality_gate = validate_action_content(
                action.parameters,
                self._load_prompt_context(),
            )
            quality_override_pending = (
                isinstance(action.parameters, dict)
                and action.parameters.get("quality_override_requested") is True
                and action.requires_approval
            )
            quality_override_approved = (
                isinstance(action.parameters, dict)
                and action.parameters.get("quality_override_approved") is True
            )
            if not quality_gate["is_compliant"] and not quality_override_pending and not quality_override_approved:
                if activity and run_record:
                    activity.log_event(
                        event_type="decision",
                        severity="warning",
                        message="Action blocked by content quality gate",
                        payload=build_agent_event_payload(
                            phase="validation",
                            step="quality_gate_blocked",
                            tool_name="quality_gates",
                            progress_percent=10,
                            input_summary=action.action_type,
                            output_summary="Content violates brand or safety rules",
                            decision_reason="Deterministic content quality gate rejected action",
                            safe_debug=True,
                            metadata={
                                "action_id": action.action_id,
                                "quality_gate": quality_gate,
                            },
                        ),
                        run_id=run_record.id,
                        agent_type=self.agent_type,
                    )
                    activity.finish_run(
                        run_record.id,
                        success=False,
                        error_message="Action blocked by content quality gate",
                    )
                return {
                    "success": False,
                    "error": "Action blocked by content quality gate",
                    "action_id": action.action_id,
                    "agent_id": self.agent_id,
                    "quality_gate": quality_gate,
                }
            
            # 1. Validate action safety
            if not await self._validate_action_safety(action):
                if activity and run_record:
                    activity.log_event(
                        event_type="decision",
                        severity="warning",
                        message="Action failed safety validation",
                        payload=build_agent_event_payload(phase="validation", step="safety_blocked", tool_name="safety_framework", progress_percent=10, input_summary=action.action_type, output_summary="Action blocked by safety validation", decision_reason="Safety framework rejected action", safe_debug=True, metadata={"action_id": action.action_id, "action_type": action.action_type}),
                        run_id=run_record.id,
                        agent_type=self.agent_type,
                    )
                    activity.finish_run(run_record.id, success=False, error_message="Action failed safety validation")
                return {
                    "success": False,
                    "error": "Action failed safety validation",
                    "action_id": action.action_id,
                    "agent_id": self.agent_id,
                    "quality_gate": quality_gate,
                }

            if action.requires_approval:
                approval_id = None
                if activity:
                    req = activity.create_approval_request(
                        action_id=action.action_id,
                        action_type=action.action_type,
                        target_resource=action.target_resource,
                        risk_level=action.risk_level,
                        payload=asdict(action),
                        agent_type=self.agent_type,
                        run_id=run_record.id if run_record else None,
                        expires_at=None,
                    )
                    approval_id = req.id
                    activity.create_alert(
                        alert_type="approval_required",
                        title=f"Approval required: {action.action_type}",
                        message=f"Agent requested approval for {action.action_type} on {action.target_resource}",
                        severity="warning" if action.risk_level < 0.8 else "error",
                        payload={"approval_id": req.id, "action_id": action.action_id, "action_type": action.action_type},
                        cta_path="/approvals",
                        dedupe_key=f"approval:{req.id}",
                    )
                    if run_record:
                        activity.log_event(
                            event_type="decision",
                            severity="info",
                            message="Action requires approval",
                            payload=build_agent_event_payload(phase="approval", step="awaiting_user_decision", tool_name=action.action_type, progress_percent=20, input_summary=action.target_resource, output_summary="Approval request created", decision_reason="Action requires human approval", safe_debug=True, metadata={"approval_id": req.id, "action_id": action.action_id}),
                            run_id=run_record.id,
                            agent_type=self.agent_type,
                        )
                        activity.finish_run(run_record.id, success=False, error_message="Pending approval")
                return {
                    "success": False,
                    "requires_approval": True,
                    "approval_request_id": approval_id,
                    "action_id": action.action_id,
                    "agent_id": self.agent_id,
                }
            
            # 2. Create rollback checkpoint
            try:
                # Capture current system state
                current_state = await self._capture_system_state(action)
                checkpoint_id = await self.safety_framework["rollback_manager"].create_checkpoint(
                    asdict(action), current_state
                )
                if activity and run_record:
                    activity.log_event(
                        event_type="progress",
                        severity="info",
                        message="Rollback checkpoint created",
                        payload=build_agent_event_payload(phase="safety", step="checkpoint_created", tool_name="rollback_manager", progress_percent=35, output_summary="Rollback checkpoint created", decision_reason="Prepare rollback safety net", safe_debug=True, metadata={"checkpoint_id": checkpoint_id}),
                        run_id=run_record.id,
                        agent_type=self.agent_type,
                    )
            except Exception as e:
                logger.warning(f"Failed to create checkpoint: {e}")
                if activity and run_record:
                    activity.log_event(
                        event_type="warning",
                        severity="warning",
                        message=str(e)[:2000],
                        payload=build_agent_event_payload(phase="safety", step="checkpoint_failed", tool_name="rollback_manager", progress_percent=30, output_summary="Checkpoint creation failed", decision_reason="Proceeding without checkpoint", safe_debug=False, metadata={"checkpoint": "failed"}),
                        run_id=run_record.id,
                        agent_type=self.agent_type,
                    )
                # Continue execution even if checkpoint fails? Maybe not for critical actions.
                # For now, we log and proceed.

            # 3. Execute action (with MLflow tracing if enabled)
            if self.txtai_agent and self.txtai_agent.available:
                if self.enable_tracing and MLFLOW_AVAILABLE:
                    with mlflow.start_run(run_name=f"{self.agent_type}_{action.action_type}"):
                        mlflow.log_param("agent_id", self.agent_id)
                        mlflow.log_param("action_type", action.action_type)
                        mlflow.log_dict(action.parameters, "parameters.json")
                        
                        result = await self._execute_with_txtai(action)
                        
                        mlflow.log_text(str(result), "result.txt")
                else:
                    result = await self._execute_with_txtai(action)
            else:
                result = await self._execute_fallback(action)
            
            # 4. Update performance metrics
            end_time = datetime.utcnow()
            response_time = (end_time - start_time).total_seconds()
            await self._update_performance_metrics(True, response_time)
            
            logger.info(f"Agent {self.agent_id} action completed successfully: {action.action_id}")

            if activity and run_record:
                activity.log_event(
                    event_type="final_summary",
                    severity="info",
                    message=str(result)[:2000] if result is not None else None,
                    payload=build_agent_event_payload(phase="execution", step="completed", tool_name=action.action_type, progress_percent=100, output_summary=str(result)[:400] if result is not None else "No output", decision_reason="Action execution completed", safe_debug=True, metadata={"action_id": action.action_id}),
                    run_id=run_record.id,
                    agent_type=self.agent_type,
                )
                activity.finish_run(run_record.id, success=True, result_summary=str(result)[:4000] if result is not None else None)
            
            return {
                "success": True,
                "result": result,
                "action_id": action.action_id,
                "agent_id": self.agent_id,
                "execution_time": response_time,
                "timestamp": end_time.isoformat(),
                "quality_gate": quality_gate,
            }
            
        except Exception as e:
            logger.error(f"Agent {self.agent_id} action failed: {action.action_id} - {e}")
            
            # 5. Handle failure and rollback if needed
            if checkpoint_id:
                logger.info(f"Initiating rollback to checkpoint {checkpoint_id}")
                await self.safety_framework["rollback_manager"].rollback_to_checkpoint(checkpoint_id)
            
            # Track failure in SIF if available
            if hasattr(self, 'sif_service') and self.sif_service:
                try:
                    # Avoid circular import by checking attribute existence
                    # Pass action dict as context
                    await self.sif_service.track_agent_failure(
                        agent_id=self.agent_id,
                        error=e,
                        context=asdict(action)
                    )
                except Exception as tracking_err:
                    logger.warning(f"Failed to track agent failure in SIF: {tracking_err}")
            
            # Update performance metrics
            end_time = datetime.utcnow()
            response_time = (end_time - start_time).total_seconds()
            await self._update_performance_metrics(False, response_time)
            
            if self.enable_tracing and MLFLOW_AVAILABLE:
                 mlflow.log_metric("success", 0)
                 mlflow.log_param("error", str(e))

            if activity and run_record:
                try:
                    activity.log_event(
                        event_type="error",
                        severity="error",
                        message=str(e)[:2000],
                        payload=build_agent_event_payload(phase="execution", step="failed", tool_name=action.action_type, progress_percent=100, output_summary=str(e)[:400], decision_reason="Exception during action execution", safe_debug=False, metadata={"action_id": action.action_id, "checkpoint_id": checkpoint_id}),
                        run_id=run_record.id,
                        agent_type=self.agent_type,
                    )
                    activity.finish_run(run_record.id, success=False, error_message=str(e)[:4000])
                    activity.create_alert(
                        alert_type="agent_action_failed",
                        title=f"{self.agent_type}: {action.action_type} failed",
                        message=str(e)[:2000],
                        severity="error",
                        payload={"agent_id": self.agent_id, "action_id": action.action_id, "action_type": action.action_type},
                    )
                except Exception:
                    pass

            return {
                "success": False,
                "error": str(e),
                "action_id": action.action_id,
                "agent_id": self.agent_id,
                "execution_time": response_time,
                "timestamp": end_time.isoformat(),
                "rollback_initiated": bool(checkpoint_id)
            }
        finally:
            try:
                if db:
                    db.close()
            except Exception:
                pass
    
    async def _capture_system_state(self, action: AgentAction) -> Dict[str, Any]:
        """Capture current system state for rollback purposes"""
        state = {"timestamp": datetime.utcnow().isoformat()}
        
        try:
            # Determine state to capture based on action type
            
            # SEO Optimization (Check first to avoid being caught by generic 'optimize')
            if "seo" in action.action_type:
                 state["seo_state"] = {
                     "target": action.target_resource,
                     "timestamp": datetime.utcnow().isoformat()
                 }
                 if "current_settings" in action.parameters:
                     state["seo_state"]["settings"] = action.parameters["current_settings"]

            # Content Modification
            elif any(kw in action.action_type for kw in ["update", "rewrite", "optimize", "modify", "blog", "article"]):
                if "content_id" in action.parameters:
                    # In a real implementation, fetch from DB using content_id
                    # For now, we capture what we can from parameters or minimal state
                    state["original_content"] = {
                        "id": action.parameters.get("content_id"),
                        "version": "pre_modification"
                    }
                    if "original_content" in action.parameters:
                         state["original_content"]["data"] = action.parameters["original_content"]

        except Exception as e:
            logger.warning(f"Failed to capture detailed system state: {e}")
            
        return state

    async def _execute_with_txtai(self, action: AgentAction) -> str:
        """Execute action using txtai agent"""
        try:
            # Prepare prompt for txtai agent
            prompt = self._prepare_agent_prompt(action)
            
            # Execute with txtai agent via self.run logic
            result = await self.run(prompt)
            
            return result
            
        except Exception as e:
            logger.error(f"txtai agent execution failed: {e}")
            raise e
    
    async def _execute_fallback(self, action: AgentAction) -> str:
        """Fail-fast instead of returning mock fallback output."""
        logger.error(
            "Fallback execution requested for action '%s' on agent %s. Failing fast to avoid mock output.",
            action.action_type,
            self.agent_id,
        )
        raise RuntimeError(
            f"Fallback execution is disabled for SIF reliability. Agent={self.agent_id}, action={action.action_type}"
        )
    
    def _prepare_agent_prompt(self, action: AgentAction) -> str:
        """Prepare prompt for txtai agent"""
        system_prompt = self.get_effective_system_prompt()
        action_prompt = f"""
        You are the {self.agent_type} agent for ALwrity user {self.user_id}.
        
        Action Details:
        - Type: {action.action_type}
        - Target: {action.target_resource}
        - Parameters: {json.dumps(action.parameters, indent=2)}
        - Expected Outcome: {action.expected_outcome}
        - Risk Level: {action.risk_level}
        
        Please execute this action and provide a detailed response.
        Consider user goals, safety constraints, and potential impacts.
        """
        if system_prompt and system_prompt.strip():
            return f"{system_prompt.strip()}\n{action_prompt}"
        return action_prompt
    
    async def _validate_action_safety(self, action: AgentAction) -> bool:
        """Validate action against safety constraints"""
        try:
            # Use SafetyConstraintManager from safety_framework
            validation_result = await self.safety_framework["constraint_manager"].validate_action(asdict(action))
            
            if not validation_result.is_valid:
                logger.warning(f"Safety validation failed for action {action.action_id}: {validation_result.violations}")
                
                # Check if approval is required and handle it
                if validation_result.requires_approval:
                    logger.info(f"Requesting approval for action {action.action_id}")
                    await self.safety_framework["approval_system"].request_approval(asdict(action))
                    return False # Pending approval counts as false for immediate execution
                
                return False
                
            return True
        except Exception as e:
            logger.error(f"Error during safety validation: {e}")
            # Fail safe
            return False
    
    async def _update_performance_metrics(self, success: bool, response_time: float):
        """Update agent performance metrics"""
        self.performance.total_actions += 1
        self.performance.last_action_at = datetime.utcnow().isoformat()
        
        if success:
            self.performance.successful_actions += 1
        else:
            self.performance.failed_actions += 1
        
        # Update average response time
        if self.performance.average_response_time == 0:
            self.performance.average_response_time = response_time
        else:
            self.performance.average_response_time = (
                (self.performance.average_response_time * (self.performance.total_actions - 1) + response_time) 
                / self.performance.total_actions
            )
        
        # Update success rate
        if self.performance.total_actions > 0:
            self.performance.success_rate = (
                self.performance.successful_actions / self.performance.total_actions
            )

        # Calculate efficiency score (0.0 to 1.0)
        # Based on success rate and response time
        time_factor = min(1.0, 30.0 / max(self.performance.average_response_time, 1.0))
        self.performance.efficiency_score = (
            self.performance.success_rate * 0.7 + time_factor * 0.3
        )

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose daily tasks based on the agent's domain and context.
        Must be implemented by specialized agents.
        """
        return []

    def get_performance_metrics(self) -> AgentPerformance:
        """Get current performance metrics"""
        return self.performance
    
    async def get_current_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            "user_id": self.user_id,
            "status": "active" if self.txtai_agent else "fallback",
            "performance": asdict(self.performance),
            "last_updated": datetime.utcnow().isoformat()
        }


def __getattr__(name: str):
    """Lazily re-export StrategyOrchestratorAgent from its new module.

    Keeps every existing ``from ...core_agent_framework import
    StrategyOrchestratorAgent`` working after the file split without a
    module-level import (which would be circular: the new module imports
    this one).
    """
    if name == "StrategyOrchestratorAgent":
        from services.intelligence.agents.strategy_orchestrator_agent import (
            StrategyOrchestratorAgent as _StrategyOrchestratorAgent,
        )

        return _StrategyOrchestratorAgent
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

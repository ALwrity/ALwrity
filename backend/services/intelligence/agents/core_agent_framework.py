"""
Core Agent Framework for ALwrity Autonomous Marketing System
Built on txtai's native Agent framework (smolagents)
"""

import asyncio
import json
import logging
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
import time

logger = get_service_logger(__name__)

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

class BaseALwrityAgent(ABC):
    """Base class for all ALwrity marketing agents"""

    _prompt_context_cache: Dict[str, Dict[str, Any]] = {}
    _profile_cache: Dict[str, Dict[str, Any]] = {}
    
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
                    # _create_txtai_agent might be async or sync
                    # CRITICAL FIX: We cannot await here. If it's async, we must run it in a loop or warn.
                    # Given specialized agents define it as async, we need a sync wrapper or run_until_complete.
                    
                    if asyncio.iscoroutinefunction(self._create_txtai_agent):
                         try:
                             # Check if we are in a running loop
                             try:
                                 loop = asyncio.get_running_loop()
                             except RuntimeError:
                                 loop = None
                             
                             if loop and loop.is_running():
                                 # We are already in a loop (e.g. server), we can't block.
                                 # This is a design flaw in initializing async agents in __init__.
                                 # We will defer initialization or use a sync wrapper if possible.
                                 logger.warning(f"Cannot await async _create_txtai_agent for {agent_type} in __init__ within running loop. Initializing via create_task (agent may not be ready immediately).")
                                 
                                 # Create a task to initialize it
                                 async def async_init():
                                     try:
                                         self.txtai_agent = await self._create_txtai_agent()
                                         logger.info(f"Async initialized txtai agent for {agent_type} - {self.agent_id}")
                                     except Exception as e:
                                         logger.error(f"Async initialization failed for {agent_type}: {e}")
                                         
                                 loop.create_task(async_init())
                                 # Temporarily set to None or a placeholder, but we can't set it to the result yet
                                 self.txtai_agent = None 
                             else:
                                 # No running loop, we can run_until_complete
                                 if not loop:
                                     loop = asyncio.new_event_loop()
                                     asyncio.set_event_loop(loop)
                                 self.txtai_agent = loop.run_until_complete(self._create_txtai_agent())
                         except Exception as e:
                             logger.error(f"Failed to handle async initialization for {agent_type}: {e}")
                             # Try fallback to sync run if possible
                             try:
                                 self.txtai_agent = asyncio.run(self._create_txtai_agent())
                             except Exception as e2:
                                 logger.error(f"Even asyncio.run failed: {e2}")
                                 raise e
                    else:
                         self.txtai_agent = self._create_txtai_agent()
                         
                    if self.txtai_agent:
                        logger.info(f"Initialized txtai agent for {agent_type} - {self.agent_id}")
                    else:
                        raise RuntimeError(f"txtai agent creation returned None for {agent_type}")
                except Exception as inner_e:
                    logger.error(f"Could not initialize specific txtai agent for {agent_type}: {inner_e}")
                    # Fail fast: Re-raise exception
                    raise inner_e
            except Exception as e:
                logger.error(f"Failed to initialize txtai agent for {agent_type}: {e}")
                # Fail fast: Re-raise exception
                raise e
        else:
            raise RuntimeError(f"txtai not available for {agent_type}")

        # Initialize safety framework
        self.safety_framework = get_safety_framework(user_id)

    async def _generate_llm_response(self, prompt: str) -> str:
        """
        Helper to generate text using the agent's LLM with usage tracking.
        Centralized method for all agents inheriting from BaseALwrityAgent.
        """
        if not self.llm:
            logger.error("LLM unavailable for agent %s (%s)", self.agent_type, self.agent_id)
            raise RuntimeError(f"LLM unavailable for agent {self.agent_type}")
            
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
            return cached

        profile_data: Dict[str, Any] = {}
        db = None
        try:
            db = get_session_for_user(self.user_id)
            if not db:
                BaseALwrityAgent._profile_cache[cache_key] = profile_data
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

        BaseALwrityAgent._profile_cache[cache_key] = profile_data
        return profile_data

    def _load_prompt_context(self) -> Dict[str, Any]:
        cached = BaseALwrityAgent._prompt_context_cache.get(self.user_id)
        if cached is not None:
            return cached

        context: Dict[str, Any] = {"website_name": "Your", "website_url": "", "user_id": self.user_id}
        db = None
        try:
            db = get_session_for_user(self.user_id)
            if not db:
                BaseALwrityAgent._prompt_context_cache[self.user_id] = context
                return context

            from api.content_planning.services.content_strategy.onboarding.data_integration import (
                OnboardingDataIntegrationService,
            )

            svc = OnboardingDataIntegrationService()
            integrated = svc.get_integrated_data_sync(self.user_id, db) or {}
            website_analysis = integrated.get("website_analysis") or {}
            canonical = integrated.get("canonical_profile") or {}

            website_url = (
                website_analysis.get("website_url")
                or website_analysis.get("website")
                or canonical.get("website_url")
                or canonical.get("website")
                or ""
            )
            domain = website_analysis.get("domain") or canonical.get("domain") or ""
            website_name = ""
            if domain:
                website_name = str(domain).split(".")[0].strip()
            if not website_name and website_url:
                try:
                    from urllib.parse import urlparse
                    host = urlparse(str(website_url)).hostname or ""
                    host = host.replace("www.", "")
                    website_name = host.split(".")[0].strip() or host
                except Exception:
                    website_name = ""

            context = {
                "user_id": self.user_id,
                "website_url": str(website_url or ""),
                "website_name": str(website_name or "Your"),
            }

            writing_style = canonical.get("writing_style") or {}
            if isinstance(writing_style, dict):
                if writing_style.get("tone"):
                    context["writing_tone"] = writing_style.get("tone")
                if writing_style.get("voice"):
                    context["writing_voice"] = writing_style.get("voice")
        except Exception:
            pass
        finally:
            try:
                if db:
                    db.close()
            except Exception:
                pass

        BaseALwrityAgent._prompt_context_cache[self.user_id] = context
        return context

    def _render_prompt_template(self, text: str) -> str:
        value = str(text or "")
        ctx = self._prompt_context or {}
        for k, v in ctx.items():
            placeholder = "{" + str(k) + "}"
            if placeholder in value:
                value = value.replace(placeholder, str(v))
        return value

    def get_effective_system_prompt(self, default_prompt: str) -> str:
        override = (self._agent_profile or {}).get("system_prompt")
        selected = override if (override is not None and str(override).strip()) else default_prompt
        return self._render_prompt_template(selected)

    def get_effective_task_prompt_template(self, default_template: str = "") -> str:
        override = (self._agent_profile or {}).get("task_prompt_template")
        selected = override if (override is not None and str(override).strip()) else default_template
        return self._render_prompt_template(selected)

    def build_task_prompt(self, instruction: str, task_context: Optional[Dict[str, Any]] = None, default_template: str = "") -> str:
        template = self.get_effective_task_prompt_template(default_template or "")
        context_json = json.dumps(task_context or {}, ensure_ascii=False)
        if template and template.strip():
            return f"{template}\n\nInstruction: {instruction}\nContext: {context_json}"
        return f"Task: {instruction}\nContext: {context_json}\n\nPlease execute this task using your specialized tools and provide a detailed report."
    
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
                    "agent_id": self.agent_id
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
                "timestamp": end_time.isoformat()
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
        return f"""
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

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose daily tasks based on the agent's domain and context.
        Must be implemented by specialized agents.
        """
        return []
        
        # Calculate efficiency score (0.0 to 1.0)
        # Based on success rate and response time
        time_factor = min(1.0, 30.0 / max(self.performance.average_response_time, 1.0))
        self.performance.efficiency_score = (
            self.performance.success_rate * 0.7 + time_factor * 0.3
        )
    
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

class StrategyOrchestratorAgent(BaseALwrityAgent):
    """Central orchestrator agent that coordinates all marketing agents"""
    
    def __init__(self, user_id: str, market_detector: Any = None, performance_monitor: Any = None, llm: Any = None, **kwargs):
        super().__init__(user_id, "StrategyOrchestrator", llm=llm, **kwargs)
        self.market_detector = market_detector
        self.performance_monitor = performance_monitor
        self.sub_agents = {}
        self.active_strategies = []
        
    def set_sub_agents(self, agents: Dict[str, Any]):
        """Set available sub-agents"""
        self.sub_agents = agents
    
    def _create_txtai_agent(self) -> Agent:
        """Create txtai orchestrator agent with coordination tools"""
        if not TXTAI_AVAILABLE:
            return None

        _llm_for_agent = self.llm
        for _ in range(3):
            _llm_for_agent = getattr(_llm_for_agent, "llm", _llm_for_agent)
        return Agent(llm=_llm_for_agent, tools=[], max_iterations=15)
    
    async def _market_signal_detector_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Tool for detecting market signals"""
        try:
            signals = []
            if self.market_detector:
                signals = await self.market_detector.detect_market_signals()
            
            return {
                "signals_detected": len(signals),
                "latest_signals": [s.dict() for s in signals[-5:]] if signals else [],
                "threat_level": self._assess_threat_level(signals),
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {"error": str(e), "signals": []}

    async def _google_trends_fetcher_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        try:
            keywords = context.get("keywords") or []
            timeframe = context.get("timeframe") or "today 12-m"
            geo = context.get("geo") or "US"

            if not isinstance(keywords, list):
                keywords = [str(keywords)]
            keywords = [str(k).strip() for k in keywords if str(k).strip()]
            if not keywords:
                return {"error": "keywords is required", "success": False}

            from services.research.trends.google_trends_service import GoogleTrendsService
            from services.intelligence.txtai_service import TxtaiIntelligenceService

            trends = await GoogleTrendsService().analyze_trends(
                keywords=keywords,
                timeframe=timeframe,
                geo=geo,
                user_id=self.user_id,
            )

            run_id = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
            latest_id = f"market_trends_latest:{self.user_id}"
            run_doc_id = f"market_trends_run:{self.user_id}:{run_id}"

            summary = (
                f"LATEST Market Trends for {geo} ({timeframe}). Keywords: {', '.join(trends.get('keywords', keywords))}. "
                f"Related queries top: {len((trends.get('related_queries') or {}).get('top', []))}. "
                f"Related topics top: {len((trends.get('related_topics') or {}).get('top', []))}."
            )

            metadata = {
                "type": "market_trends",
                "user_id": self.user_id,
                "run_id": run_id,
                "run_timestamp": trends.get("timestamp") or datetime.utcnow().isoformat(),
                "timeframe": timeframe,
                "geo": geo,
                "keywords": trends.get("keywords", keywords),
                "is_latest": True,
                "full_report": trends,
            }

            intelligence = TxtaiIntelligenceService(self.user_id)
            await intelligence.index_content(
                [
                    (latest_id, summary, metadata),
                    (run_doc_id, summary, {**metadata, "is_latest": False}),
                ]
            )

            return {
                "success": True,
                "run_id": run_id,
                "latest_doc_id": latest_id,
                "run_doc_id": run_doc_id,
                "keywords": trends.get("keywords", keywords),
                "geo": geo,
                "timeframe": timeframe,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _agent_coordinator_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Tool for coordinating agent actions"""
        return {
            "agents_available": list(self.sub_agents.keys()),
            "coordination_status": "active",
            "last_coordination": datetime.utcnow().isoformat()
        }
    
    async def _performance_analyzer_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Tool for analyzing performance metrics"""
        try:
            perf_data = {}
            if self.performance_monitor:
                perf_data = self.performance_monitor.get_all_agents_performance()
                
            return {
                "overall_performance": perf_data,
                "agent_efficiency": self.performance.efficiency_score,
                "recommendations": ["Optimize content agent latency", "Increase SEO agent throughput"],
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {"error": str(e)}
    
    async def _kickoff_gsc_first_pass_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Invoke SEO and Content agents' default GSC plans and combine results"""
        try:
            start_date = context.get("start_date")
            end_date = context.get("end_date")
            payload = {"start_date": start_date, "end_date": end_date}
            results = {}
            combined_actions = []
            
            seo = self.sub_agents.get("seo")
            if seo and hasattr(seo, "_default_seo_gsc_plan_tool"):
                plan = await seo._default_seo_gsc_plan_tool(payload)
                results["seo"] = plan
                combined_actions.extend(plan.get("actions", []) if isinstance(plan, dict) else [])
            
            content = self.sub_agents.get("content")
            if content and hasattr(content, "_default_content_gsc_plan_tool"):
                plan = await content._default_content_gsc_plan_tool(payload)
                results["content"] = plan
                combined_actions.extend(plan.get("actions", []) if isinstance(plan, dict) else [])
            
            return {
                "status": "ok",
                "invoked": list(results.keys()),
                "results": results,
                "combined_actions": combined_actions,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def _strategy_synthesizer_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Tool for synthesizing strategies"""
        return {
            "strategies_active": len(self.active_strategies),
            "synthesis_capability": "ready",
            "unified_strategy": "Focus on high-engagement topics while monitoring competitor X",
            "last_synthesis": datetime.utcnow().isoformat()
        }
    
    async def _delegate_task_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Tool to delegate a specific task to a specialized agent.
        Expected context keys: 'agent_name', 'instruction', 'task_context'
        """
        agent_name = context.get('agent_name')
        instruction = context.get('instruction')
        task_context = context.get('task_context', {})
        
        if not agent_name or not instruction:
            return {"error": "Missing agent_name or instruction"}
            
        agent = self.sub_agents.get(agent_name)
        if not agent:
            return {"error": f"Agent {agent_name} not available. Available: {list(self.sub_agents.keys())}"}
            
        try:
            # Delegate execution to the sub-agent
            logger.info(f"Delegating task to {agent_name}: {instruction}")
            sub_agent_prompt = None
            if hasattr(agent, "build_task_prompt"):
                try:
                    sub_agent_prompt = agent.build_task_prompt(instruction=instruction, task_context=task_context)
                except Exception:
                    sub_agent_prompt = None
            if not sub_agent_prompt:
                sub_agent_prompt = f"Task: {instruction}\nContext: {json.dumps(task_context)}\n\nPlease execute this task using your specialized tools and provide a detailed report."
            
            # Execute the agent
            result = await agent.run(sub_agent_prompt)
            
            return {
                "status": "success",
                "agent": agent_name,
                "result": result,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Delegation to {agent_name} failed: {e}")
            return {"error": str(e)}

    def _assess_threat_level(self, signals: List[Any] = None) -> str:
        """Assess current threat level based on market signals"""
        if not signals:
            return "low"
            
        critical_count = len([s for s in signals if getattr(s, 'urgency_level', 'low') == 'critical'])
        if critical_count > 0:
            return "critical"
            
        high_count = len([s for s in signals if getattr(s, 'urgency_level', 'low') == 'high'])
        if high_count > 2:
            return "high"
            
        return "moderate"

# Global agent service instance (Deprecated, use agent_orchestrator.py)
# This file now focuses on core definitions

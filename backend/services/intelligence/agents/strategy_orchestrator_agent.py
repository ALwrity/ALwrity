"""StrategyOrchestratorAgent - the txtai-based marketing team orchestrator.

Moved verbatim from core_agent_framework.py to shrink that module (pure
file split, no behavior change). Everything this class needs from the
framework is imported from core_agent_framework directly; the framework
itself re-exports this class lazily via module __getattr__ so every
existing import keeps working unchanged.
"""

import asyncio
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger

from services.intelligence.agents import core_agent_framework as _caf
from services.intelligence.agents.core_agent_framework import (
    BaseALwrityAgent,
    _build_market_trends_envelope,
)
from services.research.trends import TavilyTrendProvider, TrendPlatform, synthesize_trends

# txtai imports for the native agent framework (same fallback chain as
# core_agent_framework - the class body and its tool wrappers reference
# Agent/TXTAI_AVAILABLE at import time).
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

# Thread pool for running async orchestrator tools from sync txtai Agent
# calls. Fresh pool for this module (same shape as the framework's own).
_orchestrator_tool_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="orch_tool")


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
        return Agent(
            llm=_llm_for_agent,
            tools=[
                {
                    "name": "market_signal_detector",
                    "description": "Detects current market signals (competitor moves, SERP changes, social trends) and returns the latest signals with threat level assessment.",
                    "target": self._market_signal_detector_tool_sync,
                },
                {
                    "name": "google_trends_fetcher",
                    "description": "Fetches Google Trends data for given keywords, timeframe, and geo. Indexes results for semantic search. Expected context: keywords (list), timeframe (e.g. 'today 12-m'), geo (e.g. 'US').",
                    "target": self._google_trends_fetcher_tool_sync,
                },
                {
                    "name": "agent_coordinator",
                    "description": "Lists available sub-agents and their coordination status. Use this to discover which specialist agents can be delegated to.",
                    "target": self._agent_coordinator_tool_sync,
                },
                {
                    "name": "performance_analyzer",
                    "description": "Analyzes performance metrics across all agents. Returns overall performance data, efficiency scores, and optimization recommendations.",
                    "target": self._performance_analyzer_tool_sync,
                },
                {
                    "name": "kickoff_gsc_first_pass",
                    "description": "Invokes SEO and Content agents' default GSC (Google Search Console) first-pass plans and combines results. Expected context: start_date, end_date.",
                    "target": self._kickoff_gsc_first_pass_tool_sync,
                },
                {
                    "name": "strategy_synthesizer",
                    "description": "Synthesizes active strategies into a unified marketing strategy. Returns current strategy count and synthesis capability status.",
                    "target": self._strategy_synthesizer_tool_sync,
                },
                {
                    "name": "task_delegator",
                    "description": "Delegates a specific task to a specialized sub-agent. Expected context: agent_name (str, must match a key from agent_coordinator), instruction (str, the task to perform), task_context (dict, optional additional context).",
                    "target": self._delegate_task_tool_sync,
                },
            ],
            max_iterations=15,

        )

    def _run_async_tool_sync(self, coro) -> Any:
        """Run an async coroutine in a thread pool, returning the result synchronously.

        Used to bridge async orchestrator tool methods with txtai's sync Agent tool calls.
        Each invocation creates a fresh event loop in a worker thread, runs the coroutine,
        and closes the loop — safe to call from within an already-running async context.
        """
        def _run_in_thread():
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(coro)
            finally:
                try:
                    loop.close()
                except Exception:
                    pass
        future = _orchestrator_tool_executor.submit(_run_in_thread)
        return future.result(timeout=120)

    def _market_signal_detector_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects current market signals (competitor moves, SERP changes, social
        trends) and returns the latest signals with a threat level assessment.

        Args:
            context: Input parameters for the tool. No required keys; may be empty.

        Returns:
            A dictionary with signals_detected, latest_signals, threat_level and
            a timestamp (or an "error" key on failure).
        """
        return self._run_async_tool_sync(self._market_signal_detector_tool(context))

    def _google_trends_fetcher_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fetches Google Trends data for the given keywords, timeframe, and geo,
        and indexes the results for semantic search.

        Args:
            context: Input parameters for the tool. Example keys:
                - keywords: list of keywords to fetch trends for (required)
                - timeframe: trends window, e.g. "today 12-m"
                - geo: country code, e.g. "US"

        Returns:
            A dictionary with the trends envelope, or an "error" key on failure.
        """
        return self._run_async_tool_sync(self._google_trends_fetcher_tool(context))

    def _agent_coordinator_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Lists available sub-agents and their coordination status so the caller
        can discover which specialist agents can be delegated to.

        Args:
            context: Input parameters for the tool. No required keys; may be empty.

        Returns:
            A dictionary describing available sub-agents and their status.
        """
        return self._run_async_tool_sync(self._agent_coordinator_tool(context))

    def _performance_analyzer_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes performance metrics across all agents and returns overall
        performance data, efficiency scores, and optimization recommendations.

        Args:
            context: Input parameters for the tool. No required keys; may be empty.

        Returns:
            A dictionary with performance metrics and recommendations.
        """
        return self._run_async_tool_sync(self._performance_analyzer_tool(context))

    def _kickoff_gsc_first_pass_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Invokes the SEO and Content agents' default GSC (Google Search Console)
        first-pass plans and combines the results.

        Args:
            context: Input parameters for the tool. Example keys:
                - start_date: GSC window start date
                - end_date: GSC window end date

        Returns:
            A dictionary combining the agents' first-pass GSC results.
        """
        return self._run_async_tool_sync(self._kickoff_gsc_first_pass_tool(context))

    def _strategy_synthesizer_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Synthesizes active strategies into a unified marketing strategy.

        Args:
            context: Input parameters for the tool. No required keys; may be empty.

        Returns:
            A dictionary with the current strategy count and synthesis status.
        """
        return self._run_async_tool_sync(self._strategy_synthesizer_tool(context))

    def _delegate_task_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Delegates a specific task to a specialized sub-agent.

        Args:
            context: Input parameters for the tool. Example keys:
                - agent_name: sub-agent key (see agent_coordinator) (required)
                - instruction: the task to perform (required)
                - task_context: optional additional context (dict)

        Returns:
            A dictionary with the delegation outcome.
        """
        return self._run_async_tool_sync(self._delegate_task_tool(context))
    
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

            from services.intelligence.txtai_service import TxtaiIntelligenceService

            provider = getattr(self, "trend_provider", None) or TavilyTrendProvider()
            items = await provider.fetch_trends(
                TrendPlatform.WEB, industry="", keywords=keywords, user_id=self.user_id
            )
            report = await synthesize_trends(
                items, TrendPlatform.WEB, user_id=self.user_id, focus="market trends summary"
            )
            trends = _build_market_trends_envelope(keywords, timeframe, geo, items, report)

            run_id = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
            latest_id = f"market_trends_latest:{self.user_id}"
            run_doc_id = f"market_trends_run:{self.user_id}:{run_id}"

            summary = (
                f"LATEST Market Trends for {geo} ({timeframe}). Keywords: {', '.join(trends.get('keywords', keywords))}. "
                f"Trend items: {len(items)}. Synthesis trends: {len(report.get('trends', []))}."
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
    
    @staticmethod
    def _derive_performance_recommendations(perf_rows: List[Dict[str, Any]]) -> List[str]:
        """Derive recommendations from real agent performance rows.

        Every recommendation must trace to an actual metric value; when no
        threshold is breached the list is empty rather than padded.
        """
        recommendations: List[str] = []
        for row in perf_rows or []:
            if not isinstance(row, dict):
                continue
            agent_id = str(row.get("agent_id") or "unknown-agent")
            try:
                total_actions = int(row.get("total_actions") or 0)
                success_rate = float(row.get("success_rate") or 0.0)
                response_time = float(row.get("response_time") or 0.0)
            except (TypeError, ValueError):
                continue
            if total_actions == 0:
                recommendations.append(
                    f"{agent_id}: has not executed any actions yet - verify it is enabled and scheduled."
                )
            elif success_rate < 0.7:
                recommendations.append(
                    f"{agent_id}: success rate {success_rate:.0%} is below target - inspect recent run errors."
                )
            elif response_time > 30.0:
                recommendations.append(
                    f"{agent_id}: average response time {response_time:.1f}s exceeds the 30s budget - reduce task scope or tool latency."
                )
        return recommendations

    async def _performance_analyzer_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Tool for analyzing performance metrics"""
        try:
            perf_data: List[Dict[str, Any]] = []
            if self.performance_monitor:
                perf_data = await self.performance_monitor.get_all_agents_performance() or []

            return {
                "overall_performance": perf_data,
                "agent_efficiency": self.performance.efficiency_score,
                "recommendations": self._derive_performance_recommendations(perf_data),
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
        """Synthesize a unified strategy from active strategies and onboarding context.

        Grounds the output in real user data (active strategies, business goals,
        content pillars, competitors) instead of returning a canned claim. Falls
        back to a deterministic digest of the same inputs when the LLM is
        unavailable.
        """
        try:
            prompt_ctx = self._load_prompt_context()

            strategy_summaries: List[str] = []
            for s in list(self.active_strategies or [])[:10]:
                if isinstance(s, dict):
                    summary = s.get("name") or s.get("title") or s.get("goal") or ""
                else:
                    summary = getattr(s, "name", "") or str(s)
                summary = str(summary).strip()
                if summary:
                    strategy_summaries.append(summary)

            inputs: List[str] = []
            if strategy_summaries:
                inputs.append("Active strategies:\n- " + "\n- ".join(strategy_summaries))
            for key, label in (
                ("business_goals", "Business goals"),
                ("content_pillars", "Content pillars"),
                ("target_audience", "Target audience"),
                ("brand_voice", "Brand voice"),
                ("competitors", "Competitors"),
            ):
                value = str(prompt_ctx.get(key) or "").strip()
                if value:
                    inputs.append(f"{label}: {value}")
            roster = ", ".join(sorted(self.sub_agents.keys())) or "none"
            inputs.append(f"Available specialist agents: {roster}")

            has_real_input = bool(strategy_summaries) or bool(
                str(prompt_ctx.get("business_goals") or "").strip()
            )

            result = {
                "strategies_active": len(self.active_strategies or []),
                "synthesis_capability": "ready",
                "inputs_considered": len(inputs),
                "last_synthesis": datetime.utcnow().isoformat(),
            }

            if not has_real_input:
                result["unified_strategy"] = ""
                result["note"] = (
                    "No active strategies or business goals available yet; "
                    "complete onboarding to enable synthesis."
                )
                return result

            schema = {
                "type": "object",
                "properties": {
                    "unified_strategy": {"type": "string"},
                    "key_priorities": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["unified_strategy"],
            }
            prompt = (
                "You are synthesizing a unified marketing strategy.\n"
                "Combine the inputs below into ONE coherent strategy paragraph "
                "(max ~120 words), then list up to 5 key priorities.\n"
                "Ground every statement in the inputs - do not invent data.\n\n"
                + "\n".join(inputs)
            )

            unified = ""
            priorities: List[str] = []
            try:
                loop = asyncio.get_event_loop()
                llm_result = await loop.run_in_executor(
                    None,
                    lambda: _caf.llm_text_gen(
                        prompt=prompt,
                        json_struct=schema,
                        user_id=self.user_id,
                        flow_type="sif_agent",
                    ),
                )
                if isinstance(llm_result, str):
                    try:
                        llm_result = json.loads(llm_result)
                    except (ValueError, TypeError):
                        llm_result = {}
                unified = str((llm_result or {}).get("unified_strategy") or "").strip()
                priorities = [
                    str(p).strip()
                    for p in ((llm_result or {}).get("key_priorities") or [])
                    if str(p).strip()
                ][:5]
            except Exception as llm_err:
                logger.warning(
                    f"_strategy_synthesizer_tool LLM synthesis failed, using input digest: {llm_err}"
                )

            if not unified:
                unified = " | ".join(inputs[:4])
                result["note"] = (
                    "LLM synthesis unavailable; returning structured digest of inputs."
                )

            result["unified_strategy"] = unified
            if priorities:
                result["key_priorities"] = priorities
            return result
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
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

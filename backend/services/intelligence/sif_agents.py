"""
SIF Agent Interfaces
Defines the specialized agents for digital marketing and SEO.
Each agent leverages TxtaiIntelligenceService for semantic operations.
"""

import traceback
import json
import asyncio
import re
from collections import Counter
from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger
from .txtai_service import TxtaiIntelligenceService, TXTAI_AVAILABLE
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent
from services.llm_providers.main_text_generation import llm_text_gen

# Optional txtai imports (align with core agent framework)
try:
    from txtai import Agent, LLM
except ImportError:
    Agent = None
    LLM = None

class SharedLLMWrapper:
    """Wraps the shared ALwrity LLM service to look like a txtai LLM."""
    def __init__(self, user_id: str, task: Optional[str] = None):
        self.user_id = user_id
        self.task = task
    
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using the shared LLM provider."""
        try:
            return llm_text_gen(
                prompt,
                user_id=self.user_id,
                preferred_hf_models=LOW_COST_SHARED_REMOTE_MODELS,
                flow_type="sif_agent",
            )
        except Exception as e:
            logger.error(f"SharedLLMWrapper failed to generate text: {e}")
            return f"[ERROR: Shared LLM generation failed for user {self.user_id}]"
        
    def __call__(self, prompt: str, **kwargs) -> str:
        return self.generate(prompt, **kwargs)

_local_llm_cache = {}

LOW_COST_SHARED_REMOTE_MODELS = [
    "Qwen/Qwen2.5-1.5B-Instruct",
    "Qwen/Qwen2.5-0.5B-Instruct",
    "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
]

LOCAL_LLM_FALLBACKS = [
    "Qwen/Qwen2.5-1.5B-Instruct",
    "Qwen/Qwen2.5-0.5B-Instruct",
    "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
]

class LocalLLMWrapper:
    """
    Wraps a local LLM with async lifecycle support.
    Model loading runs off the event loop so it never blocks the server.
    Loaded models are cached globally (shared across all instances).
    """

    def __init__(self, model_path: str, task: str = None):
        self.model_path = model_path
        self.task = task
        self._initialized = False
        self._init_task = None

    def _load_model_sync(self) -> Any:
        """Load model (blocking — call via thread executor from async code)."""
        cache_key = f"{self.model_path}:{self.task}"
        if cache_key in _local_llm_cache:
            return _local_llm_cache[cache_key]

        if LLM is None:
            raise ImportError("txtai.pipeline.LLM is not available")

        task_to_use = (self.task or "language-generation").strip()
        if any(x in self.model_path for x in ["Qwen", "Instruct", "GPT", "Llama"]):
            task_to_use = "language-generation"
        if task_to_use == "text-generation":
            task_to_use = "language-generation"

        candidate_models = []
        for candidate in [self.model_path, *LOCAL_LLM_FALLBACKS]:
            if candidate not in candidate_models:
                candidate_models.append(candidate)

        last_error = None
        for candidate_model in candidate_models:
            candidate_key = f"{candidate_model}:{self.task}"
            if candidate_key in _local_llm_cache:
                if candidate_model != self.model_path:
                    logger.warning(f"Using cached fallback local LLM model: {candidate_model}")
                return _local_llm_cache[candidate_key]

            logger.info(f"Loading local LLM (singleton): {candidate_model} (task={task_to_use})")
            try:
                _local_llm_cache[candidate_key] = LLM(path=candidate_model, task=task_to_use)
                if candidate_model != self.model_path:
                    logger.warning(
                        f"Loaded fallback local LLM model '{candidate_model}' after failure on '{self.model_path}'"
                    )
                return _local_llm_cache[candidate_key]
            except Exception as e:
                last_error = e
                message = str(e).lower()
                is_memory_issue = (
                    "paging file is too small" in message
                    or "os error 1455" in message
                    or "out of memory" in message
                    or "not enough memory" in message
                )
                if is_memory_issue:
                    logger.warning(
                        f"Local LLM memory load failure for '{candidate_model}', trying smaller fallback. Error: {e}"
                    )
                    continue
                logger.warning(f"Local LLM load failed for '{candidate_model}', trying next fallback. Error: {e}")
                continue

        try:
            import transformers
            from transformers.pipelines import SUPPORTED_TASKS
            logger.error(
                f"LocalLLMWrapper init failed (model={self.model_path}, requested_task={task_to_use}, "
                f"transformers={getattr(transformers, '__version__', 'unknown')}, "
                f"supported_tasks={sorted(list(SUPPORTED_TASKS.keys()))[:50]})"
            )
        except Exception:
            pass
        logger.error(f"Failed to initialize LocalLLMWrapper after fallback attempts: {last_error}")
        raise last_error

    @property
    def llm(self):
        """Sync accessor — lazy loads via global cache. Blocks on first call."""
        cache_key = f"{self.model_path}:{self.task}"
        if cache_key in _local_llm_cache:
            return _local_llm_cache[cache_key]
        result = self._load_model_sync()
        self._initialized = True
        return result

    async def initialize(self) -> bool:
        """Pre-load model asynchronously. Call at server startup to avoid first-request delay."""
        if self._initialized:
            return True
        cache_key = f"{self.model_path}:{self.task}"
        if cache_key in _local_llm_cache:
            self._initialized = True
            return True
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._load_model_sync)
            self._initialized = True
            return True
        except Exception as e:
            logger.error(f"[LocalLLMWrapper] Async init failed for {self.model_path}: {e}")
            return False

    async def ensure_initialized_async(self) -> bool:
        """Public async hook — ensures model is loaded without blocking the event loop."""
        if self._initialized:
            return True
        return await self.initialize()

    async def shutdown(self):
        """Release model resources."""
        cache_key = f"{self.model_path}:{self.task}"
        _local_llm_cache.pop(cache_key, None)
        self._initialized = False

    def __call__(self, prompt: str, **kwargs) -> str:
        return self.llm(prompt, **kwargs)

    def generate(self, prompt: str, **kwargs) -> str:
        return self.llm(prompt, **kwargs)

class SIFBaseAgent(BaseALwrityAgent):
    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str, agent_type: str = "sif_agent", model_name: str = "Qwen/Qwen2.5-1.5B-Instruct", llm: Any = None):
        # Hybrid LLM Strategy:
        # 1. Shared LLM for external/high-quality generation (available to all agents)
        self.shared_llm = SharedLLMWrapper(user_id)
        
        # 2. Local LLM for internal agent work (default for SIF agents)
        if llm is None:
            if not (TXTAI_AVAILABLE and LLM is not None):
                raise RuntimeError("txtai LLM is required for SIF agents but is not available")
            llm = LocalLLMWrapper(model_name, task="text-generation")
            
        super().__init__(user_id, agent_type, model_name, llm)
        self.intelligence = intelligence_service
        
    def _log_agent_operation(self, operation: str, **kwargs):
        """Standardized logging for agent operations."""
        logger.info(f"[{self.__class__.__name__}] {operation}")
        if kwargs:
            logger.debug(f"[{self.__class__.__name__}] Parameters: {kwargs}")

    async def _ensure_intelligence_ready(self) -> bool:
        """Ensure txtai intelligence service is initialized without blocking the event loop."""
        try:
            await self.intelligence._ensure_initialized_async()
        except Exception as init_err:
            logger.warning(f"[{self.__class__.__name__}] Intelligence initialization failed: {init_err}")
            return False

        return bool(getattr(self.intelligence, "_initialized", False) and self.intelligence.embeddings)

    async def initialize_async(self):
        """Async lifecycle hook — pre-initialize both the SIF index and the local LLM."""
        await self._ensure_intelligence_ready()
        llm = getattr(self, "llm", None)
        if hasattr(llm, "ensure_initialized_async"):
            await llm.ensure_initialized_async()
        logger.info(f"[{self.__class__.__name__}] Async initialization complete")

    async def shutdown(self):
        """Async lifecycle hook — release model resources."""
        llm = getattr(self, "llm", None)
        if hasattr(llm, "shutdown"):
            await llm.shutdown()
        logger.info(f"[{self.__class__.__name__}] Shutdown complete")

    def _create_txtai_agent(self):
        """
        SIF agents primarily use the intelligence service directly, but we can expose
        capabilities via a standard agent interface if available.
        """
        if not TXTAI_AVAILABLE or Agent is None:
            raise RuntimeError(f"[{self.__class__.__name__}] txtai Agent not available")

        try:
            _llm_for_agent = self.llm
            for _ in range(3):
                _llm_for_agent = getattr(_llm_for_agent, "llm", _llm_for_agent)
            return Agent(llm=_llm_for_agent, tools=[])
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Failed to create txtai Agent: {e}")
            raise

# Phase 3.3: Previously this module defined a stripped-down ``StrategyArchitectAgent``
# that duplicated most of the canonical implementation in
# ``services.intelligence.agents.specialized.strategy_architect``. The canonical
# version is richer (has ``find_semantic_gaps`` evidence-driven analysis and
# ``propose_daily_tasks``) and is the one returned by
# ``services.intelligence.agents.__init__`` and used by
# ``sif_onboarding_service`` and ``api/seo_dashboard``. To consolidate without
# breaking callers that import this symbol from ``sif_agents`` (notably
# ``sif_integration._generate_pillar_recommendations`` and ``find_semantic_gaps``),
# we re-export the canonical class. The legacy class also implemented
# ``analyze_content_strategy``, which the canonical class does not have; we add
# it as a thin method on the re-exported class via a subclass to preserve
# call-site compatibility.
try:
    from services.intelligence.agents.specialized.strategy_architect import (
        StrategyArchitectAgent as _CanonicalStrategyArchitectAgent,
    )

    class StrategyArchitectAgent(_CanonicalStrategyArchitectAgent):
        """Re-export of the canonical StrategyArchitectAgent.

        Inherits all methods from
        ``services.intelligence.agents.specialized.strategy_architect`` and adds
        the legacy ``analyze_content_strategy(website_data)`` shim used by
        ``sif_integration._generate_pillar_recommendations``. New code should
        import directly from
        ``services.intelligence.agents.specialized.strategy_architect``.
        """

        async def analyze_content_strategy(self, website_data):
            """Legacy recommendation generator.

            Preserved verbatim from the pre-3.3 duplicate class so that
            ``sif_integration._generate_pillar_recommendations`` continues to
            work. Returns a list of strategic recommendation dicts.
            """
            try:
                recommendations = []
                pillars = await self.discover_pillars()
                if not pillars:
                    recommendations.append({
                        "type": "strategy_gap",
                        "priority": "high",
                        "title": "Establish Core Content Pillars",
                        "description": "No clear content clusters found. Focus on defining 3-5 core topics to build authority.",
                    })
                else:
                    for pillar in pillars:
                        if pillar["size"] < 3:
                            recommendations.append({
                                "type": "content_depth",
                                "priority": "medium",
                                "title": f"Strengthen Pillar {pillar['pillar_id']}",
                                "description": "This topic cluster has few articles. Create more content to establish authority.",
                                "pillar_id": pillar["pillar_id"],
                            })
                if website_data and not website_data.get("description"):
                    recommendations.append({
                        "type": "metadata",
                        "priority": "high",
                        "title": "Missing Meta Description",
                        "description": "Website is missing a meta description. Add one to improve SEO CTR.",
                    })
                logger.info(
                    f"[{self.__class__.__name__}] Generated {len(recommendations)} strategic recommendations"
                )
                return recommendations
            except Exception as e:
                logger.error(f"[{self.__class__.__name__}] Failed to analyze content strategy: {e}")
                return []
except ImportError:
    # If the canonical module is not importable for any reason, define a
    # minimal stub so the symbol still exists. This keeps the import surface
    # stable for callers like ``sif_integration``.
    class StrategyArchitectAgent(SIFBaseAgent):
        """Fallback stub when the canonical class is unavailable."""

        def __init__(self, intelligence_service, user_id):
            super().__init__(intelligence_service, user_id, agent_type="strategy_architect")

        async def discover_pillars(self):
            return []

        async def analyze_content_strategy(self, website_data):
            return []

        async def find_semantic_gaps(self, competitor_indices):
            return []



class LinkGraphAgent(SIFBaseAgent):
    """
    Agent for internal link suggestions, graph management, and authority analysis.
    Implements the semantic link graph using SIF and GSC/Bing data.
    """
    
    RELEVANCE_THRESHOLD = 0.6  # Minimum relevance score for link suggestions
    MAX_SUGGESTIONS = 10  # Maximum number of link suggestions
    
    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str, sif_service: Any = None):
        super().__init__(intelligence_service, user_id, agent_type="link_graph")
        self.sif_service = sif_service
    
    async def suggest_internal_links(self, draft: str) -> List[Dict[str, Any]]:
        """Suggest internal links based on semantic proximity and authority."""
        return await self.link_suggester(draft)

    async def link_suggester(self, draft: str) -> List[Dict[str, Any]]:
        """
        Tool: Suggests internal links.
        Analyzes draft content and finds semantically relevant pages, boosted by authority.
        """
        self._log_agent_operation("Suggesting internal links", draft_length=len(draft))
        
        try:
            if not await self._ensure_intelligence_ready():
                logger.error(f"[{self.__class__.__name__}] Intelligence service not initialized")
                return []
            
            if not draft or len(draft.strip()) < 50: # Reduced threshold for testing
                logger.warning(f"[{self.__class__.__name__}] Draft too short for meaningful link suggestions")
                return []
            
            # 1. Get Semantic Candidates
            results = await self.intelligence.search(draft, limit=self.MAX_SUGGESTIONS)
            
            if not results:
                logger.info(f"[{self.__class__.__name__}] No relevant internal pages found")
                return []
            
            suggestions = []
            for result in results:
                relevance_score = result.get('score', 0.0)
                url = result.get('id', 'unknown')
                
                if relevance_score >= self.RELEVANCE_THRESHOLD:
                    suggestion = {
                        "url": url,
                        "relevance": relevance_score,
                        "final_score": relevance_score,
                        "confidence": self._calculate_link_confidence(relevance_score),
                        "reason": f"Semantic similarity: {relevance_score:.3f}"
                    }
                    suggestions.append(suggestion)
                    logger.debug(f"[{self.__class__.__name__}] Added link suggestion: {url} (score: {relevance_score:.3f})")
            
            # Sort by final score
            suggestions.sort(key=lambda x: x['final_score'], reverse=True)
            
            logger.info(f"[{self.__class__.__name__}] Generated {len(suggestions)} internal link suggestions")
            return suggestions
            
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Failed to suggest internal links: {e}")
            logger.error(f"[{self.__class__.__name__}] Full traceback: {traceback.format_exc()}")
            return []
    
    async def graph_builder(self) -> Dict[str, Any]:
        """
        Tool: Builds/Visualizes the semantic link graph.
        Returns the structure of the graph (nodes and edges) for visualization or analysis.
        """
        self._log_agent_operation("Building semantic link graph")
        
        try:
            if not await self._ensure_intelligence_ready():
                return {"error": "Intelligence service not initialized"}
                
            # This is a resource-intensive operation in a real vector DB.
            # Here we simulate the graph structure based on recent content or clusters.
            
            # 1. Get Clusters (Nodes)
            clusters = await self.intelligence.cluster(min_score=0.5)
            
            nodes = []
            edges = []
            
            for i, cluster in enumerate(clusters):
                cluster_id = f"cluster_{i}"
                nodes.append({
                    "id": cluster_id,
                    "type": "topic_cluster",
                    "size": len(cluster)
                })
                
                # Add content items as nodes linked to cluster
                for item_idx in cluster:
                    # We need to retrieve item metadata. 
                    # txtai cluster returns indices. We might need to query by index or ID.
                    # For this implementation, we'll return a simplified view.
                    pass
            
            return {
                "graph_stats": {
                    "total_clusters": len(clusters),
                    "total_nodes": sum(len(c) for c in clusters)
                },
                "structure": "hierarchical", # vs flat
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Failed to build graph: {e}")
            return {"error": str(e)}

    async def authority_analyzer(self, target_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Tool: Analyzes the authority of the site or specific pages using GSC/Bing data.
        """
        self._log_agent_operation("Analyzing authority", target_url=target_url)
        
        if not self.sif_service:
            return {"error": "SIF Service unavailable for authority analysis"}
            
        try:
            # 1. Get Dashboard Context
            context = await self.sif_service.get_seo_dashboard_context()
            
            if "error" in context:
                return context
                
            data = context.get("dashboard_data", {})
            summary = data.get("summary", {})
            health = data.get("health_score", {})
            
            # 2. Extract Authority Metrics
            authority_report = {
                "domain_authority_proxy": {
                    "health_score": health.get("score"),
                    "total_clicks": summary.get("clicks"),
                    "avg_position": summary.get("position")
                },
                "page_authority": "Page-level authority requires granular GSC data (Planned)", # Placeholder
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return authority_report
            
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Authority analysis failed: {e}")
            return {"error": str(e)}

    def _calculate_link_confidence(self, relevance_score: float) -> float:
        """Calculate confidence score for a link suggestion."""
        # Simple confidence based on relevance score
        return min(1.0, relevance_score * 1.5)

    async def optimize_anchor_text(self, target_url: str, context: str) -> str:
        """Suggest anchor text for a link by searching the SIF index for the target page."""
        self._log_agent_operation("Optimizing anchor text", target_url=target_url, context_length=len(context))

        try:
            if not await self._ensure_intelligence_ready():
                return self._extract_anchor_from_context(target_url, context)

            results = await self.intelligence.search(f"{target_url} {context}", limit=3)
            if results:
                text = results[0].get("text", "") or results[0].get("id", "")
                words = [w for w in text.split() if len(w) > 4][:5]
                if words:
                    return " ".join(words)
            return self._extract_anchor_from_context(target_url, context)

        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] optimize_anchor_text failed: {e}")
            return self._extract_anchor_from_context(target_url, context)

    def _extract_anchor_from_context(self, target_url: str, context: str) -> str:
        """Extract a usable anchor text from the URL or context when SIF is unavailable."""
        from urllib.parse import urlparse
        try:
            parsed = urlparse(target_url)
            path = parsed.path.strip("/").replace("-", " ").replace("/", " ")
            if path:
                words = [w for w in path.split() if len(w) > 3]
                if words:
                    return " ".join(words[:4]).title()
        except Exception:
            pass
        words = [w for w in context.split() if len(w) > 4]
        return " ".join(words[:4]).title() if words else "learn more"

class CitationExpert(SIFBaseAgent):
    """
    Agent for fact-checking, citation generation, and evidence verification.
    """
    
    EVIDENCE_THRESHOLD = 0.7  # Minimum relevance score for evidence
    MAX_EVIDENCE = 5  # Maximum number of evidence pieces to return
    
    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str):
        super().__init__(intelligence_service, user_id, agent_type="citation_expert")
        
    async def fact_checker(self, claim: str) -> List[Dict[str, Any]]:
        """
        Tool: Verifies facts against trusted research data.
        Returns supporting or contradicting evidence.
        """
        return await self.verify_facts(claim)

    async def citation_finder(self, topic: str) -> List[Dict[str, Any]]:
        """
        Tool: Suggests authoritative citations for a given topic.
        """
        self._log_agent_operation("Finding citations", topic=topic)
        
        try:
            if not await self._ensure_intelligence_ready():
                return []
            
            # Search for highly relevant content
            results = await self.intelligence.search(topic, limit=self.MAX_EVIDENCE)
            
            citations = []
            for result in results:
                relevance = result.get('score', 0.0)
                if relevance > 0.6:
                    citations.append({
                        "source": result.get('id'),
                        "title": result.get('text', '')[:100] + "...",
                        "relevance": relevance,
                        "citation_text": f"Source: {result.get('id')} (Relevance: {relevance:.2f})"
                    })
            
            return citations
            
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Citation finder failed: {e}")
            return []

    async def claim_verifier(self, content: str) -> Dict[str, Any]:
        """
        Tool: Detects unsupported statements and hallucinations.
        """
        self._log_agent_operation("Verifying claims in content", content_length=len(content))
        
        # 1. Extract potential claims (heuristic: numbers, 'research shows', etc.)
        # This is a simplified extraction. A real implementation would use NLP/LLM.
        claims = []
        sentences = content.split('.')
        for sent in sentences:
            if any(char.isdigit() for char in sent) or "show" in sent.lower() or "study" in sent.lower():
                if len(sent.strip()) > 20:
                    claims.append(sent.strip())
        
        if not claims:
             return {"status": "no_claims_detected", "verified_claims": []}
             
        verified_results = []
        for claim in claims[:5]: # Limit to top 5 claims for performance
            evidence = await self.verify_facts(claim)
            status = "supported" if evidence else "unsupported"
            verified_results.append({
                "claim": claim,
                "status": status,
                "evidence_count": len(evidence),
                "top_evidence": evidence[0] if evidence else None
            })
            
        return {
            "status": "completed",
            "verified_claims": verified_results,
            "verification_score": len([c for c in verified_results if c['status'] == 'supported']) / len(verified_results)
        }

    async def verify_facts(self, claim: str) -> List[Dict[str, Any]]:
        """Verify a single claim against intelligence data."""
        results = await self.intelligence.search(claim, limit=3)
        
        evidence = []
        for result in results:
            if result.get('score', 0) > self.EVIDENCE_THRESHOLD:
                evidence.append({
                    "text": result.get('text'),
                    "source": result.get('id'),
                    "confidence": result.get('score')
                })
        return evidence

"""
Strategy Architect Agent implementation.
"""
import traceback
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import Counter
from loguru import logger
from services.intelligence.agents.specialized.base import SIFBaseAgent
from services.intelligence.agents.core_agent_framework import TaskProposal
from services.intelligence.txtai_service import TxtaiIntelligenceService

class StrategyArchitectAgent(SIFBaseAgent):
    """Agent for discovering content pillars and identifying strategic gaps."""
    
    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str, **kwargs):
        super().__init__(intelligence_service, user_id, agent_type="strategy_architect", **kwargs)

    async def discover_pillars(self) -> List[Dict[str, Any]]:
        """Identify content pillars through semantic clustering."""
        self._log_agent_operation("Discovering content pillars")
        
        try:
            # Check if intelligence service is initialized
            if not self.intelligence.is_initialized():
                logger.error(f"[{self.__class__.__name__}] Intelligence service not initialized")
                return []
            
            clusters = await self.intelligence.cluster(min_score=0.6)
            
            if not clusters:
                logger.warning(f"[{self.__class__.__name__}] No clusters found")
                return []
            
            # Create pillar objects with metadata
            pillars = []
            for i, cluster_indices in enumerate(clusters):
                pillar = {
                    "pillar_id": f"pillar_{i}",
                    "indices": cluster_indices,
                    "size": len(cluster_indices),
                    "confidence": self._calculate_cluster_confidence(cluster_indices)
                }
                pillars.append(pillar)
                logger.debug(f"[{self.__class__.__name__}] Created pillar {pillar['pillar_id']} with {pillar['size']} items")
            
            logger.info(f"[{self.__class__.__name__}] Discovered {len(pillars)} content pillars")
            return pillars
            
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Failed to discover pillars: {e}")
            logger.error(f"[{self.__class__.__name__}] Full traceback: {traceback.format_exc()}")
            return []
    
    def _calculate_cluster_confidence(self, cluster_indices: List[int]) -> float:
        """Calculate confidence score for a cluster based on its size and coherence."""
        # Simple confidence based on cluster size - larger clusters are more reliable
        return min(1.0, len(cluster_indices) / 10.0)

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """Propose PLAN pillar tasks based on semantic analysis."""
        default_proposals = []
        
        # 1. Pillar Health Check
        try:
            # We use a shorter timeout or cached check if possible, but discover_pillars is fairly fast
            pillars = await self.discover_pillars()
            if not pillars:
                default_proposals.append(TaskProposal(
                    title="Establish Content Pillars",
                    description="Your content strategy lacks defined pillars. Let's analyze your niche to find core topics.",
                    pillar_id="plan",
                    priority="high",
                    estimated_time=15,
                    source_agent="StrategyArchitectAgent",
                    reasoning="No content pillars detected via SIF clustering.",
                    action_type="navigate",
                    action_url="/content-planning-dashboard"
                ))
            elif len(pillars) < 3:
                default_proposals.append(TaskProposal(
                    title="Expand Content Pillars",
                    description=f"You only have {len(pillars)} active pillars. Consider diversifying your strategy.",
                    pillar_id="plan",
                    priority="medium",
                    estimated_time=20,
                    source_agent="StrategyArchitectAgent",
                    reasoning=f"Low pillar diversity ({len(pillars)} detected).",
                    action_type="navigate",
                    action_url="/content-planning-dashboard"
                ))
        except Exception as e:
            logger.warning(f"[{self.__class__.__name__}] Error checking pillars for proposals: {e}")

        # 2. Strategy Review (Generic fallback)
        default_proposals.append(TaskProposal(
            title="Review Strategic Goals",
            description="Ensure your content output aligns with your quarterly business goals.",
            pillar_id="plan",
            priority="low",
            estimated_time=10,
            source_agent="StrategyArchitectAgent",
            reasoning="Routine strategy maintenance.",
            action_type="navigate",
            action_url="/content-planning-dashboard"
        ))
        
        return await self._synthesize_task_proposals(
            context,
            default_proposals,
            instructions=(
                "Propose the next strategic-planning actions for this brand based on its content "
                "pillars, business goals, target audience, and competitors. Each task must have a "
                "pillar_id from [plan, generate, publish, analyze, engage, remarket] and an "
                "action_url pointing to a relevant dashboard (e.g. /content-planning-dashboard)."
            ),
        )

    async def find_semantic_gaps(self, competitor_indices: List[Any]) -> List[Dict[str, Any]]:
        """Compare user content vs competitor content to find missing topics."""
        self._log_agent_operation("Finding semantic content gaps", competitor_count=len(competitor_indices))
        
        try:
            documents = await self._fetch_index_documents()
            if not documents:
                logger.info(f"[{self.__class__.__name__}] No indexed documents available for gap detection")
                return []

            competitor_docs, user_docs = [], []
            allowed_competitor_ids = set(str(idx) for idx in competitor_indices) if competitor_indices else None
            if allowed_competitor_ids:
                for idx in competitor_indices:
                    if isinstance(idx, int) and 0 <= idx < len(documents):
                        allowed_competitor_ids.add(str(documents[idx].get("id", "")))

            for doc in documents:
                metadata = doc.get("metadata", {})
                role = self._infer_document_role(metadata)
                if role == "competitor":
                    if allowed_competitor_ids and str(doc.get("id")) not in allowed_competitor_ids:
                        continue
                    competitor_docs.append(doc)
                elif role == "user":
                    user_docs.append(doc)

            if not competitor_docs or not user_docs:
                logger.info(
                    f"[{self.__class__.__name__}] Insufficient split for gap analysis: "
                    f"user_docs={len(user_docs)}, competitor_docs={len(competitor_docs)}"
                )
                return []

            competitor_topics = self._extract_topic_density(competitor_docs)
            user_topics = self._extract_topic_density(user_docs)
            competitor_topic_docs = self._map_topic_to_doc_titles(competitor_docs)
            user_topic_docs = self._map_topic_to_doc_titles(user_docs)

            gaps = []
            for topic, competitor_density in competitor_topics.items():
                user_density = user_topics.get(topic, 0.0)
                coverage_delta = competitor_density - user_density
                if coverage_delta <= 0.08:
                    continue

                competitor_support = len(competitor_topic_docs.get(topic, []))
                user_support = len(user_topic_docs.get(topic, []))
                confidence = max(0.0, min(1.0, (coverage_delta * 0.65) + (min(1.0, competitor_support / 4) * 0.35)))
                severity_score = max(0.0, min(1.0, (coverage_delta * 0.7) + (confidence * 0.3)))
                priority = "high" if severity_score >= 0.72 else "medium" if severity_score >= 0.45 else "low"
                gaps.append({
                    "topic": topic,
                    "priority": priority,
                    "reason": (
                        f"Competitors mention '{topic}' substantially more often "
                        f"(density {competitor_density:.2f} vs {user_density:.2f})."
                    ),
                    "confidence": round(confidence, 3),
                    "severity_score": round(severity_score, 3),
                    "coverage_delta": round(coverage_delta, 4),
                    "topic_density": {
                        "competitor": round(competitor_density, 4),
                        "user": round(user_density, 4),
                        "gap": round(coverage_delta, 4)
                    },
                    "evidence": {
                        "competitor_sample_titles": self._sample_titles_for_topic(competitor_docs, topic),
                        "user_sample_titles": self._sample_titles_for_topic(user_docs, topic),
                        "competitor_supporting_docs": competitor_support,
                        "user_supporting_docs": user_support,
                        "competitor_doc_count": len(competitor_docs),
                        "user_doc_count": len(user_docs)
                    }
                })

            gaps.sort(
                key=lambda item: (
                    item.get("severity_score", 0),
                    item.get("confidence", 0),
                    item.get("topic_density", {}).get("gap", 0)
                ),
                reverse=True
            )
            return gaps[:12]
            
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Failed to find semantic gaps: {e}")
            logger.error(f"[{self.__class__.__name__}] Full traceback: {traceback.format_exc()}")
            return []

    async def _fetch_index_documents(self) -> List[Dict[str, Any]]:
        """Fetch indexed documents and normalize metadata from txtai result objects."""
        if not self.intelligence.is_initialized() or not self.intelligence.embeddings:
            return []

        embeddings = self.intelligence.embeddings
        limit = 0
        if hasattr(embeddings, "count"):
            try:
                limit = int(embeddings.count())
            except Exception:
                limit = 0

        documents = []
        candidate_queries = []
        if limit > 0:
            candidate_queries.extend([
                f"select id, text, object from txtai limit {limit}",
                f"select id, text, tags from txtai limit {limit}"
            ])
        candidate_queries.extend(["marketing", "content", "seo", "strategy", "social media"])

        seen_ids = set()
        for query in candidate_queries:
            try:
                query_limit = limit if query.startswith("select") and limit > 0 else max(10, limit or 50)
                rows = embeddings.search(query, limit=query_limit)
            except Exception:
                continue

            for row in rows or []:
                doc_id = str(row.get("id", ""))
                dedupe_key = doc_id or str(hash(f"{row.get('text','')}::{row.get('score',0)}"))
                if dedupe_key in seen_ids:
                    continue
                seen_ids.add(dedupe_key)
                documents.append({
                    "id": doc_id,
                    "text": row.get("text", "") or "",
                    "metadata": self._normalize_metadata(row)
                })

            if limit > 0 and len(documents) >= limit:
                break

        return documents

    def _normalize_metadata(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize metadata payloads from txtai search rows."""
        for key in ("object", "tags", "metadata", "meta"):
            payload = row.get(key)
            if isinstance(payload, dict):
                return payload
            if isinstance(payload, str):
                try:
                    import json
                    parsed = json.loads(payload)
                    if isinstance(parsed, dict):
                        return parsed
                except Exception:
                    continue
        return {}

    def _extract_topic_density(self, documents: List[Dict[str, Any]]) -> Dict[str, float]:
        """Extract topic density from document metadata and titles."""
        topic_counter: Counter = Counter()

        for doc in documents:
            for topic in self._extract_topics_from_document(doc):
                topic_counter[topic] += 1

        total_docs = max(1, len(documents))
        return {
            topic: count / total_docs
            for topic, count in topic_counter.items()
            if count >= 2
        }

    def _infer_document_role(self, metadata: Dict[str, Any]) -> str:
        """Infer whether a document belongs to user content or competitor content."""
        signals = [
            metadata.get("type", ""),
            metadata.get("doc_type", ""),
            metadata.get("content_type", ""),
            metadata.get("source", ""),
            metadata.get("origin", "")
        ]
        signal_blob = " ".join(str(item).lower() for item in signals if item)

        if any(token in signal_blob for token in ("competitor", "rival", "market_peer")):
            return "competitor"
        if any(token in signal_blob for token in ("user", "owned", "first_party", "customer_site")):
            return "user"
        return "unknown"

    def _extract_topics_from_document(self, doc: Dict[str, Any]) -> List[str]:
        """Extract normalized topic labels from metadata and lightweight text fields."""
        metadata = doc.get("metadata", {})
        candidates: List[str] = []

        for key in ("topics", "topic", "themes", "theme", "keywords", "keyword", "tags", "category", "categories"):
            value = metadata.get(key)
            if isinstance(value, list):
                candidates.extend([str(v) for v in value if v])
            elif isinstance(value, str) and value.strip():
                candidates.extend(re.split(r"[,|/]", value))

        title = metadata.get("title") or doc.get("text", "")[:160]
        if title:
            candidates.extend(re.findall(r"[a-zA-Z][a-zA-Z\-]{3,}", str(title).lower()))

        stopwords = {
            "with", "from", "that", "this", "your", "about", "into", "using", "guide", "best",
            "tips", "what", "when", "where", "how", "the", "and", "for", "2024", "2025"
        }
        normalized = {
            item.strip().lower()
            for item in candidates
            if item
            and len(item.strip()) >= 4
            and not item.strip().isdigit()
            and item.strip().lower() not in stopwords
        }
        return sorted(normalized)

    def _map_topic_to_doc_titles(self, documents: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """Map each topic to a list of document titles that support it."""
        mapping: Dict[str, List[str]] = {}
        for doc in documents:
            metadata = doc.get("metadata", {})
            title = str(metadata.get("title") or doc.get("text", "")[:100] or "Untitled")
            for topic in self._extract_topics_from_document(doc):
                mapping.setdefault(topic, []).append(title)
        return mapping

    def _sample_titles_for_topic(self, documents: List[Dict[str, Any]], topic: str, limit: int = 3) -> List[str]:
        """Return sample titles for a topic."""
        import json
        samples = []
        topic_lower = topic.lower()
        for doc in documents:
            metadata = doc.get("metadata", {})
            title = metadata.get("title") or doc.get("text", "")[:100]
            if not title:
                continue

            haystack = f"{title} {json.dumps(metadata, default=str)}".lower()
            if topic_lower in haystack:
                samples.append(str(title))
                if len(samples) >= limit:
                    break

        return samples

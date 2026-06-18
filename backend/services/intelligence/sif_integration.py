"""
SIF Phase 2 Integration Module

This module demonstrates how to integrate the intelligent caching system
with the existing SIF framework for improved performance and user experience.
"""

import asyncio
from typing import Dict, List, Any, Optional
from loguru import logger
from datetime import datetime
from sqlalchemy import select, desc
import json

from services.database import get_session_for_user, has_onboarding_session
from models.onboarding import WebsiteAnalysis, OnboardingSession, CompetitorAnalysis, ResearchPreferences, PersonaData

# Import existing SIF components
from .txtai_service import TxtaiIntelligenceService
from .semantic_cache import semantic_cache_manager, SemanticCacheStats
from services.intelligence.harvester import SemanticHarvesterService
from services.intelligence.agent_flat_context import AgentFlatContextStore


class SIFIntegrationService:
    """
    Semantic Intelligence Framework service with Phase 2 improvements.
    
    Features:
    - Intelligent caching for all semantic operations
    - Performance monitoring and analytics
    - Real-time cache invalidation
    - User-specific semantic memory optimization
    """
    
    def __init__(self, user_id: str, enable_caching: bool = True):
        self.user_id = user_id
        self.enable_caching = enable_caching
        self.cache_manager = semantic_cache_manager if enable_caching else None
        
        # Initialize core services with caching
        self.intelligence_service = TxtaiIntelligenceService(
            user_id=user_id,
            enable_caching=enable_caching
        )
        self.harvester = SemanticHarvesterService()
        
        # Initialize agents (will be created when needed to avoid circular imports)
        self.strategy_agent = None
        self.guardian_agent = None
        self.trend_surfer_agent = None
        
        logger.info(f"SIF Integration Service initialized for user {user_id}")

    def get_trend_surfer_agent(self):
        """Lazy load TrendSurferAgent"""
        if not self.trend_surfer_agent:
            from services.intelligence.agents.trend_surfer_agent import TrendSurferAgent
            self.trend_surfer_agent = TrendSurferAgent(
                intelligence_service=self.intelligence_service,
                user_id=self.user_id
            )
        return self.trend_surfer_agent


    async def get_step2_website_context(self) -> Dict[str, Any]:
        """
        Retrieve onboarding step 2 website context with a strict fallback chain:
        flat file -> database -> SIF semantic index.
        """
        # 1) Fastest: flat-file agent context
        try:
            flat_doc = AgentFlatContextStore(self.user_id).load_step2_context_document()
            if flat_doc:
                return {
                    "source": "flat_file",
                    "data": flat_doc.get("data") or {},
                    "agent_summary": flat_doc.get("agent_summary") or {},
                    "document_context": flat_doc.get("document_context") or {},
                    "meta": flat_doc.get("meta") or {},
                    "updated_at": flat_doc.get("updated_at"),
                }
        except Exception as e:
            logger.warning(f"Flat context lookup failed for user {self.user_id}: {e}")

        # 2) Database fallback
        db = None
        try:
            db = get_session_for_user(self.user_id)
            if db:
                stmt = (
                    select(WebsiteAnalysis)
                    .join(OnboardingSession, WebsiteAnalysis.session_id == OnboardingSession.id)
                    .where(OnboardingSession.user_id == self.user_id)
                    .order_by(desc(WebsiteAnalysis.updated_at))
                )
                row = db.execute(stmt).scalars().first()
                if row:
                    payload = row.to_dict() if hasattr(row, "to_dict") else {}
                    return {
                        "source": "database",
                        "data": payload,
                        "agent_summary": {
                            "quick_facts": {
                                "website_url": payload.get("website_url"),
                                "brand_voice": (payload.get("brand_analysis") or {}).get("brand_voice") if isinstance(payload.get("brand_analysis"), dict) else "",
                            }
                        },
                    }
        except Exception as e:
            logger.warning(f"Database fallback failed for user {self.user_id}: {e}")
        finally:
            if db:
                db.close()

        # 3) Semantic fallback
        try:
            results = await self.intelligence_service.search("website analysis brand voice style", limit=1)
            if results:
                top = results[0]
                metadata = top.get("object") if isinstance(top, dict) else None
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except Exception:
                        metadata = {}
                if isinstance(metadata, dict):
                    report = metadata.get("full_report") if isinstance(metadata.get("full_report"), dict) else metadata
                    return {
                        "source": "sif_semantic",
                        "data": report,
                        "agent_summary": {
                            "quick_facts": {
                                "website_url": report.get("website_url") if isinstance(report, dict) else None,
                            }
                        },
                    }
        except Exception as e:
            logger.warning(f"SIF semantic fallback failed for user {self.user_id}: {e}")

        return {"source": "none", "data": {}}

    async def get_step3_research_context(self) -> Dict[str, Any]:
        """
        Retrieve onboarding step 3 research context with fallback chain:
        flat file -> database -> SIF semantic index.
        """
        try:
            flat_doc = AgentFlatContextStore(self.user_id).load_step3_context_document()
            if flat_doc:
                return {
                    "source": "flat_file",
                    "data": flat_doc.get("data") or {},
                    "agent_summary": flat_doc.get("agent_summary") or {},
                    "document_context": flat_doc.get("document_context") or {},
                    "meta": flat_doc.get("meta") or {},
                    "updated_at": flat_doc.get("updated_at"),
                }
        except Exception as e:
            logger.warning(f"Step 3 flat context lookup failed for user {self.user_id}: {e}")

        db = None
        try:
            db = get_session_for_user(self.user_id)
            if db:
                stmt = (
                    select(ResearchPreferences)
                    .join(OnboardingSession, ResearchPreferences.session_id == OnboardingSession.id)
                    .where(OnboardingSession.user_id == self.user_id)
                    .order_by(desc(ResearchPreferences.updated_at))
                )
                prefs = db.execute(stmt).scalars().first()
                if prefs:
                    payload = prefs.to_dict() if hasattr(prefs, "to_dict") else {}
                    return {
                        "source": "database",
                        "data": payload,
                        "agent_summary": {
                            "quick_facts": {
                                "research_depth": payload.get("research_depth"),
                                "content_types_count": len(payload.get("content_types") or []),
                            }
                        },
                    }
        except Exception as e:
            logger.warning(f"Step 3 database fallback failed for user {self.user_id}: {e}")
        finally:
            if db:
                db.close()

        try:
            results = await self.intelligence_service.search("research preferences competitors onboarding step 3", limit=1)
            if results:
                top = results[0]
                metadata = top.get("object") if isinstance(top, dict) else None
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except Exception:
                        metadata = {}
                report = metadata.get("full_report") if isinstance(metadata, dict) and isinstance(metadata.get("full_report"), dict) else (metadata if isinstance(metadata, dict) else {})
                return {
                    "source": "sif_semantic",
                    "data": report,
                    "agent_summary": {
                        "quick_facts": {
                            "research_depth": report.get("research_depth") if isinstance(report, dict) else None,
                        }
                    },
                }
        except Exception as e:
            logger.warning(f"Step 3 semantic fallback failed for user {self.user_id}: {e}")

        return {"source": "none", "data": {}}

    async def get_step4_persona_context(self) -> Dict[str, Any]:
        """
        Retrieve onboarding step 4 persona context with fallback chain:
        flat file -> database -> SIF semantic index.
        """
        try:
            flat_doc = AgentFlatContextStore(self.user_id).load_step4_context_document()
            if flat_doc:
                return {
                    "source": "flat_file",
                    "data": flat_doc.get("data") or {},
                    "agent_summary": flat_doc.get("agent_summary") or {},
                    "document_context": flat_doc.get("document_context") or {},
                    "meta": flat_doc.get("meta") or {},
                    "updated_at": flat_doc.get("updated_at"),
                }
        except Exception as e:
            logger.warning(f"Step 4 flat context lookup failed for user {self.user_id}: {e}")

        db = None
        try:
            db = get_session_for_user(self.user_id)
            if db:
                stmt = (
                    select(PersonaData)
                    .join(OnboardingSession, PersonaData.session_id == OnboardingSession.id)
                    .where(OnboardingSession.user_id == self.user_id)
                    .order_by(desc(PersonaData.updated_at))
                )
                persona = db.execute(stmt).scalars().first()
                if persona:
                    payload = persona.to_dict() if hasattr(persona, "to_dict") else {}
                    return {
                        "source": "database",
                        "data": payload,
                        "agent_summary": {
                            "quick_facts": {
                                "selected_platforms_count": len(payload.get("selected_platforms") or []),
                                "has_core_persona": bool(payload.get("core_persona")),
                            }
                        },
                    }
        except Exception as e:
            logger.warning(f"Step 4 database fallback failed for user {self.user_id}: {e}")
        finally:
            if db:
                db.close()

        try:
            results = await self.intelligence_service.search("persona platform personas onboarding step 4", limit=1)
            if results:
                top = results[0]
                metadata = top.get("object") if isinstance(top, dict) else None
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except Exception:
                        metadata = {}
                report = metadata.get("full_report") if isinstance(metadata, dict) and isinstance(metadata.get("full_report"), dict) else (metadata if isinstance(metadata, dict) else {})
                return {
                    "source": "sif_semantic",
                    "data": report,
                    "agent_summary": {
                        "quick_facts": {
                            "has_core_persona": bool(report.get("core_persona")) if isinstance(report, dict) else False,
                        }
                    },
                }
        except Exception as e:
            logger.warning(f"Step 4 semantic fallback failed for user {self.user_id}: {e}")

        return {"source": "none", "data": {}}

    async def get_step5_integrations_context(self) -> Dict[str, Any]:
        """
        Retrieve onboarding step 5 integrations context with fallback chain:
        flat file -> SIF semantic index.
        """
        try:
            flat_doc = AgentFlatContextStore(self.user_id).load_step5_context_document()
            if flat_doc:
                return {
                    "source": "flat_file",
                    "data": flat_doc.get("data") or {},
                    "agent_summary": flat_doc.get("agent_summary") or {},
                    "document_context": flat_doc.get("document_context") or {},
                    "meta": flat_doc.get("meta") or {},
                    "updated_at": flat_doc.get("updated_at"),
                }
        except Exception as e:
            logger.warning(f"Step 5 flat context lookup failed for user {self.user_id}: {e}")

        try:
            results = await self.intelligence_service.search("integrations onboarding step 5 connected providers", limit=1)
            if results:
                top = results[0]
                metadata = top.get("object") if isinstance(top, dict) else None
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except Exception:
                        metadata = {}
                report = metadata.get("full_report") if isinstance(metadata, dict) and isinstance(metadata.get("full_report"), dict) else (metadata if isinstance(metadata, dict) else {})
                return {
                    "source": "sif_semantic",
                    "data": report,
                    "agent_summary": {
                        "quick_facts": {
                            "connected_integrations_count": len((report.get("integrations") or {})) if isinstance(report, dict) and isinstance(report.get("integrations"), dict) else None,
                        }
                    },
                }
        except Exception as e:
            logger.warning(f"Step 5 semantic fallback failed for user {self.user_id}: {e}")

        return {"source": "none", "data": {}}

    async def get_flat_context_manifest(self) -> Dict[str, Any]:
        """Return lightweight manifest of available flat context documents for this user."""
        try:
            manifest = AgentFlatContextStore(self.user_id).load_context_manifest()
            if manifest:
                return {"source": "flat_file", "data": manifest}
        except Exception as e:
            logger.warning(f"Failed to load flat context manifest for user {self.user_id}: {e}")
        return {"source": "none", "data": {"documents": []}}

    async def get_merged_flat_context(self) -> Dict[str, Any]:
        """Return merged onboarding context from all available flat context documents.

        This is an aggregation helper; step-specific APIs still return one-by-one files.
        """
        store = AgentFlatContextStore(self.user_id)
        manifest = store.load_context_manifest() or {"documents": []}
        docs = manifest.get("documents") if isinstance(manifest.get("documents"), list) else []

        merged: Dict[str, Any] = {
            "source": "flat_file",
            "user_id": self.user_id,
            "manifest_updated_at": manifest.get("updated_at"),
            "steps": {},
            "agent_summaries": {},
            "documents": [],
        }

        for item in docs:
            if not isinstance(item, dict):
                continue
            path = item.get("path")
            if not path:
                continue
            doc = store.load_context_document(str(path)) or {}
            context_type = str(doc.get("context_type") or item.get("type") or path)
            merged["documents"].append(
                {
                    "path": path,
                    "context_type": context_type,
                    "updated_at": doc.get("updated_at") or item.get("updated_at"),
                    "size_bytes": item.get("size_bytes"),
                }
            )
            merged["steps"][context_type] = doc.get("data") if isinstance(doc.get("data"), dict) else {}
            merged["agent_summaries"][context_type] = doc.get("agent_summary") if isinstance(doc.get("agent_summary"), dict) else {}

        merged["document_count"] = len(merged["documents"])
        return merged

    async def index_market_trends_run(self, trends_result: Dict[str, Any], run_id: str) -> bool:
        try:
            latest_id = f"market_trends_latest:{self.user_id}"
            run_doc_id = f"market_trends_run:{self.user_id}:{run_id}"

            geo = trends_result.get("geo", "US")
            timeframe = trends_result.get("timeframe", "today 12-m")
            keywords = trends_result.get("keywords") or []
            keywords_text = ", ".join([str(k) for k in keywords]) if isinstance(keywords, list) else str(keywords)

            related_queries_top = (trends_result.get("related_queries") or {}).get("top", [])
            related_topics_top = (trends_result.get("related_topics") or {}).get("top", [])

            text_content = (
                f"Market Trends run for {geo} ({timeframe}). Keywords: {keywords_text}. "
                f"Related queries top: {len(related_queries_top)}. Related topics top: {len(related_topics_top)}."
            )

            base_metadata = {
                "type": "market_trends",
                "user_id": self.user_id,
                "run_id": run_id,
                "run_timestamp": trends_result.get("timestamp") or datetime.utcnow().isoformat(),
                "timeframe": timeframe,
                "geo": geo,
                "keywords": keywords if isinstance(keywords, list) else [keywords_text],
                "full_report": trends_result,
            }

            await self.intelligence_service.index_content(
                [
                    (latest_id, f"LATEST {text_content}", {**base_metadata, "is_latest": True}),
                    (run_doc_id, text_content, {**base_metadata, "is_latest": False}),
                ]
            )
            return True
        except Exception as e:
            logger.error(f"Failed to index market trends run: {e}")
            return False

    async def sync_content_strategy_dashboard_to_sif(self, db=None) -> bool:
        close_db = False
        try:
            if db is None:
                db = get_session_for_user(self.user_id)
                close_db = True
            if not db:
                return False

            items_to_index = []

            try:
                from sqlalchemy import select, desc
                from models.enhanced_strategy_models import EnhancedContentStrategy, EnhancedAIAnalysisResult

                stmt = (
                    select(EnhancedContentStrategy)
                    .where(EnhancedContentStrategy.user_id == self.user_id)
                    .order_by(desc(EnhancedContentStrategy.updated_at))
                )
                strategies = db.execute(stmt).scalars().all()

                if strategies:
                    latest = strategies[0]
                    latest_id = f"enhanced_strategy_latest:{self.user_id}"
                    latest_text = f"Latest Content Strategy Dashboard snapshot. Name: {latest.name}. Industry: {latest.industry}."
                    latest_meta = {
                        "type": "enhanced_content_strategy",
                        "user_id": self.user_id,
                        "is_latest": True,
                        "strategy_id": latest.id,
                        "timestamp": (latest.updated_at or latest.created_at or datetime.utcnow()).isoformat(),
                        "full_report": latest.to_dict() if hasattr(latest, "to_dict") else {},
                    }
                    items_to_index.append((latest_id, latest_text, latest_meta))

                for st in strategies[:25]:
                    ts = (st.updated_at or st.created_at or datetime.utcnow()).isoformat()
                    run_doc_id = f"enhanced_strategy_run:{self.user_id}:{st.id}:{ts}"
                    text = f"Content Strategy Dashboard snapshot. Name: {st.name}. Industry: {st.industry}. "
                    if st.market_gaps:
                        text += f"Market gaps: {str(st.market_gaps)[:300]}. "
                    if st.emerging_trends:
                        text += f"Emerging trends: {str(st.emerging_trends)[:300]}. "
                    if st.industry_trends:
                        text += f"Industry trends: {str(st.industry_trends)[:300]}. "
                    meta = {
                        "type": "enhanced_content_strategy",
                        "user_id": self.user_id,
                        "is_latest": False,
                        "strategy_id": st.id,
                        "timestamp": ts,
                        "full_report": st.to_dict() if hasattr(st, "to_dict") else {},
                    }
                    items_to_index.append((run_doc_id, text, meta))

                stmt_ai = (
                    select(EnhancedAIAnalysisResult)
                    .where(EnhancedAIAnalysisResult.user_id == self.user_id)
                    .order_by(desc(EnhancedAIAnalysisResult.updated_at))
                )
                ai_results = db.execute(stmt_ai).scalars().all()
                if ai_results:
                    latest_ai = ai_results[0]
                    latest_ai_id = f"enhanced_ai_latest:{self.user_id}"
                    ts_ai = (latest_ai.updated_at or latest_ai.created_at or datetime.utcnow()).isoformat()
                    text_ai = f"Latest strategic intelligence. analysis_type: {latest_ai.analysis_type}. "
                    meta_ai = {
                        "type": "enhanced_ai_analysis",
                        "user_id": self.user_id,
                        "is_latest": True,
                        "analysis_id": latest_ai.id,
                        "analysis_type": latest_ai.analysis_type,
                        "timestamp": ts_ai,
                        "full_report": latest_ai.to_dict() if hasattr(latest_ai, "to_dict") else {},
                    }
                    items_to_index.append((latest_ai_id, text_ai, meta_ai))

                for r in ai_results[:50]:
                    ts_ai = (r.updated_at or r.created_at or datetime.utcnow()).isoformat()
                    run_ai_id = f"enhanced_ai_run:{self.user_id}:{r.id}:{ts_ai}"
                    text_ai = f"Strategic intelligence run. analysis_type: {r.analysis_type}. "
                    meta_ai = {
                        "type": "enhanced_ai_analysis",
                        "user_id": self.user_id,
                        "is_latest": False,
                        "analysis_id": r.id,
                        "analysis_type": r.analysis_type,
                        "timestamp": ts_ai,
                        "full_report": r.to_dict() if hasattr(r, "to_dict") else {},
                    }
                    items_to_index.append((run_ai_id, text_ai, meta_ai))
            except Exception as e:
                logger.warning(f"Failed to embed enhanced content strategy dashboard data: {e}")

            try:
                from sqlalchemy import select, desc
                from models.content_planning import ContentGapAnalysis

                stmt_gap = (
                    select(ContentGapAnalysis)
                    .where(ContentGapAnalysis.user_id == self.user_id)
                    .order_by(desc(ContentGapAnalysis.updated_at))
                )
                gaps = db.execute(stmt_gap).scalars().all()
                if gaps:
                    latest_gap = gaps[0]
                    latest_gap_id = f"content_gap_latest:{self.user_id}"
                    ts_gap = (latest_gap.updated_at or latest_gap.created_at or datetime.utcnow()).isoformat()
                    text_gap = f"Latest Content Gap Analysis for {latest_gap.website_url}. "
                    meta_gap = {
                        "type": "content_gap_analysis",
                        "user_id": self.user_id,
                        "is_latest": True,
                        "gap_id": latest_gap.id,
                        "website_url": latest_gap.website_url,
                        "timestamp": ts_gap,
                        "full_report": latest_gap.to_dict() if hasattr(latest_gap, "to_dict") else {},
                    }
                    items_to_index.append((latest_gap_id, text_gap, meta_gap))

                for g in gaps[:25]:
                    ts_gap = (g.updated_at or g.created_at or datetime.utcnow()).isoformat()
                    run_gap_id = f"content_gap_run:{self.user_id}:{g.id}:{ts_gap}"
                    text_gap = f"Content Gap Analysis for {g.website_url}. "
                    if g.target_keywords:
                        text_gap += f"Target keywords: {str(g.target_keywords)[:300]}. "
                    meta_gap = {
                        "type": "content_gap_analysis",
                        "user_id": self.user_id,
                        "is_latest": False,
                        "gap_id": g.id,
                        "website_url": g.website_url,
                        "timestamp": ts_gap,
                        "full_report": g.to_dict() if hasattr(g, "to_dict") else {},
                    }
                    items_to_index.append((run_gap_id, text_gap, meta_gap))
            except Exception as e:
                logger.warning(f"Failed to embed content gap analysis data: {e}")

            if items_to_index:
                await self.intelligence_service.index_content(items_to_index)
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to sync content strategy dashboard to SIF: {e}")
            return False
        finally:
            if close_db and db:
                db.close()
    
    async def sync_onboarding_data_to_sif(self):
        """
        Embeds existing onboarding data (WebsiteAnalysis, CompetitorAnalysis) into the SIF index.
        This ensures agents can query this data semantically without direct DB access.
        """
        try:
            logger.info(f"Syncing onboarding data to SIF for user {self.user_id}")
            db = get_session_for_user(self.user_id)
            if not db:
                return False

            items_to_index = []

            # 1. Fetch Website Analysis
            stmt = (
                select(WebsiteAnalysis)
                .join(OnboardingSession, WebsiteAnalysis.session_id == OnboardingSession.id)
                .where(OnboardingSession.user_id == self.user_id)
                .order_by(desc(WebsiteAnalysis.created_at))
            )
            website_analyses = db.execute(stmt).scalars().all()

            for analysis in website_analyses:
                # Create a rich text representation for semantic search
                text_content = f"Website Analysis for {analysis.website_url}. "
                if analysis.brand_analysis:
                     text_content += f"Brand Voice: {analysis.brand_analysis.get('brand_voice', 'Unknown')}. "
                if analysis.seo_audit:
                     issues = analysis.seo_audit.get('technical_issues', [])
                     issue_summary = ", ".join([i.get('type', '') for i in issues[:5]])
                     text_content += f"SEO Issues: {issue_summary}. "
                if analysis.social_media_presence:
                     social = analysis.social_media_presence
                     platforms = ", ".join(social.keys()) if isinstance(social, dict) else "Unknown"
                     text_content += f"Social Platforms: {platforms}. "
                
                # Metadata stores the structured data for retrieval
                metadata = {
                    "type": "website_analysis",
                    "url": analysis.website_url,
                    "timestamp": analysis.created_at.isoformat() if analysis.created_at else datetime.utcnow().isoformat(),
                    "full_report": analysis.to_dict()
                }
                
                items_to_index.append((f"wa_{analysis.id}", text_content, metadata))

            # 2. Fetch Competitor Analysis
            stmt_comp = (
                select(CompetitorAnalysis)
                .join(OnboardingSession, CompetitorAnalysis.session_id == OnboardingSession.id)
                .where(OnboardingSession.user_id == self.user_id)
            )
            competitor_analyses = db.execute(stmt_comp).scalars().all()

            for comp in competitor_analyses:
                text_content = f"Competitor Analysis for {comp.competitor_url}. "
                if comp.analysis_data:
                     text_content += f"Summary: {comp.analysis_data.get('summary', '')[:200]}... "
                
                metadata = {
                    "type": "competitor_analysis",
                    "url": comp.competitor_url,
                    "timestamp": comp.created_at.isoformat() if comp.created_at else datetime.utcnow().isoformat(),
                    "full_report": comp.analysis_data
                }
                
                items_to_index.append((f"ca_{comp.id}", text_content, metadata))

            # Index content
            if items_to_index:
                await self.intelligence_service.index_content(items_to_index)
                logger.info(f"Successfully synced {len(items_to_index)} onboarding items to SIF")
                try:
                    await self.sync_content_strategy_dashboard_to_sif(db=db)
                except Exception:
                    pass
                return True
            else:
                logger.info("No onboarding data found to sync")
                return False

        except Exception as e:
            logger.error(f"Failed to sync onboarding data to SIF: {e}")
            return False
        finally:
            if db:
                db.close()

    async def sync_seo_dashboard_to_sif(self):
        """
        Embeds SEO Dashboard data (GSC/Bing metrics) into the SIF index.
        """
        try:
            logger.info(f"Syncing SEO Dashboard data to SIF for user {self.user_id}")
            db = get_session_for_user(self.user_id)
            if not db:
                return False

            from services.seo.dashboard_service import SEODashboardService
            dashboard_service = SEODashboardService(db)
            
            # Fetch aggregated dashboard data
            dashboard_data = await dashboard_service.get_dashboard_overview(self.user_id)
            
            items_to_index = []
            
            # Create rich text representation
            site_url = dashboard_data.get('website_url', 'Unknown')
            summary = dashboard_data.get('summary', {})
            health = dashboard_data.get('health_score', {})
            
            text_content = f"SEO Dashboard Analysis for {site_url}. "
            text_content += f"Health Score: {health.get('score', 0)} ({health.get('label', 'Unknown')}). "
            text_content += f"Total Clicks: {summary.get('clicks', 0)}, Impressions: {summary.get('impressions', 0)}. "
            text_content += f"CTR: {summary.get('ctr', 0):.1%}, Avg Position: {summary.get('position', 0):.1f}. "
            
            # Add AI insights to text
            ai_insights = dashboard_data.get('ai_insights', [])
            if ai_insights:
                insights_text = " ".join([i.get('text', '') for i in ai_insights])
                text_content += f"Insights: {insights_text} "
                
            # Add Competitor Insights
            comp_insights = dashboard_data.get('competitor_insights', {})
            if comp_insights:
                opp_score = comp_insights.get('opportunity_score', 0)
                text_content += f"Competitive Opportunity Score: {opp_score}%. "
                gaps = comp_insights.get('content_gaps', [])
                if gaps:
                    text_content += f"Content Gaps: {', '.join(gaps[:5])}. "
                    
            # Add Advertools Insights
            adv_insights = dashboard_data.get('advertools_insights', {})
            if adv_insights:
                themes = adv_insights.get('augmented_themes', [])
                if themes:
                    text_content += f"Augmented Themes: {', '.join(themes[:5])}. "

                freshness = adv_insights.get('freshness', {})
                if freshness:
                    text_content += (f"Content Freshness Score: {freshness.get('freshness_score', 'N/A')}. "
                                     f"Publishing Velocity: {freshness.get('publishing_velocity', 0)}/week. "
                                     f"Trend: {freshness.get('publishing_trend', 'unknown')}. "
                                     f"Last 30d: {freshness.get('publishing_recency', {}).get('last_30d', 0)} pages. ")

                link_health = adv_insights.get('link_health', {})
                if link_health and 'error' not in link_health:
                    text_content += (f"Internal Links: {link_health.get('internal_link_count', 0)}. "
                                     f"External Links: {link_health.get('external_link_count', 0)}. "
                                     f"Nofollow: {link_health.get('nofollow_link_count', 0)}. "
                                     f"Avg Links/Page: {link_health.get('avg_links_per_page', 0)}. ")

                redirects = adv_insights.get('redirect_audit', {})
                if redirects and 'error' not in redirects:
                    text_content += (f"Redirects: {redirects.get('total_redirects', 0)} total, "
                                     f"{redirects.get('multi_hop_chains', 0)} multi-hop. ")

                image_seo = adv_insights.get('image_seo', {})
                if image_seo and 'error' not in image_seo:
                    text_content += (f"Images: {image_seo.get('total_images', 0)} total, "
                                     f"Alt Coverage: {image_seo.get('alt_coverage_percentage', 0)}%. ")

                url_struct = adv_insights.get('url_structure', {})
                if url_struct:
                    text_content += (f"URL Structure: {url_struct.get('total_urls_analyzed', 0)} URLs, "
                                     f"Avg Depth: {url_struct.get('directory_depth', {}).get('average_depth', 0)}. "
                                     f"Params: {url_struct.get('parameter_usage', {}).get('percentage_with_params', 0)}%. ")

                robots = adv_insights.get('robots_txt', {})
                if robots and robots.get('success'):
                    text_content += (f"Robots.txt: {robots.get('total_directives', 0)} directives, "
                                     f"Compliance: {robots.get('compliance_score', 0)}/100. "
                                     f"Issues: {len(robots.get('issues', []))}. ")

                budget = adv_insights.get('crawl_budget', {})
                if budget and budget.get('success'):
                    text_content += (f"Crawl Budget: {budget.get('pages_crawled', 0)} crawled of {budget.get('sitemap_total_urls', 0)} URLs. "
                                     f"Waste: {budget.get('waste_percentage', 0)}%. "
                                     f"Score: {budget.get('optimization_score', 0)}. ")
            # Add Technical SEO overview
            tech_audit = dashboard_data.get('technical_seo_audit', {})
            if tech_audit:
                 text_content += f"Technical Audit: {tech_audit.get('pages_audited', 0)} pages audited. "
                 text_content += f"Avg Score: {tech_audit.get('avg_score', 0)}. "
                 if tech_audit.get('worst_pages'):
                     worst = ", ".join([p.get('page_url', '') for p in tech_audit.get('worst_pages', [])[:3]])
                     text_content += f"Worst Pages: {worst}. "

            metadata = {
                "type": "seo_dashboard",
                "url": site_url,
                "timestamp": datetime.utcnow().isoformat(),
                "full_report": dashboard_data
            }
            
            items_to_index.append((f"seo_dash_{self.user_id}", text_content, metadata))
            
            if items_to_index:
                await self.intelligence_service.index_content(items_to_index)
                logger.info(f"Successfully synced SEO Dashboard data to SIF")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to sync SEO Dashboard data: {e}")
            return False
        finally:
            if db:
                db.close()

    async def sync_user_website_content(self, website_url: str) -> bool:
        """
        Harvests and indexes user website content using incremental upsert strategy.
        This ensures that:
        1. New content is added to the index.
        2. Existing content is updated (refreshed).
        3. Only recent/relevant pages are processed (snapshot approach).
        """
        try:
            logger.info(f"Syncing user website content for {website_url} (User: {self.user_id})")
            
            # 1. Harvest content (Limit to 50 pages for snapshot)
            # Use 'limit' to act as a snapshot, assuming harvester fetches most relevant/recent
            harvested_pages = await self.harvester.harvest_website(website_url, limit=50)
            
            if not harvested_pages:
                logger.warning(f"No content harvested from {website_url}")
                return False
                
            logger.info(f"Harvested {len(harvested_pages)} pages from {website_url}")
            
            # 2. Prepare items for indexing (Upsert Strategy)
            # Using URL as the unique ID ensures updates overwrite existing entries
            items_to_index = []
            for page in harvested_pages:
                url = page.get("url")
                if not url:
                    continue
                    
                # Rich text content
                text_content = page.get("content", "")
                title = page.get("title", "")
                
                # Metadata
                metadata = {
                    "type": "user_content",
                    "url": url,
                    "title": title,
                    "source": "user_website",
                    "crawled_at": datetime.utcnow().isoformat(),
                    "full_report": {
                        "url": url,
                        "title": title,
                        "snippet": text_content[:200]
                    }
                }
                
                # ID format: "user_content_{url_hash}" or just URL if safe?
                # Txtai usually handles string IDs. Let's use a consistent prefix.
                # But wait, existing logic in SIFOnboardingIntegration uses URL as ID?
                # "user_items = [(page['url'], ...)]"
                # Yes, it uses URL directly.
                items_to_index.append((url, text_content, metadata))
            
            # 3. Index (Upsert)
            if items_to_index:
                await self.intelligence_service.index_content(items_to_index)
                logger.info(f"Successfully synced {len(items_to_index)} pages to SIF index")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to sync user website content: {e}")
            return False

    async def get_seo_dashboard_context(self) -> Dict[str, Any]:
        """
        Retrieve SEO Dashboard context from SIF (txtai index).
        If not found, triggers a sync and tries again.
        """
        try:
            logger.info(f"Retrieving SEO Dashboard context via SIF for user {self.user_id}")
            
            # 1. Construct semantic query
            query = "seo dashboard analysis health score clicks"
            
            # 2. Search SIF
            results = await self.intelligence_service.search(query, limit=5)
            
            # 3. Filter for valid dashboard objects
            valid_result = None
            if results:
                for res in results:
                    try:
                        metadata_str = res.get('object')
                        metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                        
                        if metadata.get('type') == 'seo_dashboard':
                            valid_result = metadata.get('full_report')
                            break
                    except Exception as parse_err:
                        continue

            if valid_result:
                logger.info("Found SEO Dashboard context in SIF index")
                return {
                    "dashboard_data": valid_result,
                    "source": "sif_index"
                }

            # 4. If not found, Sync and Retry
            logger.info("SEO Dashboard context not found in SIF. Triggering sync...")
            synced = await self.sync_seo_dashboard_to_sif()
            
            if synced:
                results_retry = await self.intelligence_service.search(query, limit=5)
                if results_retry:
                    for res in results_retry:
                        try:
                            metadata_str = res.get('object')
                            metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                            
                            if metadata.get('type') == 'seo_dashboard':
                                valid_result = metadata.get('full_report')
                                return {
                                    "dashboard_data": valid_result,
                                    "source": "sif_index_after_sync"
                                }
                        except: continue

            logger.warning("No SEO Dashboard data found in SIF even after sync.")
            return {
                "error": "No SEO Dashboard data found.",
                "source": "empty"
            }
                    
        except Exception as e:
            logger.error(f"Failed to get SEO Dashboard context via SIF: {e}")
            return {"error": str(e)}

    async def get_seo_context(self, website_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieve existing SEO context from SIF (txtai index).
        If not found, triggers a sync from DB and tries again.
        """
        try:
            logger.info(f"Retrieving SEO context via SIF for user {self.user_id}")
            
            # 1. Construct semantic query
            query = f"website analysis seo audit {website_url if website_url else ''}"
            
            # 2. Search SIF
            results = await self.intelligence_service.search(query, limit=5)
            
            # 3. Filter for valid website analysis objects
            valid_result = None
            if results:
                for res in results:
                    # txtai returns metadata in the result object directly if objects=True
                    # Structure: {'id': '...', 'score': ..., 'text': '...', 'metadata': {...}}
                    # Note: txtai_service.py search returns results. 
                    # If objects=True in embeddings, result is dict with metadata fields merged or in 'metadata'?
                    # Let's check txtai_service.py implementation of search. 
                    # It calls self.embeddings.search(query, limit). 
                    # With objects=True, it usually returns list of dicts.
                    
                    # We check if the result is of type 'website_analysis' and matches URL if provided
                    # Since we serialized metadata to JSON string in index_content, we might need to parse it back?
                    # txtai_service.py: "metadata_json = json.dumps(metadata) ... processed_items.append((id, text, metadata_json))"
                    # So the stored object IS the JSON string.
                    
                    try:
                        # txtai might return the object as the 'object' field or merge it.
                        # Let's assume standard txtai behavior: 
                        # If we indexed (id, text, object), search returns {'id': id, 'score': score, 'text': text, ...object_fields...}
                        # OR if object was a string, it might be in 'object' field.
                        
                        # In txtai_service.py, we did: processed_items.append((id_val, text, metadata_json))
                        # So 'object' is a JSON string.
                        
                        metadata_str = res.get('object') # or it might be unpacked if it was a dict, but we stored string.
                        
                        if not metadata_str and 'type' in res: 
                             # Maybe it unpacks automatically? 
                             # If we stored a string, it is likely in 'object'.
                             pass

                        if metadata_str:
                             if isinstance(metadata_str, str):
                                 metadata = json.loads(metadata_str)
                             else:
                                 metadata = metadata_str # Already dict?
                        else:
                             # Fallback: maybe the dict keys are merged into res?
                             metadata = res
                        
                        if metadata.get('type') == 'website_analysis':
                            if website_url and website_url not in metadata.get('url', ''):
                                continue # URL mismatch
                            
                            valid_result = metadata.get('full_report')
                            break
                    except Exception as parse_err:
                        logger.warning(f"Failed to parse SIF result metadata: {parse_err}")
                        continue

            if valid_result:
                logger.info(f"Found SEO context in SIF index for {valid_result.get('website_url')}")
                return {
                    "website_url": valid_result.get('website_url'),
                    "seo_audit": valid_result.get('seo_audit') or {},
                    "crawl_result": valid_result.get('crawl_result') or {},
                    "sitemap_analysis": valid_result.get('crawl_result', {}).get('sitemap_analysis', {}) if valid_result.get('crawl_result') else {},
                    "pagespeed_data": valid_result.get('crawl_result', {}).get('pagespeed', {}) if valid_result.get('crawl_result') else {},
                    "analysis_date": valid_result.get('analysis_date'),
                    "source": "sif_index"
                }

            # 4. If not found, Sync and Retry (Lazy Embedding)
            logger.info("SEO context not found in SIF. Triggering DB sync...")
            synced = await self.sync_onboarding_data_to_sif()
            
            if synced:
                # Retry search once
                results_retry = await self.intelligence_service.search(query, limit=5)
                if results_retry:
                    for res in results_retry:
                        try:
                            metadata_str = res.get('object')
                            metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                            
                            if metadata.get('type') == 'website_analysis':
                                if website_url and website_url not in metadata.get('url', ''):
                                    continue
                                
                                valid_result = metadata.get('full_report')
                                return {
                                    "website_url": valid_result.get('website_url'),
                                    "seo_audit": valid_result.get('seo_audit') or {},
                                    "crawl_result": valid_result.get('crawl_result') or {},
                                    "sitemap_analysis": valid_result.get('crawl_result', {}).get('sitemap_analysis', {}) if valid_result.get('crawl_result') else {},
                                    "pagespeed_data": valid_result.get('crawl_result', {}).get('pagespeed', {}) if valid_result.get('crawl_result') else {},
                                    "analysis_date": valid_result.get('analysis_date'),
                                    "source": "sif_index_after_sync"
                                }
                        except: continue

            logger.warning("No SEO data found in SIF even after sync.")
            return {
                "error": "No SEO data found. Please complete onboarding.",
                "source": "empty"
            }
                    
        except Exception as e:
            logger.error(f"Failed to get SEO context via SIF: {e}")
            return {"error": str(e)}

    async def track_agent_failure(self, agent_id: str, error: Exception, context: Dict[str, Any]):
        """
        Tracks agent failures to identify root causes and patterns.
        """
        try:
            error_type = type(error).__name__
            error_message = str(error)
            timestamp = datetime.utcnow().isoformat()
            
            # Categorize error
            category = "unknown"
            if "context window" in error_message.lower() or "token limit" in error_message.lower():
                category = "context_window_exceeded"
            elif "timeout" in error_message.lower():
                category = "timeout"
            elif "rate limit" in error_message.lower():
                category = "rate_limit"
            elif "parse" in error_message.lower() or "json" in error_message.lower():
                category = "parsing_error"
            elif "safety" in error_message.lower():
                category = "safety_violation"
            elif "tool" in error_message.lower():
                category = "tool_execution_failed"
            
            failure_record = {
                "agent_id": agent_id,
                "error_type": error_type,
                "error_message": error_message,
                "category": category,
                "context": context,
                "timestamp": timestamp
            }
            
            logger.error(f"Agent Failure Tracked: {agent_id} - {category} - {error_message}")
            
            # Index failure for semantic analysis (optional, but useful for 'why failed?')
            text_content = f"Agent Failure: {agent_id} encountered {category}. Error: {error_message}."
            metadata = {
                "type": "agent_failure_log",
                "agent_id": agent_id,
                "category": category,
                "timestamp": timestamp,
                "full_report": failure_record
            }
            
            # Fire and forget indexing to avoid blocking
            asyncio.create_task(self.intelligence_service.index_content([(f"fail_{agent_id}_{timestamp}", text_content, metadata)]))
            
            try:
                from services.database import get_session_for_user
                from services.agent_activity_service import AgentActivityService

                db = get_session_for_user(self.user_id)
                if db:
                    service = AgentActivityService(db, self.user_id)
                    service.create_alert(
                        alert_type="agent_failure",
                        title=f"Agent failure: {category}",
                        message=error_message[:2000],
                        severity="error" if category in {"timeout", "context_window_exceeded", "tool_execution_failed", "safety_violation"} else "warning",
                        payload=failure_record,
                        cta_path="/content-planning",
                    )
                    db.close()
            except Exception:
                pass

            return failure_record
            
        except Exception as e:
            logger.error(f"Failed to track agent failure: {e}")

    async def get_agent_failure_analysis(self, time_window_hours: int = 24) -> Dict[str, Any]:
        """
        Analyzes recent agent failures to provide insights.
        """
        try:
            # Search for failure logs
            query = "agent failure error"
            results = await self.intelligence_service.search(query, limit=50)
            
            failures = []
            if results:
                for res in results:
                    try:
                        metadata_str = res.get('object')
                        metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                        
                        if metadata.get('type') == 'agent_failure_log':
                            failures.append(metadata.get('full_report'))
                    except: continue
            
            # Aggregate stats
            categories = {}
            for f in failures:
                cat = f.get('category', 'unknown')
                categories[cat] = categories.get(cat, 0) + 1
                
            return {
                "total_failures": len(failures),
                "breakdown": categories,
                "recent_failures": failures[:5]
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze agent failures: {e}")
            return {"error": str(e)}

    async def get_competitor_context(self, competitor_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieve existing Competitor context from SIF (txtai index).
        If not found, triggers a sync from DB and tries again.
        """
        try:
            logger.info(f"Retrieving Competitor context via SIF for user {self.user_id}")
            
            # 1. Construct semantic query
            query = f"competitor analysis {competitor_url if competitor_url else ''}"
            
            # 2. Search SIF
            results = await self.intelligence_service.search(query, limit=5)
            
            # 3. Filter for valid competitor analysis objects
            valid_results = []
            
            if results:
                for res in results:
                    try:
                        metadata_str = res.get('object')
                        metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                        
                        if metadata.get('type') == 'competitor_analysis':
                            if competitor_url and competitor_url not in metadata.get('url', ''):
                                continue 
                            
                            valid_results.append(metadata.get('full_report'))
                    except Exception as parse_err:
                        continue
            
            if valid_results:
                logger.info(f"Found {len(valid_results)} competitor contexts in SIF index")
                return {
                    "competitors": valid_results,
                    "source": "sif_index"
                }

            # 4. If not found, Sync and Retry
            logger.info("Competitor context not found in SIF. Triggering DB sync...")
            synced = await self.sync_onboarding_data_to_sif()
            
            if synced:
                results_retry = await self.intelligence_service.search(query, limit=5)
                if results_retry:
                    for res in results_retry:
                        try:
                            metadata_str = res.get('object')
                            metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                            if metadata.get('type') == 'competitor_analysis':
                                if competitor_url and competitor_url not in metadata.get('url', ''):
                                    continue
                                valid_results.append(metadata.get('full_report'))
                        except: continue
                    
                    if valid_results:
                         return {
                            "competitors": valid_results,
                            "source": "sif_index_after_sync"
                        }

            logger.warning("No Competitor data found in SIF even after sync.")
            return {
                "error": "No Competitor data found. Please complete onboarding.",
                "source": "empty"
            }

        except Exception as e:
            logger.error(f"Failed to get Competitor context via SIF: {e}")
            return {"error": str(e)}

    async def get_semantic_insights(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get semantic insights with intelligent caching.
        
        Args:
            website_data: User website analysis data
            
        Returns:
            Semantic insights with caching metadata
        """
        try:
            logger.info(f"Getting semantic insights for user {self.user_id}")
            
            # Check cache first
            if self.enable_caching and self.cache_manager:
                cached_insights = self.cache_manager.get_cached_semantic_insights(
                    user_id=self.user_id,
                    force_refresh=False
                )
                
                if cached_insights:
                    logger.info("Returning cached semantic insights")
                    return {
                        "insights": cached_insights,
                        "source": "cache",
                        "cached_at": cached_insights.get("timestamp", "unknown"),
                        "cache_hit": True
                    }
            
            # Generate new insights if cache miss or caching disabled
            logger.info("Generating new semantic insights")
            
            # Perform semantic analysis
            insights = await self._generate_semantic_insights(website_data)
            
            # Cache the results
            if self.enable_caching and self.cache_manager:
                self.cache_manager.cache_semantic_insights(
                    user_id=self.user_id,
                    insights=insights,
                    ttl=3600,  # 1 hour TTL
                    metadata={
                        "generated_at": datetime.now().isoformat(),
                        "website_data_hash": hash(str(website_data)),
                        "analysis_version": "v2.0"
                    }
                )
                logger.info("Cached new semantic insights")
            
            return {
                "insights": insights,
                "source": "analysis",
                "generated_at": datetime.now().isoformat(),
                "cache_hit": False
            }
            
        except Exception as e:
            logger.error(f"Failed to get semantic insights: {e}")
            return {
                "insights": {},
                "error": str(e),
                "source": "error"
            }
    
    async def _generate_semantic_insights(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate semantic insights using multiple analysis methods."""
        try:
            insights = {
                "user_id": self.user_id,
                "timestamp": datetime.now().isoformat(),
                "analysis_version": "v2.0"
            }
            
            # Content pillar analysis
            if self.intelligence_service.is_initialized():
                clusters = await self.intelligence_service.cluster(min_score=0.6)
                if asyncio.iscoroutine(clusters):
                    clusters = await clusters
                insights["content_pillars"] = self._format_clusters_as_pillars(clusters)
                
                # Semantic gaps analysis
                gaps = await self._identify_semantic_gaps(website_data)
                insights["semantic_gaps"] = gaps
                
                # Competitor comparison
                competitor_analysis = await self._analyze_competitor_semantics(website_data)
                insights["competitor_analysis"] = competitor_analysis
            
            # Strategic recommendations (lazy initialization to avoid circular imports)
            if not self.strategy_agent:
                from .sif_agents import StrategyArchitectAgent
                self.strategy_agent = StrategyArchitectAgent(self.intelligence_service, user_id=self.user_id)
            recommendations = await self.strategy_agent.analyze_content_strategy(website_data)
            insights["strategic_recommendations"] = recommendations
            
            # Content quality assessment (lazy initialization to avoid circular imports)
            if not self.guardian_agent:
                from services.intelligence.agents.specialized import ContentGuardianAgent
                self.guardian_agent = ContentGuardianAgent(self.intelligence_service, user_id=self.user_id, sif_service=self)
            quality_score = await self.guardian_agent.assess_content_quality(website_data)
            insights["content_quality"] = quality_score
            
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate semantic insights: {e}")
            return {"error": str(e)}
    
    def _format_clusters_as_pillars(self, clusters: List[List[int]]) -> List[Dict[str, Any]]:
        """Format clustering results as content pillars."""
        pillars = []
        
        for i, cluster in enumerate(clusters):
            if cluster:  # Only include non-empty clusters
                pillar = {
                    "pillar_id": f"pillar_{i}",
                    "size": len(cluster),
                    "relevance_score": 0.8,  # Placeholder - would be calculated
                    "key_topics": [f"topic_{j}" for j in range(min(5, len(cluster)))],
                    "competitor_coverage": 0.6,  # Placeholder
                    "user_coverage": 0.4  # Placeholder
                }
                pillars.append(pillar)
        
        return pillars
    
    async def _identify_semantic_gaps(self, website_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify semantic gaps using StrategyArchitectAgent evidence-driven analysis."""
        try:
            if not self.strategy_agent:
                from .sif_agents import StrategyArchitectAgent
                self.strategy_agent = StrategyArchitectAgent(self.intelligence_service, user_id=self.user_id)

            competitor_ids = website_data.get("competitor_indices", []) or []
            gaps = await self.strategy_agent.find_semantic_gaps(competitor_indices=competitor_ids)

            normalized_gaps = []
            for gap in gaps:
                density = gap.get("topic_density", {})
                normalized_gaps.append({
                    "topic": gap.get("topic"),
                    "priority": gap.get("priority", "medium"),
                    "reason": gap.get("reason", "Competitor coverage gap"),
                    "confidence": gap.get("confidence", 0.0),
                    "current_coverage_score": density.get("user", 0.0),
                    "competitor_coverage_score": density.get("competitor", 0.0),
                    "gap_severity": gap.get("priority", "medium"),
                    "suggested_action": f"Create dedicated content for '{gap.get('topic', 'this topic')}'",
                    "topic_density": density,
                    "evidence": gap.get("evidence", {})
                })

            return normalized_gaps

        except Exception as e:
            logger.error(f"Error identifying semantic gaps: {e}")
            return []
    
    async def _analyze_competitor_semantics(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze competitor semantic positioning."""
        # This would perform actual competitor analysis
        return {
            "total_competitors_analyzed": 5,
            "semantic_overlap": 0.65,
            "unique_positioning": ["AI-powered content", "Data-driven insights"],
            "competitive_advantages": ["Technical depth", "Industry expertise"],
            "threats": ["Large competitor budgets", "Established brand presence"]
        }
    
    def get_cache_performance_stats(self) -> Optional[Dict[str, Any]]:
        """Get cache performance statistics."""
        if not self.enable_caching or not self.cache_manager:
            return None
        
        try:
            stats = self.cache_manager.get_cache_stats()
            return {
                "hit_rate": stats.hit_rate,
                "total_hits": stats.total_hits,
                "total_misses": stats.total_misses,
                "cache_size": stats.cache_size,
                "memory_usage_mb": stats.memory_usage_mb,
                "average_hit_time_ms": stats.average_hit_time_ms,
                "total_invalidations": stats.total_invalidations
            }
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return None
    
    async def invalidate_user_cache(self, reason: str = "user_request") -> bool:
        """Invalidate cache for the current user."""
        try:
            if self.enable_caching and self.cache_manager:
                self.cache_manager.invalidate_user_cache(self.user_id)
                logger.info(f"Invalidated cache for user {self.user_id}. Reason: {reason}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to invalidate user cache: {e}")
            return False
    
# Integration with existing API endpoints
class SIFIntegrationAPI:
    """API wrapper for SIF operations with caching integration."""
    
    def __init__(self):
        self.services: Dict[str, SIFIntegrationService] = {}
    
    def get_service(self, user_id: str) -> Optional[SIFIntegrationService]:
        """Get or create SIF service for a user."""
        if not has_onboarding_session(user_id):
            logger.debug(
                "Skipping SIF service creation for user {} via SIFIntegrationAPI: no onboarding session",
                user_id,
            )
            return None
        if user_id not in self.services:
            self.services[user_id] = SIFIntegrationService(user_id)
        return self.services[user_id]
    
    async def get_semantic_insights_with_cache(self, user_id: str, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get semantic insights with caching metadata."""
        service = self.get_service(user_id)
        if not service:
            return {
                "source": "skipped",
                "reason": "no_onboarding_session",
                "insights": {},
            }
        return await service.get_semantic_insights(website_data)
    
    async def get_cache_performance(self, user_id: str) -> Dict[str, Any]:
        """Get cache performance metrics for a user."""
        service = self.get_service(user_id)
        if not service:
            return {
                "user_id": user_id,
                "cache_enabled": False,
                "performance": {},
                "reason": "no_onboarding_session",
                "timestamp": datetime.now().isoformat(),
            }
        stats = service.get_cache_performance_stats()
        
        return {
            "user_id": user_id,
            "cache_enabled": stats is not None,
            "performance": stats or {},
            "timestamp": datetime.now().isoformat()
        }
    
    async def invalidate_user_cache(self, user_id: str, reason: str = "api_request") -> Dict[str, Any]:
        """Invalidate cache for a specific user."""
        service = self.get_service(user_id)
        if not service:
            return {
                "user_id": user_id,
                "success": False,
                "reason": "no_onboarding_session",
                "timestamp": datetime.now().isoformat(),
            }
        success = await service.invalidate_user_cache(reason)
        
        return {
            "user_id": user_id,
            "success": success,
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        }


# Global API instance
sif_integration_api = SIFIntegrationAPI()


# Example usage and testing
async def test_sif_integration_service():
    """Test the SIF integration service with caching."""
    logger.info("Testing SIF Integration Service with Caching")
    
    # Create test service
    user_id = "test_user_123"
    service = SIFIntegrationService(user_id, enable_caching=True)
    
    # Test data
    website_data = {
        "url": "https://example.com",
        "content": [
            {"title": "SEO Best Practices", "content": "Learn about search engine optimization..."},
            {"title": "Content Marketing", "content": "Discover content marketing strategies..."}
        ],
        "competitors": [
            {"url": "https://competitor1.com", "name": "Competitor 1"},
            {"url": "https://competitor2.com", "name": "Competitor 2"}
        ]
    }
    
    # First call - should generate new insights
    logger.info("First call (cache miss expected):")
    result1 = await service.get_semantic_insights(website_data)
    logger.info(f"Source: {result1.get('source')}")
    logger.info(f"Cache hit: {result1.get('cache_hit')}")
    
    # Second call - should hit cache
    logger.info("\nSecond call (cache hit expected):")
    result2 = await service.get_semantic_insights(website_data)
    logger.info(f"Source: {result2.get('source')}")
    logger.info(f"Cache hit: {result2.get('cache_hit')}")
    
    # Get cache performance stats
    logger.info("\nCache Performance Stats:")
    stats = service.get_cache_performance_stats()
    if stats:
        logger.info(f"Hit rate: {stats['hit_rate']:.2%}")
        logger.info(f"Total hits: {stats['total_hits']}")
        logger.info(f"Total misses: {stats['total_misses']}")
        logger.info(f"Memory usage: {stats['memory_usage_mb']:.2f} MB")
    
    logger.info("SIF Integration Service test completed successfully!")


if __name__ == "__main__":
    # Run test
    asyncio.run(test_sif_integration_service())

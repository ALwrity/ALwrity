"""Indexing/sync mixin for SIFIntegrationService.

Holds the methods that embed onboarding, content-strategy, SEO dashboard,
market-trends, and user website content into the per-user SIF index, plus
the tier page-limit helper. These are split out of ``sif_integration.py``
to keep the facade light.
"""

from typing import Dict, Any, List, Tuple
from loguru import logger
from datetime import datetime
from sqlalchemy import select, desc

from services.database import get_session_for_user
from models.onboarding import WebsiteAnalysis, OnboardingSession, CompetitorAnalysis, PersonaData
from services.intelligence.sif_metrics import inc_counter as _sif_metrics_inc


def _safe_str(value: Any, fallback: str = "") -> str:
    """Coerce a persona field to a compact string (None -> '', lists joined)."""
    if value is None:
        return fallback
    if isinstance(value, str):
        return value
    if isinstance(value, (list, tuple)):
        return ", ".join(str(v) for v in value)
    return str(value)


def _build_persona_index_items(persona: Dict[str, Any], user_id: str) -> List[Tuple[str, str, Dict[str, Any]]]:
    """Build (id, text, metadata) SIF index items for a PersonaData dict.

    Writes natural-language text so content-generation agents can retrieve the
    brand voice semantically (e.g. "brand tone audience phrases"), plus one
    document per platform persona for per-platform retrieval.
    """
    items: List[Tuple[str, str, Dict[str, Any]]] = []

    # Core persona
    core = persona.get("core_persona")
    if isinstance(core, dict) and core:
        identity = core.get("identity") or {}
        linguistic = core.get("linguistic_fingerprint") or {}
        lexical = linguistic.get("lexical_features") or {}
        sentence = linguistic.get("sentence_metrics") or {}
        rhetorical = linguistic.get("rhetorical_devices") or {}
        tonal = core.get("tonal_range") or {}

        parts = [f"Brand persona {_safe_str(identity.get('persona_name'))}"]
        if identity.get("archetype"):
            parts.append(f"Archetype: {_safe_str(identity['archetype'])}")
        if identity.get("core_belief"):
            parts.append(f"Core belief: {_safe_str(identity['core_belief'])}")
        if identity.get("brand_voice_description"):
            parts.append(f"Brand voice: {_safe_str(identity['brand_voice_description'])}")
        if tonal.get("default_tone"):
            parts.append(f"Default tone: {_safe_str(tonal['default_tone'])}")
        if tonal.get("permissible_tones"):
            parts.append(f"Permissible tones: {_safe_str(tonal['permissible_tones'])}")
        if tonal.get("forbidden_tones"):
            parts.append(f"Avoid tones: {_safe_str(tonal['forbidden_tones'])}")
        if lexical.get("go_to_phrases"):
            parts.append(f"Go-to phrases: {_safe_str(lexical['go_to_phrases'])}")
        if lexical.get("go_to_words"):
            parts.append(f"Go-to words: {_safe_str(lexical['go_to_words'])}")
        if lexical.get("avoid_words"):
            parts.append(f"Avoid words: {_safe_str(lexical['avoid_words'])}")
        if sentence.get("average_sentence_length_words") is not None:
            parts.append(
                f"Sentence style: {_safe_str(sentence.get('average_sentence_length_words'))} words, "
                f"{_safe_str(sentence.get('preferred_sentence_type'))}, "
                f"{_safe_str(sentence.get('complexity_level'))}"
            )
        if rhetorical.get("storytelling_style"):
            parts.append(f"Storytelling: {_safe_str(rhetorical['storytelling_style'])}")
        text = ". ".join(parts) + "."
        meta = {
            "type": "persona",
            "persona_kind": "core",
            "user_id": user_id,
            "full_report": core,
        }
        items.append((f"persona_core:{user_id}", text, meta))

    # Platform personas (one document each, for per-platform retrieval)
    platforms = persona.get("platform_personas")
    if isinstance(platforms, dict) and platforms:
        for platform, p in platforms.items():
            if not isinstance(p, dict):
                continue
            name = _safe_str(p.get("persona_name") or p.get("name") or p.get("platform_type"))
            archetype = _safe_str(p.get("archetype"))
            core_belief = _safe_str(p.get("core_belief"))
            tone = _safe_str(p.get("default_tone") or p.get("tone"))
            parts = [f"{platform} content persona {name}"]
            if archetype:
                parts.append(f"Archetype: {archetype}")
            if core_belief:
                parts.append(f"Core belief: {core_belief}")
            if tone:
                parts.append(f"Tone: {tone}")
            text = ". ".join(parts) + "."
            meta = {
                "type": "persona",
                "persona_kind": "platform",
                "platform": platform,
                "user_id": user_id,
                "full_report": p,
            }
            items.append((f"persona_{platform}:{user_id}", text, meta))

    # Quality metrics
    quality = persona.get("quality_metrics") or {}
    if isinstance(quality, dict) and quality:
        text = (
            f"Persona quality metrics. Overall score {_safe_str(quality.get('overall_score'))}. "
            f"Core completeness {_safe_str(quality.get('core_completeness'))}, "
            f"platform consistency {_safe_str(quality.get('platform_consistency'))}, "
            f"platform optimization {_safe_str(quality.get('platform_optimization'))}, "
            f"linguistic quality {_safe_str(quality.get('linguistic_quality'))}."
        )
        meta = {
            "type": "persona",
            "persona_kind": "quality",
            "user_id": user_id,
            "full_report": quality,
        }
        items.append((f"persona_quality:{user_id}", text, meta))

    return items


class SIFSyncMixin:
    """Indexing/sync operations for the SIF index."""

    async def sync_persona_data_to_sif(self, db=None) -> None:
        """Embed PersonaData (core + platform personas + quality) into the SIF index.

        Raises:
            SIFEmbeddingFailed: If the underlying intelligence_service
                raised during the index call.
        """
        close_db = False
        try:
            if db is None:
                db = get_session_for_user(self.user_id)
                close_db = True
            if not db:
                return

            stmt = (
                select(PersonaData)
                .join(OnboardingSession, PersonaData.session_id == OnboardingSession.id)
                .where(OnboardingSession.user_id == self.user_id)
                .order_by(desc(PersonaData.updated_at))
            )
            persona = db.execute(stmt).scalars().first()
            if not persona:
                logger.info(f"No persona data found for user {self.user_id}")
                _sif_metrics_inc("sif_sync_total", "persona_success")
                return

            items = _build_persona_index_items(
                persona.to_dict() if hasattr(persona, "to_dict") else {},
                self.user_id,
            )
            if items:
                await self.intelligence_service.index_content(items)
                logger.info(f"Successfully synced {len(items)} persona items to SIF")
            _sif_metrics_inc("sif_sync_total", "persona_success")
        except Exception as e:
            logger.error(f"Failed to sync persona data to SIF: {e}", exc_info=True)
            from services.intelligence.sif_errors import SIFEmbeddingFailed
            _sif_metrics_inc("sif_sync_total", "persona_error")
            raise SIFEmbeddingFailed(
                f"Failed to sync persona data to SIF: {e}",
                user_id=self.user_id,
                operation="sync_persona_data_to_sif",
                cause=e,
            ) from e
        finally:
            if close_db and db:
                db.close()

    async def index_market_trends_run(self, trends_result: Dict[str, Any], run_id: str) -> None:
        """
        Index a market-trends run into the SIF index.

        Raises:
            SIFEmbeddingFailed: If the underlying ``intelligence_service.index_content``
                call raised.
            SIFError: Any other internal fault surfaces as the
                specific subclass raised (Phase 1.2.2 contracts).
        """
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
            _sif_metrics_inc("sif_sync_total", "market_trends_success")
        except Exception as e:
            logger.error(f"Failed to index market trends run: {e}", exc_info=True)
            _sif_metrics_inc("sif_sync_total", "market_trends_error")
            # Phase 1.2.3: re-raise as SIFEmbeddingFailed so callers
            # can distinguish "index worked" from "index failed at
            # the embedding layer" from "index failed because
            # something else broke". Pre-1.2.3 returned False; callers
            # (sif_indexing_executor, sif_integration callers) wrap
            # in ``try/except Exception`` so the behavior is preserved.
            from services.intelligence.sif_errors import SIFEmbeddingFailed
            raise SIFEmbeddingFailed(
                f"Failed to index market trends run: {e}",
                user_id=self.user_id,
                operation="index_market_trends_run",
                cause=e,
            ) from e

    async def sync_content_strategy_dashboard_to_sif(self, db=None) -> bool:
        close_db = False
        try:
            if db is None:
                db = get_session_for_user(self.user_id)
                close_db = True
            if not db:
                return

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
            _sif_metrics_inc("sif_sync_total", "content_strategy_success")
            return
        except Exception as e:
            logger.error(f"Failed to sync content strategy dashboard to SIF: {e}", exc_info=True)
            from services.intelligence.sif_errors import SIFEmbeddingFailed
            _sif_metrics_inc("sif_sync_total", "content_strategy_error")
            raise SIFEmbeddingFailed(
                f"Failed to sync content strategy dashboard to SIF: {e}",
                user_id=self.user_id,
                operation="sync_content_strategy_dashboard_to_sif",
                cause=e,
            ) from e
        finally:
            if close_db and db:
                db.close()

    async def sync_onboarding_data_to_sif(self) -> None:
        """
        Embeds existing onboarding data (WebsiteAnalysis, CompetitorAnalysis) into the SIF index.
        This ensures agents can query this data semantically without direct DB access.

        Raises:
            SIFEmbeddingFailed: If the underlying intelligence_service
                raised during the index call.
            SIFError: Any other internal fault (e.g. DB failure)
                surfaces as the specific subclass raised.
        """
        try:
            logger.info(f"Syncing onboarding data to SIF for user {self.user_id}")
            db = get_session_for_user(self.user_id)
            if not db:
                return

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

            # 3. Sync persona data (best-effort; independent of website/competitor)
            try:
                await self.sync_persona_data_to_sif(db=db)
            except Exception as e:
                logger.warning(f"Persona sync failed (continuing): {e}")

            # Index content
            if items_to_index:
                await self.intelligence_service.index_content(items_to_index)
                logger.info(f"Successfully synced {len(items_to_index)} onboarding items to SIF")
                try:
                    await self.sync_content_strategy_dashboard_to_sif(db=db)
                except Exception:
                    pass
            else:
                logger.info("No onboarding data found to sync")
            _sif_metrics_inc("sif_sync_total", "onboarding_success")
            return len(items_to_index)

        except Exception as e:
            logger.error(f"Failed to sync onboarding data to SIF: {e}", exc_info=True)
            from services.intelligence.sif_errors import SIFEmbeddingFailed
            _sif_metrics_inc("sif_sync_total", "onboarding_error")
            raise SIFEmbeddingFailed(
                f"Failed to sync onboarding data to SIF: {e}",
                user_id=self.user_id,
                operation="sync_onboarding_data_to_sif",
                cause=e,
            ) from e
        finally:
            if db:
                db.close()

    async def sync_seo_dashboard_to_sif(self) -> None:
        """
        Embeds SEO Dashboard data (GSC/Bing metrics) into the SIF index.

        Raises:
            SIFEmbeddingFailed: If the underlying intelligence_service
                raised during the index call.
            SIFError: Any other internal fault surfaces as the
                specific subclass raised.
        """

        try:
            logger.info(f"Syncing SEO Dashboard data to SIF for user {self.user_id}")
            db = get_session_for_user(self.user_id)
            if not db:
                return

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
            _sif_metrics_inc("sif_sync_total", "seo_dashboard_success")
            return

        except Exception as e:
            logger.error(f"Failed to sync SEO Dashboard data: {e}", exc_info=True)
            from services.intelligence.sif_errors import SIFEmbeddingFailed
            _sif_metrics_inc("sif_sync_total", "seo_dashboard_error")
            raise SIFEmbeddingFailed(
                f"Failed to sync SEO Dashboard data: {e}",
                user_id=self.user_id,
                operation="sync_seo_dashboard_to_sif",
                cause=e,
            ) from e
        finally:
            if db:
                db.close()

    def _get_sif_page_limit(self) -> int:
        """Return per-tier page limit for SIF indexing.

        Falls back to MAX_SIF_PAGES_PER_INDEX env var (default 10) if
        subscription lookup fails.
        """
        import os
        env_default = int(os.getenv("MAX_SIF_PAGES_PER_INDEX", "10"))
        try:
            from services.database.sessions import get_session_for_user
            from services.subscription import PricingService

            db = get_session_for_user(self.user_id)
            if not db:
                return env_default
            try:
                pricing = PricingService(db)
                limits = pricing.get_user_limits(self.user_id)
                tier = (limits or {}).get("tier", "").lower()

                tier_map = {
                    "free": env_default,
                    "basic": max(env_default, 20),
                    "pro": max(env_default, 30),
                    "enterprise": max(env_default, 50),
                }
                return tier_map.get(tier, env_default)
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[SIF] Failed to get tier limit: {e}")
            return env_default

    async def sync_user_website_content(self, website_url: str, progress_callback=None, log_callback=None) -> None:
        """
        Harvests and indexes user website content using incremental upsert strategy.
        This ensures that:
        1. New content is added to the index.
        2. Existing content is updated (refreshed).
        3. Only recent/relevant pages are processed (snapshot approach).

        Raises:
            SIFEmbeddingFailed: If the underlying intelligence_service
                raised during the index call.
            SIFError: Any other internal fault surfaces as the
                specific subclass raised.
        """
        try:
            logger.info(f"Syncing user website content for {website_url} (User: {self.user_id})")

            import hashlib
            from services.database.sessions import get_session_for_user
            from models.sif_indexing_watermark import SIFIndexingWatermark

            # 1. Resolve URLs (cheap) without crawling
            page_limit = self._get_sif_page_limit()
            if log_callback:
                try:
                    await log_callback(f"Resolving URLs (page limit: {page_limit})...")
                except Exception:
                    pass
            urls = await self.harvester.resolve_urls(
                website_url, limit=page_limit, user_id=self.user_id, log_callback=log_callback)

            # 2. Pre-filter: skip already-indexed URLs (watermark existence)
            wm_session = get_session_for_user(self.user_id)
            source_ids = [f"user_content:{u}" for u in urls]
            already_indexed = set()
            if wm_session:
                already_indexed = SIFIndexingWatermark.get_indexed_source_ids(
                    wm_session, self.user_id, source_ids)
            new_urls = [u for u, sid in zip(urls, source_ids) if sid not in already_indexed]
            unchanged_count = len(urls) - len(new_urls)

            if not new_urls:
                if log_callback:
                    try:
                        await log_callback(f"All {len(urls)} page(s) already indexed — nothing new")
                    except Exception:
                        pass
                if wm_session:
                    try:
                        wm_session.close()
                    except Exception:
                        pass
                _sif_metrics_inc("sif_sync_total", "website_content_success")
                return {"count": len(urls), "pages": [], "new": 0, "unchanged": unchanged_count}

            if log_callback:
                try:
                    await log_callback(f"Indexing {len(new_urls)} new page(s) ({unchanged_count} already indexed)")
                except Exception:
                    pass

            # 3. Harvest only new URLs
            harvested_pages = await self.harvester.harvest_website(
                website_url, limit=page_limit, user_id=self.user_id,
                progress_callback=progress_callback,
                log_callback=log_callback, urls=new_urls)

            if not harvested_pages:
                logger.warning(f"No content harvested from {website_url}")
                if wm_session:
                    try:
                        wm_session.close()
                    except Exception:
                        pass
                return {"count": unchanged_count, "pages": [], "new": 0, "unchanged": unchanged_count}

            logger.info(f"Harvested {len(harvested_pages)} new pages from {website_url}")

            # 4. Prepare items for indexing (Upsert Strategy with watermark)
            # Using URL as the unique ID ensures updates overwrite existing entries
            items_to_index = []
            watermark_updates = []  # (source_id, source_hash, embedding_count)

            for page in harvested_pages:
                url = page.get("url")
                if not url:
                    continue

                text_content = page.get("content", "")
                title = page.get("title", "")

                # Watermark: skip unchanged pages
                content_hash = hashlib.sha256(text_content.encode("utf-8")).hexdigest()
                source_id = f"user_content:{url}"
                if wm_session and SIFIndexingWatermark.is_fresh(
                    wm_session, self.user_id, source_id, content_hash
                ):
                    logger.debug(f"[SIF] Skipping unchanged page (watermark hit): {url}")
                    continue

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
                items_to_index.append((url, text_content, metadata))
                watermark_updates.append((source_id, content_hash, 1))

            # 5. Index (Upsert)
            if items_to_index:
                await self.intelligence_service.index_content(items_to_index)
                logger.info(f"Successfully synced {len(items_to_index)} new pages to SIF index")

            # 6. Persist watermarks
            if wm_session and watermark_updates:
                for source_id, content_hash, count in watermark_updates:
                    SIFIndexingWatermark.upsert(
                        wm_session, self.user_id, source_id, content_hash,
                        embedding_count=count, notes="website_content",
                    )
                try:
                    wm_session.commit()
                except Exception:
                    wm_session.rollback()
            if wm_session:
                try:
                    wm_session.close()
                except Exception:
                    pass
            _sif_metrics_inc("sif_sync_total", "website_content_success")
            return {
                "count": unchanged_count + len(harvested_pages),
                "pages": [{"url": p.get("url", ""), "title": p.get("title", "")} for p in harvested_pages if p.get("url")],
                "new": len(harvested_pages),
                "unchanged": unchanged_count,
            }

        except Exception as e:
            logger.error(f"Failed to sync user website content: {e}", exc_info=True)
            from services.intelligence.sif_errors import SIFEmbeddingFailed
            _sif_metrics_inc("sif_sync_total", "website_content_error")
            raise SIFEmbeddingFailed(
                f"Failed to sync user website content: {e}",
                user_id=self.user_id,
                operation="sync_user_website_content",
                cause=e,
            ) from e

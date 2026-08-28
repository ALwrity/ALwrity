"""
Step Management Service
Handles onboarding step operations and progress tracking.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import HTTPException
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from services.database import get_db
from models.onboarding import OnboardingSession, WebsiteAnalysis, ResearchPreferences, PersonaData, CompetitorAnalysis, PlatformIntegration
from services.intelligence.agent_flat_context import AgentFlatContextStore

class StepManagementService:
    """Service for handling onboarding step management."""
    
    def __init__(self):
        self.integration_service = OnboardingDataIntegrationService()

    def _get_or_create_session(
        self, user_id: str, db: Session, onboarding_type: Optional[str] = None
    ) -> OnboardingSession:
        """Get or create onboarding session.

        When ``onboarding_type`` is provided and a new session is created,
        it is set on the session so the correct platform strategy is used
        from the very first step.

        Returns the most recent session if one exists (ordered by updated_at DESC)
        to ensure writes go to the same session that reads target.
        """
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).order_by(OnboardingSession.updated_at.desc()).first()

        if not session:
            session = OnboardingSession(
                user_id=user_id,
                current_step=1,
                progress=0.0,
                started_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                onboarding_type=onboarding_type or "website",
            )
            db.add(session)
            db.commit()
            db.refresh(session)

        return session

    def _save_website_analysis(self, user_id: str, analysis_data: Dict[str, Any], db: Session) -> bool:
        """Save website analysis directly to database."""
        try:
            session = self._get_or_create_session(user_id, db)
            
            # Normalize payload
            incoming = analysis_data or {}
            nested = incoming.get('analysis') if isinstance(incoming.get('analysis'), dict) else None
            
            # Extract extra fields
            brand_analysis = (nested or incoming).get('brand_analysis')
            content_strategy_insights = (nested or incoming).get('content_strategy_insights')
            meta_info = (nested or incoming).get('meta_info')
            
            # Fix: Check both nested and incoming for social_media_presence
            social_media_presence = (nested or {}).get('social_media_presence') or incoming.get('social_media_presence')
            
            seo_audit = (nested or incoming).get('seo_audit')
            style_patterns = (nested or incoming).get('style_patterns')
            style_guidelines = (nested or incoming).get('guidelines')
            sitemap_analysis = (nested or incoming).get('sitemap_analysis')
            
            # Prepare crawl_result
            crawl_result = incoming.get('crawl_result') or {}
            if not isinstance(crawl_result, dict):
                crawl_result = {"raw": crawl_result}
                
            # Meta info still goes to crawl_result as we didn't add a column for it
            if meta_info:
                crawl_result['meta_info'] = meta_info
                
            # Store sitemap_analysis in crawl_result as we don't have a dedicated column yet
            if sitemap_analysis:
                crawl_result['sitemap_analysis'] = sitemap_analysis

            normalized = {
                'website_url': incoming.get('website') or incoming.get('website_url') or '',
                'writing_style': (nested or incoming).get('writing_style'),
                'content_characteristics': (nested or incoming).get('content_characteristics'),
                'target_audience': (nested or incoming).get('target_audience'),
                'content_type': (nested or incoming).get('content_type'),
                'recommended_settings': (nested or incoming).get('recommended_settings'),
                'brand_analysis': brand_analysis,
                'content_strategy_insights': content_strategy_insights,
                'social_media_presence': social_media_presence,
                'crawl_result': crawl_result,
                'seo_audit': seo_audit,
                'style_patterns': style_patterns,
                'style_guidelines': style_guidelines
            }
            
            # Filter only valid columns to prevent TypeError
            valid_columns = [c.name for c in WebsiteAnalysis.__table__.columns if c.name not in ['id', 'session_id', 'created_at', 'updated_at']]
            filtered_data = {k: v for k, v in normalized.items() if k in valid_columns and v is not None}

            existing_analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).first()
            
            if existing_analysis:
                for key, value in filtered_data.items():
                    setattr(existing_analysis, key, value)
                existing_analysis.updated_at = datetime.utcnow()
            else:
                new_analysis = WebsiteAnalysis(
                    session_id=session.id,
                    **filtered_data
                )
                db.add(new_analysis)
            
            db.commit()

            # Persist Step 2 snapshot to agent flat-file context for ultra-fast reads
            try:
                flat_store = AgentFlatContextStore(user_id)
                canonical_payload = {
                    "website_url": filtered_data.get("website_url") or incoming.get("website") or incoming.get("website_url"),
                    "analysis_date": datetime.utcnow().isoformat(),
                    "status": (nested or incoming).get("status") or "completed",
                    "error_message": (nested or incoming).get("error_message"),
                    "warning_message": (nested or incoming).get("warning_message"),
                    "writing_style": filtered_data.get("writing_style"),
                    "content_characteristics": filtered_data.get("content_characteristics"),
                    "target_audience": filtered_data.get("target_audience"),
                    "content_type": filtered_data.get("content_type"),
                    "recommended_settings": filtered_data.get("recommended_settings"),
                    "brand_analysis": filtered_data.get("brand_analysis"),
                    "content_strategy_insights": filtered_data.get("content_strategy_insights"),
                    "social_media_presence": filtered_data.get("social_media_presence"),
                    "style_patterns": filtered_data.get("style_patterns"),
                    "style_guidelines": filtered_data.get("style_guidelines"),
                    "seo_audit": filtered_data.get("seo_audit"),
                    "strategic_insights_history": (nested or incoming).get("strategic_insights_history"),
                    "crawl_result": filtered_data.get("crawl_result"),
                    "meta_info": meta_info,
                    "sitemap_analysis": sitemap_analysis,
                    "raw_step2_payload": incoming,
                    "raw_analysis_payload": nested or incoming,
                    "saved_at": datetime.utcnow().isoformat(),
                }
                flat_store.save_step2_website_analysis(canonical_payload, source="onboarding_step2")
            except Exception as flat_err:
                logger.warning(f"Failed to persist step 2 flat context for user {user_id}: {flat_err}")

            return True
        except Exception as e:
            logger.error(f"Error saving website analysis for user {user_id}: {e}")
            db.rollback()
            raise e

    def _save_research_preferences(self, user_id: str, research_data: Dict[str, Any], db: Session) -> bool:
        """Save research preferences directly to database."""
        try:
            session = self._get_or_create_session(user_id, db)
            
            # Add defaults for required fields if missing to prevent 500 errors
            # The frontend Step 3 (Competitor Analysis) might not send these
            if 'research_depth' not in research_data:
                research_data['research_depth'] = 'Comprehensive'
            if 'content_types' not in research_data:
                research_data['content_types'] = ["Blog Posts", "Social Media", "Newsletters"]
            if 'auto_research' not in research_data:
                research_data['auto_research'] = True
            if 'factual_content' not in research_data:
                research_data['factual_content'] = True
            
            existing_prefs = db.query(ResearchPreferences).filter(
                ResearchPreferences.session_id == session.id
            ).first()
            
            if existing_prefs:
                # Fix for SQLite DateTime issue: Ensure created_at is a datetime object
                if hasattr(existing_prefs, 'created_at') and isinstance(existing_prefs.created_at, str):
                    try:
                        existing_prefs.created_at = datetime.fromisoformat(existing_prefs.created_at)
                    except (ValueError, TypeError):
                        pass

                for key, value in research_data.items():
                    # Skip metadata fields and id
                    if key in ['id', 'session_id', 'created_at', 'updated_at']:
                        continue
                    # Merge per-platform research instead of overwriting:
                    # - content_types: union (never drop a platform's types)
                    # - research_depth: keep the deeper setting
                    if key == 'content_types' and isinstance(value, list):
                        existing_ct = getattr(existing_prefs, 'content_types', None)
                        if isinstance(existing_ct, list):
                            merged_ct = list(existing_ct)
                            for ct in value:
                                if ct not in merged_ct:
                                    merged_ct.append(ct)
                            value = merged_ct
                    elif key == 'research_depth' and isinstance(value, str):
                        depth_rank = {"Basic": 1, "Standard": 2, "Expert": 3, "Comprehensive": 4}
                        existing_depth = getattr(existing_prefs, 'research_depth', None)
                        if existing_depth and depth_rank.get(existing_depth, 0) >= depth_rank.get(value, 0):
                            continue
                    if hasattr(existing_prefs, key) and value is not None:
                        setattr(existing_prefs, key, value)
                existing_prefs.updated_at = datetime.utcnow()
            else:
                # Filter valid columns only to avoid errors
                valid_columns = [c.name for c in ResearchPreferences.__table__.columns if c.name not in ['id', 'session_id', 'created_at', 'updated_at']]
                filtered_data = {k: v for k, v in research_data.items() if k in valid_columns}
                
                new_prefs = ResearchPreferences(
                    session_id=session.id,
                    **filtered_data
                )
                db.add(new_prefs)
            
            db.commit()

            # Persist Step 3 snapshot to agent flat-file context
            try:
                flat_store = AgentFlatContextStore(user_id)
                canonical_payload = {
                    "research_depth": research_data.get("research_depth"),
                    "content_types": research_data.get("content_types") or [],
                    "auto_research": research_data.get("auto_research", True),
                    "factual_content": research_data.get("factual_content", True),
                    "writing_style": research_data.get("writing_style") or {},
                    "content_characteristics": research_data.get("content_characteristics") or {},
                    "target_audience": research_data.get("target_audience") or {},
                    "recommended_settings": research_data.get("recommended_settings") or {},
                    "industry_context": research_data.get("industry_context") or research_data.get("industryContext"),
                    "competitors": research_data.get("competitors") if isinstance(research_data.get("competitors"), list) else [],
                    "saved_at": datetime.utcnow().isoformat(),
                    "source_payload": research_data,
                }
                flat_store.save_step3_research_preferences(canonical_payload, source="onboarding_step3")
            except Exception as flat_err:
                logger.warning(f"Failed to persist step 3 flat context for user {user_id}: {flat_err}")

            return True
        except Exception as e:
            logger.error(f"Error saving research preferences for user {user_id}: {e}")
            db.rollback()
            raise e

    def _save_competitor_analysis(
        self, 
        user_id: str, 
        competitors: List[Dict[str, Any]], 
        industry_context: Optional[str], 
        db: Session, 
        content_pillars: Optional[Dict[str, Any]] = None,
        research_summary: Optional[Dict[str, Any]] = None,
        social_media_citations: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Save competitor analysis results to database.
        
        Args:
            user_id: User ID
            competitors: List of competitor data dicts
            industry_context: Industry context for the analysis
            db: Database session
            content_pillars: Optional content pillars from discovery
            research_summary: Optional research summary (market insights, key findings)
            social_media_citations: Optional social media citations list
        """
        try:
            session = self._get_or_create_session(user_id, db)

            logger.info(f" COMPETITOR SAVE: Starting to save {len(competitors)} competitors for session {session.id}")
            
            # Delete existing competitors for this session before re-inserting
            # This ensures stale competitors from previous runs are removed
            try:
                deleted_stale = db.query(CompetitorAnalysis).filter(
                    CompetitorAnalysis.session_id == session.id
                ).delete(synchronize_session=False)
                db.commit()
                if deleted_stale > 0:
                    logger.info(f"  Deleted {deleted_stale} stale competitors for session {session.id}")
            except Exception as del_err:
                logger.warning(f"  Failed to delete stale competitors: {del_err}")
                db.rollback()
            
            saved_count = 0
            failed_count = 0
            
            for idx, competitor in enumerate(competitors):
                try:
                    if not competitor or not isinstance(competitor, dict):
                        logger.warning(f"   Skipping invalid competitor entry at index {idx}: {competitor}")
                        continue

                    # Use full URL (Text column supports it) and clean it
                    raw_url = competitor.get("url", "")
                    competitor_url = raw_url.strip().strip('`').strip() if raw_url else ""

                    # Prepare analysis data
                    analysis_data = {
                        "title": competitor.get("title", ""),
                        "summary": competitor.get("summary", ""),
                        "relevance_score": competitor.get("relevance_score", 0.5),
                        "highlights": competitor.get("highlights", []),
                        "subpages": competitor.get("subpages", []),
                        "favicon": competitor.get("favicon"),
                        "image": competitor.get("image"),
                        "published_date": competitor.get("published_date"),
                        "author": competitor.get("author"),
                        "competitive_analysis": competitor.get("competitive_analysis") or competitor.get("competitive_insights", {}),
                        "content_insights": competitor.get("content_insights", {}),
                        "market_positioning": competitor.get("market_positioning", {}),
                        "industry_context": industry_context,
                        "completed_at": datetime.utcnow().isoformat()
                    }
                    
                    # Check if competitor already exists for this session
                    # Use the CLEANED URL (competitor_url) for dedupe to match what's stored,
                    # avoiding duplicates when same URL has different formatting (whitespace, backticks, etc.)
                    existing_competitor = db.query(CompetitorAnalysis).filter(
                        CompetitorAnalysis.session_id == session.id,
                        CompetitorAnalysis.competitor_url == competitor_url
                    ).first()

                    has_details = bool(analysis_data.get("summary") or analysis_data.get("highlights"))
                    detail_msg = "with rich details" if has_details else "basic info only"

                    if existing_competitor:
                        existing_competitor.analysis_data = analysis_data
                        existing_competitor.updated_at = datetime.utcnow()
                        logger.info(f"  Updated existing competitor {idx + 1} ({detail_msg})")
                    else:
                        competitor_record = CompetitorAnalysis(
                            session_id=session.id,
                            competitor_url=competitor_url,
                            competitor_domain=competitor.get("domain", ""),
                            analysis_data=analysis_data,
                            status="completed"
                        )
                        db.add(competitor_record)
                        logger.info(f"  Added new competitor {idx + 1} ({detail_msg})")
                    
                    saved_count += 1
                    
                except Exception as e:
                    failed_count += 1
                    logger.error(f"   Failed to save competitor {idx + 1}: {str(e)}")
            
            logger.info(f" Saved {saved_count} competitors ({failed_count} failed)")

            # Persist discovered content pillars, research summary, and social media citations
            # so they survive cache expiry and page refreshes
            if content_pillars or research_summary or social_media_citations:
                try:
                    research_prefs = db.query(ResearchPreferences).filter(
                        ResearchPreferences.session_id == session.id
                    ).first()
                    if research_prefs:
                        if content_pillars:
                            research_prefs.content_pillars = content_pillars
                        if research_summary:
                            research_prefs.research_summary = research_summary
                        if social_media_citations:
                            research_prefs.social_media_citations = social_media_citations
                        research_prefs.updated_at = datetime.utcnow()
                    else:
                        research_prefs = ResearchPreferences(
                            session_id=session.id,
                            research_depth='Comprehensive',
                            content_types=["Blog Posts", "Social Media", "Newsletters"],
                            auto_research=True,
                            factual_content=True,
                            content_pillars=content_pillars,
                            research_summary=research_summary,
                            social_media_citations=social_media_citations,
                        )
                        db.add(research_prefs)
                    logger.info(f" Prepared research data for session {session.id}: "
                                f"content_pillars={bool(content_pillars)}, "
                                f"research_summary={bool(research_summary)}, "
                                f"social_media_citations={bool(social_media_citations)}")
                except Exception as pillars_err:
                    logger.warning(f"Failed to prepare research data for user {user_id}: {pillars_err}")
                    db.rollback()
            
            # Single atomic commit for all competitor + research data
            try:
                db.commit()
                logger.info(f" Atomic commit complete for session {session.id}")
            except Exception as commit_err:
                logger.error(f"Failed to commit competitor analysis for user {user_id}: {commit_err}")
                db.rollback()
                raise commit_err

            # Refresh Step 3 flat context with competitor details saved by this flow
            try:
                flat_store = AgentFlatContextStore(user_id)
                existing_doc = flat_store.load_step3_context_document() or {}
                existing_data = existing_doc.get("data") if isinstance(existing_doc, dict) and isinstance(existing_doc.get("data"), dict) else {}
                merged_payload = {
                    **existing_data,
                    "competitors": competitors,
                    "industry_context": industry_context or existing_data.get("industry_context"),
                    "competitors_saved_at": datetime.utcnow().isoformat(),
                }
                flat_store.save_step3_research_preferences(merged_payload, source="onboarding_step3_competitors")
            except Exception as flat_err:
                logger.warning(f"Failed to refresh step 3 competitor flat context for user {user_id}: {flat_err}")

            return True
        except Exception as e:
            logger.error(f"Error saving competitor analysis for user {user_id}: {e}")
            db.rollback()
            raise e

    def save_content_pillars(self, user_id: str, content_pillars: Optional[Dict[str, Any]], db: Session) -> bool:
        """Persist discovered content pillars independently of competitor discovery.

        Used by the content-pillar refresh endpoint so pillars can be re-fetched
        without re-running the full (expensive) competitor discovery.
        """
        if not content_pillars:
            logger.warning(f"save_content_pillars: no pillars to save for user {user_id}")
            return False

        try:
            session = self._get_or_create_session(user_id, db)
            research_prefs = db.query(ResearchPreferences).filter(
                ResearchPreferences.session_id == session.id
            ).first()

            if research_prefs:
                research_prefs.content_pillars = content_pillars
                research_prefs.updated_at = datetime.utcnow()
            else:
                research_prefs = ResearchPreferences(
                    session_id=session.id,
                    research_depth='Comprehensive',
                    content_types=["Blog Posts", "Social Media", "Newsletters"],
                    auto_research=True,
                    factual_content=True,
                    content_pillars=content_pillars,
                )
                db.add(research_prefs)

            db.commit()
            logger.info(f"Saved content_pillars for session {session.id} (user {user_id})")
            return True
        except Exception as e:
            logger.error(f"Error saving content pillars for user {user_id}: {e}")
            db.rollback()
            return False

    def _delete_competitor_by_url(self, user_id: str, competitor_url: str, db: Session) -> bool:
        """Delete a single competitor by URL (or domain) across all user sessions."""
        try:
            from sqlalchemy import or_
            # Get all session IDs for this user to avoid first-vs-latest session mismatch
            session_ids = [
                s.id for s in db.query(OnboardingSession).filter(
                    OnboardingSession.user_id == user_id
                ).all()
            ]
            if not session_ids:
                logger.warning(f"No sessions found for user {user_id}")
                return False
            deleted = db.query(CompetitorAnalysis).filter(
                CompetitorAnalysis.session_id.in_(session_ids),
                or_(
                    CompetitorAnalysis.competitor_url == competitor_url,
                    CompetitorAnalysis.competitor_domain == competitor_url,
                )
            ).delete(synchronize_session=False)
            if deleted:
                db.commit()
                logger.info(f"Deleted competitor {competitor_url} for user {user_id}")
                # Clear step_data cache so get_research_data won't return stale competitors
                try:
                    from services.intelligence.agents.specialized.agent_flat_context import AgentFlatContextStore
                    flat_store = AgentFlatContextStore(user_id)
                    existing = flat_store.load_step3_context_document() or {}
                    if isinstance(existing, dict):
                        existing_data = existing.get("data") if isinstance(existing.get("data"), dict) else {}
                        competitors = existing_data.get("competitors", [])
                        if isinstance(competitors, list):
                            existing_data["competitors"] = [
                                c for c in competitors
                                if c.get("url", "").strip().strip('`').strip() != competitor_url
                            ]
                            flat_store.save_step3_research_preferences(existing_data, source="competitor_deletion")
                            logger.info(f"Updated flat context after deletion: {len(existing_data['competitors'])} competitors remain")
                except Exception as cache_err:
                    logger.warning(f"Could not update flat context after deletion: {cache_err}")
            else:
                logger.warning(f"No competitor found with URL {competitor_url} for user {user_id}")
            return deleted > 0
        except Exception as e:
            logger.error(f"Failed to delete competitor {competitor_url}: {e}")
            db.rollback()
            return False



    def _save_step5_integrations_context(self, user_id: str, step5_data: Dict[str, Any], db: Session) -> bool:
        """Persist Step 5 integrations data to DB and flat-file store."""
        try:
            integrations = step5_data.get("integrations") if isinstance(step5_data.get("integrations"), dict) else step5_data
            flat_store = AgentFlatContextStore(user_id)
            canonical_payload = {
                "integrations": integrations,
                "providers": step5_data.get("providers") if isinstance(step5_data.get("providers"), list) else [],
                "connected_accounts": step5_data.get("connectedAccounts") if isinstance(step5_data.get("connectedAccounts"), list) else [],
                "integration_status": step5_data.get("status") or step5_data.get("integrationStatus"),
                "notes": step5_data.get("notes") or step5_data.get("integrationNotes"),
                "saved_at": datetime.utcnow().isoformat(),
                "source_payload": step5_data,
            }

            # Persist to DB
            session = self._get_or_create_session(user_id, db)
            if session.platform_integrations:
                pi = session.platform_integrations
            else:
                pi = PlatformIntegration(session_id=session.id)
                db.add(pi)
            pi.primary_website = integrations.get("primaryWebsite")
            pi.website_platforms = integrations.get("websitePlatforms", {})
            pi.analytics_platforms = integrations.get("analyticsPlatforms", {})
            pi.social_platforms = integrations.get("socialPlatforms", {})
            pi.connected_platforms = integrations.get("connectedPlatforms", [])
            db.commit()

            # Also persist to flat file for backward compatibility
            flat_store.save_step5_integrations(canonical_payload, source="onboarding_step5")
            logger.info(f"Step 5 integrations persisted to DB and flat file for user {user_id}")
            return True
        except Exception as e:
            logger.warning(f"Failed to save Step 5 integrations for user {user_id}: {e}")
            return False

    def record_connected_platform(self, user_id: str, platform: str, db: Session) -> bool:
        """Idempotently record a connected platform on the session's PlatformIntegration.

        ``connected_platforms`` is the single source of truth for "which platforms
        this user connected" (website / linkedin / facebook / twitter / etc.).
        Populated incrementally as each platform connects during Step 1 (Connect
        Platforms), instead of the retired Step 5 integrations step.
        """
        try:
            from models.onboarding import PlatformIntegration
            session = self._get_or_create_session(user_id, db)
            if session.platform_integrations:
                pi = session.platform_integrations
            else:
                pi = PlatformIntegration(session_id=session.id)
                db.add(pi)
            connected = list(pi.connected_platforms or [])
            if platform not in connected:
                connected.append(platform)
            pi.connected_platforms = connected
            pi.updated_at = datetime.utcnow()
            db.commit()
            return True
        except Exception as e:
            logger.warning(f"Failed to record connected platform {platform} for user {user_id}: {e}")
            db.rollback()
            return False

    def _save_persona_data(self, user_id: str, persona_data: Dict[str, Any], db: Session) -> bool:
        """Save persona data directly to database."""
        try:
            session = self._get_or_create_session(user_id, db)
            
            existing = db.query(PersonaData).filter(
                PersonaData.session_id == session.id
            ).first()
            
            if existing:
                # Shared core persona: first non-empty write wins (the website flow's
                # core is generated from ALL connected platforms' data). A later
                # platform persona must NOT clobber it.
                new_core = persona_data.get('corePersona')
                if new_core:
                    existing.core_persona = new_core
                # Per-platform personas: MERGE (dict union) — never drop a platform.
                existing_platforms = existing.platform_personas or {}
                new_platforms = persona_data.get('platformPersonas') or {}
                if isinstance(existing_platforms, dict) and isinstance(new_platforms, dict):
                    merged = dict(existing_platforms)
                    merged.update(new_platforms)
                    existing.platform_personas = merged
                elif new_platforms:
                    existing.platform_personas = new_platforms
                if persona_data.get('qualityMetrics'):
                    existing.quality_metrics = persona_data.get('qualityMetrics')
                existing.selected_platforms = persona_data.get('selectedPlatforms', [])
                existing.updated_at = datetime.utcnow()
            else:
                persona = PersonaData(
                    session_id=session.id,
                    core_persona=persona_data.get('corePersona'),
                    platform_personas=persona_data.get('platformPersonas'),
                    quality_metrics=persona_data.get('qualityMetrics'),
                    selected_platforms=persona_data.get('selectedPlatforms', [])
                )
                db.add(persona)
            
            db.commit()

            # Persist Step 4 snapshot to agent flat-file context
            try:
                flat_store = AgentFlatContextStore(user_id)
                canonical_payload = {
                    "core_persona": persona_data.get("corePersona") or {},
                    "platform_personas": persona_data.get("platformPersonas") or {},
                    "quality_metrics": persona_data.get("qualityMetrics") or {},
                    "selected_platforms": persona_data.get("selectedPlatforms", []),
                    "research_persona": persona_data.get("researchPersona") or persona_data.get("research_persona"),
                    "persona_generation_notes": persona_data.get("personaGenerationNotes") or persona_data.get("persona_generation_notes"),
                    "saved_at": datetime.utcnow().isoformat(),
                    "source_payload": persona_data,
                }
                flat_store.save_step4_persona_data(canonical_payload, source="onboarding_step4")
            except Exception as flat_err:
                logger.warning(f"Failed to persist step 4 flat context for user {user_id}: {flat_err}")

            # Index the freshly saved core persona into SIF (fire-and-forget).
            # Platform personas are indexed incrementally by their own scheduler;
            # this ensures the core persona is retrievable immediately after
            # step 4, even before the background platform personas finish.
            try:
                from api.onboarding_utils.onboarding_task_scheduler import _fire_persona_sif_sync
                _fire_persona_sif_sync(user_id)
            except Exception as sif_err:
                logger.warning(f"Failed to schedule persona SIF sync for user {user_id}: {sif_err}")

            return True
        except Exception as e:
            logger.error(f"Error saving persona data for user {user_id}: {e}")
            db.rollback()
            raise e
    
    async def get_onboarding_status(self, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Get the current onboarding status (per user)."""
        try:
            from services.onboarding.progress_service import OnboardingProgressService
            user_id = str(current_user.get('id'))
            status = OnboardingProgressService().get_onboarding_status(user_id)
            return {
                "is_completed": status["is_completed"],
                "current_step": status["current_step"],
                "completion_percentage": status["completion_percentage"],
                "next_step": 5 if status["is_completed"] else max(1, status["current_step"]),
                "started_at": status["started_at"],
                "completed_at": status["completed_at"],
                "can_proceed_to_final": True if status["is_completed"] else status["current_step"] >= 4,
            }
        except Exception as e:
            logger.error(f"Error getting onboarding status: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def get_onboarding_progress_full(self, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Get the full onboarding progress data."""
        try:
            from services.onboarding.progress_service import OnboardingProgressService
            user_id = str(current_user.get('id'))
            progress_service = OnboardingProgressService()
            status = progress_service.get_onboarding_status(user_id)
            data = progress_service.get_completion_data(user_id)

            def completed(b: bool) -> str:
                return 'completed' if b else 'pending'

            api_keys = data.get('api_keys') or {}
            website = data.get('website_analysis') or {}
            research = data.get('research_preferences') or {}
            persona = data.get('persona_data') or {}

            steps = [
                {
                    "step_number": 1,
                    "title": "Connect Platforms",
                    "description": "Set up your website and platforms",
                    "status": completed(bool(website.get('website_url') or website.get('writing_style'))),
                    "completed_at": None,
                    "data": website or None,
                    "validation_errors": []
                },
                {
                    "step_number": 2,
                    "title": "Research",
                    "description": "Discover competitors",
                    "status": completed(bool(research.get('research_depth') or research.get('content_types'))),
                    "completed_at": None,
                    "data": research or None,
                    "validation_errors": []
                },
                {
                    "step_number": 3,
                    "title": "Personalization",
                    "description": "Customize your experience",
                    "status": completed(bool(persona.get('corePersona') or persona.get('core_persona') or persona.get('platformPersonas') or persona.get('platform_personas'))),
                    "completed_at": None,
                    "data": persona or None,
                    "validation_errors": []
                },
                {
                    "step_number": 4,
                    "title": "Finish",
                    "description": "Complete setup",
                    "status": completed(status['is_completed']),
                    "completed_at": status['completed_at'],
                    "data": None,
                    "validation_errors": []
                }
            ]

            return {
                "steps": steps,
                "current_step": 5 if status['is_completed'] else status['current_step'],
                "started_at": status['started_at'],
                "last_updated": status['last_updated'],
                "is_completed": status['is_completed'],
                "completed_at": status['completed_at'],
                "completion_percentage": status['completion_percentage']
            }
        except Exception as e:
            logger.error(f"Error getting onboarding progress: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def get_step_data(self, step_number: int, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Get data for a specific step."""
        try:
            user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
            db = next(get_db(current_user))
            
            # Use SSOT for reading step data
            integrated_data = self.integration_service.get_integrated_data_sync(user_id, db)

            if step_number == 1:
                website = integrated_data.get('website_analysis', {})
                api_keys = integrated_data.get('api_keys', {})
                return {
                    "step_number": 1,
                    "title": "Connect Platforms",
                    "description": "Set up your website and platforms",
                    "status": 'completed' if (website.get('website_url') or website.get('writing_style')) else 'pending',
                    "completed_at": None,
                    "data": website,
                    "validation_errors": []
                }
            if step_number == 2:
                research = integrated_data.get('research_preferences', {})
                competitors = integrated_data.get('competitor_analysis', [])
                website = integrated_data.get('website_analysis', {})
                social_media = dict(website.get('social_media_presence') or website.get('social_media_accounts', {}) or {})
                
                # Extract crawl_result social_media for use as fallback
                crawl_result = website.get('crawl_result', {}) or {}
                crawl_social_media = {}
                if isinstance(crawl_result, dict):
                    crawl_content = crawl_result.get('content', {}) or {}
                    crawl_social_media = crawl_content.get('social_media', {}) or {}
                    if not isinstance(crawl_social_media, dict):
                        crawl_social_media = {}
                    def _norm_url(u: str) -> str:
                        if not isinstance(u, str):
                            return ''
                        u = u.strip()
                        if not u:
                            return ''
                        if u.startswith('//'):
                            return 'https:' + u
                        if not u.startswith('http://') and not u.startswith('https://'):
                            return 'https://' + u if '.' in u else ''
                        return u
                    for platform, url in list(crawl_social_media.items()):
                        existing = social_media.get(platform)
                        if not existing or str(existing).strip().lower() in ('', '1', 'true', 'none'):
                            social_media[platform] = _norm_url(url)
                
                # Merge competitors into the data
                step_data = research.copy() if research else {}
                step_data['competitors'] = competitors
                step_data['social_media_accounts'] = social_media
                step_data['crawl_social_media'] = crawl_social_media
                step_data['content_pillars'] = research.get('content_pillars') if isinstance(research, dict) else None
                # Include research summary and social media citations from DB persistence
                step_data['researchSummary'] = research.get('research_summary') if isinstance(research, dict) else None
                step_data['social_media_citations'] = research.get('social_media_citations') if isinstance(research, dict) else None

                # Include saved sitemap analysis if available
                seo_audit = website.get('seo_audit', {}) or {}
                if seo_audit.get('sitemap_analysis'):
                    step_data['sitemapAnalysis'] = seo_audit['sitemap_analysis']
                
                return {
                    "step_number": 2,
                    "title": "Research",
                    "description": "Discover competitors",
                    "status": 'completed' if (research.get('research_depth') or research.get('content_types') or competitors) else 'pending',
                    "completed_at": None,
                    "data": step_data,
                    "validation_errors": []
                }
            if step_number == 3:
                persona = integrated_data.get('persona_data', {})
                return {
                    "step_number": 3,
                    "title": "Personalization",
                    "description": "Customize your experience",
                    "status": 'completed' if (persona.get('corePersona') or persona.get('core_persona') or persona.get('platformPersonas') or persona.get('platform_personas')) else 'pending',
                    "completed_at": None,
                    "data": persona,
                    "validation_errors": []
                }
            from services.onboarding.progress_service import OnboardingProgressService
            status = OnboardingProgressService().get_onboarding_status(user_id)
            mapping = {
                1: ('Connect Platforms', 'Set up your website and platforms', status['current_step'] >= 1),
                5: ('Finish', 'Complete setup', status['is_completed'])
            }
            title, description, done = mapping.get(step_number, (f'Step {step_number}', 'Onboarding step', False))
            return {
                "step_number": step_number,
                "title": title,
                "description": description,
                "status": 'completed' if done else 'pending',
                "completed_at": status['completed_at'] if step_number == 5 and done else None,
                "data": None,
                "validation_errors": []
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting step data: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def complete_step(self, step_number: int, request_data: Dict[str, Any], current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Mark a step as completed.

        Delegates platform-specific data persistence + task scheduling to the
        registered :class:`PlatformOnboardingStrategy` for the session's
        ``onboarding_type``.  Shared concerns (validation, progress tracking,
        SSOT refresh) stay here.
        """
        try:
            logger.info(f"[complete_step] Completing step {step_number}")
            user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))

            # Optional validation
            try:
                from services.validation import validate_step_data
                logger.info(f"[complete_step] Validating step {step_number} with data: {request_data}")
                validation_errors = validate_step_data(step_number, request_data)
                if validation_errors:
                    logger.warning(f"[complete_step] Step {step_number} validation failed: {validation_errors}")
                    raise HTTPException(status_code=400, detail=f"Step validation failed: {'; '.join(validation_errors)}")
            except ImportError:
                pass

            db = next(get_db(current_user))

            # ------------------------------------------------------------------
            # Platform strategy dispatch
            # ------------------------------------------------------------------
            from api.onboarding_utils.platform_strategies import get_strategy
            # Allow frontend to set onboarding_type on first step
            requested_type = (
                (request_data or {}).get("onboarding_type")
                or (request_data or {}).get("data", {}).get("onboarding_type")
            )
            session = self._get_or_create_session(user_id, db, onboarding_type=requested_type)
            strategy = get_strategy(session.onboarding_type)
            logger.info(f"[complete_step] Using '{strategy.onboarding_type}' strategy for user {user_id}")

            strategy_result = await strategy.complete_step(
                svc=self,
                step_number=step_number,
                user_id=user_id,
                request_data=request_data or {},
                db=db,
            )
            save_errors = strategy_result.get("warnings") or []

            # Persist current step and progress in DB
            # If the platform strategy already marked onboarding as complete
            # (current_step >= 5 or progress >= 100%), do not overwrite it.
            from services.onboarding.progress_service import OnboardingProgressService
            progress_service = OnboardingProgressService()
            try:
                session = self._get_or_create_session(user_id, db)
                already_completed = (session.current_step or 0) >= 5 or (session.progress or 0.0) >= 100.0
            except Exception:
                already_completed = False

            if not already_completed:
                progress_service.update_step(user_id, step_number + 1)
                try:
                    progress_pct = min(100.0, round((step_number / 4) * 100))
                    progress_service.update_progress(user_id, float(progress_pct))
                except Exception as e:
                    logger.warning(f"Failed to update progress: {e}")
            else:
                logger.info(f"[complete_step] Strategy already marked onboarding complete for {user_id}; skipping progress overwrite")

            # Log save errors but don't block step completion (non-blocking)
            if save_errors:
                logger.warning(f" Step {step_number} completed but some data save operations failed: {save_errors}")

            # Refresh SSOT (Canonical Profile) - non-blocking try/except inside method
            if not save_errors:
                await self.integration_service.refresh_integrated_data(user_id, db)

            logger.info(f"[complete_step] Step {step_number} persisted to DB for user {user_id}")
            return {
                "message": "Step completed successfully",
                "step_number": step_number,
                "data": request_data or {},
                "warnings": save_errors if save_errors else None  # Include warnings in response
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error completing step: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def skip_step(self, step_number: int, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Skip a step (for optional steps).

        Per-step "skipped" status was never persisted (the legacy
        ``OnboardingProgress`` kept it in-memory only), so the honest
        equivalent is to advance ``current_step`` past the skipped step.
        """
        try:
            from services.onboarding.progress_service import OnboardingProgressService
            user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
            OnboardingProgressService().update_step(user_id, step_number + 1)
            
            return {
                "message": f"Step {step_number} skipped successfully",
                "step_number": step_number
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error skipping step: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")

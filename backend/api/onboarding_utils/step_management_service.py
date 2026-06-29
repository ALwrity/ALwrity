"""
Step Management Service
Handles onboarding step operations and progress tracking.
"""

import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import HTTPException
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from services.database import get_db
from models.onboarding import OnboardingSession, APIKey, WebsiteAnalysis, ResearchPreferences, PersonaData, CompetitorAnalysis, PlatformIntegration
from services.intelligence.agent_flat_context import AgentFlatContextStore

class StepManagementService:
    """Service for handling onboarding step management."""
    
    def __init__(self):
        self.integration_service = OnboardingDataIntegrationService()

    def _get_or_create_session(self, user_id: str, db: Session) -> OnboardingSession:
        """Get or create onboarding session."""
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).first()
        
        if not session:
            session = OnboardingSession(
                user_id=user_id,
                current_step=1,
                progress=0.0,
                started_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            
        return session

    def _save_api_key(self, user_id: str, provider: str, api_key: str, db: Session) -> bool:
        """Save API key directly to database."""
        try:
            session = self._get_or_create_session(user_id, db)
            
            existing_key = db.query(APIKey).filter(
                APIKey.session_id == session.id,
                APIKey.provider == provider
            ).first()
            
            if existing_key:
                existing_key.key = api_key
                existing_key.updated_at = datetime.utcnow()
            else:
                new_key = APIKey(
                    session_id=session.id,
                    provider=provider,
                    key=api_key
                )
                db.add(new_key)
            
            db.commit()

            return True
        except Exception as e:
            logger.error(f"Error saving API key for user {user_id}: {e}")
            db.rollback()
            raise e

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

    def _save_competitor_analysis(self, user_id: str, competitors: List[Dict[str, Any]], industry_context: Optional[str], db: Session) -> bool:
        """Save competitor analysis results to database."""
        try:
            session = self._get_or_create_session(user_id, db)
            
            logger.info(f" COMPETITOR SAVE: Starting to save {len(competitors)} competitors for session {session.id}")
            
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
                        "industry_context": industry_context,
                        "completed_at": datetime.utcnow().isoformat()
                    }
                    
                    # Check if competitor already exists for this session
                    existing_competitor = db.query(CompetitorAnalysis).filter(
                        CompetitorAnalysis.session_id == session.id,
                        CompetitorAnalysis.competitor_url == competitor.get("url", "")
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
            
            db.commit()
            logger.info(f" Saved {saved_count} competitors ({failed_count} failed)")

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

    def _save_persona_data(self, user_id: str, persona_data: Dict[str, Any], db: Session) -> bool:
        """Save persona data directly to database."""
        try:
            session = self._get_or_create_session(user_id, db)
            
            existing = db.query(PersonaData).filter(
                PersonaData.session_id == session.id
            ).first()
            
            if existing:
                existing.core_persona = persona_data.get('corePersona')
                existing.platform_personas = persona_data.get('platformPersonas')
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
                "next_step": 6 if status["is_completed"] else max(1, status["current_step"]),
                "started_at": status["started_at"],
                "completed_at": status["completed_at"],
                "can_proceed_to_final": True if status["is_completed"] else status["current_step"] >= 5,
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
                    "title": "API Keys",
                    "description": "Connect your AI services",
                    "status": completed(any(v for v in api_keys.values() if v)),
                    "completed_at": None,
                    "data": None,
                    "validation_errors": []
                },
                {
                    "step_number": 2,
                    "title": "Website",
                    "description": "Set up your website",
                    "status": completed(bool(website.get('website_url') or website.get('writing_style'))),
                    "completed_at": None,
                    "data": website or None,
                    "validation_errors": []
                },
                {
                    "step_number": 3,
                    "title": "Research",
                    "description": "Discover competitors",
                    "status": completed(bool(research.get('research_depth') or research.get('content_types'))),
                    "completed_at": None,
                    "data": research or None,
                    "validation_errors": []
                },
                {
                    "step_number": 4,
                    "title": "Personalization",
                    "description": "Customize your experience",
                    "status": completed(bool(persona.get('corePersona') or persona.get('core_persona') or persona.get('platformPersonas') or persona.get('platform_personas'))),
                    "completed_at": None,
                    "data": persona or None,
                    "validation_errors": []
                },
                {
                    "step_number": 5,
                    "title": "Integrations",
                    "description": "Connect additional services",
                    "status": completed(status['current_step'] >= 5),
                    "completed_at": None,
                    "data": None,
                    "validation_errors": []
                },
                {
                    "step_number": 6,
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
                "current_step": 6 if status['is_completed'] else status['current_step'],
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

            if step_number == 2:
                website = integrated_data.get('website_analysis', {})
                return {
                    "step_number": 2,
                    "title": "Website",
                    "description": "Set up your website",
                    "status": 'completed' if (website.get('website_url') or website.get('writing_style')) else 'pending',
                    "completed_at": None,
                    "data": website,
                    "validation_errors": []
                }
            if step_number == 3:
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
                
                return {
                    "step_number": 3,
                    "title": "Research",
                    "description": "Discover competitors",
                    "status": 'completed' if (research.get('research_depth') or research.get('content_types') or competitors) else 'pending',
                    "completed_at": None,
                    "data": step_data,
                    "validation_errors": []
                }
            if step_number == 4:
                persona = integrated_data.get('persona_data', {})
                return {
                    "step_number": 4,
                    "title": "Personalization",
                    "description": "Customize your experience",
                    "status": 'completed' if (persona.get('corePersona') or persona.get('core_persona') or persona.get('platformPersonas') or persona.get('platform_personas')) else 'pending',
                    "completed_at": None,
                    "data": persona,
                    "validation_errors": []
                }
            if step_number == 5:
                integrations = integrated_data.get('platform_integrations', {})
                return {
                    "step_number": 5,
                    "title": "Integrations",
                    "description": "Connect additional services",
                    "status": 'completed' if integrations.get('connected_platforms') else 'pending',
                    "completed_at": None,
                    "data": integrations,
                    "validation_errors": []
                }

            from services.onboarding.progress_service import OnboardingProgressService
            status = OnboardingProgressService().get_onboarding_status(user_id)
            mapping = {
                1: ('API Keys', 'Connect your AI services', status['current_step'] >= 1),
                6: ('Finish', 'Complete setup', status['is_completed'])
            }
            title, description, done = mapping.get(step_number, (f'Step {step_number}', 'Onboarding step', False))
            return {
                "step_number": step_number,
                "title": title,
                "description": description,
                "status": 'completed' if done else 'pending',
                "completed_at": status['completed_at'] if step_number == 6 and done else None,
                "data": None,
                "validation_errors": []
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting step data: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def complete_step(self, step_number: int, request_data: Dict[str, Any], current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Mark a step as completed."""
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
            
            save_errors = []  # Track save failures

            # Step-specific side effects: save data to DB
            if step_number == 1 and request_data:
                step_data = request_data.get('data') or request_data
                logger.info(f" Step 1: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
                logger.info(f" Step 1: Extracted step_data keys: {list(step_data.keys()) if step_data else 'None'}")

                # Save API keys (legacy step 1)
                api_keys = step_data.get('api_keys', {})
                logger.info(f" Step 1: API keys found: {list(api_keys.keys()) if api_keys else 'None'}")
                if api_keys:
                    for provider, key in api_keys.items():
                        if key:
                            try:
                                saved = self._save_api_key(user_id, provider, key, db)
                                if saved:
                                    logger.info(f" Saved API key for provider {provider}")
                            except Exception as e:
                                logger.error(f" BLOCKING ERROR: Failed to save API key for provider {provider}: {str(e)}")
                                raise HTTPException(
                                    status_code=500,
                                    detail=f"Failed to save API key for {provider}. Onboarding cannot proceed until this is resolved."
                                ) from e

                # Save integrations data (website platforms, analytics, social, primary site)
                integrations = step_data.get('integrations')
                if integrations and isinstance(integrations, dict):
                    try:
                        logger.info(f" Step 1: Saving integrations data for user {user_id}")
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
                        logger.info(f" Step 1: Integrations data persisted for user {user_id}")
                    except Exception as e:
                        logger.error(f" Step 1: Failed to save integrations data: {str(e)}")
                        db.rollback()
                        raise HTTPException(
                            status_code=500,
                            detail="Failed to save integrations data. Onboarding cannot proceed until this is resolved."
                        ) from e

            # Step 2: Save website analysis data
            elif step_number == 2 and request_data:
                website_data = request_data.get('data') or request_data
                logger.info(f" Step 2: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
                logger.info(f" Step 2: Extracted website_data keys: {list(website_data.keys()) if website_data else 'None'}")
                if website_data:
                    try:
                        saved = self._save_website_analysis(user_id, website_data, db)
                        if saved:
                            logger.info(f" Saved website analysis for user {user_id}")
                            
                            # Schedule background tasks for Step 2 (non-blocking)
                            website_url = website_data.get('website') or website_data.get('website_url')
                            if website_url:
                                from api.onboarding_utils.onboarding_task_scheduler import schedule_step2_tasks, _immediate_sif_index
                                schedule_step2_tasks(user_id, db, website_url)
                                # Fire immediate SIF indexing (best-effort, non-blocking)
                                try:
                                    asyncio.create_task(_immediate_sif_index(user_id, website_url))
                                except Exception:
                                    logger.warning("[SIF] Failed to fire immediate indexing task")
                    except Exception as e:
                        logger.error(f" BLOCKING ERROR: Failed to save website analysis: {str(e)}")
                        raise HTTPException(
                            status_code=500,
                            detail="Failed to save website analysis data. Onboarding cannot proceed until this is resolved."
                        ) from e

            # Step 3: Save research preferences data
            elif step_number == 3 and request_data:
                research_data = request_data.get('data') or request_data
                logger.info(f" Step 3: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
                logger.info(f" Step 3: Extracted research_data keys: {list(research_data.keys()) if research_data else 'None'}")
                if research_data:
                    try:
                        saved = self._save_research_preferences(user_id, research_data, db)
                        if saved:
                            logger.info(f" Saved research preferences for user {user_id}")
                            
                        # Also save competitors if present
                        competitors = research_data.get('competitors')
                        if competitors:
                            industry_context = research_data.get('industryContext') or research_data.get('industry_context')
                            logger.info(f" Step 3: Found {len(competitors)} competitors to save")
                            self._save_competitor_analysis(user_id, competitors, industry_context, db)

                            # Schedule deep competitor analysis (non-blocking)
                            website_url = None
                            try:
                                session = self._get_or_create_session(user_id, db)
                                existing_analysis = db.query(WebsiteAnalysis).filter(
                                    WebsiteAnalysis.session_id == session.id
                                ).first()
                                if existing_analysis and existing_analysis.website_url:
                                    website_url = existing_analysis.website_url
                            except Exception:
                                pass
                            if website_url:
                                from api.onboarding_utils.onboarding_task_scheduler import schedule_step3_tasks
                                schedule_step3_tasks(user_id, db, website_url, competitors)
                            
                        # Save social media presence if available (Update WebsiteAnalysis)
                        social_media = research_data.get('social_media_accounts')
                        if social_media:
                            logger.info(f" Step 3: Found social media accounts to save")
                            try:
                                session = self._get_or_create_session(user_id, db)
                                existing_analysis = db.query(WebsiteAnalysis).filter(
                                    WebsiteAnalysis.session_id == session.id
                                ).first()
                                if existing_analysis:
                                    existing_analysis.social_media_presence = social_media
                                    existing_analysis.updated_at = datetime.utcnow()
                                    db.commit()
                                    logger.info(f" Updated social media presence for user {user_id}")
                                else:
                                    logger.warning(f" Could not save social media: WebsiteAnalysis not found for user {user_id}")
                            except Exception as e:
                                logger.error(f" Failed to save social media presence: {str(e)}")
                                # Don't block completion for this, as it's secondary data
                    
                    except Exception as e:
                        logger.error(f" BLOCKING ERROR: Failed to save research preferences: {str(e)}")
                        raise HTTPException(
                            status_code=500,
                            detail="Failed to save research preferences. Onboarding cannot proceed until this is resolved."
                        ) from e

            # Step 4: Save persona data
            elif step_number == 4 and request_data:
                persona_data = request_data.get('data') or request_data
                logger.info(f" Step 4: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
                logger.info(f" Step 4: Extracted persona_data keys: {list(persona_data.keys()) if persona_data else 'None'}")
                if persona_data:
                    try:
                        saved = self._save_persona_data(user_id, persona_data, db)
                        if saved:
                            logger.info(f" Saved persona data for user {user_id}")
                            # Schedule persona generation tasks (non-blocking)
                            from api.onboarding_utils.onboarding_task_scheduler import schedule_step4_tasks
                            schedule_step4_tasks(user_id, db)
                    except Exception as e:
                        logger.error(f" BLOCKING ERROR: Failed to save persona data: {str(e)}")
                        raise HTTPException(
                            status_code=500,
                            detail="Failed to save persona data. Onboarding cannot proceed until this is resolved."
                        ) from e


            # Step 5: Save integrations data to flat context
            elif step_number == 5 and request_data:
                step5_data = request_data.get('data') or request_data
                logger.info(f" Step 5: Raw request_data keys: {list(request_data.keys()) if request_data else 'None'}")
                logger.info(f" Step 5: Extracted step5_data keys: {list(step5_data.keys()) if step5_data else 'None'}")
                if step5_data:
                    saved = self._save_step5_integrations_context(user_id, step5_data, db)
                    if saved:
                        logger.info(f" Saved Step 5 integrations context for user {user_id}")
                        # Schedule Step 5 background tasks (non-blocking)
                        from api.onboarding_utils.onboarding_task_scheduler import schedule_step5_tasks
                        schedule_step5_tasks(user_id, db)
                    else:
                        logger.warning(f" Step 5 integrations context not persisted for user {user_id}")

            # Persist current step and progress in DB
            from services.onboarding.progress_service import OnboardingProgressService
            progress_service = OnboardingProgressService()
            progress_service.update_step(user_id, step_number)
            try:
                progress_pct = min(100.0, round((step_number / 6) * 100))
                progress_service.update_progress(user_id, float(progress_pct))
            except Exception as e:
                logger.warning(f"Failed to update progress: {e}")

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
        """Skip a step (for optional steps)."""
        try:
            from services.onboarding.api_key_manager import get_onboarding_progress_for_user
            user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
            progress = get_onboarding_progress_for_user(user_id)
            step = progress.get_step_data(step_number)
            
            if not step:
                raise HTTPException(status_code=404, detail=f"Step {step_number} not found")
            
            # Mark step as skipped
            progress.mark_step_skipped(step_number)
            
            return {
                "message": f"Step {step_number} skipped successfully",
                "step_number": step_number
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error skipping step: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    async def validate_step_access(self, step_number: int, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Validate if user can access a specific step."""
        try:
            user_id = str(current_user.get('clerk_user_id') or current_user.get('id'))
            progress = get_onboarding_progress_for_user(user_id)
            
            if not progress.can_proceed_to_step(step_number):
                return {
                    "can_proceed": False,
                    "validation_errors": [f"Cannot proceed to step {step_number}. Complete previous steps first."],
                    "step_status": "locked"
                }
            
            return {
                "can_proceed": True,
                "validation_errors": [],
                "step_status": "available"
            }
        except Exception as e:
            logger.error(f"Error validating step access: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")

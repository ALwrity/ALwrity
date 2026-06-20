"""
Onboarding Data Integration Service
Onboarding data integration and processing.
"""

from utils.logger_utils import get_service_logger
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import traceback

# Import database models
from models.enhanced_strategy_models import (
    OnboardingDataIntegration
)
from models.onboarding import (
    OnboardingSession,
    WebsiteAnalysis,
    ResearchPreferences,
    APIKey,
    PersonaData,
    CompetitorAnalysis,
    SEOPageAudit,
    PlatformIntegration,
)
from models.website_analysis_monitoring_models import (
    DeepCompetitorAnalysisTask,
    DeepCompetitorAnalysisExecutionLog
)
import os

logger = get_service_logger("onboarding.data_integration")


class OnboardingDataIntegrationError(Exception):
    """Raised when the onboarding data integration pipeline fails.

    Used in place of a silent empty-dict / zero-score fallback. The
    integration surface touches every downstream strategy-analysis
    step (autofill, gap analysis, AI recommendations, calendar
    generation) and a fabricated or empty integrated_data result
    would propagate through the system as if real data had been
    processed -- producing strategies with 0.0 quality scores and
    empty canonical profiles that the user could mistake for a
    real, low-quality integration. Fail fast and let the caller
    decide how to surface the error.
    """


class OnboardingDataIntegrationService:
    """Service for onboarding data integration and processing."""

    def __init__(self):
        self.data_freshness_threshold = timedelta(hours=24)
        self.max_analysis_age = timedelta(days=7)

    def get_integrated_data_sync(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Synchronous version of process_onboarding_data for sync contexts.
           Note: Does not include async data sources like GSC/Bing analytics.
        """
        try:
            # Get all onboarding data sources (DB only)
            website_analysis = self._get_website_analysis(user_id, db)
            research_preferences = self._get_research_preferences(user_id, db)
            api_keys_data = self._get_api_keys_data(user_id, db)
            onboarding_session = self._get_onboarding_session(user_id, db)
            persona_data = self._get_persona_data(user_id, db)
            competitor_analysis = self._get_competitor_analysis(user_id, db)
            deep_competitor_analysis = self._get_deep_competitor_analysis(user_id, db)
            
            # Skip async sources
            gsc_analytics = {}
            bing_analytics = {}

            # Use stored canonical profile when available (avoids redundant recomputation)
            existing_record = db.query(OnboardingDataIntegration).filter(
                OnboardingDataIntegration.user_id == user_id
            ).first()
            if existing_record and existing_record.canonical_profile:
                canonical_profile = existing_record.canonical_profile
            else:
                canonical_profile = self._build_canonical_profile(
                    website_analysis,
                    research_preferences,
                    persona_data,
                    onboarding_session,
                    competitor_analysis,
                    deep_competitor_analysis
                )

            platform_integrations = self._get_platform_integrations(user_id, db)

            data_quality = self._assess_data_quality(website_analysis, research_preferences, api_keys_data, persona_data, competitor_analysis, gsc_analytics, bing_analytics)

            integrated_data = {
                'website_analysis': website_analysis,
                'research_preferences': research_preferences,
                'api_keys_data': api_keys_data,
                'onboarding_session': onboarding_session,
                'persona_data': persona_data,
                'competitor_analysis': competitor_analysis,
                'deep_competitor_analysis': deep_competitor_analysis,
                'platform_integrations': platform_integrations,
                'gsc_analytics': gsc_analytics,
                'bing_analytics': bing_analytics,
                'canonical_profile': canonical_profile,
                'data_quality': data_quality,
                'processing_timestamp': datetime.utcnow().isoformat()
            }

            # ── Structured data integration summary ──
            step1_keys = api_keys_data.get('total_keys', 0) if api_keys_data else 0
            step1_providers = api_keys_data.get('providers', []) if api_keys_data else []
            step2_url = website_analysis.get('website_url', '') if website_analysis else ''
            step3_depth = research_preferences.get('research_depth', '') if research_preferences else ''
            step3_ct = research_preferences.get('content_types', []) if research_preferences else []
            comp_count = len(competitor_analysis) if competitor_analysis else 0
            deep_comp_status = deep_competitor_analysis.get('status', 'not_scheduled') if deep_competitor_analysis else 'unknown'
            persona_core = bool(persona_data.get('core_persona')) if persona_data else False
            platforms = platform_integrations.get('connected_platforms', []) if platform_integrations else []
            dq = data_quality or {}

            lines = [
                f"[DataIntegration] ✅ Data status for user {user_id}:",
                f"   ├─ Step 1 (API Keys):    {'✓' if step1_keys else '—'} {step1_keys} provider(s) {step1_providers if step1_providers else ''}".rstrip(),
                f"   ├─ Step 2 (Website):     {'✓' if step2_url else '—'} {step2_url or 'no data'}".rstrip(),
                f"   ├─ Step 3 (Research):    {'✓' if step3_depth else '—'} depth={step3_depth or 'none'}, types={len(step3_ct) if step3_ct else 0}".rstrip(),
                f"   ├─ Step 3 (Competitors): {'✓' if comp_count else '—'} {comp_count} competitor(s), deep={deep_comp_status}".rstrip(),
                f"   ├─ Step 4 (Persona):     {'✓' if persona_core else '—'}{' core_persona present' if persona_core else ' no persona data'}".rstrip(),
                f"   ├─ Step 5 (Integrations):{'✓' if platforms else '—'} {platforms if platforms else 'no platforms'}".rstrip(),
                f"   ├─ Canonical Profile:    {'✓' if canonical_profile.get('industry') else '—'} industry={canonical_profile.get('industry', 'none')}".rstrip(),
                f"   └─ Data Quality:         completeness={dq.get('completeness', 0):.2f}, freshness={dq.get('freshness', 0):.2f}, overall={dq.get('overall_score', 0):.2f}".rstrip(),
            ]
            logger.info('\n'.join(lines))

            return integrated_data

        except Exception as e:
            logger.error(f"Error processing onboarding data (sync) for user {user_id}: {str(e)}")
            logger.error("Traceback:\n%s", traceback.format_exc())
            raise OnboardingDataIntegrationError(
                f"Onboarding data integration failed for user {user_id}: {str(e)}"
            ) from e

    async def refresh_integrated_data(self, user_id: str, db: Session) -> None:
        """
        Refresh and store integrated data (DB-only sources) to ensure SSOT is up-to-date.
        This is a lightweight version of process_onboarding_data suitable for calling
        after individual step completion.
        """
        try:
            # Re-use sync logic but await the storage
            integrated_data = self.get_integrated_data_sync(user_id, db)
            await self._store_integrated_data(user_id, integrated_data, db)
            logger.info(f"Refreshed integrated data (SSOT) for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to refresh integrated data for user {user_id}: {e}")
            # Non-blocking failure

    async def store_competitive_sitemap_benchmarking(self, user_id: str, report: Dict[str, Any], db: Session) -> bool:
        try:
            if not user_id:
                return False
            if not isinstance(report, dict):
                return False

            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()

            if not session:
                return False

            website_analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).order_by(WebsiteAnalysis.updated_at.desc()).first()

            if not website_analysis:
                return False

            existing = website_analysis.seo_audit if isinstance(website_analysis.seo_audit, dict) else {}
            existing["competitive_sitemap_benchmarking"] = report
            website_analysis.seo_audit = existing
            website_analysis.updated_at = datetime.utcnow()
            
            # Use flag_modified to ensure JSON update is detected by SQLAlchemy
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(website_analysis, "seo_audit")
            
            db.commit()

            try:
                await self.refresh_integrated_data(user_id, db)
            except Exception:
                pass

            return True
        except Exception as e:
            logger.error(f"Failed to store competitive sitemap benchmarking for user {user_id}: {e}")
            db.rollback()
            return False

    async def update_competitive_sitemap_benchmarking_status(self, user_id: str, status: str, db: Session, error: Optional[str] = None) -> bool:
        """Update the status of the competitive sitemap benchmarking task."""
        try:
            if not user_id:
                return False

            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()

            if not session:
                return False

            website_analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).order_by(WebsiteAnalysis.updated_at.desc()).first()

            if not website_analysis:
                return False

            existing = website_analysis.seo_audit if isinstance(website_analysis.seo_audit, dict) else {}
            
            # Get existing benchmarking data or initialize
            benchmarking = existing.get("competitive_sitemap_benchmarking", {})
            if not isinstance(benchmarking, dict):
                benchmarking = {}
            
            benchmarking["status"] = status
            if error:
                benchmarking["error"] = error
            if status == "processing":
                benchmarking["started_at"] = datetime.utcnow().isoformat()
            
            existing["competitive_sitemap_benchmarking"] = benchmarking
            website_analysis.seo_audit = existing
            # Force update flag if needed, but assignment should trigger it
            website_analysis.updated_at = datetime.utcnow()
            
            # Use flag_modified if using JSON type with SQLAlchemy to ensure update
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(website_analysis, "seo_audit")
            
            db.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to update competitive sitemap benchmarking status for user {user_id}: {e}")
            if db:
                db.rollback()
            return False

    async def process_onboarding_data(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Process and integrate all onboarding data for a user.
        
        Args:
            user_id: Clerk user ID (string format, e.g., 'user_xxx')
            db: Database session
        """
        try:
            logger.info(f"Processing onboarding data for user: {user_id}")

            # Get all onboarding data sources
            website_analysis = self._get_website_analysis(user_id, db)
            research_preferences = self._get_research_preferences(user_id, db)
            api_keys_data = self._get_api_keys_data(user_id, db)
            onboarding_session = self._get_onboarding_session(user_id, db)
            persona_data = self._get_persona_data(user_id, db)
            competitor_analysis = self._get_competitor_analysis(user_id, db)
            deep_competitor_analysis = self._get_deep_competitor_analysis(user_id, db)
            gsc_analytics = await self._get_gsc_analytics(user_id)
            bing_analytics = await self._get_bing_analytics(user_id)

            # Log data source status
            logger.info(f"Data source status for user {user_id}:")
            logger.info(f"  - Website analysis: {'✅ Found' if website_analysis else '❌ Missing'}")
            logger.info(f"  - Research preferences: {'✅ Found' if research_preferences else '❌ Missing'}")
            logger.info(f"  - API keys data: {'✅ Found' if api_keys_data else '❌ Missing'}")
            logger.info(f"  - Onboarding session: {'✅ Found' if onboarding_session else '❌ Missing'}")
            logger.info(f"  - Persona data: {'✅ Found' if persona_data else '❌ Missing'}")
            logger.info(f"  - Competitor analysis: {'✅ Found' if competitor_analysis else '❌ Missing'}")
            logger.info(f"  - GSC Analytics: {'✅ Found' if gsc_analytics else '❌ Missing'}")
            logger.info(f"  - Bing Analytics: {'✅ Found' if bing_analytics else '❌ Missing'}")

            canonical_profile = self._build_canonical_profile(
                website_analysis,
                research_preferences,
                persona_data,
                onboarding_session,
                competitor_analysis,
                deep_competitor_analysis
            )

            integrated_data = {
                'website_analysis': website_analysis,
                'research_preferences': research_preferences,
                'api_keys_data': api_keys_data,
                'onboarding_session': onboarding_session,
                'persona_data': persona_data,
                'competitor_analysis': competitor_analysis,
                'deep_competitor_analysis': deep_competitor_analysis,
                'gsc_analytics': gsc_analytics,
                'bing_analytics': bing_analytics,
                'canonical_profile': canonical_profile,
                'data_quality': self._assess_data_quality(website_analysis, research_preferences, api_keys_data, persona_data, competitor_analysis, gsc_analytics, bing_analytics),
                'processing_timestamp': datetime.utcnow().isoformat()
            }

            # Log data quality assessment
            data_quality = integrated_data['data_quality']
            logger.info(f"Data quality assessment for user {user_id}:")
            logger.info(f"  - Completeness: {data_quality.get('completeness', 0):.2f}")
            logger.info(f"  - Freshness: {data_quality.get('freshness', 0):.2f}")
            logger.info(f"  - Relevance: {data_quality.get('relevance', 0):.2f}")
            logger.info(f"  - Confidence: {data_quality.get('confidence', 0):.2f}")

            # Store integrated data
            await self._store_integrated_data(user_id, integrated_data, db)

            logger.info(f"Onboarding data processed successfully for user: {user_id}")
            return integrated_data

        except Exception as e:
            logger.error(f"Error processing onboarding data for user {user_id}: {str(e)}")
            logger.error("Traceback:\n%s", traceback.format_exc())
            raise OnboardingDataIntegrationError(
                f"Onboarding data integration failed for user {user_id}: {str(e)}"
            ) from e

    def _get_website_analysis(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Get website analysis data for the user."""
        try:
            # Get the latest onboarding session for the user
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()
            
            if not session:
                logger.info(f"No onboarding session found for user {user_id}")
                return {}
            
            # Get the latest website analysis for this session
            website_analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).order_by(WebsiteAnalysis.updated_at.desc()).first()
            
            if not website_analysis:
                logger.info(f"No website analysis found for user {user_id}")
                return {}
            
            # Convert to dictionary and add metadata
            analysis_data = website_analysis.to_dict()
            analysis_data['data_freshness'] = self._calculate_freshness(website_analysis.updated_at)
            analysis_data['confidence_level'] = 0.9 if website_analysis.status == 'completed' else 0.5

            site_url = website_analysis.website_url
            if site_url:
                analysis_data["full_site_seo_summary"] = self._get_full_site_seo_summary(user_id, site_url, db)
            
            logger.info(f"Retrieved website analysis for user {user_id}: {website_analysis.website_url}")
            return analysis_data

        except Exception as e:
            logger.error(f"Error getting website analysis for user {user_id}: {str(e)}")
            return {}

    def _get_full_site_seo_summary(self, user_id: str, website_url: str, db: Session) -> Dict[str, Any]:
        try:
            rows = db.query(SEOPageAudit).filter(
                SEOPageAudit.user_id == user_id,
                SEOPageAudit.website_url == website_url
            ).all()

            if not rows:
                return {}

            scored = [r for r in rows if r.overall_score is not None]
            scores = [int(r.overall_score) for r in scored if isinstance(r.overall_score, (int, float))]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0

            fix_scheduled_count = len([r for r in scored if (r.status or "").lower() == "fix_scheduled"])

            worst = sorted(scored, key=lambda r: r.overall_score if r.overall_score is not None else 10**9)[:5]
            worst_pages = [{"page_url": r.page_url, "overall_score": r.overall_score, "status": r.status} for r in worst]

            return {
                "pages_audited": len(rows),
                "pages_scored": len(scored),
                "avg_score": avg_score,
                "fix_scheduled_pages": fix_scheduled_count,
                "worst_pages": worst_pages
            }
        except Exception as e:
            logger.error(f"Error building full-site SEO summary for user {user_id}: {str(e)}")
            return {}

    def _get_research_preferences(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Get research preferences data for the user."""
        try:
            # Get the latest onboarding session for the user
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()
            
            if not session:
                logger.info(f"No onboarding session found for user {user_id}")
                return {}
            
            # Get research preferences for this session
            research_prefs = db.query(ResearchPreferences).filter(
                ResearchPreferences.session_id == session.id
            ).first()
            
            if not research_prefs:
                logger.info(f"No research preferences found for user {user_id}")
                return {}
            
            # Convert to dictionary and add metadata
            prefs_data = research_prefs.to_dict()
            prefs_data['data_freshness'] = self._calculate_freshness(research_prefs.updated_at)
            prefs_data['confidence_level'] = 0.9
            
            logger.info(f"Retrieved research preferences for user {user_id}")
            return prefs_data

        except Exception as e:
            logger.error(f"Error getting research preferences for user {user_id}: {str(e)}")
            return {}

    def _get_api_keys_data(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Get API keys data for the user."""
        try:
            # Get the latest onboarding session for the user
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()
            
            if not session:
                logger.info(f"No onboarding session found for user {user_id}")
                return {}
            
            # Get all API keys for this session
            api_keys = db.query(APIKey).filter(
                APIKey.session_id == session.id
            ).all()
            
            if not api_keys:
                logger.info(f"No API keys found for user {user_id}")
                return {}
            
            # Convert to dictionary format
            api_data = {
                'api_keys': [key.to_dict() for key in api_keys],
                'total_keys': len(api_keys),
                'providers': [key.provider for key in api_keys],
                'data_freshness': self._calculate_freshness(session.updated_at),
                'confidence_level': 0.8
            }
            
            logger.info(f"Retrieved {len(api_keys)} API keys for user {user_id}")
            return api_data

        except Exception as e:
            logger.error(f"Error getting API keys data for user {user_id}: {str(e)}")
            return {}

    def _get_onboarding_session(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Get onboarding session data for the user."""
        try:
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()
            
            if not session:
                logger.info(f"No onboarding session found for user {user_id}")
                return {}
            
            session_data = {
                'id': session.id,
                'user_id': session.user_id,
                'current_step': session.current_step,
                'progress': session.progress,
                'started_at': session.started_at.isoformat() if session.started_at else None,
                'updated_at': session.updated_at.isoformat() if session.updated_at else None,
                'data_freshness': self._calculate_freshness(session.updated_at),
                'confidence_level': 0.9
            }
            
            logger.info(f"Retrieved onboarding session for user {user_id}: step {session.current_step}, progress {session.progress}%")
            return session_data
            
        except Exception as e:
            logger.error(f"Error getting onboarding session for user {user_id}: {str(e)}")
            return {}

    def _build_canonical_profile(
        self,
        website_analysis: Dict[str, Any],
        research_preferences: Dict[str, Any],
        persona_data: Dict[str, Any],
        onboarding_session: Dict[str, Any],
        competitor_analysis: List[Dict[str, Any]],
        deep_competitor_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        try:
            core_persona = None
            if persona_data:
                if isinstance(persona_data, dict):
                    core_persona = persona_data.get('corePersona') or persona_data.get('core_persona')

            website_target = {}
            if website_analysis and isinstance(website_analysis, dict):
                value = website_analysis.get('target_audience') or {}
                if isinstance(value, dict):
                    website_target = value

            research_target = {}
            if research_preferences and isinstance(research_preferences, dict):
                value = research_preferences.get('target_audience') or {}
                if isinstance(value, dict):
                    research_target = value

            industry = None
            if core_persona and isinstance(core_persona, dict):
                value = core_persona.get('industry')
                if value:
                    industry = value
            if not industry and website_target:
                value = website_target.get('industry_focus')
                if value:
                    industry = value
            if not industry and research_target:
                value = research_target.get('industry_focus')
                if value:
                    industry = value

            target_audience = None
            target_source = None
            if core_persona and isinstance(core_persona, dict):
                value = core_persona.get('target_audience')
                if value:
                    target_audience = value
                    target_source = 'persona_core'
            if not target_audience and website_target:
                value = website_target.get('demographics') or website_target.get('target_audience')
                if value:
                    target_audience = value
                    target_source = 'website_analysis'
            if not target_audience and research_target:
                value = research_target.get('demographics') or research_target.get('target_audience')
                if value:
                    target_audience = value
                    target_source = 'research_preferences'

            writing_style = {}
            if website_analysis and isinstance(website_analysis, dict):
                value = website_analysis.get('writing_style')
                if isinstance(value, dict):
                    writing_style = value
            if not writing_style and research_preferences and isinstance(research_preferences, dict):
                value = research_preferences.get('writing_style')
                if isinstance(value, dict):
                    writing_style = value

            writing_tone = None
            writing_voice = None
            writing_complexity = None
            writing_engagement = None
            writing_source = None
            if writing_style:
                value = writing_style.get('tone')
                if value:
                    writing_tone = value
                
                value = writing_style.get('voice')
                if value:
                    writing_voice = value

                value = writing_style.get('complexity')
                if value:
                    writing_complexity = value

                value = writing_style.get('engagement_level')
                if value:
                    writing_engagement = value

                if website_analysis and website_analysis.get('writing_style'):
                    writing_source = 'website_analysis'
                elif research_preferences and research_preferences.get('writing_style'):
                    writing_source = 'research_preferences'

            # Brand & Visual Identity
            brand_colors = []
            brand_values = []
            visual_style = {}
            brand_source = None
            
            if website_analysis and isinstance(website_analysis, dict):
                brand_analysis = website_analysis.get('brand_analysis', {})
                if brand_analysis:
                    brand_colors = brand_analysis.get('color_palette', [])
                    brand_values = brand_analysis.get('brand_values', [])
                    brand_source = 'website_analysis'
                
                style_guidelines = website_analysis.get('style_guidelines', {})
                if style_guidelines:
                    visual_style = {
                        'aesthetic': style_guidelines.get('aesthetic'),
                        'visual_style': style_guidelines.get('visual_style')
                    }

            # Content Strategy Insights
            strategy_insights = {}
            if website_analysis and isinstance(website_analysis, dict):
                strategy_insights = website_analysis.get('content_strategy_insights', {})

            seo_profile: Dict[str, Any] = {}
            if website_analysis and isinstance(website_analysis, dict):
                seo_profile["homepage_seo_audit"] = website_analysis.get("seo_audit") or {}
                seo_profile["full_site_seo_summary"] = website_analysis.get("full_site_seo_summary") or {}
                sitemap_strategy = website_analysis.get("sitemap_strategy_insights")
                if sitemap_strategy:
                    seo_profile["sitemap_strategy_insights"] = sitemap_strategy

            competitor_seo_benchmarks = self._build_competitor_seo_benchmarks(competitor_analysis)
            if competitor_seo_benchmarks:
                seo_profile["competitor_seo_benchmarks"] = competitor_seo_benchmarks

            # Platform Preferences
            platform_preferences = []
            platform_source = None
            
            if core_persona and isinstance(core_persona, dict):
                # Check persona_data for platforms
                if isinstance(persona_data, dict):
                    selected = persona_data.get('selectedPlatforms')
                    if selected:
                        platform_preferences = selected
                        platform_source = 'persona_data'
                    else:
                        platform_personas = persona_data.get('platformPersonas')
                        if platform_personas:
                            platform_preferences = list(platform_personas.keys())
                            platform_source = 'persona_data'

            content_types = []
            content_source = None
            if research_preferences and isinstance(research_preferences, dict):
                prefs_content = research_preferences.get('content_types')
                if isinstance(prefs_content, list):
                    content_types = list(prefs_content)
                    if content_types:
                        content_source = 'research_preferences'
            if not content_types and website_analysis and isinstance(website_analysis, dict):
                content_type_data = website_analysis.get('content_type') or {}
                if isinstance(content_type_data, dict):
                    primary = content_type_data.get('primary_type')
                    if primary:
                        content_types.append(primary)
                    secondary = content_type_data.get('secondary_types')
                    if isinstance(secondary, list):
                        content_types.extend(secondary)
                    if content_types:
                        content_source = 'website_analysis'

            research_depth = None
            auto_research = None
            factual_content = None
            if research_preferences and isinstance(research_preferences, dict):
                research_depth = research_preferences.get('research_depth')
                auto_research = research_preferences.get('auto_research')
                factual_content = research_preferences.get('factual_content')

            business_info = {}
            if industry:
                business_info['industry'] = industry
            if target_audience:
                business_info['target_audience'] = target_audience

            sources = {
                'industry': None,
                'target_audience': target_source,
                'writing_tone': writing_source,
                'content_types': content_source,
                'brand_identity': brand_source,
                'platform_preferences': platform_source,
                'seo_profile': 'website_analysis' if website_analysis else None
            }
            if core_persona and isinstance(core_persona, dict) and core_persona.get('industry'):
                sources['industry'] = 'persona_core'
            elif website_target.get('industry_focus'):
                sources['industry'] = 'website_analysis'
            elif research_target.get('industry_focus'):
                sources['industry'] = 'research_preferences'

            competitive_sitemap_benchmarking = {}
            try:
                if website_analysis and isinstance(website_analysis, dict):
                    seo_audit = website_analysis.get("seo_audit")
                    if isinstance(seo_audit, dict):
                        report = seo_audit.get("competitive_sitemap_benchmarking")
                        if isinstance(report, dict):
                            benchmark = report.get("benchmark") if isinstance(report.get("benchmark"), dict) else {}
                            gaps = benchmark.get("gaps") if isinstance(benchmark.get("gaps"), dict) else {}
                            missing_sections = gaps.get("missing_sections") if isinstance(gaps.get("missing_sections"), list) else []
                            competitive_sitemap_benchmarking = {
                                "status": "available",
                                "last_run": report.get("timestamp") or report.get("analysis_date"),
                                "competitors_analyzed": benchmark.get("competitors_analyzed"),
                                "missing_sections_count": len(missing_sections)
                            }
            except Exception:
                competitive_sitemap_benchmarking = {}

            competitive_intelligence = {
                'deep_competitor_analysis': deep_competitor_analysis or {},
                'competitive_sitemap_benchmarking': competitive_sitemap_benchmarking,
                'strategic_insights_history': website_analysis.get("strategic_insights_history", []) if isinstance(website_analysis, dict) else []
            }

            return {
                'industry': industry,
                'target_audience': target_audience,
                'writing_tone': writing_tone,
                'writing_voice': writing_voice,
                'writing_complexity': writing_complexity,
                'writing_engagement': writing_engagement,
                'content_types': content_types,
                'brand_colors': brand_colors,
                'brand_values': brand_values,
                'visual_style': visual_style,
                'strategy_insights': strategy_insights,
                'seo_profile': seo_profile,
                'competitive_intelligence': competitive_intelligence,
                'platform_preferences': platform_preferences,
                'research_depth': research_depth,
                'auto_research': auto_research,
                'factual_content': factual_content,
                'business_info': business_info,
                'sources': sources
            }
        except Exception as e:
            logger.error(f"Error building canonical profile: {str(e)}")
            return {}

    def _build_competitor_seo_benchmarks(self, competitor_analysis: List[Dict[str, Any]]) -> Dict[str, Any]:
        try:
            if not competitor_analysis:
                return {}

            rows = []
            for comp in competitor_analysis:
                analysis_data = comp.get("analysis_data") if isinstance(comp, dict) else None
                if not isinstance(analysis_data, dict):
                    continue
                seo_audit = analysis_data.get("seo_audit")
                if not isinstance(seo_audit, dict):
                    continue
                score = seo_audit.get("overall_score")
                if score is None:
                    continue
                rows.append({
                    "competitor_url": comp.get("competitor_url") or comp.get("url") or comp.get("website_url"),
                    "competitor_domain": comp.get("competitor_domain") or comp.get("domain"),
                    "overall_score": score,
                    "last_analyzed_at": comp.get("updated_at") or comp.get("analysis_date")
                })

            if not rows:
                return {}

            scores = [r["overall_score"] for r in rows if isinstance(r.get("overall_score"), (int, float))]
            avg_score = round(sum(scores) / len(scores), 1) if scores else None

            best = max(rows, key=lambda r: r.get("overall_score") or 0)
            worst = min(rows, key=lambda r: r.get("overall_score") or 0)

            return {
                "competitors_with_seo_audit": len(rows),
                "avg_homepage_seo_score": avg_score,
                "best_competitor": best,
                "worst_competitor": worst
            }
        except Exception as e:
            logger.error(f"Error building competitor SEO benchmarks: {str(e)}")
            return {}

    def _assess_data_quality(self, website_analysis: Dict, research_preferences: Dict, api_keys_data: Dict, persona_data: Dict = None, competitor_analysis: List = None, gsc_analytics: Dict = None, bing_analytics: Dict = None) -> Dict[str, Any]:
        """Assess the quality and completeness of onboarding data."""
        try:
            quality_metrics = {
                'overall_score': 0.0,
                'completeness': 0.0,
                'freshness': 0.0,
                'relevance': 0.0,
                'confidence': 0.0
            }

            # Calculate completeness
            total_fields = 0
            filled_fields = 0

            # Website analysis completeness
            website_fields = ['domain', 'industry', 'business_type', 'target_audience', 'content_goals']
            for field in website_fields:
                total_fields += 1
                if website_analysis.get(field):
                    filled_fields += 1

            # Research preferences completeness
            research_fields = ['research_topics', 'content_types', 'target_audience', 'industry_focus']
            for field in research_fields:
                total_fields += 1
                if research_preferences.get(field):
                    filled_fields += 1

            # API keys completeness
            total_fields += 1
            if api_keys_data:
                filled_fields += 1

            # Persona data completeness
            total_fields += 1
            if persona_data and persona_data.get('core_persona'):
                filled_fields += 1

            # Competitor analysis completeness
            total_fields += 1
            if competitor_analysis and len(competitor_analysis) > 0:
                filled_fields += 1

            # GSC analytics completeness
            total_fields += 1
            if gsc_analytics and (gsc_analytics.get('data') or gsc_analytics.get('metrics')):
                filled_fields += 1

            # Bing analytics completeness
            total_fields += 1
            if bing_analytics and (bing_analytics.get('data') or bing_analytics.get('summary')):
                filled_fields += 1

            quality_metrics['completeness'] = filled_fields / total_fields if total_fields > 0 else 0.0

            # Calculate freshness
            freshness_scores = []
            for data_source in [website_analysis, research_preferences]:
                if data_source.get('data_freshness'):
                    freshness_scores.append(data_source['data_freshness'])
            if persona_data and persona_data.get('data_freshness'):
                freshness_scores.append(persona_data['data_freshness'])
            if competitor_analysis:
                for competitor in competitor_analysis:
                    if competitor.get('data_freshness'):
                        freshness_scores.append(competitor['data_freshness'])
                        break  # Just use first competitor's freshness
            if gsc_analytics and gsc_analytics.get('data_freshness'):
                freshness_scores.append(gsc_analytics['data_freshness'])
            if bing_analytics and bing_analytics.get('data_freshness'):
                freshness_scores.append(bing_analytics['data_freshness'])
            
            quality_metrics['freshness'] = sum(freshness_scores) / len(freshness_scores) if freshness_scores else 0.0

            # Calculate relevance (based on data presence and quality)
            relevance_score = 0.0
            if website_analysis.get('domain'):
                relevance_score += 0.20
            if research_preferences.get('research_topics'):
                relevance_score += 0.15
            if api_keys_data:
                relevance_score += 0.10
            if persona_data and persona_data.get('core_persona'):
                relevance_score += 0.15
            if competitor_analysis and len(competitor_analysis) > 0:
                relevance_score += 0.15
            if gsc_analytics and (gsc_analytics.get('data') or gsc_analytics.get('metrics')):
                relevance_score += 0.15  # Real analytics data is highly relevant
            if bing_analytics and (bing_analytics.get('data') or bing_analytics.get('summary')):
                relevance_score += 0.10  # Real analytics data is highly relevant
            
            quality_metrics['relevance'] = relevance_score

            # Calculate confidence
            quality_metrics['confidence'] = (quality_metrics['completeness'] + quality_metrics['freshness'] + quality_metrics['relevance']) / 3

            # Calculate overall score
            quality_metrics['overall_score'] = quality_metrics['confidence']

            return quality_metrics

        except Exception as e:
            logger.error(f"Error assessing data quality: {str(e)}")
            return {
                'overall_score': 0.0,
                'completeness': 0.0,
                'freshness': 0.0,
                'relevance': 0.0,
                'confidence': 0.0
            }

    def _calculate_freshness(self, created_at: datetime) -> float:
        """Calculate data freshness score (0.0 to 1.0)."""
        try:
            age = datetime.utcnow() - created_at
            
            if age <= self.data_freshness_threshold:
                return 1.0
            elif age <= self.max_analysis_age:
                # Linear decay from 1.0 to 0.5
                decay_factor = 1.0 - (age - self.data_freshness_threshold) / (self.max_analysis_age - self.data_freshness_threshold) * 0.5
                return max(0.5, decay_factor)
            else:
                return 0.5  # Minimum freshness for old data
                
        except Exception as e:
            logger.error(f"Error calculating data freshness: {str(e)}")
            return 0.5

    def _check_api_data_availability(self, api_key_data: Dict) -> bool:
        """Check if API key has available data."""
        try:
            # Check if API key has been used recently and has data
            if api_key_data.get('last_used') and api_key_data.get('usage_count', 0) > 0:
                return api_key_data.get('data_available', False)
            return False
            
        except Exception as e:
            logger.error(f"Error checking API data availability: {str(e)}")
            return False

    async def _store_integrated_data(self, user_id: str, integrated_data: Dict[str, Any], db: Session) -> None:
        """Store integrated onboarding data."""
        try:
            # Create or update integrated data record
            existing_record = db.query(OnboardingDataIntegration).filter(
                OnboardingDataIntegration.user_id == user_id
            ).first()

            cp = integrated_data.get('canonical_profile')

            if existing_record:
                existing_record.website_analysis_data = integrated_data.get('website_analysis', {})
                existing_record.research_preferences_data = integrated_data.get('research_preferences', {})
                existing_record.api_keys_data = integrated_data.get('api_keys_data', {})
                existing_record.canonical_profile = cp
                existing_record.updated_at = datetime.utcnow()
            else:
                new_kwargs = {
                    'user_id': user_id,
                    'website_analysis_data': integrated_data.get('website_analysis', {}),
                    'research_preferences_data': integrated_data.get('research_preferences', {}),
                    'api_keys_data': integrated_data.get('api_keys_data', {}),
                    'canonical_profile': cp,
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
                new_record = OnboardingDataIntegration(**new_kwargs)
                db.add(new_record)

            db.commit()
            logger.info(f"Integrated onboarding data stored for user: {user_id}")

        except Exception as e:
            logger.error(f"Error storing integrated data for user {user_id}: {str(e)}")
            db.rollback()
            # Soft-fail storage: do not break the refresh path
            return

    def _get_persona_data(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Get persona data for the user."""
        try:
            # Get the latest onboarding session for the user
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()
            
            if not session:
                return {}
            
            # Get persona data for this session
            persona = db.query(PersonaData).filter(
                PersonaData.session_id == session.id
            ).first()
            
            if not persona:
                logger.info(f"[Persona] No persona data found for user {user_id}")
                return {}
            
            # Convert to dictionary and add metadata
            persona_dict = persona.to_dict()
            persona_dict['data_freshness'] = self._calculate_freshness(persona.updated_at)
            persona_dict['confidence_level'] = 0.9
            
            logger.info(f"Retrieved persona data for user {user_id}")
            return persona_dict

        except Exception as e:
            logger.error(f"Error getting persona data for user {user_id}: {str(e)}")
            return {}

    def _get_competitor_analysis(self, user_id: str, db: Session) -> List[Dict[str, Any]]:
        """Get competitor analysis data for the user."""
        try:
            # Get the latest onboarding session for the user
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()
            
            if not session:
                logger.info(f"[CompetitorAnalysis] No onboarding session found for user {user_id}")
                return []
            
            logger.info(f"[CompetitorAnalysis] user={user_id} session={session.id} (latest)")
            
            # Get all competitor analyses for this session
            competitor_records = db.query(CompetitorAnalysis).filter(
                CompetitorAnalysis.session_id == session.id
            ).order_by(CompetitorAnalysis.updated_at.desc()).all()
            
            if not competitor_records:
                logger.info(f"[CompetitorAnalysis] No competitor records found for user={user_id} session={session.id}")
                return []
            
            logger.info(f"[CompetitorAnalysis] session={session.id} records={len(competitor_records)} user={user_id}")
            
            # Convert to list of dictionaries
            # Use to_dict() which includes competitor_url, competitor_domain, analysis_data
            competitors = []
            for record in competitor_records:
                competitor_dict = record.to_dict()
                # Ensure analysis_data is included (to_dict() should include it)
                if 'analysis_data' not in competitor_dict and record.analysis_data:
                    competitor_dict['analysis_data'] = record.analysis_data
                competitor_dict['data_freshness'] = self._calculate_freshness(record.updated_at)
                competitor_dict['confidence_level'] = 0.9 if record.status == 'completed' else 0.5
                competitors.append(competitor_dict)
            
            logger.info(f"[CompetitorAnalysis] retrieved={len(competitors)} user={user_id}")
            if competitors:
                try:
                    sample = competitors[0]
                    logger.debug(f"[CompetitorAnalysis] sample_keys={list(sample.keys())} has_analysis_data={'analysis_data' in sample}")
                    if isinstance(sample.get('analysis_data'), dict):
                        logger.debug(f"[CompetitorAnalysis] analysis_data_keys={list(sample['analysis_data'].keys())}")
                except Exception:
                    pass
            return competitors

        except Exception as e:
            logger.error(f"Error getting competitor analysis for user {user_id}: {str(e)}")
            return []

    def _get_deep_competitor_analysis(self, user_id: str, db: Session) -> Dict[str, Any]:
        try:
            task = db.query(DeepCompetitorAnalysisTask).filter(
                DeepCompetitorAnalysisTask.user_id == user_id
            ).order_by(DeepCompetitorAnalysisTask.updated_at.desc()).first()

            if not task:
                return {
                    "status": "not_scheduled",
                    "last_run": None,
                    "report": None
                }

            latest_log = db.query(DeepCompetitorAnalysisExecutionLog).filter(
                DeepCompetitorAnalysisExecutionLog.task_id == task.id
            ).order_by(DeepCompetitorAnalysisExecutionLog.execution_date.desc()).first()

            last_run = None
            if latest_log and latest_log.execution_date:
                last_run = latest_log.execution_date.isoformat()

            report = None
            if latest_log and latest_log.status == "success":
                report = latest_log.result_data

            payload = task.payload if isinstance(task.payload, dict) else {}
            competitors = payload.get("competitors") if isinstance(payload, dict) else None

            return {
                "status": task.status,
                "next_execution": task.next_execution.isoformat() if task.next_execution else None,
                "last_run": last_run,
                "last_status": latest_log.status if latest_log else None,
                "competitors_count": len(competitors) if isinstance(competitors, list) else None,
                "report": report
            }
        except Exception as e:
            logger.error(f"Error getting deep competitor analysis for user {user_id}: {str(e)}")
            return {}

    def _get_platform_integrations(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Get platform integrations (Step 5) data for the user."""
        try:
            session = db.query(OnboardingSession).filter(
                OnboardingSession.user_id == user_id
            ).order_by(OnboardingSession.updated_at.desc()).first()

            if not session or not session.platform_integrations:
                return {}

            pi = session.platform_integrations
            return {
                "primary_website": pi.primary_website,
                "website_platforms": pi.website_platforms or {},
                "analytics_platforms": pi.analytics_platforms or {},
                "social_platforms": pi.social_platforms or {},
                "connected_platforms": pi.connected_platforms or [],
                "updated_at": pi.updated_at.isoformat() if pi.updated_at else None,
            }
        except Exception as e:
            logger.error(f"Error getting platform integrations for user {user_id}: {str(e)}")
            return {}

    async def _get_gsc_analytics(self, user_id: str) -> Dict[str, Any]:
        """Get Google Search Console analytics data for the user."""
        try:
            from services.seo.dashboard_service import SEODashboardService
            from services.database import get_db_session
            
            db = get_db_session(user_id)
            try:
                dashboard_service = SEODashboardService(db)
                gsc_data = await dashboard_service.get_gsc_data(user_id)
            finally:
                db.close()
            
            if gsc_data and gsc_data.get('status') != 'disconnected' and not gsc_data.get('error'):
                logger.info(f"Retrieved GSC analytics for user {user_id}")
                return {
                    'data': gsc_data.get('data', {}),
                    'metrics': gsc_data.get('metrics', {}),
                    'date_range': gsc_data.get('date_range', {}),
                    'data_freshness': 1.0,  # GSC data is typically fresh
                    'confidence_level': 0.9
                }
            else:
                logger.warning(f"No GSC analytics found or not connected for user {user_id}")
                return {}
                
        except Exception as e:
            logger.error(f"Error getting GSC analytics for user {user_id}: {str(e)}")
            return {}

    async def _get_bing_analytics(self, user_id: str) -> Dict[str, Any]:
        """Get Bing Webmaster Tools analytics data for the user."""
        try:
            from services.seo.dashboard_service import SEODashboardService
            from services.bing_analytics_storage_service import BingAnalyticsStorageService
            from services.database import get_db_session
            
            db = get_db_session(user_id)
            try:
                dashboard_service = SEODashboardService(db)
                bing_data = await dashboard_service.get_bing_data(user_id)
            finally:
                db.close()
            
            # Also try to get from storage service for more detailed metrics
            from services.database import get_user_db_path
            db_path = get_user_db_path(user_id)
            bing_storage = BingAnalyticsStorageService(f'sqlite:///{db_path}')
            
            # Get site URL from onboarding session if available
            site_url = None
            try:
                from services.database import get_db_session
                with get_db_session(user_id) as db:
                    session = db.query(OnboardingSession).filter(
                        OnboardingSession.user_id == user_id
                    ).order_by(OnboardingSession.updated_at.desc()).first()
                    if session:
                        website_analysis = db.query(WebsiteAnalysis).filter(
                            WebsiteAnalysis.session_id == session.id
                        ).order_by(WebsiteAnalysis.updated_at.desc()).first()
                        if website_analysis:
                            site_url = website_analysis.website_url
            except Exception as e:
                logger.warning(f"Could not get site URL for Bing analytics: {e}")
            
            analytics_summary = {}
            if site_url:
                try:
                    analytics_summary = bing_storage.get_analytics_summary(user_id, site_url, days=30)
                except Exception as e:
                    logger.warning(f"Could not get Bing analytics summary: {e}")
            
            if bing_data and bing_data.get('status') != 'disconnected' and not bing_data.get('error'):
                logger.info(f"Retrieved Bing analytics for user {user_id}")
                return {
                    'data': bing_data.get('data', {}),
                    'metrics': bing_data.get('metrics', {}),
                    'summary': analytics_summary,
                    'date_range': bing_data.get('date_range', {}),
                    'data_freshness': 1.0,  # Bing data is typically fresh
                    'confidence_level': 0.9
                }
            elif analytics_summary and not analytics_summary.get('error'):
                # Use stored analytics if available even if API is disconnected
                logger.info(f"Retrieved Bing analytics from storage for user {user_id}")
                return {
                    'data': {},
                    'metrics': {},
                    'summary': analytics_summary,
                    'date_range': {},
                    'data_freshness': 0.8,  # Stored data might be slightly older
                    'confidence_level': 0.85
                }
            else:
                logger.warning(f"No Bing analytics found or not connected for user {user_id}")
                return {}
                
        except Exception as e:
            logger.error(f"Error getting Bing analytics for user {user_id}: {str(e)}")
            return {}

    async def get_integrated_data(self, user_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """Get previously integrated onboarding data for a user."""
        try:
            record = db.query(OnboardingDataIntegration).filter(
                OnboardingDataIntegration.user_id == user_id
            ).first()

            if record:
                # Reconstruct integrated data from stored fields
                integrated_data = {
                    'website_analysis': record.website_analysis_data or {},
                    'research_preferences': record.research_preferences_data or {},
                    'api_keys_data': record.api_keys_data or {},
                    'onboarding_session': {},
                    'canonical_profile': record.canonical_profile or {},
                    'data_quality': self._assess_data_quality(
                        record.website_analysis_data or {},
                        record.research_preferences_data or {},
                        record.api_keys_data or {}
                    ),
                    'processing_timestamp': record.updated_at.isoformat()
                }

                # Check if data is still fresh
                updated_at = record.updated_at
                if datetime.utcnow() - updated_at <= self.data_freshness_threshold:
                    return integrated_data
                else:
                    logger.info(f"Integrated data is stale for user {user_id}, reprocessing...")
                    return await self.process_onboarding_data(user_id, db)

            return None

        except Exception as e:
            logger.error(f"Error getting integrated data for user {user_id}: {str(e)}")
            return None 

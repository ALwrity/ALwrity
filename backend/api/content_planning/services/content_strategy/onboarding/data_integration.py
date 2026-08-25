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
    PersonaData,
    CompetitorAnalysis,
    SEOPageAudit,
    PlatformIntegration,
)
from models.website_analysis_monitoring_models import (
    DeepCompetitorAnalysisTask,
    DeepCompetitorAnalysisExecutionLog
)
from .canonical_profile_builder import (
    build_canonical_profile,
    build_persona_synthesis,
    build_brand_voice,
    build_competitor_seo_benchmarks,
)
from .data_quality import assess_data_quality
from .analytics_fetchers import fetch_gsc_analytics, fetch_bing_analytics
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

    def get_integrated_data_sync(self, user_id: str, db: Session, force_rebuild: bool = False) -> Dict[str, Any]:
        """Synchronous version of process_onboarding_data for sync contexts.
           Note: Does not include async data sources like GSC/Bing analytics.

           ``force_rebuild=True`` skips the cached canonical_profile so the Brand
           Brain is rebuilt fresh (used right after persona generation).
        """
        try:
            # Get all onboarding data sources (DB only)
            website_analysis = self._get_website_analysis(user_id, db)
            research_preferences = self._get_research_preferences(user_id, db)
            onboarding_session = self._get_onboarding_session(user_id, db)
            persona_data = self._get_persona_data(user_id, db)
            competitor_analysis = self._get_competitor_analysis(user_id, db)
            deep_competitor_analysis = self._get_deep_competitor_analysis(user_id, db)
            linkedin_profile = self._get_linkedin_profile_info(user_id)
            
            # Skip async sources
            gsc_analytics = {}
            bing_analytics = {}

            # Use stored canonical profile when available AND fresh (TTL), unless a
            # rebuild is explicitly requested (e.g. right after persona generation).
            existing_record = db.query(OnboardingDataIntegration).filter(
                OnboardingDataIntegration.user_id == user_id
            ).first()
            canonical_profile = None
            if not force_rebuild and existing_record and existing_record.canonical_profile:
                updated_at = existing_record.updated_at
                if updated_at is None or (datetime.utcnow() - updated_at) <= self.data_freshness_threshold:
                    canonical_profile = existing_record.canonical_profile
            if canonical_profile is None:
                canonical_profile = self._build_canonical_profile(
                    website_analysis,
                    research_preferences,
                    persona_data,
                    onboarding_session,
                    competitor_analysis,
                    deep_competitor_analysis,
                    linkedin_profile,
                )

            platform_integrations = self._get_platform_integrations(user_id, db)

            data_quality = self._assess_data_quality(website_analysis, research_preferences, persona_data, competitor_analysis, gsc_analytics, bing_analytics)

            integrated_data = {
                'website_analysis': website_analysis,
                'research_preferences': research_preferences,
                'onboarding_session': onboarding_session,
                'persona_data': persona_data,
                'competitor_analysis': competitor_analysis,
                'deep_competitor_analysis': deep_competitor_analysis,
                'linkedin_profile': linkedin_profile,
                'platform_integrations': platform_integrations,
                'gsc_analytics': gsc_analytics,
                'bing_analytics': bing_analytics,
                'canonical_profile': canonical_profile,
                'data_quality': data_quality,
                'processing_timestamp': datetime.utcnow().isoformat()
            }

            # ── Structured data integration summary ──
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
                f"   ├─ Step 1 (Connect):     {'✓' if step2_url else '—'} {step2_url or 'no data'}".rstrip(),
                f"   ├─ Step 2 (Research):    {'✓' if step3_depth else '—'} depth={step3_depth or 'none'}, types={len(step3_ct) if step3_ct else 0}".rstrip(),
                f"   ├─ Step 2 (Competitors): {'✓' if comp_count else '—'} {comp_count} competitor(s), deep={deep_comp_status}".rstrip(),
                f"   ├─ Step 3 (Persona):     {'✓' if persona_core else '—'}{' core_persona present' if persona_core else ' no persona data'}".rstrip(),
                f"   ├─ Connected platforms:  {'✓' if platforms else '—'} {platforms if platforms else 'no platforms'}".rstrip(),
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
        Force-rebuilds the canonical_profile (never re-caches a stale copy), so callers
        can invoke this after a source change (e.g. persona generation) to refresh the
        Brand Brain.
        """
        try:
            # Re-use sync logic but force a fresh canonical_profile rebuild, then store.
            integrated_data = self.get_integrated_data_sync(user_id, db, force_rebuild=True)
            self._store_integrated_data(user_id, integrated_data, db)
            logger.info(f"Refreshed integrated data (SSOT) for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to refresh integrated data for user {user_id}: {e}")
            # Non-blocking failure

    def refresh_integrated_data_sync(self, user_id: str, db: Session) -> None:
        """Synchronous force-rebuild + store, for sync callers (e.g. persona save).

        Same behavior as ``refresh_integrated_data`` but callable without an
        event loop. Used from ``step4_persona_routes._save_persona_data`` so the
        Brand Brain rebuilds in the same choke point that persists the persona.
        """
        try:
            integrated_data = self.get_integrated_data_sync(user_id, db, force_rebuild=True)
            self._store_integrated_data(user_id, integrated_data, db)
            logger.info(f"Refreshed integrated data (SSOT, sync) for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to refresh integrated data (sync) for user {user_id}: {e}")
            # Best-effort: never fail the caller (persona save) on a refresh error.

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
            logger.info(f"  - Onboarding session: {'✅ Found' if onboarding_session else '❌ Missing'}")
            logger.info(f"  - Persona data: {'✅ Found' if persona_data else '❌ Missing'}")
            logger.info(f"  - Competitor analysis: {'✅ Found' if competitor_analysis else '❌ Missing'}")
            logger.info(f"  - GSC Analytics: {'✅ Found' if gsc_analytics else '❌ Missing'}")
            logger.info(f"  - Bing Analytics: {'✅ Found' if bing_analytics else '❌ Missing'}")

            linkedin_profile = self._get_linkedin_profile_info(user_id)
            canonical_profile = self._build_canonical_profile(
                website_analysis,
                research_preferences,
                persona_data,
                onboarding_session,
                competitor_analysis,
                deep_competitor_analysis,
                linkedin_profile,
            )

            integrated_data = {
                'website_analysis': website_analysis,
                'research_preferences': research_preferences,
                'onboarding_session': onboarding_session,
                'persona_data': persona_data,
                'competitor_analysis': competitor_analysis,
                'deep_competitor_analysis': deep_competitor_analysis,
                'linkedin_profile': linkedin_profile,
                'gsc_analytics': gsc_analytics,
                'bing_analytics': bing_analytics,
                'canonical_profile': canonical_profile,
                'data_quality': self._assess_data_quality(website_analysis, research_preferences, persona_data, competitor_analysis, gsc_analytics, bing_analytics),
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
            self._store_integrated_data(user_id, integrated_data, db)

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

    def _build_persona_synthesis(self, persona_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return build_persona_synthesis(persona_data)

    def _build_brand_voice(self, persona_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return build_brand_voice(persona_data)

    def _build_canonical_profile(
        self,
        website_analysis: Dict[str, Any],
        research_preferences: Dict[str, Any],
        persona_data: Dict[str, Any],
        onboarding_session: Dict[str, Any],
        competitor_analysis: List[Dict[str, Any]],
        deep_competitor_analysis: Dict[str, Any],
        linkedin_profile: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        return build_canonical_profile(
            website_analysis,
            research_preferences,
            persona_data,
            onboarding_session,
            competitor_analysis,
            deep_competitor_analysis,
            linkedin_profile,
        )

    def _build_competitor_seo_benchmarks(self, competitor_analysis: List[Dict[str, Any]]) -> Dict[str, Any]:
        return build_competitor_seo_benchmarks(competitor_analysis)


    def _assess_data_quality(self, website_analysis: Dict, research_preferences: Dict, persona_data: Dict = None, competitor_analysis: List = None, gsc_analytics: Dict = None, bing_analytics: Dict = None) -> Dict[str, Any]:
        return assess_data_quality(website_analysis, research_preferences, persona_data, competitor_analysis, gsc_analytics, bing_analytics)


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

    def _store_integrated_data(self, user_id: str, integrated_data: Dict[str, Any], db: Session) -> None:
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
                existing_record.canonical_profile = cp
                existing_record.updated_at = datetime.utcnow()
            else:
                new_kwargs = {
                    'user_id': user_id,
                    'website_analysis_data': integrated_data.get('website_analysis', {}),
                    'research_preferences_data': integrated_data.get('research_preferences', {}),
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
                # Add frontend-friendly aliases (url/domain/title/summary/relevance_score)
                competitor_dict['url'] = competitor_dict.get('competitor_url', '')
                competitor_dict['domain'] = competitor_dict.get('competitor_domain', '')
                ad = competitor_dict.get('analysis_data') or {}
                if isinstance(ad, dict):
                    competitor_dict['title'] = ad.get('title', '') or competitor_dict.get('competitor_domain', '')
                    competitor_dict['summary'] = ad.get('summary', '')
                    competitor_dict['relevance_score'] = ad.get('relevance_score', 0.5)
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
        return await fetch_gsc_analytics(user_id)

    async def _get_bing_analytics(self, user_id: str) -> Dict[str, Any]:
        return await fetch_bing_analytics(user_id)


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
                    'onboarding_session': {},
                    'canonical_profile': record.canonical_profile or {},
                    'data_quality': self._assess_data_quality(
                        record.website_analysis_data or {},
                        record.research_preferences_data or {}
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

    def _get_linkedin_profile_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Extract key LinkedIn profile fields for persona generation."""
        try:
            from api.linkedin_oauth_connection_routes import _oauth_service
            from services.integrations.linkedin.profile_repository import ProfileRepository
            import json

            repo = ProfileRepository(oauth=_oauth_service)
            row = repo.get_analysis_row(user_id)
            if not row:
                return None
            profile = json.loads(row.get("normalized_profile_json", "{}")) if row.get("normalized_profile_json") else {}
            if not profile:
                return None
            name = profile.get("name") or ""
            if not name:
                personal = profile.get("personal_information") or {}
                name = personal.get("name") or ""
            return {
                "name": name,
                "headline": profile.get("headline"),
                "industry": profile.get("industry"),
                "skills": profile.get("skills", []),
                "followers": profile.get("followers", 0),
                "connections": profile.get("connections", 0),
            }
        except Exception:
            return None

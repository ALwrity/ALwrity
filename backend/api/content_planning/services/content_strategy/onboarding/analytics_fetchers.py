"""
Analytics fetchers for onboarding data integration.

Async fetchers that pull Google Search Console and Bing Webmaster Tools
analytics for a user. Extracted from ``data_integration.py`` to keep that
module focused on orchestration and data access.
"""

from typing import Dict, Any

from models.onboarding import OnboardingSession, WebsiteAnalysis
from utils.logger_utils import get_service_logger

logger = get_service_logger("onboarding.analytics_fetchers")


async def fetch_gsc_analytics(user_id: str) -> Dict[str, Any]:
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
            logger.debug(f"Retrieved GSC analytics for user {user_id}")
            return {
                'data': gsc_data.get('data', {}),
                'metrics': gsc_data.get('metrics', {}),
                'date_range': gsc_data.get('date_range', {}),
                'data_freshness': 1.0,  # GSC data is typically fresh
                'confidence_level': 0.9
            }
        else:
            # "not connected" is the normal state for a user who
            # hasn't completed the GSC OAuth step yet. Log at
            # debug level — logging_config.py only emits WARNING+
            # to the console, so a stream of these would otherwise
            # make every healthy user look like they have a
            # problem.
            logger.debug(f"No GSC analytics for user {user_id} (GSC not connected or no data)")
            return {}
            
    except Exception as e:
        logger.error(f"Error getting GSC analytics for user {user_id}: {str(e)}")
        return {}

async def fetch_bing_analytics(user_id: str) -> Dict[str, Any]:
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
            logger.debug(f"Retrieved Bing analytics for user {user_id}")
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
            logger.debug(f"Retrieved Bing analytics from storage for user {user_id}")
            return {
                'data': {},
                'metrics': {},
                'summary': analytics_summary,
                'date_range': {},
                'data_freshness': 0.8,  # Stored data might be slightly older
                'confidence_level': 0.85
            }
        else:
            # "not connected" is the normal state for a user who
            # hasn't completed the Bing OAuth step yet. Log at
            # debug level — logging_config.py only emits WARNING+
            # to the console, so a stream of these would otherwise
            # make every healthy user look like they have a
            # problem.
            logger.debug(f"No Bing analytics for user {user_id} (Bing not connected or no data)")
            return {}
            
    except Exception as e:
        logger.error(f"Error getting Bing analytics for user {user_id}: {str(e)}")
        return {}

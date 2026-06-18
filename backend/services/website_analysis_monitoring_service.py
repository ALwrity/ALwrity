"""
Website Analysis Monitoring Service
Creates and manages website analysis monitoring tasks.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from urllib.parse import urlparse
import hashlib

from models.website_analysis_monitoring_models import WebsiteAnalysisTask
from models.onboarding import OnboardingSession

from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from services.database import get_db_session
from utils.logger_utils import get_service_logger

logger = get_service_logger("website_analysis_monitoring")

async def generate_website_analysis_tasks_task(user_id: str):
    db = None
    start_time = datetime.utcnow()
    try:
        db = get_db_session(user_id)
        if not db:
            raise RuntimeError(f"Failed to get database session for user {user_id}")

        result = create_website_analysis_tasks(user_id=user_id, db=db)

    except Exception as e:
        logger.error(f"Scheduled website analysis task creation failed for user {user_id}: {e}", exc_info=True)
    finally:
        if db:
            db.close()


def schedule_website_analysis_task_creation(user_id: str, delay_minutes: int = 5) -> str:
    from services.scheduler import get_scheduler

    scheduler = get_scheduler()
    run_date = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes)
    job_id = f"website_analysis_tasks_{user_id}"

    return scheduler.schedule_one_time_task(
        func=generate_website_analysis_tasks_task,
        run_date=run_date,
        job_id=job_id,
        kwargs={"user_id": user_id},
        replace_existing=True,
    )


def clerk_user_id_to_int(user_id: str) -> int:
    """
    Convert Clerk user ID to consistent integer for database session_id.
    Uses SHA256 hashing for deterministic, consistent results.
    This MUST match the pattern used in component_logic.py for onboarding.
    
    Args:
        user_id: Clerk user ID (e.g., 'user_33Gz1FPI86VDXhRY8QN4ragRFGN')
    
    Returns:
        int: Deterministic integer derived from user ID
    """
    user_id_hash = hashlib.sha256(user_id.encode()).hexdigest()
    return int(user_id_hash[:8], 16) % 2147483647


def create_website_analysis_tasks(user_id: str, db: Session) -> Dict[str, Any]:
    """
    Create website analysis tasks for user's website and all competitors.
    
    This should be called after onboarding completion.
    
    Args:
        user_id: Clerk user ID (string)
        db: Database session
        
    Returns:
        Dictionary with success status and task details
    """
    try:
        logger.info(f"[Website Analysis Tasks] Creating tasks for user: {user_id}")
        
        # Get user's website URL from onboarding using SSOT
        integration_service = OnboardingDataIntegrationService()
        integrated_data = integration_service.get_integrated_data_sync(user_id, db)
        
        website_analysis = integrated_data.get('website_analysis', {})
        
        if not website_analysis:
            logger.warning(f"[Website Analysis Tasks] No website analysis found for user {user_id}")
            # Try direct query using hash-based session_id (must match onboarding pattern)
            try:
                from models.onboarding import WebsiteAnalysis
                session_id_int = clerk_user_id_to_int(user_id)
                
                logger.info(
                    f"[Website Analysis Tasks] Querying WebsiteAnalysis with hash-based session_id: {session_id_int}"
                )
                
                analysis = db.query(WebsiteAnalysis).filter(
                    WebsiteAnalysis.session_id == session_id_int
                ).order_by(WebsiteAnalysis.created_at.desc()).first()
                
                if analysis:
                    logger.info(f"[Website Analysis Tasks] ✅ Found analysis via hash-based query: {analysis.website_url}")
                    website_analysis = analysis.to_dict()
            except Exception as e:
                logger.debug(f"[Website Analysis Tasks] Direct query fallback failed: {e}")
            
            if not website_analysis:
                return {
                    'success': False,
                    'error': 'No website analysis found. Complete onboarding first.'
                }
        
        website_url = website_analysis.get('website_url')
        
        # Log the actual value for debugging (always log, not just debug level)
        logger.info(
            f"[Website Analysis Tasks] website_url from dict: {repr(website_url)} "
            f"(type: {type(website_url).__name__}, truthy: {bool(website_url)})"
        )
        
        # Check if website_url is None, empty string, or whitespace
        if not website_url or (isinstance(website_url, str) and not website_url.strip()):
            # Log what we actually got for debugging
            logger.warning(
                f"[Website Analysis Tasks] No website URL found for user {user_id}. "
                f"Analysis keys: {list(website_analysis.keys()) if website_analysis else 'None'}, "
                f"website_url value: {repr(website_url)}"
            )
            
            # Try direct access to the model using hash-based session_id
            # This MUST use the same hash function as onboarding (clerk_user_id_to_int)
            try:
                from models.onboarding import WebsiteAnalysis
                session_id_int = clerk_user_id_to_int(user_id)
                
                logger.info(
                    f"[Website Analysis Tasks] Querying WebsiteAnalysis with hash-based session_id: {session_id_int} "
                    f"for user {user_id}"
                )
                
                analysis = db.query(WebsiteAnalysis).filter(
                    WebsiteAnalysis.session_id == session_id_int
                ).order_by(WebsiteAnalysis.created_at.desc()).first()
                
                if analysis:
                    logger.info(
                        f"[Website Analysis Tasks] Direct model access - "
                        f"website_url: {repr(analysis.website_url)}, "
                        f"type: {type(analysis.website_url).__name__ if analysis.website_url else 'None'}, "
                        f"id: {analysis.id}, session_id: {analysis.session_id}"
                    )
                    
                    if analysis.website_url:
                        website_url = analysis.website_url
                        logger.info(f"[Website Analysis Tasks] ✅ Retrieved website_url via hash-based query: {website_url}")
                    else:
                        # Try to extract URL from crawl_result if website_url is NULL
                        if analysis.crawl_result and isinstance(analysis.crawl_result, dict):
                            # Check multiple possible locations for URL
                            crawl_url = (
                                analysis.crawl_result.get('url') or
                                analysis.crawl_result.get('website_url') or
                                (analysis.crawl_result.get('content', {}).get('domain_info', {}).get('domain') if isinstance(analysis.crawl_result.get('content'), dict) else None)
                            )
                            
                            # If still not found, check if crawl_result has nested structure
                            if not crawl_url and 'content' in analysis.crawl_result:
                                content = analysis.crawl_result.get('content', {})
                                if isinstance(content, dict):
                                    # Check domain_info for domain
                                    domain_info = content.get('domain_info', {})
                                    if isinstance(domain_info, dict):
                                        crawl_url = domain_info.get('domain') or domain_info.get('url')
                            
                            if crawl_url:
                                # Ensure it's a full URL (add https:// if missing)
                                if crawl_url and not crawl_url.startswith(('http://', 'https://')):
                                    crawl_url = f"https://{crawl_url}"
                                logger.info(f"[Website Analysis Tasks] ✅ Extracted website_url from crawl_result: {crawl_url}")
                                website_url = crawl_url
                            else:
                                logger.warning(
                                    f"[Website Analysis Tasks] Cannot extract URL from crawl_result. "
                                    f"crawl_result keys: {list(analysis.crawl_result.keys()) if isinstance(analysis.crawl_result, dict) else 'not a dict'}, "
                                    f"Analysis ID: {analysis.id}"
                                )
                        else:
                            logger.warning(
                                f"[Website Analysis Tasks] website_url is NULL and crawl_result is empty or invalid. "
                                f"Analysis ID: {analysis.id}, Status: {analysis.status}, "
                                f"crawl_result type: {type(analysis.crawl_result).__name__ if analysis.crawl_result else 'None'}"
                            )
                else:
                    logger.warning(
                        f"[Website Analysis Tasks] No WebsiteAnalysis record found for "
                        f"hash-based session_id {session_id_int} (user {user_id})"
                    )
            except Exception as e:
                logger.warning(f"[Website Analysis Tasks] Hash-based query fallback failed: {e}", exc_info=True)
            
            if not website_url:
                return {
                    'success': False,
                    'error': 'No website URL found in onboarding data. Please complete step 2 (Website Analysis) in onboarding.'
                }
        
        logger.info(f"[Website Analysis Tasks] User website URL: {website_url}")
        
        tasks_created = []
        
        # 1. Create task for user's website (optional recurring every 30 days)
        user_task = _create_or_update_task(
            db=db,
            user_id=user_id,
            website_url=website_url,
            task_type='user_website',
            frequency_days=30  # Optional: recurring every 30 days
        )
        if user_task:
            tasks_created.append(user_task)
            logger.info(f"Created user website analysis task for {website_url}")
        
        # 2. Get competitors from onboarding
        competitors = _get_competitors_from_onboarding(user_id, db)
        logger.info(
            f"[Website Analysis Tasks] Found {len(competitors)} competitors for user {user_id}. "
            f"Competitors: {[c.get('url') or c.get('website_url') or c.get('domain') for c in competitors]}"
        )
        
        # 3. Create task for each competitor
        for competitor in competitors:
            competitor_url = competitor.get('url') or competitor.get('website_url')
            if not competitor_url:
                continue
                
            # Extract competitor identifier
            competitor_id = competitor.get('domain') or competitor.get('id') or _extract_domain(competitor_url)
            
            competitor_task = _create_or_update_task(
                db=db,
                user_id=user_id,
                website_url=competitor_url,
                task_type='competitor',
                competitor_id=competitor_id,
                frequency_days=10,  # Recurring every 10 days
                initial_delay_minutes=5
            )
            if competitor_task:
                tasks_created.append(competitor_task)
                logger.info(f"Created competitor analysis task for {competitor_url}")
        
        db.commit()
        
        logger.info(f"Created {len(tasks_created)} website analysis tasks for user {user_id}")
        
        return {
            'success': True,
            'tasks_created': len(tasks_created),
            'tasks': [{
                'id': t.id, 
                'url': t.website_url, 
                'type': t.task_type,
                'next_check': t.next_check.isoformat() if t.next_check else None
            } for t in tasks_created]
        }
        
    except Exception as e:
        logger.error(f"Error creating website analysis tasks for user {user_id}: {e}", exc_info=True)
        db.rollback()
        return {
            'success': False,
            'error': str(e)
        }


def _create_or_update_task(
    db: Session,
    user_id: str,
    website_url: str,
    task_type: str,
    competitor_id: Optional[str] = None,
    frequency_days: int = 10,
    initial_delay_minutes: Optional[int] = None
) -> Optional[WebsiteAnalysisTask]:
    """Create or update a website analysis task."""
    try:
        # Check if task already exists
        existing = db.query(WebsiteAnalysisTask).filter(
            WebsiteAnalysisTask.user_id == user_id,
            WebsiteAnalysisTask.website_url == website_url,
            WebsiteAnalysisTask.task_type == task_type
        ).first()
        
        if existing:
            # Update existing task
            existing.status = 'active'
            existing.frequency_days = frequency_days
            existing.next_check = datetime.utcnow() + timedelta(days=frequency_days)
            existing.updated_at = datetime.utcnow()
            if competitor_id:
                existing.competitor_id = competitor_id
            logger.info(f"Updated existing website analysis task {existing.id}")
            return existing
        
        # Create new task
        next_check = datetime.utcnow() + timedelta(days=frequency_days)
        if initial_delay_minutes is not None:
            next_check = datetime.utcnow() + timedelta(minutes=initial_delay_minutes)

        task = WebsiteAnalysisTask(
            user_id=user_id,
            website_url=website_url,
            task_type=task_type,
            competitor_id=competitor_id,
            status='active',
            frequency_days=frequency_days,
            next_check=next_check
        )
        db.add(task)
        db.flush()
        logger.info(f"Created new website analysis task {task.id} for {website_url}")
        return task
        
    except Exception as e:
        logger.error(f"Error creating/updating task: {e}", exc_info=True)
        return None


def _get_competitors_from_onboarding(user_id: str, db: Session) -> List[Dict[str, Any]]:
    """
    Get competitors from onboarding database.
    
    Competitors are stored in onboarding_sessions.step_data['step3_research_data']['competitors']
    or via Step3ResearchService.
    """
    try:
        # Get onboarding session using SSOT
        integration_service = OnboardingDataIntegrationService()
        integrated_data = integration_service.get_integrated_data_sync(user_id, db)
        
        # Get competitors from integrated data (SSOT handles fallback logic)
        # Priority 1: Check competitor_analysis (from CompetitorAnalysis table)
        competitors = integrated_data.get('competitor_analysis', [])
        
        # Priority 2: Check research_preferences
        if not competitors:
            research_preferences = integrated_data.get('research_preferences', {})
            competitors = research_preferences.get('competitors', [])
        
        # If not found in research_preferences, try session step_data fallback
        if not competitors:
            session = integrated_data.get('onboarding_session')
            if session:
                # Method 1: Check if step_data column exists and has competitors
                if hasattr(session, 'step_data') and session.step_data:
                    step_data = session.step_data if isinstance(session.step_data, dict) else {}
                    research_data = step_data.get('step3_research_data', {})
                    competitors = research_data.get('competitors', [])
                    logger.info(f"[Competitor Retrieval] Method 1 (step_data): found {len(competitors)} competitors")

        # Method 2: If still not found, try Step3ResearchService (Legacy Fallback)
        if not competitors:
            logger.info(f"[Competitor Retrieval] Attempting Step3ResearchService for user {user_id}")
            try:
                # We need session_id for Step3ResearchService
                session = integrated_data.get('onboarding_session')
                if session and hasattr(session, 'id'):
                    from api.onboarding_utils.step3_research_service import Step3ResearchService
                    import asyncio
                    step3_service = Step3ResearchService()
                    
                    # Run async function - handle both new and existing event loops
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    research_data_result = loop.run_until_complete(
                        step3_service.get_research_data(str(session.id))
                    )
                    
                    logger.info(f"[Competitor Retrieval] Step3ResearchService result: {research_data_result.get('success')}")
                    
                    if research_data_result.get('success'):
                        research_data = research_data_result.get('research_data', {})
                        step3_data = research_data.get('step3_research_data', {})
                        competitors = step3_data.get('competitors', [])
                        logger.info(f"[Competitor Retrieval] Retrieved {len(competitors)} competitors from Step3ResearchService")
                    else:
                        logger.warning(f"[Competitor Retrieval] Step3ResearchService returned error: {research_data_result.get('error')}")
            except Exception as e:
                logger.warning(f"[Competitor Retrieval] Could not fetch competitors from Step3ResearchService: {e}", exc_info=True)
        
        # Ensure competitors is a list
        if not isinstance(competitors, list):
            competitors = []
        
        logger.info(f"Found {len(competitors)} competitors for user {user_id}")
        return competitors
        
    except Exception as e:
        logger.error(f"Error getting competitors from onboarding: {e}", exc_info=True)
        return []


def _extract_domain(url: str) -> str:
    """Extract domain from URL."""
    try:
        parsed = urlparse(url)
        return parsed.netloc or url
    except Exception:
        return url


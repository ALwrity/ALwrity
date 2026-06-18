from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.website_analysis_monitoring_models import DeepWebsiteCrawlTask
from utils.logger_utils import get_service_logger

logger = get_service_logger("deep_website_crawl_task_loader")

def load_due_deep_website_crawl_tasks(db: Session, user_id: Optional[str] = None) -> List[DeepWebsiteCrawlTask]:
    """
    Load due deep website crawl tasks.
    
    Args:
        db: Database session
        user_id: Optional user_id to filter tasks
        
    Returns:
        List of due tasks
    """
    try:
        query = db.query(DeepWebsiteCrawlTask).filter(
            or_(
                DeepWebsiteCrawlTask.status == 'active',
                DeepWebsiteCrawlTask.status == 'retry'
            ),
            or_(
                DeepWebsiteCrawlTask.next_execution <= datetime.utcnow(),
                DeepWebsiteCrawlTask.next_execution == None
            )
        )
        
        if user_id:
            query = query.filter(DeepWebsiteCrawlTask.user_id == user_id)
            
        return query.all()
    except Exception as e:
        logger.error(f"Error loading deep website crawl tasks: {e}")
        return []

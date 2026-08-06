from datetime import datetime
from typing import Any, Dict, Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.platform_analytics import PlatformAnalyticsData


class PlatformAnalyticsPersistence:
    def __init__(self, session: Session):
        self.session = session

    def save_analytics(
        self,
        user_id: str,
        platform: str,
        metrics: Optional[Dict[str, Any]] = None,
        summary: Optional[Dict[str, Any]] = None,
        site_url: Optional[str] = None,
        status: str = "success",
        error_message: Optional[str] = None,
    ) -> int:
        import json

        existing = (
            self.session.query(PlatformAnalyticsData)
            .filter(
                PlatformAnalyticsData.user_id == user_id,
                PlatformAnalyticsData.platform == platform,
                PlatformAnalyticsData.site_url == site_url,
            )
            .order_by(PlatformAnalyticsData.analysis_date.desc())
            .first()
        )

        if existing:
            existing.metrics_json = json.dumps(metrics) if metrics else None
            existing.summary_json = json.dumps(summary) if summary else None
            existing.status = status
            existing.error_message = error_message
            existing.analysis_date = datetime.utcnow()
            existing.updated_at = datetime.utcnow()
            self.session.commit()
            return existing.id

        entry = PlatformAnalyticsData(
            user_id=user_id,
            platform=platform,
            site_url=site_url,
            metrics_json=json.dumps(metrics) if metrics else None,
            summary_json=json.dumps(summary) if summary else None,
            status=status,
            error_message=error_message,
            analysis_date=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.session.add(entry)
        self.session.commit()
        return entry.id

    def check_existing_analytics(
        self, user_id: str, platform: str, site_url: Optional[str] = None
    ) -> Dict[str, Any]:
        existing = (
            self.session.query(PlatformAnalyticsData)
            .filter(
                PlatformAnalyticsData.user_id == user_id,
                PlatformAnalyticsData.platform == platform,
                PlatformAnalyticsData.site_url == site_url,
            )
            .order_by(PlatformAnalyticsData.analysis_date.desc())
            .first()
        )

        if not existing:
            return {"exists": False}

        return {
            "exists": True,
            "analysis_id": existing.id,
            "analysis_date": existing.analysis_date.isoformat() if existing.analysis_date else None,
            "status": existing.status,
            "summary": existing.summary_json,
        }

    def get_analytics(self, analysis_id: int) -> Optional[Dict[str, Any]]:
        import json

        entry = self.session.query(PlatformAnalyticsData).filter(
            PlatformAnalyticsData.id == analysis_id
        ).first()

        if not entry:
            return None

        return {
            "id": entry.id,
            "user_id": entry.user_id,
            "platform": entry.platform,
            "site_url": entry.site_url,
            "metrics": json.loads(entry.metrics_json) if entry.metrics_json else None,
            "summary": json.loads(entry.summary_json) if entry.summary_json else None,
            "status": entry.status,
            "error_message": entry.error_message,
            "analysis_date": entry.analysis_date.isoformat() if entry.analysis_date else None,
        }

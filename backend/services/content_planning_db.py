"""
Content Planning Database Operations
Handles all database operations for content planning system.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from loguru import logger
from datetime import datetime

from models.content_planning import (
    ContentStrategy, CalendarEvent, ContentAnalytics,
    ContentGapAnalysis, ContentRecommendation
)

class ContentPlanningDBService:
    """Database operations for content planning system."""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.logger = logger
    
    # Content Strategy Operations
    async def create_content_strategy(self, strategy_data: Dict[str, Any]) -> Optional[ContentStrategy]:
        """Create a new content strategy."""
        try:
            strategy = ContentStrategy(**strategy_data)
            self.db.add(strategy)
            self.db.commit()
            self.db.refresh(strategy)
            self.logger.info(f"Created content strategy: {strategy.id}")
            return strategy
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error creating content strategy: {str(e)}")
            return None
    
    async def get_content_strategy(self, strategy_id: int) -> Optional[ContentStrategy]:
        """Get content strategy by ID."""
        try:
            return self.db.query(ContentStrategy).filter(ContentStrategy.id == strategy_id).first()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting content strategy: {str(e)}")
            return None
    
    async def get_user_content_strategies(self, user_id: int) -> List[ContentStrategy]:
        """Get all content strategies for a user."""
        try:
            return self.db.query(ContentStrategy).filter(ContentStrategy.user_id == user_id).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting user content strategies: {str(e)}")
            return []
    
    async def update_content_strategy(self, strategy_id: int, update_data: Dict[str, Any]) -> Optional[ContentStrategy]:
        """Update content strategy."""
        try:
            strategy = await self.get_content_strategy(strategy_id)
            if strategy:
                for key, value in update_data.items():
                    setattr(strategy, key, value)
                strategy.updated_at = datetime.utcnow()
                self.db.commit()
                self.logger.info(f"Updated content strategy: {strategy_id}")
                return strategy
            return None
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error updating content strategy: {str(e)}")
            return None
    
    async def delete_content_strategy(self, strategy_id: int) -> bool:
        """Delete content strategy."""
        try:
            strategy = await self.get_content_strategy(strategy_id)
            if strategy:
                self.db.delete(strategy)
                self.db.commit()
                self.logger.info(f"Deleted content strategy: {strategy_id}")
                return True
            return False
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error deleting content strategy: {str(e)}")
            return False
    
    # Calendar Event Operations
    async def create_calendar_event(self, event_data: Dict[str, Any]) -> Optional[CalendarEvent]:
        """Create a new calendar event."""
        try:
            event = CalendarEvent(**event_data)
            self.db.add(event)
            self.db.commit()
            self.db.refresh(event)
            self.logger.info(f"Created calendar event: {event.id}")
            return event
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error creating calendar event: {str(e)}")
            return None
    
    async def get_calendar_event(self, event_id: int, user_id: Optional[str] = None) -> Optional[CalendarEvent]:
        """Get calendar event by ID, optionally scoped to a user."""
        try:
            query = self.db.query(CalendarEvent).filter(CalendarEvent.id == event_id)
            if user_id:
                query = query.filter(CalendarEvent.user_id == user_id)
            return query.first()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting calendar event: {str(e)}")
            return None
    
    async def get_strategy_calendar_events(self, strategy_id: int, user_id: Optional[str] = None) -> List[CalendarEvent]:
        """Get all calendar events for a strategy, optionally scoped to a user."""
        try:
            query = self.db.query(CalendarEvent).filter(CalendarEvent.strategy_id == strategy_id)
            if user_id:
                query = query.filter(CalendarEvent.user_id == user_id)
            return query.all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting strategy calendar events: {str(e)}")
            return []
    
    async def get_user_calendar_events(self, user_id: str) -> List[CalendarEvent]:
        """Get all calendar events for a user."""
        try:
            return self.db.query(CalendarEvent).filter(CalendarEvent.user_id == user_id).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting user calendar events: {str(e)}")
            return []
    
    async def update_calendar_event(self, event_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[CalendarEvent]:
        """Update calendar event, optionally scoped to a user."""
        try:
            event = await self.get_calendar_event(event_id, user_id=user_id)
            if event:
                # Prevent ownership transfer via update
                update_data.pop('user_id', None)
                for key, value in update_data.items():
                    setattr(event, key, value)
                event.updated_at = datetime.utcnow()
                self.db.commit()
                self.logger.info(f"Updated calendar event: {event_id}")
                return event
            return None
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error updating calendar event: {str(e)}")
            return None
    
    async def delete_calendar_event(self, event_id: int, user_id: Optional[str] = None) -> bool:
        """Delete calendar event, optionally scoped to a user."""
        try:
            event = await self.get_calendar_event(event_id, user_id=user_id)
            if event:
                self.db.delete(event)
                self.db.commit()
                self.logger.info(f"Deleted calendar event: {event_id}")
                return True
            return False
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error deleting calendar event: {str(e)}")
            return False
    
    # Content Gap Analysis Operations
    async def create_content_gap_analysis(self, analysis_data: Dict[str, Any]) -> Optional[ContentGapAnalysis]:
        """Create a new content gap analysis."""
        try:
            analysis = ContentGapAnalysis(**analysis_data)
            self.db.add(analysis)
            self.db.commit()
            self.db.refresh(analysis)
            self.logger.info(f"Created content gap analysis: {analysis.id}")
            return analysis
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error creating content gap analysis: {str(e)}")
            return None
    
    async def get_content_gap_analysis(self, analysis_id: int) -> Optional[ContentGapAnalysis]:
        """Get content gap analysis by ID."""
        try:
            return self.db.query(ContentGapAnalysis).filter(ContentGapAnalysis.id == analysis_id).first()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting content gap analysis: {str(e)}")
            return None
    
    async def get_user_content_gap_analyses(self, user_id: int) -> List[ContentGapAnalysis]:
        """Get all content gap analyses for a user."""
        try:
            return self.db.query(ContentGapAnalysis).filter(ContentGapAnalysis.user_id == user_id).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting user content gap analyses: {str(e)}")
            return []
    
    async def update_content_gap_analysis(self, analysis_id: int, update_data: Dict[str, Any]) -> Optional[ContentGapAnalysis]:
        """Update content gap analysis."""
        try:
            analysis = await self.get_content_gap_analysis(analysis_id)
            if analysis:
                for key, value in update_data.items():
                    setattr(analysis, key, value)
                analysis.updated_at = datetime.utcnow()
                self.db.commit()
                self.logger.info(f"Updated content gap analysis: {analysis_id}")
                return analysis
            return None
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error updating content gap analysis: {str(e)}")
            return None
    
    async def delete_content_gap_analysis(self, analysis_id: int) -> bool:
        """Delete content gap analysis."""
        try:
            analysis = await self.get_content_gap_analysis(analysis_id)
            if analysis:
                self.db.delete(analysis)
                self.db.commit()
                self.logger.info(f"Deleted content gap analysis: {analysis_id}")
                return True
            return False
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error deleting content gap analysis: {str(e)}")
            return False
    
    # Content Recommendation Operations
    async def create_content_recommendation(self, recommendation_data: Dict[str, Any]) -> Optional[ContentRecommendation]:
        """Create a new content recommendation."""
        try:
            recommendation = ContentRecommendation(**recommendation_data)
            self.db.add(recommendation)
            self.db.commit()
            self.db.refresh(recommendation)
            self.logger.info(f"Created content recommendation: {recommendation.id}")
            return recommendation
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error creating content recommendation: {str(e)}")
            return None
    
    async def get_content_recommendation(self, recommendation_id: int) -> Optional[ContentRecommendation]:
        """Get content recommendation by ID."""
        try:
            return self.db.query(ContentRecommendation).filter(ContentRecommendation.id == recommendation_id).first()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting content recommendation: {str(e)}")
            return None
    
    async def get_user_content_recommendations(self, user_id: int) -> List[ContentRecommendation]:
        """Get all content recommendations for a user."""
        try:
            return self.db.query(ContentRecommendation).filter(ContentRecommendation.user_id == user_id).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting user content recommendations: {str(e)}")
            return []
    
    async def update_content_recommendation(self, recommendation_id: int, update_data: Dict[str, Any]) -> Optional[ContentRecommendation]:
        """Update content recommendation."""
        try:
            recommendation = await self.get_content_recommendation(recommendation_id)
            if recommendation:
                for key, value in update_data.items():
                    setattr(recommendation, key, value)
                recommendation.updated_at = datetime.utcnow()
                self.db.commit()
                self.logger.info(f"Updated content recommendation: {recommendation_id}")
                return recommendation
            return None
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error updating content recommendation: {str(e)}")
            return None
    
    async def delete_content_recommendation(self, recommendation_id: int) -> bool:
        """Delete content recommendation."""
        try:
            recommendation = await self.get_content_recommendation(recommendation_id)
            if recommendation:
                self.db.delete(recommendation)
                self.db.commit()
                self.logger.info(f"Deleted content recommendation: {recommendation_id}")
                return True
            return False
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error deleting content recommendation: {str(e)}")
            return False
    
    # Analytics Operations
    async def create_content_analytics(self, analytics_data: Dict[str, Any]) -> Optional[ContentAnalytics]:
        """Create new content analytics."""
        try:
            analytics = ContentAnalytics(**analytics_data)
            self.db.add(analytics)
            self.db.commit()
            self.db.refresh(analytics)
            self.logger.info(f"Created content analytics: {analytics.id}")
            return analytics
        except SQLAlchemyError as e:
            self.db.rollback()
            self.logger.error(f"Error creating content analytics: {str(e)}")
            return None
    
    async def get_event_analytics(self, event_id: int) -> List[ContentAnalytics]:
        """Get analytics for a specific event."""
        try:
            return self.db.query(ContentAnalytics).filter(ContentAnalytics.event_id == event_id).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting event analytics: {str(e)}")
            return []
    
    async def get_strategy_analytics(self, strategy_id: int) -> List[ContentAnalytics]:
        """Get analytics for a specific strategy."""
        try:
            return self.db.query(ContentAnalytics).filter(ContentAnalytics.strategy_id == strategy_id).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting strategy analytics: {str(e)}")
            return []
    
    async def get_analytics_by_platform(self, platform: str) -> List[ContentAnalytics]:
        """Get analytics for a specific platform."""
        try:
            return self.db.query(ContentAnalytics).filter(ContentAnalytics.platform == platform).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting platform analytics: {str(e)}")
            return []
    
    # Advanced Query Operations
    async def get_strategies_with_analytics(self, user_id: int) -> List[Dict[str, Any]]:
        """Get content strategies with their analytics summary."""
        try:
            strategies = await self.get_user_content_strategies(user_id)
            result = []
            
            for strategy in strategies:
                analytics = await self.get_strategy_analytics(strategy.id)
                avg_performance = sum(a.performance_score or 0 for a in analytics) / len(analytics) if analytics else 0
                
                result.append({
                    'strategy': strategy.to_dict(),
                    'analytics_count': len(analytics),
                    'average_performance': avg_performance,
                    'last_analytics': max(a.recorded_at for a in analytics).isoformat() if analytics else None
                })
            
            return result
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting strategies with analytics: {str(e)}")
            return []
    
    async def get_events_by_status(self, strategy_id: int, status: str) -> List[CalendarEvent]:
        """Get calendar events by status for a strategy."""
        try:
            return self.db.query(CalendarEvent).filter(
                CalendarEvent.strategy_id == strategy_id,
                CalendarEvent.status == status
            ).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting events by status: {str(e)}")
            return []
    
    async def get_recommendations_by_priority(self, user_id: int, priority: str) -> List[ContentRecommendation]:
        """Get content recommendations by priority for a user."""
        try:
            return self.db.query(ContentRecommendation).filter(
                ContentRecommendation.user_id == user_id,
                ContentRecommendation.priority == priority
            ).all()
        except SQLAlchemyError as e:
            self.logger.error(f"Error getting recommendations by priority: {str(e)}")
            return []
    
    # Health Check
    async def health_check(self) -> Dict[str, Any]:
        """Database health check."""
        try:
            # Test basic operations
            strategy_count = self.db.query(ContentStrategy).count()
            event_count = self.db.query(CalendarEvent).count()
            analysis_count = self.db.query(ContentGapAnalysis).count()
            recommendation_count = self.db.query(ContentRecommendation).count()
            analytics_count = self.db.query(ContentAnalytics).count()
            
            return {
                'status': 'healthy',
                'tables': {
                    'content_strategies': strategy_count,
                    'calendar_events': event_count,
                    'content_gap_analyses': analysis_count,
                    'content_recommendations': recommendation_count,
                    'content_analytics': analytics_count
                },
                'timestamp': datetime.utcnow().isoformat()
            }
        except SQLAlchemyError as e:
            self.logger.error(f"Database health check failed: {str(e)}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            } 
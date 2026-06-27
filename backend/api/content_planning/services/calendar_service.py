"""
Calendar Service for Content Planning API
Extracted business logic from the calendar events route for better separation of concerns.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session

# Import database service
from services.content_planning_db import ContentPlanningDBService

# Import utilities
from ..utils.error_handlers import ContentPlanningErrorHandler
from ..utils.response_builders import ResponseBuilder
from ..utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

class CalendarService:
    """Service class for calendar event operations."""
    
    def __init__(self):
        pass
    
    async def create_calendar_event(self, event_data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Create a new calendar event."""
        try:
            logger.info(f"Creating calendar event: {event_data.get('title', 'Unknown')}")
            
            db_service = ContentPlanningDBService(db)
            created_event = await db_service.create_calendar_event(event_data)
            
            if created_event:
                logger.info(f"Calendar event created successfully: {created_event.id}")
                return created_event.to_dict()
            else:
                raise Exception("Failed to create calendar event")
                
        except Exception as e:
            logger.error(f"Error creating calendar event: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "create_calendar_event")
    
    async def get_calendar_events(self, strategy_id: Optional[int] = None, user_id: Optional[str] = None, db: Session = None) -> List[Dict[str, Any]]:
        """Get calendar events, optionally filtered by strategy and scoped to user."""
        try:
            logger.info("Fetching calendar events")
            
            db_service = ContentPlanningDBService(db)
            
            if strategy_id:
                events = await db_service.get_strategy_calendar_events(strategy_id, user_id=user_id)
            elif user_id:
                events = await db_service.get_user_calendar_events(user_id)
            else:
                events = []
            
            return [event.to_dict() for event in events]
            
        except Exception as e:
            logger.error(f"Error getting calendar events: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_calendar_events")
    
    async def get_calendar_event_by_id(self, event_id: int, db: Session, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get a specific calendar event by ID, optionally scoped to a user."""
        try:
            logger.info(f"Fetching calendar event: {event_id}")
            
            db_service = ContentPlanningDBService(db)
            event = await db_service.get_calendar_event(event_id, user_id=user_id)
            
            if event:
                return event.to_dict()
            else:
                raise ContentPlanningErrorHandler.handle_not_found_error("Calendar event", event_id)
            
        except Exception as e:
            logger.error(f"Error getting calendar event: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_calendar_event_by_id")
    
    async def update_calendar_event(self, event_id: int, update_data: Dict[str, Any], db: Session, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Update a calendar event, scoped to a user."""
        try:
            logger.info(f"Updating calendar event: {event_id}")

            db_service = ContentPlanningDBService(db)
            updated_event = await db_service.update_calendar_event(event_id, update_data, user_id=user_id)

            if updated_event:
                try:
                    from services.today_workflow_service import sync_workflow_tasks_from_calendar_event
                    from models.content_planning import ContentStrategy
                    strategy = (
                        db.query(ContentStrategy)
                        .filter(ContentStrategy.id == updated_event.strategy_id)
                        .first()
                    )
                    if strategy is not None:
                        sync_workflow_tasks_from_calendar_event(
                            db, str(strategy.user_id), updated_event,
                        )
                except Exception as sync_err:
                    logger.warning(
                        f"Reverse-sync from calendar event {event_id} to workflow "
                        f"tasks failed (non-blocking): {sync_err}"
                    )
                return updated_event.to_dict()
            else:
                raise ContentPlanningErrorHandler.handle_not_found_error("Calendar event", event_id)

        except Exception as e:
            logger.error(f"Error updating calendar event: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "update_calendar_event")

    async def delete_calendar_event(self, event_id: int, db: Session, user_id: Optional[str] = None) -> bool:
        """Delete a calendar event, scoped to a user."""
        try:
            logger.info(f"Deleting calendar event: {event_id}")

            db_service = ContentPlanningDBService(db)
            event = await db_service.get_calendar_event(event_id, user_id=user_id)
            if not event:
                raise ContentPlanningErrorHandler.handle_not_found_error("Calendar event", event_id)

            strategy_user_id = None
            from models.content_planning import ContentStrategy
            strategy = (
                db.query(ContentStrategy)
                .filter(ContentStrategy.id == event.strategy_id)
                .first()
            )
            if strategy is not None:
                strategy_user_id = str(strategy.user_id)

            deleted = await db_service.delete_calendar_event(event_id, user_id=user_id)

            if deleted:
                if strategy_user_id:
                    try:
                        from services.today_workflow_service import sync_workflow_tasks_from_calendar_event
                        class _CancelledSentinel:
                            id = event.id
                            status = "cancelled"
                        sync_workflow_tasks_from_calendar_event(
                            db, strategy_user_id, _CancelledSentinel(),
                        )
                    except Exception as sync_err:
                        logger.warning(
                            f"Reverse-sync from calendar event {event_id} deletion "
                            f"to workflow tasks failed (non-blocking): {sync_err}"
                        )
                return True
            else:
                raise ContentPlanningErrorHandler.handle_not_found_error("Calendar event", event_id)

        except Exception as e:
            logger.error(f"Error deleting calendar event: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "delete_calendar_event")
    
    async def get_events_by_status(self, strategy_id: int, status: str, db: Session, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get calendar events by status for a specific strategy, scoped to a user."""
        try:
            logger.info(f"Fetching events for strategy {strategy_id} with status {status}")
            
            db_service = ContentPlanningDBService(db)
            events = await db_service.get_events_by_status(strategy_id, status)
            if user_id:
                events = [e for e in events if e.user_id == user_id]
            
            return [event.to_dict() for event in events]
            
        except Exception as e:
            logger.error(f"Error getting events by status: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_events_by_status")
    
    async def get_strategy_events(self, strategy_id: int, db: Session, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get calendar events for a specific strategy, scoped to a user."""
        try:
            logger.info(f"Fetching events for strategy: {strategy_id}")
            
            db_service = ContentPlanningDBService(db)
            events = await db_service.get_strategy_calendar_events(strategy_id, user_id=user_id)
            
            return {
                'strategy_id': strategy_id,
                'events_count': len(events),
                'events': [event.to_dict() for event in events]
            }
            
        except Exception as e:
            logger.error(f"Error getting strategy events: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "get_strategy_events")
    
    async def schedule_event(self, event_data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Schedule a calendar event with conflict checking."""
        try:
            logger.info(f"Scheduling calendar event: {event_data.get('title', 'Unknown')}")
            
            # Check for scheduling conflicts
            conflicts = await self._check_scheduling_conflicts(event_data, db)
            
            if conflicts:
                logger.warning(f"Scheduling conflicts found: {conflicts}")
                return {
                    "status": "conflict",
                    "message": "Scheduling conflicts detected",
                    "conflicts": conflicts,
                    "event_data": event_data
                }
            
            # Create the event
            created_event = await self.create_calendar_event(event_data, db)
            
            if created_event:
                return {
                    "status": "success",
                    "message": "Calendar event scheduled successfully",
                    "event": created_event
                }
            else:
                return {
                    "status": "error",
                    "message": "Failed to create calendar event",
                    "event_data": event_data
                }
            
        except Exception as e:
            logger.error(f"Error scheduling calendar event: {str(e)}")
            raise ContentPlanningErrorHandler.handle_general_error(e, "schedule_event")
    
    async def _check_scheduling_conflicts(self, event_data: Dict[str, Any], db: Session) -> List[Dict[str, Any]]:
        """Check for scheduling conflicts with existing events."""
        try:
            from models.content_planning import CalendarEvent as CalEvent
            from sqlalchemy import cast, Date

            scheduled_date = event_data.get("scheduled_date")
            strategy_id = event_data.get("strategy_id")
            platform = event_data.get("platform", "")
            content_type = event_data.get("content_type", "")

            if not scheduled_date or not strategy_id:
                return []

            conflicts = []
            # Same day + same platform conflict
            existing = db.query(CalEvent).filter(
                CalEvent.strategy_id == strategy_id,
                cast(CalEvent.scheduled_date, Date) == cast(scheduled_date, Date),
                CalEvent.platform == platform
            ).all()
            for ev in existing:
                conflicts.append({
                    "type": "platform_double_booking",
                    "message": f"Already have '{ev.title}' on {platform} this day",
                    "conflicting_event_id": ev.id,
                    "conflicting_title": ev.title
                })

            # Same day + same content type conflict
            existing_type = db.query(CalEvent).filter(
                CalEvent.strategy_id == strategy_id,
                cast(CalEvent.scheduled_date, Date) == cast(scheduled_date, Date),
                CalEvent.content_type == content_type
            ).all()
            for ev in existing_type:
                if ev.id not in {c["conflicting_event_id"] for c in conflicts}:
                    conflicts.append({
                        "type": "content_type_double_booking",
                        "message": f"Already have '{ev.title}' with type {content_type} this day",
                        "conflicting_event_id": ev.id,
                        "conflicting_title": ev.title
                    })

            return conflicts
            
        except Exception as e:
            logger.error(f"Error checking scheduling conflicts: {str(e)}")
            return []

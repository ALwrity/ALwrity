"""
Calendar Events Routes for Content Planning API
Extracted from the main content_planning.py file for better organization.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger

# Import authentication
from middleware.auth_middleware import get_current_user

# Import database service
from services.database import get_db_session, get_db
from services.content_planning_db import ContentPlanningDBService

# Import models
from ..models.requests import CalendarEventCreate
from ..models.responses import CalendarEventResponse

# Import utilities
from ...utils.error_handlers import ContentPlanningErrorHandler
from ...utils.response_builders import ResponseBuilder
from ...utils.constants import ERROR_MESSAGES, SUCCESS_MESSAGES

# Import services
from ...services.calendar_service import CalendarService

# Initialize services
calendar_service = CalendarService()

# Create router
router = APIRouter(prefix="/calendar-events", tags=["calendar-events"])

@router.post("/", response_model=CalendarEventResponse)
async def create_calendar_event(
    event: CalendarEventCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new calendar event."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        logger.info(f"Creating calendar event: {event.title} for user: {clerk_user_id}")
        
        event_data = event.dict()
        event_data['user_id'] = clerk_user_id
        created_event = await calendar_service.create_calendar_event(event_data, db)
        
        return CalendarEventResponse(**created_event)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating calendar event: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "create_calendar_event")

@router.get("/", response_model=List[CalendarEventResponse])
async def get_calendar_events(
    strategy_id: Optional[int] = Query(None, description="Filter by strategy ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get calendar events, optionally filtered by strategy, scoped to the current user."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        logger.info(f"Fetching calendar events for user: {clerk_user_id}")
        
        events = await calendar_service.get_calendar_events(strategy_id, user_id=clerk_user_id, db=db)
        return [CalendarEventResponse(**event) for event in events]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting calendar events: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_calendar_events")

@router.get("/{event_id}", response_model=CalendarEventResponse)
async def get_calendar_event(
    event_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific calendar event by ID, scoped to the current user."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        logger.info(f"Fetching calendar event: {event_id} for user: {clerk_user_id}")
        
        event = await calendar_service.get_calendar_event_by_id(event_id, db, user_id=clerk_user_id)
        return CalendarEventResponse(**event)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting calendar event: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_calendar_event")

@router.put("/{event_id}", response_model=CalendarEventResponse)
async def update_calendar_event(
    event_id: int,
    update_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a calendar event, scoped to the current user."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        logger.info(f"Updating calendar event: {event_id} for user: {clerk_user_id}")
        
        updated_event = await calendar_service.update_calendar_event(event_id, update_data, db, user_id=clerk_user_id)
        return CalendarEventResponse(**updated_event)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating calendar event: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "update_calendar_event")

@router.delete("/{event_id}")
async def delete_calendar_event(
    event_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a calendar event, scoped to the current user."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        logger.info(f"Deleting calendar event: {event_id} for user: {clerk_user_id}")
        
        deleted = await calendar_service.delete_calendar_event(event_id, db, user_id=clerk_user_id)
        
        if deleted:
            return {"message": f"Calendar event {event_id} deleted successfully"}
        else:
            raise ContentPlanningErrorHandler.handle_not_found_error("Calendar event", event_id)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting calendar event: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "delete_calendar_event")

@router.post("/schedule", response_model=Dict[str, Any])
async def schedule_calendar_event(
    event: CalendarEventCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule a calendar event with conflict checking."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        logger.info(f"Scheduling calendar event: {event.title} for user: {clerk_user_id}")
        
        event_data = event.dict()
        event_data['user_id'] = clerk_user_id
        result = await calendar_service.schedule_event(event_data, db)
        return result
        
    except Exception as e:
        logger.error(f"Error scheduling calendar event: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "schedule_calendar_event")

@router.get("/strategy/{strategy_id}/events")
async def get_strategy_events(
    strategy_id: int,
    status: Optional[str] = Query(None, description="Filter by event status"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get calendar events for a specific strategy, scoped to the current user."""
    try:
        clerk_user_id = str(current_user.get('id', ''))
        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        logger.info(f"Fetching events for strategy: {strategy_id} for user: {clerk_user_id}")
        
        if status:
            events = await calendar_service.get_events_by_status(strategy_id, status, db, user_id=clerk_user_id)
            return {
                'strategy_id': strategy_id,
                'status': status,
                'events_count': len(events),
                'events': events
            }
        else:
            result = await calendar_service.get_strategy_events(strategy_id, db, user_id=clerk_user_id)
            return result
        
    except Exception as e:
        logger.error(f"Error getting strategy events: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") 
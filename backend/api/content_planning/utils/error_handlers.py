"""
Centralized Error Handlers for Content Planning Module
Standardized error handling patterns extracted from the main content planning file.
"""

from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status
from loguru import logger
import traceback

class ContentPlanningErrorHandler:
    """Centralized error handling for content planning operations."""
    
    @staticmethod
    def handle_database_error(error: Exception, operation: str) -> HTTPException:
        """Handle database-related errors."""
        logger.error(f"Database error during {operation}: {str(error)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database operation failed during {operation}: {str(error)}"
        )
    
    @staticmethod
    def handle_validation_error(error: Exception, field: str) -> HTTPException:
        """Handle validation errors."""
        logger.error(f"Validation error for field '{field}': {str(error)}")
        
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Validation error for {field}: {str(error)}"
        )
    
    @staticmethod
    def handle_not_found_error(resource_type: str, resource_id: Any) -> HTTPException:
        """Handle resource not found errors."""
        logger.warning(f"{resource_type} not found: {resource_id}")
        
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_type} with id {resource_id} not found"
        )
    
    @staticmethod
    def handle_ai_service_error(error: Exception, service: str) -> HTTPException:
        """Handle AI service errors."""
        logger.error(f"AI service error in {service}: {str(error)}")
        
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service {service} is currently unavailable: {str(error)}"
        )
    
    @staticmethod
    def handle_api_key_error(missing_keys: list) -> HTTPException:
        """Handle API key configuration errors."""
        logger.error(f"Missing API keys: {missing_keys}")
        
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI services are not properly configured. Missing keys: {', '.join(missing_keys)}"
        )
    
    @staticmethod
    def handle_general_error(error: Exception, operation: str) -> HTTPException:
        """Handle general errors."""
        logger.error(f"General error during {operation}: {str(error)}")
        logger.error(f"Exception type: {type(error)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during {operation}: {str(error)}"
        )
    
    @staticmethod
    def create_error_response(
        status_code: int,
        message: str,
        error_type: str = "general",
        details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create standardized error response."""
        error_response = {
            "status": "error",
            "error_type": error_type,
            "message": message,
            "status_code": status_code,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if details:
            error_response["details"] = details
            
        return error_response

# Common error messages
ERROR_MESSAGES = {
    "strategy_not_found": "Content strategy not found",
    "calendar_event_not_found": "Calendar event not found",
    "gap_analysis_not_found": "Content gap analysis not found",
    "user_not_found": "User not found",
    "invalid_request": "Invalid request data",
    "database_connection": "Database connection failed",
    "ai_service_unavailable": "AI service is currently unavailable",
    "validation_failed": "Request validation failed",
    "permission_denied": "Permission denied",
    "rate_limit_exceeded": "Rate limit exceeded",
    "internal_server_error": "Internal server error",
    "service_unavailable": "Service temporarily unavailable"
}

# Error status codes mapping
ERROR_STATUS_CODES = {
    "not_found": status.HTTP_404_NOT_FOUND,
    "validation_error": status.HTTP_422_UNPROCESSABLE_ENTITY,
    "bad_request": status.HTTP_400_BAD_REQUEST,
    "unauthorized": status.HTTP_401_UNAUTHORIZED,
    "forbidden": status.HTTP_403_FORBIDDEN,
    "not_found": status.HTTP_404_NOT_FOUND,
    "conflict": status.HTTP_409_CONFLICT,
    "internal_error": status.HTTP_500_INTERNAL_SERVER_ERROR,
    "service_unavailable": status.HTTP_503_SERVICE_UNAVAILABLE
}

def log_error(error: Exception, context: str, user_id: Optional[int] = None):
    """Log error with context information."""
    logger.error(f"Error in {context}: {str(error)}")
    if user_id:
        logger.error(f"User ID: {user_id}")
    logger.error(f"Exception type: {type(error)}")
    logger.error(f"Traceback: {traceback.format_exc()}")

def create_http_exception(
    error_type: str,
    message: str,
    status_code: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None
) -> HTTPException:
    """Create HTTP exception with standardized error handling."""
    if status_code is None:
        status_code = ERROR_STATUS_CODES.get(error_type, status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    logger.error(f"HTTP Exception: {error_type} - {message}")
    if details:
        logger.error(f"Error details: {details}")
    
    return HTTPException(
        status_code=status_code,
        detail=message
    ) 
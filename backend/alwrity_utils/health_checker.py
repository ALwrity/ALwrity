"""
Health Check Module
Handles health check endpoints and database health verification.
"""

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime
from typing import Dict, Any
from loguru import logger


class HealthChecker:
    """Manages health check functionality for ALwrity backend."""
    
    def __init__(self):
        self.startup_time = datetime.utcnow()
    
    def basic_health_check(self) -> Dict[str, Any]:
        """Basic health check endpoint."""
        try:
            return {
                "status": "healthy",
                "message": "ALwrity backend is running",
                "timestamp": datetime.utcnow().isoformat(),
                "uptime": str(datetime.utcnow() - self.startup_time)
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def database_health_check(self) -> Dict[str, Any]:
        """Report that this public endpoint does not verify tenant DB connectivity."""
        return {
            "status": "not_verified",
            "database_connectivity": "not_verified",
            "scope": "public",
            "authenticated_tenant_check_required": True,
            "message": (
                "Tenant database connectivity is not verified by this public "
                "endpoint. Use an authenticated tenant-scoped health check."
            ),
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    def database_health_response(self) -> JSONResponse:
        """Return unavailable for database readiness that requires tenant context."""
        return JSONResponse(
            status_code=503,
            content=self.database_health_check(),
        )

    def comprehensive_health_check(self) -> Dict[str, Any]:
        """Comprehensive health check including all services."""
        try:
            # Basic health
            basic_health = self.basic_health_check()
            
            # Database health
            db_health = self.database_health_check()
            
            # Determine overall status
            overall_status = "healthy"
            if basic_health["status"] != "healthy" or db_health["status"] == "error":
                overall_status = "unhealthy"
            elif db_health["status"] in {"warning", "not_verified"}:
                overall_status = "degraded"
            
            return {
                "status": overall_status,
                "basic": basic_health,
                "database": db_health,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Comprehensive health check failed: {e}")
            return {
                "status": "error",
                "message": f"Comprehensive health check failed: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }

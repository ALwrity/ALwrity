"""
Health Check Module
Handles health check endpoints and database health verification.
"""

from fastapi import HTTPException
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
        """Database health check endpoint including persona tables verification."""
        try:
            from services.database import get_db_session
            # E.4: the legacy WritingPersona/PlatformPersona/PersonaAnalysisResult/
            # PersonaValidationResult tables were retired. The SSOT persona store is
            # now OnboardingSession + PersonaData (models.onboarding).
            from models.onboarding import OnboardingSession, PersonaData

            session = get_db_session()
            if not session:
                return {
                    "status": "error", 
                    "message": "Could not get database session",
                    "timestamp": datetime.utcnow().isoformat()
                }
            
            # Test the SSOT persona tables
            tables_status = {}
            try:
                session.query(OnboardingSession).first()
                tables_status["onboarding_sessions"] = "ok"
            except Exception as e:
                tables_status["onboarding_sessions"] = f"error: {str(e)}"
            
            try:
                session.query(PersonaData).first()
                tables_status["persona_data"] = "ok"
            except Exception as e:
                tables_status["persona_data"] = f"error: {str(e)}"
            
            session.close()
            
            # Check if all tables are ok
            all_ok = all(status == "ok" for status in tables_status.values())
            
            return {
                "status": "healthy" if all_ok else "warning",
                "message": "Database connection successful" if all_ok else "Some persona tables may have issues",
                "persona_tables": tables_status,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {
                "status": "error",
                "message": f"Database health check failed: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
    
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
            elif db_health["status"] == "warning":
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

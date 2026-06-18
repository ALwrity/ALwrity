"""
Database-only Onboarding Progress Service
Replaces file-based progress tracking with database-only implementation.
Refactored to use direct DB access and eliminate legacy OnboardingDatabaseService dependency.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from services.database import SessionLocal, get_session_for_user
from models.onboarding import OnboardingSession


class OnboardingProgressService:
    """Database-only onboarding progress management."""
    
    def __init__(self):
        from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
        self.integration_service = OnboardingDataIntegrationService()
    
    def get_completion_data(self, user_id: str) -> Dict[str, Any]:
        """Get full completion data for all steps using SSOT."""
        try:
            db = get_session_for_user(user_id)
            try:
                # Use SSOT integration service to get all data
                integrated_data = self.integration_service.get_integrated_data_sync(user_id, db)
                
                # Map to format expected by StepManagementService
                return {
                    "api_keys": integrated_data.get('api_keys_data', {}),
                    "website_analysis": integrated_data.get('website_analysis', {}),
                    "research_preferences": integrated_data.get('research_preferences', {}),
                    "persona_data": integrated_data.get('persona_data', {}),
                    "onboarding_session": integrated_data.get('onboarding_session', {})
                }
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error getting completion data: {e}")
            return {}

    def get_onboarding_status(self, user_id: str) -> Dict[str, Any]:
        """Get current onboarding status from database."""
        try:
            db = get_session_for_user(user_id)
            try:
                # Direct DB access to SSOT session
                session = db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()

                # Fallback for sanitized/derived IDs (e.g., workspace-safe IDs)
                # by comparing normalized IDs from existing onboarding rows.
                if not session:
                    normalized_requested = ''.join(c for c in str(user_id) if c.isalnum() or c in ('-', '_'))
                    candidate_sessions = db.query(OnboardingSession).all()
                    for candidate in candidate_sessions:
                        candidate_user_id = str(candidate.user_id or '')
                        normalized_candidate = ''.join(
                            c for c in candidate_user_id if c.isalnum() or c in ('-', '_')
                        )
                        if normalized_candidate == normalized_requested:
                            session = candidate
                            break

                if not session:
                    return {
                        "is_completed": False,
                        "current_step": 0,
                        "completion_percentage": 0.0,
                        "started_at": None,
                        "last_updated": None,
                        "completed_at": None
                    }
                
                # Check if onboarding is complete
                # Consider complete if either the final step is reached OR progress hit 100%
                is_completed = (session.current_step >= 6) or (session.progress >= 100.0)
                
                return {
                    "is_completed": is_completed,
                    "current_step": session.current_step,
                    "completion_percentage": session.progress,
                    "started_at": session.started_at.isoformat() if session.started_at else None,
                    "last_updated": session.updated_at.isoformat() if session.updated_at else None,
                    "completed_at": session.updated_at.isoformat() if is_completed else None
                }
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error getting onboarding status: {e}")
            return {
                "is_completed": False,
                "current_step": 0,
                "completion_percentage": 0.0,
                "started_at": None,
                "last_updated": None,
                "completed_at": None
            }
    
    def update_step(self, user_id: str, step_number: int) -> bool:
        """Update current step in database."""
        try:
            db = get_session_for_user(user_id)
            try:
                session = db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()
                if not session:
                    # Create session if not exists
                    session = OnboardingSession(
                        user_id=user_id,
                        current_step=step_number,
                        progress=0.0,
                        started_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    db.add(session)
                else:
                    session.current_step = step_number
                    session.updated_at = datetime.utcnow()
                
                db.commit()
                logger.info(f"Updated user {user_id} to step {step_number}")
                return True
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error updating step: {e}")
            return False
    
    def update_progress(self, user_id: str, progress_percentage: float) -> bool:
        """Update progress percentage in database."""
        try:
            db = get_session_for_user(user_id)
            try:
                session = db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()
                if session:
                    session.progress = progress_percentage
                    session.updated_at = datetime.utcnow()
                    db.commit()
                    logger.info(f"Updated user {user_id} progress to {progress_percentage}%")
                    return True
                return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error updating progress: {e}")
            return False
    
    def complete_onboarding(self, user_id: str) -> bool:
        """Mark onboarding as complete in database."""
        try:
            db = get_session_for_user(user_id)
            try:
                session = db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()
                if session:
                    session.progress = 100.0
                    session.current_step = 6  # Assuming 6 is complete
                    session.updated_at = datetime.utcnow()
                    db.commit()
                    return True
                return False
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error completing onboarding: {e}")
            return False
    
    def reset_onboarding(self, user_id: str, hard: bool = False) -> bool:
        """Reset onboarding progress and cancel/pause all scheduled tasks for the user.

        Args:
            user_id: The user to reset.
            hard: If True, delete all session & task records for a clean slate.
                  If False (default), just reset step to 1 and pause tasks.
        """
        try:
            if hard:
                self._hard_reset(user_id)
            else:
                db = get_session_for_user(user_id)
                try:
                    session = db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()
                    if session:
                        session.current_step = 0
                        session.progress = 0.0
                        session.updated_at = datetime.utcnow()
                    db.commit()
                finally:
                    db.close()
                self._cancel_scheduled_tasks(user_id)

            logger.info(f"{'Hard' if hard else 'Soft'} reset onboarding for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error resetting onboarding for user {user_id}: {e}")
            return False

    def _hard_reset(self, user_id: str):
        """Delete all onboarding data and task records for a clean slate."""
        db = get_session_for_user(user_id)
        try:
            # 1. Delete onboarding session (cascades to website_analyses,
            #    api_keys, research_preferences, persona_data,
            #    competitor_analyses, platform_integrations)
            db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).delete()
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Could not delete onboarding session for user {user_id}: {e}")
        finally:
            db.close()

        # 2. Delete scheduled monitoring task records
        task_table_groups = [
            # (task_model, execution_log_model) — logs cascade via relationship
            ("models.website_analysis_monitoring_models", [
                "OnboardingFullWebsiteAnalysisTask",
                "DeepCompetitorAnalysisTask",
                "SIFIndexingTask",
                "MarketTrendsTask",
                "WebsiteAnalysisTask",
                "DeepWebsiteCrawlTask",
            ]),
            ("models.advertools_monitoring_models", ["AdvertoolsTask"]),
            ("models.oauth_token_monitoring_models", ["OAuthTokenMonitoringTask"]),
        ]

        for mod_path, class_names in task_table_groups:
            try:
                mod = __import__(mod_path, fromlist=class_names)
                for cls_name in class_names:
                    cls = getattr(mod, cls_name, None)
                    if cls is None:
                        continue
                    try:
                        inner_db = get_session_for_user(user_id)
                        try:
                            inner_db.query(cls).filter(cls.user_id == user_id).delete()
                            inner_db.commit()
                        except Exception as e:
                            inner_db.rollback()
                            logger.warning(f"Could not delete {cls_name} for user {user_id}: {e}")
                        finally:
                            inner_db.close()
                    except Exception as e:
                        logger.warning(f"Could not delete {cls_name} for user {user_id}: {e}")
            except Exception as e:
                logger.warning(f"Could not import {mod_path} for hard reset: {e}")
    
    def _cancel_scheduled_tasks(self, user_id: str):
        """Pause all DB-backed scheduled tasks for a user after onboarding reset."""
        try:
            from models.website_analysis_monitoring_models import (
                OnboardingFullWebsiteAnalysisTask,
                DeepCompetitorAnalysisTask,
                SIFIndexingTask,
                MarketTrendsTask,
                WebsiteAnalysisTask,
            )
            from models.advertools_monitoring_models import AdvertoolsTask
            
            db = get_session_for_user(user_id)
            try:
                task_models = [
                    OnboardingFullWebsiteAnalysisTask,
                    DeepCompetitorAnalysisTask,
                    SIFIndexingTask,
                    MarketTrendsTask,
                    WebsiteAnalysisTask,
                ]
                try:
                    task_models.append(AdvertoolsTask)
                except Exception:
                    pass

                paused_count = 0
                for model_cls in task_models:
                    try:
                        active_tasks = db.query(model_cls).filter(
                            model_cls.user_id == user_id,
                            model_cls.status == "active"
                        ).all()
                        for task in active_tasks:
                            task.status = "paused"
                            paused_count += 1
                    except Exception as e:
                        logger.warning(f"Could not pause {model_cls.__tablename__} tasks for user {user_id}: {e}")

                db.commit()
                if paused_count > 0:
                    logger.info(f"Paused {paused_count} scheduled tasks for user {user_id} after onboarding reset")
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Failed to cancel scheduled tasks for user {user_id}: {e}")

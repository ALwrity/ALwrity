"""
Progressive Setup Service
Handles progressive backend initialization based on user onboarding progress.
"""

import os
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy import text

from services.user_workspace_manager import UserWorkspaceManager

class ProgressiveSetupService:
    """Manages progressive backend setup based on user progress."""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.workspace_manager = UserWorkspaceManager(db_session)
    
    def initialize_user_environment(self, user_id: str) -> Dict[str, Any]:
        """Initialize user environment based on their onboarding progress."""
        try:
            logger.info(f"Initializing environment for user {user_id}")
            
            # Get user's onboarding progress (migrated step numbers)
            from services.onboarding.progress_service import OnboardingProgressService
            status = OnboardingProgressService().get_onboarding_status(user_id)
            current_step = status.get('current_step', 0)
            
            # Create or get user workspace
            workspace = self.workspace_manager.get_user_workspace(user_id)
            if not workspace:
                workspace = self.workspace_manager.create_user_workspace(user_id)
            
            # Set up features progressively
            setup_status = self.workspace_manager.setup_progressive_features(user_id, current_step)
            
            # Initialize user-specific services
            services_status = self._initialize_user_services(user_id, current_step)
            
            return {
                "user_id": user_id,
                "onboarding_step": current_step,
                "workspace": workspace,
                "setup_status": setup_status,
                "services": services_status,
                "initialized_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error initializing user environment: {e}")
            raise
    
    def _initialize_user_services(self, user_id: str, step: int) -> Dict[str, Any]:
        """Initialize user-specific services based on onboarding step."""
        services = {
            "ai_services": {"enabled": False, "services": []},
            "content_services": {"enabled": False, "services": []},
            "research_services": {"enabled": False, "services": []},
            "integration_services": {"enabled": False, "services": []}
        }
        
        try:
            # Step 1: AI + Content Services (Connect Platforms)
            if step >= 1:
                services["ai_services"]["enabled"] = True
                services["ai_services"]["services"] = ["gemini", "exa", "copilotkit"]
                self._setup_user_ai_services(user_id)
                services["content_services"]["enabled"] = True
                services["content_services"]["services"] = ["content_analysis", "style_detection"]
                self._setup_user_content_services(user_id)
            
            # Step 2: Research Services
            if step >= 2:
                services["research_services"]["enabled"] = True
                services["research_services"]["services"] = ["web_research", "fact_checking"]
                self._setup_user_research_services(user_id)
            
            # Step 4: Integration Services (Finish)
            if step >= 4:
                services["integration_services"]["enabled"] = True
                services["integration_services"]["services"] = ["wix", "linkedin", "wordpress"]
                self._setup_user_integration_services(user_id)
            
            return services
            
        except Exception as e:
            logger.error(f"Error initializing user services: {e}")
            return services
    
    def _setup_user_ai_services(self, user_id: str):
        """Set up AI services for the user."""
        # Create user-specific AI service configuration
        user_config = {
            "gemini": {
                "enabled": True,
                "model": "gemini-pro",
                "max_tokens": 4000,
                "temperature": 0.7
            },
            "exa": {
                "enabled": True,
                "search_depth": "standard",
                "max_results": 10
            },
            "copilotkit": {
                "enabled": True,
                "assistant_type": "content",
                "context_window": 8000
            }
        }
        
        # Store in user workspace
        self.workspace_manager.update_user_config(user_id, {
            "ai_services": user_config
        })
    
    def _setup_user_content_services(self, user_id: str):
        """Set up content services for the user."""
        # Create content analysis configuration
        content_config = {
            "style_analysis": {
                "enabled": True,
                "analysis_depth": "comprehensive"
            },
            "content_generation": {
                "enabled": True,
                "templates": ["blog", "social", "email"]
            },
            "quality_checking": {
                "enabled": True,
                "checks": ["grammar", "tone", "readability"]
            }
        }
        
        self.workspace_manager.update_user_config(user_id, {
            "content_services": content_config
        })
    
    def _setup_user_research_services(self, user_id: str):
        """Set up research services for the user."""
        # Create research configuration
        research_config = {
            "web_research": {
                "enabled": True,
                "sources": ["exa", "serper"],
                "max_results": 20
            },
            "fact_checking": {
                "enabled": True,
                "verification_level": "standard"
            },
            "content_validation": {
                "enabled": True,
                "checks": ["accuracy", "relevance", "freshness"]
            }
        }
        
        self.workspace_manager.update_user_config(user_id, {
            "research_services": research_config
        })
    
    def _setup_user_integration_services(self, user_id: str):
        """Set up integration services for the user."""
        # Create integration configuration
        integration_config = {
            "wix": {
                "enabled": False,
                "connected": False,
                "auto_publish": False
            },
            "linkedin": {
                "enabled": False,
                "connected": False,
                "auto_schedule": False
            },
            "wordpress": {
                "enabled": False,
                "connected": False,
                "auto_publish": False
            }
        }
        
        self.workspace_manager.update_user_config(user_id, {
            "integration_services": integration_config
        })
    
    def get_user_environment_status(self, user_id: str) -> Dict[str, Any]:
        """Get current user environment status."""
        try:
            workspace = self.workspace_manager.get_user_workspace(user_id)
            if not workspace:
                return {"error": "User workspace not found"}
            
            from services.onboarding.progress_service import OnboardingProgressService
            progress = OnboardingProgressService().get_onboarding_status(user_id)
            
            return {
                "user_id": user_id,
                "onboarding_step": progress.get('current_step'),
                "workspace_exists": True,
                "workspace_path": workspace["workspace_path"],
                "config": workspace["config"],
                "last_updated": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting user environment status: {e}")
            return {"error": str(e)}
    
    def upgrade_user_environment(self, user_id: str, new_step: int) -> Dict[str, Any]:
        """Upgrade user environment when they progress in onboarding."""
        try:
            logger.info(f"Upgrading environment for user {user_id} to step {new_step}")
            
            # Get current status
            current_status = self.get_user_environment_status(user_id)
            current_step = current_status.get("onboarding_step", 1)
            
            if new_step <= current_step:
                return {"message": "No upgrade needed", "current_step": current_step}
            
            # Set up new features
            setup_status = self.workspace_manager.setup_progressive_features(user_id, new_step)
            services_status = self._initialize_user_services(user_id, new_step)
            
            return {
                "user_id": user_id,
                "upgraded_from_step": current_step,
                "upgraded_to_step": new_step,
                "new_features": setup_status["features_enabled"],
                "services": services_status,
                "upgraded_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error upgrading user environment: {e}")
            raise
    
    def cleanup_user_environment(self, user_id: str) -> bool:
        """Clean up user environment (for account deletion)."""
        try:
            return self.workspace_manager.cleanup_user_workspace(user_id)
        except Exception as e:
            logger.error(f"Error cleaning up user environment: {e}")
            return False

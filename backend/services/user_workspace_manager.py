"""
User Workspace Manager
Handles user-specific workspace creation, configuration, and progressive setup.
"""

import os
import json
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy import text

from services.database import WORKSPACE_DIR, init_user_database, ensure_user_workspace_db_directory
from services.workspace_dirs import ensure_user_workspace_dirs
from services.workspace_paths import get_workspace_root, get_user_workspace_dir

class UserWorkspaceManager:
    """Manages user-specific workspaces and progressive setup."""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        # Use shared workspace root authority for all environments.
        self.base_workspace_dir = get_workspace_root()
        self.user_workspaces_dir = self.base_workspace_dir
        
    def _sanitize_user_id(self, user_id: str) -> str:
        """Sanitize user_id to be safe for filesystem (matches database.py logic)."""
        return "".join(c for c in user_id if c.isalnum() or c in ('-', '_'))

    def _ensure_workspace_db_directory(self, user_id: str) -> None:
        """Ensure workspace uses canonical `db/` layout via database service authority."""
        ensure_user_workspace_db_directory(user_id)


    def create_user_workspace(self, user_id: str) -> Dict[str, Any]:
        """Create a complete user workspace with progressive setup."""
        try:
            logger.info(f"Creating workspace for user {user_id}")

            production_env = bool(os.getenv("RENDER") or os.getenv("RAILWAY") or os.getenv("HEROKU"))
            filesystem_minimal_mode = bool(os.getenv("ALWRITY_FILESYSTEM_MINIMAL_MODE"))
            mode = "filesystem_minimal" if filesystem_minimal_mode else ("production" if production_env else "development")

            user_dir = get_user_workspace_dir(user_id)
            user_dir.mkdir(parents=True, exist_ok=True)
            self._ensure_workspace_db_directory(user_id)
            user_dir = ensure_user_workspace_dirs(
                user_id,
                capabilities={"core", "content", "research", "media", "assets"},
            )

            config = self._create_user_config(user_id)
            config_file = user_dir / "config" / "user_config.json"
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2)

            try:
                init_user_database(user_id)
            except Exception as db_err:
                logger.error(f"Failed to initialize user database: {db_err}")
                raise db_err

            dirs_created = ["db", "assets", "media", "content", "config/user_config.json"]
            logger.info(
                "User workspace created",
                mode=mode,
                workspace_path=str(user_dir),
                dirs_created=dirs_created,
            )
            return {
                "user_id": user_id,
                "workspace_path": str(user_dir),
                "config": config,
                "created_at": datetime.now().isoformat(),
                "mode": mode,
                "dirs_created": dirs_created,
            }

        except Exception as e:
            logger.error(f"Error creating user workspace: {e}")
            raise
    
    def _create_user_config(self, user_id: str) -> Dict[str, Any]:
        """Create user-specific configuration."""
        return {
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "onboarding_completed": False,
            "api_keys": {
                "gemini": None,
                "exa": None,
                "copilotkit": None
            },
            "preferences": {
                "research_depth": "standard",
                "content_types": ["blog", "social"],
                "auto_research": True
            },
            "workspace_settings": {
                "max_content_items": 1000,
                "cache_duration_hours": 24,
                "export_formats": ["json", "csv", "pdf"]
            }
        }
    
    def _create_user_database_tables(self, user_id: str):
        """Create user-specific database tables."""
        try:
            # Create user-specific content tables
            user_tables = [
                f"user_{user_id}_content_items",
                f"user_{user_id}_research_cache", 
                f"user_{user_id}_ai_analyses",
                f"user_{user_id}_exports"
            ]
            
            for table in user_tables:
                create_sql = f"""
                CREATE TABLE IF NOT EXISTS {table} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id VARCHAR(50) NOT NULL,
                    data JSON,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
                self.db.execute(text(create_sql))
            
            self.db.commit()
            logger.info(f"✅ User-specific tables created for user {user_id}")
            
        except Exception as e:
            logger.error(f"Error creating user database tables: {e}")
            self.db.rollback()
            raise
    
    def get_user_workspace(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user workspace information."""
        safe_user_id = self._sanitize_user_id(user_id)
        user_dir = get_user_workspace_dir(user_id)
        
        if not user_dir.exists():
            return None
            
        config_file = user_dir / "config" / "user_config.json"
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            return {
                "user_id": user_id,
                "workspace_path": str(user_dir),
                "config": config
            }
        return None
    
    def update_user_config(self, user_id: str, updates: Dict[str, Any]) -> bool:
        """Update user configuration."""
        try:
            safe_user_id = self._sanitize_user_id(user_id)
            user_dir = get_user_workspace_dir(user_id)
            config_file = user_dir / "config" / "user_config.json"
            
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                # Deep merge updates
                self._deep_merge(config, updates)
                
                with open(config_file, 'w', encoding='utf-8') as f:
                    json.dump(config, f, indent=2)
                
                logger.info(f"✅ User config updated for user {user_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Error updating user config: {e}")
            return False
    
    def _deep_merge(self, base: Dict, updates: Dict):
        """Deep merge two dictionaries."""
        for key, value in updates.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value
    
    def setup_progressive_features(self, user_id: str, onboarding_step: int) -> Dict[str, Any]:
        """Set up features progressively based on onboarding progress."""
        setup_status = {
            "user_id": user_id,
            "step": onboarding_step,
            "features_enabled": [],
            "tables_created": [],
            "services_initialized": []
        }
        
        try:
            # Step 1: API Keys - Enable basic AI services
            if onboarding_step >= 1:
                self._setup_ai_services(user_id)
                setup_status["features_enabled"].append("ai_services")
                setup_status["services_initialized"].append("gemini")
                setup_status["services_initialized"].append("exa")
                setup_status["services_initialized"].append("copilotkit")
            
            # Step 2: Website Analysis - Enable content analysis
            if onboarding_step >= 2:
                # Tables are created by init_user_database
                setup_status["features_enabled"].append("content_analysis")
            
            # Step 3: Research - Enable research capabilities
            if onboarding_step >= 3:
                # Tables are created by init_user_database
                setup_status["features_enabled"].append("research_services")
            
            # Step 4: Personalization - Enable user-specific features
            if onboarding_step >= 4:
                # Tables are created by init_user_database
                setup_status["features_enabled"].append("personalization")
            
            # Step 5: Integrations - Enable external integrations
            if onboarding_step >= 5:
                self._setup_integrations(user_id)
                setup_status["features_enabled"].append("integrations")
                setup_status["services_initialized"].append("wix")
                setup_status["services_initialized"].append("linkedin")
            
            # Step 6: Complete - Enable all features
            if onboarding_step >= 6:
                self._setup_complete_features(user_id)
                setup_status["features_enabled"].append("all_features")
            
            logger.info(f"✅ Progressive setup completed for user {user_id} at step {onboarding_step}")
            return setup_status
            
        except Exception as e:
            logger.error(f"Error in progressive setup: {e}")
            raise
    
    def _setup_ai_services(self, user_id: str):
        """Set up AI services for the user."""
        # Create user-specific AI service configuration
        user_dir = ensure_user_workspace_dirs(user_id, capabilities={"ai_services"})
        ai_config = user_dir / "config" / "ai_services.json"
        
        ai_services = {
            "gemini": {"enabled": True, "model": "gemini-pro"},
            "exa": {"enabled": True, "search_depth": "standard"},
            "copilotkit": {"enabled": True, "assistant_type": "content"}
        }
        
        with open(ai_config, 'w', encoding='utf-8') as f:
            json.dump(ai_services, f, indent=2)
    
    def _setup_content_analysis(self, user_id: str):
        """Set up content analysis capabilities."""
        # Tables handled by database.py init_user_database
        pass
    
    def _setup_research_services(self, user_id: str):
        """Set up research services."""
        # Tables handled by database.py init_user_database
        pass
    
    def _setup_personalization(self, user_id: str):
        """Set up personalization features."""
        # Tables handled by database.py init_user_database
        pass
    
    def _setup_integrations(self, user_id: str):
        """Set up external integrations."""
        # Create integrations configuration
        user_dir = ensure_user_workspace_dirs(user_id, capabilities={"integrations"})
        integrations_config = user_dir / "config" / "integrations.json"
        
        integrations = {
            "wix": {"enabled": False, "connected": False},
            "linkedin": {"enabled": False, "connected": False},
            "wordpress": {"enabled": False, "connected": False}
        }
        
        with open(integrations_config, 'w', encoding='utf-8') as f:
            json.dump(integrations, f, indent=2)
    
    def _setup_complete_features(self, user_id: str):
        """Set up complete feature set."""
        # Create comprehensive workspace
        user_dir = ensure_user_workspace_dirs(user_id, capabilities={"core", "content", "research", "media", "assets"})

        # Create additional directories for complete setup
        complete_dirs = ["ai_models", "content_templates", "export_templates", "backup"]
        for dir_name in complete_dirs:
            (user_dir / dir_name).mkdir(parents=True, exist_ok=True)
        
        # Create final configuration
        final_config = {
            "setup_complete": True,
            "all_features_enabled": True,
            "last_updated": datetime.now().isoformat()
        }
        
        self.update_user_config(user_id, final_config)
    
    def cleanup_user_workspace(self, user_id: str) -> bool:
        """Clean up user workspace (for account deletion)."""
        try:
            safe_user_id = self._sanitize_user_id(user_id)
            user_dir = get_user_workspace_dir(user_id)
            if user_dir.exists():
                shutil.rmtree(user_dir)
            
            # Note: We do not drop tables here because each user has their own DB file
            # inside workspace/workspace_{id}/db/. Deleting the workspace folder
            # deletes the DB file as well.
            
            logger.info(f"✅ User workspace cleaned up for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error cleaning up user workspace: {e}")
            return False

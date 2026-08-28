"""
Podcast Service

Service layer for managing podcast project persistence.
"""

import os
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from typing import Optional, List, Dict, Any
from datetime import datetime

from models.podcast_models import PodcastProject
from services.podcast_bible_service import PodcastBibleService


class PodcastService:
    """Service for managing podcast projects."""
    
    def __init__(self, db: Session):
        self.db = db
        self.bible_service = PodcastBibleService()
        try:
            from services.podcast_schema_utils import ensure_podcast_projects_columns
            ensure_podcast_projects_columns(self.db)
        except Exception:
            pass
    
    def create_project(
        self,
        user_id: str,
        project_id: str,
        idea: str,
        duration: int,
        speakers: int,
        budget_cap: float,
        **kwargs
    ) -> PodcastProject:
        """Create a new podcast project."""
        # Generate Podcast Bible in full mode only — skip in podcast-only mode
        bible_data = None
        if os.getenv("ALWRITY_ENABLED_FEATURES", "").strip().lower() != "podcast":
            try:
                bible = self.bible_service.generate_bible(user_id, project_id)
                bible_data = bible.model_dump() if bible else None
            except Exception:
                pass  # Bible is optional, project creation continues regardless
        
        project = PodcastProject(
            project_id=project_id,
            user_id=user_id,
            idea=idea,
            duration=duration,
            speakers=speakers,
            budget_cap=budget_cap,
            bible=bible_data,
            status="draft",
            current_step="create",
            **kwargs
        )
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project
    
    def get_project(self, user_id: str, project_id: str) -> Optional[PodcastProject]:
        """Get a project by ID, ensuring user ownership."""
        return self.db.query(PodcastProject).filter(
            and_(
                PodcastProject.project_id == project_id,
                PodcastProject.user_id == user_id
            )
        ).first()
    
    def get_project_by_idea(self, user_id: str, idea: str) -> Optional[PodcastProject]:
        """Find a project by matching idea (case-insensitive, partial match)."""
        # Normalize idea for comparison
        normalized_idea = idea.strip().lower()
        return self.db.query(PodcastProject).filter(
            and_(
                PodcastProject.user_id == user_id,
                PodcastProject.idea.ilike(f"%{normalized_idea}%")
            )
        ).order_by(desc(PodcastProject.updated_at)).first()
    
    def update_project(
        self,
        user_id: str,
        project_id: str,
        **updates
    ) -> Optional[PodcastProject]:
        """Update project fields."""
        from loguru import logger
        updated_fields = list(updates.keys()) if isinstance(updates, dict) else []
        logger.warning(f"[PodcastService] update_project: user_id={user_id}, project_id={project_id}, fields={updated_fields}")
        
        project = self.get_project(user_id, project_id)
        if not project:
            logger.warning(f"[PodcastService] update_project: project not found")
            return None
        
        # Update fields
        for key, value in updates.items():
            if hasattr(project, key):
                setattr(project, key, value)
            else:
                logger.warning(f"[PodcastService] update_project: field '{key}' not in model")
        
        project.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(project)
        logger.warning(f"[PodcastService] update_project: success")
        return project
    
    def list_projects(
        self,
        user_id: str,
        status: Optional[str] = None,
        favorites_only: bool = False,
        limit: int = 50,
        offset: int = 0,
        order_by: str = "updated_at"  # "updated_at" or "created_at"
    ) -> tuple[List[PodcastProject], int]:
        """List user's projects with optional filtering."""
        query = self.db.query(PodcastProject).filter(
            PodcastProject.user_id == user_id
        )
        
        # Apply filters
        if status:
            query = query.filter(PodcastProject.status == status)
        
        if favorites_only:
            query = query.filter(PodcastProject.is_favorite == True)
        
        # Get total count before pagination
        total = query.count()
        
        # Apply ordering
        if order_by == "created_at":
            query = query.order_by(desc(PodcastProject.created_at))
        else:
            query = query.order_by(desc(PodcastProject.updated_at))
        
        # Apply pagination
        projects = query.offset(offset).limit(limit).all()
        
        return projects, total
    
    def delete_project(self, user_id: str, project_id: str) -> bool:
        """Delete a project."""
        project = self.get_project(user_id, project_id)
        if not project:
            return False
        
        self.db.delete(project)
        self.db.commit()
        return True
    
    def toggle_favorite(self, user_id: str, project_id: str) -> Optional[PodcastProject]:
        """Toggle favorite status of a project."""
        project = self.get_project(user_id, project_id)
        if not project:
            return None
        
        project.is_favorite = not project.is_favorite
        project.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(project)
        return project
    
    def update_status(self, user_id: str, project_id: str, status: str) -> Optional[PodcastProject]:
        """Update project status."""
        return self.update_project(user_id, project_id, status=status)


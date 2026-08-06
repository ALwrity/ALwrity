"""
Asset Tracker Utility
Helper utility for modules to easily save generated content to the unified asset library.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from services.content_asset_service import ContentAssetService
from models.content_asset_models import AssetType, AssetSource
import logging
import re
from urllib.parse import urlparse

from models.asset_metadata_schema import validate_asset_metadata

logger = logging.getLogger(__name__)

# Maximum file size (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024

# Allowed URL schemes
ALLOWED_URL_SCHEMES = ['http', 'https', '/']  # Allow relative paths starting with /


def validate_file_url(file_url: str) -> bool:
    """Validate file URL format."""
    if not file_url or not isinstance(file_url, str):
        return False
    
    # Allow relative paths
    if file_url.startswith('/'):
        return True
    
    # Validate absolute URLs
    try:
        parsed = urlparse(file_url)
        return parsed.scheme in ALLOWED_URL_SCHEMES and parsed.netloc
    except Exception:
        return False


def save_asset_to_library(
    db: Session,
    user_id: str,
    asset_type: str,
    source_module: str,
    filename: str,
    file_url: str,
    file_path: Optional[str] = None,
    file_size: Optional[int] = None,
    mime_type: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    prompt: Optional[str] = None,
    tags: Optional[list] = None,
    asset_metadata: Optional[Dict[str, Any]] = None,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    cost: Optional[float] = None,
    generation_time: Optional[float] = None,
) -> Optional[int]:
    """
    Helper function to save a generated asset to the unified asset library.
    
    This can be called from any module (story writer, image studio, etc.)
    to automatically track generated content.
    
    Args:
        db: Database session
        user_id: Clerk user ID
        asset_type: 'text', 'image', 'video', or 'audio'
        source_module: 'story_writer', 'image_studio', 'main_text_generation', etc.
        filename: Original filename
        file_url: Public URL to access the asset
        file_path: Server file path (optional)
        file_size: File size in bytes (optional)
        mime_type: MIME type (optional)
        title: Asset title (optional)
        description: Asset description (optional)
        prompt: Generation prompt (optional)
        tags: List of tags (optional)
        asset_metadata: Additional metadata (optional)
        provider: AI provider used (optional)
        model: Model used (optional)
        cost: Generation cost (optional)
        generation_time: Generation time in seconds (optional)
    
    Returns:
        Asset ID if successful, None otherwise
    """
    try:
        # Validate inputs
        if not user_id or not isinstance(user_id, str):
            logger.error("Invalid user_id provided")
            return None
        
        if not filename or not isinstance(filename, str):
            logger.error("Invalid filename provided")
            return None
        
        if not validate_file_url(file_url):
            logger.error(f"Invalid file_url format: {file_url}")
            return None
        
        if file_size and file_size > MAX_FILE_SIZE:
            logger.warning(f"File size {file_size} exceeds maximum {MAX_FILE_SIZE}")
            # Don't fail, just log warning
        
        # Convert string enums to enum types
        try:
            asset_type_enum = AssetType(asset_type.lower())
        except ValueError:
            logger.warning(f"Invalid asset type: {asset_type}, defaulting to 'text'")
            asset_type_enum = AssetType.TEXT
        
        try:
            source_module_enum = AssetSource(source_module.lower())
        except ValueError:
            logger.warning(f"Invalid source module: {source_module}, attempting fallback based on asset type")
            
            # Smart fallback based on asset type
            if asset_type_enum == AssetType.IMAGE:
                source_module_enum = AssetSource.MAIN_IMAGE_GENERATION
            elif asset_type_enum == AssetType.AUDIO:
                source_module_enum = AssetSource.MAIN_AUDIO_GENERATION
            elif asset_type_enum == AssetType.VIDEO:
                source_module_enum = AssetSource.MAIN_VIDEO_GENERATION
            else:
                source_module_enum = AssetSource.MAIN_TEXT_GENERATION
            
            logger.info(f"Fallback source module: {source_module_enum.value}")
        
        # Sanitize filename (remove path traversal attempts)
        filename = re.sub(r'[^\w\s\-_\.]', '', filename.split('/')[-1])
        if not filename:
            filename = f"asset_{asset_type}_{source_module}.{asset_type}"
        
        # Generate title from filename if not provided
        if not title:
            title = filename.replace('_', ' ').replace('-', ' ').title()
            # Limit title length
            if len(title) > 200:
                title = title[:197] + '...'
        
        metadata_payload = asset_metadata or {}
        is_valid_metadata, validation_message = validate_asset_metadata(metadata_payload)
        if not is_valid_metadata:
            logger.error(f"Invalid asset metadata: {validation_message}")
            return None

        service = ContentAssetService(db)
        asset = service.create_asset(
            user_id=user_id,
            asset_type=asset_type_enum,
            source_module=source_module_enum,
            filename=filename,
            file_url=file_url,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            title=title,
            description=description,
            prompt=prompt,
            tags=tags or [],
            asset_metadata=metadata_payload,
            provider=provider,
            model=model,
            cost=cost,
            generation_time=generation_time,
        )
        
        logger.info(f"✅ Asset saved to library: {asset.id} ({asset_type} from {source_module})")
        
        # Trigger SIF Indexing for all new assets (Text, Image, etc.)
        try:
            from models.website_analysis_monitoring_models import SIFIndexingTask
            from datetime import datetime
            
            # Check if a SIF Indexing task exists for this user
            existing_task = db.query(SIFIndexingTask).filter(SIFIndexingTask.user_id == user_id).first()
            if existing_task:
                logger.info(f"Triggering SIF Indexing task for user {user_id} due to new {asset_type} asset")
                existing_task.next_execution = datetime.utcnow()  # Run immediately
                existing_task.status = "pending"  # Ensure it gets picked up
                db.add(existing_task)
                # Note: Commit depends on the caller's transaction management
            else:
                logger.debug(f"No SIF Indexing task found for user {user_id} - skipping trigger")
        except Exception as e:
            logger.warning(f"Failed to trigger SIF Indexing task in asset_tracker: {e}")
            
        return asset.id
        
    except Exception as e:
        logger.error(f"❌ Error saving asset to library: {str(e)}", exc_info=True)
        return None

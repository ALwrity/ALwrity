"""
LinkedIn Image Storage Service

This service handles image storage, retrieval, and management for LinkedIn image generation.
It provides secure storage, efficient retrieval, and metadata management for generated images.
"""

import os
import re
import hashlib
import json
import shutil
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from pathlib import Path
from PIL import Image
from io import BytesIO
from loguru import logger

# Import existing infrastructure
from ...onboarding.api_key_manager import APIKeyManager


class LinkedInImageStorage:
    """
    Handles storage and management of LinkedIn generated images.
    
    This service provides secure storage, efficient retrieval, metadata management,
    and cleanup functionality for LinkedIn image generation.
    """
    
    def __init__(self, storage_path: Optional[str] = None, api_key_manager: Optional[APIKeyManager] = None):
        """
        Initialize the LinkedIn Image Storage service.
        
        Args:
            storage_path: Base path for image storage
            api_key_manager: API key manager for authentication
        """
        self.api_key_manager = api_key_manager or APIKeyManager()
        
        # Set up storage paths
        if storage_path:
            self.base_storage_path = Path(storage_path)
        else:
            # Default to project-relative path: root/data/media/linkedin_images
            # services/linkedin/image_generation/linkedin_image_storage.py -> image_generation -> linkedin -> services -> backend -> root
            root_dir = Path(__file__).parent.parent.parent.parent.parent
            self.base_storage_path = root_dir / "data" / "media" / "linkedin_images"
        
        # Create storage directories
        self.images_path = self.base_storage_path / "images"
        self.metadata_path = self.base_storage_path / "metadata"
        self.temp_path = self.base_storage_path / "temp"
        
        # Ensure directories exist
        self._create_storage_directories()
        
        # Storage configuration
        self.max_storage_size_gb = 10  # Maximum storage size in GB
        self.image_retention_days = 30  # Days to keep images
        self.max_image_size_mb = 10    # Maximum individual image size in MB
        self.max_images_per_user = 100  # Maximum images per user
        self._uuid_pattern = re.compile(r'^[a-f0-9]{16}$')
        
        logger.info(f"LinkedIn Image Storage initialized at {self.base_storage_path}")
    
    def _create_storage_directories(self):
        """Create necessary storage directories."""
        try:
            self.images_path.mkdir(parents=True, exist_ok=True)
            self.metadata_path.mkdir(parents=True, exist_ok=True)
            self.temp_path.mkdir(parents=True, exist_ok=True)
            
            # Create subdirectories for organization
            (self.images_path / "posts").mkdir(exist_ok=True)
            (self.images_path / "articles").mkdir(exist_ok=True)
            (self.images_path / "carousels").mkdir(exist_ok=True)
            (self.images_path / "video_scripts").mkdir(exist_ok=True)
            
            logger.info("Storage directories created successfully")
            
        except Exception as e:
            logger.error(f"Error creating storage directories: {str(e)}")
            raise
    
    async def store_image(
        self, 
        image_data: bytes, 
        metadata: Dict[str, Any],
        content_type: str = "post",
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Store generated image with metadata.
        
        Args:
            image_data: Image data in bytes
            metadata: Image metadata and context
            content_type: Type of LinkedIn content (post, article, carousel, video_script)
            user_id: Optional user ID for workspace storage
            
        Returns:
            Dict containing storage result and image ID
        """
        try:
            start_time = datetime.now()
            
            # Check per-user storage quota
            if user_id:
                user_count = await self._count_user_images(user_id)
                if user_count >= self.max_images_per_user:
                    return {
                        'success': False,
                        'error': f"User image limit ({self.max_images_per_user}) reached. Delete existing images or increase limit."
                    }
            
            # Check disk space
            if not await self._check_disk_space(len(image_data)):
                return {
                    'success': False,
                    'error': "Insufficient disk space for image storage."
                }
            
            # Generate unique image ID
            image_id = self._generate_image_id(image_data, metadata)
            
            # Validate image data
            validation_result = await self._validate_image_for_storage(image_data)
            if not validation_result['valid']:
                return {
                    'success': False,
                    'error': f"Image validation failed: {validation_result['error']}"
                }
            
            # Determine storage path based on content type
            storage_path = self._get_storage_path(content_type, image_id, user_id)
            
            # Store image file
            image_stored = await self._store_image_file(image_data, storage_path)
            if not image_stored:
                return {
                    'success': False,
                    'error': 'Failed to store image file'
                }
            
            # Store metadata
            metadata_stored = await self._store_metadata(image_id, metadata, storage_path, user_id)
            if not metadata_stored:
                # Clean up image file if metadata storage fails
                await self._cleanup_failed_storage(storage_path)
                return {
                    'success': False,
                    'error': 'Failed to store image metadata'
                }
            
            # Update storage statistics
            await self._update_storage_stats()
            
            storage_time = (datetime.now() - start_time).total_seconds()

            logger.info(
                f"[LinkedInImageGen] Stored image_id={image_id} path={storage_path} "
                f"size={len(image_data)} bytes elapsed={storage_time:.2f}s"
            )
            
            return {
                'success': True,
                'image_id': image_id,
                'storage_path': str(storage_path),
                'metadata': {
                    'stored_at': datetime.now().isoformat(),
                    'storage_time': storage_time,
                    'file_size': len(image_data),
                    'content_type': content_type
                }
            }
            
        except Exception as e:
            logger.error(f"Error storing LinkedIn image: {str(e)}")
            return {
                'success': False,
                'error': f"Image storage failed: {str(e)}"
            }
    
    async def retrieve_image(self, image_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieve stored image by ID.
        
        Args:
            image_id: Unique image identifier
            user_id: Optional user ID to locate the image
            
        Returns:
            Dict containing image data and metadata
        """
        try:
            if not self._validate_image_id(image_id):
                return {'success': False, 'error': f'Invalid image ID format: {image_id}'}
            
            # Find image file
            image_path = await self._find_image_by_id(image_id, user_id)
            if not image_path:
                return {
                    'success': False,
                    'error': f'Image not found: {image_id}'
                }
            
            # Load metadata
            metadata = await self._load_metadata(image_id, user_id)
            if not metadata:
                return {
                    'success': False,
                    'error': f'Metadata not found for image: {image_id}'
                }
            
            # Read image data
            with open(image_path, 'rb') as f:
                image_data = f.read()
            
            return {
                'success': True,
                'image_data': image_data,
                'metadata': metadata,
                'image_path': str(image_path)
            }
            
        except Exception as e:
            logger.error(f"Error retrieving LinkedIn image {image_id}: {str(e)}")
            return {
                'success': False,
                'error': f"Image retrieval failed: {str(e)}"
            }
    
    async def delete_image(self, image_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Delete stored image and metadata.
        
        Args:
            image_id: Unique image identifier
            user_id: Optional user ID to locate the image
            
        Returns:
            Dict containing deletion result
        """
        try:
            if not self._validate_image_id(image_id):
                return {'success': False, 'error': f'Invalid image ID format: {image_id}'}
            
            # Find image file
            image_path = await self._find_image_by_id(image_id, user_id)
            if not image_path:
                return {
                    'success': False,
                    'error': f'Image not found: {image_id}'
                }
            
            # Delete image file
            if image_path.exists():
                image_path.unlink()
                logger.info(f"Deleted image file: {image_path}")
            
            # Delete metadata
            _, metadata_base = self._get_workspace_paths(user_id)
            metadata_path = metadata_base / f"{image_id}.json"
            if metadata_path.exists():
                metadata_path.unlink()
                logger.info(f"Deleted metadata file: {metadata_path}")
            
            # Update storage statistics
            await self._update_storage_stats()
            
            return {
                'success': True,
                'message': f'Image {image_id} deleted successfully'
            }
            
        except Exception as e:
            logger.error(f"Error deleting LinkedIn image {image_id}: {str(e)}")
            return {
                'success': False,
                'error': f"Image deletion failed: {str(e)}"
            }
    
    async def list_images(
        self, 
        content_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        List stored images with optional filtering.
        
        Args:
            content_type: Filter by content type
            limit: Maximum number of images to return
            offset: Number of images to skip
            
        Returns:
            Dict containing list of images and metadata
        """
        try:
            images = []
            
            # Scan metadata directory
            metadata_files = list(self.metadata_path.glob("*.json"))
            
            for metadata_file in metadata_files[offset:offset + limit]:
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                    
                    # Apply content type filter
                    if content_type and metadata.get('content_type') != content_type:
                        continue
                    
                    # Check if image file still exists
                    image_id = metadata_file.stem
                    image_path = await self._find_image_by_id(image_id)
                    
                    if image_path and image_path.exists():
                        # Add file size and last modified info
                        stat = image_path.stat()
                        metadata['file_size'] = stat.st_size
                        metadata['last_modified'] = datetime.fromtimestamp(stat.st_mtime).isoformat()
                        
                        images.append(metadata)
                    
                except Exception as e:
                    logger.warning(f"Error reading metadata file {metadata_file}: {str(e)}")
                    continue
            
            return {
                'success': True,
                'images': images,
                'total_count': len(images),
                'limit': limit,
                'offset': offset
            }
            
        except Exception as e:
            logger.error(f"Error listing LinkedIn images: {str(e)}")
            return {
                'success': False,
                'error': f"Image listing failed: {str(e)}"
            }
    
    async def cleanup_old_images(self, days_old: Optional[int] = None) -> Dict[str, Any]:
        """
        Clean up old images based on retention policy.
        
        Args:
            days_old: Minimum age in days for cleanup (defaults to retention policy)
            
        Returns:
            Dict containing cleanup results
        """
        try:
            if days_old is None:
                days_old = self.image_retention_days
            
            cutoff_date = datetime.now() - timedelta(days=days_old)
            deleted_count = 0
            errors = []
            
            # Scan metadata directory
            metadata_files = list(self.metadata_path.glob("*.json"))
            
            for metadata_file in metadata_files:
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                    
                    # Check creation date
                    created_at = metadata.get('stored_at')
                    if created_at:
                        created_date = datetime.fromisoformat(created_at)
                        if created_date < cutoff_date:
                            # Delete old image
                            image_id = metadata_file.stem
                            delete_result = await self.delete_image(image_id)
                            
                            if delete_result['success']:
                                deleted_count += 1
                            else:
                                errors.append(f"Failed to delete {image_id}: {delete_result['error']}")
                    
                except Exception as e:
                    logger.warning(f"Error processing metadata file {metadata_file}: {str(e)}")
                    continue
            
            return {
                'success': True,
                'deleted_count': deleted_count,
                'errors': errors,
                'cutoff_date': cutoff_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error cleaning up old LinkedIn images: {str(e)}")
            return {
                'success': False,
                'error': f"Cleanup failed: {str(e)}"
            }
    
    async def get_storage_stats(self) -> Dict[str, Any]:
        """
        Get storage statistics and usage information.
        
        Returns:
            Dict containing storage statistics
        """
        try:
            total_size = 0
            total_files = 0
            content_type_counts = {}
            
            # Calculate storage usage
            for content_type_dir in self.images_path.iterdir():
                if content_type_dir.is_dir():
                    content_type = content_type_dir.name
                    content_type_counts[content_type] = 0
                    
                    for image_file in content_type_dir.glob("*"):
                        if image_file.is_file():
                            total_size += image_file.stat().st_size
                            total_files += 1
                            content_type_counts[content_type] += 1
            
            # Check storage limits
            total_size_gb = total_size / (1024 ** 3)
            storage_limit_exceeded = total_size_gb > self.max_storage_size_gb
            
            return {
                'success': True,
                'total_size_bytes': total_size,
                'total_size_gb': round(total_size_gb, 2),
                'total_files': total_files,
                'content_type_counts': content_type_counts,
                'storage_limit_gb': self.max_storage_size_gb,
                'storage_limit_exceeded': storage_limit_exceeded,
                'retention_days': self.image_retention_days
            }
            
        except Exception as e:
            logger.error(f"Error getting storage stats: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to get storage stats: {str(e)}"
            }
    
    def _validate_image_id(self, image_id: str) -> bool:
        """Validate image_id against expected format to prevent path traversal."""
        return bool(self._uuid_pattern.match(image_id))
    
    async def _count_user_images(self, user_id: str) -> int:
        """Count total images stored for a given user."""
        try:
            images_path, _ = self._get_workspace_paths(user_id)
            count = 0
            if images_path.exists():
                for content_dir in images_path.iterdir():
                    if content_dir.is_dir():
                        count += sum(1 for f in content_dir.glob("*.png") if f.is_file())
            return count
        except Exception as e:
            logger.warning(f"Error counting images for user {user_id}: {e}")
            return 0
    
    async def _check_disk_space(self, required_bytes: int) -> bool:
        """Check if sufficient disk space is available."""
        try:
            usage = shutil.disk_usage(self.base_storage_path)
            return usage.free > required_bytes * 2  # require 2x headroom
        except Exception:
            return True  # if we can't check, allow the write
    
    def _generate_image_id(self, image_data: bytes, metadata: Dict[str, Any]) -> str:
        """Generate unique image ID based on content and metadata."""
        # Create hash from image data and key metadata
        hash_input = f"{image_data[:1000]}{metadata.get('topic', '')}{metadata.get('industry', '')}{datetime.now().isoformat()}"
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]
    
    async def _validate_image_for_storage(self, image_data: bytes) -> Dict[str, Any]:
        """Validate image data before storage."""
        try:
            # Check file size
            if len(image_data) > self.max_image_size_mb * 1024 * 1024:
                return {
                    'valid': False,
                    'error': f'Image size {len(image_data) / (1024*1024):.2f}MB exceeds maximum {self.max_image_size_mb}MB'
                }
            
            # Validate image format
            try:
                image = Image.open(BytesIO(image_data))
                if image.format not in ['PNG', 'JPEG', 'JPG']:
                    return {
                        'valid': False,
                        'error': f'Unsupported image format: {image.format}'
                    }
            except Exception as e:
                return {
                    'valid': False,
                    'error': f'Invalid image data: {str(e)}'
                }
            
            return {'valid': True}
            
        except Exception as e:
            return {
                'valid': False,
                'error': f'Validation error: {str(e)}'
            }
    
    def _get_workspace_paths(self, user_id: Optional[str]) -> Tuple[Path, Path]:
        """
        Get images and metadata paths for a user or default global paths.
        Returns (images_path, metadata_path).
        """
        if user_id:
            try:
                # Use local import to avoid circular dependency
                from services.database import get_db
                from services.user_workspace_manager import UserWorkspaceManager
                
                db_gen = get_db()
                db = next(db_gen)
                try:
                    workspace_manager = UserWorkspaceManager(db)
                    workspace = workspace_manager.get_user_workspace(user_id)
                    if workspace:
                        # Align with global structure: linkedin_images/images and linkedin_images/metadata
                        base = Path(workspace['workspace_path']) / "media" / "linkedin_images"
                        return (base / "images", base / "metadata")
                finally:
                    if 'db' in locals():
                        db.close()
            except Exception as e:
                logger.warning(f"Failed to resolve user workspace path: {e}")
        
        return (self.images_path, self.metadata_path)

    def _get_storage_path(self, content_type: str, image_id: str, user_id: Optional[str] = None) -> Path:
        """Get storage path for image based on content type."""
        # Map content types to directory names
        content_type_map = {
            'post': 'posts',
            'article': 'articles',
            'carousel': 'carousels',
            'video_script': 'video_scripts'
        }
        
        directory = content_type_map.get(content_type, 'posts')
        
        images_path, _ = self._get_workspace_paths(user_id)
        return images_path / directory / f"{image_id}.png"
    
    async def _store_image_file(self, image_data: bytes, storage_path: Path) -> bool:
        """Store image file to disk."""
        try:
            # Ensure directory exists
            storage_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write image data
            with open(storage_path, 'wb') as f:
                f.write(image_data)
            
            logger.info(f"Stored image file: {storage_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing image file: {str(e)}")
            return False
    
    async def _store_metadata(self, image_id: str, metadata: Dict[str, Any], storage_path: Path, user_id: Optional[str] = None) -> bool:
        """Store image metadata to JSON file."""
        try:
            # Add storage metadata
            metadata['image_id'] = image_id
            metadata['storage_path'] = str(storage_path)
            metadata['stored_at'] = datetime.now().isoformat()
            
            # Determine metadata path
            _, metadata_base = self._get_workspace_paths(user_id)
            metadata_base.mkdir(parents=True, exist_ok=True)
            
            # Write metadata file
            metadata_path = metadata_base / f"{image_id}.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2, default=str)
            
            logger.info(f"Stored metadata: {metadata_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing metadata: {str(e)}")
            return False
    
    async def _find_image_by_id(self, image_id: str, user_id: Optional[str] = None) -> Optional[Path]:
        """Find image file by ID across all content type directories."""
        images_path, _ = self._get_workspace_paths(user_id)
        
        # If user_id is NOT provided, we might want to check global path only, 
        # OR we might want to check if it's a global image. 
        # Current implementation assumes if user_id is provided, look there.
        # If not provided, look in global.
        
        if images_path.exists():
            for content_dir in images_path.iterdir():
                if content_dir.is_dir():
                    image_path = content_dir / f"{image_id}.png"
                    if image_path.exists():
                        return image_path
        
        return None
    
    async def get_image_metadata(self, image_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get metadata for an image.
        
        Args:
            image_id: Unique image identifier
            user_id: Optional user ID
            
        Returns:
            Dict containing image metadata if found
        """
        if not self._validate_image_id(image_id):
            logger.warning(f"Invalid image ID format in metadata request: {image_id}")
            return None
        return await self._load_metadata(image_id, user_id)

    async def _load_metadata(self, image_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Load metadata for image ID."""
        try:
            _, metadata_base = self._get_workspace_paths(user_id)
            metadata_path = metadata_base / f"{image_id}.json"
            if metadata_path.exists():
                with open(metadata_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading metadata for {image_id}: {str(e)}")
        
        return None
    
    async def _cleanup_failed_storage(self, storage_path: Path):
        """Clean up files if storage operation fails."""
        try:
            if storage_path.exists():
                storage_path.unlink()
                logger.info(f"Cleaned up failed storage: {storage_path}")
        except Exception as e:
            logger.error(f"Error cleaning up failed storage: {str(e)}")
    
    async def _update_storage_stats(self):
        """Update storage statistics (placeholder for future implementation)."""
        # This could be implemented to track storage usage over time
        pass

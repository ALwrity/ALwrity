"""
WordPress OAuth Content Management Module

Mirrors services.integrations.wordpress_content.WordPressContentManager but
authenticates with an OAuth bearer token (stored in wordpress_oauth_tokens)
instead of HTTP Basic auth (username + application password).

Used as the OAuth counterpart of the legacy WordPressContentManager so the
WordPressPublisher can dispatch on whichever credential path resolves for a
given site_id.
"""

import os
import mimetypes
import tempfile
from typing import Optional, Dict, List, Any
import requests
from PIL import Image
from loguru import logger


class WordPressOAuthContentManager:
    """Manages WordPress content operations using an OAuth bearer token."""

    def __init__(self, site_url: str, access_token: str):
        """Initialize with site URL and OAuth access token.

        Args:
            site_url: The WordPress site's base URL (e.g. https://example.com).
                      For self-hosted sites with the WP.com OAuth plugin, the
                      bearer token works against /wp-json/wp/v2. For pure
                      WordPress.com hosted blogs the same /wp-json/wp/v2 API
                      is also available at the blog's domain.
            access_token: A valid OAuth2 bearer access token issued by
                          WordPress.com.
        """
        self.site_url = (site_url or "").rstrip('/')
        self.access_token = access_token
        self.api_base = f"{self.site_url}/wp-json/wp/v2"
        self._auth_headers = {"Authorization": f"Bearer {access_token}"}

    def _make_request(self, method: str, endpoint: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Make authenticated request to WordPress API using OAuth bearer token."""
        try:
            if not self.site_url:
                logger.error("WordPressOAuthContentManager: site_url is empty")
                return None
            url = f"{self.api_base}/{endpoint.lstrip('/')}"
            # Ensure headers include the bearer token; allow callers to override
            # for per-request additions, but never strip the auth.
            headers = dict(self._auth_headers)
            extra_headers = kwargs.pop("headers", None) or {}
            headers.update(extra_headers)
            response = requests.request(method, url, headers=headers, timeout=30, **kwargs)

            if response.status_code in [200, 201]:
                # Some DELETE responses return an empty body
                if not response.content:
                    return {"deleted": True}
                try:
                    return response.json()
                except ValueError:
                    return {"raw": response.text}
            else:
                logger.error(
                    f"WordPress OAuth API error: {response.status_code} - {response.text[:300]}"
                )
                return None
        except Exception as e:
            logger.error(f"WordPress OAuth API request error: {e}")
            return None

    def get_categories(self) -> List[Dict[str, Any]]:
        """Get all categories from WordPress site."""
        try:
            result = self._make_request('GET', 'categories', params={'per_page': 100})
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            return []

    def get_tags(self) -> List[Dict[str, Any]]:
        """Get all tags from WordPress site."""
        try:
            result = self._make_request('GET', 'tags', params={'per_page': 100})
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.error(f"Error getting tags: {e}")
            return []

    def create_category(self, name: str, description: str = "") -> Optional[Dict[str, Any]]:
        """Create a new category."""
        try:
            data = {'name': name, 'description': description}
            return self._make_request('POST', 'categories', json=data)
        except Exception as e:
            logger.error(f"Error creating category {name}: {e}")
            return None

    def create_tag(self, name: str, description: str = "") -> Optional[Dict[str, Any]]:
        """Create a new tag."""
        try:
            data = {'name': name, 'description': description}
            return self._make_request('POST', 'tags', json=data)
        except Exception as e:
            logger.error(f"Error creating tag {name}: {e}")
            return None

    def get_or_create_category(self, name: str, description: str = "") -> Optional[int]:
        """Get existing category or create new one."""
        try:
            categories = self.get_categories()
            for category in categories:
                if category.get('name', '').lower() == name.lower():
                    logger.info(f"Found existing category: {name}")
                    return category.get('id')
            new_category = self.create_category(name, description)
            if new_category and new_category.get('id') is not None:
                return new_category['id']
            return None
        except Exception as e:
            logger.error(f"Error getting or creating category {name}: {e}")
            return None

    def get_or_create_tag(self, name: str, description: str = "") -> Optional[int]:
        """Get existing tag or create new one."""
        try:
            tags = self.get_tags()
            for tag in tags:
                if tag.get('name', '').lower() == name.lower():
                    logger.info(f"Found existing tag: {name}")
                    return tag.get('id')
            new_tag = self.create_tag(name, description)
            if new_tag and new_tag.get('id') is not None:
                return new_tag['id']
            return None
        except Exception as e:
            logger.error(f"Error getting or creating tag {name}: {e}")
            return None

    def upload_media(self, file_path: str, alt_text: str = "", title: str = "",
                     caption: str = "", description: str = "") -> Optional[Dict[str, Any]]:
        """Upload media file to WordPress using OAuth bearer token."""
        try:
            if not os.path.exists(file_path):
                logger.error(f"Media file not found: {file_path}")
                return None

            file_name = os.path.basename(file_path)
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                logger.error(f"Unable to determine MIME type for: {file_path}")
                return None

            headers = {
                'Content-Disposition': f'attachment; filename="{file_name}"',
                **self._auth_headers,
            }

            with open(file_path, 'rb') as file:
                files = {'file': (file_name, file, mime_type)}
                response = requests.post(
                    f"{self.api_base}/media",
                    headers=headers,
                    files=files,
                    timeout=60,
                )

            if response.status_code == 201:
                media_data = response.json()
                media_id = media_data.get('id')
                if not media_id:
                    return media_data

                update_data = {
                    'alt_text': alt_text,
                    'title': title,
                    'caption': caption,
                    'description': description,
                }
                update_response = requests.post(
                    f"{self.api_base}/media/{media_id}",
                    headers=self._auth_headers,
                    json=update_data,
                    timeout=30,
                )
                if update_response.status_code == 200:
                    logger.info(f"Media uploaded successfully: {file_name}")
                    return update_response.json()
                logger.warning(
                    f"Media uploaded but metadata update failed: {update_response.text[:200]}"
                )
                return media_data
            logger.error(f"Media upload failed: {response.status_code} - {response.text[:300]}")
            return None
        except Exception as e:
            logger.error(f"Error uploading media {file_path}: {e}")
            return None

    def compress_image(self, image_path: str, quality: int = 85) -> str:
        """Compress image for better upload performance. Mirrors the legacy helper."""
        try:
            if not os.path.exists(image_path):
                raise ValueError(f"Image file not found: {image_path}")

            original_size = os.path.getsize(image_path)

            with Image.open(image_path) as img:
                img_format = img.format or 'JPEG'
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f'.{img_format.lower()}')
                img.save(temp_file, format=img_format, quality=quality, optimize=True)
                compressed_size = os.path.getsize(temp_file.name)
                reduction = (1 - (compressed_size / original_size)) * 100
                logger.info(
                    f"Image compressed: {original_size/1024:.2f}KB -> {compressed_size/1024:.2f}KB "
                    f"({reduction:.1f}% reduction)"
                )
                return temp_file.name
        except Exception as e:
            logger.error(f"Error compressing image {image_path}: {e}")
            return image_path

    def _test_connection(self) -> bool:
        """Test WordPress site connection via the OAuth bearer token."""
        try:
            api_url = f"{self.api_base}/users/me"
            response = requests.get(api_url, headers=self._auth_headers, timeout=10)
            if response.status_code == 200:
                logger.info(f"WordPress OAuth connection test successful for {self.site_url}")
                return True
            logger.warning(
                f"WordPress OAuth connection test failed for {self.site_url}: {response.status_code}"
            )
            return False
        except Exception as e:
            logger.error(f"WordPress OAuth connection test error for {self.site_url}: {e}")
            return False

    def create_post(self, title: str, content: str, excerpt: str = "",
                    featured_media_id: Optional[int] = None,
                    categories: Optional[List[int]] = None,
                    tags: Optional[List[int]] = None,
                    status: str = 'draft',
                    meta: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Create a new WordPress post via the OAuth bearer token."""
        try:
            post_data: Dict[str, Any] = {
                'title': title,
                'content': content,
                'excerpt': excerpt,
                'status': status,
            }
            if featured_media_id:
                post_data['featured_media'] = featured_media_id
            if categories:
                post_data['categories'] = categories
            if tags:
                post_data['tags'] = tags
            if meta:
                post_data['meta'] = meta

            result = self._make_request('POST', 'posts', json=post_data)
            if result:
                logger.info(f"Post created successfully (OAuth): {title}")
            return result
        except Exception as e:
            logger.error(f"Error creating post {title}: {e}")
            return None

    def update_post(self, post_id: int, **kwargs) -> Optional[Dict[str, Any]]:
        """Update an existing WordPress post."""
        try:
            result = self._make_request('POST', f'posts/{post_id}', json=kwargs)
            if result:
                logger.info(f"Post {post_id} updated successfully (OAuth)")
            return result
        except Exception as e:
            logger.error(f"Error updating post {post_id}: {e}")
            return None

    def delete_post(self, post_id: int, force: bool = False) -> bool:
        """Delete a WordPress post."""
        try:
            params = {'force': force} if force else {}
            result = self._make_request('DELETE', f'posts/{post_id}', params=params)
            if result is None:
                return False
            if isinstance(result, dict) and result.get('deleted') is True:
                logger.info(f"Post {post_id} deleted successfully (OAuth)")
                return True
            # Some WP endpoints return the deleted post object on success
            if isinstance(result, dict) and 'id' in result:
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting post {post_id}: {e}")
            return False

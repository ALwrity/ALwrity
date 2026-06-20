"""
WordPress Publishing Service
High-level service for publishing content to WordPress sites.

Supports two credential paths, tried in order:
1. OAuth (preferred when available): WordPress.com OAuth2 access tokens stored
   in wordpress_oauth_tokens. The site_id passed by the caller is matched
   against the OAuth token row's primary key.
2. Legacy (fallback): username + application password stored in
   wordpress_sites, looked up by site_id.

The two paths coexist to keep previously-working app-password sites
publishing unchanged while unblocking OAuth-only users.
"""

import os
import json
import tempfile
from typing import Optional, Dict, List, Any, Union
from datetime import datetime
from loguru import logger

from .wordpress_service import WordPressService
from .wordpress_content import WordPressContentManager
from .wordpress_oauth_content import WordPressOAuthContentManager
import sqlite3


from services.database import get_user_db_path

class WordPressPublisher:
    """Handles publishing content to WordPress."""
    
    def __init__(self, db_path: str = None):
        # db_path is deprecated
        self.db_path = db_path
        # The legacy credential lookup path is delegated to WordPressService.
        # The previous version of this class expected self.wp_service to be
        # initialised but never set it, causing AttributeError on every
        # publish call. Setting it here restores the legacy path's intended
        # behaviour.
        self.wp_service = WordPressService()

    def _get_db_path(self, user_id: str) -> str:
        return get_user_db_path(user_id)

    def _resolve_oauth_content_manager(self, user_id: str, site_id: int):
        """Try to resolve a WordPressOAuthContentManager for site_id via OAuth tokens.

        Looks up wordpress_oauth_tokens for a row whose primary key matches site_id
        and belongs to user_id, decrypts the access_token, and returns a
        WordPressOAuthContentManager if both blog_url and access_token are usable.

        Returns None when:
        - the OAuth table isn't initialised yet
        - no token row matches (legacy-only user)
        - the token cannot be decrypted
        - blog_url is missing
        """
        try:
            db_path = self._get_db_path(user_id)
        except Exception as e:
            logger.debug(f"WordPress OAuth resolve: cannot resolve db path: {e}")
            return None

        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='wordpress_oauth_tokens'"
                )
                if not cursor.fetchone():
                    return None
                cursor.execute(
                    """
                    SELECT id, user_id, access_token, blog_id, blog_url
                    FROM wordpress_oauth_tokens
                    WHERE id = ? AND user_id = ? AND is_active = 1
                    """,
                    (site_id, user_id),
                )
                row = cursor.fetchone()
        except Exception as e:
            logger.debug(f"WordPress OAuth resolve: query failed: {e}")
            return None

        if not row:
            return None
        _id, _row_user_id, access_token_blob, blog_id, blog_url = row
        if not blog_url or not access_token_blob:
            return None

        # Decrypt access token; reuse WordPressOAuthService so the same Fernet
        # key handling + migration logic applies. We import here to avoid
        # potential circular imports at module load.
        try:
            from .wordpress_oauth import WordPressOAuthService
            oauth_service = WordPressOAuthService()
            status = oauth_service.get_user_token_status(user_id)
            matching = None
            for tok in (status.get('active_tokens') or []):
                if tok.get('id') == site_id:
                    matching = tok
                    break
            if not matching:
                # Token is expired or filtered out; treat as missing
                return None
            decrypted = matching.get('access_token')
            if not decrypted:
                return None
        except Exception as e:
            logger.debug(f"WordPress OAuth resolve: decrypt failed: {e}")
            return None

        logger.info(
            f"WordPress OAuth resolve: matched token id={site_id} for user "
            f"{user_id[:8] if isinstance(user_id, str) else user_id}... blog={blog_url}"
        )
        return WordPressOAuthContentManager(blog_url, decrypted)

    def _resolve_content_manager(self, user_id: str, site_id: int):
        """Resolve a content manager for site_id, preferring OAuth over legacy.

        Returns a tuple of (manager, kind) where kind is 'oauth' or 'legacy',
        or (None, None) if no credential path matches.
        """
        oauth_manager = self._resolve_oauth_content_manager(user_id, site_id)
        if oauth_manager is not None:
            return oauth_manager, 'oauth'

        # Legacy fallback
        credentials = self.wp_service.get_site_credentials(user_id, site_id)
        if not credentials:
            return None, None
        return (
            WordPressContentManager(
                credentials['site_url'],
                credentials['username'],
                credentials['app_password'],
            ),
            'legacy',
        )
    
    def _init_db(self, user_id: str):
        """Initialize database tables for published posts."""
        db_path = self._get_db_path(user_id)
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS wordpress_posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    wp_post_id INTEGER NOT NULL,
                    wp_url TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
    
    def save_post_info(self, user_id: str, wp_post_id: int, wp_url: str, title: str, status: str) -> bool:
        """Save information about a published post."""
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO wordpress_posts (user_id, wp_post_id, wp_url, title, status) 
                    VALUES (?, ?, ?, ?, ?)
                ''', (user_id, wp_post_id, wp_url, title, status))
                conn.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving WordPress post info: {e}")
            return False
    
    def publish_blog_post(self, user_id: str, site_id: int,
                         title: str, content: str,
                         excerpt: str = "",
                         featured_image_path: Optional[str] = None,
                         categories: Optional[List[str]] = None,
                         tags: Optional[List[str]] = None,
                         status: str = 'draft',
                         meta_description: str = "") -> Dict[str, Any]:
        """Publish a blog post to WordPress.

        Resolves a content manager for site_id via _resolve_content_manager
        (OAuth preferred, legacy fallback). If neither path resolves, returns
        the same 'site not found or inactive' error the legacy path used to
        return on its own.
        """
        try:
            # Resolve OAuth first, then fall back to legacy.
            content_manager, _kind = self._resolve_content_manager(user_id, site_id)
            if content_manager is None:
                return {
                    'success': False,
                    'error': 'WordPress site not found or inactive',
                    'post_id': None
                }

            # Test connection
            if not content_manager._test_connection():
                return {
                    'success': False,
                    'error': 'Cannot connect to WordPress site',
                    'post_id': None
                }
            
            # Handle featured image
            featured_media_id = None
            if featured_image_path and os.path.exists(featured_image_path):
                try:
                    # Compress image if it's an image file
                    if featured_image_path.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                        compressed_path = content_manager.compress_image(featured_image_path)
                        featured_media = content_manager.upload_media(
                            compressed_path,
                            alt_text=title,
                            title=title,
                            caption=excerpt
                        )
                        # Clean up temporary file if created
                        if compressed_path != featured_image_path:
                            os.unlink(compressed_path)
                    else:
                        featured_media = content_manager.upload_media(
                            featured_image_path,
                            alt_text=title,
                            title=title,
                            caption=excerpt
                        )
                    
                    if featured_media:
                        featured_media_id = featured_media['id']
                        logger.info(f"Featured image uploaded: {featured_media_id}")
                except Exception as e:
                    logger.warning(f"Failed to upload featured image: {e}")
            
            # Handle categories
            category_ids = []
            if categories:
                for category_name in categories:
                    category_id = content_manager.get_or_create_category(category_name)
                    if category_id:
                        category_ids.append(category_id)
            
            # Handle tags
            tag_ids = []
            if tags:
                for tag_name in tags:
                    tag_id = content_manager.get_or_create_tag(tag_name)
                    if tag_id:
                        tag_ids.append(tag_id)
            
            # Prepare meta data
            meta_data = {}
            if meta_description:
                meta_data['description'] = meta_description
            
            # Create the post
            post_data = content_manager.create_post(
                title=title,
                content=content,
                excerpt=excerpt,
                featured_media_id=featured_media_id,
                categories=category_ids if category_ids else None,
                tags=tag_ids if tag_ids else None,
                status=status,
                meta=meta_data if meta_data else None
            )
            
            if post_data:
                # Store post reference in database
                self._store_post_reference(user_id, site_id, post_data['id'], title, status)
                
                logger.info(f"Blog post published successfully: {title}")
                return {
                    'success': True,
                    'post_id': post_data['id'],
                    'post_url': post_data.get('link'),
                    'featured_media_id': featured_media_id,
                    'categories': category_ids,
                    'tags': tag_ids
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to create WordPress post',
                    'post_id': None
                }
                
        except Exception as e:
            logger.error(f"Error publishing blog post: {e}")
            return {
                'success': False,
                'error': str(e),
                'post_id': None
            }
    
    def _store_post_reference(self, user_id: str, site_id: int, wp_post_id: int, title: str, status: str) -> None:
        """Store post reference in database."""
        try:
            # Resolve the per-user db path. The historical code used
            # self.db_path directly, but the default value is None which
            # caused sqlite3.connect(None) to fail. Using _get_db_path is
            # a strict improvement: identical behaviour for any caller
            # that pre-set self.db_path, and the only working path for
            # callers that didn't.
            try:
                db_path = self._get_db_path(user_id) if not self.db_path else self.db_path
            except Exception:
                db_path = self.db_path

            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO wordpress_posts
                    (user_id, site_id, wp_post_id, title, status, published_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (user_id, site_id, wp_post_id, title, status,
                      datetime.now().isoformat() if status == 'publish' else None))
                conn.commit()

        except Exception as e:
            logger.error(f"Error storing post reference: {e}")
    
    def get_user_posts(self, user_id: str, site_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get all posts published by user."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                if site_id:
                    cursor.execute('''
                        SELECT wp.id, wp.wp_post_id, wp.title, wp.status, wp.published_at, wp.created_at,
                               ws.site_name, ws.site_url
                        FROM wordpress_posts wp
                        JOIN wordpress_sites ws ON wp.site_id = ws.id
                        WHERE wp.user_id = ? AND wp.site_id = ?
                        ORDER BY wp.created_at DESC
                    ''', (user_id, site_id))
                else:
                    cursor.execute('''
                        SELECT wp.id, wp.wp_post_id, wp.title, wp.status, wp.published_at, wp.created_at,
                               ws.site_name, ws.site_url
                        FROM wordpress_posts wp
                        JOIN wordpress_sites ws ON wp.site_id = ws.id
                        WHERE wp.user_id = ?
                        ORDER BY wp.created_at DESC
                    ''', (user_id,))
                
                posts = []
                for row in cursor.fetchall():
                    posts.append({
                        'id': row[0],
                        'wp_post_id': row[1],
                        'title': row[2],
                        'status': row[3],
                        'published_at': row[4],
                        'created_at': row[5],
                        'site_name': row[6],
                        'site_url': row[7]
                    })
                
                return posts
                
        except Exception as e:
            logger.error(f"Error getting user posts: {e}")
            return []
    
    def update_post_status(self, user_id: str, post_id: int, status: str) -> bool:
        """Update post status (draft/publish).

        Tries the OAuth credential path first by looking up the post's
        stored site_id; falls back to the legacy app-password JOIN on
        wordpress_sites if the OAuth path can't resolve.
        """
        try:
            # First, try to find the post and resolve credentials via the
            # OAuth-aware path. We use the user-id-scoped db path so the
            # common case (db_path=None on the class) still works.
            try:
                db_path = self._get_db_path(user_id)
            except Exception:
                db_path = self.db_path

            site_id = None
            wp_post_id = None
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                # Detect the wordpress_posts table; if absent, fall through.
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='wordpress_posts'"
                )
                if cursor.fetchone():
                    cursor.execute(
                        '''
                        SELECT site_id, wp_post_id
                        FROM wordpress_posts
                        WHERE id = ? AND user_id = ?
                        ''',
                        (post_id, user_id),
                    )
                    row = cursor.fetchone()
                    if row:
                        site_id, wp_post_id = row

            if site_id is not None and wp_post_id is not None:
                content_manager, _kind = self._resolve_content_manager(user_id, site_id)
                if content_manager is not None:
                    wp_result = content_manager.update_post(wp_post_id, status=status)
                    if wp_result:
                        with sqlite3.connect(db_path) as conn:
                            cursor = conn.cursor()
                            cursor.execute(
                                '''
                                UPDATE wordpress_posts
                                SET status = ?, published_at = ?
                                WHERE id = ?
                                ''',
                                (
                                    status,
                                    datetime.now().isoformat() if status == 'publish' else None,
                                    post_id,
                                ),
                            )
                            conn.commit()
                        logger.info(f"Post {post_id} status updated to {status} (via resolver)")
                        return True
                    logger.warning(
                        f"Post {post_id}: resolver path returned no result; "
                        f"falling back to legacy path"
                    )

            # Legacy path: existing JOIN against wordpress_sites. Behaviour
            # preserved for users who publish through app-password sites.
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT wp.site_id, wp.wp_post_id, ws.site_url, ws.username, ws.app_password
                    FROM wordpress_posts wp
                    JOIN wordpress_sites ws ON wp.site_id = ws.id
                    WHERE wp.id = ? AND wp.user_id = ?
                ''', (post_id, user_id))

                result = cursor.fetchone()
                if not result:
                    return False

                site_id, wp_post_id, site_url, username, app_password = result

            # Update in WordPress
            content_manager = WordPressContentManager(site_url, username, app_password)
            wp_result = content_manager.update_post(wp_post_id, status=status)

            if wp_result:
                # Update in database
                cursor.execute('''
                    UPDATE wordpress_posts
                    SET status = ?, published_at = ?
                    WHERE id = ?
                ''', (status, datetime.now().isoformat() if status == 'publish' else None, post_id))
                conn.commit()

                logger.info(f"Post {post_id} status updated to {status}")
                return True

            return False

        except Exception as e:
            logger.error(f"Error updating post status: {e}")
            return False

    def delete_post(self, user_id: str, post_id: int, force: bool = False) -> bool:
        """Delete a WordPress post.

        Tries the OAuth credential path first (mirrors update_post_status),
        then falls back to the legacy app-password JOIN.
        """
        try:
            try:
                db_path = self._get_db_path(user_id)
            except Exception:
                db_path = self.db_path

            site_id = None
            wp_post_id = None
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='wordpress_posts'"
                )
                if cursor.fetchone():
                    cursor.execute(
                        '''
                        SELECT site_id, wp_post_id
                        FROM wordpress_posts
                        WHERE id = ? AND user_id = ?
                        ''',
                        (post_id, user_id),
                    )
                    row = cursor.fetchone()
                    if row:
                        site_id, wp_post_id = row

            if site_id is not None and wp_post_id is not None:
                content_manager, _kind = self._resolve_content_manager(user_id, site_id)
                if content_manager is not None:
                    wp_result = content_manager.delete_post(wp_post_id, force=force)
                    if wp_result:
                        with sqlite3.connect(db_path) as conn:
                            cursor = conn.cursor()
                            cursor.execute(
                                'DELETE FROM wordpress_posts WHERE id = ?',
                                (post_id,),
                            )
                            conn.commit()
                        logger.info(f"Post {post_id} deleted successfully (via resolver)")
                        return True
                    logger.warning(
                        f"Post {post_id}: resolver path returned no result; "
                        f"falling back to legacy path"
                    )

            # Legacy path: preserved for app-password users.
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT wp.site_id, wp.wp_post_id, ws.site_url, ws.username, ws.app_password
                    FROM wordpress_posts wp
                    JOIN wordpress_sites ws ON wp.site_id = ws.id
                    WHERE wp.id = ? AND wp.user_id = ?
                ''', (post_id, user_id))

                result = cursor.fetchone()
                if not result:
                    return False

                site_id, wp_post_id, site_url, username, app_password = result

            # Delete from WordPress
            content_manager = WordPressContentManager(site_url, username, app_password)
            wp_result = content_manager.delete_post(wp_post_id, force=force)

            if wp_result:
                # Remove from database
                cursor.execute('DELETE FROM wordpress_posts WHERE id = ?', (post_id,))
                conn.commit()

                logger.info(f"Post {post_id} deleted successfully")
                return True

            return False

        except Exception as e:
            logger.error(f"Error deleting post: {e}")
            return False

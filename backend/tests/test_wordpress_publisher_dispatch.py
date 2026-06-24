"""
Tests for the OAuth/legacy dispatch in WordPressPublisher.

The publisher was refactored so that:
- _resolve_content_manager tries OAuth first, then falls back to the
  legacy wordpress_sites (app-password) path.
- publish_blog_post / update_post_status / delete_post all use the
  resolver, so OAuth-only users can publish, legacy-only users keep
  working, and dual-path users get OAuth preferred.

These tests pin down:
- Resolver returns the right manager for each user state.
- publish_blog_post succeeds for OAuth users (and stores the post ref).
- publish_blog_post succeeds for legacy users (no breaking change).
- publish_blog_post reports 'not found' when no credentials exist.
"""

import sys
from unittest.mock import patch

import pytest

# Ensure the backend root is on the path.
sys.path.insert(0, '.')

# All imports done at the top so the closure captures the patched class
# reference at test time. See conftest.py for the patch_user_db_path
# fixture that handles get_user_db_path across the OAuth modules.


class TestResolveContentManager:
    """Unit tests for WordPressPublisher._resolve_content_manager."""

    def test_resolves_oauth_manager_when_token_matches_site_id(
        self, patch_user_db_path
    ):
        from services.integrations.wordpress_publisher import WordPressPublisher
        from services.integrations.wordpress_oauth_content import (
            WordPressOAuthContentManager,
        )

        with patch_user_db_path("user_oauth_only") as ctx:
            with sqlite3_helpers() as conn:
                conn.execute(
                    "INSERT INTO wordpress_oauth_tokens "
                    "(user_id, access_token, blog_url) VALUES (?, ?, ?)",
                    (ctx.user_id, "encrypted_blob", "https://blog.example.com"),
                )
                conn.commit()

            with patch(
                "services.integrations.wordpress_oauth.WordPressOAuthService"
            ) as WOS:
                WOS.return_value.get_user_token_status.return_value = {
                    "has_tokens": True,
                    "has_active_tokens": True,
                    "active_tokens": [
                        {
                            "id": 1,
                            "access_token": "DECRYPTED",
                            "blog_url": "https://blog.example.com",
                        }
                    ],
                    "expired_tokens": [],
                }
                pub = WordPressPublisher()
                manager, kind = pub._resolve_content_manager(ctx.user_id, 1)

            assert kind == "oauth"
            assert isinstance(manager, WordPressOAuthContentManager)
            assert manager.access_token == "DECRYPTED"
            assert manager.site_url == "https://blog.example.com"

    def test_falls_back_to_legacy_when_no_oauth_token(self, patch_user_db_path):
        """User has only an app-password site (legacy) — no OAuth tokens."""
        from services.integrations.wordpress_publisher import WordPressPublisher
        from services.integrations.wordpress_content import (
            WordPressContentManager,
        )

        with patch_user_db_path("user_legacy_only") as ctx:
            with sqlite3_helpers() as conn:
                conn.execute(
                    "INSERT INTO wordpress_sites "
                    "(user_id, site_url, site_name, username, app_password, is_active) "
                    "VALUES (?, ?, ?, ?, ?, 1)",
                    (
                        ctx.user_id,
                        "https://legacy.example.com",
                        "Legacy",
                        "admin",
                        "app_pw",
                    ),
                )
                conn.commit()

            with patch(
                "services.integrations.wordpress_oauth.WordPressOAuthService"
            ):
                pub = WordPressPublisher()
                manager, kind = pub._resolve_content_manager(ctx.user_id, 1)

            assert kind == "legacy"
            assert isinstance(manager, WordPressContentManager)
            assert manager.username == "admin"
            assert manager.app_password == "app_pw"

    def test_returns_none_when_no_credentials(self, patch_user_db_path):
        from services.integrations.wordpress_publisher import WordPressPublisher

        with patch_user_db_path("user_empty") as ctx:
            with patch(
                "services.integrations.wordpress_oauth.WordPressOAuthService"
            ):
                pub = WordPressPublisher()
                manager, kind = pub._resolve_content_manager(ctx.user_id, 999)
            assert manager is None
            assert kind is None

    def test_oauth_preferred_when_both_exist(self, patch_user_db_path):
        """If both an OAuth token and a legacy site row exist, OAuth wins."""
        from services.integrations.wordpress_publisher import WordPressPublisher
        from services.integrations.wordpress_oauth_content import (
            WordPressOAuthContentManager,
        )

        with patch_user_db_path("user_dual") as ctx:
            with sqlite3_helpers() as conn:
                conn.execute(
                    "INSERT INTO wordpress_oauth_tokens "
                    "(user_id, access_token, blog_url) VALUES (?, ?, ?)",
                    (ctx.user_id, "encrypted_blob", "https://oauth.example.com"),
                )
                conn.execute(
                    "INSERT INTO wordpress_sites "
                    "(user_id, site_url, site_name, username, app_password, is_active) "
                    "VALUES (?, ?, ?, ?, ?, 1)",
                    (
                        ctx.user_id,
                        "https://legacy.example.com",
                        "Legacy",
                        "admin",
                        "app_pw",
                    ),
                )
                conn.commit()

            with patch(
                "services.integrations.wordpress_oauth.WordPressOAuthService"
            ) as WOS:
                WOS.return_value.get_user_token_status.return_value = {
                    "has_tokens": True,
                    "has_active_tokens": True,
                    "active_tokens": [
                        {
                            "id": 1,
                            "access_token": "OAUTH_TK",
                            "blog_url": "https://oauth.example.com",
                        }
                    ],
                    "expired_tokens": [],
                }
                pub = WordPressPublisher()
                manager, kind = pub._resolve_content_manager(ctx.user_id, 1)
            assert kind == "oauth"
            assert isinstance(manager, WordPressOAuthContentManager)

    def test_oauth_expired_falls_back_to_legacy(self, patch_user_db_path):
        """If the OAuth token is expired/inactive, the resolver falls back
        to the legacy site if one exists."""
        from services.integrations.wordpress_publisher import WordPressPublisher
        from services.integrations.wordpress_content import (
            WordPressContentManager,
        )

        with patch_user_db_path("user_oauth_dead_legacy_alive") as ctx:
            with sqlite3_helpers() as conn:
                conn.execute(
                    "INSERT INTO wordpress_oauth_tokens "
                    "(user_id, access_token, blog_url) VALUES (?, ?, ?)",
                    (ctx.user_id, "expired_blob", "https://oauth.example.com"),
                )
                conn.execute(
                    "INSERT INTO wordpress_sites "
                    "(user_id, site_url, site_name, username, app_password, is_active) "
                    "VALUES (?, ?, ?, ?, ?, 1)",
                    (
                        ctx.user_id,
                        "https://legacy.example.com",
                        "Legacy",
                        "admin",
                        "app_pw",
                    ),
                )
                conn.commit()

            with patch(
                "services.integrations.wordpress_oauth.WordPressOAuthService"
            ) as WOS:
                # No active tokens — only expired
                WOS.return_value.get_user_token_status.return_value = {
                    "has_tokens": True,
                    "has_active_tokens": False,
                    "active_tokens": [],
                    "expired_tokens": [{"id": 1}],
                }
                pub = WordPressPublisher()
                manager, kind = pub._resolve_content_manager(ctx.user_id, 1)
            assert kind == "legacy"
            assert isinstance(manager, WordPressContentManager)


class TestPublishBlogPostDispatch:
    """End-to-end tests for publish_blog_post via the resolver."""

    def test_publish_via_oauth_succeeds_and_stores_post_ref(
        self, patch_user_db_path
    ):
        from services.integrations.wordpress_publisher import WordPressPublisher
        from services.integrations.wordpress_oauth_content import (
            WordPressOAuthContentManager,
        )

        with patch_user_db_path("user_pub_oauth") as ctx:
            with sqlite3_helpers() as conn:
                conn.execute(
                    "INSERT INTO wordpress_oauth_tokens "
                    "(user_id, access_token, blog_url) VALUES (?, ?, ?)",
                    (ctx.user_id, "encrypted_blob", "https://blog.example.com"),
                )
                conn.commit()

            with patch(
                "services.integrations.wordpress_oauth.WordPressOAuthService"
            ) as WOS, \
                 patch.object(
                     WordPressOAuthContentManager,
                     "_test_connection",
                     return_value=True,
                 ), \
                 patch.object(
                     WordPressOAuthContentManager,
                     "create_post",
                     return_value={
                         "id": 42,
                         "link": "https://blog.example.com/?p=42",
                     },
                 ) as mock_create:
                WOS.return_value.get_user_token_status.return_value = {
                    "has_tokens": True,
                    "has_active_tokens": True,
                    "active_tokens": [
                        {
                            "id": 1,
                            "access_token": "ATK",
                            "blog_url": "https://blog.example.com",
                        }
                    ],
                    "expired_tokens": [],
                }
                pub = WordPressPublisher()
                result = pub.publish_blog_post(
                    user_id=ctx.user_id,
                    site_id=1,
                    title="My Test Post",
                    content="Hello world",
                )

            assert result["success"] is True
            assert result["post_id"] == 42
            assert result["post_url"] == "https://blog.example.com/?p=42"
            mock_create.assert_called_once()
            # The post reference must be stored in the user DB so subsequent
            # update_post_status / delete_post can find it.
            with sqlite3_helpers() as conn:
                row = conn.execute(
                    "SELECT user_id, site_id, wp_post_id, title, status "
                    "FROM wordpress_posts WHERE user_id = ?",
                    (ctx.user_id,),
                ).fetchone()
            assert row is not None
            assert row[1] == 1
            assert row[2] == 42
            assert row[3] == "My Test Post"

    def test_publish_via_legacy_still_works(self, patch_user_db_path):
        """The legacy app-password path must keep working unchanged."""
        from services.integrations.wordpress_publisher import WordPressPublisher
        from services.integrations.wordpress_content import (
            WordPressContentManager,
        )

        with patch_user_db_path("user_pub_legacy") as ctx:
            with sqlite3_helpers() as conn:
                conn.execute(
                    "INSERT INTO wordpress_sites "
                    "(user_id, site_url, site_name, username, app_password, is_active) "
                    "VALUES (?, ?, ?, ?, ?, 1)",
                    (
                        ctx.user_id,
                        "https://legacy.example.com",
                        "Legacy",
                        "admin",
                        "app_pw",
                    ),
                )
                conn.commit()

            with patch(
                "services.integrations.wordpress_oauth.WordPressOAuthService"
            ), \
                 patch.object(
                     WordPressContentManager,
                     "_test_connection",
                     return_value=True,
                 ), \
                 patch.object(
                     WordPressContentManager,
                     "create_post",
                     return_value={
                         "id": 99,
                         "link": "https://legacy.example.com/?p=99",
                     },
                 ) as mock_create:
                pub = WordPressPublisher()
                result = pub.publish_blog_post(
                    user_id=ctx.user_id,
                    site_id=1,
                    title="Legacy Post",
                    content="Hello legacy",
                )

            assert result["success"] is True
            assert result["post_id"] == 99
            mock_create.assert_called_once()

    def test_returns_not_found_when_no_credentials(self, patch_user_db_path):
        """No OAuth token, no legacy site -> 'not found' (no crash)."""
        from services.integrations.wordpress_publisher import WordPressPublisher

        with patch_user_db_path("user_pub_empty") as ctx:
            with patch(
                "services.integrations.wordpress_oauth.WordPressOAuthService"
            ):
                pub = WordPressPublisher()
                result = pub.publish_blog_post(
                    user_id=ctx.user_id,
                    site_id=999,
                    title="No creds",
                    content="x",
                )
            assert result["success"] is False
            assert "not found" in result["error"].lower()

    def test_returns_cannot_connect_when_oauth_test_fails(
        self, patch_user_db_path
    ):
        from services.integrations.wordpress_publisher import WordPressPublisher
        from services.integrations.wordpress_oauth_content import (
            WordPressOAuthContentManager,
        )

        with patch_user_db_path("user_pub_oauth_fail") as ctx:
            with sqlite3_helpers() as conn:
                conn.execute(
                    "INSERT INTO wordpress_oauth_tokens "
                    "(user_id, access_token, blog_url) VALUES (?, ?, ?)",
                    (ctx.user_id, "encrypted_blob", "https://blog.example.com"),
                )
                conn.commit()

            with patch(
                "services.integrations.wordpress_oauth.WordPressOAuthService"
            ) as WOS, \
                 patch.object(
                     WordPressOAuthContentManager,
                     "_test_connection",
                     return_value=False,
                 ):
                WOS.return_value.get_user_token_status.return_value = {
                    "has_tokens": True,
                    "has_active_tokens": True,
                    "active_tokens": [
                        {
                            "id": 1,
                            "access_token": "ATK",
                            "blog_url": "https://blog.example.com",
                        }
                    ],
                    "expired_tokens": [],
                }
                pub = WordPressPublisher()
                result = pub.publish_blog_post(
                    user_id=ctx.user_id,
                    site_id=1,
                    title="Test",
                    content="x",
                )

            assert result["success"] is False
            assert "cannot connect" in result["error"].lower()


# Lazy import sqlite3 only inside the tests to avoid a top-level import
# pulling anything we don't need. Wrapped as a function so the helpers
# read naturally.
def sqlite3_helpers():
    """Return a context manager that opens a sqlite3 connection to the
    current conftest-managed temp DB path. Used inside `with` blocks
    after `with patch_user_db_path(...) as ctx`."""
    import sqlite3
    from conftest import _ACTIVE_DB_PATH

    class _Conn:
        def __enter__(self):
            self._conn = sqlite3.connect(_ACTIVE_DB_PATH["path"])
            return self._conn

        def __exit__(self, exc_type, exc, tb):
            self._conn.commit()
            self._conn.close()
            return False

    return _Conn()

"""
YouTube OAuth2 Service
Handles Google OAuth2 authentication for YouTube Data API v3.
Supports token encryption, auto-refresh, and per-user multi-token storage.

Pattern: follows GSCService (Google OAuth flow) + WordPressOAuthService (Fernet encryption + rich schema).
"""

import os
import json
import secrets
import sqlite3
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from cryptography.fernet import Fernet
from loguru import logger

from services.database import get_user_db_path
from services.integrations.oauth_provider_base import OAuthProviderBase, resolve_encryption_key


class YouTubeOAuthService(OAuthProviderBase):
    """Manages YouTube OAuth2 authentication flow and token storage.

    Inherits Fernet token encryption + plaintext migration from
    OAuthProviderBase. YouTube keeps one override because the
    call-site contract differs from the base:
    - _decrypt_token: YouTube swallows decryption errors and returns
      None so the caller's `if not access_token` check can handle
      a corrupted row; the base class propagates. Kept here to
      preserve the existing call-site contract.
    """

    SCOPES = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.force-ssl",
    ]

    # SQL fragments consumed by OAuthProviderBase._migrate_plaintext_tokens_if_needed
    _select_plaintext_tokens_sql = (
        "SELECT id, access_token, refresh_token FROM youtube_oauth_tokens WHERE user_id = ?"
    )
    _update_token_sql = (
        "UPDATE youtube_oauth_tokens SET access_token = ?, refresh_token = ?, updated_at = datetime('now') "
        "WHERE id = ? AND user_id = ?"
    )

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path

        # Load Google OAuth credentials
        self.client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
        self.project_id = os.getenv("GOOGLE_PROJECT_ID", "alwrity")

        # Redirect URI
        default_redirect = "http://localhost:8000/api/youtube/oauth/callback"
        self.redirect_uri = os.getenv("YOUTUBE_REDIRECT_URI", default_redirect)

        # Token encryption
        self.token_encryption_key = resolve_encryption_key("youtube")
        self._fernet: Fernet = self._initialize_fernet()
        self._migration_done: set = set()

        # Build client config for google_auth_oauthlib
        self.client_config = self._build_client_config()

        # Validate
        if not self.client_id or not self.client_secret:
            logger.error(
                "YouTube OAuth: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. "
                "YouTube upload will not work until these are configured."
            )

    # _initialize_fernet is inherited from OAuthProviderBase. YouTube
    # used to override it to raise on missing key; the base class
    # now does the same thing with a unified error message that
    # names the correct env var per provider, so the override is
    # redundant. (Step 3 of the cs4 plan.)

    def _decrypt_token(self, token_blob: Optional[str]) -> Optional[str]:
        # YouTube-specific: swallow decryption errors and return None
        # so the caller's `if not access_token` check can handle a
        # corrupted row. The base class propagates the exception.
        if not token_blob:
            return None
        try:
            return self._fernet.decrypt(token_blob.encode("utf-8")).decode("utf-8")
        except Exception as e:
            logger.error(f"YouTube OAuth: token decryption failed: {e}")
            return None

    def _build_client_config(self) -> Optional[Dict[str, Any]]:
        if not self.client_id or not self.client_secret:
            return None
        return {
            "web": {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "project_id": self.project_id,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "redirect_uris": [self.redirect_uri],
                "javascript_origins": [],
            }
        }

    def _init_db(self, user_id: str):
        db_path = self._get_db_path(user_id)
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS youtube_oauth_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    token_type TEXT DEFAULT 'bearer',
                    expires_at TIMESTAMP,
                    scope TEXT,
                    channel_id TEXT,
                    channel_name TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS youtube_oauth_states (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    state TEXT NOT NULL UNIQUE,
                    user_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP DEFAULT (datetime('now', '+10 minutes'))
                )
            """)
            conn.commit()
            logger.debug(f"YouTube OAuth tables initialized for user {user_id}")

    def generate_authorization_url(self, user_id: str) -> Optional[str]:
        """Generate Google OAuth authorization URL for YouTube scopes."""
        try:
            if not self.client_config:
                logger.error("YouTube OAuth: client config not available")
                return None

            self._init_db(user_id)

            flow = Flow.from_client_config(
                self.client_config,
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri,
                autogenerate_code_verifier=False,
            )

            random_state = secrets.token_urlsafe(32)
            state = f"{user_id}:{random_state}"

            authorization_url, _ = flow.authorization_url(
                access_type="offline",
                include_granted_scopes="true",
                prompt="consent",
                state=state,
            )

            # Store state for callback verification
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO youtube_oauth_states (state, user_id) VALUES (?, ?)",
                    (state, user_id),
                )
                conn.commit()

            logger.info(f"YouTube OAuth URL generated for user {user_id}")
            return authorization_url

        except Exception as e:
            logger.error(f"YouTube OAuth: failed to generate auth URL for {user_id}: {e}")
            return None

    def handle_oauth_callback(self, authorization_code: str, state: str) -> Dict[str, Any]:
        """
        Handle OAuth callback — exchange code for tokens, store them.

        Returns: dict with 'success' key. On success also 'channel_id', 'channel_name'.
        """
        try:
            if ":" not in state:
                logger.error(f"YouTube OAuth: invalid state format: {state}")
                return {"success": False, "error": "Invalid state format"}

            user_id = state.split(":")[0]
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)

            # Verify state
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT user_id FROM youtube_oauth_states WHERE state = ?", (state,))
                if not cursor.fetchone():
                    logger.error(f"YouTube OAuth: invalid/expired state for {user_id}")
                    return {"success": False, "error": "Invalid or expired state"}

            if not self.client_config:
                return {"success": False, "error": "Client config not loaded"}

            # Exchange code for tokens
            flow = Flow.from_client_config(
                self.client_config,
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri,
                autogenerate_code_verifier=False,
            )
            flow.fetch_token(code=authorization_code)
            google_credentials = flow.credentials

            # Clean up state
            try:
                with sqlite3.connect(db_path) as conn:
                    conn.execute("DELETE FROM youtube_oauth_states WHERE state = ?", (state,))
                    conn.commit()
            except Exception as cleanup_err:
                logger.warning(f"YouTube OAuth: state cleanup failed: {cleanup_err}")

            # Fetch channel info
            channel_info = self._fetch_channel_info(google_credentials)

            # Save tokens
            save_result = self._save_tokens(
                user_id=user_id,
                credentials=google_credentials,
                channel_id=channel_info.get("channel_id", ""),
                channel_name=channel_info.get("channel_name", ""),
            )

            if not save_result:
                return {"success": False, "error": "Failed to save tokens"}

            logger.info(f"YouTube OAuth: user {user_id} authorized — channel: {channel_info.get('channel_name', 'unknown')}")
            return {
                "success": True,
                "channel_id": channel_info.get("channel_id", ""),
                "channel_name": channel_info.get("channel_name", ""),
            }

        except Exception as e:
            logger.error(f"YouTube OAuth: callback error: {e}")
            return {"success": False, "error": str(e)}

    def _fetch_channel_info(self, credentials: Credentials) -> Dict[str, str]:
        """Fetch authenticated user's YouTube channel info."""
        try:
            youtube = build("youtube", "v3", credentials=credentials, cache_discovery=False)
            request = youtube.channels().list(part="snippet", mine=True)
            response = request.execute()
            items = response.get("items", [])
            if items:
                return {
                    "channel_id": items[0].get("id", ""),
                    "channel_name": items[0].get("snippet", {}).get("title", ""),
                }
            logger.warning("YouTube OAuth: no channel found for authenticated user")
            return {"channel_id": "", "channel_name": ""}
        except Exception as e:
            logger.error(f"YouTube OAuth: failed to fetch channel info: {e}")
            return {"channel_id": "", "channel_name": ""}

    def _save_tokens(
        self,
        user_id: str,
        credentials: Credentials,
        channel_id: str = "",
        channel_name: str = "",
    ) -> bool:
        """Save OAuth tokens to per-user database with encryption."""
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)

            expires_at = None
            if credentials.expiry:
                expires_at = credentials.expiry.strftime("%Y-%m-%d %H:%M:%S")

            enc_access = self._encrypt_token(credentials.token) or ""
            enc_refresh = self._encrypt_token(credentials.refresh_token)

            with sqlite3.connect(db_path) as conn:
                self._migrate_plaintext_tokens_if_needed(conn, user_id)
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO youtube_oauth_tokens
                        (user_id, access_token, refresh_token, token_type, expires_at, scope, channel_id, channel_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        enc_access,
                        enc_refresh,
                        "bearer",
                        expires_at,
                        " ".join(self.SCOPES),
                        channel_id,
                        channel_name,
                    ),
                )
                conn.commit()

            logger.info(f"YouTube OAuth: tokens saved for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"YouTube OAuth: failed to save tokens for {user_id}: {e}")
            return False

    def get_valid_credentials(self, user_id: str, token_id: Optional[int] = None) -> Optional[Credentials]:
        """
        Load and (if needed) refresh credentials for a user.

        Args:
            user_id: Clerk user ID
            token_id: Specific token row ID; if None, uses the most recent active token.

        Returns:
            google.oauth2.credentials.Credentials or None
        """
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)

            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                if token_id:
                    cursor.execute(
                        "SELECT id, access_token, refresh_token, expires_at FROM youtube_oauth_tokens WHERE id = ? AND user_id = ? AND is_active = 1",
                        (token_id, user_id),
                    )
                else:
                    cursor.execute(
                        "SELECT id, access_token, refresh_token, expires_at FROM youtube_oauth_tokens WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1",
                        (user_id,),
                    )
                row = cursor.fetchone()

            if not row:
                logger.warning(f"YouTube OAuth: no active tokens for user {user_id}")
                return None

            db_id, enc_access, enc_refresh, expires_at_str = row

            access_token = self._decrypt_token(enc_access)
            refresh_token = self._decrypt_token(enc_refresh)

            if not access_token:
                logger.error(f"YouTube OAuth: cannot decrypt access token for user {user_id}")
                return None

            # Build Credentials object (Google lib handles refresh automatically)
            creds = Credentials(
                token=access_token,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self.client_id,
                client_secret=self.client_secret,
                scopes=self.SCOPES,
            )

            # Auto-refresh if expired
            if creds.expired:
                if creds.refresh_token:
                    try:
                        creds.refresh(GoogleRequest())
                        self._update_stored_token(user_id, db_id, creds)
                        logger.info(f"YouTube OAuth: token refreshed for user {user_id}")
                    except Exception as e:
                        logger.error(f"YouTube OAuth: token refresh failed for {user_id}: {e}")
                        return None
                else:
                    logger.warning(f"YouTube OAuth: token expired, no refresh token for {user_id}")
                    return None

            return creds

        except Exception as e:
            logger.error(f"YouTube OAuth: get_valid_credentials error for {user_id}: {e}")
            return None

    def _update_stored_token(self, user_id: str, token_id: int, credentials: Credentials):
        """Update stored token after refresh."""
        try:
            db_path = self._get_db_path(user_id)
            enc_access = self._encrypt_token(credentials.token) or ""
            enc_refresh = self._encrypt_token(credentials.refresh_token)
            expires_at = None
            if credentials.expiry:
                expires_at = credentials.expiry.strftime("%Y-%m-%d %H:%M:%S")

            with sqlite3.connect(db_path) as conn:
                conn.execute(
                    "UPDATE youtube_oauth_tokens SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
                    (enc_access, enc_refresh, expires_at, token_id, user_id),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"YouTube OAuth: failed to update stored token for {user_id}: {e}")

    def get_connection_status(self, user_id: str) -> Dict[str, Any]:
        """Get YouTube connection status for a user."""
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)

            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, channel_id, channel_name, expires_at, created_at, is_active FROM youtube_oauth_tokens WHERE user_id = ? ORDER BY created_at DESC",
                    (user_id,),
                )
                rows = cursor.fetchall()

            channels = []
            for row in rows:
                channel = {
                    "token_id": row[0],
                    "channel_id": row[1] or "",
                    "channel_name": row[2] or "",
                    "expires_at": row[3],
                    "connected_at": row[4],
                    "is_active": bool(row[5]),
                }
                channels.append(channel)

            return {"connected": len(channels) > 0, "channels": channels}

        except Exception as e:
            logger.error(f"YouTube OAuth: connection status error for {user_id}: {e}")
            return {"connected": False, "channels": [], "error": str(e)}

    def revoke_token(self, user_id: str, token_id: int) -> bool:
        """Deactivate a specific token."""
        try:
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                conn.execute(
                    "UPDATE youtube_oauth_tokens SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
                    (token_id, user_id),
                )
                conn.commit()
            logger.info(f"YouTube OAuth: token {token_id} revoked for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"YouTube OAuth: revoke error for {user_id}: {e}")
            return False

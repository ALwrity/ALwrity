"""
Bing Webmaster OAuth2 Service
Handles Bing Webmaster Tools OAuth2 authentication flow for SEO analytics access.
"""

import os
import secrets
import sqlite3
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from loguru import logger
import json
from urllib.parse import quote
from cryptography.fernet import Fernet, InvalidToken
from ..analytics_cache_service import analytics_cache

from services.database import get_user_db_path

class BingOAuthService:
    """Manages Bing Webmaster Tools OAuth2 authentication flow."""

    def __init__(self):
        # Bing Webmaster OAuth2 credentials
        self.client_id = os.getenv('BING_CLIENT_ID', '')
        self.client_secret = os.getenv('BING_CLIENT_SECRET', '')
        self.redirect_uri = os.getenv('BING_REDIRECT_URI', 'https://littery-sonny-unscrutinisingly.ngrok-free.dev/bing/callback')
        self.base_url = "https://www.bing.com"
        self.api_base_url = "https://www.bing.com/webmaster/api.svc/json"

        # Token encryption (matches the Wix/WordPress pattern; closes
        # a security gap where Bing tokens were stored in plaintext).
        self.token_encryption_key = (
            os.getenv("BING_TOKEN_ENCRYPTION_KEY")
            or os.getenv("OAUTH_TOKEN_ENCRYPTION_KEY")
        )
        self._fernet = self._initialize_fernet()
        self._migration_done: set = set()

        if not self.client_id or not self.client_secret or self.client_id == 'your_bing_client_id_here':
            logger.warning("Bing Webmaster OAuth client credentials not configured. Please set BING_CLIENT_ID and BING_CLIENT_SECRET environment variables with valid Bing Webmaster application credentials.")
            logger.warning("To get credentials: 1. Go to https://www.bing.com/webmasters/ 2. Sign in to Bing Webmaster Tools 3. Go to Settings > API Access 4. Create OAuth client")

    def _initialize_fernet(self) -> Optional[Fernet]:
        if not self.token_encryption_key:
            logger.error("Bing token encryption key is not configured.")
            return None
        try:
            return Fernet(self.token_encryption_key.encode("utf-8"))
        except Exception:
            logger.error("Bing token encryption key is invalid.")
            return None

    def _encrypt_token(self, token: Optional[str]) -> Optional[str]:
        if not token:
            return None
        if not self._fernet:
            raise ValueError("Token encryption is unavailable: missing/invalid managed key")
        return self._fernet.encrypt(token.encode("utf-8")).decode("utf-8")

    def _decrypt_token(self, token_blob: Optional[str]) -> Optional[str]:
        if not token_blob:
            return None
        if not self._fernet:
            raise ValueError("Token decryption is unavailable: missing/invalid managed key")
        return self._fernet.decrypt(token_blob.encode("utf-8")).decode("utf-8")

    def _is_likely_encrypted_blob(self, value: Optional[str]) -> bool:
        return bool(value and value.startswith("gAAAAA"))

    def _migrate_plaintext_tokens_if_needed(self, conn: sqlite3.Connection, user_id: str) -> None:
        """One-time migration path: re-encrypt plaintext rows during rollout."""
        if not self._fernet or user_id in self._migration_done:
            return
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, access_token, refresh_token FROM bing_oauth_tokens WHERE user_id = ?",
            (user_id,),
        )
        rows = cursor.fetchall()
        migrated = 0
        for token_id, access_token, refresh_token in rows:
            needs_access = access_token and not self._is_likely_encrypted_blob(access_token)
            needs_refresh = refresh_token and not self._is_likely_encrypted_blob(refresh_token)
            if not (needs_access or needs_refresh):
                continue
            enc_access = self._encrypt_token(access_token) if needs_access else access_token
            enc_refresh = self._encrypt_token(refresh_token) if needs_refresh else refresh_token
            cursor.execute(
                "UPDATE bing_oauth_tokens SET access_token = ?, refresh_token = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
                (enc_access, enc_refresh, token_id, user_id),
            )
            migrated += 1
        if migrated:
            conn.commit()
            logger.info(f"Bing OAuth token migration completed for user {user_id}; rows migrated={migrated}")
        self._migration_done.add(user_id)

    def _get_db_path(self, user_id: str) -> str:
        return get_user_db_path(user_id)

    def _init_db(self, user_id: str):
        """Initialize database tables for OAuth tokens."""
        db_path = self._get_db_path(user_id)
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS bing_oauth_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    token_type TEXT DEFAULT 'bearer',
                    expires_at TIMESTAMP,
                    scope TEXT,
                    site_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS bing_oauth_states (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    state TEXT NOT NULL UNIQUE,
                    user_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP DEFAULT (datetime('now', '+20 minutes'))
                )
            ''')
            conn.commit()

    
    def generate_authorization_url(self, user_id: str, scope: str = "webmaster.manage") -> Dict[str, Any]:
        """Generate Bing Webmaster OAuth2 authorization URL."""
        try:
            if not self.client_id or not self.client_secret or self.client_id == 'your_bing_client_id_here':
                logger.warning("Bing Webmaster OAuth client credentials not configured")
                return None

            # Generate secure state parameter with user_id embedded
            # Format: user_id:random_token
            random_token = secrets.token_urlsafe(32)
            state = f"{user_id}:{random_token}"

            # Ensure DB tables exist for this user
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)

            # Store state in database for validation
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO bing_oauth_states (state, user_id, expires_at)
                    VALUES (?, ?, datetime('now', '+20 minutes'))
                ''', (state, user_id))
                conn.commit()

            # Build authorization URL with proper URL encoding
            params = [
                f"response_type=code",
                f"client_id={self.client_id}",
                f"redirect_uri={quote(self.redirect_uri, safe='')}",
                f"scope={scope}",
                f"state={state}"
            ]

            auth_url = f"{self.base_url}/webmasters/OAuth/authorize?{'&'.join(params)}"

            logger.info(f"Generated Bing Webmaster OAuth URL for user {user_id}")
            logger.info(f"Bing OAuth redirect URI: {self.redirect_uri}")
            return {
                "auth_url": auth_url,
                "state": state
            }

        except Exception as e:
            logger.error(f"Error generating Bing Webmaster OAuth URL: {e}")
            return None
    
    def handle_oauth_callback(self, code: str, state: str) -> Optional[Dict[str, Any]]:
        """Handle OAuth callback and exchange code for access token."""
        try:
            logger.info(f"Bing Webmaster OAuth callback started - code: {code[:20]}..., state: {state[:20]}...")
            
            # Extract user_id from state
            if ':' not in state:
                logger.error(f"Invalid state format (missing user_id): {state[:20]}...")
                return None
                
            user_id = state.split(':')[0]
            if not user_id:
                logger.error("Empty user_id in state")
                return None
                
            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                 logger.error(f"User database not found for user {user_id}")
                 return None

            # Validate state parameter
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                # First, look up the state regardless of expiry to provide clearer logs
                cursor.execute('''
                    SELECT user_id, created_at, expires_at FROM bing_oauth_states 
                    WHERE state = ?
                ''', (state,))
                row = cursor.fetchone()

                if not row:
                    # State not found - likely already consumed (deleted) or never issued
                    logger.error(f"Bing OAuth: State not found or already used. state='{state[:12]}...'")
                    return None

                db_user_id, created_at, expires_at = row
                
                # Verify user_id matches
                if db_user_id != user_id:
                    logger.error(f"Bing OAuth: State user_id mismatch. Expected {user_id}, got {db_user_id}")
                    return None
                    
                # Check expiry explicitly
                cursor.execute("SELECT datetime('now') < ?", (expires_at,))
                not_expired = cursor.fetchone()[0] == 1
                if not not_expired:
                    logger.error(
                        f"Bing OAuth: State expired. state='{state[:12]}...', user_id='{user_id}', "
                        f"created_at='{created_at}', expires_at='{expires_at}'"
                    )
                    # Clean up expired state
                    cursor.execute('DELETE FROM bing_oauth_states WHERE state = ?', (state,))
                    conn.commit()
                    return None

                # Valid, not expired
                logger.info(f"Bing OAuth: State validated for user {user_id}")
                
                # Clean up used state
                cursor.execute('DELETE FROM bing_oauth_states WHERE state = ?', (state,))
                conn.commit()
            
            # Exchange authorization code for access token
            token_data = {
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'code': code,
                'grant_type': 'authorization_code',
                'redirect_uri': self.redirect_uri
            }
            
            logger.info(f"Bing OAuth: Exchanging code for token...")
            response = requests.post(
                f"{self.base_url}/webmasters/oauth/token",
                data=token_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=30
            )
            
            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
                return None
            
            token_info = response.json()
            logger.info(f"Bing OAuth: Token received - expires_in: {token_info.get('expires_in')}")
            
            # Store token information
            access_token = token_info.get('access_token')
            refresh_token = token_info.get('refresh_token')
            expires_in = token_info.get('expires_in', 3600)  # Default 1 hour
            token_type = token_info.get('token_type', 'bearer')
            
            # Calculate expiration
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                encrypted_access = self._encrypt_token(access_token)
                encrypted_refresh = self._encrypt_token(refresh_token)
                cursor.execute('''
                    INSERT INTO bing_oauth_tokens
                    (user_id, access_token, refresh_token, token_type, expires_at, scope)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (user_id, encrypted_access, encrypted_refresh, token_type, expires_at, 'webmaster.manage'))
                conn.commit()
                logger.info(f"Bing OAuth: Token inserted into database for user {user_id}")
            
            # Proactively fetch and cache user sites using the fresh token

            try:
                headers = {'Authorization': f'Bearer {access_token}'}
                response = requests.get(
                    f"{self.api_base_url}/GetUserSites",
                    headers={
                        **headers,
                        'Origin': 'https://www.bing.com',
                        'Referer': 'https://www.bing.com/webmasters/'
                    },
                    timeout=15
                )
                sites = []
                if response.status_code == 200:
                    sites_data = response.json()
                    if isinstance(sites_data, dict):
                        if 'd' in sites_data:
                            d_data = sites_data['d']
                            if isinstance(d_data, dict) and 'results' in d_data:
                                sites = d_data['results']
                            elif isinstance(d_data, list):
                                sites = d_data
                    elif isinstance(sites_data, list):
                        sites = sites_data
                if sites:
                    analytics_cache.set('bing_sites', user_id, sites, ttl_override=2*60*60)
                    logger.info(f"Bing OAuth: Cached {len(sites)} sites for user {user_id} after OAuth callback")
            except Exception as site_err:
                logger.warning(f"Bing OAuth: Failed to prefetch sites after OAuth callback: {site_err}")
            
            # Invalidate platform status and sites cache since connection status changed
            # Don't invalidate analytics data cache as it's expensive to regenerate
            analytics_cache.invalidate('platform_status', user_id)
            analytics_cache.invalidate('bing_sites', user_id)
            logger.info(f"Bing OAuth: Invalidated platform status and sites cache for user {user_id} due to new connection")
            
            logger.info(f"Bing Webmaster OAuth token stored successfully for user {user_id}")
            return {
                "success": True,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": token_type,
                "expires_in": expires_in,
                "expires_at": expires_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error handling Bing Webmaster OAuth callback: {e}")
            return None

    def purge_expired_tokens(self, user_id: str) -> int:
        """Delete expired or inactive Bing tokens for a user to avoid refresh loops.
        Returns number of rows deleted.
        """
        try:
            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                return 0
                
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                # Delete tokens that are expired or explicitly inactive
                cursor.execute('''
                    DELETE FROM bing_oauth_tokens
                    WHERE user_id = ? AND (is_active = FALSE OR (expires_at IS NOT NULL AND expires_at <= datetime('now')))
                ''', (user_id,))
                deleted = cursor.rowcount or 0
                conn.commit()
                if deleted > 0:
                    logger.info(f"Bing OAuth: Purged {deleted} expired/inactive tokens for user {user_id}")
                else:
                    logger.info(f"Bing OAuth: No expired/inactive tokens to purge for user {user_id}")
                # Invalidate platform status cache so UI updates
                analytics_cache.invalidate('platform_status', user_id)
                return deleted
        except Exception as e:
            logger.error(f"Bing OAuth: Error purging expired tokens for user {user_id}: {e}")
            return 0
    
    def get_user_tokens(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all active Bing tokens for a user."""
        try:
            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                return []

            with sqlite3.connect(db_path) as conn:
                self._migrate_plaintext_tokens_if_needed(conn, user_id)
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, access_token, refresh_token, token_type, expires_at, scope, created_at
                    FROM bing_oauth_tokens
                    WHERE user_id = ? AND is_active = TRUE AND expires_at > datetime('now')
                    ORDER BY created_at DESC
                ''', (user_id,))

                tokens = []
                for row in cursor.fetchall():
                    access_token_val = row[1]
                    refresh_token_val = row[2]
                    try:
                        decrypted_access = (
                            self._decrypt_token(access_token_val)
                            if self._is_likely_encrypted_blob(access_token_val)
                            else access_token_val
                        )
                    except InvalidToken:
                        logger.error(f"Failed to decrypt Bing access token for user {user_id}, token_id={row[0]}")
                        continue
                    try:
                        decrypted_refresh = (
                            self._decrypt_token(refresh_token_val)
                            if self._is_likely_encrypted_blob(refresh_token_val)
                            else refresh_token_val
                        )
                    except InvalidToken:
                        decrypted_refresh = None
                    tokens.append({
                        "id": row[0],
                        "access_token": decrypted_access,
                        "refresh_token": decrypted_refresh,
                        "token_type": row[3],
                        "expires_at": row[4],
                        "scope": row[5],
                        "created_at": row[6]
                    })
                return tokens
        except Exception as e:
            logger.error(f"Error retrieving Bing tokens for user {user_id}: {e}")
            return []

    def get_user_token_status(self, user_id: str) -> Dict[str, Any]:
        """Get status of Bing OAuth tokens for a user."""
        try:
            # Ensure DB tables exist for this user before querying
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)

            with sqlite3.connect(db_path) as conn:
                self._migrate_plaintext_tokens_if_needed(conn, user_id)
                cursor = conn.cursor()

                # Get all tokens (active and expired)
                cursor.execute('''
                    SELECT id, access_token, refresh_token, token_type, expires_at, scope, created_at, is_active
                    FROM bing_oauth_tokens
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                ''', (user_id,))

                all_tokens = []
                active_tokens = []
                expired_tokens = []

                for row in cursor.fetchall():
                    access_token_val = row[1]
                    refresh_token_val = row[2]
                    try:
                        decrypted_access = (
                            self._decrypt_token(access_token_val)
                            if self._is_likely_encrypted_blob(access_token_val)
                            else access_token_val
                        )
                    except InvalidToken:
                        decrypted_access = None
                    try:
                        decrypted_refresh = (
                            self._decrypt_token(refresh_token_val)
                            if self._is_likely_encrypted_blob(refresh_token_val)
                            else refresh_token_val
                        )
                    except InvalidToken:
                        decrypted_refresh = None
                    token_data = {
                        "id": row[0],
                        "access_token": decrypted_access,
                        "refresh_token": decrypted_refresh,
                        "token_type": row[3],
                        "expires_at": row[4],
                        "scope": row[5],
                        "created_at": row[6],
                        "is_active": bool(row[7])
                    }
                    all_tokens.append(token_data)

                    # Determine expiry using robust parsing and is_active flag
                    is_active_flag = bool(row[7])
                    not_expired = False
                    try:
                        expires_at_val = row[4]
                        if expires_at_val:
                            # First try Python parsing
                            try:
                                dt = datetime.fromisoformat(expires_at_val) if isinstance(expires_at_val, str) else expires_at_val
                                not_expired = dt > datetime.now()
                            except Exception:
                                # Fallback to SQLite comparison
                                cursor.execute("SELECT datetime('now') < ?", (expires_at_val,))
                                not_expired = cursor.fetchone()[0] == 1
                        else:
                            # No expiry stored => consider not expired
                            not_expired = True
                    except Exception:
                        not_expired = False

                    if is_active_flag and not_expired:
                        active_tokens.append(token_data)
                    else:
                        expired_tokens.append(token_data)
                
                return {
                    "has_tokens": len(all_tokens) > 0,
                    "has_active_tokens": len(active_tokens) > 0,
                    "has_expired_tokens": len(expired_tokens) > 0,
                    "active_tokens": active_tokens,
                    "expired_tokens": expired_tokens,
                    "total_tokens": len(all_tokens),
                    "last_token_date": all_tokens[0]["created_at"] if all_tokens else None
                }
                
        except Exception as e:
            logger.error(f"Error getting Bing token status for user {user_id}: {e}")
            return {
                "has_tokens": False,
                "has_active_tokens": False,
                "has_expired_tokens": False,
                "active_tokens": [],
                "expired_tokens": [],
                "total_tokens": 0,
                "last_token_date": None,
                "error": str(e)
            }
    
    def test_token(self, access_token: str) -> bool:
        """Test if a Bing access token is valid."""
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            # Try to get user's sites to test token validity
            response = requests.get(
                f"{self.api_base_url}/GetUserSites",
                headers={
                    **headers,
                    'Origin': 'https://www.bing.com',
                    'Referer': 'https://www.bing.com/webmasters/'
                },
                timeout=10
            )
            
            logger.info(f"Bing test_token: Status {response.status_code}")
            if response.status_code != 200:
                logger.warning(f"Bing test_token: API error {response.status_code} - {response.text}")
            else:
                logger.info(f"Bing test_token: Token is valid")
            
            return response.status_code == 200
            
        except Exception as e:
            logger.error(f"Error testing Bing token: {e}")
            return False
    
    def refresh_access_token(self, user_id: str, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Refresh an expired access token using refresh token."""
        try:
            logger.info(f"Bing refresh_access_token: Attempting to refresh token for user {user_id}")
            logger.debug(f"Bing refresh_access_token: Using client_id={self.client_id[:10]}..., refresh_token={refresh_token[:20]}...")
            token_data = {
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'refresh_token': refresh_token,
                'grant_type': 'refresh_token'
            }
            
            response = requests.post(
                f"{self.base_url}/webmasters/oauth/token",
                data=token_data,
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://www.bing.com',
                    'Referer': 'https://www.bing.com/webmasters/'
                },
                timeout=30
            )
            
            logger.info(f"Bing refresh_access_token: Response status {response.status_code}")
            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                return None
            
            token_info = response.json()
            logger.info(f"Bing refresh_access_token: Successfully refreshed token")
            
            # Update token in database
            access_token = token_info.get('access_token')
            expires_in = token_info.get('expires_in', 3600)
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                encrypted_access = self._encrypt_token(access_token)
                cursor.execute('''
                    UPDATE bing_oauth_tokens
                    SET access_token = ?, expires_at = ?, is_active = TRUE, updated_at = datetime('now')
                    WHERE user_id = ? AND refresh_token = ?
                ''', (encrypted_access, expires_at, user_id, refresh_token))
                conn.commit()
            
            logger.info(f"Bing access token refreshed for user {user_id}")

            # Invalidate caches that depend on token validity
            try:
                analytics_cache.invalidate('platform_status', user_id)
                analytics_cache.invalidate('bing_sites', user_id)
            except Exception as _:
                pass
            return {
                "access_token": access_token,
                "expires_in": expires_in,
                "expires_at": expires_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Bing refresh_access_token: Error refreshing token: {e}")
            return None
    
    def revoke_token(self, user_id: str, token_id: int) -> bool:
        """Revoke a Bing OAuth token."""
        try:
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE bing_oauth_tokens 
                    SET is_active = FALSE, updated_at = datetime('now')
                    WHERE user_id = ? AND id = ?
                ''', (user_id, token_id))
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info(f"Bing token {token_id} revoked for user {user_id}")
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Error revoking Bing token: {e}")
            return False
    
    def get_connection_status(self, user_id: str) -> Dict[str, Any]:
        """Get Bing connection status for a user."""
        try:
            tokens = self.get_user_tokens(user_id)
            
            if not tokens:
                return {
                    "connected": False,
                    "sites": [],
                    "total_sites": 0
                }
            
            # Check cache first for sites data
            cached_sites = analytics_cache.get('bing_sites', user_id)
            if cached_sites:
                logger.info(f"Using cached Bing sites for user {user_id}")
                return {
                    "connected": True,
                    "sites": cached_sites,
                    "total_sites": len(cached_sites)
                }
            
            # If no cache, return basic connection status without making API calls
            # Sites will be fetched when needed for analytics
            logger.info(f"Bing tokens found for user {user_id}, returning basic connection status")
            active_sites = []
            for token in tokens:
                # Just check if token exists and is not expired (basic check)
                # Don't make external API calls for connection status
                active_sites.append({
                    "id": token["id"],
                    "access_token": token["access_token"],
                    "scope": token["scope"],
                    "created_at": token["created_at"],
                    "sites": []  # Sites will be fetched when needed for analytics
                })
            
            return {
                "connected": len(active_sites) > 0,
                "sites": active_sites,
                "total_sites": len(active_sites)
            }
            
        except Exception as e:
            logger.error(f"Error getting Bing connection status: {e}")
            return {
                "connected": False,
                "sites": [],
                "total_sites": 0
            }
    
    def get_user_sites(self, user_id: str) -> List[Dict[str, Any]]:
        """Get list of user's verified sites from Bing Webmaster."""
        try:
            # Fast path: return cached sites if available
            try:
                cached_sites = analytics_cache.get('bing_sites', user_id)
                if cached_sites:
                    logger.info(f"Bing get_user_sites: Returning {len(cached_sites)} cached sites for user {user_id}")
                    return cached_sites
            except Exception:
                pass

            tokens = self.get_user_tokens(user_id)
            logger.info(f"Bing get_user_sites: Found {len(tokens)} tokens for user {user_id}")
            if not tokens:
                logger.warning(f"Bing get_user_sites: No tokens found for user {user_id}")
                return []
            
            all_sites = []
            for i, token in enumerate(tokens):
                logger.info(f"Bing get_user_sites: Testing token {i+1}/{len(tokens)}")
                
                # Try to refresh token if it's invalid
                if not self.test_token(token["access_token"]):
                    logger.info(f"Bing get_user_sites: Token {i+1} is invalid, attempting refresh")
                    if token.get("refresh_token"):
                        refreshed_token = self.refresh_access_token(user_id, token["refresh_token"])
                        if refreshed_token:
                            logger.info(f"Bing get_user_sites: Token {i+1} refreshed successfully")
                            # Update the token in the database
                            self.update_token_in_db(user_id, token["id"], refreshed_token)
                            # Use the new token
                            token["access_token"] = refreshed_token["access_token"]
                        else:
                            logger.warning(f"Bing get_user_sites: Failed to refresh token {i+1} - refresh token may be expired")
                            # Mark token as inactive since refresh failed
                            self.mark_token_inactive(user_id, token["id"])
                            continue
                    else:
                        logger.warning(f"Bing get_user_sites: No refresh token available for token {i+1}")
                        continue
                
                if self.test_token(token["access_token"]):
                    try:
                        headers = {'Authorization': f'Bearer {token["access_token"]}'}
                        response = requests.get(
                            f"{self.api_base_url}/GetUserSites",
                            headers={
                                **headers,
                                'Origin': 'https://www.bing.com',
                                'Referer': 'https://www.bing.com/webmasters/'
                            },
                            timeout=10
                        )
                        
                        if response.status_code == 200:
                            sites_data = response.json()
                            logger.info(f"Bing API response: {response.status_code}, data type: {type(sites_data)}")
                            logger.debug(f"Bing API response structure: {type(sites_data)}, keys: {list(sites_data.keys()) if isinstance(sites_data, dict) else 'Not a dict'}")
                            logger.debug(f"Bing API response content: {sites_data}")
                        else:
                            logger.error(f"Bing API error: {response.status_code} - {response.text}")
                            continue
                            
                        # Handle different response structures
                        if isinstance(sites_data, dict):
                            if 'd' in sites_data:
                                d_data = sites_data['d']
                                if isinstance(d_data, dict) and 'results' in d_data:
                                    sites = d_data['results']
                                elif isinstance(d_data, list):
                                    sites = d_data
                                else:
                                    sites = []
                            else:
                                sites = []
                        elif isinstance(sites_data, list):
                            sites = sites_data
                        else:
                            sites = []
                            
                        logger.info(f"Bing get_user_sites: Found {len(sites)} sites from token")
                        all_sites.extend(sites)
                        # Cache sites immediately for future calls
                        try:
                            analytics_cache.set('bing_sites', user_id, all_sites, ttl_override=2*60*60)
                        except Exception:
                            pass
                    except Exception as e:
                        logger.error(f"Error getting Bing user sites: {e}")
            
            logger.info(f"Bing get_user_sites: Returning {len(all_sites)} total sites for user {user_id}")
            
            # If no sites found and we had tokens, it means all tokens failed
            if len(all_sites) == 0 and len(tokens) > 0:
                logger.warning(f"Bing get_user_sites: No sites found despite having {len(tokens)} tokens - all tokens may be expired")
            
            return all_sites
            
        except Exception as e:
            logger.error(f"Error getting Bing user sites: {e}")
            return []
    
    def update_token_in_db(self, user_id: str, token_id: str, refreshed_token: Dict[str, Any]) -> bool:
        """Update the access token in the database after refresh."""
        try:
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                # Compute expires_at from expires_in if expires_at missing
                expires_at_value = refreshed_token.get("expires_at")
                if not expires_at_value and refreshed_token.get("expires_in"):
                    try:
                        expires_at_value = datetime.now() + timedelta(seconds=int(refreshed_token["expires_in"]))
                    except Exception:
                        expires_at_value = None
                encrypted_access = self._encrypt_token(refreshed_token["access_token"])
                cursor.execute('''
                    UPDATE bing_oauth_tokens
                    SET access_token = ?, expires_at = ?, is_active = TRUE, updated_at = datetime('now')
                    WHERE id = ?
                ''', (
                    encrypted_access,
                    expires_at_value,
                    token_id
                ))
                conn.commit()
                logger.info(f"Bing token {token_id} updated in database")
                return True
        except Exception as e:
            logger.error(f"Error updating Bing token in database: {e}")
            return False
    
    def mark_token_inactive(self, user_id: str, token_id: str) -> bool:
        """Mark a token as inactive in the database."""
        try:
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE bing_oauth_tokens 
                    SET is_active = FALSE, updated_at = datetime('now')
                    WHERE id = ?
                ''', (token_id,))
                conn.commit()
                logger.info(f"Bing token {token_id} marked as inactive")
                return True
        except Exception as e:
            logger.error(f"Error marking Bing token as inactive: {e}")
            return False
    
    def get_rank_and_traffic_stats(self, user_id: str, site_url: str, start_date: str = None, end_date: str = None) -> Dict[str, Any]:
        """Get rank and traffic statistics for a site."""
        try:
            tokens = self.get_user_tokens(user_id)
            if not tokens:
                return {"error": "No valid tokens found"}
            
            # Use the first valid token
            valid_token = None
            for token in tokens:
                if self.test_token(token["access_token"]):
                    valid_token = token
                    break
            
            if not valid_token:
                return {"error": "No valid access token"}
            
            # Set default date range (last 30 days)
            if not start_date:
                start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
            headers = {'Authorization': f'Bearer {valid_token["access_token"]}'}
            params = {
                'siteUrl': site_url,
                'startDate': start_date,
                'endDate': end_date
            }
            
            response = requests.get(
                f"{self.api_base_url}/GetRankAndTrafficStats",
                headers=headers,
                params=params,
                timeout=15
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Bing API error: {response.status_code} - {response.text}")
                return {"error": f"API error: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Error getting Bing rank and traffic stats: {e}")
            return {"error": str(e)}
    
    def get_query_stats(self, user_id: str, site_url: str, start_date: str = None, end_date: str = None, page: int = 0) -> Dict[str, Any]:
        """Get search query statistics for a site."""
        try:
            tokens = self.get_user_tokens(user_id)
            if not tokens:
                return {"error": "No valid tokens found"}
            
            valid_token = None
            for token in tokens:
                if self.test_token(token["access_token"]):
                    valid_token = token
                    break
            
            if not valid_token:
                return {"error": "No valid access token"}
            
            if not start_date:
                start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
            headers = {'Authorization': f'Bearer {valid_token["access_token"]}'}
            params = {
                'siteUrl': site_url,
                'startDate': start_date,
                'endDate': end_date,
                'page': page
            }
            
            response = requests.get(
                f"{self.api_base_url}/GetQueryStats",
                headers=headers,
                params=params,
                timeout=15
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Bing API error: {response.status_code} - {response.text}")
                return {"error": f"API error: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Error getting Bing query stats: {e}")
            return {"error": str(e)}
    
    def get_page_stats(self, user_id: str, site_url: str, start_date: str = None, end_date: str = None, page: int = 0) -> Dict[str, Any]:
        """Get page-level statistics for a site."""
        try:
            tokens = self.get_user_tokens(user_id)
            if not tokens:
                return {"error": "No valid tokens found"}
            
            valid_token = None
            for token in tokens:
                if self.test_token(token["access_token"]):
                    valid_token = token
                    break
            
            if not valid_token:
                return {"error": "No valid access token"}
            
            if not start_date:
                start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
            headers = {'Authorization': f'Bearer {valid_token["access_token"]}'}
            params = {
                'siteUrl': site_url,
                'startDate': start_date,
                'endDate': end_date,
                'page': page
            }
            
            response = requests.get(
                f"{self.api_base_url}/GetPageStats",
                headers=headers,
                params=params,
                timeout=15
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Bing API error: {response.status_code} - {response.text}")
                return {"error": f"API error: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Error getting Bing page stats: {e}")
            return {"error": str(e)}
    
    def get_keyword_stats(self, user_id: str, keyword: str, country: str = "us", language: str = "en-US") -> Dict[str, Any]:
        """Get keyword statistics for research purposes."""
        try:
            tokens = self.get_user_tokens(user_id)
            if not tokens:
                return {"error": "No valid tokens found"}
            
            valid_token = None
            for token in tokens:
                if self.test_token(token["access_token"]):
                    valid_token = token
                    break
            
            if not valid_token:
                return {"error": "No valid access token"}
            
            headers = {'Authorization': f'Bearer {valid_token["access_token"]}'}
            params = {
                'q': keyword,
                'country': country,
                'language': language
            }
            
            response = requests.get(
                f"{self.api_base_url}/GetKeywordStats",
                headers=headers,
                params=params,
                timeout=15
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Bing API error: {response.status_code} - {response.text}")
                return {"error": f"API error: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Error getting Bing keyword stats: {e}")
            return {"error": str(e)}
    
    def get_comprehensive_analytics(self, user_id: str, site_url: str = None) -> Dict[str, Any]:
        """Get comprehensive analytics data for all connected sites or a specific site."""
        try:
            # Get user's sites
            sites = self.get_user_sites(user_id)
            if not sites:
                return {"error": "No sites found"}
            
            # If no specific site URL provided, get data for all sites
            target_sites = [site_url] if site_url else [site.get('url', '') for site in sites if site.get('url')]
            
            analytics_data = {
                "sites": [],
                "summary": {
                    "total_sites": len(target_sites),
                    "total_clicks": 0,
                    "total_impressions": 0,
                    "total_ctr": 0.0
                }
            }
            
            for site in target_sites:
                if not site:
                    continue
                    
                site_data = {
                    "url": site,
                    "traffic_stats": {},
                    "query_stats": {},
                    "page_stats": {},
                    "error": None
                }
                
                try:
                    # Get traffic stats
                    traffic_stats = self.get_rank_and_traffic_stats(user_id, site)
                    if "error" not in traffic_stats:
                        site_data["traffic_stats"] = traffic_stats
                    
                    # Get query stats (first page)
                    query_stats = self.get_query_stats(user_id, site)
                    if "error" not in query_stats:
                        site_data["query_stats"] = query_stats
                    
                    # Get page stats (first page)
                    page_stats = self.get_page_stats(user_id, site)
                    if "error" not in page_stats:
                        site_data["page_stats"] = page_stats
                        
                except Exception as e:
                    site_data["error"] = str(e)
                    logger.error(f"Error getting analytics for site {site}: {e}")
                
                analytics_data["sites"].append(site_data)
            
            return analytics_data
            
        except Exception as e:
            logger.error(f"Error getting comprehensive Bing analytics: {e}")
            return {"error": str(e)}

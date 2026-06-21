"""
Wix OAuth2 Service
Handles Wix OAuth2 authentication flow and token storage.
"""

import os
import sqlite3
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from loguru import logger
from cryptography.fernet import Fernet, InvalidToken

from services.database import get_user_db_path
from .oauth_provider_base import OAuthProviderBase, resolve_encryption_key

class WixOAuthService(OAuthProviderBase):
    """Manages Wix OAuth2 authentication flow and token storage."""

    # SQL fragments consumed by OAuthProviderBase._migrate_plaintext_tokens_if_needed
    _select_plaintext_tokens_sql = (
        "SELECT id, access_token, refresh_token FROM wix_oauth_tokens WHERE user_id = ?"
    )
    _update_token_sql = (
        "UPDATE wix_oauth_tokens SET access_token = ?, refresh_token = ?, updated_at = datetime('now') "
        "WHERE id = ? AND user_id = ?"
    )

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        self.token_encryption_key = resolve_encryption_key("wix")
        self._fernet = self._initialize_fernet()
        self._migration_done: set = set()

    def _init_db(self, user_id: str):
        """Initialize database tables for OAuth tokens."""
        db_path = self._get_db_path(user_id)
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS wix_oauth_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    token_type TEXT DEFAULT 'bearer',
                    expires_at TIMESTAMP,
                    expires_in INTEGER,
                    scope TEXT,
                    site_id TEXT,
                    member_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS wix_oauth_pkce_states (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    state TEXT NOT NULL UNIQUE,
                    code_verifier TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    used_at TIMESTAMP
                )
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_wix_oauth_pkce_user_state
                ON wix_oauth_pkce_states (user_id, state)
            ''')
            conn.commit()

    def cleanup_expired_pkce_states(self, user_id: str) -> int:
        """Delete expired or already-used PKCE state records."""
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''
                    DELETE FROM wix_oauth_pkce_states
                    WHERE used_at IS NOT NULL OR expires_at <= datetime('now')
                    '''
                )
                deleted = cursor.rowcount
                conn.commit()
                return deleted if deleted is not None else 0
        except Exception as e:
            logger.warning(f"Failed to cleanup expired Wix PKCE states for user {user_id}: {e}")
            return 0

    def store_pkce_verifier(self, user_id: str, state: str, code_verifier: str, ttl_seconds: int = 600) -> bool:
        """Store PKCE code verifier by OAuth state with short TTL."""
        try:
            self._init_db(user_id)
            self.cleanup_expired_pkce_states(user_id)
            db_path = self._get_db_path(user_id)
            expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''
                    INSERT OR REPLACE INTO wix_oauth_pkce_states (user_id, state, code_verifier, expires_at, created_at, used_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)
                    ''',
                    (user_id, state, code_verifier, expires_at)
                )
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed storing Wix PKCE verifier for user {user_id}, state {state}: {e}")
            return False

    def consume_pkce_verifier(self, user_id: str, state: str) -> Optional[str]:
        """Get and invalidate one-time PKCE verifier for a state if valid and unexpired."""
        try:
            self._init_db(user_id)
            self.cleanup_expired_pkce_states(user_id)
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''
                    SELECT id, code_verifier
                    FROM wix_oauth_pkce_states
                    WHERE user_id = ? AND state = ? AND used_at IS NULL AND expires_at > datetime('now')
                    LIMIT 1
                    ''',
                    (user_id, state)
                )
                row = cursor.fetchone()
                if not row:
                    return None
                cursor.execute(
                    "UPDATE wix_oauth_pkce_states SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (row[0],)
                )
                conn.commit()
                return row[1]
        except Exception as e:
            logger.error(f"Failed consuming Wix PKCE verifier for user {user_id}, state {state}: {e}")
            return None
    
    def store_tokens(
        self,
        user_id: str,
        access_token: str,
        refresh_token: Optional[str] = None,
        expires_in: Optional[int] = None,
        token_type: str = 'bearer',
        scope: Optional[str] = None,
        site_id: Optional[str] = None,
        member_id: Optional[str] = None
    ) -> bool:
        """
        Store Wix OAuth tokens in the database.
        
        Args:
            user_id: User ID (Clerk string)
            access_token: Access token from Wix
            refresh_token: Optional refresh token
            expires_in: Optional expiration time in seconds
            token_type: Token type (default: 'bearer')
            scope: Optional OAuth scope
            site_id: Optional Wix site ID
            member_id: Optional Wix member ID
            
        Returns:
            True if tokens were stored successfully
        """
        try:
            # Ensure DB is initialized for this user
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)
            
            expires_at = None
            if expires_in:
                expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            encrypted_access = self._encrypt_token(access_token)
            encrypted_refresh = self._encrypt_token(refresh_token) if refresh_token else None

            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO wix_oauth_tokens 
                    (user_id, access_token, refresh_token, token_type, expires_at, expires_in, scope, site_id, member_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, encrypted_access, encrypted_refresh, token_type, expires_at, expires_in, scope, site_id, member_id))
                conn.commit()
                logger.info(f"Wix OAuth: Token inserted into database for user {user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error storing Wix tokens for user {user_id}: {e}")
            return False
    
    def get_user_tokens(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all active Wix tokens for a user."""
        try:
            # Ensure database tables exist to prevent 'no such table' errors
            self._init_db(user_id)
            
            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                return []
                
            with sqlite3.connect(db_path) as conn:
                self._migrate_plaintext_tokens_if_needed(conn, user_id)
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, access_token, refresh_token, token_type, expires_at, expires_in, scope, site_id, member_id, created_at
                    FROM wix_oauth_tokens
                    WHERE user_id = ? AND is_active = TRUE AND (expires_at IS NULL OR expires_at > datetime('now'))
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
                        logger.error(f"Failed to decrypt Wix access token for user {user_id}, token_id={row[0]}")
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
                        "expires_in": row[5],
                        "scope": row[6],
                        "site_id": row[7],
                        "member_id": row[8],
                        "created_at": row[9]
                    })
                
                return tokens
                
        except Exception as e:
            logger.error(f"Error getting Wix tokens for user {user_id}: {e}")
            return []
    
    def get_user_token_status(self, user_id: str) -> Dict[str, Any]:
        """Get detailed token status for a user including expired tokens."""
        try:
            # Ensure database tables exist to prevent 'no such table' errors
            self._init_db(user_id)

            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                return {
                    "has_tokens": False,
                    "has_active_tokens": False,
                    "has_expired_tokens": False,
                    "active_tokens": [],
                    "expired_tokens": [],
                    "total_tokens": 0,
                    "last_token_date": None
                }

            with sqlite3.connect(db_path) as conn:
                self._migrate_plaintext_tokens_if_needed(conn, user_id)
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT id, access_token, refresh_token, token_type, expires_at, expires_in, scope, site_id, member_id, created_at, is_active
                    FROM wix_oauth_tokens
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
                        "expires_in": row[5],
                        "scope": row[6],
                        "site_id": row[7],
                        "member_id": row[8],
                        "created_at": row[9],
                        "is_active": bool(row[10])
                    }
                    all_tokens.append(token_data)
                    
                    # Determine expiry using robust parsing and is_active flag
                    is_active_flag = bool(row[10])
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
            logger.error(f"Error getting Wix token status for user {user_id}: {e}")
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
    
    def update_tokens(
        self,
        user_id: str,
        access_token: str,
        refresh_token: Optional[str] = None,
        expires_in: Optional[int] = None,
        token_id: Optional[int] = None
    ) -> bool:
        """Update tokens for a user (e.g., after refresh)."""
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)

            expires_at = None
            if expires_in:
                expires_at = datetime.now() + timedelta(seconds=expires_in)

            encrypted_access = self._encrypt_token(access_token)
            encrypted_refresh = self._encrypt_token(refresh_token) if refresh_token else None
            
            with sqlite3.connect(db_path) as conn:
                self._migrate_plaintext_tokens_if_needed(conn, user_id)
                cursor = conn.cursor()
                if token_id:
                    if encrypted_refresh:
                        cursor.execute('''
                            UPDATE wix_oauth_tokens 
                            SET access_token = ?, refresh_token = ?, expires_at = ?, expires_in = ?, 
                                is_active = TRUE, updated_at = datetime('now')
                            WHERE user_id = ? AND id = ?
                        ''', (encrypted_access, encrypted_refresh, expires_at, expires_in, user_id, token_id))
                    else:
                        cursor.execute('''
                            UPDATE wix_oauth_tokens 
                            SET access_token = ?, expires_at = ?, expires_in = ?, 
                                is_active = TRUE, updated_at = datetime('now')
                            WHERE user_id = ? AND id = ?
                        ''', (encrypted_access, expires_at, expires_in, user_id, token_id))
                else:
                    cursor.execute('''
                        UPDATE wix_oauth_tokens 
                        SET access_token = ?, expires_at = ?, expires_in = ?, 
                            is_active = TRUE, updated_at = datetime('now')
                        WHERE user_id = ? AND id = (SELECT id FROM wix_oauth_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1)
                    ''', (encrypted_access, expires_at, expires_in, user_id, user_id))
                conn.commit()
                logger.info(f"Wix OAuth: Tokens updated for user {user_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating Wix tokens for user {user_id}: {e}")
            return False
    
    def revoke_token(self, user_id: str, token_id: int) -> bool:
        """Revoke a Wix OAuth token."""
        try:
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE wix_oauth_tokens 
                    SET is_active = FALSE, updated_at = datetime('now')
                    WHERE user_id = ? AND id = ?
                ''', (user_id, token_id))
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info(f"Wix token {token_id} revoked for user {user_id}")
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Error revoking Wix token: {e}")
            return False

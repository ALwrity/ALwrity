"""
LinkedIn OAuth / credential service for Growth Engine.

Supports Unipile hosted auth and native LinkedIn OAuth tokens,
with Fernet encryption and per-user SQLite.
"""

from __future__ import annotations

import base64
import hashlib
import os
import secrets
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, urlencode, urlparse

import requests
from loguru import logger

from services.integrations.oauth_provider_base import OAuthProviderBase, resolve_encryption_key
from services.integrations.linkedin.types import (
    LinkedInCredentials,
    LinkedInNotConnectedError,
)

_PLACEHOLDER_BACKEND_URL_TOKENS = ("your-backend-ngrok", "example.com", "placeholder")


def _is_placeholder_backend_url(url: str) -> bool:
    """Return True when a backend/ngrok URL is unset or a documentation placeholder."""
    normalized = url.strip().lower()
    if not normalized:
        return True
    return any(token in normalized for token in _PLACEHOLDER_BACKEND_URL_TOKENS)


def _normalize_backend_origin(url: str) -> Optional[str]:
    """Return scheme://host[:port] for a backend base URL, or None if invalid."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


def _is_localhost_origin(origin: str) -> bool:
    host = (urlparse(origin).hostname or "").lower()
    return host in ("localhost", "127.0.0.1", "::1")


class LinkedInOAuthService(OAuthProviderBase):
    """Manages LinkedIn Growth Engine credentials (Unipile or native OAuth).

    Inherits Fernet token encryption and per-user DB path resolution from
    OAuthProviderBase. Legacy zernio_* SQLite columns are retained for
    schema compatibility but are unused by the Unipile connect path.
    """

    _TOKEN_SELECT_COLUMNS = """
        id, user_id, provider_mode, zernio_api_key, zernio_account_id,
        zernio_org_account_id, linkedin_access_token, linkedin_refresh_token,
        expires_at, account_name, profile_urn, is_active, created_at, updated_at,
        zernio_profile_id, unipile_account_id, unipile_org_account_id
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        self.token_encryption_key = resolve_encryption_key("linkedin")
        # Fail-fast at construction: if the key is missing or invalid,
        # OAuthProviderBase._initialize_fernet raises ValueError with a
        # message naming the provider-specific env var. This matches the
        # cs4 normalization applied to Bing/Wix/WordPress/YouTube in
        # 386f7813.
        self._fernet = self._initialize_fernet()
        self._migration_done: set[str] = set()

    def _init_db(self, user_id: str) -> None:
        db_path = self._get_db_path(user_id)
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS linkedin_oauth_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    provider_mode TEXT NOT NULL,
                    zernio_api_key TEXT,
                    zernio_account_id TEXT,
                    zernio_org_account_id TEXT,
                    linkedin_access_token TEXT,
                    linkedin_refresh_token TEXT,
                    expires_at TIMESTAMP,
                    account_name TEXT,
                    profile_urn TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    zernio_profile_id TEXT,
                    unipile_account_id TEXT,
                    unipile_org_account_id TEXT
                )
                """
            )
            cursor.execute("PRAGMA table_info(linkedin_oauth_tokens)")
            existing_cols = {row[1] for row in cursor.fetchall()}
            if "zernio_profile_id" not in existing_cols:
                cursor.execute(
                    "ALTER TABLE linkedin_oauth_tokens ADD COLUMN zernio_profile_id TEXT"
                )
            # Add Unipile columns (Phase 2 migration)
            if "unipile_account_id" not in existing_cols:
                cursor.execute(
                    "ALTER TABLE linkedin_oauth_tokens ADD COLUMN unipile_account_id TEXT"
                )
            if "unipile_org_account_id" not in existing_cols:
                cursor.execute(
                    "ALTER TABLE linkedin_oauth_tokens ADD COLUMN unipile_org_account_id TEXT"
                )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS linkedin_oauth_states (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    state TEXT NOT NULL UNIQUE,
                    code_verifier TEXT,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    used_at TIMESTAMP
                )
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_user_active
                ON linkedin_oauth_tokens (user_id, is_active)
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS linkedin_analysis_context (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL UNIQUE,
                    unipile_account_id TEXT NOT NULL,

                    normalized_profile_json TEXT,
                    raw_userprofile_json TEXT,
                    profile_content_hash TEXT,
                    fetched_at TIMESTAMP,

                    profile_context_json TEXT,
                    profile_validation_json TEXT,
                    user_completion_json TEXT,
                    ai_profile_intelligence_json TEXT,
                    topic_recommendations_json TEXT,
                    profile_optimization_json TEXT,

                    profile_context_updated_at TIMESTAMP,
                    ai_intelligence_updated_at TIMESTAMP,
                    recommendations_updated_at TIMESTAMP,
                    profile_optimization_updated_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            cursor.execute("PRAGMA table_info(linkedin_analysis_context)")
            analysis_cols = {row[1] for row in cursor.fetchall()}
            if "topic_recommendations_json" not in analysis_cols:
                cursor.execute(
                    "ALTER TABLE linkedin_analysis_context "
                    "ADD COLUMN topic_recommendations_json TEXT"
                )
            if "recommendations_updated_at" not in analysis_cols:
                cursor.execute(
                    "ALTER TABLE linkedin_analysis_context "
                    "ADD COLUMN recommendations_updated_at TIMESTAMP"
                )
            if "profile_optimization_json" not in analysis_cols:
                cursor.execute(
                    "ALTER TABLE linkedin_analysis_context "
                    "ADD COLUMN profile_optimization_json TEXT"
                )
            if "profile_optimization_updated_at" not in analysis_cols:
                cursor.execute(
                    "ALTER TABLE linkedin_analysis_context "
                    "ADD COLUMN profile_optimization_updated_at TIMESTAMP"
                )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_linkedin_analysis_user
                ON linkedin_analysis_context (user_id)
                """
            )
            conn.commit()

    def _migrate_plaintext_tokens_if_needed(
        self, conn: sqlite3.Connection, user_id: str
    ) -> None:
        """Override of OAuthProviderBase._migrate_plaintext_tokens_if_needed.

        LinkedIn may store encrypted access/refresh tokens and a legacy
        zernio_api_key column. Migrate any plaintext values once per user.
        """
        if user_id in self._migration_done:
            return
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, zernio_api_key, linkedin_access_token, linkedin_refresh_token
            FROM linkedin_oauth_tokens WHERE user_id = ?
            """,
            (user_id,),
        )
        migrated = 0
        for token_id, zernio_key, access, refresh in cursor.fetchall():
            updates: Dict[str, Optional[str]] = {}
            if zernio_key and not self._is_likely_encrypted_blob(zernio_key):
                updates["zernio_api_key"] = self._encrypt_token(zernio_key)
            if access and not self._is_likely_encrypted_blob(access):
                updates["linkedin_access_token"] = self._encrypt_token(access)
            if refresh and not self._is_likely_encrypted_blob(refresh):
                updates["linkedin_refresh_token"] = self._encrypt_token(refresh)
            if not updates:
                continue
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            cursor.execute(
                f"""
                UPDATE linkedin_oauth_tokens
                SET {set_clause}, updated_at = datetime('now')
                WHERE id = ? AND user_id = ?
                """,
                (*updates.values(), token_id, user_id),
            )
            migrated += 1
        if migrated:
            conn.commit()
            logger.info(
                f"LinkedIn OAuth token migration for user {user_id}; rows={migrated}"
            )
        self._migration_done.add(user_id)

    def _row_to_credentials(self, row: tuple) -> LinkedInCredentials:
        (
            _id,
            _user_id,
            provider_mode,
            zernio_api_key,
            zernio_account_id,
            zernio_org_account_id,
            linkedin_access_token,
            linkedin_refresh_token,
            _expires_at,
            account_name,
            profile_urn,
            _is_active,
            _created_at,
            _updated_at,
            *rest,
        ) = row
        # Handle optional columns that may not exist in older rows
        zernio_profile_id = rest[0] if len(rest) > 0 else None
        unipile_account_id = rest[1] if len(rest) > 1 else None
        unipile_org_account_id = rest[2] if len(rest) > 2 else None

        def _maybe_decrypt(value: Optional[str]) -> Optional[str]:
            if not value:
                return None
            if self._is_likely_encrypted_blob(value):
                return self._decrypt_token(value)
            return value

        # Legacy zernio_* columns remain in the SELECT for schema compat.
        _ = (zernio_api_key, zernio_account_id, zernio_org_account_id, zernio_profile_id)
        mode = str(provider_mode or "").strip().lower()
        if mode == "zernio":
            # Force reconnect via Unipile — legacy Zernio rows are unsupported.
            mode = "unipile"
            unipile_account_id = None
            unipile_org_account_id = None

        return LinkedInCredentials.from_db_row(
            {
                "provider_mode": mode,
                "unipile_account_id": unipile_account_id,
                "unipile_org_account_id": unipile_org_account_id,
                "linkedin_access_token": _maybe_decrypt(linkedin_access_token),
                "linkedin_refresh_token": _maybe_decrypt(linkedin_refresh_token),
                "account_name": account_name,
                "profile_urn": profile_urn,
            }
        )

    def _get_active_token_row(self, user_id: str) -> Optional[tuple]:
        self._init_db(user_id)
        db_path = self._get_db_path(user_id)
        if not os.path.exists(db_path):
            return None
        with sqlite3.connect(db_path) as conn:
            self._migrate_plaintext_tokens_if_needed(conn, user_id)
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT {self._TOKEN_SELECT_COLUMNS}
                FROM linkedin_oauth_tokens
                WHERE user_id = ? AND is_active = 1
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id,),
            )
            return cursor.fetchone()

    def store_native_tokens(
        self,
        user_id: str,
        access_token: str,
        refresh_token: Optional[str] = None,
        expires_at: Optional[str] = None,
        account_name: Optional[str] = None,
        profile_urn: Optional[str] = None,
    ) -> bool:
        try:
            self._init_db(user_id)
            enc_access = self._encrypt_token(access_token)
            enc_refresh = self._encrypt_token(refresh_token) if refresh_token else None
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE linkedin_oauth_tokens SET is_active = 0 WHERE user_id = ?",
                    (user_id,),
                )
                cursor.execute(
                    """
                    INSERT INTO linkedin_oauth_tokens (
                        user_id, provider_mode, linkedin_access_token,
                        linkedin_refresh_token, expires_at, account_name, profile_urn, is_active
                    ) VALUES (?, 'native', ?, ?, ?, ?, ?, 1)
                    """,
                    (
                        user_id,
                        enc_access,
                        enc_refresh,
                        expires_at,
                        account_name,
                        profile_urn,
                    ),
                )
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to store native LinkedIn tokens for user {user_id}: {e}")
            return False

    def store_unipile_credentials(
        self,
        user_id: str,
        unipile_account_id: str,
        unipile_org_account_id: Optional[str] = None,
        account_name: Optional[str] = None,
        profile_urn: Optional[str] = None,
    ) -> bool:
        """
        Store Unipile account credentials after successful OAuth.

        Unipile stores OAuth tokens server-side; we only need to store
        the account_id reference for API calls.

        Args:
            user_id: Internal user ID
            unipile_account_id: Unipile account ID from callback
            unipile_org_account_id: Optional organization account ID
            account_name: Display name for the account
            profile_urn: LinkedIn profile URN

        Returns:
            True if credentials stored successfully
        """
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                # Deactivate existing tokens
                cursor.execute(
                    "UPDATE linkedin_oauth_tokens SET is_active = 0 WHERE user_id = ?",
                    (user_id,),
                )
                # Insert new Unipile credentials
                cursor.execute(
                    """
                    INSERT INTO linkedin_oauth_tokens (
                        user_id, provider_mode, unipile_account_id,
                        unipile_org_account_id, account_name, profile_urn, is_active
                    ) VALUES (?, 'unipile', ?, ?, ?, ?, 1)
                    """,
                    (
                        user_id,
                        unipile_account_id,
                        unipile_org_account_id,
                        account_name,
                        profile_urn,
                    ),
                )
                conn.commit()
            logger.info(
                f"[LinkedInConnect] Stored Unipile credentials for user={user_id}, "
                f"account_id={unipile_account_id}"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to store Unipile credentials for user {user_id}: {e}")
            return False

    def _parse_expires_at(self, expires_at_str: Optional[str]) -> Tuple[bool, Optional[datetime]]:
        """Return (is_valid_not_expired, expires_at_dt)."""
        if not expires_at_str:
            return True, None
        try:
            expires_at = datetime.fromisoformat(
                str(expires_at_str).replace("Z", "+00:00")
            )
            if expires_at.tzinfo is not None:
                expires_at = expires_at.replace(tzinfo=None)
            return expires_at > datetime.now(), expires_at
        except Exception:
            return False, None

    def _token_row_metadata(self, row: tuple) -> Dict[str, Any]:
        """Build monitoring-safe token metadata (no decrypted secrets)."""
        (
            token_id,
            _user_id,
            provider_mode,
            _legacy_zernio_api_key,
            _legacy_zernio_account_id,
            _legacy_zernio_org_account_id,
            _linkedin_access_token,
            linkedin_refresh_token,
            expires_at,
            account_name,
            profile_urn,
            is_active,
            created_at,
            _updated_at,
            *_rest,
        ) = row
        unipile_account_id = _rest[1] if len(_rest) > 1 else None
        unipile_org_account_id = _rest[2] if len(_rest) > 2 else None
        not_expired, expires_dt = self._parse_expires_at(expires_at)
        has_refresh = bool(linkedin_refresh_token)
        return {
            "id": token_id,
            "provider_mode": provider_mode,
            "unipile_account_id": unipile_account_id,
            "unipile_org_account_id": unipile_org_account_id,
            "expires_at": expires_at,
            "account_name": account_name,
            "profile_urn": profile_urn,
            "is_active": bool(is_active),
            "created_at": created_at,
            "has_refresh_token": has_refresh,
            "not_expired": not_expired,
            "expires_at_dt": expires_dt.isoformat() if expires_dt else None,
        }

    def get_user_token_status(self, user_id: str) -> Dict[str, Any]:
        """DB-only token status for OAuth monitoring (no env fallback, no secrets)."""
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                return self._empty_token_status()

            with sqlite3.connect(db_path) as conn:
                self._migrate_plaintext_tokens_if_needed(conn, user_id)
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    SELECT {self._TOKEN_SELECT_COLUMNS}
                    FROM linkedin_oauth_tokens
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    """,
                    (user_id,),
                )
                rows = cursor.fetchall()

            all_tokens: List[Dict[str, Any]] = []
            active_tokens: List[Dict[str, Any]] = []
            expired_tokens: List[Dict[str, Any]] = []

            for row in rows:
                meta = self._token_row_metadata(row)
                all_tokens.append(meta)
                if meta["is_active"] and meta["not_expired"]:
                    active_tokens.append(meta)
                else:
                    expired_tokens.append(meta)

            has_refreshable = any(t.get("has_refresh_token") for t in expired_tokens)

            return {
                "has_tokens": len(all_tokens) > 0,
                "has_active_tokens": len(active_tokens) > 0,
                "has_expired_tokens": len(expired_tokens) > 0,
                "has_refreshable_tokens": has_refreshable,
                "active_tokens": active_tokens,
                "expired_tokens": expired_tokens,
                "total_tokens": len(all_tokens),
                "last_token_date": all_tokens[0]["created_at"] if all_tokens else None,
                "provider_mode": active_tokens[0]["provider_mode"]
                if active_tokens
                else (expired_tokens[0]["provider_mode"] if expired_tokens else None),
            }
        except Exception as e:
            logger.error(f"Error getting LinkedIn token status for user {user_id}: {e}")
            return self._empty_token_status()

    def _empty_token_status(self) -> Dict[str, Any]:
        return {
            "has_tokens": False,
            "has_active_tokens": False,
            "has_expired_tokens": False,
            "has_refreshable_tokens": False,
            "active_tokens": [],
            "expired_tokens": [],
            "total_tokens": 0,
            "last_token_date": None,
            "provider_mode": None,
        }

    def _resolve_db_credentials(self, user_id: str) -> LinkedInCredentials:
        """Resolve credentials from per-user DB only (no env fallback)."""
        row = self._get_active_token_row(user_id)
        if not row:
            raise LinkedInNotConnectedError(
                "No per-user LinkedIn credentials found in database"
            )
        creds = self._row_to_credentials(row)
        if creds.provider_mode == "native" and creds.linkedin_access_token:
            return creds
        if creds.provider_mode == "unipile" and creds.unipile_account_id:
            return creds
        raise LinkedInNotConnectedError("LinkedIn credentials row is incomplete")

    def resolve_credentials(self, user_id: str) -> LinkedInCredentials:
        row = self._get_active_token_row(user_id)
        if not row:
            raise LinkedInNotConnectedError("No LinkedIn credentials available for user")
        creds = self._row_to_credentials(row)
        if creds.provider_mode == "native" and creds.linkedin_access_token:
            return creds
        if creds.provider_mode == "unipile" and creds.unipile_account_id:
            return creds
        raise LinkedInNotConnectedError("LinkedIn credentials row is incomplete")

    def refresh_access_token(
        self, user_id: str, refresh_token: str
    ) -> Optional[Dict[str, Any]]:
        """Refresh native LinkedIn OAuth access token."""
        client_id = os.getenv("LINKEDIN_CLIENT_ID")
        client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
        if not client_id or not client_secret:
            logger.error("LINKEDIN_CLIENT_ID/SECRET not configured for token refresh")
            return None
        try:
            response = requests.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )
            if response.status_code != 200:
                logger.error(
                    f"LinkedIn token refresh failed: {response.status_code} - {response.text}"
                )
                return None
            token_info = response.json()
            access_token = token_info.get("access_token")
            new_refresh = token_info.get("refresh_token", refresh_token)
            expires_in = token_info.get("expires_in", 3600)
            expires_at = (datetime.now() + timedelta(seconds=expires_in)).isoformat()
            if not access_token:
                return None
            row = self._get_active_token_row(user_id)
            account_name = None
            profile_urn = None
            if row:
                account_name = row[9]
                profile_urn = row[10]
            self.store_native_tokens(
                user_id=user_id,
                access_token=access_token,
                refresh_token=new_refresh,
                expires_at=expires_at,
                account_name=account_name,
                profile_urn=profile_urn,
            )
            return {
                "access_token": access_token,
                "expires_in": expires_in,
                "expires_at": expires_at,
            }
        except Exception as e:
            logger.error(f"LinkedIn refresh_access_token error for user {user_id}: {e}")
            return None

    def get_valid_credentials(
        self, user_id: str, *, monitoring: bool = False
    ) -> LinkedInCredentials:
        """
        Return valid credentials for API use or token monitoring.

        When monitoring=True, uses DB-only credentials (no env fallback).
        For native mode, refreshes expired/expiring tokens when possible.
        """
        creds = (
            self._resolve_db_credentials(user_id)
            if monitoring
            else self.resolve_credentials(user_id)
        )

        if creds.provider_mode == "unipile":
            return creds

        row = self._get_active_token_row(user_id)
        if not row:
            return creds
        expires_at_str = row[8]
        not_expired, expires_dt = self._parse_expires_at(expires_at_str)
        refresh_token = self._row_to_credentials(row).linkedin_refresh_token

        if not_expired:
            if monitoring and expires_dt:
                days_until = (expires_dt - datetime.now()).days
                if days_until < 7 and refresh_token:
                    result = self.refresh_access_token(user_id, refresh_token)
                    if result:
                        return self._resolve_db_credentials(user_id)
            return creds

        if refresh_token:
            result = self.refresh_access_token(user_id, refresh_token)
            if result:
                return self._resolve_db_credentials(user_id)

        raise LinkedInNotConnectedError(
            "LinkedIn access token expired and could not be refreshed"
        )

    def get_connection_status(self, user_id: str) -> Dict[str, Any]:
        provider = os.getenv("LINKEDIN_PROVIDER", "unipile")
        row = self._get_active_token_row(user_id)
        has_db_token = row is not None

        try:
            creds = self.resolve_credentials(user_id)
            connected = True
        except LinkedInNotConnectedError:
            connected = False
            creds = None

        accounts: List[Dict[str, Any]] = []
        if connected and creds and creds.provider_mode == "unipile":
            if creds.unipile_account_id:
                accounts.append(
                    {
                        "account_id": creds.unipile_account_id,
                        "account_type": "personal",
                        "source": creds.source,
                    }
                )
            if creds.unipile_org_account_id:
                accounts.append(
                    {
                        "account_id": creds.unipile_org_account_id,
                        "account_type": "organization",
                        "source": creds.source,
                    }
                )

        account_name = creds.account_name if creds else None
        if account_name and str(account_name).strip().startswith("user_"):
            account_name = None

        return {
            "connected": connected,
            "provider": provider,
            "has_per_user_token": has_db_token,
            "has_env_fallback": False,
            "accounts": accounts,
            "account_name": account_name,
        }

    def revoke_token(self, user_id: str) -> bool:
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    UPDATE linkedin_oauth_tokens
                    SET is_active = 0, updated_at = datetime('now')
                    WHERE user_id = ? AND is_active = 1
                    """,
                    (user_id,),
                )
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to revoke LinkedIn token for user {user_id}: {e}")
            return False

    async def disconnect_user(self, user_id: str) -> Dict[str, Any]:
        """Unlink LinkedIn from ALwrity (local tokens only; remote accounts may be deleted based on provider)."""
        logger.info(f"[LinkedInConnect] disconnect_user start user_id={user_id}")

        # Check if Unipile and attempt to delete remote account
        provider = os.getenv("LINKEDIN_PROVIDER", "unipile").lower()
        unipile_account_deleted = False

        if provider == "unipile":
            try:
                creds = self.resolve_credentials(user_id)
                if creds.unipile_account_id:
                    from services.integrations.linkedin.unipile_client import UnipileClient

                    client = UnipileClient()
                    unipile_account_deleted = await client.delete_account(creds.unipile_account_id)
                    logger.info(
                        f"[LinkedInConnect] Unipile account deletion attempted user_id={user_id} "
                        f"account_id={creds.unipile_account_id} success={unipile_account_deleted}"
                    )
            except Exception as e:
                logger.warning(
                    f"[LinkedInConnect] Failed to delete Unipile account for user_id={user_id}: {e}"
                )

        revoked = self.revoke_token(user_id)
        status = self.get_connection_status(user_id)

        logger.warning(
            f"[LinkedInConnect] disconnect_user done user_id={user_id} "
            f"revoked={revoked} provider={provider} "
            f"unipile_account_deleted={unipile_account_deleted}"
        )

        return {
            "success": revoked,
            "revoked": revoked,
            "provider": provider,
            "unipile_account_deleted": unipile_account_deleted,
            "connected": status.get("connected", False),
            "has_env_fallback": False,
        }

    def validate_callback_base(self, callback_base: Optional[str]) -> Optional[str]:
        """
        Validate an optional OAuth redirect base from the frontend (local dev).

        Accepts localhost backend URLs or origins matching configured BACKEND_URL /
        NGROK_URL / LINKEDIN_SOCIAL_REDIRECT_URI.
        """
        if not callback_base or not callback_base.strip():
            return None
        origin = _normalize_backend_origin(callback_base.strip().rstrip("/"))
        if not origin:
            return None
        if _is_localhost_origin(origin):
            return origin
        for env_key in ("BACKEND_URL", "NGROK_URL", "LINKEDIN_SOCIAL_REDIRECT_URI"):
            raw = os.getenv(env_key, "").strip()
            if not raw:
                continue
            allowed = _normalize_backend_origin(raw)
            if allowed and origin == allowed:
                return origin
            if env_key == "LINKEDIN_SOCIAL_REDIRECT_URI":
                parsed = urlparse(raw)
                if parsed.scheme and parsed.netloc:
                    redirect_origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
                    if origin == redirect_origin:
                        return origin
        logger.warning(
            f"[LinkedInConnect] Rejected callback_base={callback_base!r} "
            "(not localhost and not in configured backend URLs)"
        )
        return None

    def _should_prefer_localhost_callback(self) -> bool:
        """In local development, use localhost unless explicitly forcing ngrok."""
        if os.getenv("LINKEDIN_USE_NGROK_CALLBACK", "").strip().lower() in (
            "1",
            "true",
            "yes",
        ):
            return False
        env = os.getenv("ENVIRONMENT", "development").strip().lower()
        debug = os.getenv("DEBUG", "").strip().lower() in ("1", "true", "yes")
        return env in ("development", "dev", "local") or debug

    def _resolve_public_backend_url(self, callback_base: Optional[str] = None) -> str:
        """
        Resolve the public backend base URL for Unipile OAuth redirects and webhooks.

        Priority: validated callback_base (from frontend) → localhost in dev →
        LINKEDIN_SOCIAL_REDIRECT_URI origin → NGROK_URL → BACKEND_URL → localhost.
        """
        if callback_base:
            logger.info(
                f"[LinkedInConnect] Using public backend URL from callback_base={callback_base}"
            )
            return callback_base.rstrip("/")

        if self._should_prefer_localhost_callback():
            local = (
                os.getenv("LINKEDIN_LOCAL_BACKEND_URL", "http://localhost:8000")
                .strip()
                .rstrip("/")
            )
            if local and _normalize_backend_origin(local):
                logger.info(
                    f"[LinkedInConnect] Development mode: using local OAuth callback "
                    f"base={local} (set LINKEDIN_USE_NGROK_CALLBACK=true to use ngrok)"
                )
                return local

        configured_redirect = os.getenv("LINKEDIN_SOCIAL_REDIRECT_URI", "").strip()
        if configured_redirect:
            parsed = urlparse(configured_redirect)
            if parsed.scheme and parsed.netloc:
                origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
                if not _is_placeholder_backend_url(origin):
                    logger.info(
                        f"[LinkedInConnect] Using public backend URL from "
                        f"LINKEDIN_SOCIAL_REDIRECT_URI origin={origin}"
                    )
                    return origin
                logger.warning(
                    f"[LinkedInConnect] Ignoring placeholder LINKEDIN_SOCIAL_REDIRECT_URI "
                    f"origin={origin}"
                )

        ngrok_url = os.getenv("NGROK_URL", "").strip().rstrip("/")
        if ngrok_url:
            if not _is_placeholder_backend_url(ngrok_url):
                logger.info(f"[LinkedInConnect] Using public backend URL from NGROK_URL={ngrok_url}")
                return ngrok_url
            logger.warning(f"[LinkedInConnect] Ignoring placeholder NGROK_URL={ngrok_url}")

        backend_url = os.getenv("BACKEND_URL", "").strip().rstrip("/")
        if backend_url:
            if not _is_placeholder_backend_url(backend_url):
                logger.info(
                    f"[LinkedInConnect] Using public backend URL from BACKEND_URL={backend_url}"
                )
                return backend_url
            logger.warning(f"[LinkedInConnect] Ignoring placeholder BACKEND_URL={backend_url}")

        logger.warning(
            "[LinkedInConnect] No valid BACKEND_URL/NGROK_URL configured; "
            "using http://localhost:8000 for Unipile browser callbacks. "
            "Set NGROK_URL for notify_url webhooks from Unipile servers."
        )
        return "http://localhost:8000"

    def validate_callback_base(self, callback_base: Optional[str]) -> str:
        """
        Validate optional frontend-provided backend base URL for OAuth redirects.

        Local dev sends ``callback_base=http://localhost:8000`` so redirects avoid
        stale ngrok URLs in backend ``.env``. When omitted, uses
        ``_resolve_public_backend_url()``.

        Returns:
            Normalized origin ``scheme://host[:port]`` without trailing slash.

        Raises:
            ValueError: If ``callback_base`` is not a valid http(s) origin.
        """
        if not callback_base or not str(callback_base).strip():
            return self._resolve_public_backend_url()

        raw = str(callback_base).strip().rstrip("/")
        parsed = urlparse(raw)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("callback_base must use http or https")
        if not parsed.netloc:
            raise ValueError("callback_base must include a valid host")

        origin = f"{parsed.scheme}://{parsed.netloc}"
        if _is_placeholder_backend_url(origin):
            logger.warning(
                f"[LinkedInConnect] Ignoring placeholder callback_base={origin}; "
                "using resolved public backend URL"
            )
            return self._resolve_public_backend_url()

        logger.info(f"[LinkedInConnect] Using client callback_base={origin}")
        return origin

    async def try_sync_unipile_accounts(self, user_id: str) -> bool:
        """
        Best-effort sync from Unipile when credentials exist remotely but not in ALwrity.

        Matches accounts by hosted-auth ``name`` (ALwrity user id) or account detail
        fields. Returns False if no match is found — user must complete OAuth flow.
        """
        if os.getenv("LINKEDIN_PROVIDER", "unipile").lower() != "unipile":
            return False

        try:
            self.resolve_credentials(user_id)
            return True
        except LinkedInNotConnectedError:
            pass

        from services.integrations.linkedin.unipile_client import UnipileClient

        client = UnipileClient()
        try:
            items = await client.list_accounts(provider="LINKEDIN")
        except Exception as exc:
            logger.warning(
                f"[LinkedInConnect] Unipile account sync skipped user_id={user_id}: {exc}"
            )
            return False

        if not items:
            logger.warning(
                f"[LinkedInConnect] Unipile sync found 0 accounts for user_id={user_id} "
                "despite successful list_accounts API call"
            )
            return False

        def _account_id(item: Dict[str, Any]) -> Optional[str]:
            raw = item.get("id") or item.get("account_id")
            return str(raw) if raw else None

        def _is_running(item: Dict[str, Any]) -> bool:
            status = str(item.get("status") or item.get("state") or "").upper()
            return status in ("OK", "RUNNING", "CONNECTED", "CREATION_SUCCESS", "SYNC_SUCCESS", "")

        candidates = [item for item in items if _account_id(item) and _is_running(item)]
        if not candidates:
            candidates = [item for item in items if _account_id(item)]

        for item in candidates:
            account_id = _account_id(item)
            if not account_id:
                continue
            hosted_name = item.get("name")
            if hosted_name == user_id:
                logger.info(
                    f"[LinkedInConnect] Unipile sync matched account_id={account_id} "
                    f"for user_id={user_id} via list name"
                )
                return await self.handle_unipile_callback(
                    user_id=user_id,
                    account_id=account_id,
                    status="success",
                )

        for item in candidates:
            account_id = _account_id(item)
            if not account_id:
                continue
            try:
                detail = await client.get_account(account_id)
            except Exception as exc:
                logger.debug(
                    f"[LinkedInConnect] Unipile get_account failed account_id={account_id}: {exc}"
                )
                continue
            for key in ("name", "client_name", "reference", "external_id"):
                if detail.get(key) == user_id:
                    logger.info(
                        f"[LinkedInConnect] Unipile sync matched account_id={account_id} "
                        f"for user_id={user_id} via detail.{key}"
                    )
                    return await self.handle_unipile_callback(
                        user_id=user_id,
                        account_id=account_id,
                        status="success",
                    )

        logger.info(
            f"[LinkedInConnect] Unipile sync found no matching account for user_id={user_id} "
            f"(total_candidates={len(candidates)}); user must complete OAuth flow"
        )
        return False

    def _get_redirect_uri(self, callback_base: Optional[str] = None) -> str:
        if callback_base:
            return f"{callback_base.rstrip('/')}/api/linkedin-social/callback"
        if self._should_prefer_localhost_callback():
            local = (
                os.getenv("LINKEDIN_LOCAL_BACKEND_URL", "http://localhost:8000")
                .strip()
                .rstrip("/")
            )
            if local:
                return f"{local}/api/linkedin-social/callback"
        configured = os.getenv("LINKEDIN_SOCIAL_REDIRECT_URI")
        if configured and not _is_placeholder_backend_url(configured.strip()):
            return configured.strip()
        backend_url = self._resolve_public_backend_url(callback_base)
        return f"{backend_url}/api/linkedin-social/callback"

    def _build_oauth_state(self, user_id: str, state: Optional[str] = None) -> str:
        if state and ":" in state:
            return state
        token = state or secrets.token_urlsafe(32)
        return f"{user_id}:{token}"

    def _extract_user_id_from_state(self, state: str) -> Optional[str]:
        if ":" not in state:
            return None
        return state.split(":", 1)[0]

    def _get_unipile_redirect_urls(
        self, user_id: str, callback_base: Optional[str] = None
    ) -> Dict[str, str]:
        """Build Unipile redirect URLs for OAuth callback and webhook notification."""
        backend_url = self._resolve_public_backend_url(callback_base)
        encoded_name = quote(user_id, safe="")
        callback_base_url = f"{backend_url}/api/linkedin-social/callback"
        return {
            "success": (
                f"{callback_base_url}?provider=unipile&status=success&name={encoded_name}"
            ),
            "failure": (
                f"{callback_base_url}?provider=unipile&status=error&name={encoded_name}"
            ),
            "notify": f"{backend_url}/api/unipile/webhook",
        }

    async def generate_authorization_url(
        self,
        user_id: str,
        state: Optional[str] = None,
        *,
        callback_base: Optional[str] = None,
    ) -> Dict[str, str]:
        """Return OAuth authorization URL for Unipile or native LinkedIn based on LINKEDIN_PROVIDER."""
        provider = os.getenv("LINKEDIN_PROVIDER", "unipile").lower()
        oauth_state = self._build_oauth_state(user_id, state)
        backend_base = callback_base or self._resolve_public_backend_url()

        if provider == "unipile":
            api_key = os.getenv("UNIPILE_API_KEY")
            if not api_key:
                logger.error(f"[LinkedInConnect] UNIPILE_API_KEY missing user_id={user_id}")
                raise ValueError("UNIPILE_API_KEY is not configured")

            logger.info(f"[LinkedInConnect] generating Unipile auth URL user_id={user_id}")

            # Import Unipile client here to avoid circular imports
            from services.integrations.linkedin.unipile_client import UnipileClient

            client = UnipileClient()
            redirect_urls = self._get_unipile_redirect_urls(user_id, callback_base)
            backend_url = self._resolve_public_backend_url(callback_base)
            logger.info(
                f"[LinkedInConnect] Unipile redirect base_url={backend_base} user_id={user_id} "
                f"success={redirect_urls['success']}"
            )

            try:
                result = await client.create_hosted_auth_link(
                    user_id=user_id,
                    success_redirect_url=redirect_urls["success"],
                    failure_redirect_url=redirect_urls["failure"],
                    notify_url=redirect_urls["notify"],
                    providers=["LINKEDIN"],
                )
            except Exception as e:
                logger.error(f"[LinkedInConnect] Failed to create Unipile auth link: {e}")
                raise ValueError(f"Failed to generate Unipile auth URL: {e}")

            logger.info(f"[LinkedInConnect] Unipile auth URL generated for user={user_id}")
            return {
                "auth_url": result.auth_url,
                "state": user_id,  # Unipile uses 'name' param for user matching
                "provider": "unipile",
            }

        client_id = os.getenv("LINKEDIN_CLIENT_ID")
        if not client_id:
            raise ValueError("LINKEDIN_CLIENT_ID is not configured for native OAuth")

        code_verifier = (
            base64.urlsafe_b64encode(secrets.token_bytes(32))
            .decode("utf-8")
            .rstrip("=")
        )
        code_challenge = (
            base64.urlsafe_b64encode(
                hashlib.sha256(code_verifier.encode("utf-8")).digest()
            )
            .decode("utf-8")
            .rstrip("=")
        )
        redirect_uri = self._get_redirect_uri(callback_base)
        scopes = "r_liteprofile r_emailaddress w_member_social"
        params = urlencode(
            {
                "response_type": "code",
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "scope": scopes,
                "state": oauth_state,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            }
        )
        if not self.store_oauth_state(user_id, oauth_state, code_verifier=code_verifier):
            raise RuntimeError("Failed to persist OAuth state")

        return {
            "auth_url": f"https://www.linkedin.com/oauth/v2/authorization?{params}",
            "state": oauth_state,
            "provider": "native",
        }

    def _oauth_state_is_valid(self, user_id: str, state: str) -> bool:
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT expires_at, used_at
                    FROM linkedin_oauth_states
                    WHERE user_id = ? AND state = ?
                    """,
                    (user_id, state),
                )
                row = cursor.fetchone()
                if not row:
                    return False
                expires_at_str, used_at = row
                if used_at:
                    return False
                try:
                    expires_at = datetime.fromisoformat(str(expires_at_str))
                    if expires_at < datetime.now():
                        return False
                except Exception:
                    return False
                return True
        except Exception as e:
            logger.error(f"Failed to validate LinkedIn OAuth state for user {user_id}: {e}")
            return False

    def consume_oauth_state(self, user_id: str, state: str) -> Optional[str]:
        """Validate and consume one-time OAuth state; returns code_verifier if present."""
        if not self._oauth_state_is_valid(user_id, state):
            return None
        try:
            self._init_db(user_id)
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, code_verifier
                    FROM linkedin_oauth_states
                    WHERE user_id = ? AND state = ?
                    """,
                    (user_id, state),
                )
                row = cursor.fetchone()
                if not row:
                    return None
                row_id, code_verifier = row
                cursor.execute(
                    """
                    UPDATE linkedin_oauth_states
                    SET used_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (row_id,),
                )
                conn.commit()
                return code_verifier
        except Exception as e:
            logger.error(f"Failed to consume LinkedIn OAuth state for user {user_id}: {e}")
            return None

    def peek_oauth_state_user(self, state: str) -> Optional[str]:
        """Return user_id for a valid unused OAuth state without consuming it."""
        user_id = self._extract_user_id_from_state(state)
        if not user_id:
            return None
        if self._oauth_state_is_valid(user_id, state):
            return user_id
        return None

    def consume_oauth_state_for_user(self, state: str) -> Optional[str]:
        """Validate OAuth state and return the owning user_id."""
        user_id = self._extract_user_id_from_state(state)
        if not user_id:
            return None
        if not self._oauth_state_is_valid(user_id, state):
            return None
        self.consume_oauth_state(user_id, state)
        return user_id

    def handle_native_oauth_callback(
        self, user_id: str, code: str, state: str
    ) -> Optional[Dict[str, Any]]:
        """Exchange native LinkedIn OAuth code for tokens and store them."""
        state_user = self._extract_user_id_from_state(state)
        if state_user and state_user != user_id:
            logger.error("LinkedIn OAuth state user mismatch")
            return None

        code_verifier = self.consume_oauth_state(user_id, state)
        if not code_verifier:
            logger.error("Invalid or expired LinkedIn OAuth state")
            return None

        client_id = os.getenv("LINKEDIN_CLIENT_ID")
        client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
        if not client_id or not client_secret:
            logger.error("LINKEDIN_CLIENT_ID/SECRET not configured")
            return None

        redirect_uri = self._get_redirect_uri()
        try:
            response = requests.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code_verifier": code_verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )
            if response.status_code != 200:
                logger.error(
                    f"LinkedIn OAuth token exchange failed: "
                    f"{response.status_code} - {response.text}"
                )
                return None
            token_info = response.json()
            access_token = token_info.get("access_token")
            if not access_token:
                return None
            refresh_token = token_info.get("refresh_token")
            expires_in = token_info.get("expires_in", 3600)
            expires_at = (datetime.now() + timedelta(seconds=expires_in)).isoformat()
            stored = self.store_native_tokens(
                user_id=user_id,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
            )
            if not stored:
                return None
            return {
                "access_token": access_token,
                "expires_in": expires_in,
                "expires_at": expires_at,
            }
        except Exception as e:
            logger.error(f"LinkedIn native OAuth callback error for user {user_id}: {e}")
            return None

    async def handle_unipile_callback(
        self,
        user_id: str,
        account_id: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> bool:
        """
        Handle Unipile OAuth callback and store credentials.

        This method is called after the user completes authentication on
        the Unipile hosted auth page. Unipile redirects to our callback
        with the account_id and status.

        Args:
            user_id: Internal user ID (passed as 'name' param to Unipile)
            account_id: Unipile account ID from successful auth
            status: 'success' or 'error'
            error_message: Error details if status is 'error'

        Returns:
            True if credentials stored successfully
        """
        if status != "success":
            logger.error(
                f"[LinkedInConnect] Unipile callback failed for user={user_id}: {error_message}"
            )
            return False

        if not account_id:
            logger.error(f"[LinkedInConnect] Unipile callback missing account_id for user={user_id}")
            return False

        # Fetch account details from Unipile to get account name
        from services.integrations.linkedin.unipile_client import UnipileClient

        client = UnipileClient()
        account_name = None
        profile_urn = None

        try:
            account_data = await client.get_account(account_id)
            from services.integrations.linkedin.unipile_provider import (
                unipile_display_name_from_item,
            )

            account_name = unipile_display_name_from_item(
                account_data,
                user_id=user_id,
            )
            profile_urn = account_data.get("profile_urn") or account_data.get("urn")
            logger.info(
                f"[LinkedInConnect] Fetched Unipile account details for user={user_id}, "
                f"account_name={account_name}"
            )
        except Exception as e:
            logger.warning(
                f"[LinkedInConnect] Could not fetch Unipile account details for user={user_id}: {e}. "
                "Proceeding with account_id only."
            )

        # Store credentials
        stored = self.store_unipile_credentials(
            user_id=user_id,
            unipile_account_id=account_id,
            account_name=account_name,
            profile_urn=profile_urn,
        )

        if stored:
            logger.info(
                f"[LinkedInConnect] Unipile callback succeeded for user={user_id}, account_id={account_id}"
            )
        else:
            logger.error(f"[LinkedInConnect] Failed to store Unipile credentials for user={user_id}")

        return stored

    def store_oauth_state(
        self,
        user_id: str,
        state: str,
        code_verifier: Optional[str] = None,
        ttl_seconds: int = 600,
    ) -> bool:
        try:
            self._init_db(user_id)
            expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
            db_path = self._get_db_path(user_id)
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO linkedin_oauth_states
                    (user_id, state, code_verifier, expires_at, created_at, used_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)
                    """,
                    (user_id, state, code_verifier, expires_at.isoformat()),
                )
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to store LinkedIn OAuth state for user {user_id}: {e}")
            return False

"""
LinkedIn OAuth / credential service for Growth Engine.

Supports Zernio per-user profiles + OAuth connect and native LinkedIn OAuth tokens,
with Fernet encryption and per-user SQLite.
"""

from __future__ import annotations

import base64
import hashlib
import os
import secrets
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional, Tuple
from urllib.parse import quote, urlencode

import requests
from cryptography.fernet import Fernet, InvalidToken
from loguru import logger

from services.database import get_user_db_path
from services.integrations.linkedin.types import (
    LinkedInCredentials,
    LinkedInNotConnectedError,
)
from services.integrations.linkedin.zernio_client import (
    account_id_from_item,
    account_name_from_item,
    account_type_from_item,
    create_profile_sync,
    delete_account_sync,
    get_connect_url_sync,
    list_accounts_sync,
    zernio_base_url,
    _parse_account_items,
)


class LinkedInOAuthService:
    """Manages LinkedIn Growth Engine credentials (Zernio or native OAuth)."""

    _TOKEN_SELECT_COLUMNS = """
        id, user_id, provider_mode, zernio_api_key, zernio_account_id,
        zernio_org_account_id, linkedin_access_token, linkedin_refresh_token,
        expires_at, account_name, profile_urn, is_active, created_at, updated_at,
        zernio_profile_id
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path
        self.token_encryption_key = (
            os.getenv("LINKEDIN_TOKEN_ENCRYPTION_KEY")
            or os.getenv("OAUTH_TOKEN_ENCRYPTION_KEY")
        )
        self._fernet = self._initialize_fernet()
        self._migration_done: set[str] = set()

    def _initialize_fernet(self) -> Optional[Fernet]:
        if not self.token_encryption_key:
            logger.warning(
                "LinkedIn token encryption key not configured; "
                "per-user credential storage will be unavailable."
            )
            return None
        try:
            return Fernet(self.token_encryption_key.encode("utf-8"))
        except Exception:
            logger.error("LinkedIn token encryption key is invalid.")
            return None

    def _encrypt_token(self, token: Optional[str]) -> Optional[str]:
        if not token:
            return None
        if not self._fernet:
            raise ValueError(
                "Token encryption unavailable: set LINKEDIN_TOKEN_ENCRYPTION_KEY "
                "or OAUTH_TOKEN_ENCRYPTION_KEY"
            )
        return self._fernet.encrypt(token.encode("utf-8")).decode("utf-8")

    def _decrypt_token(self, token_blob: Optional[str]) -> Optional[str]:
        if not token_blob:
            return None
        if not self._fernet:
            raise ValueError("Token decryption unavailable: missing encryption key")
        try:
            return self._fernet.decrypt(token_blob.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            logger.error("LinkedIn token decryption failed (invalid token blob)")
            return None

    def _is_likely_encrypted_blob(self, value: Optional[str]) -> bool:
        return bool(value and value.startswith("gAAAAA"))

    def _get_db_path(self, user_id: str) -> str:
        if self.db_path:
            return self.db_path
        return get_user_db_path(user_id)

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
                    zernio_profile_id TEXT
                )
                """
            )
            cursor.execute("PRAGMA table_info(linkedin_oauth_tokens)")
            existing_cols = {row[1] for row in cursor.fetchall()}
            if "zernio_profile_id" not in existing_cols:
                cursor.execute(
                    "ALTER TABLE linkedin_oauth_tokens ADD COLUMN zernio_profile_id TEXT"
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
            conn.commit()

    def _migrate_plaintext_tokens_if_needed(
        self, conn: sqlite3.Connection, user_id: str
    ) -> None:
        if not self._fernet or user_id in self._migration_done:
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
        zernio_profile_id = rest[0] if rest else None

        def _maybe_decrypt(value: Optional[str]) -> Optional[str]:
            if not value:
                return None
            if self._is_likely_encrypted_blob(value):
                return self._decrypt_token(value)
            return value

        return LinkedInCredentials.from_db_row(
            {
                "provider_mode": provider_mode,
                "zernio_api_key": _maybe_decrypt(zernio_api_key),
                "zernio_profile_id": zernio_profile_id,
                "zernio_account_id": zernio_account_id,
                "zernio_org_account_id": zernio_org_account_id,
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

    def store_zernio_credentials(
        self,
        user_id: str,
        zernio_api_key: str,
        zernio_account_id: str,
        zernio_org_account_id: Optional[str] = None,
        account_name: Optional[str] = None,
        profile_urn: Optional[str] = None,
        zernio_profile_id: Optional[str] = None,
    ) -> bool:
        try:
            self._init_db(user_id)
            enc_key = self._encrypt_token(zernio_api_key)
            resolved_profile_id = zernio_profile_id or self._get_stored_zernio_profile_id(
                user_id
            )
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
                        user_id, provider_mode, zernio_api_key, zernio_account_id,
                        zernio_org_account_id, account_name, profile_urn, is_active,
                        zernio_profile_id
                    ) VALUES (?, 'zernio', ?, ?, ?, ?, ?, 1, ?)
                    """,
                    (
                        user_id,
                        enc_key,
                        zernio_account_id,
                        zernio_org_account_id,
                        account_name,
                        profile_urn,
                        resolved_profile_id,
                    ),
                )
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to store Zernio credentials for user {user_id}: {e}")
            return False

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
            _zernio_api_key,
            zernio_account_id,
            zernio_org_account_id,
            _linkedin_access_token,
            linkedin_refresh_token,
            expires_at,
            account_name,
            profile_urn,
            is_active,
            created_at,
            _updated_at,
        ) = row
        not_expired, expires_dt = self._parse_expires_at(expires_at)
        has_refresh = bool(linkedin_refresh_token)
        return {
            "id": token_id,
            "provider_mode": provider_mode,
            "zernio_account_id": zernio_account_id,
            "zernio_org_account_id": zernio_org_account_id,
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
        if creds.provider_mode == "zernio" and creds.zernio_api_key:
            return creds
        if creds.provider_mode == "native" and creds.linkedin_access_token:
            return creds
        raise LinkedInNotConnectedError("LinkedIn credentials row is incomplete")

    def resolve_credentials(self, user_id: str) -> LinkedInCredentials:
        row = self._get_active_token_row(user_id)
        if not row:
            raise LinkedInNotConnectedError("No LinkedIn credentials available for user")
        creds = self._row_to_credentials(row)
        if creds.provider_mode == "zernio" and creds.zernio_api_key:
            return creds
        if creds.provider_mode == "native" and creds.linkedin_access_token:
            return creds
        raise LinkedInNotConnectedError("LinkedIn credentials row is incomplete")

    def test_zernio_credentials(self, creds: LinkedInCredentials) -> bool:
        """Sync health check for Zernio API key (returns True if key is valid)."""
        if not creds.zernio_api_key:
            return False
        base_url = creds.zernio_api_url.rstrip("/")
        try:
            response = requests.get(
                f"{base_url}/accounts",
                params={"platform": "linkedin"},
                headers={
                    "Authorization": f"Bearer {creds.zernio_api_key}",
                    "Accept": "application/json",
                },
                timeout=30,
            )
            return response.status_code < 400
        except Exception as e:
            logger.error(f"Zernio credential health check failed: {e}")
            return False

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
        For Zernio mode, validates API key via health check when monitoring.
        """
        creds = (
            self._resolve_db_credentials(user_id)
            if monitoring
            else self.resolve_credentials(user_id)
        )

        if creds.provider_mode == "zernio":
            if monitoring and not self.test_zernio_credentials(creds):
                raise LinkedInNotConnectedError("Zernio API key is invalid or expired")
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
        provider = os.getenv("LINKEDIN_PROVIDER", "zernio")
        row = self._get_active_token_row(user_id)
        has_db_token = row is not None

        try:
            creds = self.resolve_credentials(user_id)
            connected = True
        except LinkedInNotConnectedError:
            connected = False
            creds = None

        accounts: List[Dict[str, Any]] = []
        if connected and creds and creds.zernio_account_id:
            accounts.append(
                {
                    "account_id": creds.zernio_account_id,
                    "account_type": "personal",
                    "source": creds.source,
                }
            )
        if connected and creds and creds.zernio_org_account_id:
            accounts.append(
                {
                    "account_id": creds.zernio_org_account_id,
                    "account_type": "organization",
                    "source": creds.source,
                }
            )

        return {
            "connected": connected,
            "provider": provider,
            "has_per_user_token": has_db_token,
            "has_env_fallback": False,
            "accounts": accounts,
            "account_name": creds.account_name if creds else None,
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

    def disconnect_user(self, user_id: str) -> Dict[str, Any]:
        """Revoke per-user tokens and best-effort Zernio account removal."""
        logger.info(f"[LinkedInConnect] disconnect_user start user_id={user_id}")
        row = self._get_active_token_row(user_id)
        zernio_deleted = False
        deleted_ids: set[str] = set()
        if row:
            creds = self._row_to_credentials(row)
            if creds.provider_mode == "zernio" and creds.zernio_api_key:
                account_ids_to_delete: List[str] = []
                if creds.zernio_profile_id:
                    try:
                        raw = list_accounts_sync(
                            creds.zernio_api_key,
                            creds.zernio_api_url,
                            creds.zernio_profile_id,
                            platform="linkedin",
                        )
                        for item in _parse_account_items(raw):
                            aid = account_id_from_item(item)
                            if aid:
                                account_ids_to_delete.append(aid)
                    except Exception as e:
                        logger.warning(
                            f"[LinkedInConnect] could not list Zernio accounts for disconnect "
                            f"user_id={user_id}: {e}"
                        )
                if not account_ids_to_delete:
                    for aid in (creds.zernio_account_id, creds.zernio_org_account_id):
                        if aid:
                            account_ids_to_delete.append(aid)
                for aid in account_ids_to_delete:
                    if aid in deleted_ids:
                        continue
                    if delete_account_sync(
                        creds.zernio_api_key,
                        creds.zernio_api_url,
                        aid,
                    ):
                        zernio_deleted = True
                        deleted_ids.add(aid)
        revoked = self.revoke_token(user_id)
        status = self.get_connection_status(user_id)
        logger.info(
            f"[LinkedInConnect] disconnect_user done user_id={user_id} "
            f"revoked={revoked} zernio_deleted={zernio_deleted}"
        )
        return {
            "success": revoked or zernio_deleted,
            "revoked": revoked,
            "zernio_account_deleted": zernio_deleted,
            "connected": status.get("connected", False),
            "has_env_fallback": False,
        }

    def _get_stored_zernio_profile_id(self, user_id: str) -> Optional[str]:
        self._init_db(user_id)
        db_path = self._get_db_path(user_id)
        if not os.path.exists(db_path):
            return None
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT zernio_profile_id FROM linkedin_oauth_tokens
                WHERE user_id = ? AND zernio_profile_id IS NOT NULL AND zernio_profile_id != ''
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id,),
            )
            row = cursor.fetchone()
            return str(row[0]) if row and row[0] else None

    def _persist_zernio_profile_id(self, user_id: str, profile_id: str) -> None:
        self._init_db(user_id)
        db_path = self._get_db_path(user_id)
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE linkedin_oauth_tokens
                SET zernio_profile_id = ?, updated_at = datetime('now')
                WHERE user_id = ? AND is_active = 1
                """,
                (profile_id, user_id),
            )
            if cursor.rowcount == 0:
                cursor.execute(
                    """
                    INSERT INTO linkedin_oauth_tokens (
                        user_id, provider_mode, zernio_profile_id, is_active
                    ) VALUES (?, 'zernio', ?, 0)
                    """,
                    (user_id, profile_id),
                )
            conn.commit()

    def ensure_zernio_profile(
        self, user_id: str, *, display_name: Optional[str] = None
    ) -> str:
        """Ensure the user has a Zernio profile (Quickstart Step 1)."""
        existing = self._get_stored_zernio_profile_id(user_id)
        if existing:
            return existing

        api_key = os.getenv("ZERNIO_API_KEY")
        if not api_key:
            raise ValueError("ZERNIO_API_KEY is not configured")

        profile_label = display_name or f"ALwrity - {user_id}"
        result = create_profile_sync(
            api_key,
            zernio_base_url(),
            profile_label,
            description="ALwrity LinkedIn social profile",
        )
        profile_id = result["profileId"]
        self._persist_zernio_profile_id(user_id, profile_id)
        logger.info(f"Created Zernio profile {profile_id} for user {user_id}")
        return profile_id

    def sync_zernio_accounts(self, user_id: str) -> List[Dict[str, Any]]:
        """Sync LinkedIn accounts from Zernio for the user's profile (Quickstart Step 3)."""
        api_key = os.getenv("ZERNIO_API_KEY")
        if not api_key:
            raise ValueError("ZERNIO_API_KEY is not configured")

        profile_id = self._get_stored_zernio_profile_id(user_id)
        if not profile_id:
            raise ValueError("No Zernio profile found for user; run ensure_zernio_profile first")

        raw = list_accounts_sync(
            api_key,
            zernio_base_url(),
            profile_id,
            platform="linkedin",
        )
        items = _parse_account_items(raw)
        if not items:
            raise ValueError("No LinkedIn accounts found for this Zernio profile")

        personal_item = None
        org_item = None
        for item in items:
            account_type = (account_type_from_item(item) or "").lower()
            if account_type == "personal" and personal_item is None:
                personal_item = item
            elif account_type in ("organization", "org") and org_item is None:
                org_item = item

        primary_item = personal_item or items[0]
        primary_id = account_id_from_item(primary_item)
        if not primary_id:
            raise ValueError("Zernio account list missing account id")

        org_id = None
        if org_item and org_item is not primary_item:
            org_id = account_id_from_item(org_item) or None

        account_name = account_name_from_item(primary_item)
        stored = self.store_zernio_credentials(
            user_id=user_id,
            zernio_api_key=api_key,
            zernio_account_id=primary_id,
            zernio_org_account_id=org_id,
            account_name=account_name,
            zernio_profile_id=profile_id,
        )
        if not stored:
            raise RuntimeError("Failed to store synced Zernio credentials")

        synced: List[Dict[str, Any]] = []
        for item in items:
            aid = account_id_from_item(item)
            if not aid:
                continue
            synced.append(
                {
                    "account_id": aid,
                    "account_type": account_type_from_item(item),
                    "username": account_name_from_item(item),
                }
            )
        return synced

    def _get_redirect_uri(self) -> str:
        configured = os.getenv("LINKEDIN_SOCIAL_REDIRECT_URI")
        if configured:
            return configured.strip()
        backend_url = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
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

    def generate_authorization_url(self, user_id: str, state: Optional[str] = None) -> Dict[str, str]:
        """Return OAuth authorization URL for Zernio or native LinkedIn based on LINKEDIN_PROVIDER."""
        provider = os.getenv("LINKEDIN_PROVIDER", "zernio").lower()
        oauth_state = self._build_oauth_state(user_id, state)

        if provider == "zernio":
            api_key = os.getenv("ZERNIO_API_KEY")
            if not api_key:
                logger.error(f"[LinkedInConnect] ZERNIO_API_KEY missing user_id={user_id}")
                raise ValueError("ZERNIO_API_KEY is not configured")

            profile_id = self.ensure_zernio_profile(user_id)
            logger.info(
                f"[LinkedInConnect] generating Zernio auth URL user_id={user_id} profile_id={profile_id}"
            )

            redirect_uri = self._get_redirect_uri()
            redirect_with_state = (
                f"{redirect_uri}?alwrity_state={quote(oauth_state, safe='')}"
            )
            base_url = zernio_base_url()
            connect_data = get_connect_url_sync(
                api_key,
                base_url,
                profile_id,
                redirect_with_state,
            )
            if not self.store_oauth_state(user_id, oauth_state):
                raise RuntimeError("Failed to persist OAuth state")
            return {
                "auth_url": connect_data["authUrl"],
                "state": oauth_state,
                "provider": "zernio",
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
        redirect_uri = self._get_redirect_uri()
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

    def handle_zernio_connect_callback(
        self, user_id: str, query_params: Mapping[str, str]
    ) -> bool:
        """Persist Zernio credentials after standard connect redirect."""
        connected = query_params.get("connected")
        account_id = query_params.get("accountId") or query_params.get("account_id")
        if not account_id and connected != "linkedin":
            return False

        api_key = os.getenv("ZERNIO_API_KEY")
        if not api_key:
            logger.error(f"[LinkedInConnect] ZERNIO_API_KEY missing during callback user_id={user_id}")
            return False

        alwrity_state = query_params.get("alwrity_state")
        if alwrity_state:
            state_user = self._extract_user_id_from_state(alwrity_state)
            if state_user and state_user != user_id:
                logger.error(
                    f"[LinkedInConnect] OAuth state user mismatch user_id={user_id} state_user={state_user}"
                )
                return False
            if not self._oauth_state_is_valid(user_id, alwrity_state):
                logger.error(f"[LinkedInConnect] invalid or expired OAuth state user_id={user_id}")
                return False
            self.consume_oauth_state(user_id, alwrity_state)

        try:
            self.sync_zernio_accounts(user_id)
            logger.info(f"[LinkedInConnect] Zernio account sync succeeded user_id={user_id}")
            return True
        except Exception as e:
            logger.error(f"[LinkedInConnect] Zernio account sync failed user_id={user_id}: {e}")
            if not account_id:
                return False
            username = query_params.get("username")
            profile_id = self._get_stored_zernio_profile_id(user_id)
            return self.store_zernio_credentials(
                user_id=user_id,
                zernio_api_key=api_key,
                zernio_account_id=account_id,
                account_name=username,
                zernio_profile_id=profile_id,
            )

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

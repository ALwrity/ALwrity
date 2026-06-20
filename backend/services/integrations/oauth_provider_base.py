"""
OAuth Provider Base Class

Shared Fernet token encryption + plaintext migration for the four
ALwrity OAuth providers (Bing, Wix, WordPress, YouTube).

All four providers store their OAuth tokens in a per-user SQLite
database (see services.database.get_user_db_path) and exchange
them with remote APIs. Before this base class existed, each
provider maintained its own copy of the Fernet init / encrypt /
decrypt / migration logic. Bing (the only one that was storing
plaintext) caught up with the others in commit e383d08c, but
the actual code was still duplicated across all four files.

This module extracts the shared surface:

- _initialize_fernet: read BING_TOKEN_ENCRYPTION_KEY /
  WIX_TOKEN_ENCRYPTION_KEY / WORDPRESS_TOKEN_ENCRYPTION_KEY /
  YOUTUBE_TOKEN_ENCRYPTION_KEY (each provider class supplies
  its key attribute name) with a shared fallback to
  OAUTH_TOKEN_ENCRYPTION_KEY. Returns Optional[Fernet] (matches
  the Wix/WordPress/Bing convention). YouTube overrides this to
  raise on missing key (see oauth_provider_base / YouTube).
- _encrypt_token / _decrypt_token: word-for-word identical
  across providers. Raise ValueError if Fernet is unavailable
  so the caller knows the failure mode.
- _is_likely_encrypted_blob: Fernet ciphertext starts with
  'gAAAAA'. Used to skip decryption for already-plaintext
  rows during the one-time migration.
- _migrate_plaintext_tokens_if_needed: re-encrypts any plaintext
  rows the first time the user reads their tokens, gated by
  the per-instance _migration_done set so the migration runs
  at most once per user per process.
- _get_db_path: thin wrapper over services.database.get_user_db_path
  that honours an optional ctor-injected db_path (for tests).

Subclasses (WixOAuthService, WordPressOAuthService,
BingOAuthService, YouTubeOAuthService) keep their own:

- __init__: provider-specific client_id, client_secret, scope,
  redirect_uri, base_url
- _init_db: provider-specific SQLite schema (CREATE TABLE
  per provider, with different columns)
- _get_db_path override: only if a provider needs a different
  path resolution
- generate_authorization_url / handle_oauth_callback:
  provider-specific OAuth flow
- The full Google OAuth library integration in YouTubeOAuthService
  (uses google-auth-oauthlib instead of manual token storage)
"""

import os
import sqlite3
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from loguru import logger

from services.database import get_user_db_path


# Per-provider env var names, in the order they should be tried
# (provider-specific first, shared fallback last). Subclasses
# override the appropriate name.
PROVIDER_ENV_VARS = {
    "bing": "BING_TOKEN_ENCRYPTION_KEY",
    "wix": "WIX_TOKEN_ENCRYPTION_KEY",
    "wordpress": "WORDPRESS_TOKEN_ENCRYPTION_KEY",
    "youtube": "YOUTUBE_TOKEN_ENCRYPTION_KEY",
}


class OAuthProviderBase:
    """Shared Fernet encryption + plaintext migration for OAuth tokens.

    Subclasses must define:
        self.token_encryption_key: str | None  (set in __init__)
    """

    def _initialize_fernet(self) -> Optional[Fernet]:
        if not self.token_encryption_key:
            logger.error(
                f"{type(self).__name__} token encryption key is not configured."
            )
            return None
        try:
            return Fernet(self.token_encryption_key.encode("utf-8"))
        except Exception:
            logger.error(
                f"{type(self).__name__} token encryption key is invalid."
            )
            return None

    def _encrypt_token(self, token: Optional[str]) -> Optional[str]:
        if not token:
            return None
        if not self._fernet:
            raise ValueError(
                "Token encryption is unavailable: missing/invalid managed key"
            )
        return self._fernet.encrypt(token.encode("utf-8")).decode("utf-8")

    def _decrypt_token(self, token_blob: Optional[str]) -> Optional[str]:
        if not token_blob:
            return None
        if not self._fernet:
            raise ValueError(
                "Token decryption is unavailable: missing/invalid managed key"
            )
        return self._fernet.decrypt(token_blob.encode("utf-8")).decode("utf-8")

    def _is_likely_encrypted_blob(self, value: Optional[str]) -> bool:
        return bool(value and value.startswith("gAAAAA"))

    def _migrate_plaintext_tokens_if_needed(
        self, conn: sqlite3.Connection, user_id: str
    ) -> None:
        """One-time migration: re-encrypt plaintext rows during rollout.

        Subclasses must define:
            self._migration_done: set  (per-user-per-process gate)
            self._select_plaintext_tokens_sql: str  (SELECT id, access_token, refresh_token ...)
            self._update_token_sql: str  (UPDATE ... SET access_token = ?, refresh_token = ?, updated_at = ...)

        See WixOAuthService for the canonical pattern.
        """
        if not self._fernet or user_id in self._migration_done:
            return
        cursor = conn.cursor()
        cursor.execute(self._select_plaintext_tokens_sql, (user_id,))
        rows = cursor.fetchall()
        migrated = 0
        for row in rows:
            token_id = row[0]
            access_token = row[1]
            refresh_token = row[2]
            needs_access = access_token and not self._is_likely_encrypted_blob(access_token)
            needs_refresh = refresh_token and not self._is_likely_encrypted_blob(refresh_token)
            if not (needs_access or needs_refresh):
                continue
            enc_access = self._encrypt_token(access_token) if needs_access else access_token
            enc_refresh = self._encrypt_token(refresh_token) if needs_refresh else refresh_token
            cursor.execute(
                self._update_token_sql,
                (enc_access, enc_refresh, token_id, user_id),
            )
            migrated += 1
        if migrated:
            conn.commit()
            logger.info(
                f"{type(self).__name__} OAuth token migration completed for user {user_id}; rows migrated={migrated}"
            )
        self._migration_done.add(user_id)

    def _get_db_path(self, user_id: str) -> str:
        if getattr(self, "db_path", None):
            return self.db_path
        return get_user_db_path(user_id)


def resolve_encryption_key(provider_name: str) -> Optional[str]:
    """Resolve the Fernet key for a provider, honouring the
    provider-specific env var first, then the shared
    OAUTH_TOKEN_ENCRYPTION_KEY fallback.

    Used by subclass __init__ methods to set
    self.token_encryption_key.
    """
    provider_var = PROVIDER_ENV_VARS.get(provider_name.lower())
    if provider_var:
        specific = os.getenv(provider_var)
        if specific:
            return specific
    return os.getenv("OAUTH_TOKEN_ENCRYPTION_KEY")

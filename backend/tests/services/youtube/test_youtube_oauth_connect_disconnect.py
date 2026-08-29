"""YouTube OAuth connect / disconnect service tests (TDD).

Locks the per-user token journey used by Creator Studio:
generate auth URL → persist state → callback save → status → revoke.
Google Flow is mocked; SQLite persistence is real.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from cryptography.fernet import Fernet

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_oauth_tdd"
DEFAULT_REDIRECT = "http://localhost:8000/api/youtube/oauth/callback"

_OAUTH_SCHEMA = """
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
    is_active BOOLEAN DEFAULT 1
);
CREATE TABLE IF NOT EXISTS youtube_oauth_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    state TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);
"""


def _build_service(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, **env: str):
    from services.youtube.youtube_oauth_service import YouTubeOAuthService

    monkeypatch.setenv("OAUTH_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv("YOUTUBE_REDIRECT_URI", env.get("redirect", DEFAULT_REDIRECT))
    for key, value in env.items():
        if key != "redirect":
            monkeypatch.setenv(key, value)

    db_path = tmp_path / "alwrity_user_yt_oauth.db"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(_OAUTH_SCHEMA)
        conn.commit()

    service = YouTubeOAuthService(db_path=str(db_path))
    service._init_db = lambda _user_id: None  # noqa: ARG005 — skip Alembic in unit tests
    return service


def _insert_active_token(service, user_id: str, channel_name: str = "ALwrity Channel") -> int:
    enc_access = service._encrypt_token("ya29.access") or "ya29.access"
    enc_refresh = service._encrypt_token("1//refresh")
    with sqlite3.connect(service.db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO youtube_oauth_tokens
                (user_id, access_token, refresh_token, scope, channel_id, channel_name, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (
                user_id,
                enc_access,
                enc_refresh,
                " ".join(service.SCOPES),
                "UCtestchannel",
                channel_name,
            ),
        )
        conn.commit()
        return int(cursor.lastrowid)


class TestYouTubeOAuthRedirectAndConfig:
    def test_uses_youtube_redirect_uri_from_env(self, tmp_path, monkeypatch):
        custom = "https://example.test/api/youtube/oauth/callback"
        service = _build_service(tmp_path, monkeypatch, redirect=custom)
        assert service.redirect_uri == custom

    def test_defaults_to_backend_oauth_callback(self, tmp_path, monkeypatch):
        monkeypatch.delenv("YOUTUBE_REDIRECT_URI", raising=False)
        monkeypatch.setenv("OAUTH_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
        monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
        monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-secret")
        from services.youtube.youtube_oauth_service import YouTubeOAuthService

        service = YouTubeOAuthService(db_path=str(tmp_path / "empty.db"))
        assert service.redirect_uri == DEFAULT_REDIRECT

    def test_missing_google_credentials_disables_client_config(self, tmp_path, monkeypatch):
        monkeypatch.setenv("OAUTH_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
        monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
        monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
        from services.youtube.youtube_oauth_service import YouTubeOAuthService

        service = YouTubeOAuthService(db_path=str(tmp_path / "noconfig.db"))
        assert service.client_config is None
        assert service.generate_authorization_url(USER_ID) is None

    def test_scopes_include_upload_readonly_and_analytics(self, tmp_path, monkeypatch):
        service = _build_service(tmp_path, monkeypatch)
        joined = " ".join(service.SCOPES)
        assert "youtube.upload" in joined
        assert "youtube.readonly" in joined
        assert "yt-analytics.readonly" in joined


class TestYouTubeOAuthConnect:
    def test_generate_authorization_url_persists_state(self, tmp_path, monkeypatch):
        service = _build_service(tmp_path, monkeypatch)
        fake_flow = MagicMock()
        fake_flow.authorization_url.return_value = (
            "https://accounts.google.com/o/oauth2/auth?redirect_uri=http",
            None,
        )

        with patch("services.youtube.youtube_oauth_service.Flow") as flow_cls:
            flow_cls.from_client_config.return_value = fake_flow
            url = service.generate_authorization_url(USER_ID)

        assert url and url.startswith("https://accounts.google.com/")
        flow_cls.from_client_config.assert_called_once()
        assert flow_cls.from_client_config.call_args.kwargs["redirect_uri"] == DEFAULT_REDIRECT

        with sqlite3.connect(service.db_path) as conn:
            row = conn.execute(
                "SELECT state, user_id FROM youtube_oauth_states WHERE user_id = ?",
                (USER_ID,),
            ).fetchone()
        assert row is not None
        assert row[1] == USER_ID
        assert row[0].startswith(f"{USER_ID}:")

    def test_callback_rejects_invalid_state_format(self, tmp_path, monkeypatch):
        service = _build_service(tmp_path, monkeypatch)
        result = service.handle_oauth_callback("code-123", "not-a-valid-state")
        assert result["success"] is False
        assert "state" in result["error"].lower()

    def test_callback_rejects_unknown_state(self, tmp_path, monkeypatch):
        service = _build_service(tmp_path, monkeypatch)
        result = service.handle_oauth_callback("code-123", f"{USER_ID}:missing")
        assert result["success"] is False
        assert "state" in result["error"].lower()

    def test_callback_saves_encrypted_tokens_and_channel(self, tmp_path, monkeypatch):
        service = _build_service(tmp_path, monkeypatch)
        fake_flow = MagicMock()
        fake_flow.authorization_url.return_value = ("https://accounts.google.com/auth", None)
        fake_flow.credentials = SimpleNamespace(
            token="ya29.connect-access",
            refresh_token="1//connect-refresh",
            expiry=None,
        )

        with patch("services.youtube.youtube_oauth_service.Flow") as flow_cls:
            flow_cls.from_client_config.return_value = fake_flow
            auth_url = service.generate_authorization_url(USER_ID)
            assert auth_url

            with sqlite3.connect(service.db_path) as conn:
                state = conn.execute(
                    "SELECT state FROM youtube_oauth_states WHERE user_id = ?",
                    (USER_ID,),
                ).fetchone()[0]

            with patch.object(
                service,
                "_fetch_channel_info",
                return_value={"channel_id": "UCabc", "channel_name": "Studio Channel"},
            ):
                result = service.handle_oauth_callback("auth-code", state)

        assert result["success"] is True
        assert result["channel_id"] == "UCabc"
        assert result["channel_name"] == "Studio Channel"

        status = service.get_connection_status(USER_ID)
        assert status["connected"] is True
        assert status["channels"][0]["channel_name"] == "Studio Channel"
        assert status["channels"][0]["is_active"] is True
        assert status["analytics_ready"] is True

        with sqlite3.connect(service.db_path) as conn:
            access, leftover_state = conn.execute(
                """
                SELECT t.access_token,
                       (SELECT COUNT(*) FROM youtube_oauth_states WHERE state = ?)
                FROM youtube_oauth_tokens t WHERE t.user_id = ?
                """,
                (state, USER_ID),
            ).fetchone()
        assert leftover_state == 0
        assert access != "ya29.connect-access"
        assert access.startswith("gAAAAA")


class TestYouTubeOAuthDisconnect:
    def test_status_is_disconnected_when_no_tokens(self, tmp_path, monkeypatch):
        service = _build_service(tmp_path, monkeypatch)
        status = service.get_connection_status(USER_ID)
        assert status["connected"] is False
        assert status["channels"] == []

    def test_status_is_disconnected_when_db_missing(self, tmp_path, monkeypatch):
        monkeypatch.setenv("OAUTH_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
        monkeypatch.setenv("GOOGLE_CLIENT_ID", "id")
        monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
        from services.youtube.youtube_oauth_service import YouTubeOAuthService

        service = YouTubeOAuthService(db_path=str(tmp_path / "does-not-exist.db"))
        status = service.get_connection_status(USER_ID)
        assert status["connected"] is False
        assert status["channels"] == []

    def test_revoke_deactivates_token_and_disconnects(self, tmp_path, monkeypatch):
        service = _build_service(tmp_path, monkeypatch)
        token_id = _insert_active_token(service, USER_ID)
        assert service.get_connection_status(USER_ID)["connected"] is True

        assert service.revoke_token(USER_ID, token_id) is True

        status = service.get_connection_status(USER_ID)
        assert status["connected"] is False
        assert status["channels"][0]["token_id"] == token_id
        assert status["channels"][0]["is_active"] is False

    def test_revoke_does_not_deactivate_another_users_token(self, tmp_path, monkeypatch):
        service = _build_service(tmp_path, monkeypatch)
        other_user = "user_other"
        own_id = _insert_active_token(service, USER_ID, "Mine")
        other_id = _insert_active_token(service, other_user, "Theirs")

        assert service.revoke_token(USER_ID, other_id) is True

        assert service.get_connection_status(USER_ID)["connected"] is True
        assert service.get_connection_status(other_user)["connected"] is True
        assert own_id != other_id

    def test_connected_true_only_when_an_active_channel_exists(self, tmp_path, monkeypatch):
        service = _build_service(tmp_path, monkeypatch)
        token_id = _insert_active_token(service, USER_ID)
        service.revoke_token(USER_ID, token_id)
        status = service.get_connection_status(USER_ID)
        assert any(not channel["is_active"] for channel in status["channels"])
        assert status["connected"] is False

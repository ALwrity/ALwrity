from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from loguru import logger
from sqlalchemy import text
from sqlalchemy.orm import Session

from services.database import get_db

router = APIRouter(prefix="/v1/social-proxy", tags=["social-proxy"])


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_tables(db: Session) -> None:
    # Keep this router backward-compatible on tenant DBs without migrations.
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS oauth_nonce_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            state TEXT NOT NULL UNIQUE,
            nonce TEXT NOT NULL,
            user_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            channel_id INTEGER,
            consumed_at TEXT,
            expires_at TEXT,
            created_at TEXT NOT NULL
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS social_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            platform_account_id TEXT NOT NULL,
            token_bundle TEXT NOT NULL,
            token_version INTEGER NOT NULL DEFAULT 1,
            publication_linkage TEXT,
            is_connected INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(platform, platform_account_id)
        )
    """))


def _build_redirect(base_url: str, code: str, message: str, channel_id: Optional[int] = None) -> RedirectResponse:
    params = {"code": code, "message": message}
    if channel_id is not None:
        params["channel_id"] = str(channel_id)
    return RedirectResponse(url=f"{base_url}?{urlencode(params)}", status_code=303)


@router.get("/oauth/callback")
def oauth_callback(
    state: str = Query(...),
    platform: str = Query(...),
    account_id: str = Query(...),
    token_bundle: str = Query(..., description="Serialized token payload"),
    ui_redirect: str = Query("/dashboard/connections"),
    db: Session = Depends(get_db),
):
    """Consume OAuth callback, bind to user/platform, and upsert social channel connection."""
    _ensure_tables(db)

    record = db.execute(
        text("""
            SELECT id, nonce, user_id, platform, channel_id, consumed_at, expires_at
            FROM oauth_nonce_sessions WHERE state = :state
        """),
        {"state": state},
    ).mappings().first()

    if not record:
        return _build_redirect(ui_redirect, "invalid_state", "Missing OAuth session")

    if record["consumed_at"] is not None:
        return _build_redirect(ui_redirect, "state_reused", "OAuth state already consumed")

    if record["platform"] != platform:
        return _build_redirect(ui_redirect, "platform_mismatch", "Platform mismatch")

    if record["expires_at"] and record["expires_at"] < _utc_now_iso():
        return _build_redirect(ui_redirect, "state_expired", "OAuth session expired")

    user_id = record["user_id"]

    # Validate token payload is JSON.
    try:
        parsed_bundle = json.loads(token_bundle)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid token_bundle JSON") from exc

    now = _utc_now_iso()

    existing = db.execute(
        text("""
            SELECT id, publication_linkage, token_version
            FROM social_channels
            WHERE platform = :platform AND platform_account_id = :account_id
        """),
        {"platform": platform, "account_id": account_id},
    ).mappings().first()

    if existing:
        # Reconnect path: preserve publication linkage and bump token version.
        db.execute(
            text("""
                UPDATE social_channels
                SET user_id = :user_id,
                    token_bundle = :token_bundle,
                    token_version = :token_version,
                    is_connected = 1,
                    updated_at = :updated_at
                WHERE id = :id
            """),
            {
                "id": existing["id"],
                "user_id": user_id,
                "token_bundle": json.dumps(parsed_bundle),
                "token_version": int(existing["token_version"] or 0) + 1,
                "updated_at": now,
            },
        )
        channel_id = existing["id"]
        result_code = "reconnected"
        result_message = "Channel reconnected"
    else:
        db.execute(
            text("""
                INSERT INTO social_channels (
                    user_id, platform, platform_account_id, token_bundle,
                    token_version, publication_linkage, is_connected, created_at, updated_at
                ) VALUES (
                    :user_id, :platform, :account_id, :token_bundle,
                    1, :publication_linkage, 1, :created_at, :updated_at
                )
            """),
            {
                "user_id": user_id,
                "platform": platform,
                "account_id": account_id,
                "token_bundle": json.dumps(parsed_bundle),
                "publication_linkage": None,
                "created_at": now,
                "updated_at": now,
            },
        )
        channel_id = db.execute(text("SELECT last_insert_rowid()")).scalar_one()
        result_code = "connected"
        result_message = "Channel connected"

    # Bind callback session to concrete channel/user/platform and mark consumed.
    db.execute(
        text("""
            UPDATE oauth_nonce_sessions
            SET consumed_at = :consumed_at,
                channel_id = :channel_id,
                user_id = :user_id,
                platform = :platform
            WHERE id = :id
        """),
        {
            "id": record["id"],
            "consumed_at": now,
            "channel_id": channel_id,
            "user_id": user_id,
            "platform": platform,
        },
    )

    db.commit()
    logger.info(f"OAuth callback complete user={user_id} platform={platform} channel_id={channel_id}")
    return _build_redirect(ui_redirect, result_code, result_message, channel_id)

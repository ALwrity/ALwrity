"""Shared TestClient for YouTube studio routers (analytics / comments / ops)."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from middleware.auth_middleware import get_current_user
from api.youtube.router import router as youtube_router


def fake_youtube_user(uid: str = "user_studio_hardening") -> dict:
    return {"id": uid, "email": "test@example.com"}


def youtube_studio_client(overrides: dict | None = None) -> TestClient:
    app = FastAPI()
    app.include_router(youtube_router, prefix="/api")
    app.dependency_overrides[get_current_user] = lambda: fake_youtube_user()
    for dep, fn in (overrides or {}).items():
        app.dependency_overrides[dep] = fn
    return TestClient(app, raise_server_exceptions=False)

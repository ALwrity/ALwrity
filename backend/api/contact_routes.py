"""Public contact form API (no authentication required)."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from services.contact_form_service import submit_contact_form

router = APIRouter(prefix="/api", tags=["contact"])

_RATE_WINDOW_SECONDS = 3600
_RATE_MAX_PER_IP = 10
_rate_buckets: Dict[str, List[float]] = defaultdict(list)


class ContactFormRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=320)
    message: str = Field(..., min_length=1, max_length=1500)


class ContactFormResponse(BaseModel):
    success: bool
    message: str


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _check_rate_limit(client_ip: str) -> None:
    now = time.time()
    bucket = _rate_buckets[client_ip]
    _rate_buckets[client_ip] = [t for t in bucket if now - t < _RATE_WINDOW_SECONDS]
    if len(_rate_buckets[client_ip]) >= _RATE_MAX_PER_IP:
        raise HTTPException(
            status_code=429,
            detail="Too many contact requests. Please try again later or email info@alwrity.com.",
        )


@router.post("/contact", response_model=ContactFormResponse)
async def post_contact_form(payload: ContactFormRequest, request: Request) -> ContactFormResponse:
    """Accept a public contact form submission and forward to the team inbox."""
    _check_rate_limit(_client_ip(request))

    try:
        result = await submit_contact_form(payload.name, payload.email, payload.message)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not result.success:
        raise HTTPException(status_code=503, detail=result.message)

    _rate_buckets[_client_ip(request)].append(time.time())
    return ContactFormResponse(success=True, message=result.message)

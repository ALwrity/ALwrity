"""LinkedIn Growth Engine integration exceptions."""

from __future__ import annotations

from typing import List, Optional

from .types import LinkedInNotConnectedError


class LinkedInDuplicateContentError(Exception):
    """Raised when publish content matches a recent LinkedIn post."""

    def __init__(
        self,
        message: str = "This content matches a recent LinkedIn post. Edit before publishing.",
        *,
        matched_asset_id: Optional[int] = None,
        content_hash: Optional[str] = None,
    ):
        super().__init__(message)
        self.matched_asset_id = matched_asset_id
        self.content_hash = content_hash


class LinkedInMediaValidationError(Exception):
    """Raised when media fails LinkedIn pre-publish validation."""

    def __init__(self, errors: List[str], *, file_path: Optional[str] = None):
        self.errors = errors
        self.file_path = file_path
        summary = "; ".join(errors) if errors else "Media validation failed"
        super().__init__(summary)


class LinkedInEnvConnectError(Exception):
    """Raised when platform env-based LinkedIn connect fails."""

    def __init__(self, message: str, *, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


__all__ = [
    "LinkedInNotConnectedError",
    "LinkedInDuplicateContentError",
    "LinkedInMediaValidationError",
    "LinkedInEnvConnectError",
]

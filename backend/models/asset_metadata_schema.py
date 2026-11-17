"""Shared schema/builders for content asset metadata."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

SCHEMA_VERSION = "1.0"
PODCAST_FEATURE = "podcast_maker"

REQUIRED_KEYS = (
    "schema_version",
    "feature",
    "asset_role",
    "project_id",
    "status",
    "origin",
)


def build_asset_metadata(
    *,
    feature: str,
    asset_role: str,
    project_id: Optional[str],
    status: str,
    origin: str,
    extras: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build normalized, versioned asset metadata payload."""
    metadata: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "feature": feature,
        "asset_role": asset_role,
        "project_id": project_id or "unknown",
        "status": status,
        "origin": origin,
    }
    if extras:
        metadata.update({k: v for k, v in extras.items() if v is not None})
    return metadata


def build_podcast_asset_metadata(
    *,
    asset_role: str,
    project_id: Optional[str],
    status: str = "completed",
    origin: str,
    extras: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Podcast-specific metadata builder."""
    return build_asset_metadata(
        feature=PODCAST_FEATURE,
        asset_role=asset_role,
        project_id=project_id,
        status=status,
        origin=origin,
        extras=extras,
    )


def validate_asset_metadata(metadata: Optional[Dict[str, Any]]) -> Tuple[bool, str]:
    """Validate minimum schema requirements."""
    if metadata is None:
        return False, "asset_metadata is required"
    if not isinstance(metadata, dict):
        return False, "asset_metadata must be a dictionary"

    missing = [key for key in REQUIRED_KEYS if not metadata.get(key)]
    if missing:
        return False, f"asset_metadata missing required keys: {', '.join(missing)}"

    if str(metadata.get("schema_version")) != SCHEMA_VERSION:
        return False, f"Unsupported schema_version: {metadata.get('schema_version')}"

    return True, "ok"

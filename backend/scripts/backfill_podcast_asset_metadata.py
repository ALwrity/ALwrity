"""Backfill recent podcast assets with normalized metadata schema."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict

from sqlalchemy import desc

from services.database import SessionLocal
from models.content_asset_models import ContentAsset, AssetSource
from models.asset_metadata_schema import build_podcast_asset_metadata, validate_asset_metadata


def infer_role(meta: Dict[str, Any], filename: str) -> str:
    return (
        meta.get("asset_role")
        or meta.get("type")
        or ("podcast_audio" if filename.lower().endswith((".mp3", ".wav", ".m4a")) else "podcast_asset")
    )


def main(days: int = 90) -> None:
    db = SessionLocal()
    updated = 0
    scanned = 0
    since = datetime.utcnow() - timedelta(days=days)
    try:
        assets = (
            db.query(ContentAsset)
            .filter(ContentAsset.source_module == AssetSource.PODCAST_MAKER)
            .filter(ContentAsset.created_at >= since)
            .order_by(desc(ContentAsset.created_at))
            .all()
        )

        for asset in assets:
            scanned += 1
            meta = asset.asset_metadata or {}
            is_valid, _ = validate_asset_metadata(meta)
            if is_valid:
                continue

            role = infer_role(meta, asset.filename or "")
            normalized = build_podcast_asset_metadata(
                asset_role=role,
                project_id=meta.get("project_id"),
                status=meta.get("status", "completed"),
                origin=meta.get("origin", "migration.backfill_podcast_asset_metadata"),
                extras=meta,
            )
            asset.asset_metadata = normalized
            db.add(asset)
            updated += 1

        db.commit()
        print(f"Scanned={scanned} Updated={updated} Since={since.isoformat()}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

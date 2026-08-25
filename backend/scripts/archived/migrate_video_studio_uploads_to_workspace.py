#!/usr/bin/env python3
"""Migrate legacy Video Studio upload files into tenant workspace media folders."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
from pathlib import Path

from services.database import WORKSPACE_DIR
from utils.storage_paths import resolve_user_media_path, get_legacy_video_studio_upload_dirs

TASK_FILE_PATTERN = re.compile(r"^(img|aud|video)_([0-9a-fA-F-]{36})")


def _read_task_mappings() -> dict[str, str]:
    """Build task_id -> user_id mapping from available per-user databases."""
    mapping: dict[str, str] = {}
    workspace_root = Path(WORKSPACE_DIR)

    if not workspace_root.exists():
        return mapping

    for workspace_dir in workspace_root.glob("workspace_*"):
        safe_workspace_id = workspace_dir.name.removeprefix("workspace_")
        db_candidates = [
            workspace_dir / "db" / f"alwrity_{safe_workspace_id}.db",
            workspace_dir / "db" / "alwrity.db",
        ]

        db_path = next((p for p in db_candidates if p.exists()), None)
        if not db_path:
            continue

        conn = None
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='video_generation_tasks'"
            )
            if not cursor.fetchone():
                continue

            cursor.execute("SELECT task_id, user_id, result FROM video_generation_tasks")
            for task_id, db_user_id, raw_result in cursor.fetchall():
                if not task_id:
                    continue

                resolved_user = db_user_id or safe_workspace_id
                mapping[str(task_id)] = str(resolved_user)

                if raw_result:
                    try:
                        parsed = json.loads(raw_result) if isinstance(raw_result, str) else raw_result
                        if isinstance(parsed, dict):
                            video_url = parsed.get("video_url", "")
                            if video_url:
                                filename = Path(video_url).name
                                match = TASK_FILE_PATTERN.match(filename)
                                if match:
                                    mapping.setdefault(match.group(2), str(resolved_user))
                    except Exception:
                        pass
        finally:
            if conn:
                conn.close()

    return mapping


def migrate_legacy_uploads(apply: bool = False) -> tuple[int, int]:
    task_to_user = _read_task_mappings()
    moved = 0
    skipped = 0

    for legacy_dir in get_legacy_video_studio_upload_dirs():
        if not legacy_dir.exists():
            continue

        for file_path in legacy_dir.iterdir():
            if not file_path.is_file():
                continue

            match = TASK_FILE_PATTERN.match(file_path.name)
            if not match:
                skipped += 1
                continue

            prefix, task_id = match.groups()
            user_id = task_to_user.get(task_id)
            if not user_id:
                skipped += 1
                continue

            media_type = "videos" if prefix == "video" else "uploads"
            target_dir = resolve_user_media_path(user_id, "video_studio", media_type, create=True)
            target_path = target_dir / file_path.name

            if target_path.exists():
                skipped += 1
                continue

            print(f"{'[DRY RUN] Would move' if not apply else 'Moving'} {file_path} -> {target_path}")
            if apply:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(file_path), str(target_path))
            moved += 1

    return moved, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply changes (default is dry-run)")
    args = parser.parse_args()

    moved, skipped = migrate_legacy_uploads(apply=args.apply)
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] Completed. moved={moved}, skipped={skipped}")


if __name__ == "__main__":
    main()

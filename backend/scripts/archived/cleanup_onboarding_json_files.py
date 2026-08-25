#!/usr/bin/env python3
"""
Cleanup Onboarding JSON Files Script

This script removes any stale .onboarding_progress*.json files from the backend root.
These files were used in the old file-based onboarding system and are no longer needed
since we've migrated to database-only storage.

Usage:
    python backend/scripts/cleanup_onboarding_json_files.py [--dry-run] [--force]

Options:
    --dry-run    Show what would be deleted without actually deleting
    --force      Skip confirmation prompt (use with caution)
"""

import os
import sys
import glob
import argparse
from pathlib import Path
from loguru import logger

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def find_onboarding_json_files(backend_root: Path) -> list:
    """Find all .onboarding_progress*.json files in backend root."""
    pattern = str(backend_root / ".onboarding_progress*.json")
    files = glob.glob(pattern)
    return [Path(f) for f in files]

def cleanup_json_files(backend_root: Path, dry_run: bool = False, force: bool = False) -> int:
    """
    Clean up onboarding JSON files.
    
    Args:
        backend_root: Path to backend directory
        dry_run: If True, only show what would be deleted
        force: If True, skip confirmation prompt
        
    Returns:
        Number of files processed
    """
    files = find_onboarding_json_files(backend_root)
    
    if not files:
        logger.info("✅ No onboarding JSON files found to clean up")
        return 0
    
    logger.info(f"Found {len(files)} onboarding JSON file(s):")
    for file in files:
        logger.info(f"  - {file.name}")
    
    if dry_run:
        logger.info("🔍 DRY RUN: Would delete the above files")
        return len(files)
    
    if not force:
        response = input(f"\nDelete {len(files)} onboarding JSON file(s)? (y/N): ").strip().lower()
        if response not in ['y', 'yes']:
            logger.info("❌ Cleanup cancelled by user")
            return 0
    
    deleted_count = 0
    for file in files:
        try:
            file.unlink()
            logger.info(f"🗑️  Deleted: {file.name}")
            deleted_count += 1
        except Exception as e:
            logger.error(f"❌ Failed to delete {file.name}: {e}")
    
    logger.info(f"✅ Cleanup complete: {deleted_count}/{len(files)} files deleted")
    return deleted_count

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Clean up onboarding JSON files")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without actually deleting")
    parser.add_argument("--force", action="store_true", help="Skip confirmation prompt")
    
    args = parser.parse_args()
    
    # Get backend root directory
    script_dir = Path(__file__).parent
    backend_root = script_dir.parent
    
    logger.info(f"🧹 Onboarding JSON Cleanup Script")
    logger.info(f"Backend root: {backend_root}")
    
    if args.dry_run:
        logger.info("🔍 Running in DRY RUN mode")
    
    try:
        deleted_count = cleanup_json_files(backend_root, args.dry_run, args.force)
        
        if deleted_count > 0:
            logger.info("✅ Cleanup completed successfully")
        else:
            logger.info("ℹ️  No files needed cleanup")
            
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

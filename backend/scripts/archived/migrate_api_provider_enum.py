#!/usr/bin/env python3
"""
Migration script to normalize APIProvider enum values to lowercase.

This fixes the issue where the database has uppercase values like "VIDEO", "MISTRAL"
but the enum expects lowercase values like "video", "mistral".

Run this script once to migrate existing data.
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Load env first
from dotenv import load_dotenv
load_dotenv(backend_dir / '.env')

from loguru import logger
import sqlite3
from glob import glob

# Provider mapping: uppercase -> lowercase
PROVIDER_MAP = {
    'GEMINI': 'gemini',
    'OPENAI': 'openai',
    'ANTHROPIC': 'anthropic',
    'MISTRAL': 'mistral',
    'WAVESPEED': 'wavespeed',
    'TAVILY': 'tavily',
    'SERPER': 'serper',
    'METAPHOR': 'metaphor',
    'FIRECRAWL': 'firecrawl',
    'STABILITY': 'stability',
    'EXA': 'exa',
    'VIDEO': 'video',
    'IMAGE_EDIT': 'image_edit',
    'AUDIO': 'audio',
}

def normalize_provider_value(value: str) -> str:
    """Convert provider value to lowercase if it's uppercase."""
    if not value:
        return value
    upper_value = value.upper()
    if upper_value in PROVIDER_MAP:
        return PROVIDER_MAP[upper_value]
    # If already lowercase, return as-is
    return value

def migrate_database(db_path: str) -> tuple[int, int]:
    """Migrate a single database file. Returns (total_rows, updated_rows)."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if api_usage_logs table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='api_usage_logs'")
        if not cursor.fetchone():
            conn.close()
            return 0, 0
        
        # Get all unique provider values
        cursor.execute("SELECT DISTINCT provider FROM api_usage_logs")
        unique_providers = [row[0] for row in cursor.fetchall()]
        
        total_rows = 0
        updated_rows = 0
        
        # Count total rows
        cursor.execute("SELECT COUNT(*) FROM api_usage_logs")
        total_rows = cursor.fetchone()[0]
        
        # Update each provider value that needs normalization
        for provider in unique_providers:
            normalized = normalize_provider_value(provider)
            if provider != normalized:
                cursor.execute(
                    "UPDATE api_usage_logs SET provider = ? WHERE provider = ?",
                    (normalized, provider)
                )
                count = cursor.rowcount
                updated_rows += count
                logger.info(f"  {db_path}: Updated {count} rows with provider '{provider}' -> '{normalized}'")
        
        conn.commit()
        conn.close()
        
        return total_rows, updated_rows
        
    except Exception as e:
        logger.error(f"Error migrating {db_path}: {e}")
        return 0, 0

def main():
    """Main migration function."""
    logger.info("=" * 60)
    logger.info("APIProvider Enum Normalization Migration")
    logger.info("=" * 60)
    
    # Workspace directory where user databases are stored
    workspace_dir = backend_dir / "workspace"
    
    # Find all database files in workspaces
    all_dbs = set()
    
    if workspace_dir.exists():
        for workspace in workspace_dir.iterdir():
            if workspace.is_dir():
                # Look for database files in workspace subdirectories (database/, or root)
                for db_pattern in ["**/*.db", "**/alwrity*.db"]:
                    all_dbs.update(workspace.glob(db_pattern))
    
    logger.info(f"Found {len(all_dbs)} database files to check")
    
    total_dbs = 0
    total_rows = 0
    total_updated = 0
    
    for db_path in sorted(all_dbs):
        total_dbs += 1
        rows, updated = migrate_database(str(db_path))
        total_rows += rows
        total_updated += updated
    
    logger.info("=" * 60)
    logger.info(f"Migration complete!")
    logger.info(f"  Databases checked: {total_dbs}")
    logger.info(f"  Total rows: {total_rows}")
    logger.info(f"  Rows updated: {total_updated}")
    logger.info("=" * 60)
    
    if total_updated > 0:
        logger.warning("Please restart the backend server to ensure changes take effect.")
    else:
        logger.info("No updates needed - all provider values are already normalized.")

if __name__ == "__main__":
    main()

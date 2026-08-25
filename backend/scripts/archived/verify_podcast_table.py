#!/usr/bin/env python3
"""
Verify that the podcast_projects table exists and has the correct structure.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import inspect
from services.database import engine

def verify_table():
    """Verify the podcast_projects table exists."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if 'podcast_projects' in tables:
        print("✅ Table 'podcast_projects' exists")
        
        columns = inspector.get_columns('podcast_projects')
        print(f"\n📊 Columns ({len(columns)}):")
        for col in columns:
            print(f"  • {col['name']}: {col['type']}")
        
        indexes = inspector.get_indexes('podcast_projects')
        print(f"\n📈 Indexes ({len(indexes)}):")
        for idx in indexes:
            print(f"  • {idx['name']}: {idx['column_names']}")
        
        return True
    else:
        print("❌ Table 'podcast_projects' not found")
        print(f"Available tables: {', '.join(tables)}")
        return False

if __name__ == "__main__":
    success = verify_table()
    sys.exit(0 if success else 1)


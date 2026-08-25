"""
Database Setup Module
Handles database initialization and table creation.
"""


class DatabaseSetup:
    """Manages database setup for ALwrity backend."""
    
    def __init__(self, production_mode: bool = False):
        self.production_mode = production_mode
    
    def setup_essential_tables(self) -> bool:
        """Set up essential database tables."""
        import os
        verbose = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
        
        if verbose:
            print("📊 Setting up essential database tables...")
        
        try:
            from services.database import init_database
            
            # Initialize database connection and run migrations
            init_database()
            if verbose:
                print("   ✅ Database connection initialized")
            return True
            
        except Exception as e:
            if verbose:
                print(f"⚠️  Warning: Database setup failed: {e}")
                if self.production_mode:
                    print("   Continuing in production mode...")
                else:
                    print("   This may affect functionality")
            return True  # Don't fail startup for database issues
    
    def verify_tables(self) -> bool:
        """Verify that essential tables exist (no-op — tables managed by Alembic migrations)."""
        import os
        verbose = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
        
        if verbose:
            print("🔍 Table verification skipped (Alembic manages schema)")
        return True
    
    def setup_advanced_tables(self) -> bool:
        """Set up advanced tables — no-op, all tables created by Alembic migrations."""
        import os
        verbose = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
        if verbose:
            print("🔧 Advanced table setup skipped (Alembic manages schema)")
        return True

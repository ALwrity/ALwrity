"""
Database migration script to create API monitoring tables.
Run this script to add the monitoring tables to your database.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from loguru import logger
import os
import argparse
from services.database import get_user_db_path

def create_monitoring_tables(user_id=None):
    """Create the API monitoring tables."""
    try:
        # Get database URL
        if user_id:
            db_path = get_user_db_path(user_id)
            database_url = f'sqlite:///{db_path}'
            logger.info(f"Targeting user database: {db_path}")
        else:
            logger.error("❌ Error: user_id is required to create monitoring tables.")
            return False
        
        # Create engine
        engine = create_engine(database_url)
        
        # Create session
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        # SQL to create the monitoring tables
        create_tables_sql = [
            """
            CREATE TABLE IF NOT EXISTS api_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                path VARCHAR(500) NOT NULL,
                method VARCHAR(10) NOT NULL,
                status_code INTEGER NOT NULL,
                duration FLOAT NOT NULL,
                user_id VARCHAR(50),
                cache_hit BOOLEAN,
                request_size INTEGER,
                response_size INTEGER,
                user_agent VARCHAR(500),
                ip_address VARCHAR(45)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS api_endpoint_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint VARCHAR(500) NOT NULL UNIQUE,
                total_requests INTEGER DEFAULT 0,
                total_errors INTEGER DEFAULT 0,
                total_duration FLOAT DEFAULT 0.0,
                avg_duration FLOAT DEFAULT 0.0,
                min_duration FLOAT,
                max_duration FLOAT,
                last_called DATETIME,
                cache_hits INTEGER DEFAULT 0,
                cache_misses INTEGER DEFAULT 0,
                cache_hit_rate FLOAT DEFAULT 0.0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS system_health (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                status VARCHAR(20) NOT NULL,
                total_requests INTEGER DEFAULT 0,
                total_errors INTEGER DEFAULT 0,
                error_rate FLOAT DEFAULT 0.0,
                avg_response_time FLOAT DEFAULT 0.0,
                cache_hit_rate FLOAT DEFAULT 0.0,
                active_endpoints INTEGER DEFAULT 0,
                metrics JSON
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS cache_performance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                cache_type VARCHAR(50) NOT NULL,
                hits INTEGER DEFAULT 0,
                misses INTEGER DEFAULT 0,
                hit_rate FLOAT DEFAULT 0.0,
                avg_response_time FLOAT DEFAULT 0.0,
                total_requests INTEGER DEFAULT 0
            );
            """
        ]
        
        # Create indexes
        create_indexes_sql = [
            "CREATE INDEX IF NOT EXISTS idx_api_requests_timestamp ON api_requests(timestamp);",
            "CREATE INDEX IF NOT EXISTS idx_api_requests_path_method ON api_requests(path, method);",
            "CREATE INDEX IF NOT EXISTS idx_api_requests_status_code ON api_requests(status_code);",
            "CREATE INDEX IF NOT EXISTS idx_api_requests_user_id ON api_requests(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_api_endpoint_stats_endpoint ON api_endpoint_stats(endpoint);",
            "CREATE INDEX IF NOT EXISTS idx_api_endpoint_stats_total_requests ON api_endpoint_stats(total_requests);",
            "CREATE INDEX IF NOT EXISTS idx_api_endpoint_stats_avg_duration ON api_endpoint_stats(avg_duration);",
            "CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON system_health(timestamp);",
            "CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);",
            "CREATE INDEX IF NOT EXISTS idx_cache_performance_timestamp ON cache_performance(timestamp);",
            "CREATE INDEX IF NOT EXISTS idx_cache_performance_cache_type ON cache_performance(cache_type);"
        ]
        
        # Execute table creation
        logger.info("Creating API monitoring tables...")
        for table_sql in create_tables_sql:
            db.execute(text(table_sql))
        
        # Execute index creation
        logger.info("Creating indexes...")
        for index_sql in create_indexes_sql:
            db.execute(text(index_sql))
        
        # Commit changes
        db.commit()
        
        # Verify table creation
        tables_to_check = ['api_requests', 'api_endpoint_stats', 'system_health', 'cache_performance']
        for table_name in tables_to_check:
            result = db.execute(text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}';"))
            table_exists = result.fetchone()
            
            if table_exists:
                logger.info(f"✅ {table_name} table created successfully!")
            else:
                logger.error(f"❌ Failed to create {table_name} table")
                return False
        
        logger.info("🎉 All API monitoring tables created successfully!")
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating monitoring tables: {str(e)}")
        if 'db' in locals():
            db.close()
        return False

def drop_monitoring_tables(user_id=None):
    """Drop the API monitoring tables (for testing)."""
    try:
        # Get database URL
        if user_id:
            db_path = get_user_db_path(user_id)
            database_url = f'sqlite:///{db_path}'
            logger.info(f"Targeting user database: {db_path}")
        else:
            logger.error("❌ Error: user_id is required to drop monitoring tables.")
            return False
        
        # Create engine
        engine = create_engine(database_url)
        
        # Create session
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        # Drop tables
        tables_to_drop = ['api_requests', 'api_endpoint_stats', 'system_health', 'cache_performance']
        logger.info("Dropping API monitoring tables...")
        
        for table_name in tables_to_drop:
            db.execute(text(f"DROP TABLE IF EXISTS {table_name};"))
        
        db.commit()
        
        logger.info("✅ API monitoring tables dropped successfully!")
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Error dropping monitoring tables: {str(e)}")
        if 'db' in locals():
            db.close()
        return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Manage API monitoring tables")
    parser.add_argument("--action", choices=["create", "drop"], default="create", 
                       help="Action to perform (create or drop tables)")
    parser.add_argument("--user_id", help="Target specific user ID")
    
    args = parser.parse_args()
    
    if args.action == "create":
        success = create_monitoring_tables(args.user_id)
        if success:
            logger.info("🎉 API monitoring tables setup completed successfully!")
        else:
            logger.error("💥 API monitoring tables setup failed!")
            sys.exit(1)
    elif args.action == "drop":
        success = drop_monitoring_tables(args.user_id)
        if success:
            logger.info("🗑️ API monitoring tables dropped successfully!")
        else:
            logger.error("💥 Failed to drop API monitoring tables!")
            sys.exit(1)

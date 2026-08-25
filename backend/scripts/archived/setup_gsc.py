#!/usr/bin/env python3
"""
Google Search Console Setup Script for ALwrity

This script helps set up the GSC integration by:
1. Checking if credentials file exists
2. Validating database tables
3. Testing OAuth flow
"""

import os
import sys
import sqlite3
import json
import argparse
from pathlib import Path

# Add backend directory to path to import services
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)

from services.database import get_user_db_path

def check_credentials_file():
    """Check if GSC credentials file exists and is valid."""
    credentials_path = Path("gsc_credentials.json")
    
    if not credentials_path.exists():
        print("❌ GSC credentials file not found!")
        print("📝 Please create gsc_credentials.json with your Google OAuth credentials.")
        print("📋 Use gsc_credentials_template.json as a template.")
        return False
    
    try:
        with open(credentials_path, 'r') as f:
            credentials = json.load(f)
        
        required_fields = ['web', 'client_id', 'client_secret']
        web_config = credentials.get('web', {})
        
        if not all(field in web_config for field in ['client_id', 'client_secret']):
            print("❌ GSC credentials file is missing required fields!")
            print("📝 Please ensure client_id and client_secret are present.")
            return False
        
        if 'YOUR_GOOGLE_CLIENT_ID' in web_config.get('client_id', ''):
            print("❌ GSC credentials file contains placeholder values!")
            print("📝 Please replace placeholder values with actual Google OAuth credentials.")
            return False
        
        print("✅ GSC credentials file is valid!")
        return True
        
    except json.JSONDecodeError:
        print("❌ GSC credentials file is not valid JSON!")
        return False
    except Exception as e:
        print(f"❌ Error reading credentials file: {e}")
        return False

def check_database_tables(user_id=None):
    """Check if GSC database tables exist."""
    
    if user_id:
        db_path = get_user_db_path(user_id)
        print(f"Targeting user database: {db_path}")
    else:
        print("❌ Error: user_id is required to check GSC tables.")
        return False
    
    if not os.path.exists(db_path):
        print(f"❌ Database file not found at {db_path}!")
        print("📝 Please ensure the database is initialized.")
        return False
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Check for GSC tables
            tables = [
                'gsc_credentials',
                'gsc_data_cache', 
                'gsc_oauth_states'
            ]
            
            for table in tables:
                cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
                if not cursor.fetchone():
                    print(f"❌ Table '{table}' not found!")
                    return False
            
            print("✅ All GSC database tables exist!")
            return True
            
    except Exception as e:
        print(f"❌ Error checking database: {e}")
        return False

def check_environment_variables():
    """Check if required environment variables are set."""
    required_vars = ['GSC_REDIRECT_URI']
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("📝 Please set these in your .env file:")
        for var in missing_vars:
            if var == 'GSC_REDIRECT_URI':
                print(f"   {var}=http://localhost:8000/gsc/callback")
        return False
    
    print("✅ All required environment variables are set!")
    return True

def create_database_tables(user_id=None):
    """Create GSC database tables if they don't exist."""
    if user_id:
        db_path = get_user_db_path(user_id)
    else:
        db_path = get_user_db_path('alwrity')
    
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # GSC credentials table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS gsc_credentials (
                    user_id TEXT PRIMARY KEY,
                    credentials_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # GSC data cache table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS gsc_data_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    site_url TEXT NOT NULL,
                    data_type TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES gsc_credentials (user_id)
                )
            ''')
            
            # GSC OAuth states table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS gsc_oauth_states (
                    state TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            print("✅ GSC database tables created successfully!")
            return True
            
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")
        return False

def main():
    """Main setup function."""
    parser = argparse.ArgumentParser(description="GSC Setup Script")
    parser.add_argument("--user_id", help="Target specific user ID")
    args = parser.parse_args()

    print("🔧 Google Search Console Setup Check")
    print("=" * 50)
    
    # Change to backend directory
    backend_dir = Path(__file__).parent.parent
    os.chdir(backend_dir)
    
    all_good = True
    
    # Check credentials file
    print("\n1. Checking GSC credentials file...")
    if not check_credentials_file():
        all_good = False
    
    # Check environment variables
    print("\n2. Checking environment variables...")
    if not check_environment_variables():
        all_good = False
    
    # Check/create database tables
    print("\n3. Checking database tables...")
    if not check_database_tables(args.user_id):
        print("📝 Creating missing database tables...")
        if not create_database_tables(args.user_id):
            all_good = False
    
    # Summary
    print("\n" + "=" * 50)
    if all_good:
        print("✅ GSC setup is complete!")
        print("🚀 You can now test the GSC integration in onboarding step 5.")
    else:
        print("❌ GSC setup is incomplete!")
        print("📝 Please fix the issues above before testing.")
        print("📖 See GSC_SETUP_GUIDE.md for detailed instructions.")
    
    return 0 if all_good else 1

if __name__ == "__main__":
    sys.exit(main())

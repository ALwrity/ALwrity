"""
Database Verification Script for Onboarding Data
Verifies that all onboarding steps data is properly saved to the database.

Usage:
    python backend/scripts/verify_onboarding_data.py [user_id]
    
Example:
    python backend/scripts/verify_onboarding_data.py user_33Gz1FPI86VDXhRY8QN4ragRFGN
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from loguru import logger
from sqlalchemy import inspect, text
from typing import Optional
import json

def get_user_id_from_args() -> Optional[str]:
    """Get user_id from command line arguments."""
    if len(sys.argv) > 1:
        return sys.argv[1]
    return None

def verify_table_exists(table_name: str, inspector) -> bool:
    """Check if a table exists in the database."""
    tables = inspector.get_table_names()
    exists = table_name in tables
    
    if exists:
        logger.info(f"✅ Table '{table_name}' exists")
        # Show column count
        columns = inspector.get_columns(table_name)
        logger.info(f"   Columns: {len(columns)}")
    else:
        logger.error(f"❌ Table '{table_name}' does NOT exist")
    
    return exists

def verify_onboarding_session(user_id: str, db):
    """Verify onboarding session data."""
    try:
        from models.onboarding import OnboardingSession
        
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).first()
        
        if session:
            logger.info(f"✅ Onboarding Session found for user: {user_id}")
            logger.info(f"   Session ID: {session.id}")
            logger.info(f"   Current Step: {session.current_step}")
            logger.info(f"   Progress: {session.progress}%")
            logger.info(f"   Started At: {session.started_at}")
            logger.info(f"   Updated At: {session.updated_at}")
            return session.id
        else:
            logger.error(f"❌ No onboarding session found for user: {user_id}")
            return None
            
    except Exception as e:
        logger.error(f"Error verifying onboarding session: {e}")
        return None

def verify_website_analysis(session_id: int, user_id: str, db):
    """Verify website analysis data (Step 2)."""
    try:
        from models.onboarding import WebsiteAnalysis
        
        analysis = db.query(WebsiteAnalysis).filter(
            WebsiteAnalysis.session_id == session_id
        ).first()
        
        if analysis:
            logger.info(f"✅ Step 2 (Website Analysis): Data found")
            logger.info(f"   Website URL: {analysis.website_url}")
            logger.info(f"   Analysis Date: {analysis.analysis_date}")
            logger.info(f"   Status: {analysis.status}")
            
            if analysis.writing_style:
                logger.info(f"   Writing Style: {len(analysis.writing_style)} attributes")
            if analysis.content_characteristics:
                logger.info(f"   Content Characteristics: {len(analysis.content_characteristics)} attributes")
            if analysis.target_audience:
                logger.info(f"   Target Audience: {len(analysis.target_audience)} attributes")
        else:
            logger.warning(f"⚠️  Step 2 (Website Analysis): No data found")
            
    except Exception as e:
        logger.error(f"Error verifying website analysis: {e}")

def verify_research_preferences(session_id: int, user_id: str, db):
    """Verify research preferences data (Step 3)."""
    try:
        from models.onboarding import ResearchPreferences
        
        prefs = db.query(ResearchPreferences).filter(
            ResearchPreferences.session_id == session_id
        ).first()
        
        if prefs:
            logger.info(f"✅ Step 3 (Research Preferences): Data found")
            logger.info(f"   Research Depth: {prefs.research_depth}")
            logger.info(f"   Content Types: {prefs.content_types}")
            logger.info(f"   Auto Research: {prefs.auto_research}")
            logger.info(f"   Factual Content: {prefs.factual_content}")
        else:
            logger.warning(f"⚠️  Step 3 (Research Preferences): No data found")
            
    except Exception as e:
        logger.error(f"Error verifying research preferences: {e}")

def verify_persona_data(session_id: int, user_id: str, db):
    """Verify persona data (Step 4) - THE NEW FIX!"""
    try:
        from models.onboarding import PersonaData
        
        persona = db.query(PersonaData).filter(
            PersonaData.session_id == session_id
        ).first()
        
        if persona:
            logger.info(f"✅ Step 4 (Persona Generation): Data found ⭐")
            
            if persona.core_persona:
                logger.info(f"   Core Persona: Present")
                if isinstance(persona.core_persona, dict):
                    logger.info(f"     Attributes: {len(persona.core_persona)} fields")
            
            if persona.platform_personas:
                logger.info(f"   Platform Personas: Present")
                if isinstance(persona.platform_personas, dict):
                    platforms = list(persona.platform_personas.keys())
                    logger.info(f"     Platforms: {', '.join(platforms)}")
            
            if persona.quality_metrics:
                logger.info(f"   Quality Metrics: Present")
                if isinstance(persona.quality_metrics, dict):
                    logger.info(f"     Metrics: {len(persona.quality_metrics)} fields")
            
            if persona.selected_platforms:
                logger.info(f"   Selected Platforms: {persona.selected_platforms}")
            
            logger.info(f"   Created At: {persona.created_at}")
            logger.info(f"   Updated At: {persona.updated_at}")
        else:
            logger.error(f"❌ Step 4 (Persona Generation): No data found - THIS IS THE BUG WE FIXED!")
            
    except Exception as e:
        logger.error(f"Error verifying persona data: {e}")
        import traceback
        logger.error(traceback.format_exc())

def show_raw_sql_query_example(user_id: str):
    """Show example SQL queries for manual verification."""
    logger.info("")
    logger.info("=" * 60)
    logger.info("📋 Raw SQL Queries for Manual Verification:")
    logger.info("=" * 60)
    
    queries = [
        ("Onboarding Session", 
         f"SELECT * FROM onboarding_sessions WHERE user_id = '{user_id}';"),
        
        ("API Keys", 
         f"""SELECT ak.* FROM api_keys ak 
         JOIN onboarding_sessions os ON ak.session_id = os.id 
         WHERE os.user_id = '{user_id}';"""),
        
        ("Website Analysis", 
         f"""SELECT wa.website_url, wa.analysis_date, wa.status 
         FROM website_analyses wa 
         JOIN onboarding_sessions os ON wa.session_id = os.id 
         WHERE os.user_id = '{user_id}';"""),
        
        ("Research Preferences", 
         f"""SELECT rp.research_depth, rp.content_types, rp.auto_research 
         FROM research_preferences rp 
         JOIN onboarding_sessions os ON rp.session_id = os.id 
         WHERE os.user_id = '{user_id}';"""),
        
        ("Persona Data (NEW!)", 
         f"""SELECT pd.* FROM persona_data pd 
         JOIN onboarding_sessions os ON pd.session_id = os.id 
         WHERE os.user_id = '{user_id}';"""),
    ]
    
    for title, query in queries:
        logger.info(f"\n{title}:")
        logger.info(f"  {query}")

def count_all_records(db):
    """Count records in all onboarding tables."""
    logger.info("")
    logger.info("=" * 60)
    logger.info("📊 Overall Database Statistics:")
    logger.info("=" * 60)
    
    try:
        from models.onboarding import (
            OnboardingSession, WebsiteAnalysis, 
            ResearchPreferences, PersonaData
        )
        
        counts = {
            "Onboarding Sessions": db.query(OnboardingSession).count(),
            "Website Analyses": db.query(WebsiteAnalysis).count(),
            "Research Preferences": db.query(ResearchPreferences).count(),
            "Persona Data": db.query(PersonaData).count(),
        }
        
        for table, count in counts.items():
            logger.info(f"  {table}: {count} record(s)")
            
    except Exception as e:
        logger.error(f"Error counting records: {e}")

def main():
    """Main verification function."""
    logger.info("=" * 60)
    logger.info("🔍 Onboarding Database Verification")
    logger.info("=" * 60)
    
    # Get user_id
    user_id = get_user_id_from_args()
    
    if not user_id:
        logger.warning("⚠️  No user_id provided. Will show overall statistics only.")
        logger.info("Usage: python backend/scripts/verify_onboarding_data.py <user_id>")
    
    try:
        from services.database import SessionLocal, engine
        from sqlalchemy import inspect
        
        # Check tables exist
        logger.info("")
        logger.info("=" * 60)
        logger.info("1️⃣ Verifying Database Tables:")
        logger.info("=" * 60)
        
        inspector = inspect(engine)
        tables = [
            'onboarding_sessions',
            'api_keys',
            'website_analyses',
            'research_preferences',
            'persona_data'
        ]
        
        all_exist = True
        for table in tables:
            if not verify_table_exists(table, inspector):
                all_exist = False
        
        if not all_exist:
            logger.error("")
            logger.error("❌ Some tables are missing! Run migrations first.")
            return False
        
        # Count all records
        db = SessionLocal()
        try:
            count_all_records(db)
            
            # If user_id provided, show detailed data
            if user_id:
                logger.info("")
                logger.info("=" * 60)
                logger.info(f"2️⃣ Verifying Data for User: {user_id}")
                logger.info("=" * 60)
                
                # Verify session
                session_id = verify_onboarding_session(user_id, db)
                
                if session_id:
                    logger.info("")
                    # Verify each step's data
                    verify_api_keys(session_id, user_id, db)
                    logger.info("")
                    verify_website_analysis(session_id, user_id, db)
                    logger.info("")
                    verify_research_preferences(session_id, user_id, db)
                    logger.info("")
                    verify_persona_data(session_id, user_id, db)
                    
                    # Show SQL examples
                    show_raw_sql_query_example(user_id)
            
            logger.info("")
            logger.info("=" * 60)
            logger.info("✅ Verification Complete!")
            logger.info("=" * 60)
            
            return True
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Verification failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)


#!/usr/bin/env python3
"""
Script to create monitoring tables directly.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import engine
from models.monitoring_models import (
    StrategyMonitoringPlan,
    MonitoringTask,
    TaskExecutionLog,
    StrategyPerformanceMetrics,
    StrategyActivationStatus
)
from loguru import logger

def create_monitoring_tables_direct():
    """Create monitoring tables directly"""
    try:
        logger.info("Creating monitoring tables directly...")
        
        # Create tables directly
        StrategyMonitoringPlan.__table__.create(engine, checkfirst=True)
        MonitoringTask.__table__.create(engine, checkfirst=True)
        TaskExecutionLog.__table__.create(engine, checkfirst=True)
        StrategyPerformanceMetrics.__table__.create(engine, checkfirst=True)
        StrategyActivationStatus.__table__.create(engine, checkfirst=True)
        
        logger.info("✅ Monitoring tables created successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error creating monitoring tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_monitoring_tables_direct()

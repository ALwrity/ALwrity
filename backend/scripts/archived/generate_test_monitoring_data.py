#!/usr/bin/env python3
"""
Generate Test Monitoring Data
Creates sample API monitoring data to demonstrate the dashboard charts and animations.
"""

import sys
import os
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import get_db
from models.api_monitoring import APIRequest, APIEndpointStats
from loguru import logger

def generate_test_monitoring_data():
    """Generate test monitoring data for demonstration."""
    logger.info("🎯 Generating test monitoring data...")
    
    db = next(get_db())
    
    try:
        # Sample endpoints
        endpoints = [
            ("GET", "/api/content-planning/strategies"),
            ("POST", "/api/content-planning/calendar-generation/start"),
            ("GET", "/api/content-planning/monitoring/lightweight-stats"),
            ("GET", "/api/content-planning/health"),
            ("POST", "/api/content-planning/ai-analytics/analyze"),
            ("GET", "/api/content-planning/gap-analysis"),
            ("PUT", "/api/content-planning/strategies/1"),
            ("DELETE", "/api/content-planning/strategies/2"),
        ]
        
        # Generate requests for the last 30 minutes
        now = datetime.utcnow()
        start_time = now - timedelta(minutes=30)
        
        logger.info(f"📊 Generating data from {start_time} to {now}")
        
        for i in range(100):  # Generate 100 requests
            # Random time within the last 30 minutes
            timestamp = start_time + timedelta(
                seconds=random.randint(0, 30 * 60)
            )
            
            # Random endpoint
            method, path = random.choice(endpoints)
            
            # Random status code (mostly 200, some errors)
            if random.random() < 0.9:  # 90% success rate
                status_code = 200
            else:
                status_code = random.choice([400, 401, 403, 404, 500, 502, 503])
            
            # Random duration (0.1 to 2.0 seconds)
            duration = random.uniform(0.1, 2.0)
            
            # Random cache hit
            cache_hit = random.choice([True, False, None])
            
            # Create API request
            api_request = APIRequest(
                path=path,
                method=method,
                status_code=status_code,
                duration=duration,
                user_id=f"user_{random.randint(1, 10)}",
                cache_hit=cache_hit,
                request_size=random.randint(100, 5000),
                response_size=random.randint(500, 10000),
                user_agent="Mozilla/5.0 (Test Browser)",
                ip_address=f"192.168.1.{random.randint(1, 255)}",
                timestamp=timestamp
            )
            db.add(api_request)
        
        # Generate endpoint stats
        for method, path in endpoints:
            endpoint_key = f"{method} {path}"
            
            # Check if stats already exist
            existing_stats = db.query(APIEndpointStats).filter(
                APIEndpointStats.endpoint == endpoint_key
            ).first()
            
            if existing_stats:
                # Update existing stats
                total_requests = random.randint(50, 200)
                total_errors = random.randint(0, total_requests // 10)
                total_duration = random.uniform(10.0, 100.0)
                
                existing_stats.total_requests = total_requests
                existing_stats.total_errors = total_errors
                existing_stats.total_duration = total_duration
                existing_stats.avg_duration = total_duration / total_requests
                existing_stats.min_duration = random.uniform(0.05, 0.5)
                existing_stats.max_duration = random.uniform(1.0, 3.0)
                existing_stats.cache_hits = random.randint(0, total_requests // 2)
                existing_stats.cache_misses = random.randint(0, total_requests // 3)
                existing_stats.last_called = now
                
                if existing_stats.cache_hits + existing_stats.cache_misses > 0:
                    existing_stats.cache_hit_rate = (
                        existing_stats.cache_hits / 
                        (existing_stats.cache_hits + existing_stats.cache_misses)
                    ) * 100
            else:
                # Create new stats
                total_requests = random.randint(50, 200)
                total_errors = random.randint(0, total_requests // 10)
                total_duration = random.uniform(10.0, 100.0)
                cache_hits = random.randint(0, total_requests // 2)
                cache_misses = random.randint(0, total_requests // 3)
                
                endpoint_stats = APIEndpointStats(
                    endpoint=endpoint_key,
                    total_requests=total_requests,
                    total_errors=total_errors,
                    total_duration=total_duration,
                    avg_duration=total_duration / total_requests,
                    min_duration=random.uniform(0.05, 0.5),
                    max_duration=random.uniform(1.0, 3.0),
                    cache_hits=cache_hits,
                    cache_misses=cache_misses,
                    cache_hit_rate=(cache_hits / (cache_hits + cache_misses)) * 100 if (cache_hits + cache_misses) > 0 else 0,
                    last_called=now
                )
                db.add(endpoint_stats)
        
        db.commit()
        logger.info("✅ Test monitoring data generated successfully!")
        
        # Show summary
        total_requests = db.query(APIRequest).count()
        total_errors = db.query(APIRequest).filter(APIRequest.status_code >= 400).count()
        total_endpoints = db.query(APIEndpointStats).count()
        
        logger.info(f"📈 Generated {total_requests} API requests")
        logger.info(f"❌ Generated {total_errors} error requests")
        logger.info(f"🔗 Generated stats for {total_endpoints} endpoints")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error generating test data: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()

def clear_test_data():
    """Clear all test monitoring data."""
    logger.info("🗑️ Clearing test monitoring data...")
    
    db = next(get_db())
    
    try:
        # Clear all data
        db.execute(text("DELETE FROM api_requests"))
        db.execute(text("DELETE FROM api_endpoint_stats"))
        db.execute(text("DELETE FROM system_health"))
        db.execute(text("DELETE FROM cache_performance"))
        
        db.commit()
        logger.info("✅ Test monitoring data cleared successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error clearing test data: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate test monitoring data")
    parser.add_argument("--action", choices=["generate", "clear"], default="generate",
                       help="Action to perform (generate or clear test data)")
    
    args = parser.parse_args()
    
    if args.action == "generate":
        success = generate_test_monitoring_data()
        if success:
            logger.info("🎉 Test data generation completed successfully!")
        else:
            logger.error("💥 Test data generation failed!")
            sys.exit(1)
    elif args.action == "clear":
        success = clear_test_data()
        if success:
            logger.info("🗑️ Test data cleared successfully!")
        else:
            logger.error("💥 Failed to clear test data!")
            sys.exit(1)

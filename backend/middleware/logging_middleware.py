"""
Intelligent Logging Middleware for AI SEO Tools

Provides structured logging, file saving, and monitoring capabilities
for all SEO tool operations with performance tracking.
"""

import json
import asyncio
import aiofiles
from datetime import datetime
from functools import wraps
from typing import Dict, Any, Callable
from pathlib import Path
from loguru import logger
import os
import time

from services.workspace_dirs import ensure_global_operational_dirs

# Logging configuration - Store in root workspace to avoid uvicorn reloads
# backend/middleware/logging_middleware.py -> middleware -> backend -> root
ROOT_DIR = Path(__file__).parent.parent.parent
LOG_BASE_DIR = ROOT_DIR / "workspace" / "logs"


def ensure_logging_dirs() -> None:
    """Create log directories lazily at runtime."""
    ensure_global_operational_dirs({"logs"})
    LOG_BASE_DIR.mkdir(parents=True, exist_ok=True)
    for subdir in ["seo_tools", "api_calls", "errors", "performance"]:
        (LOG_BASE_DIR / subdir).mkdir(parents=True, exist_ok=True)

class PerformanceLogger:
    """Performance monitoring and logging for SEO operations"""
    
    def __init__(self):
        self.performance_data = {}
    
    async def log_performance(self, operation: str, duration: float, metadata: Dict[str, Any] = None):
        """Log performance metrics for operations"""
        performance_log = {
            "operation": operation,
            "duration_seconds": duration,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        
        ensure_logging_dirs()
        await save_to_file(f"{LOG_BASE_DIR}/performance/metrics.jsonl", performance_log)
        
        # Log performance warnings for slow operations
        if duration > 30:  # More than 30 seconds
            logger.warning(f"Slow operation detected: {operation} took {duration:.2f} seconds")
        elif duration > 10:  # More than 10 seconds
            logger.info(f"Operation {operation} took {duration:.2f} seconds")

performance_logger = PerformanceLogger()

async def save_to_file(filepath: str, data: Dict[str, Any]) -> None:
    """
    Asynchronously save structured data to a JSONL file
    
    Args:
        filepath: Path to the log file
        data: Dictionary data to save
    """
    try:
        # Ensure directory exists
        ensure_logging_dirs()
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        
        # Convert data to JSON string
        json_line = json.dumps(data, default=str) + "\n"
        
        # Write asynchronously
        async with aiofiles.open(filepath, "a", encoding="utf-8") as file:
            await file.write(json_line)
            
    except Exception as e:
        logger.error(f"Failed to save log to {filepath}: {e}")

def log_api_call(func: Callable) -> Callable:
    """
    Decorator for logging API calls with performance tracking
    
    Automatically logs request/response data, timing, and errors
    for SEO tool endpoints.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        operation_name = func.__name__
        
        # Extract request data
        request_data = {}
        for arg in args:
            if hasattr(arg, 'dict'):  # Pydantic model
                request_data.update(arg.dict())
        
        # Log API call start
        call_log = {
            "operation": operation_name,
            "timestamp": datetime.utcnow().isoformat(),
            "request_data": request_data,
            "status": "started"
        }
        
        logger.info(f"API Call Started: {operation_name}")
        
        try:
            # Execute the function
            result = await func(*args, **kwargs)
            
            execution_time = time.time() - start_time
            
            # Log successful completion
            call_log.update({
                "status": "completed",
                "execution_time": execution_time,
                "success": getattr(result, 'success', True),
                "completion_timestamp": datetime.utcnow().isoformat()
            })
            
            await save_to_file(f"{LOG_BASE_DIR}/api_calls/successful.jsonl", call_log)
            await performance_logger.log_performance(operation_name, execution_time, request_data)
            
            logger.info(f"API Call Completed: {operation_name} in {execution_time:.2f}s")
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            # Log error
            error_log = call_log.copy()
            error_log.update({
                "status": "failed",
                "execution_time": execution_time,
                "error_type": type(e).__name__,
                "error_message": str(e),
                "completion_timestamp": datetime.utcnow().isoformat()
            })
            
            await save_to_file(f"{LOG_BASE_DIR}/api_calls/failed.jsonl", error_log)
            
            logger.error(f"API Call Failed: {operation_name} after {execution_time:.2f}s - {e}")
            
            # Re-raise the exception
            raise
    
    return wrapper

class SEOToolsLogger:
    """Centralized logger for SEO tools with intelligent categorization"""
    
    @staticmethod
    async def log_tool_usage(tool_name: str, input_data: Dict[str, Any], 
                           output_data: Dict[str, Any], success: bool = True):
        """Log SEO tool usage with input/output tracking"""
        usage_log = {
            "tool": tool_name,
            "timestamp": datetime.utcnow().isoformat(),
            "input_data": input_data,
            "output_data": output_data,
            "success": success,
            "input_size": len(str(input_data)),
            "output_size": len(str(output_data))
        }
        
        await save_to_file(f"{LOG_BASE_DIR}/seo_tools/usage.jsonl", usage_log)
    
    @staticmethod
    async def log_ai_analysis(tool_name: str, prompt: str, response: str, 
                            model_used: str, tokens_used: int = None):
        """Log AI analysis operations with token tracking"""
        ai_log = {
            "tool": tool_name,
            "timestamp": datetime.utcnow().isoformat(),
            "model": model_used,
            "prompt_length": len(prompt),
            "response_length": len(response),
            "tokens_used": tokens_used,
            "prompt_preview": prompt[:200] + "..." if len(prompt) > 200 else prompt,
            "response_preview": response[:200] + "..." if len(response) > 200 else response
        }
        
        await save_to_file(f"{LOG_BASE_DIR}/seo_tools/ai_analysis.jsonl", ai_log)
    
    @staticmethod
    async def log_external_api_call(api_name: str, endpoint: str, response_code: int,
                                  response_time: float, request_data: Dict[str, Any] = None):
        """Log external API calls (PageSpeed, etc.)"""
        api_log = {
            "api": api_name,
            "endpoint": endpoint,
            "response_code": response_code,
            "response_time": response_time,
            "timestamp": datetime.utcnow().isoformat(),
            "request_data": request_data or {},
            "success": 200 <= response_code < 300
        }
        
        await save_to_file(f"{LOG_BASE_DIR}/seo_tools/external_apis.jsonl", api_log)
    
    @staticmethod
    async def log_crawling_operation(url: str, pages_crawled: int, errors_found: int,
                                   crawl_depth: int, duration: float):
        """Log web crawling operations"""
        crawl_log = {
            "url": url,
            "pages_crawled": pages_crawled,
            "errors_found": errors_found,
            "crawl_depth": crawl_depth,
            "duration": duration,
            "timestamp": datetime.utcnow().isoformat(),
            "pages_per_second": pages_crawled / duration if duration > 0 else 0
        }
        
        await save_to_file(f"{LOG_BASE_DIR}/seo_tools/crawling.jsonl", crawl_log)

class LogAnalyzer:
    """Analyze logs to provide insights and monitoring"""
    
    @staticmethod
    async def get_performance_summary(hours: int = 24) -> Dict[str, Any]:
        """Get performance summary for the last N hours"""
        try:
            performance_file = f"{LOG_BASE_DIR}/performance/metrics.jsonl"
            if not os.path.exists(performance_file):
                return {"error": "No performance data available"}
            
            # Read recent performance data
            cutoff_time = datetime.utcnow().timestamp() - (hours * 3600)
            operations = []
            
            async with aiofiles.open(performance_file, "r", encoding="utf-8") as file:
                async for line in file:
                    try:
                        data = json.loads(line.strip())
                        log_time = datetime.fromisoformat(data["timestamp"]).timestamp()
                        if log_time >= cutoff_time:
                            operations.append(data)
                    except (json.JSONDecodeError, KeyError):
                        continue
            
            if not operations:
                return {"message": f"No operations in the last {hours} hours"}
            
            # Calculate statistics
            durations = [op["duration_seconds"] for op in operations]
            operation_counts = {}
            for op in operations:
                op_name = op["operation"]
                operation_counts[op_name] = operation_counts.get(op_name, 0) + 1
            
            return {
                "total_operations": len(operations),
                "average_duration": sum(durations) / len(durations),
                "max_duration": max(durations),
                "min_duration": min(durations),
                "operations_by_type": operation_counts,
                "time_period_hours": hours
            }
            
        except Exception as e:
            logger.error(f"Error analyzing performance logs: {e}")
            return {"error": str(e)}
    
    @staticmethod
    async def get_error_summary(hours: int = 24) -> Dict[str, Any]:
        """Get error summary for the last N hours"""
        try:
            error_file = f"{LOG_BASE_DIR}/seo_tools/errors.jsonl"
            if not os.path.exists(error_file):
                return {"message": "No errors recorded"}
            
            cutoff_time = datetime.utcnow().timestamp() - (hours * 3600)
            errors = []
            
            async with aiofiles.open(error_file, "r", encoding="utf-8") as file:
                async for line in file:
                    try:
                        data = json.loads(line.strip())
                        log_time = datetime.fromisoformat(data["timestamp"]).timestamp()
                        if log_time >= cutoff_time:
                            errors.append(data)
                    except (json.JSONDecodeError, KeyError):
                        continue
            
            if not errors:
                return {"message": f"No errors in the last {hours} hours"}
            
            # Analyze errors
            error_types = {}
            functions_with_errors = {}
            
            for error in errors:
                error_type = error.get("error_type", "Unknown")
                function = error.get("function", "Unknown")
                
                error_types[error_type] = error_types.get(error_type, 0) + 1
                functions_with_errors[function] = functions_with_errors.get(function, 0) + 1
            
            return {
                "total_errors": len(errors),
                "error_types": error_types,
                "functions_with_errors": functions_with_errors,
                "recent_errors": errors[-5:],  # Last 5 errors
                "time_period_hours": hours
            }
            
        except Exception as e:
            logger.error(f"Error analyzing error logs: {e}")
            return {"error": str(e)}

# Initialize global logger instance
seo_logger = SEOToolsLogger()
log_analyzer = LogAnalyzer()

# Configure loguru for structured logging
# Commented out to prevent conflicts with main logging configuration
# logger.add(
#     f"{LOG_BASE_DIR}/application.log",
#     rotation="1 day",
#     retention="30 days",
#     level="INFO",
#     format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}",
#     serialize=True
# )

# logger.add(
#     f"{LOG_BASE_DIR}/errors.log",
#     rotation="1 day",
#     retention="30 days",
#     level="ERROR",
#     format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}",
#     serialize=True
# )

logger.info("Logging middleware initialized successfully")
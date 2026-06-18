"""
Enhanced FastAPI Monitoring Middleware
Database-backed monitoring for API calls, errors, performance metrics, and usage tracking.
Includes comprehensive subscription-based usage monitoring and cost tracking.
"""

# Ensure Optional is available in global scope for dynamic imports
from typing import Optional

from fastapi import Request, Response
from fastapi.responses import JSONResponse
import time
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any
from collections import defaultdict, deque
import asyncio
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, case
from sqlalchemy.exc import OperationalError
import re

from models.api_monitoring import APIRequest, APIEndpointStats, SystemHealth, CachePerformance
from models.subscription_models import APIProvider
from .usage_tracking_service import UsageTrackingService
from .pricing_service import PricingService


from services.database import get_session_for_user, init_user_database


USAGE_LIMITS_EMERGENCY_FAIL_OPEN_ENV = "USAGE_LIMITS_EMERGENCY_FAIL_OPEN"
USAGE_LIMIT_ENFORCEMENT_ERROR_METRICS = defaultdict(int)


def _is_usage_limits_emergency_fail_open_enabled() -> bool:
    """Allow temporary fail-open behavior during an active incident."""
    return os.getenv(USAGE_LIMITS_EMERGENCY_FAIL_OPEN_ENV, "false").strip().lower() in {"1", "true", "yes", "on"}


def _record_usage_limit_enforcement_error(
    *,
    reason: str,
    user_id: str,
    path: str,
    provider: Optional[APIProvider],
    fail_open_enabled: bool,
):
    """Capture structured logs + lightweight counters for enforcement infrastructure failures."""
    provider_value = provider.value if provider else "unknown"
    metric_key = f"{reason}:{provider_value}"
    USAGE_LIMIT_ENFORCEMENT_ERROR_METRICS[metric_key] += 1

    logger.bind(
        event="usage_limit_enforcement_error",
        reason=reason,
        user_id=user_id,
        path=path,
        provider=provider_value,
        fail_open_enabled=fail_open_enabled,
        metric_key=metric_key,
        metric_count=USAGE_LIMIT_ENFORCEMENT_ERROR_METRICS[metric_key],
    ).error("Usage limit enforcement infrastructure failure")


def _build_usage_enforcement_unavailable_response() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "error": "Usage limit enforcement unavailable",
            "message": "Unable to validate usage limits right now. Please retry shortly.",
            "code": "USAGE_LIMIT_ENFORCEMENT_UNAVAILABLE",
        },
    )

class DatabaseAPIMonitor:
    """Database-backed API monitoring with usage tracking and subscription management."""
    
    def __init__(self):
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'hit_rate': 0.0
        }
        # API provider detection patterns - Updated to match actual endpoints
        self.provider_patterns = {
            APIProvider.GEMINI: [
                r'gemini', r'google.*ai'
            ],
            APIProvider.OPENAI: [r'openai', r'gpt', r'chatgpt'],
            APIProvider.ANTHROPIC: [r'anthropic', r'claude'],
            APIProvider.MISTRAL: [r'mistral'],
            APIProvider.TAVILY: [r'tavily'],
            APIProvider.SERPER: [r'serper'],
            APIProvider.METAPHOR: [r'metaphor', r'/exa'],
            APIProvider.FIRECRAWL: [r'firecrawl']
        }
    
    def detect_api_provider(self, path: str, user_agent: str = None) -> Optional[APIProvider]:
        """Detect which API provider is being used based on request details."""
        path_lower = path.lower()
        user_agent_lower = (user_agent or '').lower()

        # Permanently ignore internal route families that must not accrue or check provider usage
        if path_lower.startswith('/api/onboarding/') or path_lower.startswith('/api/subscription/'):
            return None
        
        for provider, patterns in self.provider_patterns.items():
            for pattern in patterns:
                if re.search(pattern, path_lower) or re.search(pattern, user_agent_lower):
                    return provider
        
        return None
    
    def extract_usage_metrics(self, request_body: str = None, response_body: str = None) -> Dict[str, Any]:
        """Extract usage metrics from request/response bodies."""
        metrics = {
            'tokens_input': 0,
            'tokens_output': 0,
            'model_used': None,
            'search_count': 0,
            'image_count': 0,
            'page_count': 0
        }
        
        try:
            # Try to parse request body for input tokens/content
            if request_body:
                request_data = json.loads(request_body) if isinstance(request_body, str) else request_body
                
                # Extract model information
                if 'model' in request_data:
                    metrics['model_used'] = request_data['model']
                
                # Estimate input tokens from prompt/content
                if 'prompt' in request_data:
                    metrics['tokens_input'] = self._estimate_tokens(request_data['prompt'])
                elif 'messages' in request_data:
                    total_content = ' '.join([msg.get('content', '') for msg in request_data['messages']])
                    metrics['tokens_input'] = self._estimate_tokens(total_content)
                elif 'input' in request_data:
                    metrics['tokens_input'] = self._estimate_tokens(str(request_data['input']))
                
                # Count specific request types
                if 'query' in request_data or 'search' in request_data:
                    metrics['search_count'] = 1
                if 'image' in request_data or 'generate_image' in request_data:
                    metrics['image_count'] = 1
                if 'url' in request_data or 'crawl' in request_data:
                    metrics['page_count'] = 1
            
            # Try to parse response body for output tokens
            if response_body:
                response_data = json.loads(response_body) if isinstance(response_body, str) else response_body
                
                # Extract output content and estimate tokens
                if 'text' in response_data:
                    metrics['tokens_output'] = self._estimate_tokens(response_data['text'])
                elif 'content' in response_data:
                    metrics['tokens_output'] = self._estimate_tokens(str(response_data['content']))
                elif 'choices' in response_data and response_data['choices']:
                    choice = response_data['choices'][0]
                    if 'message' in choice and 'content' in choice['message']:
                        metrics['tokens_output'] = self._estimate_tokens(choice['message']['content'])
                
                # Extract actual token usage if provided by API
                if 'usage' in response_data:
                    usage = response_data['usage']
                    if 'prompt_tokens' in usage:
                        metrics['tokens_input'] = usage['prompt_tokens']
                    if 'completion_tokens' in usage:
                        metrics['tokens_output'] = usage['completion_tokens']
        
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.debug(f"Could not extract usage metrics: {e}")
        
        return metrics
    
    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count for text (rough approximation)."""
        if not text:
            return 0
        # Rough estimation: 1.3 tokens per word on average
        word_count = len(str(text).split())
        return int(word_count * 1.3)

async def check_usage_limits_middleware(request: Request, user_id: str, request_body: str = None) -> Optional[JSONResponse]:
    """Check usage limits before processing request."""
    if not user_id:
        return None
    
    # No special whitelist; onboarding/subscription are ignored by provider detection
    try:
        path = request.url.path
    except Exception:
        path = ""
    
    db = None
    fail_open_enabled = _is_usage_limits_emergency_fail_open_enabled()
    api_provider = None
    try:
        db = get_session_for_user(user_id)

        api_monitor = DatabaseAPIMonitor()
        
        # Safe User-Agent access
        user_agent = None
        try:
            if hasattr(request, 'headers') and hasattr(request.headers, 'get'):
                user_agent = request.headers.get('user-agent')
        except:
            pass
            
        # Detect if this is an API call that should be rate limited
        api_provider = api_monitor.detect_api_provider(path, user_agent)
        if not api_provider:
            return None

        # Protected route with provider metering must not silently bypass enforcement.
        if not db:
            _record_usage_limit_enforcement_error(
                reason="database_session_unavailable",
                user_id=user_id,
                path=path,
                provider=api_provider,
                fail_open_enabled=fail_open_enabled,
            )
            if fail_open_enabled:
                logger.warning(
                    f"Emergency fail-open active ({USAGE_LIMITS_EMERGENCY_FAIL_OPEN_ENV}); bypassing usage limit enforcement for {user_id}"
                )
                return None
            return _build_usage_enforcement_unavailable_response()
        
        # Use provided request body or read it if not provided
        if request_body is None:
            try:
                if hasattr(request, '_body'):
                    request_body = request._body
                else:
                    # Try to read body (this might not work in all cases)
                    body = await request.body()
                    request_body = body.decode('utf-8') if body else None
            except:
                pass
        
        # Estimate tokens needed
        tokens_requested = 0
        if request_body:
            usage_metrics = api_monitor.extract_usage_metrics(request_body)
            tokens_requested = usage_metrics.get('tokens_input', 0)
        
        # Check limits
        usage_service = UsageTrackingService(db)
        try:
            can_proceed, message, usage_info = await usage_service.enforce_usage_limits(
                user_id=user_id,
                provider=api_provider,
                tokens_requested=tokens_requested
            )
            
            if not can_proceed:
                logger.warning(f"Usage limit exceeded for {user_id}: {message}")
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Usage limit exceeded",
                        "message": message,
                        "usage_info": usage_info,
                        "provider": api_provider.value
                    }
                )
            
            # Warn if approaching limits
            if usage_info.get('call_usage_percentage', 0) >= 80 or usage_info.get('cost_usage_percentage', 0) >= 80:
                logger.warning(f"User {user_id} approaching usage limits: {usage_info}")
                
        except OperationalError as e:
            if "no such table" in str(e):
                logger.warning(f"Tables missing for user {user_id}, attempting initialization...")
                try:
                    init_user_database(user_id)
                    _record_usage_limit_enforcement_error(
                        reason="missing_usage_tables",
                        user_id=user_id,
                        path=path,
                        provider=api_provider,
                        fail_open_enabled=fail_open_enabled,
                    )
                    if fail_open_enabled:
                        logger.warning(
                            f"Emergency fail-open active ({USAGE_LIMITS_EMERGENCY_FAIL_OPEN_ENV}); bypassing usage limit enforcement after table initialization for {user_id}"
                        )
                        return None
                    return _build_usage_enforcement_unavailable_response()
                except Exception as init_error:
                    logger.error(f"Failed to initialize database for user {user_id}: {init_error}")
                    _record_usage_limit_enforcement_error(
                        reason="database_init_failed",
                        user_id=user_id,
                        path=path,
                        provider=api_provider,
                        fail_open_enabled=fail_open_enabled,
                    )
                    if fail_open_enabled:
                        logger.warning(
                            f"Emergency fail-open active ({USAGE_LIMITS_EMERGENCY_FAIL_OPEN_ENV}); bypassing usage limit enforcement after failed database init for {user_id}"
                        )
                        return None
                    return _build_usage_enforcement_unavailable_response()
            else:
                _record_usage_limit_enforcement_error(
                    reason="operational_error",
                    user_id=user_id,
                    path=path,
                    provider=api_provider,
                    fail_open_enabled=fail_open_enabled,
                )
                if fail_open_enabled:
                    logger.warning(
                        f"Emergency fail-open active ({USAGE_LIMITS_EMERGENCY_FAIL_OPEN_ENV}); bypassing usage limit enforcement after operational error for {user_id}: {e}"
                    )
                    return None
                return _build_usage_enforcement_unavailable_response()
        
        return None
        
    except Exception as e:
        _record_usage_limit_enforcement_error(
            reason="unexpected_enforcement_error",
            user_id=user_id,
            path=path,
            provider=api_provider,
            fail_open_enabled=fail_open_enabled,
        )
        logger.error(f"Error checking usage limits: {e}")
        if fail_open_enabled:
            logger.warning(
                f"Emergency fail-open active ({USAGE_LIMITS_EMERGENCY_FAIL_OPEN_ENV}); bypassing usage limit enforcement for {user_id}"
            )
            return None
        return _build_usage_enforcement_unavailable_response()
    finally:
        if db is not None:
            db.close()

async def monitoring_middleware(request: Request, call_next):
    """Enhanced FastAPI middleware for monitoring API calls with usage tracking."""
    start_time = time.time()
    
    # Extract request details - Enhanced user identification
    user_id = None
    try:
        # PRIORITY 1: Check request.state.user_id (set by API key injection middleware)
        if hasattr(request.state, 'user_id'):
            # Directly check and convert without accessing attribute if None
            raw_user_id = request.state.user_id
            
            # Defensive check for Depends object or other complex types
            if raw_user_id is not None:
                # If it's a string, use it
                if isinstance(raw_user_id, str):
                    user_id = raw_user_id
                # If it has a dependency attribute (likely a Depends object), ignore it
                elif hasattr(raw_user_id, 'dependency'):
                    logger.warning(f"Monitoring: request.state.user_id is a Depends object, ignoring.")
                    user_id = None
                # Try to convert to string if it's a simple type
                else:
                    try:
                        user_id = str(raw_user_id)
                    except:
                        user_id = None
            
            if user_id:
                logger.debug(f"Monitoring: Using user_id from request.state: {user_id}")
        
        # PRIORITY 2: Check query parameters
        elif hasattr(request, 'query_params') and 'user_id' in request.query_params:
            user_id = request.query_params['user_id']
        elif hasattr(request, 'path_params') and 'user_id' in request.path_params:
            user_id = request.path_params['user_id']
        
        # PRIORITY 3: Check headers for user identification
        elif hasattr(request, 'headers') and hasattr(request.headers, 'get'):
            try:
                if request.headers.get('x-user-id'):
                    user_id = request.headers.get('x-user-id')
                elif request.headers.get('x-user-email'):
                    user_id = request.headers.get('x-user-email')
                elif request.headers.get('x-session-id'):
                    user_id = request.headers.get('x-session-id')
                
                # Check for authorization header with user info
                elif request.headers.get('authorization'):
                    # Auth middleware should have set request.state.user_id
                    # If not, this indicates an authentication failure (likely expired token)
                    # Log at debug level to reduce noise - expired tokens are expected
                    pass
            except Exception as e:
                logger.debug(f"Error accessing request headers: {e}")
        
    except Exception as e:
        logger.debug(f"Error extracting user ID: {e}")
        user_id = None
    
    # Get database session if user identified
    db = None
    if user_id:
        try:
            db = get_session_for_user(user_id)
        except Exception as e:
            logger.error(f"Failed to get database session for user {user_id}: {e}")
            db = None
    
    # Capture request body for usage tracking (read once, safely)
    request_body = None
    try:
        # Only read body for POST/PUT/PATCH requests to avoid issues
        if request.method in ['POST', 'PUT', 'PATCH']:
            if hasattr(request, '_body') and request._body:
                request_body = request._body.decode('utf-8')
            else:
                # Read body only if it hasn't been read yet
                try:
                    body = await request.body()
                    request_body = body.decode('utf-8') if body else None
                except Exception as body_error:
                    logger.debug(f"Could not read request body: {body_error}")
                    request_body = None
    except Exception as e:
        logger.debug(f"Error capturing request body: {e}")
        request_body = None
    
    # Check usage limits before processing
    # Skip for OPTIONS requests
    try:
        if request.method != "OPTIONS":
            limit_response = await check_usage_limits_middleware(request, user_id, request_body)
            if limit_response:
                if db: db.close()
                return limit_response
    except Exception as e:
        logger.error(f"Error in usage limits middleware: {e}")
        # Continue processing if usage check fails (fail open)
    
    try:
        response = await call_next(request)
        status_code = response.status_code
        duration = time.time() - start_time
        
        # Extract response body safely for usage tracking
        response_body = None
        if hasattr(response, 'body'):
            response_body = response.body.decode('utf-8') if response.body else None
        elif hasattr(response, '_content'):
            response_body = response._content.decode('utf-8') if response._content else None
            
        # Track API usage if this is an API call to external providers
        api_monitor = DatabaseAPIMonitor()
        
        # Safe URL path access
        try:
             path = request.url.path
        except:
             path = ""
             
        # Safe User-Agent access - handle case where headers might be a Depends object
        user_agent = None
        try:
            # Defensive check: ensure request.headers is a valid headers object
            # Some dependency injection failures replace request attributes with Depends objects
            if hasattr(request, 'headers'):
                 headers_obj = request.headers
                 # Check if it has a 'get' method (like a dict or Headers object)
                 if hasattr(headers_obj, 'get') and callable(headers_obj.get):
                      user_agent = headers_obj.get('user-agent')
        except:
            pass
            
        api_provider = api_monitor.detect_api_provider(path, user_agent)
        if api_provider and user_id:
            logger.info(f"Detected API call: {request.url.path} -> {api_provider.value} for user: {user_id}")
            try:
                # Extract usage metrics
                usage_metrics = api_monitor.extract_usage_metrics(request_body, response_body)
                
                # Track usage with the usage tracking service
                if db:
                    usage_service = UsageTrackingService(db)
                    await usage_service.track_api_usage(
                        user_id=user_id,
                        provider=api_provider,
                        endpoint=path,
                        method=request.method,
                        model_used=usage_metrics.get('model_used'),
                        tokens_input=usage_metrics.get('tokens_input', 0),
                        tokens_output=usage_metrics.get('tokens_output', 0),
                        response_time=duration,
                        status_code=status_code,
                        request_size=len(request_body) if request_body else None,
                        response_size=len(response_body) if response_body else None,
                        user_agent=user_agent,
                        ip_address=request.client.host if request.client else None,
                        search_count=usage_metrics.get('search_count', 0),
                        image_count=usage_metrics.get('image_count', 0),
                        page_count=usage_metrics.get('page_count', 0)
                    )
            except OperationalError as e:
                if "no such table" in str(e):
                    # Tables missing, try to init (might happen if check_usage_limits was skipped or passed)
                    try:
                         init_user_database(user_id)
                    except:
                        pass
            except Exception as usage_error:
                logger.error(f"Error tracking API usage: {usage_error}")
                # Don't fail the main request if usage tracking fails
        
        return response
        
    except Exception as e:
        duration = time.time() - start_time
        status_code = 500
        
        # Check for missing tables and try to self-heal
        if "no such table" in str(e) and user_id:
            logger.warning(f"Tables missing for user {user_id} during request processing, attempting initialization...")
            try:
                init_user_database(user_id)
                logger.info(f"Database initialized for user {user_id}. Request failed but next should succeed.")
                return JSONResponse(
                    status_code=503, # Service Unavailable (temporary)
                    content={"error": "Database initialized. Please retry request."}
                )
            except Exception as init_error:
                logger.error(f"Failed to initialize database for user {user_id}: {init_error}")

        # Store minimal error info
        logger.error(f"API Error: {request.method} {request.url.path} - {str(e)}")
        
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )
    finally:
        if db:
            db.close()

async def get_monitoring_stats(minutes: int = 5) -> Dict[str, Any]:
    """Get current monitoring statistics."""
    # Placeholder to match old API; heavy stats handled elsewhere
    return {
        'timestamp': datetime.utcnow().isoformat(),
        'overview': {
            'recent_requests': 0,
            'recent_errors': 0,
        },
        'cache_performance': {'hits': 0, 'misses': 0, 'hit_rate': 0.0},
        'recent_errors': [],
        'system_health': {'status': 'healthy', 'error_rate': 0.0}
    }

async def get_lightweight_stats(user_id: str) -> Dict[str, Any]:
    """Get lightweight stats for dashboard header.
    
    Optimized single-query approach using conditional aggregation for better performance.
    """
    db = None
    try:
        db = get_session_for_user(user_id)
        if not db:
             return {
                'status': 'unknown',
                'icon': '⚪',
                'recent_requests': 0,
                'recent_errors': 0,
                'error_rate': 0.0,
                'timestamp': datetime.utcnow().isoformat()
            }
        now = datetime.utcnow()
        
        # Get stats from last 5 minutes
        five_minutes_ago = now - timedelta(minutes=5)
        
        # Optimized: Single query with conditional aggregation instead of two separate queries
        # This is much faster as it only scans the table once
        # Use run_in_threadpool to avoid blocking the event loop with sync DB query
        from starlette.concurrency import run_in_threadpool

        # H5: threadpool workers must not share the async-loop `db` Session
        # (SQLAlchemy Sessions are not thread-safe). Open a fresh Session
        # bound to the same per-user engine and close it in the worker.
        def _fetch_stats():
            thread_db = get_session_for_user(user_id)
            if thread_db is None:
                return None
            try:
                return thread_db.query(
                    func.count(APIRequest.id).label('total_requests'),
                    func.sum(
                        case((APIRequest.status_code >= 400, 1), else_=0)
                    ).label('total_errors')
                ).filter(
                    APIRequest.timestamp >= five_minutes_ago
                ).first()
            finally:
                thread_db.close()

        stats = await run_in_threadpool(_fetch_stats)
        
        recent_requests = stats.total_requests or 0 if stats else 0
        recent_errors = int(stats.total_errors or 0) if stats else 0
        
        # Calculate error rate
        error_rate = (recent_errors / recent_requests * 100) if recent_requests > 0 else 0.0
        
        # Determine status based on error rate
        if error_rate > 10:
            status = 'critical'
            icon = '🔴'
        elif error_rate > 5:
            status = 'warning'
            icon = '🟡'
        else:
            status = 'healthy'
            icon = '🟢'
        
        return {
            'status': status,
            'icon': icon,
            'recent_requests': recent_requests,
            'recent_errors': recent_errors,
            'error_rate': round(error_rate, 2),
            'timestamp': now.isoformat()
        }
    except OperationalError as e:
        if "no such table" in str(e):
            logger.warning(f"Tables missing for user {user_id} in lightweight stats, attempting initialization...")
            try:
                init_user_database(user_id)
            except Exception as init_error:
                logger.error(f"Failed to initialize database for user {user_id}: {init_error}")
        
        # Return default healthy state on error/missing table
        return {
            'status': 'healthy',
            'icon': '🟢',
            'recent_requests': 0,
            'recent_errors': 0,
            'error_rate': 0.0,
            'timestamp': datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting lightweight stats: {e}", exc_info=True)
        # Return default healthy state on error
        return {
            'status': 'healthy',
            'icon': '🟢',
            'recent_requests': 0,
            'recent_errors': 0,
            'error_rate': 0.0,
            'timestamp': datetime.utcnow().isoformat()
        }
    finally:
        if db is not None:
            db.close()

"""Authentication middleware for ALwrity backend."""

import os
import base64
import inspect
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, status, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from loguru import logger
from dotenv import load_dotenv

# Try to import fastapi-clerk-auth, fallback to custom implementation
try:
    from fastapi_clerk_auth import ClerkHTTPBearer, ClerkConfig
    CLERK_AUTH_AVAILABLE = True
except ImportError:
    CLERK_AUTH_AVAILABLE = False
    logger.warning("fastapi-clerk-auth not available, using custom implementation")

# Load environment variables from the correct path
# Get the backend directory path (parent of middleware directory)
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env_path = os.path.join(_backend_dir, ".env")
load_dotenv(_env_path, override=False)  # Don't override if already loaded

# Initialize security scheme
security = HTTPBearer(auto_error=False)

class ClerkAuthMiddleware:
    """Clerk authentication middleware using fastapi-clerk-auth or custom implementation."""

    def __init__(self):
        """Initialize Clerk authentication middleware."""
        self.clerk_secret_key = os.getenv('CLERK_SECRET_KEY', '').strip()
        # Check for both backend and frontend naming conventions
        publishable_key = (
            os.getenv('CLERK_PUBLISHABLE_KEY') or 
            os.getenv('REACT_APP_CLERK_PUBLISHABLE_KEY', '')
        )
        self.clerk_publishable_key = publishable_key.strip() if publishable_key else None
        self.disable_auth = os.getenv('DISABLE_AUTH', 'false').lower() == 'true'
        self.environment = (os.getenv('ENVIRONMENT') or os.getenv('APP_ENV') or 'development').strip().lower()
        self.is_production = self.environment in {'prod', 'production'}
        allow_unverified_raw = os.getenv('ALLOW_UNVERIFIED_JWT_DEV')
        if allow_unverified_raw is None:
            # Safe default: allow unverified fallback only outside production unless explicitly overridden.
            self.allow_unverified_dev = not self.is_production
        else:
            self.allow_unverified_dev = allow_unverified_raw.lower() == 'true'

        # Hard guard: never allow unverified JWTs in production, regardless of env var
        if self.is_production and self.allow_unverified_dev:
            logger.warning(
                "ALLOW_UNVERIFIED_JWT_DEV=true is ignored in production environment. "
                "Unverified JWT fallback has been forcibly disabled."
            )
            self.allow_unverified_dev = False
        
        # Cache for PyJWKClient to avoid repeated JWKS fetches
        self._jwks_client_cache = {}
        self._jwks_url_cache = None
        self._issuer_cache = None  # Pre-configured Clerk issuer for iss validation

        if not self.clerk_secret_key and not self.disable_auth:
            logger.warning("CLERK_SECRET_KEY not found, authentication may fail")

        # Initialize fastapi-clerk-auth if available
        if CLERK_AUTH_AVAILABLE and not self.disable_auth:
            try:
                if self.clerk_secret_key and self.clerk_publishable_key:
                    # Extract instance from publishable key for JWKS URL and issuer validation
                    # Format: pk_test_<instance>.<domain> or pk_live_<instance>.<domain>
                    # Production keys may have base64-encoded instance IDs
                    parts = self.clerk_publishable_key.replace('pk_test_', '').replace('pk_live_', '').split('.')
                    if len(parts) >= 1:
                        # Attempt base64 decode (production Clerk keys encode the instance)
                        raw_instance = parts[0]
                        try:
                            padded = raw_instance + '=' * (4 - len(raw_instance) % 4) if len(raw_instance) % 4 else raw_instance
                            decoded_bytes = base64.b64decode(padded)
                            instance = decoded_bytes.decode('utf-8').rstrip('\x00 $\n\r\t')
                        except Exception:
                            instance = raw_instance

                        # If decoded value contains a dot, it's already a full domain path
                        if '.' in instance:
                            issuer_url = f"https://{instance}"
                        else:
                            issuer_url = f"https://{instance}.clerk.accounts.dev"
                        jwks_url = f"{issuer_url}/.well-known/jwks.json"

                        # Create Clerk configuration with JWKS URL
                        clerk_config = ClerkConfig(
                            secret_key=self.clerk_secret_key,
                            jwks_url=jwks_url
                        )
                        # Create ClerkHTTPBearer instance for dependency injection
                        self.clerk_bearer = ClerkHTTPBearer(clerk_config)
                        logger.info(f"fastapi-clerk-auth initialized successfully with JWKS URL: {jwks_url}")
                        self._jwks_url_cache = jwks_url
                        self._issuer_cache = issuer_url  # Pin issuer for VULN-001 fix
                    else:
                        logger.warning("Could not extract instance from publishable key")
                        self.clerk_bearer = None
                else:
                    logger.warning("CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY not found")
                    self.clerk_bearer = None
            except Exception as e:
                logger.error(f"Failed to initialize fastapi-clerk-auth: {e}")
                self.clerk_bearer = None
        else:
            self.clerk_bearer = None

        logger.info(
            f"ClerkAuthMiddleware initialized - env={self.environment}, "
            f"auth_disabled={self.disable_auth}, allow_unverified_dev={self.allow_unverified_dev}, "
            f"fastapi-clerk-auth={CLERK_AUTH_AVAILABLE}"
        )

    async def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify Clerk JWT using fastapi-clerk-auth or custom implementation."""
        try:
            if self.disable_auth:
                logger.info("Authentication disabled, returning mock user")
                return {
                    'id': 'mock_user_id',
                    'email': 'mock@example.com',
                    'first_name': 'Mock',
                    'last_name': 'User',
                    'clerk_user_id': 'mock_clerk_user_id'
                }

            if not self.clerk_secret_key:
                logger.error("CLERK_SECRET_KEY not configured")
                return None

            # Use fastapi-clerk-auth if available
            if self.clerk_bearer:
                try:
                    # Decode and verify the JWT token
                    import jwt
                    from jwt import PyJWKClient
                    
                    # Get the unverified header for key ID lookup
                    unverified_header = jwt.get_unverified_header(token)

                    # --- SECURITY FIX (VULN-001): Validate issuer before any JWKS fetch ---
                    # Pre-configured issuer and JWKS URL derived from CLERK_PUBLISHABLE_KEY
                    # NEVER use the token's 'iss' claim to construct the JWKS URL (GHSA-426f-p74m-73fv)
                    expected_issuer = self._issuer_cache
                    jwks_url = self._jwks_url_cache
                    if not expected_issuer or not jwks_url:
                        raise Exception("Clerk issuer/JWKS URL not configured at startup")

                    # Decode token to validate the issuer claim against the pre-configured value
                    # WARNING: We must first validate 'iss' before trusting anything else
                    unverified_claims = jwt.decode(token, options={"verify_signature": False})
                    token_issuer = unverified_claims.get('iss', '')
                    if token_issuer != expected_issuer:
                        logger.error(
                            f"Issuer mismatch: token claims '{token_issuer}' "
                            f"but expected '{expected_issuer}'"
                        )
                        return None

                    # Use cached PyJWKClient with pinned jwks_url (never derived from token)
                    if jwks_url not in self._jwks_client_cache:
                        logger.info(f"Creating new PyJWKClient for {jwks_url} with caching enabled")
                        # Create client with caching enabled (cache_keys=True keeps keys in memory)
                        self._jwks_client_cache[jwks_url] = PyJWKClient(
                            jwks_url,
                            cache_keys=True,
                            max_cached_keys=16
                        )

                    jwks_client = self._jwks_client_cache[jwks_url]
                    signing_key = jwks_client.get_signing_key_from_jwt(token)

                    # Verify and decode the token with clock skew tolerance
                    # Add 300 seconds (5 minutes) leeway to handle clock skew and token refresh delays
                    # SECURITY: Always pass issuer= to verify the token's 'iss' matches expected (VULN-001)
                    decoded_token = jwt.decode(
                        token,
                        signing_key.key,
                        algorithms=["RS256"],
                        issuer=expected_issuer,
                        options={"verify_signature": True, "verify_exp": True, "verify_iss": True},
                        leeway=300  # Allow 5 minutes leeway for token refresh during navigation
                    )
                    
                    # Extract user information
                    user_id = decoded_token.get('sub')
                    email = decoded_token.get('email')
                    first_name = decoded_token.get('first_name') or decoded_token.get('given_name')
                    last_name = decoded_token.get('last_name') or decoded_token.get('family_name')
                    
                    if user_id:
                        logger.info(f"Token verified successfully using fastapi-clerk-auth for user: {email} (ID: {user_id})")
                        return {
                            'id': user_id,
                            'email': email,
                            'first_name': first_name,
                            'last_name': last_name,
                            'clerk_user_id': user_id
                        }
                    else:
                        logger.warning("No user ID found in verified token")
                        return None
                except Exception as e:
                    # Expired tokens are expected - log at debug level to reduce noise
                    error_msg = str(e).lower()
                    if 'expired' in error_msg or 'signature has expired' in error_msg:
                        logger.debug(f"Token expired (expected): {e}")
                    else:
                        logger.warning(f"fastapi-clerk-auth verification error: {e}. Attempting fallback decoding.")

                    # Fallback to unverified decoding on verification failure (DEV MODE ONLY)
                    try:
                        import jwt
                        # Decode the JWT without verification to get claims
                        decoded_token = jwt.decode(token, options={"verify_signature": False}, leeway=300)
                        user_id = decoded_token.get('sub')
                        email = decoded_token.get('email')
                        first_name = decoded_token.get('first_name') or decoded_token.get('given_name')
                        last_name = decoded_token.get('last_name') or decoded_token.get('family_name')
                        
                        if user_id and self.allow_unverified_dev:
                            logger.debug(f"Unverified token accepted (dev) for user: {email or 'unknown'} (ID: {user_id})")
                            return {
                                'id': user_id,
                                'email': email,
                                'first_name': first_name,
                                'last_name': last_name,
                                'clerk_user_id': user_id
                            }
                        elif user_id and not self.allow_unverified_dev:
                            logger.error(f"Unverified token rejected (env={self.environment}).")
                            return None
                    except Exception as fallback_e:
                        logger.warning(f"Fallback decoding failed: {fallback_e}")

                    return None
            else:
                # Fallback to custom implementation (not secure for production)
                logger.debug("Using fallback JWT decoding without signature verification")
                try:
                    import jwt
                    # Decode the JWT without verification to get claims
                    # This is NOT secure for production - only for development
                    # Add leeway to handle clock skew
                    decoded_token = jwt.decode(
                        token, 
                        options={"verify_signature": False},
                        leeway=300  # Allow 5 minutes leeway for token refresh
                    )
                    
                    # Extract user information from the token
                    user_id = decoded_token.get('sub') or decoded_token.get('user_id')
                    email = decoded_token.get('email')
                    first_name = decoded_token.get('first_name')
                    last_name = decoded_token.get('last_name')
                    
                    if not user_id:
                        logger.warning("No user ID found in token")
                        return None
                    
                    if self.allow_unverified_dev:
                        logger.debug(f"Token decoded successfully (fallback dev) for user: {email} (ID: {user_id})")
                        return {
                            'id': user_id,
                            'email': email,
                            'first_name': first_name,
                            'last_name': last_name,
                            'clerk_user_id': user_id
                        }
                    # In production mode, treat fallback as a soft failure:
                    # log at warning level (once per process) and let the caller
                    # handle this as an authentication failure without spamming logs.
                    logger.warning("Fallback decoding is disabled in production.")
                    return None
                    
                except Exception as e:
                    logger.warning(f"Fallback JWT decode error: {e}")
                    return None

        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return None

# Initialize middleware
clerk_auth = ClerkAuthMiddleware()

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """Get current authenticated user."""
    try:
        # Safe header access
        auth_header = None
        user_agent = "unknown"
        all_headers = {}
        
        try:
            if hasattr(request, 'headers'):
                 if hasattr(request.headers, 'get'):
                      auth_header = request.headers.get('authorization') or request.headers.get('Authorization')
                      user_agent = request.headers.get('user-agent', 'unknown')
                 
                 if hasattr(request.headers, 'items'):
                       all_headers = {k: (v[:50] if len(v) > 50 else v) for k, v in request.headers.items() if k.lower() != 'authorization'}
        except:
             pass
             
        if not credentials:
            # CRITICAL: Log as ERROR since this is a security issue - authenticated endpoint accessed without credentials
            endpoint_path = f"{request.method} {request.url.path}"
            
            logger.error(
                f"🔒 AUTHENTICATION ERROR: No credentials provided for authenticated endpoint: {endpoint_path} "
                f"(client_ip={request.client.host if request.client else 'unknown'}, "
                f"auth_header_received={'YES' if auth_header else 'NO'}, "
                f"all_headers={list(all_headers.keys())}, "
                f"user_agent={user_agent})"
            )
            
            # Get caller information for better debugging
            caller_frame = inspect.currentframe()
            caller_info = "unknown"
            if caller_frame:
                try:
                    # Go up the stack to find the actual endpoint function
                    frame = caller_frame.f_back
                    if frame:
                        # Look for the FastAPI endpoint (usually 2-3 frames up)
                        for _ in range(5):  # Check up to 5 frames
                            if frame:
                                func_name = frame.f_code.co_name
                                module_name = frame.f_globals.get('__name__', 'unknown')
                                # Skip FastAPI internal frames
                                if 'fastapi' not in module_name.lower() and 'middleware' not in module_name.lower():
                                    caller_info = f"{module_name}.{func_name}"
                                    break
                                frame = frame.f_back
                except Exception:
                    pass  # If we can't get caller info, continue with unknown
            
            # If we received an auth header but HTTPBearer didn't extract it, try manual extraction
            if auth_header and auth_header.startswith('Bearer '):
                logger.warning(
                    f"⚠️ WARNING: Authorization header received but HTTPBearer didn't extract it. "
                    f"Trying manual extraction for endpoint: {endpoint_path}"
                )
                # Try to extract token manually
                token = auth_header.replace('Bearer ', '').strip()
                if token:
                    user = await clerk_auth.verify_token(token)
                    if user:
                        logger.info(f"✅ Manual token extraction successful for endpoint: {endpoint_path}")
                        return user
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = credentials.credentials
        user = await clerk_auth.verify_token(token)
        if not user:
            # Token verification failed - log with endpoint context for debugging
            endpoint_path = f"{request.method} {request.url.path}"
            
            # Get caller information
            caller_frame = inspect.currentframe()
            caller_info = "unknown"
            if caller_frame:
                try:
                    frame = caller_frame.f_back
                    if frame:
                        for _ in range(5):
                            if frame:
                                func_name = frame.f_code.co_name
                                module_name = frame.f_globals.get('__name__', 'unknown')
                                if 'fastapi' not in module_name.lower() and 'middleware' not in module_name.lower():
                                    caller_info = f"{module_name}.{func_name}"
                                    break
                                frame = frame.f_back
                except Exception:
                    pass
            
            # Safe header access for logging
            safe_user_agent = "unknown"
            try:
                if hasattr(request, 'headers') and hasattr(request.headers, 'get'):
                    safe_user_agent = request.headers.get('user-agent', 'unknown')
            except:
                pass

            logger.error(
                f"🔒 AUTHENTICATION ERROR: Token verification failed for endpoint: {endpoint_path} "
                f"(client_ip={request.client.host if request.client else 'unknown'}, "
                f"caller={caller_info}, "
                f"user_agent={safe_user_agent})"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user

    except HTTPException:
        raise
    except Exception as e:
        endpoint_path = f"{request.method} {request.url.path}"
        
        # Get caller information
        caller_frame = inspect.currentframe()
        caller_info = "unknown"
        if caller_frame:
            try:
                frame = caller_frame.f_back
                if frame:
                    for _ in range(5):
                        if frame:
                            func_name = frame.f_code.co_name
                            module_name = frame.f_globals.get('__name__', 'unknown')
                            if 'fastapi' not in module_name.lower() and 'middleware' not in module_name.lower():
                                caller_info = f"{module_name}.{func_name}"
                                break
                            frame = frame.f_back
            except Exception:
                pass
        
        logger.error(
            f"🔒 AUTHENTICATION ERROR: Unexpected error during authentication for endpoint: {endpoint_path}: {e} "
            f"(client_ip={request.client.host if request.client else 'unknown'}, "
            f"caller={caller_info}, "
            f"user_agent={user_agent})",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """Get current user if authenticated, otherwise return None."""
    try:
        if not credentials:
            return None

        token = credentials.credentials
        user = await clerk_auth.verify_token(token)
        return user

    except Exception as e:
        logger.warning(f"Optional authentication failed: {e}")
        return None

async def get_current_user_with_query_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """Get current authenticated user from either Authorization header or query parameter.
    
    This is useful for media endpoints (audio, video, images) that need to be accessed
    by HTML elements like <audio> or <img> which cannot send custom headers.
    
    Args:
        request: FastAPI request object
        credentials: HTTP authorization credentials from header
    
    Returns:
        User dictionary with authentication info
    
    Raises:
        HTTPException: If authentication fails
    """
    try:
        # Try to get token from Authorization header first
        token_to_verify = None
        if credentials:
            token_to_verify = credentials.credentials
        else:
            # Fall back to query parameter if no header
            query_token = None
            try:
                if hasattr(request, 'query_params') and hasattr(request.query_params, 'get'):
                    query_token = request.query_params.get("token")
            except:
                pass
            if query_token:
                token_to_verify = query_token
        
        if not token_to_verify:
            # CRITICAL: Log as ERROR since this is a security issue
            endpoint_path = f"{request.method} {request.url.path}"
            
            # Safe user agent access
            user_agent = "unknown"
            try:
                if hasattr(request, 'headers') and hasattr(request.headers, 'get'):
                     user_agent = request.headers.get('user-agent', 'unknown')
            except:
                pass
            
            # Get caller information
            caller_frame = inspect.currentframe()
            caller_info = "unknown"
            if caller_frame:
                try:
                    frame = caller_frame.f_back
                    if frame:
                        for _ in range(5):
                            if frame:
                                func_name = frame.f_code.co_name
                                module_name = frame.f_globals.get('__name__', 'unknown')
                                if 'fastapi' not in module_name.lower() and 'middleware' not in module_name.lower():
                                    caller_info = f"{module_name}.{func_name}"
                                    break
                                frame = frame.f_back
                except Exception:
                    pass
            
            # Safe header access for logging
            safe_user_agent = "unknown"
            try:
                if hasattr(request, 'headers') and hasattr(request.headers, 'get'):
                    safe_user_agent = request.headers.get('user-agent', 'unknown')
            except:
                pass

            logger.error(
                f"🔒 AUTHENTICATION ERROR: No credentials provided (neither header nor query parameter) "
                f"for authenticated endpoint: {endpoint_path} "
                f"(client_ip={request.client.host if request.client else 'unknown'}, "
                f"caller={caller_info}, "
                f"user_agent={safe_user_agent})"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = await clerk_auth.verify_token(token_to_verify)
        if not user:
            # Token verification failed - log with endpoint context
            endpoint_path = f"{request.method} {request.url.path}"
            
            # Get caller information
            caller_frame = inspect.currentframe()
            caller_info = "unknown"
            if caller_frame:
                try:
                    frame = caller_frame.f_back
                    if frame:
                        for _ in range(5):
                            if frame:
                                func_name = frame.f_code.co_name
                                module_name = frame.f_globals.get('__name__', 'unknown')
                                if 'fastapi' not in module_name.lower() and 'middleware' not in module_name.lower():
                                    caller_info = f"{module_name}.{func_name}"
                                    break
                                frame = frame.f_back
                except Exception:
                    pass
            
            # Safe header access for logging
            safe_user_agent = "unknown"
            try:
                if hasattr(request, 'headers') and hasattr(request.headers, 'get'):
                    safe_user_agent = request.headers.get('user-agent', 'unknown')
            except:
                pass
            
            logger.error(
                f"🔒 AUTHENTICATION ERROR: Token verification failed for endpoint: {endpoint_path} "
                f"(client_ip={request.client.host if request.client else 'unknown'}, "
                f"caller={caller_info}, "
                f"user_agent={safe_user_agent})"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user

    except HTTPException:
        raise
    except Exception as e:
        endpoint_path = f"{request.method} {request.url.path}"
        
        # Get caller information
        caller_frame = inspect.currentframe()
        caller_info = "unknown"
        if caller_frame:
            try:
                frame = caller_frame.f_back
                if frame:
                    for _ in range(5):
                        if frame:
                            func_name = frame.f_code.co_name
                            module_name = frame.f_globals.get('__name__', 'unknown')
                            if 'fastapi' not in module_name.lower() and 'middleware' not in module_name.lower():
                                caller_info = f"{module_name}.{func_name}"
                                break
                            frame = frame.f_back
            except Exception:
                pass
        
        # Safe header access for logging
        safe_user_agent = "unknown"
        try:
            if hasattr(request, 'headers') and hasattr(request.headers, 'get'):
                safe_user_agent = request.headers.get('user-agent', 'unknown')
        except:
            pass

        logger.error(
            f"🔒 AUTHENTICATION ERROR: Unexpected error during authentication for endpoint: {endpoint_path}: {e} "
            f"(client_ip={request.client.host if request.client else 'unknown'}, "
            f"caller={caller_info}, "
            f"user_agent={safe_user_agent})",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

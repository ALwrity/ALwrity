"""Google Search Console Service for ALwrity."""

import os
import json
import sqlite3
import secrets
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from loguru import logger

from services.database import get_user_db_path
from services.analytics_cache_service import analytics_cache

from dotenv import load_dotenv

class GSCService:
    """Service for Google Search Console integration."""
    
    def __init__(self, db_path: str = None):
        """Initialize GSC service."""
        # db_path is deprecated in favor of dynamic user_id based paths
        self.db_path = db_path
        
        # Resolve credentials file robustly: env override or project-relative default
        env_credentials_path = os.getenv("GSC_CREDENTIALS_FILE")
        if env_credentials_path:
            self.credentials_file = env_credentials_path
        else:
            # Default to <backend>/gsc_credentials.json regardless of CWD
            services_dir = os.path.dirname(__file__)
            backend_dir = os.path.abspath(os.path.join(services_dir, os.pardir))
            self.credentials_file = os.path.join(backend_dir, "gsc_credentials.json")
            
        # Load client config from file or environment variables
        self.client_config = self._load_client_config()
        
        if self.client_config:
            logger.info("GSC client configuration loaded successfully")
        else:
            logger.warning(f"GSC credentials not found in {self.credentials_file} or environment variables")
            
        self.scopes = ['https://www.googleapis.com/auth/webmasters.readonly']
        # Note: Tables are initialized lazily per user
        logger.info("GSC Service initialized successfully")

    def _load_client_config(self) -> Optional[Dict[str, Any]]:
        """Load Google client configuration from environment variables or file."""
        # Reload environment variables to catch any runtime changes (e.g. .env updates)
        load_dotenv(override=True)

        # 1. Check Environment Variables (Priority)
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        
        if client_id and client_secret:
            redirect_uri = os.getenv('GSC_REDIRECT_URI', 'http://localhost:8000/gsc/callback')
            logger.info("Loading GSC credentials from environment variables")
            # Construct the config dictionary expected by google_auth_oauthlib
            return {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "project_id": os.getenv("GOOGLE_PROJECT_ID", "alwrity"),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "redirect_uris": [
                        "http://localhost:5173/onboarding",
                        redirect_uri
                    ],
                    "javascript_origins": [
                        "http://localhost:5173",
                        "http://localhost:8000"
                    ]
                }
            }

        # 2. Fallback to File
        if os.path.exists(self.credentials_file):
            try:
                with open(self.credentials_file, 'r') as f:
                    config = json.load(f)
                    logger.info(f"Loading GSC credentials from file: {self.credentials_file}")
                    return config
            except Exception as e:
                logger.warning(f"Failed to load GSC credentials from file: {e}")
        
        return None
    
    def _get_db_path(self, user_id: str) -> str:
        return get_user_db_path(user_id)
    
    def _init_gsc_tables(self, user_id: str):
        """Ensure the per-user schema exists (owned by Alembic migrations)."""
        try:
            from services.database import get_engine_for_user

            get_engine_for_user(user_id)
        except Exception as ensure_error:
            logger.warning(f"Could not ensure Alembic schema for user {user_id}: {ensure_error}")
        db_path = self._get_db_path(user_id)
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    def save_user_credentials(self, user_id: str, credentials: Credentials) -> bool:
        """Save user's GSC credentials to database."""
        try:
            self._init_gsc_tables(user_id)
            db_path = self._get_db_path(user_id)
            
            if not self.client_config:
                logger.error("Cannot save credentials: Client configuration not loaded")
                return False
            
            web_config = self.client_config.get('web', {})
            
            credentials_json = json.dumps({
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri or web_config.get('token_uri'),
                'client_id': credentials.client_id or web_config.get('client_id'),
                'client_secret': credentials.client_secret or web_config.get('client_secret'),
                'scopes': credentials.scopes
            })
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO gsc_credentials 
                    (user_id, credentials_json, updated_at) 
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                ''', (user_id, credentials_json))
                conn.commit()
            
            logger.info(f"GSC credentials saved for user: {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving GSC credentials for user {user_id}: {e}")
            return False
    
    def load_user_credentials(self, user_id: str) -> Optional[Credentials]:
        """Load user's GSC credentials from database."""
        try:
            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                return None
                
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gsc_credentials'")
                if not cursor.fetchone():
                    return None
                    
                cursor.execute('''
                    SELECT credentials_json FROM gsc_credentials 
                    WHERE user_id = ?
                ''', (user_id,))
                
                result = cursor.fetchone()
                if not result:
                    return None
                
                credentials_data = json.loads(result[0])
                
                required_fields = ['token_uri', 'client_id', 'client_secret']
                missing_fields = [field for field in required_fields if not credentials_data.get(field)]
                
                if missing_fields:
                    logger.warning(f"GSC credentials for user {user_id} missing required fields: {missing_fields}")
                    return None
                
                credentials = Credentials.from_authorized_user_info(credentials_data, self.scopes)
                
                if credentials.expired:
                    if credentials.refresh_token:
                        try:
                            credentials.refresh(GoogleRequest())
                            self.save_user_credentials(user_id, credentials)
                        except Exception as e:
                            logger.error(f"Failed to refresh GSC token for user {user_id}: {e}")
                            self.clear_incomplete_credentials(user_id)
                            return None
                    else:
                        logger.warning(f"GSC token expired for user {user_id} but no refresh token available - user needs to re-authorize")
                        self.clear_incomplete_credentials(user_id)
                        return None
                
                return credentials
                
        except Exception as e:
            logger.error(f"Error loading GSC credentials for user {user_id}: {e}")
            return None
    
    def get_oauth_url(self, user_id: str) -> str:
        """Get OAuth authorization URL for GSC."""
        try:
            logger.info(f"Generating OAuth URL for user: {user_id}")
            
            # Retry loading config if missing (in case .env was added later)
            if not self.client_config:
                self.client_config = self._load_client_config()

            if not self.client_config:
                raise FileNotFoundError("GSC credentials not found in file or environment variables.")
            
            redirect_uri = os.getenv('GSC_REDIRECT_URI', 'http://localhost:8000/gsc/callback')
            
            flow = Flow.from_client_config(
                self.client_config,
                scopes=self.scopes,
                redirect_uri=redirect_uri,
                autogenerate_code_verifier=False,
            )

            random_state = secrets.token_urlsafe(32)
            state = f"{user_id}:{random_state}"
            
            authorization_url, _ = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                prompt='consent',
                state=state
            )
            
            # Ensure the per-user schema exists (Alembic-owned) before storing
            # the OAuth state, so state storage and the callback lookup resolve
            # to the same file.
            self._init_gsc_tables(user_id)
            db_path = self._get_db_path(user_id)
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO gsc_oauth_states (state, user_id) 
                    VALUES (?, ?)
                ''', (state, user_id))
                conn.commit()
            
            logger.info(f"OAuth URL generated successfully for user: {user_id}")
            return authorization_url
            
        except Exception as e:
            logger.error(f"Error generating OAuth URL for user {user_id}: {e}")
            raise

    def handle_oauth_callback(self, authorization_code: str, state: str) -> bool:
        """Handle OAuth callback and save credentials."""
        try:
            logger.info(f"Handling GSC OAuth callback with state: {state[:20]}...")
            
            if ':' not in state:
                logger.error(f"Invalid GSC state format: {state}")
                return False
                
            user_id = state.split(':')[0]
            db_path = self._get_db_path(user_id)
            
            if not os.path.exists(db_path):
                logger.error(f"User database not found for user {user_id}")
                return False

            # Verify state in user's DB (best effort — if missing, attempt code exchange anyway)
            state_valid = False
            try:
                with sqlite3.connect(db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute('SELECT user_id FROM gsc_oauth_states WHERE state = ?', (state,))
                    state_valid = cursor.fetchone() is not None
            except Exception as state_err:
                logger.warning(f"State verification query failed, proceeding anyway: {state_err}")

            if not state_valid:
                logger.warning(f"GSC OAuth state not found in DB for user {user_id} — will attempt code exchange without state verification")

            if not self.client_config:
                logger.error("Cannot handle callback: Client configuration not loaded")
                return False

            flow = Flow.from_client_config(
                self.client_config,
                scopes=self.scopes,
                redirect_uri=os.getenv('GSC_REDIRECT_URI', 'http://localhost:8000/gsc/callback'),
                autogenerate_code_verifier=False,
            )
            
            flow.fetch_token(code=authorization_code)
            credentials = flow.credentials

            if not credentials or not credentials.token:
                logger.error(f"Token exchange returned empty credentials for user {user_id}")
                return False
            
            # Clean up state if it was valid
            if state_valid:
                try:
                    with sqlite3.connect(db_path) as conn:
                        cursor = conn.cursor()
                        cursor.execute('DELETE FROM gsc_oauth_states WHERE state = ?', (state,))
                        conn.commit()
                except Exception as cleanup_err:
                    logger.warning(f"Failed to clean up OAuth state: {cleanup_err}")
            
            result = self.save_user_credentials(user_id, credentials)
            if result:
                logger.info(f"GSC OAuth callback succeeded for user {user_id} (state_valid={state_valid})")
            else:
                logger.error(f"GSC OAuth callback: token exchange succeeded but failed to save credentials for user {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error handling GSC OAuth callback for user {user_id if 'user_id' in dir() else 'unknown'}: {e}")
            return False

    
    def get_authenticated_service(self, user_id: str):
        """Get authenticated GSC service for user."""
        try:
            credentials = self.load_user_credentials(user_id)
            if not credentials:
                raise ValueError("No valid credentials found")
            
            # Disable discovery file cache (suppress oauth2client file_cache warnings) with safe fallback
            try:
                service = build('searchconsole', 'v1', credentials=credentials, cache_discovery=False)
            except TypeError:
                service = build('searchconsole', 'v1', credentials=credentials)
            logger.info(f"Authenticated GSC service created for user: {user_id}")
            return service
        
        except ValueError as e:
            # Log as warning only, as this is expected for unconnected users
            # logger.warning(f"Cannot create GSC service for user {user_id}: {e}")
            raise e
        except Exception as e:
            logger.error(f"Error creating authenticated GSC service for user {user_id}: {e}")
            raise
    
    def get_site_list(self, user_id: str) -> List[Dict[str, Any]]:
        """Get list of sites from GSC."""
        try:
            try:
                service = self.get_authenticated_service(user_id)
            except ValueError:
                # User not connected or credentials invalid
                # logger.warning(f"User {user_id} not connected to GSC. Returning empty site list.")
                return []
            except Exception as e:
                logger.warning(f"Failed to get authenticated service for {user_id}: {e}")
                return []

            if not service:
                 return []

            sites = service.sites().list().execute()
            
            site_list = []
            if 'siteEntry' in sites:
                for site in sites.get('siteEntry', []):
                    site_list.append({
                        'siteUrl': site.get('siteUrl'),
                        'permissionLevel': site.get('permissionLevel')
                    })
            
            logger.info(f"Retrieved {len(site_list)} sites for user: {user_id}")
            return site_list
            
        except Exception as e:
            logger.error(f"Error getting site list for user {user_id}: {e}")
            # Return empty list instead of raising to prevent frontend 500s
            return []
    
    def _calculate_previous_period(self, start_date: str, end_date: str):
        """Calculate previous period date window matching current range length."""
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            window_days = max((end_dt - start_dt).days + 1, 1)
            prev_end = start_dt - timedelta(days=1)
            prev_start = prev_end - timedelta(days=window_days - 1)
            return prev_start.strftime("%Y-%m-%d"), prev_end.strftime("%Y-%m-%d")
        except Exception:
            return None, None

    def get_search_analytics(self, user_id: str, site_url: str, 
                           start_date: str = None, end_date: str = None) -> Dict[str, Any]:
        """Get search analytics data from GSC."""
        try:
            # Normalize site_url: some callers pass the full GSC site resource dict
            # ({'siteUrl': ..., 'permissionLevel': ...}) instead of the URL string,
            # which breaks both the API call and DB caching.
            if isinstance(site_url, dict):
                site_url = (
                    site_url.get('siteUrl')
                    or site_url.get('site_url')
                    or next(iter(site_url.values()), None)
                )
                logger.warning(f"get_search_analytics received dict for site_url; extracted: {site_url}")
            if not isinstance(site_url, str):
                site_url = str(site_url) if site_url else ''

            # Set default date range (last 30 days)
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            if not start_date:
                start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            
            # Check cache first (only return cached data with non-empty query rows)
            cache_key = f"{user_id}_{site_url}_{start_date}_{end_date}"
            cached_data = self._get_cached_data(user_id, site_url, 'analytics', cache_key)
            if cached_data and isinstance(cached_data, dict):
                has_pages = 'page_data' in cached_data and isinstance(cached_data.get('page_data'), dict)
                has_queries = 'query_data' in cached_data and isinstance(cached_data.get('query_data'), dict)
                has_query_rows = cached_data.get('query_data', {}).get('rows', [])
                if has_pages and has_queries and has_query_rows:
                    logger.info(f"Returning cached analytics data for user: {user_id} (includes page_data, {len(has_query_rows)} query rows)")
                    return cached_data
            
            try:
                service = self.get_authenticated_service(user_id)
            except ValueError:
                logger.warning(f"User {user_id} not connected to GSC. Returning empty analytics.")
                return {'error': 'User not connected to GSC', 'rows': [], 'rowCount': 0}

            if not service:
                logger.error(f"Failed to get authenticated GSC service for user: {user_id}")
                return {'error': 'Authentication failed', 'rows': [], 'rowCount': 0}
            
            # Step 1: Verify data presence first (as per GSC API documentation)
            verification_request = {
                'startDate': start_date,
                'endDate': end_date,
                'dimensions': ['date']  # Only date dimension for verification
            }
            
            logger.info(f"GSC Data verification request for user {user_id}: {verification_request}")
            
            try:
                verification_response = service.searchanalytics().query(
                    siteUrl=site_url,
                    body=verification_request
                ).execute()
                
                logger.info(f"GSC Data verification response for user {user_id}: {verification_response}")
                
                # Check if we have any data
                verification_rows = verification_response.get('rows', [])
                if not verification_rows:
                    logger.warning(f"No GSC data available for user {user_id} in date range {start_date} to {end_date}")
                    return {'error': 'No data available for this date range', 'rows': [], 'rowCount': 0}
                
                logger.info(f"GSC Data verification successful - found {len(verification_rows)} days with data")
                
            except Exception as verification_error:
                logger.error(f"GSC Data verification failed for user {user_id}: {verification_error}")
                return {'error': f'Data verification failed: {str(verification_error)}', 'rows': [], 'rowCount': 0}
            
            # Step 2: Get daily metrics for charting (ensure we have rows)
            request = {
                'startDate': start_date,
                'endDate': end_date,
                'dimensions': ['date'],  # Use date dimension to get time-series data
                'rowLimit': 1000
            }
            
            logger.info(f"GSC API request for user {user_id}: {request}")
            
            try:
                response = service.searchanalytics().query(
                    siteUrl=site_url,
                    body=request
                ).execute()
                
                logger.info(f"GSC API response for user {user_id}: {response}")
            except Exception as api_error:
                logger.error(f"GSC API call failed for user {user_id}: {api_error}")
                return {'error': str(api_error), 'rows': [], 'rowCount': 0}
            
            # Step 3: Get query-level data for insights (as per documentation)
            query_request = {
                'startDate': start_date,
                'endDate': end_date,
                'dimensions': ['query'],  # Get query-level data
                'rowLimit': 1000
            }
            
            logger.info(f"GSC Query-level request for user {user_id}: {query_request}")
            
            try:
                query_response = service.searchanalytics().query(
                    siteUrl=site_url,
                    body=query_request
                ).execute()
                
                logger.info(f"GSC Query-level response for user {user_id}: {query_response}")

                # Step 4: Get page-level data for top pages insights
                page_request = {
                    'startDate': start_date,
                    'endDate': end_date,
                    'dimensions': ['page'],  # Get page-level data
                    'rowLimit': 1000
                }
                logger.info(f"GSC Page-level request for user {user_id}: {page_request}")
                page_rows = []
                page_row_count = 0
                try:
                    page_response = service.searchanalytics().query(
                        siteUrl=site_url,
                        body=page_request
                    ).execute()
                    logger.info(f"GSC Page-level response for user {user_id}: {page_response}")
                    page_rows = page_response.get('rows', [])
                    page_row_count = page_response.get('rowCount', 0)
                except Exception as page_error:
                    logger.warning(f"GSC Page-level request failed for user {user_id}: {page_error}")
                    page_rows = []
                    page_row_count = 0

                # Step 5: Get query+page combined data for mapping queries to pages
                qp_rows = []
                qp_row_count = 0
                try:
                    qp_request = {
                        'startDate': start_date,
                        'endDate': end_date,
                        'dimensions': ['query', 'page'],
                        'rowLimit': 1000
                    }
                    logger.info(f"GSC Query+Page request for user {user_id}: {qp_request}")
                    qp_response = service.searchanalytics().query(
                        siteUrl=site_url,
                        body=qp_request
                    ).execute()
                    logger.info(f"GSC Query+Page response for user {user_id}: {qp_response}")
                    qp_rows = qp_response.get('rows', [])
                    qp_row_count = qp_response.get('rowCount', 0)
                except Exception as qp_error:
                    logger.warning(f"GSC Query+Page request failed for user {user_id}: {qp_error}")
                    qp_rows = []
                    qp_row_count = 0

                # Optional previous-period windows for opportunity trend detection
                prev_query_rows = []
                prev_page_rows = []
                prev_start_date, prev_end_date = self._calculate_previous_period(start_date, end_date)
                if prev_start_date and prev_end_date:
                    try:
                        prev_query_request = {
                            'startDate': prev_start_date,
                            'endDate': prev_end_date,
                            'dimensions': ['query'],
                            'rowLimit': 1000
                        }
                        prev_query_response = service.searchanalytics().query(
                            siteUrl=site_url,
                            body=prev_query_request
                        ).execute()
                        prev_query_rows = prev_query_response.get('rows', [])
                    except Exception as prev_query_error:
                        logger.warning(f"GSC previous query request failed for user {user_id}: {prev_query_error}")

                    try:
                        prev_page_request = {
                            'startDate': prev_start_date,
                            'endDate': prev_end_date,
                            'dimensions': ['page'],
                            'rowLimit': 1000
                        }
                        prev_page_response = service.searchanalytics().query(
                            siteUrl=site_url,
                            body=prev_page_request
                        ).execute()
                        prev_page_rows = prev_page_response.get('rows', [])
                    except Exception as prev_page_error:
                        logger.warning(f"GSC previous page request failed for user {user_id}: {prev_page_error}")

                # Combine overall, query, page and query+page data
                analytics_data = {
                    'overall_metrics': {
                        'rows': response.get('rows', []),
                        'rowCount': response.get('rowCount', 0)
                    },
                    'query_data': {
                        'rows': query_response.get('rows', []),
                        'rowCount': query_response.get('rowCount', 0)
                    },
                    'page_data': {
                        'rows': page_rows,
                        'rowCount': page_row_count
                    },
                    'query_page_data': {
                        'rows': qp_rows,
                        'rowCount': qp_row_count
                    },
                    'previous_period': {
                        'startDate': prev_start_date,
                        'endDate': prev_end_date,
                        'query_data': {'rows': prev_query_rows, 'rowCount': len(prev_query_rows)},
                        'page_data': {'rows': prev_page_rows, 'rowCount': len(prev_page_rows)}
                    },
                    'verification_data': {
                        'rows': verification_rows,
                        'rowCount': len(verification_rows)
                    },
                    'startDate': start_date,
                    'endDate': end_date,
                    'siteUrl': site_url
                }
                
                if analytics_data.get('query_data', {}).get('rows'):
                    self._cache_data(user_id, site_url, 'analytics', analytics_data, cache_key)
                    logger.info(f"Analytics data cached for user: {user_id}, site: {site_url} ({len(analytics_data.get('query_data', {}).get('rows', []))} query rows)")
                else:
                    logger.info(f"Skipping cache for user: {user_id} — empty query_data rows; next request will retry fresh")
                
                logger.info(f"Retrieved comprehensive analytics data for user: {user_id}, site: {site_url}")
                return analytics_data
                
            except Exception as query_error:
                logger.error(f"GSC Query-level request failed for user {user_id}: {query_error}")
                # Fall back to overall metrics only
                analytics_data = {
                    'overall_metrics': {
                        'rows': response.get('rows', []),
                        'rowCount': response.get('rowCount', 0)
                    },
                    'query_data': {'rows': [], 'rowCount': 0},
                    'page_data': {'rows': [], 'rowCount': 0},
                    'query_page_data': {'rows': [], 'rowCount': 0},
                    'previous_period': {
                        'startDate': None,
                        'endDate': None,
                        'query_data': {'rows': [], 'rowCount': 0},
                        'page_data': {'rows': [], 'rowCount': 0}
                    },
                    'verification_data': {
                        'rows': verification_rows,
                        'rowCount': len(verification_rows)
                    },
                    'startDate': start_date,
                    'endDate': end_date,
                    'siteUrl': site_url,
                    'warning': f'Query-level data unavailable: {str(query_error)}'
                }
                
                logger.info(f"Query-level data unavailable for user {user_id}; fallback analytics returned (not cached)")
                return analytics_data
            
        except Exception as e:
            logger.error(f"Error getting search analytics for user {user_id}: {e}")
            raise
    
    def get_sitemaps(self, user_id: str, site_url: str) -> List[Dict[str, Any]]:
        """Get sitemaps from GSC."""
        try:
            service = self.get_authenticated_service(user_id)
            response = service.sitemaps().list(siteUrl=site_url).execute()
            
            sitemaps = []
            for sitemap in response.get('sitemap', []):
                sitemaps.append({
                    'path': sitemap.get('path'),
                    'lastSubmitted': sitemap.get('lastSubmitted'),
                    'contents': sitemap.get('contents', [])
                })
            
            logger.info(f"Retrieved {len(sitemaps)} sitemaps for user: {user_id}, site: {site_url}")
            return sitemaps
            
        except Exception as e:
            logger.error(f"Error getting sitemaps for user {user_id}: {e}")
            raise
    
    def revoke_user_access(self, user_id: str) -> bool:
        """Revoke user's GSC access."""
        try:
            self._init_gsc_tables(user_id)
            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                return True
                
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                
                # Delete credentials
                cursor.execute('DELETE FROM gsc_credentials WHERE user_id = ?', (user_id,))
                
                # Delete cached data
                cursor.execute('DELETE FROM gsc_data_cache WHERE user_id = ?', (user_id,))
                
                # Delete OAuth states
                cursor.execute('DELETE FROM gsc_oauth_states WHERE user_id = ?', (user_id,))
                
                conn.commit()
            
            logger.info(f"GSC access revoked for user: {user_id}")
            analytics_cache.invalidate('platform_status', user_id)
            return True
            
        except Exception as e:
            logger.error(f"Error revoking GSC access for user {user_id}: {e}")
            return False
    
    def clear_incomplete_credentials(self, user_id: str) -> bool:
        """Clear incomplete GSC credentials that are missing required fields."""
        try:
            self._init_gsc_tables(user_id)
            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                return True
                
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM gsc_credentials WHERE user_id = ?', (user_id,))
                cursor.execute('DELETE FROM gsc_data_cache WHERE user_id = ?', (user_id,))
                cursor.execute('DELETE FROM gsc_oauth_states WHERE user_id = ?', (user_id,))
                conn.commit()
            
            logger.info(f"Cleared incomplete GSC credentials for user: {user_id}")
            analytics_cache.invalidate('platform_status', user_id)
            return True
            
        except Exception as e:
            logger.error(f"Error clearing incomplete credentials for user {user_id}: {e}")
            return False
    
    def _get_cached_data(self, user_id: str, site_url: str, data_type: str, cache_key: str) -> Optional[Dict]:
        """Get cached data if not expired."""
        try:
            db_path = self._get_db_path(user_id)
            if not os.path.exists(db_path):
                return None
                
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT data_json FROM gsc_data_cache 
                    WHERE user_id = ? AND site_url = ? AND data_type = ? 
                    AND expires_at > CURRENT_TIMESTAMP
                ''', (user_id, site_url, data_type))
                
                result = cursor.fetchone()
                if result:
                    return json.loads(result[0])
                return None
                
        except Exception as e:
            logger.error(f"Error getting cached data: {e}")
            return None
    
    def _cache_data(self, user_id: str, site_url: str, data_type: str, data: Dict, cache_key: str):
        """Cache data with expiration."""
        try:
            self._init_gsc_tables(user_id)
            db_path = self._get_db_path(user_id)
            
            expires_at = datetime.now() + timedelta(hours=1)  # Cache for 1 hour
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO gsc_data_cache 
                    (user_id, site_url, data_type, data_json, expires_at) 
                    VALUES (?, ?, ?, ?, ?)
                ''', (user_id, site_url, data_type, json.dumps(data), expires_at))
                conn.commit()
            
            logger.info(f"Data cached for user: {user_id}, type: {data_type}")
            
        except Exception as e:
            logger.error(f"Error caching data: {e}")

"""
Google Search Console Analytics Handler

Handles GSC analytics data retrieval and processing.
"""

from typing import Dict, Any
from datetime import datetime, timedelta
from loguru import logger

from services.gsc_service import GSCService
from ...analytics_cache_service import analytics_cache
from ..models.analytics_data import AnalyticsData
from ..models.platform_types import PlatformType
from .base_handler import BaseAnalyticsHandler


class GSCAnalyticsHandler(BaseAnalyticsHandler):
    """Handler for Google Search Console analytics"""
    
    def __init__(self):
        super().__init__(PlatformType.GSC)
        self.gsc_service = GSCService()
    
    async def get_analytics(self, user_id: str, target_url: str = None, start_date: str = None, end_date: str = None, **kwargs) -> AnalyticsData:
        """
        Get Google Search Console analytics data with caching
        
        Args:
            user_id: User ID to get analytics for
            target_url: Optional URL to prefer when selecting GSC site
            
        Returns comprehensive SEO metrics including clicks, impressions, CTR, and position data.
        """
        self.log_analytics_request(user_id, "get_analytics")
        
        # Check cache first - GSC API calls can be expensive
        # Include target_url and date range in cache key if provided
        cache_key_parts = [user_id]
        if target_url:
            cache_key_parts.append(str(target_url))
        if start_date:
            cache_key_parts.append(str(start_date))
        if end_date:
            cache_key_parts.append(str(end_date))
        # Bump cache version to include page insights (v2)
        cache_key = "_".join(cache_key_parts + ['v2pages'])
        cached_data = analytics_cache.get('gsc_analytics', cache_key)
        if cached_data:
            logger.info("Using cached GSC analytics for user {user_id}", user_id=user_id)
            return AnalyticsData(**cached_data)
        
        logger.info("Fetching fresh GSC analytics for user {user_id}", user_id=user_id)
        try:
            # Get user's sites
            try:
                sites = self.gsc_service.get_site_list(user_id)
            except Exception as e:
                logger.warning(f"GSC site list fetch failed for user {user_id}: {e}")
                sites = []

            # logger.info(f"GSC Sites found for user {user_id}: {sites}")
            if not sites:
                logger.warning(f"No GSC sites found for user {user_id} — failing fast")
                return self.create_error_response("No Google Search Console sites found for this account. Add a property in Google Search Console first.")
            
            # Select site: Prefer target_url match, otherwise first site
            selected_site = sites[0]
            if target_url:
                logger.info(f"Attempting to match target URL: {target_url}")
                # Normalize target URL (remove protocol, trailing slash)
                normalized_target = target_url.replace('https://', '').replace('http://', '').rstrip('/')
                
                for site in sites:
                    site_url = site['siteUrl']
                    normalized_site = site_url.replace('https://', '').replace('http://', '').rstrip('/')
                    
                    if normalized_target in normalized_site or normalized_site in normalized_target:
                        selected_site = site
                        logger.info(f"Found matching GSC site: {site_url}")
                        break
            
            site_url = selected_site['siteUrl']
            logger.info(f"Using GSC site URL: {site_url}")
            
            # Determine date range (defaults to last 30 days)
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            if not start_date:
                start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            logger.info(f"GSC Date range: {start_date} to {end_date}")
            
            search_analytics = self.gsc_service.get_search_analytics(
                user_id=user_id,
                site_url=site_url,
                start_date=start_date,
                end_date=end_date
            )
            logger.info(f"GSC Search analytics retrieved for user {user_id}")
            
            # Process GSC data into standardized format
            processed_metrics = self._process_gsc_metrics(search_analytics)
            
            result = self.create_success_response(metrics=processed_metrics, date_range={'start': start_date, 'end': end_date})
            
            # Cache the result to avoid expensive API calls
            analytics_cache.set('gsc_analytics', cache_key, result.__dict__)
            logger.info("Cached GSC analytics data for user {user_id}", user_id=user_id)
            
            return result
            
        except Exception as e:
            self.log_analytics_error(user_id, "get_analytics", e)
            error_result = self.create_error_response(str(e))
            
            # Cache error result briefly to avoid repeated failures but allow quick recovery
            analytics_cache.set('gsc_analytics', cache_key, error_result.__dict__, ttl_override=30)  # 30 seconds
            return error_result
    
    def get_connection_status(self, user_id: str) -> Dict[str, Any]:
        """Get GSC connection status"""
        self.log_analytics_request(user_id, "get_connection_status")
        
        try:
            sites = self.gsc_service.get_site_list(user_id)
            return {
                'connected': len(sites) > 0,
                'sites_count': len(sites),
                'sites': sites[:3] if sites else [],  # Show first 3 sites
                'error': None
            }
        except Exception as e:
            # self.log_analytics_error(user_id, "get_connection_status", e)
            return {
                'connected': False,
                'sites_count': 0,
                'sites': [],
                'error': str(e)
            }
    
    def _process_gsc_metrics(self, search_analytics: Dict[str, Any]) -> Dict[str, Any]:
        """Process GSC raw data into standardized metrics"""
        try:
            # Debug: Log the raw search analytics data structure
            logger.info(f"GSC Raw search analytics structure: {search_analytics}")
            logger.info(f"GSC Raw search analytics keys: {list(search_analytics.keys())}")
            
            # Handle new data structure with overall_metrics and query_data
            if 'overall_metrics' in search_analytics:
                # New structure from updated GSC service
                overall_rows = search_analytics.get('overall_metrics', {}).get('rows', [])
                query_rows = search_analytics.get('query_data', {}).get('rows', [])
                
                # Calculate totals from overall_rows (most accurate as it includes anonymized queries)
                total_clicks = 0
                total_impressions = 0
                total_position = 0
                valid_position_rows = 0
                
                # Use overall_rows for totals if available, otherwise fallback to query_rows
                calc_rows = overall_rows if overall_rows else query_rows
                
                for row in calc_rows:
                    clicks = row.get('clicks', 0)
                    impressions = row.get('impressions', 0)
                    position = row.get('position', 0)
                    
                    total_clicks += clicks
                    total_impressions += impressions
                    
                    if position and position > 0:
                        total_position += position * impressions  # Weighted average
                
                # Calculate weighted average position
                avg_position = total_position / total_impressions if total_impressions > 0 else 0
                avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
                
                # Use query_rows for top queries list
                top_queries_source = query_rows
                
            else:
                # Legacy structure
                rows = search_analytics.get('rows', [])
                # ... existing legacy logic ...
                calc_rows = rows
                top_queries_source = rows
                
                total_clicks = 0
                total_impressions = 0
                total_position = 0
                valid_position_rows = 0
                
                for row in calc_rows:
                    clicks = row.get('clicks', 0)
                    impressions = row.get('impressions', 0)
                    position = row.get('position', 0)
                    
                    total_clicks += clicks
                    total_impressions += impressions
                    
                    if position and position > 0:
                         # Simple average for legacy/unknown structure if we can't do weighted
                        total_position += position
                        valid_position_rows += 1
                
                avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
                avg_position = total_position / valid_position_rows if valid_position_rows > 0 else 0

            
            # Get top performing queries
            top_queries = []
            if top_queries_source:
                # Sort by clicks
                sorted_queries = sorted(top_queries_source, key=lambda x: x.get('clicks', 0), reverse=True)[:10]
                
                for row in sorted_queries:
                    clicks_val = row.get('clicks', 0) or 0
                    impr_val = row.get('impressions', 0) or 0
                    raw_ctr = row.get('ctr', None)
                    # Calculate CTR% robustly even if 'ctr' field is missing in row
                    if raw_ctr is not None:
                        ctr_percent = round(float(raw_ctr) * 100, 2)
                    else:
                        ctr_percent = round(((clicks_val / impr_val) * 100), 2) if impr_val > 0 else 0.0
                    top_queries.append({
                        'query': self._extract_query_from_row(row),
                        'clicks': clicks_val,
                        'impressions': impr_val,
                        'ctr': ctr_percent,
                        'position': round(row.get('position', 0) or 0, 2)
                    })

            # Prepare Top Pages from page_data when available
            top_pages = []
            try:
                page_rows = search_analytics.get('page_data', {}).get('rows', [])
                qp_rows = search_analytics.get('query_page_data', {}).get('rows', [])
                # Build queries-by-page map
                queries_by_page: Dict[str, list] = {}
                if qp_rows:
                    for r in qp_rows:
                        keys = r.get('keys', [])
                        if not keys or len(keys) < 2:
                            continue
                        query_key = keys[0]['keys'][0] if isinstance(keys[0], dict) else str(keys[0])
                        page_key = keys[1]['keys'][0] if isinstance(keys[1], dict) else str(keys[1])
                        clicks_val = r.get('clicks', 0) or 0
                        impr_val = r.get('impressions', 0) or 0
                        raw_ctr = r.get('ctr', None)
                        if raw_ctr is not None:
                            ctr_percent = round(float(raw_ctr) * 100, 2)
                        else:
                            ctr_percent = round(((clicks_val / impr_val) * 100), 2) if impr_val > 0 else 0.0
                        lst = queries_by_page.setdefault(page_key, [])
                        lst.append({
                            'query': query_key,
                            'clicks': clicks_val,
                            'impressions': impr_val,
                            'ctr': ctr_percent,
                        })
                if page_rows:
                    sorted_pages = sorted(page_rows, key=lambda x: x.get('clicks', 0), reverse=True)[:10]
                    for row in sorted_pages:
                        clicks_val = row.get('clicks', 0) or 0
                        impr_val = row.get('impressions', 0) or 0
                        raw_ctr = row.get('ctr', None)
                        if raw_ctr is not None:
                            ctr_percent = round(float(raw_ctr) * 100, 2)
                        else:
                            ctr_percent = round(((clicks_val / impr_val) * 100), 2) if impr_val > 0 else 0.0
                        page_url = self._extract_page_from_row(row)
                        # attach top queries pointing to this page, sorted by clicks
                        page_queries = sorted(queries_by_page.get(page_url, []), key=lambda x: x.get('clicks', 0), reverse=True)[:5]
                        top_pages.append({
                            'page': page_url,
                            'clicks': clicks_val,
                            'impressions': impr_val,
                            'ctr': ctr_percent,
                            'position': round(row.get('position', 0) or 0, 2) if 'position' in row else None,
                            'queries': page_queries
                        })
            except Exception as e:
                logger.warning(f"Failed processing top_pages: {e}")

            # Detect Cannibalization (query mapping to multiple pages)
            cannibalization = []
            try:
                qp_rows = search_analytics.get('query_page_data', {}).get('rows', [])
                q_rows = search_analytics.get('query_data', {}).get('rows', [])
                if qp_rows:
                    # Determine window days for thresholding
                    from datetime import datetime
                    start_s = search_analytics.get('startDate')
                    end_s = search_analytics.get('endDate')
                    window_days = 30
                    try:
                        if start_s and end_s:
                            sd = datetime.strptime(start_s, "%Y-%m-%d")
                            ed = datetime.strptime(end_s, "%Y-%m-%d")
                            window_days = max((ed - sd).days + 1, 1)
                    except Exception:
                        pass
                    min_clicks = 10 if window_days <= 7 else (30 if window_days <= 30 else 60)
                    # Build map: query -> { page -> metrics }
                    by_query: Dict[str, Dict[str, Dict[str, float]]] = {}
                    for r in qp_rows:
                        keys = r.get('keys', [])
                        if not keys or len(keys) < 2:
                            continue
                        qk = keys[0]['keys'][0] if isinstance(keys[0], dict) else str(keys[0])
                        pk = keys[1]['keys'][0] if isinstance(keys[1], dict) else str(keys[1])
                        clicks_val = float(r.get('clicks', 0) or 0)
                        impr_val = float(r.get('impressions', 0) or 0)
                        raw_ctr = r.get('ctr', None)
                        if raw_ctr is not None:
                            ctr_percent = float(raw_ctr) * 100.0
                        else:
                            ctr_percent = (clicks_val / impr_val * 100.0) if impr_val > 0 else 0.0
                        pos_val = float(r.get('position', 0) or 0)
                        by_query.setdefault(qk, {}).setdefault(pk, {"clicks": 0.0, "impressions": 0.0, "ctr": 0.0, "position_sum": 0.0, "position_count": 0.0})
                        agg = by_query[qk][pk]
                        agg["clicks"] += clicks_val
                        agg["impressions"] += impr_val
                        agg["ctr"] = max(agg["ctr"], ctr_percent)
                        if pos_val > 0:
                            agg["position_sum"] += pos_val
                            agg["position_count"] += 1
                    # Use query totals for context
                    total_by_query: Dict[str, Dict[str, float]] = {}
                    for r in q_rows or []:
                        qk = self._extract_query_from_row(r)
                        total_by_query[qk] = {
                            "clicks": float(r.get('clicks', 0) or 0),
                            "impressions": float(r.get('impressions', 0) or 0),
                            "position": float(r.get('position', 0) or 0)
                        }
                    for qk, pages_map in by_query.items():
                        if len(pages_map) < 2:
                            continue
                        total_clicks = sum(p["clicks"] for p in pages_map.values())
                        if total_clicks < min_clicks:
                            continue
                        qpos = total_by_query.get(qk, {}).get("position", 0.0)
                        if not (3.0 <= qpos <= 20.0) and qpos != 0.0:
                            # Skip queries already ranking very well or very poorly (if pos present)
                            continue
                        pages_list = []
                        for pk, m in pages_map.items():
                            avg_pos = (m["position_sum"] / m["position_count"]) if m["position_count"] > 0 else 0.0
                            pages_list.append({
                                "page": pk,
                                "clicks": round(m["clicks"], 0),
                                "impressions": round(m["impressions"], 0),
                                "ctr": round(m["ctr"], 2),
                                "position": round(avg_pos, 2) if avg_pos > 0 else None
                            })
                        pages_list.sort(key=lambda x: x.get("clicks", 0), reverse=True)
                        target_page = pages_list[0]["page"] if pages_list else None
                        cannibalization.append({
                            "query": qk,
                            "total_clicks": int(round(total_clicks)),
                            "recommended_target_page": target_page,
                            "pages": pages_list[:3]
                        })
                    # Sort by impact
                    cannibalization.sort(key=lambda item: item.get("total_clicks", 0), reverse=True)
                    cannibalization = cannibalization[:10]
            except Exception as e:
                logger.warning(f"Failed computing cannibalization: {e}")
            
            return {
                'connection_status': 'connected',
                'connected_sites': 1,
                'total_clicks': total_clicks,
                'total_impressions': total_impressions,
                'avg_ctr': round(avg_ctr, 2),
                'avg_position': round(avg_position, 2),
                'total_queries': len(top_queries_source) if top_queries_source else 0,
                'top_queries': top_queries,
                'top_pages': top_pages,
                'cannibalization': cannibalization
            }
            
        except Exception as e:
            logger.error(f"Error processing GSC metrics: {e}")
            raise  # fail fast — let caller create a proper error response
    
    def _extract_query_from_row(self, row: Dict[str, Any]) -> str:
        """Extract query text from GSC API row data"""
        try:
            keys = row.get('keys', [])
            if keys and len(keys) > 0:
                first_key = keys[0]
                if isinstance(first_key, dict):
                    return first_key.get('keys', [''])[0]
                else:
                    return str(first_key)
            raise ValueError(f"No 'keys' field in GSC row: {row}")
        except Exception as e:
            logger.error(f"Error extracting query from row: {e}")
            raise

    def _extract_page_from_row(self, row: Dict[str, Any]) -> str:
        """Extract page URL from GSC API row data"""
        try:
            keys = row.get('keys', [])
            if keys and len(keys) > 0:
                first_key = keys[0]
                if isinstance(first_key, dict):
                    return first_key.get('keys', [''])[0]
                else:
                    return str(first_key)
            raise ValueError(f"No 'keys' field in GSC row: {row}")
        except Exception as e:
            logger.error(f"Error extracting page from row: {e}")
            raise

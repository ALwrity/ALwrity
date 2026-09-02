"""
Deep Crawl Service for Onboarding Step 3
Handles deep crawling of user's website, combining Sitemap and Tavily data.
"""

import os
import asyncio
import httpx
from typing import Dict, List, Any, Optional
from datetime import datetime
from loguru import logger
from urllib.parse import urlparse

from services.seo_tools.sitemap_service import SitemapService
from services.research.tavily_service import TavilyService
from services.database import get_session_for_user
from models.crawled_content import EndUserWebsiteContent
from models.website_analysis_monitoring_models import DeepWebsiteCrawlTask, DeepWebsiteCrawlExecutionLog

class DeepCrawlService:
    def __init__(self):
        self.sitemap_service = SitemapService()
        self.tavily_service = TavilyService()

    async def execute_deep_crawl(self, user_id: str, website_url: str, task_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Execute deep crawl for a user's website.
        
        1. Fetch URLs from Sitemap.
        2. Crawl using Tavily.
        3. Deduplicate URLs.
        4. Check liveness (status code).
        5. Save content to DB and File.
        """
        logger.info(f"Starting deep crawl for {website_url} (User: {user_id})")
        
        execution_start = datetime.utcnow()
        db = get_session_for_user(user_id)
        if not db:
            raise Exception("Database connection failed")

        try:
            # 1. Sitemap Discovery (SSOT first; discovery only when absent)
            sitemap_urls = set()
            try:
                from services.seo.sitemap_ssot import get_or_discover_sitemap_url
                sitemap_url = await get_or_discover_sitemap_url(
                    user_id, website_url, self.sitemap_service, db=db
                )
                if not sitemap_url:
                    sitemap_url = f"{website_url.rstrip('/')}/sitemap.xml"
                
                # Analyze sitemap to get URLs
                # We use analyze_sitemap directly to get raw URLs
                sitemap_data = await self.sitemap_service.analyze_sitemap(sitemap_url)
                
                for url_entry in sitemap_data.get("urls", []):
                    if isinstance(url_entry, dict) and "loc" in url_entry:
                        sitemap_urls.add(url_entry["loc"])
                
                logger.info(f"Found {len(sitemap_urls)} URLs from sitemap")
            except Exception as e:
                logger.warning(f"Sitemap analysis failed: {e}")

            # 2. Tavily Crawl
            tavily_urls = set()
            tavily_results = []
            try:
                # Use intelligent instructions
                instructions = "Find all blog posts, articles, and main content pages. Ignore login, signup, and admin pages."
                
                crawl_result = await self.tavily_service.crawl(
                    url=website_url,
                    limit=50, # Limit to avoid excessive costs/time
                    max_depth=2,
                    extract_depth="basic",
                    instructions=instructions
                )
                
                if crawl_result.get("success"):
                    for res in crawl_result.get("results", []):
                        url = res.get("url")
                        if url:
                            tavily_urls.add(url)
                            tavily_results.append(res)
                
                logger.info(f"Found {len(tavily_urls)} URLs from Tavily")

                # Track Tavily usage
                try:
                    from services.subscription import PricingService
                    from sqlalchemy import text
                    pricing_service = PricingService(db)
                    current_period = pricing_service.get_current_billing_period(user_id)
                    cost = 0.005  # Tavily crawl cost estimate

                    update_query = text("""
                        UPDATE usage_summaries 
                        SET tavily_calls = COALESCE(tavily_calls, 0) + 1,
                            tavily_cost = COALESCE(tavily_cost, 0) + :cost,
                            total_calls = COALESCE(total_calls, 0) + 1,
                            total_cost = COALESCE(total_cost, 0) + :cost
                        WHERE user_id = :user_id AND billing_period = :period
                    """)
                    db.execute(update_query, {
                        'cost': cost, 'user_id': user_id, 'period': current_period,
                    })
                    db.commit()
                    logger.info(f"[DeepCrawl] Tracked Tavily crawl usage: user={user_id}, cost=${cost}")
                except Exception as track_err:
                    logger.warning(f"[DeepCrawl] Failed to track Tavily usage: {track_err}")
            except Exception as e:
                logger.warning(f"Tavily crawl failed: {e}")

            # 3. Merge and Deduplicate
            all_urls = sitemap_urls.union(tavily_urls)
            unique_urls = list(all_urls)
            logger.info(f"Total unique URLs to process: {len(unique_urls)}")

            # 4. Process URLs (Liveness & Save)
            processed_count = 0
            success_count = 0
            
            # Create directory for documents if not exists
            # We'll save in workspace/{user_id}/crawled_content/
            # Note: Path logic should be consistent with project structure
            # Assuming workspace path is available via env or config, or constructing it.
            # Using relative path for now, adjusted to project root.
            # Database files are stored under workspace/workspace_{user_id}/db/.
            # So workspace root is workspace/workspace_{user_id}/
            workspace_dir = f"workspace/workspace_{user_id}/crawled_content"
            os.makedirs(workspace_dir, exist_ok=True)

            # Limit concurrent checks
            sem = asyncio.Semaphore(10)
            
            async def process_url(url):
                async with sem:
                    return await self._process_single_url(url, user_id, website_url, workspace_dir, tavily_results)

            tasks = [process_url(url) for url in unique_urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            processed_data = []
            
            # Save results to DB
            for res in results:
                if isinstance(res, dict):
                    processed_data.append(res)
                    if res.get("status_code") and 200 <= res.get("status_code") < 300:
                        success_count += 1
                        
                        # Save to DB
                        try:
                            existing = db.query(EndUserWebsiteContent).filter(
                                EndUserWebsiteContent.user_id == user_id,
                                EndUserWebsiteContent.url == res["url"]
                            ).first()
                            
                            if existing:
                                existing.content = res.get("content")
                                existing.title = res.get("title")
                                existing.status_code = res.get("status_code")
                                existing.crawled_at = datetime.utcnow()
                            else:
                                new_content = EndUserWebsiteContent(
                                    user_id=user_id,
                                    website_url=website_url,
                                    url=res["url"],
                                    title=res.get("title"),
                                    content=res.get("content"),
                                    status_code=res.get("status_code"),
                                    crawled_at=datetime.utcnow()
                                )
                                db.add(new_content)
                        except Exception as e:
                            logger.error(f"Failed to save content to DB for {res['url']}: {e}")
            
            db.commit()
            
            # 5. Update Task Log if task_id provided
            if task_id:
                log = DeepWebsiteCrawlExecutionLog(
                    task_id=task_id,
                    status="success",
                    result_data={
                        "total_urls": len(unique_urls),
                        "sitemap_urls": len(sitemap_urls),
                        "tavily_urls": len(tavily_urls),
                        "success_count": success_count,
                        "processed_urls": processed_data[:100] # Store only a subset to avoid huge JSON
                    },
                    execution_time_ms=int((datetime.utcnow() - execution_start).total_seconds() * 1000)
                )
                db.add(log)
                
                # Update task
                task = db.query(DeepWebsiteCrawlTask).filter(DeepWebsiteCrawlTask.id == task_id).first()
                if task:
                    task.last_executed = datetime.utcnow()
                    task.last_success = datetime.utcnow()
                    task.status = "active"
                    task.consecutive_failures = 0
                
                db.commit()

            return {
                "success": True,
                "total_urls": len(unique_urls),
                "sitemap_urls": len(sitemap_urls),
                "tavily_urls": len(tavily_urls),
                "processed_urls": processed_data
            }

        except Exception as e:
            logger.error(f"Deep crawl failed: {e}")
            if task_id:
                log = DeepWebsiteCrawlExecutionLog(
                    task_id=task_id,
                    status="failed",
                    error_message=str(e),
                    execution_time_ms=int((datetime.utcnow() - execution_start).total_seconds() * 1000)
                )
                db.add(log)
                task = db.query(DeepWebsiteCrawlTask).filter(DeepWebsiteCrawlTask.id == task_id).first()
                if task:
                    task.last_executed = datetime.utcnow()
                    task.last_failure = datetime.utcnow()
                    task.failure_reason = str(e)
                    task.consecutive_failures += 1
                db.commit()
            raise e
        finally:
            db.close()

    async def _process_single_url(self, url: str, user_id: str, website_url: str, workspace_dir: str, tavily_results: List[Dict]):
        """Check liveness, extract content, and save."""
        status_code = None
        error = None
        content = None
        title = None
        
        # 1. Liveness Check
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url)
                status_code = resp.status_code
        except Exception as e:
            error = str(e)
            status_code = 0 # Failed

        # 2. Get content (from Tavily results or generic extraction if needed)
        # Check if we have content from Tavily
        tavily_match = next((r for r in tavily_results if r.get("url") == url), None)
        
        if tavily_match:
            content = tavily_match.get("raw_content") or tavily_match.get("content")
            title = tavily_match.get("title")
        elif status_code and 200 <= status_code < 300:
            # Simple fetch content if valid
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    resp = await client.get(url)
                    content = resp.text
                    # Naive title extraction
                    if "<title>" in content:
                        start = content.find("<title>") + 7
                        end = content.find("</title>")
                        if start > 6 and end > start:
                            title = content[start:end]
            except Exception:
                pass

        # 3. Save to Document
        if content and title:
            safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).strip()[:50]
            if not safe_title:
                safe_title = "untitled"
            filename = f"{safe_title}_{int(datetime.utcnow().timestamp())}.txt"
            filepath = os.path.join(workspace_dir, filename)
            try:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(f"URL: {url}\n")
                    f.write(f"Title: {title}\n")
                    f.write(f"Date: {datetime.utcnow()}\n\n")
                    f.write(content)
            except Exception as e:
                logger.warning(f"Failed to write file for {url}: {e}")

        return {
            "url": url,
            "status_code": status_code,
            "error": error,
            "title": title,
            "content": content
        }

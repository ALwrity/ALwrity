import asyncio
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse

import aiohttp
from bs4 import BeautifulSoup
from loguru import logger
from sqlalchemy.orm import Session

from models.onboarding import SEOPageAudit
from models.website_analysis_monitoring_models import (
    OnboardingFullWebsiteAnalysisTask,
    OnboardingFullWebsiteAnalysisExecutionLog
)
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult
from services.scheduler.core.failure_detection_service import FailureDetectionService

from services.seo_analyzer.analyzers import (
    MetaDataAnalyzer,
    TechnicalSEOAnalyzer,
    ContentAnalyzer,
    URLStructureAnalyzer,
    AccessibilityAnalyzer,
    UserExperienceAnalyzer
)


class OnboardingFullWebsiteAnalysisExecutor(TaskExecutor):
    def __init__(self):
        self.logger = logger.bind(component="OnboardingFullWebsiteAnalysisExecutor")

        self.max_urls_default = 500
        self.http_timeout_seconds = 25
        self.http_concurrency = 10

        self.healthy_threshold = 80
        self.warning_threshold = 60

        self.weights = {
            'meta': 0.15,
            'content': 0.20,
            'technical': 0.20,
            'performance': 0.20,
            'accessibility': 0.10,
            'ux': 0.10,
            'security': 0.05,
        }

    async def execute_task(self, task: Any, db: Session) -> TaskExecutionResult:
        start_time = time.time()

        if not isinstance(task, OnboardingFullWebsiteAnalysisTask):
            return TaskExecutionResult(
                success=False,
                error_message="Invalid task type for onboarding full website analysis",
                retryable=False
            )

        task_log = OnboardingFullWebsiteAnalysisExecutionLog(
            task_id=task.id,
            status='running',
            execution_date=datetime.utcnow()
        )
        db.add(task_log)
        db.commit()

        user_id = str(task.user_id)
        website_url = task.website_url
        payload = task.payload or {}

        max_urls = int(payload.get('max_urls') or self.max_urls_default)

        try:
            urls = await self._discover_urls(website_url, max_urls=max_urls)
            if not urls:
                raise ValueError("No URLs discovered for full-site analysis")

            results = await self._audit_urls(user_id, website_url, urls, db)

            task.last_executed = datetime.utcnow()
            task.last_success = datetime.utcnow()
            task.status = 'completed'  # Explicitly mark as completed instead of paused
            task.next_execution = None
            task.consecutive_failures = 0
            task.failure_pattern = None
            task.failure_reason = None

            task_log.status = 'success'
            task_log.result_data = results
            task_log.execution_time_ms = int((time.time() - start_time) * 1000)

            db.commit()

            return TaskExecutionResult(
                success=True,
                result_data=results,
                execution_time_ms=task_log.execution_time_ms,
                retryable=False
            )

        except Exception as e:
            db.rollback()
            self.logger.error(f"Full-site SEO audit task failed: {e}", exc_info=True)

            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(task.id, 'onboarding_full_website_analysis', user_id)

            task.last_executed = datetime.utcnow()
            task.last_failure = datetime.utcnow()
            task.failure_reason = str(e)
            task.consecutive_failures = (task.consecutive_failures or 0) + 1

            if pattern and pattern.should_cool_off:
                task.status = "needs_intervention"
                task.failure_pattern = {
                    "consecutive_failures": pattern.consecutive_failures,
                    "recent_failures": pattern.recent_failures,
                    "failure_reason": pattern.failure_reason.value,
                    "error_patterns": pattern.error_patterns,
                    "cool_off_until": (datetime.utcnow() + timedelta(days=7)).isoformat()
                }
                task.next_execution = None
            else:
                task.status = "failed"
                task.next_execution = datetime.utcnow() + timedelta(minutes=30)

            task_log.status = 'failed'
            task_log.error_message = str(e)
            task_log.execution_time_ms = int((time.time() - start_time) * 1000)

            db.add(task_log)
            db.commit()

            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                execution_time_ms=task_log.execution_time_ms,
                retryable=(task.status != "needs_intervention"),
                retry_delay=1800
            )

    def calculate_next_execution(
        self,
        task: Any,
        frequency: str,
        last_execution: Optional[datetime] = None
    ) -> datetime:
        base = last_execution or datetime.utcnow()
        return base + timedelta(days=365)

    async def _discover_urls(self, website_url: str, max_urls: int) -> List[str]:
        base = self._normalize_url(website_url)
        parsed = urlparse(base)
        root = f"{parsed.scheme}://{parsed.netloc}"

        sitemap_urls: List[str] = []

        robots = await self._fetch_text(urljoin(root, "/robots.txt"))
        if robots:
            for line in robots.splitlines():
                if line.lower().startswith("sitemap:"):
                    sitemap_urls.append(line.split(":", 1)[1].strip())

        if not sitemap_urls:
            candidates = [
                urljoin(root, "/sitemap.xml"),
                urljoin(root, "/sitemap_index.xml"),
                urljoin(root, "/wp-sitemap.xml"),
            ]
            sitemap_urls.extend(candidates)

        discovered: List[str] = []
        seen: Set[str] = set()

        for sm in sitemap_urls:
            if len(discovered) >= max_urls:
                break
            urls_from_sm = await self._parse_sitemap(sm, max_urls=max_urls - len(discovered))
            for u in urls_from_sm:
                n = self._normalize_url(u)
                if n not in seen and self._same_site(root, n):
                    seen.add(n)
                    discovered.append(n)
                    if len(discovered) >= max_urls:
                        break

        if not discovered:
            discovered.append(base)

        return discovered

    async def _parse_sitemap(self, sitemap_url: str, max_urls: int) -> List[str]:
        xml_text = await self._fetch_text(sitemap_url)
        if not xml_text:
            return []

        try:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(xml_text)
        except Exception:
            return []

        ns = ""
        if root.tag.startswith("{"):
            ns = root.tag.split("}", 1)[0] + "}"

        urls: List[str] = []

        if root.tag.endswith("sitemapindex"):
            locs = root.findall(f".//{ns}sitemap/{ns}loc")
            for loc in locs:
                if len(urls) >= max_urls:
                    break
                child_url = (loc.text or "").strip()
                if not child_url:
                    continue
                child_urls = await self._parse_sitemap(child_url, max_urls=max_urls - len(urls))
                urls.extend(child_urls)
        else:
            locs = root.findall(f".//{ns}url/{ns}loc")
            for loc in locs:
                if len(urls) >= max_urls:
                    break
                u = (loc.text or "").strip()
                if u:
                    urls.append(u)

        return urls

    async def _fetch_text(self, url: str) -> Optional[str]:
        try:
            timeout = aiohttp.ClientTimeout(total=self.http_timeout_seconds)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, allow_redirects=True, headers={"User-Agent": "ALwrity-SEO-Audit/1.0"}) as resp:
                    if resp.status >= 400:
                        return None
                    return await resp.text(errors="ignore")
        except Exception:
            return None

    async def _audit_urls(self, user_id: str, website_url: str, urls: List[str], db: Session) -> Dict[str, Any]:
        timeout = aiohttp.ClientTimeout(total=self.http_timeout_seconds)
        connector = aiohttp.TCPConnector(limit=self.http_concurrency)

        semaphore = asyncio.Semaphore(self.http_concurrency)

        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            async def audit_one(url: str) -> Dict[str, Any]:
                async with semaphore:
                    return await self._audit_single_url(user_id, website_url, url, session, db)

            audited = await asyncio.gather(*[audit_one(u) for u in urls], return_exceptions=True)

        successes = [r for r in audited if isinstance(r, dict) and r.get('success')]
        failures = [r for r in audited if not (isinstance(r, dict) and r.get('success'))]

        avg_score = round(sum(r['overall_score'] for r in successes) / len(successes)) if successes else 0
        fix_scheduled = len([r for r in successes if r.get('status') == 'fix_scheduled'])

        worst_pages = sorted(
            [{'page_url': r['page_url'], 'overall_score': r['overall_score'], 'status': r.get('status')} for r in successes],
            key=lambda x: x['overall_score']
        )[:10]

        return {
            'website_url': website_url,
            'pages_discovered': len(urls),
            'pages_audited': len(successes),
            'pages_failed': len(failures),
            'avg_score': avg_score,
            'fix_scheduled_pages': fix_scheduled,
            'worst_pages': worst_pages,
        }

    async def _audit_single_url(
        self,
        user_id: str,
        website_url: str,
        page_url: str,
        session: aiohttp.ClientSession,
        db: Session
    ) -> Dict[str, Any]:
        fetch_start = time.time()
        try:
            async with session.get(page_url, allow_redirects=True, headers={"User-Agent": "ALwrity-SEO-Audit/1.0"}) as resp:
                status = resp.status
                content_type = resp.headers.get("Content-Type", "")
                text = await resp.text(errors="ignore")
                headers = dict(resp.headers)
        except Exception as e:
            self._upsert_page_audit(
                db=db,
                user_id=user_id,
                website_url=website_url,
                page_url=page_url,
                overall_score=0,
                status='error',
                audit_data={'error': str(e)}
            )
            return {'success': False, 'page_url': page_url, 'error': str(e)}

        load_time = time.time() - fetch_start

        if status >= 400 or "text/html" not in content_type.lower():
            self._upsert_page_audit(
                db=db,
                user_id=user_id,
                website_url=website_url,
                page_url=page_url,
                overall_score=0,
                status='error',
                audit_data={'http_status': status, 'content_type': content_type}
            )
            return {'success': False, 'page_url': page_url, 'error': f'HTTP {status} / {content_type}'}

        soup = BeautifulSoup(text, 'html.parser')

        meta = MetaDataAnalyzer().analyze(soup)
        content = ContentAnalyzer().analyze(soup)
        technical = TechnicalSEOAnalyzer().analyze(page_url, soup)
        url_structure = URLStructureAnalyzer().analyze(page_url)
        accessibility = AccessibilityAnalyzer().analyze(text)
        ux = UserExperienceAnalyzer().analyze(text, page_url)

        performance = self._performance_from_fetch(load_time, headers)
        security = self._security_from_headers(headers)

        category_scores = {
            'meta': meta.get('score', 0),
            'content': content.get('score', 0),
            'technical': technical.get('score', 0),
            'performance': performance.get('score', 0),
            'accessibility': accessibility.get('score', 0),
            'ux': ux.get('score', 0),
            'security': security.get('score', 0),
            'url_structure': url_structure.get('score', 0),
        }

        overall_score = self._weighted_score(category_scores)

        if overall_score >= self.healthy_threshold:
            page_status = 'healthy'
        elif overall_score >= self.warning_threshold:
            page_status = 'needs_review'
        else:
            page_status = 'fix_scheduled'

        audit_data = {
            'meta': meta,
            'content_health': content,
            'technical': technical,
            'performance': performance,
            'url_structure': url_structure,
            'accessibility': accessibility,
            'ux': ux,
            'security_headers': security,
            'overall_score': overall_score,
        }

        issues = self._collect_findings(audit_data, key='issues')
        warnings = self._collect_findings(audit_data, key='warnings')
        recommendations = self._collect_findings(audit_data, key='recommendations')

        self._upsert_page_audit(
            db=db,
            user_id=user_id,
            website_url=website_url,
            page_url=page_url,
            overall_score=overall_score,
            status=page_status,
            category_scores=category_scores,
            issues=issues,
            warnings=warnings,
            recommendations=recommendations,
            audit_data=audit_data
        )

        return {
            'success': True,
            'page_url': page_url,
            'overall_score': overall_score,
            'status': page_status
        }

    def _weighted_score(self, category_scores: Dict[str, int]) -> int:
        total = 0.0
        for key, weight in self.weights.items():
            total += float(category_scores.get(key, 0)) * weight
        return int(round(total))

    def _collect_findings(self, audit_data: Dict[str, Any], key: str) -> List[Dict[str, Any]]:
        findings: List[Dict[str, Any]] = []
        for category, data in audit_data.items():
            if not isinstance(data, dict):
                continue
            items = data.get(key)
            if not isinstance(items, list):
                continue
            for item in items:
                if isinstance(item, dict):
                    enriched = dict(item)
                    enriched.setdefault('category', category)
                    findings.append(enriched)
        return findings

    def _performance_from_fetch(self, load_time: float, headers: Dict[str, str]) -> Dict[str, Any]:
        issues: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        recommendations: List[Dict[str, Any]] = []

        if load_time > 3:
            issues.append({
                'type': 'critical',
                'message': f'Page load time too slow ({load_time:.2f}s)',
                'location': 'Page performance',
                'current_value': f'{load_time:.2f}s',
                'fix': 'Optimize page speed (target < 3 seconds)',
                'code_example': 'Optimize images, minify CSS/JS, use CDN',
                'action': 'optimize_page_speed'
            })
        elif load_time > 2:
            warnings.append({
                'type': 'warning',
                'message': f'Page load time could be improved ({load_time:.2f}s)',
                'location': 'Page performance',
                'current_value': f'{load_time:.2f}s',
                'fix': 'Optimize for faster loading',
                'code_example': 'Compress images, enable caching',
                'action': 'improve_page_speed'
            })

        content_encoding = headers.get('Content-Encoding')
        if not content_encoding:
            warnings.append({
                'type': 'warning',
                'message': 'No compression detected',
                'location': 'Server configuration',
                'fix': 'Enable GZIP/Brotli compression',
                'code_example': 'Enable compression in server or CDN',
                'action': 'enable_compression'
            })

        cache_headers = ['Cache-Control', 'Expires', 'ETag']
        has_cache = any(headers.get(h) for h in cache_headers)
        if not has_cache:
            warnings.append({
                'type': 'warning',
                'message': 'No caching headers found',
                'location': 'Server configuration',
                'fix': 'Add caching headers',
                'code_example': 'Cache-Control: max-age=31536000',
                'action': 'add_caching_headers'
            })

        score = max(0, 100 - len(issues) * 25 - len(warnings) * 10)
        return {
            'score': score,
            'load_time': load_time,
            'is_compressed': bool(content_encoding),
            'has_cache': has_cache,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations
        }

    def _security_from_headers(self, headers: Dict[str, str]) -> Dict[str, Any]:
        security_headers = {
            'X-Frame-Options': headers.get('X-Frame-Options'),
            'X-Content-Type-Options': headers.get('X-Content-Type-Options'),
            'X-XSS-Protection': headers.get('X-XSS-Protection'),
            'Strict-Transport-Security': headers.get('Strict-Transport-Security'),
            'Content-Security-Policy': headers.get('Content-Security-Policy'),
            'Referrer-Policy': headers.get('Referrer-Policy')
        }

        issues: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        recommendations: List[Dict[str, Any]] = []
        present_headers: List[str] = []
        missing_headers: List[str] = []

        for header_name, header_value in security_headers.items():
            if header_value:
                present_headers.append(header_name)
                continue

            missing_headers.append(header_name)
            if header_name in ['X-Frame-Options', 'X-Content-Type-Options']:
                issues.append({
                    'type': 'critical',
                    'message': f'Missing {header_name} header',
                    'location': 'Server configuration',
                    'fix': f'Add {header_name} header',
                    'code_example': f'{header_name}: DENY' if header_name == 'X-Frame-Options' else f'{header_name}: nosniff',
                    'action': f'add_{header_name.lower().replace("-", "_")}_header'
                })
            else:
                warnings.append({
                    'type': 'warning',
                    'message': f'Missing {header_name} header',
                    'location': 'Server configuration',
                    'fix': f'Add {header_name} header for better security',
                    'code_example': f'{header_name}: max-age=31536000',
                    'action': f'add_{header_name.lower().replace("-", "_")}_header'
                })

        score = min(100, len(present_headers) * 16)
        return {
            'score': score,
            'present_headers': present_headers,
            'missing_headers': missing_headers,
            'total_headers': len(present_headers),
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations
        }

    def _upsert_page_audit(
        self,
        db: Session,
        user_id: str,
        website_url: str,
        page_url: str,
        overall_score: int,
        status: str,
        category_scores: Optional[Dict[str, Any]] = None,
        issues: Optional[List[Dict[str, Any]]] = None,
        warnings: Optional[List[Dict[str, Any]]] = None,
        recommendations: Optional[List[Dict[str, Any]]] = None,
        audit_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        existing = db.query(SEOPageAudit).filter(
            SEOPageAudit.user_id == user_id,
            SEOPageAudit.page_url == page_url
        ).first()

        if existing:
            existing.website_url = website_url
            existing.overall_score = overall_score
            existing.status = status
            existing.category_scores = category_scores
            existing.issues = issues
            existing.warnings = warnings
            existing.recommendations = recommendations
            existing.audit_data = audit_data
            existing.last_analyzed_at = datetime.utcnow()
            db.add(existing)
        else:
            db.add(SEOPageAudit(
                user_id=user_id,
                website_url=website_url,
                page_url=page_url,
                overall_score=overall_score,
                status=status,
                category_scores=category_scores,
                issues=issues,
                warnings=warnings,
                recommendations=recommendations,
                audit_data=audit_data,
                last_analyzed_at=datetime.utcnow()
            ))

        db.commit()

    def _normalize_url(self, url: str) -> str:
        u = (url or "").strip()
        if not u:
            return ""
        if not u.startswith("http://") and not u.startswith("https://"):
            u = "https://" + u
        parsed = urlparse(u)
        normalized = parsed._replace(fragment="").geturl()
        return normalized.rstrip("/")

    def _same_site(self, root: str, url: str) -> bool:
        try:
            a = urlparse(root)
            b = urlparse(url)
            return a.netloc == b.netloc
        except Exception:
            return False


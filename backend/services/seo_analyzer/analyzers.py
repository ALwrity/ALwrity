"""
SEO Analyzers Module
Contains all individual SEO analysis components.
"""

import re
import time
import requests
from urllib.parse import urlparse, urljoin
from typing import Dict, List, Any, Optional
from bs4 import BeautifulSoup
from loguru import logger


class BaseAnalyzer:
    """Base class for all SEO analyzers"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })


class URLStructureAnalyzer(BaseAnalyzer):
    """Analyzes URL structure and security"""
    
    def analyze(self, url: str) -> Dict[str, Any]:
        """Enhanced URL structure analysis with specific fixes"""
        parsed = urlparse(url)
        issues = []
        warnings = []
        recommendations = []
        
        # Check URL length
        if len(url) > 2000:
            issues.append({
                'type': 'critical',
                'message': f'URL is too long ({len(url)} characters)',
                'location': 'URL',
                'current_value': url,
                'fix': 'Shorten URL to under 2000 characters',
                'code_example': f'<a href="/shorter-path">Link</a>',
                'action': 'shorten_url'
            })
        
        # Check for hyphens
        if '_' in parsed.path and '-' not in parsed.path:
            issues.append({
                'type': 'critical',
                'message': 'URL uses underscores instead of hyphens',
                'location': 'URL',
                'current_value': parsed.path,
                'fix': 'Replace underscores with hyphens',
                'code_example': f'<a href="{parsed.path.replace("_", "-")}">Link</a>',
                'action': 'replace_underscores'
            })
        
        # Check for special characters
        special_chars = re.findall(r'[^a-zA-Z0-9\-_/]', parsed.path)
        if special_chars:
            warnings.append({
                'type': 'warning',
                'message': f'URL contains special characters: {", ".join(set(special_chars))}',
                'location': 'URL',
                'current_value': parsed.path,
                'fix': 'Remove special characters from URL',
                'code_example': f'<a href="/clean-url">Link</a>',
                'action': 'remove_special_chars'
            })
        
        # Check for HTTPS
        if parsed.scheme != 'https':
            issues.append({
                'type': 'critical',
                'message': 'URL is not using HTTPS',
                'location': 'URL',
                'current_value': parsed.scheme,
                'fix': 'Redirect to HTTPS',
                'code_example': 'RewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]',
                'action': 'enable_https'
            })
        
        score = max(0, 100 - len(issues) * 25 - len(warnings) * 10)
        
        return {
            'score': score,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations,
            'url_length': len(url),
            'has_https': parsed.scheme == 'https',
            'has_hyphens': '-' in parsed.path,
            'special_chars_count': len(special_chars)
        }


class MetaDataAnalyzer(BaseAnalyzer):
    """Analyzes meta data and technical SEO elements"""

    def analyze(self, html_content: str, url: str, soup: Optional[BeautifulSoup] = None) -> Dict[str, Any]:
        """Enhanced meta data analysis with specific element locations"""
        if soup is None:
            soup = BeautifulSoup(html_content, 'html.parser')
        issues = []
        warnings = []
        recommendations = []
        
        # Title analysis
        title_tag = soup.find('title')
        if not title_tag:
            issues.append({
                'type': 'critical',
                'message': 'Missing title tag',
                'location': '<head>',
                'fix': 'Add title tag to head section',
                'code_example': '<title>Your Page Title</title>',
                'action': 'add_title_tag'
            })
        else:
            title_text = title_tag.get_text().strip()
            if len(title_text) < 30:
                warnings.append({
                    'type': 'warning',
                    'message': f'Title too short ({len(title_text)} characters)',
                    'location': '<title>',
                    'current_value': title_text,
                    'fix': 'Make title 30-60 characters',
                    'code_example': f'<title>{title_text} - Additional Context</title>',
                    'action': 'extend_title'
                })
            elif len(title_text) > 60:
                warnings.append({
                    'type': 'warning',
                    'message': f'Title too long ({len(title_text)} characters)',
                    'location': '<title>',
                    'current_value': title_text,
                    'fix': 'Shorten title to 30-60 characters',
                    'code_example': f'<title>{title_text[:55]}...</title>',
                    'action': 'shorten_title'
                })
        
        # Meta description analysis
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if not meta_desc:
            issues.append({
                'type': 'critical',
                'message': 'Missing meta description',
                'location': '<head>',
                'fix': 'Add meta description',
                'code_example': '<meta name="description" content="Your page description here">',
                'action': 'add_meta_description'
            })
        else:
            desc_content = meta_desc.get('content', '').strip()
            if len(desc_content) < 70:
                warnings.append({
                    'type': 'warning',
                    'message': f'Meta description too short ({len(desc_content)} characters)',
                    'location': '<meta name="description">',
                    'current_value': desc_content,
                    'fix': 'Extend description to 70-160 characters',
                    'code_example': f'<meta name="description" content="{desc_content} - Additional context about your page">',
                    'action': 'extend_meta_description'
                })
            elif len(desc_content) > 160:
                warnings.append({
                    'type': 'warning',
                    'message': f'Meta description too long ({len(desc_content)} characters)',
                    'location': '<meta name="description">',
                    'current_value': desc_content,
                    'fix': 'Shorten description to 70-160 characters',
                    'code_example': f'<meta name="description" content="{desc_content[:155]}...">',
                    'action': 'shorten_meta_description'
                })
        
        # Viewport meta tag
        viewport = soup.find('meta', attrs={'name': 'viewport'})
        if not viewport:
            issues.append({
                'type': 'critical',
                'message': 'Missing viewport meta tag',
                'location': '<head>',
                'fix': 'Add viewport meta tag for mobile optimization',
                'code_example': '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
                'action': 'add_viewport_meta'
            })
        
        # Charset declaration
        charset = soup.find('meta', attrs={'charset': True}) or soup.find('meta', attrs={'http-equiv': 'Content-Type'})
        if not charset:
            warnings.append({
                'type': 'warning',
                'message': 'Missing charset declaration',
                'location': '<head>',
                'fix': 'Add charset meta tag',
                'code_example': '<meta charset="UTF-8">',
                'action': 'add_charset_meta'
            })
            
        # Social Tags (Open Graph)
        og_title = soup.find('meta', property='og:title')
        og_desc = soup.find('meta', property='og:description')
        og_image = soup.find('meta', property='og:image')
        
        if not og_title or not og_image:
            warnings.append({
                'type': 'warning',
                'message': 'Missing Open Graph tags for social sharing',
                'location': '<head>',
                'fix': 'Add Open Graph meta tags',
                'code_example': '<meta property="og:title" content="Title">\n<meta property="og:image" content="image.jpg">',
                'action': 'add_og_tags'
            })
            
        # Twitter Card
        twitter_card = soup.find('meta', attrs={'name': 'twitter:card'})
        if not twitter_card:
            recommendations.append({
                'type': 'recommendation',
                'message': 'Missing Twitter Card metadata',
                'location': '<head>',
                'fix': 'Add Twitter Card meta tags',
                'code_example': '<meta name="twitter:card" content="summary_large_image">',
                'action': 'add_twitter_card'
            })

        # Robots Meta
        robots = soup.find('meta', attrs={'name': 'robots'})
        if not robots:
             recommendations.append({
                'type': 'recommendation',
                'message': 'No robots meta tag found (defaults to index, follow)',
                'location': '<head>',
                'fix': 'Add robots meta tag if you need to control crawling',
                'code_example': '<meta name="robots" content="index, follow">',
                'action': 'add_robots_meta'
            })
        
        score = max(0, 100 - len(issues) * 25 - len(warnings) * 10)
        
        og_found = list(filter(None, ['Title' if og_title else '', 'Desc' if og_desc else '', 'Image' if og_image else '']))

        return {
            'score': score,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations,
            'title_length': len(title_tag.get_text().strip()) if title_tag else 0,
            'description_length': len(meta_desc.get('content', '')) if meta_desc else 0,
            'has_viewport': bool(viewport),
            'has_charset': bool(charset),
            'og_tags': f"Found: {', '.join(og_found)}" if og_found else "None",
            'twitter_card': twitter_card['content'] if twitter_card else "Missing",
            'robots_meta': robots['content'] if robots else "Missing (Default: index, follow)"
        }


class ContentAnalyzer(BaseAnalyzer):
    """Analyzes content quality and structure"""

    def analyze(self, html_content: str, url: str, soup: Optional[BeautifulSoup] = None) -> Dict[str, Any]:
        """Enhanced content analysis with specific text locations"""
        if soup is None:
            soup = BeautifulSoup(html_content, 'html.parser')
        issues = []
        warnings = []
        recommendations = []
        
        # Get all text content (exclude boilerplate so nav/footer links don't
        # concatenate into one giant "word" and trip the spelling check).
        for tag in soup(["script", "style", "nav", "header", "footer", "noscript"]):
            tag.decompose()
        text_content = soup.get_text(separator=" ", strip=True)
        words = text_content.split()
        word_count = len(words)
        
        # Check word count
        if word_count < 300:
            issues.append({
                'type': 'critical',
                'message': f'Content too short ({word_count} words)',
                'location': 'Page content',
                'current_value': f'{word_count} words',
                'fix': 'Add more valuable content (minimum 300 words)',
                'code_example': 'Add relevant paragraphs with useful information',
                'action': 'add_more_content'
            })
        
        # Check for H1 tags
        h1_tags = soup.find_all('h1')
        if len(h1_tags) == 0:
            issues.append({
                'type': 'critical',
                'message': 'Missing H1 tag',
                'location': 'Page structure',
                'fix': 'Add one H1 tag per page',
                'code_example': '<h1>Your Main Page Title</h1>',
                'action': 'add_h1_tag'
            })
        elif len(h1_tags) > 1:
            warnings.append({
                'type': 'warning',
                'message': f'Multiple H1 tags found ({len(h1_tags)})',
                'location': 'Page structure',
                'current_value': f'{len(h1_tags)} H1 tags',
                'fix': 'Use only one H1 tag per page',
                'code_example': 'Keep only the main H1, change others to H2',
                'action': 'reduce_h1_tags'
            })
        
        # Track images for metadata (alt check moved to AccessibilityAnalyzer)
        images = soup.find_all('img')

        # Check for internal links
        internal_links = soup.find_all('a', href=re.compile(r'^[^http]'))
        if len(internal_links) < 3:
            warnings.append({
                'type': 'warning',
                'message': f'Few internal links ({len(internal_links)} found)',
                'location': 'Page content',
                'current_value': f'{len(internal_links)} internal links',
                'fix': 'Add more internal links to improve site structure',
                'code_example': '<a href="/related-page">Related content</a>',
                'action': 'add_internal_links'
            })
        
        # Check for spelling errors (basic check)
        potential_errors = []
        for word in words[:200]:  # Check first 200 words
            w = word.lower().strip(".,;:!?()[]{}\"'")
            # Skip short words, hyphenated/compound terms, and any token with
            # digits or internal capitals (URLs, nav labels, code, brand names).
            if len(w) <= 3 or not w.isalpha():
                continue
            if any(c.isupper() for c in word):
                continue
            # Only flag unusually long lowercase runs (likely misspelled), and
            # require a suspicious consonant-heavy pattern rather than flagging
            # every legitimately long word (e.g. "personalization").
            if len(w) >= 20 and re.search(r'(.)\1{2,}', w):
                potential_errors.append(word)
        
        if potential_errors:
            issues.append({
                'type': 'critical',
                'message': f'Potential spelling errors found: {", ".join(potential_errors[:5])}',
                'location': 'Page content',
                'current_value': f'{len(potential_errors)} potential errors',
                'fix': 'Review and correct spelling errors',
                'code_example': 'Use spell checker or proofread content',
                'action': 'fix_spelling'
            })
        
        score = max(0, 100 - len(issues) * 25 - len(warnings) * 10)
        
        return {
            'score': score,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations,
            'word_count': word_count,
            'h1_count': len(h1_tags),
            'images_count': len(images),
            'images_without_alt': 0,
            'internal_links_count': len(internal_links),
            'potential_spelling_errors': len(potential_errors)
        }


class TechnicalSEOAnalyzer(BaseAnalyzer):
    """Analyzes technical SEO elements"""

    def analyze(self, html_content: str, url: str, soup: Optional[BeautifulSoup] = None) -> Dict[str, Any]:
        """Enhanced technical SEO analysis with specific fixes"""
        if soup is None:
            soup = BeautifulSoup(html_content, 'html.parser')
        issues = []
        warnings = []
        recommendations = []
        
        # Check for robots.txt
        robots_url = urljoin(url, '/robots.txt')
        try:
            robots_response = self.session.get(robots_url, timeout=5)
            if robots_response.status_code != 200:
                warnings.append({
                    'type': 'warning',
                    'message': 'Robots.txt not accessible',
                    'location': 'Server',
                    'fix': 'Create robots.txt file',
                    'code_example': 'User-agent: *\nAllow: /',
                    'action': 'create_robots_txt'
                })
        except:
            warnings.append({
                'type': 'warning',
                'message': 'Robots.txt not found',
                'location': 'Server',
                'fix': 'Create robots.txt file',
                'code_example': 'User-agent: *\nAllow: /',
                'action': 'create_robots_txt'
            })
        
        # Check for sitemap
        sitemap_url = urljoin(url, '/sitemap.xml')
        try:
            sitemap_response = self.session.get(sitemap_url, timeout=5)
            if sitemap_response.status_code != 200:
                warnings.append({
                    'type': 'warning',
                    'message': 'Sitemap not accessible',
                    'location': 'Server',
                    'fix': 'Create XML sitemap',
                    'code_example': '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url>\n<loc>https://example.com/</loc>\n</url>\n</urlset>',
                    'action': 'create_sitemap'
                })
        except:
            warnings.append({
                'type': 'warning',
                'message': 'Sitemap not found',
                'location': 'Server',
                'fix': 'Create XML sitemap',
                'code_example': '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url>\n<loc>https://example.com/</loc>\n</url>\n</urlset>',
                'action': 'create_sitemap'
            })
        
        # Check for structured data
        structured_data = soup.find_all('script', type='application/ld+json')
        if not structured_data:
            warnings.append({
                'type': 'warning',
                'message': 'No structured data found',
                'location': '<head> or <body>',
                'fix': 'Add structured data markup',
                'code_example': '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Page Title"}</script>',
                'action': 'add_structured_data'
            })
        
        # Check for canonical URL
        canonical = soup.find('link', rel='canonical')
        if not canonical:
            issues.append({
                'type': 'critical',
                'message': 'Missing canonical URL',
                'location': '<head>',
                'fix': 'Add canonical URL',
                'code_example': '<link rel="canonical" href="https://example.com/page">',
                'action': 'add_canonical_url'
            })
        
        score = max(0, 100 - len(issues) * 25 - len(warnings) * 10)
        
        return {
            'score': score,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations,
            'has_robots_txt': len([w for w in warnings if 'robots.txt' in w['message']]) == 0,
            'has_sitemap': len([w for w in warnings if 'sitemap' in w['message']]) == 0,
            'has_structured_data': bool(structured_data),
            'schema_markup': f"Found {len(structured_data)} schema objects",
            'has_canonical': bool(canonical),
            'canonical_tag': canonical['href'] if canonical else "Missing",
            'h1_count': 0
        }


class PerformanceAnalyzer(BaseAnalyzer):
    """Analyzes page performance"""
    
    def analyze(self, url: str) -> Dict[str, Any]:
        """Enhanced performance analysis with specific fixes"""
        try:
            start_time = time.time()
            response = self.session.get(url, timeout=20)
            load_time = time.time() - start_time
            
            issues = []
            warnings = []
            recommendations = []
            
            # Check load time
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
            
            # Check for compression
            content_encoding = response.headers.get('Content-Encoding')
            if not content_encoding:
                warnings.append({
                    'type': 'warning',
                    'message': 'No compression detected',
                    'location': 'Server configuration',
                    'fix': 'Enable GZIP compression',
                    'code_example': 'Add to .htaccess: SetOutputFilter DEFLATE',
                    'action': 'enable_compression'
                })
            
            # Check for caching headers
            cache_headers = ['Cache-Control', 'Expires', 'ETag']
            has_cache = any(response.headers.get(header) for header in cache_headers)
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
        except Exception as e:
            logger.warning(f"Performance analysis failed for {url}: {e}")
            return {
                'score': 0, 'error': f'Performance analysis failed: {str(e)}',
                'load_time': 0, 'is_compressed': False, 'has_cache': False,
                'issues': [{'type': 'critical', 'message': 'Performance analysis failed', 'location': 'Page', 'fix': 'Check page speed manually', 'action': 'manual_check'}],
                'warnings': [{'type': 'warning', 'message': 'Could not analyze performance', 'location': 'Page', 'fix': 'Use PageSpeed Insights', 'action': 'manual_check'}],
                'recommendations': [{'type': 'recommendation', 'message': 'Check page speed manually', 'priority': 'medium', 'action': 'manual_check'}]
            }


class AccessibilityAnalyzer(BaseAnalyzer):
    """Analyzes accessibility features"""

    def analyze(self, html_content: str, soup: Optional[BeautifulSoup] = None) -> Dict[str, Any]:
        """Enhanced accessibility analysis with specific fixes"""
        if soup is None:
            soup = BeautifulSoup(html_content, 'html.parser')
        issues = []
        warnings = []
        recommendations = []
        
        # Check for alt text on images
        images = soup.find_all('img')
        images_without_alt = [img for img in images if not img.get('alt')]
        if images_without_alt:
            issues.append({
                'type': 'critical',
                'message': f'Images without alt text ({len(images_without_alt)} found)',
                'location': 'Images',
                'current_value': f'{len(images_without_alt)} images without alt',
                'fix': 'Add descriptive alt text to all images',
                'code_example': '<img src="image.jpg" alt="Descriptive text about the image">',
                'action': 'add_alt_text'
            })
        
        # Check for form labels
        forms = soup.find_all('form')
        for form in forms:
            inputs = form.find_all(['input', 'textarea', 'select'])
            for input_elem in inputs:
                if input_elem.get('type') not in ['hidden', 'submit', 'button']:
                    input_id = input_elem.get('id')
                    if input_id:
                        label = soup.find('label', attrs={'for': input_id})
                        if not label:
                            warnings.append({
                                'type': 'warning',
                                'message': f'Input without label (ID: {input_id})',
                                'location': 'Form',
                                'current_value': f'Input ID: {input_id}',
                                'fix': 'Add label for input field',
                                'code_example': f'<label for="{input_id}">Field Label</label>',
                                'action': 'add_form_label'
                            })
        
        # Track headings for metadata (H1 check moved to ContentAnalyzer)
        headings = []

        # Check for color contrast (basic check)
        style_tags = soup.find_all('style')
        inline_styles = soup.find_all(style=True)
        if style_tags or inline_styles:
            warnings.append({
                'type': 'warning',
                'message': 'Custom styles found - check color contrast',
                'location': 'CSS',
                'fix': 'Ensure sufficient color contrast (4.5:1 for normal text)',
                'code_example': 'Use tools like WebAIM Contrast Checker',
                'action': 'check_color_contrast'
            })
        
        score = max(0, 100 - len(issues) * 25 - len(warnings) * 10)
        
        return {
            'score': score,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations,
            'images_count': len(images),
            'images_without_alt': len(images_without_alt),
            'forms_count': len(forms),
            'headings_count': len(headings)
        }


class UserExperienceAnalyzer(BaseAnalyzer):
    """Analyzes user experience elements"""

    def analyze(self, html_content: str, url: str, soup: Optional[BeautifulSoup] = None) -> Dict[str, Any]:
        """Enhanced user experience analysis with specific fixes"""
        if soup is None:
            soup = BeautifulSoup(html_content, 'html.parser')
        issues = []
        warnings = []
        recommendations = []
        
        # Check for navigation menu
        nav_elements = soup.find_all(['nav', 'ul', 'ol'])
        if not nav_elements:
            warnings.append({
                'type': 'warning',
                'message': 'No navigation menu found',
                'location': 'Page structure',
                'fix': 'Add navigation menu',
                'code_example': '<nav><ul><li><a href="/">Home</a></li></ul></nav>',
                'action': 'add_navigation'
            })
        
        # Check for contact information
        contact_patterns = ['contact', 'phone', 'email', '@', 'tel:']
        page_text = soup.get_text().lower()
        has_contact = any(pattern in page_text for pattern in contact_patterns)
        if not has_contact:
            warnings.append({
                'type': 'warning',
                'message': 'No contact information found',
                'location': 'Page content',
                'fix': 'Add contact information',
                'code_example': '<p>Contact us: <a href="mailto:info@example.com">info@example.com</a></p>',
                'action': 'add_contact_info'
            })
        
        # Check for social media links
        social_patterns = ['facebook', 'twitter', 'linkedin', 'instagram']
        has_social = any(pattern in page_text for pattern in social_patterns)
        if not has_social:
            recommendations.append({
                'type': 'recommendation',
                'message': 'No social media links found',
                'location': 'Page content',
                'fix': 'Add social media links',
                'code_example': '<a href="https://facebook.com/yourpage">Facebook</a>',
                'action': 'add_social_links',
                'priority': 'low'
            })
        
        score = max(0, 100 - len(issues) * 25 - len(warnings) * 10)

        return {
            'score': score,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations,
            'has_viewport': False,  # Check moved to MetaDataAnalyzer
            'has_navigation': bool(nav_elements),
            'has_contact': has_contact,
            'has_social': has_social
        }


class SecurityHeadersAnalyzer(BaseAnalyzer):
    """Analyzes security headers"""
    
    def analyze(self, url: str) -> Dict[str, Any]:
        """Enhanced security headers analysis with specific fixes"""
        try:
            response = self.session.get(url, timeout=15, allow_redirects=True)
            security_headers = {
                'X-Frame-Options': response.headers.get('X-Frame-Options'),
                'X-Content-Type-Options': response.headers.get('X-Content-Type-Options'),
                'X-XSS-Protection': response.headers.get('X-XSS-Protection'),
                'Strict-Transport-Security': response.headers.get('Strict-Transport-Security'),
                'Content-Security-Policy': response.headers.get('Content-Security-Policy'),
                'Referrer-Policy': response.headers.get('Referrer-Policy')
            }
            
            issues = []
            warnings = []
            recommendations = []
            present_headers = []
            missing_headers = []
            
            for header_name, header_value in security_headers.items():
                if header_value:
                    present_headers.append(header_name)
                else:
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
        except Exception as e:
            logger.warning(f"Security headers analysis failed for {url}: {e}")
            return {
                'score': 0, 'error': f'Error analyzing headers: {str(e)}',
                'present_headers': [], 'missing_headers': ['All security headers'],
                'total_headers': 0, 'issues': [{'type': 'critical', 'message': 'Could not analyze security headers', 'location': 'Server', 'fix': 'Check security headers manually', 'action': 'manual_check'}],
                'warnings': [{'type': 'warning', 'message': 'Security headers analysis failed', 'location': 'Server', 'fix': 'Verify security headers manually', 'action': 'manual_check'}],
                'recommendations': [{'type': 'recommendation', 'message': 'Check security headers manually', 'priority': 'medium', 'action': 'manual_check'}]
            }


class KeywordAnalyzer(BaseAnalyzer):
    """Analyzes keyword usage and optimization"""
    
    def analyze(self, html_content: str, target_keywords: Optional[List[str]] = None) -> Dict[str, Any]:
        """Enhanced keyword analysis with specific locations"""
        if not target_keywords:
            return {'score': 0, 'issues': [], 'warnings': [], 'recommendations': []}
        
        soup = BeautifulSoup(html_content, 'html.parser')
        issues = []
        warnings = []
        recommendations = []
        
        page_text = soup.get_text().lower()
        title_text = soup.find('title')
        title_text = title_text.get_text().lower() if title_text else ""
        
        for keyword in target_keywords:
            keyword_lower = keyword.lower()
            
            # Check if keyword is in title
            if keyword_lower not in title_text:
                issues.append({
                    'type': 'critical',
                    'message': f'Target keyword "{keyword}" not in title',
                    'location': '<title>',
                    'current_value': title_text,
                    'fix': f'Include keyword "{keyword}" in title',
                    'code_example': f'<title>{keyword} - Your Page Title</title>',
                    'action': 'add_keyword_to_title'
                })
            
            # Check keyword density
            keyword_count = page_text.count(keyword_lower)
            if keyword_count == 0:
                issues.append({
                    'type': 'critical',
                    'message': f'Target keyword "{keyword}" not found in content',
                    'location': 'Page content',
                    'current_value': '0 occurrences',
                    'fix': f'Include keyword "{keyword}" naturally in content',
                    'code_example': f'Add "{keyword}" to your page content',
                    'action': 'add_keyword_to_content'
                })
            elif keyword_count < 2:
                warnings.append({
                    'type': 'warning',
                    'message': f'Target keyword "{keyword}" appears only {keyword_count} time(s)',
                    'location': 'Page content',
                    'current_value': f'{keyword_count} occurrence(s)',
                    'fix': f'Include keyword "{keyword}" more naturally',
                    'code_example': f'Add more instances of "{keyword}" to content',
                    'action': 'increase_keyword_density'
                })
        
        score = max(0, 100 - len(issues) * 25 - len(warnings) * 10)
        
        return {
            'score': score,
            'issues': issues,
            'warnings': warnings,
            'recommendations': recommendations,
            'target_keywords': target_keywords,
            'keywords_found': [kw for kw in target_keywords if kw.lower() in page_text]
        } 